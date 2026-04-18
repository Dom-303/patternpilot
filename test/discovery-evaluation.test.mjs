import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDiscoveryEvaluation,
  renderDiscoveryEvaluationSummary,
  buildDiscoveryEvaluationReport
} from "../lib/validation/discovery-evaluation.mjs";

test("buildDiscoveryEvaluation ranks best and noisy discovery families from queue outcomes", () => {
  const manifests = [
    {
      runId: "run-1",
      projectKey: "sample-project",
      createdAt: "2026-04-18T10:00:00.000Z",
      manifestPath: "/tmp/run-1/manifest.json",
      discovery: {
        plan: {
          plans: [
            { label: "Architecture and layer patterns", family: "architecture" },
            { label: "Broad project scan", family: "broad" }
          ]
        },
        scanned: 20,
        rawCandidateCount: 4,
        evaluatedCandidates: [
          {
            discoveryScore: 88,
            discoveryClass: "fit_candidate",
            discoveryDisposition: "review_queue",
            queryLabels: ["Architecture and layer patterns"],
            queryFamilies: ["architecture"],
            projectAlignment: { fitScore: 84, fitBand: "high" }
          },
          {
            discoveryScore: 32,
            discoveryClass: "risk_signal",
            discoveryDisposition: "observe_only",
            queryLabels: ["Broad project scan"],
            queryFamilies: ["broad"],
            projectAlignment: { fitScore: 30, fitBand: "low" }
          }
        ],
        candidates: [
          {
            discoveryScore: 88,
            discoveryClass: "fit_candidate",
            discoveryDisposition: "review_queue",
            queryLabels: ["Architecture and layer patterns"],
            queryFamilies: ["architecture"],
            projectAlignment: { fitScore: 84, fitBand: "high" }
          }
        ]
      }
    }
  ];
  const queueRows = [
    {
      project_key: "sample-project",
      status: "promoted",
      promotion_status: "applied",
      review_disposition: "review_queue",
      decision_guess: "adapt",
      discovery_query_families: "architecture,broad",
      discovery_query_labels: "Architecture and layer patterns,Broad project scan",
      discovery_score: "88",
      project_fit_score: "84",
      discovery_class: "fit_candidate"
    },
    {
      project_key: "sample-project",
      status: "pending_review",
      promotion_status: "",
      review_disposition: "skip",
      decision_guess: "ignore",
      discovery_query_families: "broad",
      discovery_query_labels: "Broad project scan",
      discovery_score: "32",
      project_fit_score: "28",
      discovery_class: "risk_signal"
    },
    {
      project_key: "sample-project",
      status: "pending_review",
      promotion_status: "",
      review_disposition: "observe_only",
      decision_guess: "observe",
      discovery_query_families: "dependency",
      discovery_query_labels: "Dependency and tooling neighbors",
      discovery_score: "57",
      project_fit_score: "51",
      discovery_class: "research_signal"
    }
  ];

  const evaluation = buildDiscoveryEvaluation({
    projectKey: "sample-project",
    manifests,
    queueRows
  });

  assert.equal(evaluation.runCount, 1);
  assert.equal(evaluation.totals.promoted, 1);
  assert.equal(evaluation.totals.negative, 1);
  assert.equal(evaluation.bestFamilies[0].value, "architecture");
  assert.equal(evaluation.noisyFamilies[0].value, "broad");
  assert.equal(evaluation.runSummaries[0].bestFamily?.value, "architecture");
  assert.equal(evaluation.runSummaries[0].noisyFamily?.value, "broad");
  assert.match(evaluation.recommendations.join(" "), /architecture|broad/);
});

test("renderDiscoveryEvaluationSummary and report surface query family outcomes", () => {
  const evaluation = buildDiscoveryEvaluation({
    projectKey: "sample-project",
    manifests: [],
    queueRows: [
      {
        project_key: "sample-project",
        status: "promotion_prepared",
        promotion_status: "prepared",
        review_disposition: "review_queue",
        decision_guess: "adapt",
        discovery_query_families: "capability",
        discovery_query_labels: "quality and governance",
        discovery_score: "70",
        project_fit_score: "68",
        discovery_class: "fit_candidate"
      }
    ]
  });

  const summary = renderDiscoveryEvaluationSummary(evaluation);
  const report = buildDiscoveryEvaluationReport(evaluation, "/tmp");

  assert.match(summary, /Best Query Families/i);
  assert.match(summary, /quality and governance/i);
  assert.equal(report.bestFamilies[0].value, "capability");
  assert.equal(report.bestLabels[0].value, "quality and governance");
});
