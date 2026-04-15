import fs from "node:fs/promises";
import path from "node:path";
import {
  collectUrls,
  createRunId,
  ensureDirectory,
  loadAutomationJobs,
  loadAutomationJobState,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadWatchlistUrls,
  renderProjectRunDriftSummary,
  renderProjectRunGovernanceSummary,
  renderProjectRunLifecycleSummary,
  renderProjectRunRequalificationSummary,
  renderProjectRunStabilitySummary,
  buildProjectRunDrift,
  buildProjectRunRequalification,
  buildProjectRunStability
} from "../../lib/index.mjs";
import { computeRulesFingerprint } from "../../lib/classification.mjs";
import {
  buildProjectRunDiagnostics,
  buildProjectRunGovernanceSnapshot,
  refreshContext
} from "../shared/runtime-helpers.mjs";

export async function runPlan(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const explicitUrls = await collectUrls(rootDir, options);
  const sourceMode = options.scope === "automation"
    ? "watchlist"
    : explicitUrls.length > 0 ? "explicit_urls" : "watchlist";
  const watchlistUrls = project.watchlistFile
    ? await loadWatchlistUrls(rootDir, project)
    : [];
  const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
    projectKey,
    sourceMode,
    explicitUrlCount: explicitUrls.length,
    watchlistCount: watchlistUrls.length,
    watchlistUrls,
    currentFingerprint: computeRulesFingerprint(alignmentRules),
    isAutomation: options.scope === "automation"
  });
  const lifecycle = diagnostics.lifecycle;
  const drift = diagnostics.drift;
  const stability = diagnostics.stability;
  const governance = buildProjectRunGovernanceSnapshot({
    projectKey,
    lifecycle,
    drift,
    stability,
    scope: options.scope === "automation" ? "automation" : "manual"
  });
  const generatedAt = new Date().toISOString();
  const summary = renderProjectRunLifecycleSummary({
    projectKey,
    generatedAt,
    lifecycle
  });
  const driftSummary = renderProjectRunDriftSummary({
    projectKey,
    drift
  });
  const stabilitySummary = renderProjectRunStabilitySummary({
    projectKey,
    stability
  });
  const governanceSummary = renderProjectRunGovernanceSummary({
    projectKey,
    generatedAt,
    governance
  });

  console.log(summary);
  console.log(``);
  console.log(driftSummary);
  console.log(``);
  console.log(stabilitySummary);
  console.log(``);
  console.log(governanceSummary);

  await refreshContext(rootDir, config, {
    command: "run-plan",
    projectKey,
    mode: options.scope === "automation" ? "automation" : "manual",
    reportPath: "-"
  });

  return {
    projectKey,
    lifecycle,
    drift,
    stability,
    governance
  };
}

export async function runDrift(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const watchlistUrls = project.watchlistFile
    ? await loadWatchlistUrls(rootDir, project)
    : [];
  const drift = await buildProjectRunDrift(rootDir, config, {
    projectKey,
    selectedRunId: options.runId ?? null,
    watchlistUrls,
    currentFingerprint: computeRulesFingerprint(alignmentRules)
  });
  const summary = renderProjectRunDriftSummary({
    projectKey,
    drift
  });
  const reportId = createRunId(new Date(drift.generatedAt));
  const reportDir = path.join(rootDir, "projects", projectKey, "run-drift", reportId);

  if (!options.dryRun) {
    await ensureDirectory(reportDir, false);
    await fs.writeFile(path.join(reportDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(reportDir, "report.json"), `${JSON.stringify(drift, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- report_dir: ${path.relative(rootDir, reportDir)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "run-drift",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, reportDir)
  });

  return {
    projectKey,
    drift,
    reportDir
  };
}

export async function runStability(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const stability = await buildProjectRunStability(rootDir, config, {
    projectKey,
    limit: options.limit ?? 6
  });
  const summary = renderProjectRunStabilitySummary({
    projectKey,
    stability
  });
  const reportId = createRunId(new Date(stability.generatedAt));
  const reportDir = path.join(rootDir, "projects", projectKey, "run-stability", reportId);

  if (!options.dryRun) {
    await ensureDirectory(reportDir, false);
    await fs.writeFile(path.join(reportDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(reportDir, "report.json"), `${JSON.stringify(stability, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- report_dir: ${path.relative(rootDir, reportDir)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "run-stability",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, reportDir)
  });

  return {
    projectKey,
    stability,
    reportDir
  };
}

export async function runGovernance(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const explicitUrls = await collectUrls(rootDir, options);
  const sourceMode = options.scope === "automation"
    ? "watchlist"
    : explicitUrls.length > 0 ? "explicit_urls" : "watchlist";
  const watchlistUrls = project.watchlistFile
    ? await loadWatchlistUrls(rootDir, project)
    : [];
  const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
    projectKey,
    sourceMode,
    explicitUrlCount: explicitUrls.length,
    watchlistCount: watchlistUrls.length,
    watchlistUrls,
    currentFingerprint: computeRulesFingerprint(alignmentRules),
    isAutomation: options.scope === "automation"
  });
  const governance = buildProjectRunGovernanceSnapshot({
    projectKey,
    lifecycle: diagnostics.lifecycle,
    drift: diagnostics.drift,
    stability: diagnostics.stability,
    scope: options.scope === "automation" ? "automation" : "manual"
  });
  const generatedAt = new Date().toISOString();
  const summary = renderProjectRunGovernanceSummary({
    projectKey,
    generatedAt,
    governance
  });
  const reportId = createRunId(new Date(generatedAt));
  const reportDir = path.join(rootDir, "projects", projectKey, "run-governance", reportId);

  if (!options.dryRun) {
    await ensureDirectory(reportDir, false);
    await fs.writeFile(path.join(reportDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(reportDir, "report.json"), `${JSON.stringify({
      generatedAt,
      projectKey,
      governance,
      lifecycle: diagnostics.lifecycle,
      drift: diagnostics.drift,
      stability: diagnostics.stability
    }, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- report_dir: ${path.relative(rootDir, reportDir)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "run-governance",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, reportDir)
  });

  return {
    projectKey,
    governance,
    reportDir
  };
}

export async function runRequalify(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const watchlistUrls = project.watchlistFile
    ? await loadWatchlistUrls(rootDir, project)
    : [];
  const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
    projectKey,
    sourceMode: "watchlist",
    explicitUrlCount: 0,
    watchlistCount: watchlistUrls.length,
    watchlistUrls,
    currentFingerprint: computeRulesFingerprint(alignmentRules),
    isAutomation: options.scope === "automation"
  });
  const { state } = await loadAutomationJobState(rootDir, config);
  const { jobs } = await loadAutomationJobs(rootDir, config);
  const automationJob = options.automationJob
    ? jobs.find((job) => job.name === options.automationJob) ?? null
    : jobs.find((job) => job.scope === "project" && job.projectKey === projectKey) ?? null;
  const jobState = automationJob ? state.jobs?.[automationJob.name] ?? null : null;
  const governance = buildProjectRunGovernanceSnapshot({
    projectKey,
    lifecycle: diagnostics.lifecycle,
    drift: diagnostics.drift,
    stability: diagnostics.stability,
    scope: options.scope === "automation" ? "automation" : "manual",
    jobState,
    job: automationJob
  });
  const releaseGovernance = buildProjectRunGovernanceSnapshot({
    projectKey,
    lifecycle: diagnostics.lifecycle,
    drift: diagnostics.drift,
    stability: diagnostics.stability,
    scope: options.scope === "automation" ? "automation" : "manual",
    jobState: jobState ? { ...jobState, requalificationRequired: false } : null,
    job: automationJob
  });
  const generatedAt = new Date().toISOString();
  const requalification = buildProjectRunRequalification({
    projectKey,
    lifecycle: diagnostics.lifecycle,
    drift: diagnostics.drift,
    stability: diagnostics.stability,
    governance,
    releaseGovernance,
    jobName: automationJob?.name ?? null,
    jobState
  });
  const summary = renderProjectRunRequalificationSummary({
    projectKey,
    generatedAt,
    requalification
  });
  const reportId = createRunId(new Date(generatedAt));
  const reportDir = path.join(rootDir, "projects", projectKey, "run-requalify", reportId);

  if (!options.dryRun) {
    await ensureDirectory(reportDir, false);
    await fs.writeFile(path.join(reportDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(reportDir, "report.json"), `${JSON.stringify({
      generatedAt,
      projectKey,
      jobName: automationJob?.name ?? null,
      requalification,
      lifecycle: diagnostics.lifecycle,
      drift: diagnostics.drift,
      stability: diagnostics.stability,
      governance,
      releaseGovernance
    }, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- report_dir: ${path.relative(rootDir, reportDir)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "run-requalify",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, reportDir)
  });

  return {
    projectKey,
    jobName: automationJob?.name ?? null,
    requalification,
    reportDir
  };
}
