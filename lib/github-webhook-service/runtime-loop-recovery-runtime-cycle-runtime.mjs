import {
  evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt
} from "./runtime-loop-recovery-runtime-cycle-receipts.mjs";
import {
  evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure
} from "./runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure.mjs";
import {
  evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyCoordination
} from "./runtime-loop-recovery-runtime-cycle-runtime-coordination.mjs";
import {
  evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyGovernance
} from "./runtime-loop-recovery-runtime-cycle-runtime-governance.mjs";

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

function buildWorkerFamilyKey(workerIds = []) {
  const normalized = [...new Set((Array.isArray(workerIds) ? workerIds : [])
    .map((workerId) => String(workerId ?? "").trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  return normalized.length > 0 ? normalized.join("|") : "unscoped";
}

function compareCycleCandidates(left, right) {
  const selectedDiff = Number(right.receipt.totalSelectedCount ?? 0) - Number(left.receipt.totalSelectedCount ?? 0);
  if (selectedDiff !== 0) {
    return selectedDiff;
  }

  const executedDiff = Number(left.receipt.totalExecutedCount ?? 0) - Number(right.receipt.totalExecutedCount ?? 0);
  if (executedDiff !== 0) {
    return executedDiff;
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
    case "family_hold_manual":
      return 1;
    case "family_backpressure":
      return 2;
    case "family_budget_exhausted":
      return 3;
    case "coordination_hold":
      return 4;
    case "coordination_escalated":
      return 5;
    case "coordination_backpressure":
      return 6;
    case "coordination_group_escalated":
      return 7;
    case "family_worker_restricted":
      return 8;
    case "selection_capped":
      return 9;
    case "no_worker_match":
      return 10;
    case "family_conflict":
      return 11;
    case "resumed":
      return 12;
    case "not_required":
      return 13;
    default:
      return 14;
  }
}

function compareBlockedReceipts(left, right) {
  const statusDiff = runtimeStatusRank(left.runtimeStatus) - runtimeStatusRank(right.runtimeStatus);
  if (statusDiff !== 0) {
    return statusDiff;
  }

  const selectedDiff = Number(right.receipt.totalSelectedCount ?? 0) - Number(left.receipt.totalSelectedCount ?? 0);
  if (selectedDiff !== 0) {
    return selectedDiff;
  }

  return String(left.receipt.receiptId).localeCompare(String(right.receipt.receiptId));
}

function createBlockedReceipt(entry, runtimeStatus, nextAction, extra = {}) {
  return {
    receipt: entry.receipt,
    effectiveReceiptState: entry.effectiveReceiptState,
    runtimeStatus,
    workerFamilyKey: extra.workerFamilyKey ?? buildWorkerFamilyKey(entry.receipt.workerIds),
    runtimeWorkerId: extra.runtimeWorkerId ?? null,
    workerPool: extra.workerPool ?? (Array.isArray(entry.receipt.workerIds) ? entry.receipt.workerIds : []),
    governanceStatus: extra.governanceStatus ?? null,
    nextAction
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

function selectRuntimeWorker(workerPool, state, preferredWorkerId = null) {
  const preferred = preferredWorkerId ? String(preferredWorkerId).trim() : "";
  if (preferred && workerPool.includes(preferred)) {
    state.counts.set(preferred, (state.counts.get(preferred) ?? 0) + 1);
    state.index = (workerPool.indexOf(preferred) + 1) % workerPool.length;
    return preferred;
  }

  return selectLeastLoadedWorker(workerPool, state);
}

function summarizeRuntime(workerId, assignments = []) {
  const sortedAssignments = [...assignments].sort((left, right) => {
    const selectedDiff = Number(right.receipt.totalSelectedCount ?? 0) - Number(left.receipt.totalSelectedCount ?? 0);
    if (selectedDiff !== 0) {
      return selectedDiff;
    }
    return String(left.receipt.receiptId).localeCompare(String(right.receipt.receiptId));
  });

  return {
    runtimeKey: `recovery-cycle-worker:${workerId}`,
    workerId,
    receiptCount: sortedAssignments.length,
    familyCount: new Set(sortedAssignments.map((assignment) => assignment.workerFamilyKey)).size,
    selectedCount: sortedAssignments.reduce((sum, assignment) => sum + Number(assignment.receipt.totalSelectedCount ?? 0), 0),
    assignments: sortedAssignments,
    status: sortedAssignments.length > 0 ? "dispatch_ready" : "idle",
    nextAction: sortedAssignments.length > 0
      ? "Resume the assigned recovery-runtime cycles for this worker."
      : "No recovery-runtime cycle receipt is currently assigned to this worker."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan(state, options = {}) {
  const workerIds = normalizeWorkerIds(options);
  const governanceFamilies = Array.isArray(options.governanceState?.families)
    ? options.governanceState.families
    : [];
  const governanceByFamily = new Map(governanceFamilies.map((entry) => [
    buildWorkerFamilyKey(entry.workerFamilyKey?.split?.("|") ?? [entry.workerFamilyKey]),
    entry
  ]));
  const coordinationFamilies = Array.isArray(options.coordinationState?.families)
    ? options.coordinationState.families
    : [];
  const coordinationByFamily = new Map(coordinationFamilies.map((entry) => [
    buildWorkerFamilyKey(entry.workerFamilyKey?.split?.("|") ?? [entry.workerFamilyKey]),
    entry
  ]));
  const coordinationBackpressureGroups = Array.isArray(options.coordinationBackpressureState?.groups)
    ? options.coordinationBackpressureState.groups
    : [];
  const coordinationBackpressureByGroup = new Map(coordinationBackpressureGroups.map((entry) => [
    String(entry.coordinationGroupKey ?? "").trim() || "unscoped",
    entry
  ]));
  const coordinationBackpressureByFamily = new Map(
    coordinationBackpressureGroups.flatMap((entry) =>
      (Array.isArray(entry.workerFamilyKeys) ? entry.workerFamilyKeys : [])
        .map((workerFamilyKey) => [String(workerFamilyKey ?? "").trim() || "unscoped", entry])
    )
  );
  const evaluatedReceipts = (Array.isArray(state?.receipts) ? state.receipts : [])
    .map((receipt) => evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(receipt))
    .sort(compareCycleCandidates);
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null;
  const roundRobinState = {
    index: 0,
    counts: new Map(workerIds.map((workerId) => [workerId, 0]))
  };
  const runtimeBuckets = new Map(workerIds.map((workerId) => [workerId, []]));
  const selectedReceipts = [];
  const blockedReceipts = [];
  const familyPlans = [];

  const families = new Map();
  for (const entry of evaluatedReceipts) {
    const familyKey = buildWorkerFamilyKey(entry.receipt.workerIds);
    const group = families.get(familyKey) ?? [];
    group.push(entry);
    families.set(familyKey, group);
  }

  const sortedFamilies = [...families.entries()].sort((left, right) => left[0].localeCompare(right[0]));
  for (const [familyKey, familyEntries] of sortedFamilies) {
    const sortedEntries = [...familyEntries].sort(compareCycleCandidates);
    const primary = sortedEntries[0] ?? null;
    const secondary = sortedEntries.slice(1);

    if (!primary) {
      continue;
    }

    if (primary.effectiveReceiptState !== "open_ready") {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        primary.effectiveReceiptState,
        primary.nextAction,
        { workerFamilyKey: familyKey }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          entry.effectiveReceiptState,
          entry.nextAction,
          { workerFamilyKey: familyKey }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: primary.effectiveReceiptState,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.filter((entry) => entry.effectiveReceiptState === "open_ready").length,
        blockedCount: sortedEntries.length,
        nextAction: primary.nextAction
      });
      continue;
    }

    if (!primary.receipt.resumeContractPath) {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "missing_resume_contract",
        "This recovery-runtime cycle receipt is missing its resume contract path.",
        { workerFamilyKey: familyKey }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "missing_resume_contract",
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        nextAction: "Repair or regenerate the resume contract before running this worker family."
      });
      continue;
    }

    const governanceEvaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyGovernance(
      governanceByFamily.get(familyKey) ?? null,
      primary.receipt,
      { now: options.now }
    );
    if (governanceEvaluation.effectiveStatus === "family_manual_hold") {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "family_hold_manual",
        governanceEvaluation.nextAction,
        { workerFamilyKey: familyKey, governanceStatus: governanceEvaluation.effectiveStatus }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey, governanceStatus: governanceEvaluation.effectiveStatus }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "family_hold_manual",
        governanceStatus: governanceEvaluation.effectiveStatus,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        nextAction: governanceEvaluation.nextAction
      });
      continue;
    }

    if (governanceEvaluation.effectiveStatus === "family_backpressure") {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "family_backpressure",
        governanceEvaluation.nextAction,
        { workerFamilyKey: familyKey, governanceStatus: governanceEvaluation.effectiveStatus }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey, governanceStatus: governanceEvaluation.effectiveStatus }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "family_backpressure",
        governanceStatus: governanceEvaluation.effectiveStatus,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        nextAction: governanceEvaluation.nextAction
      });
      continue;
    }

    if (governanceEvaluation.effectiveStatus === "family_budget_exhausted") {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "family_budget_exhausted",
        governanceEvaluation.nextAction,
        { workerFamilyKey: familyKey, governanceStatus: governanceEvaluation.effectiveStatus }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey, governanceStatus: governanceEvaluation.effectiveStatus }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "family_budget_exhausted",
        governanceStatus: governanceEvaluation.effectiveStatus,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        nextAction: governanceEvaluation.nextAction
      });
      continue;
    }

    const coordinationEvaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyCoordination(
      coordinationByFamily.get(familyKey) ?? null
    );
    if (coordinationEvaluation.effectiveStatus === "coordination_hold") {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "coordination_hold",
        coordinationEvaluation.nextAction,
        { workerFamilyKey: familyKey, governanceStatus: coordinationEvaluation.effectiveStatus }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey, governanceStatus: coordinationEvaluation.effectiveStatus }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "coordination_hold",
        governanceStatus: coordinationEvaluation.effectiveStatus,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        nextAction: coordinationEvaluation.nextAction
      });
      continue;
    }

    if (coordinationEvaluation.effectiveStatus === "coordination_escalated") {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "coordination_escalated",
        coordinationEvaluation.nextAction,
        { workerFamilyKey: familyKey, governanceStatus: coordinationEvaluation.effectiveStatus }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey, governanceStatus: coordinationEvaluation.effectiveStatus }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "coordination_escalated",
        governanceStatus: coordinationEvaluation.effectiveStatus,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        nextAction: coordinationEvaluation.nextAction
      });
      continue;
    }

    const coordinationGroupKey = coordinationEvaluation.entry?.coordinationGroupKey
      ? String(coordinationEvaluation.entry.coordinationGroupKey).trim()
      : null;
    const coordinationBackpressureEvaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(
      coordinationGroupKey
        ? coordinationBackpressureByGroup.get(coordinationGroupKey) ?? coordinationBackpressureByFamily.get(familyKey) ?? null
        : coordinationBackpressureByFamily.get(familyKey) ?? null,
      { now: options.now }
    );
    if (coordinationBackpressureEvaluation.effectiveStatus === "group_backpressure") {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "coordination_backpressure",
        coordinationBackpressureEvaluation.nextAction,
        { workerFamilyKey: familyKey, governanceStatus: coordinationBackpressureEvaluation.effectiveStatus }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey, governanceStatus: coordinationBackpressureEvaluation.effectiveStatus }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "coordination_backpressure",
        governanceStatus: coordinationBackpressureEvaluation.effectiveStatus,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        coordinationGroupKey,
        nextAction: coordinationBackpressureEvaluation.nextAction
      });
      continue;
    }
    if (coordinationBackpressureEvaluation.effectiveStatus === "group_escalated") {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "coordination_group_escalated",
        coordinationBackpressureEvaluation.nextAction,
        { workerFamilyKey: familyKey, governanceStatus: coordinationBackpressureEvaluation.effectiveStatus }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey, governanceStatus: coordinationBackpressureEvaluation.effectiveStatus }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "coordination_group_escalated",
        governanceStatus: coordinationBackpressureEvaluation.effectiveStatus,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        coordinationGroupKey,
        nextAction: coordinationBackpressureEvaluation.nextAction
      });
      continue;
    }

    if (limit && selectedReceipts.length >= limit) {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        "selection_capped",
        "This recovery-runtime cycle receipt is open, but the current selection limit has been reached.",
        { workerFamilyKey: familyKey }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: "selection_capped",
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        nextAction: "Raise the selection limit or run another recovery-runtime cycle-runtime pass."
      });
      continue;
    }

    let workerPool = resolveWorkerPool(primary.receipt, workerIds);
    if (governanceEvaluation.allowedWorkerIds.length > 0) {
      workerPool = workerPool.filter((workerId) => governanceEvaluation.allowedWorkerIds.includes(workerId));
    }
    if (workerPool.length === 0) {
      blockedReceipts.push(createBlockedReceipt(
        primary,
        governanceEvaluation.allowedWorkerIds.length > 0 ? "family_worker_restricted" : "no_worker_match",
        governanceEvaluation.allowedWorkerIds.length > 0
          ? "The stored family governance currently restricts this receipt away from all available workers."
          : "No available worker matches the worker family encoded in this cycle receipt.",
        {
          workerFamilyKey: familyKey,
          workerPool: governanceEvaluation.allowedWorkerIds.length > 0
            ? governanceEvaluation.allowedWorkerIds
            : (Array.isArray(primary.receipt.workerIds) ? primary.receipt.workerIds : []),
          governanceStatus: governanceEvaluation.effectiveStatus
        }
      ));
      for (const entry of secondary) {
        blockedReceipts.push(createBlockedReceipt(
          entry,
          "family_conflict",
          "Another resumable cycle receipt in this worker family already has higher priority.",
          { workerFamilyKey: familyKey }
        ));
      }
      familyPlans.push({
        workerFamilyKey: familyKey,
        status: governanceEvaluation.allowedWorkerIds.length > 0 ? "family_worker_restricted" : "no_worker_match",
        governanceStatus: governanceEvaluation.effectiveStatus,
        workerId: null,
        selectedReceiptId: null,
        openReadyCount: sortedEntries.length,
        blockedCount: sortedEntries.length,
        nextAction: governanceEvaluation.allowedWorkerIds.length > 0
          ? "Widen the allowed governance worker set or release the family restriction before auto-resuming."
          : "Widen the worker pool or adjust worker family assignment before expecting auto-resume."
      });
      continue;
    }

    const runtimeWorkerId = selectRuntimeWorker(workerPool, roundRobinState, governanceEvaluation.preferredWorkerId);
    const assignment = {
      receipt: primary.receipt,
      effectiveReceiptState: primary.effectiveReceiptState,
      runtimeStatus: "dispatch_ready",
      runtimeWorkerId,
      workerFamilyKey: familyKey,
      workerPool,
      governanceStatus: governanceEvaluation.effectiveStatus,
      conflictCount: secondary.length,
      nextAction: `Resume this recovery-runtime cycle on worker '${runtimeWorkerId}'.`
    };
    selectedReceipts.push(assignment);
    runtimeBuckets.get(runtimeWorkerId)?.push(assignment);

    for (const entry of secondary) {
      blockedReceipts.push(createBlockedReceipt(
        entry,
        "family_conflict",
        "Another resumable cycle receipt in this worker family already has higher priority.",
        { workerFamilyKey: familyKey, runtimeWorkerId }
      ));
    }

      familyPlans.push({
      workerFamilyKey: familyKey,
      status: "dispatch_ready",
      governanceStatus: governanceEvaluation.effectiveStatus,
      workerId: runtimeWorkerId,
      selectedReceiptId: primary.receipt.receiptId,
      openReadyCount: sortedEntries.length,
      blockedCount: secondary.length,
      nextAction: `Resume the selected cycle receipt on worker '${runtimeWorkerId}'.`
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
    familyCount: families.size,
    runtimeCount: runtimes.length,
    governanceFamilyCount: governanceByFamily.size,
    coordinationFamilyCount: coordinationByFamily.size,
    selectedCount: selectedReceipts.length,
    blockedCount: sortedBlockedReceipts.length,
    openCount: evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "open_ready").length,
    resumedCount: evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "resumed").length,
    governanceManualHoldCount: sortedBlockedReceipts.filter((entry) => entry.runtimeStatus === "family_hold_manual").length,
    governanceBackpressureCount: sortedBlockedReceipts.filter((entry) => entry.runtimeStatus === "family_backpressure").length,
    governanceBudgetExhaustedCount: sortedBlockedReceipts.filter((entry) => entry.runtimeStatus === "family_budget_exhausted").length,
    coordinationHoldCount: sortedBlockedReceipts.filter((entry) => entry.runtimeStatus === "coordination_hold").length,
    coordinationEscalatedCount: sortedBlockedReceipts.filter((entry) => entry.runtimeStatus === "coordination_escalated").length,
    coordinationBackpressureCount: sortedBlockedReceipts.filter((entry) => entry.runtimeStatus === "coordination_backpressure").length,
    coordinationGroupEscalatedCount: sortedBlockedReceipts.filter((entry) => entry.runtimeStatus === "coordination_group_escalated").length,
    familyPlans,
    runtimes,
    selectedReceipts,
    blockedReceipts: sortedBlockedReceipts,
    nextAction: selectedReceipts.length > 0
      ? "Resume the assigned recovery-runtime cycles for each worker or let the cycle-runtime execute them in one pass."
      : sortedBlockedReceipts.some((entry) => entry.runtimeStatus === "family_hold_manual" || entry.runtimeStatus === "family_backpressure" || entry.runtimeStatus === "family_budget_exhausted")
        ? "Review the stored family governance and release or widen any family-level holds before auto-resuming."
        : sortedBlockedReceipts.some((entry) => entry.runtimeStatus === "coordination_backpressure")
          ? "Let the higher-priority coordination groups drain or relax the stored group backpressure before expecting additional recovery-runtime cycle resumes."
          : sortedBlockedReceipts.some((entry) => entry.runtimeStatus === "coordination_group_escalated")
            ? "Resolve the escalated coordination-group conflicts before expecting additional recovery-runtime cycle resumes."
            : sortedBlockedReceipts.some((entry) => entry.runtimeStatus === "coordination_escalated")
              ? "Resolve the escalated cross-family worker-pool conflicts before expecting auto-resume again."
              : sortedBlockedReceipts.some((entry) => entry.runtimeStatus === "coordination_hold")
                ? "Review the cross-family coordination holds and release lower-priority worker-pool conflicts when they are safe again."
                : sortedBlockedReceipts.some((entry) => entry.runtimeStatus === "family_conflict")
                  ? "Review conflicting resumable cycle receipts in the same worker family before auto-resuming."
                  : "No dispatch-ready recovery-runtime cycle receipt is currently available."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeSummary(plan) {
  const runtimeLines = plan.runtimes.length > 0
    ? plan.runtimes.map((runtime) => {
      const receiptList = runtime.assignments.length > 0
        ? runtime.assignments.map((assignment) =>
          `${assignment.receipt.receiptId} [family=${assignment.workerFamilyKey}, selected=${assignment.receipt.totalSelectedCount}, executed=${assignment.receipt.totalExecutedCount}]`
        ).join("; ")
        : "none";
      return `- worker=${runtime.workerId}: receipts=${runtime.receiptCount} | families=${runtime.familyCount} | selected=${runtime.selectedCount} | assignments=${receiptList}`;
    }).join("\n")
    : "- none";
  const blockedLines = plan.blockedReceipts.length > 0
    ? plan.blockedReceipts.slice(0, 20).map((entry) =>
      `- receipt=${entry.receipt.receiptId}: runtime_status=${entry.runtimeStatus} | family=${entry.workerFamilyKey} | stop=${entry.receipt.stopReason}${entry.runtimeWorkerId ? ` | worker=${entry.runtimeWorkerId}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime

- generated_at: ${plan.generatedAt}
- receipt_count: ${plan.receiptCount}
- review_count: ${plan.reviewCount}
- family_count: ${plan.familyCount}
- runtime_count: ${plan.runtimeCount}
- governance_family_count: ${plan.governanceFamilyCount}
- coordination_family_count: ${plan.coordinationFamilyCount}
- selected_count: ${plan.selectedCount}
- blocked_count: ${plan.blockedCount}
- open_count: ${plan.openCount}
- resumed_count: ${plan.resumedCount}
- governance_manual_hold_count: ${plan.governanceManualHoldCount}
- governance_backpressure_count: ${plan.governanceBackpressureCount}
- governance_budget_exhausted_count: ${plan.governanceBudgetExhaustedCount}
- coordination_hold_count: ${plan.coordinationHoldCount}
- coordination_escalated_count: ${plan.coordinationEscalatedCount}
- coordination_backpressure_count: ${plan.coordinationBackpressureCount}
- coordination_group_escalated_count: ${plan.coordinationGroupEscalatedCount}

## Worker Assignments

${runtimeLines}

## Blocked Receipts

${blockedLines}

## Next Action

- ${plan.nextAction}
`;
}
