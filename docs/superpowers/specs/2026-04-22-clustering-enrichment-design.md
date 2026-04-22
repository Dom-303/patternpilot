# Problem-Mode Enrichment-Driven Clustering Design

**Goal:** Fix the `single_cluster_collapse` failure mode observed in every problem-mode run by enabling per-candidate README enrichment in the standalone discovery pass. The clustering stack itself is unchanged — it is starved of signal because the Task-3 refactor of `runDiscoveryPass` hard-coded `readme: null`, `license: null`, `dependencies: []` on the returned repos. Restoring this signal lets `extractRepoKeywords` surface its full four-source signature, which drops pairwise Jaccard similarity below the DSU merge threshold and produces meaningful multi-cluster landscapes.

**Architecture:** Pure-addition inside `lib/discovery/pass.mjs`: after `searchGithubRepositories` collects deduplicated items, each one is passed through `enrichGithubRepo` (imported from `lib/github/enrichment.mjs`) in parallel via `Promise.all`. The resulting README excerpt, license, and dependencies are mapped into the flat repo shape alongside the existing topics/description/language fields. Nothing else in the discovery or clustering path is touched.

**Tech Stack:** Node.js ESM. No new dependencies. Reuses the existing `enrichGithubRepo` that powers the non-problem-mode discovery path.

**Spec parent:** Sub-Project B of the phrase-quality improvement sequence. Sub-Project A (phrase-intelligence) completed. Sub-Project B.2 (axis auto-discovery) deferred.

---

## Background

Two real runs of `problem:explore` against `self-healing-adaptive-source-intake` (2026-04-22T16-02-20-639Z and 2026-04-22T18-09-18-779Z, the second with Layer-2-sharpened phrases) both produced `landscape_signal: single_cluster_collapse` with all 12 candidates in one cluster. The cluster labels differed (`crawler+playwright+python` vs `mcp+playwright+typescript`) but the structure was identical: one big cluster, zero divergence, all three user-axes `axis_not_found_in_landscape`.

Root-cause analysis of `lib/clustering/keywords.mjs:57-64` shows `extractRepoKeywords` uses four input sources — `topics`, `dependencies`, README headings, README leading nouns. Root-cause analysis of `lib/discovery/pass.mjs` (Task-3 refactor) shows the standalone problem-mode search pass explicitly sets `readme: null`, `license: null`, `dependencies: []` on every returned repo. Thus three of the four keyword sources are systematically empty. Keyword sets reduce to topics only, which for the 12 returned candidates share `playwright`, `crawler`, `typescript` — producing trivially high pairwise Jaccard similarity and DSU-merging everything into one cluster.

The clustering algorithm is not broken. It is being fed a starved signal because the problem-mode search pass skipped enrichment for speed. This spec reverses that choice and restores the expected signal level.

## Decision Record

Single decision, three supporting sub-decisions.

1. **Restore enrichment for problem-mode via `enrichGithubRepo`.** Call it per candidate after the verbatim-phrase search stage, in parallel via `Promise.all`. Map `readme.excerpt`, `licenseId`, and `dependencies` into the flat repo shape. This is the one code change needed to unlock `extractRepoKeywords`'s full four-source signature.
2. **Parallel execution, not sequential.** `Promise.all` over all candidates keeps total latency in the 1-2 second range even for 12+ candidates. GitHub's 5000/hour authenticated rate-limit is orders of magnitude above what a single `problem:explore` can consume.
3. **Graceful degradation on per-repo failure.** `enrichGithubRepo` already returns an `error` field on fetch failure instead of throwing. The pass aggregates whatever succeeded, silently falls back to `readme: null` etc. for any repo that failed, and logs nothing at the pass level unless every enrichment failed.

**Explicitly deferred:**
- **(C) Collapse-detection safety-net** — if even with enriched signal some problems still collapse, we add a post-clustering fallback split. Not needed in MVP; adds scope.
- **(A) Further keyword extraction enrichment** — the existing `extractRepoKeywords` is well-designed; the issue was starvation, not scope. No changes there.
- **(B) Jaccard threshold tuning** — mathematics show the existing 0.35 threshold is appropriate once the signal is restored. No changes there.
- **Sub-Project B.2 (axis auto-discovery)** — separate sub-project, tracked in `OPEN_QUESTION.md`.

## Architecture

### File structure

**Modified:**
- `lib/discovery/pass.mjs` — add enrichment pass after search aggregation, map enriched fields into flat repo shape.

**Untouched (intentionally):**
- `lib/clustering/*` — no changes. Clustering was never broken.
- `lib/discovery/search.mjs` — no changes. Verbatim phrase search works.
- `lib/github/enrichment.mjs` — existing `enrichGithubRepo` is reused as-is.
- `scripts/commands/problem-explore.mjs` — consumer doesn't care how flat-shape fields are populated.

**New test files:** see Testing Strategy below.

### Signature extension

`runDiscoveryPass` gains an optional `enrichFn` parameter alongside the existing `searchFn`. Both default to the real implementations (`searchGithubRepositories` / `enrichGithubRepo`); tests inject fakes. This matches the existing dependency-injection pattern from Task 3.

New signature:
```js
runDiscoveryPass({ config, projectKey, queries, searchFn?, enrichFn? })
```

### Modified `runDiscoveryPass` flow

Current flow (simplified):
```
queries → searchFn per phrase → collected (Map by URL) → flat repos (readme/license/deps nulled)
```

New flow:
```
queries → searchFn per phrase → collected (Map by URL)
        ↓
enrichGithubRepo per unique item in parallel (Promise.all)
        ↓
flat repos (readme = excerpt, license = licenseId, dependencies = deps list)
```

The enrichment stage runs after search-stage collection, before the flat-shape mapping. Items that fail enrichment get `readme: null`, `license: null`, `dependencies: []` — identical to the current behavior for all items. Items that succeed get their full enriched signal.

### Graceful degradation

`enrichGithubRepo` handles sub-failures internally (e.g. README 404) by writing `error` into the relevant sub-object and returning success. The only failure case the pass needs to handle is a full-repo fetch failure where the function throws. In that case, the per-item try/catch in the enrichment loop logs a warn and falls back to the nulled flat shape for that specific repo. One failed enrichment never blocks the rest.

### No cache changes

Enrichment caching (if any) lives in `lib/github/enrichment.mjs` and its dependencies. This spec does not add new caching. Re-runs of the same problem may re-fetch READMEs; that is acceptable for MVP given the rate-limit headroom.

### Latency impact

Empirical estimate: 12 parallel REST calls to `github.com/repos/:owner/:name` + `/readme` + `/languages` (currently in `enrichGithubRepo`) complete in 1-2 seconds. A full `problem:explore --depth quick` today takes ~6-10 seconds; this adds ~10-20% to total runtime. Acceptable.

## Testing strategy

**Unit test (new):** `test/discovery-pass-enrichment.test.mjs`
- Injects a fake `searchFn` returning 3 items with distinct `normalizedRepoUrl`.
- Injects a fake `enrichFn` returning distinct `readme.excerpt` strings per owner/name.
- Asserts the resulting flat repos carry the injected README excerpts (not null).
- Asserts per-repo enrichment-failure path: one repo's `enrichFn` throws; the other two still return populated shape; the failed one returns `readme: null` without propagating the error.

**Regression test update:** `test/discovery-pass-standalone.test.mjs`
- Existing test "runDiscoveryPass issues one verbatim search per problem phrase" must continue to pass unchanged (enrichment is orthogonal to search contract).
- Add assertion to the repo-shape test that, when `enrichFn` is **not** injected (default path), flat repos still gracefully carry null readme/license/deps. This documents the old behavior as a fallback for callers that omit enrichFn.

**Manual smoke:**
After implementation, re-run `problem-explore self-healing-adaptive-source-intake --project eventbear-worker --depth quick`. Expected outcome: `clusters: > 1` (target 3+) and `relation_counts` with non-zero `divergent` or at least multiple `adjacent`. This is the direct validation that Sub-Project B's hypothesis holds.

If the manual smoke still shows `single_cluster_collapse`, the market-whitespace interpretation stands and we reopen Sub-Project B with additional levers (Hebel C fallback split, semantic-similarity replacement for Jaccard, etc.). The spec deliberately makes this failure visible instead of papering over it.

## Out of scope

- **Post-clustering collapse safety-net** (Hebel C from the brainstorm). Deferred until we know if enrichment alone solves the issue.
- **Axis auto-discovery** — Sub-Project B.2.
- **Feedback loop from user intake decisions** — Sub-Project C.
- **Caching strategy for enrichment results** — out of MVP; current behavior is uncached, which is acceptable.
- **Configurable enrichment toggle** (e.g. `--no-enrich` flag). YAGNI; can be added later if a performance complaint surfaces.

## Rollout and validation

1. Re-run `problem:explore self-healing-adaptive-source-intake` after implementation.
2. Compare `landscape.json` to the two existing runs:
   - If `clusters >= 3` and `relation_counts.divergent > 0`: Sub-Project B MVP succeeded. Mark `settled_now_twelve` in `OPEN_QUESTION.md`. Move to Sub-Project B.2 or C based on next priority.
   - If `clusters` still 1: market-whitespace interpretation confirmed. Document as a settled signal about the problem itself, not a Pattern-Pilot defect. Consider Hebel C fallback split as a follow-up.
3. Runtime should remain under ~12 seconds for `--depth quick`. If it balloons beyond 30 seconds, investigate; something is wrong with the enrichment path.
4. No production break is possible: the change is strictly additive to a pass that today returns no enriched data. Worst case: enrichment fails for everything, and the pass behaves exactly as today.
