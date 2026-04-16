export function buildGithubWebhookServiceRuntimeSessionState(rounds = [], options = {}) {
  const normalizedRounds = Array.isArray(rounds)
    ? rounds.map((round, index) => ({
        sessionIndex: Number.isFinite(round.sessionIndex) ? Number(round.sessionIndex) : index + 1,
        completedCycles: Number(round.completedCycles ?? 0),
        runtimeCount: Number(round.runtimeCount ?? 0),
        dispatchableRuntimeCount: Number(round.dispatchableRuntimeCount ?? 0),
        blockedLaneCount: Number(round.blockedLaneCount ?? 0),
        queueCount: Number(round.queueCount ?? 0),
        cycleStopReason: round.cycleStopReason ?? null,
        stopReason: round.stopReason ?? null,
        summaryPath: round.summaryPath ?? null
      }))
    : [];

  const lastRound = normalizedRounds[normalizedRounds.length - 1] ?? null;
  const stopReason = options.stopReason
    ?? lastRound?.stopReason
    ?? (normalizedRounds.length === 0 ? "no_sessions" : "unknown");
  const sessionLimit = Number.isFinite(options.sessionLimit) && options.sessionLimit > 0
    ? Number(options.sessionLimit)
    : 1;
  const runtimeCycleLimit = Number.isFinite(options.runtimeCycleLimit) && options.runtimeCycleLimit > 0
    ? Number(options.runtimeCycleLimit)
    : 1;
  const completedSessions = normalizedRounds.length;
  const totalCycles = normalizedRounds.reduce((sum, round) => sum + Number(round.completedCycles ?? 0), 0);
  const remainingSessionBudget = Math.max(sessionLimit - completedSessions, 0);
  const resumeReady = stopReason === "session_limit_reached" && remainingSessionBudget > 0;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerIds: Array.isArray(options.workerIds) ? options.workerIds : [],
    workerId: options.workerId ?? null,
    schedulerLane: options.schedulerLane ?? null,
    runtimeCycleLimit,
    sessionLimit,
    completedSessions,
    totalCycles,
    remainingSessionBudget,
    stopReason,
    resumeReady,
    rounds: normalizedRounds,
    nextAction: stopReason === "no_dispatchable_runtime"
      ? "No further worker runtime is dispatch-ready right now."
      : stopReason === "session_limit_reached"
        ? "Resume this runtime session to continue processing more runtime rounds."
        : stopReason === "dry_run_preview"
          ? "Remove dry-run to let the runtime session advance across multiple rounds."
          : stopReason === "manual_preview"
            ? "Use --apply to execute runtime sessions instead of previewing the first round."
            : normalizedRounds.length === 0
              ? "No runtime session round was executed."
              : "Inspect the latest runtime-session summary before continuing."
  };
}

export function buildGithubWebhookServiceRuntimeSessionResumeContract(sessionState, options = {}) {
  const normalizedSessionState = sessionState ?? buildGithubWebhookServiceRuntimeSessionState([], options);
  return {
    contractKind: "runtime_session_resume_contract",
    contractStatus: normalizedSessionState.resumeReady
      ? "dispatch_ready_runtime_session_resume_contract"
      : "runtime_session_resume_not_required",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    sessionStatePath: options.sessionStatePath ?? null,
    workerIds: normalizedSessionState.workerIds ?? [],
    workerId: normalizedSessionState.workerId ?? null,
    schedulerLane: normalizedSessionState.schedulerLane ?? null,
    runtimeCycleLimit: normalizedSessionState.runtimeCycleLimit,
    runtimeSessionLimit: normalizedSessionState.sessionLimit,
    remainingSessionBudget: normalizedSessionState.remainingSessionBudget,
    resumeFromSessionIndex: normalizedSessionState.completedSessions + 1,
    sessionState: normalizedSessionState
  };
}

export function renderGithubWebhookServiceRuntimeSessionSummary(sessionState, receipts = []) {
  const roundLines = sessionState.rounds.length > 0
    ? sessionState.rounds.map((round) => `- session=${round.sessionIndex}: cycles=${round.completedCycles} | runtimes=${round.runtimeCount} | dispatchable=${round.dispatchableRuntimeCount} | blocked_lanes=${round.blockedLaneCount} | queue=${round.queueCount} | cycle_stop=${round.cycleStopReason ?? "-"} | stop=${round.stopReason ?? "-"}${round.summaryPath ? ` | summary=${round.summaryPath}` : ""}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- session=${receipt.sessionIndex}: outcome=${receipt.outcome} | cycles=${receipt.completedCycles ?? 0} | selected=${receipt.selectedCount ?? 0}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Session

- generated_at: ${sessionState.generatedAt}
- worker_ids: ${(sessionState.workerIds ?? []).join(", ") || "-"}
- scheduler_lane_filter: ${sessionState.schedulerLane ?? "-"}
- runtime_cycle_limit: ${sessionState.runtimeCycleLimit}
- session_limit: ${sessionState.sessionLimit}
- completed_sessions: ${sessionState.completedSessions}
- total_cycles: ${sessionState.totalCycles}
- remaining_session_budget: ${sessionState.remainingSessionBudget}
- stop_reason: ${sessionState.stopReason}
- resume_ready: ${sessionState.resumeReady ? "yes" : "no"}

## Runtime Session Rounds

${roundLines}

## Session Receipts

${receiptLines}

## Next Action

- ${sessionState.nextAction}
`;
}
