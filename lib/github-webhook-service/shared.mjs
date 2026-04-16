import path from "node:path";

export const SERVICE_QUEUE_DIR = path.join("state", "github-app-runner-queue");
export const ALLOWED_CONTRACT_KINDS = new Set(["execution_contract", "resume_contract", "recovery_contract"]);
export const DEFAULT_MAX_SERVICE_ATTEMPTS = 3;
export const SERVICE_REQUEUE_SOURCE_STATES = new Set(["blocked", "dead_letter", "claimed"]);

export function buildGithubWebhookServiceIdentity(contract) {
  return [
    contract.contractKind ?? "unknown",
    contract.deliveryId ?? contract.eventKey ?? "unknown",
    contract.selectedProjectKey ?? "-",
    contract.resumeFromCommand ?? "-"
  ].join("::");
}

export function normalizeGithubWebhookQueueStateLabel(queueState) {
  if (queueState == null || queueState === "") {
    return null;
  }
  if (queueState === "dead-letter") {
    return "dead_letter";
  }
  return queueState ?? "pending";
}

export function buildGithubWebhookServiceAdminEvent(action, options = {}) {
  return {
    action,
    at: options.at ?? new Date().toISOString(),
    fromState: options.fromState ?? null,
    toState: options.toState ?? null,
    workerId: options.workerId ?? null,
    notes: options.notes?.trim() || null
  };
}

export function appendGithubWebhookServiceAdminHistory(contract, event) {
  const history = Array.isArray(contract.serviceAdminHistory)
    ? contract.serviceAdminHistory
    : [];
  return [...history, event];
}

export function normalizeGithubWebhookServiceState(contract, options = {}) {
  const existing = contract.serviceState ?? {};
  return {
    identity: existing.identity ?? buildGithubWebhookServiceIdentity(contract),
    attemptCount: Number(existing.attemptCount ?? 0),
    maxAttempts: Number(existing.maxAttempts ?? options.maxServiceAttempts ?? contract.maxServiceAttempts ?? DEFAULT_MAX_SERVICE_ATTEMPTS),
    queuedAt: existing.queuedAt ?? options.queuedAt ?? new Date().toISOString(),
    lastQueuedState: existing.lastQueuedState ?? options.lastQueuedState ?? "pending",
    lastOutcome: existing.lastOutcome ?? null,
    deadLetterReason: existing.deadLetterReason ?? null,
    lastWorkerId: existing.lastWorkerId ?? null,
    lastClaimedAt: existing.lastClaimedAt ?? null
  };
}

export function applyGithubWebhookServiceState(contract, options = {}) {
  return {
    ...contract,
    serviceState: normalizeGithubWebhookServiceState(contract, options)
  };
}

export function slugifyContractSegment(value) {
  return String(value ?? "contract")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "contract";
}

export function buildQueuedContractFilename(contract, options = {}) {
  const prefix = options.timestamp ?? new Date().toISOString().replace(/[:.]/g, "-");
  const delivery = slugifyContractSegment(contract.deliveryId ?? contract.eventKey ?? "contract");
  const kind = slugifyContractSegment(contract.contractKind ?? "contract");
  return `${prefix}__${kind}__${delivery}.json`;
}

export function installationPriorityRank(priority) {
  switch (priority) {
    case "urgent":
      return 0;
    case "high":
      return 1;
    case "elevated":
      return 2;
    case "normal":
      return 3;
    case "idle":
      return 4;
    case "low":
      return 5;
    default:
      return 6;
  }
}

function tickStrategyRank(strategy) {
  switch (strategy) {
    case "recovery_first":
      return 0;
    case "priority_first":
      return 1;
    case "balanced":
      return 2;
    case "manual_dispatch":
      return 3;
    default:
      return 4;
  }
}

export function compareActionableServiceEntries(left, right) {
  const serviceScheduleDiff = String(left.installationScheduleLaneKey ?? "").localeCompare(String(right.installationScheduleLaneKey ?? ""));
  if (serviceScheduleDiff !== 0) {
    return serviceScheduleDiff;
  }

  const schedulerLaneDiff = String(left.schedulerLane ?? "").localeCompare(String(right.schedulerLane ?? ""));
  if (schedulerLaneDiff !== 0) {
    return schedulerLaneDiff;
  }

  const strategyDiff = tickStrategyRank(left.tickStrategy) - tickStrategyRank(right.tickStrategy);
  if (strategyDiff !== 0) {
    return strategyDiff;
  }

  const priorityDiff = installationPriorityRank(left.installationPlanPriority) - installationPriorityRank(right.installationPlanPriority);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  const preferenceDiff = Number(left.contractPreferenceRank ?? Number.MAX_SAFE_INTEGER) - Number(right.contractPreferenceRank ?? Number.MAX_SAFE_INTEGER);
  if (preferenceDiff !== 0) {
    return preferenceDiff;
  }

  return String(left.fileName ?? "").localeCompare(String(right.fileName ?? ""));
}

export function applyInstallationServiceLaneSelection(actionableEntries = [], options = {}) {
  const sortedEntries = [...actionableEntries].sort(compareActionableServiceEntries);
  const selectedEntries = [];
  const perInstallationCounts = new Map();
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null;

  for (const entry of sortedEntries) {
    if (limit && selectedEntries.length >= limit) {
      break;
    }

    const installationId = Number.isFinite(entry.installationId)
      ? Number(entry.installationId)
      : null;
    const scheduleBudget = Number.isFinite(entry.installationPlanTickBudget) && entry.installationPlanTickBudget >= 0
      ? Number(entry.installationPlanTickBudget)
      : null;
    const laneCap = Number.isFinite(entry.maxConcurrentClaims) && entry.maxConcurrentClaims > 0
      ? Number(entry.maxConcurrentClaims)
      : null;
    const scheduleCap = Number.isFinite(entry.maxTicksPerCycle) && entry.maxTicksPerCycle > 0
      ? Number(entry.maxTicksPerCycle)
      : null;
    const effectiveCap = scheduleBudget == null
      ? laneCap == null
        ? scheduleCap
        : scheduleCap == null
          ? laneCap
          : Math.min(laneCap, scheduleCap)
      : laneCap == null
        ? scheduleCap == null
          ? scheduleBudget
          : Math.min(scheduleBudget, scheduleCap)
        : scheduleCap == null
          ? Math.min(scheduleBudget, laneCap)
          : Math.min(scheduleBudget, laneCap, scheduleCap);

    if (installationId && effectiveCap != null) {
      const currentCount = perInstallationCounts.get(installationId) ?? 0;
      if (currentCount >= effectiveCap) {
        continue;
      }
      perInstallationCounts.set(installationId, currentCount + 1);
    }

    selectedEntries.push(entry);
  }

  return selectedEntries;
}

export function isExpiredLease(lease, options = {}) {
  if (!lease?.leaseExpiresAt) {
    return false;
  }
  const now = options.now ? new Date(options.now) : new Date();
  return now >= new Date(lease.leaseExpiresAt);
}
