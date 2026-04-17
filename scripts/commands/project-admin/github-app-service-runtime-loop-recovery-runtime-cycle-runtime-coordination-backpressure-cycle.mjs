import {
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResumeContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleState,
  createRunId,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleSummary
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureAutoFollowup,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview
} from "./github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure.mjs";

function resolveBackpressureCycleLimit(options = {}, fallback = 2) {
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

async function writeBackpressureCycleArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle",
    payload.runId
  );
  const cycleStatePath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-state.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-receipts.json");
  const resumeContractPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-resume-contract.json");
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

function buildCyclePassFromFollowupReview(result, passIndex, stopReason) {
  const followups = Array.isArray(result.review?.followups) ? result.review.followups : [];
  return {
    passIndex,
    groupCount: Number(result.review?.groupCount ?? 0),
    selectedCount: followups.filter((item) => item.shouldApply).length,
    appliedCount: 0,
    autoReleaseCount: followups.filter((item) => item.shouldApply && item.followupAction === "auto_release").length,
    refreshCount: followups.filter((item) => item.shouldApply && item.followupAction === "refresh_backpressure").length,
    escalatedCount: followups.filter((item) => item.shouldApply && item.followupAction === "escalate").length,
    stopReason,
    summaryPath: result.artifacts?.summaryPath ? path.relative(result.rootDir ?? "", result.artifacts.summaryPath) : null
  };
}

function buildCyclePassFromAutoFollowup(rootDir, result, passIndex, stopReason) {
  const receipts = Array.isArray(result.applied?.receipts) ? result.applied.receipts : [];
  return {
    passIndex,
    groupCount: Number(result.review?.groupCount ?? 0),
    selectedCount: Number(result.selection?.selectedFollowups?.length ?? 0),
    appliedCount: receipts.length,
    autoReleaseCount: receipts.filter((item) => item.followupAction === "auto_release").length,
    refreshCount: receipts.filter((item) => item.followupAction === "refresh_backpressure").length,
    escalatedCount: receipts.filter((item) => item.followupAction === "escalate").length,
    stopReason,
    summaryPath: result.artifacts?.summaryPath ? path.relative(rootDir, result.artifacts.summaryPath) : null
  };
}

async function continueBackpressureCycle(rootDir, config, options = {}, cycleInput = {}) {
  const runId = createRunId();
  const previousState = cycleInput.cycleState ?? null;
  const previousPasses = Array.isArray(previousState?.passes) ? previousState.passes : [];
  const previousReceipts = Array.isArray(cycleInput.receipts) ? cycleInput.receipts : [];
  const startPassIndex = previousPasses.length + 1;
  const cycleLimit = Number.isFinite(cycleInput.totalCycleLimit) && cycleInput.totalCycleLimit > 0
    ? Number(cycleInput.totalCycleLimit)
    : resolveBackpressureCycleLimit(options, previousState?.cycleLimit ?? 2);
  const passes = [...previousPasses];
  const receipts = [...previousReceipts];
  let stopReason = previousState?.stopReason ?? "cycle_limit_reached";

  for (let passIndex = startPassIndex; passIndex <= cycleLimit; passIndex += 1) {
    if (!options.apply || options.dryRun) {
      const previewResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview(rootDir, config, {
        ...options,
        print: false,
        refreshContext: false
      });
      const previewStopReason = options.dryRun ? "dry_run_preview" : "manual_preview";
      passes.push({
        ...buildCyclePassFromFollowupReview({
          ...previewResult,
          rootDir
        }, passIndex, previewStopReason),
        summaryPath: path.relative(rootDir, previewResult.artifacts.summaryPath)
      });
      stopReason = previewStopReason;
      break;
    }

    const autoFollowupResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureAutoFollowup(rootDir, config, {
      ...options,
      print: false,
      refreshContext: false
    });

    if (!autoFollowupResult.autoApplied) {
      passes.push({
        passIndex,
        groupCount: Number(autoFollowupResult.review?.groupCount ?? 0),
        selectedCount: 0,
        appliedCount: 0,
        autoReleaseCount: 0,
        refreshCount: 0,
        escalatedCount: 0,
        stopReason: "no_due_group_backpressure_followup",
        summaryPath: null
      });
      receipts.push({
        passIndex,
        outcome: "cycle_drained",
        selectedCount: 0,
        appliedCount: 0,
        autoReleaseCount: 0,
        refreshCount: 0,
        escalatedCount: 0,
        summaryPath: null
      });
      stopReason = "no_due_group_backpressure_followup";
      break;
    }

    const passStopReason = passIndex === cycleLimit
      ? "cycle_limit_reached"
      : "backpressure_followup_processed";
    const pass = buildCyclePassFromAutoFollowup(rootDir, autoFollowupResult, passIndex, passStopReason);
    passes.push(pass);
    receipts.push({
      passIndex,
      outcome: passIndex === cycleLimit ? "cycle_limit_reached" : "cycle_pass_processed",
      selectedCount: pass.selectedCount,
      appliedCount: pass.appliedCount,
      autoReleaseCount: pass.autoReleaseCount,
      refreshCount: pass.refreshCount,
      escalatedCount: pass.escalatedCount,
      summaryPath: pass.summaryPath
    });

    if (passIndex === cycleLimit) {
      stopReason = "cycle_limit_reached";
      break;
    }
  }

  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleState(passes, {
    generatedAt: new Date().toISOString(),
    cycleLimit,
    stopReason
  });
  const relativeCycleStatePath = path.join(
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle",
    runId,
    "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-state.json"
  );
  const resumeContract = cycleState.resumeReady
    ? buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResumeContract(cycleState, {
        generatedAt: new Date().toISOString(),
        cycleStatePath: relativeCycleStatePath
      })
    : null;
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleSummary(cycleState, receipts);
  const artifacts = await writeBackpressureCycleArtifacts(rootDir, {
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

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleReview(rootDir, config, options) {
  const runId = createRunId();
  const previewResult = await runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview(rootDir, config, {
    ...options,
    print: false,
    refreshContext: false
  });
  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleState([
    {
      ...buildCyclePassFromFollowupReview({
        ...previewResult,
        rootDir
      }, 1, "manual_preview"),
      summaryPath: path.relative(rootDir, previewResult.artifacts.summaryPath)
    }
  ], {
    generatedAt: new Date().toISOString(),
    cycleLimit: resolveBackpressureCycleLimit(options),
    stopReason: "manual_preview"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleSummary(cycleState, []);
  const artifacts = await writeBackpressureCycleArtifacts(rootDir, {
    runId,
    cycleState,
    receipts: [],
    resumeContract: null,
    summary
  }, options);

  maybePrint(options, [
    summary,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    runId,
    cycleState,
    receipts: [],
    artifacts,
    summary
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleRun(rootDir, config, options) {
  const result = await continueBackpressureCycle(rootDir, config, options);

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
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResume(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-resume requires --contract-file <coordination-backpressure-cycle-resume-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const contract = JSON.parse(await fs.readFile(contractPath, "utf8"));
  if (contract.contractKind !== "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_cycle_resume_contract") {
    throw new Error("The provided contract file is not a coordination-backpressure cycle resume contract.");
  }

  if (contract.contractStatus !== "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_cycle_resume_contract") {
    maybePrint(options, [
      "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Cycle Resume",
      "",
      `- contract_file: ${path.relative(rootDir, contractPath)}`,
      `- contract_status: ${contract.contractStatus ?? "unknown"}`,
      `- next_action: ${contract.nextAction ?? "This coordination-backpressure cycle is not resumable."}`
    ]);
    return {
      cycleResumeContract: contract,
      cycleReady: false
    };
  }

  const result = await continueBackpressureCycle(rootDir, config, options, {
    cycleState: contract.cycleState,
    receipts: [],
    totalCycleLimit: contract.cycleState?.cycleLimit
  });

  maybePrint(options, [
    result.summary,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- resumed_from: ${path.relative(rootDir, contractPath)}`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-resume",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}
