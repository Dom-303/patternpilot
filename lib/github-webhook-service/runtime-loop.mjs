export function buildGithubWebhookServiceRuntimeLoopState(sessions = [], options = {}) {
  const normalizedSessions = Array.isArray(sessions)
    ? sessions.map((session, index) => ({
        loopIndex: Number.isFinite(session.loopIndex) ? Number(session.loopIndex) : index + 1,
        completedSessions: Number(session.completedSessions ?? 0),
        totalCycles: Number(session.totalCycles ?? 0),
        runtimeCount: Number(session.runtimeCount ?? 0),
        dispatchableRuntimeCount: Number(session.dispatchableRuntimeCount ?? 0),
        blockedLaneCount: Number(session.blockedLaneCount ?? 0),
        queueCount: Number(session.queueCount ?? 0),
        sessionStopReason: session.sessionStopReason ?? null,
        stopReason: session.stopReason ?? null,
        summaryPath: session.summaryPath ?? null
      }))
    : [];

  const lastSession = normalizedSessions[normalizedSessions.length - 1] ?? null;
  const stopReason = options.stopReason
    ?? lastSession?.stopReason
    ?? (normalizedSessions.length === 0 ? "no_loops" : "unknown");
  const loopLimit = Number.isFinite(options.loopLimit) && options.loopLimit > 0
    ? Number(options.loopLimit)
    : 1;
  const runtimeSessionLimit = Number.isFinite(options.runtimeSessionLimit) && options.runtimeSessionLimit > 0
    ? Number(options.runtimeSessionLimit)
    : 1;
  const runtimeCycleLimit = Number.isFinite(options.runtimeCycleLimit) && options.runtimeCycleLimit > 0
    ? Number(options.runtimeCycleLimit)
    : 1;
  const completedLoops = normalizedSessions.length;
  const totalSessions = normalizedSessions.reduce((sum, session) => sum + Number(session.completedSessions ?? 0), 0);
  const totalCycles = normalizedSessions.reduce((sum, session) => sum + Number(session.totalCycles ?? 0), 0);
  const remainingLoopBudget = Math.max(loopLimit - completedLoops, 0);
  const resumeReady = stopReason === "loop_limit_reached" && remainingLoopBudget > 0;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerIds: Array.isArray(options.workerIds) ? options.workerIds : [],
    workerId: options.workerId ?? null,
    schedulerLane: options.schedulerLane ?? null,
    runtimeCycleLimit,
    runtimeSessionLimit,
    loopLimit,
    completedLoops,
    totalSessions,
    totalCycles,
    remainingLoopBudget,
    stopReason,
    resumeReady,
    sessions: normalizedSessions,
    nextAction: stopReason === "no_dispatchable_runtime"
      ? "No further worker runtime is dispatch-ready right now."
      : stopReason === "loop_limit_reached"
        ? "Resume this runtime loop to continue processing more runtime sessions."
        : stopReason === "dry_run_preview"
          ? "Remove dry-run to let the runtime loop advance across multiple session rounds."
          : stopReason === "manual_preview"
            ? "Use --apply to execute runtime loops instead of previewing the first round."
            : normalizedSessions.length === 0
              ? "No runtime loop round was executed."
              : "Inspect the latest runtime-loop summary before continuing."
  };
}

export function buildGithubWebhookServiceRuntimeLoopResumeContract(loopState, options = {}) {
  const normalizedLoopState = loopState ?? buildGithubWebhookServiceRuntimeLoopState([], options);
  return {
    contractKind: "runtime_loop_resume_contract",
    contractStatus: normalizedLoopState.resumeReady
      ? "dispatch_ready_runtime_loop_resume_contract"
      : "runtime_loop_resume_not_required",
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    loopStatePath: options.loopStatePath ?? null,
    workerIds: normalizedLoopState.workerIds ?? [],
    workerId: normalizedLoopState.workerId ?? null,
    schedulerLane: normalizedLoopState.schedulerLane ?? null,
    runtimeCycleLimit: normalizedLoopState.runtimeCycleLimit,
    runtimeSessionLimit: normalizedLoopState.runtimeSessionLimit,
    runtimeLoopLimit: normalizedLoopState.loopLimit,
    remainingLoopBudget: normalizedLoopState.remainingLoopBudget,
    resumeFromLoopIndex: normalizedLoopState.completedLoops + 1,
    loopState: normalizedLoopState
  };
}

export function renderGithubWebhookServiceRuntimeLoopSummary(loopState, receipts = []) {
  const sessionLines = loopState.sessions.length > 0
    ? loopState.sessions.map((session) => `- loop=${session.loopIndex}: sessions=${session.completedSessions} | cycles=${session.totalCycles} | runtimes=${session.runtimeCount} | dispatchable=${session.dispatchableRuntimeCount} | blocked_lanes=${session.blockedLaneCount} | queue=${session.queueCount} | session_stop=${session.sessionStopReason ?? "-"} | stop=${session.stopReason ?? "-"}${session.summaryPath ? ` | summary=${session.summaryPath}` : ""}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- loop=${receipt.loopIndex}: outcome=${receipt.outcome} | sessions=${receipt.completedSessions ?? 0} | cycles=${receipt.totalCycles ?? 0} | selected=${receipt.selectedCount ?? 0}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Loop

- generated_at: ${loopState.generatedAt}
- worker_ids: ${(loopState.workerIds ?? []).join(", ") || "-"}
- scheduler_lane_filter: ${loopState.schedulerLane ?? "-"}
- runtime_cycle_limit: ${loopState.runtimeCycleLimit}
- runtime_session_limit: ${loopState.runtimeSessionLimit}
- loop_limit: ${loopState.loopLimit}
- completed_loops: ${loopState.completedLoops}
- total_sessions: ${loopState.totalSessions}
- total_cycles: ${loopState.totalCycles}
- remaining_loop_budget: ${loopState.remainingLoopBudget}
- stop_reason: ${loopState.stopReason}
- resume_ready: ${loopState.resumeReady ? "yes" : "no"}

## Runtime Loop Rounds

${sessionLines}

## Loop Receipts

${receiptLines}

## Next Action

- ${loopState.nextAction}
`;
}
