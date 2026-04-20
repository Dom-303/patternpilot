import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDiscoveryPolicyComparisonReport,
  renderDiscoveryPolicyComparisonReport
} from "../lib/policy/discovery-policy-compare.mjs";

test("buildDiscoveryPolicyComparisonReport captures changed policy impact", () => {
  const records = [
    {
      runId: "run-1",
      relativeManifestPath: "runs/sample-project/run-1/manifest.json",
      manifest: {
        discovery: {
          candidates: [
            {
              full_name: "alpha/project",
              discoveryDisposition: "intake_now",
              projectAlignment: { fitScore: 45, matchedCapabilities: ["source_first"] },
              guess: { patternFamily: "place_data_infrastructure", mainLayer: "source_intake", gapArea: "source_systems_and_families" },
              enrichment: { repo: { topics: ["events"], homepage: "https://example.com" } },
              discoveryEvidence: {
                sourceFamilyHits: 2,
                publicEventIntakeHits: 1,
                governanceHits: 0,
                normalizationHits: 1
              }
            },
            {
              full_name: "beta/project",
              discoveryDisposition: "intake_now",
              projectAlignment: { fitScore: 38, matchedCapabilities: ["evidence_acquisition"] },
              guess: { patternFamily: "portal_fed_by_many_scrapers", mainLayer: "parsing_extraction", gapArea: "adapter_handoff_contracts" },
              enrichment: { repo: { topics: ["calendar"], homepage: "https://example.com" } },
              discoveryEvidence: {
                sourceFamilyHits: 2,
                publicEventIntakeHits: 1,
                governanceHits: 0,
                normalizationHits: 1
              }
            }
          ]
        }
      }
    }
  ];

  const baselinePolicy = {
    projectKey: "sample-project",
    allowDispositions: ["intake_now", "review_queue"]
  };
  const candidatePolicy = {
    projectKey: "sample-project",
    allowDispositions: ["intake_now", "review_queue"],
    blockedPatternFamilies: ["portal_fed_by_many_scrapers"],
    preferredPatternFamilies: ["place_data_infrastructure"]
  };

  const report = buildDiscoveryPolicyComparisonReport(records, baselinePolicy, candidatePolicy);

  assert.equal(report.reviewedRuns, 1);
  assert.equal(report.changedRuns, 1);
  assert.equal(report.sourceCandidates, 2);
  assert.equal(report.delta.auditFlagged, 1);
  assert.equal(report.delta.enforceHidden, 1);
  assert.equal(report.delta.auditPreferred, 1);
  assert.match(report.recommendations.join("\n"), /hide 1 more candidate slots/i);
});

test("renderDiscoveryPolicyComparisonReport renders aggregate deltas", () => {
  const markdown = renderDiscoveryPolicyComparisonReport({
    projectKey: "sample-project",
    generatedAt: "2026-04-14T20:30:00.000Z",
    limit: 5,
    candidatePolicyPath: "projects/sample-project/DISCOVERY_POLICY.next.json",
    report: {
      reviewedRuns: 2,
      changedRuns: 1,
      sourceCandidates: 3,
      baseline: { auditFlagged: 1, enforceHidden: 0, auditPreferred: 0 },
      candidate: { auditFlagged: 2, enforceHidden: 1, auditPreferred: 1 },
      delta: { auditFlagged: 1, enforceHidden: 1, auditPreferred: 1 },
      recommendations: ["Candidate policy would hide 1 more candidate slots in enforce mode."],
      runs: [
        {
          runId: "run-1",
          sourceCandidates: 3,
          changed: true,
          delta: { enforceHidden: 1, auditFlagged: 1, auditPreferred: 1 }
        }
      ]
    }
  });

  assert.match(markdown, /candidate_policy: projects\/sample-project\/DISCOVERY_POLICY.next.json/);
  assert.match(markdown, /enforce_hidden_delta: 1/);
  assert.match(markdown, /run-1 :: candidates=3 :: changed=yes/);
});
