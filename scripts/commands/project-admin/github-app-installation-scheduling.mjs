import {
  applyGithubAppInstallationServiceScheduleToState,
  buildGithubAppInstallationServiceSchedulePlan,
  createRunId,
  loadGithubAppInstallationState,
  loadGithubWebhookServiceQueue,
  renderGithubAppInstallationServiceScheduleSummary,
  writeGithubAppInstallationServiceScheduleArtifacts,
  writeGithubAppInstallationState
} from "../../../lib/index.mjs";
import {
  path,
  refreshContext
} from "./shared.mjs";

export async function runGithubAppInstallationServiceScheduleReview(rootDir, config, options) {
  const runId = createRunId();
  const state = await loadGithubAppInstallationState(rootDir);
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const plan = buildGithubAppInstallationServiceSchedulePlan(state, queueState.queue, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project,
    workerId: options.workerId
  });
  const summary = renderGithubAppInstallationServiceScheduleSummary(plan);
  const artifacts = await writeGithubAppInstallationServiceScheduleArtifacts(rootDir, {
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
    command: "github-app-installation-service-schedule-review",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, state, artifacts };
}

export async function runGithubAppInstallationServiceScheduleApply(rootDir, config, options) {
  const runId = createRunId();
  const currentState = await loadGithubAppInstallationState(rootDir);
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const plan = buildGithubAppInstallationServiceSchedulePlan(currentState, queueState.queue, {
    generatedAt: new Date().toISOString(),
    installationId: options.installationId,
    project: options.project,
    workerId: options.workerId
  });
  const scheduling = applyGithubAppInstallationServiceScheduleToState(currentState, plan, {
    notes: options.notes,
    at: new Date().toISOString()
  });
  const statePath = await writeGithubAppInstallationState(rootDir, scheduling.nextState, {
    dryRun: options.dryRun
  });
  const summary = renderGithubAppInstallationServiceScheduleSummary(plan, scheduling.receipts);
  const artifacts = await writeGithubAppInstallationServiceScheduleArtifacts(rootDir, {
    runId,
    plan,
    receipts: scheduling.receipts,
    state: scheduling.nextState,
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
      receipts: scheduling.receipts,
      state: scheduling.nextState
    }, null, 2));
    return { runId, plan, receipts: scheduling.receipts, state: scheduling.nextState, artifacts, statePath };
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
    command: "github-app-installation-service-schedule-apply",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return { runId, plan, receipts: scheduling.receipts, state: scheduling.nextState, artifacts, statePath };
}
