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
