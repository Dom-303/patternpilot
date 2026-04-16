import {
  buildGithubWebhookServiceRuntimeSessionResumeContract,
  buildGithubWebhookServiceRuntimeSessionState,
  createRunId,
  renderGithubWebhookServiceRuntimeSessionSummary,
  writeGithubWebhookServiceRuntimeSessionArtifacts
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeCycleReview,
  runGithubAppServiceRuntimeCycleRun
} from "./github-app-service-runtime-cycle.mjs";

function resolveRuntimeSessionLimit(options = {}, fallback = 3) {
  return Number.isFinite(options.runtimeSessionLimit) && options.runtimeSessionLimit > 0
    ? Number(options.runtimeSessionLimit)
    : fallback;
}

async function continueGithubAppServiceRuntimeSession(rootDir, config, options = {}, sessionInput = {}) {
  const runId = createRunId();
  const previousState = sessionInput.sessionState ?? null;
  const previousRounds = Array.isArray(previousState?.rounds) ? previousState.rounds : [];
  const previousReceipts = Array.isArray(sessionInput.receipts) ? sessionInput.receipts : [];
  const startSessionIndex = previousRounds.length + 1;
  const totalSessionLimit = Number.isFinite(sessionInput.totalSessionLimit) && sessionInput.totalSessionLimit > 0
    ? Number(sessionInput.totalSessionLimit)
    : resolveRuntimeSessionLimit(options, previousState?.sessionLimit ?? 3);
  const sessionRounds = [...previousRounds];
  const receipts = [...previousReceipts];
  let stopReason = previousState?.stopReason ?? "session_limit_reached";

  for (let sessionIndex = startSessionIndex; sessionIndex <= totalSessionLimit; sessionIndex += 1) {
    const cycleResult = await runGithubAppServiceRuntimeCycleRun(rootDir, config, {
      ...options,
      print: false,
      refreshContext: false
    });
    const round = {
      sessionIndex,
      completedCycles: cycleResult.plan.completedCycles,
      runtimeCount: cycleResult.plan.cycles.reduce((sum, cycle) => sum + Number(cycle.runtimeCount ?? 0), 0),
      dispatchableRuntimeCount: cycleResult.plan.cycles.reduce((sum, cycle) => sum + Number(cycle.dispatchableRuntimeCount ?? 0), 0),
      blockedLaneCount: cycleResult.plan.cycles.reduce((sum, cycle) => sum + Number(cycle.blockedLaneCount ?? 0), 0),
      queueCount: cycleResult.plan.cycles[cycleResult.plan.cycles.length - 1]?.queueCount ?? 0,
      cycleStopReason: cycleResult.plan.stopReason,
      summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
    };

    if (!options.apply) {
      round.stopReason = "manual_preview";
      sessionRounds.push(round);
      stopReason = "manual_preview";
      break;
    }

    if (options.dryRun) {
      round.stopReason = "dry_run_preview";
      sessionRounds.push(round);
      receipts.push({
        sessionIndex,
        outcome: "session_dry_run",
        completedCycles: cycleResult.plan.completedCycles,
        selectedCount: cycleResult.receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
        summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
      });
      stopReason = "dry_run_preview";
      break;
    }

    if (cycleResult.plan.stopReason === "no_dispatchable_runtime") {
      round.stopReason = "no_dispatchable_runtime";
      sessionRounds.push(round);
      receipts.push({
        sessionIndex,
        outcome: "session_complete",
        completedCycles: cycleResult.plan.completedCycles,
        selectedCount: cycleResult.receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
        summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
      });
      stopReason = "no_dispatchable_runtime";
      break;
    }

    round.stopReason = sessionIndex === totalSessionLimit ? "session_limit_reached" : "session_round_complete";
    sessionRounds.push(round);
    receipts.push({
      sessionIndex,
      outcome: sessionIndex === totalSessionLimit ? "session_limit_reached" : "session_round_processed",
      completedCycles: cycleResult.plan.completedCycles,
      selectedCount: cycleResult.receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
      summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
    });

    if (sessionIndex === totalSessionLimit) {
      stopReason = "session_limit_reached";
      break;
    }
  }

  const sessionState = buildGithubWebhookServiceRuntimeSessionState(sessionRounds, {
    generatedAt: new Date().toISOString(),
    workerIds: options.workerIds,
    workerId: options.workerId,
    schedulerLane: options.schedulerLane,
    runtimeCycleLimit: options.runtimeCycleLimit,
    sessionLimit: totalSessionLimit,
    stopReason
  });
  const relativeStatePath = path.join("runs", "integration", "github-app-service-runtime-session", runId, "service-runtime-session-state.json");
  const resumeContract = sessionState.resumeReady
    ? buildGithubWebhookServiceRuntimeSessionResumeContract(sessionState, {
        generatedAt: new Date().toISOString(),
        sessionStatePath: relativeStatePath
      })
    : null;
  const summary = renderGithubWebhookServiceRuntimeSessionSummary(sessionState, receipts);
  const artifacts = await writeGithubWebhookServiceRuntimeSessionArtifacts(rootDir, {
    runId,
    sessionState,
    receipts,
    resumeContract,
    summary,
    dryRun: options.dryRun
  });

  return {
    runId,
    sessionState,
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

export async function runGithubAppServiceRuntimeSessionReview(rootDir, config, options) {
  const runId = createRunId();
  const cycleResult = await runGithubAppServiceRuntimeCycleReview(rootDir, config, {
    ...options,
    print: false,
    refreshContext: false
  });
  const sessionState = buildGithubWebhookServiceRuntimeSessionState([
    {
      sessionIndex: 1,
      completedCycles: cycleResult.plan.completedCycles,
      runtimeCount: cycleResult.plan.cycles.reduce((sum, cycle) => sum + Number(cycle.runtimeCount ?? 0), 0),
      dispatchableRuntimeCount: cycleResult.plan.cycles.reduce((sum, cycle) => sum + Number(cycle.dispatchableRuntimeCount ?? 0), 0),
      blockedLaneCount: cycleResult.plan.cycles.reduce((sum, cycle) => sum + Number(cycle.blockedLaneCount ?? 0), 0),
      queueCount: cycleResult.plan.cycles[cycleResult.plan.cycles.length - 1]?.queueCount ?? 0,
      cycleStopReason: cycleResult.plan.stopReason,
      stopReason: "manual_preview",
      summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
    }
  ], {
    generatedAt: new Date().toISOString(),
    workerIds: options.workerIds,
    workerId: options.workerId,
    schedulerLane: options.schedulerLane,
    runtimeCycleLimit: options.runtimeCycleLimit,
    sessionLimit: resolveRuntimeSessionLimit(options),
    stopReason: "manual_preview"
  });
  const summary = renderGithubWebhookServiceRuntimeSessionSummary(sessionState, []);
  const artifacts = await writeGithubWebhookServiceRuntimeSessionArtifacts(rootDir, {
    runId,
    sessionState,
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
      command: "github-app-service-runtime-session-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, sessionState, receipts: [], resumeContract: null, artifacts };
}

export async function runGithubAppServiceRuntimeSessionRun(rootDir, config, options) {
  const result = await continueGithubAppServiceRuntimeSession(rootDir, config, options, {
    totalSessionLimit: resolveRuntimeSessionLimit(options)
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
      command: "github-app-service-runtime-session-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeSessionResume(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-service-runtime-session-resume requires --contract-file <runtime-session-resume-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  if (contract.contractKind !== "runtime_session_resume_contract") {
    throw new Error("The provided contract file is not a runtime session resume contract.");
  }
  if (contract.contractStatus !== "dispatch_ready_runtime_session_resume_contract") {
    throw new Error(`Runtime session resume contract is not dispatch-ready (status='${contract.contractStatus ?? "unknown"}').`);
  }

  const sessionState = contract.sessionState ?? null;
  const remainingBudget = Number.isFinite(contract.remainingSessionBudget)
    ? Number(contract.remainingSessionBudget)
    : resolveRuntimeSessionLimit(options, 1);
  const totalSessionLimit = (Number(sessionState?.completedSessions ?? 0) || 0) + remainingBudget;
  const mergedOptions = {
    ...options,
    workerIds: Array.isArray(options.workerIds) && options.workerIds.length > 0
      ? options.workerIds
      : (Array.isArray(contract.workerIds) ? contract.workerIds : []),
    workerId: options.workerId ?? contract.workerId ?? "local-worker",
    schedulerLane: options.schedulerLane ?? contract.schedulerLane ?? null,
    runtimeCycleLimit: Number(contract.runtimeCycleLimit ?? options.runtimeCycleLimit ?? 3),
    runtimeSessionLimit: totalSessionLimit
  };
  const result = await continueGithubAppServiceRuntimeSession(rootDir, config, mergedOptions, {
    sessionState,
    totalSessionLimit
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
      command: "github-app-service-runtime-session-resume",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}
