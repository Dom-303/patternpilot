import {
  buildGithubWebhookServiceRuntimeLoopResumeContract,
  buildGithubWebhookServiceRuntimeLoopState,
  createRunId,
  renderGithubWebhookServiceRuntimeLoopSummary,
  writeGithubWebhookServiceRuntimeLoopArtifacts
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeSessionReview,
  runGithubAppServiceRuntimeSessionRun
} from "./github-app-service-runtime-session.mjs";

function resolveRuntimeLoopLimit(options = {}, fallback = 2) {
  return Number.isFinite(options.runtimeLoopLimit) && options.runtimeLoopLimit > 0
    ? Number(options.runtimeLoopLimit)
    : fallback;
}

async function continueGithubAppServiceRuntimeLoop(rootDir, config, options = {}, loopInput = {}) {
  const runId = createRunId();
  const previousState = loopInput.loopState ?? null;
  const previousSessions = Array.isArray(previousState?.sessions) ? previousState.sessions : [];
  const previousReceipts = Array.isArray(loopInput.receipts) ? loopInput.receipts : [];
  const startLoopIndex = previousSessions.length + 1;
  const totalLoopLimit = Number.isFinite(loopInput.totalLoopLimit) && loopInput.totalLoopLimit > 0
    ? Number(loopInput.totalLoopLimit)
    : resolveRuntimeLoopLimit(options, previousState?.loopLimit ?? 2);
  const loopSessions = [...previousSessions];
  const receipts = [...previousReceipts];
  let stopReason = previousState?.stopReason ?? "loop_limit_reached";

  for (let loopIndex = startLoopIndex; loopIndex <= totalLoopLimit; loopIndex += 1) {
    const sessionResult = await runGithubAppServiceRuntimeSessionRun(rootDir, config, {
      ...options,
      print: false,
      refreshContext: false
    });
    const session = {
      loopIndex,
      completedSessions: sessionResult.sessionState.completedSessions,
      totalCycles: sessionResult.sessionState.totalCycles,
      runtimeCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.runtimeCount ?? 0), 0),
      dispatchableRuntimeCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.dispatchableRuntimeCount ?? 0), 0),
      blockedLaneCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.blockedLaneCount ?? 0), 0),
      queueCount: sessionResult.sessionState.rounds[sessionResult.sessionState.rounds.length - 1]?.queueCount ?? 0,
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
        totalCycles: sessionResult.sessionState.totalCycles,
        selectedCount: sessionResult.receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
        summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
      });
      stopReason = "dry_run_preview";
      break;
    }

    if (sessionResult.sessionState.stopReason === "no_dispatchable_runtime") {
      session.stopReason = "no_dispatchable_runtime";
      loopSessions.push(session);
      receipts.push({
        loopIndex,
        outcome: "loop_complete",
        completedSessions: sessionResult.sessionState.completedSessions,
        totalCycles: sessionResult.sessionState.totalCycles,
        selectedCount: sessionResult.receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
        summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
      });
      stopReason = "no_dispatchable_runtime";
      break;
    }

    session.stopReason = loopIndex === totalLoopLimit ? "loop_limit_reached" : "loop_round_complete";
    loopSessions.push(session);
    receipts.push({
      loopIndex,
      outcome: loopIndex === totalLoopLimit ? "loop_limit_reached" : "loop_round_processed",
      completedSessions: sessionResult.sessionState.completedSessions,
      totalCycles: sessionResult.sessionState.totalCycles,
      selectedCount: sessionResult.receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
      summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
    });

    if (loopIndex === totalLoopLimit) {
      stopReason = "loop_limit_reached";
      break;
    }
  }

  const loopState = buildGithubWebhookServiceRuntimeLoopState(loopSessions, {
    generatedAt: new Date().toISOString(),
    workerIds: options.workerIds,
    workerId: options.workerId,
    schedulerLane: options.schedulerLane,
    runtimeCycleLimit: options.runtimeCycleLimit,
    runtimeSessionLimit: options.runtimeSessionLimit,
    loopLimit: totalLoopLimit,
    stopReason
  });
  const relativeStatePath = path.join("runs", "integration", "github-app-service-runtime-loop", runId, "service-runtime-loop-state.json");
  const resumeContract = loopState.resumeReady
    ? buildGithubWebhookServiceRuntimeLoopResumeContract(loopState, {
        generatedAt: new Date().toISOString(),
        loopStatePath: relativeStatePath
      })
    : null;
  const summary = renderGithubWebhookServiceRuntimeLoopSummary(loopState, receipts);
  const artifacts = await writeGithubWebhookServiceRuntimeLoopArtifacts(rootDir, {
    runId,
    loopState,
    receipts,
    resumeContract,
    summary,
    dryRun: options.dryRun
  });

  return {
    runId,
    loopState,
    receipts,
    resumeContract,
    artifacts,
    summary
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

export async function runGithubAppServiceRuntimeLoopReview(rootDir, config, options) {
  const runId = createRunId();
  const sessionResult = await runGithubAppServiceRuntimeSessionReview(rootDir, config, {
    ...options,
    print: false,
    refreshContext: false
  });
  const loopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: sessionResult.sessionState.completedSessions,
      totalCycles: sessionResult.sessionState.totalCycles,
      runtimeCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.runtimeCount ?? 0), 0),
      dispatchableRuntimeCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.dispatchableRuntimeCount ?? 0), 0),
      blockedLaneCount: sessionResult.sessionState.rounds.reduce((sum, round) => sum + Number(round.blockedLaneCount ?? 0), 0),
      queueCount: sessionResult.sessionState.rounds[sessionResult.sessionState.rounds.length - 1]?.queueCount ?? 0,
      sessionStopReason: sessionResult.sessionState.stopReason,
      stopReason: "manual_preview",
      summaryPath: path.relative(rootDir, sessionResult.artifacts.summaryPath)
    }
  ], {
    generatedAt: new Date().toISOString(),
    workerIds: options.workerIds,
    workerId: options.workerId,
    schedulerLane: options.schedulerLane,
    runtimeCycleLimit: options.runtimeCycleLimit,
    runtimeSessionLimit: options.runtimeSessionLimit,
    loopLimit: resolveRuntimeLoopLimit(options),
    stopReason: "manual_preview"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopSummary(loopState, []);
  const artifacts = await writeGithubWebhookServiceRuntimeLoopArtifacts(rootDir, {
    runId,
    loopState,
    receipts: [],
    resumeContract: null,
    summary,
    dryRun: options.dryRun
  });

  maybePrint(options, [
    summary,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, loopState, receipts: [], resumeContract: null, artifacts };
}

export async function runGithubAppServiceRuntimeLoopRun(rootDir, config, options) {
  const result = await continueGithubAppServiceRuntimeLoop(rootDir, config, options, {
    totalLoopLimit: resolveRuntimeLoopLimit(options)
  });

  maybePrint(options, [
    result.summary,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, result.artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, result.artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    ...(result.resumeContract ? [`- artifact_resume_contract: ${path.relative(rootDir, result.artifacts.resumeContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`] : []),
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopResume(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-service-runtime-loop-resume requires --contract-file <runtime-loop-resume-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  if (contract.contractKind !== "runtime_loop_resume_contract") {
    throw new Error("The provided contract file is not a runtime loop resume contract.");
  }
  if (contract.contractStatus !== "dispatch_ready_runtime_loop_resume_contract") {
    throw new Error(`Runtime loop resume contract is not dispatch-ready (status='${contract.contractStatus ?? "unknown"}').`);
  }

  const loopState = contract.loopState ?? null;
  const remainingBudget = Number.isFinite(contract.remainingLoopBudget)
    ? Number(contract.remainingLoopBudget)
    : resolveRuntimeLoopLimit(options, 1);
  const totalLoopLimit = (Number(loopState?.completedLoops ?? 0) || 0) + remainingBudget;
  const mergedOptions = {
    ...options,
    workerIds: Array.isArray(options.workerIds) && options.workerIds.length > 0
      ? options.workerIds
      : (Array.isArray(contract.workerIds) ? contract.workerIds : []),
    workerId: options.workerId ?? contract.workerId ?? "local-worker",
    schedulerLane: options.schedulerLane ?? contract.schedulerLane ?? null,
    runtimeCycleLimit: Number(contract.runtimeCycleLimit ?? options.runtimeCycleLimit ?? 3),
    runtimeSessionLimit: Number(contract.runtimeSessionLimit ?? options.runtimeSessionLimit ?? 3),
    runtimeLoopLimit: totalLoopLimit
  };
  const result = await continueGithubAppServiceRuntimeLoop(rootDir, config, mergedOptions, {
    loopState,
    totalLoopLimit
  });

  maybePrint(options, [
    result.summary,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_state: ${path.relative(rootDir, result.artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, result.artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    ...(result.resumeContract ? [`- artifact_resume_contract: ${path.relative(rootDir, result.artifacts.resumeContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`] : []),
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-resume",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}
