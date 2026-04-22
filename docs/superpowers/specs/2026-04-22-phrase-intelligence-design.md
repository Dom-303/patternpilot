# Phrase Intelligence Design

**Goal:** Raise the signal-to-noise ratio of `problem:explore` results by adding two independent phrase-quality layers to the problem-mode pipeline: a deterministic heuristic layer that always runs during `problem-refresh`, and an opt-in LLM-augmentation layer that lets the user sharpen their problem via their own LLM through a generated prompt artifact (no API integration).

**Architecture:** Two independent layers stack additively without coupling. Layer 1 runs inside `problem-refresh` as a pure-function post-pass on the derived fields, expands high-confidence tech aliases, normalizes case-equivalent duplicates on search_terms, and emits non-destructive lint warnings to stdout. Layer 2 runs at `problem-create` time, writing a per-problem `sharpen-prompt.md` artifact alongside `problem.md` that the user takes to their own LLM of choice. The LLM's structured response replaces `problem.md` in a single paste; no API calls leave Pattern Pilot.

**Tech Stack:** Node.js ESM. New modules are pure functions; new data is committed JSON. No new dependencies. No network code.

---

## Background

The real `problem:explore` run against `self-healing-adaptive-source-intake` (2026-04-22T16-02-20-639Z) validated the OQ-009 verbatim-query fix end-to-end, but also exposed the next bottleneck: result usefulness scored 4/10. The 12 returned repos clustered into a single `crawler+playwright+python` cluster with `landscape_signal: single_cluster_collapse` and all three user-defined axes flagged `axis_not_found_in_landscape`. Root cause: user-written problem phrases were too generic (`generic web extractor`, `adaptive web crawler`) and matched tens of thousands of off-topic repositories.

Today the quality of `problem:explore` is gated by the user's phrase craft. That is a heavy expectation — the tool should help the user write sharper phrases, not demand mastery upfront.

Out of the three ranked improvement sub-projects identified after the run (A: Phrase Intelligence, B: Axis / Clustering Robustness, C: Ranking Validation), this spec covers **Sub-Project A** only. B and C remain tracked in `OPEN_QUESTION.md` and will be brainstormed separately once A ships and produces real data.

## Decision Record

Three decisions anchor this design.

1. **Two independent layers, stacked.** Layer 1 (heuristic, deterministic, always on during `problem-refresh`) and Layer 2 (Prompt-as-Artifact, opt-in at `problem-create`). Both improve phrase quality via different mechanisms and never conflict. If the user skips Layer 2, Layer 1 still catches obvious issues. If the user uses Layer 2, Layer 1 runs additionally on the LLM-polished output.
2. **Layer 2 uses the user's own LLM via a generated prompt, not an API integration.** Pattern Pilot generates `sharpen-prompt.md` as a file. The user copies it into ChatGPT / Claude / Gemini / Mistral, describes the problem in their own words, and pastes the structured result back into `problem.md`. Pattern Pilot itself stays 100% deterministic, offline-capable, and free of API-key management.
3. **Layer 1 is strictly non-destructive for user phrases.** Expansion applies only to `tech_tags` where equivalence is near-perfect (e.g. `nodejs` → also `node.js`). On `search_terms` the heuristic only performs case-insensitive dedup (preserving original casing) and emits lint warnings. The user's phrases themselves are never rewritten. Auto-rewriting generic phrases would violate Pattern Pilot's deterministic-core principle and risk silent drift.

## Architecture

### File structure

**New:**
- `lib/problem/sharpen-prompt.mjs` — pure template function that renders the sharpening-prompt Markdown content, given the problem's frontmatter values (slug, title, project, created_at). No I/O.
- `lib/problem/heuristics.mjs` — pure functions for tech-alias expansion, case-insensitive dedup with original casing preserved, and the four lint checks. Returns `{ derived, warnings }`. No I/O.
- `lib/problem/tech-aliases.json` — committed dictionary of high-confidence tech aliases. Starts ~15 entries.
- `lib/problem/generic-phrases.json` — committed deny-list of generic phrases. Starts ~15 entries.

**Modified:**
- `scripts/commands/problem-create.mjs` — in addition to writing `problem.md`, renders `sharpen-prompt.md` into the same directory and prints a three-step console instruction telling the user how to use it.
- `lib/problem/store.mjs` — `refreshProblemJson` calls `applyHeuristics` after `buildDerived` and prints any warnings to stdout before writing `problem.json`. Also writes `sharpen-prompt.md` if it does not yet exist (backfill for problems created before this feature), so existing problems get Layer 2 access on their next refresh.

**Untouched:**
- `lib/problem/derived.mjs` — `buildDerived` stays pure. Heuristics are a separate post-pass.
- `lib/problem/parser.mjs`, `lib/problem/template.mjs` — no changes.
- `scripts/commands/problem-refresh.mjs`, `problem-explore.mjs`, `problem-brief.mjs`, `problem-list.mjs`, `problem-archive.mjs`, `problem-resolve.mjs` — no changes. Heuristics are wired through `refreshProblemJson`, which these already call as needed.

### Layer 2 — Prompt-as-Artifact

`lib/problem/sharpen-prompt.mjs` exports a single function `buildSharpenPrompt({ slug, title, projectKey, createdAt })` that returns a Markdown string with three blocks.

**Block 1 — Context for the LLM (≈3 sentences).** Explains what Pattern Pilot is and that its output drives GitHub search. Establishes quality expectation.

**Block 2 — Guardrails.** Per-section rules for the LLM:
- `search_terms`: 6-10 phrases, each 2-4 words. Positive examples (`schema inference crawler`, `adaptive selector learning`). Negative examples (`web scraper`, `data pipeline`, marketing language). Explicit rule to write these in English.
- `tech_tags`: technologies actually in the user's stack or plausibly relevant. No panic lists.
- `constraint_tags`, `approach_keywords`: brief guidance on scope.
- `suspected_approach_axes`: three axes in `name: left ↔ middle ↔ right` format, where solutions actually differ from each other on that axis. Concrete example given.
- `description`, `success_criteria`, `non_goals`, `current_approach`: brief length and specificity guidance. Written in the user's language.

**Block 3 — Output format.** A complete Markdown skeleton the LLM must produce as the replacement for `problem.md`. The skeleton embeds the **actual frontmatter values** for this problem as literals — not placeholders:

```
---
slug: self-healing-adaptive-source-intake    ← use this exact value
title: Self-healing adaptive source intake   ← use this exact value
status: active
project: eventbear-worker                    ← use this exact value
created_at: 2026-04-22                       ← use this exact value
---
```

This eliminates the risk of the LLM mutating the problem's identity (dir-name vs. frontmatter-slug mismatch).

The block ends with a single-mode user-input placeholder:
```
<<HIER deine formlosen Gedanken zum Problem einfügen>>
```

A **Few-Shot Example** follows: a complete filled `problem.md` for a different hypothetical problem (e.g. "Real-time collaborative text editor sync conflicts"), ~25 lines, demonstrating the aspirational output quality.

**Expected total length:** 100-120 lines Markdown. Long enough to encode quality; short enough to skim.

**Reproducibility guarantee:** the template is static. Only slug, title, project, created_at are substituted per-problem. Two users with the same frontmatter values get byte-identical prompt artifacts.

### Layer 1 — Heuristics

`lib/problem/heuristics.mjs` exports `applyHeuristics({ query_seeds, tech_tags, constraint_tags, approach_signature })` returning `{ derived, warnings }`. The `derived` object has the same shape as the input with additive changes. `warnings` is an array of strings, each a single-line human-readable advisory.

**Operations on `tech_tags`:**
- For each entry, look up `tech-aliases.json` and append any aliases not already present. Case-insensitive match; preserves the original casing of the existing entry. Aliases are appended in their canonical (dictionary) casing.
- Final dedup case-insensitively, preserving first occurrence's casing.

**Operations on `search_terms` (mapped from `query_seeds`):**
- Trim whitespace on each entry.
- Drop empty or whitespace-only entries silently.
- Case-insensitive dedup, preserving first-occurrence casing.
- **No semantic expansion.** No alias expansion. No rewriting.

**Lint checks (emit warnings, never modify):**
- **Generic-phrase lint:** entry matches an item in `generic-phrases.json` case-insensitively. Warning: `[lint] warn: search_term "web scraper" is a generic phrase. Consider sharpening (e.g. "schema-free scraper", "adaptive selector scraper").`
- **Single-word lint:** entry, after trimming and splitting on whitespace, is one token. Warning: `[lint] warn: search_term "scraper" is a single word and matches too broadly on GitHub. Consider adding a qualifier.`
- **Long-phrase lint:** entry has more than 5 whitespace-separated tokens. Warning: `[lint] warn: search_term "self-healing adaptive scraper with pattern bank feedback loop" has 9 words. GitHub search narrows too aggressively beyond 4 words — consider splitting.`
- **Duplicate lint:** after case-insensitive dedup, if the input had duplicates, emit a warning listing them. Warning: `[lint] warn: search_term "Self-healing Scraper" was a case-insensitive duplicate of "self-healing scraper" and was dropped.`

**Operations on `constraint_tags` and `approach_signature`:**
- Pass through unchanged. No normalization in MVP (license-tag normalization deliberately dropped as YAGNI).

### Data flow

```
User                               Pattern Pilot
──────                             ─────────────
problem-create --title "…"  ─────► writes problem.md (empty template)
                                   writes sharpen-prompt.md (per-problem rendered)
                                   prints 3-step instruction on stdout

          ┌─── OPTIONAL LAYER 2 (user-mediated) ────────────┐
          │ User copies sharpen-prompt.md → own LLM         │
          │ User describes problem in own words             │
          │ LLM returns structured problem.md replacement   │
          │ User pastes LLM output into problem.md          │
          └──────────────────────────────────────────────────┘

User edits problem.md (direct or LLM-polished)

problem-refresh <slug>     ─────► parses problem.md
                                   buildDerived() → raw derived
                                   applyHeuristics(raw) → { derived, warnings }
                                   warnings printed to stdout
                                   writes problem.json

problem-explore <slug>     ─────► unchanged, consumes problem.json
```

### Error handling

- **Heuristics crash:** `refreshProblemJson` wraps `applyHeuristics` in try/catch. On error, logs `[heuristics] skipped due to error: <message>` and falls back to raw `buildDerived` output. Refresh continues successfully. Heuristics must never block the core refresh pipeline.
- **Missing/corrupt `tech-aliases.json` or `generic-phrases.json`:** module loads return empty dicts; expansion and generic-phrase lint silently no-op. Lint-independent checks (single-word, long-phrase, duplicate) still run.
- **LLM output malformed:** not Pattern Pilot's concern at commit time. The user pastes what the LLM produced; if it breaks the parser, the existing `parseProblemMarkdown` error ("`problem.md is missing frontmatter`") surfaces on next refresh. The user fixes it.

### Layer 1 + Layer 2 interaction

Both layers stack without conflict. If the user runs the LLM roundtrip and pastes polished content, refresh still runs Layer 1 on top of the LLM output. Redundancies are harmless (e.g. LLM writes `typescript`, heuristic adds `ts` → final tags `[typescript, ts]`). Downstream consumers dedup anyway.

If the user skips the LLM roundtrip and writes rough content manually, Layer 1 still catches single-word phrases, generic phrases, and tech-alias gaps. Result: even the unassisted path gets baseline quality improvements.

## Testing strategy

**Unit tests (new):**
- `test/problem-sharpen-prompt.test.mjs` — verifies the prompt template includes all four frontmatter values as literals, contains all three blocks, contains the few-shot example marker, and is deterministic given the same inputs.
- `test/problem-heuristics.test.mjs` — per-rule tests:
  - Tech-alias expansion: given `["nodejs"]` → output contains `["nodejs", "node", "node.js"]` (order preserved, aliases appended).
  - Case-insensitive dedup preserves first-occurrence casing.
  - Generic-phrase lint fires for `"web scraper"`, produces a single warning.
  - Single-word lint fires for `"scraper"`, not for `"self-healing scraper"`.
  - Long-phrase lint fires for a 6-word phrase, not for a 5-word phrase (boundary).
  - Duplicate lint fires on `["foo", "FOO"]`.
  - Empty-string entries are silently dropped without warning.
  - `applyHeuristics` handles empty / missing input arrays without throwing.

**Integration test (new):**
- `test/problem-refresh-heuristics-integration.test.mjs` — end-to-end test: creates a temp problem.md with known-generic phrases, runs `refreshProblemJson`, asserts that the resulting `problem.json` contains expected expanded `tech_tags` and that warnings were emitted for the generic and single-word cases. Uses console capture.

**Existing tests stay green:**
- `test/problem-create.test.mjs` — problem-create now also writes `sharpen-prompt.md`; the existing assertion on `problem.md` creation is unaffected. Add one new assertion that `sharpen-prompt.md` also exists.
- `test/problem-refresh.test.mjs` (if exists), `test/problem-store.test.mjs` — may need a tolerance update if they assert on console output. Heuristics with empty input produce no warnings, so the common path stays silent.

**Manual smoke test:**
- Create a fresh problem with a known-generic title (e.g. `"Simple web scraper"`). Run refresh. Verify generic-phrase and single-word warnings appear. Verify tech_tag `nodejs` expands in problem.json.

## Out of scope

The following are explicitly deferred to later sub-projects:

- **Semantic expansion of search_terms** (`scraper → crawler`, `adaptive → self-healing`). Handled by Layer 2 (LLM) when the user opts in.
- **Auto-rewriting of flagged generic phrases.** Lint warns; user decides.
- **Additional lint categories** (special-character detection, regex-injection detection, etc.). Not motivated by real data yet.
- **Per-project alias dictionaries.** The global dictionary is sufficient for MVP.
- **License-tag normalization** (`MIT` ↔ `mit`, `Apache-2.0` ↔ `apache-2.0`). Low ROI; deferred.
- **Programmatic suppression of warnings** (e.g. `--quiet`). YAGNI until users complain.
- **Sub-Project B (Axis / Clustering Robustness):** `single_cluster_collapse` and `axis_not_found_in_landscape` from the first real run have deeper causes than phrase quality alone. Tracked separately.
- **Sub-Project C (Ranking Validation / Feedback Loop):** needs 3-5 real runs as training data, which Sub-Project A will help produce. Tracked separately.

## Rollout and validation

After implementation:

1. Re-run `problem:explore` against the existing `self-healing-adaptive-source-intake` problem (first without the LLM roundtrip, then with). Compare the two landscape outputs to the original 2026-04-22T16-02-20-639Z baseline.
2. Expected: lint warnings fire on at least 3 of the original 10 search_terms (`generic web extractor`, `source-agnostic scraping`, etc.). With the LLM roundtrip, the sharpened phrases should produce a landscape with ≥2 non-collapsed clusters.
3. Update `OPEN_QUESTION.md` with findings from the before/after comparison as a new `settled_now_twelve` entry.
4. If Sub-Project B becomes obvious as the next blocker (based on data), start its brainstorm.

No cache invalidation required. Heuristics run at refresh time, not at discovery time, so discovery caches are untouched. Prompt artifacts are per-problem files with no shared state.
