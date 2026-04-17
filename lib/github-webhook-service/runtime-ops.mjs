import { buildGithubWebhookServiceRuntimeLoopHistoryReview } from "./runtime-history.mjs";
import { buildGithubWebhookServiceRuntimeLoopRecoveryReceiptsReview } from "./runtime-loop-recovery-receipts.mjs";
import { buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview } from "./runtime-loop-recovery-runtime-cycle-history.mjs";
import { buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview } from "./runtime-loop-recovery-runtime-cycle-receipts.mjs";
import { buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview } from "./runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-history.mjs";
import { buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview } from "./runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-history.mjs";
import { buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview } from "./runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-recovery.mjs";

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

function pushAction(actions, severity, key, title, detail, nextAction) {
  actions.push({
    severity,
    key,
    title,
    detail,
    nextAction
  });
}

function sortActions(actions = []) {
  return [...actions].sort((left, right) => {
    const severityDiff = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return String(left.key).localeCompare(String(right.key));
  });
}

export async function loadGithubWebhookServiceRuntimeOpsState(rootDir, loaders = {}) {
  const [
    queueState,
    runtimeClaimsState,
    runtimeLoopHistoryState,
    runtimeLoopRecoveryReceiptsState,
    runtimeLoopRecoveryRuntimeCycleHistoryState,
    runtimeLoopRecoveryRuntimeCycleReceiptsState,
    coordinationBackpressureHistoryState,
    coordinationBackpressureLoopHistoryState
  ] = await Promise.all([
    loaders.loadGithubWebhookServiceQueue(rootDir),
    loaders.loadGithubWebhookServiceRuntimeClaims(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopHistory(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir)
  ]);

  return {
    queueState,
    runtimeClaimsState,
    runtimeLoopHistoryState,
    runtimeLoopRecoveryReceiptsState,
    runtimeLoopRecoveryRuntimeCycleHistoryState,
    runtimeLoopRecoveryRuntimeCycleReceiptsState,
    coordinationBackpressureHistoryState,
    coordinationBackpressureLoopHistoryState
  };
}

export function buildGithubWebhookServiceRuntimeOpsReview(state = {}, options = {}) {
  const queueState = state.queueState ?? {};
  const runtimeClaimsState = state.runtimeClaimsState ?? {};
  const runtimeLoopHistoryState = state.runtimeLoopHistoryState ?? {};
  const runtimeLoopRecoveryReceiptsState = state.runtimeLoopRecoveryReceiptsState ?? {};
  const runtimeLoopRecoveryRuntimeCycleHistoryState = state.runtimeLoopRecoveryRuntimeCycleHistoryState ?? {};
  const runtimeLoopRecoveryRuntimeCycleReceiptsState = state.runtimeLoopRecoveryRuntimeCycleReceiptsState ?? {};
  const coordinationBackpressureHistoryState = state.coordinationBackpressureHistoryState ?? {};
  const coordinationBackpressureLoopHistoryState = state.coordinationBackpressureLoopHistoryState ?? {};

  const queueEntries = Array.isArray(queueState.queue) ? queueState.queue : [];
  const queueSummary = {
    queueCount: queueEntries.length,
    pendingCount: Array.isArray(queueState.pendingQueue) ? queueState.pendingQueue.length : 0,
    claimedCount: Array.isArray(queueState.claimedQueue) ? queueState.claimedQueue.length : 0,
    blockedCount: Array.isArray(queueState.blockedQueue) ? queueState.blockedQueue.length : 0,
    deadLetterCount: Array.isArray(queueState.deadLetterQueue) ? queueState.deadLetterQueue.length : 0
  };

  const runtimeClaims = Array.isArray(runtimeClaimsState.claims) ? runtimeClaimsState.claims : [];
  const workerIds = [...new Set(runtimeClaims.map((claim) => claim.workerId).filter(Boolean))].sort();
  const runtimeClaimsSummary = {
    activeClaimCount: runtimeClaims.length,
    workerCount: workerIds.length,
    workers: workerIds,
    laneCount: [...new Set(runtimeClaims.map((claim) => claim.laneKey).filter(Boolean))].length
  };

  const runtimeLoopHistoryReview = buildGithubWebhookServiceRuntimeLoopHistoryReview(runtimeLoopHistoryState, {
    generatedAt: options.generatedAt,
    limit: options.limit
  });
  const runtimeLoopRecoveryReceiptsReview = buildGithubWebhookServiceRuntimeLoopRecoveryReceiptsReview(runtimeLoopRecoveryReceiptsState, {
    generatedAt: options.generatedAt,
    limit: options.limit
  });
  const runtimeLoopRecoveryRuntimeCycleHistoryReview = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview(runtimeLoopRecoveryRuntimeCycleHistoryState, {
    generatedAt: options.generatedAt,
    limit: options.limit
  });
  const runtimeLoopRecoveryRuntimeCycleReceiptsReview = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview(runtimeLoopRecoveryRuntimeCycleReceiptsState, {
    generatedAt: options.generatedAt,
    limit: options.limit
  });
  const coordinationBackpressureHistoryReview = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview(coordinationBackpressureHistoryState, {
    generatedAt: options.generatedAt,
    limit: options.limit
  });
  const coordinationBackpressureLoopHistoryReview = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview(coordinationBackpressureLoopHistoryState, {
    generatedAt: options.generatedAt,
    limit: options.limit
  });
  const coordinationBackpressureLoopRecoveryReview = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview(coordinationBackpressureLoopHistoryState, {
    generatedAt: options.generatedAt,
    limit: options.limit
  });

  const actions = [];
  if (queueSummary.deadLetterCount > 0) {
    pushAction(actions, "critical", "queue_dead_letter", "Dead-letter contracts need manual review", `${queueSummary.deadLetterCount} queued contract(s) are in dead-letter state.`, "Run github-app-service-review or github-app-service-requeue against dead-letter entries.");
  }
  if (runtimeLoopRecoveryReceiptsReview.exhaustedCount > 0) {
    pushAction(actions, "critical", "runtime_loop_recovery_exhausted", "Some runtime-loop recoveries are exhausted", `${runtimeLoopRecoveryReceiptsReview.exhaustedCount} recovery receipt(s) ran out of attempts.`, runtimeLoopRecoveryReceiptsReview.nextAction);
  }
  if (coordinationBackpressureLoopRecoveryReview.dispatchReadyCount > 0) {
    pushAction(actions, "high", "coordination_backpressure_loop_recovery_ready", "A backpressure loop recovery is ready", `${coordinationBackpressureLoopRecoveryReview.dispatchReadyCount} backpressure loop recovery candidate(s) are dispatch-ready.`, coordinationBackpressureLoopRecoveryReview.nextAction);
  }
  if (runtimeLoopRecoveryReceiptsReview.openCount > 0) {
    pushAction(actions, "high", "runtime_loop_recovery_open", "Runtime-loop recovery work is waiting", `${runtimeLoopRecoveryReceiptsReview.openCount} runtime-loop recovery receipt(s) can be retried now.`, runtimeLoopRecoveryReceiptsReview.nextAction);
  }
  if (runtimeLoopRecoveryRuntimeCycleReceiptsReview.openCount > 0) {
    pushAction(actions, "high", "recovery_cycle_resume_ready", "Recovery-runtime cycles are resumable", `${runtimeLoopRecoveryRuntimeCycleReceiptsReview.openCount} recovery-runtime cycle receipt(s) can be resumed now.`, runtimeLoopRecoveryRuntimeCycleReceiptsReview.nextAction);
  }
  if (queueSummary.blockedCount > 0 || queueSummary.claimedCount > 0) {
    pushAction(actions, "medium", "service_queue_attention", "Queue still has blocked or claimed contracts", `${queueSummary.blockedCount} blocked and ${queueSummary.claimedCount} claimed contract(s) are waiting in the service queue.`, "Inspect queue holds and active claims before starting more runtime work.");
  }
  if (coordinationBackpressureHistoryReview.escalatedCount > 0) {
    pushAction(actions, "medium", "coordination_backpressure_escalated", "Coordination backpressure escalations exist", `${coordinationBackpressureHistoryReview.escalatedCount} escalated coordination-group backpressure follow-up(s) appear in recent history.`, coordinationBackpressureHistoryReview.nextAction);
  }
  if (coordinationBackpressureLoopHistoryReview.resumableCount > 0) {
    pushAction(actions, "medium", "coordination_backpressure_loop_resumable", "Backpressure loops still have remaining budget", `${coordinationBackpressureLoopHistoryReview.resumableCount} persisted backpressure loop(s) are resumable.`, coordinationBackpressureLoopHistoryReview.nextAction);
  }
  if (runtimeClaimsSummary.activeClaimCount > 0) {
    pushAction(actions, "low", "runtime_claims_active", "Runtime lanes are currently claimed", `${runtimeClaimsSummary.activeClaimCount} runtime lane claim(s) are active across ${runtimeClaimsSummary.workerCount} worker(s).`, "Verify that long-lived lane claims still correspond to active runtime workers.");
  }

  const prioritizedActions = sortActions(actions);
  const healthStatus = prioritizedActions.some((action) => action.severity === "critical")
    ? "critical_attention"
    : prioritizedActions.length > 0
      ? "attention_required"
      : "healthy";

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    healthStatus,
    queueSummary,
    runtimeClaimsSummary,
    runtimeLoopHistoryReview,
    runtimeLoopRecoveryReceiptsReview,
    runtimeLoopRecoveryRuntimeCycleHistoryReview,
    runtimeLoopRecoveryRuntimeCycleReceiptsReview,
    coordinationBackpressureHistoryReview,
    coordinationBackpressureLoopHistoryReview,
    coordinationBackpressureLoopRecoveryReview,
    prioritizedActions,
    nextAction: prioritizedActions[0]?.nextAction ?? "GitHub App service runtime currently looks healthy."
  };
}

export function renderGithubWebhookServiceRuntimeOpsSummary(review) {
  const actionLines = review.prioritizedActions.length > 0
    ? review.prioritizedActions.map((action) => `- severity=${action.severity} | key=${action.key} | title=${action.title} | detail=${action.detail} | next=${action.nextAction}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Ops Review

- generated_at: ${review.generatedAt}
- health_status: ${review.healthStatus}
- queue_count: ${review.queueSummary.queueCount}
- pending_count: ${review.queueSummary.pendingCount}
- claimed_count: ${review.queueSummary.claimedCount}
- blocked_count: ${review.queueSummary.blockedCount}
- dead_letter_count: ${review.queueSummary.deadLetterCount}
- active_runtime_claims: ${review.runtimeClaimsSummary.activeClaimCount}
- runtime_claim_workers: ${review.runtimeClaimsSummary.workerCount}
- runtime_loop_history_count: ${review.runtimeLoopHistoryReview.historyCount}
- runtime_loop_recovery_open_count: ${review.runtimeLoopRecoveryReceiptsReview.openCount}
- runtime_loop_recovery_exhausted_count: ${review.runtimeLoopRecoveryReceiptsReview.exhaustedCount}
- recovery_cycle_history_count: ${review.runtimeLoopRecoveryRuntimeCycleHistoryReview.historyCount}
- recovery_cycle_open_count: ${review.runtimeLoopRecoveryRuntimeCycleReceiptsReview.openCount}
- coordination_backpressure_history_count: ${review.coordinationBackpressureHistoryReview.historyCount}
- coordination_backpressure_escalated_count: ${review.coordinationBackpressureHistoryReview.escalatedCount}
- coordination_backpressure_loop_history_count: ${review.coordinationBackpressureLoopHistoryReview.historyCount}
- coordination_backpressure_loop_recovery_ready_count: ${review.coordinationBackpressureLoopRecoveryReview.dispatchReadyCount}

## Prioritized Actions

${actionLines}

## Next Action

- ${review.nextAction}
`;
}
