import { inspectGithubAuth, inspectGithubAppAuth } from "./auth.mjs";

export function buildGithubAppReadiness(config) {
  const auth = inspectGithubAuth(config);
  const githubApp = inspectGithubAppAuth();
  const reasons = [];
  let status = "missing_auth";
  let nextAction = "Configure PAT or GitHub App credentials before expecting external GitHub integration to work.";

  if (githubApp.appReady) {
    status = "app_ready";
    reasons.push("All expected GitHub App environment variables are present.");
    nextAction = "Validate webhook delivery and installation flow against a real repo or test org.";
  } else if (auth.tokenPresent) {
    status = "cli_ready_app_missing";
    reasons.push("CLI/PAT-based GitHub access is available.");
    reasons.push(`${githubApp.missingVars.length} GitHub App variable(s) are still missing.`);
    nextAction = "Keep the kernel on PAT/CLI for now and fill the missing GitHub App env vars when moving into live app integration.";
  } else if (githubApp.presentVars.length > 0) {
    status = "partial_app_config";
    reasons.push("Some GitHub App variables are present, but the App setup is incomplete.");
    nextAction = "Complete the missing GitHub App env vars before attempting webhook or installation flows.";
  } else {
    reasons.push("Neither PAT-based CLI auth nor a complete GitHub App setup is present.");
  }

  return {
    status,
    auth,
    githubApp,
    reasons,
    nextAction
  };
}

export function renderGithubAppReadinessSummary({ generatedAt, readiness }) {
  return `# Patternpilot GitHub App Readiness

- generated_at: ${generatedAt}
- status: ${readiness.status}
- auth_mode: ${readiness.auth.authMode}
- token_present: ${readiness.auth.tokenPresent ? "yes" : "no"}
- github_app_ready: ${readiness.githubApp.appReady ? "yes" : "no"}
- github_app_present_vars: ${readiness.githubApp.presentVars.join(", ") || "-"}
- github_app_missing_vars: ${readiness.githubApp.missingVars.join(", ") || "-"}

## Reasons

${readiness.reasons.map((item) => `- ${item}`).join("\n") || "- none"}

## Next Action

- ${readiness.nextAction}
`;
}

export function buildGithubAppIntegrationPlan(config) {
  const readiness = buildGithubAppReadiness(config);
  const requiredPermissions = [
    {
      area: "metadata",
      access: "read",
      reason: "Repository identity, default branch and visibility are needed for discovery, intake and project binding context."
    },
    {
      area: "contents",
      access: "read",
      reason: "README and repository files feed enrichment, review context and later report generation."
    }
  ];
  const laterPermissions = [
    {
      area: "actions",
      access: "read",
      reason: "Helpful later for correlating follow-up loops with CI/check status, but not required for the current kernel."
    },
    {
      area: "issues",
      access: "read",
      reason: "Can enrich future curation and repo intelligence, but should stay outside the first app cutover."
    }
  ];
  const eventBindings = [
    {
      eventKey: "repository_dispatch.patternpilot_on_demand",
      transport: "synthetic_dispatch",
      currentStatus: "ready_now",
      gate: "manual",
      commandPath: ["on-demand"],
      purpose: "Run one explicit repo or project analysis on demand from a UI, button or manual trigger.",
      artifacts: [
        "runs/<project>/<run-id>/summary.md",
        "projects/<project>/reports/latest-report.json"
      ]
    },
    {
      eventKey: "schedule.tick",
      transport: "scheduler_or_app_job",
      currentStatus: "ready_now",
      gate: "governance",
      commandPath: ["automation-dispatch", "automation-alerts"],
      purpose: "Run optional recurring maintenance while keeping scheduling outside the product core.",
      artifacts: [
        "runs/automation/<run-id>/summary.md",
        "state/automation_alerts.json"
      ]
    },
    {
      eventKey: "workflow_dispatch.curation_review",
      transport: "synthetic_dispatch",
      currentStatus: "ready_now",
      gate: "manual",
      commandPath: [
        "policy-curation-review",
        "policy-curation-batch-plan",
        "policy-curation-batch-apply"
      ],
      purpose: "Drive manual curation review and controlled apply from an app surface or GitHub-triggered action.",
      artifacts: [
        "projects/<project>/calibration/batch-review/<id>/summary.md",
        "knowledge/repo_decisions.md"
      ]
    },
    {
      eventKey: "installation.created",
      transport: "github_app_webhook",
      currentStatus: "phase_4_design",
      gate: "manual",
      commandPath: ["github-app-installation-review", "github-app-installation-apply", "setup-checklist", "show-project"],
      purpose: "Bootstrap installation metadata and decide how the new installation maps onto Patternpilot project bindings.",
      artifacts: [
        "state/github-app-installations.json",
        "deployment/github-app/.env.local",
        "projects/<project>/PROJECT_CONTEXT.md"
      ]
    },
    {
      eventKey: "installation_repositories.added",
      transport: "github_app_webhook",
      currentStatus: "phase_4_design",
      gate: "manual_or_limited_unattended",
      commandPath: ["github-app-installation-review", "github-app-installation-apply", "discover-workspace", "run-plan", "on-demand"],
      purpose: "Re-scan newly granted repositories and decide whether they should become bindings, watchlist inputs or one-off analyses.",
      artifacts: [
        "state/github-app-installations.json",
        "runs/integration/github-app/<run-id>/summary.md",
        "projects/<project>/reports/latest-report.json"
      ]
    },
    {
      eventKey: "push.default_branch",
      transport: "github_app_webhook",
      currentStatus: "phase_4_design",
      gate: "governance",
      commandPath: ["run-drift", "run-governance", "automation-dispatch"],
      purpose: "Inspect repo drift after meaningful default-branch changes and decide whether unattended follow-up loops stay safe.",
      artifacts: [
        "runs/<project>/<run-id>/summary.md",
        "state/automation_jobs_state.json"
      ]
    }
  ];

  let status = "phase_4_bridge";
  let nextAction = "Model webhook envelopes and installation state around the current event bindings before wiring any live GitHub App service.";
  if (readiness.status === "app_ready") {
    status = "app_ready_for_webhook_trial";
    nextAction = "Validate webhook delivery and installation routing with a small test org or sandbox repo.";
  } else if (readiness.status === "cli_ready_app_missing") {
    status = "cli_bridge_app_missing";
    nextAction = "Keep shipping on the CLI/PAT bridge, but fill the missing GitHub App env vars before live webhook work.";
  }

  return {
    schemaVersion: 1,
    status,
    readiness,
    requiredPermissions,
    laterPermissions,
    eventBindings,
    installationModel: {
      repoSelection: "selected_repositories",
      tenancy: "one app installation can later map to one or more Patternpilot project bindings",
      notes: [
        "The product kernel stays project-neutral; installations should resolve into explicit Patternpilot project keys rather than implicit repo magic.",
        "Webhook delivery should enrich or trigger existing flows, not bypass on-demand, policy or governance stages.",
        "A local installation registry keeps installation IDs, seen repositories and mapped project keys visible before any live multi-repo automation is enabled."
      ]
    },
    nextAction
  };
}

export function renderGithubAppIntegrationPlanSummary({ generatedAt, plan }) {
  const permissionLines = plan.requiredPermissions.map((item) => `- ${item.area}: ${item.access} | ${item.reason}`).join("\n");
  const laterPermissionLines = plan.laterPermissions.map((item) => `- ${item.area}: ${item.access} | ${item.reason}`).join("\n");
  const eventLines = plan.eventBindings.map((item) => `- ${item.eventKey}: ${item.currentStatus} | transport=${item.transport} | gate=${item.gate} | commands=${item.commandPath.join(" -> ")} | purpose=${item.purpose}`).join("\n");

  return `# Patternpilot GitHub App Plan

- generated_at: ${generatedAt}
- status: ${plan.status}
- readiness_status: ${plan.readiness.status}
- repo_selection: ${plan.installationModel.repoSelection}

## Required Permissions

${permissionLines}

## Later Permissions

${laterPermissionLines}

## Event Bindings

${eventLines}

## Installation Model

${plan.installationModel.notes.map((item) => `- ${item}`).join("\n")}

## Next Action

- ${plan.nextAction}
`;
}
