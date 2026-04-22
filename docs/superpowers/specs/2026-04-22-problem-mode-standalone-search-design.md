# Problem-Mode Standalone Search Design

**Goal:** Replace the broken cohort-injection path in `problem:explore` with a dedicated standalone search path that issues one GitHub query per problem phrase, verbatim, and feeds the results into the existing problem-mode ranking and clustering pipeline.

**Architecture:** `runDiscoveryPass` gets a real standalone branch. For each problem phrase, it calls `searchGithubRepositories` directly (bypassing `buildDiscoveryPlan`), collects and dedupes results, then returns the flat repo shape. The project context re-enters the pipeline at `problem-ranking`, `problem-diversity`, and the clustering stages — not in the query string. `discoverGithubCandidates` stays untouched for the existing `discover` command.

**Tech Stack:** Node.js ESM, existing discovery primitives in `lib/discovery/`, existing problem-mode primitives in `lib/discovery/problem-*.mjs`.

---

## Background

OQ-009 documents the drift: `problem:explore` currently injects problem phrases as a `priorityCohort`, which flows through `buildDiscoveryPlan`. The resulting cohort query prepends the project anchor (e.g. `municipal event`) in front of one problem phrase, drops the remaining phrases, and produces a query that matches neither the problem nor the project well.

The `guaranteedSlot` fix (commit `ab89517`) only guarantees the cohort plan survives budget pressure — it does not reshape the query string. The query-shape problem is the architectural blocker that prevents `problem:explore` from returning useful candidates in practice.

## Decision Record

Three clarifying decisions anchor this design:

1. **Search semantics (Option A, problem-first).** GitHub searches use problem phrases only. The project does not contaminate the query string. Project context re-enters downstream at ranking / clustering / brief synthesis.
2. **Pipeline composition (Option 1, rein Problem).** `problem:explore` runs problem searches only — no parallel project searches in the same call. The existing `discover` command remains the dedicated project-similarity pipeline. No user-facing choice between search modes.
3. **Query shape (one search per phrase, verbatim).** Each problem phrase becomes its own GitHub query. No bundling. Budget is gated by the existing `--depth` profile (`quick`, `standard`, `deep`), which already deterministically caps phrase count via `buildProblemQueryFamily`.

These three decisions together implement the "broad search, smart ranking" mental model: cast the net wide with the problem, then let the project narrow it through ranking.

## Architecture

### High-level flow (problem:explore)

```
problem.derived.query_seeds   (problem phrases from parser)
         ↓
splitBudget(standalone: true) → problem: 100 %
         ↓
buildProblemQueryFamily → phrases.slice(0, budget)
         ↓
runDiscoveryPass (standalone branch) ────► searchGithubRepositories per phrase
         ↓                                              ↓
         ↓                              one GitHub call per phrase, verbatim
         ↓                                              ↓
         ↓                              dedupe by normalizedRepoUrl
         ↓
repos[] (flat shape, no enrichment)
         ↓
extractRepoKeywords → applyHardConstraints → problemFit + applySoftBoost
         ↓                                              ↑
         ↓                    project context enters here (tech_tags)
         ↓
selectWithDiversity → landscape clustering → brief
```

### Module changes

**`lib/discovery/search.mjs`** — export `searchGithubRepositories` so `pass.mjs` can call it directly. The function already accepts a minimal `plan` shape (`query`, `minSearchResults`) and handles fallback sequences and retries internally.

**`lib/discovery/pass.mjs`** — drop the old cohort-injection path and the `standalone` parameter entirely. `problem:explore` is the only caller, and it always uses this path. The simplified `runDiscoveryPass` does:

- Require `projectKey`; error early if missing (ranking needs project context).
- For each phrase in `queries`, construct a minimal plan `{ query: phrase, minSearchResults: 1 }` and call `searchGithubRepositories(config, plan, { perPage })`.
- Aggregate `items[]` across all phrases into a single `Map` keyed by `normalizedRepoUrl` for dedupe (first occurrence wins).
- Normalize each collected item into the flat repo shape already expected downstream (same fields as before: `id`, `url`, `owner`, `name`, `description`, `language`, `topics`, `readme`, `license`, `dependencies`).
- No README / license enrichment (same as today — equivalent to today's `skipEnrich: true`).
- On API errors for a single phrase, log at warn level and continue with remaining phrases. A single empty or failed phrase is not fatal.

**`scripts/commands/problem-explore.mjs`** — simplify the standalone handling:

- Drop the `standalone = !projectKey` line. `problem:explore` always uses the problem-first search contract.
- Call `splitBudget({ totalBudget, standalone: true })` unconditionally so the full budget goes to problem phrases.
- Call `runDiscoveryPass` without a `standalone` argument.
- `projectKey` is still required (enforced earlier in the command flow, and re-enforced by `runDiscoveryPass`).

**`lib/discovery/problem-queries.mjs`** — no changes. `buildProblemQueryFamily` and `splitBudget` already work for this flow.

**`lib/discovery/shared.mjs`** — no changes required. The `guaranteedSlot` mechanism and `priorityCohort` pathway remain for any future non-problem-mode caller. The cohort plan at line ~1200 stops being triggered by `problem:explore` since `problem:explore` no longer calls `discoverGithubCandidates`.

### Budget and rate limit

- `--depth quick` → ~2 phrases → 2 searches
- `--depth standard` → ~5 phrases → 5 searches
- `--depth deep` → ~8 phrases → 8 searches

GitHub Search API rate limit is 30/min authenticated. A single `problem:explore` run never approaches this. No client-side throttling beyond what `searchGithubRepositories` already does.

### Per-query parameters

- `perPage`: 10 (same as today's discovery default). Balances breadth per phrase against response size.
- `sort: updated`, `order: desc` — same as current default. Favours living repos.
- `minSearchResults: 1` — don't fall back aggressively on single-phrase queries. If a phrase returns zero, we trust the phrase is too niche rather than dropping tokens.

### Dedupe

Dedupe by `normalizedRepoUrl` across all phrase searches. First occurrence wins; subsequent duplicates are discarded. No tracking of which phrase(s) surfaced which repo — that is out of scope for this spec (see follow-ups).

## Error handling

- Single-phrase failure (rate-limit, network, 422): log at warn level, continue with remaining phrases. Return whatever aggregated successfully.
- All phrases fail: return `{ repos: [], error: "all_phrase_searches_failed" }` — same shape the caller already handles.
- Empty aggregated result: return `{ repos: [] }` without an error. The caller already handles empty repo lists (`note: "skip_discovery"` style).
- No `projectKey`: keep the existing contract — `problem:explore` requires `--project`. `runDiscoveryPass` still errors early if called without one, because the ranking pipeline needs project context.

## Testing strategy

### New unit test: `test/discovery-pass-standalone.test.mjs`

Mock `searchGithubRepositories` to record calls and return controlled responses. Verify:

1. **Phrase-to-query mapping:** given 3 phrases, exactly 3 calls are made, each with the verbatim phrase as `plan.query`.
2. **No project contamination:** the query string for each call contains only the phrase — no project anchor tokens.
3. **Dedupe:** when two phrases return overlapping repos, the aggregated result contains each repo once.
4. **Phrase-failure resilience:** when one phrase throws, the remaining phrases still execute and contribute to the result.
5. **Flat repo shape:** every returned item has the required fields (`id`, `url`, `owner`, `name`, `description`, `language`, `topics`, `readme`, `license`, `dependencies`).

### Regression test: query-shape assertion (counter-test to OQ-009)

One integration-style test that drives `runDiscoveryPass` with a fixed 3-phrase input (e.g. `["virtualized list", "react window", "infinite scroll"]`) while mocking the HTTP layer. Assert exactly three requests were made, and for each request the `q=` search parameter equals the corresponding phrase verbatim (no project anchor tokens, no additional content terms). This is the direct regression guard against the OQ-009 drift: if anyone later reintroduces contamination, this test fails.

### Existing tests

No existing test should break. The `test/discovery-shared.test.mjs` "reserves a slot for injected priorityCohort queries even at focused budget" test remains valid because `guaranteedSlot` is still a general-purpose feature — we just stop using it from problem-mode.

## Out of scope for this spec

- **Cross-family queries (project × problem combos).** Currently stubbed via `splitBudget.cross`. Not enabled in this design. If later data shows a gap, revisit.
- **Phrase-weighting in ranking.** The `__matchedPhrases` field is populated but not consumed by the existing `problemFit` scoring. Leaving for a follow-up.
- **User-facing mode switch.** No `--strict-stack` or `--with-project-breadth` flag in this design. Defer until real runs show a concrete gap.
- **LLM-assisted phrase expansion.** Out of scope. Phrases come from the problem parser as today.

## Rollout and validation

After implementation:

1. Run `problem:explore` against an existing `eventbear-worker` problem and verify via logs that the queries hitting GitHub are verbatim problem phrases (no project anchor).
2. Spot-check the candidate list: it should contain repos from diverse domains, with the ranking layer reflecting project context rather than the query.
3. Update `OPEN_QUESTION.md`: mark OQ-009 as `settled_now` in the handoff notes, remove from active questions.

No cache invalidation is needed — query strings change structurally, so new entries do not collide with stale ones.

## Follow-ups tracked as open questions

- **Phrase-weight in `problemFit`.** Whether surfacing `__matchedPhrases` count into the fit score is worth the complexity. Defer until we have real-run data on whether the current ranking already handles it.
- **Empty-result heuristics.** If `problem:explore` returns zero repos, do we automatically widen (drop most specific phrases)? Not in this design.
