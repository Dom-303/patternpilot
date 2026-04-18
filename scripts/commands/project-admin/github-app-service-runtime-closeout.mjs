import {
  buildGithubWebhookServiceRuntimeCloseoutReview,
  createRunId,
  loadGithubWebhookServiceQueue,
  loadGithubWebhookServiceRuntimeClaims,
  loadGithubWebhookServiceRuntimeCloseoutState,
  loadGithubWebhookServiceRuntimeControlState,
  loadGithubWebhookServiceRuntimeIntegrityState,
  loadGithubWebhookServiceRuntimeLoopHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory,
  renderGithubWebhookServiceRuntimeCloseoutSummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";

async function writeRuntimeCloseoutArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(rootDir, "runs", "integration", "github-app-service-runtime-closeout", payload.runId);
  const reviewPath = path.join(rootPath, "service-runtime-closeout-review.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(reviewPath, `${JSON.stringify(payload.review, null, 2)}\n`, "utf8");
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return { rootPath, reviewPath, summaryPath };
}

export async function runGithubAppServiceRuntimeCloseoutReview(rootDir, config, options) {
  const state = await loadGithubWebhookServiceRuntimeCloseoutState(rootDir, {
    loadGithubWebhookServiceQueue,
    loadGithubWebhookServiceRuntimeClaims,
    loadGithubWebhookServiceRuntimeCloseoutState,
    loadGithubWebhookServiceRuntimeControlState,
    loadGithubWebhookServiceRuntimeIntegrityState,
    loadGithubWebhookServiceRuntimeLoopHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryReceipts,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory
  });
  const review = buildGithubWebhookServiceRuntimeCloseoutReview(state, {
    generatedAt: new Date().toISOString(),
    limit: options.limit
  });
  const summary = renderGithubWebhookServiceRuntimeCloseoutSummary(review);
  const runId = createRunId();
  const artifacts = await writeRuntimeCloseoutArtifacts(rootDir, { runId, review, summary }, options);

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/foundation/V1_STATUS.md`);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-closeout-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, state, review, summary, artifacts };
}
