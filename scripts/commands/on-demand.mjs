import path from "node:path";
import {
  appendUrlsToWatchlist,
  collectUrls,
  createRunId,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadWatchlistUrls,
  renderOnDemandRunHtmlReport,
  writeRunArtifacts
} from "../../lib/index.mjs";
import { computeRulesFingerprint } from "../../lib/classification/evaluation.mjs";
import {
  buildProjectRunDiagnostics,
  buildProjectRunGovernanceSnapshot,
  refreshContext
} from "../shared/runtime-helpers.mjs";
import {
  renderNextCommandSections,
  selectPrimaryNextStep
} from "../shared/golden-path.mjs";
import { runIntake } from "./discovery.mjs";
import {
  runReEvaluate,
  runReviewWatchlist,
  runSyncWatchlist
} from "./watchlist.mjs";
import { runPromote } from "./promotion.mjs";

function buildOnDemandNextActions(summary) {
  const actions = [];
  const review = summary.reviewRun?.review ?? null;
  const topItem = review?.topItems?.[0] ?? null;
  const topFitBand = topItem?.projectFitBand ?? "unknown";
  const topRepo = topItem?.repoRef ?? null;
  const runPlan = summary.runPlan ?? null;
  const runDrift = summary.runDrift ?? null;
  const runGovernance = summary.runGovernance ?? null;

  if (summary.dryRun) {
    actions.push("Run the same command without --dry-run once the scope looks right.");
  }

  if (summary.artifacts?.reviewReportLabel) {
    actions.push(`Open the review report: ${summary.artifacts.reviewReportLabel}`);
  }

  if (summary.artifacts?.browserLinkLabel) {
    actions.push(`Use the browser-link pointer for quick local opening: ${summary.artifacts.browserLinkLabel}`);
  }

  if (!review) {
    actions.push("Enable the review step so the run produces a comparison and concrete next moves.");
  } else if ((review.missingUrls?.length ?? 0) > 0) {
    actions.push(`Cover the ${review.missingUrls.length} missing URL(s) before treating this run as complete.`);
  }

  if (topRepo && topFitBand === "high") {
    actions.push(`Inspect ${topRepo} first and decide whether it should move into focused promotion prep.`);
  } else if (topRepo && topFitBand === "medium") {
    actions.push(`Inspect ${topRepo} first, but keep the move at review level until the fit feels stronger.`);
  } else if (topRepo && topFitBand === "low") {
    actions.push(`Treat ${topRepo} more as a boundary or risk signal than as a direct adoption candidate.`);
  }

  if (summary.sourceMode === "explicit_urls" && !summary.appendWatchlist) {
    actions.push("Decide deliberately whether this repo should stay one-off or also enter the project watchlist.");
  }

  if (runPlan?.runKind === "first_run") {
    actions.push("Treat this as a first-run orientation pass and keep promotion at most on prepared level until the report feels right.");
  } else if (runPlan?.runKind === "maintenance_run") {
    actions.push("Treat this as a maintenance run: compare drift and stale data first before broadening promotion scope.");
  }

  if (runDrift?.driftStatus === "attention_required") {
    actions.push(runDrift.resumeGuidance?.nextAction ?? "Inspect run drift before broadening the next promotion step.");
  }

  if (runGovernance?.status === "manual_gate") {
    actions.push(runGovernance.nextAction ?? "Treat the next step as manual-only until the governance blockers are resolved.");
  } else if (runGovernance?.status === "limited_unattended") {
    actions.push(runGovernance.nextAction ?? "Allow limited unattended continuation, but keep promotion conservative.");
  }

  if (summary.promoteRun) {
    actions.push("Review the promotion output before making broader curated-knowledge changes.");
  }

  return [...new Set(actions)].slice(0, 6);
}

function buildOnDemandSummary({
  rootDir,
  runId,
  projectKey,
  createdAt,
  runPlan,
  runDrift,
  runStability,
  runGovernance,
  sourceMode,
  explicitUrls,
  effectiveUrls,
  dryRun,
  appendWatchlist,
  intakeRun,
  reEvaluateRun,
  reviewRun,
  promoteRun,
  nextActions
}) {
  return `# Patternpilot On-Demand Run

- run_id: ${runId}
- project: ${projectKey}
- created_at: ${createdAt}
- run_kind: ${runPlan?.runKind ?? "unknown"}
- recommended_focus: ${runPlan?.recommendedFocus ?? "-"}
- source_mode: ${sourceMode}
- explicit_urls: ${explicitUrls.length}
- effective_urls: ${effectiveUrls.length}
- dry_run: ${dryRun ? "yes" : "no"}
- append_watchlist: ${appendWatchlist ? "yes" : "no"}

## Phase Summary

- default_phases: intake=${runPlan?.defaultPhases?.intake ?? "-"} | re_evaluate=${runPlan?.defaultPhases?.reEvaluate ?? "-"} | review=${runPlan?.defaultPhases?.review ?? "-"} | promote=${runPlan?.defaultPhases?.promote ?? "-"}
- intake_items: ${intakeRun?.items?.length ?? 0}
- re_evaluated_rows: ${reEvaluateRun?.updates?.length ?? 0}
- review_scope: ${reviewRun?.review?.reviewScope ?? "-"}
- review_items: ${reviewRun?.review?.items?.length ?? 0}
- report_path: ${reviewRun?.htmlReportPath ?? "-"}
- browser_link_file: ${reviewRun?.reportPointers ? path.relative(rootDir, reviewRun.reportPointers.browserLinkPath) : "-"}
- latest_report_metadata: ${reviewRun?.reportPointers ? path.relative(rootDir, reviewRun.reportPointers.latestReportPath) : "-"}
- promotion_items: ${promoteRun?.items?.length ?? 0}

## Drift Snapshot

- drift_status: ${runDrift?.driftStatus ?? "-"}
- drift_signals: ${runDrift?.signals?.length ?? 0}
- queue_decision_states: complete=${runDrift?.queueSnapshot?.decisionStateSummary?.complete ?? 0}, fallback=${runDrift?.queueSnapshot?.decisionStateSummary?.fallback ?? 0}, stale=${runDrift?.queueSnapshot?.decisionStateSummary?.stale ?? 0}
- resume_mode: ${runDrift?.resumeGuidance?.mode ?? "-"}
- resume_next_action: ${runDrift?.resumeGuidance?.nextAction ?? "-"}

## Stability Snapshot

- stability_status: ${runStability?.status ?? "-"}
- stable_streak: ${runStability?.stableStreak ?? 0}
- unstable_streak: ${runStability?.unstableStreak ?? 0}
- compared_pairs: ${runStability?.comparedPairs ?? 0}

## Governance Snapshot

- governance_status: ${runGovernance?.status ?? "-"}
- auto_dispatch_allowed: ${runGovernance?.autoDispatchAllowed ? "yes" : "no"}
- auto_apply_allowed: ${runGovernance?.autoApplyAllowed ? "yes" : "no"}
- recommended_promotion_mode: ${runGovernance?.recommendedPromotionMode ?? "-"}
- governance_next_action: ${runGovernance?.nextAction ?? "-"}

## Effective URLs

${effectiveUrls.length > 0 ? effectiveUrls.map((url) => `- ${url}`).join("\n") : "- none"}

## Run Notes

${runPlan?.notes?.length > 0 ? runPlan.notes.map((item) => `- ${item}`).join("\n") : "- No lifecycle notes generated."}

## What Now

${nextActions.length > 0 ? nextActions.map((item) => `- ${item}`).join("\n") : "- No follow-up guidance generated."}
`;
}

export async function runOnDemand(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const explicitUrls = await collectUrls(rootDir, options);
  const sourceMode = explicitUrls.length > 0 ? "explicit_urls" : "watchlist";
  const watchlistUrls = project.watchlistFile
    ? await loadWatchlistUrls(rootDir, project)
    : [];
  const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
    projectKey,
    sourceMode,
    explicitUrlCount: explicitUrls.length,
    watchlistCount: watchlistUrls.length,
    watchlistUrls,
    currentFingerprint: computeRulesFingerprint(alignmentRules)
  });
  const runPlan = diagnostics.lifecycle;
  const runDrift = diagnostics.drift;
  const runStability = diagnostics.stability;
  const runGovernance = buildProjectRunGovernanceSnapshot({
    projectKey,
    lifecycle: runPlan,
    drift: runDrift,
    stability: runStability
  });

  if (sourceMode === "watchlist" && !project.watchlistFile) {
    throw new Error(`Project '${projectKey}' has no watchlistFile configured and no explicit URLs were supplied.`);
  }

  console.log(`# Patternpilot On-Demand`);
  console.log(``);
  console.log(`- project: ${projectKey}`);
  console.log(`- run_kind: ${runPlan.runKind}`);
  console.log(`- recommended_focus: ${runPlan.recommendedFocus}`);
  console.log(`- source_mode: ${sourceMode}`);
  console.log(`- explicit_urls: ${explicitUrls.length}`);
  console.log(`- append_watchlist: ${options.appendWatchlist ? "yes" : "no"}`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- skip_review: ${options.skipReview ? "yes" : "no"}`);
  console.log(`- promotion_mode: ${options.promotionMode ?? "skip"}`);
  console.log(`- drift_status: ${runDrift.driftStatus}`);
  console.log(`- drift_signals: ${runDrift.signals.length}`);
  console.log(`- stability_status: ${runStability.status}`);
  console.log(`- stable_streak: ${runStability.stableStreak}`);
  console.log(`- governance_status: ${runGovernance.status}`);
  console.log(`- auto_dispatch_allowed: ${runGovernance.autoDispatchAllowed ? "yes" : "no"}`);
  console.log(``);

  let effectiveUrls = explicitUrls;
  let watchlistUpdate = null;
  let intakeRun = null;
  let reEvaluateRun = null;
  let reviewRun = null;
  let promoteRun = null;

  if (sourceMode === "explicit_urls") {
    console.log(`## Intake ${projectKey}`);
    intakeRun = await runIntake(rootDir, config, {
      ...options,
      project: projectKey,
      file: null,
      urls: explicitUrls
    });

    if (options.appendWatchlist) {
      watchlistUpdate = await appendUrlsToWatchlist(rootDir, project, explicitUrls, options.dryRun);
      console.log(``);
      console.log(`## Watchlist Update`);
      console.log(`- status: ${watchlistUpdate.status}`);
      console.log(`- appended: ${watchlistUpdate.appended}`);
      console.log(`- kept_existing: ${watchlistUpdate.keptExisting}`);
    }
  } else {
    console.log(`## Watchlist Sync ${projectKey}`);
    intakeRun = await runSyncWatchlist(rootDir, config, {
      ...options,
      project: projectKey
    });
    effectiveUrls = await loadWatchlistUrls(rootDir, project);
  }

  if (effectiveUrls.length === 0) {
    console.log(``);
    console.log(`- status: skipped_no_effective_urls`);
    await refreshContext(rootDir, config, {
      command: "on-demand",
      projectKey,
      mode: options.dryRun ? "dry_run" : "write",
      reportPath: intakeRun?.runDir ? path.relative(rootDir, intakeRun.runDir) : "-"
    });
    return {
      projectKey,
      sourceMode,
      effectiveUrls,
      intakeRun
    };
  }

  console.log(``);
  console.log(`## Re-Evaluate ${projectKey}`);
  reEvaluateRun = await runReEvaluate(rootDir, config, {
    ...options,
    project: projectKey,
    allowedUrls: effectiveUrls,
    limit: options.limit ?? effectiveUrls.length
  });

  if (!options.skipReview) {
    console.log(``);
    console.log(`## Review ${projectKey}`);
    reviewRun = await runReviewWatchlist(rootDir, config, {
      ...options,
      project: projectKey,
      reviewUrls: sourceMode === "explicit_urls" ? effectiveUrls : null,
      outputSlug: "on-demand"
    });
  }

  if ((options.promotionMode === "prepared" || options.promotionMode === "apply") && !options.skipReview) {
    console.log(``);
    console.log(`## Promote ${projectKey}`);
    promoteRun = await runPromote(rootDir, config, {
      ...options,
      project: projectKey,
      urls: effectiveUrls,
      apply: options.promotionMode === "apply"
    });
  }

  const reportPath = reviewRun?.htmlReportPath
    ?? (intakeRun?.runDir ? path.relative(rootDir, intakeRun.runDir) : "-");

  console.log(``);
  console.log(`## On-Demand Result`);
  console.log(`- effective_urls: ${effectiveUrls.length}`);
  console.log(`- intake_items: ${intakeRun?.items?.length ?? 0}`);
  console.log(`- reevaluated_rows: ${reEvaluateRun?.updates?.length ?? 0}`);
  console.log(`- review_items: ${reviewRun?.review?.items?.length ?? 0}`);
  console.log(`- report_path: ${reportPath}`);
  if (reviewRun?.reportPointers) {
    console.log(`- browser_link: ${path.relative(rootDir, reviewRun.reportPointers.browserLinkPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
    console.log(`- latest_report_metadata: ${path.relative(rootDir, reviewRun.reportPointers.latestReportPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  }
  if (promoteRun) {
    console.log(`- promotion_items: ${promoteRun.items.length}`);
  }

  const onDemandRunDir = path.join(rootDir, config.runtimeRoot, projectKey, runId);
  const artifacts = {
    reviewReportHref: reviewRun?.htmlReportPath ? path.relative(onDemandRunDir, path.join(rootDir, reviewRun.htmlReportPath)) : null,
    reviewReportLabel: reviewRun?.htmlReportPath ?? null,
    latestReportHref: reviewRun?.reportPointers ? path.relative(onDemandRunDir, reviewRun.reportPointers.latestReportPath) : null,
    latestReportLabel: reviewRun?.reportPointers ? path.relative(rootDir, reviewRun.reportPointers.latestReportPath) : null,
    browserLinkHref: reviewRun?.reportPointers ? path.relative(onDemandRunDir, reviewRun.reportPointers.browserLinkPath) : null,
    browserLinkLabel: reviewRun?.reportPointers ? path.relative(rootDir, reviewRun.reportPointers.browserLinkPath) : null
  };
  const nextActions = buildOnDemandNextActions({
    dryRun: options.dryRun,
    sourceMode,
    appendWatchlist: options.appendWatchlist,
    runPlan,
    runDrift,
    runStability,
    runGovernance,
    reviewRun,
    promoteRun,
    artifacts
  });
  const summary = buildOnDemandSummary({
    rootDir,
    runId,
    projectKey,
    createdAt,
    runPlan,
    runDrift,
    runStability,
    runGovernance,
    sourceMode,
    explicitUrls,
    effectiveUrls,
    dryRun: options.dryRun,
    appendWatchlist: options.appendWatchlist,
    intakeRun,
    reEvaluateRun,
    reviewRun,
    promoteRun,
    nextActions
  });
  const manifest = {
    runId,
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    runPlan,
    runDrift: {
      driftStatus: runDrift?.driftStatus ?? null,
      signalCount: runDrift?.signals?.length ?? 0,
      signalIds: runDrift?.signals?.map((item) => item.id) ?? [],
      resumeGuidance: runDrift?.resumeGuidance ?? null,
      queueSnapshot: runDrift?.queueSnapshot ?? null
    },
    runStability: {
      status: runStability?.status ?? null,
      stableStreak: runStability?.stableStreak ?? 0,
      unstableStreak: runStability?.unstableStreak ?? 0,
      totalRuns: runStability?.totalRuns ?? 0,
      comparedPairs: runStability?.comparedPairs ?? 0
    },
    runGovernance,
    sourceMode,
    explicitUrls,
    effectiveUrls,
    appendWatchlist: options.appendWatchlist,
    analysisProfile: options.analysisProfile,
    analysisDepth: options.analysisDepth,
    reportView: options.reportView,
    intakeRun: intakeRun ? {
      runId: intakeRun.runId,
      runDir: path.relative(rootDir, intakeRun.runDir),
      items: intakeRun.items.length
    } : null,
    reEvaluateRun: reEvaluateRun ? {
      updates: reEvaluateRun.updates.length,
      targetRows: reEvaluateRun.targetRows
    } : null,
    reviewRun: reviewRun ? {
      runId: reviewRun.runId,
      runDir: path.relative(rootDir, reviewRun.runDir),
      reviewScope: reviewRun.review.reviewScope,
      items: reviewRun.review.items.length,
      htmlReportPath: reviewRun.htmlReportPath,
      browserLinkPath: path.relative(rootDir, reviewRun.reportPointers.browserLinkPath),
      latestReportPath: path.relative(rootDir, reviewRun.reportPointers.latestReportPath)
    } : null,
    promoteRun: promoteRun ? {
      runId: promoteRun.runId,
      runDir: path.relative(rootDir, promoteRun.runDir),
      items: promoteRun.items.length
    } : null,
    artifacts: {
      reviewReportPath: artifacts.reviewReportLabel,
      latestReportPath: artifacts.latestReportLabel,
      browserLinkPath: artifacts.browserLinkLabel
    },
    nextActions
  };
  const onDemandHtml = renderOnDemandRunHtmlReport({
    runId,
    projectKey,
    createdAt,
    runPlan,
    runDrift,
    runStability,
    runGovernance,
    sourceMode,
    explicitUrls,
    effectiveUrls,
    appendWatchlist: options.appendWatchlist,
    dryRun: options.dryRun,
    intakeRun,
    reEvaluateRun,
    reviewRun,
    promoteRun,
    artifacts,
    nextActions
  });
  const writtenOnDemandRunDir = await writeRunArtifacts({
    rootDir,
    config,
    projectKey,
    runId,
    manifest,
    summary,
    projectProfile: null,
    dryRun: options.dryRun,
    extraFiles: [
      {
        name: "summary.html",
        content: `${onDemandHtml}\n`
      }
    ]
  });
  console.log(`- on_demand_run_dir: ${path.relative(rootDir, writtenOnDemandRunDir)}`);
  console.log(`- on_demand_summary_html: ${path.relative(rootDir, path.join(writtenOnDemandRunDir, "summary.html"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (nextActions.length > 0) {
    console.log(``);
    console.log(renderNextCommandSections({
      primary: selectPrimaryNextStep(nextActions),
      additional: nextActions.slice(1)
    }));
  }

  await refreshContext(rootDir, config, {
    command: "on-demand",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath
  });

  return {
    projectKey,
    runPlan,
    runGovernance,
    sourceMode,
    runId,
    effectiveUrls,
    watchlistUpdate,
    intakeRun,
    reEvaluateRun,
    reviewRun,
    promoteRun,
    runDir: writtenOnDemandRunDir
  };
}
