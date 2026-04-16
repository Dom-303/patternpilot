export function buildGithubWebhookServiceRuntimeLoopRecoveryAssessment(loopState, receipts = [], options = {}) {
  const stopReason = loopState?.stopReason ?? "unknown";
  const selectedCount = Array.isArray(receipts)
    ? receipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0)
    : 0;
  const hasResumeContract = Boolean(options.resumeContractPath || options.resumeContract?.contractStatus);

  let effectiveStatus = "runtime_loop_recovery_manual_review";
  let action = "manual_review";
  let nextAction = "Inspect the latest runtime-loop summary and decide whether manual intervention is needed.";

  if (stopReason === "manual_preview" || stopReason === "dry_run_preview") {
    effectiveStatus = "runtime_loop_recovery_preview_only";
    action = "preview_only";
    nextAction = stopReason === "dry_run_preview"
      ? "Remove dry-run if this runtime loop should continue for real."
      : "Use --apply to let this runtime loop continue beyond preview.";
  } else if (loopState?.resumeReady && hasResumeContract) {
    effectiveStatus = "dispatch_ready_runtime_loop_recovery_contract";
    action = "recover_via_resume";
    nextAction = "Recover this runtime loop via its emitted resume contract.";
  } else if (stopReason === "no_dispatchable_runtime") {
    effectiveStatus = "runtime_loop_recovery_not_required";
    action = "drained";
    nextAction = selectedCount > 0
      ? "This runtime loop drained the currently dispatchable work; wait for new queue activity."
      : "No dispatchable runtime work remained for this loop.";
  } else if (stopReason === "loop_limit_reached" && !hasResumeContract) {
    effectiveStatus = "runtime_loop_recovery_manual_review";
    action = "missing_resume_contract";
    nextAction = "Loop budget remains, but the resume contract is missing; inspect artifacts before recovering.";
  } else if (stopReason === "no_loops") {
    effectiveStatus = "runtime_loop_recovery_not_required";
    action = "idle";
    nextAction = "No runtime loop rounds were executed.";
  }

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    stopReason,
    selectedCount,
    completedLoops: Number(loopState?.completedLoops ?? 0),
    totalSessions: Number(loopState?.totalSessions ?? 0),
    totalCycles: Number(loopState?.totalCycles ?? 0),
    remainingLoopBudget: Number(loopState?.remainingLoopBudget ?? 0),
    resumeReady: Boolean(loopState?.resumeReady),
    effectiveStatus,
    action,
    nextAction
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryContract(input = {}, options = {}) {
  const loopState = input.loopState ?? null;
  const receipts = Array.isArray(input.receipts) ? input.receipts : [];
  const recoveryAssessment = input.recoveryAssessment
    ?? buildGithubWebhookServiceRuntimeLoopRecoveryAssessment(loopState, receipts, options);
  const resumeContract = input.resumeContract ?? null;

  return {
    contractKind: "runtime_loop_recovery_contract",
    contractStatus: recoveryAssessment.effectiveStatus,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    loopStatePath: options.loopStatePath ?? null,
    receiptsPath: options.receiptsPath ?? null,
    resumeContractPath: options.resumeContractPath ?? null,
    summaryPath: options.summaryPath ?? null,
    runId: options.runId ?? null,
    workerIds: Array.isArray(loopState?.workerIds) ? loopState.workerIds : [],
    workerId: loopState?.workerId ?? null,
    schedulerLane: loopState?.schedulerLane ?? null,
    runtimeCycleLimit: Number(loopState?.runtimeCycleLimit ?? 0),
    runtimeSessionLimit: Number(loopState?.runtimeSessionLimit ?? 0),
    runtimeLoopLimit: Number(loopState?.loopLimit ?? 0),
    remainingLoopBudget: Number(loopState?.remainingLoopBudget ?? 0),
    resumeReady: Boolean(loopState?.resumeReady),
    stopReason: loopState?.stopReason ?? "unknown",
    selectedCount: recoveryAssessment.selectedCount,
    recoveryAssessment,
    resumeContract,
    loopState
  };
}

function normalizeRecoveryEntry(entry = {}) {
  return {
    runId: String(entry.runId ?? "").trim() || "unknown-run",
    generatedAt: entry.generatedAt ?? new Date().toISOString(),
    commandName: entry.commandName ?? "github-app-service-runtime-loop-run",
    stopReason: entry.stopReason ?? "unknown",
    recoveryStatus: entry.recoveryStatus ?? "runtime_loop_recovery_manual_review",
    selectedCount: Number(entry.selectedCount ?? 0),
    remainingLoopBudget: Number(entry.remainingLoopBudget ?? 0),
    resumeReady: Boolean(entry.resumeReady),
    statePath: entry.statePath ?? null,
    receiptsPath: entry.receiptsPath ?? null,
    resumeContractPath: entry.resumeContractPath ?? null,
    recoveryContractPath: entry.recoveryContractPath ?? null,
    summaryPath: entry.summaryPath ?? null
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryReview(historyState, options = {}) {
  const entries = Array.isArray(historyState?.entries)
    ? historyState.entries.map((entry) => normalizeRecoveryEntry(entry))
    : [];
  const limit = Number.isFinite(options.limit) && options.limit > 0
    ? Number(options.limit)
    : 10;
  const recentEntries = entries.slice(-limit).reverse();
  const recoveryCandidates = recentEntries.filter((entry) =>
    entry.recoveryStatus === "dispatch_ready_runtime_loop_recovery_contract"
    || entry.recoveryStatus === "runtime_loop_recovery_manual_review"
  );
  const dispatchReadyCount = recentEntries.filter((entry) =>
    entry.recoveryStatus === "dispatch_ready_runtime_loop_recovery_contract"
  ).length;
  const manualReviewCount = recentEntries.filter((entry) =>
    entry.recoveryStatus === "runtime_loop_recovery_manual_review"
  ).length;
  const previewOnlyCount = recentEntries.filter((entry) =>
    entry.recoveryStatus === "runtime_loop_recovery_preview_only"
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
    nextAction: bestCandidate?.recoveryStatus === "dispatch_ready_runtime_loop_recovery_contract"
      ? "Recover the latest dispatch-ready runtime loop via github-app-service-runtime-loop-recover."
      : bestCandidate?.recoveryStatus === "runtime_loop_recovery_manual_review"
        ? "Inspect the latest runtime-loop artifacts before forcing another recovery attempt."
        : previewOnlyCount > 0
          ? "Convert previewed loops into real runtime loops once ready."
          : "No runtime-loop recovery candidate is currently available."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryReviewSummary(review) {
  const entryLines = review.recentEntries.length > 0
    ? review.recentEntries.map((entry) => `- run=${entry.runId}: command=${entry.commandName} | stop=${entry.stopReason} | recovery=${entry.recoveryStatus} | selected=${entry.selectedCount} | resume_ready=${entry.resumeReady ? "yes" : "no"}${entry.recoveryContractPath ? ` | recovery_contract=${entry.recoveryContractPath}` : ""}${entry.summaryPath ? ` | summary=${entry.summaryPath}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Review

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
