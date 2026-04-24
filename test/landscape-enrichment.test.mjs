import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildLandscapeQueryPlans,
  buildLandscapeAgentView,
  buildLandscapeTechStatus
} from "../lib/landscape/enrichment.mjs";

const sampleProblem = {
  project: "eventbear-worker",
  fields: {
    description: "Event-Deduplication ueber heterogene Quellen hinweg",
    current_approach: "String-Match auf Titel + Datum",
    success_criteria: "Precision > 0.9 bei Recall > 0.85",
    constraints: ["OpenSource-Lizenz", "Kein Vendor-Lock-In"],
    non_goals: ["Realtime-Matching unter 50ms"]
  },
  derived: {
    query_seeds: ["record linkage library", "entity resolution deduplication"],
    tech_tags: ["python", "nodejs"],
    constraint_tags: ["opensource"],
    approach_signature: ["record-linkage", "fuzzy-matching"]
  }
};

describe("buildLandscapeQueryPlans", () => {
  test("returns empty when queries is empty", () => {
    assert.deepEqual(buildLandscapeQueryPlans([], sampleProblem), []);
    assert.deepEqual(buildLandscapeQueryPlans(null, sampleProblem), []);
  });

  test("produces label, query, reasons for each query with tech/approach/constraint hints", () => {
    const queries = ["record linkage python", "single"];
    const plans = buildLandscapeQueryPlans(queries, sampleProblem);
    assert.equal(plans.length, 2);
    assert.equal(plans[0].label, "Query 1");
    assert.equal(plans[0].query, "record linkage python");
    const firstReasons = plans[0].reasons.join(" | ");
    assert.ok(firstReasons.includes("python"), "tech-tag reason surfaces");
    assert.ok(firstReasons.includes("record-linkage"), "approach reason surfaces");
    assert.ok(firstReasons.includes("OpenSource"), "constraint reason surfaces");
    assert.ok(plans[1].reasons.some((r) => r.includes("breit") || r.includes("Kurz")), "single-word warning");
  });

  test("falls back to a generic reason when nothing matches", () => {
    const problem = { derived: { query_seeds: [], tech_tags: [], approach_signature: [], constraint_tags: [] } };
    const plans = buildLandscapeQueryPlans(["zufaelliger begriff"], problem);
    assert.equal(plans[0].reasons.length >= 1, true);
    assert.ok(plans[0].reasons.some((r) => r.includes("abgeleitet") || r.includes("breit") || r.includes("Mehrwort")));
  });
});

describe("buildLandscapeAgentView", () => {
  test("returns null when no clusters", () => {
    assert.equal(buildLandscapeAgentView({ problem: sampleProblem, slug: "x", project: "p", clusters: [], topRepoByCluster: {} }), null);
  });

  test("assembles mission / deliverable / priorityRepos / codingStarter from divergent cluster", () => {
    const clusters = [
      { key: "c1", label: "Record-Linkage-Libs", relation: "divergent", main_layer: "dedupe_identity", pattern_family: "python record linkage", member_ids: ["r1", "r2"] },
      { key: "c2", label: "Fuzzy-Matcher", relation: "adjacent", main_layer: "normalize_semantics", pattern_family: "fuzzy", member_ids: ["r3"] }
    ];
    const topRepoByCluster = {
      "Record-Linkage-Libs": "https://github.com/AI-team-UoA/pyJedAI",
      "Fuzzy-Matcher": "https://github.com/seatgeek/fuzzywuzzy"
    };
    const agentView = buildLandscapeAgentView({
      problem: sampleProblem,
      slug: "event-dedup",
      project: "eventbear-worker",
      clusters,
      topRepoByCluster,
      queryPlans: [{ query: "record linkage python" }]
    });
    assert.ok(agentView, "agentView produced");
    assert.ok(agentView.mission.length >= 2);
    assert.ok(agentView.mission.some((line) => /[Dd]ivergent/.test(line)), "mission mentions divergent context");
    assert.equal(agentView.priorityRepos[0].repo, "AI-team-UoA/pyJedAI");
    assert.equal(agentView.codingStarter.primary.repo, "AI-team-UoA/pyJedAI");
    assert.equal(agentView.codingStarter.primary.starterMode, "exploration", "divergent -> exploration mode");
    assert.equal(agentView.codingStarter.secondary[0].repo, "seatgeek/fuzzywuzzy");
    assert.ok(agentView.context.some((c) => c.includes("Aktueller Ansatz")));
    assert.ok(agentView.guardrails.some((g) => g.includes("OpenSource")) || agentView.guardrails.length >= 1);
    assert.ok(agentView.uncertainties.length >= 1);
    assert.equal(agentView.payload.handoffType, "landscape-to-project");
    assert.equal(agentView.payload.problemSlug, "event-dedup");
    assert.equal(agentView.downloadFileName, "patternpilot-landscape-handoff-event-dedup.json");
  });

  test("uses prototype starterMode when top cluster is not divergent", () => {
    const clusters = [{ key: "c1", label: "Near Cluster", relation: "near_current_approach", main_layer: "dedupe", member_ids: ["r1"] }];
    const topRepoByCluster = { "Near Cluster": "https://github.com/foo/bar" };
    const view = buildLandscapeAgentView({ problem: sampleProblem, slug: "s", project: "p", clusters, topRepoByCluster });
    assert.equal(view.codingStarter.primary.starterMode, "prototype");
  });
});

describe("buildLandscapeTechStatus", () => {
  test("returns effectiveQueries and empty warnings when everything is healthy", () => {
    const status = buildLandscapeTechStatus({
      queries: ["record linkage python"],
      candidateCount: 12,
      clusterCount: 3,
      outlierCount: 1
    });
    assert.deepEqual(status.effectiveQueries, ["record linkage python"]);
    assert.deepEqual(status.missingCandidates, []);
    assert.deepEqual(status.searchErrors, []);
  });

  test("surfaces 'no candidates' warning when queries ran but produced nothing", () => {
    const status = buildLandscapeTechStatus({ queries: ["q"], candidateCount: 0, clusterCount: 0, outlierCount: 0 });
    assert.ok(status.missingCandidates.some((m) => m.includes("Keine Kandidaten")));
  });

  test("surfaces 'only 1 cluster' warning when corpus is too homogeneous", () => {
    const status = buildLandscapeTechStatus({ queries: ["q"], candidateCount: 8, clusterCount: 1, outlierCount: 0 });
    assert.ok(status.missingCandidates.some((m) => m.includes("1 Cluster")));
  });

  test("single_cluster_collapse emits ready-to-run CLI commands with slug+project", () => {
    const status = buildLandscapeTechStatus({
      queries: ["q"], candidateCount: 8, clusterCount: 1, outlierCount: 0,
      problemSlug: "event-dedup", projectKey: "eventbear-worker"
    });
    assert.ok(status.missingCandidates.some((m) => m.includes("npm run problem:explore -- event-dedup --project eventbear-worker --per-page 50")));
    assert.ok(status.missingCandidates.some((m) => m.includes("--depth deep")));
    assert.ok(status.missingCandidates.some((m) => m.includes("projects/eventbear-worker/problems/event-dedup/problem.md")));
  });

  test("surfaces high-outlier-rate warning when > 50% unmatched", () => {
    const status = buildLandscapeTechStatus({ queries: ["q"], candidateCount: 10, clusterCount: 2, outlierCount: 7 });
    assert.ok(status.missingCandidates.some((m) => m.includes("Outlier-Rate")));
  });

  test("carries pass error into searchErrors", () => {
    const status = buildLandscapeTechStatus({ queries: ["q"], candidateCount: 3, clusterCount: 2, outlierCount: 0, passError: "api rate limit" });
    assert.ok(status.searchErrors.some((e) => e.includes("api rate limit")));
  });
});
