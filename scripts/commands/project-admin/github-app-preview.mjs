import {
  buildGithubAppEventPreview,
  buildGithubAppIntegrationPlan,
  buildGithubAppReadiness,
  buildGithubWebhookRoutePlan,
  createRunId,
  renderGithubAppEventPreviewSummary,
  renderGithubAppIntegrationPlanSummary,
  renderGithubAppReadinessSummary,
  renderGithubWebhookEnvelopeSummary,
  renderGithubWebhookRoutePlanSummary,
  writeGithubAppEventPreviewArtifacts,
  writeGithubAppIntegrationPlanArtifacts,
  writeGithubWebhookPreviewArtifacts,
  writeGithubWebhookRouteArtifacts
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext,
  loadGithubWebhookEventInput
} from "./shared.mjs";

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

  const runId = createRunId();
  const { generatedAt, payload, envelope } = await loadGithubWebhookEventInput(rootDir, options);
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

  const runId = createRunId();
  const { generatedAt, envelope } = await loadGithubWebhookEventInput(rootDir, options);
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
