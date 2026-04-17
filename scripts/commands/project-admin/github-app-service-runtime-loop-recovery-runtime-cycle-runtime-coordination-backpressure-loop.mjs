import {
  appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResumeContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryEntry,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryAssessment,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview,
  createRunId,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopSummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionRun
} from "./github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session.mjs";

function resolveBackpressureLoopLimit(options = {}, fallback = 2) {
  return Number.isFinite(options.runtimeLoopLimit) && options.runtimeLoopLimit > 0
    ? Number(options.runtimeLoopLimit)
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

async function writeBackpressureLoopArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop",
    payload.runId
  );
  const statePath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-state.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-receipts.json");
  const resumeContractPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-resume-contract.json");
  const recoveryContractPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-recovery-contract.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(statePath, `${JSON.stringify(payload.loopState, null, 2)}\n`, "utf8");
    await fs.writeFile(receiptsPath, `${JSON.stringify(payload.receipts, null, 2)}\n`, "utf8");
    if (payload.resumeContract) {
      await fs.writeFile(resumeContractPath, `${JSON.stringify(payload.resumeContract, null, 2)}\n`, "utf8");
    }
    if (payload.recoveryContract) {
      await fs.writeFile(recoveryContractPath, `${JSON.stringify(payload.recoveryContract, null, 2)}\n`, "utf8");
    }
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return {
    rootPath,
    statePath,
    receiptsPath,
    resumeContractPath,
    recoveryContractPath,
    summaryPath
  };
}

async function recordBackpressureLoopHistory(rootDir, result, options = {}) {
  return await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(
    rootDir,
    buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryEntry(
      result.loopState,
      result.receipts,
      {
        runId: result.runId,
        generatedAt: result.loopState.generatedAt,
        commandName: options.commandName ?? "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-run",
        recoveryStatus: result.recoveryContract?.contractStatus,
        statePath: path.relative(rootDir, result.artifacts.statePath),
        receiptsPath: path.relative(rootDir, result.artifacts.receiptsPath),
        resumeContractPath: result.resumeContract ? path.relative(rootDir, result.artifacts.resumeContractPath) : null,
        recoveryContractPath: result.recoveryContract ? path.relative(rootDir, result.artifacts.recoveryContractPath) : null,
        summaryPath: path.relative(rootDir, result.artifacts.summaryPath)
      }
    ),
    {
      dryRun: options.dryRun
    }
  );
}

async function continueBackpressureLoop(rootDir, config, options = {}, loopInput = {}) {
  const runId = createRunId();
  const previousState = loopInput.loopState ?? null;
  const previousSessions = Array.isArray(previousState?.sessions) ? previousState.sessions : [];
  const previousReceipts = Array.isArray(loopInput.receipts) ? loopInput.receipts : [];
  const startLoopIndex = previousSessions.length + 1;
  const totalLoopLimit = Number.isFinite(loopInput.totalLoopLimit) && loopInput.totalLoopLimit > 0
    ? Number(loopInput.totalLoopLimit)
    : resolveBackpressureLoopLimit(options, previousState?.loopLimit ?? 2);
  const loopSessions = [...previousSessions];
  const receipts = [...previousReceipts];
  let stopReason = previousState?.stopReason ?? "loop_limit_reached";

  for (let loopIndex = startLoopIndex; loopIndex <= totalLoopLimit; loopIndex += 1) {
    const sessionResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionRun(rootDir, config, {
      ...options,
      print: false,
      refreshContext: false
    });
    const session = {
      loopIndex,
      completedSessions: sessionResult.sessionState.completedSessions,
      totalPasses: sessionResult.sessionState.totalPasses,
      totalAppliedCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.totalAppliedCount ?? 0), 0),
      totalAutoReleaseCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.totalAutoReleaseCount ?? 0), 0),
      totalRefreshCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.totalRefreshCount ?? 0), 0),
      totalEscalatedCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.totalEscalatedCount ?? 0), 0),
      sessionStopReason: sessionResult.sessionState.stopReason,
      summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
    };

    if (!options.apply) {
      session.stopReason = "manual_preview";
      loopSessions.push(session);
      stopReason = "manual_preview";
      break;
    }

    if (options.dryRun) {
      session.stopReason = "dry_run_preview";
      loopSessions.push(session);
      receipts.push({
        loopIndex,
        outcome: "loop_dry_run",
        completedSessions: sessionResult.sessionState.completedSessions,
        totalPasses: sessionResult.sessionState.totalPasses,
        totalAppliedCount: session.totalAppliedCount,
        summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
      });
      stopReason = "dry_run_preview";
      break;
    }

    if (sessionResult.sessionState.stopReason === "no_due_group_backpressure_followup") {
      session.stopReason = "no_due_group_backpressure_followup";
      loopSessions.push(session);
      receipts.push({
        loopIndex,
        outcome: "loop_complete",
        completedSessions: sessionResult.sessionState.completedSessions,
        totalPasses: sessionResult.sessionState.totalPasses,
        totalAppliedCount: session.totalAppliedCount,
        summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
      });
      stopReason = "no_due_group_backpressure_followup";
      break;
    }

    session.stopReason = loopIndex === totalLoopLimit ? "loop_limit_reached" : "loop_round_complete";
    loopSessions.push(session);
    receipts.push({
      loopIndex,
      outcome: loopIndex === totalLoopLimit ? "loop_limit_reached" : "loop_round_processed",
      completedSessions: sessionResult.sessionState.completedSessions,
      totalPasses: sessionResult.sessionState.totalPasses,
      totalAppliedCount: session.totalAppliedCount,
      summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
    });

    if (loopIndex === totalLoopLimit) {
      stopReason = "loop_limit_reached";
      break;
    }
  }

  const loopState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState(loopSessions, {
    generatedAt: new Date().toISOString(),
    runtimeCycleLimit: options.runtimeCycleLimit,
    runtimeSessionLimit: options.runtimeSessionLimit,
    loopLimit: totalLoopLimit,
    stopReason
  });
  const relativeStatePath = path.join(
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop",
    runId,
    "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-state.json"
  );
  const resumeContract = loopState.resumeReady
    ? buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResumeContract(loopState, {
        generatedAt: new Date().toISOString(),
        loopStatePath: relativeStatePath
      })
    : null;
  const recoveryAssessment = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryAssessment(loopState, receipts, {
    generatedAt: new Date().toISOString(),
    resumeContractPath: resumeContract ? path.join("runs", "integration", "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop", runId, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-resume-contract.json") : null,
    resumeContract
  });
  const recoveryContract = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryContract({
    loopState,
    receipts,
    recoveryAssessment,
    resumeContract
  }, {
    generatedAt: new Date().toISOString(),
    runId,
    loopStatePath: relativeStatePath,
    receiptsPath: path.join("runs", "integration", "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop", runId, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-receipts.json"),
    resumeContractPath: resumeContract ? path.join("runs", "integration", "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop", runId, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-resume-contract.json") : null,
    recoveryContractPath: path.join("runs", "integration", "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop", runId, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-recovery-contract.json"),
    summaryPath: path.join("runs", "integration", "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop", runId, "summary.md")
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopSummary(loopState, receipts);
  const artifacts = await writeBackpressureLoopArtifacts(rootDir, {
    runId,
    loopState,
    receipts,
    resumeContract,
    recoveryContract,
    summary
  }, options);

  return {
    runId,
    loopState,
    receipts,
    resumeContract,
    recoveryAssessment,
    recoveryContract,
    artifacts,
    summary
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopReview(rootDir, config, options) {
  const runId = createRunId();
  const sessionResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionReview(rootDir, config, {
    ...options,
    print: false,
    refreshContext: false
  });
  const loopState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState([
    {
      loopIndex: 1,
      completedSessions: sessionResult.sessionState.completedSessions,
      totalPasses: sessionResult.sessionState.totalPasses,
      totalAppliedCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.totalAppliedCount ?? 0), 0),
      totalAutoReleaseCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.totalAutoReleaseCount ?? 0), 0),
      totalRefreshCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.totalRefreshCount ?? 0), 0),
      totalEscalatedCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.totalEscalatedCount ?? 0), 0),
      sessionStopReason: sessionResult.sessionState.stopReason,
      stopReason: "manual_preview",
      summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
    }
  ], {
    generatedAt: new Date().toISOString(),
    runtimeCycleLimit: options.runtimeCycleLimit,
    runtimeSessionLimit: options.runtimeSessionLimit,
    loopLimit: resolveBackpressureLoopLimit(options),
    stopReason: "manual_preview"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopSummary(loopState, []);
  const artifacts = await writeBackpressureLoopArtifacts(rootDir, {
    runId,
    loopState,
    receipts: [],
    resumeContract: null,
    summary
  }, options);

  maybePrint(options, [
    summary,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, loopState, receipts: [], resumeContract: null, artifacts, summary };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRun(rootDir, config, options) {
  const result = await continueBackpressureLoop(rootDir, config, options, {
    totalLoopLimit: resolveBackpressureLoopLimit(options)
  });

  maybePrint(options, [
    result.summary,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, result.artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, result.artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    ...(result.resumeContract ? [`- artifact_resume_contract: ${path.relative(rootDir, result.artifacts.resumeContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`] : []),
    `- artifact_recovery_contract: ${path.relative(rootDir, result.artifacts.recoveryContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  await recordBackpressureLoopHistory(rootDir, result, {
    commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-run",
    dryRun: options.dryRun
  });

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResume(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-resume requires --contract-file <coordination-backpressure-loop-resume-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  if (contract.contractKind !== "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_resume_contract") {
    throw new Error("The provided contract file is not a coordination-backpressure loop resume contract.");
  }
  if (contract.contractStatus !== "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_resume_contract") {
    throw new Error(`Coordination-backpressure loop resume contract is not dispatch-ready (status='${contract.contractStatus ?? "unknown"}').`);
  }

  const loopState = contract.loopState ?? null;
  const remainingBudget = Number.isFinite(contract.remainingLoopBudget)
    ? Number(contract.remainingLoopBudget)
    : resolveBackpressureLoopLimit(options, 1);
  const totalLoopLimit = (Number(loopState?.completedLoops ?? 0) || 0) + remainingBudget;
  const mergedOptions = {
    ...options,
    runtimeCycleLimit: Number(contract.runtimeCycleLimit ?? options.runtimeCycleLimit ?? 3),
    runtimeSessionLimit: Number(contract.runtimeSessionLimit ?? options.runtimeSessionLimit ?? 2),
    runtimeLoopLimit: totalLoopLimit
  };
  const result = await continueBackpressureLoop(rootDir, config, mergedOptions, {
    loopState,
    totalLoopLimit
  });

  maybePrint(options, [
    result.summary,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, result.artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, result.artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    ...(result.resumeContract ? [`- artifact_resume_contract: ${path.relative(rootDir, result.artifacts.resumeContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`] : []),
    `- artifact_recovery_contract: ${path.relative(rootDir, result.artifacts.recoveryContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-resume",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  await recordBackpressureLoopHistory(rootDir, result, {
    commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-resume",
    dryRun: options.dryRun
  });

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview(rootDir, config, options) {
  const historyState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview(historyState, {
    generatedAt: new Date().toISOString(),
    limit: options.limit
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReviewSummary(review);

  maybePrint(options, [
    summary,
    `- history_path: ${path.relative(rootDir, historyState.historyPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-history-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, historyState.historyPath)
    });
  }

  return { historyState, review, summary };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview(rootDir, config, options) {
  const historyState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview(historyState, {
    generatedAt: new Date().toISOString(),
    limit: options.limit
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReviewSummary(review);

  maybePrint(options, [
    summary,
    `- history_path: ${path.relative(rootDir, historyState.historyPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-recovery-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, historyState.historyPath)
    });
  }

  return { historyState, review, summary };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecover(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-recover requires --contract-file <coordination-backpressure-loop-recovery-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  if (contract.contractKind !== "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract") {
    throw new Error("The provided contract file is not a coordination-backpressure loop recovery contract.");
  }

  if (contract.contractStatus !== "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract") {
    maybePrint(options, [
      "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Loop Recover",
      "",
      `- contract_file: ${path.relative(rootDir, contractPath)}`,
      `- contract_status: ${contract.contractStatus ?? "unknown"}`,
      `- next_action: ${contract.recoveryAssessment?.nextAction ?? contract.nextAction ?? "Coordination-backpressure loop recovery is not dispatch-ready."}`
    ]);
    return {
      recoveryContract: contract,
      recoveryReady: false
    };
  }

  const resumeContractPath = contract.resumeContractPath
    ? (path.isAbsolute(contract.resumeContractPath)
      ? contract.resumeContractPath
      : path.join(rootDir, contract.resumeContractPath))
    : null;
  if (!resumeContractPath) {
    throw new Error("Coordination-backpressure loop recovery contract does not reference a resume contract.");
  }

  return await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResume(rootDir, config, {
    ...options,
    contractFile: resumeContractPath
  });
}
