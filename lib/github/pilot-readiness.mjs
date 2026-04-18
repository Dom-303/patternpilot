import { buildGithubAppReadiness } from "./app-planning.mjs";
import { buildSetupChecklist } from "./setup.mjs";

function buildChecklist(readiness, closeoutReview, context = {}) {
  const controlReview = closeoutReview.controlReview;
  const scaffoldState = context.scaffoldState ?? {};
  const envState = context.envState ?? {};

  const credentialsStatus = readiness.status === "missing_auth" || readiness.status === "partial_app_config"
    ? "blocked"
    : "pass";

  const appCutoverStatus = readiness.githubApp.appReady
    ? "pass"
    : "followup";

  const runtimeControlStatus = controlReview.controlStatus === "runtime_control_critical"
    ? "blocked"
    : controlReview.controlStatus === "runtime_control_healthy"
      ? "pass"
      : "followup";

  const runtimeCloseoutStatus = closeoutReview.closeoutStatus === "closeout_blocked"
    ? "blocked"
    : closeoutReview.closeoutStatus === "closeout_ready"
      ? "pass"
      : "followup";

  const localBootstrapStatus = envState.rootEnvLocalPresent || envState.githubAppEnvLocalPresent || readiness.auth.tokenPresent || readiness.githubApp.appReady
    ? "pass"
    : "followup";

  const scaffoldStatus = scaffoldState.githubAppScaffoldPresent && scaffoldState.automationOpsPresent
    ? "pass"
    : "followup";

  return [
    {
      key: "credential_surface",
      status: credentialsStatus,
      label: "At least one real GitHub pilot credential path is available",
      detail: credentialsStatus === "pass"
        ? readiness.githubApp.appReady
          ? "GitHub App credentials are complete enough for a live webhook trial."
          : "CLI/PAT bridge is ready for a first real pilot run."
        : readiness.nextAction
    },
    {
      key: "runtime_control",
      status: runtimeControlStatus,
      label: "Runtime control surface is healthy enough for a pilot",
      detail: controlReview.nextAction
    },
    {
      key: "runtime_closeout",
      status: runtimeCloseoutStatus,
      label: "Runtime closeout is in a pilot-safe state",
      detail: closeoutReview.nextAction
    },
    {
      key: "app_cutover",
      status: appCutoverStatus,
      label: "GitHub App cutover path is fully populated",
      detail: readiness.githubApp.appReady
        ? "All expected GitHub App environment variables are present."
        : `Missing GitHub App vars: ${readiness.githubApp.missingVars.join(", ") || "-"}`
    },
    {
      key: "local_bootstrap",
      status: localBootstrapStatus,
      label: "Local bootstrap env files or live env values are present",
      detail: `root_env_local=${envState.rootEnvLocalPresent ? "yes" : "no"} | github_app_env_local=${envState.githubAppEnvLocalPresent ? "yes" : "no"}`
    },
    {
      key: "pilot_scaffolds",
      status: scaffoldStatus,
      label: "Reference scaffolds for app and automation pilot work are present",
      detail: `github_app_scaffold=${scaffoldState.githubAppScaffoldPresent ? "yes" : "no"} | automation_ops=${scaffoldState.automationOpsPresent ? "yes" : "no"}`
    }
  ];
}

function buildRecommendedCommands(defaultProject, review) {
  const projectArg = defaultProject ?? "<project>";
  const commands = [];

  if (review.pilotStatus === "pilot_live_ready") {
    commands.push(
      "npm run patternpilot -- github-app-readiness",
      `npm run patternpilot -- github-app-webhook-preview --headers-file deployment/github-app/examples/installation.created.headers.json --file deployment/github-app/examples/installation.created.json --webhook-secret <secret> --dry-run`,
      `npm run patternpilot -- github-app-installation-review --file deployment/github-app/examples/installation.created.json --headers-file deployment/github-app/examples/installation.created.headers.json --github-event installation --webhook-secret <secret> --dry-run`
    );
  } else if (review.pilotStatus === "pilot_bridge_ready") {
    commands.push(
      `npm run patternpilot -- on-demand --project ${projectArg} --dry-run`,
      "npm run patternpilot -- github-app-service-runtime-control-review --dry-run",
      "npm run patternpilot -- github-app-live-pilot-review --dry-run"
    );
  } else {
    commands.push(
      "npm run patternpilot -- setup-checklist",
      "npm run patternpilot -- github-app-readiness",
      "npm run patternpilot -- github-app-service-runtime-closeout-review --dry-run"
    );
  }

  return commands;
}

function classifyPilotMode(readiness) {
  if (readiness.githubApp.appReady) {
    return "github_app_live_trial";
  }
  if (readiness.auth.tokenPresent) {
    return "cli_bridge_pilot";
  }
  return "pilot_blocked";
}

function classifyPilotStatus(readiness, closeoutReview) {
  const controlReview = closeoutReview.controlReview;

  if (
    readiness.status === "missing_auth"
    || readiness.status === "partial_app_config"
    || controlReview.controlStatus === "runtime_control_critical"
    || closeoutReview.closeoutStatus === "closeout_blocked"
  ) {
    return "pilot_blocked";
  }

  if (
    controlReview.controlStatus !== "runtime_control_healthy"
    || closeoutReview.closeoutStatus !== "closeout_ready"
  ) {
    return "pilot_followup_required";
  }

  return readiness.githubApp.appReady
    ? "pilot_live_ready"
    : "pilot_bridge_ready";
}

function buildNextAction(review) {
  if (review.pilotStatus === "pilot_live_ready") {
    return "Run a small live GitHub App pilot against a sandbox repo or test org and validate webhook -> installation -> route behavior end to end.";
  }
  if (review.pilotStatus === "pilot_bridge_ready") {
    return "Run the first real PAT/CLI-backed pilot on one target project, then fill the missing GitHub App env vars before live app cutover.";
  }
  return review.blockers[0]?.detail
    ?? review.followups[0]?.detail
    ?? "Clear the remaining setup or runtime follow-up items before attempting a real pilot.";
}

export function buildGithubAppLivePilotReview(config, context = {}, options = {}) {
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const readiness = context.readiness ?? buildGithubAppReadiness(config);
  const closeoutReview = context.closeoutReview;

  if (!closeoutReview) {
    throw new Error("buildGithubAppLivePilotReview requires a closeoutReview.");
  }

  const checklist = buildChecklist(readiness, closeoutReview, context);
  const pilotMode = classifyPilotMode(readiness);
  const pilotStatus = classifyPilotStatus(readiness, closeoutReview);
  const passCount = checklist.filter((item) => item.status === "pass").length;
  const followups = checklist.filter((item) => item.status === "followup");
  const blockers = checklist.filter((item) => item.status === "blocked");
  const installationState = context.installationState ?? {};
  const installations = Array.isArray(installationState.installations) ? installationState.installations : [];
  const governedInstallationCount = installations.filter((item) => item.governance?.status === "governance_configured").length;
  const runtimeReadyInstallationCount = installations.filter((item) => item.runtime?.status === "runtime_configured").length;
  const serviceReadyInstallationCount = installations.filter((item) => item.operations?.serviceStatus === "service_ready").length;

  const review = {
    schemaVersion: 1,
    generatedAt,
    pilotStatus,
    pilotMode,
    readiness,
    closeoutReview,
    checklist,
    setupChecklist: buildSetupChecklist(),
    envState: context.envState ?? {},
    scaffoldState: context.scaffoldState ?? {},
    installationSummary: {
      installationCount: installations.length,
      governedInstallationCount,
      runtimeReadyInstallationCount,
      serviceReadyInstallationCount
    },
    passCount,
    followupCount: followups.length,
    blockerCount: blockers.length,
    followups,
    blockers
  };

  review.recommendedCommands = buildRecommendedCommands(config.defaultProject, review);
  review.nextAction = buildNextAction(review);
  return review;
}

export function renderGithubAppLivePilotSummary(review) {
  const checklistLines = review.checklist.length > 0
    ? review.checklist.map((item) =>
      `- key=${item.key} | status=${item.status} | label=${item.label} | detail=${item.detail}`
    ).join("\n")
    : "- none";
  const commandLines = review.recommendedCommands.length > 0
    ? review.recommendedCommands.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Live Pilot Review

- generated_at: ${review.generatedAt}
- pilot_status: ${review.pilotStatus}
- pilot_mode: ${review.pilotMode}
- readiness_status: ${review.readiness.status}
- control_status: ${review.closeoutReview.controlReview.controlStatus}
- closeout_status: ${review.closeoutReview.closeoutStatus}
- pass_count: ${review.passCount}
- followup_count: ${review.followupCount}
- blocker_count: ${review.blockerCount}
- installation_count: ${review.installationSummary.installationCount}
- governed_installation_count: ${review.installationSummary.governedInstallationCount}
- runtime_ready_installation_count: ${review.installationSummary.runtimeReadyInstallationCount}
- service_ready_installation_count: ${review.installationSummary.serviceReadyInstallationCount}

## Pilot Checklist

${checklistLines}

## Recommended Commands

${commandLines}

## Next Action

- ${review.nextAction}
`;
}
