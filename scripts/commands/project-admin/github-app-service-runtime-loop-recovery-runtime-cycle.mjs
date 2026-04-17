import {
  appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
  appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleResumeContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryEntry,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview,
  createRunId,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
  markGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptResumed,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleSummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeLoopRecoveryRuntimeReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeRun
} from "./github-app-service-runtime-loop-recovery-runtime.mjs";

function resolveRuntimeLoopRecoveryRuntimeCycleLimit(options = {}, fallback = 2) {
  return Number.isFinite(options.runtimeCycleLimit) && options.runtimeCycleLimit > 0
    ? Number(options.runtimeCycleLimit)
    : fallback;
}

function maybePrint(options, lines = []) {
  if (options.print === false) {
    return;
  }
  for (const line of lines) {
    console.log(line);
  }
}

async function recordRecoveryRuntimeCycleHistory(rootDir, result, options = {}) {
  return await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryEntry(
    result.cycleState,
    result.receipts,
    {
      runId: result.runId,
      generatedAt: result.cycleState.generatedAt,
      commandName: options.commandName ?? "github-app-service-runtime-loop-recovery-runtime-cycle-run",
      statePath: path.relative(rootDir, result.artifacts.cycleStatePath),
      receiptsPath: path.relative(rootDir, result.artifacts.receiptsPath),
      resumeContractPath: result.resumeContract ? path.relative(rootDir, result.artifacts.resumeContractPath) : null,
      summaryPath: path.relative(rootDir, result.artifacts.summaryPath)
    }
  ), {
    dryRun: options.dryRun
  });
}

async function recordRecoveryRuntimeCycleReceipt(rootDir, result, options = {}) {
  return await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(
    result.cycleState,
    {
      receiptId: `${result.runId}::${options.sourceCommand ?? "github-app-service-runtime-loop-recovery-runtime-cycle-run"}`,
      runId: result.runId,
      generatedAt: result.cycleState.generatedAt,
      sourceCommand: options.sourceCommand ?? "github-app-service-runtime-loop-recovery-runtime-cycle-run",
      statePath: path.relative(rootDir, result.artifacts.cycleStatePath),
      receiptsPath: path.relative(rootDir, result.artifacts.receiptsPath),
      resumeContractPath: result.resumeContract ? path.relative(rootDir, result.artifacts.resumeContractPath) : null,
      summaryPath: path.relative(rootDir, result.artifacts.summaryPath),
      notes: options.notes ?? null
    }
  ), {
    dryRun: options.dryRun
  });
}

async function writeRecoveryRuntimeCycleArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle",
    payload.runId
  );
  const cycleStatePath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-state.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-receipts.json");
  const resumeContractPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-resume-contract.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(cycleStatePath, `${JSON.stringify(payload.cycleState, null, 2)}\n`, "utf8");
    await fs.writeFile(receiptsPath, `${JSON.stringify(payload.receipts, null, 2)}\n`, "utf8");
    if (payload.resumeContract) {
      await fs.writeFile(resumeContractPath, `${JSON.stringify(payload.resumeContract, null, 2)}\n`, "utf8");
    }
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return {
    rootPath,
    cycleStatePath,
    receiptsPath,
    resumeContractPath,
    summaryPath
  };
}

async function continueRecoveryRuntimeCycle(rootDir, config, options = {}, cycleInput = {}) {
  const runId = createRunId();
  const previousState = cycleInput.cycleState ?? null;
  const previousRounds = Array.isArray(previousState?.rounds) ? previousState.rounds : [];
  const previousReceipts = Array.isArray(cycleInput.receipts) ? cycleInput.receipts : [];
  const startRoundIndex = previousRounds.length + 1;
  const cycleLimit = Number.isFinite(cycleInput.totalCycleLimit) && cycleInput.totalCycleLimit > 0
    ? Number(cycleInput.totalCycleLimit)
    : resolveRuntimeLoopRecoveryRuntimeCycleLimit(options, previousState?.cycleLimit ?? 2);
  const rounds = [...previousRounds];
  const receipts = [...previousReceipts];
  let stopReason = previousState?.stopReason ?? "cycle_limit_reached";

  for (let roundIndex = startRoundIndex; roundIndex <= cycleLimit; roundIndex += 1) {
    const runtimeResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeRun(rootDir, config, {
      ...options,
      print: false,
      refreshContext: false
    });
    const round = {
      roundIndex,
      workerCount: runtimeResult.plan.runtimes.filter((runtime) => runtime.receiptCount > 0).length,
      selectedCount: runtimeResult.plan.selectedCount,
      executedCount: runtimeResult.recoveryResults.length,
      blockedCount: runtimeResult.plan.blockedCount,
      laneCount: runtimeResult.plan.laneCount,
      summaryPath: path.relative(rootDir, runtimeResult.artifacts.summaryPath)
    };

    if (!options.apply) {
      round.stopReason = "manual_preview";
      rounds.push(round);
      stopReason = "manual_preview";
      break;
    }

    if (options.dryRun) {
      round.stopReason = "dry_run_preview";
      rounds.push(round);
      receipts.push({
        roundIndex,
        outcome: "cycle_dry_run",
        workerCount: round.workerCount,
        selectedCount: round.selectedCount,
        executedCount: round.executedCount,
        summaryPath: round.summaryPath
      });
      stopReason = "dry_run_preview";
      break;
    }

    if (runtimeResult.plan.selectedCount === 0) {
      round.stopReason = "no_dispatchable_recovery_runtime";
      rounds.push(round);
      receipts.push({
        roundIndex,
        outcome: "cycle_drained",
        workerCount: round.workerCount,
        selectedCount: round.selectedCount,
        executedCount: round.executedCount,
        summaryPath: round.summaryPath
      });
      stopReason = "no_dispatchable_recovery_runtime";
      break;
    }

    round.stopReason = roundIndex === cycleLimit ? "cycle_limit_reached" : "recovery_runtime_round_processed";
    rounds.push(round);
    receipts.push({
      roundIndex,
      outcome: roundIndex === cycleLimit ? "cycle_limit_reached" : "cycle_round_processed",
      workerCount: round.workerCount,
      selectedCount: round.selectedCount,
      executedCount: round.executedCount,
      summaryPath: round.summaryPath
    });

    if (roundIndex === cycleLimit) {
      stopReason = "cycle_limit_reached";
      break;
    }
  }

  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState(rounds, {
    generatedAt: new Date().toISOString(),
    workerIds: options.workerIds,
    cycleLimit,
    stopReason
  });
  const relativeCycleStatePath = path.join(
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle",
    runId,
    "service-runtime-loop-recovery-runtime-cycle-state.json"
  );
  const resumeContract = cycleState.resumeReady
    ? buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleResumeContract(cycleState, {
        generatedAt: new Date().toISOString(),
        cycleStatePath: relativeCycleStatePath
      })
    : null;
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleSummary(cycleState, receipts);
  const artifacts = await writeRecoveryRuntimeCycleArtifacts(rootDir, {
    runId,
    cycleState,
    receipts,
    resumeContract,
    summary
  }, options);

  return {
    runId,
    cycleState,
    receipts,
    resumeContract,
    artifacts,
    summary
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleReview(rootDir, config, options) {
  const runId = createRunId();
  const runtimeResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeReview(rootDir, config, {
    ...options,
    print: false,
    refreshContext: false
  });
  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: runtimeResult.plan.runtimes.filter((runtime) => runtime.receiptCount > 0).length,
      selectedCount: runtimeResult.plan.selectedCount,
      executedCount: 0,
      blockedCount: runtimeResult.plan.blockedCount,
      laneCount: runtimeResult.plan.laneCount,
      stopReason: "manual_preview",
      summaryPath: path.relative(rootDir, runtimeResult.artifacts.summaryPath)
    }
  ], {
    generatedAt: new Date().toISOString(),
    workerIds: options.workerIds,
    cycleLimit: resolveRuntimeLoopRecoveryRuntimeCycleLimit(options),
    stopReason: "manual_preview"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleSummary(cycleState, []);
  const artifacts = await writeRecoveryRuntimeCycleArtifacts(rootDir, {
    runId,
    cycleState,
    receipts: [],
    resumeContract: null,
    summary
  }, options);

  maybePrint(options, [
    summary,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, artifacts.cycleStatePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, cycleState, receipts: [], resumeContract: null, artifacts };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRun(rootDir, config, options) {
  const result = await continueRecoveryRuntimeCycle(rootDir, config, options, {
    totalCycleLimit: resolveRuntimeLoopRecoveryRuntimeCycleLimit(options)
  });

  maybePrint(options, [
    result.summary,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, result.artifacts.cycleStatePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, result.artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    ...(result.resumeContract ? [`- artifact_resume_contract: ${path.relative(rootDir, result.artifacts.resumeContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`] : []),
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  await recordRecoveryRuntimeCycleHistory(rootDir, result, {
    commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-run",
    dryRun: options.dryRun
  });
  await recordRecoveryRuntimeCycleReceipt(rootDir, result, {
    sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-run",
    dryRun: options.dryRun
  });

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleResume(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-service-runtime-loop-recovery-runtime-cycle-resume requires --contract-file <runtime-loop-recovery-runtime-cycle-resume-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  if (contract.contractKind !== "runtime_loop_recovery_runtime_cycle_resume_contract") {
    throw new Error("The provided contract file is not a runtime-loop recovery runtime cycle resume contract.");
  }
  if (contract.contractStatus !== "dispatch_ready_runtime_loop_recovery_runtime_cycle_resume_contract") {
    throw new Error(`Runtime-loop recovery runtime cycle resume contract is not dispatch-ready (status='${contract.contractStatus ?? "unknown"}').`);
  }

  const cycleState = contract.cycleState ?? null;
  const remainingCycleBudget = Number.isFinite(contract.remainingCycleBudget)
    ? Number(contract.remainingCycleBudget)
    : resolveRuntimeLoopRecoveryRuntimeCycleLimit(options, 1);
  const totalCycleLimit = (Number(cycleState?.completedRounds ?? 0) || 0) + remainingCycleBudget;
  const mergedOptions = {
    ...options,
    workerIds: Array.isArray(options.workerIds) && options.workerIds.length > 0
      ? options.workerIds
      : (Array.isArray(contract.workerIds) ? contract.workerIds : [])
  };
  const result = await continueRecoveryRuntimeCycle(rootDir, config, mergedOptions, {
    cycleState,
    totalCycleLimit
  });

  maybePrint(options, [
    result.summary,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, result.artifacts.cycleStatePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, result.artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    ...(result.resumeContract ? [`- artifact_resume_contract: ${path.relative(rootDir, result.artifacts.resumeContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`] : []),
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-resume",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  const isRealResume = options.apply && !options.dryRun;
  if (isRealResume) {
    await markGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptResumed(rootDir, {
      resumeContractPath: contractPath,
      resumedAt: new Date().toISOString(),
      resumedByRunId: result.runId,
      notes: "Resumed via recovery-runtime cycle resume contract."
    });
  }
  await recordRecoveryRuntimeCycleHistory(rootDir, result, {
    commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-resume",
    dryRun: options.dryRun
  });
  await recordRecoveryRuntimeCycleReceipt(rootDir, result, {
    sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-resume",
    dryRun: options.dryRun
  });

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview(rootDir, config, options) {
  const historyState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview(historyState, {
    generatedAt: new Date().toISOString(),
    limit: options.limit
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReviewSummary(review);

  maybePrint(options, [
    summary,
    `- history_path: ${path.relative(rootDir, historyState.historyPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-history-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, historyState.historyPath)
    });
  }

  return { historyState, review };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview(rootDir, config, options) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview(receiptState, {
    generatedAt: new Date().toISOString(),
    limit: options.limit
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReviewSummary(review);

  maybePrint(options, [
    summary,
    `- receipts_path: ${path.relative(rootDir, receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-receipts-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, receiptState.receiptsPath)
    });
  }

  return { receiptState, review };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleAutoResume(rootDir, config, options) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview(receiptState, {
    generatedAt: new Date().toISOString(),
    limit: options.limit
  });
  const candidate = review.bestReceipt;

  if (!candidate) {
    const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReviewSummary(review);
    maybePrint(options, [
      summary,
      `- receipts_path: ${path.relative(rootDir, receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
      `- auto_resume: no_open_receipt`
    ]);
    return {
      receiptState,
      review,
      autoResumed: false
    };
  }

  maybePrint(options, [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Auto Resume",
    "",
    `- selected_receipt: ${candidate.receiptId}`,
    `- resume_contract: ${candidate.resumeContractPath ?? "-"}`,
    `- completed_rounds: ${candidate.completedRounds}`,
    `- selected_count: ${candidate.totalSelectedCount}`,
    `- executed_count: ${candidate.totalExecutedCount}`,
    `- remaining_cycle_budget: ${candidate.remainingCycleBudget}`
  ]);

  if (!candidate.resumeContractPath) {
    return {
      receiptState,
      review,
      autoResumed: false,
      candidate
    };
  }

  const result = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleResume(rootDir, config, {
    ...options,
    contractFile: candidate.resumeContractPath,
    print: options.print,
    refreshContext: false
  });

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-auto-resume",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: candidate.resumeContractPath
    });
  }

  return {
    receiptState,
    review,
    candidate,
    result,
    autoResumed: true
  };
}
