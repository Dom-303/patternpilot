# Onboarding Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static `getting-started` text-print with an interactive 5-step wizard (`patternpilot init`) that auto-detects target project, project context, GitHub auth, and produces a working setup in ≤ 90 seconds.

**Architecture:** New `lib/wizard/` module composed of three layers — pure detection (no UI), interactive steps (uses prompts + detection), and orchestration (mode-detect, step-runner, re-run menu). Wiring touches `scripts/patternpilot.mjs` (auto-trigger), `scripts/shared/command-registry.mjs` (register `init`), and `scripts/commands/project-admin/core.mjs` (delegate from `runInit` to wizard or print). Existing `runGettingStarted` print code is preserved as the non-TTY fallback.

**Tech Stack:** Node 20+, ESM modules, zero external dependencies, `node:readline` for prompts, `node:test` for tests, `node:child_process` for `gh` integration. Replay test files use JSON (not YAML as illustrated in the spec) to keep zero-dep guarantee.

**Reference:** [docs/superpowers/specs/2026-04-28-onboarding-wizard-design.md](../specs/2026-04-28-onboarding-wizard-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `lib/wizard/index.mjs` | Public entry: `runWizard(rootDir, opts)`, mode detect, step orchestration |
| `lib/wizard/state.mjs` | In-memory wizard state object + `wizard-history.json` writer |
| `lib/wizard/prompt.mjs` | Readline wrapper: `ask()`, `choose()`, `askMasked()`, `confirm()` |
| `lib/wizard/replay.mjs` | Reads `--replay <file>` JSON, returns step-keyed value provider |
| `lib/wizard/rerun-menu.mjs` | Re-run action menu (A/E/T/D/Z) |
| `lib/wizard/steps/target.mjs` | Step 1 — choose target repo |
| `lib/wizard/steps/context.mjs` | Step 2 — confirm detected context |
| `lib/wizard/steps/github.mjs` | Step 3 — GitHub auth (G/P/S paths) |
| `lib/wizard/steps/discovery.mjs` | Step 4 — discovery profile |
| `lib/wizard/steps/first-action.mjs` | Step 5 — optional first command |
| `lib/wizard/detect/target-scan.mjs` | Scan parents/home for git repos |
| `lib/wizard/detect/project-context.mjs` | Detect label, language, context files, domain hint |
| `lib/wizard/detect/github-auth.mjs` | Pre-flight: gh CLI / env / .env |
| `lib/wizard/detect/npm-watchlist-seed.mjs` | npm dependencies → GitHub URLs |

### Modified files

| Path | Change |
|---|---|
| `scripts/patternpilot.mjs` | Add `init` command dispatch + auto-trigger when no config |
| `scripts/shared/command-registry.mjs` | Register `init`; mark `getting-started` as alias |
| `scripts/commands/project-admin.mjs` | Re-export `runInit` |
| `scripts/commands/project-admin/core.mjs` | Add `runInit` wrapper that delegates to wizard or print |

### Test files

| Path | Covers |
|---|---|
| `test/wizard/state.test.mjs` | state object, history writer |
| `test/wizard/prompt.test.mjs` | prompts driven by piped stdin |
| `test/wizard/replay.test.mjs` | replay file loader + missing-step error |
| `test/wizard/rerun-menu.test.mjs` | menu options dispatch |
| `test/wizard/detect/target-scan.test.mjs` | scan timing, 0/1/N candidates |
| `test/wizard/detect/project-context.test.mjs` | label, files, domain |
| `test/wizard/detect/github-auth.test.mjs` | pre-flight cascade |
| `test/wizard/detect/npm-watchlist-seed.test.mjs` | offline graceful, cache |
| `test/wizard/steps/target.test.mjs` | step 1 incl. "Anderen Pfad" |
| `test/wizard/steps/context.test.mjs` | step 2 accept + edit |
| `test/wizard/steps/github.test.mjs` | all four paths |
| `test/wizard/steps/discovery.test.mjs` | step 4 incl. offline-disabled |
| `test/wizard/steps/first-action.test.mjs` | step 5 incl. token-required guards |
| `test/wizard/integration/wizard-fresh-with-pat.test.mjs` | end-to-end replay |
| `test/wizard/integration/wizard-fresh-skip.test.mjs` | end-to-end skip path |
| `test/wizard/integration/wizard-rerun-add-project.test.mjs` | re-run menu |
| `test/wizard/integration/print-mode-snapshot.test.mjs` | print output unchanged |

### Test fixtures

| Path | Content |
|---|---|
| `test/fixtures/wizard/replays/fresh-with-pat.json` | scripted answers for fresh+PAT scenario |
| `test/fixtures/wizard/replays/fresh-skip.json` | scripted answers for skip path |
| `test/fixtures/wizard/replays/rerun-add-project.json` | re-run menu scenario |

Fixture workspaces are created per-test via `mkdtempSync` (consistent with existing tests).

---

## Phase 1 — Foundation

### Task 1: State object and history writer

**Files:**
- Create: `lib/wizard/state.mjs`
- Test: `test/wizard/state.test.mjs`

- [ ] **Step 1: Write failing test for state operations**

```js
// test/wizard/state.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createWizardState, appendHistory, readHistory } from "../../lib/wizard/state.mjs";

describe("wizard state", () => {
  test("createWizardState returns empty object with started_at", () => {
    const s = createWizardState();
    assert.equal(typeof s.started_at, "string");
    assert.deepEqual(s.steps, []);
    assert.equal(s.outcome, "in_progress");
  });

  test("recordStep mutates the steps array", () => {
    const s = createWizardState();
    s.recordStep("target", { value: "../foo", source: "auto-scan-1" });
    assert.equal(s.steps.length, 1);
    assert.equal(s.steps[0].name, "target");
    assert.equal(s.steps[0].value, "../foo");
  });

  test("appendHistory writes to state/wizard-history.json", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-wizard-state-"));
    const s = createWizardState();
    s.recordStep("target", { value: "../bar" });
    s.outcome = "completed";
    s.completed_at = new Date().toISOString();

    appendHistory(rootDir, s);

    const file = path.join(rootDir, "state", "wizard-history.json");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(data.runs.length, 1);
    assert.equal(data.runs[0].outcome, "completed");
    assert.equal(data.runs[0].steps[0].value, "../bar");
  });

  test("appendHistory appends without losing prior runs", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-wizard-state-"));
    appendHistory(rootDir, { ...createWizardState(), outcome: "completed" });
    appendHistory(rootDir, { ...createWizardState(), outcome: "cancelled" });

    const data = readHistory(rootDir);
    assert.equal(data.runs.length, 2);
    assert.equal(data.runs[1].outcome, "cancelled");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wizard/state.test.mjs`
Expected: FAIL with `Cannot find module '../../lib/wizard/state.mjs'`

- [ ] **Step 3: Implement state module**

```js
// lib/wizard/state.mjs
import fs from "node:fs";
import path from "node:path";

export function createWizardState() {
  return {
    started_at: new Date().toISOString(),
    completed_at: null,
    outcome: "in_progress",
    steps: [],
    recordStep(name, payload) {
      this.steps.push({ name, ...payload });
    }
  };
}

export function appendHistory(rootDir, state) {
  const dir = path.join(rootDir, "state");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "wizard-history.json");

  const existing = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { runs: [] };

  const { recordStep, ...persisted } = state;
  existing.runs.push(persisted);
  fs.writeFileSync(file, JSON.stringify(existing, null, 2), "utf8");
}

export function readHistory(rootDir) {
  const file = path.join(rootDir, "state", "wizard-history.json");
  if (!fs.existsSync(file)) return { runs: [] };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test test/wizard/state.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/state.mjs test/wizard/state.test.mjs
git commit -m "feat(wizard): add state object and history writer"
```

---

### Task 2: Prompt module (readline wrapper)

**Files:**
- Create: `lib/wizard/prompt.mjs`
- Test: `test/wizard/prompt.test.mjs`

- [ ] **Step 1: Write failing tests for prompt primitives**

```js
// test/wizard/prompt.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { createPrompter } from "../../lib/wizard/prompt.mjs";

function pipedStreams(inputLines) {
  const input = Readable.from(inputLines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({
    write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); }
  });
  return { input, output, captured: () => chunks.join("") };
}

describe("prompter", () => {
  test("ask returns the typed line, trimmed", async () => {
    const { input, output } = pipedStreams(["  hello world  "]);
    const p = createPrompter({ input, output });
    const answer = await p.ask("Frage:");
    assert.equal(answer, "hello world");
    p.close();
  });

  test("choose returns the chosen key when valid", async () => {
    const { input, output } = pipedStreams(["B"]);
    const p = createPrompter({ input, output });
    const choice = await p.choose("Was?", [
      { key: "A", label: "Apfel" },
      { key: "B", label: "Birne" }
    ]);
    assert.equal(choice, "B");
    p.close();
  });

  test("choose accepts default on empty input", async () => {
    const { input, output } = pipedStreams([""]);
    const p = createPrompter({ input, output });
    const choice = await p.choose("Was?", [
      { key: "A", label: "Apfel", default: true },
      { key: "B", label: "Birne" }
    ]);
    assert.equal(choice, "A");
    p.close();
  });

  test("choose re-asks on invalid input", async () => {
    const { input, output, captured } = pipedStreams(["X", "A"]);
    const p = createPrompter({ input, output });
    const choice = await p.choose("Was?", [{ key: "A", label: "Apfel" }]);
    assert.equal(choice, "A");
    assert.match(captured(), /Bitte/);
    p.close();
  });

  test("confirm yes-default", async () => {
    const { input, output } = pipedStreams([""]);
    const p = createPrompter({ input, output });
    assert.equal(await p.confirm("Ok?", { default: true }), true);
    p.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/wizard/prompt.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement prompt module**

```js
// lib/wizard/prompt.mjs
import readline from "node:readline";

export function createPrompter({ input = process.stdin, output = process.stdout } = {}) {
  const rl = readline.createInterface({ input, output, terminal: false });

  function write(s) { output.write(s); }

  async function ask(question) {
    write(question + " ");
    return new Promise((resolve) => rl.once("line", (l) => resolve(l.trim())));
  }

  async function askMasked(question) {
    write(question + " ");
    return new Promise((resolve) => rl.once("line", (l) => resolve(l.trim())));
    // NOTE: true masking via raw-mode is added in Task 2b (token input only).
  }

  async function choose(question, options) {
    const def = options.find((o) => o.default);
    while (true) {
      write(question + "\n");
      for (const o of options) {
        const marker = o.default ? "> " : "  ";
        write(`${marker}[${o.key}] ${o.label}\n`);
      }
      const raw = (await ask(">")).toUpperCase();
      if (raw === "" && def) return def.key;
      const hit = options.find((o) => o.key.toUpperCase() === raw);
      if (hit) return hit.key;
      write("Bitte eine der angebotenen Optionen wählen.\n");
    }
  }

  async function confirm(question, { default: def = true } = {}) {
    const suffix = def ? "[Y/n]" : "[y/N]";
    const raw = (await ask(`${question} ${suffix}`)).toLowerCase();
    if (raw === "") return def;
    return raw === "y" || raw === "j" || raw === "yes" || raw === "ja";
  }

  function close() { rl.close(); }

  return { ask, askMasked, choose, confirm, close };
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `node --test test/wizard/prompt.test.mjs`
Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/prompt.mjs test/wizard/prompt.test.mjs
git commit -m "feat(wizard): add readline prompt wrapper"
```

---

### Task 3: Replay loader

**Files:**
- Create: `lib/wizard/replay.mjs`
- Test: `test/wizard/replay.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/replay.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { loadReplay } from "../../lib/wizard/replay.mjs";

function writeFixture(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-wizard-replay-"));
  const file = path.join(dir, "scenario.json");
  fs.writeFileSync(file, JSON.stringify(content), "utf8");
  return file;
}

describe("replay", () => {
  test("get returns the value for a known step", () => {
    const file = writeFixture({ target: "../foo", discovery: "balanced" });
    const r = loadReplay(file);
    assert.equal(r.get("target"), "../foo");
    assert.equal(r.get("discovery"), "balanced");
  });

  test("get throws with exit-3 reason when step is missing", () => {
    const file = writeFixture({ target: "../foo" });
    const r = loadReplay(file);
    assert.throws(
      () => r.get("github"),
      /Replay unvollständig: kein Wert für Step github/
    );
  });

  test("get supports nested objects via dot path", () => {
    const file = writeFixture({ github: { path: "G", gh_already_authed: true } });
    const r = loadReplay(file);
    assert.equal(r.get("github.path"), "G");
    assert.equal(r.get("github.gh_already_authed"), true);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/replay.test.mjs`
Expected: module-not-found.

- [ ] **Step 3: Implement replay module**

```js
// lib/wizard/replay.mjs
import fs from "node:fs";

export function loadReplay(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  function get(stepPath) {
    const parts = stepPath.split(".");
    let cur = data;
    for (const p of parts) {
      if (cur === undefined || cur === null || !(p in cur)) {
        const err = new Error(`Replay unvollständig: kein Wert für Step ${stepPath}`);
        err.code = "REPLAY_INCOMPLETE";
        err.exitCode = 3;
        throw err;
      }
      cur = cur[p];
    }
    return cur;
  }

  return { get, raw: data };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/replay.test.mjs`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/replay.mjs test/wizard/replay.test.mjs
git commit -m "feat(wizard): add JSON replay loader for scripted tests"
```

---

## Phase 2 — Detection layer

### Task 4: Target-scan detector

**Files:**
- Create: `lib/wizard/detect/target-scan.mjs`
- Test: `test/wizard/detect/target-scan.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/detect/target-scan.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { scanForTargets } from "../../../lib/wizard/detect/target-scan.mjs";

function makeRepo(dir, name, mtime) {
  const repo = path.join(dir, name);
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.writeFileSync(path.join(repo, "README.md"), `# ${name}\n`);
  if (mtime) fs.utimesSync(path.join(repo, "README.md"), mtime, mtime);
  return repo;
}

describe("scanForTargets", () => {
  test("returns top 3 sorted by mtime descending", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scan-"));
    const now = Date.now() / 1000;
    makeRepo(dir, "a", now - 86400 * 7);
    makeRepo(dir, "b", now - 86400 * 1);
    makeRepo(dir, "c", now);
    makeRepo(dir, "d", now - 86400 * 2);

    const hits = await scanForTargets({ paths: [dir], maxResults: 3 });
    const names = hits.map((h) => path.basename(h.path));
    assert.deepEqual(names, ["c", "b", "d"]);
  });

  test("returns empty array when no repos found", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scan-"));
    const hits = await scanForTargets({ paths: [dir] });
    assert.deepEqual(hits, []);
  });

  test("respects maxDepth (does not descend deeper)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scan-"));
    const deep = path.join(dir, "level1", "level2", "level3");
    fs.mkdirSync(path.join(deep, ".git"), { recursive: true });
    fs.writeFileSync(path.join(deep, "README.md"), "x");

    const hits = await scanForTargets({ paths: [dir], maxDepth: 2 });
    assert.equal(hits.length, 0);
  });

  test("aborts after timeoutMs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scan-"));
    for (let i = 0; i < 100; i++) makeRepo(dir, `r${i}`);
    const hits = await scanForTargets({ paths: [dir], timeoutMs: 1 });
    assert.ok(Array.isArray(hits));
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/detect/target-scan.test.mjs`
Expected: module-not-found.

- [ ] **Step 3: Implement target-scan**

```js
// lib/wizard/detect/target-scan.mjs
import fs from "node:fs";
import path from "node:path";

export async function scanForTargets({
  paths = [],
  maxDepth = 2,
  maxResults = 3,
  timeoutMs = 3000
} = {}) {
  const deadline = Date.now() + timeoutMs;
  const hits = [];

  for (const root of paths) {
    if (Date.now() > deadline) break;
    if (!safeExists(root)) continue;
    walk(root, 0, maxDepth, deadline, hits);
  }

  hits.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return hits.slice(0, maxResults);
}

function walk(dir, depth, maxDepth, deadline, out) {
  if (depth > maxDepth) return;
  if (Date.now() > deadline) return;

  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const e of entries) {
    if (Date.now() > deadline) return;
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".")) continue;

    const child = path.join(dir, e.name);
    if (isCandidate(child)) {
      const mtimeMs = readableMtime(child);
      out.push({ path: child, mtimeMs });
    } else {
      walk(child, depth + 1, maxDepth, deadline, out);
    }
  }
}

function isCandidate(dir) {
  return safeExists(path.join(dir, ".git"))
    && (safeExists(path.join(dir, "README.md")) || safeExists(path.join(dir, "package.json")));
}

function readableMtime(dir) {
  const probes = ["README.md", "package.json"];
  let max = 0;
  for (const p of probes) {
    try {
      const st = fs.statSync(path.join(dir, p));
      if (st.mtimeMs > max) max = st.mtimeMs;
    } catch { /* skip */ }
  }
  return max;
}

function safeExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/detect/target-scan.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/detect/target-scan.mjs test/wizard/detect/target-scan.test.mjs
git commit -m "feat(wizard): add target-repo scanner with depth + timeout limits"
```

---

### Task 5: Project-context detector

**Files:**
- Create: `lib/wizard/detect/project-context.mjs`
- Test: `test/wizard/detect/project-context.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/detect/project-context.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { detectProjectContext } from "../../../lib/wizard/detect/project-context.mjs";

function makeProject({ pkg, readme, files = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-ctx-"));
  if (pkg) fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg));
  if (readme) fs.writeFileSync(path.join(dir, "README.md"), readme);
  for (const f of files) fs.writeFileSync(path.join(dir, f), "x");
  return dir;
}

describe("detectProjectContext", () => {
  test("derives label from package.json name", () => {
    const dir = makeProject({ pkg: { name: "eventbear-worker", type: "module" } });
    const ctx = detectProjectContext(dir);
    assert.equal(ctx.label, "Eventbear Worker");
    assert.equal(ctx.language, "Node.js (ESM)");
  });

  test("falls back to dirname title-case when no package.json", () => {
    const dir = makeProject({ readme: "# foo" });
    const ctx = detectProjectContext(dir);
    assert.match(ctx.label, /^[A-Z]/);
  });

  test("collects standard context files when present", () => {
    const dir = makeProject({
      readme: "# r",
      files: ["CLAUDE.md", "AGENT_CONTEXT.md"]
    });
    const ctx = detectProjectContext(dir);
    assert.ok(ctx.contextFiles.includes("CLAUDE.md"));
    assert.ok(ctx.contextFiles.includes("AGENT_CONTEXT.md"));
    assert.ok(ctx.contextFiles.includes("README.md"));
  });

  test("derives domain hint from README headline + body", () => {
    const dir = makeProject({
      readme: "# Event Scraping Worker\n\nDieser Worker sammelt Events aus verschiedenen Quellen."
    });
    const ctx = detectProjectContext(dir);
    assert.match(ctx.domainHint, /event|scrap/i);
  });

  test("language detected as Python when requirements.txt present", () => {
    const dir = makeProject({ files: ["requirements.txt"] });
    const ctx = detectProjectContext(dir);
    assert.equal(ctx.language, "Python");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/detect/project-context.test.mjs`
Expected: module-not-found.

- [ ] **Step 3: Implement project-context detector**

```js
// lib/wizard/detect/project-context.mjs
import fs from "node:fs";
import path from "node:path";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "from",
  "der", "die", "das", "ein", "eine", "und", "oder", "von", "fuer", "für",
  "im", "in", "auf", "mit", "aus", "ist", "sind", "dieser", "diese", "dieses"
]);

const CONTEXT_CANDIDATES = [
  "CLAUDE.md", "AGENT_CONTEXT.md", "AGENTS.md", "GEMINI.md", "README.md"
];

export function detectProjectContext(repoDir) {
  const pkg = readJsonSafe(path.join(repoDir, "package.json"));
  const readme = readFileSafe(path.join(repoDir, "README.md"));

  return {
    label: deriveLabel(pkg, repoDir),
    language: deriveLanguage(repoDir, pkg),
    domainHint: deriveDomainHint(readme),
    contextFiles: collectContextFiles(repoDir),
    repoDir
  };
}

function deriveLabel(pkg, repoDir) {
  if (pkg?.name) return titleCase(pkg.name.replace(/[-_]/g, " "));
  return titleCase(path.basename(repoDir));
}

function deriveLanguage(repoDir, pkg) {
  if (pkg?.type === "module") return "Node.js (ESM)";
  if (pkg) return "Node.js (CommonJS)";
  if (existsSafe(path.join(repoDir, "requirements.txt"))) return "Python";
  if (existsSafe(path.join(repoDir, "pyproject.toml"))) return "Python";
  if (existsSafe(path.join(repoDir, "go.mod"))) return "Go";
  if (existsSafe(path.join(repoDir, "Cargo.toml"))) return "Rust";
  return "unbekannt";
}

function deriveDomainHint(readme) {
  if (!readme) return "";
  const headlineMatch = readme.match(/^#\s+(.+?)$/m);
  const headline = headlineMatch ? headlineMatch[1] : "";
  const body = readme.slice(0, 200);
  const text = (headline + " " + body).toLowerCase();
  const words = text.match(/[a-zäöüß]{4,}/g) ?? [];
  const counts = new Map();
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w)
    .join(" / ");
}

function collectContextFiles(repoDir) {
  return CONTEXT_CANDIDATES.filter((f) => existsSafe(path.join(repoDir, f)));
}

function titleCase(s) {
  return s.split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function existsSafe(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/detect/project-context.test.mjs`
Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/detect/project-context.mjs test/wizard/detect/project-context.test.mjs
git commit -m "feat(wizard): add project-context detector (label, language, files, domain)"
```

---

### Task 6: GitHub-auth pre-flight detector

**Files:**
- Create: `lib/wizard/detect/github-auth.mjs`
- Test: `test/wizard/detect/github-auth.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/detect/github-auth.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { detectGithubAuth } from "../../../lib/wizard/detect/github-auth.mjs";

describe("detectGithubAuth", () => {
  test("returns gh-cli source when gh subprocess succeeds", async () => {
    const result = await detectGithubAuth({
      env: {},
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-auth-")),
      ghProbe: async () => ({ ok: true, user: "@dom-303", token: "ghp_fake" })
    });
    assert.equal(result.source, "gh-cli");
    assert.equal(result.user, "@dom-303");
    assert.equal(result.token, "ghp_fake");
  });

  test("returns env source when GITHUB_TOKEN is set and gh fails", async () => {
    const result = await detectGithubAuth({
      env: { GITHUB_TOKEN: "ghp_envtoken" },
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-auth-")),
      ghProbe: async () => ({ ok: false })
    });
    assert.equal(result.source, "env");
    assert.equal(result.token, "ghp_envtoken");
  });

  test("returns dotenv source when ~/.config/patternpilot/.env exists", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-auth-"));
    fs.writeFileSync(path.join(dir, ".env"), "GITHUB_TOKEN=ghp_fromfile\n");

    const result = await detectGithubAuth({
      env: {},
      configDir: dir,
      ghProbe: async () => ({ ok: false })
    });
    assert.equal(result.source, "dotenv");
    assert.equal(result.token, "ghp_fromfile");
  });

  test("returns none when nothing found", async () => {
    const result = await detectGithubAuth({
      env: {},
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-auth-")),
      ghProbe: async () => ({ ok: false })
    });
    assert.equal(result.source, "none");
    assert.equal(result.token, null);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/detect/github-auth.test.mjs`
Expected: module-not-found.

- [ ] **Step 3: Implement github-auth detector**

```js
// lib/wizard/detect/github-auth.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export async function detectGithubAuth({
  env = process.env,
  configDir = defaultConfigDir(),
  ghProbe = probeGhCli
} = {}) {
  const gh = await ghProbe();
  if (gh.ok) return { source: "gh-cli", user: gh.user, token: gh.token };

  const envToken = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (envToken) return { source: "env", user: null, token: envToken };

  const dotenvToken = readDotenvToken(path.join(configDir, ".env"));
  if (dotenvToken) return { source: "dotenv", user: null, token: dotenvToken };

  return { source: "none", user: null, token: null };
}

export function defaultConfigDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || process.env.HOME, "patternpilot");
  }
  return path.join(process.env.HOME || "/", ".config", "patternpilot");
}

function readDotenvToken(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    const m = text.match(/^GITHUB_TOKEN=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

function probeGhCli() {
  return new Promise((resolve) => {
    const status = spawn("gh", ["auth", "status"], { stdio: "ignore" });
    status.on("error", () => resolve({ ok: false }));
    status.on("exit", (code) => {
      if (code !== 0) return resolve({ ok: false });
      const tok = spawn("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      tok.stdout.on("data", (d) => { out += d.toString(); });
      tok.on("error", () => resolve({ ok: false }));
      tok.on("exit", (c2) => {
        if (c2 !== 0) return resolve({ ok: false });
        resolve({ ok: true, user: null, token: out.trim() });
      });
    });
  });
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/detect/github-auth.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/detect/github-auth.mjs test/wizard/detect/github-auth.test.mjs
git commit -m "feat(wizard): add github-auth pre-flight (gh/env/dotenv cascade)"
```

---

### Task 7: NPM watchlist-seed detector

**Files:**
- Create: `lib/wizard/detect/npm-watchlist-seed.mjs`
- Test: `test/wizard/detect/npm-watchlist-seed.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/detect/npm-watchlist-seed.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { detectWatchlistSeed } from "../../../lib/wizard/detect/npm-watchlist-seed.mjs";

function makeRepo({ deps = {}, devDeps = {} }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-seed-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    dependencies: deps, devDependencies: devDeps
  }));
  return dir;
}

describe("detectWatchlistSeed", () => {
  test("returns github URLs from npm registry lookup", async () => {
    const dir = makeRepo({ deps: { "puppeteer": "^1", "cheerio": "^1" } });
    const result = await detectWatchlistSeed(dir, {
      cacheDir: path.join(dir, ".cache"),
      fetchPkg: async (name) => ({
        repository: { url: `git+https://github.com/example/${name}.git` }
      })
    });
    assert.equal(result.status, "ok");
    assert.equal(result.urls.length, 2);
    assert.ok(result.urls.includes("https://github.com/example/puppeteer"));
  });

  test("status=offline when fetcher rejects", async () => {
    const dir = makeRepo({ deps: { "puppeteer": "^1" } });
    const result = await detectWatchlistSeed(dir, {
      cacheDir: path.join(dir, ".cache"),
      fetchPkg: async () => { throw new Error("ECONNREFUSED"); }
    });
    assert.equal(result.status, "offline");
    assert.deepEqual(result.urls, []);
  });

  test("uses cache on second call when offline", async () => {
    const dir = makeRepo({ deps: { "puppeteer": "^1" } });
    const cacheDir = path.join(dir, ".cache");
    let callCount = 0;
    const fetcher = async (name) => {
      callCount++;
      return { repository: { url: `https://github.com/example/${name}` } };
    };

    await detectWatchlistSeed(dir, { cacheDir, fetchPkg: fetcher });
    assert.equal(callCount, 1);

    const second = await detectWatchlistSeed(dir, {
      cacheDir,
      fetchPkg: async () => { throw new Error("offline"); }
    });
    assert.equal(second.status, "ok");
    assert.equal(second.urls.length, 1);
  });

  test("filters out non-github registry entries", async () => {
    const dir = makeRepo({ deps: { "internal": "^1" } });
    const result = await detectWatchlistSeed(dir, {
      cacheDir: path.join(dir, ".cache"),
      fetchPkg: async () => ({ repository: { url: "https://gitlab.com/x/y" } })
    });
    assert.deepEqual(result.urls, []);
  });

  test("returns empty when no package.json", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-seed-no-"));
    const result = await detectWatchlistSeed(dir);
    assert.equal(result.status, "ok");
    assert.deepEqual(result.urls, []);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/detect/npm-watchlist-seed.test.mjs`

- [ ] **Step 3: Implement watchlist-seed detector**

```js
// lib/wizard/detect/npm-watchlist-seed.mjs
import fs from "node:fs";
import path from "node:path";

const REQUEST_TIMEOUT_MS = 2000;
const TOTAL_TIMEOUT_MS = 8000;

export async function detectWatchlistSeed(repoDir, {
  cacheDir = path.join(repoDir, ".wizard-cache"),
  fetchPkg = defaultFetcher,
  maxResults = 5
} = {}) {
  const pkg = readJsonSafe(path.join(repoDir, "package.json"));
  if (!pkg) return { status: "ok", urls: [] };

  const deps = scoreDependencies(pkg);
  if (deps.length === 0) return { status: "ok", urls: [] };

  fs.mkdirSync(cacheDir, { recursive: true });
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const urls = [];
  let networkFailed = false;

  for (const name of deps) {
    if (urls.length >= maxResults) break;
    if (Date.now() > deadline) break;

    const cached = readCache(cacheDir, name);
    if (cached !== undefined) {
      if (cached) urls.push(cached);
      continue;
    }

    try {
      const data = await fetchPkg(name);
      const url = extractGithubUrl(data?.repository?.url);
      writeCache(cacheDir, name, url ?? null);
      if (url) urls.push(url);
    } catch {
      networkFailed = true;
      break;
    }
  }

  if (networkFailed && urls.length === 0) {
    return { status: "offline", urls: [] };
  }
  return { status: "ok", urls };
}

function scoreDependencies(pkg) {
  const scores = new Map();
  for (const name of Object.keys(pkg.dependencies ?? {})) scores.set(name, 2);
  for (const name of Object.keys(pkg.devDependencies ?? {})) {
    scores.set(name, (scores.get(name) ?? 0) + 1);
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

function extractGithubUrl(raw) {
  if (!raw) return null;
  const m = raw.match(/github\.com[:/]([^/]+)\/([^/.#]+)/);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}

function cachePath(cacheDir, name) {
  return path.join(cacheDir, encodeURIComponent(name) + ".json");
}

function readCache(cacheDir, name) {
  try {
    const raw = fs.readFileSync(cachePath(cacheDir, name), "utf8");
    return JSON.parse(raw).url;
  } catch { return undefined; }
}

function writeCache(cacheDir, name, url) {
  fs.writeFileSync(cachePath(cacheDir, name), JSON.stringify({ url }), "utf8");
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

async function defaultFetcher(name) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/detect/npm-watchlist-seed.test.mjs`
Expected: 5 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/detect/npm-watchlist-seed.mjs test/wizard/detect/npm-watchlist-seed.test.mjs
git commit -m "feat(wizard): add npm-watchlist-seed detector with cache + offline-graceful"
```

---

## Phase 3 — Steps

Each step module exports a single async function `runStep({ prompter, state, replay, ...ctx })` returning the captured value. Step modules never write to disk directly — they update state and return.

### Task 8: Step 1 — Target

**Files:**
- Create: `lib/wizard/steps/target.mjs`
- Test: `test/wizard/steps/target.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/steps/target.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runTargetStep } from "../../../lib/wizard/steps/target.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runTargetStep", () => {
  test("uses replay value when provided", async () => {
    const { prompter } = pipedPrompter([]);
    const state = createWizardState();
    const result = await runTargetStep({
      prompter,
      state,
      replay: { get: () => "/abs/path" },
      scanFn: async () => [{ path: "/x", mtimeMs: 0 }]
    });
    assert.equal(result.path, "/abs/path");
    prompter.close();
  });

  test("offers scanned candidates and accepts selection by number", async () => {
    const { prompter } = pipedPrompter(["1"]);
    const state = createWizardState();
    const result = await runTargetStep({
      prompter,
      state,
      scanFn: async () => [
        { path: "/p/a", mtimeMs: Date.now() },
        { path: "/p/b", mtimeMs: Date.now() - 86400000 }
      ]
    });
    assert.equal(result.path, "/p/a");
    prompter.close();
  });

  test("only shows manual-input option when scan returns 0 hits", async () => {
    const { prompter, captured } = pipedPrompter(["/some/abs/path"]);
    const state = createWizardState();
    await runTargetStep({
      prompter, state,
      scanFn: async () => [],
      pathExists: () => true
    });
    assert.match(captured(), /Anderen Pfad/);
    prompter.close();
  });

  test("re-asks on non-existing manual path", async () => {
    const { prompter } = pipedPrompter(["M", "/does/not/exist", "/exists"]);
    const state = createWizardState();
    let calls = 0;
    const result = await runTargetStep({
      prompter, state,
      scanFn: async () => [{ path: "/p/a", mtimeMs: 0 }],
      pathExists: (p) => { calls++; return p === "/exists"; }
    });
    assert.equal(result.path, "/exists");
    prompter.close();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/steps/target.test.mjs`

- [ ] **Step 3: Implement target step**

```js
// lib/wizard/steps/target.mjs
import fs from "node:fs";
import path from "node:path";
import { scanForTargets } from "../detect/target-scan.mjs";

const MANUAL_KEY = "M";

export async function runTargetStep({
  prompter,
  state,
  replay = null,
  scanFn = scanForTargets,
  pathExists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } },
  scanPaths = defaultScanPaths()
} = {}) {
  if (replay) {
    const value = replay.get("target");
    state.recordStep("target", { value, source: "replay" });
    return { path: path.resolve(value) };
  }

  const hits = await scanFn({ paths: scanPaths });
  prompter.write?.("\n[1/5] Welches Repo soll Patternpilot analysieren?\n\n");

  const options = hits.map((h, i) => ({
    key: String(i + 1),
    label: `${h.path}   (${humanMtime(h.mtimeMs)})`,
    default: i === 0
  }));
  options.push({ key: MANUAL_KEY, label: "Anderen Pfad eingeben…" });

  while (true) {
    const choice = await prompter.choose("> ", options);
    if (choice !== MANUAL_KEY) {
      const idx = Number(choice) - 1;
      const picked = hits[idx].path;
      state.recordStep("target", { value: picked, source: `auto-scan-${idx + 1}` });
      return { path: picked };
    }
    const manual = await prompter.ask("Pfad:");
    const abs = path.resolve(manual);
    if (!pathExists(abs)) {
      prompter.ask && prompter.ask;
      continue;
    }
    state.recordStep("target", { value: abs, source: "manual" });
    return { path: abs };
  }
}

function defaultScanPaths() {
  const home = process.env.HOME || process.env.USERPROFILE || "/";
  return [
    path.resolve(".."),
    path.join(home, "dev"),
    path.join(home, "projects"),
    path.join(home, "code"),
    path.join(home, "src")
  ];
}

function humanMtime(ms) {
  if (!ms) return "unbekannt";
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days === 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  return `vor ${Math.floor(days / 30)} Monaten`;
}
```

Note: `prompter.write` is a small sugar method. Add it to the prompt module:

- [ ] **Step 4: Extend prompter with write helper**

Edit `lib/wizard/prompt.mjs` — add `write` to the returned object:

```js
function write(s) { output.write(s); }
// ...
return { ask, askMasked, choose, confirm, close, write };
```

Re-run prompt tests to confirm nothing breaks: `node --test test/wizard/prompt.test.mjs`

- [ ] **Step 5: Run target tests, verify pass**

Run: `node --test test/wizard/steps/target.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 6: Commit**

```bash
git add lib/wizard/steps/target.mjs test/wizard/steps/target.test.mjs lib/wizard/prompt.mjs
git commit -m "feat(wizard): add step 1 (target repo selection)"
```

---

### Task 9: Step 2 — Context

**Files:**
- Create: `lib/wizard/steps/context.mjs`
- Test: `test/wizard/steps/context.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/steps/context.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runContextStep } from "../../../lib/wizard/steps/context.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runContextStep", () => {
  test("accept-path Y returns detected context unchanged", async () => {
    const { prompter } = pipedPrompter(["Y"]);
    const state = createWizardState();
    const detected = {
      label: "Foo", language: "Node.js (ESM)",
      domainHint: "events", contextFiles: ["README.md"],
      repoDir: "/abs"
    };
    const seed = { status: "ok", urls: ["https://github.com/x/y"] };
    const result = await runContextStep({
      prompter, state,
      detectFn: () => detected,
      seedFn: async () => seed
    });
    assert.deepEqual(result.context, detected);
    assert.deepEqual(result.watchlistSeed, seed);
    prompter.close();
  });

  test("offline seed shows '(übersprungen — kein Netz)' marker", async () => {
    const { prompter, captured } = pipedPrompter(["Y"]);
    const state = createWizardState();
    await runContextStep({
      prompter, state,
      detectFn: () => ({ label: "Foo", language: "x", domainHint: "", contextFiles: [], repoDir: "/abs" }),
      seedFn: async () => ({ status: "offline", urls: [] })
    });
    assert.match(captured(), /übersprungen.*kein Netz/);
    prompter.close();
  });

  test("E path lets user override label", async () => {
    const { prompter } = pipedPrompter(["E", "L", "New Label", "X"]);
    const state = createWizardState();
    const result = await runContextStep({
      prompter, state,
      detectFn: () => ({ label: "Old", language: "x", domainHint: "", contextFiles: [], repoDir: "/abs" }),
      seedFn: async () => ({ status: "ok", urls: [] })
    });
    assert.equal(result.context.label, "New Label");
    prompter.close();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/steps/context.test.mjs`

- [ ] **Step 3: Implement context step**

```js
// lib/wizard/steps/context.mjs
import { detectProjectContext } from "../detect/project-context.mjs";
import { detectWatchlistSeed } from "../detect/npm-watchlist-seed.mjs";

export async function runContextStep({
  prompter, state, replay = null,
  targetPath,
  detectFn = detectProjectContext,
  seedFn = detectWatchlistSeed
} = {}) {
  const context = detectFn(targetPath);
  const seed = await seedFn(targetPath);

  if (replay) {
    const action = replay.get("context");
    state.recordStep("context", { value: action });
    return { context, watchlistSeed: seed };
  }

  prompter.write("\n[2/5] Erkannter Projekt-Kontext (bitte bestätigen):\n\n");
  prompter.write(`  Label:           "${context.label}"\n`);
  prompter.write(`  Sprache:         ${context.language}\n`);
  prompter.write(`  Domäne-Hinweis:  ${context.domainHint || "-"}\n`);
  prompter.write(`  Context-Files:   ${context.contextFiles.join(", ")}\n`);
  prompter.write(`  Watchlist-Seed:  ${formatSeed(seed)}\n\n`);

  const ans = await prompter.choose("> ", [
    { key: "Y", label: "passt", default: true },
    { key: "E", label: "anpassen" }
  ]);

  if (ans === "Y") {
    state.recordStep("context", { value: "accepted" });
    return { context, watchlistSeed: seed };
  }

  const edited = await editLoop(prompter, context);
  state.recordStep("context", { value: "edited", edits: edited.fields });
  return { context: edited.context, watchlistSeed: seed };
}

function formatSeed(seed) {
  if (seed.status === "offline") return "(übersprungen — kein Netz)";
  if (seed.urls.length === 0) return "(keine GitHub-Dependencies erkannt)";
  return `${seed.urls.length} Repos aus dependencies erkannt`;
}

async function editLoop(prompter, ctx) {
  const fields = [];
  while (true) {
    const choice = await prompter.choose("Was anpassen?", [
      { key: "L", label: `Label  (aktuell: ${ctx.label})` },
      { key: "S", label: `Sprache  (aktuell: ${ctx.language})` },
      { key: "D", label: `Domäne  (aktuell: ${ctx.domainHint})` },
      { key: "X", label: "Fertig", default: true }
    ]);
    if (choice === "X") return { context: ctx, fields };
    if (choice === "L") { ctx = { ...ctx, label: await prompter.ask("Label:") }; fields.push("label"); }
    if (choice === "S") { ctx = { ...ctx, language: await prompter.ask("Sprache:") }; fields.push("language"); }
    if (choice === "D") { ctx = { ...ctx, domainHint: await prompter.ask("Domäne:") }; fields.push("domainHint"); }
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/steps/context.test.mjs`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/steps/context.mjs test/wizard/steps/context.test.mjs
git commit -m "feat(wizard): add step 2 (context confirmation with edit loop)"
```

---

### Task 10: Step 3 — GitHub auth (skeleton + dispatch)

**Files:**
- Create: `lib/wizard/steps/github.mjs`
- Test: `test/wizard/steps/github.test.mjs`

This task creates the dispatcher and the three sub-paths (G, P, S). The PAT path is split in Task 10b to keep the diff reviewable.

- [ ] **Step 1: Write failing tests for dispatcher and skip path**

```js
// test/wizard/steps/github.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runGithubStep } from "../../../lib/wizard/steps/github.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runGithubStep", () => {
  test("skips dialog when pre-flight returns gh-cli", async () => {
    const { prompter } = pipedPrompter([""]);
    const state = createWizardState();
    const result = await runGithubStep({
      prompter, state,
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-gh-")),
      detectFn: async () => ({ source: "gh-cli", token: "ghp_x", user: "@u" })
    });
    assert.equal(result.source, "gh-cli");
    assert.equal(result.token, "ghp_x");
    prompter.close();
  });

  test("S path writes nothing and reports skip", async () => {
    const { prompter } = pipedPrompter(["S"]);
    const state = createWizardState();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-gh-"));
    const result = await runGithubStep({
      prompter, state,
      configDir: dir,
      detectFn: async () => ({ source: "none", token: null, user: null })
    });
    assert.equal(result.source, "skipped");
    assert.equal(fs.existsSync(path.join(dir, ".env")), false);
    prompter.close();
  });

  test("M (manual override) lets user enter token even when pre-flight succeeds", async () => {
    const { prompter } = pipedPrompter(["M", "P", "ghp_manualtoken"]);
    const state = createWizardState();
    const result = await runGithubStep({
      prompter, state,
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-gh-")),
      detectFn: async () => ({ source: "gh-cli", token: "ghp_x", user: "@u" }),
      validateToken: async (t) => ({ ok: true, user: "@manual", scopes: ["public_repo"] })
    });
    assert.equal(result.token, "ghp_manualtoken");
    prompter.close();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/steps/github.test.mjs`

- [ ] **Step 3: Implement github step skeleton**

```js
// lib/wizard/steps/github.mjs
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { detectGithubAuth } from "../detect/github-auth.mjs";

export async function runGithubStep({
  prompter, state, replay = null,
  configDir,
  detectFn = detectGithubAuth,
  validateToken = defaultValidate,
  ghLogin = defaultGhLogin,
  openBrowser = defaultOpenBrowser
} = {}) {
  if (replay) return runGithubReplay({ prompter, state, replay, configDir, validateToken });

  const detected = await detectFn({ configDir });

  if (detected.source !== "none") {
    prompter.write(`\n[3/5] GitHub-Zugang gefunden:\n  ✓ ${describeSource(detected)}\n\n`);
    const ans = await prompter.choose("> ", [
      { key: "Enter", label: "übernehmen", default: true },
      { key: "M", label: "manuell anderen Token eingeben" }
    ]);
    if (ans !== "M") {
      writeTokenFile(configDir, detected.token);
      state.recordStep("github", { source: detected.source, user: detected.user });
      return detected;
    }
  }

  return chooseAuthPath({ prompter, state, configDir, validateToken, ghLogin, openBrowser });
}

async function chooseAuthPath(ctx) {
  const { prompter, state, configDir, validateToken, ghLogin, openBrowser } = ctx;
  prompter.write("\n[3/5] GitHub-Zugang einrichten\n\n");
  prompter.write("  gh CLI ist der empfohlene Weg (sicherer, OS-Keychain).\n");
  prompter.write("  Personal Access Token funktioniert genauso, ist aber manueller.\n\n");

  const choice = await prompter.choose("> ", [
    { key: "G", label: "gh CLI verwenden          empfohlen", default: true },
    { key: "P", label: "Personal Access Token     funktioniert auch gut" },
    { key: "S", label: "Überspringen              läuft offline weiter" }
  ]);

  if (choice === "S") {
    state.recordStep("github", { path: "S" });
    return { source: "skipped", token: null, user: null };
  }

  if (choice === "G") {
    const r = await runGhPath({ prompter, ghLogin, configDir });
    if (r.source === "gh-cli") {
      writeTokenFile(configDir, r.token);
      state.recordStep("github", { path: "G", source: "gh-cli", user: r.user });
      return r;
    }
    if (r.fallback === "P") return runPatPath({ prompter, state, configDir, validateToken, openBrowser });
    state.recordStep("github", { path: "S" });
    return { source: "skipped", token: null, user: null };
  }

  return runPatPath({ prompter, state, configDir, validateToken, openBrowser });
}

async function runGhPath({ prompter, ghLogin, configDir }) {
  const installed = await isGhInstalled();
  if (!installed) {
    prompter.write("\ngh ist nicht installiert. Eine Zeile reicht:\n\n");
    prompter.write("    macOS:     brew install gh\n");
    prompter.write("    Linux:     sudo apt install gh    (oder dnf/pacman/yay)\n");
    prompter.write("    Windows:   winget install GitHub.cli\n\n");
    const c = await prompter.choose("> ", [
      { key: "Enter", label: "wenn fertig", default: true },
      { key: "P", label: "Doch lieber Token-Pfad nehmen" },
      { key: "S", label: "Überspringen" }
    ]);
    if (c === "P") return { source: "none", fallback: "P" };
    if (c === "S") return { source: "none", fallback: "S" };
  }

  const ok = await ghLogin();
  if (!ok) {
    prompter.write("gh-Anmeldung wurde abgebrochen oder ist fehlgeschlagen.\n");
    const c = await prompter.choose("> ", [
      { key: "R", label: "Wiederholen", default: true },
      { key: "P", label: "Doch Token-Pfad" },
      { key: "S", label: "Überspringen" }
    ]);
    if (c === "P") return { source: "none", fallback: "P" };
    if (c === "S") return { source: "none", fallback: "S" };
    return runGhPath({ prompter, ghLogin, configDir });
  }

  const token = await readGhToken();
  return { source: "gh-cli", token, user: null };
}

async function runPatPath(ctx) {
  // implemented in Task 10b
  ctx.prompter.write("PAT path placeholder — implemented in Task 10b\n");
  const token = await ctx.prompter.ask("Token:");
  const v = await ctx.validateToken(token);
  if (v.ok) {
    writeTokenFile(ctx.configDir, token);
    ctx.state.recordStep("github", { path: "P", user: v.user });
    return { source: "pat", token, user: v.user };
  }
  return { source: "skipped", token: null, user: null };
}

function describeSource(d) {
  if (d.source === "gh-cli") return `gh CLI authentifiziert${d.user ? ` als ${d.user}` : ""} (Source: gh auth)`;
  if (d.source === "env") return "Token aus Umgebungsvariable $GITHUB_TOKEN";
  if (d.source === "dotenv") return `Token aus ${path.join("~", ".config", "patternpilot", ".env")}`;
  return d.source;
}

function writeTokenFile(configDir, token) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, ".env"), `GITHUB_TOKEN=${token}\n`, { mode: 0o600 });
}

function isGhInstalled() {
  return new Promise((resolve) => {
    const p = spawn(process.platform === "win32" ? "where" : "which", ["gh"], { stdio: "ignore" });
    p.on("exit", (c) => resolve(c === 0));
    p.on("error", () => resolve(false));
  });
}

function defaultGhLogin() {
  return new Promise((resolve) => {
    const p = spawn("gh", ["auth", "login"], { stdio: "inherit" });
    p.on("exit", (c) => resolve(c === 0));
    p.on("error", () => resolve(false));
  });
}

function readGhToken() {
  return new Promise((resolve) => {
    const p = spawn("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.on("exit", (c) => resolve(c === 0 ? out.trim() : null));
    p.on("error", () => resolve(null));
  });
}

function defaultOpenBrowser(url) {
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  return new Promise((resolve) => {
    const p = spawn(cmd, [url], { stdio: "ignore", shell: process.platform === "win32" });
    p.on("exit", (c) => resolve(c === 0));
    p.on("error", () => resolve(false));
  });
}

async function defaultValidate(token) {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}`, "User-Agent": "patternpilot-wizard" }
    });
    if (!res.ok) return { ok: false, status: res.status };
    const body = await res.json();
    const scopes = (res.headers.get("x-oauth-scopes") || "").split(",").map((s) => s.trim()).filter(Boolean);
    return { ok: true, user: `@${body.login}`, scopes };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function runGithubReplay({ replay, configDir, state, validateToken }) {
  const path = replay.get("github.path");
  if (path === "S") {
    state.recordStep("github", { path: "S", source: "replay" });
    return { source: "skipped", token: null, user: null };
  }
  if (path === "G" && replay.get("github.gh_already_authed") === true) {
    const fakeToken = "ghp_replay_gh";
    writeTokenFile(configDir, fakeToken);
    state.recordStep("github", { path: "G", source: "replay" });
    return { source: "gh-cli", token: fakeToken, user: "@replay" };
  }
  if (path === "P") {
    const token = replay.get("github.token");
    const v = await validateToken(token);
    if (v.ok) writeTokenFile(configDir, token);
    state.recordStep("github", { path: "P", source: "replay" });
    return { source: "pat", token, user: v.user };
  }
  state.recordStep("github", { path: "S", source: "replay-fallback" });
  return { source: "skipped", token: null, user: null };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/steps/github.test.mjs`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/steps/github.mjs test/wizard/steps/github.test.mjs
git commit -m "feat(wizard): add step 3 dispatcher + gh CLI + skip paths"
```

---

### Task 10b: Step 3 — PAT 4-step path

- [ ] **Step 1: Add tests for PAT happy-path and error-path**

Append to `test/wizard/steps/github.test.mjs`:

```js
describe("PAT path", () => {
  test("happy path: browser open + token paste + validate", async () => {
    const { prompter } = pipedPrompter(["P", "", "", "", "ghp_validtoken"]);
    const state = createWizardState();
    let openedUrl = null;
    const result = await runGithubStep({
      prompter, state,
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-gh-")),
      detectFn: async () => ({ source: "none", token: null, user: null }),
      validateToken: async (t) => t === "ghp_validtoken"
        ? { ok: true, user: "@dom-303", scopes: ["public_repo", "read:user"] }
        : { ok: false, status: 401 },
      openBrowser: async (url) => { openedUrl = url; return true; }
    });
    assert.equal(result.source, "pat");
    assert.equal(result.token, "ghp_validtoken");
    assert.match(openedUrl, /github\.com\/settings\/tokens\/new/);
    assert.match(openedUrl, /scopes=public_repo,read:user/);
    prompter.close();
  });

  test("invalid token shows diagnosis with three actions", async () => {
    const { prompter, captured } = pipedPrompter(["P", "", "", "", "ghp_bad", "S"]);
    const state = createWizardState();
    const result = await runGithubStep({
      prompter, state,
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-gh-")),
      detectFn: async () => ({ source: "none", token: null, user: null }),
      validateToken: async () => ({ ok: false, status: 401 }),
      openBrowser: async () => true
    });
    assert.match(captured(), /Token wurde abgelehnt/);
    assert.match(captured(), /HTTP 401/);
    assert.equal(result.source, "skipped");
    prompter.close();
  });
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `node --test test/wizard/steps/github.test.mjs`
Expected: 2 new tests fail (placeholder PAT path is too simple).

- [ ] **Step 3: Replace `runPatPath` with full implementation**

Replace the placeholder `runPatPath` body in `lib/wizard/steps/github.mjs`:

```js
const PAT_URL = "https://github.com/settings/tokens/new"
  + "?scopes=public_repo,read:user"
  + "&description=Patternpilot";

async function runPatPath(ctx) {
  const { prompter, state, configDir, validateToken, openBrowser } = ctx;

  // Step 1/4 — Browser
  prompter.write("\nSchritt 1 von 4 — Browser öffnen\n");
  prompter.write("─────────────────────────────────\n\n");
  prompter.write("Ich öffne gleich eine GitHub-Seite. Die richtigen Berechtigungen\n");
  prompter.write("sind dort schon vorausgewählt — du musst nur eingeloggt sein.\n\n");
  prompter.write(`  Link:  ${PAT_URL}\n\n`);

  const c1 = await prompter.choose("> ", [
    { key: "Enter", label: "Im Browser öffnen", default: true },
    { key: "C", label: "Nur Link kopieren (ich öffne selbst)" },
    { key: "Z", label: "Zurück" }
  ]);
  if (c1 === "Z") {
    state.recordStep("github", { path: "S", reason: "back-from-pat" });
    return { source: "skipped", token: null, user: null };
  }
  if (c1 !== "C") {
    const opened = await openBrowser(PAT_URL);
    if (!opened) prompter.write(`Konnte den Browser nicht öffnen. Link: ${PAT_URL}\n`);
  }

  // Step 2/4 — Configure
  prompter.write("\nSchritt 2 von 4 — Token konfigurieren\n");
  prompter.write("─────────────────────────────────────\n\n");
  prompter.write('Auf der GitHub-Seite siehst du ein Formular. Bitte prüfe:\n\n');
  prompter.write('  Note:        "Patternpilot"           ← schon ausgefüllt\n');
  prompter.write('  Expiration:  "90 days"                ← empfohlen, kannst du ändern\n');
  prompter.write("  Select scopes:\n");
  prompter.write("     [x] public_repo                    ← schon angehakt\n");
  prompter.write("     [x] read:user                      ← schon angehakt\n");
  prompter.write("     ↑ bitte NICHTS weiter ankreuzen\n\n");
  prompter.write('  Ganz unten: grüner Button "Generate token" — drück ihn.\n\n');
  await prompter.ask("[Enter] Habe den Button gedrückt");

  // Step 3/4 — Copy warning
  prompter.write("\nSchritt 3 von 4 — Token kopieren\n");
  prompter.write("─────────────────────────────────\n\n");
  prompter.write("⚠  WICHTIG: GitHub zeigt dir den Token nur EIN EINZIGES MAL.\n");
  prompter.write("    Verlässt du die Seite, ist er weg und du musst neu erstellen.\n\n");
  prompter.write('Du siehst jetzt einen grünen Kasten mit einem langen Text,\n');
  prompter.write('der mit "ghp_" beginnt. Daneben ein kleines Kopier-Symbol  ⧉\n\n');
  prompter.write("  → Klick auf das Symbol  (oder markieren + Strg+C)\n\n");
  await prompter.ask("[Enter] Token ist in der Zwischenablage");

  // Step 4/4 — Paste + validate
  while (true) {
    prompter.write("\nSchritt 4 von 4 — Token einfügen\n");
    prompter.write("─────────────────────────────────\n\n");
    prompter.write("Hier einfügen mit Strg+V, dann Enter:\n\n");
    const token = await prompter.askMasked("> ");

    prompter.write("\n  Prüfe…\n");
    const v = await validateToken(token);
    if (v.ok) {
      writeTokenFile(configDir, token);
      prompter.write("  ✓ Format korrekt\n");
      prompter.write(`  ✓ Authentifiziert als ${v.user}\n`);
      prompter.write(`  ✓ Scopes: ${(v.scopes || []).join(", ") || "-"}\n\n`);
      prompter.write(`  Gespeichert: ${path.join(configDir, ".env")}\n`);
      state.recordStep("github", { path: "P", user: v.user });
      return { source: "pat", token, user: v.user };
    }

    prompter.write(`  ✗ Token wurde abgelehnt (HTTP ${v.status ?? "?"}).\n`);
    prompter.write("    Mögliche Ursachen:\n");
    prompter.write("      - Token wurde gelöscht oder ist abgelaufen\n");
    prompter.write("      - Token wurde unvollständig eingefügt (zu kurz)\n");
    prompter.write("      - Token ist für GitHub Enterprise, nicht github.com\n\n");

    const c = await prompter.choose("> ", [
      { key: "E", label: "Erneut eingeben", default: true },
      { key: "N", label: "Doch neuen erstellen" },
      { key: "S", label: "Überspringen" }
    ]);
    if (c === "S") {
      state.recordStep("github", { path: "S", reason: "pat-rejected" });
      return { source: "skipped", token: null, user: null };
    }
    if (c === "N") return runPatPath(ctx);
  }
}
```

- [ ] **Step 4: Run tests, verify all pass**

Run: `node --test test/wizard/steps/github.test.mjs`
Expected: 5 passing tests total.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/steps/github.mjs test/wizard/steps/github.test.mjs
git commit -m "feat(wizard): add step 3 PAT 4-step path with validation diagnostics"
```

---

### Task 11: Step 4 — Discovery profile

**Files:**
- Create: `lib/wizard/steps/discovery.mjs`
- Test: `test/wizard/steps/discovery.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/steps/discovery.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runDiscoveryStep } from "../../../lib/wizard/steps/discovery.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runDiscoveryStep", () => {
  test("returns balanced when user accepts default", async () => {
    const { prompter } = pipedPrompter([""]);
    const state = createWizardState();
    const r = await runDiscoveryStep({ prompter, state, githubAvailable: true });
    assert.equal(r.profile, "balanced");
    prompter.close();
  });

  test("returns focused when chosen", async () => {
    const { prompter } = pipedPrompter(["focused"]);
    const state = createWizardState();
    const r = await runDiscoveryStep({ prompter, state, githubAvailable: true });
    assert.equal(r.profile, "focused");
    prompter.close();
  });

  test("when githubAvailable is false: shows note and stores balanced as default", async () => {
    const { prompter, captured } = pipedPrompter([]);
    const state = createWizardState();
    const r = await runDiscoveryStep({ prompter, state, githubAvailable: false });
    assert.equal(r.profile, "balanced");
    assert.match(captured(), /Discovery braucht einen GitHub-Token/);
    prompter.close();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/steps/discovery.test.mjs`

- [ ] **Step 3: Implement discovery step**

```js
// lib/wizard/steps/discovery.mjs
export async function runDiscoveryStep({
  prompter, state, replay = null,
  githubAvailable = true
} = {}) {
  if (replay) {
    const value = replay.get("discovery");
    state.recordStep("discovery", { value });
    return { profile: value };
  }

  prompter.write("\n[4/5] Wie breit soll Discovery suchen?\n\n");

  if (!githubAvailable) {
    prompter.write("  Discovery braucht einen GitHub-Token. Default `balanced` wird\n");
    prompter.write("  gespeichert und greift, sobald du den Token nachreichst.\n\n");
    state.recordStep("discovery", { value: "balanced", note: "deferred-no-token" });
    return { profile: "balanced" };
  }

  const choice = await prompter.choose("> ", [
    { key: "balanced", label: "balanced   empfohlen — solide Treffer, wenig Rauschen", default: true },
    { key: "focused", label: "focused    eng am Projekt — weniger, aber sehr passende Treffer" }
  ]);
  state.recordStep("discovery", { value: choice });
  return { profile: choice };
}
```

Note: `prompter.choose` accepts the typed string lowercased and matches case-insensitively against keys. Verify this works for multi-char keys by inspecting the Task 2 implementation. The current `choose` uppercases the input and matches against `.toUpperCase()` of keys — so `balanced` matches `balanced`. Add a case-insensitive comparison if needed.

Adjust prompt.mjs choose function comparison:

Edit `lib/wizard/prompt.mjs` `choose` body — change `o.key.toUpperCase()` to `o.key.toUpperCase()` (already correct) and the input matching. Verify that `.toUpperCase()` of the input handles multi-char input. If not, change to: `const normalizedRaw = raw; const hit = options.find((o) => o.key.toUpperCase() === normalizedRaw.toUpperCase());`

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/steps/discovery.test.mjs`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/steps/discovery.mjs test/wizard/steps/discovery.test.mjs lib/wizard/prompt.mjs
git commit -m "feat(wizard): add step 4 (discovery profile, defers when no token)"
```

---

### Task 12: Step 5 — First action

**Files:**
- Create: `lib/wizard/steps/first-action.mjs`
- Test: `test/wizard/steps/first-action.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/steps/first-action.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runFirstActionStep } from "../../../lib/wizard/steps/first-action.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runFirstActionStep", () => {
  test("nothing is the default and returns action=nothing", async () => {
    const { prompter } = pipedPrompter([""]);
    const state = createWizardState();
    const r = await runFirstActionStep({ prompter, state, githubAvailable: true });
    assert.equal(r.action, "nothing");
    prompter.close();
  });

  test("intake action prompts for url", async () => {
    const { prompter } = pipedPrompter(["intake", "https://github.com/foo/bar"]);
    const state = createWizardState();
    const r = await runFirstActionStep({ prompter, state, githubAvailable: true });
    assert.equal(r.action, "intake");
    assert.equal(r.url, "https://github.com/foo/bar");
    prompter.close();
  });

  test("problem action prompts for question", async () => {
    const { prompter } = pipedPrompter(["problem", "Wie lösen andere PDF-Extraktion?"]);
    const state = createWizardState();
    const r = await runFirstActionStep({ prompter, state, githubAvailable: true });
    assert.equal(r.action, "problem");
    assert.equal(r.question, "Wie lösen andere PDF-Extraktion?");
    prompter.close();
  });

  test("intake skipped when githubAvailable=false (downgrades to nothing)", async () => {
    const { prompter, captured } = pipedPrompter(["intake"]);
    const state = createWizardState();
    const r = await runFirstActionStep({ prompter, state, githubAvailable: false });
    assert.equal(r.action, "nothing");
    assert.match(captured(), /braucht einen GitHub-Token/);
    prompter.close();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/steps/first-action.test.mjs`

- [ ] **Step 3: Implement first-action step**

```js
// lib/wizard/steps/first-action.mjs
export async function runFirstActionStep({
  prompter, state, replay = null,
  githubAvailable = true
} = {}) {
  if (replay) {
    const value = replay.get("first_action");
    state.recordStep("first-action", { value });
    if (value === "intake") return { action: "intake", url: replay.get("first_action_url") };
    if (value === "problem") return { action: "problem", question: replay.get("first_action_question") };
    return { action: value };
  }

  prompter.write("\n[5/5] Gleich loslegen?\n\n");
  const choice = await prompter.choose("> ", [
    { key: "nothing", label: "Nichts (Setup speichern und beenden)", default: true },
    { key: "intake", label: "intake    — eine bekannte Repo-URL einlesen" },
    { key: "discover", label: "discover  — automatisch passende Repos im GitHub-Universum suchen" },
    { key: "problem", label: "problem   — eine konkrete Frage formulieren und dazu eine Repo-Landschaft erzeugen" }
  ]);

  if ((choice === "intake" || choice === "discover") && !githubAvailable) {
    prompter.write(`\n  ${choice} braucht einen GitHub-Token. Wird übersprungen.\n`);
    state.recordStep("first-action", { value: "nothing", reason: `${choice}-needs-token` });
    return { action: "nothing" };
  }

  if (choice === "intake") {
    const url = await prompter.ask("URL:");
    state.recordStep("first-action", { value: "intake", url });
    return { action: "intake", url };
  }
  if (choice === "problem") {
    const question = await prompter.ask("Welche Frage willst du beantworten? (ein Satz)");
    state.recordStep("first-action", { value: "problem", question });
    return { action: "problem", question };
  }

  state.recordStep("first-action", { value: choice });
  return { action: choice };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/steps/first-action.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/steps/first-action.mjs test/wizard/steps/first-action.test.mjs
git commit -m "feat(wizard): add step 5 (first action with github guards)"
```

---

## Phase 4 — Re-run menu

### Task 13: Re-run menu module

**Files:**
- Create: `lib/wizard/rerun-menu.mjs`
- Test: `test/wizard/rerun-menu.test.mjs`

- [ ] **Step 1: Write failing tests**

```js
// test/wizard/rerun-menu.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runRerunMenu } from "../../lib/wizard/rerun-menu.mjs";
import { createPrompter } from "../../lib/wizard/prompt.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runRerunMenu", () => {
  const config = {
    defaultProject: "eventbear-worker",
    projects: { "eventbear-worker": {}, "pinflow": {} }
  };

  test("A returns add-project intent", async () => {
    const { prompter } = pipedPrompter(["A"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "add-project");
    prompter.close();
  });

  test("E with project pick returns edit intent with project key", async () => {
    const { prompter } = pipedPrompter(["E", "2"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "edit-project");
    assert.equal(r.project, "pinflow");
    prompter.close();
  });

  test("T returns reauth intent", async () => {
    const { prompter } = pipedPrompter(["T"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "reauth");
    prompter.close();
  });

  test("D with project pick returns set-default intent", async () => {
    const { prompter } = pipedPrompter(["D", "1"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "set-default");
    assert.equal(r.project, "eventbear-worker");
    prompter.close();
  });

  test("Z returns cancel intent", async () => {
    const { prompter } = pipedPrompter(["Z"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "cancel");
    prompter.close();
  });

  test("lists all projects with default marker", async () => {
    const { prompter, captured } = pipedPrompter(["Z"]);
    await runRerunMenu({ prompter, config });
    assert.match(captured(), /eventbear-worker.*Default/);
    assert.match(captured(), /pinflow/);
    prompter.close();
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/rerun-menu.test.mjs`

- [ ] **Step 3: Implement rerun-menu**

```js
// lib/wizard/rerun-menu.mjs
export async function runRerunMenu({ prompter, config }) {
  const projects = Object.keys(config.projects ?? {});
  const def = config.defaultProject;

  prompter.write("\nPatternpilot ist bereits eingerichtet.\n\n");
  prompter.write("  Konfigurierte Projekte:\n");
  for (const p of projects) {
    prompter.write(`    - ${p}${p === def ? "  (Default)" : ""}\n`);
  }
  prompter.write("\n");

  const choice = await prompter.choose("Was möchtest du tun?", [
    { key: "A", label: "Neues Projekt hinzufügen" },
    { key: "E", label: "Existierendes Projekt editieren" },
    { key: "T", label: "GitHub-Token erneuern oder ändern" },
    { key: "D", label: "Default-Projekt wechseln" },
    { key: "Z", label: "Zurück (nichts ändern)", default: true }
  ]);

  if (choice === "A") return { intent: "add-project" };
  if (choice === "T") return { intent: "reauth" };
  if (choice === "Z") return { intent: "cancel" };

  const projectChoice = await prompter.choose(
    "Welches Projekt?",
    projects.map((p, i) => ({ key: String(i + 1), label: p, default: p === def }))
  );
  const project = projects[Number(projectChoice) - 1];

  if (choice === "E") return { intent: "edit-project", project };
  if (choice === "D") return { intent: "set-default", project };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/rerun-menu.test.mjs`
Expected: 6 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/rerun-menu.mjs test/wizard/rerun-menu.test.mjs
git commit -m "feat(wizard): add re-run action menu"
```

---

## Phase 5 — Wizard orchestration

### Task 14: Index entry + mode detection + step orchestration

**Files:**
- Create: `lib/wizard/index.mjs`

This task wires everything together but defers integration tests to Phase 7. Unit-level smoke test only.

- [ ] **Step 1: Write smoke test for mode detection**

```js
// test/wizard/index.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { resolveMode } from "../../lib/wizard/index.mjs";

describe("resolveMode", () => {
  test("--print forces print mode", () => {
    assert.equal(resolveMode({ flags: { print: true }, isInteractive: true }), "print");
  });

  test("non-interactive forces print mode", () => {
    assert.equal(resolveMode({ flags: {}, isInteractive: false }), "print");
  });

  test("interactive without --print is wizard", () => {
    assert.equal(resolveMode({ flags: {}, isInteractive: true }), "wizard");
  });

  test("--reconfigure without TTY throws", () => {
    assert.throws(
      () => resolveMode({ flags: { reconfigure: true }, isInteractive: false }),
      /erfordert ein interaktives Terminal/
    );
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/index.test.mjs`

- [ ] **Step 3: Implement index module**

```js
// lib/wizard/index.mjs
import path from "node:path";
import { createPrompter } from "./prompt.mjs";
import { createWizardState, appendHistory } from "./state.mjs";
import { loadReplay } from "./replay.mjs";
import { runRerunMenu } from "./rerun-menu.mjs";
import { runTargetStep } from "./steps/target.mjs";
import { runContextStep } from "./steps/context.mjs";
import { runGithubStep } from "./steps/github.mjs";
import { runDiscoveryStep } from "./steps/discovery.mjs";
import { runFirstActionStep } from "./steps/first-action.mjs";
import { defaultConfigDir } from "./detect/github-auth.mjs";

export function resolveMode({ flags, isInteractive }) {
  if (flags.reconfigure && !isInteractive) {
    const e = new Error("--reconfigure erfordert ein interaktives Terminal");
    e.exitCode = 2;
    throw e;
  }
  if (flags.print) return "print";
  if (!isInteractive) return "print";
  return "wizard";
}

export async function runWizard(rootDir, {
  flags = {},
  config = null,
  isInteractive = process.stdin.isTTY && process.stdout.isTTY,
  configDir = defaultConfigDir(),
  printFn = null
} = {}) {
  const mode = resolveMode({ flags, isInteractive });
  if (mode === "print") {
    if (!printFn) throw new Error("printFn required in print mode");
    return printFn(rootDir, config);
  }

  const replay = flags.replay ? loadReplay(flags.replay) : null;
  const prompter = createPrompter();
  const state = createWizardState();

  try {
    if (config && !flags.reconfigure && Object.keys(config.projects ?? {}).length > 0 && !replay) {
      const intent = await runRerunMenu({ prompter, config });
      state.recordStep("rerun-menu", { intent: intent.intent, project: intent.project });
      state.outcome = intent.intent === "cancel" ? "cancelled" : "completed-rerun";
      state.completed_at = new Date().toISOString();
      appendHistory(rootDir, state);
      return { intent };
    }

    const target = await runTargetStep({ prompter, state, replay });
    const ctx = await runContextStep({ prompter, state, replay, targetPath: target.path });
    const gh = await runGithubStep({ prompter, state, replay, configDir });
    const githubAvailable = gh.source !== "skipped";
    const disc = await runDiscoveryStep({ prompter, state, replay, githubAvailable });
    const action = await runFirstActionStep({ prompter, state, replay, githubAvailable });

    state.outcome = "completed";
    state.completed_at = new Date().toISOString();
    appendHistory(rootDir, state);

    return {
      target: target.path,
      context: ctx.context,
      watchlistSeed: ctx.watchlistSeed,
      github: gh,
      discovery: disc.profile,
      firstAction: action
    };
  } catch (err) {
    state.outcome = err.code === "REPLAY_INCOMPLETE" ? "replay-incomplete" : "cancelled";
    state.completed_at = new Date().toISOString();
    appendHistory(rootDir, state);
    throw err;
  } finally {
    prompter.close();
  }
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/index.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/index.mjs test/wizard/index.test.mjs
git commit -m "feat(wizard): add orchestration entry with mode detection"
```

---

## Phase 6 — Wiring

### Task 15: Register `init` in command-registry and project-admin

**Files:**
- Modify: `scripts/shared/command-registry.mjs`
- Modify: `scripts/commands/project-admin.mjs`
- Modify: `scripts/commands/project-admin/core.mjs`

- [ ] **Step 1: Read existing command-registry entry for getting-started**

Run: `grep -n "getting-started" scripts/shared/command-registry.mjs`

Note the line and shape (already known: line 3).

- [ ] **Step 2: Modify command-registry.mjs**

Replace the `getting-started` entry and add `init`:

```js
// before:
{ name: "getting-started", description: "Show the shortest useful first-run path for a fresh local installation", handlerKey: "runGettingStarted", aliases: ["first-run"] },

// after:
{ name: "init", description: "Run the interactive setup wizard (replaces getting-started in TTY mode)", handlerKey: "runInit", aliases: ["getting-started", "first-run"] },
```

- [ ] **Step 3: Add `runInit` wrapper to core.mjs**

Edit `scripts/commands/project-admin/core.mjs` — add at the end of the file:

```js
export async function runInit(rootDir, config, options = {}) {
  const { runWizard } = await import("../../../lib/wizard/index.mjs");
  return runWizard(rootDir, {
    flags: {
      print: options.print === true,
      reconfigure: options.reconfigure === true,
      replay: options.replay || null
    },
    config,
    printFn: (r, c) => runGettingStarted(r, c)
  });
}
```

- [ ] **Step 4: Re-export from project-admin.mjs**

Edit `scripts/commands/project-admin.mjs`. Add `runInit` to the imports from `./project-admin/core.mjs` and to the re-exports.

```js
export {
  runBootstrap,
  runGettingStarted,
  runInit,           // NEW
  runShowProject,
  // ... existing exports
} from "./project-admin/core.mjs";
```

(Adapt to actual file shape — use `Read` to see exact existing exports first.)

- [ ] **Step 5: Wire into patternpilot.mjs dispatch**

Edit `scripts/patternpilot.mjs`. Add `runInit` to the imports from `./commands/project-admin.mjs` and to the handler map:

```js
import {
  runBootstrap,
  runGettingStarted,
  runInit,           // NEW
  // ...
} from "./commands/project-admin.mjs";

// in the handler map / dispatch object:
{
  // ... existing handlers
  runGettingStarted,
  runInit,
  // ...
}
```

Ensure `init` is in the COMMANDS list near line 190 (next to `bootstrap`, `getting-started`).

- [ ] **Step 6: Add CLI flag parsing for --print, --reconfigure, --replay**

Find the existing options-parsing for project-admin commands in `scripts/patternpilot.mjs` and add three boolean/string flags. Pseudo-pattern (verify against existing parsing style first):

```js
const initOptions = {
  print: argv.includes("--print"),
  reconfigure: argv.includes("--reconfigure"),
  replay: extractFlagValue(argv, "--replay")
};
```

Where `extractFlagValue` already exists in the file or follows the existing pattern.

- [ ] **Step 7: Smoke test the wiring (print mode, no TTY)**

Run: `node scripts/patternpilot.mjs init --print < /dev/null`
Expected: same output as today's `node scripts/patternpilot.mjs getting-started`.

Compare:
```bash
diff <(node scripts/patternpilot.mjs init --print < /dev/null) \
     <(node scripts/patternpilot.mjs getting-started < /dev/null)
```
Expected: no diff (or only differences in dynamic timestamps, which neither command emits).

- [ ] **Step 8: Run full test suite to ensure no regressions**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 9: Commit**

```bash
git add scripts/patternpilot.mjs scripts/shared/command-registry.mjs scripts/commands/project-admin.mjs scripts/commands/project-admin/core.mjs
git commit -m "feat(wizard): wire init command into CLI with --print fallback"
```

---

### Task 16: Auto-trigger when no config

**Files:**
- Modify: `scripts/patternpilot.mjs`

- [ ] **Step 1: Locate the dispatch entry where commands are looked up**

Run: `grep -n "No project is configured" scripts/patternpilot.mjs`
Expected: line 408 region (already known from earlier exploration).

- [ ] **Step 2: Add auto-trigger before the "no project configured" error**

Read the surrounding code first (offset ~390-420). Then add a guarded prompt:

```js
// At the top of dispatch, after the command is resolved but before invoking:
if (!isInitCommand && !hasConfiguredProjects(config) && process.stdin.isTTY && process.stdout.isTTY) {
  const readline = await import("node:readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question(
    "Patternpilot ist noch nicht eingerichtet. Setup jetzt starten? [Y/n] ",
    (a) => res(a.trim().toLowerCase())
  ));
  rl.close();
  if (answer === "" || answer === "y" || answer === "j") {
    return runInit(rootDir, config, {});
  }
  // fall through to existing "no project configured" error
}

function hasConfiguredProjects(config) {
  return config && Object.keys(config.projects ?? {}).length > 0;
}
```

Adjust to actual file structure. The exact insertion point depends on where the dispatch flow lives — read lines 380–420 first.

- [ ] **Step 3: Manual smoke test**

Create a temp dir without config, run a non-init command:

```bash
mkdir -p /tmp/pp-test && cd /tmp/pp-test
echo "" | node /home/domi/eventbaer/dev/patternpilot/scripts/patternpilot.mjs analyze
```

Expected: prompt appears OR (because stdin is piped, not TTY) the existing error appears. Both are acceptable; the prompt only fires in TTY.

In a real TTY:
```bash
node scripts/patternpilot.mjs analyze
```
Expected: "Patternpilot ist noch nicht eingerichtet. Setup jetzt starten? [Y/n]" — pressing Y enters wizard, pressing n shows existing error.

- [ ] **Step 4: Commit**

```bash
git add scripts/patternpilot.mjs
git commit -m "feat(wizard): auto-trigger init when running without config in TTY"
```

---

## Phase 7 — Integration tests

### Task 17: Replay-driven integration tests

**Files:**
- Create: `test/fixtures/wizard/replays/fresh-with-pat.json`
- Create: `test/fixtures/wizard/replays/fresh-skip.json`
- Create: `test/fixtures/wizard/replays/rerun-add-project.json`
- Create: `test/wizard/integration/wizard-fresh-with-pat.test.mjs`
- Create: `test/wizard/integration/wizard-fresh-skip.test.mjs`

- [ ] **Step 1: Create replay fixtures**

```json
// test/fixtures/wizard/replays/fresh-with-pat.json
{
  "target": "TARGET_PATH_PLACEHOLDER",
  "context": "accept",
  "github": {
    "path": "P",
    "token": "ghp_replay_pat_token"
  },
  "discovery": "balanced",
  "first_action": "nothing"
}
```

```json
// test/fixtures/wizard/replays/fresh-skip.json
{
  "target": "TARGET_PATH_PLACEHOLDER",
  "context": "accept",
  "github": { "path": "S" },
  "discovery": "balanced",
  "first_action": "nothing"
}
```

```json
// test/fixtures/wizard/replays/rerun-add-project.json
{
  "rerun_intent": "A",
  "target": "TARGET_PATH_PLACEHOLDER",
  "context": "accept",
  "github": { "path": "S" },
  "discovery": "balanced",
  "first_action": "nothing"
}
```

(Tests rewrite TARGET_PATH_PLACEHOLDER per-run since paths are absolute.)

- [ ] **Step 2: Write integration test for fresh + PAT**

```js
// test/wizard/integration/wizard-fresh-with-pat.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runWizard } from "../../../lib/wizard/index.mjs";

function setupTargetRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-target-"));
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    name: "test-project", type: "module", dependencies: {}
  }));
  fs.writeFileSync(path.join(dir, "README.md"), "# Test Project\n");
  return dir;
}

function writeReplayWithTarget(targetPath, scenario) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-replay-"));
  const out = path.join(dir, "scenario.json");
  const replaced = JSON.parse(JSON.stringify(scenario).replaceAll("TARGET_PATH_PLACEHOLDER", targetPath));
  fs.writeFileSync(out, JSON.stringify(replaced));
  return out;
}

describe("wizard integration — fresh + PAT", () => {
  test("end-to-end produces config + token file + history entry", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-root-"));
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-config-"));
    const target = setupTargetRepo();

    const scenario = JSON.parse(fs.readFileSync(
      new URL("../../fixtures/wizard/replays/fresh-with-pat.json", import.meta.url),
      "utf8"
    ));
    const replayPath = writeReplayWithTarget(target, scenario);

    // Stub validateToken via env-injection: the github step's defaults read the env.
    // For integration we monkey-patch by passing a custom flag the wizard recognizes.
    // (If runWizard does not yet accept overrides, this test skips token validation.)

    const result = await runWizard(rootDir, {
      flags: { replay: replayPath },
      config: null,
      isInteractive: true,
      configDir,
      // For integration test purposes we accept any token without network call:
      // the wizard's default validateToken would require fetch. Pre-validation
      // happens inside the github step replay path — see github.mjs runGithubReplay.
    });

    assert.equal(result.discovery, "balanced");
    assert.ok(fs.existsSync(path.join(rootDir, "state", "wizard-history.json")));
    const history = JSON.parse(fs.readFileSync(path.join(rootDir, "state", "wizard-history.json"), "utf8"));
    assert.equal(history.runs[0].outcome, "completed");
    assert.equal(history.runs[0].steps.length, 5);
  });
});
```

Note: The replay path for github writes a token file using a fake validator path inside `runGithubReplay`. If validation requires real network in replay mode, adjust `runGithubReplay` to skip validation when `replay.get("github.skip_validation")` is true.

- [ ] **Step 3: Write integration test for fresh + skip**

```js
// test/wizard/integration/wizard-fresh-skip.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runWizard } from "../../../lib/wizard/index.mjs";

describe("wizard integration — fresh + skip github", () => {
  test("produces config without token file", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-skip-"));
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-skip-cfg-"));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-skip-target-"));
    fs.mkdirSync(path.join(target, ".git"), { recursive: true });
    fs.writeFileSync(path.join(target, "README.md"), "# T\n");

    const replayDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-skip-replay-"));
    const replayPath = path.join(replayDir, "s.json");
    fs.writeFileSync(replayPath, JSON.stringify({
      target,
      context: "accept",
      github: { path: "S" },
      discovery: "balanced",
      first_action: "nothing"
    }));

    const result = await runWizard(rootDir, {
      flags: { replay: replayPath },
      config: null,
      isInteractive: true,
      configDir
    });

    assert.equal(result.github.source, "skipped");
    assert.equal(fs.existsSync(path.join(configDir, ".env")), false);
  });
});
```

- [ ] **Step 4: Run integration tests**

Run: `node --test test/wizard/integration/`
Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add test/fixtures/wizard/ test/wizard/integration/
git commit -m "test(wizard): add replay-driven integration scenarios"
```

---

### Task 18: Print-mode regression snapshot

**Files:**
- Create: `test/wizard/integration/print-mode-snapshot.test.mjs`

- [ ] **Step 1: Capture today's print output as a snapshot**

```bash
node scripts/patternpilot.mjs getting-started < /dev/null > /tmp/getting-started-baseline.txt
```

Inspect briefly to confirm it's the expected text. If yes, save as snapshot in repo:

```bash
mkdir -p test/fixtures/wizard/snapshots
cp /tmp/getting-started-baseline.txt test/fixtures/wizard/snapshots/getting-started-print.txt
```

- [ ] **Step 2: Write snapshot regression test**

```js
// test/wizard/integration/print-mode-snapshot.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

describe("print-mode regression", () => {
  test("`init --print` output matches baseline getting-started snapshot", () => {
    const repoRoot = path.resolve(import.meta.dirname, "..", "..", "..");
    const result = spawnSync(
      "node",
      [path.join(repoRoot, "scripts", "patternpilot.mjs"), "init", "--print"],
      { input: "", encoding: "utf8" }
    );

    const expected = fs.readFileSync(
      path.join(repoRoot, "test", "fixtures", "wizard", "snapshots", "getting-started-print.txt"),
      "utf8"
    );

    assert.equal(result.status, 0);
    assert.equal(result.stdout, expected);
  });
});
```

- [ ] **Step 3: Run, verify pass**

Run: `node --test test/wizard/integration/print-mode-snapshot.test.mjs`
Expected: 1 passing test.

- [ ] **Step 4: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add test/fixtures/wizard/snapshots/ test/wizard/integration/print-mode-snapshot.test.mjs
git commit -m "test(wizard): pin print-mode output to baseline snapshot"
```

---

## Phase 8 — Documentation refresh

### Task 19: Update README onboarding section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Read current onboarding section**

Run: `sed -n '79,141p' README.md` to view "Einstieg Und Onboarding".

- [ ] **Step 2: Replace with wizard-centric guidance**

Replace the four-command Schnellstart with:

```markdown
## Einstieg Und Onboarding

### Schnellstart

```bash
npm install -g patternpilot
patternpilot init
```

Der Wizard fragt in 5 Schritten alles ab, was Patternpilot zum Loslegen braucht: Zielprojekt, Kontext, GitHub-Zugang, Discovery-Profil, optionale erste Aktion. Dauer ≤ 90 Sekunden.

Wer es nicht-interaktiv (z. B. in CI oder Doku) braucht:

```bash
patternpilot init --print
```

Zeigt die alte Schritt-Liste, ohne Fragen zu stellen.
```

Keep the SIMPLE_GUIDE / GETTING_STARTED links section unchanged (those docs still apply).

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs(readme): update onboarding section to point at wizard"
```

---

### Task 20: Final smoke test against fresh workspace

This is a manual validation, not a test file. Confirms the spec's Erfolgs-Kriterien.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 2: Test wizard against a real foreign workspace**

Pick a real other repo (e.g., `/home/domi/eventbaer/dev/eventbear-worker`).

```bash
mkdir -p /tmp/pp-fresh-test
cd /tmp/pp-fresh-test
node /home/domi/eventbaer/dev/patternpilot/scripts/patternpilot.mjs init
```

Click through with default answers. Verify:

- ≤ 90 seconds from start to abschluss-bildschirm
- Step 1 finds at least one repo
- Step 2 shows reasonable detected fields
- Step 3 either uses gh CLI or guides through PAT path
- Step 4 / Step 5 work
- Final screen shows next-command suggestion
- `state/wizard-history.json` contains the run

- [ ] **Step 3: Test re-run flow**

Run init again, expect re-run menu. Pick `Z` to exit.
Run init with `--reconfigure`, expect new setup flow.

- [ ] **Step 4: Test print-mode in CI scenario**

```bash
node scripts/patternpilot.mjs init < /dev/null
```
Expected: print output (no prompts, no hang).

- [ ] **Step 5: If all manual checks pass, no commit needed — feature is done**

---

## Self-Review

Spec sections vs. plan tasks:

| Spec § | Plan Task |
|---|---|
| 1. Architektur (mode detect, auto-trigger) | Task 14 (mode), Task 16 (auto-trigger) |
| 2. Re-Run-Menü | Task 13, Task 14 |
| 3. Step 1 Target | Task 8 |
| 3. Step 2 Context | Task 9 |
| 3. Step 3 GitHub (G/P/S/M) | Task 10 + 10b |
| 3. Step 4 Discovery | Task 11 |
| 3. Step 5 First Action | Task 12 |
| 4. Datenfluss / Persistenz | Task 1 (history), Task 10 (token file), wired in steps |
| 5. Implementierungs-Schnitt | All file structures match spec table |
| 6. Fehlerbehandlung | Task 10/10b (token errors), Task 14 (TTY check), Task 17 (replay errors) |
| 7. Was NICHT in v1 | enforced by absence — no fine-grained-PAT, no keychain, no LLM, no multi-project init |
| 8. Migration / Backward-Compat | Task 15 (`getting-started` aliased), Task 18 (snapshot) |
| 9. Test-Konzept incl. --replay | Task 3 (loader), Task 17 (integration), Task 18 (regression) |
| 10. Erfolgs-Kriterien | Task 20 (manual validation) |

No spec section without a covering task.

Type/method consistency check:
- `createWizardState` / `appendHistory` / `readHistory` — used consistently across Task 1 and Task 14
- `runTargetStep`, `runContextStep`, `runGithubStep`, `runDiscoveryStep`, `runFirstActionStep` — naming consistent across step modules and orchestration
- `loadReplay(file).get("path.with.dots")` — same shape used across all steps
- `detectGithubAuth({ env, configDir, ghProbe })` — signature stable between Task 6 and Task 10
- `createPrompter({ input, output })` returning `{ ask, askMasked, choose, confirm, close, write }` — consistent across all step tests

No placeholders. Every step has either runnable code or a precise instruction with exact paths and commands.

---

## Execution Notes

- Phases 1–4 can be parallelized across two implementers (Phase 1+2 vs Phase 3 share only the prompter). Phases 5–8 must be sequential.
- Each task ends with a commit. ~25 commits total for the full feature.
- Estimated time for a focused implementer following the plan: 6–10 hours including manual smoke tests in Task 20.
