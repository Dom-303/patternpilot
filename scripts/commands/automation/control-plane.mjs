import path from "node:path";
import {
  clearAutomationJobState,
  deliverAutomationAlertPayload,
  evaluateAutomationJobs,
  loadAutomationJobs,
  loadAutomationJobState,
  renderAutomationAlertDeliverySummary,
  renderAutomationAlertSummary,
  renderAutomationJobsSummary,
  resolveAutomationDispatchJob,
  runShellCommand,
  selectNextDispatchableAutomationJob,
  updateAutomationJobState,
  writeAutomationJobState
} from "../../../lib/index.mjs";
import {
  enrichAutomationEvaluationsWithGovernance,
  writeAlertArtifacts
} from "./shared.mjs";

export async function runAutomationJobs(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { jobsPath, jobs } = await loadAutomationJobs(rootDir, config);
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      jobsPath: path.relative(rootDir, jobsPath),
      statePath: path.relative(rootDir, statePath),
      evaluations
    }, null, 2));
    return {
      generatedAt,
      evaluations
    };
  }

  const summary = renderAutomationJobsSummary({
    generatedAt,
    evaluations
  });
  console.log(summary);
  console.log(`- jobs_file: ${path.relative(rootDir, jobsPath)}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);

  return {
    generatedAt,
    evaluations
  };
}

export async function runAutomationAlertDeliver(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const { jobs } = await loadAutomationJobs(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);
  const alertArtifacts = await writeAlertArtifacts(rootDir, config, generatedAt, evaluations, options.dryRun);
  const delivery = await deliverAutomationAlertPayload(rootDir, config, alertArtifacts.payload, {
    target: options.target,
    file: options.file,
    targetCommand: options.targetCommand,
    targetHook: options.targetHook,
    targetCwd: options.targetCwd,
    payloadFile: options.payloadFile,
    hookMarkdownFile: options.hookMarkdownFile,
    hookJsonFile: options.hookJsonFile,
    hookPrint: options.hookPrint,
    dryRun: options.dryRun
  });
  const summary = renderAutomationAlertDeliverySummary({
    generatedAt,
    deliveries: delivery.deliveries
  });

  console.log(summary);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- source_alerts_json: ${path.relative(rootDir, alertArtifacts.paths.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- source_alerts_markdown: ${path.relative(rootDir, alertArtifacts.paths.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  return {
    generatedAt,
    delivery,
    alerts: alertArtifacts.alerts,
    nextJob: alertArtifacts.nextJob
  };
}

export async function runAutomationDispatch(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { jobsPath, jobs } = await loadAutomationJobs(rootDir, config);
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);
  let selection = resolveAutomationDispatchJob(evaluations, options.automationJob);
  if (!options.automationJob && selection.job?.liveGovernance?.autoDispatchAllowed === false) {
    const nextDispatchableJob = selectNextDispatchableAutomationJob(evaluations);
    if (nextDispatchableJob) {
      selection = {
        status: "selected",
        reason: `Selected next dispatchable job '${nextDispatchableJob.name}'.`,
        job: nextDispatchableJob
      };
    }
  }
  if (selection.job?.liveGovernance?.autoDispatchAllowed === false) {
    selection = {
      status: "governance_blocked",
      reason: selection.job.liveGovernance.nextAction ?? `${selection.job.name} currently requires a manual governance gate.`,
      job: selection.job
    };
  }
  const alertArtifacts = await writeAlertArtifacts(rootDir, config, generatedAt, evaluations, options.dryRun);

  console.log(`# Patternpilot Automation Dispatch`);
  console.log(``);
  console.log(`- generated_at: ${generatedAt}`);
  console.log(`- jobs_file: ${path.relative(rootDir, jobsPath)}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- alerts_json: ${path.relative(rootDir, alertArtifacts.paths.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- alerts_markdown: ${path.relative(rootDir, alertArtifacts.paths.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- selection_status: ${selection.status}`);
  console.log(`- selection_reason: ${selection.reason}`);

  if (!selection.job) {
    return {
      generatedAt,
      selection,
      alertArtifacts
    };
  }

  console.log(`- selected_job: ${selection.job.name}`);
  console.log(`- selected_command: ${selection.job.command}`);
  if (selection.job.liveGovernance) {
    console.log(`- governance_status: ${selection.job.liveGovernance.status}`);
    console.log(`- governance_next_action: ${selection.job.liveGovernance.nextAction}`);
  }

  if (selection.status === "governance_blocked") {
    return {
      generatedAt,
      selection,
      alertArtifacts
    };
  }

  if (options.dryRun) {
    console.log(`- dispatch_status: dry_run_preview`);
    return {
      generatedAt,
      selection,
      alertArtifacts
    };
  }

  console.log(``);
  console.log(`## Dispatch Run`);
  const result = await runShellCommand(selection.job.command, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });

  console.log(``);
  console.log(`## Dispatch Result`);
  console.log(`- exit_code: ${result.code}`);
  console.log(`- signal: ${result.signal ?? "-"}`);

  if (result.code !== 0) {
    const error = new Error(`Dispatched automation job '${selection.job.name}' failed with exit code ${result.code}.`);
    error.exitCode = result.code;
    throw error;
  }

  const postRunGeneratedAt = new Date().toISOString();
  const { state: refreshedState } = await loadAutomationJobState(rootDir, config);
  const refreshedEvaluations = evaluateAutomationJobs(jobs, refreshedState, new Date(postRunGeneratedAt));
  const refreshedAlertArtifacts = await writeAlertArtifacts(rootDir, config, postRunGeneratedAt, refreshedEvaluations, false);
  console.log(`- next_ready_job_after_dispatch: ${refreshedAlertArtifacts.nextJob?.name ?? "-"}`);

  return {
    generatedAt,
    selection,
    result,
    alertArtifacts: refreshedAlertArtifacts
  };
}

export async function runAutomationAlerts(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const { jobs } = await loadAutomationJobs(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);
  const alertArtifacts = await writeAlertArtifacts(rootDir, config, generatedAt, evaluations, options.dryRun);
  const { alerts, nextJob, paths } = alertArtifacts;

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      statePath: path.relative(rootDir, statePath),
      jsonPath: path.relative(rootDir, paths.jsonPath),
      markdownPath: path.relative(rootDir, paths.markdownPath),
      alerts,
      nextJob
    }, null, 2));
    return { generatedAt, alerts, nextJob };
  }

  const summary = renderAutomationAlertSummary({
    generatedAt,
    alerts,
    nextJob
  });
  console.log(summary);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- alerts_json: ${path.relative(rootDir, paths.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- alerts_markdown: ${path.relative(rootDir, paths.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  if (options.target || (Array.isArray(config.automationAlertTargets) && config.automationAlertTargets.length > 0)) {
    const delivery = await deliverAutomationAlertPayload(rootDir, config, alertArtifacts.payload, {
      target: options.target,
      file: options.file,
      targetCommand: options.targetCommand,
      targetHook: options.targetHook,
      targetCwd: options.targetCwd,
      payloadFile: options.payloadFile,
      hookMarkdownFile: options.hookMarkdownFile,
      hookJsonFile: options.hookJsonFile,
      hookPrint: options.hookPrint,
      dryRun: options.dryRun
    });
    const deliverySummary = renderAutomationAlertDeliverySummary({
      generatedAt,
      deliveries: delivery.deliveries
    });
    console.log(``);
    console.log(deliverySummary);
  }

  return { generatedAt, alerts, nextJob };
}

export async function runAutomationJobClear(rootDir, config, options) {
  if (!options.automationJob) {
    throw new Error("automation-job-clear requires --automation-job <job-name>.");
  }

  const clearedAt = new Date().toISOString();
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const out = clearAutomationJobState(state, options.automationJob, {
    clearedAt,
    reason: options.notes || "manual_clear"
  });

  if (out.result.status === "missing") {
    console.log(`# Patternpilot Automation Job Clear`);
    console.log(``);
    console.log(`- job: ${options.automationJob}`);
    console.log(`- status: missing`);
    console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
    return out.result;
  }

  await writeAutomationJobState(rootDir, config, out.state, options.dryRun);

  console.log(`# Patternpilot Automation Job Clear`);
  console.log(``);
  console.log(`- job: ${options.automationJob}`);
  console.log(`- status: cleared`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- previous_blocked_manual: ${out.result.previous.blockedManual ? "yes" : "no"}`);
  console.log(`- previous_requalification_required: ${out.result.previous.requalificationRequired ? "yes" : "no"}`);
  console.log(`- previous_next_retry_at: ${out.result.previous.nextRetryAt ?? "-"}`);
  console.log(`- clear_reason: ${out.result.current.manualClearReason ?? "-"}`);

  return out.result;
}
