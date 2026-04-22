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
