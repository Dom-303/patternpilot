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

test("selectWithDiversity marks diversity_gap when no repos remain after the top-half", () => {
  // Nur 2 Repos, windowSize 4 → nach topHalf bleibt nichts mehr fuer
  // fair-picks uebrig; diversity_gap signalisiert das.
  const repos = [
    repo("a", 0.9, ["virt"]),
    repo("b", 0.85, ["virt"])
  ];
  const signature = ["virt"];
  const result = selectWithDiversity({
    repos, signature, windowSize: 4, divergenceThreshold: 0.3, minProblemFit: 0.4
  });
  assert.equal(result.diversity_gap, "no_candidates_after_top_half");
});

test("selectWithDiversity round-robins fair-picks across query lenses", () => {
  // 3 Lenses, je 3 Repos. Bei windowSize=6 (topHalf=3, fair-slots=3) sollen
  // die 3 fair-slots alle drei Lenses abdecken — nicht 3× Lens A.
  const mk = (id, lens, score) => ({
    id, score, problemFit: score, keywords: new Set([id]),
    discoveryProvenance: [lens]
  });
  const repos = [
    mk("a1", "lens-a", 0.95), mk("a2", "lens-a", 0.9), mk("a3", "lens-a", 0.85),
    mk("b1", "lens-b", 0.7),  mk("b2", "lens-b", 0.65), mk("b3", "lens-b", 0.6),
    mk("c1", "lens-c", 0.5),  mk("c2", "lens-c", 0.45), mk("c3", "lens-c", 0.4)
  ];
  const result = selectWithDiversity({
    repos, signature: [], windowSize: 6, divergenceThreshold: 0.3, minProblemFit: 0.0
  });
  assert.equal(result.selected.length, 6);
  const lensesInFairPicks = new Set(result.selected.slice(3).map((r) => r.discoveryProvenance[0]));
  assert.ok(lensesInFairPicks.has("lens-b"), "fair-picks include lens-b");
  assert.ok(lensesInFairPicks.has("lens-c"), "fair-picks include lens-c");
});
