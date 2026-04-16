import {
  findInstallationRecord,
  normalizeInstallationServiceLane,
  normalizeInstallationServicePlan,
  normalizeInstallationServiceSchedule,
  normalizeInstallationWorkerRouting,
  unique
} from "./shared.mjs";

function deriveWorkerScope(routing) {
  if (routing.workerMode === "manual_worker_release") {
    return {
      workerScope: "manual_release",
      preferredWorkerId: null,
      allowedWorkerIds: []
    };
  }

  if (routing.workerMode === "pinned_worker" && routing.assignedWorkerId) {
    return {
      workerScope: "pinned_worker",
      preferredWorkerId: routing.assignedWorkerId,
      allowedWorkerIds: [routing.assignedWorkerId]
    };
  }

  if (routing.workerMode === "allowed_pool") {
    return {
      workerScope: "allowed_pool",
      preferredWorkerId: null,
      allowedWorkerIds: routing.allowedWorkerIds
    };
  }

  return {
    workerScope: "shared_pool",
    preferredWorkerId: routing.assignedWorkerId ?? null,
    allowedWorkerIds: routing.allowedWorkerIds
  };
}

function buildScheduleLaneKey(schedulerLane, workerScope, preferredWorkerId = null) {
  if (workerScope === "pinned_worker" && preferredWorkerId) {
    return `${schedulerLane}:worker:${preferredWorkerId}`;
  }
  return `${schedulerLane}:${workerScope}`;
}

function deriveTickStrategy({ schedulerLane, servicePlan, lane, blockedCount, deadLetterCount }) {
  if (schedulerLane === "recovery_priority" || lane.tickDisposition === "recovery_tick" || deadLetterCount > 0 || blockedCount > 0) {
    return "recovery_first";
  }
  if (servicePlan.priority === "urgent" || servicePlan.priority === "high") {
    return "priority_first";
  }
  return "balanced";
}

function inferInstallationServiceScheduleFromRecord(installation) {
  const lane = normalizeInstallationServiceLane(installation);
  const servicePlan = normalizeInstallationServicePlan(installation);
  const routing = normalizeInstallationWorkerRouting(installation);
  const currentSchedule = normalizeInstallationServiceSchedule(installation);
  const queueStats = {
    blockedCount: 0,
    deadLetterCount: 0
  };

  if (
    lane.status !== "lane_governed"
    || servicePlan.status !== "schedule_governed"
    || routing.status !== "routing_governed"
    || lane.tickDisposition === "manual_only"
    || servicePlan.tickBudget <= 0
    || routing.workerMode === "manual_worker_release"
  ) {
    return normalizeInstallationServiceSchedule(currentSchedule, {
      override: {
        status: currentSchedule.status === "schedule_runtime_governed" ? currentSchedule.status : "schedule_runtime_inferred_ready",
        schedulerLane: routing.schedulerLane ?? "shared_default",
        laneKey: buildScheduleLaneKey(routing.schedulerLane ?? "shared_default", "shared_pool"),
        workerScope: "shared_pool",
        preferredWorkerId: routing.assignedWorkerId ?? null,
        allowedWorkerIds: routing.allowedWorkerIds ?? [],
        tickStrategy: "balanced",
        maxTicksPerCycle: Math.max(1, Math.min(lane.maxConcurrentClaims ?? 1, servicePlan.tickBudget > 0 ? servicePlan.tickBudget : 1))
      }
    });
  }

  const workerScope = deriveWorkerScope(routing);
  const tickStrategy = deriveTickStrategy({
    schedulerLane: routing.schedulerLane,
    servicePlan,
    lane,
    ...queueStats
  });

  return normalizeInstallationServiceSchedule(currentSchedule, {
    override: {
      status: currentSchedule.status === "schedule_runtime_governed"
        ? currentSchedule.status
        : "schedule_runtime_inferred_ready",
      schedulerLane: routing.schedulerLane,
      laneKey: buildScheduleLaneKey(routing.schedulerLane, workerScope.workerScope, workerScope.preferredWorkerId),
      workerScope: workerScope.workerScope,
      preferredWorkerId: workerScope.preferredWorkerId,
      allowedWorkerIds: workerScope.allowedWorkerIds,
      tickStrategy,
      maxTicksPerCycle: Math.max(1, Math.min(lane.maxConcurrentClaims, servicePlan.tickBudget))
    }
  });
}

export function assessGithubAppInstallationServiceSchedule(state, contract, options = {}) {
  const installationId = Number.isFinite(contract?.installationId)
    ? Number(contract.installationId)
    : null;
  const requestedSchedulerLane = options.schedulerLane ?? null;

  if (!installationId) {
    const laneKey = "unscoped:shared_pool";
    const allowed = !requestedSchedulerLane || requestedSchedulerLane === "all" || requestedSchedulerLane === "unscoped" || requestedSchedulerLane === laneKey;
    return {
      status: allowed ? "no_installation_context" : "schedule_lane_filtered",
      installationId: null,
      allowed,
      schedulerLane: "unscoped",
      laneKey,
      workerScope: "shared_pool",
      preferredWorkerId: null,
      allowedWorkerIds: [],
      tickStrategy: "balanced",
      maxTicksPerCycle: 1,
      nextAction: allowed
        ? "This contract has no installation context, so scheduler-scoped installation service schedules do not apply."
        : `This contract has no installation scope and does not match the requested scheduler lane '${requestedSchedulerLane}'.`
    };
  }

  const installation = findInstallationRecord(state, installationId);
  if (!installation) {
    return {
      status: "installation_unregistered",
      installationId,
      allowed: false,
      schedulerLane: "unknown",
      laneKey: "unknown:unknown",
      workerScope: "unknown",
      preferredWorkerId: null,
      allowedWorkerIds: [],
      tickStrategy: "balanced",
      maxTicksPerCycle: 0,
      nextAction: "Persist or refresh the installation registry before scheduler-scoped service plans can apply."
    };
  }

  const currentSchedule = normalizeInstallationServiceSchedule(installation);
  const effectiveSchedule = currentSchedule.status === "schedule_runtime_governed" || currentSchedule.status === "schedule_runtime_blocked"
    ? currentSchedule
    : inferInstallationServiceScheduleFromRecord(installation);

  const laneMatches = !requestedSchedulerLane
    || requestedSchedulerLane === "all"
    || requestedSchedulerLane === effectiveSchedule.schedulerLane
    || requestedSchedulerLane === effectiveSchedule.laneKey;

  if (!laneMatches) {
    return {
      status: "schedule_lane_filtered",
      installationId,
      installation,
      allowed: false,
      schedulerLane: effectiveSchedule.schedulerLane,
      laneKey: effectiveSchedule.laneKey,
      workerScope: effectiveSchedule.workerScope,
      preferredWorkerId: effectiveSchedule.preferredWorkerId,
      allowedWorkerIds: effectiveSchedule.allowedWorkerIds,
      tickStrategy: effectiveSchedule.tickStrategy,
      maxTicksPerCycle: effectiveSchedule.maxTicksPerCycle,
      nextAction: `This installation is scheduled for lane '${effectiveSchedule.laneKey}', not '${requestedSchedulerLane}'.`
    };
  }

  if (effectiveSchedule.status === "schedule_runtime_blocked") {
    return {
      status: "schedule_runtime_blocked",
      installationId,
      installation,
      allowed: false,
      schedulerLane: effectiveSchedule.schedulerLane,
      laneKey: effectiveSchedule.laneKey,
      workerScope: effectiveSchedule.workerScope,
      preferredWorkerId: effectiveSchedule.preferredWorkerId,
      allowedWorkerIds: effectiveSchedule.allowedWorkerIds,
      tickStrategy: effectiveSchedule.tickStrategy,
      maxTicksPerCycle: effectiveSchedule.maxTicksPerCycle,
      nextAction: "This installation stays outside scheduler-scoped service runs until its runtime schedule is explicitly released."
    };
  }

  return {
    status: effectiveSchedule.status === "schedule_runtime_governed"
      ? "schedule_runtime_ready"
      : "schedule_runtime_inferred_ready",
    installationId,
    installation,
    allowed: true,
    schedulerLane: effectiveSchedule.schedulerLane,
    laneKey: effectiveSchedule.laneKey,
    workerScope: effectiveSchedule.workerScope,
    preferredWorkerId: effectiveSchedule.preferredWorkerId,
    allowedWorkerIds: effectiveSchedule.allowedWorkerIds,
    tickStrategy: effectiveSchedule.tickStrategy,
    maxTicksPerCycle: effectiveSchedule.maxTicksPerCycle,
    nextAction: "Installation service schedule allows this contract to participate in the requested scheduler lane."
  };
}

export function buildGithubAppInstallationServiceSchedulePlan(state, queueEntries = [], options = {}) {
  const installations = Array.isArray(state.installations) ? state.installations : [];
  const selectedInstallations = installations.filter((installation) => {
    if (!Number.isFinite(options.installationId)) {
      return true;
    }
    return installation.installationId === options.installationId;
  });

  const entries = selectedInstallations.map((installation) => {
    const lane = normalizeInstallationServiceLane(installation);
    const servicePlan = normalizeInstallationServicePlan(installation);
    const routing = normalizeInstallationWorkerRouting(installation);
    const currentSchedule = normalizeInstallationServiceSchedule(installation);
    const installationQueueEntries = queueEntries.filter((entry) => {
      return Number(entry.contract?.installationId) === Number(installation.installationId);
    });
    const pendingCount = installationQueueEntries.filter((entry) => entry.queueState === "pending").length;
    const blockedCount = installationQueueEntries.filter((entry) => entry.queueState === "blocked").length;
    const deadLetterCount = installationQueueEntries.filter((entry) => entry.queueState === "dead_letter").length;
    const claimedCount = installationQueueEntries.filter((entry) => entry.queueState === "claimed").length;

    let suggestedStatus = "schedule_runtime_governed";
    let suggestedSchedulerLane = "shared_default";
    let suggestedWorkerScope = "shared_pool";
    let suggestedPreferredWorkerId = null;
    let suggestedAllowedWorkerIds = [];
    let suggestedTickStrategy = "balanced";
    let suggestedMaxTicksPerCycle = 1;
    let recommendation = "Keep this installation on a shared scheduler lane until queue pressure or worker affinity requires stronger separation.";

    if (
      lane.status !== "lane_governed"
      || servicePlan.status !== "schedule_governed"
      || routing.status !== "routing_governed"
    ) {
      suggestedStatus = "schedule_runtime_blocked";
      suggestedSchedulerLane = "manual";
      suggestedWorkerScope = "manual_release";
      suggestedTickStrategy = "manual_dispatch";
      suggestedMaxTicksPerCycle = 0;
      recommendation = "Persist lane, shared service plan and worker routing first before this installation joins scheduler-scoped runtime lanes.";
    } else if (
      lane.tickDisposition === "manual_only"
      || servicePlan.tickBudget <= 0
      || routing.workerMode === "manual_worker_release"
    ) {
      suggestedStatus = "schedule_runtime_blocked";
      suggestedSchedulerLane = "manual";
      suggestedWorkerScope = "manual_release";
      suggestedTickStrategy = "manual_dispatch";
      suggestedMaxTicksPerCycle = 0;
      recommendation = "This installation remains behind manual runtime release until queue pressure and worker ownership are explicitly cleared.";
    } else {
      const workerScope = deriveWorkerScope(routing);
      suggestedSchedulerLane = routing.schedulerLane;
      suggestedWorkerScope = workerScope.workerScope;
      suggestedPreferredWorkerId = workerScope.preferredWorkerId;
      suggestedAllowedWorkerIds = workerScope.allowedWorkerIds;
      suggestedTickStrategy = deriveTickStrategy({
        schedulerLane: routing.schedulerLane,
        servicePlan,
        lane,
        blockedCount,
        deadLetterCount
      });
      suggestedMaxTicksPerCycle = Math.max(1, Math.min(lane.maxConcurrentClaims, servicePlan.tickBudget));
      recommendation = suggestedTickStrategy === "recovery_first"
        ? "Use a recovery-focused scheduler lane for this installation until blocked and dead-letter pressure drops."
        : suggestedWorkerScope === "pinned_worker"
          ? "Keep this installation on a dedicated worker lane so its pinned worker affinity stays explicit."
          : "This installation can share a scheduler lane with worker-aware caps and tick strategy.";
    }

    return {
      installationId: installation.installationId,
      accountLogin: installation.accountLogin ?? null,
      currentStatus: currentSchedule.status,
      currentSchedulerLane: currentSchedule.schedulerLane,
      currentLaneKey: currentSchedule.laneKey,
      currentWorkerScope: currentSchedule.workerScope,
      currentPreferredWorkerId: currentSchedule.preferredWorkerId,
      currentTickStrategy: currentSchedule.tickStrategy,
      currentMaxTicksPerCycle: currentSchedule.maxTicksPerCycle,
      laneStatus: lane.status,
      laneMode: lane.laneMode,
      tickDisposition: lane.tickDisposition,
      planStatus: servicePlan.status,
      planPriority: servicePlan.priority,
      planTickBudget: servicePlan.tickBudget,
      routingStatus: routing.status,
      routingSchedulerLane: routing.schedulerLane,
      routingWorkerMode: routing.workerMode,
      queueCount: installationQueueEntries.length,
      pendingCount,
      claimedCount,
      blockedCount,
      deadLetterCount,
      suggestedStatus,
      suggestedSchedulerLane,
      suggestedLaneKey: buildScheduleLaneKey(suggestedSchedulerLane, suggestedWorkerScope, suggestedPreferredWorkerId),
      suggestedWorkerScope,
      suggestedPreferredWorkerId,
      suggestedAllowedWorkerIds,
      suggestedTickStrategy,
      suggestedMaxTicksPerCycle,
      recommendation
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    installationId: Number.isFinite(options.installationId) ? options.installationId : null,
    project: options.project ?? null,
    workerId: options.workerId ?? "local-worker",
    installationCount: selectedInstallations.length,
    entries,
    nextAction: entries.length > 0
      ? "Review the installation runtime schedule and persist it before relying on scheduler-scoped multi-worker service ticks."
      : "No installation records match the current service-schedule filter."
  };
}

export function renderGithubAppInstallationServiceScheduleSummary(plan, receipts = []) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => `- installation=${entry.installationId}: current=${entry.currentStatus}:${entry.currentLaneKey}/${entry.currentTickStrategy}/cap=${entry.currentMaxTicksPerCycle} | lane=${entry.laneStatus}:${entry.laneMode}/${entry.tickDisposition} | service_plan=${entry.planStatus}:${entry.planPriority}/budget=${entry.planTickBudget} | routing=${entry.routingStatus}:${entry.routingSchedulerLane}/${entry.routingWorkerMode} | suggested=${entry.suggestedStatus}:${entry.suggestedLaneKey}/${entry.suggestedTickStrategy}/cap=${entry.suggestedMaxTicksPerCycle} | pending=${entry.pendingCount} | blocked=${entry.blockedCount} | dead_letter=${entry.deadLetterCount}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- installation=${receipt.installationId}: status=${receipt.status} | lane_key=${receipt.laneKey} | worker_scope=${receipt.workerScope} | preferred_worker=${receipt.preferredWorkerId ?? "-"} | tick_strategy=${receipt.tickStrategy} | cap=${receipt.maxTicksPerCycle} | notes=${receipt.notes ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Service Schedule

- generated_at: ${plan.generatedAt}
- installation_filter: ${plan.installationId ?? "-"}
- project_filter: ${plan.project ?? "-"}
- worker_id: ${plan.workerId}
- installation_count: ${plan.installationCount}

## Schedule Entries

${entryLines}

## Schedule Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function applyGithubAppInstallationServiceScheduleToState(currentState, plan, options = {}) {
  const installations = Array.isArray(currentState.installations)
    ? structuredClone(currentState.installations)
    : [];
  const receipts = [];
  const reviewedAt = options.at ?? new Date().toISOString();

  for (const entry of plan.entries) {
    const installation = installations.find((item) => item.installationId === entry.installationId);
    if (!installation) {
      continue;
    }

    const serviceSchedule = normalizeInstallationServiceSchedule(installation, {
      override: {
        status: entry.suggestedStatus,
        schedulerLane: entry.suggestedSchedulerLane,
        laneKey: entry.suggestedLaneKey,
        workerScope: entry.suggestedWorkerScope,
        preferredWorkerId: entry.suggestedPreferredWorkerId,
        allowedWorkerIds: entry.suggestedAllowedWorkerIds,
        tickStrategy: entry.suggestedTickStrategy,
        maxTicksPerCycle: entry.suggestedMaxTicksPerCycle,
        lastReviewedAt: reviewedAt,
        notes: unique([...(installation.serviceSchedule?.notes ?? []), options.notes?.trim() || null]),
        history: [
          ...((installation.serviceSchedule?.history ?? [])),
          {
            at: reviewedAt,
            action: "service_schedule_reviewed",
            laneKey: entry.suggestedLaneKey,
            workerScope: entry.suggestedWorkerScope,
            preferredWorkerId: entry.suggestedPreferredWorkerId,
            allowedWorkerIds: entry.suggestedAllowedWorkerIds,
            tickStrategy: entry.suggestedTickStrategy,
            maxTicksPerCycle: entry.suggestedMaxTicksPerCycle,
            notes: options.notes?.trim() || null
          }
        ]
      }
    });

    installation.serviceSchedule = serviceSchedule;
    receipts.push({
      installationId: installation.installationId,
      status: serviceSchedule.status,
      schedulerLane: serviceSchedule.schedulerLane,
      laneKey: serviceSchedule.laneKey,
      workerScope: serviceSchedule.workerScope,
      preferredWorkerId: serviceSchedule.preferredWorkerId,
      allowedWorkerIds: serviceSchedule.allowedWorkerIds,
      tickStrategy: serviceSchedule.tickStrategy,
      maxTicksPerCycle: serviceSchedule.maxTicksPerCycle,
      notes: options.notes?.trim() || null
    });
  }

  return {
    nextState: {
      schemaVersion: 1,
      updatedAt: reviewedAt,
      installations
    },
    receipts
  };
}
