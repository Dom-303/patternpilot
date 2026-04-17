import fs from "node:fs/promises";
import path from "node:path";

import {
  evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt
} from "./runtime-loop-recovery-runtime-cycle-receipts.mjs";
import {
  evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyGovernance
} from "./runtime-loop-recovery-runtime-cycle-runtime-governance.mjs";

const RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_COORDINATION_PATH = path.join(
  "state",
  "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination.json"
);
const DEFAULT_COORDINATION_ESCALATION_SECONDS = 3600;

function normalizeWorkerIds(value) {
  const workerIds = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  return [...new Set(workerIds
    .map((workerId) => String(workerId ?? "").trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function buildWorkerFamilyKey(workerIds = []) {
  const normalized = normalizeWorkerIds(workerIds);
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

function normalizeCoordinationStatus(value) {
  const normalized = String(value ?? "").trim();
  switch (normalized) {
    case "coordination_hold":
    case "coordination_escalated":
    case "coordination_ready":
      return normalized;
    default:
      return "coordination_ready";
  }
}

function normalizeCoordinationEntry(entry = {}) {
  return {
    workerFamilyKey: String(entry.workerFamilyKey ?? "").trim() || "unscoped",
    coordinationGroupKey: String(entry.coordinationGroupKey ?? "").trim() || "unscoped",
    status: normalizeCoordinationStatus(entry.status),
    blockedByFamilyKey: entry.blockedByFamilyKey ? String(entry.blockedByFamilyKey).trim() : null,
    effectiveWorkerIds: normalizeWorkerIds(entry.effectiveWorkerIds),
    preferredWorkerId: entry.preferredWorkerId ? String(entry.preferredWorkerId).trim() : null,
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
    sourceCommand: entry.sourceCommand ?? "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-apply",
    notes: entry.notes ?? null
  };
}

function isMeaningfulCoordinationEntry(entry) {
  return Boolean(entry && (entry.status === "coordination_hold" || entry.status === "coordination_escalated"));
}

function resolveAvailableWorkerIds(options = {}) {
  const normalized = normalizeWorkerIds(options.workerIds);
  if (normalized.length > 0) {
    return normalized;
  }

  return [options.workerId ?? "local-worker"];
}

function computeEffectiveWorkerIds(receipt, governanceEvaluation, availableWorkerIds) {
  let effectiveWorkerIds = Array.isArray(receipt?.workerIds) && receipt.workerIds.length > 0
    ? normalizeWorkerIds(receipt.workerIds).filter((workerId) => availableWorkerIds.includes(workerId))
    : [...availableWorkerIds];

  if (governanceEvaluation.allowedWorkerIds.length > 0) {
    effectiveWorkerIds = effectiveWorkerIds.filter((workerId) => governanceEvaluation.allowedWorkerIds.includes(workerId));
  }

  return effectiveWorkerIds;
}

function candidatesOverlap(left, right) {
  const leftWorkers = new Set(normalizeWorkerIds(left.effectiveWorkerIds));
  const rightWorkers = normalizeWorkerIds(right.effectiveWorkerIds);
  for (const workerId of rightWorkers) {
    if (leftWorkers.has(workerId)) {
      return true;
    }
  }

  const leftPreferred = left.preferredWorkerId ? String(left.preferredWorkerId).trim() : "";
  const rightPreferred = right.preferredWorkerId ? String(right.preferredWorkerId).trim() : "";
  return Boolean(leftPreferred && rightPreferred && leftPreferred === rightPreferred);
}

function buildCoordinationGroupKey(candidates = []) {
  const workerIds = [...new Set(candidates.flatMap((candidate) => normalizeWorkerIds(candidate.effectiveWorkerIds)))]
    .sort((left, right) => left.localeCompare(right));
  const preferredWorkers = [...new Set(candidates
    .map((candidate) => candidate.preferredWorkerId ? String(candidate.preferredWorkerId).trim() : "")
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  if (preferredWorkers.length > 0) {
    return `preferred:${preferredWorkers.join("+")}|overlap:${workerIds.join("|") || "unscoped"}`;
  }
  return `overlap:${workerIds.join("|") || "unscoped"}`;
}

function buildCoordinationCandidateGroups(candidates = []) {
  const remaining = [...candidates];
  const groups = [];

  while (remaining.length > 0) {
    const seed = remaining.shift();
    const group = [seed];
    let expanded = true;

    while (expanded) {
      expanded = false;
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        const candidate = remaining[index];
        if (group.some((item) => candidatesOverlap(item, candidate))) {
          group.push(candidate);
          remaining.splice(index, 1);
          expanded = true;
        }
      }
    }

    groups.push(group);
  }

  return groups;
}

export function getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationPath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_COORDINATION_PATH);
}

export async function loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(rootDir) {
  const coordinationPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationPath(rootDir);
  try {
    const raw = await fs.readFile(coordinationPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      coordinationPath,
      families: Array.isArray(parsed.families)
        ? parsed.families.map((entry) => normalizeCoordinationEntry(entry))
        : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        coordinationPath,
        families: []
      };
    }
    throw error;
  }
}

export async function writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(rootDir, state, options = {}) {
  const coordinationPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationPath(rootDir);
  if (options.dryRun) {
    return coordinationPath;
  }

  await fs.mkdir(path.dirname(coordinationPath), { recursive: true });
  await fs.writeFile(coordinationPath, `${JSON.stringify({
    schemaVersion: 1,
    families: Array.isArray(state.families)
      ? state.families.map((entry) => normalizeCoordinationEntry(entry))
      : []
  }, null, 2)}\n`, "utf8");
  return coordinationPath;
}

export function evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyCoordination(entry) {
  const normalizedEntry = entry ? normalizeCoordinationEntry(entry) : null;
  if (!normalizedEntry) {
    return {
      entry: null,
      effectiveStatus: "coordination_ready",
      actionable: true,
      nextAction: "This worker family has no stored coordination override."
    };
  }

  if (normalizedEntry.status === "coordination_hold") {
    return {
      entry: normalizedEntry,
      effectiveStatus: "coordination_hold",
      actionable: false,
      nextAction: normalizedEntry.notes
        ?? normalizedEntry.blockedByFamilyKey
        ?? "This worker family is currently held by cross-family coordination."
    };
  }

  if (normalizedEntry.status === "coordination_escalated") {
    return {
      entry: normalizedEntry,
      effectiveStatus: "coordination_escalated",
      actionable: false,
      nextAction: normalizedEntry.notes
        ?? normalizedEntry.blockedByFamilyKey
        ?? "This worker family has an escalated cross-family coordination conflict."
    };
  }

  return {
    entry: normalizedEntry,
    effectiveStatus: "coordination_ready",
    actionable: true,
    nextAction: normalizedEntry.notes ?? "This worker family is coordination-ready."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview(receiptState, governanceState, coordinationState, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const availableWorkerIds = resolveAvailableWorkerIds(options);
  const currentCoordination = Array.isArray(coordinationState?.families) ? coordinationState.families : [];
  const currentByFamily = new Map(currentCoordination.map((entry) => {
    const normalized = normalizeCoordinationEntry(entry);
    return [normalized.workerFamilyKey, normalized];
  }));
  const governanceByFamily = new Map((Array.isArray(governanceState?.families) ? governanceState.families : []).map((entry) => [
    String(entry.workerFamilyKey ?? "").trim() || "unscoped",
    entry
  ]));
  const evaluatedReceipts = (Array.isArray(receiptState?.receipts) ? receiptState.receipts : [])
    .map((receipt) => evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(receipt))
    .sort(compareCycleCandidates);

  const candidates = evaluatedReceipts
    .filter((entry) => entry.effectiveReceiptState === "open_ready" && entry.receipt.resumeContractPath)
    .map((entry) => {
      const workerFamilyKey = buildWorkerFamilyKey(entry.receipt.workerIds);
      const governanceEvaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyGovernance(
        governanceByFamily.get(workerFamilyKey) ?? null,
        entry.receipt,
        { now: options.now }
      );
      const effectiveWorkerIds = computeEffectiveWorkerIds(entry.receipt, governanceEvaluation, availableWorkerIds);
      return {
        entry,
        workerFamilyKey,
        governanceEvaluation,
        effectiveWorkerIds,
        preferredWorkerId: governanceEvaluation.preferredWorkerId ?? null
      };
    });

  const familyReviews = [];
  const candidateGroups = buildCoordinationCandidateGroups(candidates)
    .map((group) => [...group].sort((left, right) => compareCycleCandidates(left.entry, right.entry)))
    .sort((left, right) =>
      buildCoordinationGroupKey(left).localeCompare(buildCoordinationGroupKey(right))
    );
  for (const sortedGroup of candidateGroups) {
    const coordinationGroupKey = buildCoordinationGroupKey(sortedGroup);
    const capacity = Math.max(1, [...new Set(sortedGroup.flatMap((candidate) => normalizeWorkerIds(candidate.effectiveWorkerIds)))].length || 1);

    sortedGroup.forEach((candidate, index) => {
      const currentEntry = currentByFamily.get(candidate.workerFamilyKey) ?? null;
      const currentEvaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyCoordination(currentEntry);
      const shouldHold = index >= capacity;
      const suggestedEntry = normalizeCoordinationEntry({
        workerFamilyKey: candidate.workerFamilyKey,
        coordinationGroupKey,
        status: shouldHold ? "coordination_hold" : "coordination_ready",
        blockedByFamilyKey: shouldHold ? sortedGroup[0]?.workerFamilyKey ?? null : null,
        effectiveWorkerIds: candidate.effectiveWorkerIds,
        preferredWorkerId: candidate.preferredWorkerId,
        updatedAt: generatedAt,
        sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-apply",
        notes: shouldHold
          ? `This worker family currently competes in coordination group '${coordinationGroupKey}' and should wait for higher-priority families first.`
          : null
      });
      const suggestedEvaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyCoordination(suggestedEntry);
      const shouldPersist = isMeaningfulCoordinationEntry(suggestedEntry) || Boolean(currentEntry);

      familyReviews.push({
        workerFamilyKey: candidate.workerFamilyKey,
        coordinationGroupKey,
        primaryReceipt: candidate.entry.receipt,
        currentEntry,
        currentStatus: currentEvaluation.effectiveStatus,
        suggestedEntry,
        suggestedStatus: suggestedEvaluation.effectiveStatus,
        effectiveWorkerIds: candidate.effectiveWorkerIds,
        preferredWorkerId: candidate.preferredWorkerId,
        coordinationCapacity: capacity,
        coordinationRank: index + 1,
        shouldPersist,
        nextAction: suggestedEvaluation.nextAction
      });
    });
  }

  const persistedSuggestions = familyReviews.filter((item) => item.shouldPersist && item.suggestedStatus === "coordination_hold");
  const statusCounts = familyReviews.reduce((counts, item) => {
    counts[item.suggestedStatus] = (counts[item.suggestedStatus] ?? 0) + 1;
    return counts;
  }, {});

  return {
    schemaVersion: 1,
    generatedAt,
    availableWorkerIds,
    familyCount: familyReviews.length,
    groupCount: candidateGroups.length,
    persistedSuggestionCount: persistedSuggestions.length,
    currentCoordinatedCount: currentCoordination.length,
    statusCounts,
    familyReviews,
    nextAction: persistedSuggestions.length > 0
      ? "Apply the suggested coordination holds if the worker-pool contention between families looks correct."
      : "No cross-family coordination hold is currently suggested."
  };
}

export function applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview(currentState, review, options = {}) {
  const currentFamilies = Array.isArray(currentState?.families) ? currentState.families : [];
  const nextByFamily = new Map(currentFamilies.map((entry) => {
    const normalized = normalizeCoordinationEntry(entry);
    return [normalized.workerFamilyKey, normalized];
  }));
  const receipts = [];
  const appliedAt = options.appliedAt ?? new Date().toISOString();

  for (const familyReview of review.familyReviews) {
    const nextEntry = normalizeCoordinationEntry({
      ...familyReview.suggestedEntry,
      updatedAt: appliedAt,
      notes: familyReview.suggestedEntry.status === "coordination_hold"
        ? (options.notes || familyReview.suggestedEntry.notes || null)
        : null
    });

    if (isMeaningfulCoordinationEntry(nextEntry)) {
      nextByFamily.set(nextEntry.workerFamilyKey, nextEntry);
      receipts.push({
        workerFamilyKey: nextEntry.workerFamilyKey,
        coordinationGroupKey: nextEntry.coordinationGroupKey,
        status: nextEntry.status,
        blockedByFamilyKey: nextEntry.blockedByFamilyKey,
        effectiveWorkerIds: nextEntry.effectiveWorkerIds,
        preferredWorkerId: nextEntry.preferredWorkerId
      });
    } else {
      nextByFamily.delete(nextEntry.workerFamilyKey);
    }
  }

  return {
    nextState: {
      schemaVersion: 1,
      families: [...nextByFamily.values()].sort((left, right) =>
        String(left.workerFamilyKey).localeCompare(String(right.workerFamilyKey))
      )
    },
    receipts
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationSummary(review) {
  const familyLines = review.familyReviews.length > 0
    ? review.familyReviews.map((item) =>
      `- family=${item.workerFamilyKey}: group=${item.coordinationGroupKey} | current=${item.currentStatus} | suggested=${item.suggestedStatus} | rank=${item.coordinationRank}/${item.coordinationCapacity}${item.blockedByFamilyKey ? ` | blocked_by=${item.blockedByFamilyKey}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination

- generated_at: ${review.generatedAt}
- family_count: ${review.familyCount}
- group_count: ${review.groupCount}
- current_coordinated_count: ${review.currentCoordinatedCount}
- persisted_suggestion_count: ${review.persistedSuggestionCount}
- ready_count: ${review.statusCounts.coordination_ready ?? 0}
- hold_count: ${review.statusCounts.coordination_hold ?? 0}
- escalated_count: ${review.statusCounts.coordination_escalated ?? 0}

## Family Coordination

${familyLines}

## Next Action

- ${review.nextAction}
`;
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview(receiptState, governanceState, coordinationState, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const escalationSeconds = Number.isFinite(options.coordinationEscalationSeconds) && options.coordinationEscalationSeconds > 0
    ? Number(options.coordinationEscalationSeconds)
    : DEFAULT_COORDINATION_ESCALATION_SECONDS;
  const baseReview = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview(
    receiptState,
    governanceState,
    coordinationState,
    options
  );
  const suggestedByFamily = new Map(baseReview.familyReviews.map((item) => [item.workerFamilyKey, item]));
  const currentFamilies = (Array.isArray(coordinationState?.families) ? coordinationState.families : [])
    .map((entry) => normalizeCoordinationEntry(entry))
    .sort((left, right) => String(left.workerFamilyKey).localeCompare(String(right.workerFamilyKey)));
  const followups = [];

  for (const currentEntry of currentFamilies) {
    const suggested = suggestedByFamily.get(currentEntry.workerFamilyKey) ?? null;
    const updatedAt = new Date(currentEntry.updatedAt ?? 0).getTime();
    const ageSeconds = Number.isFinite(updatedAt)
      ? Math.max(0, Math.floor((new Date(generatedAt).getTime() - updatedAt) / 1000))
      : null;
    let followupAction = "keep";
    let nextStatus = currentEntry.status;
    let nextAction = "Keep this coordination hold in place.";

    if (!suggested || suggested.suggestedStatus === "coordination_ready") {
      followupAction = "auto_release";
      nextStatus = "coordination_ready";
      nextAction = "This coordination hold no longer has an active conflict and can be released.";
    } else if (
      currentEntry.status !== "coordination_escalated"
      && ageSeconds != null
      && ageSeconds >= escalationSeconds
    ) {
      followupAction = "escalate";
      nextStatus = "coordination_escalated";
      nextAction = "This coordination hold has exceeded its escalation window and should be escalated for manual review.";
    }

    followups.push({
      workerFamilyKey: currentEntry.workerFamilyKey,
      coordinationGroupKey: currentEntry.coordinationGroupKey,
      currentStatus: currentEntry.status,
      suggestedStatus: suggested?.suggestedStatus ?? "coordination_ready",
      followupAction,
      nextStatus,
      ageSeconds,
      blockedByFamilyKey: currentEntry.blockedByFamilyKey,
      effectiveWorkerIds: currentEntry.effectiveWorkerIds,
      shouldApply: followupAction !== "keep",
      nextAction
    });
  }

  const statusCounts = followups.reduce((counts, item) => {
    counts[item.followupAction] = (counts[item.followupAction] ?? 0) + 1;
    return counts;
  }, {});

  return {
    schemaVersion: 1,
    generatedAt,
    escalationSeconds,
    familyCount: currentFamilies.length,
    applyCount: followups.filter((item) => item.shouldApply).length,
    statusCounts,
    followups,
    nextAction: followups.some((item) => item.followupAction === "auto_release")
      ? "Apply the suggested coordination follow-ups to release stale conflict holds."
      : followups.some((item) => item.followupAction === "escalate")
        ? "Apply the suggested coordination follow-ups to escalate long-running conflict holds."
        : "No coordination follow-up action is currently suggested."
  };
}

export function applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview(currentState, review, options = {}) {
  const currentFamilies = Array.isArray(currentState?.families) ? currentState.families : [];
  const nextByFamily = new Map(currentFamilies.map((entry) => {
    const normalized = normalizeCoordinationEntry(entry);
    return [normalized.workerFamilyKey, normalized];
  }));
  const receipts = [];
  const appliedAt = options.appliedAt ?? new Date().toISOString();

  for (const followup of review.followups) {
    if (!followup.shouldApply) {
      continue;
    }

    if (followup.followupAction === "auto_release") {
      nextByFamily.delete(followup.workerFamilyKey);
      receipts.push({
        workerFamilyKey: followup.workerFamilyKey,
        previousStatus: followup.currentStatus,
        followupAction: followup.followupAction,
        nextStatus: "coordination_ready"
      });
      continue;
    }

    if (followup.followupAction === "escalate") {
      const currentEntry = nextByFamily.get(followup.workerFamilyKey);
      const nextEntry = normalizeCoordinationEntry({
        ...currentEntry,
        status: "coordination_escalated",
        updatedAt: appliedAt,
        sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-followup-apply",
        notes: options.notes || `Escalated after ${followup.ageSeconds ?? 0}s of unresolved worker-pool contention.`
      });
      nextByFamily.set(nextEntry.workerFamilyKey, nextEntry);
      receipts.push({
        workerFamilyKey: followup.workerFamilyKey,
        previousStatus: followup.currentStatus,
        followupAction: followup.followupAction,
        nextStatus: nextEntry.status
      });
    }
  }

  return {
    nextState: {
      schemaVersion: 1,
      families: [...nextByFamily.values()].sort((left, right) =>
        String(left.workerFamilyKey).localeCompare(String(right.workerFamilyKey))
      )
    },
    receipts
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupSummary(review) {
  const followupLines = review.followups.length > 0
    ? review.followups.map((item) =>
      `- family=${item.workerFamilyKey}: current=${item.currentStatus} | followup=${item.followupAction} | next=${item.nextStatus}${item.ageSeconds != null ? ` | age_seconds=${item.ageSeconds}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Follow-up

- generated_at: ${review.generatedAt}
- family_count: ${review.familyCount}
- escalation_seconds: ${review.escalationSeconds}
- apply_count: ${review.applyCount}
- keep_count: ${review.statusCounts.keep ?? 0}
- auto_release_count: ${review.statusCounts.auto_release ?? 0}
- escalate_count: ${review.statusCounts.escalate ?? 0}

## Family Follow-ups

${followupLines}

## Next Action

- ${review.nextAction}
`;
}
