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

test("buildLandscape promotes keyword sub-clusters to top level when structural collapses to one bucket", () => {
  // All repos share no pattern_family (simulates problem-mode flat-repo shape).
  // Stage 1 puts them in a single unknown|unknown structural cluster.
  // Stage 2 keyword clustering at default threshold 0.35 separates the two groups
  // because the shared tokens are thin relative to the group-specific tokens.
  const repos = [
    { id: "r1", keywords: new Set(["react", "virtualization", "window"]) },
    { id: "r2", keywords: new Set(["react", "virtualization", "window", "ui"]) },
    { id: "r3", keywords: new Set(["pagination", "api", "server"]) },
    { id: "r4", keywords: new Set(["pagination", "api", "ssr"]) },
    { id: "r5", keywords: new Set(["pagination", "server", "api"]) }
  ];
  const ls = buildLandscape({
    repos,
    problem: { approach_signature: [], suspected_approach_axes: [] }
  });
  assert.ok(ls.clusters.length >= 2, `expected >=2 top-level clusters, got ${ls.clusters.length}`);
  const stages = ls.clusters.map((c) => c.stage);
  assert.ok(stages.some((s) => s === "keyword" || s === "keyword-rescued"), "at least one cluster should be from keyword stage");
});

test("buildLandscape applies rescue threshold when stage2 returns a single large cluster", () => {
  // Six repos with uniformly high pairwise Jaccard at threshold 0.35 (common+shared dominate)
  // but differentiable at 0.55 (unique group tokens dominate the stricter bound).
  // stripUniversalRatio=0 disables the universal-keyword preprocessor so we can
  // exercise the original rescue pathway in isolation; on real discovery runs the
  // preprocessor handles this collision class before rescue is ever needed.
  const repos = [
    { id: "a1", keywords: new Set(["common", "shared", "unique1"]) },
    { id: "a2", keywords: new Set(["common", "shared", "unique1", "alpha"]) },
    { id: "a3", keywords: new Set(["common", "shared", "unique1", "alpha", "one"]) },
    { id: "b1", keywords: new Set(["common", "shared", "unique2"]) },
    { id: "b2", keywords: new Set(["common", "shared", "unique2", "beta"]) },
    { id: "b3", keywords: new Set(["common", "shared", "unique2", "beta", "two"]) }
  ];
  const ls = buildLandscape({
    repos,
    problem: { approach_signature: [], suspected_approach_axes: [] },
    stripUniversalRatio: 0
  });
  assert.ok(ls.clusters.length >= 2, `expected >=2 clusters after rescue, got ${ls.clusters.length}`);
  const stages = ls.clusters.map((c) => c.stage);
  assert.ok(stages.includes("keyword-rescued"), `rescue pass should run when stage2 collapses to one; got stages ${JSON.stringify(stages)}`);
});

test("buildLandscape splits via stripUniversalKeywords when common topic tokens dominate", () => {
  // Sechs Repos, die zwei Topic-Tokens ("python", "dedup") teilen — typischer
  // Patternpilot-Discovery-Output. Intern zerfallen sie in zwei Sub-Familien
  // (blocking-basiert vs. probabilistic-basiert). Ohne Preprocessing wuerden
  // "python" und "dedup" die Jaccard-Similarity dominieren und alle 6 Repos
  // in einen Mega-Cluster zusammenfallen. Mit stripUniversalKeywords werden
  // die 100%-Tokens entfernt und die verbleibenden Diskriminatoren trennen
  // die zwei Familien sauber in Stage 2.
  const repos = [
    { id: "a1", keywords: new Set(["python", "dedup", "blocking", "lsh", "hash", "specific-a1"]) },
    { id: "a2", keywords: new Set(["python", "dedup", "blocking", "lsh", "hash", "specific-a2"]) },
    { id: "a3", keywords: new Set(["python", "dedup", "blocking", "lsh", "hash", "specific-a3"]) },
    { id: "b1", keywords: new Set(["python", "dedup", "probabilistic", "bayesian", "em", "specific-b1"]) },
    { id: "b2", keywords: new Set(["python", "dedup", "probabilistic", "bayesian", "em", "specific-b2"]) },
    { id: "b3", keywords: new Set(["python", "dedup", "probabilistic", "bayesian", "em", "specific-b3"]) }
  ];
  const ls = buildLandscape({
    repos,
    problem: { approach_signature: [], suspected_approach_axes: [] },
    // Explizit ratio=0.9 im synthetischen 6-Repo-Test: der Produktionsdefault
    // von 0.5 wuerde hier zu aggressiv auch "blocking"/"probabilistic"
    // strippen (3/6 = 50%). In echten 20er-Discovery-Korpussen sind solche
    // Sub-Familien-Tokens typischerweise nur in 15-25% vertreten, nicht 50%.
    stripUniversalRatio: 0.9
  });
  assert.ok(ls.clusters.length >= 2, `expected >=2 clusters after stripping universals, got ${ls.clusters.length}`);
  // Labels should NOT contain "python" or "dedup" (those were stripped as universal)
  const labels = ls.clusters.map((c) => c.label ?? "");
  for (const label of labels) {
    assert.ok(!label.includes("python"), `label "${label}" should not contain universal token "python"`);
    assert.ok(!label.includes("dedup"), `label "${label}" should not contain universal token "dedup"`);
  }
});

test("buildLandscape skips stripUniversalKeywords when stripUniversalRatio=0", () => {
  // Gleicher Input wie oben — aber Preprocessing explizit ausgeschaltet.
  // Jetzt kollabieren alle 6 Repos in einen Cluster, dessen Label die
  // Topic-Tokens enthaelt (weil sie nicht mehr herausgefiltert werden).
  const repos = [
    { id: "a1", keywords: new Set(["python", "dedup", "blocking", "lsh", "hash"]) },
    { id: "a2", keywords: new Set(["python", "dedup", "blocking", "lsh", "hash"]) },
    { id: "a3", keywords: new Set(["python", "dedup", "blocking", "lsh", "hash"]) },
    { id: "b1", keywords: new Set(["python", "dedup", "probabilistic", "bayesian", "em"]) },
    { id: "b2", keywords: new Set(["python", "dedup", "probabilistic", "bayesian", "em"]) },
    { id: "b3", keywords: new Set(["python", "dedup", "probabilistic", "bayesian", "em"]) }
  ];
  const ls = buildLandscape({
    repos,
    problem: { approach_signature: [], suspected_approach_axes: [] },
    stripUniversalRatio: 0
  });
  const label = ls.clusters[0]?.label ?? "";
  assert.ok(label.includes("python") || label.includes("dedup"),
    `with preprocessing disabled, label should retain universal tokens, got "${label}"`);
});

test("buildLandscape leaves a genuinely homogeneous single cluster intact", () => {
  // All repos share identical keyword sets — no rescue can split them.
  const repos = Array.from({ length: 6 }, (_, i) => ({
    id: `r${i}`,
    keywords: new Set(["same", "exact", "tokens"])
  }));
  const ls = buildLandscape({
    repos,
    problem: { approach_signature: [], suspected_approach_axes: [] }
  });
  assert.equal(ls.clusters.length, 1, "genuine homogeneity should stay as one cluster");
  assert.equal(ls.landscape_signal, "single_cluster_collapse");
});
