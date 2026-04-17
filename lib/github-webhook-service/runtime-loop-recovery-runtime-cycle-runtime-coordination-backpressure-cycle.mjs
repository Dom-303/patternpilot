function normalizeCyclePass(pass = {}, index = 0) {
  return {
    passIndex: Number.isFinite(pass.passIndex) ? Number(pass.passIndex) : index + 1,
    groupCount: Number(pass.groupCount ?? 0),
    selectedCount: Number(pass.selectedCount ?? 0),
    appliedCount: Number(pass.appliedCount ?? 0),
    autoReleaseCount: Number(pass.autoReleaseCount ?? 0),
    refreshCount: Number(pass.refreshCount ?? 0),
    escalatedCount: Number(pass.escalatedCount ?? 0),
    stopReason: pass.stopReason ?? null,
    summaryPath: pass.summaryPath ?? null
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleState(passes = [], options = {}) {
  const normalizedPasses = Array.isArray(passes)
    ? passes.map((pass, index) => normalizeCyclePass(pass, index))
    : [];
  const cycleLimit = Number.isFinite(options.cycleLimit) && options.cycleLimit > 0
    ? Number(options.cycleLimit)
    : 2;
  const completedPasses = normalizedPasses.length;
  const remainingCycleBudget = Math.max(cycleLimit - completedPasses, 0);
  const finalPass = normalizedPasses[normalizedPasses.length - 1] ?? null;
  const stopReason = options.stopReason
    ?? finalPass?.stopReason
    ?? (completedPasses === 0 ? "no_backpressure_cycle_passes" : "unknown");
  const resumeReady = remainingCycleBudget > 0
    && (stopReason === "manual_preview" || stopReason === "dry_run_preview");

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    cycleLimit,
    completedPasses,
    remainingCycleBudget,
    resumeReady,
    stopReason,
    totalGroupCount: normalizedPasses.reduce((sum, pass) => sum + Number(pass.groupCount ?? 0), 0),
    totalSelectedCount: normalizedPasses.reduce((sum, pass) => sum + Number(pass.selectedCount ?? 0), 0),
    totalAppliedCount: normalizedPasses.reduce((sum, pass) => sum + Number(pass.appliedCount ?? 0), 0),
    totalAutoReleaseCount: normalizedPasses.reduce((sum, pass) => sum + Number(pass.autoReleaseCount ?? 0), 0),
    totalRefreshCount: normalizedPasses.reduce((sum, pass) => sum + Number(pass.refreshCount ?? 0), 0),
    totalEscalatedCount: normalizedPasses.reduce((sum, pass) => sum + Number(pass.escalatedCount ?? 0), 0),
    passes: normalizedPasses,
    nextAction: stopReason === "no_due_group_backpressure_followup"
      ? "No further coordination-group backpressure follow-up is currently due."
      : stopReason === "cycle_limit_reached"
        ? "Increase the backpressure cycle limit if more auto-follow-up passes should be attempted."
        : stopReason === "dry_run_preview"
          ? "Remove dry-run to let the coordination-group backpressure cycle apply multiple passes."
          : stopReason === "manual_preview"
            ? "Use --apply to execute coordination-group backpressure follow-up passes instead of previewing the first one."
            : completedPasses === 0
              ? "No coordination-group backpressure cycle pass was executed."
              : "Inspect the latest coordination-group backpressure cycle summary before continuing."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResumeContract(cycleState, options = {}) {
  const remainingCycleBudget = Number.isFinite(cycleState?.remainingCycleBudget)
    ? Number(cycleState.remainingCycleBudget)
    : 0;
  const dispatchReady = Boolean(cycleState?.resumeReady) && remainingCycleBudget > 0;

  return {
    schemaVersion: 1,
    contractKind: "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_cycle_resume_contract",
    contractStatus: dispatchReady
      ? "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_cycle_resume_contract"
      : "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_cycle_resume_not_ready",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    cycleState,
    cycleStatePath: options.cycleStatePath ?? null,
    remainingCycleBudget,
    nextAction: dispatchReady
      ? "Resume the coordination-group backpressure cycle from the persisted cycle state."
      : "This coordination-group backpressure cycle cannot be resumed right now."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleSummary(cycleState, receipts = []) {
  const passLines = cycleState.passes.length > 0
    ? cycleState.passes.map((pass) =>
      `- pass=${pass.passIndex}: groups=${pass.groupCount} | selected=${pass.selectedCount} | applied=${pass.appliedCount} | released=${pass.autoReleaseCount} | refreshed=${pass.refreshCount} | escalated=${pass.escalatedCount} | stop=${pass.stopReason ?? "-"}${pass.summaryPath ? ` | summary=${pass.summaryPath}` : ""}`
    ).join("\n")
    : "- none";
  const receiptLines = Array.isArray(receipts) && receipts.length > 0
    ? receipts.map((receipt) =>
      `- pass=${receipt.passIndex}: outcome=${receipt.outcome} | selected=${receipt.selectedCount ?? 0} | applied=${receipt.appliedCount ?? 0} | released=${receipt.autoReleaseCount ?? 0} | refreshed=${receipt.refreshCount ?? 0} | escalated=${receipt.escalatedCount ?? 0}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Cycle

- generated_at: ${cycleState.generatedAt}
- cycle_limit: ${cycleState.cycleLimit}
- completed_passes: ${cycleState.completedPasses}
- remaining_cycle_budget: ${cycleState.remainingCycleBudget}
- resume_ready: ${cycleState.resumeReady ? "yes" : "no"}
- stop_reason: ${cycleState.stopReason}
- total_group_count: ${cycleState.totalGroupCount}
- total_selected_count: ${cycleState.totalSelectedCount}
- total_applied_count: ${cycleState.totalAppliedCount}
- total_auto_release_count: ${cycleState.totalAutoReleaseCount}
- total_refresh_count: ${cycleState.totalRefreshCount}
- total_escalated_count: ${cycleState.totalEscalatedCount}

## Backpressure Cycle Passes

${passLines}

## Cycle Receipts

${receiptLines}

## Next Action

- ${cycleState.nextAction}
`;
}
