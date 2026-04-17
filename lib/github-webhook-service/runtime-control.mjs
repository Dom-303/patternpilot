import { buildGithubWebhookServiceRuntimeIntegrityReview } from "./runtime-integrity.mjs";
import { buildGithubWebhookServiceRuntimeMaintenancePlan } from "./runtime-maintenance.mjs";
import { buildGithubWebhookServiceRuntimeOpsReview } from "./runtime-ops.mjs";

const STATUS_ORDER = {
  runtime_control_critical: 0,
  runtime_control_attention: 1,
  runtime_control_healthy: 2
};

function classifyControlStatus(opsReview, integrityReview, maintenancePlan) {
  if (
    opsReview.healthStatus === "critical_attention"
    || integrityReview.integrityStatus === "integrity_critical"
    || maintenancePlan.maintenanceStatus === "maintenance_attention_critical"
  ) {
    return "runtime_control_critical";
  }
  if (
    opsReview.healthStatus !== "healthy"
    || integrityReview.integrityStatus !== "integrity_healthy"
    || maintenancePlan.maintenanceStatus !== "maintenance_clear"
  ) {
    return "runtime_control_attention";
  }
  return "runtime_control_healthy";
}

function buildHighlights(opsReview, integrityReview, maintenancePlan) {
  const highlights = [];

  if (opsReview.prioritizedActions[0]) {
    highlights.push({
      source: "ops",
      severity: opsReview.prioritizedActions[0].severity,
      key: opsReview.prioritizedActions[0].key,
      title: opsReview.prioritizedActions[0].title,
      detail: opsReview.prioritizedActions[0].detail,
      nextAction: opsReview.prioritizedActions[0].nextAction
    });
  }

  if (integrityReview.prioritizedIssues[0]) {
    highlights.push({
      source: "integrity",
      severity: integrityReview.prioritizedIssues[0].severity,
      key: integrityReview.prioritizedIssues[0].key,
      title: integrityReview.prioritizedIssues[0].title,
      detail: integrityReview.prioritizedIssues[0].detail,
      nextAction: integrityReview.prioritizedIssues[0].nextAction
    });
  }

  if (maintenancePlan.prioritizedActions[0]) {
    highlights.push({
      source: "maintenance",
      severity: maintenancePlan.prioritizedActions[0].severity,
      key: maintenancePlan.prioritizedActions[0].key,
      title: maintenancePlan.prioritizedActions[0].title,
      detail: maintenancePlan.prioritizedActions[0].detail,
      nextAction: maintenancePlan.prioritizedActions[0].nextAction
    });
  }

  return highlights.sort((left, right) => {
    const leftRank = STATUS_ORDER[left.severity] ?? 99;
    const rightRank = STATUS_ORDER[right.severity] ?? 99;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return String(left.key).localeCompare(String(right.key));
  });
}

export async function loadGithubWebhookServiceRuntimeControlState(rootDir, loaders = {}) {
  return loaders.loadGithubWebhookServiceRuntimeIntegrityState(rootDir, loaders);
}

export function buildGithubWebhookServiceRuntimeControlReview(state = {}, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const opsReview = buildGithubWebhookServiceRuntimeOpsReview(state, {
    generatedAt,
    limit: options.limit
  });
  const integrityReview = buildGithubWebhookServiceRuntimeIntegrityReview(state, {
    generatedAt,
    limit: options.limit
  });
  const maintenancePlan = buildGithubWebhookServiceRuntimeMaintenancePlan({ integrityState: state }, {
    generatedAt,
    limit: options.limit
  });
  const controlStatus = classifyControlStatus(opsReview, integrityReview, maintenancePlan);
  const highlights = buildHighlights(opsReview, integrityReview, maintenancePlan);

  return {
    schemaVersion: 1,
    generatedAt,
    controlStatus,
    opsReview,
    integrityReview,
    maintenancePlan,
    highlights,
    nextAction: highlights[0]?.nextAction ?? "GitHub App runtime control surface looks healthy."
  };
}

export function renderGithubWebhookServiceRuntimeControlSummary(review) {
  const highlightLines = review.highlights.length > 0
    ? review.highlights.map((item) =>
      `- source=${item.source} | severity=${item.severity} | key=${item.key} | title=${item.title} | detail=${item.detail} | next=${item.nextAction}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Control Review

- generated_at: ${review.generatedAt}
- control_status: ${review.controlStatus}
- ops_status: ${review.opsReview.healthStatus}
- integrity_status: ${review.integrityReview.integrityStatus}
- maintenance_status: ${review.maintenancePlan.maintenanceStatus}
- queue_count: ${review.opsReview.queueSummary.queueCount}
- runtime_claim_count: ${review.opsReview.runtimeClaimsSummary.activeClaimCount}
- integrity_issue_count: ${review.integrityReview.prioritizedIssues.length}
- maintenance_safe_action_count: ${review.maintenancePlan.safeActionCount}
- maintenance_manual_action_count: ${review.maintenancePlan.manualActionCount}

## Control Highlights

${highlightLines}

## Next Action

- ${review.nextAction}
`;
}
