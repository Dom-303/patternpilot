import {
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan,
  createRunId,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeSummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleResume
} from "./github-app-service-runtime-loop-recovery-runtime-cycle.mjs";

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

async function writeCycleRuntimeArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime",
    payload.runId
  );
  const planPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-plan.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-receipts.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(planPath, `${JSON.stringify(payload.plan, null, 2)}\n`, "utf8");
    await fs.writeFile(receiptsPath, `${JSON.stringify(payload.receipts, null, 2)}\n`, "utf8");
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return {
    rootPath,
    planPath,
    receiptsPath,
    summaryPath
  };
}

async function buildCycleRuntimeResult(rootDir, options = {}) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const governanceState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir);
  const coordinationState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan(receiptState, {
    generatedAt: new Date().toISOString(),
    workerIds: normalizeWorkerIds(options),
    workerId: options.workerId,
    limit: options.limit,
    governanceState,
    coordinationState
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeSummary(plan);
  const runId = createRunId();
  const artifacts = await writeCycleRuntimeArtifacts(rootDir, {
    runId,
    plan,
    receipts: plan.selectedReceipts,
    summary
  }, options);

  return {
    runId,
    receiptState,
    governanceState,
    coordinationState,
    plan,
    summary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeReview(rootDir, config, options) {
  const result = await buildCycleRuntimeResult(rootDir, options);

  maybePrint(options, [
    result.summary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- governance_state_path: ${path.relative(rootDir, result.governanceState.governancePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- coordination_state_path: ${path.relative(rootDir, result.coordinationState.coordinationPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_plan: ${path.relative(rootDir, result.artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeRun(rootDir, config, options) {
  const result = await buildCycleRuntimeResult(rootDir, options);
  const resumeResults = [];

  for (const assignment of result.plan.selectedReceipts) {
    const resumeResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleResume(rootDir, config, {
      ...options,
      contractFile: assignment.receipt.resumeContractPath,
      workerId: assignment.runtimeWorkerId,
      workerIds: [assignment.runtimeWorkerId],
      print: false,
      refreshContext: false
    });
    resumeResults.push({
      receiptId: assignment.receipt.receiptId,
      workerFamilyKey: assignment.workerFamilyKey,
      workerId: assignment.runtimeWorkerId,
      resumeContractPath: assignment.receipt.resumeContractPath,
      runId: resumeResult?.runId ?? null,
      stopReason: resumeResult?.cycleState?.stopReason ?? null,
      completedRounds: resumeResult?.cycleState?.completedRounds ?? null
    });
  }

  const executionSummary = [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Run",
    "",
    `- generated_at: ${result.plan.generatedAt}`,
    `- selected_count: ${result.plan.selectedCount}`,
    `- executed_count: ${resumeResults.length}`,
    `- worker_count: ${result.plan.runtimes.filter((runtime) => runtime.receiptCount > 0).length}`,
    "",
    "## Resume Results",
    "",
    resumeResults.length > 0
      ? resumeResults.map((entry) =>
        `- receipt=${entry.receiptId}: worker=${entry.workerId} | family=${entry.workerFamilyKey}${entry.runId ? ` | run_id=${entry.runId}` : ""}${entry.stopReason ? ` | stop=${entry.stopReason}` : ""}${entry.completedRounds != null ? ` | rounds=${entry.completedRounds}` : ""}`
      ).join("\n")
      : "- none",
    "",
    "## Next Action",
    "",
    `- ${resumeResults.length > 0
      ? "Review the emitted recovery-runtime cycles and run another cycle-runtime pass if more resumable families remain."
      : result.plan.nextAction}`
  ].join("\n");

  const executionArtifacts = await writeCycleRuntimeArtifacts(rootDir, {
    runId: result.runId,
    plan: result.plan,
    receipts: resumeResults,
    summary: executionSummary
  }, options);

  maybePrint(options, [
    executionSummary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- governance_state_path: ${path.relative(rootDir, result.governanceState.governancePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- coordination_state_path: ${path.relative(rootDir, result.coordinationState.coordinationPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, executionArtifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_plan: ${path.relative(rootDir, executionArtifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, executionArtifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, executionArtifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, executionArtifacts.summaryPath)
    });
  }

  return {
    ...result,
    resumeResults,
    artifacts: executionArtifacts,
    summary: executionSummary
  };
}
