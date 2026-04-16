import { classifyGithubWebhookServiceQueueEntry } from "./classification.mjs";
import {
  applyInstallationServiceLaneSelection,
  compareActionableServiceEntries,
  installationPriorityRank
} from "./shared.mjs";

function tickStrategyRank(strategy) {
  switch (strategy) {
    case "recovery_first":
      return 0;
    case "priority_first":
      return 1;
    case "balanced":
      return 2;
    case "manual_dispatch":
      return 3;
    default:
      return 4;
  }
}

function summarizeLane(entries = []) {
  const actionableEntries = entries.filter((entry) => entry.actionable);
  const blockedEntries = entries.filter((entry) => entry.blocked);
  const firstEntry = entries[0] ?? {};
  const selectedEntries = applyInstallationServiceLaneSelection(actionableEntries, {});
  const installationIds = [...new Set(entries
    .map((entry) => Number.isFinite(entry.installationId) ? Number(entry.installationId) : null)
    .filter((value) => value != null))];
  const preferredWorkerId = [...new Set(entries.map((entry) => entry.assignedWorkerId).filter(Boolean))][0] ?? null;
  const allowedWorkerIds = [...new Set(entries.flatMap((entry) => Array.isArray(entry.allowedWorkerIds) ? entry.allowedWorkerIds : []).filter(Boolean))];
  const workerScope = [...new Set(entries.map((entry) => entry.workerMode).filter(Boolean))][0] ?? "shared_pool";
  const priority = [...entries]
    .sort((left, right) => installationPriorityRank(left.installationPlanPriority) - installationPriorityRank(right.installationPlanPriority))[0]?.installationPlanPriority
    ?? "normal";
  const tickStrategy = [...entries]
    .sort((left, right) => tickStrategyRank(left.tickStrategy) - tickStrategyRank(right.tickStrategy))[0]?.tickStrategy
    ?? "balanced";

  return {
    laneKey: firstEntry.installationScheduleLaneKey ?? "unscoped:shared_pool",
    schedulerLane: firstEntry.schedulerLane ?? "shared_default",
    workerScope,
    preferredWorkerId,
    allowedWorkerIds,
    installationIds,
    priority,
    tickStrategy,
    queueCount: entries.length,
    actionableCount: actionableEntries.length,
    blockedCount: blockedEntries.length,
    selectedCount: selectedEntries.length,
    entries,
    selectedEntries,
    status: selectedEntries.length > 0
      ? "dispatch_ready"
      : actionableEntries.length > 0
        ? "actionable_unselected"
        : blockedEntries.length > 0
          ? "blocked"
          : "idle",
    nextAction: selectedEntries.length > 0
      ? "Run the service tick for this scheduler lane."
      : actionableEntries.length > 0
        ? "This lane has actionable entries, but none were selected after lane and schedule caps."
        : blockedEntries.length > 0
          ? "This lane is currently blocked by installation, schedule or worker gates."
          : "No contracts are currently queued for this lane."
  };
}

function compareSchedulerLanes(left, right) {
  const statusRank = (status) => {
    switch (status) {
      case "dispatch_ready":
        return 0;
      case "actionable_unselected":
        return 1;
      case "blocked":
        return 2;
      default:
        return 3;
    }
  };

  const statusDiff = statusRank(left.status) - statusRank(right.status);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const strategyDiff = tickStrategyRank(left.tickStrategy) - tickStrategyRank(right.tickStrategy);
  if (strategyDiff !== 0) {
    return strategyDiff;
  }

  const priorityDiff = installationPriorityRank(left.priority) - installationPriorityRank(right.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const selectedA = left.selectedEntries[0];
  const selectedB = right.selectedEntries[0];
  if (selectedA && selectedB) {
    return compareActionableServiceEntries(selectedA, selectedB);
  }

  return String(left.laneKey).localeCompare(String(right.laneKey));
}

export function buildGithubWebhookServiceSchedulerPlan(queueEntries = [], options = {}) {
  const classifiedEntries = queueEntries.map((entry) => classifyGithubWebhookServiceQueueEntry(entry, options));
  const laneMap = new Map();

  for (const entry of classifiedEntries) {
    const laneKey = entry.installationScheduleLaneKey ?? "unscoped:shared_pool";
    const bucket = laneMap.get(laneKey) ?? [];
    bucket.push(entry);
    laneMap.set(laneKey, bucket);
  }

  let lanes = [...laneMap.values()].map((entries) => summarizeLane(entries)).sort(compareSchedulerLanes);
  const laneLimit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null;
  if (laneLimit) {
    lanes = lanes.slice(0, laneLimit);
  }

  const dispatchableLanes = lanes.filter((lane) => lane.status === "dispatch_ready");

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerId: options.workerId ?? "local-worker",
    schedulerLaneFilter: options.schedulerLane ?? null,
    laneLimit,
    queueCount: classifiedEntries.length,
    laneCount: lanes.length,
    dispatchableLaneCount: dispatchableLanes.length,
    blockedLaneCount: lanes.filter((lane) => lane.status === "blocked").length,
    lanes,
    nextAction: dispatchableLanes.length > 0
      ? "Run one or more dispatch-ready scheduler lanes through lane-scoped service ticks."
      : lanes.length > 0
        ? "No scheduler lane is dispatch-ready yet; inspect blocked lanes or adjust installation runtime policies."
        : "Service queue is empty."
  };
}

export function renderGithubWebhookServiceSchedulerSummary(plan, receipts = []) {
  const laneLines = plan.lanes.length > 0
    ? plan.lanes.map((lane) => `- lane=${lane.laneKey}: status=${lane.status} | scheduler=${lane.schedulerLane} | worker_scope=${lane.workerScope} | preferred_worker=${lane.preferredWorkerId ?? "-"} | priority=${lane.priority} | strategy=${lane.tickStrategy} | queue=${lane.queueCount} | actionable=${lane.actionableCount} | selected=${lane.selectedCount} | blocked=${lane.blockedCount}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- lane=${receipt.laneKey}: outcome=${receipt.outcome} | selected=${receipt.selectedCount ?? 0} | target=${receipt.targetState ?? "-"}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Scheduler

- generated_at: ${plan.generatedAt}
- worker_id: ${plan.workerId}
- scheduler_lane_filter: ${plan.schedulerLaneFilter ?? "-"}
- lane_limit: ${plan.laneLimit ?? "-"}
- queue_count: ${plan.queueCount}
- lane_count: ${plan.laneCount}
- dispatchable_lane_count: ${plan.dispatchableLaneCount}
- blocked_lane_count: ${plan.blockedLaneCount}

## Scheduler Lanes

${laneLines}

## Scheduler Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}
