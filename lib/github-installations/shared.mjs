export function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

export function normalizeInstallationGovernance(record = {}, options = {}) {
  const existing = record.governance ?? {};
  return {
    status: existing.status ?? "ungoverned",
    allowedProjects: unique(existing.allowedProjects ?? []),
    blockedRepositories: unique(existing.blockedRepositories ?? []),
    defaultMappedAction: existing.defaultMappedAction ?? "watchlist_candidate",
    defaultUnmappedAction: existing.defaultUnmappedAction ?? "manual_review",
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

export function normalizeInstallationRuntime(record = {}, options = {}) {
  const existing = record.runtime ?? {};
  return {
    status: existing.status ?? "runtime_unset",
    mode: existing.mode ?? "manual_only",
    autoWatchlistSync: existing.autoWatchlistSync ?? false,
    autoServiceEnabled: existing.autoServiceEnabled ?? false,
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

export function normalizeInstallationOperations(record = {}, options = {}) {
  const existing = record.operations ?? {};
  return {
    status: existing.status ?? "operations_unset",
    watchlistSyncStatus: existing.watchlistSyncStatus ?? "watchlist_sync_blocked",
    serviceStatus: existing.serviceStatus ?? "service_disabled",
    requeueBlockedAllowed: existing.requeueBlockedAllowed ?? false,
    requeueDeadLetterAllowed: existing.requeueDeadLetterAllowed ?? false,
    requeueClaimedAllowed: existing.requeueClaimedAllowed ?? false,
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

export function normalizeInstallationServiceLane(record = {}, options = {}) {
  const existing = record.serviceLane ?? {};
  return {
    status: existing.status ?? "lane_unset",
    laneMode: existing.laneMode ?? "manual_lane",
    tickDisposition: existing.tickDisposition ?? "manual_only",
    maxConcurrentClaims: Number(existing.maxConcurrentClaims ?? 1) > 0
      ? Number(existing.maxConcurrentClaims ?? 1)
      : 1,
    priority: existing.priority ?? "normal",
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

export function normalizeInstallationServicePlan(record = {}, options = {}) {
  const existing = record.servicePlan ?? {};
  return {
    status: existing.status ?? "schedule_unset",
    priority: existing.priority ?? "normal",
    tickBudget: Number(existing.tickBudget ?? 1) > 0
      ? Number(existing.tickBudget ?? 1)
      : 0,
    preferredContractKinds: Array.isArray(existing.preferredContractKinds) && existing.preferredContractKinds.length > 0
      ? unique(existing.preferredContractKinds)
      : ["execution_contract", "resume_contract", "recovery_contract"],
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

export function normalizeInstallationWorkerRouting(record = {}, options = {}) {
  const existing = record.workerRouting ?? {};
  return {
    status: existing.status ?? "routing_unset",
    schedulerLane: existing.schedulerLane ?? "shared_default",
    workerMode: existing.workerMode ?? "any_worker",
    assignedWorkerId: existing.assignedWorkerId ?? null,
    allowedWorkerIds: unique(existing.allowedWorkerIds ?? []),
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

export function normalizeInstallationServiceSchedule(record = {}, options = {}) {
  const existing = record.serviceSchedule ?? {};
  return {
    status: existing.status ?? "schedule_runtime_unset",
    schedulerLane: existing.schedulerLane ?? "shared_default",
    laneKey: existing.laneKey ?? "shared_default:shared_pool",
    workerScope: existing.workerScope ?? "shared_pool",
    preferredWorkerId: existing.preferredWorkerId ?? null,
    allowedWorkerIds: unique(existing.allowedWorkerIds ?? []),
    tickStrategy: existing.tickStrategy ?? "balanced",
    maxTicksPerCycle: Number(existing.maxTicksPerCycle ?? 1) > 0
      ? Number(existing.maxTicksPerCycle ?? 1)
      : 0,
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

export function findInstallationRecord(state, installationId) {
  const installations = Array.isArray(state?.installations) ? state.installations : [];
  if (!Number.isFinite(installationId)) {
    return null;
  }
  return installations.find((item) => item.installationId === installationId) ?? null;
}

export function buildGithubRepoUrl(fullName) {
  return fullName ? `https://github.com/${fullName}` : null;
}

export function normalizeInstallationScopeDecision(repository, installation, options = {}) {
  const governance = normalizeInstallationGovernance(installation);
  const runtime = normalizeInstallationRuntime(installation);
  const handoffStatus = repository.handoff?.status ?? null;
  const runtimeEnforced = options.runtimeAware !== false && runtime.status !== "runtime_unset";

  if (handoffStatus === "appended_urls" || handoffStatus === "no_changes") {
    return "already_handed_off";
  }

  if (governance.blockedRepositories.includes(repository.fullName)) {
    return "blocked_repository";
  }

  if (repository.mappedProjectKey) {
    if (governance.allowedProjects.length > 0 && !governance.allowedProjects.includes(repository.mappedProjectKey)) {
      return "governance_blocked";
    }
    if (runtimeEnforced && (runtime.mode === "manual_only" || runtime.autoWatchlistSync !== true)) {
      return "runtime_blocked";
    }
    return governance.defaultMappedAction ?? "watchlist_candidate";
  }
  return governance.defaultUnmappedAction ?? "manual_review";
}
