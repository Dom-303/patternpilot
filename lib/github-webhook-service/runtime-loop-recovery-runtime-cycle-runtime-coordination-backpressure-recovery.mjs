export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryAssessment(loopState, receipts = [], options = {}) {
  const stopReason = loopState?.stopReason ?? "unknown";
  const appliedCount = Array.isArray(receipts)
    ? receipts.reduce((sum, receipt) => sum + Number(receipt.totalAppliedCount ?? 0), 0)
    : 0;
  const hasResumeContract = Boolean(options.resumeContractPath || options.resumeContract?.contractStatus);

  let effectiveStatus = "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_manual_review";
  let action = "manual_review";
  let nextAction = "Inspect the latest coordination-group backpressure loop summary and decide whether manual intervention is needed.";

  if (stopReason === "manual_preview" || stopReason === "dry_run_preview") {
    effectiveStatus = "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_preview_only";
    action = "preview_only";
    nextAction = stopReason === "dry_run_preview"
      ? "Remove dry-run if this coordination-group backpressure loop should continue for real."
      : "Use --apply to let this coordination-group backpressure loop continue beyond preview.";
  } else if (loopState?.resumeReady && hasResumeContract) {
    effectiveStatus = "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract";
    action = "recover_via_resume";
    nextAction = "Recover this coordination-group backpressure loop via its emitted resume contract.";
  } else if (stopReason === "no_due_group_backpressure_followup") {
    effectiveStatus = "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_not_required";
    action = "drained";
    nextAction = appliedCount > 0
      ? "This coordination-group backpressure loop drained the currently due follow-up work; wait for new backpressure activity."
      : "No due coordination-group backpressure follow-up remained for this loop.";
  } else if (stopReason === "loop_limit_reached" && !hasResumeContract) {
    effectiveStatus = "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_manual_review";
    action = "missing_resume_contract";
    nextAction = "Loop budget remains, but the resume contract is missing; inspect artifacts before recovering.";
  } else if (stopReason === "no_backpressure_loops") {
    effectiveStatus = "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_not_required";
    action = "idle";
    nextAction = "No coordination-group backpressure loop rounds were executed.";
  }

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    stopReason,
    appliedCount,
    completedLoops: Number(loopState?.completedLoops ?? 0),
    totalSessions: Number(loopState?.totalSessions ?? 0),
    totalPasses: Number(loopState?.totalPasses ?? 0),
    remainingLoopBudget: Number(loopState?.remainingLoopBudget ?? 0),
    resumeReady: Boolean(loopState?.resumeReady),
    effectiveStatus,
    action,
    nextAction
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryContract(input = {}, options = {}) {
  const loopState = input.loopState ?? null;
  const receipts = Array.isArray(input.receipts) ? input.receipts : [];
  const recoveryAssessment = input.recoveryAssessment
    ?? buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryAssessment(loopState, receipts, options);
  const resumeContract = input.resumeContract ?? null;

  return {
    contractKind: "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract",
    contractStatus: recoveryAssessment.effectiveStatus,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    loopStatePath: options.loopStatePath ?? null,
    receiptsPath: options.receiptsPath ?? null,
    resumeContractPath: options.resumeContractPath ?? null,
    summaryPath: options.summaryPath ?? null,
    runId: options.runId ?? null,
    runtimeCycleLimit: Number(loopState?.runtimeCycleLimit ?? 0),
    runtimeSessionLimit: Number(loopState?.runtimeSessionLimit ?? 0),
    runtimeLoopLimit: Number(loopState?.loopLimit ?? 0),
    remainingLoopBudget: Number(loopState?.remainingLoopBudget ?? 0),
    resumeReady: Boolean(loopState?.resumeReady),
    stopReason: loopState?.stopReason ?? "unknown",
    appliedCount: recoveryAssessment.appliedCount,
    recoveryAssessment,
    resumeContract,
    loopState
  };
}

function normalizeRecoveryEntry(entry = {}) {
  return {
    runId: String(entry.runId ?? "").trim() || "unknown-run",
    generatedAt: entry.generatedAt ?? new Date().toISOString(),
    commandName: entry.commandName ?? "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-run",
    stopReason: entry.stopReason ?? "unknown",
    recoveryStatus: entry.recoveryStatus ?? "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_manual_review",
    appliedCount: Number(entry.appliedCount ?? 0),
    remainingLoopBudget: Number(entry.remainingLoopBudget ?? 0),
    resumeReady: Boolean(entry.resumeReady),
    statePath: entry.statePath ?? null,
    receiptsPath: entry.receiptsPath ?? null,
    resumeContractPath: entry.resumeContractPath ?? null,
    recoveryContractPath: entry.recoveryContractPath ?? null,
    summaryPath: entry.summaryPath ?? null
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview(historyState, options = {}) {
  const entries = Array.isArray(historyState?.entries)
    ? historyState.entries.map((entry) => normalizeRecoveryEntry(entry))
    : [];
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : 10;
  const recentEntries = entries.slice(-limit).reverse();
  const recoveryCandidates = recentEntries.filter((entry) =>
    entry.recoveryStatus === "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract"
    || entry.recoveryStatus === "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_manual_review"
  );
  const dispatchReadyCount = recentEntries.filter((entry) =>
    entry.recoveryStatus === "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract"
  ).length;
  const manualReviewCount = recentEntries.filter((entry) =>
    entry.recoveryStatus === "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_manual_review"
  ).length;
  const previewOnlyCount = recentEntries.filter((entry) =>
    entry.recoveryStatus === "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_preview_only"
  ).length;
  const bestCandidate = recoveryCandidates[0] ?? null;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    historyCount: entries.length,
    reviewCount: recentEntries.length,
    dispatchReadyCount,
    manualReviewCount,
    previewOnlyCount,
    bestCandidate,
    recentEntries,
    nextAction: bestCandidate?.recoveryStatus === "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract"
      ? "Recover the latest dispatch-ready coordination-group backpressure loop via its emitted recovery contract."
      : bestCandidate?.recoveryStatus === "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_manual_review"
        ? "Inspect the latest coordination-group backpressure loop artifacts before forcing another recovery attempt."
        : previewOnlyCount > 0
          ? "Convert previewed coordination-group backpressure loops into real loops once ready."
          : "No coordination-group backpressure loop recovery candidate is currently available."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReviewSummary(review) {
  const entryLines = review.recentEntries.length > 0
    ? review.recentEntries.map((entry) =>
      `- run=${entry.runId}: command=${entry.commandName} | stop=${entry.stopReason} | recovery=${entry.recoveryStatus} | applied=${entry.appliedCount} | resume_ready=${entry.resumeReady ? "yes" : "no"}${entry.recoveryContractPath ? ` | recovery_contract=${entry.recoveryContractPath}` : ""}${entry.summaryPath ? ` | summary=${entry.summaryPath}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Loop Recovery Review

- generated_at: ${review.generatedAt}
- history_count: ${review.historyCount}
- review_count: ${review.reviewCount}
- dispatch_ready_count: ${review.dispatchReadyCount}
- manual_review_count: ${review.manualReviewCount}
- preview_only_count: ${review.previewOnlyCount}

## Recent Recovery Candidates

${entryLines}

## Next Action

- ${review.nextAction}
`;
}
