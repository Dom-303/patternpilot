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
