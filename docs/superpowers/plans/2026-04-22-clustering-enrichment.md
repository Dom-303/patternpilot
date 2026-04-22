# Clustering-Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore README/license/dependency enrichment in the problem-mode `runDiscoveryPass` so `extractRepoKeywords` receives its full four-source signature and `single_cluster_collapse` stops being the default outcome.

**Architecture:** Add an optional `enrichFn` parameter to `runDiscoveryPass` (defaults to `enrichGithubRepo` from `lib/github/enrichment.mjs`). After the verbatim-phrase search aggregates items, enrich each in parallel via `Promise.all`. Map `readme.excerpt`, `licenseId`, and `dependencies` into the flat repo shape. Per-item try/catch ensures one failed enrichment never blocks the rest.

**Tech Stack:** Node.js ESM. Reuses existing `enrichGithubRepo`.

**Spec:** `docs/superpowers/specs/2026-04-22-clustering-enrichment-design.md`

---

## File Structure

**Modified:**
- `lib/discovery/pass.mjs` — add `enrichFn` param, enrichment loop, flat-shape mapping with real data
- `test/discovery-pass-standalone.test.mjs` — inject noop `enrichFn` in existing tests to preserve hermeticity

**Created:**
- `test/discovery-pass-enrichment.test.mjs` — new unit tests for the enrichment path

**Untouched:** `lib/clustering/*`, `lib/discovery/search.mjs`, `lib/github/enrichment.mjs`, problem-mode commands.

---

### Task 1: Enrichment wiring (TDD)

**Files:**
- Create: `test/discovery-pass-enrichment.test.mjs`
- Modify: `lib/discovery/pass.mjs`
- Modify: `test/discovery-pass-standalone.test.mjs`

- [ ] **Step 1: Write failing enrichment tests**

Create `test/discovery-pass-enrichment.test.mjs`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runDiscoveryPass } from "../lib/discovery/pass.mjs";

function fakeSearch(items) {
  return async () => ({ items });
}

test("runDiscoveryPass maps enrichment readme excerpt into flat repo shape", async () => {
  const items = [
    { normalizedRepoUrl: "https://github.com/foo/bar", owner: "foo", name: "bar", description: "d", language: "TypeScript", topics: ["x"] }
  ];
  const enrichFn = async (repo) => ({
    readme: { excerpt: `README for ${repo.owner}/${repo.name}` },
    licenseId: "MIT",
    dependencies: ["dep1"]
  });

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["q"],
    searchFn: fakeSearch(items),
    enrichFn
  });

  assert.equal(repos.length, 1);
  assert.equal(repos[0].readme, "README for foo/bar");
  assert.equal(repos[0].license, "MIT");
  assert.deepEqual(repos[0].dependencies, ["dep1"]);
});

test("runDiscoveryPass enriches multiple repos in parallel and preserves order", async () => {
  const items = [
    { normalizedRepoUrl: "https://github.com/a/1", owner: "a", name: "1", description: null, language: null, topics: [] },
    { normalizedRepoUrl: "https://github.com/b/2", owner: "b", name: "2", description: null, language: null, topics: [] },
    { normalizedRepoUrl: "https://github.com/c/3", owner: "c", name: "3", description: null, language: null, topics: [] }
  ];
  const enrichFn = async (repo) => ({
    readme: { excerpt: `EX-${repo.name}` }
  });

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["q"],
    searchFn: fakeSearch(items),
    enrichFn
  });

  assert.deepEqual(repos.map((r) => r.readme), ["EX-1", "EX-2", "EX-3"]);
});

test("runDiscoveryPass tolerates per-repo enrichment failure without dropping other repos", async () => {
  const items = [
    { normalizedRepoUrl: "https://github.com/ok/1", owner: "ok", name: "1", description: null, language: null, topics: [] },
    { normalizedRepoUrl: "https://github.com/bad/2", owner: "bad", name: "2", description: null, language: null, topics: [] },
    { normalizedRepoUrl: "https://github.com/ok/3", owner: "ok", name: "3", description: null, language: null, topics: [] }
  ];
  const enrichFn = async (repo) => {
    if (repo.owner === "bad") throw new Error("enrichment boom");
    return { readme: { excerpt: `EX-${repo.name}` } };
  };

  const { repos, error } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["q"],
    searchFn: fakeSearch(items),
    enrichFn
  });

  assert.equal(error, undefined, "single-repo enrichment failure is not fatal");
  assert.equal(repos.length, 3);
  assert.equal(repos[0].readme, "EX-1");
  assert.equal(repos[1].readme, null, "failed repo falls back to null");
  assert.equal(repos[2].readme, "EX-3");
});

test("runDiscoveryPass handles enrichment returning error-shaped readme", async () => {
  const items = [
    { normalizedRepoUrl: "https://github.com/x/y", owner: "x", name: "y", description: null, language: null, topics: [] }
  ];
  const enrichFn = async () => ({
    readme: { path: null, htmlUrl: null, excerpt: "", error: "404" }
  });

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["q"],
    searchFn: fakeSearch(items),
    enrichFn
  });

  assert.equal(repos[0].readme, "", "empty excerpt passes through as empty string, not null");
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test test/discovery-pass-enrichment.test.mjs`
Expected: FAIL — current `runDiscoveryPass` ignores `enrichFn` and hard-codes `readme: null`.

- [ ] **Step 3: Modify `lib/discovery/pass.mjs`**

Open `lib/discovery/pass.mjs`. Replace the entire exported `runDiscoveryPass` with:

```js
import { searchGithubRepositories } from "./search.mjs";
import { enrichGithubRepo } from "../github/enrichment.mjs";

/**
 * @param {object} params
 * @param {object}   params.config
 * @param {string}   params.projectKey
 * @param {string[]} params.queries
 * @param {Function} [params.searchFn]
 * @param {Function} [params.enrichFn]  - (repo, config) => enrichment; defaults to enrichGithubRepo
 * @returns {Promise<{ repos: FlatRepo[], error?: string }>}
 */
export async function runDiscoveryPass({
  config,
  projectKey,
  queries,
  searchFn = searchGithubRepositories,
  enrichFn = enrichGithubRepo
}) {
  if (!projectKey) {
    return { repos: [], error: "projectKey required for problem-mode discovery" };
  }
  if (!Array.isArray(queries) || queries.length === 0) {
    return { repos: [] };
  }

  const collected = new Map();
  for (const phrase of queries) {
    try {
      const result = await searchFn(
        config,
        { query: phrase, minSearchResults: 1 },
        { perPage: 10 }
      );
      for (const item of result?.items ?? []) {
        if (item.normalizedRepoUrl && !collected.has(item.normalizedRepoUrl)) {
          collected.set(item.normalizedRepoUrl, item);
        }
      }
    } catch (error) {
      console.warn(`[problem-mode] phrase '${phrase}' search failed: ${error.message}`);
    }
  }

  const items = [...collected.values()];
  const enriched = await Promise.all(
    items.map(async (item) => {
      try {
        const enrichment = await enrichFn({ owner: item.owner, name: item.name }, config);
        return { item, enrichment };
      } catch (err) {
        console.warn(`[problem-mode] enrichment failed for ${item.owner}/${item.name}: ${err.message}`);
        return { item, enrichment: null };
      }
    })
  );

  const repos = enriched.map(({ item, enrichment }) => ({
    id: item.normalizedRepoUrl ?? `${item.owner}/${item.name}`,
    url: item.normalizedRepoUrl ?? null,
    owner: item.owner ?? null,
    name: item.name ?? null,
    description: item.description ?? null,
    language: item.language ?? null,
    topics: Array.isArray(item.topics) ? item.topics : [],
    readme: enrichment?.readme?.excerpt ?? null,
    license: enrichment?.licenseId ?? null,
    dependencies: Array.isArray(enrichment?.dependencies) ? enrichment.dependencies : []
  }));

  return { repos };
}
```

- [ ] **Step 4: Update existing test `test/discovery-pass-standalone.test.mjs`**

Inject a noop `enrichFn` in every `runDiscoveryPass` call in that file. The simplest way: declare a helper at the top:

```js
const noopEnrichFn = async () => ({});
```

and add `enrichFn: noopEnrichFn` to each existing call, for example:

```js
const result = await runDiscoveryPass({
  config: {},
  projectKey: "eventbear-worker",
  queries: ["virtualized list", "react window", "infinite scroll"],
  searchFn: fakeSearchFn,
  enrichFn: noopEnrichFn
});
```

Apply this to all six existing tests in that file. Do not change assertions — only the call signature.

- [ ] **Step 5: Verify GREEN**

Run: `node --test test/discovery-pass-enrichment.test.mjs`
Expected: PASS (4 tests).

Run: `node --test test/discovery-pass-standalone.test.mjs`
Expected: PASS (6 tests, assertions unchanged).

- [ ] **Step 6: Full suite**

Run: `npm test`
Expected: PASS (previous 527 + 4 new enrichment tests = 531).

- [ ] **Step 7: Commit**

```bash
git add lib/discovery/pass.mjs test/discovery-pass-enrichment.test.mjs test/discovery-pass-standalone.test.mjs
git commit -m "feat(problem-mode): enrich candidates with README/license/deps in discovery pass

runDiscoveryPass now runs enrichGithubRepo in parallel per collected
candidate and maps readme.excerpt, licenseId, dependencies into the flat
repo shape. Restores the keyword-extraction signal that the Task-3
refactor had starved, addressing the single_cluster_collapse outcome in
problem-mode runs. Per-repo enrichment failure is non-fatal. enrichFn is
injectable for tests following the existing searchFn DI pattern."
```

---

### Task 2: Smoke validation and comparison

**Files:** none modified; verification only.

- [ ] **Step 1: Re-run `problem:explore`**

From the repo root:

```bash
node scripts/patternpilot.mjs problem-explore self-healing-adaptive-source-intake --project eventbear-worker --depth quick 2>&1 | tail -20
```

Expected: success, written to a new `landscape/<timestamp>/` directory under `projects/eventbear-worker/problems/self-healing-adaptive-source-intake/`.

- [ ] **Step 2: Inspect the new landscape vs. baseline**

Read the new `landscape.json`. Extract:
- `clusters.length`
- `landscape_signal`
- `relation_counts`

Compare to the two baseline runs:
- `2026-04-22T16-02-20-639Z` (pre-enrichment, pre-Layer-2): 1 cluster, `single_cluster_collapse`, 0 divergent.
- `2026-04-22T18-09-18-779Z` (pre-enrichment, post-Layer-2): 1 cluster, `single_cluster_collapse`, 0 divergent.

Success criteria for this MVP: the new run produces `clusters.length >= 2` AND either `relation_counts.divergent > 0` OR multiple clusters with distinct signature contrasts.

- [ ] **Step 3: Record outcome in `OPEN_QUESTION.md`**

Append a `settled_now_twelve` or similar handoff line summarizing:
- Before (run IDs + collapse signal)
- After (new run ID + new cluster count + relation distribution)
- Verdict: "enrichment-driven clustering unblocks diversity" OR "market-whitespace confirmed, Hebel C fallback split queued as next lever".

This is the one deliverable of Task 2 that persists beyond the log. Commit is not required since `OPEN_QUESTION.md` is gitignored local state.

- [ ] **Step 4: No commit** — verification only.

---

## Self-Review Notes

- **Spec coverage:** Decision 1 (enrichment), 2 (parallel), 3 (graceful failure) → all in Task 1's implementation. Testing strategy → Task 1 Steps 1 and 4.
- **Untouched surfaces stay untouched:** clustering, search, enrichment module, problem-mode commands. Verified in File Structure.
- **Type consistency:** `enrichFn({ owner, name }, config) → { readme: { excerpt }, licenseId, dependencies }` matches `enrichGithubRepo`'s real return shape observed in `lib/github/enrichment.mjs`.
- **No placeholders:** every step has complete code or complete commands.
- **TDD discipline:** Task 1 follows RED → GREEN → COMMIT.
- **Failure mode coverage:** four tests (success, parallel-order, per-repo failure, enrichment-error-shape).
