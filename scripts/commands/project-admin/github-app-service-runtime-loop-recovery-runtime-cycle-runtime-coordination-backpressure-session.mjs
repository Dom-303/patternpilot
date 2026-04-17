import {
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResumeContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionState,
  createRunId,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionSummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleRun
} from "./github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle.mjs";

function resolveBackpressureSessionLimit(options = {}, fallback = 2) {
  return Number.isFinite(options.runtimeSessionLimit) && options.runtimeSessionLimit > 0
    ? Number(options.runtimeSessionLimit)
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

async function writeBackpressureSessionArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session",
    payload.runId
  );
  const statePath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-state.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-receipts.json");
  const resumeContractPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-resume-contract.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(statePath, `${JSON.stringify(payload.sessionState, null, 2)}\n`, "utf8");
    await fs.writeFile(receiptsPath, `${JSON.stringify(payload.receipts, null, 2)}\n`, "utf8");
    if (payload.resumeContract) {
      await fs.writeFile(resumeContractPath, `${JSON.stringify(payload.resumeContract, null, 2)}\n`, "utf8");
    }
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return {
    rootPath,
    statePath,
    receiptsPath,
    resumeContractPath,
    summaryPath
  };
}

async function continueBackpressureSession(rootDir, config, options = {}, sessionInput = {}) {
  const runId = createRunId();
  const previousState = sessionInput.sessionState ?? null;
  const previousRounds = Array.isArray(previousState?.rounds) ? previousState.rounds : [];
  const previousReceipts = Array.isArray(sessionInput.receipts) ? sessionInput.receipts : [];
  const startSessionIndex = previousRounds.length + 1;
  const totalSessionLimit = Number.isFinite(sessionInput.totalSessionLimit) && sessionInput.totalSessionLimit > 0
    ? Number(sessionInput.totalSessionLimit)
    : resolveBackpressureSessionLimit(options, previousState?.sessionLimit ?? 2);
  const sessionRounds = [...previousRounds];
  const receipts = [...previousReceipts];
  let stopReason = previousState?.stopReason ?? "session_limit_reached";

  for (let sessionIndex = startSessionIndex; sessionIndex <= totalSessionLimit; sessionIndex += 1) {
    const cycleResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleRun(rootDir, config, {
      ...options,
      print: false,
      refreshContext: false
    });
    const round = {
      sessionIndex,
      completedPasses: cycleResult.cycleState.completedPasses,
      totalGroupCount: cycleResult.cycleState.totalGroupCount,
      totalSelectedCount: cycleResult.cycleState.totalSelectedCount,
      totalAppliedCount: cycleResult.cycleState.totalAppliedCount,
      totalAutoReleaseCount: cycleResult.cycleState.totalAutoReleaseCount,
      totalRefreshCount: cycleResult.cycleState.totalRefreshCount,
      totalEscalatedCount: cycleResult.cycleState.totalEscalatedCount,
      cycleStopReason: cycleResult.cycleState.stopReason,
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
        completedPasses: cycleResult.cycleState.completedPasses,
        totalAppliedCount: cycleResult.cycleState.totalAppliedCount,
        summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
      });
      stopReason = "dry_run_preview";
      break;
    }

    if (cycleResult.cycleState.stopReason === "no_due_group_backpressure_followup") {
      round.stopReason = "no_due_group_backpressure_followup";
      sessionRounds.push(round);
      receipts.push({
        sessionIndex,
        outcome: "session_complete",
        completedPasses: cycleResult.cycleState.completedPasses,
        totalAppliedCount: cycleResult.cycleState.totalAppliedCount,
        summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
      });
      stopReason = "no_due_group_backpressure_followup";
      break;
    }

    round.stopReason = sessionIndex === totalSessionLimit ? "session_limit_reached" : "session_round_complete";
    sessionRounds.push(round);
    receipts.push({
      sessionIndex,
      outcome: sessionIndex === totalSessionLimit ? "session_limit_reached" : "session_round_processed",
      completedPasses: cycleResult.cycleState.completedPasses,
      totalAppliedCount: cycleResult.cycleState.totalAppliedCount,
      summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
    });

    if (sessionIndex === totalSessionLimit) {
      stopReason = "session_limit_reached";
      break;
    }
  }

  const sessionState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionState(sessionRounds, {
    generatedAt: new Date().toISOString(),
    runtimeCycleLimit: options.runtimeCycleLimit,
    sessionLimit: totalSessionLimit,
    stopReason
  });
  const relativeStatePath = path.join(
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session",
    runId,
    "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-state.json"
  );
  const resumeContract = sessionState.resumeReady
    ? buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResumeContract(sessionState, {
        generatedAt: new Date().toISOString(),
        sessionStatePath: relativeStatePath
      })
    : null;
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionSummary(sessionState, receipts);
  const artifacts = await writeBackpressureSessionArtifacts(rootDir, {
    runId,
    sessionState,
    receipts,
    resumeContract,
    summary
  }, options);

  return {
    runId,
    sessionState,
    receipts,
    resumeContract,
    artifacts,
    summary
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionReview(rootDir, config, options) {
  const runId = createRunId();
  const cycleResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleReview(rootDir, config, {
    ...options,
    print: false,
    refreshContext: false
  });
  const sessionState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionState([
    {
      sessionIndex: 1,
      completedPasses: cycleResult.cycleState.completedPasses,
      totalGroupCount: cycleResult.cycleState.totalGroupCount,
      totalSelectedCount: cycleResult.cycleState.totalSelectedCount,
      totalAppliedCount: cycleResult.cycleState.totalAppliedCount,
      totalAutoReleaseCount: cycleResult.cycleState.totalAutoReleaseCount,
      totalRefreshCount: cycleResult.cycleState.totalRefreshCount,
      totalEscalatedCount: cycleResult.cycleState.totalEscalatedCount,
      cycleStopReason: cycleResult.cycleState.stopReason,
      stopReason: "manual_preview",
      summaryPath: path.relative(rootDir, cycleResult.artifacts.summaryPath)
    }
  ], {
    generatedAt: new Date().toISOString(),
    runtimeCycleLimit: options.runtimeCycleLimit,
    sessionLimit: resolveBackpressureSessionLimit(options),
    stopReason: "manual_preview"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionSummary(sessionState, []);
  const artifacts = await writeBackpressureSessionArtifacts(rootDir, {
    runId,
    sessionState,
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
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, sessionState, receipts: [], resumeContract: null, artifacts, summary };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionRun(rootDir, config, options) {
  const result = await continueBackpressureSession(rootDir, config, options, {
    totalSessionLimit: resolveBackpressureSessionLimit(options)
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
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResume(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-resume requires --contract-file <coordination-backpressure-session-resume-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  if (contract.contractKind !== "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_session_resume_contract") {
    throw new Error("The provided contract file is not a coordination-backpressure session resume contract.");
  }
  if (contract.contractStatus !== "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_session_resume_contract") {
    throw new Error(`Coordination-backpressure session resume contract is not dispatch-ready (status='${contract.contractStatus ?? "unknown"}').`);
  }

  const sessionState = contract.sessionState ?? null;
  const remainingBudget = Number.isFinite(contract.remainingSessionBudget)
    ? Number(contract.remainingSessionBudget)
    : resolveBackpressureSessionLimit(options, 1);
  const totalSessionLimit = (Number(sessionState?.completedSessions ?? 0) || 0) + remainingBudget;
  const mergedOptions = {
    ...options,
    runtimeCycleLimit: Number(contract.runtimeCycleLimit ?? options.runtimeCycleLimit ?? 3),
    runtimeSessionLimit: totalSessionLimit
  };
  const result = await continueBackpressureSession(rootDir, config, mergedOptions, {
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
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-resume",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}
