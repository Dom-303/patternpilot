import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildDiscoveryPolicyCalibrationReport,
  renderDiscoveryPolicyCalibrationReport
} from "../lib/policy/discovery-policy-calibration.mjs";
import { defaultDiscoveryPolicy } from "../lib/policy/discovery-policy.mjs";

describe("buildDiscoveryPolicyCalibrationReport", () => {
  test("aggregates reviewed runs and blocker signals", () => {
    const policy = {
      ...defaultDiscoveryPolicy("demo"),
      blockedSignalPatterns: ["starter template"]
    };
    const records = [
      {
        runId: "r1",
        relativeManifestPath: "runs/demo/r1/manifest.json",
        manifest: {
          discovery: {
            candidates: [
              {
                full_name: "keep/strong",
                repo: { owner: "keep", name: "strong" },
                guess: { patternFamily: "local_source_infra_framework", mainLayer: "source_intake", gapArea: "source_systems_and_families" },
                enrichment: { repo: { topics: ["events"], license: "MIT", homepage: "" }, readme: { excerpt: "" } },
                projectAlignment: { fitScore: 82, matchedCapabilities: ["source_first"] },
                discoveryDisposition: "review_queue",
                risks: []
              },
              {
                full_name: "drop/template",
                repo: { owner: "drop", name: "template" },
                guess: { patternFamily: "event_discovery_frontend", mainLayer: "ui_discovery_surface", gapArea: "frontend_and_surface_design" },
                enrichment: { repo: { topics: ["events"], license: "MIT", homepage: "" }, readme: { excerpt: "starter template" } },
                projectAlignment: { fitScore: 70, matchedCapabilities: ["distribution_surfaces"] },
                discoveryDisposition: "review_queue",
                risks: []
              }
            ]
          }
        }
      },
      {
        runId: "r2",
        relativeManifestPath: "runs/demo/r2/manifest.json",
        manifest: {
          discovery: {
            candidates: []
          }
        }
      }
    ];

    const report = buildDiscoveryPolicyCalibrationReport(records, policy);
    assert.equal(report.reviewedRuns, 2);
    assert.equal(report.runsWithCandidates, 1);
    assert.equal(report.sourceCandidates, 2);
    assert.equal(report.auditFlagged, 1);
    assert.equal(report.enforceHidden, 1);
    assert.equal(report.blockerCounts[0].value, "blocked_signal_pattern");
    assert.equal(report.blockerExamples[0].blocker, "blocked_signal_pattern");
    assert.equal(report.blockerExamples[0].repos[0].repoRef, "drop/template");
    assert.equal(report.nextWorkbenchRun.runId, "r1");
    assert.match(report.nextWorkbenchCommand, /policy-workbench --project demo --run-id r1/);
    assert.ok(report.recommendations.some((item) => item.includes("Top blocker")));
  });

  test("renders markdown summary", () => {
    const markdown = renderDiscoveryPolicyCalibrationReport({
      projectKey: "demo",
      generatedAt: "2026-04-14T20:10:00.000Z",
      limit: 5,
      report: {
        reviewedRuns: 2,
        runsWithCandidates: 1,
        sourceCandidates: 2,
        auditFlagged: 1,
        enforceHidden: 1,
        preferredHits: 0,
        blockerCounts: [{ value: "blocked_signal_pattern", count: 1 }],
        blockerExamples: [
          {
            blocker: "blocked_signal_pattern",
            repos: [{ repoRef: "drop/template", runId: "r1", fitBand: "high", fitScore: 70 }]
          }
        ],
        auditStatusCounts: [{ value: "calibrating", count: 2 }],
        enforceStatusCounts: [{ value: "calibrating", count: 2 }],
        nextWorkbenchRun: {
          runId: "r1",
          manifestPath: "runs/demo/r1/manifest.json",
          sourceCandidateCount: 2,
          hiddenByEnforce: 1,
          blockerStatus: "calibrating"
        },
        nextWorkbenchCommand: "npm run patternpilot -- policy-workbench --project demo --run-id r1",
        recommendations: ["Inspect blocked examples."],
        runs: [
          {
            runId: "r1",
            sourceCandidateCount: 2,
            audit: { policyCalibration: { status: "calibrating" } },
            enforce: { policyCalibration: { status: "calibrating" }, policySummary: { enforcedBlocked: 1 } }
          }
        ]
      }
    });

    assert.match(markdown, /Patternpilot Discovery Policy Calibration/);
    assert.match(markdown, /Top Blockers/);
    assert.match(markdown, /Blocker Examples/);
    assert.match(markdown, /blocked_signal_pattern: 1/);
    assert.match(markdown, /drop\/template \[r1\] fit=high\/70/);
    assert.match(markdown, /Next Workbench Candidate/);
    assert.match(markdown, /next_command: npm run patternpilot -- policy-workbench --project demo --run-id r1/);
    assert.match(markdown, /r1 :: candidates=2/);
  });
});
