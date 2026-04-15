import fs from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import {
  safeReadFile,
  asRelativeFromRoot,
  wait,
  decodeBase64Markdown,
  stripMarkdown
} from "./utils.mjs";

export function resolveGithubToken(githubConfig) {
  for (const envName of githubConfig.authEnvVars ?? []) {
    const value = process.env[envName];
    if (value) {
      return {
        token: value,
        envName,
        authMode: "token"
      };
    }
  }

  return {
    token: null,
    envName: null,
    authMode: "anonymous"
  };
}

export function inspectGithubAuth(config) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  return {
    authMode: auth.authMode,
    authSource: auth.envName,
    configuredEnvVars: githubConfig.authEnvVars ?? [],
    tokenPresent: Boolean(auth.token)
  };
}

export function inspectGithubAppAuth() {
  const requiredVars = [
    "PATTERNPILOT_GITHUB_APP_ID",
    "PATTERNPILOT_GITHUB_APP_CLIENT_ID",
    "PATTERNPILOT_GITHUB_APP_CLIENT_SECRET",
    "PATTERNPILOT_GITHUB_APP_PRIVATE_KEY_PATH",
    "PATTERNPILOT_GITHUB_WEBHOOK_SECRET"
  ];
  const presentVars = requiredVars.filter((name) => Boolean(process.env[name]));
  return {
    requiredVars,
    presentVars,
    missingVars: requiredVars.filter((name) => !process.env[name]),
    appReady: requiredVars.every((name) => Boolean(process.env[name]))
  };
}

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

export function buildSetupChecklist() {
  return {
    pat: {
      envVar: "PATTERNPILOT_GITHUB_TOKEN",
      filePath: ".env.local",
      whereToFind:
        "GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens",
      docsUrl:
        "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
      note:
        "Use a fine-grained PAT with repository read access for the repos Patternpilot should analyze."
    },
    githubApp: [
      {
        key: "PATTERNPILOT_GITHUB_APP_ID",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > App ID",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_CLIENT_ID",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Client ID",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_CLIENT_SECRET",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Generate a new client secret",
        docsUrl:
          "https://docs.github.com/enterprise-cloud@latest/apps/maintaining-github-apps/modifying-a-github-app-registration"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_PRIVATE_KEY_PATH",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Private keys > Generate a private key",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps"
      },
      {
        key: "PATTERNPILOT_GITHUB_WEBHOOK_SECRET",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "Choose your own secret value when configuring the webhook endpoint for the GitHub App",
        docsUrl:
          "https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries"
      }
    ]
  };
}

export async function initializeEnvFiles(rootDir, options = {}) {
  const templates = [
    {
      source: path.join(rootDir, ".env.example"),
      target: path.join(rootDir, ".env.local")
    },
    {
      source: path.join(rootDir, "deployment/github-app/.env.example"),
      target: path.join(rootDir, "deployment/github-app/.env.local")
    }
  ];
  const results = [];

  for (const template of templates) {
    const sourceContent = await safeReadFile(template.source);
    if (!sourceContent) {
      continue;
    }
    const existing = await safeReadFile(template.target);
    if (existing && !options.force) {
      results.push({
        path: asRelativeFromRoot(rootDir, template.target),
        status: "exists"
      });
      continue;
    }
    if (!options.dryRun) {
      await fs.mkdir(path.dirname(template.target), { recursive: true });
      await fs.writeFile(template.target, sourceContent, "utf8");
    }
    results.push({
      path: asRelativeFromRoot(rootDir, template.target),
      status: options.dryRun ? "planned" : "created"
    });
  }

  return results;
}

export function createHeaders(githubConfig, auth) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": githubConfig.userAgent ?? "patternpilot"
  };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

async function fetchJson(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      new URL(url),
      {
        method: "GET",
        headers,
        timeout: timeoutMs
      },
      (response) => {
        let payload = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          payload += chunk;
        });
        response.on("end", () => {
          try {
            const data = payload ? JSON.parse(payload) : {};
            if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
              const message = data?.message || response.statusMessage || "request failed";
              reject(new Error(`GitHub API ${response.statusCode}: ${message}`));
              return;
            }
            resolve(data);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });
    request.on("timeout", () => {
      request.destroy(new Error("request aborted"));
    });
    request.end();
  });
}

function shouldRetryGithubError(error) {
  const message = error?.message ?? "";
  return (
    message.includes("fetch failed") ||
    message.includes("aborted") ||
    message.includes("EAI_AGAIN") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNRESET")
  );
}

export async function fetchJsonWithRetry(url, headers, timeoutMs, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJson(url, headers, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetryGithubError(error)) {
        throw error;
      }
      await wait(800 * attempt);
    }
  }
  throw lastError;
}

export async function runGithubDoctor(config, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  const diagnosis = {
    authMode: auth.authMode,
    authSource: auth.envName,
    configuredEnvVars: githubConfig.authEnvVars ?? [],
    tokenPresent: Boolean(auth.token),
    apiBaseUrl: githubConfig.apiBaseUrl ?? "https://api.github.com",
    networkStatus: options.offline ? "skipped_offline" : "not_checked",
    rateLimit: null,
    error: null
  };

  if (options.offline) {
    return diagnosis;
  }

  try {
    const headers = createHeaders(githubConfig, auth);
    const data = await fetchJsonWithRetry(
      `${diagnosis.apiBaseUrl}/rate_limit`,
      headers,
      githubConfig.requestTimeoutMs ?? 12000,
      2
    );
    const core = data?.resources?.core ?? {};
    diagnosis.networkStatus = "ok";
    diagnosis.rateLimit = {
      limit: core.limit ?? null,
      remaining: core.remaining ?? null,
      used: core.used ?? null,
      reset: core.reset ? new Date(core.reset * 1000).toISOString() : null
    };
  } catch (error) {
    diagnosis.networkStatus = "failed";
    diagnosis.error = error.message;
  }

  return diagnosis;
}

export async function enrichGithubRepo(repo, config, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);

  if (options.skipEnrich) {
    return {
      status: "skipped",
      authMode: auth.authMode,
      authSource: auth.envName
    };
  }

  const headers = createHeaders(githubConfig, auth);
  const baseUrl = githubConfig.apiBaseUrl ?? "https://api.github.com";
  const timeoutMs = githubConfig.requestTimeoutMs ?? 12000;

  try {
    const repoData = await fetchJsonWithRetry(
      `${baseUrl}/repos/${repo.owner}/${repo.name}`,
      headers,
      timeoutMs
    );

    let readme = null;
    try {
      const readmeData = await fetchJsonWithRetry(
        `${baseUrl}/repos/${repo.owner}/${repo.name}/readme`,
        headers,
        timeoutMs
      );
      const rawReadme = decodeBase64Markdown(readmeData.content);
      readme = {
        path: readmeData.path,
        htmlUrl: readmeData.html_url,
        excerpt: stripMarkdown(rawReadme, githubConfig.readmeExcerptMaxChars ?? 1600)
      };
    } catch (error) {
      readme = {
        path: null,
        htmlUrl: null,
        excerpt: "",
        error: error.message
      };
    }

    let languages = [];
    try {
      const languagesData = await fetchJsonWithRetry(
        `${baseUrl}/repos/${repo.owner}/${repo.name}/languages`,
        headers,
        timeoutMs
      );
      languages = Object.keys(languagesData);
    } catch {
      languages = [];
    }

    return {
      status: "success",
      authMode: auth.authMode,
      authSource: auth.envName,
      fetchedAt: new Date().toISOString(),
      repo: {
        fullName: repoData.full_name,
        description: repoData.description ?? "",
        homepage: repoData.homepage ?? "",
        topics: repoData.topics ?? [],
        defaultBranch: repoData.default_branch ?? "",
        visibility: repoData.visibility ?? "public",
        archived: Boolean(repoData.archived),
        fork: Boolean(repoData.fork),
        stars: repoData.stargazers_count ?? 0,
        forks: repoData.forks_count ?? 0,
        openIssues: repoData.open_issues_count ?? 0,
        watchers: repoData.watchers_count ?? 0,
        language: repoData.language ?? "",
        license: repoData.license?.spdx_id || repoData.license?.name || "",
        createdAt: repoData.created_at ?? "",
        updatedAt: repoData.updated_at ?? "",
        pushedAt: repoData.pushed_at ?? ""
      },
      languages,
      readme
    };
  } catch (error) {
    return {
      status: "failed",
      authMode: auth.authMode,
      authSource: auth.envName,
      fetchedAt: new Date().toISOString(),
      error: error.message
    };
  }
}
