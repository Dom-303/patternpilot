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
  assert.equal(clusters.length, 1);
  assert.equal(clusters[0].members.length, 3);
});
