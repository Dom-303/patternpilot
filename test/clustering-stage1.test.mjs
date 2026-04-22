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
