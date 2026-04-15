import fs from "node:fs/promises";
import path from "node:path";

const RUNNER_READY_CONTRACT_STATUSES = new Set([
  "dispatch_ready",
  "dispatch_ready_dry_run",
  "dispatch_ready_contract_only",
  "dispatch_ready_resume_contract",
  "dispatch_ready_recovery_contract"
]);

const TRANSIENT_EXIT_CODES = new Set([75, 111, 124, 137, 143, 255]);
const SAFER_RETRY_EXECUTION_CLASSES = new Set([
  "diagnostic",
  "governance_probe",
  "automation_dispatch"
]);

export async function loadGithubWebhookExecutionContract(contractPath) {
  const raw = await fs.readFile(contractPath, "utf8");
  return JSON.parse(raw);
}

export function buildGithubWebhookRunnerPlan(executionContract, options = {}) {
  const apply = Boolean(options.apply);
  const dryRun = Boolean(options.dryRun);
  const force = Boolean(options.force);
  const scheduledCommands = Array.isArray(executionContract.scheduledCommands)
    ? executionContract.scheduledCommands
    : [];
  const routeReady = RUNNER_READY_CONTRACT_STATUSES.has(executionContract.contractStatus);
  const forceApproved = Boolean(executionContract.forceRequested || force);
  const hasForceGatedCommands = scheduledCommands.some((command) => command.forceRequired);

  const commands = scheduledCommands.map((command) => {
    const requiresForce = Boolean(command.forceRequired) && !forceApproved;
    const executable = routeReady && !requiresForce;
    return {
      ...command,
      runnerStatus: !routeReady
        ? "not_runnable"
        : !apply
          ? "preview_ready"
          : requiresForce
            ? "requires_force"
            : "scheduled_for_execution",
      runnerReason: !routeReady
        ? "Execution contract is not in a dispatch-ready state."
        : !apply
          ? "Runner can execute this command, but apply mode is off."
          : requiresForce
            ? "Runner still requires --force before this command may execute."
            : "Runner accepted this command for execution."
    };
  });

  const executableCommands = commands.filter((command) => command.runnerStatus === "scheduled_for_execution");
  let runnerStatus = "preview_only";
  let nextAction = "Inspect the execution contract and enable apply mode once the runner input is judged safe.";

  if (!routeReady) {
    runnerStatus = "blocked_contract";
    nextAction = executionContract.nextAction ?? "Execution contract is not dispatch-ready.";
  } else if (apply && executableCommands.length === 0 && hasForceGatedCommands && !forceApproved) {
    runnerStatus = "blocked_force_gate";
    nextAction = "The execution contract is ready, but the runner still requires --force for one or more commands.";
  } else if (apply && dryRun) {
    runnerStatus = "ready_dry_run";
    nextAction = "Dry-run kept the runner from executing; inspect the runner plan before a real apply run.";
  } else if (apply && executableCommands.length > 0) {
    runnerStatus = "ready_to_execute";
    nextAction = "Execute the scheduled runner commands in order and inspect any later failures before retrying.";
  } else if (apply) {
    runnerStatus = "nothing_executable";
    nextAction = "No command is currently executable from this contract.";
  }

  return {
    schemaVersion: 1,
    contractKind: executionContract.contractKind ?? "execution_contract",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    eventKey: executionContract.eventKey ?? null,
    deliveryId: executionContract.deliveryId ?? null,
    repository: executionContract.repository ?? null,
    selectedProjectKey: executionContract.selectedProjectKey ?? null,
    contractStatus: executionContract.contractStatus ?? "unknown",
    attemptNumber: Number(executionContract.attemptNumber ?? 1),
    maxAttempts: Number(executionContract.maxAttempts ?? 3),
    apply,
    dryRun,
    force,
    forceApproved,
    runnerStatus,
    commands,
    executableCommands,
    nextAction
  };
}

export async function executeGithubWebhookRunnerPlan(runnerPlan, options = {}) {
  const runShellCommand = options.runShellCommand;
  if (!runShellCommand) {
    throw new Error("executeGithubWebhookRunnerPlan requires runShellCommand.");
  }

  const results = [];
  for (const command of runnerPlan.executableCommands ?? []) {
    const execution = await runShellCommand(command.shellCommand, {
      cwd: options.cwd,
      env: options.env,
      stdio: options.stdio ?? "inherit"
    });
    results.push({
      commandName: command.commandName,
      shellCommand: command.shellCommand,
      exitCode: execution.code,
      signal: execution.signal ?? null
    });
    if (execution.code !== 0) {
      break;
    }
  }
  return results;
}

export function summarizeGithubWebhookRunnerExecution(runnerPlan, executionResults = [], options = {}) {
  const scheduledCount = Array.isArray(runnerPlan.executableCommands)
    ? runnerPlan.executableCommands.length
    : 0;
  const attemptedCount = executionResults.length;
  const failedResults = executionResults.filter((item) => Number(item.exitCode ?? 1) !== 0);
  const failedCount = failedResults.length;
  const succeededCount = executionResults.filter((item) => Number(item.exitCode ?? 1) === 0).length;
  const firstFailure = failedResults[0] ?? null;

  if (runnerPlan.runnerStatus !== "ready_to_execute") {
    return {
      scheduledCount,
      attemptedCount,
      succeededCount,
      failedCount,
      haltedEarly: false,
      firstFailure,
      finalStatus: runnerPlan.runnerStatus === "ready_dry_run" ? "dry_run_not_executed" : "not_executed",
      nextAction: runnerPlan.nextAction
    };
  }

  if (options.dryRun) {
    return {
      scheduledCount,
      attemptedCount,
      succeededCount,
      failedCount,
      haltedEarly: false,
      firstFailure,
      finalStatus: "dry_run_not_executed",
      nextAction: "Dry-run kept the runner from executing; inspect the contract and runner plan before applying for real."
    };
  }

  if (failedCount > 0) {
    return {
      scheduledCount,
      attemptedCount,
      succeededCount,
      failedCount,
      haltedEarly: attemptedCount < scheduledCount,
      firstFailure,
      finalStatus: "execution_failed",
      nextAction: `Inspect the failing runner command '${firstFailure.commandName}' before retrying the contract.`
    };
  }

  if (attemptedCount === 0) {
    return {
      scheduledCount,
      attemptedCount,
      succeededCount,
      failedCount,
      haltedEarly: false,
      firstFailure,
      finalStatus: "execution_not_started",
      nextAction: "Runner apply was requested, but no command actually ran; inspect the contract and local runtime."
    };
  }

  if (attemptedCount < scheduledCount) {
    return {
      scheduledCount,
      attemptedCount,
      succeededCount,
      failedCount,
      haltedEarly: true,
      firstFailure,
      finalStatus: "execution_incomplete",
      nextAction: "Runner execution halted before all commands ran; inspect the runtime before continuing."
    };
  }

  return {
    scheduledCount,
    attemptedCount,
    succeededCount,
    failedCount,
    haltedEarly: false,
    firstFailure,
    finalStatus: "execution_succeeded",
    nextAction: "Runner completed all scheduled commands successfully."
  };
}

export function buildGithubWebhookRunnerState({
  executionContract,
  runnerPlan,
  executionResults = [],
  executionSummary
}) {
  const commands = Array.isArray(runnerPlan.commands) ? runnerPlan.commands : [];
  const attemptedNames = new Set(executionResults.map((item) => item.commandName));
  const successfulNames = new Set(
    executionResults
      .filter((item) => Number(item.exitCode ?? 1) === 0)
      .map((item) => item.commandName)
  );
  const failedResult = executionResults.find((item) => Number(item.exitCode ?? 1) !== 0) ?? null;
  const commandsByName = new Map(commands.map((command) => [command.commandName, command]));
  const failedCommand = failedResult ? commandsByName.get(failedResult.commandName) ?? null : null;

  let remainingCommands = [];
  if (failedCommand) {
    const failedIndex = commands.findIndex((command) => command.commandName === failedCommand.commandName);
    remainingCommands = failedIndex >= 0 ? commands.slice(failedIndex) : [];
  } else {
    remainingCommands = commands.filter((command) => !attemptedNames.has(command.commandName));
  }

  const completedCommands = commands.filter((command) => successfulNames.has(command.commandName));
  const resumeReady = remainingCommands.length > 0 && (
    executionSummary.finalStatus === "execution_failed" ||
    executionSummary.finalStatus === "execution_incomplete" ||
    executionSummary.finalStatus === "execution_not_started"
  );

  return {
    schemaVersion: 1,
    generatedAt: runnerPlan.generatedAt,
    eventKey: runnerPlan.eventKey ?? executionContract.eventKey ?? null,
    deliveryId: runnerPlan.deliveryId ?? executionContract.deliveryId ?? null,
    repository: runnerPlan.repository ?? executionContract.repository ?? null,
    selectedProjectKey: runnerPlan.selectedProjectKey ?? executionContract.selectedProjectKey ?? null,
    contractStatus: executionContract.contractStatus ?? null,
    attemptNumber: Number(executionContract.attemptNumber ?? runnerPlan.attemptNumber ?? 1),
    maxAttempts: Number(executionContract.maxAttempts ?? runnerPlan.maxAttempts ?? 3),
    runnerStatus: runnerPlan.runnerStatus,
    executionStatus: executionSummary.finalStatus,
    completedCommands,
    failedCommand,
    failedExecution: failedResult
      ? {
          commandName: failedResult.commandName,
          shellCommand: failedResult.shellCommand,
          exitCode: Number(failedResult.exitCode ?? 1),
          signal: failedResult.signal ?? null
        }
      : null,
    remainingCommands,
    resumeReady,
    nextAction: resumeReady
      ? "Use the generated resume contract to continue from the failed or pending command boundary."
      : executionSummary.nextAction
  };
}

export function buildGithubWebhookRecoveryAssessment({
  executionContract,
  runnerPlan,
  runnerState,
  executionSummary
}) {
  const currentAttempt = Number(runnerState.attemptNumber ?? executionContract.attemptNumber ?? runnerPlan.attemptNumber ?? 1);
  const maxAttempts = Number(runnerState.maxAttempts ?? executionContract.maxAttempts ?? runnerPlan.maxAttempts ?? 3);
  const remainingAttempts = Math.max(maxAttempts - currentAttempt, 0);
  const nextAttemptNumber = currentAttempt + 1;
  const finalStatus = executionSummary.finalStatus;
  const failedExecution = runnerState.failedExecution ?? null;
  const failedCommand = runnerState.failedCommand ?? null;
  const exitCode = Number(failedExecution?.exitCode ?? 1);
  const signal = failedExecution?.signal ?? null;
  const executionClass = failedCommand?.executionClass ?? null;

  let retryClass = "not_required";
  let retryable = false;
  let backoffSeconds = 0;
  let recoveryStatus = "recovery_not_required";
  let nextAction = executionSummary.nextAction;

  if (!runnerState.resumeReady) {
    return {
      schemaVersion: 1,
      generatedAt: runnerState.generatedAt ?? runnerPlan.generatedAt ?? new Date().toISOString(),
      currentAttempt,
      nextAttemptNumber,
      maxAttempts,
      remainingAttempts,
      retryClass,
      retryable,
      backoffSeconds,
      nextEligibleAt: null,
      recoveryStatus,
      nextAction
    };
  }

  if (currentAttempt >= maxAttempts) {
    return {
      schemaVersion: 1,
      generatedAt: runnerState.generatedAt ?? runnerPlan.generatedAt ?? new Date().toISOString(),
      currentAttempt,
      nextAttemptNumber,
      maxAttempts,
      remainingAttempts,
      retryClass: "attempts_exhausted",
      retryable: false,
      backoffSeconds: 0,
      nextEligibleAt: null,
      recoveryStatus: "recovery_exhausted",
      nextAction: `Recovery attempts are exhausted after ${currentAttempt} tries; inspect the runner state manually before trying again.`
    };
  }

  if (finalStatus === "execution_not_started") {
    retryClass = "runtime_start_failure";
    retryable = true;
    backoffSeconds = 60;
  } else if (finalStatus === "execution_incomplete") {
    retryClass = "partial_runtime_interruption";
    retryable = true;
    backoffSeconds = 120;
  } else if (finalStatus === "execution_failed") {
    if (signal || TRANSIENT_EXIT_CODES.has(exitCode)) {
      retryClass = "transient_runtime_failure";
      retryable = true;
      backoffSeconds = 300;
    } else if (SAFER_RETRY_EXECUTION_CLASSES.has(executionClass)) {
      retryClass = "retryable_command_failure";
      retryable = true;
      backoffSeconds = 180;
    } else {
      retryClass = "manual_command_review";
      retryable = false;
      backoffSeconds = 0;
    }
  } else {
    retryClass = "manual_review";
    retryable = false;
  }

  if (!retryable) {
    recoveryStatus = "manual_recovery_review";
    nextAction = failedCommand?.commandName
      ? `Review the failing command '${failedCommand.commandName}' manually before allowing another recovery attempt.`
      : "Review the interrupted runner manually before allowing another recovery attempt.";
  } else if (backoffSeconds > 0) {
    recoveryStatus = "recovery_backoff_pending";
    nextAction = `Wait for the recovery backoff window to pass, then continue via github-app-execution-recover.`;
  } else {
    recoveryStatus = "dispatch_ready_recovery_contract";
    nextAction = "Recovery can continue immediately via github-app-execution-recover.";
  }

  const generatedAt = runnerState.generatedAt ?? runnerPlan.generatedAt ?? new Date().toISOString();
  const nextEligibleAt = backoffSeconds > 0
    ? new Date(new Date(generatedAt).getTime() + (backoffSeconds * 1000)).toISOString()
    : null;

  return {
    schemaVersion: 1,
    generatedAt,
    currentAttempt,
    nextAttemptNumber,
    maxAttempts,
    remainingAttempts,
    retryClass,
    retryable,
    backoffSeconds,
    nextEligibleAt,
    recoveryStatus,
    nextAction
  };
}

export function evaluateGithubWebhookRecoveryContract(recoveryContract, options = {}) {
  const now = options.now ? new Date(options.now) : new Date();
  const nextEligibleAt = recoveryContract.recoveryAssessment?.nextEligibleAt
    ? new Date(recoveryContract.recoveryAssessment.nextEligibleAt)
    : null;
  const baseStatus = recoveryContract.contractStatus ?? "unknown";

  if (baseStatus !== "recovery_backoff_pending") {
    return {
      effectiveStatus: baseStatus,
      backoffElapsed: false,
      blockedUntil: nextEligibleAt ? nextEligibleAt.toISOString() : null,
      nextAction: recoveryContract.nextAction ?? "Inspect the recovery contract."
    };
  }

  if (nextEligibleAt && now >= nextEligibleAt) {
    return {
      effectiveStatus: "dispatch_ready_recovery_contract",
      backoffElapsed: true,
      blockedUntil: nextEligibleAt.toISOString(),
      nextAction: "Recovery backoff elapsed; the recovery contract may now be executed."
    };
  }

  return {
    effectiveStatus: "recovery_backoff_pending",
    backoffElapsed: false,
    blockedUntil: nextEligibleAt ? nextEligibleAt.toISOString() : null,
    nextAction: recoveryContract.nextAction ?? "Recovery is still waiting for its backoff window."
  };
}

export function buildGithubWebhookResumeContract({
  executionContract,
  runnerPlan,
  runnerState
}) {
  const remainingCommands = Array.isArray(runnerState.remainingCommands)
    ? runnerState.remainingCommands
    : [];
  const resumeReady = Boolean(runnerState.resumeReady) && remainingCommands.length > 0;

  return {
    schemaVersion: 1,
    contractKind: "resume_contract",
    generatedAt: runnerState.generatedAt ?? runnerPlan.generatedAt ?? new Date().toISOString(),
    deliveryId: runnerState.deliveryId ?? executionContract.deliveryId ?? null,
    eventKey: runnerState.eventKey ?? executionContract.eventKey ?? null,
    repository: runnerState.repository ?? executionContract.repository ?? null,
    selectedProjectKey: runnerState.selectedProjectKey ?? executionContract.selectedProjectKey ?? null,
    routeStatus: executionContract.routeStatus ?? null,
    dispatchStatus: executionContract.dispatchStatus ?? null,
    attemptNumber: Number(runnerState.attemptNumber ?? executionContract.attemptNumber ?? 1) + 1,
    maxAttempts: Number(runnerState.maxAttempts ?? executionContract.maxAttempts ?? 3),
    contractStatus: resumeReady ? "dispatch_ready_resume_contract" : "resume_not_required",
    runnerMode: resumeReady ? "external_runner_resume" : "manual_review",
    applyRequested: true,
    forceRequested: Boolean(executionContract.forceRequested),
    dryRun: false,
    contractOnly: false,
    resumeFromCommand: runnerState.failedCommand?.commandName ?? remainingCommands[0]?.commandName ?? null,
    previousExecutionStatus: runnerState.executionStatus,
    scheduledCommands: remainingCommands.map((command, index) => ({
      order: index + 1,
      commandName: command.commandName,
      executionClass: command.executionClass,
      shellCommand: command.shellCommand,
      forceRequired: Boolean(command.forceRequired),
      cwd: command.cwd ?? "."
    })),
    executionSummary: {
      finalStatus: runnerState.executionStatus,
      nextAction: runnerState.nextAction
    },
    nextAction: resumeReady
      ? "Resume execution from the remaining command boundary with github-app-execution-run."
      : "No resume contract is needed because the runner did not leave resumable work behind."
  };
}

export function buildGithubWebhookRecoveryContract({
  executionContract,
  runnerPlan,
  runnerState,
  recoveryAssessment
}) {
  const remainingCommands = Array.isArray(runnerState.remainingCommands)
    ? runnerState.remainingCommands
    : [];

  return {
    schemaVersion: 1,
    contractKind: "recovery_contract",
    generatedAt: recoveryAssessment.generatedAt ?? runnerState.generatedAt ?? runnerPlan.generatedAt ?? new Date().toISOString(),
    deliveryId: runnerState.deliveryId ?? executionContract.deliveryId ?? null,
    eventKey: runnerState.eventKey ?? executionContract.eventKey ?? null,
    repository: runnerState.repository ?? executionContract.repository ?? null,
    selectedProjectKey: runnerState.selectedProjectKey ?? executionContract.selectedProjectKey ?? null,
    routeStatus: executionContract.routeStatus ?? null,
    dispatchStatus: executionContract.dispatchStatus ?? null,
    contractStatus: recoveryAssessment.recoveryStatus,
    runnerMode: recoveryAssessment.recoveryStatus === "dispatch_ready_recovery_contract"
      ? "external_runner_recovery"
      : "manual_review",
    attemptNumber: recoveryAssessment.nextAttemptNumber,
    previousAttemptNumber: recoveryAssessment.currentAttempt,
    maxAttempts: recoveryAssessment.maxAttempts,
    applyRequested: true,
    forceRequested: Boolean(executionContract.forceRequested),
    dryRun: false,
    contractOnly: false,
    resumeFromCommand: runnerState.failedCommand?.commandName ?? remainingCommands[0]?.commandName ?? null,
    previousExecutionStatus: runnerState.executionStatus,
    recoveryAssessment,
    scheduledCommands: remainingCommands.map((command, index) => ({
      order: index + 1,
      commandName: command.commandName,
      executionClass: command.executionClass,
      shellCommand: command.shellCommand,
      forceRequired: Boolean(command.forceRequired),
      cwd: command.cwd ?? "."
    })),
    executionSummary: {
      finalStatus: runnerState.executionStatus,
      nextAction: runnerState.nextAction
    },
    nextAction: recoveryAssessment.nextAction
  };
}

export function renderGithubWebhookRunnerSummary({
  executionContract,
  runnerPlan,
  executionResults = [],
  executionSummary = null,
  runnerState = null,
  resumeContract = null,
  recoveryAssessment = null,
  recoveryContract = null
}) {
  const resolvedSummary = executionSummary ?? summarizeGithubWebhookRunnerExecution(runnerPlan, executionResults);
  const commandLines = (runnerPlan.commands ?? []).length > 0
    ? runnerPlan.commands.map((command) => `- ${command.commandName}: ${command.runnerStatus} | class=${command.executionClass ?? "-"} | force_required=${command.forceRequired ? "yes" : "no"} | shell=${command.shellCommand}`).join("\n")
    : "- none";
  const executionLines = executionResults.length > 0
    ? executionResults.map((item) => `- ${item.commandName}: exit_code=${item.exitCode} | signal=${item.signal ?? "-"} | shell=${item.shellCommand}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub Webhook Runner

- generated_at: ${runnerPlan.generatedAt}
- delivery_id: ${runnerPlan.deliveryId ?? "-"}
- event_key: ${runnerPlan.eventKey ?? "-"}
- repository: ${runnerPlan.repository ?? "-"}
- project: ${runnerPlan.selectedProjectKey ?? "-"}
- contract_kind: ${executionContract.contractKind ?? "-"}
- contract_status: ${executionContract.contractStatus ?? "-"}
- attempt_number: ${runnerPlan.attemptNumber ?? "-"}
- max_attempts: ${runnerPlan.maxAttempts ?? "-"}
- runner_status: ${runnerPlan.runnerStatus}
- apply: ${runnerPlan.apply ? "yes" : "no"}
- dry_run: ${runnerPlan.dryRun ? "yes" : "no"}
- force: ${runnerPlan.force ? "yes" : "no"}
- force_approved: ${runnerPlan.forceApproved ? "yes" : "no"}
- execution_status: ${resolvedSummary.finalStatus}
- scheduled_commands: ${resolvedSummary.scheduledCount}
- attempted_commands: ${resolvedSummary.attemptedCount}
- succeeded_commands: ${resolvedSummary.succeededCount}
- failed_commands: ${resolvedSummary.failedCount}
- resume_ready: ${runnerState?.resumeReady ? "yes" : "no"}
- resume_contract_status: ${resumeContract?.contractStatus ?? "-"}
- recovery_status: ${recoveryAssessment?.recoveryStatus ?? "-"}
- recovery_retry_class: ${recoveryAssessment?.retryClass ?? "-"}
- recovery_attempts_remaining: ${recoveryAssessment?.remainingAttempts ?? "-"}
- recovery_contract_status: ${recoveryContract?.contractStatus ?? "-"}

## Runner Commands

${commandLines}

## Execution Results

${executionLines}

## Next Action

- ${resolvedSummary.nextAction}
`;
}

export async function writeGithubWebhookRunnerArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-runner", options.runId);
  const contractPath = path.join(integrationRoot, "execution-contract.json");
  const runnerPlanPath = path.join(integrationRoot, "runner-plan.json");
  const executionPath = path.join(integrationRoot, "execution-results.json");
  const executionSummaryPath = path.join(integrationRoot, "execution-summary.json");
  const runnerStatePath = path.join(integrationRoot, "runner-state.json");
  const resumeContractPath = path.join(integrationRoot, "resume-contract.json");
  const recoveryAssessmentPath = path.join(integrationRoot, "recovery-assessment.json");
  const recoveryContractPath = path.join(integrationRoot, "recovery-contract.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      contractPath,
      runnerPlanPath,
      executionPath,
      executionSummaryPath,
      runnerStatePath,
      resumeContractPath,
      recoveryAssessmentPath,
      recoveryContractPath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(contractPath, `${JSON.stringify(options.executionContract, null, 2)}\n`, "utf8");
  await fs.writeFile(runnerPlanPath, `${JSON.stringify(options.runnerPlan, null, 2)}\n`, "utf8");
  await fs.writeFile(executionPath, `${JSON.stringify(options.executionResults ?? [], null, 2)}\n`, "utf8");
  await fs.writeFile(executionSummaryPath, `${JSON.stringify(options.executionSummary ?? summarizeGithubWebhookRunnerExecution(options.runnerPlan, options.executionResults), null, 2)}\n`, "utf8");
  await fs.writeFile(runnerStatePath, `${JSON.stringify(options.runnerState, null, 2)}\n`, "utf8");
  await fs.writeFile(resumeContractPath, `${JSON.stringify(options.resumeContract, null, 2)}\n`, "utf8");
  await fs.writeFile(recoveryAssessmentPath, `${JSON.stringify(options.recoveryAssessment, null, 2)}\n`, "utf8");
  await fs.writeFile(recoveryContractPath, `${JSON.stringify(options.recoveryContract, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    contractPath,
    runnerPlanPath,
    executionPath,
    executionSummaryPath,
    runnerStatePath,
    resumeContractPath,
    recoveryAssessmentPath,
    recoveryContractPath,
    summaryPath
  };
}
