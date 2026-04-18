import test from "node:test";
import assert from "node:assert/strict";

import {
  describeAutomationOperatingMode,
  describeGovernanceOperatingPosture,
  describePolicyControlOperatingPosture
} from "../lib/automation/operating-mode.mjs";

test("describeAutomationOperatingMode treats missing automation as healthy core-only mode", () => {
  const mode = describeAutomationOperatingMode({
    jobsConfigured: 0
  });

  assert.equal(mode.modeKey, "core_only");
  assert.equal(mode.operatorMode, "manual_first");
  assert.match(mode.summary, /local core mode/i);
});

test("describeAutomationOperatingMode marks urgent operator attention when ack is required", () => {
  const mode = describeAutomationOperatingMode({
    jobsConfigured: 2,
    jobsReady: 1,
    ackRequiredJobs: 1
  });

  assert.equal(mode.modeKey, "operator_attention_required");
  assert.equal(mode.operatorMode, "manual_attention");
});

test("describeGovernanceOperatingPosture maps limited unattended state to guarded posture", () => {
  const posture = describeGovernanceOperatingPosture({
    status: "limited_unattended"
  });

  assert.equal(posture.postureKey, "guarded_unattended");
  assert.equal(posture.operatorMode, "manual_promotion");
});

test("describePolicyControlOperatingPosture distinguishes dormant and careful states", () => {
  const dormant = describePolicyControlOperatingPosture({
    overallStatus: "no_policy_activity"
  });
  const careful = describePolicyControlOperatingPosture({
    overallStatus: "followup_with_care"
  });

  assert.equal(dormant.postureKey, "dormant");
  assert.equal(careful.postureKey, "careful_followup");
});
