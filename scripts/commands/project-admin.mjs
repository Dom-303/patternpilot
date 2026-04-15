import fs from "node:fs/promises";
import path from "node:path";
import {
  appendUrlsToWatchlist,
  applyGithubAppInstallationGovernanceToState,
  applyGithubAppInstallationOperationsToState,
  applyGithubAppInstallationRuntimeToState,
  createRunId,
  buildGithubAppEventPreview,
  buildGithubAppInstallationGovernancePlan,
  buildGithubAppInstallationOperationsPlan,
  buildGithubAppInstallationPacket,
  buildGithubAppInstallationRuntimePlan,
  buildGithubAppInstallationScopePlan,
  buildGithubAppInstallationStateSummary,
  buildGithubAppReadiness,
  buildGithubAppIntegrationPlan,
  buildSetupChecklist,
  buildGithubWebhookEnvelope,
  buildGithubWebhookExecutionContract,
  buildGithubWebhookDispatchPlan,
  buildGithubWebhookRecoveryAssessment,
  buildGithubWebhookRecoveryContract,
  buildGithubWebhookRunnerPlan,
  buildGithubWebhookResumeContract,
  buildGithubWebhookRunnerState,
  buildGithubWebhookServiceReviewPlan,
  buildGithubWebhookServiceRequeuePlan,
  buildGithubWebhookServiceTickPlan,
  claimGithubWebhookServiceQueueEntries,
  summarizeGithubWebhookExecution,
  summarizeGithubWebhookRunnerExecution,
  buildGithubWebhookRoutePlan,
  discoverWorkspaceProjects,
  executeGithubWebhookRunnerPlan,
  evaluateGithubWebhookRecoveryContract,
  initializeEnvFiles,
  initializeProjectBinding,
  inspectGithubAppAuth,
  inspectGithubAuth,
  loadGithubAppInstallationState,
  loadGithubWebhookExecutionContract,
  loadGithubWebhookServiceQueue,
  reclaimExpiredGithubWebhookServiceClaims,
  requeueGithubWebhookServiceQueueEntries,
  loadProjectBinding,
  enqueueGithubWebhookServiceContractFromFile,
  queueGithubWebhookServiceContract,
  executeGithubWebhookDispatchPlan,
  parseWebhookHeadersContent,
  renderGithubWebhookDispatchSummary,
  renderGithubWebhookEnvelopeSummary,
  renderGithubWebhookRunnerSummary,
  renderGithubWebhookRoutePlanSummary,
  renderGithubWebhookServiceReviewSummary,
  renderGithubWebhookServiceRequeueSummary,
  renderGithubWebhookServiceTickSummary,
  renderGithubAppEventPreviewSummary,
  renderGithubAppInstallationGovernanceSummary,
  renderGithubAppInstallationOperationsSummary,
  renderGithubAppInstallationPacketSummary,
  renderGithubAppInstallationRuntimeSummary,
  renderGithubAppInstallationScopeSummary,
  renderGithubAppIntegrationPlanSummary,
  renderGithubAppReadinessSummary,
  writeGithubAppEventPreviewArtifacts,
  writeGithubAppInstallationArtifacts,
  writeGithubAppInstallationOperationsArtifacts,
  writeGithubAppInstallationRuntimeArtifacts,
  writeGithubAppInstallationScopeArtifacts,
  writeGithubAppInstallationState,
  writeGithubAppIntegrationPlanArtifacts,
  writeGithubWebhookDispatchArtifacts,
  writeGithubWebhookPreviewArtifacts,
  writeGithubWebhookRunnerArtifacts,
  writeGithubWebhookServiceAdminArtifacts,
  writeGithubWebhookServiceArtifacts,
  writeGithubWebhookRouteArtifacts,
  applyGithubAppInstallationScopeHandoff,
  applyGithubAppInstallationPacketToState,
  runShellCommand,
  runGithubDoctor
} from "../../lib/index.mjs";
import { refreshContext } from "../shared/runtime-helpers.mjs";

export async function runRefreshContext(rootDir, config) {
  await refreshContext(rootDir, config, {
    command: "refresh-context",
    projectKey: config.defaultProject,
    mode: "manual",
    reportPath: "-"
  });
  console.log(`# Patternpilot Context Refreshed`);
  console.log(``);
  console.log(`- status_file: STATUS.md`);
  console.log(`- open_questions_file: OPEN_QUESTION.md`);
}

export async function runShowProject(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding, bindingPath } = await loadProjectBinding(rootDir, config, projectKey);
  const projectRoot = path.resolve(rootDir, project.projectRoot);

  console.log(`# Patternpilot Project Binding`);
  console.log(``);
  console.log(`- project: ${projectKey}`);
  console.log(`- label: ${binding.projectLabel ?? project.label}`);
  console.log(`- project_root: ${projectRoot}`);
  console.log(`- binding_file: ${path.relative(rootDir, bindingPath)}`);
  console.log(`- alignment_rules: ${binding.alignmentRulesFile ?? project.alignmentRulesFile ?? "-"}`);
  console.log(`- discovery_policy: ${binding.discoveryPolicyFile ?? project.discoveryPolicyFile ?? "-"}`);
  console.log(`- watchlist_file: ${project.watchlistFile ?? "-"}`);
  console.log(`- context_strategy: markdown_first + configured_context_scan`);
  console.log(``);
  console.log(`## Read Before Analysis`);
  for (const item of binding.readBeforeAnalysis) {
    console.log(`- ${item}`);
  }
  console.log(``);
  console.log(`## Reference Directories`);
  for (const item of binding.referenceDirectories) {
    console.log(`- ${item}/`);
  }
  if (binding.discoveryHints?.length > 0) {
    console.log(``);
    console.log(`## Discovery Hints`);
    for (const item of binding.discoveryHints) {
      console.log(`- ${item}`);
    }
  }
}

export function printProjectList(rootDir, config) {
  console.log(`# Patternpilot Projects`);
  console.log(``);
  console.log(`- default_project: ${config.defaultProject ?? "-"}`);
  console.log(``);
  console.log(`## Configured Projects`);
  for (const [projectKey, project] of Object.entries(config.projects ?? {})) {
    console.log(`- ${projectKey}: ${path.resolve(rootDir, project.projectRoot)} (${project.label ?? projectKey})`);
  }
}

export async function runDoctor(rootDir, config, options, envFiles) {
  const auth = inspectGithubAuth(config);
  const githubApp = inspectGithubAppAuth();
  const doctor = await runGithubDoctor(config, { offline: options.offline });
  const discovered = await discoverWorkspaceProjects(rootDir, config, {
    workspaceRoot: options.workspaceRoot,
    maxDepth: options.maxDepth
  });
  const pluginScaffoldPath = path.join(rootDir, "plugins", "patternpilot-workspace", ".codex-plugin", "plugin.json");
  const marketplacePath = path.join(rootDir, ".agents", "plugins", "marketplace.json");
  const githubAppScaffoldPath = path.join(rootDir, "deployment", "github-app", "README.md");
  const automationOpsPath = path.join(rootDir, "automation", "README.md");

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          envFiles,
          githubAuth: auth,
          githubApp,
          githubApi: doctor,
          discovered,
          productization: {
            pluginScaffold: path.relative(rootDir, pluginScaffoldPath),
            marketplaceManifest: path.relative(rootDir, marketplacePath),
            githubAppScaffold: path.relative(rootDir, githubAppScaffoldPath),
            automationOps: path.relative(rootDir, automationOpsPath)
          }
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`# Patternpilot Doctor`);
  console.log(``);
  console.log(`## Env Files`);
  if (envFiles.length === 0) {
    console.log(`- loaded: none`);
  } else {
    for (const envFile of envFiles) {
      console.log(`- ${envFile.path} (${envFile.entries} entries)`);
    }
  }
  console.log(``);
  console.log(`## GitHub Auth`);
  console.log(`- auth_mode: ${auth.authMode}`);
  console.log(`- auth_source: ${auth.authSource ?? "-"}`);
  console.log(`- token_present: ${auth.tokenPresent ? "yes" : "no"}`);
  console.log(`- configured_env_vars: ${auth.configuredEnvVars.join(", ") || "-"}`);
  console.log(``);
  console.log(`## GitHub App Auth`);
  console.log(`- app_ready: ${githubApp.appReady ? "yes" : "no"}`);
  console.log(`- present_vars: ${githubApp.presentVars.join(", ") || "-"}`);
  console.log(`- missing_vars: ${githubApp.missingVars.join(", ") || "-"}`);
  console.log(``);
  console.log(`## GitHub API`);
  console.log(`- network_status: ${doctor.networkStatus}`);
  console.log(`- api_base_url: ${doctor.apiBaseUrl}`);
  if (doctor.rateLimit) {
    console.log(`- core_limit: ${doctor.rateLimit.limit}`);
    console.log(`- core_remaining: ${doctor.rateLimit.remaining}`);
    console.log(`- core_used: ${doctor.rateLimit.used}`);
    console.log(`- core_reset: ${doctor.rateLimit.reset}`);
  }
  if (doctor.error) {
    console.log(`- error: ${doctor.error}`);
  }
  console.log(``);
  console.log(`## Workspace Discovery`);
  console.log(`- discovered_git_repos: ${discovered.length}`);
  for (const repo of discovered.slice(0, 20)) {
    console.log(
      `- ${repo.relativePath} :: ${repo.boundProjectKey ? `bound=${repo.boundProjectKey}` : `candidate=${repo.suggestedProjectKey}`}`
    );
  }
  if (discovered.length > 20) {
    console.log(`- more: ${discovered.length - 20} additional repos not shown`);
  }
  console.log(``);
  console.log(`## Productization`);
  console.log(`- plugin_scaffold: ${path.relative(rootDir, pluginScaffoldPath)}`);
  console.log(`- marketplace_manifest: ${path.relative(rootDir, marketplacePath)}`);
  console.log(`- github_app_scaffold: ${path.relative(rootDir, githubAppScaffoldPath)}`);
  console.log(`- automation_ops: ${path.relative(rootDir, automationOpsPath)}`);
}

export async function runGithubAppReadiness(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const readiness = buildGithubAppReadiness(config);
  const summary = renderGithubAppReadinessSummary({
    generatedAt,
    readiness
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      readiness,
      githubAppScaffold: path.relative(rootDir, path.join(rootDir, "deployment", "github-app", "README.md")),
      automationOps: path.relative(rootDir, path.join(rootDir, "automation", "README.md"))
    }, null, 2));
    return {
      generatedAt,
      readiness
    };
  }

  console.log(summary);
  console.log(`- github_app_scaffold: deployment/github-app/README.md`);
  console.log(`- automation_ops: automation/README.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-readiness",
    projectKey: config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: "-"
  });

  return {
    generatedAt,
    readiness
  };
}

export async function runGithubAppPlan(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const runId = createRunId();
  const plan = buildGithubAppIntegrationPlan(config);
  const summary = renderGithubAppIntegrationPlanSummary({
    generatedAt,
    plan
  });
  const artifacts = await writeGithubAppIntegrationPlanArtifacts(rootDir, {
    generatedAt,
    plan,
    runId,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        jsonPath: path.relative(rootDir, artifacts.jsonPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan
    }, null, 2));
    return {
      generatedAt,
      runId,
      plan,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_json: ${path.relative(rootDir, artifacts.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- github_app_scaffold: deployment/github-app/README.md`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_EVENT_MODEL.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-plan",
    projectKey: config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    generatedAt,
    runId,
    plan,
    artifacts
  };
}

export async function runGithubAppEventPreview(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const runId = createRunId();
  let payload = {};

  if (options.file) {
    const payloadPath = path.isAbsolute(options.file)
      ? options.file
      : path.join(rootDir, options.file);
    const raw = await fs.readFile(payloadPath, "utf8");
    payload = JSON.parse(raw);
  }

  const preview = buildGithubAppEventPreview(config, {
    generatedAt,
    eventKey: options.eventKey,
    deliveryId: options.deliveryId,
    githubAction: options.githubAction,
    payload
  });
  const summary = renderGithubAppEventPreviewSummary({
    preview
  });
  const artifacts = await writeGithubAppEventPreviewArtifacts(rootDir, {
    runId,
    preview,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        jsonPath: path.relative(rootDir, artifacts.jsonPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      preview
    }, null, 2));
    return {
      generatedAt,
      runId,
      preview,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_json: ${path.relative(rootDir, artifacts.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_EVENT_MODEL.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-event-preview",
    projectKey: config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    generatedAt,
    runId,
    preview,
    artifacts
  };
}

export async function runGithubAppWebhookPreview(rootDir, config, options) {
  if (!options.file) {
    throw new Error("github-app-webhook-preview requires --file <payload-json>.");
  }

  const generatedAt = new Date().toISOString();
  const runId = createRunId();
  const payloadPath = path.isAbsolute(options.file)
    ? options.file
    : path.join(rootDir, options.file);
  const payloadText = await fs.readFile(payloadPath, "utf8");
  const payload = JSON.parse(payloadText);

  let headers = {};
  if (options.headersFile) {
    const headersPath = path.isAbsolute(options.headersFile)
      ? options.headersFile
      : path.join(rootDir, options.headersFile);
    const rawHeaders = await fs.readFile(headersPath, "utf8");
    headers = parseWebhookHeadersContent(rawHeaders);
  }

  const envelope = buildGithubWebhookEnvelope({
    generatedAt,
    headers,
    payloadText,
    payload,
    rawEvent: options.githubEvent ?? headers["x-github-event"] ?? null,
    deliveryId: options.deliveryId,
    githubAction: options.githubAction,
    signature: options.signature,
    webhookSecret: options.webhookSecret,
    env: process.env
  });
  const preview = buildGithubAppEventPreview(config, {
    generatedAt,
    eventKey: envelope.patternpilotEventKey,
    deliveryId: envelope.deliveryId,
    githubAction: envelope.githubAction,
    payload
  });
  const summary = renderGithubWebhookEnvelopeSummary({
    envelope,
    preview
  });
  const artifacts = await writeGithubWebhookPreviewArtifacts(rootDir, {
    runId,
    envelope,
    preview,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        envelopePath: path.relative(rootDir, artifacts.envelopePath),
        previewPath: path.relative(rootDir, artifacts.previewPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      envelope,
      preview
    }, null, 2));
    return {
      generatedAt,
      runId,
      envelope,
      preview,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_envelope: ${path.relative(rootDir, artifacts.envelopePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_preview: ${path.relative(rootDir, artifacts.previewPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_EVENT_MODEL.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-webhook-preview",
    projectKey: config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    generatedAt,
    runId,
    envelope,
    preview,
    artifacts
  };
}

export async function runGithubAppWebhookRoute(rootDir, config, options) {
  if (!options.file) {
    throw new Error("github-app-webhook-route requires --file <payload-json>.");
  }

  const generatedAt = new Date().toISOString();
  const runId = createRunId();
  const payloadPath = path.isAbsolute(options.file)
    ? options.file
    : path.join(rootDir, options.file);
  const payloadText = await fs.readFile(payloadPath, "utf8");
  const payload = JSON.parse(payloadText);

  let headers = {};
  if (options.headersFile) {
    const headersPath = path.isAbsolute(options.headersFile)
      ? options.headersFile
      : path.join(rootDir, options.headersFile);
    const rawHeaders = await fs.readFile(headersPath, "utf8");
    headers = parseWebhookHeadersContent(rawHeaders);
  }

  const envelope = buildGithubWebhookEnvelope({
    generatedAt,
    headers,
    payloadText,
    payload,
    rawEvent: options.githubEvent ?? headers["x-github-event"] ?? null,
    deliveryId: options.deliveryId,
    githubAction: options.githubAction,
    signature: options.signature,
    webhookSecret: options.webhookSecret,
    env: process.env
  });
  const routePlan = buildGithubWebhookRoutePlan(config, envelope, {
    project: options.project
  });
  const summary = renderGithubWebhookRoutePlanSummary({
    routePlan,
    envelope
  });
  const artifacts = await writeGithubWebhookRouteArtifacts(rootDir, {
    runId,
    routePlan,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        routePath: path.relative(rootDir, artifacts.routePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      envelope,
      routePlan
    }, null, 2));
    return {
      generatedAt,
      runId,
      envelope,
      routePlan,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_route: ${path.relative(rootDir, artifacts.routePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_EVENT_MODEL.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-webhook-route",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    generatedAt,
    runId,
    envelope,
    routePlan,
    artifacts
  };
}

async function loadGithubWebhookEventInput(rootDir, options) {
  if (!options.file) {
    throw new Error("This command requires --file <payload-json>.");
  }

  const generatedAt = new Date().toISOString();
  const payloadPath = path.isAbsolute(options.file)
    ? options.file
    : path.join(rootDir, options.file);
  const payloadText = await fs.readFile(payloadPath, "utf8");
  const payload = JSON.parse(payloadText);

  let headers = {};
  if (options.headersFile) {
    const headersPath = path.isAbsolute(options.headersFile)
      ? options.headersFile
      : path.join(rootDir, options.headersFile);
    const rawHeaders = await fs.readFile(headersPath, "utf8");
    headers = parseWebhookHeadersContent(rawHeaders);
  }

  const envelope = buildGithubWebhookEnvelope({
    generatedAt,
    headers,
    payloadText,
    payload,
    rawEvent: options.githubEvent ?? headers["x-github-event"] ?? null,
    deliveryId: options.deliveryId,
    githubAction: options.githubAction,
    signature: options.signature,
    webhookSecret: options.webhookSecret,
    env: process.env
  });

  return {
    generatedAt,
    payload,
    payloadText,
    headers,
    envelope
  };
}

export async function runGithubAppInstallationReview(rootDir, config, options) {
  const runId = createRunId();
  const { envelope } = await loadGithubWebhookEventInput(rootDir, options);
  const packet = buildGithubAppInstallationPacket(config, envelope, {
    generatedAt: envelope.generatedAt,
    project: options.project
  });
  const state = await loadGithubAppInstallationState(rootDir);
  const summary = renderGithubAppInstallationPacketSummary(packet, {
    apply: false
  });
  const artifacts = await writeGithubAppInstallationArtifacts(rootDir, {
    runId,
    packet,
    state,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        packetPath: path.relative(rootDir, artifacts.packetPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      envelope,
      packet,
      state
    }, null, 2));
    return { runId, envelope, packet, state, artifacts };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_packet: ${path.relative(rootDir, artifacts.packetPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, envelope, packet, state, artifacts };
}

export async function runGithubAppInstallationApply(rootDir, config, options) {
  const runId = createRunId();
  const { envelope } = await loadGithubWebhookEventInput(rootDir, options);
  const packet = buildGithubAppInstallationPacket(config, envelope, {
    generatedAt: envelope.generatedAt,
    project: options.project
  });
  const currentState = await loadGithubAppInstallationState(rootDir);
  const nextState = applyGithubAppInstallationPacketToState(currentState, packet, {
    updatedAt: envelope.generatedAt
  });
  const statePath = await writeGithubAppInstallationState(rootDir, nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationPacketSummary(packet, {
    apply: true
  });
  const artifacts = await writeGithubAppInstallationArtifacts(rootDir, {
    runId,
    packet,
    state: nextState,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      statePath: path.relative(rootDir, statePath),
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        packetPath: path.relative(rootDir, artifacts.packetPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      envelope,
      packet,
      state: nextState
    }, null, 2));
    return { runId, envelope, packet, state: nextState, artifacts, statePath };
  }

  console.log(summary);
  console.log(`- installation_state: ${path.relative(rootDir, statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_packet: ${path.relative(rootDir, artifacts.packetPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-apply",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, envelope, packet, state: nextState, artifacts, statePath };
}

export async function runGithubAppInstallationGovernanceReview(rootDir, config, options) {
  const runId = createRunId();
  const state = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubAppInstallationGovernancePlan(state, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const summary = renderGithubAppInstallationGovernanceSummary(plan);
  const artifacts = await writeGithubAppInstallationRuntimeArtifacts(rootDir, {
    runId,
    plan,
    receipts: [],
    state,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      state
    }, null, 2));
    return { runId, plan, state, artifacts };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-governance-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, state, artifacts };
}

export async function runGithubAppInstallationGovernanceApply(rootDir, config, options) {
  const runId = createRunId();
  const currentState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubAppInstallationGovernancePlan(currentState, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const governance = applyGithubAppInstallationGovernanceToState(currentState, plan, {
    notes: options.notes,
    at: new Date().toISOString()
  });
  const statePath = await writeGithubAppInstallationState(rootDir, governance.nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationGovernanceSummary(plan, governance.receipts);
  const artifacts = await writeGithubAppInstallationRuntimeArtifacts(rootDir, {
    runId,
    plan,
    receipts: governance.receipts,
    state: governance.nextState,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      statePath: path.relative(rootDir, statePath),
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts: governance.receipts,
      state: governance.nextState
    }, null, 2));
    return { runId, plan, receipts: governance.receipts, state: governance.nextState, artifacts, statePath };
  }

  console.log(summary);
  console.log(`- installation_state: ${path.relative(rootDir, statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-governance-apply",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, receipts: governance.receipts, state: governance.nextState, artifacts, statePath };
}

export async function runGithubAppInstallationRuntimeReview(rootDir, config, options) {
  const runId = createRunId();
  const state = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubAppInstallationRuntimePlan(state, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const summary = renderGithubAppInstallationRuntimeSummary(plan);
  const artifacts = await writeGithubAppInstallationRuntimeArtifacts(rootDir, {
    runId,
    plan,
    receipts: [],
    state,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      state
    }, null, 2));
    return { runId, plan, state, artifacts };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-runtime-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, state, artifacts };
}

export async function runGithubAppInstallationRuntimeApply(rootDir, config, options) {
  const runId = createRunId();
  const currentState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubAppInstallationRuntimePlan(currentState, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const runtime = applyGithubAppInstallationRuntimeToState(currentState, plan, {
    notes: options.notes,
    at: new Date().toISOString()
  });
  const statePath = await writeGithubAppInstallationState(rootDir, runtime.nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationRuntimeSummary(plan, runtime.receipts);
  const artifacts = await writeGithubAppInstallationRuntimeArtifacts(rootDir, {
    runId,
    plan,
    receipts: runtime.receipts,
    state: runtime.nextState,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      statePath: path.relative(rootDir, statePath),
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts: runtime.receipts,
      state: runtime.nextState
    }, null, 2));
    return { runId, plan, receipts: runtime.receipts, state: runtime.nextState, artifacts, statePath };
  }

  console.log(summary);
  console.log(`- installation_state: ${path.relative(rootDir, statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-runtime-apply",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, receipts: runtime.receipts, state: runtime.nextState, artifacts, statePath };
}

export async function runGithubAppInstallationOperationsReview(rootDir, config, options) {
  const runId = createRunId();
  const state = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubAppInstallationOperationsPlan(state, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const summary = renderGithubAppInstallationOperationsSummary(plan);
  const artifacts = await writeGithubAppInstallationOperationsArtifacts(rootDir, {
    runId,
    plan,
    receipts: [],
    state,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      state
    }, null, 2));
    return { runId, plan, state, artifacts };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-operations-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, state, artifacts };
}

export async function runGithubAppInstallationOperationsApply(rootDir, config, options) {
  const runId = createRunId();
  const currentState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubAppInstallationOperationsPlan(currentState, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const operations = applyGithubAppInstallationOperationsToState(currentState, plan, {
    notes: options.notes,
    at: new Date().toISOString()
  });
  const statePath = await writeGithubAppInstallationState(rootDir, operations.nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationOperationsSummary(plan, operations.receipts);
  const artifacts = await writeGithubAppInstallationOperationsArtifacts(rootDir, {
    runId,
    plan,
    receipts: operations.receipts,
    state: operations.nextState,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      statePath: path.relative(rootDir, statePath),
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts: operations.receipts,
      state: operations.nextState
    }, null, 2));
    return { runId, plan, receipts: operations.receipts, state: operations.nextState, artifacts, statePath };
  }

  console.log(summary);
  console.log(`- installation_state: ${path.relative(rootDir, statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-operations-apply",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, receipts: operations.receipts, state: operations.nextState, artifacts, statePath };
}

export async function runGithubAppInstallationShow(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const state = await loadGithubAppInstallationState(rootDir);
  const summary = buildGithubAppInstallationStateSummary(state, {
    generatedAt
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      state
    }, null, 2));
    return { generatedAt, state };
  }

  console.log(summary);
  console.log(`- installation_state: state/github-app-installations.json`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-show",
    projectKey: options.project || config.defaultProject,
    mode: "manual",
    reportPath: "state/github-app-installations.json"
  });

  return { generatedAt, state };
}

export async function runGithubAppInstallationScope(rootDir, config, options) {
  const runId = createRunId();
  const state = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubAppInstallationScopePlan(config, state, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project,
    limit: options.limit
  });
  const summary = renderGithubAppInstallationScopeSummary(plan);
  const artifacts = await writeGithubAppInstallationScopeArtifacts(rootDir, {
    runId,
    plan,
    receipts: [],
    state,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      state
    }, null, 2));
    return { runId, plan, state, artifacts };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-scope",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, state, artifacts };
}

export async function runGithubAppInstallationHandoff(rootDir, config, options) {
  const runId = createRunId();
  const currentState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubAppInstallationScopePlan(config, currentState, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project,
    limit: options.limit
  });
  const handoff = await applyGithubAppInstallationScopeHandoff(rootDir, config, currentState, plan, {
    appendUrlsToWatchlist,
    dryRun: options.dryRun,
    notes: options.notes,
    at: new Date().toISOString()
  });
  const statePath = await writeGithubAppInstallationState(rootDir, handoff.nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationScopeSummary(plan, handoff.receipts);
  const artifacts = await writeGithubAppInstallationScopeArtifacts(rootDir, {
    runId,
    plan,
    receipts: handoff.receipts,
    state: handoff.nextState,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      statePath: path.relative(rootDir, statePath),
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        statePath: path.relative(rootDir, artifacts.statePath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts: handoff.receipts,
      state: handoff.nextState
    }, null, 2));
    return { runId, plan, receipts: handoff.receipts, state: handoff.nextState, artifacts, statePath };
  }

  console.log(summary);
  console.log(`- installation_state: ${path.relative(rootDir, statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_state: ${path.relative(rootDir, artifacts.statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-installation-handoff",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, receipts: handoff.receipts, state: handoff.nextState, artifacts, statePath };
}

export async function runGithubAppWebhookDispatch(rootDir, config, options) {
  if (!options.file) {
    throw new Error("github-app-webhook-dispatch requires --file <payload-json>.");
  }

  const generatedAt = new Date().toISOString();
  const runId = createRunId();
  const payloadPath = path.isAbsolute(options.file)
    ? options.file
    : path.join(rootDir, options.file);
  const payloadText = await fs.readFile(payloadPath, "utf8");
  const payload = JSON.parse(payloadText);

  let headers = {};
  if (options.headersFile) {
    const headersPath = path.isAbsolute(options.headersFile)
      ? options.headersFile
      : path.join(rootDir, options.headersFile);
    const rawHeaders = await fs.readFile(headersPath, "utf8");
    headers = parseWebhookHeadersContent(rawHeaders);
  }

  const envelope = buildGithubWebhookEnvelope({
    generatedAt,
    headers,
    payloadText,
    payload,
    rawEvent: options.githubEvent ?? headers["x-github-event"] ?? null,
    deliveryId: options.deliveryId,
    githubAction: options.githubAction,
    signature: options.signature,
    webhookSecret: options.webhookSecret,
    env: process.env
  });
  const routePlan = buildGithubWebhookRoutePlan(config, envelope, {
    project: options.project
  });
  const dispatchPlan = buildGithubWebhookDispatchPlan(routePlan, {
    apply: options.apply,
    force: options.force
  });
  const executionResults = dispatchPlan.apply && !options.dryRun && dispatchPlan.dispatchStatus === "ready_to_execute"
    && !options.contractOnly
    ? await executeGithubWebhookDispatchPlan(dispatchPlan, {
        runShellCommand,
        cwd: rootDir,
        env: process.env,
        stdio: "inherit"
      })
    : [];
  const executionSummary = summarizeGithubWebhookExecution(dispatchPlan, executionResults, {
    dryRun: options.dryRun,
    contractOnly: options.contractOnly
  });
  const executionContract = buildGithubWebhookExecutionContract({
    envelope,
    routePlan,
    dispatchPlan,
    executionSummary
  }, {
    dryRun: options.dryRun,
    contractOnly: options.contractOnly,
    cwd: "."
  });
  const summary = renderGithubWebhookDispatchSummary({
    envelope,
    routePlan,
    dispatchPlan,
    executionResults,
    executionSummary,
    executionContract
  });
  const artifacts = await writeGithubWebhookDispatchArtifacts(rootDir, {
    runId,
    envelope,
    routePlan,
    dispatchPlan,
    executionContract,
    executionResults,
    executionSummary,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        envelopePath: path.relative(rootDir, artifacts.envelopePath),
        routePath: path.relative(rootDir, artifacts.routePath),
        dispatchPath: path.relative(rootDir, artifacts.dispatchPath),
        executionContractPath: path.relative(rootDir, artifacts.executionContractPath),
        executionPath: path.relative(rootDir, artifacts.executionPath),
        executionSummaryPath: path.relative(rootDir, artifacts.executionSummaryPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      envelope,
      routePlan,
      dispatchPlan,
      executionContract,
      executionResults,
      executionSummary
    }, null, 2));
    return {
      generatedAt,
      runId,
      envelope,
      routePlan,
      dispatchPlan,
      executionContract,
      executionResults,
      executionSummary,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_envelope: ${path.relative(rootDir, artifacts.envelopePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_route: ${path.relative(rootDir, artifacts.routePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_dispatch: ${path.relative(rootDir, artifacts.dispatchPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution_contract: ${path.relative(rootDir, artifacts.executionContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution: ${path.relative(rootDir, artifacts.executionPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution_summary: ${path.relative(rootDir, artifacts.executionSummaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_EVENT_MODEL.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-webhook-dispatch",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  if (executionSummary.finalStatus === "execution_failed") {
    const error = new Error(`Webhook dispatch execution failed at command '${executionSummary.firstFailure.commandName}'.`);
    error.exitCode = 1;
    throw error;
  }

  return {
    generatedAt,
    runId,
    envelope,
    routePlan,
    dispatchPlan,
    executionContract,
    executionResults,
    executionSummary,
    artifacts
  };
}

export async function runGithubAppExecutionRun(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-execution-run requires --contract-file <execution-contract-json>.");
  }

  const runId = createRunId();
  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const executionContract = options.loadedContract ?? await loadGithubWebhookExecutionContract(contractPath);
  const runnerPlan = buildGithubWebhookRunnerPlan(executionContract, {
    apply: options.apply,
    dryRun: options.dryRun,
    force: options.force,
    generatedAt: new Date().toISOString()
  });
  const executionResults = runnerPlan.apply && !options.dryRun && runnerPlan.runnerStatus === "ready_to_execute"
    ? await executeGithubWebhookRunnerPlan(runnerPlan, {
        runShellCommand,
        cwd: rootDir,
        env: process.env,
        stdio: "inherit"
      })
    : [];
  const executionSummary = summarizeGithubWebhookRunnerExecution(runnerPlan, executionResults, {
    dryRun: options.dryRun
  });
  const runnerState = buildGithubWebhookRunnerState({
    executionContract,
    runnerPlan,
    executionResults,
    executionSummary
  });
  const recoveryAssessment = buildGithubWebhookRecoveryAssessment({
    executionContract,
    runnerPlan,
    runnerState,
    executionSummary
  });
  const resumeContract = buildGithubWebhookResumeContract({
    executionContract,
    runnerPlan,
    runnerState
  });
  const recoveryContract = buildGithubWebhookRecoveryContract({
    executionContract,
    runnerPlan,
    runnerState,
    recoveryAssessment
  });
  const summary = renderGithubWebhookRunnerSummary({
    executionContract,
    runnerPlan,
    executionResults,
    executionSummary,
    runnerState,
    resumeContract,
    recoveryAssessment,
    recoveryContract
  });
  const artifacts = await writeGithubWebhookRunnerArtifacts(rootDir, {
    runId,
    executionContract,
    runnerPlan,
    executionResults,
    executionSummary,
    runnerState,
    resumeContract,
    recoveryAssessment,
    recoveryContract,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        contractPath: path.relative(rootDir, artifacts.contractPath),
        runnerPlanPath: path.relative(rootDir, artifacts.runnerPlanPath),
        executionPath: path.relative(rootDir, artifacts.executionPath),
        executionSummaryPath: path.relative(rootDir, artifacts.executionSummaryPath),
        runnerStatePath: path.relative(rootDir, artifacts.runnerStatePath),
        resumeContractPath: path.relative(rootDir, artifacts.resumeContractPath),
        recoveryAssessmentPath: path.relative(rootDir, artifacts.recoveryAssessmentPath),
        recoveryContractPath: path.relative(rootDir, artifacts.recoveryContractPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      executionContract,
      runnerPlan,
      executionResults,
      executionSummary,
      runnerState,
      resumeContract,
      recoveryAssessment,
      recoveryContract
    }, null, 2));
    return {
      runId,
      executionContract,
      runnerPlan,
      executionResults,
      executionSummary,
      runnerState,
      resumeContract,
      recoveryAssessment,
      recoveryContract,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- contract_file: ${path.relative(rootDir, contractPath)}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_contract: ${path.relative(rootDir, artifacts.contractPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_runner_plan: ${path.relative(rootDir, artifacts.runnerPlanPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution: ${path.relative(rootDir, artifacts.executionPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_execution_summary: ${path.relative(rootDir, artifacts.executionSummaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_runner_state: ${path.relative(rootDir, artifacts.runnerStatePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_resume_contract: ${path.relative(rootDir, artifacts.resumeContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_recovery_assessment: ${path.relative(rootDir, artifacts.recoveryAssessmentPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_recovery_contract: ${path.relative(rootDir, artifacts.recoveryContractPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_EVENT_MODEL.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-execution-run",
    projectKey: executionContract.selectedProjectKey || config.defaultProject,
    mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  if (executionSummary.finalStatus === "execution_failed" && !options.allowFailureReturn) {
    const error = new Error(`GitHub execution runner failed at command '${executionSummary.firstFailure.commandName}'.`);
    error.exitCode = 1;
    throw error;
  }

  return {
    runId,
    executionContract,
    runnerPlan,
    executionResults,
    executionSummary,
    runnerState,
    resumeContract,
    recoveryAssessment,
    recoveryContract,
    artifacts
  };
}

export async function runGithubAppExecutionResume(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-execution-resume requires --contract-file <resume-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const executionContract = await loadGithubWebhookExecutionContract(contractPath);

  if (executionContract.contractStatus === "resume_not_required") {
    console.log(`# Patternpilot GitHub Webhook Resume`);
    console.log(``);
    console.log(`- contract_file: ${path.relative(rootDir, contractPath)}`);
    console.log(`- contract_status: resume_not_required`);
    console.log(`- next_action: ${executionContract.nextAction ?? "No resumable work remains."}`);
    return {
      executionContract,
      resumeRequired: false
    };
  }

  if (executionContract.contractStatus !== "dispatch_ready_resume_contract") {
    throw new Error(`github-app-execution-resume expects a resume contract, got '${executionContract.contractStatus ?? "unknown"}'.`);
  }

  return await runGithubAppExecutionRun(rootDir, config, options);
}

export async function runGithubAppExecutionRecover(rootDir, config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-execution-recover requires --contract-file <recovery-contract-json>.");
  }

  const contractPath = path.isAbsolute(options.contractFile)
    ? options.contractFile
    : path.join(rootDir, options.contractFile);
  const executionContract = await loadGithubWebhookExecutionContract(contractPath);

  if (executionContract.contractKind !== "recovery_contract") {
    throw new Error(`github-app-execution-recover expects a recovery contract, got '${executionContract.contractKind ?? "unknown"}'.`);
  }

  const recoveryEvaluation = evaluateGithubWebhookRecoveryContract(executionContract);
  const evaluatedContract = {
    ...executionContract,
    contractStatus: recoveryEvaluation.effectiveStatus,
    nextAction: recoveryEvaluation.nextAction,
    recoveryAssessment: {
      ...(executionContract.recoveryAssessment ?? {}),
      evaluatedAt: new Date().toISOString(),
      effectiveStatus: recoveryEvaluation.effectiveStatus,
      blockedUntil: recoveryEvaluation.blockedUntil
    }
  };

  if (recoveryEvaluation.effectiveStatus !== "dispatch_ready_recovery_contract") {
    console.log(`# Patternpilot GitHub Webhook Recover`);
    console.log(``);
    console.log(`- contract_file: ${path.relative(rootDir, contractPath)}`);
    console.log(`- contract_status: ${recoveryEvaluation.effectiveStatus}`);
    console.log(`- blocked_until: ${recoveryEvaluation.blockedUntil ?? "-"}`);
    console.log(`- next_action: ${recoveryEvaluation.nextAction}`);
    return {
      executionContract: evaluatedContract,
      recoveryReady: false
    };
  }

  return await runGithubAppExecutionRun(rootDir, config, {
    ...options,
    loadedContract: evaluatedContract
  });
}

export async function runGithubAppExecutionEnqueue(rootDir, _config, options) {
  if (!options.contractFile) {
    throw new Error("github-app-execution-enqueue requires --contract-file <contract-json>.");
  }

  const result = await enqueueGithubWebhookServiceContractFromFile(rootDir, options.contractFile, {
    dryRun: options.dryRun,
    maxServiceAttempts: options.maxServiceAttempts
  });

  console.log(`# Patternpilot GitHub App Queue Enqueue`);
  console.log(``);
  console.log(`- source_contract: ${path.relative(rootDir, result.sourcePath)}`);
  console.log(`- contract_kind: ${result.contract.contractKind ?? "-"}`);
  console.log(`- contract_status: ${result.contract.contractStatus ?? "-"}`);
  console.log(`- target_state: ${result.queued.targetState}`);
  console.log(`- duplicate: ${result.queued.duplicate ? "yes" : "no"}`);
  console.log(`- queued_path: ${path.relative(rootDir, result.queued.targetPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  return result;
}

export async function runGithubAppServiceReview(rootDir, config, options) {
  const runId = createRunId();
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const installationState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubWebhookServiceReviewPlan(queueState.queue, {
    fromStatus: options.fromStatus,
    project: options.project,
    file: options.file,
    limit: options.limit,
    generatedAt: new Date().toISOString(),
    workerId: options.workerId,
    installationState
  });
  const summary = renderGithubWebhookServiceReviewSummary(plan);
  const artifacts = await writeGithubWebhookServiceAdminArtifacts(rootDir, {
    runId,
    artifactPrefix: "service-review",
    plan,
    receipts: [],
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan
    }, null, 2));
    return {
      runId,
      plan,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-service-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    runId,
    plan,
    artifacts
  };
}

export async function runGithubAppServiceRequeue(rootDir, config, options) {
  const runId = createRunId();
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const installationState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubWebhookServiceRequeuePlan(queueState.queue, {
    fromStatus: options.fromStatus,
    project: options.project,
    file: options.file,
    limit: options.limit,
    generatedAt: new Date().toISOString(),
    workerId: options.workerId,
    installationState
  });
  const receipts = options.apply
    ? await requeueGithubWebhookServiceQueueEntries(rootDir, queueState.queue.filter((item) => {
        return plan.releaseableEntries.some((selected) => selected.fileName === item.fileName);
      }), {
        dryRun: options.dryRun,
        force: options.force,
        notes: options.notes,
        workerId: options.workerId,
        maxServiceAttempts: options.maxServiceAttempts,
        installationState
      })
    : [];
  const summary = renderGithubWebhookServiceRequeueSummary(plan, receipts);
  const artifacts = await writeGithubWebhookServiceAdminArtifacts(rootDir, {
    runId,
    artifactPrefix: "service-requeue",
    plan,
    receipts,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts
    }, null, 2));
    return {
      runId,
      plan,
      receipts,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-service-requeue",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    runId,
    plan,
    receipts,
    artifacts
  };
}

export async function runGithubAppServiceTick(rootDir, config, options) {
  const runId = createRunId();
  const reclaimedClaims = await reclaimExpiredGithubWebhookServiceClaims(rootDir, {
    dryRun: options.dryRun,
    now: new Date().toISOString()
  });
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const installationState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubWebhookServiceTickPlan(queueState.queue, {
    limit: options.limit,
    generatedAt: new Date().toISOString(),
    workerId: options.workerId,
    installationState
  });
  const receipts = [];

  if (options.apply && !options.dryRun) {
    const claimResult = await claimGithubWebhookServiceQueueEntries(rootDir, queueState.queue.filter((item) => {
      return plan.selectedEntries.some((selected) => selected.fileName === item.fileName);
    }), {
      workerId: options.workerId,
      leaseMinutes: options.serviceLeaseMinutes,
      maxServiceAttempts: options.maxServiceAttempts
    });
    const claimedEntries = claimResult.claimed;

    if (claimResult.deadLettered.length > 0) {
      receipts.push(...claimResult.deadLettered.map((entry) => ({
        fileName: entry.fileName,
        action: "claim_contract",
        outcome: "dead_lettered_before_execution",
        workerId: options.workerId,
        targetState: "dead_letter",
        spawnedContracts: []
      })));
    }

    for (const entry of claimedEntries) {
      const selected = plan.selectedEntries.find((item) => item.fileName === entry.fileName);
      if (!entry) {
        continue;
      }

      let executionResult = null;
      let outcome = "processed";
      const spawnedContracts = [];

      try {
        if (selected.action === "run_execution") {
          executionResult = await runGithubAppExecutionRun(rootDir, config, {
            contractFile: entry.contractPath,
            apply: true,
            dryRun: false,
            allowFailureReturn: true
          });
        } else if (selected.action === "run_resume") {
          executionResult = await runGithubAppExecutionResume(rootDir, config, {
            contractFile: entry.contractPath,
            apply: true,
            dryRun: false,
            allowFailureReturn: true
          });
        } else if (selected.action === "run_recover") {
          executionResult = await runGithubAppExecutionRecover(rootDir, config, {
            contractFile: entry.contractPath,
            apply: true,
            dryRun: false,
            allowFailureReturn: true
          });
        }

        const recoveryContract = executionResult?.recoveryContract ?? null;
        const resumeContract = executionResult?.resumeContract ?? null;

        if (recoveryContract && recoveryContract.contractStatus !== "recovery_not_required") {
          const targetState = recoveryContract.contractStatus === "dispatch_ready_recovery_contract"
            ? "pending"
            : "blocked";
          const queued = await queueGithubWebhookServiceContract(rootDir, recoveryContract, {
            targetState,
            maxServiceAttempts: options.maxServiceAttempts
          });
          spawnedContracts.push({
            contractKind: recoveryContract.contractKind,
            contractStatus: recoveryContract.contractStatus,
            targetState: queued.duplicate ? "duplicate" : targetState,
            targetPath: path.relative(rootDir, queued.targetPath),
            duplicate: Boolean(queued.duplicate)
          });
        } else if (resumeContract && resumeContract.contractStatus === "dispatch_ready_resume_contract") {
          const queued = await queueGithubWebhookServiceContract(rootDir, resumeContract, {
            targetState: "pending",
            maxServiceAttempts: options.maxServiceAttempts
          });
          spawnedContracts.push({
            contractKind: resumeContract.contractKind,
            contractStatus: resumeContract.contractStatus,
            targetState: queued.duplicate ? "duplicate" : "pending",
            targetPath: path.relative(rootDir, queued.targetPath),
            duplicate: Boolean(queued.duplicate)
          });
        }
      } catch (error) {
        outcome = "execution_error";
        receipts.push({
          fileName: selected.fileName,
          action: selected.action,
          outcome,
          workerId: options.workerId,
          targetState: "blocked",
          error: error.message,
          spawnedContracts
        });
        const blockedPath = path.join(queueState.paths.blockedPath, entry.fileName);
        await fs.mkdir(queueState.paths.blockedPath, { recursive: true });
        const blockedContract = {
          ...entry.contract,
          serviceLease: null,
          serviceState: {
            ...(entry.contract.serviceState ?? {}),
            lastQueuedState: "blocked",
            lastOutcome: "execution_error"
          }
        };
        await fs.writeFile(blockedPath, `${JSON.stringify(blockedContract, null, 2)}\n`, "utf8");
        await fs.unlink(entry.contractPath);
        continue;
      }

      const processedPath = path.join(queueState.paths.processedPath, entry.fileName);
      await fs.mkdir(queueState.paths.processedPath, { recursive: true });
      const processedContract = {
        ...entry.contract,
        serviceLease: null,
        serviceState: {
          ...(entry.contract.serviceState ?? {}),
          lastQueuedState: "processed",
          lastOutcome: executionResult?.executionSummary?.finalStatus ?? "processed"
        }
      };
      await fs.writeFile(processedPath, `${JSON.stringify(processedContract, null, 2)}\n`, "utf8");
      await fs.unlink(entry.contractPath);
      receipts.push({
        fileName: selected.fileName,
        action: selected.action,
        outcome,
        workerId: options.workerId,
        targetState: "processed",
        resultStatus: executionResult?.executionSummary?.finalStatus ?? "-",
        spawnedContracts
      });
    }
  }

  if (reclaimedClaims.length > 0) {
    receipts.unshift(...reclaimedClaims.map((item) => ({
      fileName: item.fileName,
      action: "reclaim_expired_claim",
      outcome: "reclaimed",
      workerId: options.workerId,
      targetState: "pending",
      spawnedContracts: []
    })));
  }

  const summary = renderGithubWebhookServiceTickSummary(plan, receipts);
  const artifacts = await writeGithubWebhookServiceArtifacts(rootDir, {
    runId,
    plan,
    receipts,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts
    }, null, 2));
    return {
      runId,
      plan,
      receipts,
      artifacts
    };
  }

  console.log(summary);
  console.log(`- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`);

  await refreshContext(rootDir, config, {
    command: "github-app-service-tick",
    projectKey: config.defaultProject,
    mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    runId,
    plan,
    receipts,
    artifacts
  };
}

export async function runInitEnv(rootDir, options) {
  const results = await initializeEnvFiles(rootDir, options);
  console.log(`# Patternpilot Env Init`);
  console.log(``);
  if (results.length === 0) {
    console.log(`- no env templates found`);
    return;
  }
  for (const result of results) {
    console.log(`- ${result.path}: ${result.status}`);
  }
}

export function runSetupChecklist(options) {
  const checklist = buildSetupChecklist();
  const githubApp = inspectGithubAppAuth();

  if (options.json) {
    console.log(JSON.stringify({ checklist, githubApp }, null, 2));
    return;
  }

  console.log(`# Patternpilot Setup Checklist`);
  console.log(``);
  console.log(`## PAT`);
  console.log(`- env_var: ${checklist.pat.envVar}`);
  console.log(`- put_it_here: ${checklist.pat.filePath}`);
  console.log(`- where_to_find_it: ${checklist.pat.whereToFind}`);
  console.log(`- docs: ${checklist.pat.docsUrl}`);
  console.log(`- note: ${checklist.pat.note}`);
  console.log(``);
  console.log(`## GitHub App`);
  for (const item of checklist.githubApp) {
    const status = githubApp.presentVars.includes(item.key) ? "present" : "missing";
    console.log(`- ${item.key}: ${status}`);
    console.log(`  file: ${item.filePath}`);
    console.log(`  where: ${item.whereToFind}`);
    console.log(`  docs: ${item.docsUrl}`);
  }
}

export async function runInitProject(rootDir, config, options) {
  const result = await initializeProjectBinding(rootDir, config, options);
  console.log(`# Patternpilot Project Initialized`);
  console.log(``);
  console.log(`- project: ${result.projectKey}`);
  console.log(`- label: ${result.projectLabel}`);
  console.log(`- target_path: ${result.targetPath}`);
  console.log(`- project_root: ${result.projectRoot}`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(``);
  console.log(`## Generated Files`);
  for (const output of result.outputs) {
    console.log(`- ${output}`);
  }
  console.log(``);
  console.log(`## Detected Context`);
  for (const item of result.readBeforeAnalysis) {
    console.log(`- read_first: ${item}`);
  }
  for (const item of result.referenceDirectories) {
    console.log(`- ref_dir: ${item}/`);
  }
  await refreshContext(rootDir, config, {
    command: "init-project",
    projectKey: result.projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: `projects/${result.projectKey}`
  });
}

export async function runDiscoverWorkspace(rootDir, config, options) {
  const repos = await discoverWorkspaceProjects(rootDir, config, {
    workspaceRoot: options.workspaceRoot,
    maxDepth: options.maxDepth
  });
  console.log(`# Patternpilot Workspace Discovery`);
  console.log(``);
  console.log(`- workspace_root: ${options.workspaceRoot ? path.resolve(rootDir, options.workspaceRoot) : (config.workspaceRoots ?? [".."]).join(", ")}`);
  console.log(`- max_depth: ${options.maxDepth}`);
  console.log(`- discovered: ${repos.length}`);
  console.log(``);
  console.log(`## Repositories`);
  for (const repo of repos) {
    console.log(
      `- ${repo.relativePath} :: ${repo.boundProjectKey ? `bound=${repo.boundProjectKey}` : `candidate=${repo.suggestedProjectKey}`} :: read_files=${repo.readBeforeAnalysisCount} :: ref_dirs=${repo.referenceDirectoryCount}`
    );
  }
}
