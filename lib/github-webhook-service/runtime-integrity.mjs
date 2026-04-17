import fs from "node:fs/promises";

import {
  buildGithubWebhookServiceIdentity,
  isExpiredLease
} from "./shared.mjs";
import { evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt } from "./runtime-loop-recovery-receipts.mjs";
import { evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt } from "./runtime-loop-recovery-runtime-cycle-receipts.mjs";

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

const REFERENCE_FIELDS = ["statePath", "receiptsPath", "resumeContractPath", "recoveryContractPath", "summaryPath"];
const CONTRACT_REFERENCE_FIELDS = new Set(["resumeContractPath", "recoveryContractPath"]);

function pushIssue(issues, severity, key, title, detail, nextAction, options = {}) {
  issues.push({
    severity,
    key,
    title,
    detail,
    nextAction,
    count: Number(options.count ?? 0) || null,
    examples: Array.isArray(options.examples) ? options.examples.slice(0, 5) : []
  });
}

function sortIssues(issues = []) {
  return [...issues].sort((left, right) => {
    const severityDiff = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return String(left.key).localeCompare(String(right.key));
  });
}

function trimReference(referencePath) {
  if (referencePath == null) {
    return null;
  }
  const value = String(referencePath).trim();
  return value || null;
}

function resolveReferencePath(rootDir, referencePath) {
  const normalized = trimReference(referencePath);
  if (!normalized) {
    return null;
  }
  return normalized.startsWith("/")
    ? normalized
    : `${rootDir}/${normalized}`;
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function getEntryId(entry = {}) {
  return String(entry.receiptId ?? entry.runId ?? entry.groupId ?? entry.familyKey ?? entry.key ?? "unknown-entry");
}

function collectStateReferences(rootDir, sourceType, entries = []) {
  const references = [];

  for (const entry of entries) {
    const sourceId = getEntryId(entry);
    for (const field of REFERENCE_FIELDS) {
      const referencePath = trimReference(entry[field]);
      if (!referencePath) {
        continue;
      }
      references.push({
        sourceType,
        sourceId,
        field,
        referencePath,
        absolutePath: resolveReferencePath(rootDir, referencePath)
      });
    }
  }

  return references;
}

async function buildReferenceChecks(rootDir, references = []) {
  const results = [];
  for (const reference of references) {
    results.push({
      ...reference,
      exists: reference.absolutePath ? await pathExists(reference.absolutePath) : false
    });
  }
  return results;
}

function describeIssueExamples(values = [], formatter = (value) => value) {
  return values.slice(0, 3).map((value) => formatter(value));
}

export async function loadGithubWebhookServiceRuntimeIntegrityState(rootDir, loaders = {}) {
  const [
    queueState,
    runtimeClaimsState,
    runtimeLoopHistoryState,
    runtimeLoopRecoveryReceiptsState,
    runtimeLoopRecoveryRuntimeCycleHistoryState,
    runtimeLoopRecoveryRuntimeCycleReceiptsState,
    coordinationBackpressureHistoryState,
    coordinationBackpressureLoopHistoryState
  ] = await Promise.all([
    loaders.loadGithubWebhookServiceQueue(rootDir),
    loaders.loadGithubWebhookServiceRuntimeClaims(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopHistory(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir),
    loaders.loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir)
  ]);

  const references = [
    ...collectStateReferences(rootDir, "runtime_loop_history", runtimeLoopHistoryState.entries),
    ...collectStateReferences(rootDir, "runtime_loop_recovery_receipt", runtimeLoopRecoveryReceiptsState.receipts),
    ...collectStateReferences(rootDir, "runtime_loop_recovery_cycle_history", runtimeLoopRecoveryRuntimeCycleHistoryState.entries),
    ...collectStateReferences(rootDir, "runtime_loop_recovery_cycle_receipt", runtimeLoopRecoveryRuntimeCycleReceiptsState.receipts),
    ...collectStateReferences(rootDir, "coordination_backpressure_history", coordinationBackpressureHistoryState.entries),
    ...collectStateReferences(rootDir, "coordination_backpressure_loop_history", coordinationBackpressureLoopHistoryState.entries)
  ];

  const referenceChecks = await buildReferenceChecks(rootDir, references);

  return {
    queueState,
    runtimeClaimsState,
    runtimeLoopHistoryState,
    runtimeLoopRecoveryReceiptsState,
    runtimeLoopRecoveryRuntimeCycleHistoryState,
    runtimeLoopRecoveryRuntimeCycleReceiptsState,
    coordinationBackpressureHistoryState,
    coordinationBackpressureLoopHistoryState,
    referenceChecks
  };
}

export function buildGithubWebhookServiceRuntimeIntegrityReview(state = {}, options = {}) {
  const queueEntries = Array.isArray(state.queueState?.queue) ? state.queueState.queue : [];
  const claimedQueue = Array.isArray(state.queueState?.claimedQueue) ? state.queueState.claimedQueue : [];
  const runtimeClaims = Array.isArray(state.runtimeClaimsState?.claims) ? state.runtimeClaimsState.claims : [];
  const runtimeLoopHistoryEntries = Array.isArray(state.runtimeLoopHistoryState?.entries) ? state.runtimeLoopHistoryState.entries : [];
  const runtimeLoopRecoveryReceipts = Array.isArray(state.runtimeLoopRecoveryReceiptsState?.receipts) ? state.runtimeLoopRecoveryReceiptsState.receipts : [];
  const runtimeLoopRecoveryRuntimeCycleHistoryEntries = Array.isArray(state.runtimeLoopRecoveryRuntimeCycleHistoryState?.entries)
    ? state.runtimeLoopRecoveryRuntimeCycleHistoryState.entries
    : [];
  const runtimeLoopRecoveryRuntimeCycleReceipts = Array.isArray(state.runtimeLoopRecoveryRuntimeCycleReceiptsState?.receipts)
    ? state.runtimeLoopRecoveryRuntimeCycleReceiptsState.receipts
    : [];
  const coordinationBackpressureLoopHistoryEntries = Array.isArray(state.coordinationBackpressureLoopHistoryState?.entries)
    ? state.coordinationBackpressureLoopHistoryState.entries
    : [];
  const referenceChecks = Array.isArray(state.referenceChecks) ? state.referenceChecks : [];

  const issues = [];

  const queueIdentityMap = new Map();
  for (const entry of queueEntries) {
    const identity = entry.contract?.serviceState?.identity ?? buildGithubWebhookServiceIdentity(entry.contract ?? {});
    const group = queueIdentityMap.get(identity) ?? [];
    group.push(entry);
    queueIdentityMap.set(identity, group);
  }
  const duplicateQueueIdentities = [...queueIdentityMap.entries()].filter(([, entries]) => entries.length > 1);
  if (duplicateQueueIdentities.length > 0) {
    pushIssue(
      issues,
      "critical",
      "duplicate_queue_identity",
      "Service queue contains duplicate contract identities",
      `${duplicateQueueIdentities.length} queue identity group(s) appear in multiple queue states at once.`,
      "Deduplicate conflicting queue entries before the service loop continues.",
      {
        count: duplicateQueueIdentities.length,
        examples: describeIssueExamples(duplicateQueueIdentities, ([identity, entries]) =>
          `${identity} -> ${entries.map((entry) => entry.queueState).join(", ")}`
        )
      }
    );
  }

  const claimedWithoutLease = claimedQueue.filter((entry) => !entry.contract?.serviceLease?.leaseExpiresAt);
  if (claimedWithoutLease.length > 0) {
    pushIssue(
      issues,
      "high",
      "claimed_queue_missing_lease",
      "Claimed queue entries are missing leases",
      `${claimedWithoutLease.length} claimed contract(s) have no active queue lease metadata.`,
      "Reclaim or requeue these contracts so claimed work can be trusted again.",
      {
        count: claimedWithoutLease.length,
        examples: describeIssueExamples(claimedWithoutLease, (entry) => entry.fileName)
      }
    );
  }

  const expiredClaimedQueue = claimedQueue.filter((entry) => isExpiredLease(entry.contract?.serviceLease, { now: options.generatedAt }));
  if (expiredClaimedQueue.length > 0) {
    pushIssue(
      issues,
      "high",
      "claimed_queue_expired_lease",
      "Claimed queue entries still hold expired leases",
      `${expiredClaimedQueue.length} claimed contract(s) have expired queue leases but were not reclaimed.`,
      "Run service review/requeue or reclaim the stale claims before executing more service work.",
      {
        count: expiredClaimedQueue.length,
        examples: describeIssueExamples(expiredClaimedQueue, (entry) => entry.fileName)
      }
    );
  }

  const queueMissingServiceIdentity = queueEntries.filter((entry) => !entry.contract?.serviceState?.identity);
  if (queueMissingServiceIdentity.length > 0) {
    pushIssue(
      issues,
      "medium",
      "queue_missing_service_identity",
      "Queue entries are missing normalized service identity",
      `${queueMissingServiceIdentity.length} queued contract(s) do not carry serviceState.identity.`,
      "Rewrite or requeue those contracts so duplicate and governance checks stay reliable.",
      {
        count: queueMissingServiceIdentity.length,
        examples: describeIssueExamples(queueMissingServiceIdentity, (entry) => entry.fileName)
      }
    );
  }

  const laneClaimMap = new Map();
  for (const claim of runtimeClaims) {
    const group = laneClaimMap.get(claim.laneKey) ?? [];
    group.push(claim);
    laneClaimMap.set(claim.laneKey, group);
  }
  const duplicateLaneClaims = [...laneClaimMap.entries()].filter(([, claims]) => claims.length > 1);
  if (duplicateLaneClaims.length > 0) {
    pushIssue(
      issues,
      "critical",
      "duplicate_runtime_lane_claims",
      "Multiple workers claim the same runtime lane",
      `${duplicateLaneClaims.length} runtime lane(s) are claimed more than once.`,
      "Release or repair duplicate runtime claims before starting another runtime cycle.",
      {
        count: duplicateLaneClaims.length,
        examples: describeIssueExamples(duplicateLaneClaims, ([laneKey, claims]) =>
          `${laneKey} -> ${claims.map((claim) => claim.workerId).join(", ")}`
        )
      }
    );
  }

  const expiredRuntimeClaims = runtimeClaims.filter((claim) => new Date(claim.leaseExpiresAt) <= new Date(options.generatedAt ?? new Date().toISOString()));
  if (expiredRuntimeClaims.length > 0) {
    pushIssue(
      issues,
      "medium",
      "expired_runtime_lane_claims",
      "Runtime lane claims are still persisted after expiry",
      `${expiredRuntimeClaims.length} runtime lane claim(s) appear expired in the claims state.`,
      "Reclaim expired runtime claims so worker routing reflects the real live state.",
      {
        count: expiredRuntimeClaims.length,
        examples: describeIssueExamples(expiredRuntimeClaims, (claim) => `${claim.laneKey} -> ${claim.workerId}`)
      }
    );
  }

  const loopHistoryMissingResumeContract = runtimeLoopHistoryEntries.filter((entry) => entry.resumeReady && !entry.resumeContractPath);
  if (loopHistoryMissingResumeContract.length > 0) {
    pushIssue(
      issues,
      "high",
      "runtime_loop_history_missing_resume_contract",
      "Resumable runtime loops are missing resume contracts",
      `${loopHistoryMissingResumeContract.length} runtime loop history entr${loopHistoryMissingResumeContract.length === 1 ? "y" : "ies"} say resume-ready without a resume contract path.`,
      "Regenerate or repair these runtime loop artifacts before resuming them.",
      {
        count: loopHistoryMissingResumeContract.length,
        examples: describeIssueExamples(loopHistoryMissingResumeContract, (entry) => entry.runId)
      }
    );
  }

  const loopHistoryMissingRecoveryContract = runtimeLoopHistoryEntries.filter((entry) =>
    entry.recoveryStatus === "dispatch_ready_runtime_loop_recovery_contract" && !entry.recoveryContractPath
  );
  if (loopHistoryMissingRecoveryContract.length > 0) {
    pushIssue(
      issues,
      "high",
      "runtime_loop_history_missing_recovery_contract",
      "Runtime loop history marks recovery-ready runs without contracts",
      `${loopHistoryMissingRecoveryContract.length} runtime loop history entr${loopHistoryMissingRecoveryContract.length === 1 ? "y" : "ies"} are recovery-ready without a recovery contract path.`,
      "Regenerate or repair the recovery artifacts before running loop recovery.",
      {
        count: loopHistoryMissingRecoveryContract.length,
        examples: describeIssueExamples(loopHistoryMissingRecoveryContract, (entry) => entry.runId)
      }
    );
  }

  const runtimeLoopRecoveryReceiptEvaluations = runtimeLoopRecoveryReceipts.map((receipt) =>
    evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt(receipt, { now: options.generatedAt })
  );
  const openLoopReceiptsMissingRecoveryContract = runtimeLoopRecoveryReceiptEvaluations.filter((entry) =>
    entry.effectiveReceiptState === "open_ready" && !entry.receipt.recoveryContractPath
  );
  if (openLoopReceiptsMissingRecoveryContract.length > 0) {
    pushIssue(
      issues,
      "critical",
      "runtime_loop_recovery_receipt_missing_recovery_contract",
      "Retryable runtime-loop recovery receipts are missing recovery contracts",
      `${openLoopReceiptsMissingRecoveryContract.length} open runtime-loop recovery receipt(s) have no recovery contract path.`,
      "Repair these receipts or recreate their recovery contracts before auto-recovery runs again.",
      {
        count: openLoopReceiptsMissingRecoveryContract.length,
        examples: describeIssueExamples(openLoopReceiptsMissingRecoveryContract, (entry) => entry.receipt.receiptId)
      }
    );
  }

  const openLoopReceiptsMissingResumeContract = runtimeLoopRecoveryReceiptEvaluations.filter((entry) =>
    entry.effectiveReceiptState === "open_ready" && !entry.receipt.resumeContractPath
  );
  if (openLoopReceiptsMissingResumeContract.length > 0) {
    pushIssue(
      issues,
      "high",
      "runtime_loop_recovery_receipt_missing_resume_contract",
      "Retryable runtime-loop recovery receipts are missing resume contracts",
      `${openLoopReceiptsMissingResumeContract.length} open runtime-loop recovery receipt(s) have no resume contract path.`,
      "Repair these receipts so recovery can safely hand back into resume flow.",
      {
        count: openLoopReceiptsMissingResumeContract.length,
        examples: describeIssueExamples(openLoopReceiptsMissingResumeContract, (entry) => entry.receipt.receiptId)
      }
    );
  }

  const recoveryCycleHistoryMissingResumeContract = runtimeLoopRecoveryRuntimeCycleHistoryEntries.filter((entry) =>
    entry.resumeReady && !entry.resumeContractPath
  );
  if (recoveryCycleHistoryMissingResumeContract.length > 0) {
    pushIssue(
      issues,
      "high",
      "recovery_cycle_history_missing_resume_contract",
      "Recovery-cycle history marks resumable runs without contracts",
      `${recoveryCycleHistoryMissingResumeContract.length} recovery-runtime cycle history entr${recoveryCycleHistoryMissingResumeContract.length === 1 ? "y" : "ies"} are resumable without a resume contract path.`,
      "Repair or regenerate recovery-cycle artifacts before resuming them.",
      {
        count: recoveryCycleHistoryMissingResumeContract.length,
        examples: describeIssueExamples(recoveryCycleHistoryMissingResumeContract, (entry) => entry.runId)
      }
    );
  }

  const runtimeLoopRecoveryRuntimeCycleReceiptEvaluations = runtimeLoopRecoveryRuntimeCycleReceipts.map((receipt) =>
    evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(receipt)
  );
  const openRecoveryCycleReceiptsMissingResumeContract = runtimeLoopRecoveryRuntimeCycleReceiptEvaluations.filter((entry) =>
    entry.effectiveReceiptState === "open_ready" && !entry.receipt.resumeContractPath
  );
  if (openRecoveryCycleReceiptsMissingResumeContract.length > 0) {
    pushIssue(
      issues,
      "high",
      "recovery_cycle_receipt_missing_resume_contract",
      "Open recovery-cycle receipts are missing resume contracts",
      `${openRecoveryCycleReceiptsMissingResumeContract.length} resumable recovery-cycle receipt(s) have no resume contract path.`,
      "Repair these receipts before auto-resume consumes them.",
      {
        count: openRecoveryCycleReceiptsMissingResumeContract.length,
        examples: describeIssueExamples(openRecoveryCycleReceiptsMissingResumeContract, (entry) => entry.receipt.receiptId)
      }
    );
  }

  const coordinationBackpressureLoopHistoryMissingResumeContract = coordinationBackpressureLoopHistoryEntries.filter((entry) =>
    entry.resumeReady && !entry.resumeContractPath
  );
  if (coordinationBackpressureLoopHistoryMissingResumeContract.length > 0) {
    pushIssue(
      issues,
      "high",
      "coordination_backpressure_loop_missing_resume_contract",
      "Backpressure loops are resumable without resume contracts",
      `${coordinationBackpressureLoopHistoryMissingResumeContract.length} coordination backpressure loop entr${coordinationBackpressureLoopHistoryMissingResumeContract.length === 1 ? "y" : "ies"} are resume-ready without a resume contract path.`,
      "Repair loop resume artifacts before resuming grouped backpressure runtime.",
      {
        count: coordinationBackpressureLoopHistoryMissingResumeContract.length,
        examples: describeIssueExamples(coordinationBackpressureLoopHistoryMissingResumeContract, (entry) => entry.runId)
      }
    );
  }

  const coordinationBackpressureLoopHistoryMissingRecoveryContract = coordinationBackpressureLoopHistoryEntries.filter((entry) =>
    entry.recoveryStatus === "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract"
      && !entry.recoveryContractPath
  );
  if (coordinationBackpressureLoopHistoryMissingRecoveryContract.length > 0) {
    pushIssue(
      issues,
      "high",
      "coordination_backpressure_loop_missing_recovery_contract",
      "Backpressure loop history marks recovery-ready runs without contracts",
      `${coordinationBackpressureLoopHistoryMissingRecoveryContract.length} coordination backpressure loop entr${coordinationBackpressureLoopHistoryMissingRecoveryContract.length === 1 ? "y" : "ies"} are recovery-ready without a recovery contract path.`,
      "Repair or regenerate backpressure loop recovery artifacts before the next recovery runtime.",
      {
        count: coordinationBackpressureLoopHistoryMissingRecoveryContract.length,
        examples: describeIssueExamples(coordinationBackpressureLoopHistoryMissingRecoveryContract, (entry) => entry.runId)
      }
    );
  }

  const missingReferenceChecks = referenceChecks.filter((entry) => !entry.exists);
  const missingContractReferenceChecks = missingReferenceChecks.filter((entry) => CONTRACT_REFERENCE_FIELDS.has(entry.field));
  const missingArtifactReferenceChecks = missingReferenceChecks.filter((entry) => !CONTRACT_REFERENCE_FIELDS.has(entry.field));

  if (missingContractReferenceChecks.length > 0) {
    pushIssue(
      issues,
      "high",
      "missing_runtime_contract_files",
      "Runtime states point to missing contract files",
      `${missingContractReferenceChecks.length} referenced resume/recovery contract file(s) do not exist anymore.`,
      "Regenerate the missing contracts or clear the stale history/receipt entries that still point to them.",
      {
        count: missingContractReferenceChecks.length,
        examples: describeIssueExamples(missingContractReferenceChecks, (entry) =>
          `${entry.sourceType}:${entry.sourceId}:${entry.field} -> ${entry.referencePath}`
        )
      }
    );
  }

  if (missingArtifactReferenceChecks.length > 0) {
    pushIssue(
      issues,
      "medium",
      "missing_runtime_artifact_files",
      "Runtime states point to missing artifact files",
      `${missingArtifactReferenceChecks.length} referenced runtime state/receipt/summary artifact file(s) are missing.`,
      "Refresh or clean up stale artifact pointers so runtime review remains trustworthy.",
      {
        count: missingArtifactReferenceChecks.length,
        examples: describeIssueExamples(missingArtifactReferenceChecks, (entry) =>
          `${entry.sourceType}:${entry.sourceId}:${entry.field} -> ${entry.referencePath}`
        )
      }
    );
  }

  const prioritizedIssues = sortIssues(issues);
  const integrityStatus = prioritizedIssues.some((issue) => issue.severity === "critical")
    ? "integrity_critical"
    : prioritizedIssues.length > 0
      ? "integrity_attention"
      : "integrity_healthy";

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    integrityStatus,
    queueCount: queueEntries.length,
    runtimeClaimCount: runtimeClaims.length,
    referenceCheckCount: referenceChecks.length,
    missingReferenceCount: missingReferenceChecks.length,
    duplicateQueueIdentityCount: duplicateQueueIdentities.length,
    duplicateRuntimeLaneClaimCount: duplicateLaneClaims.length,
    prioritizedIssues,
    nextAction: prioritizedIssues[0]?.nextAction ?? "GitHub App service runtime integrity looks consistent."
  };
}

export function renderGithubWebhookServiceRuntimeIntegritySummary(review) {
  const issueLines = review.prioritizedIssues.length > 0
    ? review.prioritizedIssues.map((issue) => {
      const examples = issue.examples.length > 0
        ? ` | examples=${issue.examples.join(" ; ")}`
        : "";
      return `- severity=${issue.severity} | key=${issue.key} | title=${issue.title} | detail=${issue.detail} | next=${issue.nextAction}${examples}`;
    }).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Integrity Review

- generated_at: ${review.generatedAt}
- integrity_status: ${review.integrityStatus}
- queue_count: ${review.queueCount}
- runtime_claim_count: ${review.runtimeClaimCount}
- reference_check_count: ${review.referenceCheckCount}
- missing_reference_count: ${review.missingReferenceCount}
- duplicate_queue_identity_count: ${review.duplicateQueueIdentityCount}
- duplicate_runtime_lane_claim_count: ${review.duplicateRuntimeLaneClaimCount}

## Prioritized Issues

${issueLines}

## Next Action

- ${review.nextAction}
`;
}
