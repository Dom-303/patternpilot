import fs from "node:fs/promises";
import path from "node:path";
import {
  buildAutomationAlertAttention,
  buildAutomationAlerts,
  buildAutomationOperatorReviewDigest,
  buildPatternpilotProductReadinessReview,
  buildPolicyControlReview,
  buildProjectRunGovernance,
  buildProjectRunLifecycle,
  buildProjectRunStability,
  createRunId,
  ensureDirectory,
  evaluateAutomationJobs,
  findLatestPolicyStageArtifact,
  inspectGithubAppAuth,
  inspectGithubAuth,
  listProjectRunHistory,
  loadAutomationJobState,
  loadAutomationJobs,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadQueueEntries,
  loadWatchlistUrls,
  renderPatternpilotProductReadinessSummary,
  resolveAutomationAlertTargets,
  runGithubDoctor,
  selectNextDispatchableAutomationJob
} from "../../lib/index.mjs";
import { computeRulesFingerprint } from "../../lib/classification/evaluation.mjs";
import { enrichAutomationEvaluationsWithGovernance } from "./automation/shared.mjs";
import {
  buildGoldenPathCommands,
  renderNextCommandSections
} from "../shared/golden-path.mjs";
import { buildProjectRunDiagnostics, refreshContext } from "../shared/runtime-helpers.mjs";

async function safeLoadJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadLatestReportMetadata(rootDir, projectKey) {
  return safeLoadJson(path.join(rootDir, "projects", projectKey, "reports", "latest-report.json"));
}

async function loadRuntimeContextState(rootDir) {
  return safeLoadJson(path.join(rootDir, "state", "runtime_context.json"));
}

async function loadProjectPolicyControl(rootDir, projectKey) {
  const [cycle, handoff, curation, applyReview, apply] = await Promise.all([
    findLatestPolicyStageArtifact(rootDir, projectKey, "cycle"),
    findLatestPolicyStageArtifact(rootDir, projectKey, "handoff"),
    findLatestPolicyStageArtifact(rootDir, projectKey, "curation"),
    findLatestPolicyStageArtifact(rootDir, projectKey, "apply_review"),
    findLatestPolicyStageArtifact(rootDir, projectKey, "apply")
  ]);

  return buildPolicyControlReview({
    projectKey,
    cycle,
    handoff,
    curation,
    applyReview,
    apply
  });
}

async function collectProjectReadiness(rootDir, config, projectKey, evaluations, alerts, runtimeContext = null) {
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const watchlistUrls = project.watchlistFile
    ? await loadWatchlistUrls(rootDir, project)
    : [];
  const latestReport = await loadLatestReportMetadata(rootDir, projectKey);
  const jobEntries = evaluations.filter((evaluation) => evaluation.projectKey === projectKey);
  const job = jobEntries[0] ?? null;
  const projectAlertItems = alerts.filter((alert) => jobEntries.some((item) => item.name === alert.jobName));

  let governance = job?.liveGovernance ?? null;
  let policyControl = job?.livePolicyControl ?? null;

  if (!governance) {
    const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
    const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
      projectKey,
      sourceMode: "watchlist",
      explicitUrlCount: 0,
      watchlistCount: watchlistUrls.length,
      watchlistUrls,
      currentFingerprint: computeRulesFingerprint(alignmentRules),
      isAutomation: true
    });
    governance = buildProjectRunGovernance({
      projectKey,
      lifecycle: diagnostics.lifecycle,
      drift: diagnostics.drift,
      stability: diagnostics.stability,
      scope: "automation",
      jobState: job?.jobState ?? null,
      job
    });
  }

  if (!policyControl) {
    policyControl = await loadProjectPolicyControl(rootDir, projectKey);
  }

  return {
    projectKey,
    label: binding.projectLabel ?? project.label ?? projectKey,
    watchlistCount: watchlistUrls.length,
    watchlistFile: project.watchlistFile ?? null,
    governanceStatus: governance.status,
    governanceNextAction: governance.nextAction,
    policyControlStatus: policyControl.overallStatus,
    policyControlNextCommand: policyControl.nextCommand,
    jobName: job?.name ?? null,
    jobStatus: job?.status ?? "unconfigured",
    jobReason: job?.reason ?? "No automation job is configured for this project.",
    jobNextAction:
      job?.jobState?.resumeRecommendation?.nextAction
      ?? job?.jobState?.requalificationReason
      ?? null,
    alertCount: projectAlertItems.length,
    highAlertCount: projectAlertItems.filter((alert) => alert.severity === "high").length,
    topAlertCategory: projectAlertItems[0]?.category ?? null,
    topAlertNextAction: projectAlertItems[0]?.nextAction ?? null,
    recentCompletedCommands: [
      ...(latestReport?.command && latestReport?.createdAt
        ? [{
          command: latestReport.command,
          createdAt: latestReport.createdAt
        }]
        : []),
      ...(runtimeContext?.lastContext?.projectKey === projectKey && runtimeContext?.lastContext?.command
        ? [{
          command: runtimeContext.lastContext.command,
          createdAt: runtimeContext.generatedAt ?? null
        }]
        : [])
    ]
  };
}

async function writeProductReadinessArtifacts(rootDir, runId, review, summary, dryRun = false) {
  const artifactRoot = path.join(rootDir, "runs", "product-readiness", runId);
  const reviewPath = path.join(artifactRoot, "product-readiness-review.json");
  const summaryPath = path.join(artifactRoot, "summary.md");

  if (!dryRun) {
    await ensureDirectory(artifactRoot, false);
    await fs.writeFile(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
  }

  return {
    artifactRoot,
    reviewPath,
    summaryPath
  };
}

export function selectProductReadinessProjectKeys(config, options = {}) {
  if (options.project) {
    return [options.project];
  }
  if (options.allProjects) {
    return Object.keys(config.projects ?? {});
  }
  if (config.defaultProject) {
    return [config.defaultProject];
  }
  return Object.keys(config.projects ?? {});
}

export async function runProductReadiness(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const auth = inspectGithubAuth(config);
  const githubApp = inspectGithubAppAuth();
  const githubApi = await runGithubDoctor(config, { offline: options.offline });
  const { jobs } = await loadAutomationJobs(rootDir, config);
  const { state } = await loadAutomationJobState(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);
  const nextJob = selectNextDispatchableAutomationJob(evaluations) ?? evaluations.find((job) => job.status === "ready") ?? null;
  const alerts = buildAutomationAlerts(evaluations, {
    now: new Date(generatedAt)
  });
  const runtimeContext = await loadRuntimeContextState(rootDir);
  const operatorReviewDigest = buildAutomationOperatorReviewDigest(evaluations, {
    now: new Date(generatedAt)
  });
  const attention = buildAutomationAlertAttention({
    alerts,
    operatorReviewDigest,
    nextJob
  });
  const targets = resolveAutomationAlertTargets(rootDir, config, {});
  const projectKeys = selectProductReadinessProjectKeys(config, options);
  const projects = [];
  for (const projectKey of projectKeys) {
    projects.push(await collectProjectReadiness(rootDir, config, projectKey, evaluations, alerts, runtimeContext));
  }

  const review = buildPatternpilotProductReadinessReview({
    generatedAt,
    auth,
    githubApp,
    githubApi,
    alertDelivery: {
      configured: Boolean(config.automationAlertPreset) || (Array.isArray(config.automationAlertTargets) && config.automationAlertTargets.length > 0),
      preset: config.automationAlertPreset ?? null,
      targetCount: targets.length
    },
    automation: {
      jobsConfigured: jobs.length,
      jobsReady: evaluations.filter((job) => job.status === "ready").length,
      jobsBlocked: evaluations.filter((job) => job.status === "blocked_manual" || job.status === "blocked_requalify").length,
      jobsBackoff: evaluations.filter((job) => job.status === "backoff").length,
      attentionStatus: attention.status,
      deliveryPriority: attention.deliveryPriority,
      nextAction: attention.nextAction,
      fallbackNextAction: projects.find((project) => project.governanceNextAction || project.policyControlNextCommand)?.governanceNextAction
        ?? projects.find((project) => project.policyControlNextCommand)?.policyControlNextCommand
        ?? null
    },
    projects
  });
  const runId = createRunId(new Date(generatedAt));
  const summary = renderPatternpilotProductReadinessSummary(review);
  const artifacts = await writeProductReadinessArtifacts(rootDir, runId, review, summary, options.dryRun);

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      review,
      artifacts: {
        artifactRoot: path.relative(rootDir, artifacts.artifactRoot),
        reviewPath: path.relative(rootDir, artifacts.reviewPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      }
    }, null, 2));
  } else {
    console.log(summary);
    console.log(`- artifact_root: ${path.relative(rootDir, artifacts.artifactRoot)}${options.dryRun ? " (dry-run not written)" : ""}`);
    console.log(`- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
    console.log(`- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
    console.log(``);
    const targetProject = options.project || config.defaultProject || review.projects?.[0]?.projectKey || "my-project";
    const commands = buildGoldenPathCommands(targetProject);
    console.log(renderNextCommandSections({
      primary: review.nextAction ?? commands.bootstrap,
      additional: review.projects.length > 0
        ? [commands.showProject, commands.reviewWatchlist]
        : [commands.gettingStarted]
    }));
  }

  await refreshContext(rootDir, config, {
    command: "product-readiness",
    projectKey: options.project || config.defaultProject,
    mode: options.dryRun ? "dry_run" : "manual",
    reportPath: path.relative(rootDir, artifacts.summaryPath)
  });

  return {
    runId,
    review,
    artifacts
  };
}
