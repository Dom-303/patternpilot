# Problem Statement Mode — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional "problem statement" layer on top of Pattern Pilot's project-binding, producing a problem-scoped solution landscape + brief that explicitly fights tunnel vision.

**Architecture:** Three layers that compose: (1) `lib/problem/` holds the artifact model (parse, derive, store, lifecycle) and is independent of discovery; (2) `lib/clustering/` produces a solution landscape from a pool of repos plus problem context and is independent of discovery; (3) `lib/discovery/problem-*.mjs` and `scripts/commands/problem-*.mjs` wire both into the existing Pattern Pilot flow via new `problem:*` commands and `--problem <slug>` flags on existing commands. LLM augmentation is a separate opt-in module in `lib/brief/llm.mjs` that never replaces heuristic output.

**Tech Stack:** Node.js ES modules (`.mjs`), `node:test` for tests, `node:fs/promises` for IO. No new dependencies beyond what patternpilot already uses.

**Reference:** See `docs/superpowers/specs/2026-04-20-problem-statement-mode-design.md` for the full spec.

---

## File Structure

**New files under `lib/problem/`:**
- `paths.mjs` — resolves project-bound vs standalone problem paths
- `slug.mjs` — slug generation + collision detection
- `parser.mjs` — parses `problem.md` (frontmatter + sections)
- `derived.mjs` — builds `derived.*` from hints
- `store.mjs` — read/write problem.md + problem.json
- `lifecycle.mjs` — status transitions, resolution.md
- `template.mjs` — template text for new problem.md
- `intake-backref.mjs` — adds `problem:` reference to intake dossiers

**New files under `lib/clustering/`:**
- `synonyms.json` — seed synonym map (data)
- `keywords.mjs` — keyword extraction from repo signals
- `stage1-structural.mjs` — (pattern_family, main_layer) clustering
- `stage2-keyword.mjs` — agglomerative single-link on Jaccard
- `stage3-axes.mjs` — user-declared axes mapping
- `labels.mjs` — cluster label generation
- `anti-tunnel.mjs` — near/adjacent/divergent markings
- `contrast.mjs` — signature-kontrast keywords per cluster
- `landscape.mjs` — orchestrator producing landscape.json

**New files under `lib/discovery/` (problem integration):**
- `problem-queries.mjs` — builds problem + cross query families
- `problem-ranking.mjs` — problem_fit score + combined score
- `problem-diversity.mjs` — diversity selection rule (11-20 slots)
- `problem-constraints.mjs` — hard/soft constraint application

**New files under `lib/brief/`:**
- `heuristic.mjs` — builds heuristic brief.md
- `llm.mjs` — optional LLM augmentation (cluster narrative + stärken/schwächen)
- `llm-cache.mjs` — per-run LLM cache with cluster-fingerprint keys
- `render.mjs` — brief.md rendering

**New files under `lib/landscape/`:**
- `html-report.mjs` — HTML landscape report

**New scripts under `scripts/commands/`:**
- `problem-create.mjs`
- `problem-list.mjs`
- `problem-refresh.mjs`
- `problem-explore.mjs`
- `problem-brief.mjs`
- `problem-resolve.mjs`
- `problem-archive.mjs`

**Modified files:**
- `scripts/patternpilot.mjs` — register problem-* handlers
- `scripts/shared/command-registry.mjs` — add COMMANDS entries
- `scripts/commands/discovery.mjs` — accept `--problem <slug>` flag
- `scripts/commands/watchlist.mjs` — accept `--problem <slug>` flag on review:watchlist
- `lib/index.mjs` — re-export problem + clustering + brief APIs
- `lib/config.mjs` — add `llm` config section
- `package.json` — add `problem:*` npm scripts

**New test files** (one per lib module, following existing `.test.mjs` convention):
- `test/problem-paths.test.mjs`, `test/problem-slug.test.mjs`, `test/problem-parser.test.mjs`, `test/problem-derived.test.mjs`, `test/problem-store.test.mjs`, `test/problem-lifecycle.test.mjs`, `test/problem-intake-backref.test.mjs`
- `test/clustering-keywords.test.mjs`, `test/clustering-stage1.test.mjs`, `test/clustering-stage2.test.mjs`, `test/clustering-stage3.test.mjs`, `test/clustering-labels.test.mjs`, `test/clustering-anti-tunnel.test.mjs`, `test/clustering-contrast.test.mjs`, `test/clustering-landscape.test.mjs`
- `test/problem-queries.test.mjs`, `test/problem-ranking.test.mjs`, `test/problem-diversity.test.mjs`, `test/problem-constraints.test.mjs`
- `test/brief-heuristic.test.mjs`, `test/brief-llm-cache.test.mjs`

---

## Phase 1 — Problem Artifact Foundation

### Task 1: Paths module

**Files:**
- Create: `lib/problem/paths.mjs`
- Create: `test/problem-paths.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-paths.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { resolveProblemDir, isStandalone } from "../lib/problem/paths.mjs";

test("resolveProblemDir returns project-scoped path when project is given", () => {
  const result = resolveProblemDir({ rootDir: "/r", projectKey: "app", slug: "slow-lists" });
  assert.equal(result, "/r/projects/app/problems/slow-lists");
});

test("resolveProblemDir returns standalone path when project is null", () => {
  const result = resolveProblemDir({ rootDir: "/r", projectKey: null, slug: "slow-lists" });
  assert.equal(result, "/r/state/standalone-problems/slow-lists");
});

test("isStandalone reflects projectKey presence", () => {
  assert.equal(isStandalone({ projectKey: "app" }), false);
  assert.equal(isStandalone({ projectKey: null }), true);
  assert.equal(isStandalone({}), true);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-paths.test.mjs`
Expected: FAIL with module-not-found error.

- [ ] **Step 3: Implement module**

```js
// lib/problem/paths.mjs
import path from "node:path";

export function isStandalone(problem) {
  return !problem?.projectKey;
}

export function resolveProblemDir({ rootDir, projectKey, slug }) {
  if (!rootDir || !slug) {
    throw new Error("resolveProblemDir requires rootDir and slug");
  }
  if (projectKey) {
    return path.join(rootDir, "projects", projectKey, "problems", slug);
  }
  return path.join(rootDir, "state", "standalone-problems", slug);
}

export function resolveLandscapeDir({ rootDir, projectKey, slug, runId }) {
  return path.join(resolveProblemDir({ rootDir, projectKey, slug }), "landscape", runId);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-paths.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/problem/paths.mjs test/problem-paths.test.mjs
git commit -m "feat(problem): add paths helper for project-scoped and standalone problems"
```

---

### Task 2: Slug module

**Files:**
- Create: `lib/problem/slug.mjs`
- Create: `test/problem-slug.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-slug.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildSlug, validateSlug } from "../lib/problem/slug.mjs";

test("buildSlug lowercases and replaces spaces with dashes", () => {
  assert.equal(buildSlug("Slow Event Lists"), "slow-event-lists");
});

test("buildSlug strips punctuation and umlauts", () => {
  assert.equal(buildSlug("Lange Eventlisten für Ö-Städte!"), "lange-eventlisten-fur-o-stadte");
});

test("buildSlug collapses repeated dashes", () => {
  assert.equal(buildSlug("A  --  B"), "a-b");
});

test("buildSlug trims leading and trailing dashes", () => {
  assert.equal(buildSlug("---x---"), "x");
});

test("validateSlug rejects uppercase and invalid chars", () => {
  assert.equal(validateSlug("slow-lists"), true);
  assert.equal(validateSlug("Slow-Lists"), false);
  assert.equal(validateSlug("slow_lists"), false);
  assert.equal(validateSlug(""), false);
  assert.equal(validateSlug("slow--lists"), false);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-slug.test.mjs`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement module**

```js
// lib/problem/slug.mjs
const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const UMLAUT_MAP = new Map([
  ["ä", "a"], ["ö", "o"], ["ü", "u"], ["ß", "ss"],
  ["à", "a"], ["á", "a"], ["â", "a"], ["é", "e"], ["è", "e"],
  ["ê", "e"], ["í", "i"], ["ì", "i"], ["î", "i"], ["ó", "o"],
  ["ò", "o"], ["ô", "o"], ["ú", "u"], ["ù", "u"], ["û", "u"]
]);

export function buildSlug(input) {
  if (typeof input !== "string") return "";
  const folded = [...input.toLowerCase()]
    .map((ch) => UMLAUT_MAP.get(ch) ?? ch)
    .join("");
  const replaced = folded.replace(/[^a-z0-9]+/g, "-");
  const collapsed = replaced.replace(/-+/g, "-");
  return collapsed.replace(/^-|-$/g, "");
}

export function validateSlug(slug) {
  return typeof slug === "string" && slug.length > 0 && SLUG_PATTERN.test(slug);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-slug.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/problem/slug.mjs test/problem-slug.test.mjs
git commit -m "feat(problem): add slug builder with umlaut folding and validation"
```

---

### Task 3: Markdown parser

**Files:**
- Create: `lib/problem/parser.mjs`
- Create: `test/problem-parser.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-parser.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { parseProblemMarkdown } from "../lib/problem/parser.mjs";

const SAMPLE = `---
slug: slow-lists
title: Long lists are slow
status: active
project: app
created_at: 2026-04-20
---

## description
Lists with 500+ items take 3-5 seconds.

## success_criteria
- first 50 items < 300 ms
- smooth scroll

## constraints
- no external service
- license: apache-compatible

## non_goals
- no SSR rewrite

## current_approach
We load everything at once and render it.

## hints
- search_terms: long list virtualization, event feed performance
- tech_tags: nextjs, react
- constraint_tags: local-only, license:apache-compatible
- approach_keywords: client-virtualization, react-window
`;

test("parseProblemMarkdown extracts frontmatter fields", () => {
  const parsed = parseProblemMarkdown(SAMPLE);
  assert.equal(parsed.frontmatter.slug, "slow-lists");
  assert.equal(parsed.frontmatter.title, "Long lists are slow");
  assert.equal(parsed.frontmatter.status, "active");
  assert.equal(parsed.frontmatter.project, "app");
  assert.equal(parsed.frontmatter.created_at, "2026-04-20");
});

test("parseProblemMarkdown extracts text fields as raw text", () => {
  const parsed = parseProblemMarkdown(SAMPLE);
  assert.match(parsed.fields.description, /Lists with 500/);
  assert.match(parsed.fields.current_approach, /everything at once/);
});

test("parseProblemMarkdown extracts list fields as bullet arrays", () => {
  const parsed = parseProblemMarkdown(SAMPLE);
  assert.deepEqual(parsed.fields.success_criteria, ["first 50 items < 300 ms", "smooth scroll"]);
  assert.deepEqual(parsed.fields.constraints, ["no external service", "license: apache-compatible"]);
  assert.deepEqual(parsed.fields.non_goals, ["no SSR rewrite"]);
});

test("parseProblemMarkdown parses hints into key-value entries", () => {
  const parsed = parseProblemMarkdown(SAMPLE);
  assert.deepEqual(parsed.fields.hints.search_terms, ["long list virtualization", "event feed performance"]);
  assert.deepEqual(parsed.fields.hints.tech_tags, ["nextjs", "react"]);
  assert.deepEqual(parsed.fields.hints.constraint_tags, ["local-only", "license:apache-compatible"]);
  assert.deepEqual(parsed.fields.hints.approach_keywords, ["client-virtualization", "react-window"]);
});

test("parseProblemMarkdown tolerates missing optional sections", () => {
  const minimal = `---
slug: x
title: X
status: active
created_at: 2026-04-20
---

## description
Just some text.
`;
  const parsed = parseProblemMarkdown(minimal);
  assert.equal(parsed.fields.description, "Just some text.");
  assert.deepEqual(parsed.fields.success_criteria, []);
  assert.deepEqual(parsed.fields.hints, {});
});

test("parseProblemMarkdown supports suspected_approach_axes as list", () => {
  const content = `---
slug: x
title: X
status: active
created_at: 2026-04-20
---

## description
d

## suspected_approach_axes
- client-side virtualization
- server-side pagination
`;
  const parsed = parseProblemMarkdown(content);
  assert.deepEqual(parsed.fields.suspected_approach_axes, [
    "client-side virtualization",
    "server-side pagination"
  ]);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-parser.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/problem/parser.mjs
const TEXT_FIELDS = new Set(["description", "current_approach"]);
const LIST_FIELDS = new Set(["success_criteria", "constraints", "non_goals", "suspected_approach_axes"]);
const KEY_VALUE_FIELDS = new Set(["hints"]);

function parseFrontmatter(block) {
  const out = {};
  for (const line of block.split("\n")) {
    const m = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (m) out[m[1].trim()] = m[2].trim();
  }
  return out;
}

function splitSections(body) {
  const sections = {};
  const lines = body.split("\n");
  let currentName = null;
  let buffer = [];
  for (const line of lines) {
    const headerMatch = line.match(/^##\s+(.+?)\s*$/);
    if (headerMatch) {
      if (currentName) sections[currentName] = buffer.join("\n").trim();
      currentName = headerMatch[1].trim();
      buffer = [];
    } else if (currentName) {
      buffer.push(line);
    }
  }
  if (currentName) sections[currentName] = buffer.join("\n").trim();
  return sections;
}

function parseListSection(text) {
  if (!text) return [];
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("-"))
    .map((l) => l.slice(1).trim())
    .filter(Boolean);
}

function parseKeyValueSection(text) {
  const out = {};
  for (const entry of parseListSection(text)) {
    const m = entry.match(/^([a-z_]+):\s*(.+)$/i);
    if (!m) continue;
    const key = m[1].trim();
    const values = m[2].split(",").map((v) => v.trim()).filter(Boolean);
    out[key] = values;
  }
  return out;
}

export function parseProblemMarkdown(source) {
  const fmMatch = source.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) {
    throw new Error("problem.md is missing frontmatter (--- ... --- block)");
  }
  const frontmatter = parseFrontmatter(fmMatch[1]);
  const sections = splitSections(fmMatch[2]);

  const fields = {
    description: "",
    current_approach: "",
    success_criteria: [],
    constraints: [],
    non_goals: [],
    suspected_approach_axes: [],
    hints: {}
  };

  for (const [name, text] of Object.entries(sections)) {
    if (TEXT_FIELDS.has(name)) fields[name] = text;
    else if (LIST_FIELDS.has(name)) fields[name] = parseListSection(text);
    else if (KEY_VALUE_FIELDS.has(name)) fields[name] = parseKeyValueSection(text);
  }

  return { frontmatter, fields };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-parser.test.mjs`
Expected: PASS (all 6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/problem/parser.mjs test/problem-parser.test.mjs
git commit -m "feat(problem): add markdown parser for problem.md with frontmatter and sections"
```

---

### Task 4: Derived fields builder

**Files:**
- Create: `lib/problem/derived.mjs`
- Create: `test/problem-derived.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-derived.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildDerived } from "../lib/problem/derived.mjs";

test("buildDerived prefers hints.search_terms and adds keyword extract from title", () => {
  const derived = buildDerived({
    title: "Long event lists are slow",
    fields: { hints: { search_terms: ["virtualization", "event feed"] } }
  });
  assert.ok(derived.query_seeds.includes("virtualization"));
  assert.ok(derived.query_seeds.includes("event feed"));
  assert.ok(derived.query_seeds.some((s) => /event|list|slow/i.test(s)));
});

test("buildDerived approach_signature returns hints.approach_keywords only", () => {
  const derived = buildDerived({
    title: "T",
    fields: {
      hints: { approach_keywords: ["client-virtualization", "react-window"] },
      current_approach: "We use react-window and custom virtualization."
    }
  });
  assert.deepEqual(derived.approach_signature, ["client-virtualization", "react-window"]);
});

test("buildDerived approach_signature empty when no hint", () => {
  const derived = buildDerived({
    title: "T",
    fields: { hints: {}, current_approach: "No hints here." }
  });
  assert.deepEqual(derived.approach_signature, []);
});

test("buildDerived uses hints.constraint_tags and tech_tags verbatim", () => {
  const derived = buildDerived({
    title: "T",
    fields: {
      hints: {
        constraint_tags: ["local-only", "license:apache-compatible"],
        tech_tags: ["nextjs", "react"]
      }
    }
  });
  assert.deepEqual(derived.constraint_tags, ["local-only", "license:apache-compatible"]);
  assert.deepEqual(derived.tech_tags, ["nextjs", "react"]);
});

test("buildDerived query_seeds filters out stopwords and short tokens from title", () => {
  const derived = buildDerived({
    title: "The lists are a slow thing",
    fields: { hints: {} }
  });
  for (const token of derived.query_seeds) {
    assert.ok(!["the", "are", "a"].includes(token), `token ${token} should be filtered`);
  }
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-derived.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/problem/derived.mjs
const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "be", "to", "of", "in", "on", "for",
  "with", "and", "or", "it", "that", "this", "as", "at", "by", "from",
  "we", "you", "they", "i", "me", "my", "our", "your", "their",
  "do", "does", "did", "has", "have", "had", "was", "were", "been",
  "should", "would", "could", "can", "will", "thing", "things"
]);

function extractTitleKeywords(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function buildDerived({ title, fields }) {
  const hints = fields?.hints ?? {};

  const seeds = [...(hints.search_terms ?? []), ...extractTitleKeywords(title)];
  const query_seeds = dedupe(seeds);

  const approach_signature = Array.isArray(hints.approach_keywords)
    ? [...hints.approach_keywords]
    : [];

  const constraint_tags = Array.isArray(hints.constraint_tags)
    ? [...hints.constraint_tags]
    : [];

  const tech_tags = Array.isArray(hints.tech_tags) ? [...hints.tech_tags] : [];

  return { query_seeds, approach_signature, constraint_tags, tech_tags };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-derived.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/problem/derived.mjs test/problem-derived.test.mjs
git commit -m "feat(problem): derive query_seeds and signature fields from hints"
```

---

### Task 5: Problem template

**Files:**
- Create: `lib/problem/template.mjs`

- [ ] **Step 1: Implement template module**

```js
// lib/problem/template.mjs
export function buildProblemTemplate({ slug, title, projectKey, createdAt }) {
  const projectLine = projectKey ? `project: ${projectKey}\n` : "";
  return `---
slug: ${slug}
title: ${title}
status: active
${projectLine}created_at: ${createdAt}
---

## description
<one paragraph describing the problem>

## success_criteria
- <what "solved" looks like>

## constraints
- <must-not, budget, stack, license>

## non_goals
- <what this problem explicitly is not about>

## current_approach
<how you are currently thinking about solving it>

## hints
- search_terms: <comma-separated terms for discovery>
- tech_tags: <comma-separated tech stack tokens>
- constraint_tags: <comma-separated filterable tags>
- approach_keywords: <comma-separated approach tokens>

## suspected_approach_axes
# optional — declare candidate axes for the Solution Landscape
- <axis 1>
- <axis 2>
`;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/problem/template.mjs
git commit -m "feat(problem): add problem.md template generator"
```

---

### Task 6: Store (read/write problem.md + problem.json)

**Files:**
- Create: `lib/problem/store.mjs`
- Create: `test/problem-store.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-store.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeProblem, readProblem, refreshProblemJson } from "../lib/problem/store.mjs";
import { buildProblemTemplate } from "../lib/problem/template.mjs";

async function tmpRoot() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "problem-store-"));
}

test("writeProblem creates problem.md and problem.json", async () => {
  const rootDir = await tmpRoot();
  const md = buildProblemTemplate({
    slug: "x",
    title: "X",
    projectKey: "app",
    createdAt: "2026-04-20"
  });
  await writeProblem({ rootDir, projectKey: "app", slug: "x", markdown: md });

  const mdPath = path.join(rootDir, "projects/app/problems/x/problem.md");
  const jsonPath = path.join(rootDir, "projects/app/problems/x/problem.json");
  const mdExists = await fs.stat(mdPath).then(() => true).catch(() => false);
  const jsonExists = await fs.stat(jsonPath).then(() => true).catch(() => false);
  assert.equal(mdExists, true);
  assert.equal(jsonExists, true);
});

test("readProblem returns parsed fields and derived", async () => {
  const rootDir = await tmpRoot();
  const md = `---
slug: y
title: Y problem
status: active
project: app
created_at: 2026-04-20
---

## description
The Y problem description.

## hints
- search_terms: y-term
- approach_keywords: y-approach
`;
  await writeProblem({ rootDir, projectKey: "app", slug: "y", markdown: md });
  const problem = await readProblem({ rootDir, projectKey: "app", slug: "y" });
  assert.equal(problem.slug, "y");
  assert.equal(problem.title, "Y problem");
  assert.equal(problem.project, "app");
  assert.equal(problem.fields.description, "The Y problem description.");
  assert.ok(problem.derived.query_seeds.includes("y-term"));
  assert.deepEqual(problem.derived.approach_signature, ["y-approach"]);
});

test("refreshProblemJson regenerates problem.json from current problem.md", async () => {
  const rootDir = await tmpRoot();
  const md = buildProblemTemplate({ slug: "z", title: "Z", projectKey: "app", createdAt: "2026-04-20" });
  await writeProblem({ rootDir, projectKey: "app", slug: "z", markdown: md });

  const updated = md.replace(
    "## description\n<one paragraph describing the problem>",
    "## description\nUpdated description.\n\n## hints\n- search_terms: new-term"
  );
  const mdPath = path.join(rootDir, "projects/app/problems/z/problem.md");
  await fs.writeFile(mdPath, updated);

  await refreshProblemJson({ rootDir, projectKey: "app", slug: "z" });
  const problem = await readProblem({ rootDir, projectKey: "app", slug: "z" });
  assert.equal(problem.fields.description, "Updated description.");
  assert.ok(problem.derived.query_seeds.includes("new-term"));
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-store.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/problem/store.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { resolveProblemDir } from "./paths.mjs";
import { parseProblemMarkdown } from "./parser.mjs";
import { buildDerived } from "./derived.mjs";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function buildProblemJson({ frontmatter, fields, derived, latestLandscape, lastExploreResult }) {
  return {
    slug: frontmatter.slug,
    title: frontmatter.title,
    status: frontmatter.status ?? "active",
    project: frontmatter.project ?? null,
    created_at: frontmatter.created_at ?? null,
    updated_at: new Date().toISOString().slice(0, 10),
    latest_landscape: latestLandscape ?? null,
    last_explore_result: lastExploreResult ?? null,
    fields,
    derived
  };
}

export async function writeProblem({ rootDir, projectKey, slug, markdown }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, "problem.md"), markdown);
  await refreshProblemJson({ rootDir, projectKey, slug });
}

export async function refreshProblemJson({ rootDir, projectKey, slug }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const markdown = await fs.readFile(path.join(dir, "problem.md"), "utf8");
  const { frontmatter, fields } = parseProblemMarkdown(markdown);
  const derived = buildDerived({ title: frontmatter.title, fields });

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

export async function readProblem({ rootDir, projectKey, slug }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const raw = await fs.readFile(path.join(dir, "problem.json"), "utf8");
  return JSON.parse(raw);
}

export async function updateProblemPointer({ rootDir, projectKey, slug, latestLandscape, lastExploreResult }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const jsonPath = path.join(dir, "problem.json");
  const current = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  if (latestLandscape !== undefined) current.latest_landscape = latestLandscape;
  if (lastExploreResult !== undefined) current.last_explore_result = lastExploreResult;
  current.updated_at = new Date().toISOString().slice(0, 10);
  await fs.writeFile(jsonPath, `${JSON.stringify(current, null, 2)}\n`);
  return current;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-store.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/problem/store.mjs test/problem-store.test.mjs
git commit -m "feat(problem): add store with writeProblem, readProblem, refreshProblemJson"
```

---

### Task 7: Lifecycle (status transitions + resolution)

**Files:**
- Create: `lib/problem/lifecycle.mjs`
- Create: `test/problem-lifecycle.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-lifecycle.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { writeProblem } from "../lib/problem/store.mjs";
import { buildProblemTemplate } from "../lib/problem/template.mjs";
import { resolveProblem, archiveProblem } from "../lib/problem/lifecycle.mjs";

async function tmpRoot() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "problem-lifecycle-"));
}

async function seed(rootDir) {
  const md = buildProblemTemplate({ slug: "x", title: "X", projectKey: "app", createdAt: "2026-04-20" });
  await writeProblem({ rootDir, projectKey: "app", slug: "x", markdown: md });
}

test("resolveProblem sets status and writes resolution.md when note is given", async () => {
  const rootDir = await tmpRoot();
  await seed(rootDir);

  await resolveProblem({ rootDir, projectKey: "app", slug: "x", note: "Chose option A" });

  const json = JSON.parse(await fs.readFile(path.join(rootDir, "projects/app/problems/x/problem.json"), "utf8"));
  assert.equal(json.status, "resolved");

  const resolutionPath = path.join(rootDir, "projects/app/problems/x/resolution.md");
  const exists = await fs.stat(resolutionPath).then(() => true).catch(() => false);
  assert.equal(exists, true);

  const content = await fs.readFile(resolutionPath, "utf8");
  assert.match(content, /Chose option A/);
});

test("resolveProblem without note skips resolution.md", async () => {
  const rootDir = await tmpRoot();
  await seed(rootDir);
  await resolveProblem({ rootDir, projectKey: "app", slug: "x" });
  const resolutionPath = path.join(rootDir, "projects/app/problems/x/resolution.md");
  const exists = await fs.stat(resolutionPath).then(() => true).catch(() => false);
  assert.equal(exists, false);
});

test("archiveProblem sets status to archived", async () => {
  const rootDir = await tmpRoot();
  await seed(rootDir);
  await archiveProblem({ rootDir, projectKey: "app", slug: "x" });
  const json = JSON.parse(await fs.readFile(path.join(rootDir, "projects/app/problems/x/problem.json"), "utf8"));
  assert.equal(json.status, "archived");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-lifecycle.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/problem/lifecycle.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { resolveProblemDir } from "./paths.mjs";
import { readProblem } from "./store.mjs";

async function setStatus({ rootDir, projectKey, slug, status }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const jsonPath = path.join(dir, "problem.json");
  const current = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  current.status = status;
  current.updated_at = new Date().toISOString().slice(0, 10);
  await fs.writeFile(jsonPath, `${JSON.stringify(current, null, 2)}\n`);

  const mdPath = path.join(dir, "problem.md");
  let md = await fs.readFile(mdPath, "utf8");
  md = md.replace(/^status:\s*.*$/m, `status: ${status}`);
  await fs.writeFile(mdPath, md);
}

function buildResolutionMarkdown({ problem, note, landscapeRef }) {
  const resolvedAt = new Date().toISOString().slice(0, 10);
  const landscapeLine = landscapeRef ? `landscape_ref: ${landscapeRef}\n` : "";
  return `---
problem: ${problem.slug}
resolved_at: ${resolvedAt}
${landscapeLine}---

## chosen_approach
${note ?? ""}

## why
<why this approach won over alternatives>

## links_to_cluster
- <cluster label or landscape reference>
`;
}

export async function resolveProblem({ rootDir, projectKey, slug, note }) {
  await setStatus({ rootDir, projectKey, slug, status: "resolved" });
  if (!note) return;
  const problem = await readProblem({ rootDir, projectKey, slug });
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const markdown = buildResolutionMarkdown({
    problem,
    note,
    landscapeRef: problem.latest_landscape ?? null
  });
  await fs.writeFile(path.join(dir, "resolution.md"), markdown);
}

export async function archiveProblem({ rootDir, projectKey, slug }) {
  await setStatus({ rootDir, projectKey, slug, status: "archived" });
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-lifecycle.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/problem/lifecycle.mjs test/problem-lifecycle.test.mjs
git commit -m "feat(problem): add resolve/archive lifecycle with optional resolution.md"
```

---

## Phase 2 — Problem CLI commands (create, list, refresh, resolve, archive)

### Task 8: Command — problem-create

**Files:**
- Create: `scripts/commands/problem-create.mjs`
- Modify: `scripts/patternpilot.mjs` (wire handler)
- Modify: `scripts/shared/command-registry.mjs` (register command)
- Modify: `package.json` (npm script)

- [ ] **Step 1: Implement command handler**

```js
// scripts/commands/problem-create.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { buildSlug, validateSlug } from "../../lib/problem/slug.mjs";
import { buildProblemTemplate } from "../../lib/problem/template.mjs";
import { writeProblem } from "../../lib/problem/store.mjs";
import { resolveProblemDir } from "../../lib/problem/paths.mjs";

function parseArgs(rawArgs) {
  const opts = { project: null, title: null, slug: null };
  for (let i = 0; i < rawArgs.length; i += 1) {
    const a = rawArgs[i];
    if (a === "--project") { opts.project = rawArgs[++i]; continue; }
    if (a === "--title") { opts.title = rawArgs[++i]; continue; }
    if (a === "--slug") { opts.slug = rawArgs[++i]; continue; }
  }
  return opts;
}

export async function runProblemCreate({ rawArgs, rootDir }) {
  const { project, title, slug: explicitSlug } = parseArgs(rawArgs ?? []);
  if (!title) {
    console.error("problem:create requires --title \"...\"");
    process.exitCode = 2;
    return;
  }
  const slug = explicitSlug ?? buildSlug(title);
  if (!validateSlug(slug)) {
    console.error(`Invalid slug: ${slug}. Use lowercase, dashes, no underscores.`);
    process.exitCode = 2;
    return;
  }

  const dir = resolveProblemDir({ rootDir, projectKey: project, slug });
  const exists = await fs.stat(dir).then(() => true).catch(() => false);
  if (exists) {
    console.error(`Problem already exists at ${dir}. Use a different --slug or delete manually.`);
    process.exitCode = 2;
    return;
  }

  const markdown = buildProblemTemplate({
    slug,
    title,
    projectKey: project,
    createdAt: new Date().toISOString().slice(0, 10)
  });
  await writeProblem({ rootDir, projectKey: project, slug, markdown });

  console.log(`Created problem at ${path.join(dir, "problem.md")}`);
  console.log("Edit the markdown, then run: npm run patternpilot -- problem-refresh " + slug);
}
```

- [ ] **Step 2: Register handler in scripts/patternpilot.mjs**

Add this import near other command imports:

```js
import { runProblemCreate } from "./commands/problem-create.mjs";
```

Add handler key to the dispatch map where other handlers are registered (search for `runBootstrap` to find the pattern). Follow exactly the same style as existing entries.

- [ ] **Step 3: Add command entry to scripts/shared/command-registry.mjs**

Append inside the `COMMANDS` array:

```js
  { name: "problem-create", description: "Create a new problem artifact (project-bound or standalone)", handlerKey: "runProblemCreate" },
```

- [ ] **Step 4: Add npm script in package.json**

Inside the `scripts` object, add:

```json
    "problem:create": "node scripts/patternpilot.mjs problem-create",
```

- [ ] **Step 5: Smoke test manually**

```bash
rm -rf /tmp/pp-smoke && mkdir -p /tmp/pp-smoke
cd /home/domi/eventbaer/dev/patternpilot
PATTERNPILOT_ROOT=/tmp/pp-smoke npm run problem:create -- --project test --title "Slow lists"
ls /tmp/pp-smoke/projects/test/problems/slow-lists/
```

Expected: `problem.md` and `problem.json` both present. Open `problem.md` and confirm it matches the template.

- [ ] **Step 6: Commit**

```bash
git add scripts/commands/problem-create.mjs scripts/patternpilot.mjs scripts/shared/command-registry.mjs package.json
git commit -m "feat(cli): add problem:create command"
```

---

### Task 9: Command — problem-refresh

**Files:**
- Create: `scripts/commands/problem-refresh.mjs`
- Modify: `scripts/patternpilot.mjs`, `scripts/shared/command-registry.mjs`, `package.json`

- [ ] **Step 1: Implement command**

```js
// scripts/commands/problem-refresh.mjs
import fs from "node:fs/promises";
import { refreshProblemJson } from "../../lib/problem/store.mjs";
import { resolveProblemDir } from "../../lib/problem/paths.mjs";

function parseArgs(rawArgs) {
  const opts = { project: null, slug: null };
  let positional = 0;
  for (let i = 0; i < rawArgs.length; i += 1) {
    const a = rawArgs[i];
    if (a === "--project") { opts.project = rawArgs[++i]; continue; }
    if (a.startsWith("--")) continue;
    if (positional === 0) { opts.slug = a; positional += 1; }
  }
  return opts;
}

async function findProblemProject({ rootDir, slug }) {
  const projectsDir = `${rootDir}/projects`;
  try {
    const projects = await fs.readdir(projectsDir);
    for (const project of projects) {
      const candidate = `${projectsDir}/${project}/problems/${slug}`;
      const exists = await fs.stat(candidate).then(() => true).catch(() => false);
      if (exists) return project;
    }
  } catch { /* projects dir missing */ }

  const standalone = `${rootDir}/state/standalone-problems/${slug}`;
  const standaloneExists = await fs.stat(standalone).then(() => true).catch(() => false);
  if (standaloneExists) return null;

  throw new Error(`Problem ${slug} not found in any project or standalone`);
}

export async function runProblemRefresh({ rawArgs, rootDir }) {
  const { project: explicitProject, slug } = parseArgs(rawArgs ?? []);
  if (!slug) {
    console.error("problem:refresh requires <slug>");
    process.exitCode = 2;
    return;
  }
  const project = explicitProject ?? await findProblemProject({ rootDir, slug });
  await refreshProblemJson({ rootDir, projectKey: project, slug });
  const dir = resolveProblemDir({ rootDir, projectKey: project, slug });
  console.log(`Refreshed ${dir}/problem.json`);
}
```

- [ ] **Step 2: Register handler + command entry + npm script**

Same pattern as Task 8. Handler key `runProblemRefresh`, command name `problem-refresh`, npm script `"problem:refresh": "node scripts/patternpilot.mjs problem-refresh"`.

- [ ] **Step 3: Smoke test**

```bash
PATTERNPILOT_ROOT=/tmp/pp-smoke npm run problem:refresh -- slow-lists
```

Expected: `Refreshed /tmp/pp-smoke/projects/test/problems/slow-lists/problem.json`.

- [ ] **Step 4: Commit**

```bash
git add scripts/commands/problem-refresh.mjs scripts/patternpilot.mjs scripts/shared/command-registry.mjs package.json
git commit -m "feat(cli): add problem:refresh command"
```

---

### Task 10: Command — problem-list

**Files:**
- Create: `scripts/commands/problem-list.mjs`
- Modify: registry + dispatcher + package.json

- [ ] **Step 1: Implement command**

```js
// scripts/commands/problem-list.mjs
import fs from "node:fs/promises";
import path from "node:path";

async function readProblemDirs(rootDir) {
  const entries = [];
  const projectsDir = path.join(rootDir, "projects");
  try {
    const projects = await fs.readdir(projectsDir);
    for (const project of projects) {
      const problemsDir = path.join(projectsDir, project, "problems");
      const exists = await fs.stat(problemsDir).then(() => true).catch(() => false);
      if (!exists) continue;
      const slugs = await fs.readdir(problemsDir);
      for (const slug of slugs) entries.push({ project, slug, dir: path.join(problemsDir, slug) });
    }
  } catch { /* no projects yet */ }

  const standaloneRoot = path.join(rootDir, "state", "standalone-problems");
  try {
    const slugs = await fs.readdir(standaloneRoot);
    for (const slug of slugs) entries.push({ project: null, slug, dir: path.join(standaloneRoot, slug) });
  } catch { /* none */ }

  return entries;
}

async function loadProblemJson(dir) {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, "problem.json"), "utf8"));
  } catch {
    return null;
  }
}

function parseArgs(rawArgs) {
  const opts = { project: null, status: "active" };
  for (let i = 0; i < rawArgs.length; i += 1) {
    const a = rawArgs[i];
    if (a === "--project") { opts.project = rawArgs[++i]; continue; }
    if (a === "--status") { opts.status = rawArgs[++i]; continue; }
  }
  return opts;
}

export async function runProblemList({ rawArgs, rootDir }) {
  const { project, status } = parseArgs(rawArgs ?? []);
  const all = await readProblemDirs(rootDir);
  const rows = [];
  for (const entry of all) {
    if (project && entry.project !== project) continue;
    const json = await loadProblemJson(entry.dir);
    if (!json) continue;
    if (status !== "all" && json.status !== status) continue;
    rows.push({
      project: json.project ?? "(standalone)",
      slug: json.slug,
      status: json.status,
      title: json.title,
      latest: json.latest_landscape ?? "-",
      last_result: json.last_explore_result ?? "-"
    });
  }

  if (rows.length === 0) {
    console.log("(no problems match)");
    return;
  }

  console.log(`${"project".padEnd(20)} ${"slug".padEnd(26)} ${"status".padEnd(9)} ${"latest".padEnd(34)} title`);
  for (const r of rows) {
    console.log(`${r.project.padEnd(20)} ${r.slug.padEnd(26)} ${r.status.padEnd(9)} ${r.latest.padEnd(34)} ${r.title}`);
  }
}
```

- [ ] **Step 2: Register handler + command entry + npm script**

Handler `runProblemList`, command `problem-list`, npm script `"problem:list": "node scripts/patternpilot.mjs problem-list"`.

- [ ] **Step 3: Smoke test**

```bash
PATTERNPILOT_ROOT=/tmp/pp-smoke npm run problem:list
```

Expected: table with one row for `slow-lists`.

- [ ] **Step 4: Commit**

```bash
git add scripts/commands/problem-list.mjs scripts/patternpilot.mjs scripts/shared/command-registry.mjs package.json
git commit -m "feat(cli): add problem:list command"
```

---

### Task 11: Commands — problem-resolve, problem-archive

**Files:**
- Create: `scripts/commands/problem-resolve.mjs`
- Create: `scripts/commands/problem-archive.mjs`
- Modify: registry + dispatcher + package.json

- [ ] **Step 1: Implement problem-resolve**

```js
// scripts/commands/problem-resolve.mjs
import { resolveProblem } from "../../lib/problem/lifecycle.mjs";

function parseArgs(rawArgs) {
  const opts = { project: null, slug: null, note: null };
  let positional = 0;
  for (let i = 0; i < rawArgs.length; i += 1) {
    const a = rawArgs[i];
    if (a === "--project") { opts.project = rawArgs[++i]; continue; }
    if (a === "--note") { opts.note = rawArgs[++i]; continue; }
    if (a.startsWith("--")) continue;
    if (positional === 0) { opts.slug = a; positional += 1; }
  }
  return opts;
}

export async function runProblemResolve({ rawArgs, rootDir }) {
  const { project, slug, note } = parseArgs(rawArgs ?? []);
  if (!slug) {
    console.error("problem:resolve requires <slug>");
    process.exitCode = 2;
    return;
  }
  await resolveProblem({ rootDir, projectKey: project, slug, note });
  console.log(`Resolved ${slug}${note ? " with resolution.md" : ""}`);
}
```

- [ ] **Step 2: Implement problem-archive**

```js
// scripts/commands/problem-archive.mjs
import { archiveProblem } from "../../lib/problem/lifecycle.mjs";

function parseArgs(rawArgs) {
  const opts = { project: null, slug: null };
  let positional = 0;
  for (let i = 0; i < rawArgs.length; i += 1) {
    const a = rawArgs[i];
    if (a === "--project") { opts.project = rawArgs[++i]; continue; }
    if (a.startsWith("--")) continue;
    if (positional === 0) { opts.slug = a; positional += 1; }
  }
  return opts;
}

export async function runProblemArchive({ rawArgs, rootDir }) {
  const { project, slug } = parseArgs(rawArgs ?? []);
  if (!slug) {
    console.error("problem:archive requires <slug>");
    process.exitCode = 2;
    return;
  }
  await archiveProblem({ rootDir, projectKey: project, slug });
  console.log(`Archived ${slug}`);
}
```

- [ ] **Step 3: Register both handlers + command entries + npm scripts**

- `problem-resolve` → `runProblemResolve` → `"problem:resolve"`
- `problem-archive` → `runProblemArchive` → `"problem:archive"`

- [ ] **Step 4: Commit**

```bash
git add scripts/commands/problem-resolve.mjs scripts/commands/problem-archive.mjs scripts/patternpilot.mjs scripts/shared/command-registry.mjs package.json
git commit -m "feat(cli): add problem:resolve and problem:archive commands"
```

---

## Phase 3 — Clustering Engine (heuristic)

### Task 12: Synonym seed map

**Files:**
- Create: `lib/clustering/synonyms.json`

- [ ] **Step 1: Write seed content**

```json
{
  "virtualization": ["virtualisation", "windowing"],
  "pagination": ["paging"],
  "infinite-scroll": ["infinite-scrolling", "endless-scroll"],
  "fuzzy-match": ["approximate-match", "fuzzy-matching"],
  "hydration": ["hydrate"],
  "memoization": ["memoisation", "memoize"],
  "debounce": ["debouncing"],
  "throttle": ["throttling"],
  "lazy-load": ["lazy-loading", "deferred-load"],
  "server-side-rendering": ["ssr"],
  "client-side-rendering": ["csr"],
  "dedupe": ["deduplication", "deduplicate"],
  "rate-limit": ["rate-limiting", "throttling"]
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/clustering/synonyms.json
git commit -m "feat(clustering): seed synonym map"
```

---

### Task 13: Keyword extraction

**Files:**
- Create: `lib/clustering/keywords.mjs`
- Create: `test/clustering-keywords.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/clustering-keywords.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { extractRepoKeywords, normalizeKeyword } from "../lib/clustering/keywords.mjs";

test("extractRepoKeywords pulls from topics, readme headings, dependencies", () => {
  const repo = {
    topics: ["Virtualization", "react"],
    readme: "# Fast Lists\n## Windowing Under the Hood\nSome prose about virtualized tables.",
    dependencies: ["react-window", "react"]
  };
  const kw = extractRepoKeywords(repo);
  assert.ok(kw.has("virtualization"));
  assert.ok(kw.has("react"));
  assert.ok(kw.has("windowing"));
  assert.ok(kw.has("react-window"));
});

test("normalizeKeyword applies synonym map", () => {
  assert.equal(normalizeKeyword("virtualisation"), "virtualization");
  assert.equal(normalizeKeyword("Windowing"), "virtualization");
  assert.equal(normalizeKeyword("react-window"), "react-window");
});

test("extractRepoKeywords filters stopwords and short tokens", () => {
  const repo = { topics: [], readme: "# A and to be", dependencies: [] };
  const kw = extractRepoKeywords(repo);
  assert.equal(kw.size, 0);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/clustering-keywords.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/clustering/keywords.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNONYMS_RAW = JSON.parse(fs.readFileSync(path.join(__dirname, "synonyms.json"), "utf8"));

const SYNONYM_INDEX = new Map();
for (const [canonical, aliases] of Object.entries(SYNONYMS_RAW)) {
  SYNONYM_INDEX.set(canonical.toLowerCase(), canonical);
  for (const alias of aliases) SYNONYM_INDEX.set(alias.toLowerCase(), canonical);
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "be", "to", "of", "in", "on", "for",
  "with", "and", "or", "it", "that", "this", "as", "at", "by", "from",
  "some", "prose", "about", "under", "over", "fast"
]);

export function normalizeKeyword(token) {
  const lower = token.toLowerCase().trim();
  return SYNONYM_INDEX.get(lower) ?? lower;
}

function tokenize(text) {
  if (!text) return [];
  return text
    .split(/[^a-z0-9-]+/i)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function readmeHeadings(readme) {
  if (!readme) return [];
  const tokens = [];
  for (const line of readme.split("\n")) {
    const h = line.match(/^#{1,2}\s+(.+)$/);
    if (h) tokens.push(...tokenize(h[1]));
  }
  return tokens;
}

function readmeLeadingNouns(readme) {
  if (!readme) return [];
  const firstParagraph = readme.split("\n\n")[1] ?? "";
  return tokenize(firstParagraph).slice(0, 20);
}

export function extractRepoKeywords(repo) {
  const tokens = new Set();
  for (const topic of repo.topics ?? []) tokens.add(normalizeKeyword(topic));
  for (const dep of repo.dependencies ?? []) tokens.add(normalizeKeyword(dep));
  for (const t of readmeHeadings(repo.readme)) tokens.add(normalizeKeyword(t));
  for (const t of readmeLeadingNouns(repo.readme)) tokens.add(normalizeKeyword(t));
  return tokens;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/clustering-keywords.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clustering/keywords.mjs test/clustering-keywords.test.mjs
git commit -m "feat(clustering): add keyword extraction with synonym normalization"
```

---

### Task 14: Stage 1 clustering (structural)

**Files:**
- Create: `lib/clustering/stage1-structural.mjs`
- Create: `test/clustering-stage1.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/clustering-stage1.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { clusterByStructure } from "../lib/clustering/stage1-structural.mjs";

test("clusterByStructure groups repos sharing (pattern_family, main_layer)", () => {
  const repos = [
    { id: "a", pattern_family: "virtualization", main_layer: "ui_discovery_surface" },
    { id: "b", pattern_family: "virtualization", main_layer: "ui_discovery_surface" },
    { id: "c", pattern_family: "pagination", main_layer: "export_feed_api" },
    { id: "d", pattern_family: "pagination", main_layer: "export_feed_api" }
  ];
  const { clusters } = clusterByStructure(repos);
  assert.equal(clusters.length, 2);
  const ids = clusters.map((c) => c.members.map((m) => m.id).sort()).sort();
  assert.deepEqual(ids, [["a", "b"], ["c", "d"]]);
});

test("clusterByStructure puts singletons into outliers bucket", () => {
  const repos = [
    { id: "a", pattern_family: "x", main_layer: "y" },
    { id: "b", pattern_family: "x", main_layer: "y" },
    { id: "c", pattern_family: "unique", main_layer: "y" }
  ];
  const { clusters, outliers } = clusterByStructure(repos);
  assert.equal(clusters.length, 1);
  assert.equal(outliers.length, 1);
  assert.equal(outliers[0].id, "c");
});

test("clusterByStructure marks clusters with suggested pattern_family", () => {
  const repos = [
    { id: "a", pattern_family: "x", main_layer: "y", pattern_family_source: "suggested" },
    { id: "b", pattern_family: "x", main_layer: "y" }
  ];
  const { clusters } = clusterByStructure(repos);
  assert.equal(clusters[0].has_suggested_members, true);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/clustering-stage1.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/clustering/stage1-structural.mjs
function keyOf(repo) {
  return `${repo.pattern_family ?? "unknown"}|${repo.main_layer ?? "unknown"}`;
}

export function clusterByStructure(repos) {
  const groups = new Map();
  for (const repo of repos) {
    const k = keyOf(repo);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(repo);
  }

  const clusters = [];
  const outliers = [];
  for (const [key, members] of groups.entries()) {
    if (members.length < 2) {
      outliers.push(...members);
      continue;
    }
    const [pattern_family, main_layer] = key.split("|");
    clusters.push({
      key,
      stage: "structural",
      pattern_family,
      main_layer,
      members,
      has_suggested_members: members.some((m) => m.pattern_family_source === "suggested")
    });
  }
  return { clusters, outliers };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/clustering-stage1.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clustering/stage1-structural.mjs test/clustering-stage1.test.mjs
git commit -m "feat(clustering): add structural (pattern_family, main_layer) clustering"
```

---

### Task 15: Stage 2 clustering (keyword)

**Files:**
- Create: `lib/clustering/stage2-keyword.mjs`
- Create: `test/clustering-stage2.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/clustering-stage2.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { clusterByKeywords } from "../lib/clustering/stage2-keyword.mjs";

test("clusterByKeywords groups repos with Jaccard >= threshold via single-link", () => {
  const repos = [
    { id: "a", keywords: new Set(["virtualization", "windowing", "react"]) },
    { id: "b", keywords: new Set(["virtualization", "windowing", "vue"]) },
    { id: "c", keywords: new Set(["pagination", "ssr"]) }
  ];
  const clusters = clusterByKeywords(repos, { threshold: 0.3 });
  const groups = clusters.map((c) => c.members.map((m) => m.id).sort()).sort();
  assert.deepEqual(groups, [["a", "b"], ["c"]]);
});

test("clusterByKeywords singletons remain their own cluster", () => {
  const repos = [
    { id: "a", keywords: new Set(["x", "y"]) },
    { id: "b", keywords: new Set(["z"]) }
  ];
  const clusters = clusterByKeywords(repos, { threshold: 0.5 });
  assert.equal(clusters.length, 2);
});

test("clusterByKeywords chains via single-link transitivity", () => {
  const repos = [
    { id: "a", keywords: new Set(["x", "y"]) },
    { id: "b", keywords: new Set(["y", "z"]) },
    { id: "c", keywords: new Set(["z", "w"]) }
  ];
  const clusters = clusterByKeywords(repos, { threshold: 0.3 });
  // a-b share y (Jaccard 1/3), b-c share z (Jaccard 1/3); transitively same cluster
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].members.length, 3);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/clustering-stage2.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/clustering/stage2-keyword.mjs
function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 0;
  let intersect = 0;
  for (const x of a) if (b.has(x)) intersect += 1;
  const union = a.size + b.size - intersect;
  return union === 0 ? 0 : intersect / union;
}

class DSU {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x) {
    while (this.parent[x] !== x) { this.parent[x] = this.parent[this.parent[x]]; x = this.parent[x]; }
    return x;
  }
  union(a, b) {
    const ra = this.find(a); const rb = this.find(b);
    if (ra !== rb) this.parent[ra] = rb;
  }
}

export function clusterByKeywords(repos, { threshold = 0.35 } = {}) {
  const dsu = new DSU(repos.length);
  for (let i = 0; i < repos.length; i += 1) {
    for (let j = i + 1; j < repos.length; j += 1) {
      if (jaccard(repos[i].keywords, repos[j].keywords) >= threshold) {
        dsu.union(i, j);
      }
    }
  }

  const groups = new Map();
  for (let i = 0; i < repos.length; i += 1) {
    const root = dsu.find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(repos[i]);
  }

  return [...groups.values()].map((members, idx) => ({
    key: `keyword-${idx}`,
    stage: "keyword",
    members
  }));
}

export { jaccard };
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/clustering-stage2.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/clustering/stage2-keyword.mjs test/clustering-stage2.test.mjs
git commit -m "feat(clustering): add agglomerative single-link Jaccard clustering"
```

---

### Task 16: Stage 3 clustering (user-declared axes)

**Files:**
- Create: `lib/clustering/stage3-axes.mjs`
- Create: `test/clustering-stage3.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/clustering-stage3.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { mapToAxes } from "../lib/clustering/stage3-axes.mjs";

test("mapToAxes assigns each repo to nearest axis by keyword overlap", () => {
  const axes = ["client-side virtualization", "server-side pagination", "lazy hydration"];
  const repos = [
    { id: "a", keywords: new Set(["virtualization", "client"]) },
    { id: "b", keywords: new Set(["pagination", "server"]) },
    { id: "c", keywords: new Set(["hydration", "lazy"]) }
  ];
  const result = mapToAxes(repos, axes);
  assert.equal(result.axes[0].members.map((m) => m.id).join(","), "a");
  assert.equal(result.axes[1].members.map((m) => m.id).join(","), "b");
  assert.equal(result.axes[2].members.map((m) => m.id).join(","), "c");
});

test("mapToAxes marks axes with no matches as axis_not_found_in_landscape", () => {
  const axes = ["known", "unknown"];
  const repos = [{ id: "a", keywords: new Set(["known"]) }];
  const result = mapToAxes(repos, axes);
  assert.equal(result.axes[0].members.length, 1);
  assert.equal(result.axes[1].members.length, 0);
  assert.equal(result.axes[1].status, "axis_not_found_in_landscape");
});

test("mapToAxes puts zero-overlap repos in unmatched bucket", () => {
  const axes = ["x", "y"];
  const repos = [{ id: "a", keywords: new Set(["z"]) }];
  const result = mapToAxes(repos, axes);
  assert.equal(result.unmatched.length, 1);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/clustering-stage3.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/clustering/stage3-axes.mjs
import { normalizeKeyword } from "./keywords.mjs";

function tokenizeAxis(axis) {
  return new Set(
    axis.toLowerCase().split(/[^a-z0-9-]+/).filter((t) => t.length >= 3).map(normalizeKeyword)
  );
}

function overlapCount(a, b) {
  let n = 0;
  for (const x of a) if (b.has(x)) n += 1;
  return n;
}

export function mapToAxes(repos, axisDefinitions) {
  const axes = axisDefinitions.map((label) => ({ label, tokens: tokenizeAxis(label), members: [] }));
  const unmatched = [];

  for (const repo of repos) {
    let best = null;
    let bestOverlap = 0;
    for (const axis of axes) {
      const n = overlapCount(repo.keywords, axis.tokens);
      if (n > bestOverlap) { bestOverlap = n; best = axis; }
    }
    if (best) best.members.push(repo); else unmatched.push(repo);
  }

  return {
    axes: axes.map((a) => ({
      label: a.label,
      members: a.members,
      status: a.members.length === 0 ? "axis_not_found_in_landscape" : "ok"
    })),
    unmatched
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/clustering-stage3.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clustering/stage3-axes.mjs test/clustering-stage3.test.mjs
git commit -m "feat(clustering): add user-declared axis mapping (stage 3)"
```

---

### Task 17: Cluster labels

**Files:**
- Create: `lib/clustering/labels.mjs`
- Create: `test/clustering-labels.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/clustering-labels.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildClusterLabel } from "../lib/clustering/labels.mjs";

test("buildClusterLabel picks top-3 keywords sorted alphabetically", () => {
  const cluster = {
    members: [
      { keywords: new Set(["virtualization", "windowing", "react"]) },
      { keywords: new Set(["virtualization", "windowing"]) },
      { keywords: new Set(["virtualization"]) }
    ]
  };
  assert.equal(buildClusterLabel(cluster), "react+virtualization+windowing");
});

test("buildClusterLabel handles cluster with single keyword", () => {
  const cluster = { members: [{ keywords: new Set(["x"]) }] };
  assert.equal(buildClusterLabel(cluster), "x");
});

test("buildClusterLabel returns 'unlabeled' for empty keywords", () => {
  const cluster = { members: [{ keywords: new Set() }] };
  assert.equal(buildClusterLabel(cluster), "unlabeled");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/clustering-labels.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/clustering/labels.mjs
export function buildClusterLabel(cluster, { topN = 3 } = {}) {
  const frequency = new Map();
  for (const member of cluster.members) {
    for (const token of member.keywords ?? []) {
      frequency.set(token, (frequency.get(token) ?? 0) + 1);
    }
  }
  if (frequency.size === 0) return "unlabeled";

  const sorted = [...frequency.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, topN)
    .map(([token]) => token)
    .sort();

  return sorted.join("+");
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/clustering-labels.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clustering/labels.mjs test/clustering-labels.test.mjs
git commit -m "feat(clustering): add deterministic cluster labeling"
```

---

### Task 18: Anti-tunnel markings

**Files:**
- Create: `lib/clustering/anti-tunnel.mjs`
- Create: `test/clustering-anti-tunnel.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/clustering-anti-tunnel.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { markRelation } from "../lib/clustering/anti-tunnel.mjs";

test("markRelation returns near_current_approach when >=66% of signature tokens present", () => {
  const cluster = { members: [{ keywords: new Set(["a", "b", "c"]) }, { keywords: new Set(["a", "d"]) }] };
  const signature = ["a", "b", "x"];
  // cluster has a, b (2 of 3 signature tokens in cluster keyword pool)
  assert.equal(markRelation(cluster, signature), "near_current_approach");
});

test("markRelation returns adjacent with one overlap only", () => {
  const cluster = { members: [{ keywords: new Set(["a", "x"]) }] };
  const signature = ["a", "b", "c"];
  assert.equal(markRelation(cluster, signature), "adjacent");
});

test("markRelation returns divergent with zero overlap", () => {
  const cluster = { members: [{ keywords: new Set(["z"]) }] };
  const signature = ["a", "b", "c"];
  assert.equal(markRelation(cluster, signature), "divergent");
});

test("markRelation returns divergent for empty signature", () => {
  const cluster = { members: [{ keywords: new Set(["z"]) }] };
  assert.equal(markRelation(cluster, []), "divergent");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/clustering-anti-tunnel.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/clustering/anti-tunnel.mjs
export function markRelation(cluster, signature) {
  if (!signature || signature.length === 0) return "divergent";
  const pool = new Set();
  for (const member of cluster.members ?? []) {
    for (const kw of member.keywords ?? []) pool.add(kw);
  }
  let overlap = 0;
  for (const token of signature) if (pool.has(token)) overlap += 1;

  const ratio = overlap / signature.length;
  if (ratio >= 2 / 3) return "near_current_approach";
  if (overlap >= 1) return "adjacent";
  return "divergent";
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/clustering-anti-tunnel.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clustering/anti-tunnel.mjs test/clustering-anti-tunnel.test.mjs
git commit -m "feat(clustering): add anti-tunnel relation marker"
```

---

### Task 19: Signature contrast

**Files:**
- Create: `lib/clustering/contrast.mjs`
- Create: `test/clustering-contrast.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/clustering-contrast.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildSignatureContrast } from "../lib/clustering/contrast.mjs";

test("buildSignatureContrast returns tokens overrepresented in this cluster", () => {
  const target = { id: "virt", members: [{ keywords: new Set(["virtualization", "windowing"]) }, { keywords: new Set(["virtualization", "recycling"]) }] };
  const others = [
    { id: "pag", members: [{ keywords: new Set(["pagination", "ssr"]) }, { keywords: new Set(["pagination"]) }] }
  ];
  const contrast = buildSignatureContrast(target, others, { topN: 3 });
  assert.ok(contrast.includes("virtualization"));
  assert.ok(!contrast.includes("pagination"));
});

test("buildSignatureContrast returns empty array when no contrast possible", () => {
  const target = { id: "t", members: [{ keywords: new Set() }] };
  const others = [{ id: "o", members: [{ keywords: new Set() }] }];
  assert.deepEqual(buildSignatureContrast(target, others), []);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/clustering-contrast.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/clustering/contrast.mjs
function countTokens(clusters) {
  const counts = new Map();
  let memberTotal = 0;
  for (const cluster of clusters) {
    for (const member of cluster.members ?? []) {
      memberTotal += 1;
      for (const token of member.keywords ?? []) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }
  return { counts, memberTotal };
}

export function buildSignatureContrast(target, others, { topN = 3 } = {}) {
  const { counts: targetCounts, memberTotal: targetTotal } = countTokens([target]);
  const { counts: otherCounts, memberTotal: otherTotal } = countTokens(others);

  if (targetTotal === 0) return [];

  const scores = [];
  for (const [token, tCount] of targetCounts.entries()) {
    const targetFreq = tCount / targetTotal;
    const otherFreq = otherTotal === 0 ? 0 : (otherCounts.get(token) ?? 0) / otherTotal;
    const delta = targetFreq - otherFreq;
    if (delta > 0) scores.push([token, delta]);
  }

  scores.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  return scores.slice(0, topN).map(([token]) => token);
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/clustering-contrast.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/clustering/contrast.mjs test/clustering-contrast.test.mjs
git commit -m "feat(clustering): add signature-contrast keyword discrimination"
```

---

### Task 20: Landscape orchestrator

**Files:**
- Create: `lib/clustering/landscape.mjs`
- Create: `test/clustering-landscape.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/clustering-landscape.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildLandscape } from "../lib/clustering/landscape.mjs";

function makeRepos() {
  return [
    { id: "r1", pattern_family: "virt", main_layer: "ui", keywords: new Set(["virtualization", "react"]) },
    { id: "r2", pattern_family: "virt", main_layer: "ui", keywords: new Set(["virtualization", "windowing"]) },
    { id: "r3", pattern_family: "pag", main_layer: "api", keywords: new Set(["pagination", "ssr"]) },
    { id: "r4", pattern_family: "pag", main_layer: "api", keywords: new Set(["pagination", "server"]) }
  ];
}

test("buildLandscape returns stage1 clusters with labels, relation, contrast", () => {
  const problem = { approach_signature: ["virtualization", "react"], suspected_approach_axes: [] };
  const ls = buildLandscape({ repos: makeRepos(), problem });

  assert.equal(ls.clusters.length, 2);
  const virt = ls.clusters.find((c) => c.pattern_family === "virt");
  assert.ok(virt.label.length > 0);
  assert.equal(virt.relation, "near_current_approach");
  assert.ok(virt.signature_contrast.includes("virtualization"));

  const pag = ls.clusters.find((c) => c.pattern_family === "pag");
  assert.equal(pag.relation, "divergent");
});

test("buildLandscape flags single_cluster_collapse when only one cluster forms", () => {
  const repos = [
    { id: "a", pattern_family: "x", main_layer: "y", keywords: new Set(["a"]) },
    { id: "b", pattern_family: "x", main_layer: "y", keywords: new Set(["a"]) }
  ];
  const ls = buildLandscape({ repos, problem: { approach_signature: [], suspected_approach_axes: [] } });
  assert.equal(ls.landscape_signal, "single_cluster_collapse");
});

test("buildLandscape attaches axis view when suspected_approach_axes given", () => {
  const problem = { approach_signature: [], suspected_approach_axes: ["virtualization", "pagination"] };
  const ls = buildLandscape({ repos: makeRepos(), problem });
  assert.ok(ls.axis_view);
  assert.equal(ls.axis_view.axes.length, 2);
});

test("buildLandscape collects suggested-pattern-family clusters under has_suggested_members", () => {
  const repos = [
    { id: "a", pattern_family: "x", pattern_family_source: "suggested", main_layer: "y", keywords: new Set() },
    { id: "b", pattern_family: "x", main_layer: "y", keywords: new Set() }
  ];
  const ls = buildLandscape({ repos, problem: { approach_signature: [], suspected_approach_axes: [] } });
  assert.equal(ls.clusters[0].has_suggested_members, true);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/clustering-landscape.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/clustering/landscape.mjs
import { clusterByStructure } from "./stage1-structural.mjs";
import { clusterByKeywords } from "./stage2-keyword.mjs";
import { mapToAxes } from "./stage3-axes.mjs";
import { buildClusterLabel } from "./labels.mjs";
import { markRelation } from "./anti-tunnel.mjs";
import { buildSignatureContrast } from "./contrast.mjs";

function summarizeRelations(clusters) {
  const counts = { near_current_approach: 0, adjacent: 0, divergent: 0 };
  for (const c of clusters) counts[c.relation] += 1;
  return counts;
}

export function buildLandscape({ repos, problem, stage2Threshold = 0.35, stage2MinClusterSize = 4 }) {
  const { clusters: structuralClusters, outliers } = clusterByStructure(repos);
  const enrichedClusters = [];

  for (const cluster of structuralClusters) {
    let subClusters = null;
    if (cluster.members.length >= stage2MinClusterSize) {
      const withKeywords = cluster.members.map((r) => ({ ...r, keywords: r.keywords ?? new Set() }));
      subClusters = clusterByKeywords(withKeywords, { threshold: stage2Threshold });
    }
    enrichedClusters.push({ ...cluster, sub_clusters: subClusters });
  }

  for (const cluster of enrichedClusters) {
    cluster.label = buildClusterLabel(cluster);
    cluster.relation = markRelation(cluster, problem.approach_signature ?? []);
    const others = enrichedClusters.filter((c) => c !== cluster);
    cluster.signature_contrast = buildSignatureContrast(cluster, others);
  }

  const clustersWithMultipleMembers = enrichedClusters.filter((c) => c.members.length >= 2);
  const landscape_signal = clustersWithMultipleMembers.length < 2 ? "single_cluster_collapse" : "ok";

  const suspectedAxes = problem.suspected_approach_axes ?? [];
  let axis_view = null;
  if (suspectedAxes.length > 0) {
    const flatMembers = enrichedClusters.flatMap((c) => c.members);
    axis_view = mapToAxes(flatMembers, suspectedAxes);
  }

  return {
    clusters: enrichedClusters,
    outliers,
    relation_counts: summarizeRelations(enrichedClusters),
    landscape_signal,
    axis_view
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/clustering-landscape.test.mjs`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/clustering/landscape.mjs test/clustering-landscape.test.mjs
git commit -m "feat(clustering): add landscape orchestrator combining stages 1-3"
```

---

## Phase 4 — Discovery Integration

### Task 21: Problem queries (additive query families)

**Files:**
- Create: `lib/discovery/problem-queries.mjs`
- Create: `test/problem-queries.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-queries.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildProblemQueryFamily, splitBudget } from "../lib/discovery/problem-queries.mjs";

test("buildProblemQueryFamily produces one query per seed", () => {
  const queries = buildProblemQueryFamily({ seeds: ["virtualization", "windowing"], budget: 10 });
  assert.equal(queries.length, 2);
  assert.deepEqual(queries, ["virtualization", "windowing"]);
});

test("buildProblemQueryFamily respects budget", () => {
  const queries = buildProblemQueryFamily({ seeds: ["a", "b", "c", "d"], budget: 2 });
  assert.equal(queries.length, 2);
});

test("buildProblemQueryFamily returns empty with reason when seeds empty", () => {
  const queries = buildProblemQueryFamily({ seeds: [], budget: 10 });
  assert.deepEqual(queries, []);
});

test("splitBudget returns 40/40/20 for project-bound problem", () => {
  const split = splitBudget({ totalBudget: 10, standalone: false });
  assert.equal(split.project, 4);
  assert.equal(split.problem, 4);
  assert.equal(split.cross, 2);
});

test("splitBudget returns 0/100/0 for standalone problem", () => {
  const split = splitBudget({ totalBudget: 10, standalone: true });
  assert.equal(split.project, 0);
  assert.equal(split.problem, 10);
  assert.equal(split.cross, 0);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-queries.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/discovery/problem-queries.mjs
export function buildProblemQueryFamily({ seeds, budget }) {
  if (!Array.isArray(seeds) || seeds.length === 0) return [];
  return seeds.slice(0, budget);
}

export function buildCrossFamily({ projectSeeds, problemSeeds, budget }) {
  if (!projectSeeds?.length || !problemSeeds?.length) return [];
  const combos = [];
  for (const ps of projectSeeds) {
    for (const qs of problemSeeds) {
      combos.push(`${ps} ${qs}`);
      if (combos.length >= budget) return combos;
    }
  }
  return combos;
}

export function splitBudget({ totalBudget, standalone }) {
  if (standalone) return { project: 0, problem: totalBudget, cross: 0 };
  const project = Math.floor(totalBudget * 0.4);
  const cross = Math.floor(totalBudget * 0.2);
  const problem = totalBudget - project - cross;
  return { project, problem, cross };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-queries.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/problem-queries.mjs test/problem-queries.test.mjs
git commit -m "feat(discovery): add problem query family builder and budget split"
```

---

### Task 22: Problem ranking

**Files:**
- Create: `lib/discovery/problem-ranking.mjs`
- Create: `test/problem-ranking.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-ranking.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { problemFit, combinedScore } from "../lib/discovery/problem-ranking.mjs";

test("problemFit returns Jaccard overlap between repo keywords and problem seeds", () => {
  const repo = { keywords: new Set(["virtualization", "windowing", "react"]) };
  const fit = problemFit(repo, ["virtualization", "react", "other"]);
  // intersection 2, union 4 → 0.5
  assert.ok(Math.abs(fit - 0.5) < 0.01);
});

test("problemFit returns 0 when no overlap", () => {
  const repo = { keywords: new Set(["a", "b"]) };
  assert.equal(problemFit(repo, ["x"]), 0);
});

test("combinedScore uses 0.5/0.5 for project-bound", () => {
  const s = combinedScore({ projectFit: 0.8, problemFit: 0.4, standalone: false });
  assert.ok(Math.abs(s - 0.6) < 0.01);
});

test("combinedScore uses 100% problemFit for standalone", () => {
  const s = combinedScore({ projectFit: 0.8, problemFit: 0.4, standalone: true });
  assert.equal(s, 0.4);
});

test("combinedScore accepts weight override", () => {
  const s = combinedScore({ projectFit: 1, problemFit: 0, standalone: false, weights: { project: 0.7, problem: 0.3 } });
  assert.equal(s, 0.7);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-ranking.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/discovery/problem-ranking.mjs
export function problemFit(repo, problemTokens) {
  const tokens = new Set(problemTokens ?? []);
  if (tokens.size === 0) return 0;
  const repoKeywords = repo.keywords ?? new Set();
  if (repoKeywords.size === 0) return 0;
  let intersect = 0;
  for (const t of tokens) if (repoKeywords.has(t)) intersect += 1;
  const union = new Set([...tokens, ...repoKeywords]).size;
  return union === 0 ? 0 : intersect / union;
}

export function combinedScore({ projectFit = 0, problemFit = 0, standalone = false, weights }) {
  if (standalone) return problemFit;
  const w = weights ?? { project: 0.5, problem: 0.5 };
  return projectFit * w.project + problemFit * w.problem;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-ranking.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/problem-ranking.mjs test/problem-ranking.test.mjs
git commit -m "feat(discovery): add problem_fit and combinedScore helpers"
```

---

### Task 23: Problem constraints

**Files:**
- Create: `lib/discovery/problem-constraints.mjs`
- Create: `test/problem-constraints.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-constraints.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { applyHardConstraints, applySoftBoost } from "../lib/discovery/problem-constraints.mjs";

test("applyHardConstraints rejects repo with incompatible license", () => {
  const repo = { id: "r", license: "GPL-3.0", keywords: new Set() };
  const kept = applyHardConstraints([repo], ["license:apache-compatible"]);
  assert.equal(kept.length, 0);
});

test("applyHardConstraints keeps repo with unknown license but marks it", () => {
  const repo = { id: "r", license: null, keywords: new Set() };
  const kept = applyHardConstraints([repo], ["license:apache-compatible"]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].constraint_warnings?.includes("license_unknown"), true);
});

test("applyHardConstraints keeps repo with compatible license", () => {
  const repo = { id: "r", license: "Apache-2.0", keywords: new Set() };
  const kept = applyHardConstraints([repo], ["license:apache-compatible"]);
  assert.equal(kept.length, 1);
});

test("applySoftBoost adds score bonus per matching tech_tag", () => {
  const repo = { id: "r", keywords: new Set(["nextjs", "react"]), score: 0.5 };
  const boosted = applySoftBoost(repo, ["nextjs", "tailwind"], 0.05);
  assert.ok(Math.abs(boosted.score - 0.55) < 0.001);
});

test("applySoftBoost leaves score unchanged when no match", () => {
  const repo = { id: "r", keywords: new Set(["vue"]), score: 0.5 };
  const boosted = applySoftBoost(repo, ["nextjs"], 0.05);
  assert.equal(boosted.score, 0.5);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-constraints.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/discovery/problem-constraints.mjs
const LICENSE_COMPAT = {
  "license:apache-compatible": new Set([
    "APACHE-2.0", "MIT", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "ISC", "CC0-1.0"
  ])
};

function licenseIncompatible(repoLicense, tag) {
  const set = LICENSE_COMPAT[tag];
  if (!set) return false;
  return !set.has((repoLicense ?? "").toUpperCase());
}

export function applyHardConstraints(repos, constraintTags) {
  const kept = [];
  for (const repo of repos) {
    let reject = false;
    const warnings = [];
    for (const tag of constraintTags ?? []) {
      if (tag.startsWith("license:")) {
        if (!repo.license) { warnings.push("license_unknown"); continue; }
        if (licenseIncompatible(repo.license, tag)) { reject = true; break; }
      }
    }
    if (reject) continue;
    kept.push(warnings.length > 0 ? { ...repo, constraint_warnings: warnings } : repo);
  }
  return kept;
}

export function applySoftBoost(repo, techTags, bonusPerMatch = 0.05) {
  const keywords = repo.keywords ?? new Set();
  let boost = 0;
  for (const tag of techTags ?? []) if (keywords.has(tag)) boost += bonusPerMatch;
  return { ...repo, score: (repo.score ?? 0) + boost };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-constraints.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/problem-constraints.mjs test/problem-constraints.test.mjs
git commit -m "feat(discovery): add hard/soft constraint application for problems"
```

---

### Task 24: Problem diversity selection

**Files:**
- Create: `lib/discovery/problem-diversity.mjs`
- Create: `test/problem-diversity.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/problem-diversity.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { selectWithDiversity } from "../lib/discovery/problem-diversity.mjs";

function repo(id, score, keywordList) {
  return { id, score, problemFit: score, keywords: new Set(keywordList) };
}

test("selectWithDiversity fills first half by score, second half by divergence", () => {
  const repos = [
    repo("a", 0.9, ["virt", "react"]),
    repo("b", 0.85, ["virt", "windowing"]),
    repo("c", 0.6, ["pagination", "ssr"]),
    repo("d", 0.5, ["hydration"])
  ];
  const signature = ["virt"];
  const result = selectWithDiversity({
    repos, signature, windowSize: 4, divergenceThreshold: 0.3, minProblemFit: 0.4
  });
  assert.equal(result.selected.length, 4);
  assert.ok(result.selected.some((r) => r.id === "c"));
  assert.ok(result.selected.some((r) => r.id === "d"));
  assert.equal(result.selectedByScore, 2);
  assert.equal(result.selectedByDivergence, 2);
});

test("selectWithDiversity marks diversity_gap when no divergent repos meet minFit", () => {
  const repos = [
    repo("a", 0.9, ["virt"]),
    repo("b", 0.85, ["virt"]),
    repo("c", 0.2, ["pagination"])
  ];
  const signature = ["virt"];
  const result = selectWithDiversity({
    repos, signature, windowSize: 4, divergenceThreshold: 0.3, minProblemFit: 0.4
  });
  assert.equal(result.diversity_gap, "no_divergent_candidates_met_threshold");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-diversity.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/discovery/problem-diversity.mjs
import { jaccard } from "../clustering/stage2-keyword.mjs";

function isDivergent(repo, signature, threshold) {
  const sigSet = new Set(signature);
  return jaccard(repo.keywords ?? new Set(), sigSet) < threshold;
}

export function selectWithDiversity({ repos, signature, windowSize, divergenceThreshold, minProblemFit }) {
  const sorted = [...repos].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const half = Math.floor(windowSize / 2);
  const topHalf = sorted.slice(0, half);

  const remaining = sorted.slice(half);
  const divergent = remaining.filter(
    (r) => (r.problemFit ?? 0) >= minProblemFit && isDivergent(r, signature ?? [], divergenceThreshold)
  );

  const selectedByScore = topHalf.length;
  let selectedByDivergence = 0;
  const divergentSelection = [];
  for (const r of divergent) {
    divergentSelection.push(r);
    selectedByDivergence += 1;
    if (selectedByDivergence >= windowSize - half) break;
  }

  let diversity_gap = null;
  if (selectedByDivergence === 0) {
    diversity_gap = "no_divergent_candidates_met_threshold";
  }

  const filler = [];
  if (selectedByDivergence < windowSize - half) {
    const used = new Set([...topHalf.map((r) => r.id), ...divergentSelection.map((r) => r.id)]);
    for (const r of remaining) {
      if (used.has(r.id)) continue;
      filler.push(r);
      if (topHalf.length + divergentSelection.length + filler.length >= windowSize) break;
    }
  }

  return {
    selected: [...topHalf, ...divergentSelection, ...filler],
    selectedByScore,
    selectedByDivergence,
    diversity_gap
  };
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-diversity.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/discovery/problem-diversity.mjs test/problem-diversity.test.mjs
git commit -m "feat(discovery): add diversity selection rule with problem_fit gate"
```

---

## Phase 5 — problem:explore Chain

### Task 25: problem-explore command (heuristic only, no HTML yet)

**Files:**
- Create: `scripts/commands/problem-explore.mjs`
- Modify: registry + dispatcher + package.json

This task wires the pieces from Phases 1–4 into the full chain but produces only `landscape.json` and an intake stub. HTML report and heuristic brief follow in Phase 6.

- [ ] **Step 1: Implement command (chain skeleton)**

```js
// scripts/commands/problem-explore.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { refreshProblemJson, readProblem, updateProblemPointer } from "../../lib/problem/store.mjs";
import { resolveLandscapeDir } from "../../lib/problem/paths.mjs";
import { buildLandscape } from "../../lib/clustering/landscape.mjs";
import { extractRepoKeywords } from "../../lib/clustering/keywords.mjs";

function parseArgs(rawArgs) {
  const opts = { project: null, slug: null, depth: "standard", skipDiscovery: false, withLlm: false };
  let positional = 0;
  for (let i = 0; i < rawArgs.length; i += 1) {
    const a = rawArgs[i];
    if (a === "--project") { opts.project = rawArgs[++i]; continue; }
    if (a === "--depth") { opts.depth = rawArgs[++i]; continue; }
    if (a === "--skip-discovery") { opts.skipDiscovery = true; continue; }
    if (a === "--with-llm") { opts.withLlm = true; continue; }
    if (a.startsWith("--")) continue;
    if (positional === 0) { opts.slug = a; positional += 1; }
  }
  return opts;
}

function createRunId() {
  const iso = new Date().toISOString().replace(/[:.]/g, "-");
  return iso;
}

async function loadCandidateRepos({ rootDir, projectKey, slug, skipDiscovery }) {
  // Placeholder hook: integrate with real discovery engine here.
  // For heuristic-only stub, read any intake dossiers already present in the project
  // and enrich them with keywords. Real discovery wiring lives in Task 26.
  if (skipDiscovery) return [];
  return [];
}

export async function runProblemExplore({ rawArgs, rootDir }) {
  const { project, slug, skipDiscovery } = parseArgs(rawArgs ?? []);
  if (!slug) {
    console.error("problem:explore requires <slug>");
    process.exitCode = 2;
    return;
  }

  await refreshProblemJson({ rootDir, projectKey: project, slug });
  const problem = await readProblem({ rootDir, projectKey: project, slug });

  const rawRepos = await loadCandidateRepos({ rootDir, projectKey: project, slug, skipDiscovery });

  if (rawRepos.length === 0) {
    await updateProblemPointer({
      rootDir, projectKey: project, slug,
      lastExploreResult: "no_candidates"
    });
    console.log("No candidates — landscape not written. Check query seeds.");
    return;
  }

  const reposWithKeywords = rawRepos.map((r) => ({ ...r, keywords: extractRepoKeywords(r) }));
  const landscape = buildLandscape({
    repos: reposWithKeywords,
    problem: {
      approach_signature: problem.derived.approach_signature,
      suspected_approach_axes: problem.fields.suspected_approach_axes ?? []
    }
  });

  const runId = createRunId();
  const landscapeDir = resolveLandscapeDir({ rootDir, projectKey: project, slug, runId });
  await fs.mkdir(landscapeDir, { recursive: true });

  const jsonOut = {
    run_id: runId,
    problem: slug,
    project: problem.project,
    generated_at: new Date().toISOString(),
    clusters: landscape.clusters.map((c) => ({
      key: c.key,
      label: c.label,
      pattern_family: c.pattern_family,
      main_layer: c.main_layer,
      relation: c.relation,
      signature_contrast: c.signature_contrast,
      has_suggested_members: c.has_suggested_members,
      member_ids: c.members.map((m) => m.id)
    })),
    outliers: landscape.outliers.map((r) => r.id),
    relation_counts: landscape.relation_counts,
    landscape_signal: landscape.landscape_signal,
    axis_view: landscape.axis_view
  };
  await fs.writeFile(path.join(landscapeDir, "landscape.json"), `${JSON.stringify(jsonOut, null, 2)}\n`);

  await updateProblemPointer({
    rootDir, projectKey: project, slug,
    latestLandscape: `landscape/${runId}`,
    lastExploreResult: "ok"
  });

  console.log(`Wrote landscape to ${landscapeDir}/landscape.json`);
}
```

- [ ] **Step 2: Register handler + command entry + npm script**

Handler `runProblemExplore`, command `problem-explore`, npm script `"problem:explore": "node scripts/patternpilot.mjs problem-explore"`.

- [ ] **Step 3: Commit**

```bash
git add scripts/commands/problem-explore.mjs scripts/patternpilot.mjs scripts/shared/command-registry.mjs package.json
git commit -m "feat(cli): add problem:explore chain skeleton with landscape.json output"
```

---

### Task 26: Wire problem-explore into existing discovery engine

**Files:**
- Modify: `scripts/commands/problem-explore.mjs`
- Modify: `scripts/commands/discovery.mjs` (expose `runDiscoverForProblem` if needed)

This task replaces the `loadCandidateRepos` placeholder with real integration. The exact surface depends on the current `runDiscover` function signature; study it before writing code.

- [ ] **Step 1: Read current discovery entry points**

Read `scripts/commands/discovery.mjs` fully. Identify:
- The function that runs a discovery pass given a project and query list
- The return shape (list of candidate repos)
- The function that writes candidates into an intake dossier

- [ ] **Step 2: Export a programmatic entry point**

If `runDiscover` only accepts CLI `rawArgs`, extract its core into a function like `runDiscoveryPass({ rootDir, projectKey, queries, depth })` returning `[{ url, owner, topics, readme, license, dependencies, ... }]`. Do NOT remove the existing CLI path — add a new exported helper beside it.

If a programmatic entry point already exists, note its name and skip the extraction.

- [ ] **Step 3: Replace `loadCandidateRepos` in problem-explore**

```js
// scripts/commands/problem-explore.mjs (replacement for loadCandidateRepos)
import { runDiscoveryPass } from "./discovery.mjs";
import { buildProblemQueryFamily, buildCrossFamily, splitBudget } from "../../lib/discovery/problem-queries.mjs";
import { applyHardConstraints, applySoftBoost } from "../../lib/discovery/problem-constraints.mjs";
import { problemFit, combinedScore } from "../../lib/discovery/problem-ranking.mjs";
import { selectWithDiversity } from "../../lib/discovery/problem-diversity.mjs";
import { extractRepoKeywords } from "../../lib/clustering/keywords.mjs";
import { resolveDiscoveryProfile } from "../../lib/constants.mjs";

async function loadCandidateRepos({ rootDir, projectKey, slug, skipDiscovery, depth, problem }) {
  if (skipDiscovery) return [];

  const profile = resolveDiscoveryProfile(depth);
  const totalBudget = profile.limit;
  const standalone = !projectKey;
  const split = splitBudget({ totalBudget, standalone });

  const problemQueries = buildProblemQueryFamily({
    seeds: problem.derived.query_seeds,
    budget: split.problem
  });

  // Project queries come from existing discovery engine; if standalone, skip.
  // Cross queries: combine top project seeds with top problem seeds if project-bound.
  const queries = [...problemQueries];
  // TODO: if project-bound, load project seeds via loadProjectProfile and compute cross queries here.

  if (queries.length === 0) {
    return { repos: [], note: "problem_query_family: empty(reason: no_seeds)" };
  }

  const rawRepos = await runDiscoveryPass({ rootDir, projectKey, queries, depth });

  const withKeywords = rawRepos.map((r) => ({ ...r, keywords: extractRepoKeywords(r) }));
  const filtered = applyHardConstraints(withKeywords, problem.derived.constraint_tags ?? []);
  const scored = filtered.map((r) => {
    const pf = problemFit(r, problem.derived.query_seeds);
    const boosted = applySoftBoost(r, problem.derived.tech_tags ?? []);
    boosted.problemFit = pf;
    boosted.score = combinedScore({ projectFit: r.projectFit ?? 0, problemFit: pf, standalone });
    return boosted;
  });

  const selection = selectWithDiversity({
    repos: scored,
    signature: problem.derived.approach_signature,
    windowSize: Math.min(20, totalBudget),
    divergenceThreshold: 0.3,
    minProblemFit: 0.4
  });

  return {
    repos: selection.selected,
    selectedByScore: selection.selectedByScore,
    selectedByDivergence: selection.selectedByDivergence,
    diversity_gap: selection.diversity_gap
  };
}
```

- [ ] **Step 4: Update the main handler to record selection metadata**

Replace the existing body after `rawRepos` with:

```js
  const discoveryResult = await loadCandidateRepos({
    rootDir, projectKey: project, slug, skipDiscovery, depth: parseArgs(rawArgs).depth, problem
  });
  const rawRepos = discoveryResult.repos ?? [];

  // ...existing landscape-build and json-write code...

  jsonOut.selection = {
    by_score: discoveryResult.selectedByScore ?? 0,
    by_divergence: discoveryResult.selectedByDivergence ?? 0,
    diversity_gap: discoveryResult.diversity_gap ?? null,
    note: discoveryResult.note ?? null
  };
```

- [ ] **Step 5: Smoke test against real project**

```bash
# Seed a project binding if none exists, then:
cd /home/domi/eventbaer/dev/patternpilot
npm run problem:create -- --project eventbear-worker --title "Long Event Lists performance"
# edit the generated problem.md with real hints
npm run problem:explore -- slow-event-lists --depth quick
ls projects/eventbear-worker/problems/slow-event-lists/landscape/
```

Expected: one landscape directory with `landscape.json`. Inspect the JSON for clusters, relation_counts, and `selection` metadata.

- [ ] **Step 6: Commit**

```bash
git add scripts/commands/problem-explore.mjs scripts/commands/discovery.mjs
git commit -m "feat(cli): wire problem:explore into real discovery engine with scoring and diversity"
```

---

## Phase 6 — Heuristic Brief + HTML Report

### Task 27: Heuristic brief

**Files:**
- Create: `lib/brief/heuristic.mjs`
- Create: `test/brief-heuristic.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/brief-heuristic.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildHeuristicBrief } from "../lib/brief/heuristic.mjs";

test("buildHeuristicBrief renders markdown with landscape signals and next step", () => {
  const problem = {
    slug: "x",
    title: "T",
    project: "app",
    fields: { description: "Long lists are slow.\n\nSecond paragraph." },
    derived: { constraint_tags: [] }
  };
  const landscape = {
    run_id: "2026-04-20T14-22-05Z",
    clusters: [
      {
        label: "virt+windowing", relation: "near_current_approach",
        signature_contrast: ["virtualization", "windowing"],
        member_ids: ["repo-a", "repo-b"],
        pattern_family: "virt"
      },
      {
        label: "pagination+ssr", relation: "divergent",
        signature_contrast: ["pagination"],
        member_ids: ["repo-c"],
        pattern_family: "pag"
      }
    ],
    relation_counts: { near_current_approach: 1, adjacent: 0, divergent: 1 },
    landscape_signal: "ok"
  };
  const markdown = buildHeuristicBrief({
    problem, landscape, topRepoByCluster: { "virt+windowing": "https://github.com/org/repo-a" }
  });
  assert.match(markdown, /Long lists are slow\./);
  assert.match(markdown, /near_current_approach/);
  assert.match(markdown, /virt\+windowing/);
  assert.match(markdown, /npm run intake/);
});

test("buildHeuristicBrief shortens description to 200 chars for the 1-sentence header", () => {
  const longText = "x".repeat(500);
  const brief = buildHeuristicBrief({
    problem: { slug: "x", title: "T", project: null, fields: { description: longText }, derived: { constraint_tags: [] } },
    landscape: { run_id: "r", clusters: [], relation_counts: { near_current_approach: 0, adjacent: 0, divergent: 0 }, landscape_signal: "ok" },
    topRepoByCluster: {}
  });
  const header = brief.split("## Problem (1 Satz)")[1].split("##")[0].trim();
  assert.ok(header.length <= 200);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/brief-heuristic.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/brief/heuristic.mjs
function oneSentence(description) {
  if (!description) return "";
  const firstLine = description.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine;
}

function tableRow(cluster, topRepoByCluster) {
  const kern = "needs_manual_read";
  const kontrast = (cluster.signature_contrast ?? []).join(", ") || "-";
  const beispiele = (cluster.member_ids ?? []).slice(0, 3).join(", ") || "-";
  const relation = cluster.relation ?? "-";
  const topRepo = topRepoByCluster[cluster.label] ?? "-";
  return `| ${cluster.label} | ${kern} | ${kontrast} | ${beispiele} | ${relation} |`;
}

function pickRecommendationSignals(clusters) {
  if (clusters.length === 0) {
    return { highest: null, cleanConstraint: null, divergent: null };
  }
  const highest = [...clusters].sort((a, b) => (b.member_ids?.length ?? 0) - (a.member_ids?.length ?? 0))[0];
  const cleanConstraint = clusters.find((c) => !c.has_constraint_violation) ?? highest;
  const divergent = clusters.find((c) => c.relation === "divergent") ?? null;
  return { highest, cleanConstraint, divergent };
}

export function buildHeuristicBrief({ problem, landscape, topRepoByCluster }) {
  const oneLiner = oneSentence(problem.fields?.description ?? "");
  const totalRepos = landscape.clusters.reduce((sum, c) => sum + (c.member_ids?.length ?? 0), 0);
  const rc = landscape.relation_counts;

  const signals = pickRecommendationSignals(landscape.clusters);
  const recommendedCluster = signals.highest;
  const nextStepRepo = recommendedCluster ? topRepoByCluster[recommendedCluster.label] ?? null : null;
  const intakeLine = nextStepRepo
    ? `→ \`npm run intake -- --project ${problem.project ?? "<project>"} --problem ${problem.slug} ${nextStepRepo}\``
    : "→ (kein Repo — Landscape leer oder Empfehlung fehlt)";

  return `---
problem: ${problem.slug}
run_id: ${landscape.run_id}
project: ${problem.project ?? "(standalone)"}
generated_at: ${new Date().toISOString()}
llm_augmentation: false
---

## Problem (1 Satz)
${oneLiner}

## Landscape auf einen Blick
- ${landscape.clusters.length} Ansatz-Cluster aus ${totalRepos} bewerteten Repos
- Anti-Tunnel-Verteilung: ${rc.near_current_approach} near_current_approach, ${rc.adjacent} adjacent, ${rc.divergent} divergent
- Landscape-Signal: ${landscape.landscape_signal}

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
${landscape.clusters.map((c) => tableRow(c, topRepoByCluster)).join("\n")}

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: ${signals.highest?.label ?? "-"}
- constraint_clean_cluster: ${signals.cleanConstraint?.label ?? "-"}
- anti_tunnel_alternative: ${signals.divergent?.label ?? "-"}

## Nächster konkreter Schritt
${intakeLine}
`;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/brief-heuristic.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/brief/heuristic.mjs test/brief-heuristic.test.mjs
git commit -m "feat(brief): add heuristic brief renderer"
```

---

### Task 28: Wire heuristic brief + HTML landscape into problem-explore

**Files:**
- Create: `lib/landscape/html-report.mjs`
- Modify: `scripts/commands/problem-explore.mjs`

- [ ] **Step 1: Implement HTML report generator (minimal)**

```js
// lib/landscape/html-report.mjs
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[c]));
}

export function renderLandscapeHtml({ problem, landscape, runId }) {
  const rows = landscape.clusters.map((c) => `
    <tr>
      <td>${escapeHtml(c.label)}</td>
      <td>${escapeHtml(c.pattern_family ?? "-")}</td>
      <td><span class="rel rel-${escapeHtml(c.relation)}">${escapeHtml(c.relation)}</span></td>
      <td>${escapeHtml((c.signature_contrast ?? []).join(", "))}</td>
      <td>${escapeHtml((c.member_ids ?? []).join(", "))}</td>
    </tr>
  `).join("\n");

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<title>Landscape — ${escapeHtml(problem.slug)} — ${escapeHtml(runId)}</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #111; }
  h1, h2 { font-weight: 600; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; vertical-align: top; }
  th { background: #f4f4f4; }
  .rel { padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.85em; }
  .rel-near_current_approach { background: #fde68a; }
  .rel-adjacent { background: #bae6fd; }
  .rel-divergent { background: #bbf7d0; }
</style>
</head>
<body>
  <h1>Solution Landscape</h1>
  <p><strong>Problem:</strong> ${escapeHtml(problem.title)}</p>
  <p><strong>Run:</strong> ${escapeHtml(runId)} · <strong>Signal:</strong> ${escapeHtml(landscape.landscape_signal)}</p>

  <h2>Cluster</h2>
  <table>
    <thead><tr><th>Label</th><th>Pattern Family</th><th>Relation</th><th>Signatur-Kontrast</th><th>Mitglieder</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}
```

- [ ] **Step 2: Extend problem-explore to write brief.md, landscape.html, clusters.csv**

Add to the end of the `runProblemExplore` function body, after `landscape.json` is written:

```js
  // Write brief.md
  const { buildHeuristicBrief } = await import("../../lib/brief/heuristic.mjs");
  const topRepoByCluster = {};
  for (const cluster of landscape.clusters) {
    if (cluster.members.length > 0) {
      // members are the raw repos with .url/.html_url; pick the first
      const top = cluster.members[0];
      topRepoByCluster[cluster.label] = top.url ?? top.html_url ?? top.id;
    }
  }
  const briefMd = buildHeuristicBrief({ problem, landscape: jsonOut, topRepoByCluster });
  await fs.writeFile(path.join(landscapeDir, "brief.md"), briefMd);

  // Write landscape.html
  const { renderLandscapeHtml } = await import("../../lib/landscape/html-report.mjs");
  const html = renderLandscapeHtml({ problem, landscape: jsonOut, runId });
  await fs.writeFile(path.join(landscapeDir, "landscape.html"), html);

  // Write clusters.csv
  const csvLines = ["label,pattern_family,main_layer,relation,member_count,signature_contrast"];
  for (const c of jsonOut.clusters) {
    const contrast = (c.signature_contrast ?? []).join("|");
    csvLines.push(`${c.label},${c.pattern_family ?? ""},${c.main_layer ?? ""},${c.relation},${c.member_ids.length},${contrast}`);
  }
  await fs.writeFile(path.join(landscapeDir, "clusters.csv"), `${csvLines.join("\n")}\n`);
```

- [ ] **Step 3: Smoke test**

```bash
npm run problem:explore -- slow-event-lists --depth quick
ls projects/eventbear-worker/problems/slow-event-lists/landscape/*/
```

Expected: `landscape.json`, `landscape.html`, `brief.md`, `clusters.csv` all present. Open the HTML file and the brief in a viewer to sanity-check.

- [ ] **Step 4: Commit**

```bash
git add lib/landscape/html-report.mjs scripts/commands/problem-explore.mjs
git commit -m "feat(cli): problem:explore writes brief.md, landscape.html, clusters.csv"
```

---

### Task 29: Standalone problem-brief command

**Files:**
- Create: `scripts/commands/problem-brief.mjs`
- Modify: registry + dispatcher + package.json

- [ ] **Step 1: Implement command**

```js
// scripts/commands/problem-brief.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { readProblem } from "../../lib/problem/store.mjs";
import { resolveLandscapeDir } from "../../lib/problem/paths.mjs";
import { buildHeuristicBrief } from "../../lib/brief/heuristic.mjs";

function parseArgs(rawArgs) {
  const opts = { project: null, slug: null, run: null, withLlm: false };
  let positional = 0;
  for (let i = 0; i < rawArgs.length; i += 1) {
    const a = rawArgs[i];
    if (a === "--project") { opts.project = rawArgs[++i]; continue; }
    if (a === "--run") { opts.run = rawArgs[++i]; continue; }
    if (a === "--with-llm") { opts.withLlm = true; continue; }
    if (a.startsWith("--")) continue;
    if (positional === 0) { opts.slug = a; positional += 1; }
  }
  return opts;
}

export async function runProblemBrief({ rawArgs, rootDir }) {
  const { project, slug, run } = parseArgs(rawArgs ?? []);
  if (!slug) {
    console.error("problem:brief requires <slug>");
    process.exitCode = 2;
    return;
  }
  const problem = await readProblem({ rootDir, projectKey: project, slug });
  const runId = run ?? problem.latest_landscape?.replace(/^landscape\//, "") ?? null;
  if (!runId) {
    console.error("No landscape run specified and none recorded. Run problem:explore first.");
    process.exitCode = 2;
    return;
  }
  const landscapeDir = resolveLandscapeDir({ rootDir, projectKey: project, slug, runId });
  const landscape = JSON.parse(await fs.readFile(path.join(landscapeDir, "landscape.json"), "utf8"));

  const topRepoByCluster = {};
  for (const c of landscape.clusters) {
    topRepoByCluster[c.label] = c.member_ids?.[0] ?? null;
  }
  const markdown = buildHeuristicBrief({ problem, landscape, topRepoByCluster });
  await fs.writeFile(path.join(landscapeDir, "brief.md"), markdown);
  console.log(`Brief rewritten at ${landscapeDir}/brief.md`);
}
```

- [ ] **Step 2: Register handler + command entry + npm script**

Handler `runProblemBrief`, command `problem-brief`, npm script `"problem:brief"`.

- [ ] **Step 3: Commit**

```bash
git add scripts/commands/problem-brief.mjs scripts/patternpilot.mjs scripts/shared/command-registry.mjs package.json
git commit -m "feat(cli): add standalone problem:brief command"
```

---

## Phase 7 — Intake / Watchlist Flag Integration

### Task 30: Intake backref + `--problem` flag

**Files:**
- Create: `lib/problem/intake-backref.mjs`
- Create: `test/problem-intake-backref.test.mjs`
- Modify: `scripts/commands/discovery.mjs` (add flag to `runIntake`)

- [ ] **Step 1: Write failing test**

```js
// test/problem-intake-backref.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { addProblemBackref } from "../lib/problem/intake-backref.mjs";

test("addProblemBackref injects problem frontmatter into dossier", () => {
  const original = `---
url: https://github.com/org/repo
status: new
---

## body
`;
  const updated = addProblemBackref(original, "slow-lists");
  assert.match(updated, /problems:\n  - slow-lists/);
});

test("addProblemBackref appends slug when problems list exists", () => {
  const original = `---
url: https://github.com/org/repo
status: new
problems:
  - existing-slug
---
body`;
  const updated = addProblemBackref(original, "new-slug");
  assert.match(updated, /- existing-slug/);
  assert.match(updated, /- new-slug/);
});

test("addProblemBackref is idempotent when slug already present", () => {
  const original = `---
url: https://github.com/org/repo
status: new
problems:
  - slow-lists
---
body`;
  const updated = addProblemBackref(original, "slow-lists");
  const count = (updated.match(/- slow-lists/g) ?? []).length;
  assert.equal(count, 1);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `node --test test/problem-intake-backref.test.mjs`
Expected: FAIL.

- [ ] **Step 3: Implement module**

```js
// lib/problem/intake-backref.mjs
export function addProblemBackref(markdown, slug) {
  const fmMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return markdown;
  const fm = fmMatch[1];
  const body = fmMatch[2];

  const problemsBlockMatch = fm.match(/problems:\n((?:\s*-\s*.+\n?)+)/);
  let newFm;
  if (problemsBlockMatch) {
    const block = problemsBlockMatch[1];
    if (block.includes(`- ${slug}`)) return markdown;
    const appended = `problems:\n${block.trimEnd()}\n  - ${slug}`;
    newFm = fm.replace(problemsBlockMatch[0], appended);
  } else {
    newFm = `${fm.trimEnd()}\nproblems:\n  - ${slug}`;
  }
  return `---\n${newFm}\n---\n${body}`;
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `node --test test/problem-intake-backref.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Add `--problem` flag to runIntake**

Read `scripts/commands/discovery.mjs` to find `runIntake`. Extract whichever function writes the intake dossier file, and wrap the content with `addProblemBackref` when `--problem <slug>` flag is present. The arg parsing extension:

```js
// inside runIntake's arg parsing
if (a === "--problem") { opts.problem = rawArgs[++i]; continue; }
```

After the dossier markdown is built (search for the file write), apply:

```js
import { addProblemBackref } from "../../lib/problem/intake-backref.mjs";

if (opts.problem) {
  dossierMarkdown = addProblemBackref(dossierMarkdown, opts.problem);
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/problem/intake-backref.mjs test/problem-intake-backref.test.mjs scripts/commands/discovery.mjs
git commit -m "feat(intake): add --problem flag that backrefs dossier to problem artifact"
```

---

### Task 31: `--problem` flag on review:watchlist

**Files:**
- Modify: `scripts/commands/watchlist.mjs`

This is a small flag-addition: when `--problem <slug>` is passed to `review:watchlist`, load the problem's `derived.constraint_tags` and pass them to the ranking step as a soft filter.

- [ ] **Step 1: Add arg parsing**

In `runReviewWatchlist`, add to the arg parser:

```js
if (a === "--problem") { opts.problem = rawArgs[++i]; continue; }
```

- [ ] **Step 2: Load problem and apply constraints**

After the project binding is loaded, if `opts.problem` is set:

```js
import { readProblem } from "../../lib/problem/store.mjs";
import { applySoftBoost } from "../../lib/discovery/problem-constraints.mjs";

let problemForFilter = null;
if (opts.problem) {
  problemForFilter = await readProblem({ rootDir, projectKey: binding.projectKey, slug: opts.problem });
}

// When ranking/iterating items:
if (problemForFilter) {
  item = applySoftBoost(item, problemForFilter.derived.tech_tags ?? []);
  // additionally log constraint_tags as filter hints in the review report
}
```

- [ ] **Step 3: Smoke test**

```bash
npm run review:watchlist -- --project eventbear-worker --problem slow-event-lists --dry-run
```

Expected: review runs without errors; output mentions the problem slug as part of the run context.

- [ ] **Step 4: Commit**

```bash
git add scripts/commands/watchlist.mjs
git commit -m "feat(review): accept --problem flag to bias review:watchlist by problem constraints"
```

---

## Phase 8 — LLM Augmentation (opt-in)

### Task 32: LLM config + cache

**Files:**
- Modify: `lib/config.mjs`
- Create: `lib/brief/llm-cache.mjs`
- Create: `test/brief-llm-cache.test.mjs`

- [ ] **Step 1: Add llm section to config loader**

Read `lib/config.mjs` and add handling for an `llm` object in `patternpilot.config.json`. Minimum shape:

```js
// lib/config.mjs — inside existing loadConfig, ensure this is exposed
// Expected config shape:
// "llm": { "enabled": false, "provider": null, "model": null }
```

Set safe defaults (`enabled: false`, rest null). Do NOT add a provider SDK dependency yet — that lands in Task 33.

- [ ] **Step 2: Write failing test for cache**

```js
// test/brief-llm-cache.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clusterFingerprint, readLlmCache, writeLlmCache, getCached, setCached } from "../lib/brief/llm-cache.mjs";

async function tmpRoot() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "llm-cache-"));
}

test("clusterFingerprint is stable for identical member sets regardless of order", () => {
  const a = clusterFingerprint({ members: [{ id: "r1" }, { id: "r2" }] });
  const b = clusterFingerprint({ members: [{ id: "r2" }, { id: "r1" }] });
  assert.equal(a, b);
});

test("clusterFingerprint differs for different member sets", () => {
  const a = clusterFingerprint({ members: [{ id: "r1" }] });
  const b = clusterFingerprint({ members: [{ id: "r2" }] });
  assert.notEqual(a, b);
});

test("readLlmCache returns empty object when file missing", async () => {
  const dir = await tmpRoot();
  const cache = await readLlmCache(dir);
  assert.deepEqual(cache, {});
});

test("writeLlmCache + readLlmCache round-trip", async () => {
  const dir = await tmpRoot();
  await writeLlmCache(dir, { "c1|fp": { narrative: "x" } });
  const cache = await readLlmCache(dir);
  assert.deepEqual(cache, { "c1|fp": { narrative: "x" } });
});

test("getCached/setCached keys by cluster id + fingerprint", async () => {
  const dir = await tmpRoot();
  await setCached(dir, "c1", "fp", { narrative: "n" });
  assert.deepEqual(await getCached(dir, "c1", "fp"), { narrative: "n" });
  assert.equal(await getCached(dir, "c1", "other"), null);
});
```

- [ ] **Step 3: Run test to verify failure**

Run: `node --test test/brief-llm-cache.test.mjs`
Expected: FAIL.

- [ ] **Step 4: Implement cache module**

```js
// lib/brief/llm-cache.mjs
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const FILE_NAME = "llm-cache.json";

export function clusterFingerprint(cluster) {
  const ids = (cluster.members ?? []).map((m) => m.id).sort();
  return crypto.createHash("sha1").update(ids.join("|")).digest("hex");
}

export async function readLlmCache(dir) {
  try {
    const raw = await fs.readFile(path.join(dir, FILE_NAME), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function writeLlmCache(dir, data) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, FILE_NAME), `${JSON.stringify(data, null, 2)}\n`);
}

function keyOf(clusterId, fingerprint) {
  return `${clusterId}|${fingerprint}`;
}

export async function getCached(dir, clusterId, fingerprint) {
  const cache = await readLlmCache(dir);
  return cache[keyOf(clusterId, fingerprint)] ?? null;
}

export async function setCached(dir, clusterId, fingerprint, value) {
  const cache = await readLlmCache(dir);
  cache[keyOf(clusterId, fingerprint)] = value;
  await writeLlmCache(dir, cache);
}
```

- [ ] **Step 5: Run test to verify pass**

Run: `node --test test/brief-llm-cache.test.mjs`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add lib/config.mjs lib/brief/llm-cache.mjs test/brief-llm-cache.test.mjs
git commit -m "feat(brief): add LLM config section and deterministic cluster cache"
```

---

### Task 33: LLM augmentation module

**Files:**
- Create: `lib/brief/llm.mjs`

This module defines the contract for LLM augmentation but does NOT bundle a provider SDK. The provider hook is pluggable: the caller passes a function `generate(prompt)` that returns a string. This keeps the module test-friendly and provider-agnostic per spec.

- [ ] **Step 1: Implement module**

```js
// lib/brief/llm.mjs
import { getCached, setCached, clusterFingerprint } from "./llm-cache.mjs";

function buildNarrativePrompt(cluster) {
  const keywords = cluster.signature_contrast?.join(", ") ?? "";
  const memberIds = (cluster.member_ids ?? []).join(", ");
  return `You analyze a cluster of open-source repositories.
Cluster label: ${cluster.label}
Distinguishing keywords: ${keywords}
Pattern family: ${cluster.pattern_family ?? "unknown"}
Member repo ids: ${memberIds}

Write exactly 3 sentences:
1. What is the core idea shared by these repos? (one sentence)
2. What is the typical strength of this approach? (one sentence)
3. What is the typical weakness or trade-off? (one sentence)

Keep each sentence factual and grounded in the given data. Do not invent new repos. Do not recommend an action.`;
}

function buildStrengthsPrompt(cluster) {
  return `For the cluster "${cluster.label}" with keywords [${(cluster.signature_contrast ?? []).join(", ")}]:
List exactly 2 strengths and 2 weaknesses as short bullets (one line each).
Format:
STRENGTHS:
- <bullet>
- <bullet>
WEAKNESSES:
- <bullet>
- <bullet>`;
}

export async function augmentClusterWithLlm({ cluster, cacheDir, generate }) {
  const fingerprint = clusterFingerprint(cluster);
  const cached = await getCached(cacheDir, cluster.key ?? cluster.label, fingerprint);
  if (cached) return cached;

  const narrative = await generate(buildNarrativePrompt(cluster));
  const strengthsRaw = await generate(buildStrengthsPrompt(cluster));

  const value = { narrative, strengths_weaknesses_raw: strengthsRaw };
  await setCached(cacheDir, cluster.key ?? cluster.label, fingerprint, value);
  return value;
}

export async function augmentLandscape({ landscape, cacheDir, generate }) {
  const out = {};
  for (const cluster of landscape.clusters ?? []) {
    out[cluster.key ?? cluster.label] = await augmentClusterWithLlm({ cluster, cacheDir, generate });
  }
  return out;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/brief/llm.mjs
git commit -m "feat(brief): add LLM augmentation module (provider-agnostic, cache-backed)"
```

---

### Task 34: Wire --with-llm into explore and brief commands

**Files:**
- Modify: `scripts/commands/problem-explore.mjs`
- Modify: `scripts/commands/problem-brief.mjs`

- [ ] **Step 1: Add generate-function loader**

Create a small helper in `scripts/commands/problem-explore.mjs` (or share via a new `scripts/shared/llm-provider.mjs` if preferred):

```js
async function buildGenerateFn(config) {
  if (!config.llm?.enabled) {
    throw new Error("LLM is not enabled in patternpilot.config.json. Cannot use --with-llm.");
  }
  if (!config.llm.provider) {
    throw new Error("llm.enabled=true but no provider configured. Set llm.provider in config.");
  }
  // MVP: require the user to provide a generate-function file path in config.
  // Future: plug in concrete providers.
  if (config.llm.provider === "stub") {
    return async (prompt) => `[stub-response for: ${prompt.slice(0, 40)}...]`;
  }
  throw new Error(`Unknown LLM provider: ${config.llm.provider}. MVP supports only 'stub'.`);
}
```

- [ ] **Step 2: Call augmentLandscape when --with-llm is set**

In `runProblemExplore`, after the landscape is written but before the brief is built, if `withLlm` is true:

```js
let llmAugmentation = null;
if (withLlm) {
  const { augmentLandscape } = await import("../../lib/brief/llm.mjs");
  const generate = await buildGenerateFn(config);
  llmAugmentation = await augmentLandscape({
    landscape: { clusters: landscape.clusters },
    cacheDir: landscapeDir,
    generate
  });
  jsonOut.llm_augmentation = llmAugmentation;
  await fs.writeFile(path.join(landscapeDir, "landscape.json"), `${JSON.stringify(jsonOut, null, 2)}\n`);
}
```

Then pass `llmAugmentation` into the brief builder (Task 35 will extend the brief renderer to consume it).

- [ ] **Step 3: Smoke test with stub provider**

```bash
# First, set llm.enabled=true and provider="stub" in patternpilot.config.json manually
npm run problem:explore -- slow-event-lists --depth quick --with-llm
cat projects/eventbear-worker/problems/slow-event-lists/landscape/*/llm-cache.json
```

Expected: cache file contains one entry per cluster with stub response text.

- [ ] **Step 4: Commit**

```bash
git add scripts/commands/problem-explore.mjs scripts/commands/problem-brief.mjs
git commit -m "feat(cli): wire --with-llm into problem:explore and problem:brief"
```

---

### Task 35: Brief rendering with LLM augmentation

**Files:**
- Modify: `lib/brief/heuristic.mjs`

- [ ] **Step 1: Extend buildHeuristicBrief to accept optional augmentation**

Change the signature:

```js
// lib/brief/heuristic.mjs
// add parameter: llmAugmentation (map of clusterKey -> { narrative, strengths_weaknesses_raw })
```

Replace the `kern` and `kontrast` columns in `tableRow`:

```js
function tableRow(cluster, topRepoByCluster, augmentation) {
  const key = cluster.key ?? cluster.label;
  const aug = augmentation?.[key];
  const kern = aug?.narrative ?? "needs_manual_read";
  const kontrast = (cluster.signature_contrast ?? []).join(", ") || "-";
  const beispiele = (cluster.member_ids ?? []).slice(0, 3).join(", ") || "-";
  const relation = cluster.relation ?? "-";
  return `| ${cluster.label} | ${kern} | ${kontrast} | ${beispiele} | ${relation} |`;
}
```

Update the frontmatter marker:

```js
llm_augmentation: ${llmAugmentation ? "true" : "false"}
```

And add a separate "LLM-Ergänzung" section at the bottom when augmentation is present:

```js
${llmAugmentation ? `## KI-Ergänzung (optional)\n> [LLM-Zusammenfassung — keine Primärquelle]\n\n${Object.entries(llmAugmentation).map(([k, v]) => `### ${k}\n${v.strengths_weaknesses_raw ?? ""}\n`).join("\n")}\n` : ""}
```

- [ ] **Step 2: Update the test to cover both modes**

Add a test case to `test/brief-heuristic.test.mjs`:

```js
test("buildHeuristicBrief inserts LLM narrative when augmentation provided", () => {
  const problem = { slug: "x", title: "T", project: "app", fields: { description: "D" }, derived: { constraint_tags: [] } };
  const landscape = {
    run_id: "r",
    clusters: [{ key: "c1", label: "virt", relation: "near_current_approach", signature_contrast: [], member_ids: ["a"], pattern_family: "v" }],
    relation_counts: { near_current_approach: 1, adjacent: 0, divergent: 0 },
    landscape_signal: "ok"
  };
  const aug = { c1: { narrative: "Clever narrative here.", strengths_weaknesses_raw: "STRENGTHS:\n- s1" } };
  const md = buildHeuristicBrief({ problem, landscape, topRepoByCluster: {}, llmAugmentation: aug });
  assert.match(md, /Clever narrative here\./);
  assert.match(md, /KI-Ergänzung/);
  assert.match(md, /llm_augmentation: true/);
});
```

- [ ] **Step 3: Run tests**

Run: `node --test test/brief-heuristic.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add lib/brief/heuristic.mjs test/brief-heuristic.test.mjs
git commit -m "feat(brief): render LLM narrative and strengths/weaknesses when augmentation present"
```

---

## Phase 9 — Boundary Handling

### Task 36: Project-binding-missing detection

**Files:**
- Modify: `scripts/commands/problem-list.mjs`
- Modify: `scripts/commands/problem-explore.mjs`

- [ ] **Step 1: Add binding check helper to problem-list**

In `runProblemList`, for each project-bound row, check if the binding file exists. If missing, add a `project_binding_missing` marker column.

```js
import fs from "node:fs/promises";
import path from "node:path";

async function bindingExists(rootDir, projectKey) {
  const p = path.join(rootDir, "bindings", projectKey, "PROJECT_BINDING.json");
  return fs.stat(p).then(() => true).catch(() => false);
}

// In the row loop:
let marker = "";
if (entry.project) {
  const ok = await bindingExists(rootDir, entry.project);
  if (!ok) marker = "project_binding_missing";
}
rows.push({ ...existingRow, marker });
```

Add the marker to the printed table.

- [ ] **Step 2: Add hard-fail in problem-explore**

In `runProblemExplore`, before refreshing the problem:

```js
if (project) {
  const bindingPath = path.join(rootDir, "bindings", project, "PROJECT_BINDING.json");
  const exists = await fs.stat(bindingPath).then(() => true).catch(() => false);
  if (!exists) {
    console.error(`Project binding missing at ${bindingPath}.`);
    console.error("Either run bootstrap to restore the binding, or convert the problem to standalone by removing the 'project' field in its frontmatter and moving the directory to state/standalone-problems/.");
    process.exitCode = 2;
    return;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/commands/problem-list.mjs scripts/commands/problem-explore.mjs
git commit -m "fix(problem): handle missing project binding in list and explore"
```

---

### Task 37: lib/index.mjs re-exports

**Files:**
- Modify: `lib/index.mjs`

- [ ] **Step 1: Add problem + clustering + brief re-exports**

Append near other re-exports:

```js
export {
  resolveProblemDir,
  resolveLandscapeDir,
  isStandalone
} from "./problem/paths.mjs";

export { buildSlug, validateSlug } from "./problem/slug.mjs";
export { parseProblemMarkdown } from "./problem/parser.mjs";
export { buildDerived } from "./problem/derived.mjs";
export { buildProblemTemplate } from "./problem/template.mjs";
export {
  writeProblem,
  readProblem,
  refreshProblemJson,
  updateProblemPointer
} from "./problem/store.mjs";
export { resolveProblem, archiveProblem } from "./problem/lifecycle.mjs";
export { addProblemBackref } from "./problem/intake-backref.mjs";

export { extractRepoKeywords, normalizeKeyword } from "./clustering/keywords.mjs";
export { buildLandscape } from "./clustering/landscape.mjs";

export {
  buildProblemQueryFamily,
  buildCrossFamily,
  splitBudget
} from "./discovery/problem-queries.mjs";
export { problemFit, combinedScore } from "./discovery/problem-ranking.mjs";
export {
  applyHardConstraints,
  applySoftBoost
} from "./discovery/problem-constraints.mjs";
export { selectWithDiversity } from "./discovery/problem-diversity.mjs";

export { buildHeuristicBrief } from "./brief/heuristic.mjs";
export { renderLandscapeHtml } from "./landscape/html-report.mjs";
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```

Expected: all tests pass. If something breaks due to import order, fix before moving on.

- [ ] **Step 3: Commit**

```bash
git add lib/index.mjs
git commit -m "refactor(lib): re-export problem, clustering, brief APIs via lib/index.mjs"
```

---

### Task 38: Documentation update

**Files:**
- Modify: `README.md` (add one section)
- Modify: `STATUS.md` (add capability flag)

- [ ] **Step 1: Append to README.md "Die Wichtigsten Befehle" section**

After the existing bullet list of commands, add:

```markdown
- `npm run problem:create -- --project my-project --title "..."`
  Legt ein problem.md-Artefakt an. Ohne `--project` als standalone-Problem unter `state/standalone-problems/`.
- `npm run problem:explore -- <slug>`
  Startet den Kettenlauf: targeted discovery → clustering → Solution Landscape + Brief.
- `npm run problem:list`
  Listet alle aktiven Probleme mit letzter Landscape-Referenz.
```

- [ ] **Step 2: Update STATUS.md capabilities line**

Change:

```
- capabilities: intake, promotion, discovery, watchlist_review, html_reports, workspace_mode
```

to:

```
- capabilities: intake, promotion, discovery, watchlist_review, html_reports, workspace_mode, problem_mode
```

- [ ] **Step 3: Commit**

```bash
git add README.md STATUS.md
git commit -m "docs: document problem-mode commands in README and STATUS"
```

---

## Self-Review Checklist (run after plan is complete)

Spec coverage:
- [x] Abschnitt 1 (architecture/layout) → Task 1 (paths)
- [x] Abschnitt 2 (data model) → Tasks 2–7 (slug, parser, derived, template, store, lifecycle)
- [x] Abschnitt 3 (command surface) → Tasks 8–11 (create, refresh, list, resolve, archive), Task 25–29 (explore, brief), Tasks 30–31 (flags)
- [x] Abschnitt 4 (discovery integration) → Tasks 21–24, wired in Task 26
- [x] Abschnitt 5 (clustering) → Tasks 12–20
- [x] Abschnitt 6 (LLM boundary) → Tasks 32–35
- [x] Abschnitt 7 (brief) → Tasks 27–28, 35
- [x] Abschnitt 8 (lifecycle + boundary cases) → Task 11 (resolve/archive), Task 36 (binding-missing)

Known deferrals flagged in plan:
- Task 26 step 2 leaves project-query-seed loading explicit as a TODO inside the problem-explore integration. Reason: the existing project-seed-building internals vary by version; implementer must read `lib/discovery/search.mjs` / `lib/project.mjs` to pick the right entry point. The plan calls this out explicitly rather than inventing a function signature that may not match.

Type consistency:
- `{ rootDir, projectKey, slug }` argument shape is consistent across all `lib/problem/*.mjs` functions.
- `{ members: [...], keywords: Set }` is the consistent cluster shape across stage1, stage2, labels, anti-tunnel, contrast.
- `problem_fit` and `combinedScore` use the same field name convention throughout.
