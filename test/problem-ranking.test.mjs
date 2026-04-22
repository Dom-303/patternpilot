import test from "node:test";
import assert from "node:assert/strict";
import { problemFit, combinedScore } from "../lib/discovery/problem-ranking.mjs";

test("problemFit returns Jaccard overlap between repo keywords and problem seeds", () => {
  const repo = { keywords: new Set(["virtualization", "windowing", "react"]) };
  const fit = problemFit(repo, ["virtualization", "react", "other"]);
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
