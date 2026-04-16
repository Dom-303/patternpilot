import {
  applyInstallationServiceLaneSelection,
  installationPriorityRank
} from "./shared.mjs";
import {
  buildGithubWebhookServiceSchedulerPlan
} from "./scheduler.mjs";
import {
  isExpiredGithubWebhookServiceRuntimeClaim
} from "./runtime-claims.mjs";

function normalizeWorkerIds(options = {}) {
  const workerIds = Array.isArray(options.workerIds)
    ? options.workerIds
    : typeof options.workerIds === "string"
      ? options.workerIds.split(",")
      : [];
  const normalized = [...new Set(workerIds
    .map((value) => String(value ?? "").trim())
    .filter(Boolean))];

  if (normalized.length > 0) {
    return normalized;
  }

  return [options.workerId ?? "local-worker"];
}

function runtimeStatusRank(status) {
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
}

function compareRuntimeLanes(left, right) {
  const statusDiff = runtimeStatusRank(left.status) - runtimeStatusRank(right.status);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const priorityDiff = installationPriorityRank(left.priority) - installationPriorityRank(right.priority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return String(left.laneKey).localeCompare(String(right.laneKey));
}

function selectLeastLoadedWorker(workerPool, state) {
  const candidates = workerPool.map((workerId, index) => ({
    workerId,
    index,
    count: state.counts.get(workerId) ?? 0
  }));
  candidates.sort((left, right) => {
    const countDiff = left.count - right.count;
    if (countDiff !== 0) {
      return countDiff;
    }

    const leftOffset = (left.index - state.index + workerPool.length) % workerPool.length;
    const rightOffset = (right.index - state.index + workerPool.length) % workerPool.length;
    return leftOffset - rightOffset;
  });

  const selected = candidates[0]?.workerId ?? workerPool[0];
  state.counts.set(selected, (state.counts.get(selected) ?? 0) + 1);
  state.index = (workerPool.indexOf(selected) + 1) % workerPool.length;
  return selected;
}

function assignSchedulerLane(lane, workerPool, roundRobinState) {
  if (lane.workerScope === "manual_release") {
    return {
      status: "manual_release",
      workerId: null,
      nextAction: "This runtime lane requires manual worker release before it can run."
    };
  }

  if (lane.preferredWorkerId) {
    if (workerPool.includes(lane.preferredWorkerId)) {
      roundRobinState.counts.set(
        lane.preferredWorkerId,
        (roundRobinState.counts.get(lane.preferredWorkerId) ?? 0) + 1
      );
      return {
        status: "assigned",
        workerId: lane.preferredWorkerId,
        nextAction: `Run this runtime lane on worker '${lane.preferredWorkerId}'.`
      };
    }

    return {
      status: "preferred_worker_unavailable",
      workerId: null,
      nextAction: `The preferred worker '${lane.preferredWorkerId}' is not available in the current worker pool.`
    };
  }

  const allowedWorkerIds = Array.isArray(lane.allowedWorkerIds)
    ? lane.allowedWorkerIds.filter(Boolean)
    : [];
  if (lane.workerScope === "allowed_pool") {
    const matchingWorkerIds = workerPool.filter((workerId) => allowedWorkerIds.includes(workerId));
    const matchingWorker = matchingWorkerIds.length > 0
      ? selectLeastLoadedWorker(matchingWorkerIds, roundRobinState)
      : null;
    if (matchingWorker) {
      return {
        status: "assigned",
        workerId: matchingWorker,
        nextAction: `Run this runtime lane on allowed worker '${matchingWorker}'.`
      };
    }

    return {
      status: "no_allowed_worker",
      workerId: null,
      nextAction: "No currently available worker matches the allowed worker pool for this runtime lane."
    };
  }

  return {
    status: "assigned",
    workerId: selectLeastLoadedWorker(workerPool, roundRobinState),
    nextAction: "Run this shared runtime lane on the assigned worker."
  };
}

function summarizeRuntime(workerId, lanes = []) {
  const sortedLanes = [...lanes].sort(compareRuntimeLanes);
  const dispatchableLanes = sortedLanes.filter((lane) => lane.status === "dispatch_ready");

  return {
    runtimeKey: `worker:${workerId}`,
    workerId,
    laneCount: sortedLanes.length,
    dispatchableLaneCount: dispatchableLanes.length,
    blockedLaneCount: sortedLanes.filter((lane) => lane.status === "blocked").length,
    actionableLaneCount: sortedLanes.filter((lane) => lane.status !== "idle").length,
    selectedCount: dispatchableLanes.reduce((sum, lane) => sum + Number(lane.selectedCount ?? 0), 0),
    lanes: sortedLanes,
    status: dispatchableLanes.length > 0
      ? "dispatch_ready"
      : sortedLanes.some((lane) => lane.status === "actionable_unselected")
        ? "actionable_unselected"
        : sortedLanes.some((lane) => lane.status === "blocked")
          ? "blocked"
          : "idle",
    nextAction: dispatchableLanes.length > 0
      ? "Run the assigned scheduler lanes for this worker through lane-scoped service ticks."
      : sortedLanes.length > 0
        ? "This worker has no dispatch-ready runtime lane yet."
        : "No runtime lanes are currently assigned to this worker."
  };
}

function findActiveRuntimeClaim(runtimeClaimState, laneKey, options = {}) {
  const claims = Array.isArray(runtimeClaimState?.claims) ? runtimeClaimState.claims : [];
  return claims.find((claim) => claim.laneKey === laneKey && !isExpiredGithubWebhookServiceRuntimeClaim(claim, options)) ?? null;
}

export function buildGithubWebhookServiceRuntimePlan(queueEntries = [], options = {}) {
  const schedulerPlan = buildGithubWebhookServiceSchedulerPlan(queueEntries, options);
  const workerIds = normalizeWorkerIds(options);
  const roundRobinState = {
    index: 0,
    counts: new Map(workerIds.map((workerId) => [workerId, 0]))
  };
  const runtimeBuckets = new Map(workerIds.map((workerId) => [workerId, []]));
  const blockedLanes = [];

  for (const lane of schedulerPlan.lanes) {
    const activeClaim = findActiveRuntimeClaim(options.runtimeClaimState, lane.laneKey, options);
    if (activeClaim) {
      blockedLanes.push({
        ...lane,
        runtimeStatus: activeClaim.workerId === options.workerId
          ? "runtime_claimed_by_worker"
          : "runtime_claimed_elsewhere",
        runtimeWorkerId: activeClaim.workerId,
        runtimeAction: activeClaim.workerId === options.workerId
          ? `This runtime lane is already claimed by worker '${activeClaim.workerId}'.`
          : `This runtime lane is currently claimed by worker '${activeClaim.workerId}'.`,
        runtimeClaim: activeClaim
      });
      continue;
    }

    const assignment = assignSchedulerLane(lane, workerIds, roundRobinState);
    if (assignment.status === "assigned" && assignment.workerId) {
      const effectiveLane = {
        ...lane,
        runtimeStatus: assignment.status,
        runtimeWorkerId: assignment.workerId,
        runtimeAction: assignment.nextAction,
        selectedEntries: applyInstallationServiceLaneSelection(lane.selectedEntries ?? [], {})
      };
      runtimeBuckets.get(assignment.workerId)?.push(effectiveLane);
      continue;
    }

    blockedLanes.push({
      ...lane,
      runtimeStatus: assignment.status,
      runtimeWorkerId: null,
      runtimeAction: assignment.nextAction
    });
  }

  const runtimes = [...runtimeBuckets.entries()]
    .map(([workerId, lanes]) => summarizeRuntime(workerId, lanes))
    .sort((left, right) => {
      const statusDiff = runtimeStatusRank(left.status) - runtimeStatusRank(right.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return String(left.workerId).localeCompare(String(right.workerId));
    });
  const dispatchableRuntimeCount = runtimes.filter((runtime) => runtime.status === "dispatch_ready").length;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerIds,
    workerId: options.workerId ?? workerIds[0] ?? "local-worker",
    schedulerLaneFilter: options.schedulerLane ?? null,
    queueCount: schedulerPlan.queueCount,
    laneCount: schedulerPlan.laneCount,
    runtimeCount: runtimes.length,
    dispatchableRuntimeCount,
    blockedLaneCount: blockedLanes.length,
    runtimes,
    blockedLanes,
    nextAction: dispatchableRuntimeCount > 0
      ? "Run one or more worker runtimes to process their assigned scheduler lanes."
      : blockedLanes.length > 0
        ? "Review blocked runtime lanes or widen the worker pool before expecting multi-worker execution."
        : schedulerPlan.laneCount > 0
          ? "No worker runtime is dispatch-ready yet."
          : "Service queue is empty."
  };
}

export function renderGithubWebhookServiceRuntimeSummary(plan, receipts = []) {
  const runtimeLines = plan.runtimes.length > 0
    ? plan.runtimes.map((runtime) => `- worker=${runtime.workerId}: status=${runtime.status} | lanes=${runtime.laneCount} | dispatchable=${runtime.dispatchableLaneCount} | selected=${runtime.selectedCount}`).join("\n")
    : "- none";
  const blockedLines = plan.blockedLanes.length > 0
    ? plan.blockedLanes.map((lane) => `- lane=${lane.laneKey}: runtime_status=${lane.runtimeStatus} | worker_scope=${lane.workerScope} | preferred_worker=${lane.preferredWorkerId ?? "-"} | action=${lane.runtimeAction}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- worker=${receipt.workerId}: outcome=${receipt.outcome} | lanes=${receipt.laneCount ?? 0} | selected=${receipt.selectedCount ?? 0}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime

- generated_at: ${plan.generatedAt}
- worker_ids: ${plan.workerIds.join(", ")}
- scheduler_lane_filter: ${plan.schedulerLaneFilter ?? "-"}
- queue_count: ${plan.queueCount}
- lane_count: ${plan.laneCount}
- runtime_count: ${plan.runtimeCount}
- dispatchable_runtime_count: ${plan.dispatchableRuntimeCount}
- blocked_lane_count: ${plan.blockedLaneCount}

## Worker Runtimes

${runtimeLines}

## Blocked Runtime Lanes

${blockedLines}

## Runtime Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}
