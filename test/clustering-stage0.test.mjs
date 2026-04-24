import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { clusterByProvenance } from "../lib/clustering/stage0-provenance.mjs";

describe("clusterByProvenance", () => {
  test("empty input yields empty clusters + empty ungrouped", () => {
    assert.deepEqual(clusterByProvenance([]), { clusters: [], ungrouped: [] });
    assert.deepEqual(clusterByProvenance(null), { clusters: [], ungrouped: [] });
  });

  test("repos without discoveryProvenance land in ungrouped", () => {
    const repos = [
      { id: "r1", keywords: new Set(["a"]) },
      { id: "r2", keywords: new Set(["b"]), discoveryProvenance: [] }
    ];
    const { clusters, ungrouped } = clusterByProvenance(repos);
    assert.equal(clusters.length, 0);
    assert.equal(ungrouped.length, 2);
  });

  test("groups repos by primary provenance, respects minClusterSize", () => {
    const repos = [
      { id: "a1", discoveryProvenance: ["graph entity resolution"] },
      { id: "a2", discoveryProvenance: ["graph entity resolution"] },
      { id: "a3", discoveryProvenance: ["graph entity resolution"] },
      { id: "b1", discoveryProvenance: ["fuzzy matching"] },
      { id: "b2", discoveryProvenance: ["fuzzy matching"] }
      // b only has 2 - below min, should go to ungrouped
    ];
    const { clusters, ungrouped } = clusterByProvenance(repos, { minClusterSize: 3 });
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].members.length, 3);
    assert.equal(clusters[0].provenance_query, "graph entity resolution");
    assert.equal(clusters[0].stage, "provenance");
    assert.equal(clusters[0].main_layer, "problem_lens");
    assert.equal(ungrouped.length, 2);
    assert.ok(ungrouped.every((r) => r.id.startsWith("b")));
  });

  test("produces stable-keyed slug from the phrase", () => {
    const repos = [
      { id: "r1", discoveryProvenance: ["Graph Entity Resolution!"] },
      { id: "r2", discoveryProvenance: ["Graph Entity Resolution!"] },
      { id: "r3", discoveryProvenance: ["Graph Entity Resolution!"] }
    ];
    const { clusters } = clusterByProvenance(repos, { minClusterSize: 3 });
    assert.equal(clusters[0].key, "provenance|graph-entity-resolution");
  });

  test("orders clusters by size descending, then alphabetically", () => {
    const repos = [
      { id: "b1", discoveryProvenance: ["beta query"] },
      { id: "b2", discoveryProvenance: ["beta query"] },
      { id: "b3", discoveryProvenance: ["beta query"] },
      { id: "b4", discoveryProvenance: ["beta query"] },
      { id: "a1", discoveryProvenance: ["alpha query"] },
      { id: "a2", discoveryProvenance: ["alpha query"] },
      { id: "a3", discoveryProvenance: ["alpha query"] }
    ];
    const { clusters } = clusterByProvenance(repos, { minClusterSize: 3 });
    assert.equal(clusters.length, 2);
    assert.equal(clusters[0].provenance_query, "beta query", "larger cluster first");
    assert.equal(clusters[0].members.length, 4);
    assert.equal(clusters[1].provenance_query, "alpha query");
    assert.equal(clusters[1].members.length, 3);
  });

  test("uses first provenance entry as primary when repo has multiple", () => {
    const repos = [
      { id: "r1", discoveryProvenance: ["first query", "second query"] },
      { id: "r2", discoveryProvenance: ["first query"] },
      { id: "r3", discoveryProvenance: ["first query"] }
    ];
    const { clusters } = clusterByProvenance(repos, { minClusterSize: 3 });
    assert.equal(clusters[0].provenance_query, "first query");
    assert.equal(clusters[0].members.length, 3);
  });
});

describe("buildLandscape with Stage-0 provenance", () => {
  test("Stage 0 forms clusters from provenance before Stage 1/2", async () => {
    const { buildLandscape } = await import("../lib/clustering/landscape.mjs");
    const repos = [
      // Group A: 3 repos from 'graph entity resolution' query
      { id: "a1", keywords: new Set(["graph", "specific-a1"]), discoveryProvenance: ["graph entity resolution"] },
      { id: "a2", keywords: new Set(["graph", "specific-a2"]), discoveryProvenance: ["graph entity resolution"] },
      { id: "a3", keywords: new Set(["graph", "specific-a3"]), discoveryProvenance: ["graph entity resolution"] },
      // Group B: 3 repos from 'fuzzy matching' query
      { id: "b1", keywords: new Set(["fuzzy", "specific-b1"]), discoveryProvenance: ["fuzzy matching"] },
      { id: "b2", keywords: new Set(["fuzzy", "specific-b2"]), discoveryProvenance: ["fuzzy matching"] },
      { id: "b3", keywords: new Set(["fuzzy", "specific-b3"]), discoveryProvenance: ["fuzzy matching"] }
    ];
    const ls = buildLandscape({
      repos,
      problem: { approach_signature: [], suspected_approach_axes: [] }
    });
    assert.ok(ls.clusters.length >= 2, `expected >=2 clusters, got ${ls.clusters.length}`);
    const stages = ls.clusters.map((c) => c.stage);
    assert.ok(stages.includes("provenance"), `expected at least one provenance-stage cluster, got ${JSON.stringify(stages)}`);
    assert.equal(ls.clusters[0].members.length, 3);
    assert.equal(ls.clusters[1].members.length, 3);
  });

  test("Stage 0 skipped when provenance absent — falls through to Stage 1/2 as before", async () => {
    const { buildLandscape } = await import("../lib/clustering/landscape.mjs");
    const repos = [
      { id: "r1", pattern_family: "x", main_layer: "y", keywords: new Set(["a"]) },
      { id: "r2", pattern_family: "x", main_layer: "y", keywords: new Set(["b"]) }
    ];
    const ls = buildLandscape({
      repos,
      problem: { approach_signature: [], suspected_approach_axes: [] }
    });
    const stages = ls.clusters.map((c) => c.stage);
    assert.ok(!stages.includes("provenance"), "no provenance cluster without provenance data");
    assert.ok(stages.length > 0, "still produces classical clusters");
  });

  test("Stage 0 with minClusterSize=2 pulls small groups into clusters too", async () => {
    const { buildLandscape } = await import("../lib/clustering/landscape.mjs");
    const repos = [
      { id: "a1", keywords: new Set(), discoveryProvenance: ["query-a"] },
      { id: "a2", keywords: new Set(), discoveryProvenance: ["query-a"] },
      { id: "b1", keywords: new Set(), discoveryProvenance: ["query-b"] },
      { id: "b2", keywords: new Set(), discoveryProvenance: ["query-b"] }
    ];
    const ls = buildLandscape({
      repos,
      problem: { approach_signature: [], suspected_approach_axes: [] },
      provenanceMinClusterSize: 2
    });
    const provenanceClusters = ls.clusters.filter((c) => c.stage === "provenance");
    assert.equal(provenanceClusters.length, 2);
  });
});
