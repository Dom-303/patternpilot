import {
  buildGithubWebhookServiceRuntimeMaintenancePlan,
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
  loadGithubWebhookServiceRuntimeMaintenanceState,
  reclaimExpiredGithubWebhookServiceClaims,
  reclaimExpiredGithubWebhookServiceRuntimeClaims,
  renderGithubWebhookServiceRuntimeMaintenanceSummary,
  summarizeGithubWebhookServiceRuntimeMaintenanceApply
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";

async function writeRuntimeMaintenanceArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(rootDir, "runs", "integration", "github-app-service-runtime-maintenance", payload.runId);
  const planPath = path.join(rootPath, "service-runtime-maintenance-plan.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(planPath, `${JSON.stringify(payload.plan, null, 2)}\n`, "utf8");
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return { rootPath, planPath, summaryPath };
}

async function loadMaintenanceState(rootDir) {
  return loadGithubWebhookServiceRuntimeMaintenanceState(rootDir, {
    loadGithubWebhookServiceQueue,
    loadGithubWebhookServiceRuntimeClaims,
    loadGithubWebhookServiceRuntimeIntegrityState,
    loadGithubWebhookServiceRuntimeLoopHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryReceipts,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
    loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory
  });
}

async function runRuntimeMaintenance(rootDir, config, options = {}, mode = "review") {
  const generatedAt = new Date().toISOString();
  const initialState = await loadMaintenanceState(rootDir);
  const initialPlan = buildGithubWebhookServiceRuntimeMaintenancePlan(initialState, {
    generatedAt,
    limit: options.limit
  });

  const queueClaimsReclaimed = mode === "apply"
    ? await reclaimExpiredGithubWebhookServiceClaims(rootDir, {
      dryRun: options.dryRun,
      now: generatedAt
    })
    : [];
  const runtimeClaimResult = mode === "apply"
    ? await reclaimExpiredGithubWebhookServiceRuntimeClaims(rootDir, {
      dryRun: options.dryRun,
      now: generatedAt
    })
    : { reclaimed: [] };

  const applySummary = mode === "apply"
    ? summarizeGithubWebhookServiceRuntimeMaintenanceApply(initialPlan, {
      appliedAt: generatedAt,
      queueClaimsReclaimed,
      runtimeClaimsReclaimed: runtimeClaimResult.reclaimed
    })
    : null;

  const finalState = mode === "apply" && !options.dryRun
    ? await loadMaintenanceState(rootDir)
    : initialState;
  const finalPlan = mode === "apply" && !options.dryRun
    ? buildGithubWebhookServiceRuntimeMaintenancePlan(finalState, {
      generatedAt: new Date().toISOString(),
      limit: options.limit
    })
    : initialPlan;
  const summary = renderGithubWebhookServiceRuntimeMaintenanceSummary(finalPlan, applySummary);

  const runId = createRunId();
  const artifacts = await writeRuntimeMaintenanceArtifacts(rootDir, { runId, plan: finalPlan, summary }, options);

  console.log(summary);
  console.log(`- queue_path: state/github-app-runner-queue${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- runtime_claims_path: state/github-app-service-runtime-claims.json${options.dryRun ? " (dry-run read-only)" : ""}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: mode === "apply"
        ? "github-app-service-runtime-maintenance-apply"
        : "github-app-service-runtime-maintenance-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    runId,
    initialState,
    finalState,
    initialPlan,
    finalPlan,
    applySummary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeMaintenanceReview(rootDir, config, options) {
  return runRuntimeMaintenance(rootDir, config, options, "review");
}

export async function runGithubAppServiceRuntimeMaintenanceApply(rootDir, config, options) {
  return runRuntimeMaintenance(rootDir, config, options, "apply");
}
