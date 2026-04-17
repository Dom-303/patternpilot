import fs from "node:fs/promises";
import path from "node:path";

import {
  evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt
} from "./runtime-loop-recovery-runtime-cycle-receipts.mjs";

const RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_GOVERNANCE_PATH = path.join(
  "state",
  "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance.json"
);
const DEFAULT_FAMILY_BACKPRESSURE_SECONDS = 1800;

function normalizeWorkerFamilyKey(value) {
  const normalized = String(value ?? "").trim();
  return normalized || "unscoped";
}

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

function normalizeMaxSelectedCount(value) {
  if (value == null || value === "") {
    return null;
  }

  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : null;
}

function normalizeGovernanceStatus(value) {
  const normalized = String(value ?? "").trim();
  switch (normalized) {
    case "family_manual_hold":
    case "family_backpressure":
    case "family_budget_exhausted":
    case "family_ready":
      return normalized;
    default:
      return "family_ready";
  }
}

function normalizeGovernanceEntry(entry = {}) {
  return {
    workerFamilyKey: normalizeWorkerFamilyKey(entry.workerFamilyKey),
    status: normalizeGovernanceStatus(entry.status),
    holdReason: entry.holdReason ?? null,
    blockedUntil: entry.blockedUntil ?? null,
    maxSelectedCount: normalizeMaxSelectedCount(entry.maxSelectedCount),
    preferredWorkerId: entry.preferredWorkerId ? String(entry.preferredWorkerId).trim() : null,
    allowedWorkerIds: normalizeWorkerIds(entry.allowedWorkerIds),
    updatedAt: entry.updatedAt ?? new Date().toISOString(),
    sourceCommand: entry.sourceCommand ?? "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-apply",
    notes: entry.notes ?? null
  };
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

function computeBlockedUntil(now, seconds) {
  return new Date(new Date(now).getTime() + (seconds * 1000)).toISOString();
}

function createSuggestedEntry(base = {}, overrides = {}) {
  return normalizeGovernanceEntry({
    ...base,
    ...overrides
  });
}

function normalizeGovernanceReleaseFilter(value) {
  const normalized = String(value ?? "problematic").trim().toLowerCase().replace(/-/g, "_");
  switch (normalized) {
    case "all":
    case "family_manual_hold":
    case "manual_hold":
    case "family_backpressure":
    case "backpressure":
    case "family_budget_exhausted":
    case "budget_exhausted":
      return normalized;
    default:
      return "problematic";
  }
}

function isMeaningfulGovernanceEntry(entry) {
  if (!entry) {
    return false;
  }

  return Boolean(
    entry.status !== "family_ready"
    || entry.maxSelectedCount != null
    || entry.allowedWorkerIds.length > 0
    || entry.preferredWorkerId
    || entry.notes
  );
}

export function getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernancePath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_GOVERNANCE_PATH);
}

export async function loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir) {
  const governancePath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernancePath(rootDir);
  try {
    const raw = await fs.readFile(governancePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      governancePath,
      families: Array.isArray(parsed.families)
        ? parsed.families.map((entry) => normalizeGovernanceEntry(entry))
        : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        governancePath,
        families: []
      };
    }
    throw error;
  }
}

export async function writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir, state, options = {}) {
  const governancePath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernancePath(rootDir);
  if (options.dryRun) {
    return governancePath;
  }

  await fs.mkdir(path.dirname(governancePath), { recursive: true });
  await fs.writeFile(governancePath, `${JSON.stringify({
    schemaVersion: 1,
    families: Array.isArray(state.families)
      ? state.families.map((entry) => normalizeGovernanceEntry(entry))
      : []
  }, null, 2)}\n`, "utf8");
  return governancePath;
}

export function evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyGovernance(entry, receipt, options = {}) {
  const normalizedEntry = entry ? normalizeGovernanceEntry(entry) : null;
  const now = options.now ? new Date(options.now) : new Date();
  const blockedUntil = normalizedEntry?.blockedUntil ? new Date(normalizedEntry.blockedUntil) : null;
  const allowedWorkerIds = normalizeWorkerIds(normalizedEntry?.allowedWorkerIds);
  const preferredWorkerId = normalizedEntry?.preferredWorkerId ? String(normalizedEntry.preferredWorkerId).trim() : null;

  if (!normalizedEntry) {
    return {
      entry: null,
      effectiveStatus: "family_ready",
      actionable: true,
      blockedUntil: null,
      maxSelectedCount: null,
      allowedWorkerIds: [],
      preferredWorkerId: null,
      nextAction: "This worker family has no stored governance override."
    };
  }

  if (normalizedEntry.status === "family_manual_hold") {
    return {
      entry: normalizedEntry,
      effectiveStatus: "family_manual_hold",
      actionable: false,
      blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
      maxSelectedCount: normalizedEntry.maxSelectedCount,
      allowedWorkerIds,
      preferredWorkerId,
      nextAction: normalizedEntry.holdReason
        ?? "This worker family is on manual hold; release it before auto-resuming cycles."
    };
  }

  if (normalizedEntry.status === "family_backpressure" && blockedUntil && now < blockedUntil) {
    return {
      entry: normalizedEntry,
      effectiveStatus: "family_backpressure",
      actionable: false,
      blockedUntil: blockedUntil.toISOString(),
      maxSelectedCount: normalizedEntry.maxSelectedCount,
      allowedWorkerIds,
      preferredWorkerId,
      nextAction: normalizedEntry.holdReason
        ?? "This worker family is temporarily throttled by backpressure; wait for the hold window to expire."
    };
  }

  if (
    normalizedEntry.maxSelectedCount != null
    && receipt
    && Number(receipt.totalSelectedCount ?? 0) > normalizedEntry.maxSelectedCount
  ) {
    return {
      entry: normalizedEntry,
      effectiveStatus: "family_budget_exhausted",
      actionable: false,
      blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
      maxSelectedCount: normalizedEntry.maxSelectedCount,
      allowedWorkerIds,
      preferredWorkerId,
      nextAction: normalizedEntry.holdReason
        ?? `This worker family exceeds its selected-count budget (${receipt.totalSelectedCount}/${normalizedEntry.maxSelectedCount}).`
    };
  }

  return {
    entry: normalizedEntry,
    effectiveStatus: "family_ready",
    actionable: true,
    blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
    maxSelectedCount: normalizedEntry.maxSelectedCount,
    allowedWorkerIds,
    preferredWorkerId,
    nextAction: normalizedEntry.holdReason
      ?? "This worker family is cleared for recovery-runtime cycle resume."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview(receiptState, governanceState, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const currentGovernance = Array.isArray(governanceState?.families) ? governanceState.families : [];
  const currentByFamily = new Map(currentGovernance.map((entry) => {
    const normalized = normalizeGovernanceEntry(entry);
    return [normalized.workerFamilyKey, normalized];
  }));
  const evaluatedReceipts = (Array.isArray(receiptState?.receipts) ? receiptState.receipts : [])
    .map((receipt) => evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(receipt, { now: options.now }))
    .sort(compareCycleCandidates);
  const receiptsByFamily = new Map();

  for (const entry of evaluatedReceipts) {
    const familyKey = buildWorkerFamilyKey(entry.receipt.workerIds);
    const group = receiptsByFamily.get(familyKey) ?? [];
    group.push(entry);
    receiptsByFamily.set(familyKey, group);
  }

  const familyKeys = [...new Set([
    ...receiptsByFamily.keys(),
    ...currentByFamily.keys()
  ])].sort((left, right) => left.localeCompare(right));

  const familyReviews = familyKeys.map((familyKey) => {
    const entries = [...(receiptsByFamily.get(familyKey) ?? [])].sort(compareCycleCandidates);
    const currentEntry = currentByFamily.get(familyKey) ?? null;
    const openReadyEntries = entries.filter((entry) => entry.effectiveReceiptState === "open_ready");
    const primary = openReadyEntries[0] ?? entries[0] ?? null;
    const currentEvaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyGovernance(currentEntry, primary?.receipt ?? null, {
      now: options.now
    });

    const recommendedBase = currentEntry ?? {
      workerFamilyKey: familyKey,
      status: "family_ready"
    };
    const hasConflict = openReadyEntries.length > 1;
    const hasMissingResumeContract = Boolean(primary?.effectiveReceiptState === "open_ready" && !primary.receipt.resumeContractPath);
    let suggestedEntry = createSuggestedEntry(recommendedBase, {
      workerFamilyKey: familyKey,
      sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-apply",
      updatedAt: generatedAt
    });

    if (!currentEntry || currentEntry.status === "family_ready") {
      if (hasConflict) {
        suggestedEntry = createSuggestedEntry(suggestedEntry, {
          status: "family_backpressure",
          holdReason: "This worker family currently has multiple open resumable cycle receipts; drain the highest-priority one before opening the family again.",
          blockedUntil: suggestedEntry.blockedUntil ?? computeBlockedUntil(options.now ?? generatedAt, DEFAULT_FAMILY_BACKPRESSURE_SECONDS)
        });
      } else if (hasMissingResumeContract) {
        suggestedEntry = createSuggestedEntry(suggestedEntry, {
          status: "family_manual_hold",
          holdReason: "The highest-priority cycle receipt is missing its resume contract path and needs manual repair first.",
          blockedUntil: null
        });
      } else {
        suggestedEntry = createSuggestedEntry(suggestedEntry, {
          status: "family_ready",
          holdReason: suggestedEntry.status === "family_ready" ? suggestedEntry.holdReason : null
        });
      }
    }

    const suggestedEvaluation = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeFamilyGovernance(
      suggestedEntry,
      primary?.receipt ?? null,
      { now: options.now }
    );
    const shouldPersist = Boolean(
      currentEntry
      || suggestedEntry.status !== "family_ready"
      || suggestedEntry.maxSelectedCount != null
      || suggestedEntry.allowedWorkerIds.length > 0
      || suggestedEntry.preferredWorkerId
      || suggestedEntry.notes
    );

    return {
      workerFamilyKey: familyKey,
      primaryReceipt: primary?.receipt ?? null,
      openReadyCount: openReadyEntries.length,
      reviewReceiptCount: entries.length,
      currentEntry,
      currentStatus: currentEvaluation.effectiveStatus,
      suggestedEntry,
      suggestedStatus: suggestedEvaluation.effectiveStatus,
      shouldPersist,
      nextAction: suggestedEvaluation.nextAction
    };
  });

  const persistedSuggestions = familyReviews.filter((item) => item.shouldPersist);
  const statusCounts = familyReviews.reduce((counts, item) => {
    const key = item.suggestedStatus;
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});

  return {
    schemaVersion: 1,
    generatedAt,
    familyCount: familyReviews.length,
    receiptCount: Array.isArray(receiptState?.receipts) ? receiptState.receipts.length : 0,
    persistedSuggestionCount: persistedSuggestions.length,
    currentGovernedCount: currentGovernance.length,
    statusCounts,
    familyReviews,
    nextAction: persistedSuggestions.length > 0
      ? "Apply the suggested family governance if the current worker-family holds and throttles look correct."
      : "No family-level governance change is currently suggested."
  };
}

export function applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview(currentState, review, options = {}) {
  const currentFamilies = Array.isArray(currentState?.families) ? currentState.families : [];
  const nextByFamily = new Map(currentFamilies.map((entry) => {
    const normalized = normalizeGovernanceEntry(entry);
    return [normalized.workerFamilyKey, normalized];
  }));
  const receipts = [];
  const appliedAt = options.appliedAt ?? new Date().toISOString();

  for (const familyReview of review.familyReviews) {
    if (!familyReview.shouldPersist) {
      continue;
    }

    const nextEntry = createSuggestedEntry(familyReview.suggestedEntry, {
      updatedAt: appliedAt,
      notes: options.notes || familyReview.suggestedEntry.notes || null
    });
    nextByFamily.set(nextEntry.workerFamilyKey, nextEntry);
    receipts.push({
      workerFamilyKey: nextEntry.workerFamilyKey,
      status: nextEntry.status,
      blockedUntil: nextEntry.blockedUntil,
      maxSelectedCount: nextEntry.maxSelectedCount,
      preferredWorkerId: nextEntry.preferredWorkerId,
      allowedWorkerIds: nextEntry.allowedWorkerIds,
      notes: nextEntry.notes
    });
  }

  const nextState = {
    schemaVersion: 1,
    families: [...nextByFamily.values()].sort((left, right) =>
      String(left.workerFamilyKey).localeCompare(String(right.workerFamilyKey))
    )
  };

  return {
    nextState,
    receipts
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceSummary(review) {
  const familyLines = review.familyReviews.length > 0
    ? review.familyReviews.map((item) => {
      const primary = item.primaryReceipt;
      return `- family=${item.workerFamilyKey}: current=${item.currentStatus} | suggested=${item.suggestedStatus} | open_ready=${item.openReadyCount} | receipts=${item.reviewReceiptCount}${primary ? ` | primary=${primary.receiptId}` : ""}${item.suggestedEntry.blockedUntil ? ` | blocked_until=${item.suggestedEntry.blockedUntil}` : ""}${item.suggestedEntry.maxSelectedCount != null ? ` | max_selected=${item.suggestedEntry.maxSelectedCount}` : ""}${item.suggestedEntry.preferredWorkerId ? ` | preferred_worker=${item.suggestedEntry.preferredWorkerId}` : ""}`;
    }).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Governance

- generated_at: ${review.generatedAt}
- receipt_count: ${review.receiptCount}
- family_count: ${review.familyCount}
- current_governed_count: ${review.currentGovernedCount}
- persisted_suggestion_count: ${review.persistedSuggestionCount}
- ready_count: ${review.statusCounts.family_ready ?? 0}
- manual_hold_count: ${review.statusCounts.family_manual_hold ?? 0}
- backpressure_count: ${review.statusCounts.family_backpressure ?? 0}
- budget_exhausted_count: ${review.statusCounts.family_budget_exhausted ?? 0}

## Family Reviews

${familyLines}

## Next Action

- ${review.nextAction}
`;
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan(governanceState, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const fromStatus = normalizeGovernanceReleaseFilter(options.fromStatus);
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null;
  const families = (Array.isArray(governanceState?.families) ? governanceState.families : [])
    .map((entry) => normalizeGovernanceEntry(entry))
    .sort((left, right) => String(left.workerFamilyKey).localeCompare(String(right.workerFamilyKey)));
  const selectedFamilies = [];
  const blockedFamilies = [];

  for (const entry of families) {
    const matchesFilter = fromStatus === "all"
      ? true
      : fromStatus === "problematic"
        ? ["family_manual_hold", "family_backpressure", "family_budget_exhausted"].includes(entry.status)
        : fromStatus === "manual_hold"
          ? entry.status === "family_manual_hold"
          : fromStatus === "backpressure"
            ? entry.status === "family_backpressure"
            : fromStatus === "budget_exhausted"
              ? entry.status === "family_budget_exhausted"
              : entry.status === fromStatus;
    if (!matchesFilter) {
      continue;
    }

    if (limit && selectedFamilies.length >= limit) {
      blockedFamilies.push({
        workerFamilyKey: entry.workerFamilyKey,
        currentStatus: entry.status,
        releaseAction: "selection_capped",
        nextAction: "Raise the release review limit or run another governance release pass."
      });
      continue;
    }

    if (entry.status === "family_budget_exhausted" && !options.clearBudget) {
      blockedFamilies.push({
        workerFamilyKey: entry.workerFamilyKey,
        currentStatus: entry.status,
        releaseAction: "needs_clear_budget",
        nextAction: "Re-run this release with --clear-budget to remove the selected-count ceiling for this family."
      });
      continue;
    }

    selectedFamilies.push({
      workerFamilyKey: entry.workerFamilyKey,
      currentEntry: entry,
      releaseAction: "release_ready",
      clearBudget: Boolean(options.clearBudget && entry.status === "family_budget_exhausted"),
      nextAction: entry.status === "family_budget_exhausted"
        ? "Release this family and clear its selected-count budget so it can resume again."
        : "Release this family back into the ready pool."
    });
  }

  return {
    schemaVersion: 1,
    generatedAt,
    fromStatus,
    familyCount: families.length,
    selectedCount: selectedFamilies.length,
    blockedCount: blockedFamilies.length,
    clearBudget: Boolean(options.clearBudget),
    selectedFamilies,
    blockedFamilies,
    nextAction: selectedFamilies.length > 0
      ? "Apply the selected governance release plan to reopen the chosen worker families."
      : blockedFamilies.some((item) => item.releaseAction === "needs_clear_budget")
        ? "No family is directly releasable yet; use --clear-budget for budget-exhausted families."
        : "No worker family currently matches this release filter."
  };
}

export function applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan(currentState, plan, options = {}) {
  const currentFamilies = Array.isArray(currentState?.families) ? currentState.families : [];
  const nextByFamily = new Map(currentFamilies.map((entry) => {
    const normalized = normalizeGovernanceEntry(entry);
    return [normalized.workerFamilyKey, normalized];
  }));
  const releasedFamilies = [];
  const releasedAt = options.releasedAt ?? new Date().toISOString();

  for (const family of plan.selectedFamilies) {
    const currentEntry = normalizeGovernanceEntry(family.currentEntry);
    let nextEntry = normalizeGovernanceEntry({
      ...currentEntry,
      status: "family_ready",
      holdReason: options.notes || null,
      blockedUntil: null,
      maxSelectedCount: family.clearBudget ? null : currentEntry.maxSelectedCount,
      updatedAt: releasedAt,
      sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-release",
      notes: options.notes || currentEntry.notes || null
    });
    if (!isMeaningfulGovernanceEntry({
      ...nextEntry,
      notes: null
    })) {
      nextEntry = normalizeGovernanceEntry({
        ...nextEntry,
        notes: null
      });
    }

    if (isMeaningfulGovernanceEntry(nextEntry)) {
      nextByFamily.set(nextEntry.workerFamilyKey, nextEntry);
    } else {
      nextByFamily.delete(nextEntry.workerFamilyKey);
    }

    releasedFamilies.push({
      workerFamilyKey: currentEntry.workerFamilyKey,
      previousStatus: currentEntry.status,
      releasedStatus: nextEntry.status,
      clearedBudget: Boolean(family.clearBudget),
      preferredWorkerId: nextEntry.preferredWorkerId,
      allowedWorkerIds: nextEntry.allowedWorkerIds,
      notes: nextEntry.notes
    });
  }

  const nextState = {
    schemaVersion: 1,
    families: [...nextByFamily.values()].sort((left, right) =>
      String(left.workerFamilyKey).localeCompare(String(right.workerFamilyKey))
    )
  };

  return {
    nextState,
    receipts: releasedFamilies
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseSummary(plan) {
  const selectedLines = plan.selectedFamilies.length > 0
    ? plan.selectedFamilies.map((item) =>
      `- family=${item.workerFamilyKey}: current=${item.currentEntry.status} | action=${item.releaseAction}${item.clearBudget ? " | clear_budget=yes" : ""}`
    ).join("\n")
    : "- none";
  const blockedLines = plan.blockedFamilies.length > 0
    ? plan.blockedFamilies.map((item) =>
      `- family=${item.workerFamilyKey}: current=${item.currentStatus} | action=${item.releaseAction}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Governance Release

- generated_at: ${plan.generatedAt}
- family_count: ${plan.familyCount}
- from_status: ${plan.fromStatus}
- clear_budget: ${plan.clearBudget ? "yes" : "no"}
- selected_count: ${plan.selectedCount}
- blocked_count: ${plan.blockedCount}

## Selected Families

${selectedLines}

## Blocked Families

${blockedLines}

## Next Action

- ${plan.nextAction}
`;
}
