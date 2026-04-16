import {
  buildGithubWebhookServiceRuntimeCyclePlan,
  createRunId,
  renderGithubWebhookServiceRuntimeCycleSummary,
  writeGithubWebhookServiceRuntimeCycleArtifacts
} from "../../../lib/index.mjs";
import {
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeReview,
  runGithubAppServiceRuntimeRun
} from "./github-app-service-runtime.mjs";

function maybePrint(options, lines = []) {
  if (options.print === false) {
    return;
  }
  for (const line of lines) {
    console.log(line);
  }
}

export async function runGithubAppServiceRuntimeCycleReview(rootDir, config, options) {
  const runId = createRunId();
  const runtimeResult = await runGithubAppServiceRuntimeReview(rootDir, config, {
    ...options,
    print: false,
    refreshContext: false
  });
  const plan = buildGithubWebhookServiceRuntimeCyclePlan([
    {
      cycleIndex: 1,
      runtimeCount: runtimeResult.plan.runtimeCount,
      dispatchableRuntimeCount: runtimeResult.plan.dispatchableRuntimeCount,
      blockedLaneCount: runtimeResult.plan.blockedLaneCount,
      queueCount: runtimeResult.plan.queueCount,
      stopReason: "manual_preview",
      summaryPath: path.relative(rootDir, runtimeResult.artifacts.summaryPath)
    }
  ], {
    generatedAt: new Date().toISOString(),
    workerIds: options.workerIds,
    cycleLimit: options.runtimeCycleLimit,
    stopReason: "manual_preview"
  });
  const summary = renderGithubWebhookServiceRuntimeCycleSummary(plan, []);
  const artifacts = await writeGithubWebhookServiceRuntimeCycleArtifacts(rootDir, {
    runId,
    plan,
    receipts: [],
    summary,
    dryRun: options.dryRun
  });

  maybePrint(options, [
    summary,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-cycle-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, plan, receipts: [], artifacts };
}

export async function runGithubAppServiceRuntimeCycleRun(rootDir, config, options) {
  const runId = createRunId();
  const cycles = [];
  const receipts = [];
  const cycleLimit = Number.isFinite(options.runtimeCycleLimit) && options.runtimeCycleLimit > 0
    ? Number(options.runtimeCycleLimit)
    : 3;
  let stopReason = "cycle_limit_reached";

  for (let cycleIndex = 1; cycleIndex <= cycleLimit; cycleIndex += 1) {
    const runtimeResult = await runGithubAppServiceRuntimeRun(rootDir, config, {
      ...options,
      print: false,
      refreshContext: false
    });
    const cycle = {
      cycleIndex,
      runtimeCount: runtimeResult.plan.runtimeCount,
      dispatchableRuntimeCount: runtimeResult.plan.dispatchableRuntimeCount,
      blockedLaneCount: runtimeResult.plan.blockedLaneCount,
      queueCount: runtimeResult.plan.queueCount,
      summaryPath: path.relative(rootDir, runtimeResult.artifacts.summaryPath)
    };

    if (!options.apply) {
      cycle.stopReason = "manual_preview";
      cycles.push(cycle);
      stopReason = "manual_preview";
      break;
    }

    if (options.dryRun) {
      cycle.stopReason = "dry_run_preview";
      cycles.push(cycle);
      receipts.push({
        cycleIndex,
        outcome: "cycle_dry_run",
        runtimeCount: runtimeResult.plan.runtimeCount,
        selectedCount: runtimeResult.receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
        summaryPath: path.relative(rootDir, runtimeResult.artifacts.summaryPath)
      });
      stopReason = "dry_run_preview";
      break;
    }

    cycles.push(cycle);
    receipts.push({
      cycleIndex,
      outcome: "cycle_processed",
      runtimeCount: runtimeResult.plan.runtimeCount,
      selectedCount: runtimeResult.receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
      summaryPath: path.relative(rootDir, runtimeResult.artifacts.summaryPath)
    });

    if (runtimeResult.plan.dispatchableRuntimeCount === 0) {
      cycles[cycles.length - 1].stopReason = "no_dispatchable_runtime";
      stopReason = "no_dispatchable_runtime";
      break;
    }

    if (cycleIndex === cycleLimit) {
      cycles[cycles.length - 1].stopReason = "cycle_limit_reached";
    }
  }

  const plan = buildGithubWebhookServiceRuntimeCyclePlan(cycles, {
    generatedAt: new Date().toISOString(),
    workerIds: options.workerIds,
    cycleLimit,
    stopReason
  });
  const summary = renderGithubWebhookServiceRuntimeCycleSummary(plan, receipts);
  const artifacts = await writeGithubWebhookServiceRuntimeCycleArtifacts(rootDir, {
    runId,
    plan,
    receipts,
    summary,
    dryRun: options.dryRun
  });

  maybePrint(options, [
    summary,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-cycle-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, plan, receipts, artifacts };
}
