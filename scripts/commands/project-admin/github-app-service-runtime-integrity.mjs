import {
  buildGithubWebhookServiceRuntimeIntegrityReview,
  createRunId,
  loadGithubWebhookServiceQueue,
  loadGithubWebhookServiceRuntimeClaims,
  loadGithubWebhookServiceRuntimeIntegrityState,
  loadGithubWebhookServiceRuntimeLoopHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory,
  renderGithubWebhookServiceRuntimeIntegritySummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";

async function writeRuntimeIntegrityArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(rootDir, "runs", "integration", "github-app-service-runtime-integrity", payload.runId);
  const reviewPath = path.join(rootPath, "service-runtime-integrity-review.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(reviewPath, `${JSON.stringify(payload.review, null, 2)}\n`, "utf8");
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return { rootPath, reviewPath, summaryPath };
}

export async function runGithubAppServiceRuntimeIntegrityReview(rootDir, config, options) {
  const state = await loadGithubWebhookServiceRuntimeIntegrityState(rootDir, {
    loadGithubWebhookServiceQueue,
    loadGithubWebhookServiceRuntimeClaims,
    loadGithubWebhookServiceRuntimeLoopHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryReceipts,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory
  });
  const review = buildGithubWebhookServiceRuntimeIntegrityReview(state, {
    generatedAt: new Date().toISOString(),
    limit: options.limit
  });
  const summary = renderGithubWebhookServiceRuntimeIntegritySummary(review);
  const runId = createRunId();
  const artifacts = await writeRuntimeIntegrityArtifacts(rootDir, { runId, review, summary }, options);

  console.log(summary);
  console.log(`- queue_path: ${path.relative(rootDir, state.queueState.paths?.rootPath ?? path.join(rootDir, "state", "github-app-runner-queue"))}${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- runtime_claims_path: ${path.relative(rootDir, state.runtimeClaimsState.claimsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- runtime_loop_history_path: ${path.relative(rootDir, state.runtimeLoopHistoryState.historyPath)}${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- runtime_loop_recovery_receipts_path: ${path.relative(rootDir, state.runtimeLoopRecoveryReceiptsState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- recovery_cycle_history_path: ${path.relative(rootDir, state.runtimeLoopRecoveryRuntimeCycleHistoryState.historyPath)}${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- recovery_cycle_receipts_path: ${path.relative(rootDir, state.runtimeLoopRecoveryRuntimeCycleReceiptsState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- coordination_backpressure_history_path: ${path.relative(rootDir, state.coordinationBackpressureHistoryState.historyPath)}${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- coordination_backpressure_loop_history_path: ${path.relative(rootDir, state.coordinationBackpressureLoopHistoryState.historyPath)}${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-integrity-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, state, review, summary, artifacts };
}
