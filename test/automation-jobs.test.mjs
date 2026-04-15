import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAutomationAlerts,
  clearAutomationJobState,
  evaluateAutomationJobs,
  resolveAutomationDispatchJob,
  selectNextDispatchableAutomationJob,
  selectNextAutomationJob,
  updateAutomationJobState
} from "../lib/automation/automation-jobs.mjs";

describe("updateAutomationJobState", () => {
  test("stores retryable failure backoff and clears on success", () => {
    const initial = {
      schemaVersion: 1,
      updatedAt: null,
      jobs: {}
    };

    const failed = updateAutomationJobState(initial, {
      jobName: "eventbear-worker-apply",
      runId: "run-1",
      createdAt: "2026-04-14T18:00:00.000Z",
      counts: { failed: 1, completed: 0, completed_with_blocks: 0 },
      projectRuns: [
        {
          metrics: {
            runKind: "maintenance_run",
            recommendedFocus: "maintenance_and_drift_control",
            executionPolicy: {
              reEvaluateScope: "stale_only"
            },
            defaultPromotionMode: "skip",
            runDriftStatus: "attention_required",
            runDriftSignals: 3,
            runGovernanceStatus: "manual_gate",
            autoDispatchAllowed: false,
            autoApplyAllowed: false,
            governanceNextAction: "Inspect governance before dispatch."
          }
        }
      ],
      failures: [
        {
          projectKey: "eventbear-worker",
          error: "GitHub API timed out",
          retryable: true,
          recommendedDelayMinutes: 15,
          resumeRecommendation: {
            strategy: "retry_after_backoff",
            nextAction: "Allow discover to retry after backoff."
          }
        }
      ]
    });

    assert.equal(failed.jobs["eventbear-worker-apply"].retryable, true);
    assert.equal(failed.jobs["eventbear-worker-apply"].blockedManual, false);
    assert.equal(failed.jobs["eventbear-worker-apply"].consecutiveRetryableFailures, 1);
    assert.equal(failed.jobs["eventbear-worker-apply"].nextRetryAt, "2026-04-14T18:15:00.000Z");
    assert.equal(failed.jobs["eventbear-worker-apply"].runKind, "maintenance_run");
    assert.equal(failed.jobs["eventbear-worker-apply"].driftStatus, "attention_required");
    assert.equal(failed.jobs["eventbear-worker-apply"].governanceStatus, "manual_gate");
    assert.equal(failed.jobs["eventbear-worker-apply"].requalificationRequired, false);
    assert.equal(failed.jobs["eventbear-worker-apply"].autoDispatchAllowed, false);
    assert.equal(failed.jobs["eventbear-worker-apply"].resumeRecommendation.strategy, "retry_after_backoff");

    const succeeded = updateAutomationJobState(failed, {
      jobName: "eventbear-worker-apply",
      runId: "run-2",
      createdAt: "2026-04-14T18:30:00.000Z",
      counts: { failed: 0, completed: 1, completed_with_blocks: 0 },
      failures: []
    });

    assert.equal(succeeded.jobs["eventbear-worker-apply"].retryable, false);
    assert.equal(succeeded.jobs["eventbear-worker-apply"].consecutiveRetryableFailures, 0);
    assert.equal(succeeded.jobs["eventbear-worker-apply"].lastSuccessAt, "2026-04-14T18:30:00.000Z");
  });

  test("latches manual requalification until a later stable success clears it", () => {
    const initial = {
      schemaVersion: 1,
      updatedAt: null,
      jobs: {}
    };

    const latched = updateAutomationJobState(initial, {
      jobName: "eventbear-worker-apply",
      runId: "run-1",
      createdAt: "2026-04-14T18:00:00.000Z",
      counts: { failed: 0, completed: 0, completed_with_blocks: 1 },
      projectRuns: [
        {
          metrics: {
            runGovernanceStatus: "manual_requalify",
            governanceNextAction: "Run requalification before dispatching again.",
            stableStreak: 0,
            unstableStreak: 2
          }
        }
      ],
      failures: []
    });

    assert.equal(latched.jobs["eventbear-worker-apply"].requalificationRequired, true);
    assert.equal(latched.jobs["eventbear-worker-apply"].requalificationTriggeredAt, "2026-04-14T18:00:00.000Z");

    const cleared = updateAutomationJobState(latched, {
      jobName: "eventbear-worker-apply",
      runId: "run-2",
      createdAt: "2026-04-14T20:00:00.000Z",
      counts: { failed: 0, completed: 1, completed_with_blocks: 0 },
      projectRuns: [
        {
          metrics: {
            runGovernanceStatus: "unattended_ready",
            stableStreak: 2,
            unstableStreak: 0
          }
        }
      ],
      failures: []
    });

    assert.equal(cleared.jobs["eventbear-worker-apply"].requalificationRequired, false);
    assert.equal(cleared.jobs["eventbear-worker-apply"].requalificationClearedAt, "2026-04-14T20:00:00.000Z");
  });
});

describe("evaluateAutomationJobs", () => {
  test("marks jobs as backoff, blocked_manual or ready", () => {
    const jobs = [
      { name: "ready-job", priority: 50, intervalMinutes: 60 },
      { name: "backoff-job", priority: 100, intervalMinutes: 60 },
      { name: "blocked-job", priority: 80, intervalMinutes: 60 }
    ];
    const state = {
      schemaVersion: 1,
      updatedAt: "2026-04-14T18:00:00.000Z",
      jobs: {
        "ready-job": {
          lastRunAt: "2026-04-14T15:00:00.000Z",
          lastStatus: "completed",
          blockedManual: false,
          nextRetryAt: null
        },
        "backoff-job": {
          lastRunAt: "2026-04-14T17:55:00.000Z",
          lastStatus: "failed",
          blockedManual: false,
          nextRetryAt: "2026-04-14T18:20:00.000Z"
        },
        "blocked-job": {
          lastRunAt: "2026-04-14T17:00:00.000Z",
          lastStatus: "failed",
          blockedManual: true,
          nextRetryAt: null
        }
      }
    };

    const evaluations = evaluateAutomationJobs(jobs, state, new Date("2026-04-14T18:00:00.000Z"));

    assert.equal(evaluations[0].name, "ready-job");
    assert.equal(evaluations[0].status, "ready");
    assert.equal(evaluations[1].name, "backoff-job");
    assert.equal(evaluations[1].status, "backoff");
    assert.equal(evaluations[2].name, "blocked-job");
    assert.equal(evaluations[2].status, "blocked_manual");
    assert.equal(selectNextAutomationJob(evaluations)?.name, "ready-job");
  });

  test("marks requalification-latched jobs as blocked_requalify", () => {
    const jobs = [
      { name: "requalify-job", priority: 100, intervalMinutes: 60 }
    ];
    const state = {
      schemaVersion: 1,
      updatedAt: "2026-04-14T18:00:00.000Z",
      jobs: {
        "requalify-job": {
          lastRunAt: "2026-04-14T17:00:00.000Z",
          lastStatus: "completed_with_blocks",
          blockedManual: false,
          requalificationRequired: true,
          nextRetryAt: null
        }
      }
    };

    const evaluations = evaluateAutomationJobs(jobs, state, new Date("2026-04-14T20:00:00.000Z"));

    assert.equal(evaluations[0].status, "blocked_requalify");
    assert.equal(selectNextAutomationJob(evaluations), null);
  });
});

describe("automation alerting and clear flows", () => {
  test("builds alerts for blocked and repeated retryable failures", () => {
    const evaluations = [
      {
        name: "blocked-job",
        status: "blocked_manual",
        jobState: {
          blockedManual: true
        }
      },
      {
        name: "backoff-job",
        status: "backoff",
        jobState: {
          lastRunAt: "2026-04-14T17:00:00.000Z",
          nextRetryAt: "2026-04-14T19:30:00.000Z",
          consecutiveRetryableFailures: 3
        }
      },
      {
        name: "ready-but-drifting",
        status: "ready",
        jobState: {
          driftStatus: "attention_required",
          driftSignals: 2
        }
      },
      {
        name: "needs-requalify",
        status: "blocked_requalify",
        jobState: {
          requalificationRequired: true,
          requalificationReason: "Run requalification before dispatching again."
        }
      }
    ];

    const alerts = buildAutomationAlerts(evaluations, {
      now: new Date("2026-04-14T18:00:00.000Z"),
      backoffAlertMinutes: 60,
      retryFailureThreshold: 2
    });

    assert.equal(alerts.length, 5);
    assert.equal(alerts[0].category, "blocked_manual");
    assert.equal(alerts[1].category, "extended_backoff");
    assert.equal(alerts[2].category, "repeated_retryable_failures");
    assert.equal(alerts[3].category, "drift_attention");
    assert.equal(alerts[4].category, "blocked_requalify");
  });

  test("clears blocked or backoff job state for manual resume", () => {
    const state = {
      schemaVersion: 1,
      updatedAt: "2026-04-14T18:00:00.000Z",
      jobs: {
        "eventbear-worker-apply": {
          jobName: "eventbear-worker-apply",
          blockedManual: true,
          retryable: true,
          nextRetryAt: "2026-04-14T18:30:00.000Z",
          consecutiveRetryableFailures: 4
        }
      }
    };

    const out = clearAutomationJobState(state, "eventbear-worker-apply", {
      clearedAt: "2026-04-14T18:05:00.000Z",
      reason: "manual_resume_after_fix"
    });

    assert.equal(out.result.status, "cleared");
    assert.equal(out.state.jobs["eventbear-worker-apply"].blockedManual, false);
    assert.equal(out.state.jobs["eventbear-worker-apply"].retryable, false);
    assert.equal(out.state.jobs["eventbear-worker-apply"].nextRetryAt, null);
    assert.equal(out.state.jobs["eventbear-worker-apply"].requalificationRequired, false);
    assert.equal(out.state.jobs["eventbear-worker-apply"].manualClearReason, "manual_resume_after_fix");
  });
});

describe("automation dispatch selection", () => {
  test("selects the next ready job or reports a not-ready request", () => {
    const evaluations = [
      {
        name: "eventbear-worker-apply",
        status: "ready",
        reason: "never_run",
        command: "npm run automation:run -- --project eventbear-worker --automation-job eventbear-worker-apply",
        liveGovernance: {
          autoDispatchAllowed: false
        }
      },
      {
        name: "all-project-watchlists",
        status: "backoff",
        reason: "retry_backoff_active",
        command: "npm run automation:run -- --all-projects --automation-job all-project-watchlists"
      },
      {
        name: "prepared-job",
        status: "ready",
        reason: "interval_elapsed",
        command: "npm run automation:run -- --project sample --automation-job prepared-job --promotion-mode prepared",
        liveGovernance: {
          autoDispatchAllowed: true
        }
      }
    ];

    const next = resolveAutomationDispatchJob(evaluations);
    const requestedBlocked = resolveAutomationDispatchJob(evaluations, "all-project-watchlists");
    const dispatchable = selectNextDispatchableAutomationJob(evaluations);

    assert.equal(next.status, "selected");
    assert.equal(next.job?.name, "eventbear-worker-apply");
    assert.equal(requestedBlocked.status, "job_not_ready");
    assert.equal(requestedBlocked.job?.status, "backoff");
    assert.equal(dispatchable?.name, "prepared-job");
  });
});
