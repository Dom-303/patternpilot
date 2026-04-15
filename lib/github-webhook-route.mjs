import path from "node:path";
import fs from "node:fs/promises";

function buildGithubRepoUrl(fullName) {
  return fullName ? `https://github.com/${fullName}` : null;
}

function quoteShellArg(value) {
  return JSON.stringify(String(value));
}

export function resolveProjectKeyForWebhookRoute(config, envelope, preferredProjectKey = null) {
  const projects = config.projects ?? {};

  if (preferredProjectKey && projects[preferredProjectKey]) {
    return {
      projectKey: preferredProjectKey,
      source: "explicit",
      project: projects[preferredProjectKey]
    };
  }

  const fullName = envelope?.repository?.fullName ?? null;
  const repoName = fullName ? fullName.split("/").pop() : null;
  if (!repoName) {
    return null;
  }

  for (const [projectKey, project] of Object.entries(projects)) {
    if (projectKey === repoName || path.basename(project.projectRoot ?? "") === repoName) {
      return {
        projectKey,
        source: "repository_match",
        project
      };
    }
  }

  return null;
}

function buildCommandSpec(commandName, args, status = "ready", reason = null) {
  return {
    commandName,
    args,
    status,
    reason,
    shellCommand: ["npm", "run", "patternpilot", "--", commandName, ...args].map(quoteShellArg).join(" ")
  };
}

function buildAnalyzeSpec(projectKey, urls, status = "ready", reason = null) {
  return {
    commandName: "on-demand",
    args: ["--project", projectKey, ...urls],
    status,
    reason,
    shellCommand: ["npm", "run", "analyze", "--", "--project", projectKey, ...urls].map(quoteShellArg).join(" ")
  };
}

function normalizeUrlList(values) {
  return Array.isArray(values)
    ? values.map((value) => String(value).trim()).filter(Boolean)
    : [];
}

export function buildGithubWebhookRoutePlan(config, envelope, options = {}) {
  const projectSelection = resolveProjectKeyForWebhookRoute(config, envelope, options.project ?? null);
  const projectKey = projectSelection?.projectKey ?? null;
  const payload = envelope.payload ?? {};
  const clientPayload = payload.client_payload ?? {};
  const route = {
    schemaVersion: 1,
    generatedAt: envelope.generatedAt,
    eventKey: envelope.patternpilotEventKey,
    deliveryId: envelope.deliveryId ?? null,
    signatureStatus: envelope.verification?.status ?? "unknown",
    projectSelection,
    routeStatus: "unknown_event",
    gate: "manual",
    commands: [],
    artifacts: [],
    nextAction: "Add a route for this event before treating it as a stable GitHub App integration path."
  };

  if (envelope.verification?.valid === false) {
    route.routeStatus = "blocked_invalid_signature";
    route.nextAction = "Do not dispatch this webhook route until the GitHub signature validates cleanly.";
    return route;
  }

  if (envelope.patternpilotEventKey === "repository_dispatch.patternpilot_on_demand") {
    const requestedProject = clientPayload.project ?? projectKey;
    const urls = normalizeUrlList(clientPayload.urls);
    if (urls.length === 0) {
      const repoUrl = buildGithubRepoUrl(envelope.repository.fullName);
      if (repoUrl) {
        urls.push(repoUrl);
      }
    }

    if (requestedProject && urls.length > 0) {
      route.routeStatus = "dispatchable";
      route.gate = "manual";
      route.commands.push(buildAnalyzeSpec(requestedProject, urls));
      route.artifacts = [
        "runs/<project>/<run-id>/summary.md",
        "projects/<project>/reports/latest-report.json"
      ];
      route.nextAction = "This dispatch is concrete enough to trigger the existing on-demand flow through a thin adapter.";
      return route;
    }

    route.routeStatus = "blocked_missing_inputs";
    route.nextAction = "Provide client_payload.project and at least one URL, or send the dispatch from a repository that can be resolved into a known project.";
    return route;
  }

  if (envelope.patternpilotEventKey === "installation.created") {
    route.routeStatus = "manual_packet";
    route.gate = "manual";
    route.commands.push(buildCommandSpec("github-app-installation-review", projectKey ? ["--project", projectKey] : [], "ready"));
    route.commands.push(buildCommandSpec("github-app-installation-apply", projectKey ? ["--project", projectKey] : [], "manual_confirmation", "Persist the installation packet only after reviewing the mapped project scope."));
    route.commands.push(buildCommandSpec("setup-checklist", []));
    route.commands.push(buildCommandSpec("show-project", projectKey ? ["--project", projectKey] : [], projectKey ? "ready" : "needs_project", projectKey ? null : "Select or initialize the target project binding first."));
    route.commands.push(buildCommandSpec("init-project", projectKey ? ["--project", projectKey] : [], "manual_template", "Prepare an explicit binding decision before creating or updating project state."));
    route.artifacts = [
      "state/github-app-installations.json",
      "deployment/github-app/.env.local",
      "projects/<project>/PROJECT_CONTEXT.md"
    ];
    route.nextAction = "Use this packet to bootstrap installation setup and explicitly decide which Patternpilot project binding this installation belongs to.";
    return route;
  }

  if (envelope.patternpilotEventKey === "installation_repositories.added") {
    const repositories = Array.isArray(payload.repositories) ? payload.repositories : [];
    const urls = repositories.map((item) => buildGithubRepoUrl(item.full_name)).filter(Boolean);
    route.gate = "manual_or_limited_unattended";
    route.artifacts = [
      "state/github-app-installations.json",
      "runs/integration/github-app/<run-id>/summary.md",
      "projects/<project>/reports/latest-report.json"
    ];
    route.commands.push(buildCommandSpec("github-app-installation-review", projectKey ? ["--project", projectKey] : [], "ready"));
    route.commands.push(buildCommandSpec("github-app-installation-apply", projectKey ? ["--project", projectKey] : [], "manual_confirmation", "Update installation state before dispatching newly granted repositories further."));
    route.commands.push(buildCommandSpec("discover-workspace", []));
    if (projectKey) {
      route.commands.push(buildCommandSpec("run-plan", ["--project", projectKey]));
      if (urls.length > 0) {
        route.commands.push(buildAnalyzeSpec(projectKey, urls, "ready"));
        route.routeStatus = "limited_dispatchable";
        route.nextAction = "Project binding is known; the newly granted repositories can now enter the normal on-demand path.";
        return route;
      }
    }

    route.routeStatus = projectKey ? "manual_packet" : "blocked_missing_project";
    route.nextAction = projectKey
      ? "Resolve which of the newly added repositories should become watchlist inputs versus one-off analyses."
      : "Resolve or initialize the target project binding before routing newly added repositories.";
    return route;
  }

  if (envelope.patternpilotEventKey === "push.default_branch") {
    if (!projectKey) {
      route.routeStatus = "blocked_missing_project";
      route.gate = "governance";
      route.nextAction = "Map the repository to a Patternpilot project before routing drift and governance checks.";
      return route;
    }

    route.routeStatus = "governance_review";
    route.gate = "governance";
    route.commands.push(buildCommandSpec("run-drift", ["--project", projectKey]));
    route.commands.push(buildCommandSpec("run-governance", ["--project", projectKey, "--scope", "automation"]));
    route.commands.push(buildCommandSpec("automation-dispatch", ["--automation-job", `${projectKey}-apply`], "guarded", "Dispatch stays guarded by current governance and job-state signals."));
    route.artifacts = [
      "runs/<project>/<run-id>/summary.md",
      "state/automation_jobs_state.json"
    ];
    route.nextAction = "Run drift and governance first; only then decide whether unattended follow-up automation should continue.";
    return route;
  }

  if (envelope.patternpilotEventKey === "workflow_dispatch.curation_review") {
    if (!projectKey) {
      route.routeStatus = "blocked_missing_project";
      route.gate = "manual";
      route.nextAction = "Provide or resolve the target project before driving curation review.";
      return route;
    }

    route.routeStatus = "manual_packet";
    route.gate = "manual";
    route.commands.push(buildCommandSpec("policy-curation-review", ["--project", projectKey]));
    route.commands.push(buildCommandSpec("policy-curation-batch-plan", ["--project", projectKey]));
    route.commands.push(buildCommandSpec("policy-curation-batch-apply", ["--project", projectKey], "manual_confirmation", "Keep batch apply behind an explicit manual review step."));
    route.artifacts = [
      "projects/<project>/calibration/batch-review/<id>/summary.md",
      "knowledge/repo_decisions.md"
    ];
    route.nextAction = "Use the existing curation commands as the execution layer behind this dispatch surface.";
    return route;
  }

  return route;
}

export function renderGithubWebhookRoutePlanSummary({ routePlan, envelope }) {
  const commandLines = routePlan.commands.length > 0
    ? routePlan.commands.map((item) => `- ${item.commandName}: ${item.status}${item.reason ? ` | reason=${item.reason}` : ""} | shell=${item.shellCommand}`).join("\n")
    : "- none";
  const artifactLines = routePlan.artifacts.length > 0
    ? routePlan.artifacts.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub Webhook Route

- generated_at: ${routePlan.generatedAt}
- delivery_id: ${routePlan.deliveryId ?? "-"}
- event_key: ${routePlan.eventKey ?? "-"}
- repository: ${envelope.repository.fullName ?? "-"}
- project: ${routePlan.projectSelection?.projectKey ?? "-"}
- project_source: ${routePlan.projectSelection?.source ?? "-"}
- signature_status: ${routePlan.signatureStatus}
- route_status: ${routePlan.routeStatus}
- gate: ${routePlan.gate}

## Commands

${commandLines}

## Artifacts

${artifactLines}

## Next Action

- ${routePlan.nextAction}
`;
}

export async function writeGithubWebhookRouteArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-routes", options.runId);
  const routePath = path.join(integrationRoot, "route-plan.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      routePath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(routePath, `${JSON.stringify(options.routePlan, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    routePath,
    summaryPath
  };
}
