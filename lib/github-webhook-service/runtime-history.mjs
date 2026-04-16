import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_LOOP_HISTORY_PATH = path.join("state", "github-app-service-runtime-loop-history.json");

function normalizeRuntimeLoopHistoryEntry(entry = {}) {
  return {
    runId: String(entry.runId ?? "").trim() || "unknown-run",
    generatedAt: entry.generatedAt ?? new Date().toISOString(),
    commandName: entry.commandName ?? "github-app-service-runtime-loop-run",
    stopReason: entry.stopReason ?? "unknown",
    recoveryStatus: entry.recoveryStatus ?? "runtime_loop_recovery_manual_review",
    completedLoops: Number(entry.completedLoops ?? 0),
    totalSessions: Number(entry.totalSessions ?? 0),
    totalCycles: Number(entry.totalCycles ?? 0),
    selectedCount: Number(entry.selectedCount ?? 0),
    remainingLoopBudget: Number(entry.remainingLoopBudget ?? 0),
    resumeReady: Boolean(entry.resumeReady),
    workerIds: Array.isArray(entry.workerIds) ? entry.workerIds : [],
    statePath: entry.statePath ?? null,
    receiptsPath: entry.receiptsPath ?? null,
    resumeContractPath: entry.resumeContractPath ?? null,
    recoveryContractPath: entry.recoveryContractPath ?? null,
    summaryPath: entry.summaryPath ?? null
  };
}

export function getGithubWebhookServiceRuntimeLoopHistoryPath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_HISTORY_PATH);
}

export async function loadGithubWebhookServiceRuntimeLoopHistory(rootDir) {
  const historyPath = getGithubWebhookServiceRuntimeLoopHistoryPath(rootDir);
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.map((entry) => normalizeRuntimeLoopHistoryEntry(entry))
      : [];
    return {
      schemaVersion: 1,
      historyPath,
      entries
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        historyPath,
        entries: []
      };
    }
    throw error;
  }
}

export async function writeGithubWebhookServiceRuntimeLoopHistory(rootDir, state, options = {}) {
  const historyPath = getGithubWebhookServiceRuntimeLoopHistoryPath(rootDir);
  if (options.dryRun) {
    return historyPath;
  }
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(historyPath, `${JSON.stringify({
    schemaVersion: 1,
    entries: Array.isArray(state.entries)
      ? state.entries.map((entry) => normalizeRuntimeLoopHistoryEntry(entry))
      : []
  }, null, 2)}\n`, "utf8");
  return historyPath;
}

export function buildGithubWebhookServiceRuntimeLoopHistoryEntry(loopState, receipts = [], options = {}) {
  const selectedCount = Array.isArray(receipts)
    ? receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0)
    : 0;
  return normalizeRuntimeLoopHistoryEntry({
    runId: options.runId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    commandName: options.commandName,
    stopReason: loopState?.stopReason ?? "unknown",
    completedLoops: loopState?.completedLoops ?? 0,
    totalSessions: loopState?.totalSessions ?? 0,
    totalCycles: loopState?.totalCycles ?? 0,
    selectedCount,
    remainingLoopBudget: loopState?.remainingLoopBudget ?? 0,
    resumeReady: loopState?.resumeReady ?? false,
    workerIds: loopState?.workerIds ?? [],
    recoveryStatus: options.recoveryStatus,
    statePath: options.statePath ?? null,
    receiptsPath: options.receiptsPath ?? null,
    resumeContractPath: options.resumeContractPath ?? null,
    recoveryContractPath: options.recoveryContractPath ?? null,
    summaryPath: options.summaryPath ?? null
  });
}

export async function appendGithubWebhookServiceRuntimeLoopHistory(rootDir, entry, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopHistory(rootDir);
  const nextState = {
    ...current,
    entries: [...current.entries, normalizeRuntimeLoopHistoryEntry(entry)]
  };
  await writeGithubWebhookServiceRuntimeLoopHistory(rootDir, nextState, options);
  return {
    state: nextState,
    entry: normalizeRuntimeLoopHistoryEntry(entry)
  };
}

export function buildGithubWebhookServiceRuntimeLoopHistoryReview(historyState, options = {}) {
  const entries = Array.isArray(historyState?.entries) ? [...historyState.entries] : [];
  const limit = Number.isFinite(options.limit) && options.limit > 0
    ? Number(options.limit)
    : 10;
  const recentEntries = entries.slice(-limit).reverse();
  const resumableCount = recentEntries.filter((entry) => entry.resumeReady).length;
  const drainedCount = recentEntries.filter((entry) => entry.stopReason === "no_dispatchable_runtime").length;
  const previewCount = recentEntries.filter((entry) => entry.stopReason === "dry_run_preview" || entry.stopReason === "manual_preview").length;
  const recoveryReadyCount = recentEntries.filter((entry) => entry.recoveryStatus === "dispatch_ready_runtime_loop_recovery_contract").length;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    historyCount: entries.length,
    reviewCount: recentEntries.length,
    resumableCount,
    drainedCount,
    previewCount,
    recoveryReadyCount,
    recentEntries,
    nextAction: recoveryReadyCount > 0
      ? "Recover one of the latest runtime loops via its emitted loop recovery contract."
      : resumableCount > 0
      ? "Resume one of the latest runtime loops that still has remaining loop budget."
      : drainedCount > 0
        ? "Recent runtime loops are draining cleanly; inspect whether new queue work should trigger another loop."
        : previewCount > 0
          ? "Convert a dry-run or manual preview into a real runtime loop once ready."
          : "No runtime-loop history is available yet."
  };
}

export function renderGithubWebhookServiceRuntimeLoopHistoryReviewSummary(review) {
  const entryLines = review.recentEntries.length > 0
    ? review.recentEntries.map((entry) => `- run=${entry.runId}: command=${entry.commandName} | stop=${entry.stopReason} | recovery=${entry.recoveryStatus} | loops=${entry.completedLoops} | sessions=${entry.totalSessions} | cycles=${entry.totalCycles} | selected=${entry.selectedCount} | resume_ready=${entry.resumeReady ? "yes" : "no"}${entry.recoveryContractPath ? ` | recovery_contract=${entry.recoveryContractPath}` : ""}${entry.summaryPath ? ` | summary=${entry.summaryPath}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop History

- generated_at: ${review.generatedAt}
- history_count: ${review.historyCount}
- review_count: ${review.reviewCount}
- resumable_count: ${review.resumableCount}
- drained_count: ${review.drainedCount}
- preview_count: ${review.previewCount}
- recovery_ready_count: ${review.recoveryReadyCount}

## Recent Runtime Loops

${entryLines}

## Next Action

- ${review.nextAction}
`;
}
