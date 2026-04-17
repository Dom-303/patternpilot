import fs from "node:fs/promises";
import path from "node:path";

import {
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview
} from "./runtime-loop-recovery-runtime-cycle-runtime-coordination.mjs";

const RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_COORDINATION_BACKPRESSURE_PATH = path.join(
  "state",
  "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure.json"
);
const DEFAULT_COORDINATION_GROUP_BUDGET = 2;
const DEFAULT_COORDINATION_BACKPRESSURE_SECONDS = 1800;
const DEFAULT_COORDINATION_GROUP_ESCALATION_SECONDS = 3600;

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

function normalizeGroupStatus(value) {
  const normalized = String(value ?? "").trim();
  switch (normalized) {
    case "group_backpressure":
    case "group_escalated":
    case "group_ready":
      return normalized;
    default:
      return "group_ready";
  }
}

function normalizeBackpressureEntry(entry = {}) {
  return {
    coordinationGroupKey: String(entry.coordinationGroupKey ?? "").trim() || "unscoped",
    status: normalizeGroupStatus(entry.status),
    blockedUntil: entry.blockedUntil ?? null,
    primaryWorkerFamilyKey: entry.primaryWorkerFamilyKey ? String(entry.primaryWorkerFamilyKey).trim() : null,
    workerFamilyKeys: [...new Set((Array.isArray(entry.workerFamilyKeys) ? entry.workerFamilyKeys : [])
      .map((workerFamilyKey) => String(workerFamilyKey ?? "").trim())
      .filter(Boolean))]
      .sort((left, right) => left.localeCompare(right)),
    effectiveWorkerIds: normalizeWorkerIds(entry.effectiveWorkerIds),
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
    sourceCommand: entry.sourceCommand ?? "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-apply",
    notes: entry.notes ?? null
  };
}

function isMeaningfulBackpressureEntry(entry) {
  return Boolean(entry && (entry.status === "group_backpressure" || entry.status === "group_escalated"));
}

function computeBlockedUntil(generatedAt, seconds) {
  return new Date(new Date(generatedAt).getTime() + (seconds * 1000)).toISOString();
}

function compareGroupPriority(left, right) {
  const holdDiff = Number(right.problemFamilyCount ?? 0) - Number(left.problemFamilyCount ?? 0);
  if (holdDiff !== 0) {
    return holdDiff;
  }

  const selectedDiff = Number(right.prioritySelectedCount ?? 0) - Number(left.prioritySelectedCount ?? 0);
  if (selectedDiff !== 0) {
    return selectedDiff;
  }

  const familyDiff = Number(right.familyCount ?? 0) - Number(left.familyCount ?? 0);
  if (familyDiff !== 0) {
    return familyDiff;
  }

  return String(left.coordinationGroupKey).localeCompare(String(right.coordinationGroupKey));
}

function buildCoordinationGroupReviews(familyReviews = []) {
  const byGroup = new Map();
  for (const familyReview of familyReviews) {
    const coordinationGroupKey = String(familyReview.coordinationGroupKey ?? "").trim() || "unscoped";
    const current = byGroup.get(coordinationGroupKey) ?? {
      coordinationGroupKey,
      familyReviews: []
    };
    current.familyReviews.push(familyReview);
    byGroup.set(coordinationGroupKey, current);
  }

  return [...byGroup.values()]
    .map((group) => {
      const sortedFamilyReviews = [...group.familyReviews].sort((left, right) => {
        const selectedDiff = Number(right.primaryReceipt?.totalSelectedCount ?? 0) - Number(left.primaryReceipt?.totalSelectedCount ?? 0);
        if (selectedDiff !== 0) {
          return selectedDiff;
        }
        return String(left.workerFamilyKey).localeCompare(String(right.workerFamilyKey));
      });
      const effectiveWorkerIds = [...new Set(sortedFamilyReviews.flatMap((item) => normalizeWorkerIds(item.effectiveWorkerIds)))];
      const problemFamilies = sortedFamilyReviews.filter((item) => item.suggestedStatus === "coordination_hold" || item.suggestedStatus === "coordination_escalated");

      return {
        coordinationGroupKey: group.coordinationGroupKey,
        familyCount: sortedFamilyReviews.length,
        problemFamilyCount: problemFamilies.length,
        prioritySelectedCount: Math.max(...sortedFamilyReviews.map((item) => Number(item.primaryReceipt?.totalSelectedCount ?? 0)), 0),
        primaryWorkerFamilyKey: sortedFamilyReviews[0]?.workerFamilyKey ?? null,
        workerFamilyKeys: sortedFamilyReviews.map((item) => item.workerFamilyKey),
        effectiveWorkerIds,
        familyReviews: sortedFamilyReviews
      };
    })
    .sort(compareGroupPriority);
}

export function getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressurePath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_COORDINATION_BACKPRESSURE_PATH);
}

export async function loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(rootDir) {
  const backpressurePath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressurePath(rootDir);
  try {
    const raw = await fs.readFile(backpressurePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      backpressurePath,
      groups: Array.isArray(parsed.groups)
        ? parsed.groups.map((entry) => normalizeBackpressureEntry(entry))
        : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        backpressurePath,
        groups: []
      };
    }
    throw error;
  }
}

export async function writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(rootDir, state, options = {}) {
  const backpressurePath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressurePath(rootDir);
  if (options.dryRun) {
    return backpressurePath;
  }

  await fs.mkdir(path.dirname(backpressurePath), { recursive: true });
  await fs.writeFile(backpressurePath, `${JSON.stringify({
    schemaVersion: 1,
    groups: Array.isArray(state.groups)
      ? state.groups.map((entry) => normalizeBackpressureEntry(entry))
      : []
  }, null, 2)}\n`, "utf8");
  return backpressurePath;
}

export function evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(entry, options = {}) {
  const normalizedEntry = entry ? normalizeBackpressureEntry(entry) : null;
  const now = options.now ? new Date(options.now) : new Date();
  const blockedUntil = normalizedEntry?.blockedUntil ? new Date(normalizedEntry.blockedUntil) : null;

  if (!normalizedEntry) {
    return {
      entry: null,
      effectiveStatus: "group_ready",
      actionable: true,
      nextAction: "This coordination group has no stored backpressure override."
    };
  }

  if (normalizedEntry.status === "group_backpressure" && blockedUntil && now < blockedUntil) {
    return {
      entry: normalizedEntry,
      effectiveStatus: "group_backpressure",
      actionable: false,
      blockedUntil: blockedUntil.toISOString(),
      nextAction: normalizedEntry.notes
        ?? "This coordination group is currently backpressured while higher-priority groups drain first."
    };
  }

  if (normalizedEntry.status === "group_escalated") {
    return {
      entry: normalizedEntry,
      effectiveStatus: "group_escalated",
      actionable: false,
      blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
      nextAction: normalizedEntry.notes
        ?? "This coordination group has escalated and now needs manual review before it will resume."
    };
  }

  return {
    entry: normalizedEntry,
    effectiveStatus: "group_ready",
    actionable: true,
    blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
    nextAction: normalizedEntry.notes ?? "This coordination group is ready again."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview(receiptState, governanceState, coordinationState, backpressureState, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const coordinationGroupBudget = Number.isFinite(options.coordinationGroupBudget) && options.coordinationGroupBudget > 0
    ? Number(options.coordinationGroupBudget)
    : DEFAULT_COORDINATION_GROUP_BUDGET;
  const backpressureSeconds = Number.isFinite(options.coordinationBackpressureSeconds) && options.coordinationBackpressureSeconds > 0
    ? Number(options.coordinationBackpressureSeconds)
    : DEFAULT_COORDINATION_BACKPRESSURE_SECONDS;
  const baseReview = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview(
    receiptState,
    governanceState,
    coordinationState,
    options
  );
  const currentByGroup = new Map((Array.isArray(backpressureState?.groups) ? backpressureState.groups : [])
    .map((entry) => {
      const normalized = normalizeBackpressureEntry(entry);
      return [normalized.coordinationGroupKey, normalized];
    }));
  const groupReviews = [];
  const candidateGroups = buildCoordinationGroupReviews(baseReview.familyReviews)
    .filter((group) => group.problemFamilyCount > 0);

  candidateGroups.forEach((group, index) => {
    const currentEntry = currentByGroup.get(group.coordinationGroupKey) ?? null;
    const shouldBackpressure = index >= coordinationGroupBudget;
    const suggestedEntry = normalizeBackpressureEntry({
      coordinationGroupKey: group.coordinationGroupKey,
      status: shouldBackpressure ? "group_backpressure" : "group_ready",
      blockedUntil: shouldBackpressure ? computeBlockedUntil(generatedAt, backpressureSeconds) : null,
      primaryWorkerFamilyKey: group.primaryWorkerFamilyKey,
      workerFamilyKeys: group.workerFamilyKeys,
      effectiveWorkerIds: group.effectiveWorkerIds,
      updatedAt: generatedAt,
      sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-apply",
      notes: shouldBackpressure
        ? `This coordination group is temporarily deferred so higher-priority conflict groups can drain first.`
        : null
    });
    const evaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(suggestedEntry, {
      now: generatedAt
    });
    groupReviews.push({
      coordinationGroupKey: group.coordinationGroupKey,
      currentEntry,
      currentStatus: evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(currentEntry, {
        now: generatedAt
      }).effectiveStatus,
      suggestedEntry,
      suggestedStatus: evaluation.effectiveStatus,
      primaryWorkerFamilyKey: group.primaryWorkerFamilyKey,
      workerFamilyKeys: group.workerFamilyKeys,
      effectiveWorkerIds: group.effectiveWorkerIds,
      familyCount: group.familyCount,
      problemFamilyCount: group.problemFamilyCount,
      prioritySelectedCount: group.prioritySelectedCount,
      groupRank: index + 1,
      groupBudget: coordinationGroupBudget,
      shouldPersist: isMeaningfulBackpressureEntry(suggestedEntry) || Boolean(currentEntry),
      nextAction: evaluation.nextAction
    });
  });

  const statusCounts = groupReviews.reduce((counts, item) => {
    counts[item.suggestedStatus] = (counts[item.suggestedStatus] ?? 0) + 1;
    return counts;
  }, {});
  const persistedSuggestions = groupReviews.filter((item) => item.shouldPersist && item.suggestedStatus === "group_backpressure");

  return {
    schemaVersion: 1,
    generatedAt,
    coordinationGroupBudget,
    backpressureSeconds,
    groupCount: groupReviews.length,
    persistedSuggestionCount: persistedSuggestions.length,
    currentBackpressuredCount: Array.isArray(backpressureState?.groups) ? backpressureState.groups.length : 0,
    statusCounts,
    groupReviews,
    nextAction: persistedSuggestions.length > 0
      ? "Apply the suggested group backpressure entries so lower-priority conflict groups wait while stronger groups drain first."
      : "No coordination-group backpressure is currently suggested."
  };
}

export function applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview(currentState, review, options = {}) {
  const nextByGroup = new Map((Array.isArray(currentState?.groups) ? currentState.groups : [])
    .map((entry) => {
      const normalized = normalizeBackpressureEntry(entry);
      return [normalized.coordinationGroupKey, normalized];
    }));
  const appliedAt = options.appliedAt ?? new Date().toISOString();
  const receipts = [];

  for (const groupReview of review.groupReviews) {
    const nextEntry = normalizeBackpressureEntry({
      ...groupReview.suggestedEntry,
      updatedAt: appliedAt,
      notes: groupReview.suggestedEntry.status === "group_backpressure"
        ? (options.notes || groupReview.suggestedEntry.notes || null)
        : null
    });

    if (isMeaningfulBackpressureEntry(nextEntry)) {
      nextByGroup.set(nextEntry.coordinationGroupKey, nextEntry);
      receipts.push({
        coordinationGroupKey: nextEntry.coordinationGroupKey,
        status: nextEntry.status,
        blockedUntil: nextEntry.blockedUntil,
        primaryWorkerFamilyKey: nextEntry.primaryWorkerFamilyKey,
        workerFamilyKeys: nextEntry.workerFamilyKeys,
        effectiveWorkerIds: nextEntry.effectiveWorkerIds
      });
    } else {
      nextByGroup.delete(nextEntry.coordinationGroupKey);
    }
  }

  return {
    nextState: {
      schemaVersion: 1,
      groups: [...nextByGroup.values()].sort((left, right) =>
        String(left.coordinationGroupKey).localeCompare(String(right.coordinationGroupKey))
      )
    },
    receipts
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview(receiptState, governanceState, coordinationState, backpressureState, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const escalationSeconds = Number.isFinite(options.coordinationGroupEscalationSeconds) && options.coordinationGroupEscalationSeconds > 0
    ? Number(options.coordinationGroupEscalationSeconds)
    : DEFAULT_COORDINATION_GROUP_ESCALATION_SECONDS;
  const backpressureSeconds = Number.isFinite(options.coordinationBackpressureSeconds) && options.coordinationBackpressureSeconds > 0
    ? Number(options.coordinationBackpressureSeconds)
    : DEFAULT_COORDINATION_BACKPRESSURE_SECONDS;
  const baseReview = options.baseReview
    ? options.baseReview
    : buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview(
      receiptState,
      governanceState,
      coordinationState,
      backpressureState,
      {
        ...options,
        generatedAt
      }
    );
  const suggestedByGroup = new Map(baseReview.groupReviews.map((item) => [item.coordinationGroupKey, item]));
  const currentGroups = (Array.isArray(backpressureState?.groups) ? backpressureState.groups : [])
    .map((entry) => normalizeBackpressureEntry(entry))
    .sort((left, right) => String(left.coordinationGroupKey).localeCompare(String(right.coordinationGroupKey)));
  const followups = [];

  for (const currentEntry of currentGroups) {
    const suggested = suggestedByGroup.get(currentEntry.coordinationGroupKey) ?? null;
    const updatedAt = new Date(currentEntry.updatedAt ?? 0).getTime();
    const ageSeconds = Number.isFinite(updatedAt)
      ? Math.max(0, Math.floor((new Date(generatedAt).getTime() - updatedAt) / 1000))
      : null;
    const blockedUntilTime = currentEntry.blockedUntil ? new Date(currentEntry.blockedUntil).getTime() : null;
    const isExpired = blockedUntilTime != null && blockedUntilTime <= new Date(generatedAt).getTime();

    let followupAction = "keep";
    let nextStatus = currentEntry.status;
    let nextBlockedUntil = currentEntry.blockedUntil;
    let nextAction = "Keep this group backpressure entry in place.";

    if (!suggested || suggested.suggestedStatus === "group_ready") {
      followupAction = "auto_release";
      nextStatus = "group_ready";
      nextBlockedUntil = null;
      nextAction = "This coordination-group backpressure is no longer needed and can be released.";
    } else if (
      currentEntry.status !== "group_escalated"
      && ageSeconds != null
      && ageSeconds >= escalationSeconds
    ) {
      followupAction = "escalate";
      nextStatus = "group_escalated";
      nextBlockedUntil = currentEntry.blockedUntil;
      nextAction = "This coordination-group backpressure has exceeded its escalation window and should move to manual review.";
    } else if (
      suggested.suggestedStatus === "group_backpressure"
      && currentEntry.status === "group_backpressure"
      && isExpired
    ) {
      followupAction = "refresh_backpressure";
      nextStatus = "group_backpressure";
      nextBlockedUntil = computeBlockedUntil(generatedAt, backpressureSeconds);
      nextAction = "This coordination-group backpressure is still needed and its blocking window should be refreshed.";
    }

    followups.push({
      coordinationGroupKey: currentEntry.coordinationGroupKey,
      currentStatus: currentEntry.status,
      suggestedStatus: suggested?.suggestedStatus ?? "group_ready",
      followupAction,
      nextStatus,
      ageSeconds,
      blockedUntil: currentEntry.blockedUntil,
      nextBlockedUntil,
      primaryWorkerFamilyKey: currentEntry.primaryWorkerFamilyKey,
      workerFamilyKeys: currentEntry.workerFamilyKeys,
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
    backpressureSeconds,
    groupCount: currentGroups.length,
    applyCount: followups.filter((item) => item.shouldApply).length,
    statusCounts,
    followups,
    nextAction: followups.some((item) => item.followupAction === "auto_release")
      ? "Apply the suggested group-backpressure follow-ups to release stale or resolved group holds."
      : followups.some((item) => item.followupAction === "refresh_backpressure")
        ? "Apply the suggested group-backpressure follow-ups to refresh still-needed blocking windows."
        : followups.some((item) => item.followupAction === "escalate")
          ? "Apply the suggested group-backpressure follow-ups to escalate long-running group conflicts."
          : "No coordination-group backpressure follow-up action is currently suggested."
  };
}

export function applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview(currentState, review, options = {}) {
  const nextByGroup = new Map((Array.isArray(currentState?.groups) ? currentState.groups : [])
    .map((entry) => {
      const normalized = normalizeBackpressureEntry(entry);
      return [normalized.coordinationGroupKey, normalized];
    }));
  const appliedAt = options.appliedAt ?? new Date().toISOString();
  const receipts = [];

  for (const followup of review.followups) {
    if (!followup.shouldApply) {
      continue;
    }

    if (followup.followupAction === "auto_release") {
      nextByGroup.delete(followup.coordinationGroupKey);
      receipts.push({
        coordinationGroupKey: followup.coordinationGroupKey,
        previousStatus: followup.currentStatus,
        followupAction: followup.followupAction,
        nextStatus: "group_ready"
      });
      continue;
    }

    const currentEntry = nextByGroup.get(followup.coordinationGroupKey);
    const nextEntry = normalizeBackpressureEntry({
      ...currentEntry,
      status: followup.nextStatus,
      blockedUntil: followup.nextBlockedUntil,
      updatedAt: appliedAt,
      sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-followup-apply",
      notes: options.notes || (
        followup.followupAction === "escalate"
          ? `Escalated after ${followup.ageSeconds ?? 0}s of unresolved coordination-group pressure.`
          : followup.followupAction === "refresh_backpressure"
            ? "Refreshed because the coordination-group pressure is still active."
            : currentEntry?.notes
      ) || null
    });
    nextByGroup.set(nextEntry.coordinationGroupKey, nextEntry);
    receipts.push({
      coordinationGroupKey: followup.coordinationGroupKey,
      previousStatus: followup.currentStatus,
      followupAction: followup.followupAction,
      nextStatus: nextEntry.status,
      blockedUntil: nextEntry.blockedUntil
    });
  }

  return {
    nextState: {
      schemaVersion: 1,
      groups: [...nextByGroup.values()].sort((left, right) =>
        String(left.coordinationGroupKey).localeCompare(String(right.coordinationGroupKey))
      )
    },
    receipts
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSummary(review) {
  const groupLines = review.groupReviews.length > 0
    ? review.groupReviews.map((item) =>
      `- group=${item.coordinationGroupKey}: current=${item.currentStatus} | suggested=${item.suggestedStatus} | rank=${item.groupRank}/${item.groupBudget} | problem_families=${item.problemFamilyCount}${item.primaryWorkerFamilyKey ? ` | primary_family=${item.primaryWorkerFamilyKey}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure

- generated_at: ${review.generatedAt}
- group_count: ${review.groupCount}
- coordination_group_budget: ${review.coordinationGroupBudget}
- backpressure_seconds: ${review.backpressureSeconds}
- current_backpressured_count: ${review.currentBackpressuredCount}
- persisted_suggestion_count: ${review.persistedSuggestionCount}
- ready_count: ${review.statusCounts.group_ready ?? 0}
- backpressure_count: ${review.statusCounts.group_backpressure ?? 0}

## Coordination Group Backpressure

${groupLines}

## Next Action

- ${review.nextAction}
`;
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupSummary(review) {
  const followupLines = review.followups.length > 0
    ? review.followups.map((item) =>
      `- group=${item.coordinationGroupKey}: current=${item.currentStatus} | followup=${item.followupAction} | next=${item.nextStatus}${item.ageSeconds != null ? ` | age_seconds=${item.ageSeconds}` : ""}${item.nextBlockedUntil ? ` | next_blocked_until=${item.nextBlockedUntil}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Follow-up

- generated_at: ${review.generatedAt}
- group_count: ${review.groupCount}
- escalation_seconds: ${review.escalationSeconds}
- backpressure_seconds: ${review.backpressureSeconds}
- apply_count: ${review.applyCount}
- keep_count: ${review.statusCounts.keep ?? 0}
- auto_release_count: ${review.statusCounts.auto_release ?? 0}
- refresh_backpressure_count: ${review.statusCounts.refresh_backpressure ?? 0}
- escalate_count: ${review.statusCounts.escalate ?? 0}

## Group Follow-ups

${followupLines}

## Next Action

- ${review.nextAction}
`;
}
