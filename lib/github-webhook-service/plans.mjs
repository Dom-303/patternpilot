import { assessGithubAppInstallationServiceAdmin } from "../github-installations.mjs";
import {
  SERVICE_REQUEUE_SOURCE_STATES,
  applyInstallationServiceLaneSelection
} from "./shared.mjs";
import {
  classifyGithubWebhookServiceQueueEntry,
  selectGithubWebhookServiceQueueEntries
} from "./classification.mjs";

export function buildGithubWebhookServiceTickPlan(queueEntries = [], options = {}) {
  const classifiedEntries = queueEntries.map((entry) => classifyGithubWebhookServiceQueueEntry(entry, options));
  const actionableEntries = classifiedEntries.filter((entry) => entry.actionable);
  const blockedEntries = classifiedEntries.filter((entry) => entry.blocked);
  const selectedEntries = applyInstallationServiceLaneSelection(actionableEntries, options);

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    workerId: options.workerId ?? "local-worker",
    schedulerLane: options.schedulerLane ?? null,
    queueCount: classifiedEntries.length,
    actionableCount: actionableEntries.length,
    blockedCount: blockedEntries.length,
    pendingCount: classifiedEntries.filter((entry) => entry.queueState === "pending").length,
    claimedCount: classifiedEntries.filter((entry) => entry.queueState === "claimed").length,
    deadLetterCount: classifiedEntries.filter((entry) => entry.queueState === "dead_letter").length,
    installationBlockedCount: classifiedEntries.filter((entry) => entry.action === "installation_blocked").length,
    installationLaneBlockedCount: classifiedEntries.filter((entry) => entry.action === "installation_lane_blocked").length,
    installationPlanBlockedCount: classifiedEntries.filter((entry) => entry.action === "installation_plan_blocked").length,
    installationWorkerBlockedCount: classifiedEntries.filter((entry) => entry.action === "installation_worker_blocked").length,
    installationScheduleBlockedCount: classifiedEntries.filter((entry) => entry.action === "installation_schedule_blocked").length,
    limit: Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null,
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
    ? entries.map((entry) => `- ${entry.fileName}: state=${entry.queueState ?? "pending"} | action=${entry.action} | status=${entry.contractStatus} | project=${entry.selectedProjectKey ?? "-"} | installation=${entry.installationId ?? "-"}:${entry.installationStatus ?? "-"} | lane=${entry.installationLaneStatus ?? "-"}:${entry.installationLaneMode ?? "-"}/${entry.tickDisposition ?? "-"}${entry.maxConcurrentClaims ? ` | lane_cap=${entry.maxConcurrentClaims}` : ""} | plan=${entry.installationPlanStatus ?? "-"}:${entry.installationPlanPriority ?? "-"}/budget=${entry.installationPlanTickBudget ?? "-"} | routing=${entry.installationRoutingStatus ?? "-"}:${entry.schedulerLane ?? "-"}/${entry.workerMode ?? "-"}${entry.assignedWorkerId ? `:${entry.assignedWorkerId}` : ""} | schedule=${entry.installationScheduleStatus ?? "-"}:${entry.installationScheduleLaneKey ?? "-"}/${entry.tickStrategy ?? "-"}${entry.maxTicksPerCycle ? ` | schedule_cap=${entry.maxTicksPerCycle}` : ""}${Number.isFinite(entry.contractPreferenceRank) ? ` | preference_rank=${entry.contractPreferenceRank}` : ""}${entry.blockedUntil ? ` | blocked_until=${entry.blockedUntil}` : ""}${entry.serviceLease?.workerId ? ` | claimed_by=${entry.serviceLease.workerId}` : ""}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- ${receipt.fileName}: outcome=${receipt.outcome} | action=${receipt.action} | target_state=${receipt.targetState}${receipt.spawnedContracts?.length ? ` | spawned=${receipt.spawnedContracts.length}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Tick

- generated_at: ${plan.generatedAt}
- worker_id: ${plan.workerId ?? "-"}
- scheduler_lane_filter: ${plan.schedulerLane ?? "-"}
- queue_count: ${plan.queueCount}
- pending_count: ${plan.pendingCount ?? 0}
- claimed_count: ${plan.claimedCount ?? 0}
- actionable_count: ${plan.actionableCount}
- blocked_count: ${plan.blockedCount}
- dead_letter_count: ${plan.deadLetterCount ?? 0}
- installation_blocked_count: ${plan.installationBlockedCount ?? 0}
- installation_lane_blocked_count: ${plan.installationLaneBlockedCount ?? 0}
- installation_plan_blocked_count: ${plan.installationPlanBlockedCount ?? 0}
- installation_worker_blocked_count: ${plan.installationWorkerBlockedCount ?? 0}
- installation_schedule_blocked_count: ${plan.installationScheduleBlockedCount ?? 0}
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
