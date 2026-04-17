import { isExpiredLease } from "./shared.mjs";
import { buildGithubWebhookServiceRuntimeIntegrityReview } from "./runtime-integrity.mjs";

const SEVERITY_ORDER = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3
};

function sortActions(actions = []) {
  return [...actions].sort((left, right) => {
    const severityDiff = (SEVERITY_ORDER[left.severity] ?? 99) - (SEVERITY_ORDER[right.severity] ?? 99);
    if (severityDiff !== 0) {
      return severityDiff;
    }
    return String(left.key).localeCompare(String(right.key));
  });
}

function toAction(key, severity, actionType, title, detail, nextAction, options = {}) {
  return {
    key,
    severity,
    actionType,
    title,
    detail,
    nextAction,
    count: Number(options.count ?? 0) || null,
    examples: Array.isArray(options.examples) ? options.examples.slice(0, 5) : [],
    safeToApply: Boolean(options.safeToApply)
  };
}

export async function loadGithubWebhookServiceRuntimeMaintenanceState(rootDir, loaders = {}) {
  const integrityState = await loaders.loadGithubWebhookServiceRuntimeIntegrityState(rootDir, loaders);
  return {
    integrityState
  };
}

export function buildGithubWebhookServiceRuntimeMaintenancePlan(state = {}, options = {}) {
  const integrityState = state.integrityState ?? {};
  const integrityReview = buildGithubWebhookServiceRuntimeIntegrityReview(integrityState, {
    generatedAt: options.generatedAt,
    limit: options.limit
  });

  const queueState = integrityState.queueState ?? {};
  const runtimeClaimsState = integrityState.runtimeClaimsState ?? {};
  const claimedQueue = Array.isArray(queueState.claimedQueue) ? queueState.claimedQueue : [];
  const runtimeClaims = Array.isArray(runtimeClaimsState.claims) ? runtimeClaimsState.claims : [];
  const now = options.generatedAt ?? new Date().toISOString();

  const expiredClaimedQueue = claimedQueue.filter((entry) => isExpiredLease(entry.contract?.serviceLease, { now }));
  const expiredRuntimeClaims = runtimeClaims.filter((claim) => new Date(claim.leaseExpiresAt) <= new Date(now));

  const safeActions = [];
  const manualActions = [];

  if (expiredClaimedQueue.length > 0) {
    safeActions.push(toAction(
      "reclaim_expired_queue_claims",
      "high",
      "reclaim_expired_queue_claims",
      "Reclaim expired claimed queue entries",
      `${expiredClaimedQueue.length} claimed queue entr${expiredClaimedQueue.length === 1 ? "y has" : "ies have"} expired leases and can safely move back to pending.`,
      "Apply maintenance to reclaim stale queue leases before the next service tick.",
      {
        count: expiredClaimedQueue.length,
        examples: expiredClaimedQueue.map((entry) => entry.fileName),
        safeToApply: true
      }
    ));
  }

  if (expiredRuntimeClaims.length > 0) {
    safeActions.push(toAction(
      "reclaim_expired_runtime_lane_claims",
      "medium",
      "reclaim_expired_runtime_lane_claims",
      "Reclaim expired runtime lane claims",
      `${expiredRuntimeClaims.length} runtime lane claim(s) are expired and can safely be removed from the live claims file.`,
      "Apply maintenance to clear stale runtime lane claims before the next runtime run.",
      {
        count: expiredRuntimeClaims.length,
        examples: expiredRuntimeClaims.map((claim) => `${claim.laneKey} -> ${claim.workerId}`),
        safeToApply: true
      }
    ));
  }

  for (const issue of integrityReview.prioritizedIssues) {
    if (issue.key === "claimed_queue_expired_lease" || issue.key === "expired_runtime_lane_claims") {
      continue;
    }
    manualActions.push(toAction(
      issue.key,
      issue.severity,
      "manual_followup",
      issue.title,
      issue.detail,
      issue.nextAction,
      {
        count: issue.count,
        examples: issue.examples,
        safeToApply: false
      }
    ));
  }

  const prioritizedActions = sortActions([...safeActions, ...manualActions]);
  const maintenanceStatus = prioritizedActions.some((action) => action.severity === "critical")
    ? "maintenance_attention_critical"
    : prioritizedActions.length > 0
      ? "maintenance_attention"
      : "maintenance_clear";

  return {
    schemaVersion: 1,
    generatedAt: now,
    maintenanceStatus,
    integrityStatus: integrityReview.integrityStatus,
    safeActionCount: safeActions.length,
    manualActionCount: manualActions.length,
    expiredClaimedQueueCount: expiredClaimedQueue.length,
    expiredRuntimeClaimCount: expiredRuntimeClaims.length,
    integrityReview,
    safeActions,
    manualActions,
    prioritizedActions,
    nextAction: prioritizedActions[0]?.nextAction ?? "GitHub App runtime maintenance has no immediate follow-up."
  };
}

export function summarizeGithubWebhookServiceRuntimeMaintenanceApply(plan, result = {}) {
  return {
    appliedAt: result.appliedAt ?? new Date().toISOString(),
    queueClaimsReclaimed: Array.isArray(result.queueClaimsReclaimed) ? result.queueClaimsReclaimed.length : 0,
    runtimeClaimsReclaimed: Array.isArray(result.runtimeClaimsReclaimed) ? result.runtimeClaimsReclaimed.length : 0,
    plannedSafeActionCount: plan.safeActionCount ?? 0,
    remainingManualActionCount: plan.manualActionCount ?? 0
  };
}

export function renderGithubWebhookServiceRuntimeMaintenanceSummary(plan, applySummary = null) {
  const safeLines = plan.safeActions.length > 0
    ? plan.safeActions.map((action) => `- severity=${action.severity} | key=${action.key} | detail=${action.detail}${action.examples.length > 0 ? ` | examples=${action.examples.join(" ; ")}` : ""}`).join("\n")
    : "- none";
  const manualLines = plan.manualActions.length > 0
    ? plan.manualActions.map((action) => `- severity=${action.severity} | key=${action.key} | detail=${action.detail}${action.examples.length > 0 ? ` | examples=${action.examples.join(" ; ")}` : ""}`).join("\n")
    : "- none";
  const applyLines = applySummary
    ? `\n## Apply Summary\n\n- applied_at: ${applySummary.appliedAt}\n- queue_claims_reclaimed: ${applySummary.queueClaimsReclaimed}\n- runtime_claims_reclaimed: ${applySummary.runtimeClaimsReclaimed}\n- planned_safe_action_count: ${applySummary.plannedSafeActionCount}\n- remaining_manual_action_count: ${applySummary.remainingManualActionCount}\n`
    : "";

  return `# Patternpilot GitHub App Service Runtime Maintenance

- generated_at: ${plan.generatedAt}
- maintenance_status: ${plan.maintenanceStatus}
- integrity_status: ${plan.integrityStatus}
- safe_action_count: ${plan.safeActionCount}
- manual_action_count: ${plan.manualActionCount}
- expired_claimed_queue_count: ${plan.expiredClaimedQueueCount}
- expired_runtime_claim_count: ${plan.expiredRuntimeClaimCount}

## Safe Actions

${safeLines}

## Manual Follow-up

${manualLines}${applyLines}

## Next Action

- ${plan.nextAction}
`;
}
