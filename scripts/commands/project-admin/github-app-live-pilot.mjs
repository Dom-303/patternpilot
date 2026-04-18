import {
  buildGithubAppLivePilotReview,
  buildGithubAppReadiness,
  buildGithubWebhookServiceRuntimeCloseoutReview,
  createRunId,
  loadGithubAppInstallationState,
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
  renderGithubAppLivePilotSummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";

async function fileExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeGithubAppLivePilotArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(rootDir, "runs", "integration", "github-app-live-pilot", payload.runId);
  const reviewPath = path.join(rootPath, "github-app-live-pilot-review.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(reviewPath, `${JSON.stringify(payload.review, null, 2)}\n`, "utf8");
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return { rootPath, reviewPath, summaryPath };
}

export async function runGithubAppLivePilotReview(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const readiness = buildGithubAppReadiness(config);
  const runtimeState = await loadGithubWebhookServiceRuntimeCloseoutState(rootDir, {
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
  const closeoutReview = buildGithubWebhookServiceRuntimeCloseoutReview(runtimeState, {
    generatedAt,
    limit: options.limit
  });
  const installationState = await loadGithubAppInstallationState(rootDir);
  const envState = {
    rootEnvLocalPresent: await fileExists(path.join(rootDir, ".env.local")),
    githubAppEnvLocalPresent: await fileExists(path.join(rootDir, "deployment", "github-app", ".env.local"))
  };
  const scaffoldState = {
    githubAppScaffoldPresent: await fileExists(path.join(rootDir, "deployment", "github-app", "README.md")),
    automationOpsPresent: await fileExists(path.join(rootDir, "automation", "README.md"))
  };

  const review = buildGithubAppLivePilotReview(config, {
    readiness,
    closeoutReview,
    installationState,
    envState,
    scaffoldState
  }, {
    generatedAt
  });
  const summary = renderGithubAppLivePilotSummary(review);
  const runId = createRunId();
  const artifacts = await writeGithubAppLivePilotArtifacts(rootDir, { runId, review, summary }, options);

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      review,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        reviewPath: path.relative(rootDir, artifacts.reviewPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      }
    }, null, 2));
  } else {
    console.log(summary);
    console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
    console.log(`- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
    console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
    console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);
  }

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-live-pilot-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, readiness, runtimeState, closeoutReview, installationState, review, summary, artifacts };
}
