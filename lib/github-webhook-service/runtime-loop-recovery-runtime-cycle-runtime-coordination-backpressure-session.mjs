export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionState(rounds = [], options = {}) {
  const normalizedRounds = Array.isArray(rounds)
    ? rounds.map((round, index) => ({
        sessionIndex: Number.isFinite(round.sessionIndex) ? Number(round.sessionIndex) : index + 1,
        completedPasses: Number(round.completedPasses ?? 0),
        totalGroupCount: Number(round.totalGroupCount ?? 0),
        totalSelectedCount: Number(round.totalSelectedCount ?? 0),
        totalAppliedCount: Number(round.totalAppliedCount ?? 0),
        totalAutoReleaseCount: Number(round.totalAutoReleaseCount ?? 0),
        totalRefreshCount: Number(round.totalRefreshCount ?? 0),
        totalEscalatedCount: Number(round.totalEscalatedCount ?? 0),
        cycleStopReason: round.cycleStopReason ?? null,
        stopReason: round.stopReason ?? null,
        summaryPath: round.summaryPath ?? null
      }))
    : [];

  const lastRound = normalizedRounds[normalizedRounds.length - 1] ?? null;
  const stopReason = options.stopReason
    ?? lastRound?.stopReason
    ?? (normalizedRounds.length === 0 ? "no_backpressure_sessions" : "unknown");
  const sessionLimit = Number.isFinite(options.sessionLimit) && options.sessionLimit > 0
    ? Number(options.sessionLimit)
    : 1;
  const runtimeCycleLimit = Number.isFinite(options.runtimeCycleLimit) && options.runtimeCycleLimit > 0
    ? Number(options.runtimeCycleLimit)
    : 1;
  const completedSessions = normalizedRounds.length;
  const totalPasses = normalizedRounds.reduce((sum, round) => sum + Number(round.completedPasses ?? 0), 0);
  const remainingSessionBudget = Math.max(sessionLimit - completedSessions, 0);
  const resumeReady = stopReason === "session_limit_reached" && remainingSessionBudget > 0;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    runtimeCycleLimit,
    sessionLimit,
    completedSessions,
    totalPasses,
    remainingSessionBudget,
    stopReason,
    resumeReady,
    rounds: normalizedRounds,
    nextAction: stopReason === "no_due_group_backpressure_followup"
      ? "No further coordination-group backpressure work is due right now."
      : stopReason === "session_limit_reached"
        ? "Resume this coordination-group backpressure session to continue processing more cycle rounds."
        : stopReason === "dry_run_preview"
          ? "Remove dry-run to let the coordination-group backpressure session advance across multiple rounds."
          : stopReason === "manual_preview"
            ? "Use --apply to execute coordination-group backpressure sessions instead of previewing the first round."
            : normalizedRounds.length === 0
              ? "No coordination-group backpressure session round was executed."
              : "Inspect the latest coordination-group backpressure session summary before continuing."
  };
}

export function buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResumeContract(sessionState, options = {}) {
  const normalizedSessionState = sessionState
    ?? buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionState([], options);
  return {
    contractKind: "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_session_resume_contract",
    contractStatus: normalizedSessionState.resumeReady
      ? "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_session_resume_contract"
      : "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_session_resume_not_required",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sessionStatePath: options.sessionStatePath ?? null,
    runtimeCycleLimit: normalizedSessionState.runtimeCycleLimit,
    runtimeSessionLimit: normalizedSessionState.sessionLimit,
    remainingSessionBudget: normalizedSessionState.remainingSessionBudget,
    resumeFromSessionIndex: normalizedSessionState.completedSessions + 1,
    sessionState: normalizedSessionState
  };
}

export function renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionSummary(sessionState, receipts = []) {
  const roundLines = sessionState.rounds.length > 0
    ? sessionState.rounds.map((round) =>
      `- session=${round.sessionIndex}: passes=${round.completedPasses} | groups=${round.totalGroupCount} | selected=${round.totalSelectedCount} | applied=${round.totalAppliedCount} | released=${round.totalAutoReleaseCount} | refreshed=${round.totalRefreshCount} | escalated=${round.totalEscalatedCount} | cycle_stop=${round.cycleStopReason ?? "-"} | stop=${round.stopReason ?? "-"}${round.summaryPath ? ` | summary=${round.summaryPath}` : ""}`
    ).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) =>
      `- session=${receipt.sessionIndex}: outcome=${receipt.outcome} | passes=${receipt.completedPasses ?? 0} | applied=${receipt.totalAppliedCount ?? 0}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Session

- generated_at: ${sessionState.generatedAt}
- runtime_cycle_limit: ${sessionState.runtimeCycleLimit}
- session_limit: ${sessionState.sessionLimit}
- completed_sessions: ${sessionState.completedSessions}
- total_passes: ${sessionState.totalPasses}
- remaining_session_budget: ${sessionState.remainingSessionBudget}
- stop_reason: ${sessionState.stopReason}
- resume_ready: ${sessionState.resumeReady ? "yes" : "no"}

## Backpressure Session Rounds

${roundLines}

## Session Receipts

${receiptLines}

## Next Action

- ${sessionState.nextAction}
`;
}
