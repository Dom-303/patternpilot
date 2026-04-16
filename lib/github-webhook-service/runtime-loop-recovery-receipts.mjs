import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_LOOP_RECOVERY_RECEIPTS_PATH = path.join("state", "github-app-service-runtime-loop-recovery-receipts.json");
const DEFAULT_RUNTIME_LOOP_RECOVERY_MAX_ATTEMPTS = 3;
const DEFAULT_RUNTIME_LOOP_RECOVERY_BACKOFF_SECONDS = 300;

function normalizeRuntimeLoopRecoveryReceipt(receipt = {}) {
  return {
    receiptId: String(receipt.receiptId ?? "").trim() || "unknown-receipt",
    runId: String(receipt.runId ?? "").trim() || "unknown-run",
    generatedAt: receipt.generatedAt ?? new Date().toISOString(),
    sourceCommand: receipt.sourceCommand ?? "github-app-service-runtime-loop-run",
    stopReason: receipt.stopReason ?? "unknown",
    recoveryStatus: receipt.recoveryStatus ?? "runtime_loop_recovery_manual_review",
    receiptState: receipt.receiptState ?? "manual_review",
    selectedCount: Number(receipt.selectedCount ?? 0),
    completedLoops: Number(receipt.completedLoops ?? 0),
    remainingLoopBudget: Number(receipt.remainingLoopBudget ?? 0),
    resumeReady: Boolean(receipt.resumeReady),
    workerIds: Array.isArray(receipt.workerIds) ? receipt.workerIds : [],
    schedulerLane: receipt.schedulerLane ?? null,
    attemptCount: Number(receipt.attemptCount ?? 0),
    maxAttempts: Number(receipt.maxAttempts ?? DEFAULT_RUNTIME_LOOP_RECOVERY_MAX_ATTEMPTS),
    backoffSeconds: Number(receipt.backoffSeconds ?? DEFAULT_RUNTIME_LOOP_RECOVERY_BACKOFF_SECONDS),
    lastAttemptAt: receipt.lastAttemptAt ?? null,
    blockedUntil: receipt.blockedUntil ?? null,
    lastOutcome: receipt.lastOutcome ?? null,
    statePath: receipt.statePath ?? null,
    receiptsPath: receipt.receiptsPath ?? null,
    resumeContractPath: receipt.resumeContractPath ?? null,
    recoveryContractPath: receipt.recoveryContractPath ?? null,
    summaryPath: receipt.summaryPath ?? null,
    recoveredAt: receipt.recoveredAt ?? null,
    recoveredByRunId: receipt.recoveredByRunId ?? null,
    notes: receipt.notes ?? null
  };
}

function inferReceiptState(recoveryStatus) {
  switch (recoveryStatus) {
    case "dispatch_ready_runtime_loop_recovery_contract":
      return "open";
    case "runtime_loop_recovery_preview_only":
      return "preview_only";
    case "runtime_loop_recovery_not_required":
      return "not_required";
    default:
      return "manual_review";
  }
}

function normalizeRuntimeLoopRecoveryReceiptFilter(value) {
  if (!value) {
    return "problematic";
  }
  return String(value).trim().toLowerCase().replace(/-/g, "_");
}

export function getGithubWebhookServiceRuntimeLoopRecoveryReceiptsPath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_RECOVERY_RECEIPTS_PATH);
}

function computeBlockedUntil(at, backoffSeconds) {
  if (!backoffSeconds || backoffSeconds <= 0) {
    return null;
  }
  return new Date(new Date(at).getTime() + (backoffSeconds * 1000)).toISOString();
}

export async function loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir) {
  const receiptsPath = getGithubWebhookServiceRuntimeLoopRecoveryReceiptsPath(rootDir);
  try {
    const raw = await fs.readFile(receiptsPath, "utf8");
    const parsed = JSON.parse(raw);
    const receipts = Array.isArray(parsed.receipts)
      ? parsed.receipts.map((receipt) => normalizeRuntimeLoopRecoveryReceipt(receipt))
      : [];
    return {
      schemaVersion: 1,
      receiptsPath,
      receipts
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        receiptsPath,
        receipts: []
      };
    }
    throw error;
  }
}

export async function writeGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir, state, options = {}) {
  const receiptsPath = getGithubWebhookServiceRuntimeLoopRecoveryReceiptsPath(rootDir);
  if (options.dryRun) {
    return receiptsPath;
  }

  await fs.mkdir(path.dirname(receiptsPath), { recursive: true });
  await fs.writeFile(receiptsPath, `${JSON.stringify({
    schemaVersion: 1,
    receipts: Array.isArray(state.receipts)
      ? state.receipts.map((receipt) => normalizeRuntimeLoopRecoveryReceipt(receipt))
      : []
  }, null, 2)}\n`, "utf8");
  return receiptsPath;
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryReceipt(loopState, recoveryContract, options = {}) {
  const recoveryStatus = recoveryContract?.contractStatus ?? "runtime_loop_recovery_manual_review";
  return normalizeRuntimeLoopRecoveryReceipt({
    receiptId: options.receiptId
      ?? `${options.runId ?? "unknown-run"}::${options.sourceCommand ?? "github-app-service-runtime-loop-run"}`,
    runId: options.runId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceCommand: options.sourceCommand,
    stopReason: loopState?.stopReason ?? recoveryContract?.stopReason ?? "unknown",
    recoveryStatus,
    receiptState: options.receiptState ?? inferReceiptState(recoveryStatus),
    selectedCount: recoveryContract?.selectedCount ?? 0,
    completedLoops: loopState?.completedLoops ?? 0,
    remainingLoopBudget: loopState?.remainingLoopBudget ?? 0,
    resumeReady: loopState?.resumeReady ?? recoveryContract?.resumeReady ?? false,
    workerIds: loopState?.workerIds ?? recoveryContract?.workerIds ?? [],
    schedulerLane: loopState?.schedulerLane ?? recoveryContract?.schedulerLane ?? null,
    attemptCount: options.attemptCount ?? 0,
    maxAttempts: options.maxAttempts ?? recoveryContract?.maxAttempts ?? DEFAULT_RUNTIME_LOOP_RECOVERY_MAX_ATTEMPTS,
    backoffSeconds: options.backoffSeconds ?? recoveryContract?.backoffSeconds ?? DEFAULT_RUNTIME_LOOP_RECOVERY_BACKOFF_SECONDS,
    lastAttemptAt: options.lastAttemptAt ?? null,
    blockedUntil: options.blockedUntil ?? null,
    lastOutcome: options.lastOutcome ?? null,
    statePath: options.statePath ?? recoveryContract?.loopStatePath ?? null,
    receiptsPath: options.receiptsPath ?? recoveryContract?.receiptsPath ?? null,
    resumeContractPath: options.resumeContractPath ?? recoveryContract?.resumeContractPath ?? null,
    recoveryContractPath: options.recoveryContractPath ?? null,
    summaryPath: options.summaryPath ?? recoveryContract?.summaryPath ?? null,
    notes: options.notes ?? null
  });
}

export async function appendGithubWebhookServiceRuntimeLoopRecoveryReceipt(rootDir, receipt, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const nextState = {
    ...current,
    receipts: [...current.receipts, normalizeRuntimeLoopRecoveryReceipt(receipt)]
  };
  await writeGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir, nextState, options);
  return {
    state: nextState,
    receipt: normalizeRuntimeLoopRecoveryReceipt(receipt)
  };
}

export function evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt(receipt, options = {}) {
  const normalized = normalizeRuntimeLoopRecoveryReceipt(receipt);
  const now = options.now ? new Date(options.now) : new Date();
  const blockedUntil = normalized.blockedUntil ? new Date(normalized.blockedUntil) : null;

  if (normalized.receiptState === "recovered") {
    return {
      receipt: normalized,
      effectiveReceiptState: "recovered",
      actionable: false,
      blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
      nextAction: "This runtime-loop recovery receipt has already been recovered."
    };
  }

  if (normalized.receiptState === "preview_only") {
    return {
      receipt: normalized,
      effectiveReceiptState: "preview_only",
      actionable: false,
      blockedUntil: null,
      nextAction: "Convert this previewed runtime loop into a real runtime loop before recovering it."
    };
  }

  if (normalized.receiptState === "not_required") {
    return {
      receipt: normalized,
      effectiveReceiptState: "not_required",
      actionable: false,
      blockedUntil: null,
      nextAction: "This runtime-loop recovery receipt no longer requires recovery."
    };
  }

  if (normalized.receiptState === "manual_review") {
    return {
      receipt: normalized,
      effectiveReceiptState: "manual_review",
      actionable: false,
      blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
      nextAction: normalized.notes ?? "This runtime-loop recovery receipt still needs manual review."
    };
  }

  if (normalized.attemptCount >= normalized.maxAttempts) {
    return {
      receipt: normalized,
      effectiveReceiptState: "exhausted",
      actionable: false,
      blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
      nextAction: `Recovery attempts are exhausted after ${normalized.attemptCount} tries; inspect this runtime-loop receipt manually.`
    };
  }

  if (blockedUntil && now < blockedUntil) {
    return {
      receipt: normalized,
      effectiveReceiptState: "backoff_pending",
      actionable: false,
      blockedUntil: blockedUntil.toISOString(),
      nextAction: "Wait until the runtime-loop recovery backoff window has elapsed before retrying."
    };
  }

  return {
    receipt: normalized,
    effectiveReceiptState: "open_ready",
    actionable: true,
    blockedUntil: blockedUntil ? blockedUntil.toISOString() : null,
    nextAction: "This runtime-loop recovery receipt can be retried now."
  };
}

export async function markGithubWebhookServiceRuntimeLoopRecoveryReceiptRecovered(rootDir, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  let updated = false;
  const receipts = current.receipts.map((receipt) => {
    const matches = (options.recoveryContractPath && receipt.recoveryContractPath === options.recoveryContractPath)
      || (options.receiptId && receipt.receiptId === options.receiptId);
    if (!matches || receipt.receiptState !== "open") {
      return receipt;
    }
    updated = true;
    return normalizeRuntimeLoopRecoveryReceipt({
      ...receipt,
      receiptState: "recovered",
      recoveredAt: options.recoveredAt ?? new Date().toISOString(),
      recoveredByRunId: options.recoveredByRunId ?? null,
      notes: options.notes ?? receipt.notes ?? null
    });
  });

  const nextState = {
    ...current,
    receipts
  };
  if (updated) {
    await writeGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir, nextState, options);
  }
  return {
    updated,
    state: nextState
  };
}

export async function markGithubWebhookServiceRuntimeLoopRecoveryReceiptAttempted(rootDir, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  let updated = false;
  const attemptedAt = options.attemptedAt ?? new Date().toISOString();
  const maxAttempts = Number(options.maxAttempts ?? DEFAULT_RUNTIME_LOOP_RECOVERY_MAX_ATTEMPTS);
  const backoffSeconds = Number(options.backoffSeconds ?? DEFAULT_RUNTIME_LOOP_RECOVERY_BACKOFF_SECONDS);

  const receipts = current.receipts.map((receipt) => {
    const matches = (options.recoveryContractPath && receipt.recoveryContractPath === options.recoveryContractPath)
      || (options.receiptId && receipt.receiptId === options.receiptId);
    if (!matches) {
      return receipt;
    }

    updated = true;
    const nextAttemptCount = Number(receipt.attemptCount ?? 0) + 1;
    return normalizeRuntimeLoopRecoveryReceipt({
      ...receipt,
      attemptCount: nextAttemptCount,
      maxAttempts,
      backoffSeconds,
      lastAttemptAt: attemptedAt,
      blockedUntil: computeBlockedUntil(attemptedAt, backoffSeconds),
      lastOutcome: "attempted",
      notes: options.notes ?? receipt.notes ?? null
    });
  });

  const nextState = {
    ...current,
    receipts
  };
  if (updated) {
    await writeGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir, nextState, options);
  }
  return {
    updated,
    state: nextState
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryReceiptReleasePlan(state, options = {}) {
  const receipts = Array.isArray(state?.receipts) ? [...state.receipts] : [];
  const filter = normalizeRuntimeLoopRecoveryReceiptFilter(options.fromStatus);
  const limit = Number.isFinite(options.limit) && options.limit > 0
    ? Number(options.limit)
    : null;
  const evaluatedReceipts = receipts.map((receipt) =>
    evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt(receipt, { now: options.now })
  );
  const filtered = evaluatedReceipts.filter((entry) => {
    if (filter === "all") {
      return true;
    }
    if (filter === "problematic") {
      return entry.effectiveReceiptState === "backoff_pending"
        || entry.effectiveReceiptState === "manual_review"
        || entry.effectiveReceiptState === "exhausted";
    }
    return entry.effectiveReceiptState === filter;
  });
  const selectedReceipts = limit ? filtered.slice(0, limit) : filtered;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    filter,
    totalMatches: filtered.length,
    selectedCount: selectedReceipts.length,
    selectedReceipts,
    resetAttempts: Boolean(options.resetAttempts),
    nextAction: selectedReceipts.length > 0
      ? "Release the selected runtime-loop recovery receipts back into the open pool when you are comfortable overriding their current state."
      : "No runtime-loop recovery receipts match the requested release filter."
  };
}

export async function releaseGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const selectedIds = new Set(Array.isArray(options.receiptIds) ? options.receiptIds : []);
  const selectedPaths = new Set(Array.isArray(options.recoveryContractPaths) ? options.recoveryContractPaths : []);
  const releasedAt = options.releasedAt ?? new Date().toISOString();
  let releaseCount = 0;

  const receipts = current.receipts.map((receipt) => {
    const matches = selectedIds.has(receipt.receiptId)
      || (receipt.recoveryContractPath && selectedPaths.has(receipt.recoveryContractPath));
    if (!matches) {
      return receipt;
    }

    releaseCount += 1;
    const shouldResetAttempts = Boolean(options.resetAttempts)
      || evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt(receipt, { now: options.now }).effectiveReceiptState === "exhausted";
    return normalizeRuntimeLoopRecoveryReceipt({
      ...receipt,
      receiptState: "open",
      attemptCount: shouldResetAttempts ? 0 : receipt.attemptCount,
      blockedUntil: null,
      lastOutcome: "released",
      notes: options.notes ?? receipt.notes ?? null,
      lastAttemptAt: shouldResetAttempts ? null : receipt.lastAttemptAt,
      generatedAt: receipt.generatedAt ?? releasedAt
    });
  });

  const nextState = {
    ...current,
    receipts
  };
  if (releaseCount > 0) {
    await writeGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir, nextState, options);
  }
  return {
    releasedAt,
    releaseCount,
    state: nextState
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryReceiptsReview(state, options = {}) {
  const receipts = Array.isArray(state?.receipts) ? [...state.receipts] : [];
  const limit = Number.isFinite(options.limit) && options.limit > 0
    ? Number(options.limit)
    : 10;
  const evaluatedReceipts = receipts
    .slice(-limit)
    .reverse()
    .map((receipt) => evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt(receipt, { now: options.now }));
  const openReadyReceipts = evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "open_ready");
  const recoveredReceipts = evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "recovered");
  const manualReviewReceipts = evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "manual_review");
  const previewOnlyReceipts = evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "preview_only");
  const backoffPendingReceipts = evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "backoff_pending");
  const exhaustedReceipts = evaluatedReceipts.filter((entry) => entry.effectiveReceiptState === "exhausted");
  const bestReceipt = openReadyReceipts[0]?.receipt ?? null;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    receiptCount: receipts.length,
    reviewCount: evaluatedReceipts.length,
    openCount: openReadyReceipts.length,
    recoveredCount: recoveredReceipts.length,
    manualReviewCount: manualReviewReceipts.length,
    previewOnlyCount: previewOnlyReceipts.length,
    backoffPendingCount: backoffPendingReceipts.length,
    exhaustedCount: exhaustedReceipts.length,
    bestReceipt,
    recentReceipts: evaluatedReceipts,
    nextAction: bestReceipt
      ? "Recover the latest open runtime-loop receipt or let auto-recover consume it."
      : backoffPendingReceipts.length > 0
        ? "Wait until the backoff window elapses or manually release a blocked runtime-loop recovery receipt."
      : manualReviewReceipts.length > 0
        ? "Inspect runtime-loop recovery receipts that still require manual review."
        : previewOnlyReceipts.length > 0
          ? "Convert preview-only loops into real runtime loops before expecting recovery."
          : "No open runtime-loop recovery receipt is currently available."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryReceiptReleaseSummary(plan) {
  const receiptLines = plan.selectedReceipts.length > 0
    ? plan.selectedReceipts.map((entry) => {
      const receipt = entry.receipt;
      return `- receipt=${receipt.receiptId}: state=${entry.effectiveReceiptState} | attempts=${receipt.attemptCount}/${receipt.maxAttempts}${entry.blockedUntil ? ` | blocked_until=${entry.blockedUntil}` : ""}${receipt.recoveryContractPath ? ` | recovery_contract=${receipt.recoveryContractPath}` : ""}`;
    }).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Receipt Release

- generated_at: ${plan.generatedAt}
- filter: ${plan.filter}
- total_matches: ${plan.totalMatches}
- selected_count: ${plan.selectedCount}
- reset_attempts: ${plan.resetAttempts ? "yes" : "no"}

## Selected Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryReceiptsReviewSummary(review) {
  const receiptLines = review.recentReceipts.length > 0
    ? review.recentReceipts.map((entry) => {
      const receipt = entry.receipt;
      return `- receipt=${receipt.receiptId}: state=${entry.effectiveReceiptState} | recovery=${receipt.recoveryStatus} | stop=${receipt.stopReason} | selected=${receipt.selectedCount} | attempts=${receipt.attemptCount}/${receipt.maxAttempts}${entry.blockedUntil ? ` | blocked_until=${entry.blockedUntil}` : ""}${receipt.recoveryContractPath ? ` | recovery_contract=${receipt.recoveryContractPath}` : ""}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`;
    }).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Receipts

- generated_at: ${review.generatedAt}
- receipt_count: ${review.receiptCount}
- review_count: ${review.reviewCount}
- open_count: ${review.openCount}
- recovered_count: ${review.recoveredCount}
- manual_review_count: ${review.manualReviewCount}
- preview_only_count: ${review.previewOnlyCount}
- backoff_pending_count: ${review.backoffPendingCount}
- exhausted_count: ${review.exhaustedCount}

## Recent Recovery Receipts

${receiptLines}

## Next Action

- ${review.nextAction}
`;
}
