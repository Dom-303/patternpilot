import fs from "node:fs/promises";
import path from "node:path";

const EXECUTABLE_ROUTE_STATUSES = new Set([
  "dispatchable",
  "limited_dispatchable",
  "governance_review"
]);

const EXECUTABLE_COMMAND_STATUSES = new Set([
  "ready"
]);

const FORCE_GATED_COMMANDS = new Set([
  "on-demand",
  "automation-dispatch",
  "init-project",
  "discover-workspace",
  "policy-curation-apply",
  "policy-curation-batch-apply",
  "promote"
]);

const SAFE_EXECUTION_CLASSES = new Set([
  "diagnostic",
  "governance_probe"
]);

export function classifyGithubWebhookCommand(commandName) {
  switch (commandName) {
    case "run-drift":
    case "show-project":
    case "setup-checklist":
    case "doctor":
      return "diagnostic";
    case "run-governance":
      return "governance_probe";
    case "on-demand":
      return "analysis_run";
    case "automation-dispatch":
      return "automation_dispatch";
    case "init-project":
      return "setup_mutation";
    case "discover-workspace":
      return "workspace_scan";
    case "policy-curation-apply":
    case "policy-curation-batch-apply":
    case "promote":
      return "curation_apply";
    default:
      return "unknown";
  }
}

export function buildGithubWebhookDispatchPlan(routePlan, options = {}) {
  const apply = Boolean(options.apply);
  const force = Boolean(options.force);
  const routeAllowsExecution = EXECUTABLE_ROUTE_STATUSES.has(routePlan.routeStatus);
  const commands = (routePlan.commands ?? []).map((command) => {
    const executionClass = classifyGithubWebhookCommand(command.commandName);
    const executable = routeAllowsExecution && EXECUTABLE_COMMAND_STATUSES.has(command.status);
    const forceRequired = executable && !SAFE_EXECUTION_CLASSES.has(executionClass) && (
      FORCE_GATED_COMMANDS.has(command.commandName) || executionClass === "unknown"
    );
    const scheduled = apply && executable && (!forceRequired || force);
    return {
      ...command,
      executionClass,
      forceRequired,
      dispatchStatus: !executable
        ? "not_dispatchable"
        : !apply
          ? "preview_ready"
          : scheduled
            ? "scheduled_for_execution"
            : "requires_force",
      dispatchReason: !executable
        ? command.reason ?? "Command stays behind a manual or guarded gate."
        : !apply
          ? "Command is executable under the current route, but apply mode is off."
          : scheduled
            ? forceRequired
              ? "Command passed the force gate and will be executed."
              : "Command is executable under the current route and will be executed."
            : "Command is executable but requires --force before it may run."
    };
  });

  const executableCommands = commands.filter((item) => item.dispatchStatus === "scheduled_for_execution");
  const forceGatedCommands = commands.filter((item) => item.dispatchStatus === "requires_force");
  let dispatchStatus = "preview_only";
  let nextAction = "Inspect the proposed commands and enable apply mode once the route is judged safe.";

  if (!routeAllowsExecution) {
    dispatchStatus = "blocked_route";
    nextAction = routePlan.nextAction;
  } else if (apply && executableCommands.length === 0 && forceGatedCommands.length > 0) {
    dispatchStatus = "blocked_force_gate";
    nextAction = "The route is executable, but the pending commands require --force before local execution is allowed.";
  } else if (apply && executableCommands.length === 0) {
    dispatchStatus = "nothing_executable";
    nextAction = "No command is currently executable; inspect the guarded/manual steps first.";
  } else if (apply && executableCommands.length > 0) {
    dispatchStatus = "ready_to_execute";
    nextAction = forceGatedCommands.length > 0
      ? "Execute the scheduled commands in order; the remaining force-gated commands still need an explicit --force pass."
      : "Execute the scheduled commands in order and keep the guarded/manual ones untouched.";
  }

  return {
    schemaVersion: 1,
    generatedAt: routePlan.generatedAt,
    eventKey: routePlan.eventKey,
    routeStatus: routePlan.routeStatus,
    gate: routePlan.gate,
    apply,
    force,
    dispatchStatus,
    commands,
    executableCommands,
    forceGatedCommands,
    nextAction
  };
}

export function renderGithubWebhookDispatchSummary({
  envelope,
  routePlan,
  dispatchPlan,
  executionResults = [],
  executionSummary = null,
  executionContract = null
}) {
  const resolvedExecutionSummary = executionSummary ?? summarizeGithubWebhookExecution(dispatchPlan, executionResults);
  const commands = Array.isArray(dispatchPlan.commands) ? dispatchPlan.commands : [];
  const commandLines = commands.length > 0
    ? commands.map((item) => `- ${item.commandName}: ${item.dispatchStatus} | status=${item.status} | class=${item.executionClass ?? "-"} | force_required=${item.forceRequired ? "yes" : "no"}${item.dispatchReason ? ` | reason=${item.dispatchReason}` : ""} | shell=${item.shellCommand}`).join("\n")
    : "- none";
  const executionLines = executionResults.length > 0
    ? executionResults.map((item) => `- ${item.commandName}: exit_code=${item.exitCode} | signal=${item.signal ?? "-"} | shell=${item.shellCommand}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub Webhook Dispatch

- generated_at: ${dispatchPlan.generatedAt}
- delivery_id: ${envelope.deliveryId ?? "-"}
- event_key: ${dispatchPlan.eventKey ?? "-"}
- repository: ${envelope.repository.fullName ?? "-"}
- route_status: ${routePlan.routeStatus}
- dispatch_status: ${dispatchPlan.dispatchStatus}
- apply: ${dispatchPlan.apply ? "yes" : "no"}
- force: ${dispatchPlan.force ? "yes" : "no"}
- execution_status: ${resolvedExecutionSummary.finalStatus}
- scheduled_commands: ${resolvedExecutionSummary.scheduledCount}
- attempted_commands: ${resolvedExecutionSummary.attemptedCount}
- succeeded_commands: ${resolvedExecutionSummary.succeededCount}
- failed_commands: ${resolvedExecutionSummary.failedCount}
- execution_contract_status: ${executionContract?.contractStatus ?? "-"}
- runner_mode: ${executionContract?.runnerMode ?? "-"}

## Command Decisions

${commandLines}

## Execution Results

${executionLines}

## Next Action

- ${resolvedExecutionSummary.nextAction}
`;
}

export function summarizeGithubWebhookExecution(dispatchPlan, executionResults = [], options = {}) {
  const scheduledCount = Array.isArray(dispatchPlan.executableCommands)
    ? dispatchPlan.executableCommands.length
    : 0;
  const attemptedCount = executionResults.length;
  const failedResults = executionResults.filter((item) => Number(item.exitCode ?? 1) !== 0);
  const failedCount = failedResults.length;
  const succeededCount = executionResults.filter((item) => Number(item.exitCode ?? 1) === 0).length;
  const firstFailure = failedResults[0] ?? null;

  if (dispatchPlan.dispatchStatus !== "ready_to_execute") {
    return {
      scheduledCount,
      attemptedCount,
      succeededCount,
      failedCount,
      haltedEarly: false,
      firstFailure,
      finalStatus: "not_executed",
      nextAction: dispatchPlan.nextAction
    };
  }

  if (options.contractOnly) {
    return {
      scheduledCount,
      attemptedCount,
      succeededCount,
      failedCount,
      haltedEarly: false,
      firstFailure,
      finalStatus: "contract_emitted",
      nextAction: "Execution was deferred; hand the execution contract to a runner before allowing a real apply run."
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
      nextAction: "Dry-run kept execution disabled; inspect the execution contract before allowing a real apply run."
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
      nextAction: `Inspect the failing command '${firstFailure.commandName}' before re-running the webhook dispatch apply step.`
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
      nextAction: "Execution was requested, but no command actually ran; inspect the dispatch plan and local runtime."
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
      nextAction: "Some commands did not run even though execution started; inspect the local runtime before continuing."
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
    nextAction: "The scheduled webhook dispatch commands completed successfully."
  };
}

export function buildGithubWebhookExecutionContract({
  envelope,
  routePlan,
  dispatchPlan,
  executionSummary
}, options = {}) {
  const dryRun = Boolean(options.dryRun);
  const contractOnly = Boolean(options.contractOnly);
  const attemptNumber = Number.isFinite(options.attemptNumber) ? Number(options.attemptNumber) : 1;
  const maxAttempts = Number.isFinite(options.maxAttempts) ? Number(options.maxAttempts) : 3;
  const projectSelection = routePlan.projectSelection ?? {};
  const selectedProjectKey = projectSelection.selectedProjectKey
    ?? projectSelection.projectKey
    ?? projectSelection.preferredProjectKey
    ?? null;
  const scheduledCommands = Array.isArray(dispatchPlan.executableCommands)
    ? dispatchPlan.executableCommands.map((command, index) => ({
      order: index + 1,
      commandName: command.commandName,
      executionClass: command.executionClass ?? classifyGithubWebhookCommand(command.commandName),
      shellCommand: command.shellCommand,
      forceRequired: Boolean(command.forceRequired),
      cwd: options.cwd ?? "."
    }))
    : [];

  let contractStatus = "preview_only";
  let runnerMode = "preview_contract";

  if (dispatchPlan.dispatchStatus === "blocked_force_gate") {
    contractStatus = "blocked_force_gate";
    runnerMode = "manual_review";
  } else if (dispatchPlan.dispatchStatus === "blocked_route" || dispatchPlan.dispatchStatus === "nothing_executable") {
    contractStatus = "not_dispatchable";
    runnerMode = "manual_review";
  } else if (dispatchPlan.dispatchStatus === "ready_to_execute" && contractOnly) {
    contractStatus = "dispatch_ready_contract_only";
    runnerMode = "external_runner";
  } else if (dispatchPlan.dispatchStatus === "ready_to_execute" && dryRun) {
    contractStatus = "dispatch_ready_dry_run";
    runnerMode = "dry_run_contract";
  } else if (dispatchPlan.dispatchStatus === "ready_to_execute") {
    contractStatus = executionSummary.finalStatus === "execution_succeeded"
      ? "executed"
      : executionSummary.finalStatus === "execution_failed"
        ? "executed_with_failure"
        : "dispatch_ready";
    runnerMode = "local_apply";
  }

  return {
    schemaVersion: 1,
    generatedAt: dispatchPlan.generatedAt,
    deliveryId: envelope.deliveryId ?? null,
    eventKey: dispatchPlan.eventKey,
    repository: envelope.repository.fullName ?? null,
    installationId: envelope.installation?.id ?? null,
    installationAccountLogin: envelope.installation?.accountLogin ?? null,
    selectedProjectKey,
    routeStatus: routePlan.routeStatus,
    dispatchStatus: dispatchPlan.dispatchStatus,
    contractStatus,
    runnerMode,
    attemptNumber,
    maxAttempts,
    applyRequested: Boolean(dispatchPlan.apply),
    forceRequested: Boolean(dispatchPlan.force),
    dryRun,
    contractOnly,
    scheduledCommands,
    executionSummary,
    nextAction: executionSummary.nextAction
  };
}

export async function executeGithubWebhookDispatchPlan(dispatchPlan, options = {}) {
  const runShellCommand = options.runShellCommand;
  if (!runShellCommand) {
    throw new Error("executeGithubWebhookDispatchPlan requires runShellCommand.");
  }

  const results = [];
  for (const command of dispatchPlan.executableCommands ?? []) {
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

export async function writeGithubWebhookDispatchArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-dispatch", options.runId);
  const envelopePath = path.join(integrationRoot, "envelope.json");
  const routePath = path.join(integrationRoot, "route-plan.json");
  const dispatchPath = path.join(integrationRoot, "dispatch-plan.json");
  const executionContractPath = path.join(integrationRoot, "execution-contract.json");
  const executionPath = path.join(integrationRoot, "execution-results.json");
  const executionSummaryPath = path.join(integrationRoot, "execution-summary.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      envelopePath,
      routePath,
      dispatchPath,
      executionContractPath,
      executionPath,
      executionSummaryPath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(envelopePath, `${JSON.stringify(options.envelope, null, 2)}\n`, "utf8");
  await fs.writeFile(routePath, `${JSON.stringify(options.routePlan, null, 2)}\n`, "utf8");
  await fs.writeFile(dispatchPath, `${JSON.stringify(options.dispatchPlan, null, 2)}\n`, "utf8");
  await fs.writeFile(executionContractPath, `${JSON.stringify(options.executionContract, null, 2)}\n`, "utf8");
  await fs.writeFile(executionPath, `${JSON.stringify(options.executionResults ?? [], null, 2)}\n`, "utf8");
  await fs.writeFile(executionSummaryPath, `${JSON.stringify(options.executionSummary ?? summarizeGithubWebhookExecution(options.dispatchPlan, options.executionResults), null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    envelopePath,
    routePath,
    dispatchPath,
    executionContractPath,
    executionPath,
    executionSummaryPath,
    summaryPath
  };
}
