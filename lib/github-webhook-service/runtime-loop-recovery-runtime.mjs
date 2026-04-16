import {
  evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt
} from "./runtime-loop-recovery-receipts.mjs";

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

function normalizeSchedulerLane(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "unscoped";
}

function compareRecoveryCandidates(left, right) {
  const selectedDiff = Number(right.receipt.selectedCount ?? 0) - Number(left.receipt.selectedCount ?? 0);
  if (selectedDiff !== 0) {
    return selectedDiff;
  }

  const attemptDiff = Number(left.receipt.attemptCount ?? 0) - Number(right.receipt.attemptCount ?? 0);
  if (attemptDiff !== 0) {
    return attemptDiff;
  }

  const leftGeneratedAt = new Date(left.receipt.generatedAt ?? 0).getTime();
  const rightGeneratedAt = new Date(right.receipt.generatedAt ?? 0).getTime();
  if (rightGeneratedAt !== leftGeneratedAt) {
    return rightGeneratedAt - leftGeneratedAt;
  }

  return String(left.receipt.receiptId).localeCompare(String(right.receipt.receiptId));
}

function runtimeStatusRank(status) {
  switch (status) {
    case "dispatch_ready":
      return 0;
    case "selection_capped":
      return 1;
    case "no_worker_match":
      return 2;
    case "lane_backoff_pending":
      return 3;
    case "lane_conflict":
      return 4;
    case "manual_review":
      return 5;
    case "backoff_pending":
      return 6;
    case "exhausted":
      return 7;
    case "preview_only":
      return 8;
    case "recovered":
      return 9;
    case "not_required":
      return 10;
    default:
      return 11;
  }
}

function compareBlockedReceipts(left, right) {
  const statusDiff = runtimeStatusRank(left.runtimeStatus) - runtimeStatusRank(right.runtimeStatus);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const selectedDiff = Number(right.receipt.selectedCount ?? 0) - Number(left.receipt.selectedCount ?? 0);
  if (selectedDiff !== 0) {
    return selectedDiff;
  }

  return String(left.receipt.receiptId).localeCompare(String(right.receipt.receiptId));
}

function normalizeLaneGroup(laneKey) {
  return {
    laneKey,
    openReady: [],
    backoffPending: [],
    manualReview: [],
    previewOnly: [],
    exhausted: [],
    recovered: [],
    notRequired: []
  };
}

function groupEvaluatedReceiptsByLane(evaluatedReceipts = []) {
  const groups = new Map();

  for (const entry of evaluatedReceipts) {
    const laneKey = normalizeSchedulerLane(entry.receipt.schedulerLane);
    const group = groups.get(laneKey) ?? normalizeLaneGroup(laneKey);

    switch (entry.effectiveReceiptState) {
      case "open_ready":
        group.openReady.push(entry);
        break;
      case "backoff_pending":
        group.backoffPending.push(entry);
        break;
      case "manual_review":
        group.manualReview.push(entry);
        break;
      case "preview_only":
        group.previewOnly.push(entry);
        break;
      case "exhausted":
        group.exhausted.push(entry);
        break;
      case "recovered":
        group.recovered.push(entry);
        break;
      default:
        group.notRequired.push(entry);
        break;
    }

    groups.set(laneKey, group);
  }

  return groups;
}

function createBlockedReceipt(entry, runtimeStatus, nextAction, extra = {}) {
  return {
    receipt: entry.receipt,
    effectiveReceiptState: entry.effectiveReceiptState,
    runtimeStatus,
    schedulerLane: normalizeSchedulerLane(entry.receipt.schedulerLane),
    runtimeWorkerId: extra.runtimeWorkerId ?? null,
    workerPool: extra.workerPool ?? (Array.isArray(entry.receipt.workerIds) ? entry.receipt.workerIds : []),
    nextAction,
    blockedUntil: entry.blockedUntil ?? null
  };
}

function resolveWorkerPool(receipt, workerIds) {
  const preferredPool = Array.isArray(receipt.workerIds)
    ? receipt.workerIds
      .map((workerId) => String(workerId ?? "").trim())
      .filter(Boolean)
    : [];

  if (preferredPool.length === 0) {
    return [...workerIds];
  }

  return workerIds.filter((workerId) => preferredPool.includes(workerId));
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

function summarizeRuntime(workerId, assignments = []) {
  const sortedAssignments = [...assignments].sort((left, right) => {
    const selectedDiff = Number(right.receipt.selectedCount ?? 0) - Number(left.receipt.selectedCount ?? 0);
    if (selectedDiff !== 0) {
      return selectedDiff;
    }
    return String(left.receipt.receiptId).localeCompare(String(right.receipt.receiptId));
  });

  return {
    runtimeKey: `recovery-worker:${workerId}`,
    workerId,
    receiptCount: sortedAssignments.length,
    laneCount: new Set(sortedAssignments.map((assignment) => assignment.schedulerLane)).size,
    selectedCount: sortedAssignments.reduce((sum, assignment) => sum + Number(assignment.receipt.selectedCount ?? 0), 0),
    assignments: sortedAssignments,
    status: sortedAssignments.length > 0 ? "dispatch_ready" : "idle",
    nextAction: sortedAssignments.length > 0
      ? "Recover the assigned runtime-loop receipts for this worker."
      : "No runtime-loop recovery receipt is currently assigned to this worker."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimePlan(state, options = {}) {
  const workerIds = normalizeWorkerIds(options);
  const evaluatedReceipts = (Array.isArray(state?.receipts) ? state.receipts : [])
    .map((receipt) => evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt(receipt, { now: options.now }))
    .sort(compareRecoveryCandidates);
  const groups = groupEvaluatedReceiptsByLane(evaluatedReceipts);
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null;
  const roundRobinState = {
    index: 0,
    counts: new Map(workerIds.map((workerId) => [workerId, 0]))
  };
  const runtimeBuckets = new Map(workerIds.map((workerId) => [workerId, []]));
  const selectedReceipts = [];
  const blockedReceipts = [];
  const lanePlans = [];

  const sortedGroups = [...groups.values()].sort((left, right) =>
    String(left.laneKey).localeCompare(String(right.laneKey))
  );

  for (const group of sortedGroups) {
    const sortedOpenReady = [...group.openReady].sort(compareRecoveryCandidates);
    const primary = sortedOpenReady[0] ?? null;
    const secondary = sortedOpenReady.slice(1);

    for (const entry of group.backoffPending) {
      blockedReceipts.push(createBlockedReceipt(
        entry,
        "backoff_pending",
        entry.nextAction
      ));
    }
    for (const entry of group.manualReview) {
      blockedReceipts.push(createBlockedReceipt(
        entry,
        "manual_review",
        entry.nextAction
      ));
    }
    for (const entry of group.previewOnly) {
      blockedReceipts.push(createBlockedReceipt(
        entry,
        "preview_only",
        entry.nextAction
      ));
    }
    for (const entry of group.exhausted) {
      blockedReceipts.push(createBlockedReceipt(
        entry,
        "exhausted",
        entry.nextAction
      ));
    }
    for (const entry of group.recovered) {
      blockedReceipts.push(createBlockedReceipt(
        entry,
        "recovered",
        entry.nextAction
      ));
    }
    for (const entry of group.notRequired) {
      blockedReceipts.push(createBlockedReceipt(
        entry,
        "not_required",
        entry.nextAction
      ));
    }

    if (!primary) {
      lanePlans.push({
        laneKey: group.laneKey,
        status: group.backoffPending.length > 0
          ? "backoff_pending"
          : group.manualReview.length > 0
            ? "manual_review"
            : group.previewOnly.length > 0
              ? "preview_only"
              : group.exhausted.length > 0
                ? "exhausted"
                : group.recovered.length > 0
                  ? "recovered"
                  : "idle",
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: 0,
        blockedCount: group.backoffPending.length
          + group.manualReview.length
          + group.previewOnly.length
          + group.exhausted.length
          + group.recovered.length
          + group.notRequired.length,
        nextAction: group.backoffPending.length > 0
          ? "Wait for the active backoff window on this scheduler lane."
          : "No open runtime-loop recovery receipt is currently available on this scheduler lane."
      });
      continue;
    }

    const hasBackoffConflict = group.backoffPending.length > 0;
    if (hasBackoffConflict) {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "lane_backoff_pending",
        "This scheduler lane already has a receipt waiting for its backoff window; resolve or release it before recovering another receipt on the same lane."
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "lane_conflict",
          "Another open recovery receipt on this scheduler lane already has higher priority."
        ));
      }
      lanePlans.push({
        laneKey: group.laneKey,
        status: "lane_backoff_pending",
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedOpenReady.length,
        blockedCount: sortedOpenReady.length + group.backoffPending.length,
        nextAction: "Wait until the current backoff receipt on this lane becomes eligible again."
      });
      continue;
    }

    if (!primary.receipt.recoveryContractPath) {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "missing_recovery_contract",
        "This open recovery receipt is missing its recovery contract path."
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "lane_conflict",
          "Another open recovery receipt on this scheduler lane already has higher priority."
        ));
      }
      lanePlans.push({
        laneKey: group.laneKey,
        status: "missing_recovery_contract",
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedOpenReady.length,
        blockedCount: sortedOpenReady.length,
        nextAction: "Repair or regenerate the recovery contract before running this lane."
      });
      continue;
    }

    if (limit && selectedReceipts.length >= limit) {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "selection_capped",
        "This receipt is open, but the current recovery-runtime selection limit has been reached."
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "lane_conflict",
          "Another open recovery receipt on this scheduler lane already has higher priority."
        ));
      }
      lanePlans.push({
        laneKey: group.laneKey,
        status: "selection_capped",
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedOpenReady.length,
        blockedCount: sortedOpenReady.length,
        nextAction: "Raise the selection limit or run another recovery-runtime pass for this lane."
      });
      continue;
    }

    const workerPool = resolveWorkerPool(primary.receipt, workerIds);
    if (workerPool.length === 0) {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "no_worker_match",
        "No available worker matches the worker pool encoded in this recovery receipt.",
        { workerPool: Array.isArray(primary.receipt.workerIds) ? primary.receipt.workerIds : [] }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "lane_conflict",
          "Another open recovery receipt on this scheduler lane already has higher priority."
        ));
      }
      lanePlans.push({
        laneKey: group.laneKey,
        status: "no_worker_match",
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedOpenReady.length,
        blockedCount: sortedOpenReady.length,
        nextAction: "Widen the worker pool or change worker assignment before expecting auto-recovery on this lane."
      });
      continue;
    }

    const runtimeWorkerId = selectLeastLoadedWorker(workerPool, roundRobinState);
    const assignment = {
      receipt: primary.receipt,
      effectiveReceiptState: primary.effectiveReceiptState,
      runtimeStatus: "dispatch_ready",
      runtimeWorkerId,
      schedulerLane: group.laneKey,
      workerPool,
      blockedUntil: primary.blockedUntil ?? null,
      conflictCount: secondary.length,
      nextAction: `Recover this runtime-loop receipt on worker '${runtimeWorkerId}'.`
    };
    selectedReceipts.push(assignment);
    runtimeBuckets.get(runtimeWorkerId)?.push(assignment);

    for (const entry of secondary) {
      blockedReceipts.push(createBlockedReceipt(
        entry,
        "lane_conflict",
        "Another open recovery receipt on this scheduler lane already has higher priority.",
        { runtimeWorkerId }
      ));
    }

    lanePlans.push({
      laneKey: group.laneKey,
      status: "dispatch_ready",
      workerId: runtimeWorkerId,
      selectedReceiptId: primary.receipt.receiptId,
      openReadyCount: sortedOpenReady.length,
      blockedCount: secondary.length,
      nextAction: `Recover the selected receipt on worker '${runtimeWorkerId}'.`
    });
  }

  const runtimes = [...runtimeBuckets.entries()]
    .map(([workerId, assignments]) => summarizeRuntime(workerId, assignments))
    .sort((left, right) => String(left.workerId).localeCompare(String(right.workerId)));
  const sortedBlockedReceipts = blockedReceipts.sort(compareBlockedReceipts);

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerIds,
    workerId: options.workerId ?? workerIds[0] ?? "local-worker",
    receiptCount: Array.isArray(state?.receipts) ? state.receipts.length : 0,
    reviewCount: evaluatedReceipts.length,
    laneCount: groups.size,
    runtimeCount: runtimes.length,
    selectedCount: selectedReceipts.length,
    blockedCount: sortedBlockedReceipts.length,
    openCount: evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "open_ready").length,
    backoffPendingCount: evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "backoff_pending").length,
    manualReviewCount: evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "manual_review").length,
    previewOnlyCount: evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "preview_only").length,
    exhaustedCount: evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "exhausted").length,
    recoveredCount: evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "recovered").length,
    lanePlans: lanePlans.sort((left, right) => String(left.laneKey).localeCompare(String(right.laneKey))),
    runtimes,
    selectedReceipts,
    blockedReceipts: sortedBlockedReceipts,
    nextAction: selectedReceipts.length > 0
      ? "Run the assigned runtime-loop recoveries for each worker or let the recovery runtime execute them in one pass."
      : sortedBlockedReceipts.some((entry) => entry.runtimeStatus === "backoff_pending" || entry.runtimeStatus === "lane_backoff_pending")
        ? "Wait for backoff windows to elapse or manually release blocked runtime-loop recovery receipts."
        : sortedBlockedReceipts.some((entry) => entry.runtimeStatus === "manual_review" || entry.runtimeStatus === "exhausted")
          ? "Review or manually release the blocked runtime-loop recovery receipts before expecting auto-recovery."
          : "No dispatch-ready runtime-loop recovery receipt is currently available."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeSummary(plan) {
  const runtimeLines = plan.runtimes.length > 0
    ? plan.runtimes.map((runtime) => {
      const receiptList = runtime.assignments.length > 0
        ? runtime.assignments.map((assignment) =>
          `${assignment.receipt.receiptId} [lane=${assignment.schedulerLane}, selected=${assignment.receipt.selectedCount}, attempts=${assignment.receipt.attemptCount}/${assignment.receipt.maxAttempts}]`
        ).join("; ")
        : "none";
      return `- worker=${runtime.workerId}: receipts=${runtime.receiptCount} | lanes=${runtime.laneCount} | selected=${runtime.selectedCount} | assignments=${receiptList}`;
    }).join("\n")
    : "- none";
  const blockedLines = plan.blockedReceipts.length > 0
    ? plan.blockedReceipts.slice(0, 20).map((entry) =>
      `- receipt=${entry.receipt.receiptId}: runtime_status=${entry.runtimeStatus} | lane=${entry.schedulerLane} | recovery=${entry.receipt.recoveryStatus} | attempts=${entry.receipt.attemptCount}/${entry.receipt.maxAttempts}${entry.runtimeWorkerId ? ` | worker=${entry.runtimeWorkerId}` : ""}${entry.blockedUntil ? ` | blocked_until=${entry.blockedUntil}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime

- generated_at: ${plan.generatedAt}
- receipt_count: ${plan.receiptCount}
- review_count: ${plan.reviewCount}
- lane_count: ${plan.laneCount}
- runtime_count: ${plan.runtimeCount}
- selected_count: ${plan.selectedCount}
- blocked_count: ${plan.blockedCount}
- open_count: ${plan.openCount}
- backoff_pending_count: ${plan.backoffPendingCount}
- manual_review_count: ${plan.manualReviewCount}
- preview_only_count: ${plan.previewOnlyCount}
- exhausted_count: ${plan.exhaustedCount}
- recovered_count: ${plan.recoveredCount}

## Worker Assignments

${runtimeLines}

## Blocked Receipts

${blockedLines}

## Next Action

- ${plan.nextAction}
`;
}
