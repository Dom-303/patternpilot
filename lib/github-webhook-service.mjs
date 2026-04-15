import fs from "node:fs/promises";
import path from "node:path";

import { assessGithubAppInstallationOperations, assessGithubAppInstallationServiceAdmin } from "./github-installations.mjs";
import { safeReadDirEntries } from "./utils.mjs";
import { evaluateGithubWebhookRecoveryContract } from "./github-webhook-runner.mjs";

const SERVICE_QUEUE_DIR = path.join("state", "github-app-runner-queue");
const ALLOWED_CONTRACT_KINDS = new Set(["execution_contract", "resume_contract", "recovery_contract"]);
const DEFAULT_MAX_SERVICE_ATTEMPTS = 3;
const SERVICE_REQUEUE_SOURCE_STATES = new Set(["blocked", "dead_letter", "claimed"]);

export function getGithubWebhookServicePaths(rootDir) {
  const rootPath = path.join(rootDir, SERVICE_QUEUE_DIR);
  return {
    rootPath,
    pendingPath: path.join(rootPath, "pending"),
    claimedPath: path.join(rootPath, "claimed"),
    blockedPath: path.join(rootPath, "blocked"),
    deadLetterPath: path.join(rootPath, "dead-letter"),
    processedPath: path.join(rootPath, "processed")
  };
}

function buildGithubWebhookServiceIdentity(contract) {
  return [
    contract.contractKind ?? "unknown",
    contract.deliveryId ?? contract.eventKey ?? "unknown",
    contract.selectedProjectKey ?? "-",
    contract.resumeFromCommand ?? "-"
  ].join("::");
}

function normalizeGithubWebhookQueueStateLabel(queueState) {
  if (queueState == null || queueState === "") {
    return null;
  }
  if (queueState === "dead-letter") {
    return "dead_letter";
  }
  return queueState ?? "pending";
}

function buildGithubWebhookServiceAdminEvent(action, options = {}) {
  return {
    action,
    at: options.at ?? new Date().toISOString(),
    fromState: options.fromState ?? null,
    toState: options.toState ?? null,
    workerId: options.workerId ?? null,
    notes: options.notes?.trim() || null
  };
}

function appendGithubWebhookServiceAdminHistory(contract, event) {
  const history = Array.isArray(contract.serviceAdminHistory)
    ? contract.serviceAdminHistory
    : [];
  return [...history, event];
}

function normalizeGithubWebhookServiceState(contract, options = {}) {
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

function applyGithubWebhookServiceState(contract, options = {}) {
  return {
    ...contract,
    serviceState: normalizeGithubWebhookServiceState(contract, options)
  };
}

function slugifyContractSegment(value) {
  return String(value ?? "contract")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "contract";
}

function buildQueuedContractFilename(contract, options = {}) {
  const prefix = options.timestamp ?? new Date().toISOString().replace(/[:.]/g, "-");
  const delivery = slugifyContractSegment(contract.deliveryId ?? contract.eventKey ?? "contract");
  const kind = slugifyContractSegment(contract.contractKind ?? "contract");
  return `${prefix}__${kind}__${delivery}.json`;
}

export async function queueGithubWebhookServiceContract(rootDir, contract, options = {}) {
  if (!ALLOWED_CONTRACT_KINDS.has(contract.contractKind)) {
    throw new Error(`Unsupported queued contract kind '${contract.contractKind ?? "unknown"}'.`);
  }

  const paths = getGithubWebhookServicePaths(rootDir);
  const targetState = options.targetState === "blocked"
    ? "blocked"
    : options.targetState === "dead_letter"
      ? "dead_letter"
      : "pending";
  const targetDir = targetState === "blocked"
    ? paths.blockedPath
    : targetState === "dead_letter"
      ? paths.deadLetterPath
      : paths.pendingPath;
  const lease = options.lease ?? null;
  const statefulContract = applyGithubWebhookServiceState(contract, {
    maxServiceAttempts: options.maxServiceAttempts,
    lastQueuedState: targetState
  });
  const queuedContract = lease
    ? {
        ...statefulContract,
        serviceLease: lease
      }
    : {
        ...statefulContract,
        serviceLease: null
      };
  const duplicate = options.allowDuplicate ? null : await findGithubWebhookServiceDuplicate(rootDir, queuedContract);
  const fileName = buildQueuedContractFilename(queuedContract, {
    timestamp: options.timestamp
  });
  const targetPath = path.join(targetDir, fileName);

  if (options.dryRun) {
    return {
      targetState,
      targetPath,
      duplicate
    };
  }

  if (duplicate) {
    return {
      targetState: duplicate.queueState,
      targetPath: duplicate.contractPath,
      duplicate
    };
  }

  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(targetPath, `${JSON.stringify(queuedContract, null, 2)}\n`, "utf8");
  return {
    targetState,
    targetPath,
    contract: queuedContract
  };
}

export async function enqueueGithubWebhookServiceContractFromFile(rootDir, contractPath, options = {}) {
  const absolutePath = path.isAbsolute(contractPath)
    ? contractPath
    : path.join(rootDir, contractPath);
  const raw = await fs.readFile(absolutePath, "utf8");
  const contract = JSON.parse(raw);
  const queued = await queueGithubWebhookServiceContract(rootDir, contract, options);
  return {
    contract,
    sourcePath: absolutePath,
    queued
  };
}

export async function loadGithubWebhookServiceQueue(rootDir) {
  const paths = getGithubWebhookServicePaths(rootDir);
  const pendingEntries = await safeReadDirEntries(paths.pendingPath);
  const claimedEntries = await safeReadDirEntries(paths.claimedPath);
  const blockedEntries = await safeReadDirEntries(paths.blockedPath);
  const deadLetterEntries = await safeReadDirEntries(paths.deadLetterPath);
  const pendingQueue = [];
  const claimedQueue = [];
  const blockedQueue = [];
  const deadLetterQueue = [];

  for (const entry of pendingEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const contractPath = path.join(paths.pendingPath, entry.name);
    const raw = await fs.readFile(contractPath, "utf8");
    const contract = JSON.parse(raw);
    pendingQueue.push({
      fileName: entry.name,
      contractPath,
      contract,
      queueState: "pending"
    });
  }

  for (const entry of claimedEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const contractPath = path.join(paths.claimedPath, entry.name);
    const raw = await fs.readFile(contractPath, "utf8");
    const contract = JSON.parse(raw);
    claimedQueue.push({
      fileName: entry.name,
      contractPath,
      contract,
      queueState: "claimed"
    });
  }

  for (const entry of blockedEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const contractPath = path.join(paths.blockedPath, entry.name);
    const raw = await fs.readFile(contractPath, "utf8");
    const contract = JSON.parse(raw);
    blockedQueue.push({
      fileName: entry.name,
      contractPath,
      contract,
      queueState: "blocked"
    });
  }

  for (const entry of deadLetterEntries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }
    const contractPath = path.join(paths.deadLetterPath, entry.name);
    const raw = await fs.readFile(contractPath, "utf8");
    const contract = JSON.parse(raw);
    deadLetterQueue.push({
      fileName: entry.name,
      contractPath,
      contract,
      queueState: "dead_letter"
    });
  }

  pendingQueue.sort((left, right) => left.fileName.localeCompare(right.fileName));
  claimedQueue.sort((left, right) => left.fileName.localeCompare(right.fileName));
  blockedQueue.sort((left, right) => left.fileName.localeCompare(right.fileName));
  deadLetterQueue.sort((left, right) => left.fileName.localeCompare(right.fileName));
  return {
    paths,
    queue: [...pendingQueue, ...claimedQueue, ...blockedQueue, ...deadLetterQueue],
    pendingQueue,
    claimedQueue,
    blockedQueue,
    deadLetterQueue
  };
}

function matchesGithubWebhookServiceEntryFilter(entry, options = {}) {
  const fromStatus = normalizeGithubWebhookQueueStateLabel(options.fromStatus);
  const fileFilter = options.file
    ? path.basename(options.file)
    : null;
  const entryRelativePath = path.relative(rootDirFromEntry(entry), entry.contractPath);

  const stateMatches = !fromStatus || fromStatus === "problematic"
    ? entry.queueState === "blocked" || entry.queueState === "dead_letter"
    : fromStatus === "all"
      ? true
      : entry.queueState === fromStatus;
  const projectMatches = !options.project || entry.contract?.selectedProjectKey === options.project;
  const fileMatches = !fileFilter
    ? true
    : entry.fileName === fileFilter || entry.contractPath === options.file || entryRelativePath.endsWith(fileFilter);

  return stateMatches && projectMatches && fileMatches;
}

function rootDirFromEntry(entry) {
  const marker = `${path.sep}${SERVICE_QUEUE_DIR}${path.sep}`;
  const index = entry.contractPath.indexOf(marker);
  return index === -1 ? process.cwd() : entry.contractPath.slice(0, index);
}

export function selectGithubWebhookServiceQueueEntries(queueEntries = [], options = {}) {
  const selected = queueEntries.filter((entry) => matchesGithubWebhookServiceEntryFilter(entry, options));
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null;
  const limited = limit ? selected.slice(0, limit) : selected;

  return {
    filter: {
      fromStatus: normalizeGithubWebhookQueueStateLabel(options.fromStatus) ?? "problematic",
      project: options.project ?? null,
      file: options.file ?? null,
      limit
    },
    totalMatches: selected.length,
    selectedEntries: limited
  };
}

export async function findGithubWebhookServiceDuplicate(rootDir, contract) {
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const identity = buildGithubWebhookServiceIdentity(contract);
  return queueState.queue.find((entry) => {
    const entryIdentity = entry.contract?.serviceState?.identity ?? buildGithubWebhookServiceIdentity(entry.contract ?? {});
    return entryIdentity === identity;
  }) ?? null;
}

export function classifyGithubWebhookServiceQueueEntry(entry, options = {}) {
  const contract = entry.contract ?? {};
  const kind = contract.contractKind ?? "unknown";
  const installationAssessment = assessGithubAppInstallationOperations(options.installationState, contract, options);
  const base = {
    fileName: entry.fileName,
    contractPath: entry.contractPath,
    queueState: entry.queueState ?? "pending",
    contractKind: kind,
    contractStatus: contract.contractStatus ?? "unknown",
    deliveryId: contract.deliveryId ?? null,
    eventKey: contract.eventKey ?? null,
    selectedProjectKey: contract.selectedProjectKey ?? null,
    installationId: contract.installationId ?? null,
    installationStatus: installationAssessment.status,
    serviceLease: contract.serviceLease ?? null,
    serviceState: contract.serviceState ?? null
  };

  if (base.queueState === "claimed") {
    return {
      ...base,
      action: "lease_held",
      actionable: false,
      blocked: true,
      nextAction: "This contract is already claimed by another worker lease."
    };
  }

  if (base.queueState === "dead_letter") {
    return {
      ...base,
      action: "dead_letter",
      actionable: false,
      blocked: true,
      nextAction: contract.nextAction ?? "This contract moved to dead-letter after repeated failures or a terminal conflict."
    };
  }

  if (base.queueState === "blocked") {
    return {
      ...base,
      action: "blocked_contract",
      actionable: false,
      blocked: true,
      nextAction: contract.nextAction ?? "This contract is currently blocked and needs manual review or later recovery."
    };
  }

  if (kind === "execution_contract") {
    if (contract.contractStatus === "dispatch_ready" || contract.contractStatus === "dispatch_ready_dry_run" || contract.contractStatus === "dispatch_ready_contract_only") {
      if (!installationAssessment.allowed) {
        return {
          ...base,
          action: "installation_blocked",
          actionable: false,
          blocked: true,
          nextAction: installationAssessment.nextAction
        };
      }
      return {
        ...base,
        action: "run_execution",
        actionable: true,
        blocked: false,
        nextAction: "Consume this execution contract via the runner."
      };
    }
    return {
      ...base,
      action: "manual_review",
      actionable: false,
      blocked: true,
      nextAction: contract.nextAction ?? "Execution contract is not ready for the runner."
    };
  }

  if (kind === "resume_contract") {
    if (contract.contractStatus === "dispatch_ready_resume_contract") {
      if (!installationAssessment.allowed) {
        return {
          ...base,
          action: "installation_blocked",
          actionable: false,
          blocked: true,
          nextAction: installationAssessment.nextAction
        };
      }
      return {
        ...base,
        action: "run_resume",
        actionable: true,
        blocked: false,
        nextAction: "Resume the interrupted runner flow."
      };
    }
    return {
      ...base,
      action: "manual_review",
      actionable: false,
      blocked: true,
      nextAction: contract.nextAction ?? "Resume contract is not ready."
    };
  }

  if (kind === "recovery_contract") {
    const recoveryEvaluation = evaluateGithubWebhookRecoveryContract(contract, {
      now: options.now
    });
    if (recoveryEvaluation.effectiveStatus === "dispatch_ready_recovery_contract") {
      if (!installationAssessment.allowed) {
        return {
          ...base,
          contractStatus: recoveryEvaluation.effectiveStatus,
          action: "installation_blocked",
          actionable: false,
          blocked: true,
          blockedUntil: recoveryEvaluation.blockedUntil,
          nextAction: installationAssessment.nextAction
        };
      }
      return {
        ...base,
        contractStatus: recoveryEvaluation.effectiveStatus,
        action: "run_recover",
        actionable: true,
        blocked: false,
        blockedUntil: recoveryEvaluation.blockedUntil,
        nextAction: recoveryEvaluation.nextAction
      };
    }
    return {
      ...base,
      contractStatus: recoveryEvaluation.effectiveStatus,
      action: "hold_recovery",
      actionable: false,
      blocked: true,
      blockedUntil: recoveryEvaluation.blockedUntil,
      nextAction: recoveryEvaluation.nextAction
    };
  }

  return {
    ...base,
    action: "unsupported_contract",
    actionable: false,
    blocked: true,
    nextAction: "This queued contract kind is not supported by the local service tick."
  };
}

export function buildGithubWebhookServiceTickPlan(queueEntries = [], options = {}) {
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null;
  const classifiedEntries = queueEntries.map((entry) => classifyGithubWebhookServiceQueueEntry(entry, options));
  const actionableEntries = classifiedEntries.filter((entry) => entry.actionable);
  const blockedEntries = classifiedEntries.filter((entry) => entry.blocked);
  const selectedEntries = limit ? actionableEntries.slice(0, limit) : actionableEntries;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerId: options.workerId ?? "local-worker",
    queueCount: classifiedEntries.length,
    actionableCount: actionableEntries.length,
    blockedCount: blockedEntries.length,
    pendingCount: classifiedEntries.filter((entry) => entry.queueState === "pending").length,
    claimedCount: classifiedEntries.filter((entry) => entry.queueState === "claimed").length,
    deadLetterCount: classifiedEntries.filter((entry) => entry.queueState === "dead_letter").length,
    installationBlockedCount: classifiedEntries.filter((entry) => entry.action === "installation_blocked").length,
    limit,
    entries: classifiedEntries,
    selectedEntries,
    nextAction: selectedEntries.length > 0
      ? "Process the selected queued contracts through the local GitHub App service tick."
      : blockedEntries.length > 0
        ? "No queued contract is currently actionable; inspect the blocked or backoff-held entries."
        : "Service queue is empty."
  };
}

export function renderGithubWebhookServiceTickSummary(plan, receipts = []) {
  const entries = Array.isArray(plan.entries) ? plan.entries : [];
  const selectedEntries = Array.isArray(plan.selectedEntries) ? plan.selectedEntries : [];
  const entryLines = entries.length > 0
    ? entries.map((entry) => `- ${entry.fileName}: state=${entry.queueState ?? "pending"} | action=${entry.action} | status=${entry.contractStatus} | project=${entry.selectedProjectKey ?? "-"} | installation=${entry.installationId ?? "-"}:${entry.installationStatus ?? "-"}${entry.blockedUntil ? ` | blocked_until=${entry.blockedUntil}` : ""}${entry.serviceLease?.workerId ? ` | claimed_by=${entry.serviceLease.workerId}` : ""}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- ${receipt.fileName}: outcome=${receipt.outcome} | action=${receipt.action} | target_state=${receipt.targetState}${receipt.spawnedContracts?.length ? ` | spawned=${receipt.spawnedContracts.length}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Tick

- generated_at: ${plan.generatedAt}
- worker_id: ${plan.workerId ?? "-"}
- queue_count: ${plan.queueCount}
- pending_count: ${plan.pendingCount ?? 0}
- claimed_count: ${plan.claimedCount ?? 0}
- actionable_count: ${plan.actionableCount}
- blocked_count: ${plan.blockedCount}
- dead_letter_count: ${plan.deadLetterCount ?? 0}
- installation_blocked_count: ${plan.installationBlockedCount ?? 0}
- selected_count: ${selectedEntries.length}

## Queue Entries

${entryLines}

## Tick Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function buildGithubWebhookServiceReviewPlan(queueEntries = [], options = {}) {
  const selection = selectGithubWebhookServiceQueueEntries(queueEntries, options);
  const classifiedEntries = selection.selectedEntries.map((entry) => classifyGithubWebhookServiceQueueEntry(entry, options));

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerId: options.workerId ?? "local-worker",
    reviewFilter: selection.filter,
    totalMatches: selection.totalMatches,
    selectedCount: classifiedEntries.length,
    blockedCount: classifiedEntries.filter((entry) => entry.queueState === "blocked").length,
    deadLetterCount: classifiedEntries.filter((entry) => entry.queueState === "dead_letter").length,
    claimedCount: classifiedEntries.filter((entry) => entry.queueState === "claimed").length,
    entries: classifiedEntries,
    nextAction: classifiedEntries.length > 0
      ? "Review the selected service contracts and explicitly requeue only the entries you want to release."
      : "No service contracts match the current review filter."
  };
}

export function renderGithubWebhookServiceReviewSummary(plan) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => {
        const serviceState = entry.serviceState ?? {};
        return `- ${entry.fileName}: state=${entry.queueState} | action=${entry.action} | status=${entry.contractStatus} | project=${entry.selectedProjectKey ?? "-"} | installation=${entry.installationId ?? "-"}:${entry.installationStatus ?? "-"}${serviceState.attemptCount != null ? ` | attempts=${serviceState.attemptCount}/${serviceState.maxAttempts ?? "-"}` : ""}${serviceState.deadLetterReason ? ` | dead_letter_reason=${serviceState.deadLetterReason}` : ""}${entry.serviceLease?.workerId ? ` | claimed_by=${entry.serviceLease.workerId}` : ""}`;
      }).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Review

- generated_at: ${plan.generatedAt}
- worker_id: ${plan.workerId}
- review_from_status: ${plan.reviewFilter.fromStatus}
- project_filter: ${plan.reviewFilter.project ?? "-"}
- file_filter: ${plan.reviewFilter.file ?? "-"}
- total_matches: ${plan.totalMatches}
- selected_count: ${plan.selectedCount}
- blocked_count: ${plan.blockedCount}
- dead_letter_count: ${plan.deadLetterCount}
- claimed_count: ${plan.claimedCount}

## Selected Entries

${entryLines}

## Next Action

- ${plan.nextAction}
`;
}

export function buildGithubWebhookServiceRequeuePlan(queueEntries = [], options = {}) {
  const selection = selectGithubWebhookServiceQueueEntries(queueEntries, options);
  const selectedEntries = selection.selectedEntries.map((entry) => classifyGithubWebhookServiceQueueEntry(entry, options));
  const evaluatedEntries = selectedEntries.map((entry) => ({
    ...entry,
    installationAdmin: assessGithubAppInstallationServiceAdmin(options.installationState, {
      installationId: entry.installationId
    }, {
      queueState: entry.queueState
    })
  }));
  const releaseableEntries = evaluatedEntries.filter((entry) => {
    return SERVICE_REQUEUE_SOURCE_STATES.has(entry.queueState) && entry.installationAdmin.allowed;
  });
  const installationBlockedEntries = evaluatedEntries.filter((entry) => {
    return SERVICE_REQUEUE_SOURCE_STATES.has(entry.queueState) && !entry.installationAdmin.allowed;
  });
  const forceRequiredEntries = releaseableEntries.filter((entry) => entry.queueState === "claimed" && entry.serviceLease?.workerId);

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerId: options.workerId ?? "local-worker",
    requeueFilter: selection.filter,
    totalMatches: selection.totalMatches,
    selectedCount: evaluatedEntries.length,
    releaseableCount: releaseableEntries.length,
    installationBlockedCount: installationBlockedEntries.length,
    forceRequiredCount: forceRequiredEntries.length,
    selectedEntries: evaluatedEntries,
    releaseableEntries,
    installationBlockedEntries,
    forceRequiredEntries,
    nextAction: releaseableEntries.length === 0
      ? installationBlockedEntries.length > 0
        ? "Some contracts matched, but installation-level service admin policy keeps them behind manual installation review."
        : "No blocked, dead-letter or claimed contracts match the current filter."
      : forceRequiredEntries.length > 0
        ? "Use --force to requeue actively claimed contracts, or narrow the filter to blocked/dead-letter entries."
        : "Use --apply to move the selected service contracts back to pending."
  };
}

export function renderGithubWebhookServiceRequeueSummary(plan, receipts = []) {
  const entryLines = plan.releaseableEntries.length > 0
    ? plan.releaseableEntries.map((entry) => `- ${entry.fileName}: state=${entry.queueState} | status=${entry.contractStatus} | project=${entry.selectedProjectKey ?? "-"} | installation=${entry.installationId ?? "-"}:${entry.installationAdmin?.status ?? "-"}${entry.serviceLease?.workerId ? ` | claimed_by=${entry.serviceLease.workerId}` : ""}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- ${receipt.fileName}: outcome=${receipt.outcome} | from_state=${receipt.fromState} | target_state=${receipt.targetState}${receipt.notes ? ` | notes=${receipt.notes}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Requeue

- generated_at: ${plan.generatedAt}
- worker_id: ${plan.workerId}
- requeue_from_status: ${plan.requeueFilter.fromStatus}
- project_filter: ${plan.requeueFilter.project ?? "-"}
- file_filter: ${plan.requeueFilter.file ?? "-"}
- total_matches: ${plan.totalMatches}
- selected_count: ${plan.selectedCount}
- releaseable_count: ${plan.releaseableCount}
- installation_blocked_count: ${plan.installationBlockedCount ?? 0}
- force_required_count: ${plan.forceRequiredCount}

## Releaseable Entries

${entryLines}

## Requeue Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export async function writeGithubWebhookServiceArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-service", options.runId);
  const planPath = path.join(integrationRoot, "service-plan.json");
  const receiptsPath = path.join(integrationRoot, "service-receipts.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      planPath,
      receiptsPath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(planPath, `${JSON.stringify(options.plan, null, 2)}\n`, "utf8");
  await fs.writeFile(receiptsPath, `${JSON.stringify(options.receipts ?? [], null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    planPath,
    receiptsPath,
    summaryPath
  };
}

export async function writeGithubWebhookServiceAdminArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-service-admin", options.runId);
  const planPath = path.join(integrationRoot, `${options.artifactPrefix}-plan.json`);
  const receiptsPath = path.join(integrationRoot, `${options.artifactPrefix}-receipts.json`);
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      planPath,
      receiptsPath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(planPath, `${JSON.stringify(options.plan, null, 2)}\n`, "utf8");
  await fs.writeFile(receiptsPath, `${JSON.stringify(options.receipts ?? [], null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    planPath,
    receiptsPath,
    summaryPath
  };
}

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

function isExpiredLease(lease, options = {}) {
  if (!lease?.leaseExpiresAt) {
    return false;
  }
  const now = options.now ? new Date(options.now) : new Date();
  return now >= new Date(lease.leaseExpiresAt);
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
