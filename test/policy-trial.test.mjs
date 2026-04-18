import test from "node:test";
import assert from "node:assert/strict";
import { buildPolicyTrial, renderPolicyTrialSummary } from "../lib/policy/policy-trial.mjs";

test("buildPolicyTrial shows newly visible candidates under softer policy", () => {
  const discovery = {
    evaluatedCandidates: [
      {
        full_name: "oc/openevents",
        repo: { owner: "oc", name: "openevents", normalizedRepoUrl: "https://github.com/oc/openevents" },
        projectAlignment: { fitBand: "high", fitScore: 73 },
        discoveryDisposition: "observe_only"
      },
      {
        full_name: "citybureau/city-scrapers",
        repo: { owner: "citybureau", name: "city-scrapers", normalizedRepoUrl: "https://github.com/citybureau/city-scrapers" },
        projectAlignment: { fitBand: "high", fitScore: 95 },
        discoveryDisposition: "observe_only"
      }
    ]
  };
  const currentPolicy = {
    allowDispositions: ["intake_now", "review_queue"]
  };
  const trialPolicy = {
    allowDispositions: ["intake_now", "review_queue", "observe_only"]
  };

  const trial = buildPolicyTrial({ discovery, currentPolicy, trialPolicy });

  assert.equal(trial.sourceCandidateCount, 2);
  assert.equal(trial.baselineVisible, 0);
  assert.equal(trial.trialVisible, 2);
  assert.equal(trial.newlyVisibleCount, 2);
  assert.equal(trial.decisionStatus, "apply_ready");
  assert.equal(trial.rows[0].visibilityChange, "newly_visible");
});

test("renderPolicyTrialSummary renders trial outcome", () => {
  const markdown = renderPolicyTrialSummary({
    projectKey: "eventbear-worker",
    workbenchId: "wb-1",
    sourceRunId: "run-1",
    trialPolicyPath: "projects/eventbear-worker/calibration/workbench/wb-1/suggested-policy.json",
    trial: {
      sourceCandidateCount: 2,
      baselineVisible: 0,
      baselineHidden: 2,
      trialVisible: 2,
      trialHidden: 0,
      changedRows: 2,
      newlyVisibleCount: 2,
      newlyHiddenCount: 0,
      decisionStatus: "apply_ready",
      rows: [
        {
          repoRef: "oc/openevents",
          fitBand: "high",
          fitScore: 73,
          visibilityChange: "newly_visible",
          trialAllowed: true,
          trialBlockers: []
        }
      ],
      comparison: {
        delta: {
          auditFlagged: -2,
          enforceHidden: -2,
          auditPreferred: 0
        }
      },
      recommendations: ["Trial policy reveals 2 candidate slots that were previously hidden."]
    }
  });

  assert.match(markdown, /newly_visible: 2/);
  assert.match(markdown, /delta_enforce_hidden: -2/);
  assert.match(markdown, /oc\/openevents :: fit=high\/73 :: newly_visible/);
  assert.match(markdown, /decision_status: apply_ready/);
  assert.match(markdown, /next_command: npm run patternpilot -- policy-apply --project eventbear-worker --workbench-dir/);
});
