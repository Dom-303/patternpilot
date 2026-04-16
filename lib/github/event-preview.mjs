import fs from "node:fs/promises";
import path from "node:path";
import { buildGithubAppIntegrationPlan } from "./app-planning.mjs";

function extractRepoRef(payload) {
  const repository = payload?.repository ?? {};
  const ownerLogin = repository?.owner?.login ?? repository?.owner?.name ?? null;
  const name = repository?.name ?? null;
  return {
    owner: ownerLogin,
    name,
    fullName: repository?.full_name ?? (ownerLogin && name ? `${ownerLogin}/${name}` : null),
    defaultBranch: repository?.default_branch ?? null,
    visibility: repository?.visibility ?? null,
    private: repository?.private ?? null
  };
}

function extractInstallationRef(payload) {
  const installation = payload?.installation ?? null;
  if (!installation) {
    return null;
  }
  return {
    id: installation.id ?? null,
    accountLogin: installation?.account?.login ?? null,
    targetType: installation?.target_type ?? null
  };
}

function collectSuggestedArtifacts(binding) {
  return Array.isArray(binding?.artifacts) ? binding.artifacts : [];
}

export function buildGithubAppEventPreview(config, input = {}) {
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const plan = buildGithubAppIntegrationPlan(config);
  const eventKey = input.eventKey ?? null;
  const binding = plan.eventBindings.find((item) => item.eventKey === eventKey) ?? null;
  const payload = input.payload ?? {};
  const repository = extractRepoRef(payload);
  const installation = extractInstallationRef(payload);
  const deliveryId = input.deliveryId ?? null;
  const githubAction = input.githubAction ?? payload?.action ?? null;

  let previewStatus = "unknown_event";
  let nextAction = "Map this event explicitly before treating it as a stable GitHub App integration surface.";
  if (binding) {
    previewStatus = binding.currentStatus === "ready_now" ? "mapped_now" : "planned_phase_4";
    nextAction = binding.currentStatus === "ready_now"
      ? "Trigger the mapped existing command path through a thin app adapter when ready."
      : "Keep this event in the plan layer until webhook delivery, installation state and governance handoff are implemented.";
  }

  const route = binding
    ? {
        eventKey: binding.eventKey,
        transport: binding.transport,
        gate: binding.gate,
        commandPath: binding.commandPath,
        purpose: binding.purpose,
        artifacts: collectSuggestedArtifacts(binding)
      }
    : null;

  return {
    schemaVersion: 1,
    generatedAt,
    previewStatus,
    deliveryId,
    eventKey,
    githubAction,
    repository,
    installation,
    route,
    readinessStatus: plan.readiness.status,
    nextAction
  };
}

export function renderGithubAppEventPreviewSummary({ preview }) {
  const routeLines = preview.route
    ? [
        `- transport: ${preview.route.transport}`,
        `- gate: ${preview.route.gate}`,
        `- commands: ${preview.route.commandPath.join(" -> ")}`,
        `- purpose: ${preview.route.purpose}`
      ].join("\n")
    : "- no_route";
  const artifactLines = preview.route?.artifacts?.length > 0
    ? preview.route.artifacts.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Event Preview

- generated_at: ${preview.generatedAt}
- preview_status: ${preview.previewStatus}
- readiness_status: ${preview.readinessStatus}
- delivery_id: ${preview.deliveryId ?? "-"}
- event_key: ${preview.eventKey ?? "-"}
- github_action: ${preview.githubAction ?? "-"}
- repository: ${preview.repository.fullName ?? "-"}
- default_branch: ${preview.repository.defaultBranch ?? "-"}
- installation_id: ${preview.installation?.id ?? "-"}

## Route

${routeLines}

## Artifacts

${artifactLines}

## Next Action

- ${preview.nextAction}
`;
}

export async function writeGithubAppEventPreviewArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-events", options.runId);
  const jsonPath = path.join(integrationRoot, "event-preview.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      jsonPath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(options.preview, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    jsonPath,
    summaryPath
  };
}

export async function writeGithubAppIntegrationPlanArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app", options.runId);
  const jsonPath = path.join(integrationRoot, "plan.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      jsonPath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(options.plan, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    jsonPath,
    summaryPath
  };
}
