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
