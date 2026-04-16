import {
  findInstallationRecord,
  normalizeInstallationServiceLane,
  normalizeInstallationServicePlan,
  normalizeInstallationWorkerRouting,
  unique
} from "./shared.mjs";

export function assessGithubAppInstallationWorkerRouting(state, contract, options = {}) {
  const installationId = Number.isFinite(contract?.installationId)
    ? Number(contract.installationId)
    : null;
  const workerId = options.workerId ?? "local-worker";

  if (!installationId) {
    return {
      status: "no_installation_context",
      installationId: null,
      allowed: true,
      schedulerLane: "shared_default",
      workerMode: "any_worker",
      assignedWorkerId: null,
      nextAction: "This contract has no installation context, so installation worker routing does not apply."
    };
  }

  const installation = findInstallationRecord(state, installationId);
  if (!installation) {
    return {
      status: "installation_unregistered",
      installationId,
      allowed: false,
      schedulerLane: "unknown",
      workerMode: "unknown",
      assignedWorkerId: null,
      nextAction: "Persist or refresh the installation registry before worker-scoped routing can apply."
    };
  }

  const routing = normalizeInstallationWorkerRouting(installation);

  if (routing.status !== "routing_governed") {
    return {
      status: "routing_inferred_ready",
      installationId,
      installation,
      allowed: true,
      schedulerLane: "shared_default",
      workerMode: "any_worker",
      assignedWorkerId: null,
      nextAction: "No explicit installation worker routing is stored yet, so the shared service worker may process this installation."
    };
  }

  if (routing.workerMode === "manual_worker_release") {
    return {
      status: "routing_manual_guard",
      installationId,
      installation,
      allowed: false,
      schedulerLane: routing.schedulerLane,
      workerMode: routing.workerMode,
      assignedWorkerId: routing.assignedWorkerId,
      nextAction: "This installation stays behind a manual worker release and is excluded from automated worker ticks."
    };
  }

  if (routing.workerMode === "pinned_worker" && routing.assignedWorkerId && routing.assignedWorkerId !== workerId) {
    return {
      status: "routing_worker_mismatch",
      installationId,
      installation,
      allowed: false,
      schedulerLane: routing.schedulerLane,
      workerMode: routing.workerMode,
      assignedWorkerId: routing.assignedWorkerId,
      nextAction: `This installation is currently pinned to worker '${routing.assignedWorkerId}', not '${workerId}'.`
    };
  }

  if (routing.allowedWorkerIds.length > 0 && !routing.allowedWorkerIds.includes(workerId)) {
    return {
      status: "routing_worker_not_allowed",
      installationId,
      installation,
      allowed: false,
      schedulerLane: routing.schedulerLane,
      workerMode: routing.workerMode,
      assignedWorkerId: routing.assignedWorkerId,
      nextAction: `Worker '${workerId}' is not part of the allowed worker set for this installation.`
    };
  }

  return {
    status: "routing_ready",
    installationId,
    installation,
    allowed: true,
    schedulerLane: routing.schedulerLane,
    workerMode: routing.workerMode,
    assignedWorkerId: routing.assignedWorkerId,
    nextAction: "Installation worker routing allows this worker to process the contract."
  };
}

export function buildGithubAppInstallationWorkerRoutingPlan(state, queueEntries = [], options = {}) {
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
    const currentRouting = normalizeInstallationWorkerRouting(installation);
    const installationQueueEntries = queueEntries.filter((entry) => {
      return Number(entry.contract?.installationId) === Number(installation.installationId);
    });
    const blockedCount = installationQueueEntries.filter((entry) => entry.queueState === "blocked").length;
    const deadLetterCount = installationQueueEntries.filter((entry) => entry.queueState === "dead_letter").length;
    const pendingCount = installationQueueEntries.filter((entry) => entry.queueState === "pending").length;

    let suggestedStatus = "routing_governed";
    let suggestedSchedulerLane = "shared_default";
    let suggestedWorkerMode = "any_worker";
    let suggestedAssignedWorkerId = null;
    let suggestedAllowedWorkerIds = [];
    let recommendation = "Keep this installation on the shared worker pool until queue pressure or recovery needs justify stricter routing.";

    if (servicePlan.status !== "schedule_governed" || lane.status !== "lane_governed") {
      suggestedStatus = "routing_blocked";
      suggestedSchedulerLane = "manual";
      suggestedWorkerMode = "manual_worker_release";
      recommendation = "Persist lane and shared service plan first before assigning workers to this installation.";
    } else if (lane.tickDisposition === "manual_only" || servicePlan.tickBudget <= 0) {
      suggestedSchedulerLane = "manual";
      suggestedWorkerMode = "manual_worker_release";
      recommendation = "This installation remains outside automated worker routing until it is explicitly released.";
    } else if (servicePlan.priority === "urgent" || lane.tickDisposition === "recovery_tick" || deadLetterCount > 0 || blockedCount > 0) {
      suggestedSchedulerLane = "recovery_priority";
      suggestedWorkerMode = options.workerId ? "pinned_worker" : "any_worker";
      suggestedAssignedWorkerId = options.workerId ?? null;
      suggestedAllowedWorkerIds = options.workerId ? [options.workerId] : [];
      recommendation = "Recovery-heavy installations should prefer a dedicated recovery worker or lane when available.";
    } else if (servicePlan.priority === "high" && pendingCount > 0) {
      suggestedSchedulerLane = "priority";
      suggestedWorkerMode = "allowed_pool";
      suggestedAllowedWorkerIds = options.workerId ? [options.workerId] : [];
      recommendation = "High-priority installations should stay on a priority worker lane with a constrained worker pool.";
    }

    return {
      installationId: installation.installationId,
      accountLogin: installation.accountLogin ?? null,
      currentStatus: currentRouting.status,
      currentSchedulerLane: currentRouting.schedulerLane,
      currentWorkerMode: currentRouting.workerMode,
      currentAssignedWorkerId: currentRouting.assignedWorkerId,
      currentAllowedWorkerIds: currentRouting.allowedWorkerIds,
      laneStatus: lane.status,
      laneMode: lane.laneMode,
      planStatus: servicePlan.status,
      planPriority: servicePlan.priority,
      planTickBudget: servicePlan.tickBudget,
      queueCount: installationQueueEntries.length,
      pendingCount,
      blockedCount,
      deadLetterCount,
      suggestedStatus,
      suggestedSchedulerLane,
      suggestedWorkerMode,
      suggestedAssignedWorkerId,
      suggestedAllowedWorkerIds,
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
      ? "Review the installation worker routing and persist it before relying on worker-scoped service ticks."
      : "No installation records match the current worker-routing filter."
  };
}

export function renderGithubAppInstallationWorkerRoutingSummary(plan, receipts = []) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => `- installation=${entry.installationId}: current=${entry.currentStatus}:${entry.currentSchedulerLane}/${entry.currentWorkerMode}${entry.currentAssignedWorkerId ? `:${entry.currentAssignedWorkerId}` : ""} | lane=${entry.laneStatus}:${entry.laneMode} | service_plan=${entry.planStatus}:${entry.planPriority}/budget=${entry.planTickBudget} | suggested=${entry.suggestedStatus}:${entry.suggestedSchedulerLane}/${entry.suggestedWorkerMode}${entry.suggestedAssignedWorkerId ? `:${entry.suggestedAssignedWorkerId}` : ""} | pending=${entry.pendingCount} | blocked=${entry.blockedCount} | dead_letter=${entry.deadLetterCount}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- installation=${receipt.installationId}: status=${receipt.status} | lane=${receipt.schedulerLane} | worker_mode=${receipt.workerMode} | assigned_worker=${receipt.assignedWorkerId ?? "-"} | allowed_workers=${receipt.allowedWorkerIds.join(",") || "-"} | notes=${receipt.notes ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Worker Routing

- generated_at: ${plan.generatedAt}
- installation_filter: ${plan.installationId ?? "-"}
- project_filter: ${plan.project ?? "-"}
- worker_id: ${plan.workerId}
- installation_count: ${plan.installationCount}

## Routing Entries

${entryLines}

## Routing Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function applyGithubAppInstallationWorkerRoutingToState(currentState, plan, options = {}) {
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

    const routing = normalizeInstallationWorkerRouting(installation, {
      override: {
        status: entry.suggestedStatus,
        schedulerLane: entry.suggestedSchedulerLane,
        workerMode: entry.suggestedWorkerMode,
        assignedWorkerId: entry.suggestedAssignedWorkerId,
        allowedWorkerIds: entry.suggestedAllowedWorkerIds,
        lastReviewedAt: reviewedAt,
        notes: unique([...(installation.workerRouting?.notes ?? []), options.notes?.trim() || null]),
        history: [
          ...((installation.workerRouting?.history ?? [])),
          {
            at: reviewedAt,
            action: "worker_routing_reviewed",
            schedulerLane: entry.suggestedSchedulerLane,
            workerMode: entry.suggestedWorkerMode,
            assignedWorkerId: entry.suggestedAssignedWorkerId,
            allowedWorkerIds: entry.suggestedAllowedWorkerIds,
            notes: options.notes?.trim() || null
          }
        ]
      }
    });

    installation.workerRouting = routing;
    receipts.push({
      installationId: installation.installationId,
      status: routing.status,
      schedulerLane: routing.schedulerLane,
      workerMode: routing.workerMode,
      assignedWorkerId: routing.assignedWorkerId,
      allowedWorkerIds: routing.allowedWorkerIds,
      notes: options.notes?.trim() || null
    });
  }

  return {
    receipts,
    nextState: {
      schemaVersion: 1,
      updatedAt: reviewedAt,
      installations
    }
  };
}
