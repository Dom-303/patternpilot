import test from "node:test";
import assert from "node:assert/strict";

import { buildDiscoveryEvaluation } from "../lib/validation/discovery-evaluation.mjs";

test("buildDiscoveryEvaluation reports benchmark positives, negatives and boundary balance per run", () => {
  const benchmark = {
    projectKey: "eventbear-worker",
    positiveRepos: [
      { repo: "City-Bureau/city-scrapers-events", why: "Good public-event intake signal." }
    ],
    negativeRepos: [
      { repo: "ManojKumarPatnaik/Major-project-list", why: "Generic list repo." }
    ],
    boundaryRepos: [
      { repo: "j-e-d/agenda-lumiton", why: "Boundary repo." }
    ]
  };
  const manifests = [
    {
      runId: "2026-04-19T20-42-28-240Z",
      projectKey: "eventbear-worker",
      createdAt: "2026-04-19T20:42:28.240Z",
      manifestPath: "D:/patternpilot/runs/eventbear-worker/2026-04-19T20-42-28-240Z/manifest.json",
      discovery: {
        plan: {
          plans: [
            { family: "signal_lane" }
          ]
        },
        scanned: 12,
        rawCandidateCount: 6,
        evaluatedCandidates: [
          {
            repo: {
              fullName: "City-Bureau/city-scrapers-events"
            },
            discoveryScore: 84,
            discoveryClass: "fit_candidate",
            discoveryDisposition: "review_queue",
            projectAlignment: {
              fitScore: 78,
              fitBand: "high"
            },
            queryFamilies: ["signal_lane"],
            queryLabels: ["Public-event intake signals"]
          },
          {
            repo: {
              fullName: "ManojKumarPatnaik/Major-project-list"
            },
            discoveryScore: 69,
            discoveryClass: "risk_signal",
            discoveryDisposition: "observe_only",
            projectAlignment: {
              fitScore: 32,
              fitBand: "low"
            },
            queryFamilies: ["capability"],
            queryLabels: ["Broad project scan"]
          },
          {
            repo: {
              fullName: "j-e-d/agenda-lumiton"
            },
            discoveryScore: 73,
            discoveryClass: "boundary_signal",
            discoveryDisposition: "review_queue",
            projectAlignment: {
              fitScore: 61,
              fitBand: "medium"
            },
            queryFamilies: ["signal_lane"],
            queryLabels: ["Agenda signal"]
          }
        ],
        candidates: [
          {
            repo: {
              fullName: "City-Bureau/city-scrapers-events"
            },
            alreadyKnown: true
          },
          {
            repo: {
              fullName: "j-e-d/agenda-lumiton"
            }
          },
          {
            repo: {
              fullName: "ManojKumarPatnaik/Major-project-list"
            }
          }
        ]
      }
    }
  ];
  const queueRows = [
    {
      project_key: "eventbear-worker",
      discovery_query_families: "signal_lane",
      discovery_query_labels: "Public-event intake signals",
      status: "promoted",
      promotion_status: "applied",
      review_disposition: "review_queue",
      decision_guess: "adapt"
    }
  ];

  const evaluation = buildDiscoveryEvaluation({
    projectKey: "eventbear-worker",
    manifests,
    queueRows,
    benchmark
  });

  assert.equal(evaluation.benchmark.runCount, 1);
  assert.equal(evaluation.benchmark.runsWithVisiblePositiveHit, 1);
  assert.equal(evaluation.benchmark.runsWithVisibleNovelPositiveHit, 0);
  assert.equal(evaluation.benchmark.runsWithVisibleNegativeLeak, 1);
  assert.equal(evaluation.benchmark.latestRun.visible.positive.hits, 1);
  assert.equal(evaluation.benchmark.latestRun.novelVisible.positive.hits, 0);
  assert.equal(evaluation.benchmark.latestRun.baselineVisible.positive.hits, 1);
  assert.equal(evaluation.benchmark.latestRun.visible.positive.earliestRank, 1);
  assert.equal(evaluation.benchmark.latestRun.visible.negative.earliestRank, 3);
  assert.equal(evaluation.benchmark.latestRun.visible.boundary.earliestRank, 2);
  assert.ok(evaluation.recommendations.some((item) => item.includes("Benchmark negatives still leak")));
});
