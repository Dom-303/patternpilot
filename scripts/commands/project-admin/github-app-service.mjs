import {
  buildGithubWebhookDispatchPlan,
  buildGithubWebhookExecutionContract,
  buildGithubWebhookRecoveryAssessment,
  buildGithubWebhookRecoveryContract,
  buildGithubWebhookResumeContract,
  buildGithubWebhookRunnerPlan,
  buildGithubWebhookRunnerState,
  buildGithubWebhookServiceRequeuePlan,
  buildGithubWebhookServiceReviewPlan,
  buildGithubWebhookServiceTickPlan,
  claimGithubWebhookServiceQueueEntries,
  createRunId,
  enqueueGithubWebhookServiceContractFromFile,
  evaluateGithubWebhookRecoveryContract,
  executeGithubWebhookDispatchPlan,
  executeGithubWebhookRunnerPlan,
  loadGithubAppInstallationState,
  loadGithubWebhookExecutionContract,
  loadGithubWebhookServiceQueue,
  queueGithubWebhookServiceContract,
  reclaimExpiredGithubWebhookServiceClaims,
  requeueGithubWebhookServiceQueueEntries,
  renderGithubWebhookDispatchSummary,
  renderGithubWebhookRunnerSummary,
  renderGithubWebhookServiceRequeueSummary,
  renderGithubWebhookServiceReviewSummary,
  renderGithubWebhookServiceTickSummary,
  runShellCommand,
  summarizeGithubWebhookExecution,
  summarizeGithubWebhookRunnerExecution,
  writeGithubWebhookDispatchArtifacts,
  writeGithubWebhookRunnerArtifacts,
  writeGithubWebhookServiceAdminArtifacts,
  writeGithubWebhookServiceArtifacts,
  buildGithubWebhookRoutePlan
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext,
  loadGithubWebhookEventInput
} from "./shared.mjs";

export async function runGithubAppWebhookDispatch(rootDir, config, options) {
  if (!options.file) {
    throw new Error("github-app-webhook-dispatch requires --file <payload-json>.");
  }

  const runId = createRunId();
  const { generatedAt, envelope } = await loadGithubWebhookEventInput(rootDir, options);
  const routePlan = buildGithubWebhookRoutePlan(config, envelope, {
    project: options.project
  });
  const dispatchPlan = buildGithubWebhookDispatchPlan(routePlan, {
    apply: options.apply,
    force: options.force
  });
  const executionResults = dispatchPlan.apply && !options.dryRun && dispatchPlan.dispatchStatus === "ready_to_execute"
    && !options.contractOnly
    ? await executeGithubWebhookDispatchPlan(dispatchPlan, {
        runShellCommand,
        cwd: rootDir,
        env: process.env,
        stdio: "inherit"
      })
    : [];
  const executionSummary = summarizeGithubWebhookExecution(dispatchPlan, executionResults, {
    dryRun: options.dryRun,
    contractOnly: options.contractOnly
  });
  const executionContract = buildGithubWebhookExecutionContract({
    envelope,
    routePlan,
    dispatchPlan,
    executionSummary
  }, {
    dryRun: options.dryRun,
    contractOnly: options.contractOnly,
    cwd: "."
  });
  const summary = renderGithubWebhookDispatchSummary({
    envelope,
    routePlan,
    dispatchPlan,
    executionResults,
    executionSummary,
    executionContract
  });
  const artifacts = await writeGithubWebhookDispatchArtifacts(rootDir, {
    runId,
    envelope,
    routePlan,
    dispatchPlan,
    executionContract,
    executionResults,
    executionSummary,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        envelopePath: path.relative(rootDir, artifacts.envelopePath),
        routePath: path.relative(rootDir, artifacts.routePath),
        dispatchPath: path.relative(rootDir, artifacts.dispatchPath),
        executionContractPath: path.relative(rootDir, artifacts.executionContractPath),
        executionPath: path.relative(rootDir, artifacts.executionPath),
        executionSummaryPath: path.relative(rootDir, artifacts.executionSummaryPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      envelope,
      routePlan,
      dispatchPlan,
      executionContract,
      executionResults,
      executionSummary
    }, null, 2));
    return {
      generatedAt,
      runId,
      envelope,
      routePlan,
      dispatchPlan,
      executionContract,
      executionResults,
      executionSummary,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_envelope: ${path.relative(rootDir, artifacts.envelopePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_route: ${path.relative(rootDir, artifacts.routePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_dispatch: ${path.relative(rootDir, artifacts.dispatchPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution_contract: ${path.relative(rootDir, artifacts.executionContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution: ${path.relative(rootDir, artifacts.executionPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution_summary: ${path.relative(rootDir, artifacts.executionSummaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_EVENT_MODEL.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-webhook-dispatch",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  if (executionSummary.finalStatus === "execution_failed") {
    const error = new Error(`Webhook dispatch execution failed at command '${executionSummary.firstFailure.commandName}'.`);
    error.exitCode = 1;
    throw error;
  }

  return {
    generatedAt,
    runId,
    envelope,
    routePlan,
    dispatchPlan,
    executionContract,
    executionResults,
    executionSummary,
    artifacts
  };
}

export async function runGithubAppExecutionRun(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-execution-run requires --contract-file <execution-contract-json>.");
  }

  const runId = createRunId();
  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const executionContract = options.loadedContract ?? await loadGithubWebhookExecutionContract(contractPath);
  const runnerPlan = buildGithubWebhookRunnerPlan(executionContract, {
    apply: options.apply,
    dryRun: options.dryRun,
    force: options.force,
    generatedAt: new Date().toISOString()
  });
  const executionResults = runnerPlan.apply && !options.dryRun && runnerPlan.runnerStatus === "ready_to_execute"
    ? await executeGithubWebhookRunnerPlan(runnerPlan, {
        runShellCommand,
        cwd: rootDir,
        env: process.env,
        stdio: "inherit"
      })
    : [];
  const executionSummary = summarizeGithubWebhookRunnerExecution(runnerPlan, executionResults, {
    dryRun: options.dryRun
  });
  const runnerState = buildGithubWebhookRunnerState({
    executionContract,
    runnerPlan,
    executionResults,
    executionSummary
  });
  const recoveryAssessment = buildGithubWebhookRecoveryAssessment({
    executionContract,
    runnerPlan,
    runnerState,
    executionSummary
  });
  const resumeContract = buildGithubWebhookResumeContract({
    executionContract,
    runnerPlan,
    runnerState
  });
  const recoveryContract = buildGithubWebhookRecoveryContract({
    executionContract,
    runnerPlan,
    runnerState,
    recoveryAssessment
  });
  const summary = renderGithubWebhookRunnerSummary({
    executionContract,
    runnerPlan,
    executionResults,
    executionSummary,
    runnerState,
    resumeContract,
    recoveryAssessment,
    recoveryContract
  });
  const artifacts = await writeGithubWebhookRunnerArtifacts(rootDir, {
    runId,
    executionContract,
    runnerPlan,
    executionResults,
    executionSummary,
    runnerState,
    resumeContract,
    recoveryAssessment,
    recoveryContract,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        contractPath: path.relative(rootDir, artifacts.contractPath),
        runnerPlanPath: path.relative(rootDir, artifacts.runnerPlanPath),
        executionPath: path.relative(rootDir, artifacts.executionPath),
        executionSummaryPath: path.relative(rootDir, artifacts.executionSummaryPath),
        runnerStatePath: path.relative(rootDir, artifacts.runnerStatePath),
        resumeContractPath: path.relative(rootDir, artifacts.resumeContractPath),
        recoveryAssessmentPath: path.relative(rootDir, artifacts.recoveryAssessmentPath),
        recoveryContractPath: path.relative(rootDir, artifacts.recoveryContractPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      executionContract,
      runnerPlan,
      executionResults,
      executionSummary,
      runnerState,
      resumeContract,
      recoveryAssessment,
      recoveryContract
    }, null, 2));
    return {
      runId,
      executionContract,
      runnerPlan,
      executionResults,
      executionSummary,
      runnerState,
      resumeContract,
      recoveryAssessment,
      recoveryContract,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- contract_file: ${path.relative(rootDir, contractPath)}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_contract: ${path.relative(rootDir, artifacts.contractPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_runner_plan: ${path.relative(rootDir, artifacts.runnerPlanPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution: ${path.relative(rootDir, artifacts.executionPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution_summary: ${path.relative(rootDir, artifacts.executionSummaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_runner_state: ${path.relative(rootDir, artifacts.runnerStatePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_resume_contract: ${path.relative(rootDir, artifacts.resumeContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_recovery_assessment: ${path.relative(rootDir, artifacts.recoveryAssessmentPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_recovery_contract: ${path.relative(rootDir, artifacts.recoveryContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_EVENT_MODEL.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-execution-run",
    projectKey: executionContract.selectedProjectKey || config.defaultProject,
    mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  if (executionSummary.finalStatus === "execution_failed" && !options.allowFailureReturn) {
    const error = new Error(`GitHub execution runner failed at command '${executionSummary.firstFailure.commandName}'.`);
    error.exitCode = 1;
    throw error;
  }

  return {
    runId,
    executionContract,
    runnerPlan,
    executionResults,
    executionSummary,
    runnerState,
    resumeContract,
    recoveryAssessment,
    recoveryContract,
    artifacts
  };
}

export async function runGithubAppExecutionResume(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-execution-resume requires --contract-file <resume-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const executionContract = await loadGithubWebhookExecutionContract(contractPath);

  if (executionContract.contractStatus === "resume_not_required") {
    console.log(`# Patternpilot GitHub Webhook Resume`);
    console.log(``);
    console.log(`- contract_file: ${path.relative(rootDir, contractPath)}`);
    console.log(`- contract_status: resume_not_required`);
    console.log(`- next_action: ${executionContract.nextAction ?? "No resumable work remains."}`);
    return {
      executionContract,
      resumeRequired: false
    };
  }

  if (executionContract.contractStatus !== "dispatch_ready_resume_contract") {
    throw new Error(`github-app-execution-resume expects a resume contract, got '${executionContract.contractStatus ?? "unknown"}'.`);
  }

  return await runGithubAppExecutionRun(rootDir, config, options);
}

export async function runGithubAppExecutionRecover(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-execution-recover requires --contract-file <recovery-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const executionContract = await loadGithubWebhookExecutionContract(contractPath);

  if (executionContract.contractKind !== "recovery_contract") {
    throw new Error(`github-app-execution-recover expects a recovery contract, got '${executionContract.contractKind ?? "unknown"}'.`);
  }

  const recoveryEvaluation = evaluateGithubWebhookRecoveryContract(executionContract);
  const evaluatedContract = {
    ...executionContract,
    contractStatus: recoveryEvaluation.effectiveStatus,
    nextAction: recoveryEvaluation.nextAction,
    recoveryAssessment: {
      ...(executionContract.recoveryAssessment ?? {}),
      evaluatedAt: new Date().toISOString(),
      effectiveStatus: recoveryEvaluation.effectiveStatus,
      blockedUntil: recoveryEvaluation.blockedUntil
    }
  };

  if (recoveryEvaluation.effectiveStatus !== "dispatch_ready_recovery_contract") {
    console.log(`# Patternpilot GitHub Webhook Recover`);
    console.log(``);
    console.log(`- contract_file: ${path.relative(rootDir, contractPath)}`);
    console.log(`- contract_status: ${recoveryEvaluation.effectiveStatus}`);
    console.log(`- blocked_until: ${recoveryEvaluation.blockedUntil ?? "-"}`);
    console.log(`- next_action: ${recoveryEvaluation.nextAction}`);
    return {
      executionContract: evaluatedContract,
      recoveryReady: false
    };
  }

  return await runGithubAppExecutionRun(rootDir, config, {
    ...options,
    loadedContract: evaluatedContract
  });
}

export async function runGithubAppExecutionEnqueue(rootDir, _config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-execution-enqueue requires --contract-file <contract-json>.");
  }

  const result = await enqueueGithubWebhookServiceContractFromFile(rootDir, options.contractFile, {
    dryRun: options.dryRun,
    maxServiceAttempts: options.maxServiceAttempts
  });

  console.log(`# Patternpilot GitHub App Queue Enqueue`);
  console.log(``);
  console.log(`- source_contract: ${path.relative(rootDir, result.sourcePath)}`);
  console.log(`- contract_kind: ${result.contract.contractKind ?? "-"}`);
  console.log(`- contract_status: ${result.contract.contractStatus ?? "-"}`);
  console.log(`- target_state: ${result.queued.targetState}`);
  console.log(`- duplicate: ${result.queued.duplicate ? "yes" : "no"}`);
  console.log(`- queued_path: ${path.relative(rootDir, result.queued.targetPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  return result;
}

export async function runGithubAppServiceReview(rootDir, config, options) {
  const runId = createRunId();
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const installationState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubWebhookServiceReviewPlan(queueState.queue, {
    fromStatus: options.fromStatus,
    project: options.project,
    file: options.file,
    limit: options.limit,
    generatedAt: new Date().toISOString(),
    workerId: options.workerId,
    installationState
  });
  const summary = renderGithubWebhookServiceReviewSummary(plan);
  const artifacts = await writeGithubWebhookServiceAdminArtifacts(rootDir, {
    runId,
    artifactPrefix: "service-review",
    plan,
    receipts: [],
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan
    }, null, 2));
    return {
      runId,
      plan,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-service-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    runId,
    plan,
    artifacts
  };
}

export async function runGithubAppServiceRequeue(rootDir, config, options) {
  const runId = createRunId();
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const installationState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubWebhookServiceRequeuePlan(queueState.queue, {
    fromStatus: options.fromStatus,
    project: options.project,
    file: options.file,
    limit: options.limit,
    generatedAt: new Date().toISOString(),
    workerId: options.workerId,
    installationState
  });
  const receipts = options.apply
    ? await requeueGithubWebhookServiceQueueEntries(rootDir, queueState.queue.filter((item) => {
        return plan.releaseableEntries.some((selected) => selected.fileName === item.fileName);
      }), {
        dryRun: options.dryRun,
        force: options.force,
        notes: options.notes,
        workerId: options.workerId,
        maxServiceAttempts: options.maxServiceAttempts,
        installationState
      })
    : [];
  const summary = renderGithubWebhookServiceRequeueSummary(plan, receipts);
  const artifacts = await writeGithubWebhookServiceAdminArtifacts(rootDir, {
    runId,
    artifactPrefix: "service-requeue",
    plan,
    receipts,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts
    }, null, 2));
    return {
      runId,
      plan,
      receipts,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-service-requeue",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    runId,
    plan,
    receipts,
    artifacts
  };
}

export async function runGithubAppServiceTick(rootDir, config, options) {
  const runId = createRunId();
  const reclaimedClaims = await reclaimExpiredGithubWebhookServiceClaims(rootDir, {
    dryRun: options.dryRun,
    now: new Date().toISOString()
  });
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const installationState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubWebhookServiceTickPlan(queueState.queue, {
    limit: options.limit,
    generatedAt: new Date().toISOString(),
    workerId: options.workerId,
    installationState
  });
  const receipts = [];

  if (options.apply && !options.dryRun) {
    const claimResult = await claimGithubWebhookServiceQueueEntries(rootDir, queueState.queue.filter((item) => {
      return plan.selectedEntries.some((selected) => selected.fileName === item.fileName);
    }), {
      workerId: options.workerId,
      leaseMinutes: options.serviceLeaseMinutes,
      maxServiceAttempts: options.maxServiceAttempts
    });
    const claimedEntries = claimResult.claimed;

    if (claimResult.deadLettered.length > 0) {
      receipts.push(...claimResult.deadLettered.map((entry) => ({
        fileName: entry.fileName,
        action: "claim_contract",
        outcome: "dead_lettered_before_execution",
        workerId: options.workerId,
        targetState: "dead_letter",
        spawnedContracts: []
      })));
    }

    for (const entry of claimedEntries) {
      const selected = plan.selectedEntries.find((item) => item.fileName === entry.fileName);
      if (!entry) {
        continue;
      }

      let executionResult = null;
      let outcome = "processed";
      const spawnedContracts = [];

      try {
        if (selected.action === "run_execution") {
          executionResult = await runGithubAppExecutionRun(rootDir, config, {
            contractFile: entry.contractPath,
            apply: true,
            dryRun: false,
            allowFailureReturn: true
          });
        } else if (selected.action === "run_resume") {
          executionResult = await runGithubAppExecutionResume(rootDir, config, {
            contractFile: entry.contractPath,
            apply: true,
            dryRun: false,
            allowFailureReturn: true
          });
        } else if (selected.action === "run_recover") {
          executionResult = await runGithubAppExecutionRecover(rootDir, config, {
            contractFile: entry.contractPath,
            apply: true,
            dryRun: false,
            allowFailureReturn: true
          });
        }

        const recoveryContract = executionResult?.recoveryContract ?? null;
        const resumeContract = executionResult?.resumeContract ?? null;

        if (recoveryContract && recoveryContract.contractStatus !== "recovery_not_required") {
          const targetState = recoveryContract.contractStatus === "dispatch_ready_recovery_contract"
            ? "pending"
            : "blocked";
          const queued = await queueGithubWebhookServiceContract(rootDir, recoveryContract, {
            targetState,
            maxServiceAttempts: options.maxServiceAttempts
          });
          spawnedContracts.push({
            contractKind: recoveryContract.contractKind,
            contractStatus: recoveryContract.contractStatus,
            targetState: queued.duplicate ? "duplicate" : targetState,
            targetPath: path.relative(rootDir, queued.targetPath),
            duplicate: Boolean(queued.duplicate)
          });
        } else if (resumeContract && resumeContract.contractStatus === "dispatch_ready_resume_contract") {
          const queued = await queueGithubWebhookServiceContract(rootDir, resumeContract, {
            targetState: "pending",
            maxServiceAttempts: options.maxServiceAttempts
          });
          spawnedContracts.push({
            contractKind: resumeContract.contractKind,
            contractStatus: resumeContract.contractStatus,
            targetState: queued.duplicate ? "duplicate" : "pending",
            targetPath: path.relative(rootDir, queued.targetPath),
            duplicate: Boolean(queued.duplicate)
          });
        }
      } catch (error) {
        outcome = "execution_error";
        receipts.push({
          fileName: selected.fileName,
          action: selected.action,
          outcome,
          workerId: options.workerId,
          targetState: "blocked",
          error: error.message,
          spawnedContracts
        });
        const blockedPath = path.join(queueState.paths.blockedPath, entry.fileName);
        await fs.mkdir(queueState.paths.blockedPath, { recursive: true });
        const blockedContract = {
          ...entry.contract,
          serviceLease: null,
          serviceState: {
            ...(entry.contract.serviceState ?? {}),
            lastQueuedState: "blocked",
            lastOutcome: "execution_error"
          }
        };
        await fs.writeFile(blockedPath, `${JSON.stringify(blockedContract, null, 2)}\n`, "utf8");
        await fs.unlink(entry.contractPath);
        continue;
      }

      const processedPath = path.join(queueState.paths.processedPath, entry.fileName);
      await fs.mkdir(queueState.paths.processedPath, { recursive: true });
      const processedContract = {
        ...entry.contract,
        serviceLease: null,
        serviceState: {
          ...(entry.contract.serviceState ?? {}),
          lastQueuedState: "processed",
          lastOutcome: executionResult?.executionSummary?.finalStatus ?? "processed"
        }
      };
      await fs.writeFile(processedPath, `${JSON.stringify(processedContract, null, 2)}\n`, "utf8");
      await fs.unlink(entry.contractPath);
      receipts.push({
        fileName: selected.fileName,
        action: selected.action,
        outcome,
        workerId: options.workerId,
        targetState: "processed",
        resultStatus: executionResult?.executionSummary?.finalStatus ?? "-",
        spawnedContracts
      });
    }
  }

  if (reclaimedClaims.length > 0) {
    receipts.unshift(...reclaimedClaims.map((item) => ({
      fileName: item.fileName,
      action: "reclaim_expired_claim",
      outcome: "reclaimed",
      workerId: options.workerId,
      targetState: "pending",
      spawnedContracts: []
    })));
  }

  const summary = renderGithubWebhookServiceTickSummary(plan, receipts);
  const artifacts = await writeGithubWebhookServiceArtifacts(rootDir, {
    runId,
    plan,
    receipts,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts
    }, null, 2));
    return {
      runId,
      plan,
      receipts,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-service-tick",
    projectKey: config.defaultProject,
    mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    runId,
    plan,
    receipts,
    artifacts
  };
}
