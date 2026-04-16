export function buildGithubWebhookServiceRuntimeCyclePlan(cycles = [], options = {}) {
  const normalizedCycles = Array.isArray(cycles)
    ? cycles.map((cycle, index) => ({
        cycleIndex: Number.isFinite(cycle.cycleIndex) ? Number(cycle.cycleIndex) : index + 1,
        runtimeCount: Number(cycle.runtimeCount ?? 0),
        dispatchableRuntimeCount: Number(cycle.dispatchableRuntimeCount ?? 0),
        blockedLaneCount: Number(cycle.blockedLaneCount ?? 0),
        queueCount: Number(cycle.queueCount ?? 0),
        stopReason: cycle.stopReason ?? null,
        summaryPath: cycle.summaryPath ?? null
      }))
    : [];

  const finalCycle = normalizedCycles[normalizedCycles.length - 1] ?? null;
  const stopReason = options.stopReason
    ?? finalCycle?.stopReason
    ?? (normalizedCycles.length === 0 ? "no_cycles" : "unknown");

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerIds: Array.isArray(options.workerIds) ? options.workerIds : [],
    cycleLimit: Number.isFinite(options.cycleLimit) && options.cycleLimit > 0
      ? Number(options.cycleLimit)
      : 1,
    completedCycles: normalizedCycles.length,
    stopReason,
    cycles: normalizedCycles,
    nextAction: stopReason === "no_dispatchable_runtime"
      ? "No further worker runtime is dispatch-ready right now."
      : stopReason === "cycle_limit_reached"
        ? "Increase the runtime cycle limit if more worker-runtime passes should be attempted."
        : stopReason === "dry_run_preview"
          ? "Remove dry-run to let the runtime cycle advance the queue across multiple rounds."
          : stopReason === "manual_preview"
            ? "Use --apply to execute runtime cycles instead of just previewing the first round."
            : normalizedCycles.length === 0
              ? "No runtime cycle was executed."
              : "Inspect the latest runtime-cycle summary before continuing."
  };
}

export function renderGithubWebhookServiceRuntimeCycleSummary(plan, receipts = []) {
  const cycleLines = plan.cycles.length > 0
    ? plan.cycles.map((cycle) => `- cycle=${cycle.cycleIndex}: runtimes=${cycle.runtimeCount} | dispatchable=${cycle.dispatchableRuntimeCount} | blocked_lanes=${cycle.blockedLaneCount} | queue=${cycle.queueCount} | stop=${cycle.stopReason ?? "-"}${cycle.summaryPath ? ` | summary=${cycle.summaryPath}` : ""}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- cycle=${receipt.cycleIndex}: outcome=${receipt.outcome} | runtimes=${receipt.runtimeCount ?? 0} | selected=${receipt.selectedCount ?? 0}${receipt.summaryPath ? ` | summary=${receipt.summaryPath}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Cycle

- generated_at: ${plan.generatedAt}
- worker_ids: ${(plan.workerIds ?? []).join(", ") || "-"}
- cycle_limit: ${plan.cycleLimit}
- completed_cycles: ${plan.completedCycles}
- stop_reason: ${plan.stopReason}

## Runtime Cycles

${cycleLines}

## Cycle Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}
