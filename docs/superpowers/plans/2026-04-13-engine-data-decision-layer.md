# Engine Data for Decision Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verlagere die Report-Bewertungslogik (Confidence, Top-Adopt-Ranking, Dispositionen) aus `lib/html-renderer.mjs` in die Engine (`lib/classification.mjs`) und persistiere die Ergebnisse pro Kandidat in Queue + Dossier, mit einer `rules_fingerprint`-basierten Data-State-Machine (complete/fallback/stale) und einem Template-Hardcutover auf `reportSchemaVersion: 2`.

**Architecture:** Flache Feld-Additionen auf bestehenden Shapes — kein neuer Wrapper-Typ, keine neue Pipeline-Stufe. Eine geteilte `deriveDisposition`-Funktion fuer Discovery und Review (3x3 Matrix + 4 Overrides). `EVALUATION_VERSION`-Konstante bindet Code-Logik an den JSON-Fingerprint. Template liest nur Engine-Felder; bei `reportSchemaVersion !== 2` erscheint ein expliziter Missing-Data-Error.

**Tech Stack:** Node 20+, ESM (`.mjs`), Node built-in test runner (`node --test`), bestehende `csv`-lose Queue-Implementierung in `lib/queue.mjs`.

**Spec Reference:** [docs/superpowers/specs/2026-04-13-engine-data-decision-layer-design.md](../specs/2026-04-13-engine-data-decision-layer-design.md)

---

## File Structure

**Files to create:**
- `test/helpers/fixtures.mjs` — Test-Fixtures (Fake-Repo, Fake-Enrichment, Fake-AlignmentRules, Fake-ProjectAlignment)
- `test/smoke.test.mjs` — Runner-Sanity-Check fuer `node --test`
- `test/queue.test.mjs` — Regression-Test fuer queue.mjs auto-extension der neuen Spalten
- `test/classification.test.mjs` — Unit-Tests fuer die neuen Engine-Funktionen
- `test/intake.test.mjs` — Dossier-Test fuer den `## Decision Signals`-Block
- `test/discovery.test.mjs` — Integration-Tests fuer Discovery-Pipeline
- `test/review.test.mjs` — Integration-Tests fuer Review-Pipeline inkl. decisionDataState-State-Machine
- `test/html-renderer.test.mjs` — Template-Tests fuer Schema-Check, Warn-Banner, License-Tag, Adopt-Sort

**Files to modify:**
- `package.json` — `scripts.test` fuer `node --test`
- `projects/eventbear-worker/ALIGNMENT_RULES.json` — `effort_bias` in `layerMappings`, `value_bias` in `gapMappings`
- `lib/classification.mjs` — Neue Exports: `EVALUATION_VERSION`, `classifyLicense`, `computeRulesFingerprint`, `bandFromScore`, `buildCandidateEvaluation`, `deriveDisposition`, `buildRunConfidence`
- `lib/queue.mjs` — Keine Header-Konstante (`upsertQueueEntry` auto-extendiert), nur Default-Handling fuer fehlende neue Spalten beim Lesen
- `lib/intake.mjs` — Ruft `buildCandidateEvaluation` + `deriveDisposition` + `computeRulesFingerprint`, persistiert 6 neue Queue-Felder, schreibt `## Decision Signals`-Block ins Dossier
- `lib/discovery.mjs` — Loescht `buildDiscoveryDisposition`, ruft `buildCandidateEvaluation` + `deriveDisposition` pro Kandidat, setzt `reportSchemaVersion: 2` + `runConfidence` + `itemsDataStateSummary` pro Run
- `lib/review.mjs` — Liest neue Queue-Felder, implementiert `decisionDataState`-State-Machine pro Item, setzt Run-Felder wie Discovery
- `lib/html-renderer.mjs` — Heuristik-Pfade geloescht, Schema-Version-Check, Engine-Felder lesen, Adopt-Sort, License-Tag immer rendern, Data-State-Warn-Banner, Missing-Data-Error, CSS fuer `.action-item__license` und `.section-warn`

**Responsibility boundaries:**
- `lib/classification.mjs` ist rein funktional — keine I/O, keine globale State. Jede Funktion hat deterministische Signatur.
- `lib/queue.mjs` behandelt CSV-I/O, kennt aber die Semantik der neuen Felder nicht. Nur generisches Lesen/Schreiben.
- `lib/intake.mjs` + `lib/discovery.mjs` + `lib/review.mjs` sind die einzigen Aufrufer der Engine-Funktionen. Sie merge-n Engine-Ergebnisse auf ihre Shapes.
- `lib/html-renderer.mjs` konsumiert nur Engine-Felder. Keine eigene Heuristik mehr.

---

## Phase 0 — Test Infrastructure

### Task 0: Node built-in test runner einrichten

**Why first:** Patternpilot hat heute kein Test-Framework. Ohne ein lauffaehiges `npm test` koennen wir die TDD-Tasks in Phase 2 nicht durchziehen. Wir nutzen Node's eingebauten Test-Runner (`node --test`), der zero Dependencies braucht.

**Files:**
- Modify: `package.json`
- Create: `test/helpers/fixtures.mjs`
- Create: `test/smoke.test.mjs` (Platzhalter-Smoke-Test, wird in Task 3 ersetzt)

- [ ] **Step 1: Modify package.json to add test script**

Open `package.json` and add a `test` entry inside `scripts` (alphabetical order after `setup:checklist`):

```json
"test": "node --test --test-reporter=spec test/"
```

The scripts section becomes:

```json
"scripts": {
  "patternpilot": "node scripts/patternpilot.mjs",
  "automation:run": "node scripts/patternpilot.mjs automation-run",
  "discover:github": "node scripts/patternpilot.mjs discover",
  "doctor": "node scripts/patternpilot.mjs doctor",
  "discover:workspace": "node scripts/patternpilot.mjs discover-workspace",
  "init:env": "node scripts/patternpilot.mjs init-env",
  "init:project": "node scripts/patternpilot.mjs init-project",
  "intake": "node scripts/patternpilot.mjs intake",
  "refresh:context": "node scripts/patternpilot.mjs refresh-context",
  "review:watchlist": "node scripts/patternpilot.mjs review-watchlist",
  "setup:checklist": "node scripts/patternpilot.mjs setup-checklist",
  "test": "node --test --test-reporter=spec test/",
  "sync:all": "node scripts/patternpilot.mjs sync-all-watchlists",
  "sync:watchlist": "node scripts/patternpilot.mjs sync-watchlist",
  "promote": "node scripts/patternpilot.mjs promote",
  "show:project": "node scripts/patternpilot.mjs show-project",
  "list:projects": "node scripts/patternpilot.mjs list-projects"
}
```

- [ ] **Step 2: Create test/helpers/fixtures.mjs with fake data builders**

```js
// Test-Fixtures fuer die Engine-Tests.
// Alle Builder sind pure Funktionen, damit Tests unabhaengig bleiben.

export function makeFakeRepo(overrides = {}) {
  return {
    owner: "acme",
    name: "demo-repo",
    normalizedRepoUrl: "https://github.com/acme/demo-repo",
    size: 500,
    ...overrides
  };
}

export function makeFakeEnrichment(overrides = {}) {
  return {
    status: "success",
    repo: {
      description: "A demo repo for testing",
      topics: [],
      size: 500,
      archived: false,
      pushedAt: new Date().toISOString(),
      license: "MIT",
      primaryLanguage: "JavaScript",
      ...overrides.repo
    },
    languages: overrides.languages ?? ["JavaScript"],
    readme: overrides.readme ?? { excerpt: "" }
  };
}

export function makeFakeGuess(overrides = {}) {
  return {
    category: "connector",
    patternFamily: "connector",
    mainLayer: "source_intake",
    gapArea: "source_systems_and_families",
    buildVsBorrow: "adapt_pattern",
    priority: "now",
    ...overrides
  };
}

export function makeFakeProjectAlignment(overrides = {}) {
  return {
    projectKey: "eventbear-worker",
    projectFitScore: 70,
    fitBand: "high",
    matchedCapabilities: ["source_first", "candidate_first"],
    recommendedWorkerAreas: ["sources/"],
    risks: [],
    reasoning: [],
    suggestedNextStep: "Review intake contract",
    ...overrides
  };
}

export function makeFakeAlignmentRules(overrides = {}) {
  return {
    projectKey: "eventbear-worker",
    capabilities: [
      { id: "source_first", label: "source-first", signals: ["source"], review_docs: [] },
      { id: "candidate_first", label: "candidate-first", signals: ["candidate"], review_docs: [] },
      { id: "evidence_acquisition", label: "evidence acquisition", signals: ["fetch"], review_docs: [] },
      { id: "quality_governance", label: "quality", signals: ["quality"], review_docs: [] },
      { id: "location_intelligence", label: "location", signals: ["place"], review_docs: [] },
      { id: "distribution_surfaces", label: "distribution", signals: ["plugin"], review_docs: [] }
    ],
    layerMappings: {
      source_intake:           { fit_bias: 28, effort_bias: -5, worker_areas: ["sources/"],        review_docs: [], next_step: "" },
      access_fetch:            { fit_bias: 26, effort_bias:  8, worker_areas: ["lib/fetch.mjs"],   review_docs: [], next_step: "" },
      parsing_extraction:      { fit_bias: 22, effort_bias:  0, worker_areas: [],                  review_docs: [], next_step: "" },
      export_feed_api:         { fit_bias: 14, effort_bias: -3, worker_areas: [],                  review_docs: [], next_step: "" },
      distribution_plugin:     { fit_bias:  8, effort_bias: 15, worker_areas: [],                  review_docs: [], next_step: "" },
      ui_discovery_surface:    { fit_bias:  7, effort_bias: 12, worker_areas: [],                  review_docs: [], next_step: "" },
      location_place_enrichment: { fit_bias: 18, effort_bias:  3, worker_areas: [],                review_docs: [], next_step: "" }
    },
    gapMappings: {
      source_systems_and_families:    { fit_bias: 24, value_bias: 22, suggested_next_step: "" },
      connector_families:             { fit_bias: 18, value_bias: 18, suggested_next_step: "" },
      adapter_handoff_contracts:      { fit_bias: 20, value_bias: 15, suggested_next_step: "" },
      location_and_gastro_intelligence: { fit_bias: 18, value_bias: 14, suggested_next_step: "" },
      secondary_enrichment_layers:    { fit_bias: 14, value_bias: 10, suggested_next_step: "" },
      vertical_depth_connectors:      { fit_bias: 11, value_bias: 10, suggested_next_step: "" },
      distribution_surfaces:          { fit_bias: 12, value_bias:  8, suggested_next_step: "" },
      wordpress_plugin_distribution:  { fit_bias: 10, value_bias:  6, suggested_next_step: "" },
      frontend_and_surface_design:    { fit_bias:  8, value_bias:  4, suggested_next_step: "" },
      risk_and_dependency_awareness:  { fit_bias:  6, value_bias:  2, suggested_next_step: "" }
    },
    patternTensions: {},
    ...overrides
  };
}
```

- [ ] **Step 3: Create test/smoke.test.mjs as a runner sanity check**

```js
import { test } from "node:test";
import { strict as assert } from "node:assert";

test("node --test runner is wired up", () => {
  assert.equal(1 + 1, 2);
});
```

- [ ] **Step 4: Run the test suite to verify the runner works**

Run: `npm test`
Expected: 1 pass, `smoke.test.mjs` reported as green by the spec reporter.

- [ ] **Step 5: Commit**

```bash
git add package.json test/helpers/fixtures.mjs test/smoke.test.mjs
git commit -m "test: set up node built-in test runner with shared fixtures"
```

---

## Phase 1 — Schema & Alignment-Rules

### Task 1: ALIGNMENT_RULES.json um effort_bias/value_bias erweitern

**Why:** Foundation fuer die Scoring-Formeln in Phase 2. Reine Datenaenderung, kein Code-Touch. Werte kommen aus der Kalibrierungs-Leitlinie im Spec (Abschnitt "Alignment-Rules-Erweiterung").

**Files:**
- Modify: `projects/eventbear-worker/ALIGNMENT_RULES.json`

- [ ] **Step 1: Add effort_bias to every layerMappings entry**

Edit `projects/eventbear-worker/ALIGNMENT_RULES.json` so each entry in `layerMappings` gets a new `effort_bias` field, placed directly after `fit_bias`:

```json
"layerMappings": {
  "access_fetch": {
    "fit_bias": 26,
    "effort_bias": 8,
    "worker_areas": ["lib/fetch.mjs", "lib/headless-scraper.mjs", "lib/firecrawl.mjs"],
    "review_docs": ["WORKER_FLOW.md", "docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md"],
    "next_step": "Compare the external access pattern against the worker's fetch, browser and fallback chain."
  },
  "source_intake": {
    "fit_bias": 28,
    "effort_bias": -5,
    "worker_areas": ["docs/SOURCE_MASTERLIST_POLICY.md", "docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md", "sources/"],
    "review_docs": ["docs/SOURCE_MASTERLIST_POLICY.md", "docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md"],
    "next_step": "Check whether the repo suggests a reusable source-family or intake contract for EventBaer."
  },
  "parsing_extraction": {
    "fit_bias": 22,
    "effort_bias": 0,
    "worker_areas": ["lib/parse-jsonld.mjs", "lib/heuristic-registry.mjs", "lib/evidence.mjs"],
    "review_docs": ["WORKER_FLOW.md", "WORKER_CONTRACT.md"],
    "next_step": "Inspect whether extraction tactics improve evidence quality without weakening worker guardrails."
  },
  "export_feed_api": {
    "fit_bias": 14,
    "effort_bias": -3,
    "worker_areas": ["lib/export.mjs", "lib/report.mjs", "templates/"],
    "review_docs": ["WORKER_CONTRACT.md", "docs/WEB_PLATFORM_OVERVIEW.md"],
    "next_step": "Treat as a distribution or export pattern layered on top of the worker core."
  },
  "distribution_plugin": {
    "fit_bias": 8,
    "effort_bias": 15,
    "worker_areas": ["docs/WEB_PLATFORM_OVERVIEW.md", "docs/UI_FRAMEWORK.md"],
    "review_docs": ["docs/WEB_PLATFORM_OVERVIEW.md"],
    "next_step": "Evaluate as an adjacent product surface, not as worker core logic."
  },
  "ui_discovery_surface": {
    "fit_bias": 7,
    "effort_bias": 12,
    "worker_areas": ["docs/UI_FRAMEWORK.md", "docs/WEB_PLATFORM_OVERVIEW.md"],
    "review_docs": ["docs/UI_FRAMEWORK.md"],
    "next_step": "Keep the discovery surface conceptually separate from the ingestion and truth core."
  },
  "location_place_enrichment": {
    "fit_bias": 18,
    "effort_bias": 3,
    "worker_areas": ["lib/geo-validator.mjs", "scripts/run-locations.mjs", "templates/locations_template.csv"],
    "review_docs": ["WORKER_CONTRACT.md", "docs/SOURCE_GEO_REFERENCE.md"],
    "next_step": "Evaluate as a controlled secondary layer for place and venue intelligence."
  }
}
```

- [ ] **Step 2: Add value_bias to every gapMappings entry**

In the same file, each entry in `gapMappings` gets a new `value_bias` field, placed directly after `fit_bias`:

```json
"gapMappings": {
  "connector_families": {
    "fit_bias": 18,
    "value_bias": 18,
    "suggested_next_step": "Check whether the repo should influence connector-family conventions, not the worker core."
  },
  "source_systems_and_families": {
    "fit_bias": 24,
    "value_bias": 22,
    "suggested_next_step": "Compare the repo against EventBaer's source-system target architecture and family scaling goals."
  },
  "adapter_handoff_contracts": {
    "fit_bias": 20,
    "value_bias": 15,
    "suggested_next_step": "Inspect handoff contracts into a common candidate or evidence layer."
  },
  "distribution_surfaces": {
    "fit_bias": 12,
    "value_bias": 8,
    "suggested_next_step": "Treat as a product-surface signal sitting on top of the worker, not inside it."
  },
  "wordpress_plugin_distribution": {
    "fit_bias": 10,
    "value_bias": 6,
    "suggested_next_step": "Review as partner/distribution leverage, separate from worker truth logic."
  },
  "frontend_and_surface_design": {
    "fit_bias": 8,
    "value_bias": 4,
    "suggested_next_step": "Evaluate as an external discovery surface, not as worker architecture."
  },
  "location_and_gastro_intelligence": {
    "fit_bias": 18,
    "value_bias": 14,
    "suggested_next_step": "Review against location/gastro layers and geo-validation capabilities."
  },
  "secondary_enrichment_layers": {
    "fit_bias": 14,
    "value_bias": 10,
    "suggested_next_step": "Evaluate as optional enrichment behind strong evidence and governance constraints."
  },
  "vertical_depth_connectors": {
    "fit_bias": 11,
    "value_bias": 10,
    "suggested_next_step": "Use to judge whether niche connectors deserve a later family slot."
  },
  "risk_and_dependency_awareness": {
    "fit_bias": 6,
    "value_bias": 2,
    "suggested_next_step": "Read primarily as a risk or anti-pattern signal for EventBaer."
  }
}
```

- [ ] **Step 3: Verify JSON is valid**

Run: `node -e "JSON.parse(require('fs').readFileSync('projects/eventbear-worker/ALIGNMENT_RULES.json', 'utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add projects/eventbear-worker/ALIGNMENT_RULES.json
git commit -m "feat: add effort_bias to layerMappings and value_bias to gapMappings"
```

### Task 2: Queue-Reader-Defaults fuer neue Felder

**Why:** `lib/queue.mjs` nutzt bereits dynamisches Header-Lesen und `upsertQueueEntry` erweitert den Header automatisch. Wir muessen also keinen Header-Konstanten anlegen. Was noetig ist: sicherstellen, dass fehlende neue Spalten beim Lesen als leere Strings gelesen werden (ist bereits implementiert), und einen Regression-Test schreiben, der verifiziert dass die 6 neuen Spalten durch `upsertQueueEntry` korrekt in einen neuen Header auto-extended werden.

**Files:**
- Create: `test/queue.test.mjs`
- Read: `lib/queue.mjs` (no changes expected)

- [ ] **Step 1: Write the failing test**

Create `test/queue.test.mjs`:

```js
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { upsertQueueEntry } from "../lib/queue.mjs";

function makeTempQueue(header, rows = []) {
  const dir = mkdtempSync(path.join(tmpdir(), "pp-queue-"));
  const file = path.join(dir, "queue.csv");
  const lines = [header.join(";"), ...rows.map((r) => header.map((h) => r[h] ?? "").join(";"))];
  writeFileSync(file, lines.join("\n") + "\n", "utf8");
  return { dir, file };
}

test("upsertQueueEntry auto-extends header with new engine-decision columns", () => {
  const legacyHeader = [
    "url",
    "project",
    "project_fit_band",
    "project_fit_score",
    "matched_capabilities"
  ];
  const { dir, file } = makeTempQueue(legacyHeader, [
    { url: "https://github.com/acme/one", project: "eventbear-worker", project_fit_band: "high", project_fit_score: "70", matched_capabilities: "source_first" }
  ]);

  try {
    upsertQueueEntry(file, {
      url: "https://github.com/acme/one",
      project: "eventbear-worker",
      project_fit_band: "high",
      project_fit_score: 70,
      effort_band: "low",
      effort_score: 25,
      value_band: "high",
      value_score: 80,
      review_disposition: "intake_now",
      rules_fingerprint: "a3f9c1b2d4e5",
      matched_capabilities: "source_first"
    });

    const content = readFileSync(file, "utf8");
    const headerLine = content.split("\n")[0];
    for (const col of ["effort_band", "effort_score", "value_band", "value_score", "review_disposition", "rules_fingerprint"]) {
      assert.ok(headerLine.includes(col), `header missing ${col}: ${headerLine}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("reading a legacy row returns empty string for missing new columns", async () => {
  const { readQueue } = await import("../lib/queue.mjs");
  const legacyHeader = [
    "url",
    "project",
    "project_fit_band",
    "project_fit_score",
    "matched_capabilities"
  ];
  const { dir, file } = makeTempQueue(legacyHeader, [
    { url: "https://github.com/acme/two", project: "eventbear-worker", project_fit_band: "medium", project_fit_score: "50", matched_capabilities: "" }
  ]);

  try {
    const rows = readQueue(file);
    assert.equal(rows.length, 1);
    const row = rows[0];
    assert.equal(row.effort_band ?? "", "");
    assert.equal(row.value_band ?? "", "");
    assert.equal(row.rules_fingerprint ?? "", "");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- --test-name-pattern="upsertQueueEntry auto-extends|reading a legacy row"`
Expected: Both tests pass without any code change (queue.mjs already supports this). If they fail, inspect `readQueue`/`upsertQueueEntry` and fix the default-handling so fehlende Spalten als leere Strings landen — but **do not modify the public API**.

- [ ] **Step 3: Commit**

```bash
git add test/queue.test.mjs
git commit -m "test: pin queue.mjs auto-extension behavior for engine-decision columns"
```

---

## Phase 2 — Classification-Funktionen

### Task 3: EVALUATION_VERSION + classifyLicense + computeRulesFingerprint

**Why:** Die Fingerprint-Funktion braucht `classifyLicense` semantisch nicht, aber beide sind kleine Helfer die zusammen in einer TDD-Runde gebaut werden koennen — und die anderen grossen Engine-Funktionen haengen an `computeRulesFingerprint`. Wir bauen die Fundamente zuerst.

**Files:**
- Modify: `lib/classification.mjs`
- Modify: `test/classification.test.mjs` (create)

- [ ] **Step 1: Write the failing tests**

Create `test/classification.test.mjs`:

```js
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import {
  EVALUATION_VERSION,
  classifyLicense,
  computeRulesFingerprint
} from "../lib/classification.mjs";
import { makeFakeAlignmentRules } from "./helpers/fixtures.mjs";

describe("EVALUATION_VERSION", () => {
  test("is an integer >= 1", () => {
    assert.equal(typeof EVALUATION_VERSION, "number");
    assert.ok(Number.isInteger(EVALUATION_VERSION));
    assert.ok(EVALUATION_VERSION >= 1);
  });
});

describe("classifyLicense", () => {
  test("permissive licenses", () => {
    for (const l of ["MIT", "Apache-2.0", "BSD-3-Clause", "BSD-2-Clause", "ISC", "Unlicense"]) {
      assert.equal(classifyLicense(l), "permissive", `expected permissive for ${l}`);
    }
  });

  test("copyleft licenses", () => {
    for (const l of ["GPL-3.0", "GPL-2.0", "AGPL-3.0", "LGPL-2.1"]) {
      assert.equal(classifyLicense(l), "copyleft", `expected copyleft for ${l}`);
    }
  });

  test("unknown / missing licenses", () => {
    assert.equal(classifyLicense(null), "unknown");
    assert.equal(classifyLicense(undefined), "unknown");
    assert.equal(classifyLicense(""), "unknown");
    assert.equal(classifyLicense("NOASSERTION"), "unknown");
    assert.equal(classifyLicense("some-random-string"), "unknown");
  });
});

describe("computeRulesFingerprint", () => {
  test("returns a 12-char string", () => {
    const rules = makeFakeAlignmentRules();
    const fp = computeRulesFingerprint(rules);
    assert.equal(typeof fp, "string");
    assert.equal(fp.length, 12);
  });

  test("is deterministic: same input produces same fingerprint", () => {
    const rules = makeFakeAlignmentRules();
    const fp1 = computeRulesFingerprint(rules);
    const fp2 = computeRulesFingerprint(rules);
    assert.equal(fp1, fp2);
  });

  test("is deterministic across key-order changes", () => {
    const rules1 = makeFakeAlignmentRules();
    const rules2 = {
      patternTensions: rules1.patternTensions,
      gapMappings: rules1.gapMappings,
      layerMappings: rules1.layerMappings,
      capabilities: rules1.capabilities,
      projectKey: rules1.projectKey
    };
    assert.equal(computeRulesFingerprint(rules1), computeRulesFingerprint(rules2));
  });

  test("is sensitive: changing a layer_bias changes the fingerprint", () => {
    const rules = makeFakeAlignmentRules();
    const fp1 = computeRulesFingerprint(rules);
    const mutated = structuredClone(rules);
    mutated.layerMappings.source_intake.effort_bias = -10;
    const fp2 = computeRulesFingerprint(mutated);
    assert.notEqual(fp1, fp2);
  });

  test("is insensitive to non-evaluation meta fields like projectKey", () => {
    const rules = makeFakeAlignmentRules();
    const fp1 = computeRulesFingerprint(rules);
    const mutated = structuredClone(rules);
    mutated.projectKey = "other-project";
    const fp2 = computeRulesFingerprint(mutated);
    assert.equal(fp1, fp2);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- --test-name-pattern="EVALUATION_VERSION|classifyLicense|computeRulesFingerprint"`
Expected: All fail with `SyntaxError` or `TypeError` because the exports do not exist yet.

- [ ] **Step 3: Implement the three primitives in lib/classification.mjs**

Append to `lib/classification.mjs` (after the existing exports, before end of file):

```js
import { createHash } from "node:crypto";

/**
 * EVALUATION_VERSION ist ein manuell gepflegter Versions-Counter fuer die
 * Bewertungs-Logik in diesem Modul. Er wird NICHT automatisch aus Code-Hash
 * abgeleitet (zu fragil gegen Whitespace-Aenderungen).
 *
 * Bumpen bei jeder fachlichen Aenderung an:
 *   - buildCandidateEvaluation (Score-Summanden, Schwellenwerte)
 *   - deriveDisposition (Matrix-Zellen, Override-Reihenfolge, neue Overrides)
 *   - buildRunConfidence (Base-Entscheidung, Reality-Guards)
 *   - classifyLicense (Kategorien)
 *
 * NICHT bumpen bei:
 *   - Refactor ohne Verhaltensaenderung
 *   - Kommentar-Aenderungen
 *   - Test-Aenderungen
 *
 * Bump = alte Queue-Rows bekommen bei naechstem Fingerprint-Vergleich
 * automatisch decisionDataState: "stale".
 */
export const EVALUATION_VERSION = 1;

const PERMISSIVE_PATTERNS = [/^MIT/i, /^Apache/i, /^BSD/i, /^ISC$/i, /^Unlicense$/i];
const COPYLEFT_PATTERNS = [/^A?GPL/i, /^LGPL/i];

export function classifyLicense(licenseString) {
  if (!licenseString || typeof licenseString !== "string") {
    return "unknown";
  }
  const trimmed = licenseString.trim();
  if (trimmed === "" || trimmed.toUpperCase() === "NOASSERTION") {
    return "unknown";
  }
  if (PERMISSIVE_PATTERNS.some((r) => r.test(trimmed))) return "permissive";
  if (COPYLEFT_PATTERNS.some((r) => r.test(trimmed))) return "copyleft";
  return "unknown";
}

function canonicalStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map(canonicalStringify).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(value[k])).join(",") + "}";
}

export function computeRulesFingerprint(alignmentRules) {
  const relevant = {
    capabilities: alignmentRules?.capabilities ?? [],
    layerMappings: alignmentRules?.layerMappings ?? {},
    gapMappings: alignmentRules?.gapMappings ?? {},
    patternTensions: alignmentRules?.patternTensions ?? {}
  };
  const payload = canonicalStringify(relevant) + `::v${EVALUATION_VERSION}`;
  return createHash("sha1").update(payload).digest("hex").slice(0, 12);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- --test-name-pattern="EVALUATION_VERSION|classifyLicense|computeRulesFingerprint"`
Expected: All pass.

- [ ] **Step 5: Add a version-sensitivity test**

Append to `test/classification.test.mjs` (inside the `describe("computeRulesFingerprint", ...)` block or as a new describe):

```js
describe("computeRulesFingerprint version sensitivity", () => {
  test("a different EVALUATION_VERSION would produce a different fingerprint", async () => {
    // We cannot mutate the const at runtime, so we assert the formula shape:
    // a fingerprint computed against a payload that pretends to use version+1
    // must differ from the real fingerprint.
    const { createHash } = await import("node:crypto");
    const rules = makeFakeAlignmentRules();
    const real = computeRulesFingerprint(rules);

    // Replicate internal format and bump the version tag:
    const keys = (obj) => {
      if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
      if (Array.isArray(obj)) return "[" + obj.map(keys).join(",") + "]";
      return "{" + Object.keys(obj).sort().map((k) => JSON.stringify(k) + ":" + keys(obj[k])).join(",") + "}";
    };
    const relevant = {
      capabilities: rules.capabilities,
      layerMappings: rules.layerMappings,
      gapMappings: rules.gapMappings,
      patternTensions: rules.patternTensions
    };
    const bumpedPayload = keys(relevant) + `::v${EVALUATION_VERSION + 1}`;
    const bumped = createHash("sha1").update(bumpedPayload).digest("hex").slice(0, 12);

    assert.notEqual(real, bumped);
  });
});
```

- [ ] **Step 6: Run the new test**

Run: `npm test -- --test-name-pattern="version sensitivity"`
Expected: Pass.

- [ ] **Step 7: Commit**

```bash
git add lib/classification.mjs test/classification.test.mjs
git commit -m "feat(engine): add EVALUATION_VERSION, classifyLicense, computeRulesFingerprint"
```

### Task 4: bandFromScore helper + buildCandidateEvaluation

**Why:** Kern der Engine. Wandelt Repo-Signale in effort/value-Scores + Bands + Reason-Codes. Grosser Schritt — wir bauen erst den `bandFromScore`-Helper, dann die Hauptfunktion mit allen Summanden einzeln als Tests.

**Files:**
- Modify: `lib/classification.mjs`
- Modify: `test/classification.test.mjs`

- [ ] **Step 1: Write the failing test for bandFromScore**

Append to `test/classification.test.mjs`:

```js
import { bandFromScore } from "../lib/classification.mjs";

describe("bandFromScore", () => {
  test("0..35 is low", () => {
    assert.equal(bandFromScore(0), "low");
    assert.equal(bandFromScore(20), "low");
    assert.equal(bandFromScore(35), "low");
  });
  test("36..65 is medium", () => {
    assert.equal(bandFromScore(36), "medium");
    assert.equal(bandFromScore(50), "medium");
    assert.equal(bandFromScore(65), "medium");
  });
  test("66..100 is high", () => {
    assert.equal(bandFromScore(66), "high");
    assert.equal(bandFromScore(100), "high");
  });
});
```

- [ ] **Step 2: Run the test to verify failure**

Run: `npm test -- --test-name-pattern="bandFromScore"`
Expected: FAIL — `bandFromScore is not a function`.

- [ ] **Step 3: Implement bandFromScore**

Append to `lib/classification.mjs`:

```js
export function bandFromScore(score) {
  if (score <= 35) return "low";
  if (score <= 65) return "medium";
  return "high";
}
```

- [ ] **Step 4: Run the test to verify pass**

Run: `npm test -- --test-name-pattern="bandFromScore"`
Expected: PASS.

- [ ] **Step 5: Write the failing tests for buildCandidateEvaluation**

Append to `test/classification.test.mjs`:

```js
import { buildCandidateEvaluation } from "../lib/classification.mjs";
import {
  makeFakeRepo,
  makeFakeGuess,
  makeFakeEnrichment,
  makeFakeProjectAlignment,
  makeFakeAlignmentRules
} from "./helpers/fixtures.mjs";

describe("buildCandidateEvaluation", () => {
  test("returns all required fields", () => {
    const result = buildCandidateEvaluation(
      makeFakeRepo(),
      makeFakeGuess(),
      makeFakeEnrichment(),
      makeFakeProjectAlignment(),
      makeFakeAlignmentRules()
    );
    assert.ok("effortScore" in result);
    assert.ok("effortBand" in result);
    assert.ok("valueScore" in result);
    assert.ok("valueBand" in result);
    assert.ok(Array.isArray(result.effortReasons));
    assert.ok(Array.isArray(result.valueReasons));
    assert.equal(typeof result.decisionSummary, "string");
    assert.ok(result.decisionSummary.length > 0);
  });

  test("empty alignment rules -> unknown bands", () => {
    const result = buildCandidateEvaluation(
      makeFakeRepo(),
      makeFakeGuess(),
      makeFakeEnrichment(),
      makeFakeProjectAlignment(),
      { layerMappings: {}, gapMappings: {}, capabilities: [] }
    );
    assert.equal(result.effortBand, "unknown");
    assert.equal(result.valueBand, "unknown");
  });

  test("canonical source_intake + source_systems_and_families -> effort low, value high", () => {
    // Score trace for the reader:
    //   effort: 50 + layer_bias(-5) + size_penalty(-5 for 500KB) + language_match(-8 for JS)
    //           + activity(0) + license(-3 for MIT) = 29 → low band (0-35)
    //   value:  8 + gap_bias(+22) + matched_capabilities(3 * 8 = +24) + build_vs_borrow(+10)
    //           + priority(+8) + tensions(0) + archive(0) = 72 → high band (66-100)
    const result = buildCandidateEvaluation(
      makeFakeRepo({ size: 500 }),
      makeFakeGuess({ mainLayer: "source_intake", gapArea: "source_systems_and_families" }),
      makeFakeEnrichment({ repo: { size: 500, license: "MIT", primaryLanguage: "JavaScript" }, languages: ["JavaScript"] }),
      makeFakeProjectAlignment({ matchedCapabilities: ["source_first", "candidate_first", "evidence_acquisition"] }),
      makeFakeAlignmentRules()
    );
    assert.equal(result.effortBand, "low");
    assert.equal(result.valueBand, "high");
  });

  test("archived repo -> value penalty, effort penalty", () => {
    const archived = buildCandidateEvaluation(
      makeFakeRepo(),
      makeFakeGuess({ mainLayer: "source_intake", gapArea: "source_systems_and_families" }),
      makeFakeEnrichment({ repo: { archived: true, pushedAt: new Date("2020-01-01").toISOString() } }),
      makeFakeProjectAlignment({ matchedCapabilities: ["source_first"] }),
      makeFakeAlignmentRules()
    );
    const fresh = buildCandidateEvaluation(
      makeFakeRepo(),
      makeFakeGuess({ mainLayer: "source_intake", gapArea: "source_systems_and_families" }),
      makeFakeEnrichment(),
      makeFakeProjectAlignment({ matchedCapabilities: ["source_first"] }),
      makeFakeAlignmentRules()
    );
    assert.ok(archived.valueScore < fresh.valueScore, "archived should drop value");
    assert.ok(archived.effortScore > fresh.effortScore, "archived should raise effort");
  });

  test("permissive license produces effort discount; copyleft produces effort penalty; unknown produces smaller penalty", () => {
    const base = makeFakeGuess();
    const rules = makeFakeAlignmentRules();
    const mit = buildCandidateEvaluation(makeFakeRepo(), base, makeFakeEnrichment({ repo: { license: "MIT" } }), makeFakeProjectAlignment(), rules);
    const gpl = buildCandidateEvaluation(makeFakeRepo(), base, makeFakeEnrichment({ repo: { license: "GPL-3.0" } }), makeFakeProjectAlignment(), rules);
    const none = buildCandidateEvaluation(makeFakeRepo(), base, makeFakeEnrichment({ repo: { license: null } }), makeFakeProjectAlignment(), rules);
    assert.ok(mit.effortScore < none.effortScore, "permissive should be cheaper than unknown");
    assert.ok(gpl.effortScore > none.effortScore, "copyleft should be more expensive than unknown");
  });

  test("effortReasons contain token strings with +/- prefix for active summands", () => {
    const result = buildCandidateEvaluation(
      makeFakeRepo({ size: 15000 }),
      makeFakeGuess({ mainLayer: "source_intake" }),
      makeFakeEnrichment({ repo: { size: 15000, license: "MIT", primaryLanguage: "JavaScript" } }),
      makeFakeProjectAlignment(),
      makeFakeAlignmentRules()
    );
    assert.ok(result.effortReasons.some((r) => r.startsWith("layer_bias:")), "expected layer_bias token");
    assert.ok(result.effortReasons.some((r) => r.startsWith("size_penalty:+15")), "expected size_penalty:+15");
    assert.ok(result.effortReasons.some((r) => r.startsWith("language_match:-8")), "expected language_match:-8 for JS");
    assert.ok(result.effortReasons.some((r) => r.startsWith("license_adjustment:-3")), "expected license_adjustment:-3 for MIT");
  });

  test("valueReasons contain matched_capabilities and gap_bias tokens", () => {
    const result = buildCandidateEvaluation(
      makeFakeRepo(),
      makeFakeGuess({ gapArea: "source_systems_and_families", buildVsBorrow: "adapt_pattern", priority: "now" }),
      makeFakeEnrichment(),
      makeFakeProjectAlignment({ matchedCapabilities: ["source_first", "candidate_first"] }),
      makeFakeAlignmentRules()
    );
    assert.ok(result.valueReasons.some((r) => r.startsWith("gap_bias:+22")), "expected gap_bias:+22");
    assert.ok(result.valueReasons.some((r) => r.startsWith("matched_capabilities:+16")), "expected matched_capabilities:+16 (2 * 8)");
    assert.ok(result.valueReasons.some((r) => r.startsWith("build_vs_borrow:+10")), "expected build_vs_borrow:+10 for adapt_pattern");
    assert.ok(result.valueReasons.some((r) => r.startsWith("priority:+8")), "expected priority:+8 for now");
  });

  test("scores are clamped to 0..100", () => {
    const huge = buildCandidateEvaluation(
      makeFakeRepo({ size: 99999 }),
      makeFakeGuess({ mainLayer: "distribution_plugin" }),
      makeFakeEnrichment({ repo: { size: 99999, license: "GPL-3.0", archived: true, primaryLanguage: "Rust" } }),
      makeFakeProjectAlignment({ matchedCapabilities: [] }),
      makeFakeAlignmentRules()
    );
    assert.ok(huge.effortScore >= 0 && huge.effortScore <= 100);
    assert.ok(huge.valueScore >= 0 && huge.valueScore <= 100);
  });
});
```

- [ ] **Step 6: Run the failing tests**

Run: `npm test -- --test-name-pattern="buildCandidateEvaluation"`
Expected: FAIL — function does not exist.

- [ ] **Step 7: Implement buildCandidateEvaluation**

Append to `lib/classification.mjs`:

```js
const PERMISSIVE_DISCOUNT = -3;
const COPYLEFT_PENALTY = 8;
const UNKNOWN_LICENSE_PENALTY = 4;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function effortSizePenalty(sizeKb) {
  if (!Number.isFinite(sizeKb)) return { delta: 0, token: null };
  if (sizeKb > 10000) return { delta: 15, token: "size_penalty:+15" };
  if (sizeKb > 1000) return { delta: 5, token: "size_penalty:+5" };
  return { delta: -5, token: "size_penalty:-5" };
}

function effortLanguageDelta(primaryLanguage) {
  if (!primaryLanguage) return { delta: 0, token: null };
  const js = ["JavaScript", "TypeScript"];
  const midFamiliar = ["Python", "Go", "Ruby"];
  const exotic = ["Rust", "C++", "Elixir", "Haskell"];
  if (js.includes(primaryLanguage)) return { delta: -8, token: "language_match:-8" };
  if (midFamiliar.includes(primaryLanguage)) return { delta: 5, token: "language_match:+5" };
  if (exotic.includes(primaryLanguage)) return { delta: 12, token: "language_match:+12" };
  return { delta: 0, token: null };
}

function effortActivityDelta(activityStatus) {
  if (activityStatus === "stale") return { delta: 8, token: "activity_penalty:+8" };
  if (activityStatus === "archived") return { delta: 12, token: "activity_penalty:+12" };
  return { delta: 0, token: null };
}

function effortLicenseDelta(licenseString) {
  const cat = classifyLicense(licenseString);
  if (cat === "permissive") return { delta: PERMISSIVE_DISCOUNT, token: `license_adjustment:${PERMISSIVE_DISCOUNT}` };
  if (cat === "copyleft") return { delta: COPYLEFT_PENALTY, token: `license_adjustment:+${COPYLEFT_PENALTY}` };
  return { delta: UNKNOWN_LICENSE_PENALTY, token: `license_adjustment:+${UNKNOWN_LICENSE_PENALTY}` };
}

function valueBuildVsBorrowDelta(buildVsBorrow) {
  if (buildVsBorrow === "adapt_pattern") return { delta: 10, token: "build_vs_borrow:+10" };
  if (buildVsBorrow === "borrow_optional") return { delta: 5, token: "build_vs_borrow:+5" };
  return { delta: 0, token: null };
}

function valuePriorityDelta(priority) {
  if (priority === "now") return { delta: 8, token: "priority:+8" };
  return { delta: 0, token: null };
}

export function buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules) {
  const layerMapping = alignmentRules?.layerMappings?.[guess?.mainLayer] ?? null;
  const gapMapping = alignmentRules?.gapMappings?.[guess?.gapArea] ?? null;
  const hasMappings = Boolean(layerMapping || gapMapping);

  // effortScore
  let effortScore = 50;
  const effortReasons = [];

  if (layerMapping && typeof layerMapping.effort_bias === "number") {
    effortScore += layerMapping.effort_bias;
    const sign = layerMapping.effort_bias >= 0 ? "+" : "";
    effortReasons.push(`layer_bias:${sign}${layerMapping.effort_bias}`);
  }

  const sizeKb = enrichment?.repo?.size ?? repo?.size ?? null;
  const size = effortSizePenalty(sizeKb);
  if (size.token) {
    effortScore += size.delta;
    effortReasons.push(size.token);
  }

  const lang = effortLanguageDelta(enrichment?.repo?.primaryLanguage);
  if (lang.token) {
    effortScore += lang.delta;
    effortReasons.push(lang.token);
  }

  const activity = deriveActivityStatus(enrichment);
  const act = effortActivityDelta(activity);
  if (act.token) {
    effortScore += act.delta;
    effortReasons.push(act.token);
  }

  const lic = effortLicenseDelta(enrichment?.repo?.license);
  effortScore += lic.delta;
  effortReasons.push(lic.token);

  effortScore = clamp(effortScore, 0, 100);

  // valueScore
  let valueScore = 8;
  const valueReasons = [];

  if (gapMapping && typeof gapMapping.value_bias === "number") {
    valueScore += gapMapping.value_bias;
    valueReasons.push(`gap_bias:+${gapMapping.value_bias}`);
  }

  const matchedCount = projectAlignment?.matchedCapabilities?.length ?? 0;
  if (matchedCount > 0) {
    const delta = matchedCount * 8;
    valueScore += delta;
    valueReasons.push(`matched_capabilities:+${delta}`);
  }

  const bvb = valueBuildVsBorrowDelta(guess?.buildVsBorrow);
  if (bvb.token) {
    valueScore += bvb.delta;
    valueReasons.push(bvb.token);
  }

  const prio = valuePriorityDelta(guess?.priority);
  if (prio.token) {
    valueScore += prio.delta;
    valueReasons.push(prio.token);
  }

  const tensionsCount = Object.keys(alignmentRules?.patternTensions ?? {}).length;
  if (tensionsCount > 0) {
    valueScore -= 6;
    valueReasons.push("tension_penalty:-6");
  }

  if (enrichment?.repo?.archived) {
    valueScore -= 15;
    valueReasons.push("archive_value_drop:-15");
  }

  valueScore = clamp(valueScore, 0, 100);

  // Bands
  const effortBand = hasMappings ? bandFromScore(effortScore) : "unknown";
  const valueBand = hasMappings ? bandFromScore(valueScore) : "unknown";

  const decisionSummary = buildDecisionSummary(effortBand, valueBand);

  return {
    effortScore,
    effortBand,
    valueScore,
    valueBand,
    effortReasons,
    valueReasons,
    decisionSummary
  };
}

function buildDecisionSummary(effortBand, valueBand) {
  if (effortBand === "unknown" || valueBand === "unknown") {
    return "Insufficient signal for band decision";
  }
  const effortLabel = effortBand === "low" ? "low effort" : effortBand === "medium" ? "medium effort" : "high effort";
  const valueLabel = valueBand === "low" ? "low value" : valueBand === "medium" ? "medium value" : "high value";
  if (effortBand === "low" && valueBand === "high") return `High value, low effort, candidate for direct intake`;
  if (valueBand === "high") return `High value, ${effortLabel}, review before adoption`;
  if (valueBand === "medium") return `Medium value, ${effortLabel}, observe or defer`;
  return `Low value, ${effortLabel}, skip`;
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm test -- --test-name-pattern="buildCandidateEvaluation"`
Expected: PASS all 8 buildCandidateEvaluation subtests.

- [ ] **Step 9: Commit**

```bash
git add lib/classification.mjs test/classification.test.mjs
git commit -m "feat(engine): add bandFromScore and buildCandidateEvaluation"
```

### Task 5: deriveDisposition (3x3 matrix + 4 overrides)

**Files:**
- Modify: `lib/classification.mjs`
- Modify: `test/classification.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `test/classification.test.mjs`:

```js
import { deriveDisposition } from "../lib/classification.mjs";

describe("deriveDisposition matrix", () => {
  const cases = [
    ["low",    "low",    "observe_only"],
    ["low",    "medium", "review_queue"],
    ["low",    "high",   "intake_now"],
    ["medium", "low",    "skip"],
    ["medium", "medium", "observe_only"],
    ["medium", "high",   "review_queue"],
    ["high",   "low",    "skip"],
    ["high",   "medium", "observe_only"],
    ["high",   "high",   "review_queue"]
  ];
  for (const [effortBand, valueBand, expected] of cases) {
    test(`effort ${effortBand} + value ${valueBand} -> ${expected}`, () => {
      const out = deriveDisposition({ effortBand, valueBand }, [], "high");
      assert.equal(out.disposition, expected);
      assert.equal(out.dispositionReason, `matrix:effort_${effortBand}_value_${valueBand}`);
    });
  }
});

describe("deriveDisposition overrides", () => {
  test("archived_repo caps at observe_only even if matrix says intake_now", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "high" }, ["archived_repo"], "high");
    assert.equal(out.disposition, "observe_only");
    assert.equal(out.dispositionReason, "override:archived_cap");
  });

  test("source_lock_in with non-high value -> observe_only", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "medium" }, ["source_lock_in"], "high");
    assert.equal(out.disposition, "observe_only");
    assert.equal(out.dispositionReason, "override:source_lock_in_cap");
  });

  test("source_lock_in with high value -> matrix applies", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "high" }, ["source_lock_in"], "high");
    assert.equal(out.disposition, "intake_now");
  });

  test("unknown fit -> observe_only", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "high" }, [], "unknown");
    assert.equal(out.disposition, "observe_only");
    assert.equal(out.dispositionReason, "override:unknown_fit");
  });

  test("unknown effort band -> cap at review_queue", () => {
    const out = deriveDisposition({ effortBand: "unknown", valueBand: "high" }, [], "high");
    assert.equal(out.disposition, "review_queue");
    assert.equal(out.dispositionReason, "override:unknown_band");
  });

  test("unknown value band -> cap at review_queue", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "unknown" }, [], "high");
    assert.equal(out.disposition, "review_queue");
    assert.equal(out.dispositionReason, "override:unknown_band");
  });

  test("override priority: archived beats source_lock_in beats unknown_fit beats unknown_band", () => {
    const out = deriveDisposition(
      { effortBand: "unknown", valueBand: "unknown" },
      ["archived_repo", "source_lock_in"],
      "unknown"
    );
    assert.equal(out.dispositionReason, "override:archived_cap");
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- --test-name-pattern="deriveDisposition"`
Expected: FAIL — function does not exist.

- [ ] **Step 3: Implement deriveDisposition**

Append to `lib/classification.mjs`:

```js
const MATRIX = {
  low: {
    low: "observe_only",
    medium: "review_queue",
    high: "intake_now"
  },
  medium: {
    low: "skip",
    medium: "observe_only",
    high: "review_queue"
  },
  high: {
    low: "skip",
    medium: "observe_only",
    high: "review_queue"
  }
};

export function deriveDisposition(evaluation, risks, projectFitBand) {
  const risksArr = Array.isArray(risks) ? risks : [];
  const effortBand = evaluation?.effortBand;
  const valueBand = evaluation?.valueBand;

  // Override 1: archived_repo caps at observe_only
  if (risksArr.includes("archived_repo")) {
    return { disposition: "observe_only", dispositionReason: "override:archived_cap" };
  }

  // Override 2: source_lock_in with non-high value -> observe_only
  if (risksArr.includes("source_lock_in") && valueBand !== "high") {
    return { disposition: "observe_only", dispositionReason: "override:source_lock_in_cap" };
  }

  // Override 3: unknown fit -> observe_only
  if (projectFitBand === "unknown") {
    return { disposition: "observe_only", dispositionReason: "override:unknown_fit" };
  }

  // Override 4: unknown effort or value band -> cap at review_queue
  if (effortBand === "unknown" || valueBand === "unknown") {
    return { disposition: "review_queue", dispositionReason: "override:unknown_band" };
  }

  // Matrix
  const disposition = MATRIX[effortBand]?.[valueBand] ?? "observe_only";
  return {
    disposition,
    dispositionReason: `matrix:effort_${effortBand}_value_${valueBand}`
  };
}
```

- [ ] **Step 4: Run the tests to verify pass**

Run: `npm test -- --test-name-pattern="deriveDisposition"`
Expected: All 16 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/classification.mjs test/classification.test.mjs
git commit -m "feat(engine): add deriveDisposition with 3x3 matrix and 4 overrides"
```

### Task 6: buildRunConfidence (base + reality guards)

**Files:**
- Modify: `lib/classification.mjs`
- Modify: `test/classification.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `test/classification.test.mjs`:

```js
import { buildRunConfidence } from "../lib/classification.mjs";

function makeCandidates(specs) {
  return specs.map((s, i) => ({
    repo: { owner: "x", name: `r${i}` },
    projectAlignment: { fitBand: s.fit, matchedCapabilities: s.caps ?? [] },
    risks: s.risks ?? []
  }));
}

describe("buildRunConfidence base", () => {
  test("n < 3 -> low", () => {
    const r = buildRunConfidence(makeCandidates([{ fit: "high" }, { fit: "high" }]), 6);
    assert.equal(r.runConfidence, "low");
    assert.ok(r.runConfidenceReason.includes("too few"));
  });

  test("3 high-fit + 40% diversity -> high", () => {
    const cands = makeCandidates([
      { fit: "high", caps: ["source_first", "candidate_first"] },
      { fit: "high", caps: ["evidence_acquisition"] },
      { fit: "high", caps: ["quality_governance"] }
    ]);
    const r = buildRunConfidence(cands, 6);
    assert.equal(r.runConfidence, "high");
  });

  test("2 high-fit -> medium", () => {
    const cands = makeCandidates([
      { fit: "high", caps: ["source_first"] },
      { fit: "high", caps: ["candidate_first"] },
      { fit: "medium", caps: [] },
      { fit: "medium", caps: [] }
    ]);
    const r = buildRunConfidence(cands, 6);
    assert.equal(r.runConfidence, "medium");
  });

  test("thin signals -> low", () => {
    const cands = makeCandidates([
      { fit: "low" },
      { fit: "low" },
      { fit: "low" },
      { fit: "medium" }
    ]);
    const r = buildRunConfidence(cands, 6);
    assert.equal(r.runConfidence, "low");
  });
});

describe("buildRunConfidence reality guards", () => {
  test(">30% unknown fit caps high at medium", () => {
    const cands = makeCandidates([
      { fit: "high", caps: ["source_first", "candidate_first"] },
      { fit: "high", caps: ["evidence_acquisition"] },
      { fit: "high", caps: ["quality_governance"] },
      { fit: "unknown" },
      { fit: "unknown" }
    ]);
    const r = buildRunConfidence(cands, 6);
    assert.equal(r.runConfidence, "medium");
    assert.ok(r.runConfidenceReason.includes("unknown fit"));
  });

  test(">40% risky caps high at medium", () => {
    const cands = makeCandidates([
      { fit: "high", caps: ["source_first", "candidate_first"], risks: ["archived_repo"] },
      { fit: "high", caps: ["evidence_acquisition"], risks: ["source_lock_in"] },
      { fit: "high", caps: ["quality_governance"] },
      { fit: "high", caps: ["location_intelligence"] },
      { fit: "high", caps: ["distribution_surfaces"] }
    ]);
    const r = buildRunConfidence(cands, 6);
    assert.equal(r.runConfidence, "medium");
    assert.ok(r.runConfidenceReason.includes("risk-flagged"));
  });

  test("both guards together cap at medium, not lower", () => {
    const cands = makeCandidates([
      { fit: "high", caps: ["source_first", "candidate_first"] },
      { fit: "high", caps: ["evidence_acquisition"] },
      { fit: "high", caps: ["quality_governance"], risks: ["archived_repo"] },
      { fit: "unknown", risks: ["source_lock_in"] },
      { fit: "unknown", risks: ["archived_repo"] }
    ]);
    const r = buildRunConfidence(cands, 6);
    assert.equal(r.runConfidence, "medium");
  });
});

describe("buildRunConfidence confidenceFactors", () => {
  test("returns all 5 raw numbers", () => {
    const cands = makeCandidates([
      { fit: "high", caps: ["source_first"] },
      { fit: "medium", caps: ["candidate_first"] },
      { fit: "unknown" }
    ]);
    const r = buildRunConfidence(cands, 6);
    assert.equal(r.confidenceFactors.candidateCount, 3);
    assert.equal(r.confidenceFactors.highFitCount, 1);
    assert.equal(r.confidenceFactors.unknownFitCount, 1);
    assert.equal(r.confidenceFactors.riskyCount, 0);
    assert.equal(typeof r.confidenceFactors.capabilityDiversity, "number");
  });
});

describe("buildRunConfidence accepts both nested and flat candidate shapes", () => {
  test("flat shape (review-style) works the same as nested (discovery-style)", () => {
    const nested = [
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["source_first", "candidate_first"] }, risks: [] },
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["evidence_acquisition"] }, risks: [] },
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["quality_governance"] }, risks: [] }
    ];
    const flat = [
      { projectFitBand: "high", matchedCapabilities: ["source_first", "candidate_first"], risks: [] },
      { projectFitBand: "high", matchedCapabilities: ["evidence_acquisition"], risks: [] },
      { projectFitBand: "high", matchedCapabilities: ["quality_governance"], risks: [] }
    ];
    const rNested = buildRunConfidence(nested, 6);
    const rFlat = buildRunConfidence(flat, 6);
    assert.equal(rNested.runConfidence, rFlat.runConfidence);
    assert.equal(rNested.confidenceFactors.highFitCount, rFlat.confidenceFactors.highFitCount);
    assert.equal(rNested.confidenceFactors.capabilityDiversity, rFlat.confidenceFactors.capabilityDiversity);
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- --test-name-pattern="buildRunConfidence"`
Expected: FAIL — function does not exist.

- [ ] **Step 3: Implement buildRunConfidence**

Append to `lib/classification.mjs`:

```js
function minConfidence(a, b) {
  const order = { low: 0, medium: 1, high: 2 };
  return order[a] <= order[b] ? a : b;
}

// Discovery candidates carry `projectAlignment: { fitBand, matchedCapabilities }` nested.
// Review items carry `projectFitBand` / `matchedCapabilities` flat (from queue rows).
// buildRunConfidence accepts both shapes so the function can be shared without normalization
// at every call site.
function readFitBand(c) {
  return c?.projectAlignment?.fitBand ?? c?.projectFitBand ?? "unknown";
}
function readMatchedCapabilities(c) {
  return c?.projectAlignment?.matchedCapabilities ?? c?.matchedCapabilities ?? [];
}

export function buildRunConfidence(candidates, totalCapabilitiesInRules) {
  const n = candidates.length;
  const highFitCount = candidates.filter((c) => readFitBand(c) === "high").length;
  const unknownFitCount = candidates.filter((c) => readFitBand(c) === "unknown").length;
  const riskyCount = candidates.filter((c) =>
    (c?.risks ?? []).some((r) => r === "archived_repo" || r === "source_lock_in")
  ).length;

  const uniqueCaps = new Set();
  for (const c of candidates) {
    for (const cap of readMatchedCapabilities(c)) {
      uniqueCaps.add(cap);
    }
  }
  const totalCaps = Math.max(1, totalCapabilitiesInRules || 1);
  const capabilityDiversity = uniqueCaps.size / totalCaps;

  let base;
  let reason;

  if (n < 3) {
    base = "low";
    reason = `Only ${n} candidate(s) evaluated — too few to draw a pattern`;
  } else if (highFitCount >= 3 && capabilityDiversity >= 0.4) {
    base = "high";
    reason = `${highFitCount} high-fit candidates across ${uniqueCaps.size} capabilities`;
  } else if (highFitCount >= 2 || capabilityDiversity >= 0.25) {
    base = "medium";
    reason = `${highFitCount} high-fit candidates, capability diversity ${Math.round(capabilityDiversity * 100)}%`;
  } else {
    base = "low";
    reason = `${highFitCount} high-fit in ${n} total — signals are thin`;
  }

  if (n > 0 && unknownFitCount / n > 0.3) {
    base = minConfidence(base, "medium");
    reason += ` — capped: ${unknownFitCount}/${n} candidates unknown fit`;
  }
  if (n > 0 && riskyCount / n > 0.4) {
    base = minConfidence(base, "medium");
    reason += ` — capped: ${riskyCount}/${n} candidates risk-flagged`;
  }

  return {
    runConfidence: base,
    runConfidenceReason: reason,
    confidenceFactors: {
      candidateCount: n,
      highFitCount,
      unknownFitCount,
      riskyCount,
      capabilityDiversity
    }
  };
}
```

- [ ] **Step 4: Run the tests to verify pass**

Run: `npm test -- --test-name-pattern="buildRunConfidence"`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/classification.mjs test/classification.test.mjs
git commit -m "feat(engine): add buildRunConfidence with reality guards"
```

---

## Phase 3 — Intake-Integration

### Task 7: intake.mjs wires buildCandidateEvaluation + deriveDisposition + dossier block

**Files:**
- Modify: `lib/intake.mjs`
- Create: `test/intake.test.mjs`

- [ ] **Step 1: Read intake.mjs to locate the integration point**

Open `lib/intake.mjs`. Find the place where `buildProjectAlignment` is called — that is the insertion point. Also find `renderIntakeDoc` to see where the `## Project Alignment` block is built, and add the `## Decision Signals` block right after it.

- [ ] **Step 2: Write the failing integration test**

Create `test/intake.test.mjs`:

```js
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { makeFakeRepo, makeFakeGuess, makeFakeEnrichment, makeFakeProjectAlignment } from "./helpers/fixtures.mjs";
import { renderIntakeDoc } from "../lib/intake.mjs";

function makeBinding() {
  return {
    projectKey: "eventbear-worker",
    readBeforeAnalysis: [],
    referenceDirectories: [],
    analysisQuestions: [],
    targetCapabilities: []
  };
}

describe("renderIntakeDoc decision signals block", () => {
  test("includes ## Decision Signals block with bands and fingerprint", () => {
    const repo = { ...makeFakeRepo(), host: "github.com" };
    const doc = renderIntakeDoc({
      repo,
      guess: makeFakeGuess(),
      enrichment: makeFakeEnrichment(),
      landkarteCandidate: null,
      projectAlignment: makeFakeProjectAlignment(),
      projectProfile: { referenceFiles: [] },
      binding: makeBinding(),
      projectLabel: "eventbear-worker",
      repoRoot: "../eventbear-worker",
      createdAt: "2026-04-13T00:00:00.000Z",
      notes: [],
      candidate: {
        effortBand: "low",
        effortScore: 25,
        valueBand: "high",
        valueScore: 80,
        reviewDisposition: "intake_now",
        rulesFingerprint: "a3f9c1b2d4e5",
        decisionSummary: "High value, low effort, candidate for direct intake",
        effortReasons: ["layer_bias:-5", "language_match:-8"],
        valueReasons: ["gap_bias:+22", "matched_capabilities:+16"],
        dispositionReason: "matrix:effort_low_value_high"
      }
    });
    assert.ok(doc.includes("## Decision Signals"));
    assert.ok(doc.includes("- effort: low"));
    assert.ok(doc.includes("- value: high"));
    assert.ok(doc.includes("- review_disposition: intake_now"));
    assert.ok(doc.includes("- rules_fingerprint: a3f9c1b2d4e5"));
    assert.ok(doc.includes("### Reasons"));
    assert.ok(doc.includes("layer_bias:-5"));
    assert.ok(doc.includes("matrix:effort_low_value_high"));
  });
});
```

**Note:** the real `renderIntakeDoc` signature may expose more fields (check `lib/intake.mjs`). If the test fails because a required field is missing from our fixture, add the missing field to `makeBinding()` — do not loosen the assertions. The `candidate` parameter is the NEW one this task is adding.

- [ ] **Step 3: Run the failing test**

Run: `npm test -- --test-name-pattern="renderIntakeDoc decision signals"`
Expected: FAIL — either `renderIntakeDoc` does not accept `candidate` or it does not render the block.

- [ ] **Step 4: Modify renderIntakeDoc to render the Decision Signals block**

In `lib/intake.mjs`, locate where the `## Project Alignment` block is rendered. After its closing (before the next section), add:

```js
function renderDecisionSignalsBlock(candidate) {
  if (!candidate) return "";
  const lines = [
    "",
    "## Decision Signals",
    "",
    `- effort: ${candidate.effortBand ?? "unknown"}`,
    `- value: ${candidate.valueBand ?? "unknown"}`,
    `- review_disposition: ${candidate.reviewDisposition ?? "unknown"}`,
    `- summary: ${candidate.decisionSummary ?? "-"}`,
    `- rules_fingerprint: ${candidate.rulesFingerprint ?? "-"}`,
    "",
    "### Reasons",
    "",
    `- effort: ${(candidate.effortReasons ?? []).join(", ") || "-"}`,
    `- value: ${(candidate.valueReasons ?? []).join(", ") || "-"}`,
    `- disposition: ${candidate.dispositionReason ?? "-"}`,
    ""
  ];
  return lines.join("\n");
}
```

Then in `renderIntakeDoc`, after the line that appends the Project Alignment section, append:

```js
doc += renderDecisionSignalsBlock(input.candidate);
```

Adjust variable names to match the real structure of the existing `renderIntakeDoc` (it may use a `parts` array or similar — add the block in the same style).

- [ ] **Step 5: Modify the intake pipeline to compute and pass the candidate decision fields**

In `lib/intake.mjs`, at the top add:

```js
import {
  buildCandidateEvaluation,
  deriveDisposition,
  computeRulesFingerprint
} from "./classification.mjs";
```

Then locate the code path that calls `buildProjectAlignment`. After that call, add:

```js
const evaluation = buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules);
const { disposition, dispositionReason } = deriveDisposition(
  evaluation,
  projectAlignment.risks ?? [],
  projectAlignment.fitBand
);
const rulesFingerprint = computeRulesFingerprint(alignmentRules);

const decisionFields = {
  effortBand: evaluation.effortBand,
  effortScore: evaluation.effortScore,
  valueBand: evaluation.valueBand,
  valueScore: evaluation.valueScore,
  reviewDisposition: disposition,
  rulesFingerprint,
  decisionSummary: evaluation.decisionSummary,
  effortReasons: evaluation.effortReasons,
  valueReasons: evaluation.valueReasons,
  dispositionReason
};
```

Pass `decisionFields` both into `renderIntakeDoc` (as `candidate`) and into the queue upsert payload. In the `upsertQueueEntry` call, add these 6 new fields:

```js
upsertQueueEntry(queuePath, {
  // ... bestehende Felder
  effort_band: decisionFields.effortBand,
  effort_score: decisionFields.effortScore,
  value_band: decisionFields.valueBand,
  value_score: decisionFields.valueScore,
  review_disposition: decisionFields.reviewDisposition,
  rules_fingerprint: decisionFields.rulesFingerprint
});
```

- [ ] **Step 6: Run the intake test to verify pass**

Run: `npm test -- --test-name-pattern="renderIntakeDoc decision signals"`
Expected: PASS.

- [ ] **Step 7: Run the full test suite to ensure nothing regressed**

Run: `npm test`
Expected: All existing tests still pass.

- [ ] **Step 8: Commit**

```bash
git add lib/intake.mjs test/intake.test.mjs
git commit -m "feat(intake): persist engine decision fields to queue and dossier"
```

---

## Phase 4 — Pipeline-Integration

### Task 8: discovery.mjs replaces buildDiscoveryDisposition with shared engine

**Files:**
- Modify: `lib/discovery.mjs`
- Create: `test/discovery.test.mjs`

- [ ] **Step 1: Write the failing integration test**

Create `test/discovery.test.mjs`:

```js
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";

describe("discovery run-level engine fields", () => {
  test("decorateDiscoveryCandidate attaches effort/value bands and disposition", async () => {
    const { decorateDiscoveryCandidate } = await import("../lib/discovery.mjs");
    const { makeFakeRepo, makeFakeGuess, makeFakeEnrichment, makeFakeAlignmentRules, makeFakeProjectAlignment } = await import("./helpers/fixtures.mjs");

    const candidate = {
      repo: makeFakeRepo(),
      guess: makeFakeGuess({ mainLayer: "source_intake", gapArea: "source_systems_and_families" }),
      enrichment: makeFakeEnrichment(),
      projectAlignment: makeFakeProjectAlignment({ fitBand: "high", matchedCapabilities: ["source_first", "candidate_first"] }),
      risks: [],
      discoveryScore: 60,
      reasoning: ["seed match"]
    };

    const decorated = decorateDiscoveryCandidate(candidate, makeFakeAlignmentRules());

    assert.ok(["low", "medium", "high"].includes(decorated.effortBand));
    assert.ok(["low", "medium", "high"].includes(decorated.valueBand));
    assert.ok(["intake_now", "review_queue", "observe_only", "skip"].includes(decorated.discoveryDisposition));
    assert.equal(decorated.decisionDataState, "complete");
    assert.ok(typeof decorated.dispositionReason === "string");
  });

  test("buildDiscoveryRunFields adds schema version 2 and itemsDataStateSummary", async () => {
    const { buildDiscoveryRunFields } = await import("../lib/discovery.mjs");
    const { makeFakeAlignmentRules } = await import("./helpers/fixtures.mjs");

    const candidates = [
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["source_first"] }, risks: [], decisionDataState: "complete" },
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["candidate_first"] }, risks: [], decisionDataState: "complete" },
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["evidence_acquisition"] }, risks: [], decisionDataState: "complete" }
    ];

    const run = buildDiscoveryRunFields(candidates, makeFakeAlignmentRules());
    assert.equal(run.reportSchemaVersion, 2);
    assert.equal(typeof run.runConfidence, "string");
    assert.equal(typeof run.runConfidenceReason, "string");
    assert.ok(run.confidenceFactors);
    assert.deepEqual(run.itemsDataStateSummary, { complete: 3, fallback: 0, stale: 0 });
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- --test-name-pattern="discovery run-level"`
Expected: FAIL — `decorateDiscoveryCandidate` or `buildDiscoveryRunFields` does not exist.

- [ ] **Step 3: Refactor discovery.mjs**

Open `lib/discovery.mjs`.

**Delete** the existing `buildDiscoveryDisposition` function (~lines 417-428).

At the top of the file, add imports:

```js
import {
  buildCandidateEvaluation,
  deriveDisposition,
  buildRunConfidence
} from "./classification.mjs";
```

Add two new exported helpers (near the top, after imports):

```js
export function decorateDiscoveryCandidate(candidate, alignmentRules) {
  const evaluation = buildCandidateEvaluation(
    candidate.repo,
    candidate.guess,
    candidate.enrichment,
    candidate.projectAlignment,
    alignmentRules
  );
  const { disposition, dispositionReason } = deriveDisposition(
    evaluation,
    candidate.risks ?? [],
    candidate.projectAlignment?.fitBand
  );
  Object.assign(candidate, {
    effortBand: evaluation.effortBand,
    effortScore: evaluation.effortScore,
    valueBand: evaluation.valueBand,
    valueScore: evaluation.valueScore,
    discoveryDisposition: disposition,
    dispositionReason,
    decisionDataState: "complete",
    decisionSummary: evaluation.decisionSummary,
    effortReasons: evaluation.effortReasons,
    valueReasons: evaluation.valueReasons
  });
  return candidate;
}

export function buildDiscoveryRunFields(candidates, alignmentRules) {
  const totalCaps = alignmentRules?.capabilities?.length ?? 0;
  const confidence = buildRunConfidence(candidates, totalCaps);
  const itemsDataStateSummary = candidates.reduce(
    (acc, c) => {
      const state = c?.decisionDataState ?? "complete";
      acc[state] = (acc[state] ?? 0) + 1;
      return acc;
    },
    { complete: 0, fallback: 0, stale: 0 }
  );
  return {
    reportSchemaVersion: 2,
    runConfidence: confidence.runConfidence,
    runConfidenceReason: confidence.runConfidenceReason,
    confidenceFactors: confidence.confidenceFactors,
    itemsDataStateSummary
  };
}
```

Then in the main `discoverGithubCandidates` function (or whichever function produces the final `candidates` array and `discovery` run object), replace the old `candidate.discoveryDisposition = buildDiscoveryDisposition(candidate)` line with:

```js
decorateDiscoveryCandidate(candidate, alignmentRules);
```

And before the final `return discovery` (or equivalent), add:

```js
Object.assign(discovery, buildDiscoveryRunFields(discovery.candidates, alignmentRules));
```

Remove any remaining references to `buildDiscoveryDisposition`.

- [ ] **Step 4: Run the tests to verify pass**

Run: `npm test -- --test-name-pattern="discovery run-level"`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: Everything still green.

- [ ] **Step 6: Commit**

```bash
git add lib/discovery.mjs test/discovery.test.mjs
git commit -m "feat(discovery): use shared deriveDisposition and emit run-level engine fields"
```

### Task 9: review.mjs decisionDataState state machine

**Files:**
- Modify: `lib/review.mjs`
- Create: `test/review.test.mjs`

- [ ] **Step 1: Write the failing state-machine tests**

Create `test/review.test.mjs`:

```js
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { classifyReviewItemState, buildReviewRunFields } from "../lib/review.mjs";
import { computeRulesFingerprint } from "../lib/classification.mjs";
import { makeFakeAlignmentRules } from "./helpers/fixtures.mjs";

describe("classifyReviewItemState", () => {
  const rules = makeFakeAlignmentRules();
  const currentFp = computeRulesFingerprint(rules);

  test("complete row with matching fingerprint -> complete", () => {
    const row = {
      effort_band: "low",
      effort_score: "25",
      value_band: "high",
      value_score: "80",
      review_disposition: "intake_now",
      rules_fingerprint: currentFp,
      project_fit_band: "high"
    };
    const item = classifyReviewItemState(row, rules, currentFp);
    assert.equal(item.decisionDataState, "complete");
    assert.equal(item.reviewDisposition, "intake_now");
  });

  test("row without review_disposition -> fallback (derives disposition)", () => {
    const row = {
      effort_band: "low",
      effort_score: "25",
      value_band: "high",
      value_score: "80",
      review_disposition: "",
      rules_fingerprint: currentFp,
      project_fit_band: "high"
    };
    const item = classifyReviewItemState(row, rules, currentFp);
    assert.equal(item.decisionDataState, "fallback");
    assert.equal(item.reviewDisposition, "intake_now");
  });

  test("row with empty effort_band (pre-schema) -> fallback", () => {
    const row = {
      effort_band: "",
      effort_score: "",
      value_band: "",
      value_score: "",
      review_disposition: "review_queue",
      rules_fingerprint: currentFp,
      project_fit_band: "high"
    };
    const item = classifyReviewItemState(row, rules, currentFp);
    assert.equal(item.decisionDataState, "fallback");
  });

  test("row with mismatched fingerprint -> stale", () => {
    const row = {
      effort_band: "low",
      effort_score: "25",
      value_band: "high",
      value_score: "80",
      review_disposition: "intake_now",
      rules_fingerprint: "000000000000",
      project_fit_band: "high"
    };
    const item = classifyReviewItemState(row, rules, currentFp);
    assert.equal(item.decisionDataState, "stale");
  });

  test("row with missing fingerprint -> stale (not silent complete)", () => {
    const row = {
      effort_band: "low",
      effort_score: "25",
      value_band: "high",
      value_score: "80",
      review_disposition: "intake_now",
      rules_fingerprint: "",
      project_fit_band: "high"
    };
    const item = classifyReviewItemState(row, rules, currentFp);
    assert.equal(item.decisionDataState, "stale");
  });
});

describe("buildReviewRunFields", () => {
  test("mixed run aggregates itemsDataStateSummary", () => {
    const items = [
      { decisionDataState: "complete", projectAlignment: { fitBand: "high", matchedCapabilities: ["source_first"] }, risks: [] },
      { decisionDataState: "complete", projectAlignment: { fitBand: "high", matchedCapabilities: ["candidate_first"] }, risks: [] },
      { decisionDataState: "fallback", projectAlignment: { fitBand: "medium", matchedCapabilities: [] }, risks: [] },
      { decisionDataState: "stale", projectAlignment: { fitBand: "high", matchedCapabilities: ["evidence_acquisition"] }, risks: [] }
    ];
    const out = buildReviewRunFields(items, makeFakeAlignmentRules());
    assert.equal(out.reportSchemaVersion, 2);
    assert.deepEqual(out.itemsDataStateSummary, { complete: 2, fallback: 1, stale: 1 });
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- --test-name-pattern="classifyReviewItemState|buildReviewRunFields"`
Expected: FAIL — functions do not exist.

- [ ] **Step 3: Implement the review helpers**

In `lib/review.mjs`, add at the top:

```js
import {
  deriveDisposition,
  buildRunConfidence,
  computeRulesFingerprint
} from "./classification.mjs";
```

Add two new exports (near the other exports):

```js
export function classifyReviewItemState(row, alignmentRules, currentFingerprint) {
  const effortBand = row.effort_band || "unknown";
  const effortScore = Number(row.effort_score || 0);
  const valueBand = row.value_band || "unknown";
  const valueScore = Number(row.value_score || 0);
  let reviewDisposition = row.review_disposition || null;
  const rulesFingerprint = row.rules_fingerprint || null;
  const projectFitBand = row.project_fit_band || "unknown";
  const risks = (row.risks || "").split(",").map((r) => r.trim()).filter(Boolean);

  let usedFallback = false;
  let dispositionReason = null;

  if (!reviewDisposition) {
    const fallback = deriveDisposition({ effortBand, valueBand }, risks, projectFitBand);
    reviewDisposition = fallback.disposition;
    dispositionReason = fallback.dispositionReason;
    usedFallback = true;
  }

  if (effortBand === "unknown" || valueBand === "unknown") {
    usedFallback = true;
  }

  let decisionDataState;
  if (usedFallback) {
    decisionDataState = "fallback";
  } else if (rulesFingerprint && rulesFingerprint !== currentFingerprint) {
    decisionDataState = "stale";
  } else if (!rulesFingerprint) {
    decisionDataState = "stale";
  } else {
    decisionDataState = "complete";
  }

  return {
    effortBand,
    effortScore,
    valueBand,
    valueScore,
    reviewDisposition,
    rulesFingerprint,
    dispositionReason,
    decisionDataState
  };
}

export function buildReviewRunFields(items, alignmentRules) {
  const totalCaps = alignmentRules?.capabilities?.length ?? 0;
  const confidence = buildRunConfidence(items, totalCaps);
  const itemsDataStateSummary = items.reduce(
    (acc, i) => {
      const state = i?.decisionDataState ?? "fallback";
      acc[state] = (acc[state] ?? 0) + 1;
      return acc;
    },
    { complete: 0, fallback: 0, stale: 0 }
  );
  return {
    reportSchemaVersion: 2,
    runConfidence: confidence.runConfidence,
    runConfidenceReason: confidence.runConfidenceReason,
    confidenceFactors: confidence.confidenceFactors,
    itemsDataStateSummary
  };
}
```

Then in the existing `buildWatchlistReview` function (or wherever queue rows are turned into review items), locate the item construction and replace the manual field reading with:

```js
const currentFingerprint = computeRulesFingerprint(alignmentRules);

// Inside the map over rows:
const stateFields = classifyReviewItemState(row, alignmentRules, currentFingerprint);
const item = {
  // ... bestehende Felder wie repoRef, mainLayer, gapArea, projectFitBand, projectFitScore etc.
  ...stateFields
};
```

And at the bottom of `buildWatchlistReview`, before returning `review`, add:

```js
Object.assign(review, buildReviewRunFields(review.items, alignmentRules));
```

- [ ] **Step 4: Run the tests to verify pass**

Run: `npm test -- --test-name-pattern="classifyReviewItemState|buildReviewRunFields"`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm test`
Expected: All green.

- [ ] **Step 6: Commit**

```bash
git add lib/review.mjs test/review.test.mjs
git commit -m "feat(review): decisionDataState state machine and run-level engine fields"
```

---

## Phase 5 — Template-Cutover

### Task 10: Schema-Version-Check + Missing-Data error state

**Files:**
- Modify: `lib/html-renderer.mjs`
- Create: `test/html-renderer.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `test/html-renderer.test.mjs`:

```js
import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { renderDecisionSummary } from "../lib/html-renderer.mjs";

function makeRunRoot(overrides = {}) {
  return {
    reportSchemaVersion: 2,
    runConfidence: "medium",
    runConfidenceReason: "2 high-fit candidates",
    itemsDataStateSummary: { complete: 10, fallback: 0, stale: 0 },
    ...overrides
  };
}

describe("renderDecisionSummary schema check", () => {
  test("reportSchemaVersion !== 2 renders Missing-Data error state", () => {
    const html = renderDecisionSummary({ runRoot: { reportSchemaVersion: 1 }, reportType: "discovery" });
    assert.ok(html.includes("Engine-Daten unvollstaendig"));
    assert.ok(html.includes("reportSchemaVersion"));
  });

  test("missing reportSchemaVersion renders Missing-Data error state", () => {
    const html = renderDecisionSummary({ runRoot: {}, reportType: "discovery" });
    assert.ok(html.includes("Engine-Daten unvollstaendig"));
  });

  test("reportSchemaVersion === 2 renders normal summary without heuristic label", () => {
    const html = renderDecisionSummary({ runRoot: makeRunRoot(), reportType: "discovery" });
    assert.ok(!html.includes("(heuristic)"));
    assert.ok(!html.includes("Engine-Daten unvollstaendig"));
    assert.ok(html.includes("medium"));
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- --test-name-pattern="renderDecisionSummary schema check"`
Expected: FAIL — `renderDecisionSummary` is not exported or does not match new signature.

- [ ] **Step 3: Modify html-renderer.mjs**

Open `lib/html-renderer.mjs`. Locate `renderDecisionSummary` (~lines 202-299).

**Change 1:** Export it by prefixing with `export` so tests can import it (if it is not already exported).

**Change 2:** Replace the heuristic `highFitCount` / `ratio` / `confidence` / `confidenceTone` / `confidenceReason` block with engine-sourced reading:

```js
export function renderDecisionSummary({ runRoot, reportType, discovery, review, ...rest }) {
  const root = runRoot ?? (reportType === "discovery" ? discovery : review);
  if (!root || root.reportSchemaVersion !== 2) {
    return `<section class="section-card warn" id="decision-summary">
  <header class="section-head"><h2>Decision Summary</h2></header>
  <div class="section-body">
    <p class="empty">Engine-Daten unvollstaendig (reportSchemaVersion: ${root?.reportSchemaVersion ?? "fehlend"}) — dieser Run wurde vor der Engine-Upgrade-Integration erzeugt. Lauf erneut ausfuehren, um aktuelle Bewertungen zu sehen.</p>
  </div>
</section>`;
  }

  const runConfidence = root.runConfidence;
  const runConfidenceReason = root.runConfidenceReason;

  // ... rest des bestehenden renderings (Top Recommendations, gapCounts etc.)
  // NICHT mehr: `(heuristic)`-Label, keine eigene Confidence-Berechnung.
```

Adjust the surrounding code to pass `runRoot` or `discovery`/`review` consistently. In the main `renderHtmlReport` function (wherever `renderDecisionSummary` is called), pass the new argument shape.

- [ ] **Step 4: Run the tests to verify pass**

Run: `npm test -- --test-name-pattern="renderDecisionSummary schema check"`
Expected: PASS.

- [ ] **Step 5: Run full suite to catch regressions**

Run: `npm test`
Expected: All green.

- [ ] **Step 6: Commit**

```bash
git add lib/html-renderer.mjs test/html-renderer.test.mjs
git commit -m "feat(html): schema-version check and missing-data error state"
```

### Task 11: Data-State Warn-Banner

**Files:**
- Modify: `lib/html-renderer.mjs`
- Modify: `test/html-renderer.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `test/html-renderer.test.mjs`:

```js
import { renderDataStateWarnBanner } from "../lib/html-renderer.mjs";

describe("renderDataStateWarnBanner", () => {
  test("0% non-complete -> empty string", () => {
    assert.equal(renderDataStateWarnBanner({ complete: 10, fallback: 0, stale: 0 }), "");
  });

  test("50% non-complete -> banner with counts", () => {
    const html = renderDataStateWarnBanner({ complete: 5, fallback: 3, stale: 2 });
    assert.ok(html.includes("section-warn"));
    assert.ok(html.includes("3"));
    assert.ok(html.includes("2"));
    assert.ok(html.includes("50%"));
  });

  test("~23% non-complete (below threshold) -> empty string", () => {
    // 3 non-complete out of 13 total = 23%
    assert.equal(renderDataStateWarnBanner({ complete: 10, fallback: 2, stale: 1 }), "");
  });

  test("31% non-complete -> banner (just over threshold)", () => {
    // 4 non-complete out of 13 = 30.7%
    const html = renderDataStateWarnBanner({ complete: 9, fallback: 3, stale: 1 });
    assert.ok(html.includes("section-warn"));
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- --test-name-pattern="renderDataStateWarnBanner"`
Expected: FAIL — function does not exist.

- [ ] **Step 3: Implement renderDataStateWarnBanner**

Add to `lib/html-renderer.mjs`:

```js
const DATA_STATE_WARN_THRESHOLD = 0.3;

export function renderDataStateWarnBanner(summary) {
  const stateSummary = summary ?? { complete: 0, fallback: 0, stale: 0 };
  const total = stateSummary.complete + stateSummary.fallback + stateSummary.stale;
  if (total === 0) return "";
  const nonComplete = stateSummary.fallback + stateSummary.stale;
  const ratio = nonComplete / total;
  if (ratio <= DATA_STATE_WARN_THRESHOLD) return "";
  const percent = Math.round(ratio * 100);
  return `<div class="section-warn">
  <strong>Engine-Daten nur teilweise vollstaendig.</strong>
  ${stateSummary.fallback} Items mit Fallback-Bewertung,
  ${stateSummary.stale} Items gegen alte Regelversion bewertet
  (${percent}% nicht vollstaendig).
  Die Top-Empfehlungen koennen sich nach einem frischen Intake-Lauf verschieben.
</div>`;
}
```

Integrate it inside `renderDecisionSummary`, immediately after the schema check and before the confidence block. Compute the banner first, then inject it into the section body's HTML string as the first child element:

```js
// Inside renderDecisionSummary, right after the `if (!root || root.reportSchemaVersion !== 2)` early-return:
const warnBanner = renderDataStateWarnBanner(root.itemsDataStateSummary);
const runConfidence = root.runConfidence;
const runConfidenceReason = root.runConfidenceReason;

// When building the section body, place `${warnBanner}` as the FIRST child element
// of the `<div class="section-body">...` string — before the existing confidence block.
// Example:
//   <div class="section-body">
//     ${warnBanner}
//     <div class="confidence-row">...existing...</div>
//     ...
//   </div>
```

If `warnBanner` is an empty string (threshold not exceeded), it simply contributes nothing to the HTML. No conditional needed.

Add the CSS block to the document-level style string in `renderHtmlDocument`:

```css
.section-warn {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(255, 145, 0, 0.12);
  border-left: 3px solid var(--orange);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
}
.section-warn strong { color: var(--orange); display: block; margin-bottom: 4px; }
```

- [ ] **Step 4: Run the tests to verify pass**

Run: `npm test -- --test-name-pattern="renderDataStateWarnBanner"`
Expected: PASS all 4 cases.

- [ ] **Step 5: Commit**

```bash
git add lib/html-renderer.mjs test/html-renderer.test.mjs
git commit -m "feat(html): data-state warn banner above 30% non-complete threshold"
```

### Task 12: Adopt-Sort + License-Tag (always render)

**Files:**
- Modify: `lib/html-renderer.mjs`
- Modify: `test/html-renderer.test.mjs`

- [ ] **Step 1: Write the failing tests**

Append to `test/html-renderer.test.mjs`:

```js
import { sortAdoptGroup, renderLicenseTag, renderRecommendedActions } from "../lib/html-renderer.mjs";

describe("sortAdoptGroup", () => {
  test("sorts by netScore (value - effort) descending", () => {
    const items = [
      { full_name: "a/low",  valueScore: 50, effortScore: 40, projectFitScore: 70, matchedCapabilities: ["x"] },
      { full_name: "a/high", valueScore: 80, effortScore: 20, projectFitScore: 70, matchedCapabilities: ["x"] },
      { full_name: "a/mid",  valueScore: 70, effortScore: 50, projectFitScore: 70, matchedCapabilities: ["x"] }
    ];
    sortAdoptGroup(items);
    assert.equal(items[0].full_name, "a/high");
    assert.equal(items[1].full_name, "a/low");
    assert.equal(items[2].full_name, "a/mid");
  });

  test("tiebreaker: higher projectFitScore wins on netScore tie", () => {
    const items = [
      { full_name: "a/low-fit",  valueScore: 80, effortScore: 20, projectFitScore: 50, matchedCapabilities: [] },
      { full_name: "a/high-fit", valueScore: 80, effortScore: 20, projectFitScore: 90, matchedCapabilities: [] }
    ];
    sortAdoptGroup(items);
    assert.equal(items[0].full_name, "a/high-fit");
  });

  test("tiebreaker: alphabetical as last resort", () => {
    const items = [
      { full_name: "z/z", valueScore: 80, effortScore: 20, projectFitScore: 70, matchedCapabilities: ["x"] },
      { full_name: "a/a", valueScore: 80, effortScore: 20, projectFitScore: 70, matchedCapabilities: ["x"] }
    ];
    sortAdoptGroup(items);
    assert.equal(items[0].full_name, "a/a");
  });
});

describe("renderLicenseTag", () => {
  test("MIT -> permissive span", () => {
    const html = renderLicenseTag("MIT");
    assert.ok(html.includes("license-permissive"));
    assert.ok(html.includes(">MIT<"));
  });

  test("GPL-3.0 -> copyleft span", () => {
    const html = renderLicenseTag("GPL-3.0");
    assert.ok(html.includes("license-copyleft"));
    assert.ok(html.includes(">GPL-3.0<"));
  });

  test("null -> unknown span with License ? label (span still rendered)", () => {
    const html = renderLicenseTag(null);
    assert.ok(html.includes("license-unknown"));
    assert.ok(html.includes("License ?"));
  });

  test("NOASSERTION -> unknown span with License ? label", () => {
    const html = renderLicenseTag("NOASSERTION");
    assert.ok(html.includes("license-unknown"));
    assert.ok(html.includes("License ?"));
  });
});

describe("renderRecommendedActions license visibility", () => {
  test("adopt candidate without license field still renders license-unknown span", () => {
    const candidates = [
      {
        full_name: "acme/one",
        discoveryDisposition: "intake_now",
        valueScore: 80,
        effortScore: 20,
        projectFitScore: 70,
        matchedCapabilities: ["source_first"],
        license: null,
        decisionSummary: "High value, low effort"
      }
    ];
    const html = renderRecommendedActions({ candidates, reportType: "discovery", runRoot: { reportSchemaVersion: 2 } });
    assert.ok(html.includes("license-unknown"), "unknown span missing from output");
    assert.ok(html.includes("License ?"));
  });
});
```

- [ ] **Step 2: Run the failing tests**

Run: `npm test -- --test-name-pattern="sortAdoptGroup|renderLicenseTag|license visibility"`
Expected: FAIL.

- [ ] **Step 3: Implement the helpers and integrate into renderRecommendedActions**

Add to `lib/html-renderer.mjs`:

```js
import { classifyLicense } from "./classification.mjs";

export function sortAdoptGroup(items) {
  const netScore = (c) => (c.valueScore ?? 0) - (c.effortScore ?? 0);
  items.sort((a, b) => {
    const netDiff = netScore(b) - netScore(a);
    if (netDiff !== 0) return netDiff;
    const fitDiff = (b.projectFitScore ?? 0) - (a.projectFitScore ?? 0);
    if (fitDiff !== 0) return fitDiff;
    const capDiff = (b.matchedCapabilities?.length ?? 0) - (a.matchedCapabilities?.length ?? 0);
    if (capDiff !== 0) return capDiff;
    return (a.full_name ?? "").localeCompare(b.full_name ?? "");
  });
  return items;
}

export function renderLicenseTag(licenseString) {
  const category = classifyLicense(licenseString);
  const label = category === "unknown" ? "License ?" : (licenseString || "");
  return `<span class="action-item__license license-${category}">${escapeHtml(label)}</span>`;
}
```

Find `renderRecommendedActions`. Export it (`export function renderRecommendedActions(...)`). Replace the dual-path `if (reportType === "discovery") { ... } else { ... }` with a unified path that reads `c.discoveryDisposition || c.reviewDisposition`:

```js
export function renderRecommendedActions({ candidates, reportType, runRoot, ...rest }) {
  if (!runRoot || runRoot.reportSchemaVersion !== 2) return "";

  const groups = { adopt: [], study: [], watch: [], defer: [] };
  for (const c of candidates ?? []) {
    const disposition = c.discoveryDisposition || c.reviewDisposition;
    if (disposition === "intake_now") groups.adopt.push(c);
    else if (disposition === "review_queue") groups.study.push(c);
    else if (disposition === "observe_only") groups.watch.push(c);
    else if (disposition === "skip") groups.defer.push(c);
  }

  sortAdoptGroup(groups.adopt);

  const configs = [
    { key: "adopt", label: "Adopt", color: "var(--green)", items: groups.adopt },
    { key: "study", label: "Study", color: "var(--cyan)", items: groups.study },
    { key: "watch", label: "Watch", color: "var(--magenta)", items: groups.watch },
    { key: "defer", label: "Defer", color: "var(--ink-muted)", items: groups.defer }
  ].filter((g) => g.items.length > 0);

  if (configs.length === 0) return "";

  return `<section class="section-card" id="recommended-actions">
  <header class="section-head"><h2>Recommended Actions</h2></header>
  <div class="section-body">
    <div class="actions-grid">${configs.map((g) => `<div class="action-group" style="--group-color:${g.color}">
      <h3>${escapeHtml(g.label)} (${g.items.length})</h3>
      ${g.items.map((item, idx) => {
        const slug = slugifyForId((item.full_name ?? item.repoRef ?? "unknown"));
        const licenseTag = g.key === "adopt" ? renderLicenseTag(item.license) : "";
        const rankSpan = g.key === "adopt" && idx < 3 ? `<span class="action-item__rank">${idx + 1}.</span>` : "";
        return `<a href="#repo-${slug}" class="action-item${g.key === "adopt" && idx < 3 ? " ranked" : ""}">
        ${rankSpan}
        <strong class="action-item__name">${escapeHtml(item.full_name ?? item.repoRef ?? "-")}</strong>
        ${licenseTag}
        ${item.decisionSummary ? `<span class="action-item__reason">${escapeHtml(item.decisionSummary)}</span>` : ""}
      </a>`;
      }).join("")}
    </div>`).join("")}</div>
  </div>
</section>`;
}
```

Add the license-tag CSS to the document-level style block:

```css
.action-item__license {
  font-size: 11px;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}
.license-permissive { color: var(--ink-muted); background: rgba(255,255,255,0.04); }
.license-copyleft  { color: var(--orange); background: rgba(255,145,0,0.12); }
.license-unknown   { color: var(--ink-muted); background: rgba(255,255,255,0.04); opacity: 0.7; }
```

- [ ] **Step 4: Run the tests to verify pass**

Run: `npm test -- --test-name-pattern="sortAdoptGroup|renderLicenseTag|license visibility"`
Expected: PASS.

- [ ] **Step 5: Run full suite**

Run: `npm test`
Expected: All green.

- [ ] **Step 6: Commit**

```bash
git add lib/html-renderer.mjs test/html-renderer.test.mjs
git commit -m "feat(html): adopt-sort with tiebreakers and always-render license tag"
```

---

## Phase 6 — Smoke-Test & Validation

### Task 13: End-to-End run + determinism check

**Why:** Tests proven that individual units work; this task proves that the full CLI pipeline produces a clean Engine-based report.

**Files:**
- No code changes expected. Only runtime verification.

- [ ] **Step 1: Run a fresh discovery on the default project**

Run: `npm run discover:github -- --project eventbear-worker --profile balanced`
Expected: Command succeeds, writes a new run under `runs/eventbear-worker/`, writes an HTML report under `projects/eventbear-worker/reports/`.

- [ ] **Step 2: Open the report and visually verify**

Inspect the generated HTML file in a browser:
- Decision Summary block has a Confidence value **without** `(heuristic)` label.
- If present, Recommended Actions > Adopt shows candidates in sensible order (value-minus-effort descending).
- Each Adopt item has a `<span class="action-item__license license-*">` tag — `License ?` if unknown.
- No `Engine-Daten unvollstaendig` error state in Decision Summary.
- Warn banner only appears if `itemsDataStateSummary` has >30% non-complete (unlikely on fresh discovery).

- [ ] **Step 3: Run a watchlist review on the same project**

Run: `npm run review:watchlist -- --project eventbear-worker --depth standard`
Expected: Command succeeds. Open the new review report.

- [ ] **Step 4: Verify the review report**

Same checks as step 2, plus:
- Decision Summary and Recommended Actions behave identically to the discovery report (symmetric rendering).
- No parallel-branch differences.

- [ ] **Step 5: Determinism check**

Run discovery twice with the same profile:
```bash
npm run discover:github -- --project eventbear-worker --profile balanced
mv runs/eventbear-worker/$(ls -t runs/eventbear-worker/ | head -1) /tmp/pp-run-a
npm run discover:github -- --project eventbear-worker --profile balanced
mv runs/eventbear-worker/$(ls -t runs/eventbear-worker/ | head -1) /tmp/pp-run-b
diff -r /tmp/pp-run-a /tmp/pp-run-b || echo "DIFFS FOUND"
```
Expected: Only timestamps differ between runs. Engine fields (`effortBand`, `valueBand`, `reviewDisposition`, `rulesFingerprint`, `runConfidence`) are identical between runs.

If any engine field drifts between runs, the issue is non-deterministic input (e.g., floating-point, Date.now in reasons). Diagnose and fix before proceeding.

- [ ] **Step 6: Inspect an intake dossier for the Decision Signals block**

Run: `npm run intake -- --project eventbear-worker https://github.com/oc/openevents`
Open the newly generated file under `projects/eventbear-worker/intake/`. Verify the `## Decision Signals` block exists with bands, summary, fingerprint, and `### Reasons` sub-block.

- [ ] **Step 7: Inspect the queue for new columns**

Open `state/repo_intake_queue.csv`. Verify the header now contains `effort_band`, `effort_score`, `value_band`, `value_score`, `review_disposition`, `rules_fingerprint`. Verify the new row from step 6 has values in all 6 columns.

- [ ] **Step 8: Update ENGINE_BACKLOG.md and OPEN_QUESTION.md**

Open `docs/foundation/ENGINE_BACKLOG.md`. Mark EB-001, EB-002, EB-003, EB-005 as erledigt. Leave EB-004 open.

Open `OPEN_QUESTION.md`. Add a settled entry (similar format to OQ-001) documenting that the engine-data decision layer is shipped. Reference this plan file and the spec file.

- [ ] **Step 9: Final commit**

```bash
git add docs/foundation/ENGINE_BACKLOG.md OPEN_QUESTION.md
git commit -m "docs: mark EB-001/002/003/005 settled after engine decision layer rollout"
```

---

## Done criteria

- `npm test` is green on all suites (`classification.test.mjs`, `queue.test.mjs`, `intake.test.mjs`, `discovery.test.mjs`, `review.test.mjs`, `html-renderer.test.mjs`, `smoke.test.mjs`).
- A fresh discovery or review run produces `reportSchemaVersion: 2` in the payload and an HTML report without the `(heuristic)` label.
- Every adopt candidate in the HTML renders a `license-*` span, including `license-unknown` for candidates without license info.
- Running the same profile twice produces byte-identical engine fields (only timestamps differ).
- The queue CSV header contains the 6 new engine-decision columns.
- ENGINE_BACKLOG.md reflects EB-001/002/003/005 as settled and EB-004 as still open.
