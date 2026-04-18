import test from "node:test";
import assert from "node:assert/strict";
import {
  buildProjectRunGovernance,
  renderProjectRunGovernanceSummary
} from "../lib/run/run-governance.mjs";

function sampleLifecycle(overrides = {}) {
  return {
    runKind: "maintenance_run",
    defaultPromotionMode: "skip",
    executionPolicy: {
      autoResumeEligiblePhases: ["discover", "intake", "re_evaluate"],
      manualResumePhases: ["review", "promote"]
    },
    ...overrides
  };
}

function sampleDrift(overrides = {}) {
  return {
    latestRun: { runId: "latest" },
    driftStatus: "stable",
    queueSnapshot: {
      byStatus: { promoted: 2 },
      decisionStateSummary: { complete: 2, fallback: 0, stale: 0 }
    },
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

test("buildProjectRunGovernance requires baseline for projects without a run history", () => {
  const governance = buildProjectRunGovernance({
    projectKey: "sample-project",
    lifecycle: sampleLifecycle({ runKind: "first_run" }),
    drift: { latestRun: null, queueSnapshot: { byStatus: {}, decisionStateSummary: { complete: 0, fallback: 0, stale: 0 } } },
    stability: sampleStability({ status: "baseline_only", stableStreak: 0 })
  });

  assert.equal(governance.status, "baseline_required");
  assert.equal(governance.autoDispatchAllowed, false);
  assert.equal(governance.operatingPosture, "manual_only");
});

test("buildProjectRunGovernance blocks unattended apply when drift needs attention", () => {
  const governance = buildProjectRunGovernance({
    projectKey: "sample-project",
    lifecycle: sampleLifecycle(),
    drift: sampleDrift({
      driftStatus: "attention_required"
    }),
    stability: sampleStability({ status: "lightly_stable", stableStreak: 1 }),
    scope: "automation",
    job: {
      name: "sample-apply",
      command: "npm run automation:run -- --project sample-project --promotion-mode apply"
    }
  });

  assert.equal(governance.status, "manual_gate");
  assert.equal(governance.autoDispatchAllowed, false);
  assert.match(governance.nextAction, /Inspect run drift|drift/i);
});

test("buildProjectRunGovernance allows limited unattended continuation when queue needs re-evaluate", () => {
  const governance = buildProjectRunGovernance({
    projectKey: "sample-project",
    lifecycle: sampleLifecycle(),
    drift: sampleDrift({
      queueSnapshot: {
        byStatus: { pending_review: 2 },
        decisionStateSummary: { complete: 0, fallback: 1, stale: 1 }
      },
      resumeGuidance: {
        nextAction: "Run re-evaluate first."
      }
    }),
    stability: sampleStability({ status: "lightly_stable", stableStreak: 1 }),
    scope: "automation",
    job: {
      name: "sample-prepared",
      command: "npm run automation:run -- --project sample-project --promotion-mode prepared"
    }
  });

  assert.equal(governance.status, "limited_unattended");
  assert.equal(governance.autoDispatchAllowed, true);
  assert.equal(governance.autoApplyAllowed, false);
  assert.equal(governance.operatingPosture, "guarded_unattended");
  assert.ok(governance.blockedPhases.includes("promote"));
});

test("buildProjectRunGovernance marks stable maintenance runs as unattended-ready", () => {
  const governance = buildProjectRunGovernance({
    projectKey: "sample-project",
    lifecycle: sampleLifecycle(),
    drift: sampleDrift(),
    stability: sampleStability(),
    scope: "automation",
    job: {
      name: "sample-apply",
      command: "npm run automation:run -- --project sample-project --promotion-mode apply"
    }
  });

  assert.equal(governance.status, "unattended_ready");
  assert.equal(governance.autoDispatchAllowed, true);
  assert.equal(governance.autoApplyAllowed, true);
  assert.equal(governance.operatingPosture, "unattended_ready");

  const markdown = renderProjectRunGovernanceSummary({
    projectKey: "sample-project",
    generatedAt: "2026-04-15T10:00:00.000Z",
    governance
  });
  assert.match(markdown, /auto_dispatch_allowed: yes/);
  assert.match(markdown, /operating_posture: unattended_ready/);
  assert.match(markdown, /operator_mode: unattended_allowed/);
  assert.match(markdown, /recommended_promotion_mode:/);
});

test("buildProjectRunGovernance requires manual requalification after an instability streak", () => {
  const governance = buildProjectRunGovernance({
    projectKey: "sample-project",
    lifecycle: sampleLifecycle(),
    drift: sampleDrift(),
    stability: sampleStability({
      status: "unstable_streak",
      stableStreak: 0,
      unstableStreak: 2
    }),
    scope: "automation",
    job: {
      name: "sample-apply",
      command: "npm run automation:run -- --project sample-project --promotion-mode apply"
    }
  });

  assert.equal(governance.status, "manual_requalify");
  assert.equal(governance.autoDispatchAllowed, false);
  assert.match(governance.nextAction, /run-stability/i);
});

test("buildProjectRunGovernance respects a latched manual requalification state", () => {
  const governance = buildProjectRunGovernance({
    projectKey: "sample-project",
    lifecycle: sampleLifecycle(),
    drift: sampleDrift(),
    stability: sampleStability(),
    jobState: {
      requalificationRequired: true,
      requalificationReason: "Run requalification before clearing the job state."
    },
    scope: "automation",
    job: {
      name: "sample-apply",
      command: "npm run automation:run -- --project sample-project --promotion-mode apply"
    }
  });

  assert.equal(governance.status, "manual_requalify");
  assert.equal(governance.autoDispatchAllowed, false);
  assert.match(governance.nextAction, /requalification/i);
});
