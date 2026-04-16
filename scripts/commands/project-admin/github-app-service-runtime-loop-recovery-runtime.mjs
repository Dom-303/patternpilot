import {
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimePlan,
  createRunId,
  loadGithubWebhookServiceRuntimeLoopRecoveryReceipts,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeSummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeLoopRecover
} from "./github-app-service-runtime-loop.mjs";

async function writeRecoveryRuntimeArtifacts(rootDir, result, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime",
    result.runId
  );
  const planPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-plan.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-receipts.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(planPath, `${JSON.stringify(result.plan, null, 2)}\n`, "utf8");
    await fs.writeFile(receiptsPath, `${JSON.stringify(result.receipts, null, 2)}\n`, "utf8");
    await fs.writeFile(summaryPath, result.summary, "utf8");
  }

  return {
    rootPath,
    planPath,
    receiptsPath,
    summaryPath
  };
}

function maybePrint(options, lines = []) {
  if (options.print === false) {
    return;
  }
  for (const line of lines) {
    console.log(line);
  }
}

function normalizeWorkerIds(options = {}) {
  const workerIds = Array.isArray(options.workerIds)
    ? options.workerIds
    : typeof options.workerIds === "string"
      ? options.workerIds.split(",")
      : [];
  const normalized = [...new Set(workerIds
    .map((value) => String(value ?? "").trim())
    .filter(Boolean))];

  if (normalized.length > 0) {
    return normalized;
  }

  return [options.workerId ?? "local-worker"];
}

async function buildRecoveryRuntimeResult(rootDir, options = {}) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimePlan(receiptState, {
    generatedAt: new Date().toISOString(),
    workerIds: normalizeWorkerIds(options),
    workerId: options.workerId,
    limit: options.limit,
    now: options.now
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeSummary(plan);
  const runId = createRunId();
  const artifacts = await writeRecoveryRuntimeArtifacts(rootDir, {
    runId,
    plan,
    receipts: plan.selectedReceipts,
    summary
  }, options);

  return {
    runId,
    receiptState,
    plan,
    summary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeReview(rootDir, config, options) {
  const result = await buildRecoveryRuntimeResult(rootDir, options);

  maybePrint(options, [
    result.summary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_plan: ${path.relative(rootDir, result.artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeRun(rootDir, config, options) {
  const result = await buildRecoveryRuntimeResult(rootDir, options);
  const recoveryResults = [];

  for (const assignment of result.plan.selectedReceipts) {
    const recoverResult = await runGithubAppServiceRuntimeLoopRecover(rootDir, config, {
      ...options,
      contractFile: assignment.receipt.recoveryContractPath,
      workerId: assignment.runtimeWorkerId,
      workerIds: [assignment.runtimeWorkerId],
      schedulerLane: assignment.schedulerLane,
      print: false,
      refreshContext: false
    });
    recoveryResults.push({
      receiptId: assignment.receipt.receiptId,
      schedulerLane: assignment.schedulerLane,
      workerId: assignment.runtimeWorkerId,
      recoveryContractPath: assignment.receipt.recoveryContractPath,
      recoveryReady: recoverResult?.recoveryReady !== false,
      runId: recoverResult?.runId ?? null,
      stopReason: recoverResult?.loopState?.stopReason ?? null
    });
  }

  const executionSummary = [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Run",
    "",
    `- generated_at: ${result.plan.generatedAt}`,
    `- selected_count: ${result.plan.selectedCount}`,
    `- executed_count: ${recoveryResults.length}`,
    `- worker_count: ${result.plan.runtimes.filter((runtime) => runtime.receiptCount > 0).length}`,
    "",
    "## Recovery Results",
    "",
    recoveryResults.length > 0
      ? recoveryResults.map((entry) =>
        `- receipt=${entry.receiptId}: worker=${entry.workerId} | lane=${entry.schedulerLane} | ready=${entry.recoveryReady ? "yes" : "no"}${entry.runId ? ` | run_id=${entry.runId}` : ""}${entry.stopReason ? ` | stop=${entry.stopReason}` : ""}`
      ).join("\n")
      : "- none",
    "",
    "## Next Action",
    "",
    `- ${recoveryResults.length > 0
      ? "Review the emitted runtime-loop runs and continue with another recovery-runtime pass if more receipts remain open."
      : result.plan.nextAction}`
  ].join("\n");

  const executionArtifacts = await writeRecoveryRuntimeArtifacts(rootDir, {
    runId: result.runId,
    plan: result.plan,
    receipts: recoveryResults,
    summary: executionSummary
  }, options);

  maybePrint(options, [
    executionSummary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, executionArtifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_plan: ${path.relative(rootDir, executionArtifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, executionArtifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, executionArtifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, executionArtifacts.summaryPath)
    });
  }

  return {
    ...result,
    recoveryResults,
    artifacts: executionArtifacts,
    summary: executionSummary
  };
}
