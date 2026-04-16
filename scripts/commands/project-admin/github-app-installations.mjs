import {
  appendUrlsToWatchlist,
  applyGithubAppInstallationGovernanceToState,
  applyGithubAppInstallationOperationsToState,
  applyGithubAppInstallationRuntimeToState,
  applyGithubAppInstallationServiceLaneToState,
  applyGithubAppInstallationServicePlanToState,
  applyGithubAppInstallationWorkerRoutingToState,
  applyGithubAppInstallationScopeHandoff,
  applyGithubAppInstallationPacketToState,
  buildGithubAppInstallationGovernancePlan,
  buildGithubAppInstallationOperationsPlan,
  buildGithubAppInstallationPacket,
  buildGithubAppInstallationRuntimePlan,
  buildGithubAppInstallationScopePlan,
  buildGithubAppInstallationServiceLanePlan,
  buildGithubAppInstallationServicePlan,
  buildGithubAppInstallationStateSummary,
  buildGithubAppInstallationWorkerRoutingPlan,
  createRunId,
  loadGithubAppInstallationState,
  loadGithubWebhookServiceQueue,
  renderGithubAppInstallationGovernanceSummary,
  renderGithubAppInstallationOperationsSummary,
  renderGithubAppInstallationPacketSummary,
  renderGithubAppInstallationRuntimeSummary,
  renderGithubAppInstallationScopeSummary,
  renderGithubAppInstallationServiceLaneSummary,
  renderGithubAppInstallationServicePlanSummary,
  renderGithubAppInstallationWorkerRoutingSummary,
  writeGithubAppInstallationArtifacts,
  writeGithubAppInstallationOperationsArtifacts,
  writeGithubAppInstallationRuntimeArtifacts,
  writeGithubAppInstallationScopeArtifacts,
  writeGithubAppInstallationServiceLaneArtifacts,
  writeGithubAppInstallationServicePlanArtifacts,
  writeGithubAppInstallationState,
  writeGithubAppInstallationWorkerRoutingArtifacts
} from "../../../lib/index.mjs";
import {
  path,
  refreshContext,
  loadGithubWebhookEventInput
} from "./shared.mjs";

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

export async function runGithubAppInstallationServiceLaneReview(rootDir, config, options) {
  const runId = createRunId();
  const state = await loadGithubAppInstallationState(rootDir);
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const plan = buildGithubAppInstallationServiceLanePlan(state, queueState.queue, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const summary = renderGithubAppInstallationServiceLaneSummary(plan);
  const artifacts = await writeGithubAppInstallationServiceLaneArtifacts(rootDir, {
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
    command: "github-app-installation-service-lane-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, state, artifacts };
}

export async function runGithubAppInstallationServiceLaneApply(rootDir, config, options) {
  const runId = createRunId();
  const currentState = await loadGithubAppInstallationState(rootDir);
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const plan = buildGithubAppInstallationServiceLanePlan(currentState, queueState.queue, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const lanes = applyGithubAppInstallationServiceLaneToState(currentState, plan, {
    notes: options.notes,
    at: new Date().toISOString()
  });
  const statePath = await writeGithubAppInstallationState(rootDir, lanes.nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationServiceLaneSummary(plan, lanes.receipts);
  const artifacts = await writeGithubAppInstallationServiceLaneArtifacts(rootDir, {
    runId,
    plan,
    receipts: lanes.receipts,
    state: lanes.nextState,
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
      receipts: lanes.receipts,
      state: lanes.nextState
    }, null, 2));
    return { runId, plan, receipts: lanes.receipts, state: lanes.nextState, artifacts, statePath };
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
    command: "github-app-installation-service-lane-apply",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, receipts: lanes.receipts, state: lanes.nextState, artifacts, statePath };
}

export async function runGithubAppInstallationServicePlanReview(rootDir, config, options) {
  const runId = createRunId();
  const state = await loadGithubAppInstallationState(rootDir);
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const plan = buildGithubAppInstallationServicePlan(state, queueState.queue, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const summary = renderGithubAppInstallationServicePlanSummary(plan);
  const artifacts = await writeGithubAppInstallationServicePlanArtifacts(rootDir, {
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
    command: "github-app-installation-service-plan-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, state, artifacts };
}

export async function runGithubAppInstallationServicePlanApply(rootDir, config, options) {
  const runId = createRunId();
  const currentState = await loadGithubAppInstallationState(rootDir);
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const plan = buildGithubAppInstallationServicePlan(currentState, queueState.queue, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project
  });
  const servicePlan = applyGithubAppInstallationServicePlanToState(currentState, plan, {
    notes: options.notes,
    at: new Date().toISOString()
  });
  const statePath = await writeGithubAppInstallationState(rootDir, servicePlan.nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationServicePlanSummary(plan, servicePlan.receipts);
  const artifacts = await writeGithubAppInstallationServicePlanArtifacts(rootDir, {
    runId,
    plan,
    receipts: servicePlan.receipts,
    state: servicePlan.nextState,
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
      receipts: servicePlan.receipts,
      state: servicePlan.nextState
    }, null, 2));
    return { runId, plan, receipts: servicePlan.receipts, state: servicePlan.nextState, artifacts, statePath };
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
    command: "github-app-installation-service-plan-apply",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, receipts: servicePlan.receipts, state: servicePlan.nextState, artifacts, statePath };
}

export async function runGithubAppInstallationWorkerRoutingReview(rootDir, config, options) {
  const runId = createRunId();
  const state = await loadGithubAppInstallationState(rootDir);
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const plan = buildGithubAppInstallationWorkerRoutingPlan(state, queueState.queue, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project,
    workerId: options.workerId
  });
  const summary = renderGithubAppInstallationWorkerRoutingSummary(plan);
  const artifacts = await writeGithubAppInstallationWorkerRoutingArtifacts(rootDir, {
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
    command: "github-app-installation-worker-routing-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, state, artifacts };
}

export async function runGithubAppInstallationWorkerRoutingApply(rootDir, config, options) {
  const runId = createRunId();
  const currentState = await loadGithubAppInstallationState(rootDir);
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const plan = buildGithubAppInstallationWorkerRoutingPlan(currentState, queueState.queue, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project,
    workerId: options.workerId
  });
  const routing = applyGithubAppInstallationWorkerRoutingToState(currentState, plan, {
    notes: options.notes,
    at: new Date().toISOString()
  });
  const statePath = await writeGithubAppInstallationState(rootDir, routing.nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationWorkerRoutingSummary(plan, routing.receipts);
  const artifacts = await writeGithubAppInstallationWorkerRoutingArtifacts(rootDir, {
    runId,
    plan,
    receipts: routing.receipts,
    state: routing.nextState,
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
      receipts: routing.receipts,
      state: routing.nextState
    }, null, 2));
    return { runId, plan, receipts: routing.receipts, state: routing.nextState, artifacts, statePath };
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
    command: "github-app-installation-worker-routing-apply",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, receipts: routing.receipts, state: routing.nextState, artifacts, statePath };
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
