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
