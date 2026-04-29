import path from "node:path";
import {
  acknowledgeAutomationJobState,
  assessAutomationDispatchGate,
  appendAutomationDispatchHistory,
  buildAutomationDispatchHistoryEntry,
  clearAutomationJobState,
  deliverAutomationAlertPayload,
  evaluateAutomationJobs,
  latchAutomationJobOperatorAck,
  loadAutomationDispatchHistory,
  loadAutomationJobs,
  loadAutomationJobState,
  loadAutomationOperatorReviews,
  renderAutomationAlertDeliverySummary,
  renderAutomationDispatchHistorySummary,
  renderAutomationAlertSummary,
  renderAutomationJobsSummary,
  renderAutomationOperatorReviewSummary,
  recordAutomationOperatorReviewOpen,
  recordAutomationOperatorReviewResolution,
  resolveAutomationDispatchJob,
  runShellCommand,
  summarizeAutomationDispatchHistory,
  summarizeAutomationOperatorReviews,
  updateAutomationJobState,
  writeAutomationOperatorReviews,
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

  if (!options.skipAutoResume) {
    const { tickAutoResume } = await import("../../../lib/automation/automation-jobs.mjs");
    const tick = tickAutoResume(state);
    if (tick.released.length > 0) {
      await writeAutomationJobState(rootDir, config, state, options.dryRun);
      if (!options.json) {
        console.log(`# Auto-resumed ${tick.released.length} stuck job${tick.released.length === 1 ? "" : "s"}:`);
        for (const r of tick.released) {
          console.log(`- ${r.jobId} (locked for ${r.ageMinutes} min)`);
        }
        console.log("");
      }
    }
  }

  const { historyPath } = await loadAutomationDispatchHistory(rootDir, config);
  const { reviewsPath } = await loadAutomationOperatorReviews(rootDir, config);
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
  console.log(`- dispatch_history_file: ${path.relative(rootDir, historyPath)}`);
  console.log(`- operator_review_file: ${path.relative(rootDir, reviewsPath)}`);

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
    deliveries: delivery.deliveries,
    attention: alertArtifacts.payload.attention ?? null
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
  const { reviewsPath, reviewState } = await loadAutomationOperatorReviews(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);
  let selection = resolveAutomationDispatchJob(evaluations, options.automationJob);
  const dispatchGate = selection.job ? assessAutomationDispatchGate(selection.job) : null;
  let ackLatchResult = null;
  let reviewOpenResult = null;
  let effectiveState = state;
  let effectiveEvaluations = evaluations;

  if (!options.dryRun && selection.job && dispatchGate?.escalation) {
    ackLatchResult = latchAutomationJobOperatorAck(state, selection.job.name, dispatchGate, {
      latchedAt: generatedAt
    });
    effectiveState = ackLatchResult.state;
    await writeAutomationJobState(rootDir, config, effectiveState, false);
    reviewOpenResult = recordAutomationOperatorReviewOpen(reviewState, {
      jobName: selection.job.name,
      category: dispatchGate.escalation.category,
      sourceStatus: dispatchGate.status,
      openedAt: generatedAt,
      reason: dispatchGate.reason,
      nextAction: ackLatchResult.result.current.operatorAckNextAction,
      nextCommand: ackLatchResult.result.current.operatorAckCommand,
      note: options.notes || null
    });
    await writeAutomationOperatorReviews(rootDir, config, reviewOpenResult.state, false);
    const refreshedBaseEvaluations = evaluateAutomationJobs(jobs, effectiveState, new Date(generatedAt));
    effectiveEvaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, refreshedBaseEvaluations);
  }

  const historyEntry = buildAutomationDispatchHistoryEntry({
    generatedAt,
    requestedJobName: options.automationJob,
    selection,
    evaluations,
    dryRun: options.dryRun
  });
  const historyRecord = options.dryRun
    ? await loadAutomationDispatchHistory(rootDir, config)
    : await appendAutomationDispatchHistory(rootDir, config, historyEntry);
  const alertArtifacts = await writeAlertArtifacts(rootDir, config, generatedAt, effectiveEvaluations, options.dryRun);

  console.log(`# Patternpilot Automation Dispatch`);
  console.log(``);
  console.log(`- generated_at: ${generatedAt}`);
  console.log(`- jobs_file: ${path.relative(rootDir, jobsPath)}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- dispatch_history_file: ${path.relative(rootDir, historyRecord.historyPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- operator_review_file: ${path.relative(rootDir, reviewsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- alerts_json: ${path.relative(rootDir, alertArtifacts.paths.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- alerts_markdown: ${path.relative(rootDir, alertArtifacts.paths.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- selection_status: ${selection.status}`);
  console.log(`- selection_reason: ${selection.reason}`);

  if (!selection.job) {
    return {
      generatedAt,
      selection,
      ackLatchResult,
      reviewOpenResult,
      alertArtifacts
    };
  }

  console.log(`- selected_job: ${selection.job.name}`);
  console.log(`- selected_command: ${selection.job.command}`);
  if (selection.job.liveGovernance) {
    console.log(`- governance_status: ${selection.job.liveGovernance.status}`);
    console.log(`- governance_next_action: ${selection.job.liveGovernance.nextAction}`);
  }
  if (selection.job.livePolicyControl) {
    console.log(`- policy_control_status: ${selection.job.livePolicyControl.overallStatus}`);
    console.log(`- policy_control_next_command: ${selection.job.livePolicyControl.nextCommand}`);
  }
  console.log(`- dispatch_gate_status: ${dispatchGate.status}`);
  if (dispatchGate.nextAction) {
    console.log(`- dispatch_gate_next_action: ${dispatchGate.nextAction}`);
  }
  if (ackLatchResult?.result?.status) {
    console.log(`- operator_ack_latch: ${ackLatchResult.result.status}`);
  }
  if (reviewOpenResult?.result?.current) {
    console.log(`- operator_review_status: ${reviewOpenResult.result.current.status}`);
    console.log(`- operator_review_id: ${reviewOpenResult.result.current.reviewId}`);
  }
  if (ackLatchResult?.result?.current?.operatorAckCommand) {
    console.log(`- operator_ack_command: ${ackLatchResult.result.current.operatorAckCommand}`);
  }

  if (selection.status !== "selected") {
    return {
      generatedAt,
      selection,
      ackLatchResult,
      reviewOpenResult,
      alertArtifacts
    };
  }

  if (options.dryRun) {
    console.log(`- dispatch_status: dry_run_preview`);
    return {
      generatedAt,
      selection,
      ackLatchResult,
      reviewOpenResult,
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
    ackLatchResult,
    reviewOpenResult,
    historyEntry,
    result,
    alertArtifacts: refreshedAlertArtifacts
  };
}

export async function runAutomationDispatchHistory(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { historyPath, history } = await loadAutomationDispatchHistory(rootDir, config);
  const summaryData = summarizeAutomationDispatchHistory(history, {
    jobName: options.automationJob ?? null,
    limit: options.limit
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      historyPath: path.relative(rootDir, historyPath),
      summary: summaryData
    }, null, 2));
    return {
      generatedAt,
      historyPath,
      summary: summaryData
    };
  }

  const summary = renderAutomationDispatchHistorySummary({
    generatedAt,
    summary: summaryData
  });
  console.log(summary);
  console.log(`- history_file: ${path.relative(rootDir, historyPath)}`);

  return {
    generatedAt,
    historyPath,
    summary: summaryData
  };
}

export async function runAutomationAlerts(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const { jobs } = await loadAutomationJobs(rootDir, config);
  const { reviewsPath } = await loadAutomationOperatorReviews(rootDir, config);
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
    nextJob,
    operatorReviewDigest: alertArtifacts.payload.operatorReviewDigest ?? null,
    attention: alertArtifacts.payload.attention ?? null
  });
  console.log(summary);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- operator_review_file: ${path.relative(rootDir, reviewsPath)}`);
  console.log(`- alerts_json: ${path.relative(rootDir, paths.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- alerts_markdown: ${path.relative(rootDir, paths.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  if (
    options.target
    || Boolean(config.automationAlertPreset)
    || (Array.isArray(config.automationAlertTargets) && config.automationAlertTargets.length > 0)
  ) {
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
      deliveries: delivery.deliveries,
      attention: alertArtifacts.payload.attention ?? null
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
  const { reviewsPath, reviewState } = await loadAutomationOperatorReviews(rootDir, config);
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
    console.log(`- operator_review_file: ${path.relative(rootDir, reviewsPath)}`);
    return out.result;
  }

  await writeAutomationJobState(rootDir, config, out.state, options.dryRun);
  const reviewResult = recordAutomationOperatorReviewResolution(reviewState, {
    jobName: options.automationJob,
    resolvedAt: clearedAt,
    status: "cleared",
    notes: options.notes || "manual_clear",
    nextCommand: "npm run patternpilot -- automation-jobs"
  });
  await writeAutomationOperatorReviews(rootDir, config, reviewResult.state, options.dryRun);

  console.log(`# Patternpilot Automation Job Clear`);
  console.log(``);
  console.log(`- job: ${options.automationJob}`);
  console.log(`- status: cleared`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- operator_review_file: ${path.relative(rootDir, reviewsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- previous_blocked_manual: ${out.result.previous.blockedManual ? "yes" : "no"}`);
  console.log(`- previous_requalification_required: ${out.result.previous.requalificationRequired ? "yes" : "no"}`);
  console.log(`- previous_operator_ack_required: ${out.result.previous.operatorAckRequired ? "yes" : "no"}`);
  console.log(`- previous_next_retry_at: ${out.result.previous.nextRetryAt ?? "-"}`);
  console.log(`- clear_reason: ${out.result.current.manualClearReason ?? "-"}`);
  console.log(`- operator_review_status: ${reviewResult.result.current.status}`);

  return out.result;
}

export async function runAutomationJobAck(rootDir, config, options) {
  if (!options.automationJob) {
    throw new Error("automation-job-ack requires --automation-job <job-name>.");
  }

  const acknowledgedAt = new Date().toISOString();
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const { reviewsPath, reviewState } = await loadAutomationOperatorReviews(rootDir, config);
  const out = acknowledgeAutomationJobState(state, options.automationJob, {
    acknowledgedAt,
    reason: options.notes || "manual_ack"
  });

  console.log(`# Patternpilot Automation Job Ack`);
  console.log(``);
  console.log(`- job: ${options.automationJob}`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- operator_review_file: ${path.relative(rootDir, reviewsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  if (out.result.status === "missing") {
    console.log(`- status: missing`);
    return out.result;
  }

  if (out.result.status === "not_required") {
    console.log(`- status: not_required`);
    console.log(`- operator_ack_required: no`);
    return out.result;
  }

  await writeAutomationJobState(rootDir, config, out.state, options.dryRun);
  const reviewResult = recordAutomationOperatorReviewResolution(reviewState, {
    jobName: options.automationJob,
    resolvedAt: acknowledgedAt,
    status: "acknowledged",
    notes: options.notes || "manual_ack",
    nextCommand: "npm run patternpilot -- automation-dispatch --dry-run"
  });
  await writeAutomationOperatorReviews(rootDir, config, reviewResult.state, options.dryRun);

  console.log(`- status: acknowledged`);
  console.log(`- previous_operator_ack_category: ${out.result.previous.operatorAckCategory ?? "-"}`);
  console.log(`- previous_operator_ack_source_status: ${out.result.previous.operatorAckSourceStatus ?? "-"}`);
  console.log(`- previous_operator_ack_triggered_at: ${out.result.previous.operatorAckTriggeredAt ?? "-"}`);
  console.log(`- ack_reason: ${out.result.current.operatorAckAcknowledgedReason ?? "-"}`);
  console.log(`- operator_review_status: ${reviewResult.result.current.status}`);
  console.log(`- next_command: npm run patternpilot -- automation-dispatch --dry-run`);

  return out.result;
}

export async function runAutomationReviews(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { reviewsPath, reviewState } = await loadAutomationOperatorReviews(rootDir, config);
  const summaryData = summarizeAutomationOperatorReviews(reviewState, {
    jobName: options.automationJob ?? null,
    limit: options.limit
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      reviewsPath: path.relative(rootDir, reviewsPath),
      summary: summaryData
    }, null, 2));
    return {
      generatedAt,
      reviewsPath,
      summary: summaryData
    };
  }

  const summary = renderAutomationOperatorReviewSummary({
    generatedAt,
    summary: summaryData
  });
  console.log(summary);
  console.log(`- operator_review_file: ${path.relative(rootDir, reviewsPath)}`);

  return {
    generatedAt,
    reviewsPath,
    summary: summaryData
  };
}
