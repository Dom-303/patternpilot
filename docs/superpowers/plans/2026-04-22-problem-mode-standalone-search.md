# Problem-Mode Standalone Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken cohort-injection path in `problem:explore` with a dedicated standalone search path that issues one GitHub query per problem phrase, verbatim, feeding results into the existing problem-mode ranking and clustering pipeline.

**Architecture:** `runDiscoveryPass` loops over problem phrases and calls `searchGithubRepositories` directly (bypassing `buildDiscoveryPlan` and `discoverGithubCandidates`). A `searchFn` parameter enables test-time dependency injection. Results are deduped by `normalizedRepoUrl` and mapped to the flat repo shape the downstream ranking/clustering already consumes. `problem-explore.mjs` drops the obsolete `standalone = !projectKey` logic.

**Tech Stack:** Node.js ESM, native `node:test`, existing primitives in `lib/discovery/`.

**Spec:** `docs/superpowers/specs/2026-04-22-problem-mode-standalone-search-design.md`

---

## File Structure

**Modified:**
- `lib/discovery/search.mjs` — export `searchGithubRepositories`
- `lib/discovery/pass.mjs` — rewrite `runDiscoveryPass` as phrase-loop with `searchFn` injection
- `scripts/commands/problem-explore.mjs` — drop `standalone = !projectKey` flag handling

**Created:**
- `test/discovery-pass-standalone.test.mjs` — regression + unit tests for the new path

**Untouched (intentionally):**
- `lib/discovery/shared.mjs` — `guaranteedSlot` and `priorityCohort` stay as general-purpose infrastructure, just no longer triggered by `problem:explore`
- `lib/discovery/problem-queries.mjs` — `buildProblemQueryFamily` / `splitBudget` already work as needed

---

### Task 1: Export searchGithubRepositories

**Files:**
- Modify: `lib/discovery/search.mjs:274`

- [ ] **Step 1: Add `export` keyword to the function declaration**

Change the existing line:

```js
async function searchGithubRepositories(config, plan, options = {}) {
```

To:

```js
export async function searchGithubRepositories(config, plan, options = {}) {
```

- [ ] **Step 2: Verify nothing else breaks**

Run: `npm test`
Expected: PASS (485/485). Adding `export` to an already-used function cannot break anything that imports it internally.

- [ ] **Step 3: Commit**

```bash
git add lib/discovery/search.mjs
git commit -m "refactor(discovery): export searchGithubRepositories for direct use"
```

---

### Task 2: Regression test — verbatim query shape (RED)

**Files:**
- Create: `test/discovery-pass-standalone.test.mjs`

- [ ] **Step 1: Write the failing regression test**

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { runDiscoveryPass } from "../lib/discovery/pass.mjs";

test("runDiscoveryPass issues one verbatim search per problem phrase", async () => {
  const calls = [];
  const fakeSearchFn = async (_config, plan) => {
    calls.push({ query: plan.query });
    return { items: [] };
  };

  const result = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["virtualized list", "react window", "infinite scroll"],
    searchFn: fakeSearchFn
  });

  assert.equal(result.error, undefined, "no error expected");
  assert.equal(calls.length, 3, "one call per phrase");
  assert.equal(calls[0].query, "virtualized list");
  assert.equal(calls[1].query, "react window");
  assert.equal(calls[2].query, "infinite scroll");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/discovery-pass-standalone.test.mjs`
Expected: FAIL — current `runDiscoveryPass` errors with `standalone_not_supported` or tries to load a real project binding from disk.

- [ ] **Step 3: Commit the failing test**

```bash
git add test/discovery-pass-standalone.test.mjs
git commit -m "test(discovery): add verbatim-query regression test for problem-mode (OQ-009)"
```

---

### Task 3: Rewrite runDiscoveryPass as phrase-loop (GREEN)

**Files:**
- Modify: `lib/discovery/pass.mjs` (full rewrite of the exported function; ~70 lines become ~40)

- [ ] **Step 1: Replace the file contents**

```js
/**
 * lib/discovery/pass.mjs
 *
 * Standalone discovery pass for problem:explore.
 * One GitHub search per problem phrase, verbatim — no project anchor in the
 * query string. Project context re-enters at the ranking / clustering /
 * brief stages, not here.
 *
 * Spec: docs/superpowers/specs/2026-04-22-problem-mode-standalone-search-design.md
 */

import { searchGithubRepositories } from "./search.mjs";

/**
 * @param {object} params
 * @param {object}   params.config       - loaded patternpilot config
 * @param {string}   params.projectKey   - required for the caller contract
 *                                         (ranking downstream needs it)
 * @param {string[]} params.queries      - verbatim problem phrases
 * @param {Function} [params.searchFn]   - optional injection point for tests;
 *                                         defaults to searchGithubRepositories
 * @returns {Promise<{ repos: FlatRepo[], error?: string }>}
 */
export async function runDiscoveryPass({
  config,
  projectKey,
  queries,
  searchFn = searchGithubRepositories
}) {
  if (!projectKey) {
    return {
      repos: [],
      error: "projectKey required for problem-mode discovery"
    };
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

  const repos = Array.from(collected.values()).map((item) => ({
    id: item.normalizedRepoUrl ?? `${item.owner}/${item.name}`,
    url: item.normalizedRepoUrl ?? null,
    owner: item.owner ?? null,
    name: item.name ?? null,
    description: item.description ?? null,
    language: item.language ?? null,
    topics: Array.isArray(item.topics) ? item.topics : [],
    readme: null,
    license: null,
    dependencies: []
  }));

  return { repos };
}
```

- [ ] **Step 2: Run regression test to verify it passes**

Run: `node --test test/discovery-pass-standalone.test.mjs`
Expected: PASS (1 test).

- [ ] **Step 3: Run full suite**

Run: `npm test`
Expected: PASS. `problem-explore.mjs` still passes a spurious `rootDir`/`depth`/`standalone` — those are harmless extra fields the destructuring just ignores.

- [ ] **Step 4: Commit**

```bash
git add lib/discovery/pass.mjs
git commit -m "feat(discovery): rewrite runDiscoveryPass as verbatim phrase loop

One GitHub search per problem phrase, no project anchor contamination.
Results deduped by normalizedRepoUrl, mapped to the flat repo shape
downstream ranking/clustering expects. searchFn parameter enables
test-time dependency injection.

Fixes OQ-009."
```

---

### Task 4: Dedupe test

**Files:**
- Modify: `test/discovery-pass-standalone.test.mjs`

- [ ] **Step 1: Append dedupe test**

```js
test("runDiscoveryPass dedupes repos surfacing via multiple phrases", async () => {
  const fakeSearchFn = async (_config, plan) => {
    if (plan.query === "virtualized list") {
      return {
        items: [
          { normalizedRepoUrl: "https://github.com/foo/bar", owner: "foo", name: "bar", description: "a", language: "TypeScript", topics: [] },
          { normalizedRepoUrl: "https://github.com/foo/baz", owner: "foo", name: "baz", description: "b", language: "JavaScript", topics: [] }
        ]
      };
    }
    if (plan.query === "react window") {
      return {
        items: [
          { normalizedRepoUrl: "https://github.com/foo/bar", owner: "foo", name: "bar", description: "a", language: "TypeScript", topics: [] },
          { normalizedRepoUrl: "https://github.com/foo/qux", owner: "foo", name: "qux", description: "c", language: "Rust", topics: [] }
        ]
      };
    }
    return { items: [] };
  };

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["virtualized list", "react window"],
    searchFn: fakeSearchFn
  });

  const urls = repos.map((repo) => repo.url).sort();
  assert.deepEqual(urls, [
    "https://github.com/foo/bar",
    "https://github.com/foo/baz",
    "https://github.com/foo/qux"
  ], "each repo appears exactly once");
});
```

- [ ] **Step 2: Run tests**

Run: `node --test test/discovery-pass-standalone.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 3: Commit**

```bash
git add test/discovery-pass-standalone.test.mjs
git commit -m "test(discovery): cover repo dedupe across multiple phrase searches"
```

---

### Task 5: Phrase-failure resilience test

**Files:**
- Modify: `test/discovery-pass-standalone.test.mjs`

- [ ] **Step 1: Append failure-resilience test**

```js
test("runDiscoveryPass continues on single-phrase failure", async () => {
  const fakeSearchFn = async (_config, plan) => {
    if (plan.query === "flaky phrase") {
      throw new Error("rate_limited");
    }
    return {
      items: [
        { normalizedRepoUrl: `https://github.com/ok/${plan.query.replace(/\s+/g, "-")}`, owner: "ok", name: plan.query.replace(/\s+/g, "-"), description: null, language: null, topics: [] }
      ]
    };
  };

  const { repos, error } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["good one", "flaky phrase", "good two"],
    searchFn: fakeSearchFn
  });

  assert.equal(error, undefined, "single-phrase failure is not fatal");
  assert.equal(repos.length, 2, "two surviving phrases produced two repos");
  assert.deepEqual(
    repos.map((repo) => repo.name).sort(),
    ["good-one", "good-two"]
  );
});
```

- [ ] **Step 2: Run tests**

Run: `node --test test/discovery-pass-standalone.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 3: Commit**

```bash
git add test/discovery-pass-standalone.test.mjs
git commit -m "test(discovery): cover phrase-failure resilience"
```

---

### Task 6: Repo-shape test

**Files:**
- Modify: `test/discovery-pass-standalone.test.mjs`

- [ ] **Step 1: Append repo-shape test**

```js
test("runDiscoveryPass returns flat repo shape with enrichment fields nulled", async () => {
  const fakeSearchFn = async () => ({
    items: [
      {
        normalizedRepoUrl: "https://github.com/foo/bar",
        owner: "foo",
        name: "bar",
        description: "desc",
        language: "TypeScript",
        topics: ["perf", "lists"]
      }
    ]
  });

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["anything"],
    searchFn: fakeSearchFn
  });

  assert.equal(repos.length, 1);
  const repo = repos[0];
  assert.equal(repo.id, "https://github.com/foo/bar");
  assert.equal(repo.url, "https://github.com/foo/bar");
  assert.equal(repo.owner, "foo");
  assert.equal(repo.name, "bar");
  assert.equal(repo.description, "desc");
  assert.equal(repo.language, "TypeScript");
  assert.deepEqual(repo.topics, ["perf", "lists"]);
  assert.equal(repo.readme, null, "no README enrichment in standalone path");
  assert.equal(repo.license, null, "no license enrichment in standalone path");
  assert.deepEqual(repo.dependencies, [], "no dependencies enrichment in standalone path");
});

test("runDiscoveryPass returns projectKey error when missing", async () => {
  const { repos, error } = await runDiscoveryPass({
    config: {},
    queries: ["anything"],
    searchFn: async () => ({ items: [] })
  });
  assert.deepEqual(repos, []);
  assert.match(error, /projectKey required/);
});

test("runDiscoveryPass returns empty repos on empty queries", async () => {
  let called = false;
  const { repos, error } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: [],
    searchFn: async () => { called = true; return { items: [] }; }
  });
  assert.deepEqual(repos, []);
  assert.equal(error, undefined);
  assert.equal(called, false, "no search calls for empty queries");
});
```

- [ ] **Step 2: Run tests**

Run: `node --test test/discovery-pass-standalone.test.mjs`
Expected: PASS (6 tests total).

- [ ] **Step 3: Commit**

```bash
git add test/discovery-pass-standalone.test.mjs
git commit -m "test(discovery): cover flat repo shape, missing projectKey, empty queries"
```

---

### Task 7: Clean up problem-explore.mjs caller

**Files:**
- Modify: `scripts/commands/problem-explore.mjs:26-48`

- [ ] **Step 1: Replace the standalone handling block**

Change lines 23-48 from:

```js
  const depth = options.depth ?? "standard";
  const profile = resolveDiscoveryProfile(depth);
  const totalBudget = profile.limit;
  const standalone = !projectKey;
  const split = splitBudget({ totalBudget, standalone });

  const problemQueries = buildProblemQueryFamily({
    seeds: problem.derived.query_seeds ?? [],
    budget: split.problem
  });

  // TODO: add cross-family queries when project seeds are loaded
  const queries = problemQueries;

  if (queries.length === 0) {
    return { repos: [], note: "problem_query_family: empty(reason: no_seeds)" };
  }

  const passResult = await runDiscoveryPass({
    rootDir,
    config,
    projectKey,
    queries,
    depth,
    standalone
  });
```

To:

```js
  const depth = options.depth ?? "standard";
  const profile = resolveDiscoveryProfile(depth);
  const totalBudget = profile.limit;
  const split = splitBudget({ totalBudget, standalone: true });

  const problemQueries = buildProblemQueryFamily({
    seeds: problem.derived.query_seeds ?? [],
    budget: split.problem
  });

  const queries = problemQueries;

  if (queries.length === 0) {
    return { repos: [], note: "problem_query_family: empty(reason: no_seeds)" };
  }

  const passResult = await runDiscoveryPass({
    config,
    projectKey,
    queries
  });
```

- [ ] **Step 2: Run full test suite**

Run: `npm test`
Expected: PASS. No existing test should break. If a test referenced `standalone` or the old signature, update it to match the new reality.

- [ ] **Step 3: Commit**

```bash
git add scripts/commands/problem-explore.mjs
git commit -m "refactor(problem-mode): drop standalone flag from explore caller

standalone is now the only supported mode. Pass standalone: true to
splitBudget unconditionally and drop rootDir/depth/standalone from the
runDiscoveryPass call — they are no longer consumed."
```

---

### Task 8: Smoke-run against a real problem

**Files:** none modified; verification only.

- [ ] **Step 1: Ensure GitHub token is present**

Run: `node -e "import('./lib/config.mjs').then(m => m.loadConfig('.').then(c => console.log(c.github?.token ? 'TOKEN_OK' : 'NO_TOKEN')))"`
Expected: `TOKEN_OK`. If not, stop — the smoke-run needs a token.

- [ ] **Step 2: Pick a real problem and run explore**

List available problems:

```bash
node scripts/patternpilot.mjs problem:list --project eventbear-worker
```

Pick one problem slug (any existing one). Run:

```bash
DEBUG_PATTERNPILOT_QUERIES=1 node scripts/patternpilot.mjs problem:explore --project eventbear-worker --slug <slug> --depth quick 2>&1 | grep -E "(GET|search|problem-mode)"
```

Expected: visible GitHub `/search/repositories?q=` URLs where the `q=` parameter is a verbatim problem phrase. No `municipal event` or other project anchors in the q string.

If the existing code does not log queries at that level, skip this variant and instead inspect network traffic via a minimal script:

```bash
node -e "
import('./lib/discovery/pass.mjs').then(async (mod) => {
  const result = await mod.runDiscoveryPass({
    config: (await import('./lib/config.mjs')).loadConfig ? await (await import('./lib/config.mjs')).loadConfig('.') : {},
    projectKey: 'eventbear-worker',
    queries: ['virtualized list react'],
    searchFn: async (_c, plan) => {
      console.log('QUERY:', plan.query);
      return { items: [] };
    }
  });
  console.log('REPOS:', result.repos.length);
});
"
```

Expected output: `QUERY: virtualized list react` then `REPOS: 0`.

- [ ] **Step 3: Note the result**

If the smoke run shows verbatim queries, proceed to Task 9. If queries are contaminated, stop and debug before committing anything else.

No commit for this task — verification only.

---

### Task 9: Close OQ-009 in local OPEN_QUESTION.md

**Files:**
- Modify: `OPEN_QUESTION.md` (local, gitignored — not committed)

- [ ] **Step 1: Update handoff notes**

Add a new `settled_now_ten` line and update `next_recommended_step`:

```
- settled_now_ten: problem-mode discovery now issues one verbatim GitHub query per problem phrase via a dedicated standalone path. Project context re-enters at ranking/clustering/brief, not in the query string.
- next_recommended_step: run problem:explore against a real eventbear-worker problem and review whether the candidate list quality justifies keeping the default or introducing a future --with-project-breadth flag.
```

- [ ] **Step 2: Remove OQ-009 from active questions**

Delete the full `### OQ-009 — PROBLEM_MODE_QUERY_SHAPE` section (lines 89–96 in the current file).

- [ ] **Step 3: Update `last_updated` timestamp**

Change `last_updated` to current ISO timestamp.

- [ ] **Step 4: No commit**

`OPEN_QUESTION.md` is gitignored. Local-only update.

---

## Self-Review Notes

- **Spec coverage:** All three design decisions (A/1/one-per-phrase) are implemented in Task 3. The regression test in Task 2 is the direct counter-test to OQ-009.
- **Untouched surfaces stay untouched:** `lib/discovery/shared.mjs` (cohort/guaranteedSlot) and `lib/discovery/problem-queries.mjs` are not modified, matching the spec's "out of scope" section.
- **Type consistency:** `searchFn` signature matches `searchGithubRepositories(config, plan, options)`. The returned `items` shape matches `normalizeGithubSearchItem` output consumed today.
- **No placeholders:** Every step contains complete code. No "add appropriate error handling" or "fill in details". The three error paths (missing projectKey, empty queries, single-phrase failure) are all covered by specific code in Task 3 and specific tests in Tasks 2/5/6.
