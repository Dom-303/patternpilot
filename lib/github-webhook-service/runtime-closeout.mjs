import { buildGithubWebhookServiceRuntimeControlReview } from "./runtime-control.mjs";

function classifyCloseoutStatus(controlReview) {
  switch (controlReview.controlStatus) {
    case "runtime_control_critical":
      return "closeout_blocked";
    case "runtime_control_attention":
      return "closeout_followup_required";
    default:
      return "closeout_ready";
  }
}

function buildChecklist(controlReview) {
  return [
    {
      key: "ops_surface",
      label: "Runtime ops surface is healthy",
      status: controlReview.opsReview.healthStatus === "healthy" ? "pass" : "followup",
      detail: controlReview.opsReview.nextAction
    },
    {
      key: "integrity_surface",
      label: "Runtime integrity surface is healthy",
      status: controlReview.integrityReview.integrityStatus === "integrity_healthy" ? "pass" : "followup",
      detail: controlReview.integrityReview.nextAction
    },
    {
      key: "maintenance_surface",
      label: "Runtime maintenance surface is clear",
      status: controlReview.maintenancePlan.maintenanceStatus === "maintenance_clear" ? "pass" : "followup",
      detail: controlReview.maintenancePlan.nextAction
    },
    {
      key: "consolidated_control",
      label: "Combined runtime control review is healthy",
      status: controlReview.controlStatus === "runtime_control_healthy" ? "pass" : "followup",
      detail: controlReview.nextAction
    }
  ];
}

export async function loadGithubWebhookServiceRuntimeCloseoutState(rootDir, loaders = {}) {
  return loaders.loadGithubWebhookServiceRuntimeControlState(rootDir, loaders);
}

export function buildGithubWebhookServiceRuntimeCloseoutReview(state = {}, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const controlReview = buildGithubWebhookServiceRuntimeControlReview(state, {
    generatedAt,
    limit: options.limit
  });
  const checklist = buildChecklist(controlReview);
  const passCount = checklist.filter((item) => item.status === "pass").length;
  const followupCount = checklist.filter((item) => item.status !== "pass").length;
  const closeoutStatus = classifyCloseoutStatus(controlReview);
  const completionPercent = closeoutStatus === "closeout_ready"
    ? 100
    : closeoutStatus === "closeout_followup_required"
      ? 95
      : 85;

  return {
    schemaVersion: 1,
    generatedAt,
    closeoutStatus,
    completionPercent,
    controlReview,
    checklist,
    passCount,
    followupCount,
    nextAction: followupCount > 0
      ? controlReview.nextAction
      : "GitHub App runtime closeout is ready."
  };
}

export function renderGithubWebhookServiceRuntimeCloseoutSummary(review) {
  const checklistLines = review.checklist.length > 0
    ? review.checklist.map((item) =>
      `- key=${item.key} | status=${item.status} | label=${item.label} | detail=${item.detail}`
    ).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Service Runtime Closeout

- generated_at: ${review.generatedAt}
- closeout_status: ${review.closeoutStatus}
- completion_percent: ${review.completionPercent}
- control_status: ${review.controlReview.controlStatus}
- pass_count: ${review.passCount}
- followup_count: ${review.followupCount}

## Closeout Checklist

${checklistLines}

## Next Action

- ${review.nextAction}
`;
}
