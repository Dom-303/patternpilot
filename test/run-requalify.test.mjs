import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProjectRunRequalification,
  renderProjectRunRequalificationSummary
} from "../lib/run/run-requalify.mjs";

function sampleLifecycle(overrides = {}) {
  return {
    runKind: "maintenance_run",
    ...overrides
  };
}

function sampleDrift(overrides = {}) {
  return {
    driftStatus: "stable",
    ...overrides
  };
}

function sampleStability(overrides = {}) {
  return {
    status: "stable_streak",
    stableStreak: 2,
    unstableStreak: 0,
    ...overrides
  };
}

function sampleGovernance(overrides = {}) {
  return {
    status: "manual_requalify",
    ...overrides
  };
}

test("buildProjectRunRequalification reports ready_to_clear once stability recovered", () => {
  const requalification = buildProjectRunRequalification({
    projectKey: "sample-project",
    lifecycle: sampleLifecycle(),
    drift: sampleDrift(),
    stability: sampleStability(),
    governance: sampleGovernance(),
    releaseGovernance: sampleGovernance({ status: "unattended_ready" }),
    jobName: "sample-job",
    jobState: {
      requalificationRequired: true,
      requalificationTriggeredAt: "2026-04-15T10:00:00.000Z"
    }
  });

  assert.equal(requalification.status, "ready_to_clear");
  assert.match(requalification.nextAction, /automation-job-clear/);
});

test("buildProjectRunRequalification stays blocked when stability is still weak", () => {
  const requalification = buildProjectRunRequalification({
    projectKey: "sample-project",
    lifecycle: sampleLifecycle(),
    drift: sampleDrift(),
    stability: sampleStability({ status: "mixed", stableStreak: 0, unstableStreak: 1 }),
    governance: sampleGovernance(),
    releaseGovernance: sampleGovernance({ status: "limited_unattended" }),
    jobState: {
      requalificationRequired: true
    }
  });

  assert.equal(requalification.status, "blocked_by_stability");

  const markdown = renderProjectRunRequalificationSummary({
    projectKey: "sample-project",
    generatedAt: "2026-04-15T10:00:00.000Z",
    requalification
  });
  assert.match(markdown, /status: blocked_by_stability/);
});
