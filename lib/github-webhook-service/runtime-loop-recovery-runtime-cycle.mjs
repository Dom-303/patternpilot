export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState(rounds = [], options = {}) {
  const normalizedRounds = Array.isArray(rounds)
    ? rounds.map((round, index) => ({
        roundIndex: Number.isFinite(round.roundIndex) ? Number(round.roundIndex) : index + 1,
        workerCount: Number(round.workerCount ?? 0),
        selectedCount: Number(round.selectedCount ?? 0),
        executedCount: Number(round.executedCount ?? 0),
        blockedCount: Number(round.blockedCount ?? 0),
        laneCount: Number(round.laneCount ?? 0),
        stopReason: round.stopReason ?? null,
        summaryPath: round.summaryPath ?? null
      }))
    : [];

  const cycleLimit = Number.isFinite(options.cycleLimit) && options.cycleLimit > 0
    ? Number(options.cycleLimit)
    : 1;
  const completedRounds = normalizedRounds.length;
  const remainingCycleBudget = Math.max(cycleLimit - completedRounds, 0);
  const finalRound = normalizedRounds[normalizedRounds.length - 1] ?? null;
  const stopReason = options.stopReason
    ?? finalRound?.stopReason
    ?? (completedRounds === 0 ? "no_recovery_runtime_rounds" : "unknown");
  const resumeReady = remainingCycleBudget > 0
    && (stopReason === "manual_preview" || stopReason === "dry_run_preview");

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerIds: Array.isArray(options.workerIds) ? options.workerIds : [],
    cycleLimit,
    completedRounds,
    remainingCycleBudget,
    resumeReady,
    stopReason,
    totalSelectedCount: normalizedRounds.reduce((sum, round) => sum + Number(round.selectedCount ?? 0), 0),
    totalExecutedCount: normalizedRounds.reduce((sum, round) => sum + Number(round.executedCount ?? 0), 0),
    rounds: normalizedRounds,
    nextAction: stopReason === "no_dispatchable_recovery_runtime"
      ? "No further runtime-loop recovery runtime is dispatch-ready right now."
      : stopReason === "cycle_limit_reached"
        ? "Increase the recovery-runtime cycle limit if more worker recovery passes should be attempted."
        : stopReason === "dry_run_preview"
          ? "Remove dry-run to let the recovery-runtime cycle advance multiple passes."
          : stopReason === "manual_preview"
            ? "Use --apply to execute recovery-runtime cycles instead of previewing the first round."
            : completedRounds === 0
              ? "No recovery-runtime cycle round was executed."
              : "Inspect the latest recovery-runtime cycle summary before continuing."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleResumeContract(cycleState, options = {}) {
  const remainingCycleBudget = Number.isFinite(cycleState?.remainingCycleBudget)
    ? Number(cycleState.remainingCycleBudget)
    : 0;
  const dispatchReady = Boolean(cycleState?.resumeReady) && remainingCycleBudget > 0;

  return {
    schemaVersion: 1,
    contractKind: "runtime_loop_recovery_runtime_cycle_resume_contract",
    contractStatus: dispatchReady
      ? "dispatch_ready_runtime_loop_recovery_runtime_cycle_resume_contract"
      : "runtime_loop_recovery_runtime_cycle_resume_not_ready",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    cycleState,
    cycleStatePath: options.cycleStatePath ?? null,
    remainingCycleBudget,
    workerIds: Array.isArray(cycleState?.workerIds) ? cycleState.workerIds : [],
    nextAction: dispatchReady
      ? "Resume the runtime-loop recovery runtime cycle from the persisted cycle state."
      : "This runtime-loop recovery runtime cycle cannot be resumed right now."
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleSummary(cycleState, receipts = []) {
  const roundLines = cycleState.rounds.length > 0
    ? cycleState.rounds.map((round) =>
      `- round=${round.roundIndex}: workers=${round.workerCount} | selected=${round.selectedCount} | executed=${round.executedCount} | blocked=${round.blockedCount} | lanes=${round.laneCount} | stop=${round.stopReason ?? "-"}${round.summaryPath ? ` | summary=${round.summaryPath}` : ""}`
    ).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) =>
      `- round=${receipt.roundIndex}: outcome=${receipt.outcome} | selected=${receipt.selectedCount ?? 0} | executed=${receipt.executedCount ?? 0} | workers=${receipt.workerCount ?? 0}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle

- generated_at: ${cycleState.generatedAt}
- worker_ids: ${(cycleState.workerIds ?? []).join(", ") || "-"}
- cycle_limit: ${cycleState.cycleLimit}
- completed_rounds: ${cycleState.completedRounds}
- remaining_cycle_budget: ${cycleState.remainingCycleBudget}
- resume_ready: ${cycleState.resumeReady ? "yes" : "no"}
- stop_reason: ${cycleState.stopReason}
- total_selected_count: ${cycleState.totalSelectedCount}
- total_executed_count: ${cycleState.totalExecutedCount}

## Recovery Runtime Rounds

${roundLines}

## Cycle Receipts

${receiptLines}

## Next Action

- ${cycleState.nextAction}
`;
}
