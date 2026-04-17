import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_COORDINATION_BACKPRESSURE_LOOP_HISTORY_PATH = path.join(
  "state",
  "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-history.json"
);

function normalizeEntry(entry = {}) {
  return {
    runId: String(entry.runId ?? "").trim() || "unknown-run",
    generatedAt: entry.generatedAt ?? new Date().toISOString(),
    commandName: entry.commandName ?? "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-run",
    stopReason: entry.stopReason ?? "unknown",
    recoveryStatus: entry.recoveryStatus ?? "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_manual_review",
    completedLoops: Number(entry.completedLoops ?? 0),
    totalSessions: Number(entry.totalSessions ?? 0),
    totalPasses: Number(entry.totalPasses ?? 0),
    appliedCount: Number(entry.appliedCount ?? 0),
    remainingLoopBudget: Number(entry.remainingLoopBudget ?? 0),
    resumeReady: Boolean(entry.resumeReady),
    statePath: entry.statePath ?? null,
    receiptsPath: entry.receiptsPath ?? null,
    resumeContractPath: entry.resumeContractPath ?? null,
    recoveryContractPath: entry.recoveryContractPath ?? null,
    summaryPath: entry.summaryPath ?? null
  };
}

export function getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryPath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_COORDINATION_BACKPRESSURE_LOOP_HISTORY_PATH);
}

export async function loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir) {
  const historyPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryPath(rootDir);
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      historyPath,
      entries: Array.isArray(parsed.entries)
        ? parsed.entries.map((entry) => normalizeEntry(entry))
        : []
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

export async function writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir, state, options = {}) {
  const historyPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryPath(rootDir);
  if (options.dryRun) {
    return historyPath;
  }
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(historyPath, `${JSON.stringify({
    schemaVersion: 1,
    entries: Array.isArray(state.entries)
      ? state.entries.map((entry) => normalizeEntry(entry))
      : []
  }, null, 2)}\n`, "utf8");
  return historyPath;
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryEntry(loopState, receipts = [], options = {}) {
  const appliedCount = Array.isArray(receipts)
    ? receipts.reduce((sum, receipt) => sum + Number(receipt.totalAppliedCount ?? 0), 0)
    : 0;
  return normalizeEntry({
    runId: options.runId,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    commandName: options.commandName,
    stopReason: loopState?.stopReason ?? "unknown",
    completedLoops: loopState?.completedLoops ?? 0,
    totalSessions: loopState?.totalSessions ?? 0,
    totalPasses: loopState?.totalPasses ?? 0,
    appliedCount,
    remainingLoopBudget: loopState?.remainingLoopBudget ?? 0,
    resumeReady: loopState?.resumeReady ?? false,
    recoveryStatus: options.recoveryStatus,
    statePath: options.statePath ?? null,
    receiptsPath: options.receiptsPath ?? null,
    resumeContractPath: options.resumeContractPath ?? null,
    recoveryContractPath: options.recoveryContractPath ?? null,
    summaryPath: options.summaryPath ?? null
  });
}

export async function appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir, entry, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir);
  const nextState = {
    ...current,
    entries: [...current.entries, normalizeEntry(entry)]
  };
  await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir, nextState, options);
  return {
    state: nextState,
    entry: normalizeEntry(entry)
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview(historyState, options = {}) {
  const entries = Array.isArray(historyState?.entries) ? [...historyState.entries] : [];
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : 10;
  const recentEntries = entries.slice(-limit).reverse();
  const resumableCount = recentEntries.filter((entry) => entry.resumeReady).length;
  const drainedCount = recentEntries.filter((entry) => entry.stopReason === "no_due_group_backpressure_followup").length;
  const previewCount = recentEntries.filter((entry) => entry.stopReason === "dry_run_preview" || entry.stopReason === "manual_preview").length;
  const recoveryReadyCount = recentEntries.filter((entry) => entry.recoveryStatus === "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract").length;

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
      ? "Recover one of the latest coordination-group backpressure loops via its emitted recovery contract."
      : resumableCount > 0
        ? "Resume one of the latest coordination-group backpressure loops that still has remaining loop budget."
        : drainedCount > 0
          ? "Recent coordination-group backpressure loops are draining cleanly; inspect whether new backpressure work should trigger another loop."
          : previewCount > 0
            ? "Convert a dry-run or manual preview into a real coordination-group backpressure loop once ready."
            : "No coordination-group backpressure loop history is available yet."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReviewSummary(review) {
  const entryLines = review.recentEntries.length > 0
    ? review.recentEntries.map((entry) =>
      `- run=${entry.runId}: command=${entry.commandName} | stop=${entry.stopReason} | recovery=${entry.recoveryStatus} | loops=${entry.completedLoops} | sessions=${entry.totalSessions} | passes=${entry.totalPasses} | applied=${entry.appliedCount} | resume_ready=${entry.resumeReady ? "yes" : "no"}${entry.recoveryContractPath ? ` | recovery_contract=${entry.recoveryContractPath}` : ""}${entry.summaryPath ? ` | summary=${entry.summaryPath}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Loop History

- generated_at: ${review.generatedAt}
- history_count: ${review.historyCount}
- review_count: ${review.reviewCount}
- resumable_count: ${review.resumableCount}
- drained_count: ${review.drainedCount}
- preview_count: ${review.previewCount}
- recovery_ready_count: ${review.recoveryReadyCount}

## Recent Coordination Group Backpressure Loops

${entryLines}

## Next Action

- ${review.nextAction}
`;
}
