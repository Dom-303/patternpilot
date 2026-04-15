import fs from "node:fs/promises";
import path from "node:path";
import {
  collectUrls,
  createRunId,
  ensureDirectory,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadProjectProfile,
  loadQueueEntries,
  loadWatchlistUrls,
  normalizeGithubUrl,
  reEvaluateQueueEntries,
  renderWatchlistReviewHtmlReport,
  writeLatestReportPointers,
  writeRunArtifacts
} from "../../lib/index.mjs";
import {
  buildWatchlistReview,
  buildWatchlistReviewReport,
  classifyReviewItemState
} from "../../lib/review.mjs";
import { computeRulesFingerprint } from "../../lib/classification/evaluation.mjs";
import { refreshContext } from "../shared/runtime-helpers.mjs";
import { runIntake } from "./discovery.mjs";

function buildReviewReportPath(rootDir, binding, review, outputSlug) {
  const reportFilename = outputSlug
    ? `${outputSlug}-review-${review.analysisProfile.id}-${review.analysisDepth.id}.md`
    : `watchlist-review-${review.analysisProfile.id}-${review.analysisDepth.id}.md`;
  return path.join(rootDir, "projects", binding.projectKey, "reviews", reportFilename);
}

function selectReEvaluateTargets(queueRows, alignmentRules, options = {}) {
  const currentFingerprint = computeRulesFingerprint(alignmentRules);
  const requestedUrls = new Set(
    (options.urls ?? []).map((url) => normalizeGithubUrl(url).normalizedRepoUrl)
  );
  const allowedUrls = options.allowedUrls ? new Set(options.allowedUrls) : null;
  const states = { complete: 0, fallback: 0, stale: 0 };
  const targets = [];

  for (const row of queueRows) {
    const stateFields = classifyReviewItemState(row, alignmentRules, currentFingerprint);
    states[stateFields.decisionDataState] += 1;
    const normalizedUrl = row.normalized_repo_url || row.repo_url;

    if (requestedUrls.size > 0 && !requestedUrls.has(normalizedUrl)) {
      continue;
    }
    if (allowedUrls && !allowedUrls.has(normalizedUrl)) {
      continue;
    }
    if (options.staleOnly) {
      if (stateFields.decisionDataState !== "stale") {
        continue;
      }
    } else if (stateFields.decisionDataState !== "stale" && stateFields.decisionDataState !== "fallback") {
      continue;
    }

    targets.push({
      row,
      stateFields
    });
  }

  return {
    currentFingerprint,
    states,
    targets
  };
}

export async function runReviewWatchlist(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);
  const review = await buildWatchlistReview(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    options
  );
  const createdAt = review.createdAt;
  const runId = createRunId(new Date(createdAt));
  const report = buildWatchlistReviewReport(review);
  const htmlReport = renderWatchlistReviewHtmlReport(review, options.reportView);
  const reportPath = buildReviewReportPath(rootDir, binding, review, options.outputSlug);
  const reviewDateStr = review.createdAt.slice(0, 10);
  const htmlReportPath = path.join(
    rootDir,
    "projects",
    binding.projectKey,
    "reports",
    `patternpilot-report-${binding.projectKey}-${reviewDateStr}${options.outputSlug ? `-${options.outputSlug}` : ""}.html`
  );
  const reportRelativePath = path.relative(rootDir, reportPath);
  const htmlReportRelativePath = path.relative(rootDir, htmlReportPath);
  const manifest = {
    runId,
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    reviewScope: review.reviewScope,
    inputUrlCount: review.inputUrlCount,
    reportPath: reportRelativePath,
    htmlReportPath: htmlReportRelativePath,
    reportView: options.reportView,
    review
  };
  const runDir = await writeRunArtifacts({
    rootDir,
    config,
    projectKey,
    runId,
    manifest,
    summary: report,
    projectProfile,
    dryRun: options.dryRun
  });
  const runHtmlPath = path.join(runDir, `patternpilot-report-${projectKey}-${reviewDateStr}.html`);

  if (!options.dryRun) {
    await ensureDirectory(path.dirname(reportPath), false);
    await ensureDirectory(path.dirname(htmlReportPath), false);
    await fs.writeFile(reportPath, `${report}\n`, "utf8");
    await fs.writeFile(htmlReportPath, `${htmlReport}\n`, "utf8");
    await fs.writeFile(runHtmlPath, `${htmlReport}\n`, "utf8");
  }

  const reportPointers = await writeLatestReportPointers({
    rootDir,
    projectKey,
    reportPath: htmlReportPath,
    createdAt,
    runId,
    command: options.outputSlug === "on-demand" ? "on-demand" : "review-watchlist",
    reportKind: "review",
    dryRun: options.dryRun
  });

  console.log(report);
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);
  console.log(`Review report: ${reportRelativePath}`);
  console.log(`HTML report: ${htmlReportRelativePath}`);
  console.log(`Browser link: ${path.relative(rootDir, reportPointers.browserLinkPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`Latest report metadata: ${path.relative(rootDir, reportPointers.latestReportPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (options.dryRun) {
    console.log("Dry run only: review report was not written.");
  }
  await refreshContext(rootDir, config, {
    command: "review-watchlist",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: htmlReportRelativePath
  });

  return {
    runId,
    projectKey,
    review,
    runDir,
    htmlReportPath: htmlReportRelativePath,
    reportPointers
  };
}

export async function runSyncWatchlist(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const project = config.projects?.[projectKey];
  if (!project) {
    throw new Error(`Unknown project '${projectKey}'.`);
  }
  if (!project.watchlistFile) {
    throw new Error(`Project '${projectKey}' has no watchlistFile configured.`);
  }
  const watchlistUrls = await collectUrls(rootDir, {
    ...options,
    file: project.watchlistFile,
    urls: options.urls ?? []
  });
  if (watchlistUrls.length === 0) {
    console.log(`# Patternpilot Watchlist Sync`);
    console.log(``);
    console.log(`- project: ${projectKey}`);
    console.log(`- status: skipped_empty_watchlist`);
    return null;
  }
  return await runIntake(rootDir, config, {
    ...options,
    file: null,
    urls: watchlistUrls
  });
}

export async function runSyncAllWatchlists(rootDir, config, options) {
  const projectEntries = Object.entries(config.projects ?? {});
  const targetEntries = options.project && !options.allProjects
    ? projectEntries.filter(([projectKey]) => projectKey === options.project)
    : projectEntries;

  console.log(`# Patternpilot Watchlist Sync`);
  console.log(``);
  console.log(`- projects: ${targetEntries.length}`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(``);

  for (const [projectKey, project] of targetEntries) {
    if (!project.watchlistFile) {
      console.log(`- ${projectKey}: skipped (no watchlist_file configured)`);
      continue;
    }
    const watchlistUrls = await collectUrls(rootDir, {
      ...options,
      file: project.watchlistFile,
      urls: []
    });
    if (watchlistUrls.length === 0) {
      console.log(`- ${projectKey}: skipped (empty watchlist)`);
      continue;
    }
    console.log(`## Sync ${projectKey}`);
    await runIntake(rootDir, config, {
      ...options,
      project: projectKey,
      file: null,
      urls: watchlistUrls
    });
    console.log(``);
  }
}

export async function runReEvaluate(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === projectKey);
  const selection = selectReEvaluateTargets(queueRows, alignmentRules, options);

  if (options.limit && Number.isFinite(options.limit) && options.limit > 0) {
    selection.targets = selection.targets.slice(0, options.limit);
  }

  console.log(`# Patternpilot Re-Evaluate`);
  console.log(``);
  console.log(`- project: ${projectKey}`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- stale_only: ${options.staleOnly ? "yes" : "no"}`);
  console.log(`- queue_rows: ${queueRows.length}`);
  console.log(`- complete_rows: ${selection.states.complete}`);
  console.log(`- fallback_rows: ${selection.states.fallback}`);
  console.log(`- stale_rows: ${selection.states.stale}`);
  console.log(`- target_rows: ${selection.targets.length}`);
  console.log(`- current_rules_fingerprint: ${selection.currentFingerprint}`);

  if (selection.targets.length === 0) {
    console.log(``);
    console.log(`- status: skipped_no_targets`);
    await refreshContext(rootDir, config, {
      command: "re-evaluate",
      projectKey,
      mode: options.dryRun ? "dry_run" : "write",
      reportPath: "-"
    });
    return {
      projectKey,
      updates: [],
      states: selection.states,
      targetRows: 0
    };
  }

  const updates = await reEvaluateQueueEntries(
    rootDir,
    config,
    selection.targets.map((item) => item.row),
    alignmentRules,
    options
  );

  console.log(``);
  console.log(`## Updated Items`);
  for (const update of updates) {
    const repoRef = `${update.row.owner}/${update.row.name}`;
    console.log(
      `- ${repoRef}: disposition=${update.decisionFields.reviewDisposition} | effort=${update.decisionFields.effortBand} (${update.decisionFields.effortScore}) | value=${update.decisionFields.valueBand} (${update.decisionFields.valueScore}) | intake_doc=${update.intakeDocResult.status}`
    );
  }

  await refreshContext(rootDir, config, {
    command: "re-evaluate",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: "-"
  });

  return {
    projectKey,
    updates,
    states: selection.states,
    targetRows: selection.targets.length
  };
}
