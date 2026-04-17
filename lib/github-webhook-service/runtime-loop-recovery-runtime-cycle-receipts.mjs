import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RECEIPTS_PATH = path.join(
  "state",
  "github-app-service-runtime-loop-recovery-runtime-cycle-receipts.json"
);

function normalizeRuntimeLoopRecoveryRuntimeCycleReceipt(receipt = {}) {
  return {
    receiptId: String(receipt.receiptId ?? "").trim() || "unknown-receipt",
    runId: String(receipt.runId ?? "").trim() || "unknown-run",
    generatedAt: receipt.generatedAt ?? new Date().toISOString(),
    sourceCommand: receipt.sourceCommand ?? "github-app-service-runtime-loop-recovery-runtime-cycle-run",
    stopReason: receipt.stopReason ?? "unknown",
    receiptState: receipt.receiptState ?? "not_required",
    completedRounds: Number(receipt.completedRounds ?? 0),
    totalSelectedCount: Number(receipt.totalSelectedCount ?? 0),
    totalExecutedCount: Number(receipt.totalExecutedCount ?? 0),
    remainingCycleBudget: Number(receipt.remainingCycleBudget ?? 0),
    resumeReady: Boolean(receipt.resumeReady),
    workerIds: Array.isArray(receipt.workerIds) ? receipt.workerIds : [],
    statePath: receipt.statePath ?? null,
    receiptsPath: receipt.receiptsPath ?? null,
    resumeContractPath: receipt.resumeContractPath ?? null,
    summaryPath: receipt.summaryPath ?? null,
    resumedAt: receipt.resumedAt ?? null,
    resumedByRunId: receipt.resumedByRunId ?? null,
    notes: receipt.notes ?? null
  };
}

function inferReceiptState(cycleState) {
  return cycleState?.resumeReady ? "open" : "not_required";
}

export function getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsPath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RECEIPTS_PATH);
}

export async function loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir) {
  const receiptsPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsPath(rootDir);
  try {
    const raw = await fs.readFile(receiptsPath, "utf8");
    const parsed = JSON.parse(raw);
    const receipts = Array.isArray(parsed.receipts)
      ? parsed.receipts.map((receipt) => normalizeRuntimeLoopRecoveryRuntimeCycleReceipt(receipt))
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

export async function writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir, state, options = {}) {
  const receiptsPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsPath(rootDir);
  if (options.dryRun) {
    return receiptsPath;
  }

  await fs.mkdir(path.dirname(receiptsPath), { recursive: true });
  await fs.writeFile(receiptsPath, `${JSON.stringify({
    schemaVersion: 1,
    receipts: Array.isArray(state.receipts)
      ? state.receipts.map((receipt) => normalizeRuntimeLoopRecoveryRuntimeCycleReceipt(receipt))
      : []
  }, null, 2)}\n`, "utf8");
  return receiptsPath;
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(cycleState, options = {}) {
  return normalizeRuntimeLoopRecoveryRuntimeCycleReceipt({
    receiptId: options.receiptId ?? `${options.runId ?? "unknown-run"}::${options.sourceCommand ?? "github-app-service-runtime-loop-recovery-runtime-cycle-run"}`,
    runId: options.runId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sourceCommand: options.sourceCommand,
    stopReason: cycleState?.stopReason ?? "unknown",
    receiptState: options.receiptState ?? inferReceiptState(cycleState),
    completedRounds: cycleState?.completedRounds ?? 0,
    totalSelectedCount: cycleState?.totalSelectedCount ?? 0,
    totalExecutedCount: cycleState?.totalExecutedCount ?? 0,
    remainingCycleBudget: cycleState?.remainingCycleBudget ?? 0,
    resumeReady: cycleState?.resumeReady ?? false,
    workerIds: cycleState?.workerIds ?? [],
    statePath: options.statePath ?? null,
    receiptsPath: options.receiptsPath ?? null,
    resumeContractPath: options.resumeContractPath ?? null,
    summaryPath: options.summaryPath ?? null,
    notes: options.notes ?? null
  });
}

export async function appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, receipt, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const nextState = {
    ...current,
    receipts: [...current.receipts, normalizeRuntimeLoopRecoveryRuntimeCycleReceipt(receipt)]
  };
  await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir, nextState, options);
  return {
    state: nextState,
    receipt: normalizeRuntimeLoopRecoveryRuntimeCycleReceipt(receipt)
  };
}

export function evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(receipt) {
  const normalized = normalizeRuntimeLoopRecoveryRuntimeCycleReceipt(receipt);

  if (normalized.receiptState === "resumed") {
    return {
      receipt: normalized,
      effectiveReceiptState: "resumed",
      actionable: false,
      nextAction: "This recovery-runtime cycle receipt has already been resumed."
    };
  }

  if (normalized.receiptState === "not_required") {
    return {
      receipt: normalized,
      effectiveReceiptState: "not_required",
      actionable: false,
      nextAction: "This recovery-runtime cycle no longer requires a resume step."
    };
  }

  if (normalized.resumeReady) {
    return {
      receipt: normalized,
      effectiveReceiptState: "open_ready",
      actionable: true,
      nextAction: "This recovery-runtime cycle receipt can be resumed now."
    };
  }

  return {
    receipt: normalized,
    effectiveReceiptState: "not_required",
    actionable: false,
    nextAction: "This recovery-runtime cycle is not resumable right now."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview(state, options = {}) {
  const receipts = Array.isArray(state?.receipts) ? [...state.receipts] : [];
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : 10;
  const recentReceipts = receipts
    .slice(-limit)
    .reverse()
    .map((receipt) => evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(receipt));
  const openReadyReceipts = recentReceipts.filter((entry) => entry.effectiveReceiptState === "open_ready");
  const resumedReceipts = recentReceipts.filter((entry) => entry.effectiveReceiptState === "resumed");
  const bestReceipt = openReadyReceipts[0]?.receipt ?? null;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    receiptCount: receipts.length,
    reviewCount: recentReceipts.length,
    openCount: openReadyReceipts.length,
    resumedCount: resumedReceipts.length,
    bestReceipt,
    recentReceipts,
    nextAction: bestReceipt
      ? "Resume the latest open recovery-runtime cycle receipt or let auto-resume consume it."
      : "No open recovery-runtime cycle receipt is currently available."
  };
}

export async function markGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptResumed(rootDir, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  let updated = false;
  const receipts = current.receipts.map((receipt) => {
    const matches = (options.resumeContractPath && receipt.resumeContractPath === options.resumeContractPath)
      || (options.receiptId && receipt.receiptId === options.receiptId);
    if (!matches || receipt.receiptState !== "open") {
      return receipt;
    }
    updated = true;
    return normalizeRuntimeLoopRecoveryRuntimeCycleReceipt({
      ...receipt,
      receiptState: "resumed",
      resumedAt: options.resumedAt ?? new Date().toISOString(),
      resumedByRunId: options.resumedByRunId ?? null,
      notes: options.notes ?? receipt.notes ?? null
    });
  });

  const nextState = {
    ...current,
    receipts
  };
  if (updated) {
    await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir, nextState, options);
  }
  return {
    updated,
    state: nextState
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReviewSummary(review) {
  const receiptLines = review.recentReceipts.length > 0
    ? review.recentReceipts.map((entry) => {
      const receipt = entry.receipt;
      return `- receipt=${receipt.receiptId}: state=${entry.effectiveReceiptState} | stop=${receipt.stopReason} | rounds=${receipt.completedRounds} | selected=${receipt.totalSelectedCount} | executed=${receipt.totalExecutedCount}${receipt.resumeContractPath ? ` | resume_contract=${receipt.resumeContractPath}` : ""}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`;
    }).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Receipts

- generated_at: ${review.generatedAt}
- receipt_count: ${review.receiptCount}
- review_count: ${review.reviewCount}
- open_count: ${review.openCount}
- resumed_count: ${review.resumedCount}

## Recent Cycle Receipts

${receiptLines}

## Next Action

- ${review.nextAction}
`;
}
