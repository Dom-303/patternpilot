import fs from "node:fs/promises";
import path from "node:path";
import {
  buildReviewAgentView,
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
  selectReEvaluateTargets,
  renderWatchlistReviewHtmlReport,
  writeLatestReportPointers,
  writeRunArtifacts
} from "../../lib/index.mjs";
import {
  buildGoldenPathCommands,
  renderNextCommandSections
} from "../shared/golden-path.mjs";
import {
  buildWatchlistReview,
  buildWatchlistReviewReport
} from "../../lib/review.mjs";
import { refreshContext } from "../shared/runtime-helpers.mjs";
import { runDiscover, runIntake } from "./discovery.mjs";
import { readProblem } from "../../lib/problem/store.mjs";
import { applySoftBoost } from "../../lib/discovery/problem-constraints.mjs";
import { assessWatchlistHealth } from "../../lib/review/watchlist-health.mjs";
import { runAutoDiscoverForReview } from "../../lib/review/auto-discover.mjs";

function buildReviewReportPath(rootDir, binding, review, outputSlug) {
  const reportFilename = outputSlug
    ? `${outputSlug}-review-${review.analysisProfile.id}-${review.analysisDepth.id}.md`
    : `watchlist-review-${review.analysisProfile.id}-${review.analysisDepth.id}.md`;
  return path.join(rootDir, "projects", binding.projectKey, "reviews", reportFilename);
}

function buildReviewCommandGuidance(projectKey, review) {
  const commands = buildGoldenPathCommands(projectKey);

  if ((review.items?.length ?? 0) <= 0) {
    return (review.missingUrls?.length ?? 0) > 0
      ? {
          primary: commands.syncWatchlist,
          additional: [commands.intake, commands.showProject]
        }
      : {
          primary: commands.intake,
          additional: [commands.syncWatchlist, commands.showProject]
        };
  }

  if ((review.missingUrls?.length ?? 0) > 0) {
    return {
      primary: commands.syncWatchlist,
      additional: [commands.reviewWatchlist, commands.releaseCheck]
    };
  }

  return {
    primary: commands.releaseCheck,
    additional: [commands.reviewWatchlist, commands.showProject]
  };
}

export async function runReviewWatchlist(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);

  // Phase 4 Layer 2: --auto-discover trigger.  Wenn der Nutzer den Flag
  // gesetzt hat UND die Watchlist unter dem Schwellwert liegt, ruft der
  // Helper runDiscover mit focused/quick/intake/appendWatchlist auf.
  // Bei selectedUrls > 0 wird der Trigger unterdrueckt, weil der Nutzer
  // den Korridor explizit gewaehlt hat. Fail-Fall: Health-Layer-1 bleibt
  // wirksam, der Review laeuft weiter mit dem unveraenderten Stand.
  let autoDiscoverResult = null;
  if (options.autoDiscover && (!options.urls || options.urls.length === 0)) {
    const initialWatchlistUrls = await loadWatchlistUrls(rootDir, project);
    const initialQueueRows = (await loadQueueEntries(rootDir, config))
      .filter((row) => row.project_key === binding.projectKey);
    const initialHealth = assessWatchlistHealth({
      watchlistCount: initialWatchlistUrls.length,
      queueCount: initialQueueRows.length,
    });
    autoDiscoverResult = await runAutoDiscoverForReview({
      rootDir,
      config,
      projectKey: binding.projectKey,
      health: initialHealth,
      options,
      runDiscoverFn: options.runDiscoverFn ?? runDiscover,
      logger: console,
    });
  }

  const review = await buildWatchlistReview(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    options
  );

  if (autoDiscoverResult) {
    review.autoDiscoverResult = autoDiscoverResult;
  }

  let problemForFilter = null;
  if (options.problem) {
    try {
      problemForFilter = await readProblem({ rootDir, projectKey: binding.projectKey, slug: options.problem });
    } catch {
      // problem artifact not found — skip soft boost, continue normally
    }
  }
  if (problemForFilter) {
    const techTags = problemForFilter.derived?.tech_tags ?? [];
    for (let idx = 0; idx < review.items.length; idx++) {
      review.items[idx] = applySoftBoost(review.items[idx], techTags);
    }
    review.items.sort((left, right) => right.reviewScore - left.reviewScore);
    review.problemSlug = options.problem;
  } else if (options.problem) {
    review.problemSlug = options.problem;
  }

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
    agentHandoffPayload: buildReviewAgentView(review).payload,
    dryRun: options.dryRun
  });

  console.log(report);
  if (review.problemSlug) {
    console.log(`Problem context: ${review.problemSlug}`);
  }
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);
  console.log(`Review report: ${reportRelativePath}`);
  console.log(`HTML report: ${htmlReportRelativePath}`);
  console.log(`Browser link: ${path.relative(rootDir, reportPointers.browserLinkPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`Latest report metadata: ${path.relative(rootDir, reportPointers.latestReportPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`Agent handoff: ${path.relative(rootDir, reportPointers.agentHandoffPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (options.dryRun) {
    console.log("Dry run only: review report was not written.");
  }
  console.log(``);
  const commandGuidance = buildReviewCommandGuidance(projectKey, review);
  console.log(renderNextCommandSections(commandGuidance));
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
    const commands = buildGoldenPathCommands(projectKey);
    console.log(`# Patternpilot Watchlist Sync`);
    console.log(``);
    console.log(`- project: ${projectKey}`);
    console.log(`- status: skipped_empty_watchlist`);
    console.log(``);
    console.log(renderNextCommandSections({
      primary: `edit bindings/${projectKey}/WATCHLIST.txt`,
      additional: [
        commands.intake,
        commands.reviewWatchlist
      ]
    }));
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

function renderReEvaluateSummary({
  projectKey,
  createdAt,
  dryRun,
  staleOnly,
  states,
  totalTargetRows,
  selectedTargetRows,
  remainingTargetRows,
  limitApplied,
  currentFingerprint,
  driftCounts,
  updates
}) {
  const driftLines = Object.keys(driftCounts ?? {}).length > 0
    ? Object.entries(driftCounts)
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([reason, count]) => `- ${reason}: ${count}`)
      .join("\n")
    : "- none";
  const updateLines = (updates?.length ?? 0) > 0
    ? updates.map((update) =>
      `- ${update.audit.repoRef}: triggers=${update.audit.triggerReasons.join(",") || "-"} | previous_fingerprint=${update.audit.previousRulesFingerprint ?? "-"} | next_fingerprint=${update.audit.nextRulesFingerprint ?? "-"} | disposition=${update.decisionFields.reviewDisposition} | intake_doc=${update.intakeDocResult.status}`
    ).join("\n")
    : "- none";

  return `# Patternpilot Re-Evaluate

- project: ${projectKey}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}
- stale_only: ${staleOnly ? "yes" : "no"}
- complete_rows: ${states.complete}
- fallback_rows: ${states.fallback}
- stale_rows: ${states.stale}
- target_rows_total: ${totalTargetRows}
- target_rows_selected: ${selectedTargetRows}
- target_rows_remaining: ${remainingTargetRows}
- batch_limit: ${limitApplied ?? "-"}
- current_rules_fingerprint: ${currentFingerprint}

## Drift Signals

${driftLines}

## Updated Items

${updateLines}
`;
}

export async function runReEvaluate(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === projectKey);
  const normalizedUrls = (options.urls ?? []).map((url) => {
    const rawUrl = String(url ?? "").trim();
    if (!rawUrl) {
      return null;
    }
    return normalizeGithubUrl(rawUrl).normalizedRepoUrl;
  }).filter(Boolean);
  const selection = selectReEvaluateTargets(queueRows, alignmentRules, {
    ...options,
    urls: normalizedUrls
  });
  const totalTargetRows = selection.targets.length;
  const limitApplied = options.limit && Number.isFinite(options.limit) && options.limit > 0
    ? Number(options.limit)
    : null;
  const plannedTargets = limitApplied
    ? selection.targets.slice(0, limitApplied)
    : selection.targets;
  const remainingTargetRows = Math.max(0, totalTargetRows - plannedTargets.length);
  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));

  let updates = [];

  if (plannedTargets.length > 0) {
    const targetMetadataByUrl = new Map(
      plannedTargets
        .filter((item) => item.target.normalizedRepoUrl)
        .map((item) => [
          item.target.normalizedRepoUrl,
          {
            decisionDataState: item.target.decisionDataState,
            previousRulesFingerprint: item.target.previousRulesFingerprint,
            driftReasons: item.target.driftReasons
          }
        ])
    );
    updates = await reEvaluateQueueEntries(
      rootDir,
      config,
      plannedTargets.map((item) => item.row),
      alignmentRules,
      {
        ...options,
        targetMetadataByUrl
      }
    );
  }

  const summary = renderReEvaluateSummary({
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    staleOnly: options.staleOnly,
    states: selection.states,
    totalTargetRows,
    selectedTargetRows: plannedTargets.length,
    remainingTargetRows,
    limitApplied,
    currentFingerprint: selection.currentFingerprint,
    driftCounts: selection.driftCounts,
    updates
  });
  const manifest = {
    command: "re-evaluate",
    runId,
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    staleOnly: Boolean(options.staleOnly),
    batchLimit: limitApplied,
    queueRows: queueRows.length,
    totalTargetRows,
    selectedTargetRows: plannedTargets.length,
    remainingTargetRows,
    currentFingerprint: selection.currentFingerprint,
    states: selection.states,
    driftCounts: selection.driftCounts,
    updates
  };
  const runDir = await writeRunArtifacts({
    rootDir,
    config,
    projectKey,
    runId,
    manifest,
    summary,
    projectProfile: null,
    dryRun: options.dryRun
  });

  console.log(summary);
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);

  if (plannedTargets.length === 0) {
    console.log(`- status: skipped_no_targets`);
    console.log(`- note: Queue entries are already current for this selection.`);
    console.log(``);
    const commands = buildGoldenPathCommands(projectKey);
    console.log(renderNextCommandSections({
      primary: commands.reviewWatchlist,
      additional: [commands.releaseCheck, commands.showProject]
    }));
    await refreshContext(rootDir, config, {
      command: "re-evaluate",
      projectKey,
      mode: options.dryRun ? "dry_run" : "write",
      reportPath: path.relative(rootDir, runDir)
    });
    return {
      projectKey,
      runId,
      runDir,
      updates: [],
      states: selection.states,
      targetRows: 0,
      totalTargetRows,
      remainingTargetRows,
      driftCounts: selection.driftCounts
    };
  }

  console.log(``);
  const commands = buildGoldenPathCommands(projectKey);
  if (remainingTargetRows > 0) {
    console.log(`- next_batch_hint: ${remainingTargetRows} target row(s) remain for a later re-evaluate batch.`);
  }
  console.log(``);
  console.log(renderNextCommandSections({
    primary: commands.reviewWatchlist,
    additional: [commands.releaseCheck, commands.showProject]
  }));

  await refreshContext(rootDir, config, {
    command: "re-evaluate",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, runDir)
  });

  return {
    projectKey,
    runId,
    runDir,
    updates,
    states: selection.states,
    targetRows: plannedTargets.length,
    totalTargetRows,
    remainingTargetRows,
    driftCounts: selection.driftCounts
  };
}
