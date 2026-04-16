import fs from "node:fs/promises";
import path from "node:path";

import { assessGithubAppInstallationServiceAdmin } from "../github-installations.mjs";
import { safeReadDirEntries } from "../utils.mjs";
import { getGithubWebhookServicePaths } from "./queue-store.mjs";
import {
  DEFAULT_MAX_SERVICE_ATTEMPTS,
  SERVICE_REQUEUE_SOURCE_STATES,
  appendGithubWebhookServiceAdminHistory,
  buildGithubWebhookServiceAdminEvent,
  isExpiredLease,
  normalizeGithubWebhookServiceState
} from "./shared.mjs";

export function buildGithubWebhookServiceLease(options = {}) {
  const claimedAt = options.claimedAt ?? new Date().toISOString();
  const leaseMinutes = Number.isFinite(options.leaseMinutes) && options.leaseMinutes > 0
    ? Number(options.leaseMinutes)
    : 15;
  const leaseExpiresAt = new Date(new Date(claimedAt).getTime() + (leaseMinutes * 60 * 1000)).toISOString();
  return {
    workerId: options.workerId ?? "local-worker",
    claimedAt,
    leaseMinutes,
    leaseExpiresAt
  };
}

async function moveGithubWebhookServiceContract(sourcePath, targetPath, contract, options = {}) {
  if (options.dryRun) {
    return;
  }
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(contract, null, 2)}\n`, "utf8");
  await fs.unlink(sourcePath);
}

export async function reclaimExpiredGithubWebhookServiceClaims(rootDir, options = {}) {
  const paths = getGithubWebhookServicePaths(rootDir);
  const entries = await safeReadDirEntries(paths.claimedPath);
  const reclaimed = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const sourcePath = path.join(paths.claimedPath, entry.name);
    const raw = await fs.readFile(sourcePath, "utf8");
    const contract = JSON.parse(raw);
    if (!isExpiredLease(contract.serviceLease, options)) {
      continue;
    }

    const releasedContract = {
      ...contract,
      serviceLease: null,
      serviceState: {
        ...normalizeGithubWebhookServiceState(contract),
        lastQueuedState: "pending",
        lastOutcome: "lease_reclaimed"
      }
    };
    const targetPath = path.join(paths.pendingPath, entry.name);

    await moveGithubWebhookServiceContract(sourcePath, targetPath, releasedContract, options);

    reclaimed.push({
      fileName: entry.name,
      sourcePath,
      targetPath
    });
  }

  return reclaimed;
}

export async function claimGithubWebhookServiceQueueEntries(rootDir, selectedEntries = [], options = {}) {
  const paths = getGithubWebhookServicePaths(rootDir);
  const claimed = [];
  const deadLettered = [];

  for (const entry of selectedEntries) {
    const raw = await fs.readFile(entry.contractPath, "utf8");
    const contract = JSON.parse(raw);
    const state = normalizeGithubWebhookServiceState(contract, {
      maxServiceAttempts: options.maxServiceAttempts
    });
    const nextAttemptCount = Number(state.attemptCount ?? 0) + 1;
    if (nextAttemptCount > Number(state.maxAttempts ?? DEFAULT_MAX_SERVICE_ATTEMPTS)) {
      const deadLetterContract = {
        ...contract,
        serviceLease: null,
        serviceState: {
          ...state,
          attemptCount: nextAttemptCount,
          lastQueuedState: "dead_letter",
          lastOutcome: "max_service_attempts_exhausted",
          deadLetterReason: "max_service_attempts_exhausted"
        },
        nextAction: "Inspect and explicitly requeue this contract before any further service attempt."
      };
      const targetPath = path.join(paths.deadLetterPath, entry.fileName);
      await moveGithubWebhookServiceContract(entry.contractPath, targetPath, deadLetterContract, options);
      deadLettered.push({
        ...entry,
        contract: deadLetterContract,
        contractPath: targetPath,
        queueState: "dead_letter"
      });
      continue;
    }
    const lease = buildGithubWebhookServiceLease({
      workerId: options.workerId,
      claimedAt: options.claimedAt,
      leaseMinutes: options.leaseMinutes
    });
    const claimedContract = {
      ...contract,
      serviceLease: lease,
      serviceState: {
        ...state,
        attemptCount: nextAttemptCount,
        lastQueuedState: "claimed",
        lastOutcome: "claimed",
        lastWorkerId: lease.workerId,
        lastClaimedAt: lease.claimedAt
      }
    };
    const targetPath = path.join(paths.claimedPath, entry.fileName);

    await moveGithubWebhookServiceContract(entry.contractPath, targetPath, claimedContract, options);

    claimed.push({
      ...entry,
      contract: claimedContract,
      contractPath: targetPath,
      queueState: "claimed"
    });
  }

  return {
    claimed,
    deadLettered
  };
}

export async function requeueGithubWebhookServiceQueueEntries(rootDir, selectedEntries = [], options = {}) {
  const paths = getGithubWebhookServicePaths(rootDir);
  const receipts = [];

  for (const entry of selectedEntries) {
    if (!SERVICE_REQUEUE_SOURCE_STATES.has(entry.queueState)) {
      receipts.push({
        fileName: entry.fileName,
        outcome: "skipped_unsupported_state",
        fromState: entry.queueState,
        targetState: entry.queueState,
        notes: options.notes?.trim() || null
      });
      continue;
    }

    if (entry.queueState === "claimed" && entry.contract?.serviceLease?.workerId && !options.force) {
      receipts.push({
        fileName: entry.fileName,
        outcome: "blocked_force_required",
        fromState: entry.queueState,
        targetState: entry.queueState,
        notes: options.notes?.trim() || null
      });
      continue;
    }

    const adminAssessment = assessGithubAppInstallationServiceAdmin(options.installationState, entry.contract ?? {}, {
      queueState: entry.queueState
    });
    if (!adminAssessment.allowed) {
      receipts.push({
        fileName: entry.fileName,
        outcome: "blocked_installation_policy",
        fromState: entry.queueState,
        targetState: entry.queueState,
        notes: options.notes?.trim() || null
      });
      continue;
    }

    const raw = await fs.readFile(entry.contractPath, "utf8");
    const contract = JSON.parse(raw);
    const event = buildGithubWebhookServiceAdminEvent("manual_requeue", {
      at: options.at,
      fromState: entry.queueState,
      toState: "pending",
      workerId: options.workerId,
      notes: options.notes
    });
    const requeuedContract = {
      ...contract,
      serviceLease: null,
      nextAction: "Resume service processing from the pending queue.",
      serviceAdminHistory: appendGithubWebhookServiceAdminHistory(contract, event),
      serviceState: {
        ...normalizeGithubWebhookServiceState(contract, {
          maxServiceAttempts: options.maxServiceAttempts
        }),
        lastQueuedState: "pending",
        lastOutcome: "manually_requeued",
        deadLetterReason: null,
        lastWorkerId: options.workerId ?? null
      }
    };
    const targetPath = path.join(paths.pendingPath, entry.fileName);
    await moveGithubWebhookServiceContract(entry.contractPath, targetPath, requeuedContract, options);
    receipts.push({
      fileName: entry.fileName,
      outcome: "requeued",
      fromState: entry.queueState,
      targetState: "pending",
      notes: options.notes?.trim() || null,
      targetPath
    });
  }

  return receipts;
}
