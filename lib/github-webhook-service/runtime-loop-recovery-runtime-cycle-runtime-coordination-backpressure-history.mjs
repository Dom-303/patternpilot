import fs from "node:fs/promises";
import path from "node:path";

const RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_COORDINATION_BACKPRESSURE_HISTORY_PATH = path.join(
  "state",
  "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-history.json"
);

function normalizeEntry(entry = {}) {
  return {
    runId: String(entry.runId ?? "").trim() || "unknown-run",
    generatedAt: entry.generatedAt ?? new Date().toISOString(),
    commandName: entry.commandName ?? "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-apply",
    groupCount: Number(entry.groupCount ?? 0),
    coordinationGroupBudget: Number(entry.coordinationGroupBudget ?? 0),
    backpressureSeconds: Number(entry.backpressureSeconds ?? 0),
    escalationSeconds: Number(entry.escalationSeconds ?? 0),
    receiptCount: Number(entry.receiptCount ?? 0),
    autoReleaseCount: Number(entry.autoReleaseCount ?? 0),
    refreshCount: Number(entry.refreshCount ?? 0),
    escalatedCount: Number(entry.escalatedCount ?? 0),
    statePath: entry.statePath ?? null,
    reviewPath: entry.reviewPath ?? null,
    summaryPath: entry.summaryPath ?? null
  };
}

export function getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryPath(rootDir) {
  return path.join(rootDir, RUNTIME_LOOP_RECOVERY_RUNTIME_CYCLE_RUNTIME_COORDINATION_BACKPRESSURE_HISTORY_PATH);
}

export async function loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir) {
  const historyPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryPath(rootDir);
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

export async function writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir, state, options = {}) {
  const historyPath = getGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryPath(rootDir);
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

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryEntry(review = {}, receipts = [], options = {}) {
  const normalizedReceipts = Array.isArray(receipts) ? receipts : [];
  const autoReleaseCount = normalizedReceipts.filter((entry) => entry.followupAction === "auto_release").length;
  const refreshCount = normalizedReceipts.filter((entry) => entry.followupAction === "refresh_backpressure").length;
  const escalatedCount = normalizedReceipts.filter((entry) => entry.followupAction === "escalate").length;

  return normalizeEntry({
    runId: options.runId,
    generatedAt: options.generatedAt ?? review.generatedAt ?? new Date().toISOString(),
    commandName: options.commandName,
    groupCount: review.groupCount ?? 0,
    coordinationGroupBudget: review.coordinationGroupBudget ?? 0,
    backpressureSeconds: review.backpressureSeconds ?? 0,
    escalationSeconds: review.escalationSeconds ?? 0,
    receiptCount: normalizedReceipts.length,
    autoReleaseCount,
    refreshCount,
    escalatedCount,
    statePath: options.statePath ?? null,
    reviewPath: options.reviewPath ?? null,
    summaryPath: options.summaryPath ?? null
  });
}

export async function appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir, entry, options = {}) {
  const current = options.state ?? await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir);
  const nextState = {
    ...current,
    entries: [...current.entries, normalizeEntry(entry)]
  };
  await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir, nextState, options);
  return {
    state: nextState,
    entry: normalizeEntry(entry)
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview(historyState, options = {}) {
  const entries = Array.isArray(historyState?.entries) ? [...historyState.entries] : [];
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : 10;
  const recentEntries = entries.slice(-limit).reverse();
  const applyCount = recentEntries.reduce((sum, entry) => sum + Number(entry.receiptCount ?? 0), 0);
  const autoReleaseCount = recentEntries.reduce((sum, entry) => sum + Number(entry.autoReleaseCount ?? 0), 0);
  const refreshCount = recentEntries.reduce((sum, entry) => sum + Number(entry.refreshCount ?? 0), 0);
  const escalatedCount = recentEntries.reduce((sum, entry) => sum + Number(entry.escalatedCount ?? 0), 0);

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    historyCount: entries.length,
    reviewCount: recentEntries.length,
    applyCount,
    autoReleaseCount,
    refreshCount,
    escalatedCount,
    recentEntries,
    nextAction: recentEntries.length > 0
      ? "Inspect the latest coordination-group backpressure apply or follow-up runs before scheduling another group backpressure pass."
      : "No coordination-group backpressure history is available yet."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReviewSummary(review) {
  const entryLines = review.recentEntries.length > 0
    ? review.recentEntries.map((entry) =>
      `- run=${entry.runId}: command=${entry.commandName} | groups=${entry.groupCount} | receipts=${entry.receiptCount} | auto_release=${entry.autoReleaseCount} | refresh=${entry.refreshCount} | escalated=${entry.escalatedCount}${entry.summaryPath ? ` | summary=${entry.summaryPath}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure History

- generated_at: ${review.generatedAt}
- history_count: ${review.historyCount}
- review_count: ${review.reviewCount}
- apply_count: ${review.applyCount}
- auto_release_count: ${review.autoReleaseCount}
- refresh_count: ${review.refreshCount}
- escalated_count: ${review.escalatedCount}

## Recent Coordination Group Backpressure Runs

${entryLines}

## Next Action

- ${review.nextAction}
`;
}
