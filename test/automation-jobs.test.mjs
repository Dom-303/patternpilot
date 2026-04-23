import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  acknowledgeAutomationJobState,
  assessAutomationDispatchGate,
  buildAutomationAlertAttention,
  buildAutomationAlertPayload,
  buildAutomationOperatorReviewDigest,
  buildAutomationDispatchHistoryEntry,
  buildAutomationAlerts,
  clearAutomationJobState,
  evaluateAutomationJobs,
  latchAutomationJobOperatorAck,
  renderAutomationDispatchHistorySummary,
  renderAutomationJobsSummary,
  resolveAutomationDispatchJob,
  selectNextDispatchableAutomationJob,
  selectNextAutomationJob,
  summarizeAutomationDispatchHistory,
  summarizeAutomationDispatchHistoryForJob,
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
      jobName: "sample-project-apply",
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
            policyControlStatus: "chain_refresh_recommended",
            policyControlStage: "handoff",
            policyControlDecisionStatus: "handoff_review_ready",
            policyControlNextCommand: "npm run patternpilot -- policy-handoff --project sample-project",
            policyControlTopBlocker: "Latest handoff still points to an older cycle.",
            autoDispatchAllowed: false,
            autoApplyAllowed: false,
            governanceNextAction: "Inspect governance before dispatch."
          }
        }
      ],
      failures: [
        {
          projectKey: "sample-project",
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

    assert.equal(failed.jobs["sample-project-apply"].retryable, true);
    assert.equal(failed.jobs["sample-project-apply"].blockedManual, false);
    assert.equal(failed.jobs["sample-project-apply"].consecutiveRetryableFailures, 1);
    assert.equal(failed.jobs["sample-project-apply"].nextRetryAt, "2026-04-14T18:15:00.000Z");
    assert.equal(failed.jobs["sample-project-apply"].runKind, "maintenance_run");
    assert.equal(failed.jobs["sample-project-apply"].driftStatus, "attention_required");
    assert.equal(failed.jobs["sample-project-apply"].governanceStatus, "manual_gate");
    assert.equal(failed.jobs["sample-project-apply"].policyControlStatus, "chain_refresh_recommended");
    assert.equal(failed.jobs["sample-project-apply"].policyControlStage, "handoff");
    assert.equal(failed.jobs["sample-project-apply"].requalificationRequired, false);
    assert.equal(failed.jobs["sample-project-apply"].autoDispatchAllowed, false);
    assert.equal(failed.jobs["sample-project-apply"].resumeRecommendation.strategy, "retry_after_backoff");

    const succeeded = updateAutomationJobState(failed, {
      jobName: "sample-project-apply",
      runId: "run-2",
      createdAt: "2026-04-14T18:30:00.000Z",
      counts: { failed: 0, completed: 1, completed_with_blocks: 0 },
      failures: []
    });

    assert.equal(succeeded.jobs["sample-project-apply"].retryable, false);
    assert.equal(succeeded.jobs["sample-project-apply"].consecutiveRetryableFailures, 0);
    assert.equal(succeeded.jobs["sample-project-apply"].lastSuccessAt, "2026-04-14T18:30:00.000Z");
  });

  test("latches manual requalification until a later stable success clears it", () => {
    const initial = {
      schemaVersion: 1,
      updatedAt: null,
      jobs: {}
    };

    const latched = updateAutomationJobState(initial, {
      jobName: "sample-project-apply",
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

    assert.equal(latched.jobs["sample-project-apply"].requalificationRequired, true);
    assert.equal(latched.jobs["sample-project-apply"].requalificationTriggeredAt, "2026-04-14T18:00:00.000Z");

    const cleared = updateAutomationJobState(latched, {
      jobName: "sample-project-apply",
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

    assert.equal(cleared.jobs["sample-project-apply"].requalificationRequired, false);
    assert.equal(cleared.jobs["sample-project-apply"].requalificationClearedAt, "2026-04-14T20:00:00.000Z");
  });

  test("preserves operator-ack latch state across later automation updates", () => {
    const initial = {
      schemaVersion: 1,
      updatedAt: "2026-04-17T22:25:36.790Z",
      jobs: {
        "sample-project-apply": {
          jobName: "sample-project-apply",
          operatorAckRequired: true,
          operatorAckCategory: "repeated_governance_block",
          operatorAckSourceStatus: "governance_escalated",
          operatorAckTriggeredAt: "2026-04-17T22:25:36.790Z",
          operatorAckReason: "Repeated governance block.",
          operatorAckNextAction: "npm run patternpilot -- automation-job-ack --automation-job sample-project-apply",
          operatorAckCommand: "npm run patternpilot -- automation-job-ack --automation-job sample-project-apply"
        }
      }
    };

    const updated = updateAutomationJobState(initial, {
      jobName: "sample-project-apply",
      runId: "run-3",
      createdAt: "2026-04-17T22:30:00.000Z",
      counts: { failed: 0, completed: 1, completed_with_blocks: 0 },
      failures: []
    });

    assert.equal(updated.jobs["sample-project-apply"].operatorAckRequired, true);
    assert.equal(updated.jobs["sample-project-apply"].operatorAckCategory, "repeated_governance_block");
    assert.equal(updated.jobs["sample-project-apply"].operatorAckSourceStatus, "governance_escalated");
  });

  test("holds retryable failures manually when auto-resume is not allowed", () => {
    const initial = {
      schemaVersion: 1,
      updatedAt: null,
      jobs: {}
    };

    const failed = updateAutomationJobState(initial, {
      jobName: "first-run-watchlist",
      runId: "run-1",
      createdAt: "2026-04-23T08:00:00.000Z",
      counts: { failed: 1, completed: 0, completed_with_blocks: 0 },
      failures: [
        {
          projectKey: "sample-project",
          phase: "discover",
          error: "GitHub API timed out",
          retryable: true,
          recommendedDelayMinutes: 15,
          resumeRecommendation: {
            strategy: "manual_resume_after_retryable_failure",
            autoResumeAllowed: false,
            nextAction: "Inspect discover manually before retrying the first run."
          }
        }
      ]
    });

    assert.equal(failed.jobs["first-run-watchlist"].blockedManual, true);
    assert.equal(failed.jobs["first-run-watchlist"].retryable, false);
    assert.equal(failed.jobs["first-run-watchlist"].autoResumeAllowed, false);
    assert.equal(failed.jobs["first-run-watchlist"].recommendedDelayMinutes, null);
    assert.equal(failed.jobs["first-run-watchlist"].nextRetryAt, null);
    assert.equal(failed.jobs["first-run-watchlist"].failureRecoveryMode, "manual_clear_required");
    assert.equal(failed.jobs["first-run-watchlist"].resumeRecommendation.strategy, "manual_resume_after_retryable_failure");
  });

  test("stores scheduler hook and project window metadata for chain-run jobs", () => {
    const initial = {
      schemaVersion: 1,
      updatedAt: null,
      jobs: {}
    };

    const updated = updateAutomationJobState(initial, {
      jobName: "all-project-watchlists",
      runId: "run-2",
      createdAt: "2026-04-23T09:00:00.000Z",
      counts: { failed: 0, completed: 1, completed_with_blocks: 0 },
      failures: [],
      jobMetadata: {
        scope: "all-projects",
        schedulerHook: "staggered-project-window",
        maxProjectsPerRun: 2,
        totalProjects: 5,
        projectWindowKeys: ["alpha", "beta"],
        projectWindowTruncated: true,
        projectWindowStartCursor: 0,
        nextProjectCursor: 2
      }
    });

    assert.equal(updated.jobs["all-project-watchlists"].jobScope, "all-projects");
    assert.equal(updated.jobs["all-project-watchlists"].schedulerHook, "staggered-project-window");
    assert.equal(updated.jobs["all-project-watchlists"].maxProjectsPerRun, 2);
    assert.equal(updated.jobs["all-project-watchlists"].totalProjects, 5);
    assert.deepEqual(updated.jobs["all-project-watchlists"].projectWindowKeys, ["alpha", "beta"]);
    assert.equal(updated.jobs["all-project-watchlists"].projectWindowTruncated, true);
    assert.equal(updated.jobs["all-project-watchlists"].nextProjectCursor, 2);
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
  test("emits a scheduled auto-resume alert for retryable backoff jobs", () => {
    const alerts = buildAutomationAlerts([
      {
        name: "backoff-job",
        status: "backoff",
        jobState: {
          lastRunAt: "2026-04-23T08:00:00.000Z",
          nextRetryAt: "2026-04-23T08:15:00.000Z",
          autoResumeAllowed: true,
          resumeRecommendation: {
            strategy: "retry_after_backoff",
            nextAction: "Allow discover to retry after backoff."
          }
        }
      }
    ], {
      now: new Date("2026-04-23T08:05:00.000Z")
    });

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].category, "retry_backoff_scheduled");
    assert.equal(alerts[0].severity, "low");
    assert.match(alerts[0].message, /auto-resume after cooldown/i);
    assert.match(alerts[0].message, /2026-04-23T08:15:00.000Z/);
  });

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

    assert.equal(alerts.length, 6);
    assert.equal(alerts[0].category, "blocked_manual");
    assert.equal(alerts[1].category, "blocked_requalify");
    assert.equal(alerts[2].category, "extended_backoff");
    assert.equal(alerts[3].category, "repeated_retryable_failures");
    assert.equal(alerts[4].category, "drift_attention");
    assert.equal(alerts[5].category, "retry_backoff_scheduled");
  });

  test("clears blocked or backoff job state for manual resume", () => {
    const state = {
      schemaVersion: 1,
      updatedAt: "2026-04-14T18:00:00.000Z",
      jobs: {
        "sample-project-apply": {
          jobName: "sample-project-apply",
          blockedManual: true,
          retryable: true,
          nextRetryAt: "2026-04-14T18:30:00.000Z",
          consecutiveRetryableFailures: 4
        }
      }
    };

    const out = clearAutomationJobState(state, "sample-project-apply", {
      clearedAt: "2026-04-14T18:05:00.000Z",
      reason: "manual_resume_after_fix"
    });

    assert.equal(out.result.status, "cleared");
    assert.equal(out.state.jobs["sample-project-apply"].blockedManual, false);
    assert.equal(out.state.jobs["sample-project-apply"].retryable, false);
    assert.equal(out.state.jobs["sample-project-apply"].nextRetryAt, null);
    assert.equal(out.state.jobs["sample-project-apply"].requalificationRequired, false);
    assert.equal(out.state.jobs["sample-project-apply"].manualClearReason, "manual_resume_after_fix");
  });

  test("builds policy-control alerts for stale chains and careful follow-up", () => {
    const alerts = buildAutomationAlerts([
      {
        name: "sample-project-apply",
        status: "ready",
        jobState: {
          policyControlStatus: "chain_refresh_recommended",
          policyControlStage: "handoff",
          policyControlNextCommand: "npm run patternpilot -- policy-handoff --project sample-project",
          policyControlTopBlocker: "Latest handoff still points to an older cycle."
        }
      },
      {
        name: "sample-project-watchlist",
        status: "ready",
        jobState: {
          policyControlStatus: "followup_with_care",
          policyControlStage: "apply",
          policyControlNextCommand: "npm run patternpilot -- re-evaluate --project sample-project --stale-only",
          policyControlTopBlocker: "Observe-only promotions should be monitored."
        }
      }
    ], {
      now: new Date("2026-04-14T18:00:00.000Z")
    });

    assert.equal(alerts.length, 2);
    assert.equal(alerts[0].category, "policy_control_chain_refresh");
    assert.equal(alerts[0].severity, "high");
    assert.match(alerts[0].nextAction, /policy-handoff/);
    assert.equal(alerts[1].category, "policy_control_followup");
    assert.equal(alerts[1].severity, "medium");
    assert.match(alerts[1].message, /followup_with_care/);
  });

  test("builds repeated dispatch-block alerts from history-based escalation", () => {
    const alerts = buildAutomationAlerts([
      {
        name: "governance-loop",
        status: "ready",
        liveGovernance: {
          autoDispatchAllowed: false,
          nextAction: "Run stability review."
        },
        jobState: {
          dispatchBlockedStreak: 2,
          dispatchGovernanceBlockedStreak: 2,
          dispatchGovernanceBlockedCount: 2
        }
      },
      {
        name: "policy-loop",
        status: "ready",
        liveGovernance: {
          autoDispatchAllowed: true
        },
        jobState: {
          policyControlStatus: "followup_with_care",
          policyControlStage: "apply",
          policyControlNextCommand: "npm run patternpilot -- re-evaluate --project blocked --stale-only",
          policyControlTopBlocker: "Observe-only promotions should be monitored.",
          dispatchBlockedStreak: 2,
          dispatchPolicyBlockedStreak: 2,
          dispatchPolicyBlockedCount: 2
        }
      }
    ], {
      now: new Date("2026-04-14T18:00:00.000Z")
    });

    assert.equal(alerts.length, 2);
    assert.equal(alerts[0].category, "repeated_governance_block");
    assert.equal(alerts[0].severity, "high");
    assert.match(alerts[0].message, /2 consecutive attempts/);
    assert.equal(alerts[1].category, "repeated_policy_control_block");
    assert.equal(alerts[1].severity, "high");
    assert.match(alerts[1].nextAction, /Repeated policy-control block detected/);
  });

  test("builds dispatch-ack alerts for latched operator acknowledgment", () => {
    const alerts = buildAutomationAlerts([
      {
        name: "governance-loop",
        status: "ready",
        liveGovernance: {
          autoDispatchAllowed: true
        },
        jobState: {
          operatorAckRequired: true,
          operatorAckReason: "Repeated governance block latched.",
          operatorAckNextAction: "npm run patternpilot -- automation-job-ack --automation-job governance-loop"
        }
      }
    ], {
      now: new Date("2026-04-14T18:00:00.000Z")
    });

    assert.equal(alerts.length, 1);
    assert.equal(alerts[0].category, "dispatch_ack_required");
    assert.equal(alerts[0].severity, "high");
    assert.match(alerts[0].nextAction, /automation-job-ack/);
  });
});

describe("automation dispatch selection", () => {
  test("selects the next dispatchable job and reports blocked requests", () => {
    const evaluations = [
      {
        name: "sample-project-apply",
        status: "ready",
        reason: "never_run",
        command: "npm run automation:run -- --project sample-project --automation-job sample-project-apply",
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
      },
      {
        name: "policy-blocked-job",
        status: "ready",
        reason: "interval_elapsed",
        command: "npm run automation:run -- --project blocked --automation-job policy-blocked-job",
        liveGovernance: {
          autoDispatchAllowed: true
        },
        jobState: {
          policyControlStatus: "followup_with_care",
          policyControlStage: "apply",
          policyControlNextCommand: "npm run patternpilot -- re-evaluate --project blocked --stale-only",
          policyControlTopBlocker: "Observe-only promotions should be monitored."
        }
      }
    ];

    const next = resolveAutomationDispatchJob(evaluations);
    const requestedBlocked = resolveAutomationDispatchJob(evaluations, "all-project-watchlists");
    const requestedPolicyBlocked = resolveAutomationDispatchJob(evaluations, "policy-blocked-job");
    const dispatchable = selectNextDispatchableAutomationJob(evaluations);
    const gate = assessAutomationDispatchGate(evaluations[3]);

    assert.equal(next.status, "selected");
    assert.equal(next.job?.name, "prepared-job");
    assert.equal(requestedBlocked.status, "job_not_ready");
    assert.equal(requestedBlocked.job?.status, "backoff");
    assert.equal(requestedPolicyBlocked.status, "policy_control_blocked");
    assert.equal(dispatchable?.name, "prepared-job");
    assert.equal(gate.status, "policy_control_blocked");
    assert.match(gate.nextAction ?? "", /re-evaluate/);
  });

  test("escalates repeated blocked dispatch attempts from history streaks", () => {
    const evaluations = [
      {
        name: "governance-loop",
        status: "ready",
        reason: "interval_elapsed",
        command: "npm run automation:run -- --project sample --automation-job governance-loop",
        liveGovernance: {
          autoDispatchAllowed: false,
          nextAction: "Run stability review."
        },
        jobState: {
          dispatchBlockedStreak: 2,
          dispatchGovernanceBlockedStreak: 2,
          dispatchGovernanceBlockedCount: 2
        }
      },
      {
        name: "policy-loop",
        status: "ready",
        reason: "interval_elapsed",
        command: "npm run automation:run -- --project blocked --automation-job policy-loop",
        liveGovernance: {
          autoDispatchAllowed: true
        },
        jobState: {
          policyControlStatus: "followup_with_care",
          policyControlStage: "apply",
          policyControlNextCommand: "npm run patternpilot -- re-evaluate --project blocked --stale-only",
          policyControlTopBlocker: "Observe-only promotions should be monitored.",
          dispatchBlockedStreak: 2,
          dispatchPolicyBlockedStreak: 2,
          dispatchPolicyBlockedCount: 2
        }
      }
    ];

    const governanceGate = assessAutomationDispatchGate(evaluations[0]);
    const policyGate = assessAutomationDispatchGate(evaluations[1]);
    const requestedGovernance = resolveAutomationDispatchJob(evaluations, "governance-loop");
    const requestedPolicy = resolveAutomationDispatchJob(evaluations, "policy-loop");

    assert.equal(governanceGate.status, "governance_escalated");
    assert.equal(governanceGate.escalation?.category, "repeated_governance_block");
    assert.match(governanceGate.reason, /2 dispatch attempts in a row/);
    assert.equal(policyGate.status, "policy_control_escalated");
    assert.equal(policyGate.escalation?.category, "repeated_policy_control_block");
    assert.match(policyGate.nextAction ?? "", /Repeated policy-control block detected/);
    assert.equal(requestedGovernance.status, "governance_escalated");
    assert.equal(requestedPolicy.status, "policy_control_escalated");
  });
});

describe("automation dispatch history", () => {
  test("builds reroute-aware history entries and summarizes them by job", () => {
    const evaluations = [
      {
        name: "sample-project-apply",
        status: "ready",
        reason: "never_run",
        command: "npm run automation:run -- --project sample-project --automation-job sample-project-apply",
        liveGovernance: {
          autoDispatchAllowed: false,
          status: "manual_requalify",
          nextAction: "Run stability review."
        }
      },
      {
        name: "all-project-watchlists",
        status: "ready",
        reason: "interval_elapsed",
        command: "npm run automation:run -- --all-projects --automation-job all-project-watchlists",
        liveGovernance: {
          autoDispatchAllowed: true,
          status: "unattended_ready",
          nextAction: "Dispatch may continue."
        }
      }
    ];
    const selected = resolveAutomationDispatchJob(evaluations);
    const rerouteEntry = buildAutomationDispatchHistoryEntry({
      generatedAt: "2026-04-17T22:00:00.000Z",
      selection: selected,
      evaluations
    });
    const blockedEntry = buildAutomationDispatchHistoryEntry({
      generatedAt: "2026-04-17T22:05:00.000Z",
      requestedJobName: "sample-project-apply",
      selection: resolveAutomationDispatchJob(evaluations, "sample-project-apply"),
      evaluations
    });
    const history = {
      schemaVersion: 1,
      updatedAt: "2026-04-17T22:05:00.000Z",
      entries: [blockedEntry, rerouteEntry]
    };

    const jobSummary = summarizeAutomationDispatchHistoryForJob(history, "sample-project-apply");
    const summary = summarizeAutomationDispatchHistory(history, {
      jobName: "sample-project-apply",
      limit: 5
    });
    const rendered = renderAutomationDispatchHistorySummary({
      generatedAt: "2026-04-17T22:10:00.000Z",
      summary
    });

    assert.equal(rerouteEntry.reroutedFromJobName, "sample-project-apply");
    assert.equal(rerouteEntry.selectedJobName, "all-project-watchlists");
    assert.equal(blockedEntry.selectionStatus, "governance_blocked");
    assert.equal(jobSummary.reroutedCount, 1);
    assert.equal(jobSummary.blockedCount, 1);
    assert.equal(jobSummary.governanceBlockedCount, 1);
    assert.equal(jobSummary.governanceBlockedStreak, 1);
    assert.equal(jobSummary.blockedStreak, 1);
    assert.equal(summary.totalEntries, 2);
    assert.match(rendered, /filter_job: sample-project-apply/);
    assert.match(rendered, /blocked: 1/);
    assert.match(rendered, /governance_blocked: 1/);
    assert.match(rendered, /rerouted: 1/);
  });
});

describe("automation operator ack", () => {
  test("latches repeated escalations and blocks unattended dispatch until acknowledged", () => {
    const initial = {
      schemaVersion: 1,
      updatedAt: null,
      jobs: {}
    };
    const gate = {
      status: "governance_escalated",
      reason: "governance-loop has been governance-blocked 2 dispatch attempts in a row.",
      nextAction: "Repeated governance block detected. Run stability review.",
      escalation: {
        category: "repeated_governance_block"
      }
    };

    const latched = latchAutomationJobOperatorAck(initial, "governance-loop", gate, {
      latchedAt: "2026-04-17T22:25:36.790Z"
    });
    const gateAfterLatch = assessAutomationDispatchGate({
      name: "governance-loop",
      status: "ready",
      reason: "interval_elapsed",
      command: "npm run automation:run -- --project sample --automation-job governance-loop",
      liveGovernance: {
        autoDispatchAllowed: true
      },
      jobState: latched.state.jobs["governance-loop"]
    });
    const acknowledged = acknowledgeAutomationJobState(latched.state, "governance-loop", {
      acknowledgedAt: "2026-04-17T22:30:00.000Z",
      reason: "manual_ack_after_review"
    });
    const gateAfterAck = assessAutomationDispatchGate({
      name: "governance-loop",
      status: "ready",
      reason: "interval_elapsed",
      command: "npm run automation:run -- --project sample --automation-job governance-loop",
      liveGovernance: {
        autoDispatchAllowed: true
      },
      jobState: acknowledged.state.jobs["governance-loop"]
    });

    assert.equal(latched.result.status, "latched");
    assert.equal(latched.state.jobs["governance-loop"].operatorAckRequired, true);
    assert.equal(gateAfterLatch.status, "operator_ack_required");
    assert.match(gateAfterLatch.nextAction ?? "", /automation-job-ack/);
    assert.equal(acknowledged.result.status, "acknowledged");
    assert.equal(acknowledged.state.jobs["governance-loop"].operatorAckRequired, false);
    assert.equal(gateAfterAck.status, "dispatch_allowed");
  });

  test("resets operator-ack trigger timestamp when a new latch is opened after an earlier ack", () => {
    const initial = {
      schemaVersion: 1,
      updatedAt: "2026-04-17T22:30:00.000Z",
      jobs: {
        "governance-loop": {
          jobName: "governance-loop",
          operatorAckRequired: false,
          operatorAckCategory: "repeated_governance_block",
          operatorAckSourceStatus: "governance_escalated",
          operatorAckTriggeredAt: "2026-04-17T22:25:36.790Z",
          operatorAckAcknowledgedAt: "2026-04-17T22:30:00.000Z"
        }
      }
    };
    const gate = {
      status: "governance_escalated",
      reason: "Repeated governance block.",
      nextAction: "Review then ack.",
      escalation: {
        category: "repeated_governance_block"
      }
    };

    const relatched = latchAutomationJobOperatorAck(initial, "governance-loop", gate, {
      latchedAt: "2026-04-17T22:46:15.614Z"
    });

    assert.equal(relatched.state.jobs["governance-loop"].operatorAckRequired, true);
    assert.equal(relatched.state.jobs["governance-loop"].operatorAckTriggeredAt, "2026-04-17T22:46:15.614Z");
    assert.equal(relatched.state.jobs["governance-loop"].operatorAckAcknowledgedAt, null);
  });
});

describe("automation jobs summary", () => {
  test("renders policy-control status alongside governance", () => {
    const rendered = renderAutomationJobsSummary({
      generatedAt: "2026-04-17T20:00:00.000Z",
      evaluations: [
        {
          name: "sample-project-apply",
          status: "ready",
          priority: 100,
          reason: "interval_elapsed",
          nextEligibleAt: "2026-04-17T20:30:00.000Z",
          jobState: {
            lastStatus: "completed",
            runKind: "maintenance_run",
            recommendedFocus: "maintenance_and_drift_control",
            driftStatus: "attention_required",
            driftSignals: 2,
            stabilityStatus: "stable",
            stableStreak: 2,
            unstableStreak: 0,
            governanceStatus: "manual_gate",
            policyControlStatus: "followup_with_care",
            policyControlStage: "apply",
            operatorReviewStatus: "open",
            operatorAckRequired: true,
            dispatchBlockedStreak: 3,
            dispatchBlockedCount: 3,
            dispatchPolicyBlockedCount: 3,
            dispatchPolicyBlockedStreak: 3,
            dispatchReroutedCount: 2,
            lastDispatchStatus: "policy_control_blocked",
            autoDispatchAllowed: false
          }
        }
      ]
    });

    assert.match(rendered, /automation_mode: operator_attention_required/);
    assert.match(rendered, /operator_mode: manual_attention/);
    assert.match(rendered, /policy_control=followup_with_care/);
    assert.match(rendered, /governance_posture=manual_only/);
    assert.match(rendered, /policy_posture=careful_followup/);
    assert.match(rendered, /policy_stage=apply/);
    assert.match(rendered, /operator_review=open/);
    assert.match(rendered, /dispatch_gate=operator_ack_required/);
    assert.match(rendered, /dispatch_ack=required/);
    assert.match(rendered, /dispatch_block_streak=3/);
    assert.match(rendered, /dispatch_blocks=3/);
    assert.match(rendered, /dispatch_reroutes=2/);
    assert.match(rendered, /last_dispatch=policy_control_blocked/);
  });
});

describe("automation alert reporting", () => {
  test("includes operator review digest in alert payload and rendered summary", () => {
    const evaluations = [
      {
        name: "sample-project-apply",
        status: "ready",
        reason: "never_run",
        jobState: {
          operatorReviewStatus: "open",
          operatorReviewCategory: "repeated_governance_block",
          operatorReviewSourceStatus: "governance_escalated",
          operatorReviewOpenedAt: "2026-04-17T22:46:15.614Z",
          operatorReviewNextAction: "Acknowledge after review."
        }
      },
      {
        name: "all-project-watchlists",
        status: "ready",
        reason: "never_run",
        jobState: {
          operatorReviewStatus: "acknowledged",
          operatorReviewCategory: "repeated_policy_control_block",
          operatorReviewResolvedAt: "2026-04-17T22:47:00.000Z",
          operatorReviewResolutionNotes: "review closed"
        }
      }
    ];

    const alerts = buildAutomationAlerts(evaluations, {
      now: new Date("2026-04-17T22:47:30.000Z")
    });
    const operatorReviewDigest = buildAutomationOperatorReviewDigest(evaluations, {
      now: new Date("2026-04-17T22:47:30.000Z")
    });
    const payload = buildAutomationAlertPayload({
      generatedAt: "2026-04-17T22:47:30.000Z",
      alerts,
      nextJob: evaluations[0],
      operatorReviewDigest
    });

    assert.equal(operatorReviewDigest.openCount, 1);
    assert.equal(operatorReviewDigest.recentCloseoutCount, 1);
    assert.equal(payload.attention.status, "operator_attention_required");
    assert.equal(payload.attention.deliveryPriority, "urgent");
    assert.ok(payload.attention.signals.includes("operator_review_open"));
    assert.equal(payload.operatorReviewDigest.openReviews[0].jobName, "sample-project-apply");
    assert.equal(payload.operatorReviewDigest.recentCloseouts[0].jobName, "all-project-watchlists");
    assert.match(payload.markdown, /attention_status: operator_attention_required/);
    assert.match(payload.markdown, /delivery_priority: urgent/);
    assert.match(payload.markdown, /operator_reviews_open: 1/);
    assert.match(payload.markdown, /operator_reviews_recent_closeouts: 1/);
    assert.match(payload.markdown, /Priority Focus/);
    assert.match(payload.markdown, /Operator Reviews Open/);
    assert.match(payload.markdown, /review closed/);
  });

  test("promotes open operator reviews into urgent alert attention", () => {
    const attention = buildAutomationAlertAttention({
      alerts: [
        {
          severity: "medium",
          category: "policy_control_followup",
          jobName: "all-project-watchlists",
          nextAction: "Refresh the policy chain."
        }
      ],
      operatorReviewDigest: {
        openReviews: [
          {
            jobName: "sample-project-apply",
            category: "repeated_governance_block",
            sourceStatus: "governance_escalated",
            nextAction: "Acknowledge after manual review."
          }
        ],
        recentCloseouts: []
      },
      nextJob: {
        name: "sample-project-apply",
        command: "npm run patternpilot -- automation-job-ack --automation-job sample-project-apply"
      }
    });

    assert.equal(attention.status, "operator_attention_required");
    assert.equal(attention.deliveryPriority, "urgent");
    assert.ok(attention.signals.includes("operator_review_open"));
    assert.equal(attention.promotedJobs[0], "sample-project-apply");
    assert.match(attention.summary, /open operator review/);
    assert.match(attention.nextAction, /Acknowledge after manual review/);
  });
});
