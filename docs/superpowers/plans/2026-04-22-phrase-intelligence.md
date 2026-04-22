# Phrase Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two independent phrase-quality layers to problem-mode: a deterministic heuristic layer during `problem-refresh` (tech-alias expansion, case-dedup, four lint checks), and a Prompt-as-Artifact layer at `problem-create` (generated `sharpen-prompt.md` file the user takes to their own LLM). Ships without API integration and without touching existing discovery / ranking / clustering.

**Architecture:** Two new pure-function modules (`lib/problem/heuristics.mjs`, `lib/problem/sharpen-prompt.mjs`) plus two committed data files (`tech-aliases.json`, `generic-phrases.json`). Minimal touches to `store.mjs` (wire heuristics into `refreshProblemJson`, backfill sharpen-prompt.md) and `problem-create.mjs` (richer console instruction only). TDD per module, one commit per task.

**Tech Stack:** Node.js ESM, native `node:test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-04-22-phrase-intelligence-design.md`

---

## File Structure

**Created:**
- `lib/problem/tech-aliases.json` — alias dictionary
- `lib/problem/generic-phrases.json` — deny-list for lint
- `lib/problem/heuristics.mjs` — pure functions
- `lib/problem/sharpen-prompt.mjs` — pure template function
- `test/problem-heuristics.test.mjs` — unit tests
- `test/problem-sharpen-prompt.test.mjs` — unit tests
- `test/problem-refresh-heuristics-integration.test.mjs` — end-to-end

**Modified:**
- `lib/problem/store.mjs` — call `applyHeuristics` in `refreshProblemJson`, backfill `sharpen-prompt.md`
- `scripts/commands/problem-create.mjs` — richer console instruction (no direct file-write; `refreshProblemJson` handles `sharpen-prompt.md` via backfill)

**Untouched:** `derived.mjs`, `parser.mjs`, `template.mjs`, `paths.mjs`, any `problem-*.mjs` command other than `problem-create.mjs`, all discovery / ranking / clustering code.

---

### Task 1: Starter data files

**Files:**
- Create: `lib/problem/tech-aliases.json`
- Create: `lib/problem/generic-phrases.json`

- [ ] **Step 1: Write `lib/problem/tech-aliases.json`**

```json
{
  "groups": [
    ["nodejs", "node", "node.js"],
    ["typescript", "ts"],
    ["javascript", "js"],
    ["python", "py"],
    ["kubernetes", "k8s"],
    ["postgres", "postgresql"],
    ["golang", "go"]
  ]
}
```

- [ ] **Step 2: Write `lib/problem/generic-phrases.json`**

```json
{
  "phrases": [
    "web scraper",
    "data pipeline",
    "machine learning",
    "artificial intelligence",
    "api wrapper",
    "cli tool",
    "web framework",
    "database tool",
    "code generator",
    "testing framework",
    "data extraction",
    "text processing",
    "file parser",
    "task runner",
    "dev tool"
  ]
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/problem/tech-aliases.json lib/problem/generic-phrases.json
git commit -m "feat(heuristics): add starter tech-aliases and generic-phrases dictionaries"
```

---

### Task 2: Heuristics — alias expansion + search-term normalization

**Files:**
- Create: `lib/problem/heuristics.mjs`
- Create: `test/problem-heuristics.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  expandTechAliases,
  normalizeSearchTerms
} from "../lib/problem/heuristics.mjs";

describe("expandTechAliases", () => {
  test("expands nodejs to include node and node.js", () => {
    const result = expandTechAliases(["nodejs"]);
    assert.ok(result.includes("nodejs"));
    assert.ok(result.includes("node"));
    assert.ok(result.includes("node.js"));
  });

  test("case-insensitive lookup; keeps user's original casing", () => {
    const result = expandTechAliases(["NodeJS"]);
    assert.ok(result.includes("NodeJS"));
    assert.ok(result.some((t) => t.toLowerCase() === "node"));
    assert.ok(result.some((t) => t.toLowerCase() === "node.js"));
  });

  test("passes through unknown tags unchanged; no duplicates", () => {
    const result = expandTechAliases(["docker", "nodejs"]);
    assert.equal(result.filter((t) => t === "docker").length, 1);
  });

  test("case-insensitive dedup", () => {
    const result = expandTechAliases(["nodejs", "NODE"]);
    const lower = result.map((t) => t.toLowerCase());
    assert.equal(new Set(lower).size, result.length);
  });

  test("handles empty and missing input", () => {
    assert.deepEqual(expandTechAliases([]), []);
    assert.deepEqual(expandTechAliases(undefined), []);
    assert.deepEqual(expandTechAliases(null), []);
  });
});

describe("normalizeSearchTerms", () => {
  test("trims whitespace", () => {
    assert.deepEqual(normalizeSearchTerms(["  foo  "]), ["foo"]);
  });

  test("drops empty / whitespace-only entries", () => {
    assert.deepEqual(normalizeSearchTerms(["foo", "", "   "]), ["foo"]);
  });

  test("case-insensitive dedup preserves first occurrence casing", () => {
    const result = normalizeSearchTerms(["Self-Healing", "self-healing"]);
    assert.deepEqual(result, ["Self-Healing"]);
  });

  test("keeps order of first occurrences", () => {
    const result = normalizeSearchTerms(["beta", "alpha", "BETA"]);
    assert.deepEqual(result, ["beta", "alpha"]);
  });

  test("handles missing input", () => {
    assert.deepEqual(normalizeSearchTerms(undefined), []);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/problem-heuristics.test.mjs`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Write implementation**

```js
// lib/problem/heuristics.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function loadJsonSafely(filename, fallback) {
  try {
    const raw = fs.readFileSync(path.join(moduleDir, filename), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const TECH_ALIASES = loadJsonSafely("tech-aliases.json", { groups: [] });

export function expandTechAliases(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  const seen = new Map(); // lowercase key → original casing (first occurrence)
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const key = tag.toLowerCase();
    if (!seen.has(key)) seen.set(key, tag);
  }
  for (const tag of [...tags]) {
    if (typeof tag !== "string") continue;
    const group = (TECH_ALIASES.groups ?? []).find((g) =>
      g.some((member) => member.toLowerCase() === tag.toLowerCase())
    );
    if (!group) continue;
    for (const member of group) {
      const key = member.toLowerCase();
      if (!seen.has(key)) seen.set(key, member);
    }
  }
  return [...seen.values()];
}

export function normalizeSearchTerms(terms) {
  if (!Array.isArray(terms)) return [];
  const seen = new Map();
  for (const raw of terms) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()];
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `node --test test/problem-heuristics.test.mjs`
Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/problem/heuristics.mjs test/problem-heuristics.test.mjs
git commit -m "feat(heuristics): tech-alias expansion and search-term normalization"
```

---

### Task 3: Heuristics — four lint checks

**Files:**
- Modify: `lib/problem/heuristics.mjs`
- Modify: `test/problem-heuristics.test.mjs`

- [ ] **Step 1: Append lint tests**

```js
import {
  lintGenericPhrases,
  lintSingleWords,
  lintLongPhrases,
  lintDuplicates
} from "../lib/problem/heuristics.mjs";

describe("lintGenericPhrases", () => {
  test("flags known generic phrases", () => {
    const warnings = lintGenericPhrases(["web scraper", "self-healing scraper"]);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("web scraper"));
    assert.ok(warnings[0].toLowerCase().includes("generic"));
  });

  test("case-insensitive match", () => {
    const warnings = lintGenericPhrases(["WEB SCRAPER"]);
    assert.equal(warnings.length, 1);
  });

  test("returns empty for clean input", () => {
    assert.deepEqual(lintGenericPhrases(["schema inference crawler"]), []);
  });

  test("handles missing input", () => {
    assert.deepEqual(lintGenericPhrases(undefined), []);
  });
});

describe("lintSingleWords", () => {
  test("flags single-word phrases", () => {
    const warnings = lintSingleWords(["scraper", "self-healing scraper"]);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("scraper"));
    assert.ok(warnings[0].toLowerCase().includes("single word"));
  });

  test("handles extra whitespace", () => {
    assert.equal(lintSingleWords(["  scraper  "]).length, 1);
  });

  test("does not flag multi-word", () => {
    assert.deepEqual(lintSingleWords(["self-healing scraper"]), []);
  });
});

describe("lintLongPhrases", () => {
  test("flags phrases with more than 5 whitespace-separated tokens", () => {
    const warnings = lintLongPhrases(["one two three four five six"]);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].match(/\d+\s*words/));
  });

  test("does not flag exactly 5 words (boundary)", () => {
    assert.deepEqual(lintLongPhrases(["one two three four five"]), []);
  });

  test("does not flag short phrases", () => {
    assert.deepEqual(lintLongPhrases(["two words", "three word phrase"]), []);
  });
});

describe("lintDuplicates", () => {
  test("flags case-insensitive duplicates", () => {
    const warnings = lintDuplicates(["foo", "FOO"]);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].toLowerCase().includes("duplicate"));
  });

  test("returns empty for unique list", () => {
    assert.deepEqual(lintDuplicates(["foo", "bar"]), []);
  });

  test("handles whitespace-only-difference duplicates", () => {
    const warnings = lintDuplicates(["foo", "  foo  "]);
    assert.equal(warnings.length, 1);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `node --test test/problem-heuristics.test.mjs`
Expected: FAIL (lint functions not exported).

- [ ] **Step 3: Append implementation to `lib/problem/heuristics.mjs`**

```js
const GENERIC_PHRASES = loadJsonSafely("generic-phrases.json", { phrases: [] });

export function lintGenericPhrases(terms) {
  if (!Array.isArray(terms)) return [];
  const deny = (GENERIC_PHRASES.phrases ?? []).map((p) => p.toLowerCase());
  const warnings = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    if (deny.includes(term.trim().toLowerCase())) {
      warnings.push(
        `[lint] warn: search_term "${term}" is a generic phrase. Consider sharpening (e.g. "schema-free scraper", "adaptive selector scraper").`
      );
    }
  }
  return warnings;
}

export function lintSingleWords(terms) {
  if (!Array.isArray(terms)) return [];
  const warnings = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    const parts = term.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      warnings.push(
        `[lint] warn: search_term "${term}" is a single word and matches too broadly on GitHub. Consider adding a qualifier.`
      );
    }
  }
  return warnings;
}

export function lintLongPhrases(terms) {
  if (!Array.isArray(terms)) return [];
  const warnings = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    const parts = term.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 5) {
      warnings.push(
        `[lint] warn: search_term "${term}" has ${parts.length} words. GitHub search narrows too aggressively beyond 4 words — consider splitting.`
      );
    }
  }
  return warnings;
}

export function lintDuplicates(terms) {
  if (!Array.isArray(terms)) return [];
  const seen = new Map();
  const warnings = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    const key = term.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      warnings.push(
        `[lint] warn: search_term "${term}" was a case-insensitive duplicate of "${seen.get(key)}" and was dropped.`
      );
    } else {
      seen.set(key, term);
    }
  }
  return warnings;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `node --test test/problem-heuristics.test.mjs`
Expected: PASS (all tests, including new lint tests).

- [ ] **Step 5: Commit**

```bash
git add lib/problem/heuristics.mjs test/problem-heuristics.test.mjs
git commit -m "feat(heuristics): four lint checks (generic, single-word, long-phrase, duplicate)"
```

---

### Task 4: Heuristics — applyHeuristics orchestrator

**Files:**
- Modify: `lib/problem/heuristics.mjs`
- Modify: `test/problem-heuristics.test.mjs`

- [ ] **Step 1: Append orchestrator tests**

```js
import { applyHeuristics } from "../lib/problem/heuristics.mjs";

describe("applyHeuristics", () => {
  test("expands tech_tags and normalizes search_terms", () => {
    const { derived, warnings } = applyHeuristics({
      query_seeds: ["foo", "FOO", "  bar  "],
      tech_tags: ["nodejs"],
      constraint_tags: ["opensource"],
      approach_signature: ["self-healing"]
    });

    assert.deepEqual(derived.query_seeds, ["foo", "bar"]);
    assert.ok(derived.tech_tags.includes("nodejs"));
    assert.ok(derived.tech_tags.some((t) => t.toLowerCase() === "node"));
    assert.ok(derived.tech_tags.some((t) => t.toLowerCase() === "node.js"));
    assert.deepEqual(derived.constraint_tags, ["opensource"]);
    assert.deepEqual(derived.approach_signature, ["self-healing"]);

    assert.ok(warnings.some((w) => w.toLowerCase().includes("duplicate")));
  });

  test("handles missing fields gracefully", () => {
    const { derived, warnings } = applyHeuristics({});
    assert.deepEqual(derived.query_seeds, []);
    assert.deepEqual(derived.tech_tags, []);
    assert.deepEqual(derived.constraint_tags, []);
    assert.deepEqual(derived.approach_signature, []);
    assert.deepEqual(warnings, []);
  });

  test("emits all four lint categories when applicable", () => {
    const { warnings } = applyHeuristics({
      query_seeds: [
        "web scraper",
        "scraper",
        "one two three four five six",
        "foo",
        "FOO"
      ]
    });
    assert.ok(warnings.some((w) => w.toLowerCase().includes("generic")));
    assert.ok(warnings.some((w) => w.toLowerCase().includes("single word")));
    assert.ok(warnings.some((w) => w.match(/\d+\s*words/)));
    assert.ok(warnings.some((w) => w.toLowerCase().includes("duplicate")));
  });

  test("accepts undefined input without throwing", () => {
    const { derived, warnings } = applyHeuristics();
    assert.deepEqual(derived.query_seeds, []);
    assert.deepEqual(warnings, []);
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `node --test test/problem-heuristics.test.mjs`
Expected: FAIL (`applyHeuristics` not exported).

- [ ] **Step 3: Append orchestrator to `lib/problem/heuristics.mjs`**

```js
export function applyHeuristics(input = {}) {
  const raw = {
    query_seeds: Array.isArray(input.query_seeds) ? input.query_seeds : [],
    tech_tags: Array.isArray(input.tech_tags) ? input.tech_tags : [],
    constraint_tags: Array.isArray(input.constraint_tags) ? input.constraint_tags : [],
    approach_signature: Array.isArray(input.approach_signature) ? input.approach_signature : []
  };

  const warnings = [
    ...lintGenericPhrases(raw.query_seeds),
    ...lintSingleWords(raw.query_seeds),
    ...lintLongPhrases(raw.query_seeds),
    ...lintDuplicates(raw.query_seeds)
  ];

  const derived = {
    query_seeds: normalizeSearchTerms(raw.query_seeds),
    tech_tags: expandTechAliases(raw.tech_tags),
    constraint_tags: [...raw.constraint_tags],
    approach_signature: [...raw.approach_signature]
  };

  return { derived, warnings };
}
```

- [ ] **Step 4: Verify all tests pass**

Run: `node --test test/problem-heuristics.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/problem/heuristics.mjs test/problem-heuristics.test.mjs
git commit -m "feat(heuristics): applyHeuristics orchestrator combining expansion, normalization, and lints"
```

---

### Task 5: Sharpen-prompt module

**Files:**
- Create: `lib/problem/sharpen-prompt.mjs`
- Create: `test/problem-sharpen-prompt.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildSharpenPrompt } from "../lib/problem/sharpen-prompt.mjs";

describe("buildSharpenPrompt", () => {
  test("embeds slug, title, project, created_at as literals", () => {
    const prompt = buildSharpenPrompt({
      slug: "my-problem",
      title: "My problem title",
      projectKey: "my-project",
      createdAt: "2026-04-22"
    });
    assert.ok(prompt.includes("slug: my-problem"));
    assert.ok(prompt.includes("title: My problem title"));
    assert.ok(prompt.includes("project: my-project"));
    assert.ok(prompt.includes("created_at: 2026-04-22"));
  });

  test("omits project line when projectKey is null (standalone)", () => {
    const prompt = buildSharpenPrompt({
      slug: "x",
      title: "X",
      projectKey: null,
      createdAt: "2026-04-22"
    });
    assert.ok(!prompt.includes("project: null"));
    assert.ok(!prompt.includes("project: undefined"));
  });

  test("contains all three blocks + user-input placeholder", () => {
    const prompt = buildSharpenPrompt({
      slug: "x",
      title: "X",
      projectKey: "p",
      createdAt: "2026-04-22"
    });
    assert.ok(prompt.toLowerCase().includes("pattern pilot"), "Block 1 mentions tool");
    assert.ok(prompt.includes("search_terms"), "Block 2 guardrails");
    assert.ok(prompt.includes("<<HIER"), "Block 3 user-input placeholder");
  });

  test("contains few-shot example", () => {
    const prompt = buildSharpenPrompt({
      slug: "x",
      title: "X",
      projectKey: "p",
      createdAt: "2026-04-22"
    });
    assert.ok(prompt.toLowerCase().includes("beispiel"), "few-shot marker present");
  });

  test("is deterministic for same inputs", () => {
    const args = { slug: "x", title: "X", projectKey: "p", createdAt: "2026-04-22" };
    assert.equal(buildSharpenPrompt(args), buildSharpenPrompt(args));
  });
});
```

- [ ] **Step 2: Verify tests fail**

Run: `node --test test/problem-sharpen-prompt.test.mjs`
Expected: FAIL (module does not exist).

- [ ] **Step 3: Write implementation**

```js
// lib/problem/sharpen-prompt.mjs

export function buildSharpenPrompt({ slug, title, projectKey, createdAt }) {
  const projectLine = projectKey
    ? `project: ${projectKey}              ← use this exact value\n`
    : "";

  return `# Sharpening Prompt für Pattern Pilot Problem

**Was das ist:** Kopiere den GESAMTEN Inhalt unter dem "---"-Separator in dein bevorzugtes LLM (ChatGPT / Claude / Gemini / etc.), ersetze den Platzhalter am Ende mit deinen formlosen Gedanken zum Problem, und ersetze den Inhalt deiner \`problem.md\` mit der strukturierten Antwort des LLMs.

---

Du bist ein Research-Assistent. Dein Job: ein formlos beschriebenes Problem in ein strukturiertes Problem-Artefakt für das Tool **Pattern Pilot** umzuwandeln. Pattern Pilot nimmt deine Ausgabe und bildet daraus GitHub-Suchanfragen, um relevante Open-Source-Lösungen zu finden.

**Die Qualität der gefundenen Repos hängt zu 90% von der Qualität der \`search_terms\` ab.** Zu generische Begriffe ("web scraper") liefern zehntausende irrelevante Treffer. Zu seltene Begriffe liefern null Treffer. Deine Aufgabe: scharfe, präzise, fachlich spezifische Phrasen liefern.

## Leitplanken

**\`search_terms\` (6-10 Phrasen, englisch, jeweils 2-4 Wörter):**
- ✅ Gut: "schema inference crawler", "adaptive selector learning", "pattern-bank scraper", "crawler feedback loop"
- ❌ Schlecht: Ein-Wort-Phrasen, generische Kategorien ("web scraper", "data pipeline"), Marketing-Sprache ("powerful", "enterprise")
- Kombiniere Problem-Mechanik + Lösungs-Ansatz

**\`tech_tags\` (englisch):** Nur Technologien aus dem tatsächlichen Stack oder plausibel relevant. Keine Panik-Listen.

**\`constraint_tags\` (englisch):** Filterbare Tags wie \`opensource\`, \`mit-license\`.

**\`approach_keywords\` (englisch):** Ansatz-Tokens wie \`self-healing\`, \`adaptive\`, \`feedback-loop\`.

**\`suspected_approach_axes\` (3 Achsen, Format \`name: links ↔ mitte ↔ rechts\`):** Achsen, auf denen Lösungen sich **unterscheiden** (nicht konvergieren). Beispiel: \`extraction_paradigm: hand-crafted ↔ structural-inference ↔ learned-patterns\`.

**\`description\`, \`success_criteria\`, \`non_goals\`, \`current_approach\` (Sprache des Nutzers, meist Deutsch):** Messbar, spezifisch, nicht schwammig. Kurz halten.

## Output-Format

Gib AUSSCHLIESSLICH einen Markdown-Block zurück, der den kompletten Inhalt von \`problem.md\` ersetzt. Verwende diese exakten Frontmatter-Werte:

\`\`\`
---
slug: ${slug}              ← use this exact value
title: ${title}              ← use this exact value
status: active
${projectLine}created_at: ${createdAt}          ← use this exact value
---

## description
<ein präziser Absatz, max 4 Sätze>

## success_criteria
- <messbares Kriterium 1>
- <messbares Kriterium 2>
- <messbares Kriterium 3>

## constraints
- <harte Einschränkungen: Stack, Lizenz, Budget>

## non_goals
- <was dieses Problem explizit NICHT ist>

## current_approach
<wie der Nutzer das Problem bisher angeht, max 3 Sätze>

## hints
- search_terms: <6-10 scharfe englische Phrasen, komma-getrennt>
- tech_tags: <relevante englische Tech-Tokens, komma-getrennt>
- constraint_tags: <filterbare englische Tags, komma-getrennt>
- approach_keywords: <Ansatz-Tokens, englisch, komma-getrennt>

## suspected_approach_axes
- <Achse 1>
- <Achse 2>
- <Achse 3>
\`\`\`

## Beispiel für ein anderes Problem

\`\`\`
---
slug: realtime-collab-text-sync-conflicts
title: Realtime collaborative text editor sync conflict resolution
status: active
project: demo-project
created_at: 2026-04-22
---

## description
Zwei Nutzer editieren dasselbe Text-Dokument gleichzeitig. Ohne Conflict-Resolution-Schicht überschreiben die Änderungen sich gegenseitig oder produzieren Zeichen-Salat. Gesucht: ein bewährtes Pattern zur Reconciliation von parallelen Edits, das Cursor-Position und Auswahl bewahrt.

## success_criteria
- Zwei parallele Edits konvergieren zu einem deterministischen Ergebnis
- Cursor-Position bleibt erhalten, kein Zeichen-Salat
- Latenz < 100ms Ende-zu-Ende

## constraints
- TypeScript, läuft im Browser + Node-Backend
- Open-Source-Lizenz (MIT / Apache-2.0 / ähnlich)

## non_goals
- Rich-Text-Formatting (nur plain text)
- Offline-Editing-Synchronisation

## current_approach
Aktuell: Last-Write-Wins auf Character-Ebene, was Zeichensalat erzeugt. Angedacht: CRDT-basierter Ansatz, aber noch keine konkrete Library gewählt.

## hints
- search_terms: operational transformation, conflict-free replicated data type, CRDT text editor, collaborative cursor sync, Yjs shared types, ProseMirror collab
- tech_tags: typescript, javascript, websocket, browser, nodejs
- constraint_tags: opensource, mit-license
- approach_keywords: CRDT, operational-transformation, last-writer-wins, convergence

## suspected_approach_axes
- consistency_model: last-writer-wins ↔ operational-transformation ↔ CRDT
- sync_mechanism: polling ↔ websocket ↔ webrtc-p2p
- cursor_preservation: reset ↔ best-effort ↔ deterministic
\`\`\`

## Die Gedanken des Nutzers zu seinem Problem:

<<HIER deine formlosen Gedanken zum Problem einfügen — je konkreter und ehrlicher, desto schärfer wird der Output>>
`;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `node --test test/problem-sharpen-prompt.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/problem/sharpen-prompt.mjs test/problem-sharpen-prompt.test.mjs
git commit -m "feat(sharpen-prompt): template for user-mediated LLM sharpening"
```

---

### Task 6: Wire heuristics + sharpen-prompt backfill into refreshProblemJson

**Files:**
- Modify: `lib/problem/store.mjs`
- Create: `test/problem-refresh-heuristics-integration.test.mjs`

- [ ] **Step 1: Write failing integration test**

```js
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { refreshProblemJson } from "../lib/problem/store.mjs";

function createStandaloneProblem(rootDir, slug, markdown) {
  const dir = path.join(rootDir, "state", "standalone-problems", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "problem.md"), markdown);
  return dir;
}

describe("refreshProblemJson + heuristics + sharpen-prompt backfill", () => {
  test("expanded tech_tags land in problem.json; warnings go to stderr", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-heuristics-"));
    const originalWarn = console.warn;
    const captured = [];
    console.warn = (...args) => captured.push(args.join(" "));

    try {
      const dir = createStandaloneProblem(rootDir, "test-heuristics", `---
slug: test-heuristics
title: Test heuristics
status: active
created_at: 2026-04-22
---

## hints
- search_terms: self-healing scraper, web scraper, scraper
- tech_tags: nodejs
`);
      await refreshProblemJson({ rootDir, projectKey: null, slug: "test-heuristics" });
      const json = JSON.parse(fs.readFileSync(path.join(dir, "problem.json"), "utf8"));

      assert.ok(json.derived.tech_tags.includes("nodejs"));
      assert.ok(json.derived.tech_tags.some((t) => t.toLowerCase() === "node"));
      assert.ok(json.derived.tech_tags.some((t) => t.toLowerCase() === "node.js"));
      assert.ok(captured.some((line) => line.toLowerCase().includes("generic")), "generic warning printed");
      assert.ok(captured.some((line) => line.toLowerCase().includes("single word")), "single-word warning printed");
    } finally {
      console.warn = originalWarn;
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("backfills sharpen-prompt.md when missing", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-backfill-"));
    try {
      const dir = createStandaloneProblem(rootDir, "needs-backfill", `---
slug: needs-backfill
title: Needs backfill
status: active
created_at: 2026-04-22
---

## hints
- search_terms: nothing special
`);
      assert.ok(!fs.existsSync(path.join(dir, "sharpen-prompt.md")), "no sharpen-prompt initially");
      await refreshProblemJson({ rootDir, projectKey: null, slug: "needs-backfill" });
      assert.ok(fs.existsSync(path.join(dir, "sharpen-prompt.md")), "sharpen-prompt backfilled");
      const content = fs.readFileSync(path.join(dir, "sharpen-prompt.md"), "utf8");
      assert.ok(content.includes("slug: needs-backfill"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("does not overwrite existing sharpen-prompt.md", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-nooverwrite-"));
    try {
      const dir = createStandaloneProblem(rootDir, "has-prompt", `---
slug: has-prompt
title: Has prompt
status: active
created_at: 2026-04-22
---

## hints
- search_terms: example
`);
      fs.writeFileSync(path.join(dir, "sharpen-prompt.md"), "USER_CUSTOMIZED_CONTENT");
      await refreshProblemJson({ rootDir, projectKey: null, slug: "has-prompt" });
      const content = fs.readFileSync(path.join(dir, "sharpen-prompt.md"), "utf8");
      assert.equal(content, "USER_CUSTOMIZED_CONTENT");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
```

- [ ] **Step 2: Verify integration tests fail**

Run: `node --test test/problem-refresh-heuristics-integration.test.mjs`
Expected: FAIL (heuristics not wired; backfill not wired).

- [ ] **Step 3: Modify `lib/problem/store.mjs`**

Add imports at the top (after existing imports):

```js
import { applyHeuristics } from "./heuristics.mjs";
import { buildSharpenPrompt } from "./sharpen-prompt.mjs";
```

Replace the existing `refreshProblemJson` with:

```js
export async function refreshProblemJson({ rootDir, projectKey, slug }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const markdown = await fs.readFile(path.join(dir, "problem.md"), "utf8");
  const { frontmatter, fields } = parseProblemMarkdown(markdown);
  const rawDerived = buildDerived({ title: frontmatter.title, fields });

  let derived = rawDerived;
  try {
    const result = applyHeuristics(rawDerived);
    derived = result.derived;
    for (const warning of result.warnings) {
      console.warn(warning);
    }
  } catch (err) {
    console.warn(`[heuristics] skipped due to error: ${err.message}`);
  }

  const sharpenPath = path.join(dir, "sharpen-prompt.md");
  const sharpenExists = await fs.stat(sharpenPath).then(() => true).catch(() => false);
  if (!sharpenExists) {
    try {
      const prompt = buildSharpenPrompt({
        slug: frontmatter.slug,
        title: frontmatter.title,
        projectKey: frontmatter.project ?? null,
        createdAt: frontmatter.created_at ?? null
      });
      await fs.writeFile(sharpenPath, prompt);
    } catch (err) {
      console.warn(`[sharpen-prompt] could not backfill: ${err.message}`);
    }
  }

  const jsonPath = path.join(dir, "problem.json");
  let latestLandscape = null;
  let lastExploreResult = null;
  try {
    const existing = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    latestLandscape = existing.latest_landscape ?? null;
    lastExploreResult = existing.last_explore_result ?? null;
  } catch {
    // no existing file — defaults stay null
  }

  const json = buildProblemJson({ frontmatter, fields, derived, latestLandscape, lastExploreResult });
  await fs.writeFile(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
  return json;
}
```

- [ ] **Step 4: Verify tests pass**

Run: `node --test test/problem-refresh-heuristics-integration.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: PASS — all 492 existing + the new heuristics, sharpen-prompt, and integration tests.

- [ ] **Step 6: Commit**

```bash
git add lib/problem/store.mjs test/problem-refresh-heuristics-integration.test.mjs
git commit -m "feat(problem-mode): wire heuristics into refresh + backfill sharpen-prompt.md

refreshProblemJson now runs applyHeuristics after buildDerived, prints
lint warnings to stderr, and writes sharpen-prompt.md if missing. Graceful
degradation: heuristic crash does not block refresh. Backfill provides
Layer 2 access to problems created before this feature."
```

---

### Task 7: problem-create richer console instruction

**Files:**
- Modify: `scripts/commands/problem-create.mjs`

`problem-create` already calls `writeProblem`, which calls `refreshProblemJson`, which in Task 6 now backfills `sharpen-prompt.md`. So the file is created automatically. This task only upgrades the console instruction so the user understands the new Layer-2 flow.

- [ ] **Step 1: Replace the final two `console.log` lines in `scripts/commands/problem-create.mjs`**

Find:

```js
  console.log(`Created problem at ${path.join(dir, "problem.md")}`);
  console.log("Edit the markdown, then run: npm run patternpilot -- problem-refresh " + slug);
```

Replace with:

```js
  console.log(`Created problem at ${path.join(dir, "problem.md")}`);
  console.log("");
  console.log("Next steps:");
  console.log("  1. Open sharpen-prompt.md in the same directory and copy its content into your LLM (ChatGPT / Claude / Gemini).");
  console.log("  2. Describe the problem in your own words where the placeholder asks.");
  console.log("  3. Replace the content of problem.md with the LLM's structured response.");
  console.log(`  4. Run: npm run patternpilot -- problem-refresh ${slug}`);
  console.log("");
  console.log("If you prefer to write problem.md manually, you can skip the LLM step — problem-refresh will still run the deterministic heuristic layer.");
```

- [ ] **Step 2: Run full suite**

Run: `npm test`
Expected: PASS. No new tests required; the output is purely cosmetic and the file creation is covered by Task 6's backfill integration test.

- [ ] **Step 3: Commit**

```bash
git add scripts/commands/problem-create.mjs
git commit -m "feat(problem-create): richer console instruction for sharpen-prompt flow"
```

---

### Task 8: Manual smoke + end-to-end verification

**Files:** none modified; verification only.

- [ ] **Step 1: Verify full test suite**

Run: `npm test`
Expected: PASS with all new tests green. Record the final test count.

- [ ] **Step 2: Smoke — refresh the existing problem and verify heuristic output**

Run:

```bash
node scripts/patternpilot.mjs problem-refresh self-healing-adaptive-source-intake --project eventbear-worker 2>&1 | grep -E "\[lint|heuristics|sharpen-prompt"
```

Expected output includes at least:
- One `[lint] warn: search_term "..."` for `generic web extractor` (if matched by deny list — note: may require adding `generic web extractor` to `generic-phrases.json` if you want it flagged for this specific run)
- One `[lint] warn: search_term "..."` for a single-word seed if present in the original hints
- Confirmation that `sharpen-prompt.md` was backfilled into `projects/eventbear-worker/problems/self-healing-adaptive-source-intake/`

If `generic web extractor` isn't flagged, the deny-list is simply missing that entry — acceptable for MVP. Note the observation for future dictionary expansion.

- [ ] **Step 3: Verify `sharpen-prompt.md` exists and is readable**

Check:

```bash
ls projects/eventbear-worker/problems/self-healing-adaptive-source-intake/sharpen-prompt.md
head -20 projects/eventbear-worker/problems/self-healing-adaptive-source-intake/sharpen-prompt.md
```

Expected: file exists, starts with `# Sharpening Prompt für Pattern Pilot Problem`, includes `slug: self-healing-adaptive-source-intake` in the output-format block.

- [ ] **Step 4: No commit for this task** — verification only.

---

## Self-Review Notes

- **Spec coverage:** Every component in the spec has a task. Layer 1 (heuristics) → Tasks 2, 3, 4. Layer 2 (sharpen-prompt) → Task 5. Integration wiring + backfill → Task 6. Console UX → Task 7. Data files → Task 1.
- **Untouched surfaces stay untouched:** `derived.mjs`, `parser.mjs`, any discovery/ranking/clustering module. Verified in the File Structure section.
- **Type consistency:** `applyHeuristics` input/output shapes are consistent across Task 4's orchestrator implementation, Task 6's integration wiring, and the tests. `buildSharpenPrompt` takes `{ slug, title, projectKey, createdAt }` and returns a string — consistent across Task 5's tests, implementation, and Task 6's backfill caller.
- **No placeholders:** Every task has complete test code and complete implementation code. No "add appropriate error handling" or "fill in logic" — every step runs.
- **TDD discipline:** Tasks 2, 3, 4, 5, 6 all follow the RED → GREEN → COMMIT cycle. Task 1 is pure data, Task 7 is cosmetic-only (covered by Task 6's integration), Task 8 is verification — none need TDD.
- **Commit granularity:** One commit per task. Each commit is self-contained and leaves the tree green.
