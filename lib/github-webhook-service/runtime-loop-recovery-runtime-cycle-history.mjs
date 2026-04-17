import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_HISTORY_PATH = path.join(
  "state",
  "github-app-service-runtime-loop-recovery-runtime-cycle-history.json"
);

function normalizeRuntimeLoopRecoveryRuntimeCycleHistoryEntry(entry = {}) {
  return {
    runId: String(entry.runId ?? "").trim() || "unknown-run",
    generatedAt: entry.generatedAt ?? new Date().toISOString(),
    commandName: entry.commandName ?? "github-app-service-runtime-loop-recovery-runtime-cycle-run",
    stopReason: entry.stopReason ?? "unknown",
    completedRounds: Number(entry.completedRounds ?? 0),
    totalSelectedCount: Number(entry.totalSelectedCount ?? 0),
    totalExecutedCount: Number(entry.totalExecutedCount ?? 0),
    remainingCycleBudget: Number(entry.remainingCycleBudget ?? 0),
    resumeReady: Boolean(entry.resumeReady),
    workerIds: Array.isArray(entry.workerIds) ? entry.workerIds : [],
    statePath: entry.statePath ?? null,
    receiptsPath: entry.receiptsPath ?? null,
    resumeContractPath: entry.resumeContractPath ?? null,
    summaryPath: entry.summaryPath ?? null
  };
}

export function getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryPath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_HISTORY_PATH);
}

export async function loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir) {
  const historyPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryPath(rootDir);
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    const entries = Array.isArray(parsed.entries)
      ? parsed.entries.map((entry) => normalizeRuntimeLoopRecoveryRuntimeCycleHistoryEntry(entry))
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

export async function writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir, state, options = {}) {
  const historyPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryPath(rootDir);
  if (options.dryRun) {
    return historyPath;
  }
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(historyPath, `${JSON.stringify({
    schemaVersion: 1,
    entries: Array.isArray(state.entries)
      ? state.entries.map((entry) => normalizeRuntimeLoopRecoveryRuntimeCycleHistoryEntry(entry))
      : []
  }, null, 2)}\n`, "utf8");
  return historyPath;
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryEntry(cycleState, receipts = [], options = {}) {
  const totalSelectedCount = Array.isArray(receipts)
    ? receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0)
    : Number(cycleState?.totalSelectedCount ?? 0);
  const totalExecutedCount = Array.isArray(receipts)
    ? receipts.reduce((sum, receipt) => sum + Number(receipt.executedCount ?? 0), 0)
    : Number(cycleState?.totalExecutedCount ?? 0);

  return normalizeRuntimeLoopRecoveryRuntimeCycleHistoryEntry({
    runId: options.runId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    commandName: options.commandName,
    stopReason: cycleState?.stopReason ?? "unknown",
    completedRounds: cycleState?.completedRounds ?? 0,
    totalSelectedCount,
    totalExecutedCount,
    remainingCycleBudget: cycleState?.remainingCycleBudget ?? 0,
    resumeReady: cycleState?.resumeReady ?? false,
    workerIds: cycleState?.workerIds ?? [],
    statePath: options.statePath ?? null,
    receiptsPath: options.receiptsPath ?? null,
    resumeContractPath: options.resumeContractPath ?? null,
    summaryPath: options.summaryPath ?? null
  });
}

export async function appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir, entry, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir);
  const nextState = {
    ...current,
    entries: [...current.entries, normalizeRuntimeLoopRecoveryRuntimeCycleHistoryEntry(entry)]
  };
  await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir, nextState, options);
  return {
    state: nextState,
    entry: normalizeRuntimeLoopRecoveryRuntimeCycleHistoryEntry(entry)
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview(historyState, options = {}) {
  const entries = Array.isArray(historyState?.entries) ? [...historyState.entries] : [];
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : 10;
  const recentEntries = entries.slice(-limit).reverse();
  const resumableCount = recentEntries.filter((entry) => entry.resumeReady).length;
  const drainedCount = recentEntries.filter((entry) => entry.stopReason === "no_dispatchable_recovery_runtime").length;
  const previewCount = recentEntries.filter((entry) => entry.stopReason === "manual_preview" || entry.stopReason === "dry_run_preview").length;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    historyCount: entries.length,
    reviewCount: recentEntries.length,
    resumableCount,
    drainedCount,
    previewCount,
    recentEntries,
    nextAction: resumableCount > 0
      ? "Resume one of the latest recovery-runtime cycles that still has remaining budget."
      : drainedCount > 0
        ? "Recent recovery-runtime cycles are draining cleanly; inspect whether new recovery receipts should trigger another cycle."
        : previewCount > 0
          ? "Convert a dry-run or manual preview into a real recovery-runtime cycle once ready."
          : "No recovery-runtime cycle history is available yet."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReviewSummary(review) {
  const entryLines = review.recentEntries.length > 0
    ? review.recentEntries.map((entry) =>
      `- run=${entry.runId}: command=${entry.commandName} | stop=${entry.stopReason} | rounds=${entry.completedRounds} | selected=${entry.totalSelectedCount} | executed=${entry.totalExecutedCount} | resume_ready=${entry.resumeReady ? "yes" : "no"}${entry.resumeContractPath ? ` | resume_contract=${entry.resumeContractPath}` : ""}${entry.summaryPath ? ` | summary=${entry.summaryPath}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle History

- generated_at: ${review.generatedAt}
- history_count: ${review.historyCount}
- review_count: ${review.reviewCount}
- resumable_count: ${review.resumableCount}
- drained_count: ${review.drainedCount}
- preview_count: ${review.previewCount}

## Recent Recovery Runtime Cycles

${entryLines}

## Next Action

- ${review.nextAction}
`;
}
