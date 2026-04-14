#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import {
  appendUrlsToWatchlist,
  buildAutomationAlertPayload,
  buildAutomationAlerts,
  buildDiscoveryPolicyCalibrationReport,
  buildDiscoveryPolicyComparisonReport,
  buildDiscoveryPolicyReview,
  buildPolicyWorkbench,
  buildPolicyWorkbenchReview,
  buildPolicySuggestion,
  buildPolicyTrial,
  buildWatchlistReview,
  buildWatchlistReviewReport,
  clearAutomationJobState,
  evaluateAutomationJobs,
  buildPromotionCandidate,
  buildPromotionDocPath,
  buildSetupChecklist,
  buildIntakeDocPath,
  buildLandkarteCandidate,
  buildProjectAlignment,
  buildProjectRelevanceNote,
  collectUrls,
  createRunId,
  discoverGithubCandidates,
  discoverImportedCandidates,
  discoverWorkspaceProjects,
  enrichGithubRepo,
  ensureDirectory,
  guessClassification,
  initializeProjectBinding,
  initializeEnvFiles,
  indexPreloadedCandidates,
  inspectGithubAuth,
  inspectGithubAppAuth,
  findLatestDiscoveryManifest,
  findLatestPolicyWorkbench,
  listDiscoveryManifests,
  loadPolicyWorkbench,
  loadDiscoveryPolicyFromFile,
  loadAutomationJobs,
  loadAutomationJobState,
  listProjectRunHistory,
  loadConfig,
  loadEnvFiles,
  loadWatchlistUrls,
  loadQueueEntries,
  loadProjectAlignmentRules,
  loadProjectDiscoveryPolicy,
  loadPatternpilotRoot,
  loadProjectBinding,
  loadProjectProfile,
  normalizeGithubUrl,
  parseArgs,
  refreshOperationalDocs,
  resolveLearningsPath,
  resolveDecisionsPath,
  resolveAutomationDispatchJob,
  buildProjectRunDrift,
  buildProjectRunLifecycle,
  buildProjectRunGovernance,
  buildProjectRunRequalification,
  buildProjectRunStability,
  buildRunResumeRecommendation,
  renderDiscoveryHtmlReport,
  renderDiscoverySummary,
  renderIntakeDoc,
  renderLearningBlock,
  renderAutomationAlertSummary,
  renderDecisionBlock,
  renderDiscoveryPolicyCalibrationReport,
  renderDiscoveryPolicyComparisonReport,
  renderOnDemandRunHtmlReport,
  renderDiscoveryPolicyReviewSummary,
  renderProjectRunDriftSummary,
  renderProjectRunGovernanceSummary,
  renderProjectRunLifecycleSummary,
  renderProjectRunRequalificationSummary,
  renderProjectRunStabilitySummary,
  renderPolicyWorkbenchSummary,
  renderPolicyWorkbenchReviewSummary,
  buildReplayImportPayloadFromDiscovery,
  findLatestPolicyCycle,
  loadPolicyCycle,
  buildPolicyCuration,
  buildPolicyCurationApplyReview,
  buildPolicyCurationBatchReview,
  selectPolicyHandoffCandidates,
  selectPolicyCurationApplyCandidates,
  selectPolicyCurationBatchCandidates,
  renderPolicyCurationSummary,
  renderPolicyCurationApplyReviewSummary,
  renderPolicyCurationBatchPlanSummary,
  renderPolicyCurationBatchReviewSummary,
  renderPolicyHandoffSummary,
  renderPolicyCycleSummary,
  renderPolicySuggestionSummary,
  renderPolicyTrialSummary,
  renderPromotionPacket,
  renderRunSummary,
  renderAutomationJobsSummary,
  renderWatchlistReviewHtmlReport,
  reEvaluateQueueEntries,
  runGithubDoctor,
  upsertQueueEntry,
  upsertLandkarteEntry,
  upsertManagedMarkdownBlock,
  updateAutomationJobState,
  applyProjectPolicy,
  selectNextDispatchableAutomationJob,
  writeIntakeDoc,
  writeAutomationAlertArtifacts,
  writeAutomationJobState,
  writeLatestReportPointers,
  writePromotionPacket,
  writeRunArtifacts,
  runShellCommand
} from "../lib/index.mjs";
import { classifyReviewItemState } from "../lib/review.mjs";
import {
  buildCandidateEvaluation,
  deriveDisposition,
  computeRulesFingerprint
} from "../lib/classification.mjs";
import {
  acquireAutomationLock,
  buildAutomationOpsReport,
  classifyAutomationFailure,
  createAutomationProjectRun,
  finalizeAutomationProjectRun,
  releaseAutomationLock,
  renderAutomationRunSummary,
  selectAutomationDiscoveryCandidates,
  setAutomationPhase,
  summarizeAutomationProjects
} from "../lib/automation.mjs";

function printHelp() {
  console.log(`Patternpilot CLI

Commands:
  on-demand     Run the primary manual flow for one project in a single step
  policy-audit  Run discovery with project policy in audit mode for calibration
  policy-calibrate Aggregate saved discovery runs into a project-wide policy calibration report
  policy-compare Compare the current discovery policy with an alternate policy file
  policy-pack   Write a bundled discovery-policy calibration packet for one project
  policy-review Re-evaluate a saved discovery run against the current project policy
  policy-workbench Write a candidate-level calibration workbench from a saved discovery run
  policy-workbench-review Summarize manual verdicts and proposed-policy impact from a workbench
  policy-suggest Derive a suggested policy variant from a workbench and compare it to the source run
  policy-trial Simulate a trial policy against the workbench source run and emit a candidate-level before/after matrix
  policy-cycle Run review -> suggest -> trial -> replay as one calibration loop and optionally apply the result
  policy-handoff Send selected policy-cycle candidates into the normal on-demand intake/review path
  policy-curate Rank handoff candidates for curation and optionally prepare promotion packets
  policy-curation-review Preview which curated candidates would touch canonical knowledge artifacts
  policy-curation-apply Apply selected curated candidates into canonical knowledge artifacts
  policy-curation-batch-review Review multiple curated candidates together before batch apply
  policy-curation-batch-plan Build a governance plan with safe sub-batches and manual-review cases
  policy-curation-batch-apply Apply the safe curated batch while skipping already promoted and high-risk candidates
  run-plan      Classify the next run as first, follow-up, or maintenance and show the default phase shape
  run-drift     Inspect multi-run drift, queue staleness and resume guidance for one project
  run-stability Inspect recent lifecycle-relevant runs for stable/unstable streaks across multiple loops
  run-governance Evaluate whether the next project run is manual-only, limited unattended, or fully unattended-ready
  run-requalify Inspect whether a latched manual requalification can be cleared after stable follow-up loops
  policy-apply Apply a proposed policy file back to the project with history snapshots
  automation-dispatch Run the next ready automation job or a selected one
  automation-jobs Show scheduler readiness for configured automation jobs
  automation-run  Run discover -> intake -> review and optionally promote
  doctor        Show GitHub auth, rate-limit and workspace readiness
  discover      Search GitHub heuristically for project-fit repos before intake
  discover-import Build a discovery run from an imported candidate JSON fixture
  init-project  Bind a new local repo/workspace project to Patternpilot
  init-env      Create local env files from checked-in examples
  discover-workspace  Scan workspace roots for git repos and binding candidates
  list-projects Show configured Patternpilot project bindings
  intake        Create intake queue entries and dossiers from GitHub URLs
  promote       Prepare or apply promotion candidates from queue to curated artifacts
  re-evaluate   Refresh stale or fallback decision data in queue and intake docs
  refresh-context  Refresh STATUS.md and OPEN_QUESTION.md
  review-watchlist  Compare watchlist-backed intake repos against the target project
  setup-checklist  Show exactly which secrets or IDs are still needed and where to find them
  sync-all-watchlists  Run watchlist intake across all configured projects
  sync-watchlist  Run intake against the configured project watchlist file
  show-project  Show the binding and reference context for a project
  automation-alerts Show blocked/backoff automation jobs and recommended next action
  automation-job-clear Clear scheduler state for a named automation job

Examples:
  npm run analyze -- --project eventbear-worker https://github.com/City-Bureau/city-scrapers
  npm run patternpilot -- policy-audit --project eventbear-worker --dry-run
  npm run patternpilot -- policy-calibrate --project eventbear-worker
  npm run patternpilot -- policy-compare --project eventbear-worker --policy-file projects/eventbear-worker/DISCOVERY_POLICY.json
  npm run patternpilot -- policy-pack --project eventbear-worker --policy-file projects/eventbear-worker/DISCOVERY_POLICY.json
  npm run patternpilot -- policy-review --project eventbear-worker
  npm run patternpilot -- policy-workbench --project eventbear-worker
  npm run patternpilot -- policy-workbench-review --project eventbear-worker
  npm run patternpilot -- policy-suggest --project eventbear-worker
  npm run patternpilot -- policy-trial --project eventbear-worker
  npm run patternpilot -- policy-cycle --project eventbear-worker
  npm run patternpilot -- policy-handoff --project eventbear-worker
  npm run patternpilot -- policy-curate --project eventbear-worker --prepare-promotions
  npm run patternpilot -- policy-curation-review --project eventbear-worker --limit 1
  npm run patternpilot -- policy-curation-apply --project eventbear-worker --limit 1
  npm run patternpilot -- policy-curation-batch-review --project eventbear-worker --limit 2
  npm run patternpilot -- policy-curation-batch-plan --project eventbear-worker --limit 3
  npm run patternpilot -- policy-curation-batch-apply --project eventbear-worker --limit 2
  npm run patternpilot -- run-plan --project eventbear-worker
  npm run patternpilot -- run-drift --project eventbear-worker
  npm run patternpilot -- run-stability --project eventbear-worker
  npm run patternpilot -- run-governance --project eventbear-worker
  npm run patternpilot -- run-requalify --project eventbear-worker --scope automation
  npm run patternpilot -- policy-apply --project eventbear-worker --policy-file projects/eventbear-worker/calibration/workbench/<id>/proposed-policy.json
  npm run patternpilot -- on-demand --project eventbear-worker --analysis-profile architecture
  npm run patternpilot -- automation-jobs
  npm run patternpilot -- automation-dispatch --dry-run
  npm run patternpilot -- automation-alerts
  npm run patternpilot -- automation-job-clear --automation-job eventbear-worker-apply
  npm run automation:run -- --all-projects --promotion-mode prepared --dry-run
  npm run automation:run -- --project eventbear-worker --automation-job eventbear-worker-apply --automation-min-confidence medium --automation-max-new-candidates 5 --automation-re-evaluate-limit 20
  npm run automation:run -- --all-projects --automation-job all-project-watchlists --promotion-mode prepared --automation-continue-on-project-error --automation-lock-timeout-minutes 180
  npm run doctor -- --offline
  npm run patternpilot -- discover --project eventbear-worker --discovery-profile balanced --report-view standard --dry-run
  npm run patternpilot -- discover-import --project eventbear-worker --file projects/eventbear-worker/calibration/discovery-candidates.example.json --dry-run
  npm run patternpilot -- discover --project eventbear-worker --discovery-policy-mode audit --dry-run
  npm run patternpilot -- policy-calibrate --project eventbear-worker --limit 5
  npm run patternpilot -- policy-review --project eventbear-worker --run-id 2026-04-13T14-11-11-441Z
  npm run patternpilot -- discover --project eventbear-worker --query "scraper calendar venue" --intake
  npm run patternpilot -- refresh-context
  npm run patternpilot -- re-evaluate --project eventbear-worker --stale-only
  npm run patternpilot -- review-watchlist --project eventbear-worker --analysis-profile architecture --analysis-depth deep --report-view full
  npm run init:env
  npm run init:project -- --project sample-worker --target ../sample-worker --label "Sample Worker"
  npm run discover:workspace
  npm run setup:checklist
  npm run sync:all -- --dry-run
  npm run patternpilot -- sync-watchlist --project eventbear-worker --dry-run
  npm run intake -- --project eventbear-worker https://github.com/City-Bureau/city-scrapers
  npm run intake -- --project eventbear-worker --file links.txt --dry-run
  npm run intake -- --project eventbear-worker --skip-enrich https://github.com/City-Bureau/city-scrapers
  npm run patternpilot -- promote --project eventbear-worker --from-status pending_review
  npm run patternpilot -- promote --project eventbear-worker --apply --from-status pending_review
  npm run show:project -- --project eventbear-worker
`);
}

async function refreshContext(rootDir, config, context) {
  await refreshOperationalDocs(rootDir, config, context);
}

async function runIntake(rootDir, config, options) {
  if (process.env.PATTERNPILOT_DEBUG === "1") {
    console.error(`[patternpilot-debug] rootDir=${rootDir}`);
    console.error(`[patternpilot-debug] githubConfig=${JSON.stringify(config.github ?? {})}`);
  }
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);
  const urls = await collectUrls(rootDir, options);
  if (urls.length === 0) {
    throw new Error("No GitHub URLs supplied. Pass URLs directly or via --file.");
  }

  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const items = [];
  const preloadedCandidates = indexPreloadedCandidates(options.preloadedCandidates ?? []);

  await ensureDirectory(path.join(rootDir, project.intakeRoot), options.dryRun);

  for (const rawUrl of urls) {
    const repo = normalizeGithubUrl(rawUrl);
    const preloadedCandidate = preloadedCandidates.get(repo.normalizedRepoUrl) ?? null;
    let enrichment;
    if (preloadedCandidate) {
      enrichment = preloadedCandidate.enrichment ?? {
        status: "success",
        repo: {}
      };
    } else {
      enrichment = await enrichGithubRepo(repo, config, {
        skipEnrich: options.skipEnrich
      });
      if (!options.skipEnrich && enrichment.status === "failed") {
        enrichment = await enrichGithubRepo(repo, config, {
          skipEnrich: false
        });
      }
    }
    if (process.env.PATTERNPILOT_DEBUG === "1") {
      console.error(
        `[patternpilot-debug] enrichment ${repo.owner}/${repo.name}: ${JSON.stringify(enrichment)}`
      );
    }
    const guess = preloadedCandidate?.guess ?? guessClassification(repo, enrichment);
    const landkarteCandidate =
      preloadedCandidate?.landkarteCandidate ?? buildLandkarteCandidate(repo, guess, enrichment);
    const projectAlignment = preloadedCandidate?.projectAlignment ?? buildProjectAlignment(
      repo,
      guess,
      enrichment,
      projectProfile,
      alignmentRules
    );
    const evaluation = buildCandidateEvaluation(
      repo,
      guess,
      enrichment,
      projectAlignment,
      alignmentRules
    );
    const rulesFingerprint = computeRulesFingerprint(alignmentRules);
    const risks = String(landkarteCandidate.risks ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    const disposition = deriveDisposition(
      evaluation,
      risks,
      projectAlignment.fitBand
    );
    const decisionFields = {
      effortBand: evaluation.effortBand,
      effortScore: evaluation.effortScore,
      valueBand: evaluation.valueBand,
      valueScore: evaluation.valueScore,
      reviewDisposition: disposition.disposition,
      rulesFingerprint,
      decisionSummary: evaluation.decisionSummary,
      effortReasons: evaluation.effortReasons,
      valueReasons: evaluation.valueReasons,
      dispositionReason: disposition.dispositionReason
    };
    const intakeDocPath = buildIntakeDocPath(rootDir, project, repo);
    const intakeDocRelativePath = path.relative(rootDir, intakeDocPath);
    const projectRoot = path.resolve(rootDir, binding.projectRoot);
    const projectLabel = binding.projectLabel ?? binding.projectKey;
    const projectRelevanceNote = buildProjectRelevanceNote(binding, guess);

    const queueEntry = {
      intake_id: `${runId}__${repo.slug}`,
      project_key: projectKey,
      status: "pending_review",
      created_at: createdAt,
      updated_at: createdAt,
      last_api_sync_at: enrichment.fetchedAt ?? "",
      enrichment_status: enrichment.status ?? "unknown",
      alignment_status: projectAlignment.status,
      project_fit_band: projectAlignment.fitBand,
      project_fit_score: String(projectAlignment.fitScore),
      effort_band: decisionFields.effortBand,
      effort_score: String(decisionFields.effortScore),
      value_band: decisionFields.valueBand,
      value_score: String(decisionFields.valueScore),
      review_disposition: decisionFields.reviewDisposition,
      rules_fingerprint: decisionFields.rulesFingerprint,
      decision_summary: decisionFields.decisionSummary,
      effort_reasons: decisionFields.effortReasons.join(","),
      value_reasons: decisionFields.valueReasons.join(","),
      disposition_reason: decisionFields.dispositionReason,
      matched_capabilities: projectAlignment.matchedCapabilities.join(","),
      recommended_worker_areas: projectAlignment.recommendedWorkerAreas.join(","),
      suggested_next_step: projectAlignment.suggestedNextStep,
      repo_url: rawUrl,
      normalized_repo_url: repo.normalizedRepoUrl,
      owner: repo.owner,
      name: repo.name,
      host: repo.host,
      description: enrichment.repo?.description ?? "",
      stars: String(enrichment.repo?.stars ?? ""),
      primary_language: enrichment.repo?.language ?? "",
      topics: (enrichment.repo?.topics ?? []).join(","),
      default_branch: enrichment.repo?.defaultBranch ?? "",
      license: enrichment.repo?.license ?? "",
      pushed_at: enrichment.repo?.pushedAt ?? "",
      archived: enrichment.repo?.archived ? "yes" : "no",
      homepage: enrichment.repo?.homepage ?? "",
      category_guess: guess.category,
      pattern_family_guess: guess.patternFamily,
      main_layer_guess: guess.mainLayer,
      eventbaer_gap_area_guess: guess.gapArea,
      build_vs_borrow_guess: guess.buildVsBorrow,
      priority_guess: guess.priority,
      secondary_layers: landkarteCandidate.secondary_layers,
      source_focus: landkarteCandidate.source_focus,
      geographic_model: landkarteCandidate.geographic_model,
      data_model: landkarteCandidate.data_model,
      distribution_type: landkarteCandidate.distribution_type,
      activity_status: landkarteCandidate.activity_status,
      maturity: landkarteCandidate.maturity,
      strengths: landkarteCandidate.strengths,
      weaknesses: landkarteCandidate.weaknesses,
      risks: landkarteCandidate.risks,
      learning_for_eventbaer: landkarteCandidate.learning_for_eventbaer,
      possible_implication: landkarteCandidate.possible_implication,
      decision_guess: landkarteCandidate.decision,
      eventbaer_relevance_guess: landkarteCandidate.eventbaer_relevance,
      project_relevance_note: projectRelevanceNote,
      intake_doc: intakeDocRelativePath,
      run_id: runId,
      notes: preloadedCandidate
        ? [options.notes, "preloaded_candidate_seed"].filter(Boolean).join(" | ")
        : options.notes
    };

    if (!options.dryRun) {
      await upsertQueueEntry(rootDir, config, queueEntry);
    }

    const intakeDoc = renderIntakeDoc({
      repo,
      guess,
      enrichment,
      landkarteCandidate,
      projectAlignment,
      projectProfile,
      binding,
      projectLabel,
      repoRoot: projectRoot,
      createdAt,
      notes: options.notes,
      candidate: decisionFields
    });
    const docWrite = await writeIntakeDoc({
      intakeDocPath,
      content: intakeDoc,
      dryRun: options.dryRun,
      force: options.force
    });

    items.push({
      repo,
      guess,
      enrichment,
      landkarteCandidate,
      candidate: decisionFields,
      projectAlignment,
      action: options.dryRun ? "planned" : docWrite.created ? "created_or_updated" : "reused_existing_doc",
      intakeDocRelativePath
    });
  }

  const summary = renderRunSummary({
    runId,
    projectKey,
    createdAt,
    items,
    dryRun: options.dryRun
  });
  const manifest = {
    command: "on-demand",
    runId,
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    notes: options.notes,
    items: items.map((item) => ({
      repo: item.repo,
      guess: item.guess,
      enrichment: item.enrichment,
      landkarteCandidate: item.landkarteCandidate,
      candidate: item.candidate,
      projectAlignment: item.projectAlignment,
      intakeDoc: item.intakeDocRelativePath,
      action: item.action
    }))
  };
  const runDir = await writeRunArtifacts({
    rootDir,
    config,
    projectKey,
    runId,
    manifest,
    summary,
    projectProfile,
    dryRun: options.dryRun
  });

  console.log(summary);
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);
  if (options.dryRun) {
    console.log("Dry run only: queue and files were not written.");
  }
  await refreshContext(rootDir, config, {
    command: "intake",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, runDir)
  });

  return { runId, projectKey, createdAt, items, runDir };
}

async function runDiscover(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const commandName = options.commandName ?? "discover";
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);
  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const discovery = await discoverGithubCandidates(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    {
      ...options,
      discoveryPolicy
    }
  );
  const summary = renderDiscoverySummary({
    runId,
    projectKey,
    createdAt,
    discovery,
    dryRun: options.dryRun
  });
  const policyCalibrationMarkdown = [
    "# Discovery Policy Calibration",
    "",
    `- project: ${projectKey}`,
    `- created_at: ${createdAt}`,
    `- mode: ${discovery.policySummary?.mode ?? "off"}`,
    `- calibration_status: ${discovery.policyCalibration?.status ?? "unknown"}`,
    "",
    "## Top Blockers",
    "",
    (discovery.policyCalibration?.topBlockers?.length ?? 0) > 0
      ? discovery.policyCalibration.topBlockers.map((item) => `- ${item.value}: ${item.count}`).join("\n")
      : "- none",
    "",
    "## Calibration Hints",
    "",
    (discovery.policyCalibration?.recommendations?.length ?? 0) > 0
      ? discovery.policyCalibration.recommendations.map((item) => `- ${item}`).join("\n")
      : "- none",
    ""
  ].join("\n");
  const htmlReport = renderDiscoveryHtmlReport({
    projectKey,
    createdAt,
    discovery,
    projectProfile,
    binding,
    reportView: options.reportView
  });
  const dateStr = createdAt.slice(0, 10);
  const projectReportPath = path.join(
    rootDir,
    "projects",
    binding.projectKey,
    "reports",
    `patternpilot-report-${binding.projectKey}-${dateStr}.html`
  );
  const projectReportRelativePath = path.relative(rootDir, projectReportPath);
  const manifest = {
    runId,
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    query: options.query,
    intake: options.intake,
    appendWatchlist: options.appendWatchlist,
    reportView: options.reportView,
    htmlReportPath: projectReportRelativePath,
    discovery
  };
  const runDir = await writeRunArtifacts({
    rootDir,
    config,
    projectKey,
    runId,
    manifest,
    summary,
    projectProfile,
    dryRun: options.dryRun,
    extraFiles: [
      {
        name: "policy-calibration.md",
        content: policyCalibrationMarkdown
      }
    ]
  });
  const runHtmlPath = path.join(runDir, `patternpilot-report-${projectKey}-${dateStr}.html`);

  if (!options.dryRun) {
    await ensureDirectory(path.dirname(projectReportPath), false);
    await fs.writeFile(projectReportPath, `${htmlReport}\n`, "utf8");
    await fs.writeFile(runHtmlPath, `${htmlReport}\n`, "utf8");
  }

  const reportPointers = await writeLatestReportPointers({
    rootDir,
    projectKey,
    reportPath: projectReportPath,
    createdAt,
    runId,
    command: commandName,
    reportKind: "discovery",
    dryRun: options.dryRun
  });

  console.log(summary);
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);
  console.log(`Policy calibration: ${path.relative(rootDir, path.join(runDir, "policy-calibration.md"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`HTML report: ${projectReportRelativePath}`);
  console.log(`Browser link: ${path.relative(rootDir, reportPointers.browserLinkPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`Latest report metadata: ${path.relative(rootDir, reportPointers.latestReportPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  const candidateUrls = discovery.candidates.map((candidate) => candidate.repo.normalizedRepoUrl);
  if (options.appendWatchlist) {
    const watchlistResult = await appendUrlsToWatchlist(
      rootDir,
      project,
      candidateUrls,
      options.dryRun
    );
    console.log(``);
    console.log(`## Watchlist Update`);
    console.log(`- status: ${watchlistResult.status}`);
    console.log(`- appended: ${watchlistResult.appended}`);
    console.log(`- kept_existing: ${watchlistResult.keptExisting}`);
  }

  if (options.intake) {
    if (candidateUrls.length === 0) {
      console.log(``);
      console.log(`## Intake Handoff`);
      console.log(`- status: skipped_no_candidates`);
      return;
    }
    console.log(``);
    console.log(`## Intake Handoff`);
    await runIntake(rootDir, config, {
      ...options,
      file: null,
      urls: candidateUrls,
      notes: options.notes
        ? `auto-discovered | ${options.notes}`
        : "auto-discovered via patternpilot discovery"
    });
  }
  await refreshContext(rootDir, config, {
    command: commandName,
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: projectReportRelativePath
  });

  return {
    runId,
    projectKey,
    createdAt,
    discovery,
    runDir,
    htmlReportPath: projectReportRelativePath,
    candidateUrls
  };
}

async function runDiscoverImport(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  if (!options.file) {
    throw new Error("discover-import requires --file <candidate-json>.");
  }
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);
  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const dateStr = createdAt.slice(0, 10);
  const rawImport = await fs.readFile(path.resolve(rootDir, options.file), "utf8");
  const importPayload = JSON.parse(rawImport);
  const discovery = await discoverImportedCandidates(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    importPayload,
    {
      ...options,
      discoveryPolicy
    }
  );
  const summary = renderDiscoverySummary({
    runId,
    projectKey,
    createdAt,
    discovery,
    dryRun: options.dryRun
  });
  const policyCalibrationMarkdown = [
    "# Discovery Policy Calibration",
    "",
    `- project: ${projectKey}`,
    `- created_at: ${createdAt}`,
    `- mode: ${discovery.policySummary?.mode ?? "off"}`,
    `- calibration_status: ${discovery.policyCalibration?.status ?? "unknown"}`,
    `- imported: yes`,
    `- import_source: ${options.file}`,
    "",
    "## Top Blockers",
    "",
    (discovery.policyCalibration?.topBlockers?.length ?? 0) > 0
      ? discovery.policyCalibration.topBlockers.map((item) => `- ${item.value}: ${item.count}`).join("\n")
      : "- none",
    "",
    "## Calibration Hints",
    "",
    (discovery.policyCalibration?.recommendations?.length ?? 0) > 0
      ? discovery.policyCalibration.recommendations.map((item) => `- ${item}`).join("\n")
      : "- none",
    ""
  ].join("\n");
  const htmlReport = renderDiscoveryHtmlReport({
    projectKey,
    createdAt,
    discovery,
    projectProfile,
    binding,
    reportView: options.reportView
  });
  const projectReportPath = path.join(
    rootDir,
    "projects",
    binding.projectKey,
    "reports",
    `patternpilot-report-${binding.projectKey}-${dateStr}-imported.html`
  );
  const projectReportRelativePath = path.relative(rootDir, projectReportPath);
  const manifest = {
    runId,
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    imported: true,
    importPath: options.file,
    reportView: options.reportView,
    htmlReportPath: projectReportRelativePath,
    discovery
  };
  const runDir = await writeRunArtifacts({
    rootDir,
    config,
    projectKey,
    runId,
    manifest,
    summary,
    projectProfile,
    dryRun: options.dryRun,
    extraFiles: [
      {
        name: "policy-calibration.md",
        content: policyCalibrationMarkdown
      }
    ]
  });
  const runHtmlPath = path.join(runDir, `patternpilot-report-${projectKey}-${dateStr}-imported.html`);

  if (!options.dryRun) {
    await ensureDirectory(path.dirname(projectReportPath), false);
    await fs.writeFile(projectReportPath, `${htmlReport}\n`, "utf8");
    await fs.writeFile(runHtmlPath, `${htmlReport}\n`, "utf8");
  }

  const reportPointers = await writeLatestReportPointers({
    rootDir,
    projectKey,
    reportPath: projectReportPath,
    createdAt,
    runId,
    command: "discover-import",
    reportKind: "discovery",
    dryRun: options.dryRun
  });

  console.log(summary);
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);
  console.log(`Policy calibration: ${path.relative(rootDir, path.join(runDir, "policy-calibration.md"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`HTML report: ${projectReportRelativePath}`);
  console.log(`Browser link: ${path.relative(rootDir, reportPointers.browserLinkPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`Latest report metadata: ${path.relative(rootDir, reportPointers.latestReportPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "discover-import",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: projectReportRelativePath
  });

  return {
    runId,
    projectKey,
    createdAt,
    discovery,
    runDir,
    htmlReportPath: projectReportRelativePath
  };
}

async function runReviewWatchlist(rootDir, config, options) {
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

async function runPolicyReview(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);

  let manifestRecord;
  if (options.manifest) {
    const manifestPath = path.resolve(rootDir, options.manifest);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (!manifest.discovery) {
      throw new Error(`Manifest '${options.manifest}' does not contain a discovery payload.`);
    }
    manifestRecord = {
      runId: manifest.runId ?? path.basename(path.dirname(manifestPath)),
      manifestPath,
      relativeManifestPath: path.relative(rootDir, manifestPath),
      manifest
    };
  } else {
    manifestRecord = await findLatestDiscoveryManifest(rootDir, config, projectKey, options.runId, {
      preferCandidates: true
    });
    if (!manifestRecord) {
      throw new Error(`No discovery run manifest found for project '${projectKey}'.`);
    }
  }

  const review = buildDiscoveryPolicyReview(manifestRecord.manifest.discovery, discoveryPolicy);
  const summary = renderDiscoveryPolicyReviewSummary({
    projectKey,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    review
  });
  const reviewJson = {
    schemaVersion: 1,
    projectKey,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    reviewedAt: new Date().toISOString(),
    review
  };
  const sourceRunDir = path.dirname(manifestRecord.manifestPath);
  const markdownPath = path.join(sourceRunDir, "policy-review-current.md");
  const jsonPath = path.join(sourceRunDir, "policy-review-current.json");

  if (!options.dryRun) {
    await fs.writeFile(markdownPath, `${summary}\n`, "utf8");
    await fs.writeFile(jsonPath, `${JSON.stringify(reviewJson, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- source_manifest: ${manifestRecord.relativeManifestPath}`);
  console.log(`- policy_review_markdown: ${path.relative(rootDir, markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- policy_review_json: ${path.relative(rootDir, jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-review",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: manifestRecord.relativeManifestPath
  });

  return {
    projectKey,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    review
  };
}

async function runPolicyCompare(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  if (!options.policyFile) {
    throw new Error("policy-compare requires --policy-file <relative-or-absolute-json-path>.");
  }
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const baselinePolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const candidatePolicy = await loadDiscoveryPolicyFromFile(rootDir, projectKey, options.policyFile);
  const manifests = await listDiscoveryManifests(rootDir, config, projectKey);
  const limitedManifests = options.limit ? manifests.slice(0, Math.max(1, options.limit)) : manifests;
  const report = buildDiscoveryPolicyComparisonReport(limitedManifests, baselinePolicy, candidatePolicy);
  const generatedAt = new Date().toISOString();
  const runId = createRunId(new Date(generatedAt));
  const markdown = renderDiscoveryPolicyComparisonReport({
    projectKey,
    generatedAt,
    limit: options.limit,
    candidatePolicyPath: options.policyFile,
    report
  });
  const jsonPayload = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    candidatePolicyPath: options.policyFile,
    limit: options.limit ?? null,
    reviewedManifestCount: limitedManifests.length,
    report
  };

  const calibrationDir = path.join(rootDir, "projects", projectKey, "calibration");
  const datedMarkdownPath = path.join(calibrationDir, `discovery-policy-compare-${runId}.md`);
  const datedJsonPath = path.join(calibrationDir, `discovery-policy-compare-${runId}.json`);
  const latestMarkdownPath = path.join(calibrationDir, "latest-discovery-policy-compare.md");
  const latestJsonPath = path.join(calibrationDir, "latest-discovery-policy-compare.json");

  if (!options.dryRun) {
    await ensureDirectory(calibrationDir, false);
    await fs.writeFile(datedMarkdownPath, `${markdown}\n`, "utf8");
    await fs.writeFile(datedJsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
    await fs.writeFile(latestMarkdownPath, `${markdown}\n`, "utf8");
    await fs.writeFile(latestJsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
  }

  console.log(markdown);
  console.log(`- comparison_markdown: ${path.relative(rootDir, datedMarkdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- comparison_json: ${path.relative(rootDir, datedJsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- comparison_latest_markdown: ${path.relative(rootDir, latestMarkdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- comparison_latest_json: ${path.relative(rootDir, latestJsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-compare",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, datedMarkdownPath)
  });

  return {
    projectKey,
    generatedAt,
    report
  };
}

async function runPolicyCalibrate(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const manifests = await listDiscoveryManifests(rootDir, config, projectKey);
  const limitedManifests = options.limit ? manifests.slice(0, Math.max(1, options.limit)) : manifests;
  const report = buildDiscoveryPolicyCalibrationReport(limitedManifests, discoveryPolicy);
  const generatedAt = new Date().toISOString();
  const runId = createRunId(new Date(generatedAt));
  const markdown = renderDiscoveryPolicyCalibrationReport({
    projectKey,
    generatedAt,
    limit: options.limit,
    report
  });
  const jsonPayload = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    limit: options.limit ?? null,
    reviewedManifestCount: limitedManifests.length,
    report
  };

  const calibrationDir = path.join(rootDir, "projects", projectKey, "calibration");
  const datedMarkdownPath = path.join(calibrationDir, `discovery-policy-calibration-${runId}.md`);
  const datedJsonPath = path.join(calibrationDir, `discovery-policy-calibration-${runId}.json`);
  const latestMarkdownPath = path.join(calibrationDir, "latest-discovery-policy-calibration.md");
  const latestJsonPath = path.join(calibrationDir, "latest-discovery-policy-calibration.json");

  if (!options.dryRun) {
    await ensureDirectory(calibrationDir, false);
    await fs.writeFile(datedMarkdownPath, `${markdown}\n`, "utf8");
    await fs.writeFile(datedJsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
    await fs.writeFile(latestMarkdownPath, `${markdown}\n`, "utf8");
    await fs.writeFile(latestJsonPath, `${JSON.stringify(jsonPayload, null, 2)}\n`, "utf8");
  }

  console.log(markdown);
  console.log(`- calibration_markdown: ${path.relative(rootDir, datedMarkdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- calibration_json: ${path.relative(rootDir, datedJsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- calibration_latest_markdown: ${path.relative(rootDir, latestMarkdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- calibration_latest_json: ${path.relative(rootDir, latestJsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-calibrate",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, datedMarkdownPath)
  });

  return {
    projectKey,
    generatedAt,
    report
  };
}

async function runPolicyPack(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const generatedAt = new Date().toISOString();
  const packetId = createRunId(new Date(generatedAt));

  let manifestRecord;
  if (options.manifest) {
    const manifestPath = path.resolve(rootDir, options.manifest);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (!manifest.discovery) {
      throw new Error(`Manifest '${options.manifest}' does not contain a discovery payload.`);
    }
    manifestRecord = {
      runId: manifest.runId ?? path.basename(path.dirname(manifestPath)),
      manifestPath,
      relativeManifestPath: path.relative(rootDir, manifestPath),
      manifest
    };
  } else {
    manifestRecord = await findLatestDiscoveryManifest(rootDir, config, projectKey, options.runId, {
      preferCandidates: true
    });
  }

  const manifests = await listDiscoveryManifests(rootDir, config, projectKey);
  const limitedManifests = options.limit ? manifests.slice(0, Math.max(1, options.limit)) : manifests;
  const calibrationReport = buildDiscoveryPolicyCalibrationReport(limitedManifests, discoveryPolicy);
  const calibrationMarkdown = renderDiscoveryPolicyCalibrationReport({
    projectKey,
    generatedAt,
    limit: options.limit,
    report: calibrationReport
  });

  let latestReview = null;
  let latestReviewMarkdown = null;
  if (manifestRecord) {
    latestReview = buildDiscoveryPolicyReview(manifestRecord.manifest.discovery, discoveryPolicy);
    latestReviewMarkdown = renderDiscoveryPolicyReviewSummary({
      projectKey,
      sourceRunId: manifestRecord.runId,
      sourceManifestPath: manifestRecord.relativeManifestPath,
      review: latestReview
    });
  }

  let comparisonReport = null;
  let comparisonMarkdown = null;
  if (options.policyFile) {
    const candidatePolicy = await loadDiscoveryPolicyFromFile(rootDir, projectKey, options.policyFile);
    comparisonReport = buildDiscoveryPolicyComparisonReport(limitedManifests, discoveryPolicy, candidatePolicy);
    comparisonMarkdown = renderDiscoveryPolicyComparisonReport({
      projectKey,
      generatedAt,
      limit: options.limit,
      candidatePolicyPath: options.policyFile,
      report: comparisonReport
    });
  }

  const summaryMarkdown = [
    "# Patternpilot Discovery Policy Packet",
    "",
    `- project: ${projectKey}`,
    `- generated_at: ${generatedAt}`,
    `- packet_id: ${packetId}`,
    `- reviewed_manifests: ${limitedManifests.length}`,
    `- source_run: ${manifestRecord?.runId ?? "-"}`,
    `- source_manifest: ${manifestRecord?.relativeManifestPath ?? "-"}`,
    `- comparison_policy: ${options.policyFile ?? "-"}`,
    "",
    "## Current Calibration Snapshot",
    "",
    `- runs_with_candidates: ${calibrationReport.runsWithCandidates}`,
    `- source_candidates: ${calibrationReport.sourceCandidates}`,
    `- audit_flagged: ${calibrationReport.auditFlagged}`,
    `- enforce_hidden: ${calibrationReport.enforceHidden}`,
    `- preferred_hits: ${calibrationReport.preferredHits}`,
    "",
    "## Next Loop",
    "",
    ...(calibrationReport.recommendations.length > 0
      ? calibrationReport.recommendations.map((item) => `- ${item}`)
      : ["- none"]),
    ...(comparisonReport?.recommendations?.length
      ? ["", "## Comparison Hints", "", ...comparisonReport.recommendations.map((item) => `- ${item}`)]
      : []),
    ""
  ].join("\n");

  const packetDir = path.join(rootDir, "projects", projectKey, "calibration", "packets", packetId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");
  const packetManifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    packetId,
    reviewedManifestCount: limitedManifests.length,
    sourceRunId: manifestRecord?.runId ?? null,
    sourceManifestPath: manifestRecord?.relativeManifestPath ?? null,
    comparisonPolicyPath: options.policyFile ?? null,
    calibrationReport,
    latestReview,
    comparisonReport
  };

  if (!options.dryRun) {
    await ensureDirectory(packetDir, false);
    await fs.writeFile(path.join(packetDir, "summary.md"), `${summaryMarkdown}\n`, "utf8");
    await fs.writeFile(path.join(packetDir, "manifest.json"), `${JSON.stringify(packetManifest, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(packetDir, "current-policy.json"), `${JSON.stringify(discoveryPolicy, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(packetDir, "current-calibration.md"), `${calibrationMarkdown}\n`, "utf8");
    await fs.writeFile(path.join(packetDir, "current-calibration.json"), `${JSON.stringify(calibrationReport, null, 2)}\n`, "utf8");
    if (latestReview && latestReviewMarkdown) {
      await fs.writeFile(path.join(packetDir, "latest-review.md"), `${latestReviewMarkdown}\n`, "utf8");
      await fs.writeFile(path.join(packetDir, "latest-review.json"), `${JSON.stringify(latestReview, null, 2)}\n`, "utf8");
    }
    if (comparisonReport && comparisonMarkdown) {
      await fs.writeFile(path.join(packetDir, "policy-compare.md"), `${comparisonMarkdown}\n`, "utf8");
      await fs.writeFile(path.join(packetDir, "policy-compare.json"), `${JSON.stringify(comparisonReport, null, 2)}\n`, "utf8");
    }
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-packets",
      sectionTitle: "Discovery Policy Packets",
      blockKey: packetId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- packet_dir: ${path.relative(rootDir, packetDir)}`,
        `- reviewed_manifests: ${limitedManifests.length}`,
        `- source_run: ${manifestRecord?.runId ?? "-"}`,
        `- source_candidates: ${calibrationReport.sourceCandidates}`,
        `- audit_flagged: ${calibrationReport.auditFlagged}`,
        `- enforce_hidden: ${calibrationReport.enforceHidden}`,
        `- comparison_policy: ${options.policyFile ?? "-"}`,
        ...(comparisonReport?.recommendations?.length
          ? comparisonReport.recommendations.map((item) => `- compare_hint: ${item}`)
          : [])
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summaryMarkdown);
  console.log(`- packet_dir: ${path.relative(rootDir, packetDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- packet_manifest: ${path.relative(rootDir, path.join(packetDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- packet_notes: ${path.relative(rootDir, notesPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-pack",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(packetDir, "summary.md"))
  });

  return {
    projectKey,
    generatedAt,
    packetId,
    calibrationReport,
    comparisonReport
  };
}

async function runPolicyWorkbench(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);

  let manifestRecord;
  if (options.manifest) {
    const manifestPath = path.resolve(rootDir, options.manifest);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (!manifest.discovery) {
      throw new Error(`Manifest '${options.manifest}' does not contain a discovery payload.`);
    }
    manifestRecord = {
      runId: manifest.runId ?? path.basename(path.dirname(manifestPath)),
      manifestPath,
      relativeManifestPath: path.relative(rootDir, manifestPath),
      manifest
    };
  } else {
    manifestRecord = await findLatestDiscoveryManifest(rootDir, config, projectKey, options.runId, {
      preferCandidates: true
    });
    if (!manifestRecord) {
      throw new Error(`No discovery run manifest found for project '${projectKey}'.`);
    }
  }

  const generatedAt = new Date().toISOString();
  const workbenchId = createRunId(new Date(generatedAt));
  const workbench = buildPolicyWorkbench(manifestRecord.manifest.discovery, discoveryPolicy);
  const summary = renderPolicyWorkbenchSummary({
    projectKey,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    workbench
  });
  const workbenchDir = path.join(rootDir, "projects", projectKey, "calibration", "workbench", workbenchId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");
  const currentPolicyPath = path.join(workbenchDir, "current-policy.json");
  const proposedPolicyPath = path.join(workbenchDir, "proposed-policy.json");
  const rowsPath = path.join(workbenchDir, "rows.json");
  const manifestPath = path.join(workbenchDir, "manifest.json");
  const summaryPath = path.join(workbenchDir, "summary.md");
  const workbenchManifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    workbenchId,
    sourceRunId: manifestRecord.runId,
    sourceManifestPath: manifestRecord.relativeManifestPath,
    workbench
  };

  if (!options.dryRun) {
    await ensureDirectory(workbenchDir, false);
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    await fs.writeFile(manifestPath, `${JSON.stringify(workbenchManifest, null, 2)}\n`, "utf8");
    await fs.writeFile(rowsPath, `${JSON.stringify(workbench.rows, null, 2)}\n`, "utf8");
    await fs.writeFile(currentPolicyPath, `${JSON.stringify(discoveryPolicy, null, 2)}\n`, "utf8");
    await fs.writeFile(proposedPolicyPath, `${JSON.stringify(discoveryPolicy, null, 2)}\n`, "utf8");
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-workbench",
      sectionTitle: "Discovery Policy Workbench",
      blockKey: workbenchId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- source_run: ${manifestRecord.runId}`,
        `- source_manifest: ${manifestRecord.relativeManifestPath}`,
        `- workbench_dir: ${path.relative(rootDir, workbenchDir)}`,
        `- source_candidates: ${workbench.sourceCandidateCount}`,
        `- policy_blocked: ${workbench.blockedCount}`,
        `- policy_preferred: ${workbench.preferredCount}`,
        `- proposed_policy: ${path.relative(rootDir, proposedPolicyPath)}`
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summary);
  console.log(`- workbench_dir: ${path.relative(rootDir, workbenchDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- workbench_manifest: ${path.relative(rootDir, manifestPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- workbench_rows: ${path.relative(rootDir, rowsPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- proposed_policy: ${path.relative(rootDir, proposedPolicyPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- policy_notes: ${path.relative(rootDir, notesPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-workbench",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, summaryPath)
  });

  return {
    projectKey,
    generatedAt,
    workbenchId,
    workbench
  };
}

async function runPolicyWorkbenchReview(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  let resolvedWorkbenchDir = options.workbenchDir;
  if (!resolvedWorkbenchDir) {
    const latest = await findLatestPolicyWorkbench(rootDir, projectKey);
    if (!latest) {
      throw new Error(`No policy workbench found for project '${projectKey}'.`);
    }
    resolvedWorkbenchDir = latest.relativeWorkbenchDir;
  }

  const loaded = await loadPolicyWorkbench(rootDir, resolvedWorkbenchDir);
  const sourceManifestPath = loaded.manifest.sourceManifestPath
    ? path.resolve(rootDir, loaded.manifest.sourceManifestPath)
    : null;
  let sourceRecord = null;
  if (sourceManifestPath) {
    const manifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
    sourceRecord = {
      runId: loaded.manifest.sourceRunId,
      relativeManifestPath: loaded.manifest.sourceManifestPath,
      manifest
    };
  }

  const review = buildPolicyWorkbenchReview({
    rows: loaded.rows,
    sourceRecord,
    currentPolicy: loaded.currentPolicy,
    proposedPolicy: loaded.proposedPolicy
  });
  const workbenchId = path.basename(loaded.workbenchDir);
  const summary = renderPolicyWorkbenchReviewSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    review
  });
  const reviewJson = {
    schemaVersion: 1,
    projectKey,
    generatedAt: new Date().toISOString(),
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId ?? null,
    review
  };
  const summaryPath = path.join(loaded.workbenchDir, "review-summary.md");
  const jsonPath = path.join(loaded.workbenchDir, "review-summary.json");

  if (!options.dryRun) {
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    await fs.writeFile(jsonPath, `${JSON.stringify(reviewJson, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- workbench_dir: ${loaded.relativeWorkbenchDir}`);
  console.log(`- review_summary: ${path.relative(rootDir, summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- review_json: ${path.relative(rootDir, jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-workbench-review",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, summaryPath)
  });

  return {
    projectKey,
    workbenchId,
    review
  };
}

async function runPolicySuggest(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  let resolvedWorkbenchDir = options.workbenchDir;
  if (!resolvedWorkbenchDir) {
    const latest = await findLatestPolicyWorkbench(rootDir, projectKey);
    if (!latest) {
      throw new Error(`No policy workbench found for project '${projectKey}'.`);
    }
    resolvedWorkbenchDir = latest.relativeWorkbenchDir;
  }

  const loaded = await loadPolicyWorkbench(rootDir, resolvedWorkbenchDir);
  const sourceManifestPath = loaded.manifest.sourceManifestPath
    ? path.resolve(rootDir, loaded.manifest.sourceManifestPath)
    : null;
  let sourceRecord = null;
  if (sourceManifestPath) {
    const manifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
    sourceRecord = {
      runId: loaded.manifest.sourceRunId,
      relativeManifestPath: loaded.manifest.sourceManifestPath,
      manifest
    };
  }

  const suggestion = buildPolicySuggestion({
    rows: loaded.rows,
    currentPolicy: loaded.currentPolicy,
    sourceRecord
  });
  const workbenchId = path.basename(loaded.workbenchDir);
  const summary = renderPolicySuggestionSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    suggestion
  });
  const summaryPath = path.join(loaded.workbenchDir, "suggestion-summary.md");
  const jsonPath = path.join(loaded.workbenchDir, "suggestion-summary.json");
  const suggestedPolicyPath = path.join(loaded.workbenchDir, "suggested-policy.json");
  const proposedPolicyPath = path.join(loaded.workbenchDir, "proposed-policy.json");
  const suggestionJson = {
    schemaVersion: 1,
    projectKey,
    generatedAt: new Date().toISOString(),
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId ?? null,
    suggestion
  };

  if (!options.dryRun) {
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    await fs.writeFile(jsonPath, `${JSON.stringify(suggestionJson, null, 2)}\n`, "utf8");
    await fs.writeFile(suggestedPolicyPath, `${JSON.stringify(suggestion.nextPolicy, null, 2)}\n`, "utf8");
    if (options.apply) {
      await fs.writeFile(proposedPolicyPath, `${JSON.stringify(suggestion.nextPolicy, null, 2)}\n`, "utf8");
    }
  }

  console.log(summary);
  console.log(`- workbench_dir: ${loaded.relativeWorkbenchDir}`);
  console.log(`- suggestion_summary: ${path.relative(rootDir, summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- suggestion_json: ${path.relative(rootDir, jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- suggested_policy: ${path.relative(rootDir, suggestedPolicyPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (options.apply) {
    console.log(`- proposed_policy_updated: ${path.relative(rootDir, proposedPolicyPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "policy-suggest",
    projectKey,
    mode: options.dryRun ? "dry_run" : options.apply ? "write_apply" : "write",
    reportPath: path.relative(rootDir, summaryPath)
  });

  return {
    projectKey,
    workbenchId,
    suggestion
  };
}

async function runPolicyTrial(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  let resolvedWorkbenchDir = options.workbenchDir;
  if (!resolvedWorkbenchDir) {
    const latest = await findLatestPolicyWorkbench(rootDir, projectKey);
    if (!latest) {
      throw new Error(`No policy workbench found for project '${projectKey}'.`);
    }
    resolvedWorkbenchDir = latest.relativeWorkbenchDir;
  }

  const loaded = await loadPolicyWorkbench(rootDir, resolvedWorkbenchDir);
  const sourceManifestPath = loaded.manifest.sourceManifestPath
    ? path.resolve(rootDir, loaded.manifest.sourceManifestPath)
    : null;
  if (!sourceManifestPath) {
    throw new Error("Workbench has no source manifest path.");
  }
  const manifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
  const sourceRecord = {
    runId: loaded.manifest.sourceRunId,
    relativeManifestPath: loaded.manifest.sourceManifestPath,
    manifest
  };

  let trialPolicy = loaded.proposedPolicy ?? loaded.currentPolicy;
  let trialPolicyPath = path.join(loaded.relativeWorkbenchDir, "proposed-policy.json");
  if (options.policyFile) {
    trialPolicy = await loadDiscoveryPolicyFromFile(rootDir, projectKey, options.policyFile);
    trialPolicyPath = options.policyFile;
  } else {
    const suggestedPolicyPath = path.join(loaded.workbenchDir, "suggested-policy.json");
    try {
      const raw = await fs.readFile(suggestedPolicyPath, "utf8");
      trialPolicy = JSON.parse(raw);
      trialPolicyPath = path.relative(rootDir, suggestedPolicyPath);
    } catch {
      // keep proposed policy fallback
    }
  }

  const trial = buildPolicyTrial({
    discovery: manifest.discovery,
    currentPolicy: loaded.currentPolicy,
    trialPolicy,
    sourceRecord
  });
  const workbenchId = path.basename(loaded.workbenchDir);
  const summary = renderPolicyTrialSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    trialPolicyPath,
    trial
  });
  const summaryPath = path.join(loaded.workbenchDir, "trial-summary.md");
  const jsonPath = path.join(loaded.workbenchDir, "trial-summary.json");
  const matrixPath = path.join(loaded.workbenchDir, "trial-candidate-matrix.json");
  const trialJson = {
    schemaVersion: 1,
    projectKey,
    generatedAt: new Date().toISOString(),
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId ?? null,
    trialPolicyPath,
    trial
  };

  if (!options.dryRun) {
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    await fs.writeFile(jsonPath, `${JSON.stringify(trialJson, null, 2)}\n`, "utf8");
    await fs.writeFile(matrixPath, `${JSON.stringify(trial.rows, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- workbench_dir: ${loaded.relativeWorkbenchDir}`);
  console.log(`- trial_summary: ${path.relative(rootDir, summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- trial_json: ${path.relative(rootDir, jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- trial_matrix: ${path.relative(rootDir, matrixPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-trial",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, summaryPath)
  });

  return {
    projectKey,
    workbenchId,
    trial
  };
}

async function runPolicyCycle(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);

  let resolvedWorkbenchDir = options.workbenchDir;
  if (!resolvedWorkbenchDir) {
    const latest = await findLatestPolicyWorkbench(rootDir, projectKey);
    if (!latest) {
      throw new Error(`No policy workbench found for project '${projectKey}'.`);
    }
    resolvedWorkbenchDir = latest.relativeWorkbenchDir;
  }

  const loaded = await loadPolicyWorkbench(rootDir, resolvedWorkbenchDir);
  const workbenchId = path.basename(loaded.workbenchDir);
  const sourceManifestPath = loaded.manifest.sourceManifestPath
    ? path.resolve(rootDir, loaded.manifest.sourceManifestPath)
    : null;
  if (!sourceManifestPath) {
    throw new Error("Workbench has no source manifest path.");
  }

  const sourceManifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
  const sourceRecord = {
    runId: loaded.manifest.sourceRunId,
    relativeManifestPath: loaded.manifest.sourceManifestPath,
    manifest: sourceManifest
  };

  const review = buildPolicyWorkbenchReview({
    rows: loaded.rows,
    sourceRecord,
    currentPolicy: loaded.currentPolicy,
    proposedPolicy: loaded.proposedPolicy
  });
  const suggestion = buildPolicySuggestion({
    rows: loaded.rows,
    currentPolicy: loaded.currentPolicy,
    sourceRecord
  });

  let effectivePolicy = suggestion.changed
    ? suggestion.nextPolicy
    : (loaded.proposedPolicy ?? loaded.currentPolicy);
  let effectivePolicyLabel = "suggested-policy";
  if (options.policyFile) {
    effectivePolicy = await loadDiscoveryPolicyFromFile(rootDir, projectKey, options.policyFile);
    effectivePolicyLabel = options.policyFile;
  } else if (!suggestion.changed && loaded.proposedPolicy) {
    effectivePolicyLabel = path.join(loaded.relativeWorkbenchDir, "proposed-policy.json");
  }

  const trial = buildPolicyTrial({
    discovery: sourceManifest.discovery,
    currentPolicy: loaded.currentPolicy,
    trialPolicy: effectivePolicy,
    sourceRecord
  });

  const replayImportPayload = buildReplayImportPayloadFromDiscovery(
    sourceManifest.discovery,
    `policy-cycle-${workbenchId}`
  );
  const replayDiscovery = await discoverImportedCandidates(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    replayImportPayload,
    {
      ...options,
      discoveryPolicy: effectivePolicy,
      discoveryPolicyMode: options.discoveryPolicyMode ?? "enforce"
    }
  );

  const generatedAt = new Date().toISOString();
  const cycleId = createRunId(new Date(generatedAt));
  const cycleDir = path.join(rootDir, "projects", projectKey, "calibration", "cycles", cycleId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");
  const effectivePolicyPath = path.join(cycleDir, "effective-policy.json");
  const replaySummary = renderDiscoverySummary({
    runId: cycleId,
    projectKey,
    createdAt: generatedAt,
    discovery: replayDiscovery,
    dryRun: options.dryRun
  });
  const replayHtml = renderDiscoveryHtmlReport({
    projectKey,
    createdAt: generatedAt,
    discovery: replayDiscovery,
    projectProfile,
    binding,
    reportView: options.reportView
  });

  let applyResult = null;
  if (options.apply) {
    if (!options.dryRun) {
      await ensureDirectory(cycleDir, false);
      await fs.writeFile(effectivePolicyPath, `${JSON.stringify(effectivePolicy, null, 2)}\n`, "utf8");
      await fs.writeFile(
        path.join(loaded.workbenchDir, "proposed-policy.json"),
        `${JSON.stringify(effectivePolicy, null, 2)}\n`,
        "utf8"
      );
    }

    const currentPolicyPath = binding.discoveryPolicyFile ?? project.discoveryPolicyFile;
    if (!currentPolicyPath) {
      throw new Error(`Project '${projectKey}' has no configured discovery policy file.`);
    }

    if (options.dryRun) {
      const currentPolicyRaw = JSON.stringify(loaded.currentPolicy, null, 2).trim();
      const nextPolicyRaw = JSON.stringify(effectivePolicy, null, 2).trim();
      const changed = currentPolicyRaw !== nextPolicyRaw;
      applyResult = {
        changed,
        currentPolicyPath,
        nextPolicyPath: options.policyFile ?? `${path.join(loaded.relativeWorkbenchDir, "proposed-policy.json")} (simulated)`,
        summaryPath: path.join("projects", projectKey, "calibration", "history", `discovery-policy-apply-${generatedAt.replace(/[:.]/g, "-")}.md`),
        summary: [
          "# Patternpilot Discovery Policy Apply",
          "",
          `- project: ${projectKey}`,
          `- generated_at: ${generatedAt}`,
          `- changed: ${changed ? "yes" : "no"}`,
          `- simulated: yes`,
          ""
        ].join("\n")
      };
    } else {
      applyResult = await applyProjectPolicy({
        rootDir,
        projectKey,
        currentPolicyPath,
        nextPolicyPath: path.relative(rootDir, effectivePolicyPath),
        notesPath,
        generatedAt,
        dryRun: false,
        summaryLines: [
          `workbench_dir=${loaded.relativeWorkbenchDir}`,
          `cycle_dir=${path.relative(rootDir, cycleDir)}`,
          `rows_with_verdict=${review.rowsWithVerdict}`,
          `trial_newly_visible=${trial.newlyVisibleCount}`,
          `replay_visible=${replayDiscovery.candidateCount}`,
          ...review.recommendations
        ]
      });
    }
  }

  const summary = renderPolicyCycleSummary({
    projectKey,
    cycleId,
    generatedAt,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    review,
    suggestion,
    trial,
    applyResult,
    replay: {
      candidateCount: replayDiscovery.rawCandidateCount ?? replayDiscovery.evaluatedCandidates?.length ?? 0,
      visibleCount: replayDiscovery.candidateCount ?? replayDiscovery.candidates?.length ?? 0
    }
  });

  const cycleManifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    cycleId,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId ?? null,
    sourceManifestPath: loaded.manifest.sourceManifestPath ?? null,
    workbenchDir: loaded.relativeWorkbenchDir,
    effectivePolicyLabel,
    applyRequested: Boolean(options.apply),
    review,
    suggestion,
    trial,
    replay: {
      candidateCount: replayDiscovery.rawCandidateCount ?? replayDiscovery.evaluatedCandidates?.length ?? 0,
      visibleCount: replayDiscovery.candidateCount ?? replayDiscovery.candidates?.length ?? 0,
      blockedCount: replayDiscovery.blockedCandidates?.length ?? 0,
      policyMode: replayDiscovery.policySummary?.mode ?? "off",
      policySummary: replayDiscovery.policySummary ?? null
    },
    applyResult: applyResult
      ? {
          changed: applyResult.changed,
          currentPolicyPath: applyResult.currentPolicyPath ?? null,
          nextPolicyPath: applyResult.nextPolicyPath ?? null,
          summaryPath: applyResult.summaryPath ?? null
        }
      : null
  };

  const reviewSummary = renderPolicyWorkbenchReviewSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    review
  });
  const suggestionSummary = renderPolicySuggestionSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    suggestion
  });
  const trialSummary = renderPolicyTrialSummary({
    projectKey,
    workbenchId,
    sourceRunId: loaded.manifest.sourceRunId,
    trialPolicyPath: effectivePolicyLabel,
    trial
  });

  if (!options.dryRun) {
    await ensureDirectory(cycleDir, false);
    await fs.writeFile(path.join(cycleDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "manifest.json"), `${JSON.stringify(cycleManifest, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "review-summary.md"), `${reviewSummary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "review-summary.json"), `${JSON.stringify(review, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "suggestion-summary.md"), `${suggestionSummary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "suggestion-summary.json"), `${JSON.stringify(suggestion, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "suggested-policy.json"), `${JSON.stringify(suggestion.nextPolicy, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "effective-policy.json"), `${JSON.stringify(effectivePolicy, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "trial-summary.md"), `${trialSummary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "trial-summary.json"), `${JSON.stringify(trial, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "trial-candidate-matrix.json"), `${JSON.stringify(trial.rows, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "replay-import.json"), `${JSON.stringify(replayImportPayload, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "replay-summary.md"), `${replaySummary}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "replay-manifest.json"), `${JSON.stringify(replayDiscovery, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(cycleDir, "replay-report.html"), `${replayHtml}\n`, "utf8");
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-cycles",
      sectionTitle: "Discovery Policy Cycles",
      blockKey: cycleId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- workbench_id: ${workbenchId}`,
        `- source_run: ${loaded.manifest.sourceRunId ?? "-"}`,
        `- cycle_dir: ${path.relative(rootDir, cycleDir)}`,
        `- trial_newly_visible: ${trial.newlyVisibleCount}`,
        `- trial_newly_hidden: ${trial.newlyHiddenCount}`,
        `- replay_visible: ${replayDiscovery.candidateCount ?? replayDiscovery.candidates?.length ?? 0}`,
        `- policy_applied: ${applyResult ? (applyResult.changed ? "yes" : "no_change") : "no"}`
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summary);
  console.log(`- workbench_dir: ${loaded.relativeWorkbenchDir}`);
  console.log(`- cycle_dir: ${path.relative(rootDir, cycleDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- cycle_manifest: ${path.relative(rootDir, path.join(cycleDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- replay_summary: ${path.relative(rootDir, path.join(cycleDir, "replay-summary.md"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- replay_report: ${path.relative(rootDir, path.join(cycleDir, "replay-report.html"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (applyResult) {
    console.log(`- apply_summary: ${applyResult.summaryPath}${options.dryRun ? " (simulated dry-run)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "policy-cycle",
    projectKey,
    mode: options.dryRun ? "dry_run" : options.apply ? "write_apply" : "write",
    reportPath: path.relative(rootDir, path.join(cycleDir, "summary.md"))
  });

  return {
    projectKey,
    cycleId,
    workbenchId,
    review,
    suggestion,
    trial,
    replayDiscovery,
    applyResult
  };
}

async function runPolicyHandoff(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  let resolvedCycleDir = options.cycleDir;
  if (!resolvedCycleDir) {
    const latest = await findLatestPolicyCycle(rootDir, projectKey);
    if (!latest) {
      throw new Error(`No policy cycle found for project '${projectKey}'.`);
    }
    resolvedCycleDir = latest.relativeCycleDir;
  }

  const cycle = await loadPolicyCycle(rootDir, resolvedCycleDir);
  const cycleId = cycle.manifest.cycleId ?? path.basename(cycle.cycleDir);
  const selection = selectPolicyHandoffCandidates({
    scope: options.scope ?? "newly_visible",
    trialRows: cycle.trialRows,
    replayManifest: cycle.replayManifest
  });
  const generatedAt = new Date().toISOString();
  const handoffId = createRunId(new Date(generatedAt));
  const handoffDir = path.join(rootDir, "projects", projectKey, "calibration", "handoffs", handoffId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");

  let onDemandResult = null;
  const preloadedCandidates = (cycle.replayManifest?.candidates ?? []).filter((candidate) =>
    selection.urls.includes(candidate?.repo?.normalizedRepoUrl ?? candidate?.repoUrl ?? candidate?.normalizedRepoUrl)
  );
  if (selection.urls.length > 0) {
    onDemandResult = await runOnDemand(rootDir, config, {
      ...options,
      project: projectKey,
      file: null,
      urls: selection.urls,
      preloadedCandidates,
      notes: options.notes
        ? `policy-handoff:${cycleId} | ${options.notes}`
        : `policy-handoff from cycle ${cycleId}`,
      appendWatchlist: options.appendWatchlist ?? false
    });
  }

  const summary = renderPolicyHandoffSummary({
    projectKey,
    handoffId,
    generatedAt,
    cycleId,
    workbenchId: cycle.manifest.workbenchId ?? null,
    scope: selection.scope,
    selection,
    onDemandResult,
    dryRun: options.dryRun
  });
  const handoffManifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    handoffId,
    cycleId,
    cycleDir: cycle.relativeCycleDir,
    sourceRunId: cycle.manifest.sourceRunId ?? null,
    workbenchId: cycle.manifest.workbenchId ?? null,
    scope: selection.scope,
    selection,
    onDemandResult: onDemandResult
      ? {
          runId: onDemandResult.runId,
          runDir: path.relative(rootDir, onDemandResult.runDir),
          effectiveUrls: onDemandResult.effectiveUrls,
          intakeItems: onDemandResult.intakeRun?.items?.length ?? 0,
          reviewItems: onDemandResult.reviewRun?.review?.items?.length ?? 0,
          reportPath: onDemandResult.reviewRun?.htmlReportPath ?? null
        }
      : null
  };

  if (!options.dryRun) {
    await ensureDirectory(handoffDir, false);
    await fs.writeFile(path.join(handoffDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(handoffDir, "manifest.json"), `${JSON.stringify(handoffManifest, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(handoffDir, "selected-urls.txt"), `${selection.urls.join("\n")}${selection.urls.length ? "\n" : ""}`, "utf8");
    await fs.writeFile(path.join(handoffDir, "selection.json"), `${JSON.stringify(selection, null, 2)}\n`, "utf8");
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-handoffs",
      sectionTitle: "Policy Handoffs",
      blockKey: handoffId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- cycle_id: ${cycleId}`,
        `- cycle_dir: ${cycle.relativeCycleDir}`,
        `- scope: ${selection.scope}`,
        `- selected_repos: ${selection.count}`,
        `- handoff_dir: ${path.relative(rootDir, handoffDir)}`,
        `- on_demand_run: ${onDemandResult?.runId ?? "-"}`,
        `- review_items: ${onDemandResult?.reviewRun?.review?.items?.length ?? 0}`
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summary);
  console.log(`- cycle_dir: ${cycle.relativeCycleDir}`);
  console.log(`- handoff_dir: ${path.relative(rootDir, handoffDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- handoff_manifest: ${path.relative(rootDir, path.join(handoffDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (onDemandResult?.reviewRun?.htmlReportPath) {
    console.log(`- handoff_report: ${onDemandResult.reviewRun.htmlReportPath}${options.dryRun ? " (dry-run not written)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "policy-handoff",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(handoffDir, "summary.md"))
  });

  return {
    projectKey,
    handoffId,
    selection,
    onDemandResult
  };
}

async function runPolicyCurate(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  let resolvedHandoffDir = options.handoffDir;
  if (!resolvedHandoffDir) {
    const handoffRoot = path.join(rootDir, "projects", projectKey, "calibration", "handoffs");
    const entries = await fs.readdir(handoffRoot, { withFileTypes: true }).catch(() => []);
    const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse()[0];
    if (!latest) {
      throw new Error(`No policy handoff found for project '${projectKey}'.`);
    }
    resolvedHandoffDir = path.join("projects", projectKey, "calibration", "handoffs", latest);
  }

  const handoffManifest = JSON.parse(
    await fs.readFile(path.resolve(rootDir, resolvedHandoffDir, "manifest.json"), "utf8")
  );
  const queueRows = await loadQueueEntries(rootDir, config);
  const curation = buildPolicyCuration({
    handoffManifest,
    queueRows,
    limit: options.limit
  });
  const generatedAt = new Date().toISOString();
  const curationId = createRunId(new Date(generatedAt));
  const curationDir = path.join(rootDir, "projects", projectKey, "calibration", "curation", curationId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");

  let promotionRun = null;
  if (options.preparePromotions || options.apply) {
    promotionRun = await runPromote(rootDir, config, {
      ...options,
      project: projectKey,
      urls: curation.curatedCandidates.map((item) => item.url),
      apply: Boolean(options.apply),
      limit: curation.curatedCandidates.length
    });
  }

  const summary = renderPolicyCurationSummary({
    projectKey,
    curationId,
    generatedAt,
    handoffId: handoffManifest.handoffId ?? path.basename(path.resolve(rootDir, resolvedHandoffDir)),
    cycleId: handoffManifest.cycleId ?? null,
    curation,
    promotionRun,
    dryRun: options.dryRun
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    curationId,
    handoffDir: resolvedHandoffDir,
    handoffId: handoffManifest.handoffId ?? null,
    cycleId: handoffManifest.cycleId ?? null,
    curation,
    promotionRun: promotionRun
      ? {
          runId: promotionRun.runId,
          runDir: path.relative(rootDir, promotionRun.runDir),
          items: promotionRun.items
        }
      : null
  };

  if (!options.dryRun) {
    await ensureDirectory(curationDir, false);
    await fs.writeFile(path.join(curationDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(curationDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(curationDir, "curated-candidates.json"), `${JSON.stringify(curation.curatedCandidates, null, 2)}\n`, "utf8");
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-curation",
      sectionTitle: "Policy Curation",
      blockKey: curationId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- handoff_dir: ${resolvedHandoffDir}`,
        `- curated_candidates: ${curation.curatedCount}`,
        `- curation_dir: ${path.relative(rootDir, curationDir)}`,
        `- promotion_run: ${promotionRun?.runId ?? "-"}`,
        ...curation.curatedCandidates.map((item) => `- candidate: ${item.repoRef} :: score=${item.curationScore}`)
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summary);
  console.log(`- handoff_dir: ${resolvedHandoffDir}`);
  console.log(`- curation_dir: ${path.relative(rootDir, curationDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- curation_manifest: ${path.relative(rootDir, path.join(curationDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (promotionRun) {
    console.log(`- promotion_run_dir: ${path.relative(rootDir, promotionRun.runDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "policy-curate",
    projectKey,
    mode: options.dryRun ? "dry_run" : options.apply ? "apply" : options.preparePromotions ? "prepare" : "write",
    reportPath: path.relative(rootDir, path.join(curationDir, "summary.md"))
  });

  return {
    projectKey,
    curationId,
    curation,
    promotionRun
  };
}

async function resolveLatestCurationDir(rootDir, projectKey) {
  const curationRoot = path.join(rootDir, "projects", projectKey, "calibration", "curation");
  const entries = await fs.readdir(curationRoot, { withFileTypes: true }).catch(() => []);
  const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse()[0];
  if (!latest) {
    throw new Error(`No policy curation found for project '${projectKey}'.`);
  }
  return path.join("projects", projectKey, "calibration", "curation", latest);
}

async function loadCurationManifest(rootDir, curationDir) {
  return JSON.parse(await fs.readFile(path.resolve(rootDir, curationDir, "manifest.json"), "utf8"));
}

async function runPolicyCurationReview(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const resolvedCurationDir = options.curationDir
    ? options.curationDir
    : await resolveLatestCurationDir(rootDir, projectKey);
  const curationManifest = await loadCurationManifest(rootDir, resolvedCurationDir);
  const selectedCandidates = selectPolicyCurationApplyCandidates(curationManifest, options);
  const landkarteText = await fs.readFile(path.join(rootDir, "knowledge", "repo_landkarte.csv"), "utf8").catch(() => "");
  const learningsText = await fs.readFile(resolveLearningsPath(rootDir, config), "utf8").catch(() => "");
  const decisionsText = await fs.readFile(resolveDecisionsPath(rootDir, config), "utf8").catch(() => "");
  const review = buildPolicyCurationApplyReview({
    candidates: selectedCandidates,
    landkarteText,
    learningsText,
    decisionsText
  });
  const generatedAt = new Date().toISOString();
  const reviewId = createRunId(new Date(generatedAt));
  const reviewDir = path.join(rootDir, "projects", projectKey, "calibration", "apply-review", reviewId);
  const summary = renderPolicyCurationApplyReviewSummary({
    projectKey,
    reviewId,
    generatedAt,
    curationId: curationManifest.curationId ?? null,
    review
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    reviewId,
    curationDir: resolvedCurationDir,
    curationId: curationManifest.curationId ?? null,
    selectedCandidates: selectedCandidates.map((item) => ({
      repoRef: item.repoRef,
      url: item.url
    })),
    review
  };

  if (!options.dryRun) {
    await ensureDirectory(reviewDir, false);
    await fs.writeFile(path.join(reviewDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(reviewDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- curation_dir: ${resolvedCurationDir}`);
  console.log(`- apply_review_dir: ${path.relative(rootDir, reviewDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- apply_review_manifest: ${path.relative(rootDir, path.join(reviewDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-review",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(reviewDir, "summary.md"))
  });

  return {
    projectKey,
    reviewId,
    review,
    selectedCandidates
  };
}

async function runPolicyCurationApply(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const reviewRun = await runPolicyCurationReview(rootDir, config, options);
  const generatedAt = new Date().toISOString();
  const applyId = createRunId(new Date(generatedAt));
  const applyDir = path.join(rootDir, "projects", projectKey, "calibration", "apply", applyId);
  const promotionRun = await runPromote(rootDir, config, {
    ...options,
    project: projectKey,
    urls: reviewRun.selectedCandidates.map((item) => item.url),
    apply: true,
    limit: reviewRun.selectedCandidates.length
  });

  const summary = [
    "# Patternpilot Policy Curation Apply",
    "",
    `- project: ${projectKey}`,
    `- apply_id: ${applyId}`,
    `- generated_at: ${generatedAt}`,
    `- review_id: ${reviewRun.reviewId}`,
    `- selected_candidates: ${reviewRun.selectedCandidates.length}`,
    `- promotion_run: ${promotionRun.runId}`,
    `- promotion_items: ${promotionRun.items.length}`,
    "",
    "## Applied Candidates",
    "",
    ...reviewRun.selectedCandidates.map((item) => `- ${item.repoRef} :: ${item.url}`),
    ""
  ].join("\n");
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    applyId,
    reviewId: reviewRun.reviewId,
    selectedCandidates: reviewRun.selectedCandidates,
    promotionRun: {
      runId: promotionRun.runId,
      runDir: path.relative(rootDir, promotionRun.runDir),
      items: promotionRun.items
    }
  };

  if (!options.dryRun) {
    await ensureDirectory(applyDir, false);
    await fs.writeFile(path.join(applyDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(applyDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- apply_dir: ${path.relative(rootDir, applyDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- apply_manifest: ${path.relative(rootDir, path.join(applyDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-apply",
    projectKey,
    mode: options.dryRun ? "dry_run" : "apply",
    reportPath: path.relative(rootDir, path.join(applyDir, "summary.md"))
  });

  return {
    projectKey,
    applyId,
    promotionRun
  };
}

async function runPolicyCurationBatchReview(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const resolvedCurationDir = options.curationDir
    ? options.curationDir
    : await resolveLatestCurationDir(rootDir, projectKey);
  const curationManifest = await loadCurationManifest(rootDir, resolvedCurationDir);
  const selectedCandidates = selectPolicyCurationBatchCandidates(curationManifest, options);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === projectKey);
  const landkarteText = await fs.readFile(path.join(rootDir, "knowledge", "repo_landkarte.csv"), "utf8").catch(() => "");
  const learningsText = await fs.readFile(resolveLearningsPath(rootDir, config), "utf8").catch(() => "");
  const decisionsText = await fs.readFile(resolveDecisionsPath(rootDir, config), "utf8").catch(() => "");
  const review = buildPolicyCurationBatchReview({
    candidates: selectedCandidates,
    queueRows,
    landkarteText,
    learningsText,
    decisionsText
  });
  const generatedAt = new Date().toISOString();
  const reviewId = createRunId(new Date(generatedAt));
  const reviewDir = path.join(rootDir, "projects", projectKey, "calibration", "batch-review", reviewId);
  const summary = renderPolicyCurationBatchReviewSummary({
    projectKey,
    reviewId,
    generatedAt,
    curationId: curationManifest.curationId ?? null,
    review
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    reviewId,
    curationDir: resolvedCurationDir,
    curationId: curationManifest.curationId ?? null,
    review
  };

  if (!options.dryRun) {
    await ensureDirectory(reviewDir, false);
    await fs.writeFile(path.join(reviewDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(reviewDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- curation_dir: ${resolvedCurationDir}`);
  console.log(`- batch_review_dir: ${path.relative(rootDir, reviewDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- batch_review_manifest: ${path.relative(rootDir, path.join(reviewDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-batch-review",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(reviewDir, "summary.md"))
  });

  return {
    projectKey,
    reviewId,
    review
  };
}

async function runPolicyCurationBatchPlan(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const resolvedCurationDir = options.curationDir
    ? options.curationDir
    : await resolveLatestCurationDir(rootDir, projectKey);
  const curationManifest = await loadCurationManifest(rootDir, resolvedCurationDir);
  const reviewRun = await runPolicyCurationBatchReview(rootDir, config, options);
  const generatedAt = new Date().toISOString();
  const planId = createRunId(new Date(generatedAt));
  const planDir = path.join(rootDir, "projects", projectKey, "calibration", "batch-plan", planId);
  const summary = renderPolicyCurationBatchPlanSummary({
    projectKey,
    planId,
    generatedAt,
    curationId: curationManifest.curationId ?? null,
    review: reviewRun.review
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    planId,
    curationDir: resolvedCurationDir,
    curationId: curationManifest.curationId ?? null,
    reviewId: reviewRun.reviewId,
    governance: reviewRun.review.governance
  };

  if (!options.dryRun) {
    await ensureDirectory(planDir, false);
    await fs.writeFile(path.join(planDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(planDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- curation_dir: ${resolvedCurationDir}`);
  console.log(`- batch_plan_dir: ${path.relative(rootDir, planDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- batch_plan_manifest: ${path.relative(rootDir, path.join(planDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-batch-plan",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(planDir, "summary.md"))
  });

  return {
    projectKey,
    planId,
    review: reviewRun.review
  };
}

async function runPolicyCurationBatchApply(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const reviewRun = await runPolicyCurationBatchReview(rootDir, config, options);
  const generatedAt = new Date().toISOString();
  const applyId = createRunId(new Date(generatedAt));
  const applyDir = path.join(rootDir, "projects", projectKey, "calibration", "batch-apply", applyId);
  const applyRows = options.force || options.scope === "all"
    ? reviewRun.review.rows.filter((item) => !item.alreadyPromoted)
    : reviewRun.review.governance.safeApplyCandidates;
  const applyUrls = applyRows.map((item) => item.url);

  let promotionRun = null;
  if (applyUrls.length > 0) {
    promotionRun = await runPromote(rootDir, config, {
      ...options,
      project: projectKey,
      urls: applyUrls,
      apply: true,
      limit: applyUrls.length
    });
  }

  const summary = [
    "# Patternpilot Policy Curation Batch Apply",
    "",
    `- project: ${projectKey}`,
    `- apply_id: ${applyId}`,
    `- generated_at: ${generatedAt}`,
    `- review_id: ${reviewRun.reviewId}`,
    `- selected_candidates: ${reviewRun.review.candidateCount}`,
    `- apply_candidates: ${reviewRun.review.applyCandidateCount}`,
    `- already_promoted: ${reviewRun.review.alreadyPromotedCount}`,
    `- manual_review: ${reviewRun.review.manualReviewCount}`,
    `- apply_scope: ${options.force || options.scope === "all" ? "all_non_promoted" : "safe_only"}`,
    `- promotion_run: ${promotionRun?.runId ?? "-"}`,
    `- promotion_items: ${promotionRun?.items?.length ?? 0}`,
    "",
    "## Batch Apply Candidates",
    "",
    ...(applyRows.length > 0
      ? applyRows.map((item) => `- ${item.repoRef} :: ${item.url}`)
      : ["- none"]),
    "",
    "## Manual Review Candidates",
    "",
    ...(reviewRun.review.governance.manualReviewCandidates.length > 0
      ? reviewRun.review.governance.manualReviewCandidates.map((item) => `- ${item.repoRef} :: risk=${item.conflictRisk} :: overlap=${item.overlapReasons.join(", ") || "-"}`)
      : ["- none"]),
    ""
  ].join("\n");
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    applyId,
    reviewId: reviewRun.reviewId,
    review: reviewRun.review,
    promotionRun: promotionRun
      ? {
          runId: promotionRun.runId,
          runDir: path.relative(rootDir, promotionRun.runDir),
          items: promotionRun.items
        }
      : null
  };

  if (!options.dryRun) {
    await ensureDirectory(applyDir, false);
    await fs.writeFile(path.join(applyDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(applyDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- batch_apply_dir: ${path.relative(rootDir, applyDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- batch_apply_manifest: ${path.relative(rootDir, path.join(applyDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-batch-apply",
    projectKey,
    mode: options.dryRun ? "dry_run" : "apply",
    reportPath: path.relative(rootDir, path.join(applyDir, "summary.md"))
  });

  return {
    projectKey,
    applyId,
    promotionRun
  };
}

async function runPolicyApply(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const currentPolicyPath = binding.discoveryPolicyFile ?? project.discoveryPolicyFile;
  if (!currentPolicyPath) {
    throw new Error(`Project '${projectKey}' has no configured discovery policy file.`);
  }

  let workbench = null;
  let nextPolicyPath = options.policyFile;
  if (options.workbenchDir) {
    workbench = await loadPolicyWorkbench(rootDir, options.workbenchDir);
    nextPolicyPath = nextPolicyPath ?? path.join(workbench.relativeWorkbenchDir, "proposed-policy.json");
  } else if (!nextPolicyPath) {
    const latest = await findLatestPolicyWorkbench(rootDir, projectKey);
    if (latest) {
      workbench = await loadPolicyWorkbench(rootDir, latest.relativeWorkbenchDir);
      nextPolicyPath = path.join(workbench.relativeWorkbenchDir, "proposed-policy.json");
    }
  }

  if (!nextPolicyPath) {
    throw new Error("policy-apply requires --policy-file <path> or an existing workbench with proposed-policy.json.");
  }

  let summaryLines = [];
  if (workbench) {
    const sourceManifestPath = workbench.manifest.sourceManifestPath
      ? path.resolve(rootDir, workbench.manifest.sourceManifestPath)
      : null;
    let sourceRecord = null;
    if (sourceManifestPath) {
      const manifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
      sourceRecord = {
        runId: workbench.manifest.sourceRunId,
        relativeManifestPath: workbench.manifest.sourceManifestPath,
        manifest
      };
    }
    const review = buildPolicyWorkbenchReview({
      rows: workbench.rows,
      sourceRecord,
      currentPolicy: workbench.currentPolicy,
      proposedPolicy: workbench.proposedPolicy
    });
    summaryLines = [
      `workbench_dir=${workbench.relativeWorkbenchDir}`,
      `rows_with_verdict=${review.rowsWithVerdict}`,
      ...review.recommendations
    ];
  }

  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");
  const out = await applyProjectPolicy({
    rootDir,
    projectKey,
    currentPolicyPath,
    nextPolicyPath,
    notesPath,
    generatedAt: new Date().toISOString(),
    dryRun: options.dryRun,
    summaryLines
  });

  console.log(out.summary);
  console.log(`- before_policy: ${out.beforePath}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- after_policy: ${out.afterPath}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- apply_summary: ${out.summaryPath}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-apply",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: out.summaryPath
  });

  return out;
}

function buildReviewReportPath(rootDir, binding, review, outputSlug) {
  const reportFilename = outputSlug
    ? `${outputSlug}-review-${review.analysisProfile.id}-${review.analysisDepth.id}.md`
    : `watchlist-review-${review.analysisProfile.id}-${review.analysisDepth.id}.md`;
  return path.join(rootDir, "projects", binding.projectKey, "reviews", reportFilename);
}

function buildQueueLifecycleStats(queueRows = []) {
  return queueRows.reduce((acc, row) => {
    acc.total += 1;
    const status = row.status || "unknown";
    acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
    if (status === "promoted") {
      acc.promoted += 1;
    }
    if (status === "promotion_prepared") {
      acc.prepared += 1;
    }
    return acc;
  }, {
    total: 0,
    promoted: 0,
    prepared: 0,
    byStatus: {}
  });
}

async function buildProjectRunDiagnostics(rootDir, config, {
  projectKey,
  sourceMode,
  explicitUrlCount = 0,
  watchlistCount = 0,
  watchlistUrls = [],
  currentFingerprint = null,
  isAutomation = false
}) {
  const priorRuns = await listProjectRunHistory(rootDir, config, projectKey);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === projectKey);
  const stability = await buildProjectRunStability(rootDir, config, {
    projectKey
  });
  const lifecycle = buildProjectRunLifecycle({
    priorRuns,
    sourceMode,
    explicitUrlCount,
    watchlistCount,
    isAutomation,
    queueStats: buildQueueLifecycleStats(queueRows)
  });
  const drift = await buildProjectRunDrift(rootDir, config, {
    projectKey,
    watchlistUrls,
    currentFingerprint
  });

  return {
    priorRuns,
    queueRows,
    stability,
    lifecycle,
    drift
  };
}

async function buildProjectRunPlan(rootDir, config, options) {
  const diagnostics = await buildProjectRunDiagnostics(rootDir, config, options);
  return diagnostics.lifecycle;
}

function buildProjectRunGovernanceSnapshot({
  projectKey,
  lifecycle,
  drift,
  stability,
  scope = "manual",
  jobState = null,
  job = null
}) {
  return buildProjectRunGovernance({
    projectKey,
    lifecycle,
    drift,
    stability,
    scope,
    jobState,
    job
  });
}

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

async function runOnDemand(rootDir, config, options) {
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
    console.log(`## Suggested Next Actions`);
    for (const action of nextActions) {
      console.log(`- ${action}`);
    }
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

async function runRefreshContext(rootDir, config) {
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

async function runPlan(rootDir, config, options) {
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

async function runDrift(rootDir, config, options) {
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

async function runStability(rootDir, config, options) {
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

async function runGovernance(rootDir, config, options) {
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

async function runRequalify(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const watchlistUrls = project.watchlistFile
    ? await loadWatchlistUrls(rootDir, project)
    : [];
  const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
    projectKey,
    sourceMode: options.scope === "automation" ? "watchlist" : "watchlist",
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

async function runShowProject(rootDir, config, options) {
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

function printProjectList(rootDir, config) {
  console.log(`# Patternpilot Projects`);
  console.log(``);
  console.log(`- default_project: ${config.defaultProject ?? "-"}`);
  console.log(``);
  console.log(`## Configured Projects`);
  for (const [projectKey, project] of Object.entries(config.projects ?? {})) {
    console.log(`- ${projectKey}: ${path.resolve(rootDir, project.projectRoot)} (${project.label ?? projectKey})`);
  }
}

async function runDoctor(rootDir, config, options, envFiles) {
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

async function runInitEnv(rootDir, options) {
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

function runSetupChecklist(options) {
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

async function runInitProject(rootDir, config, options) {
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

async function runDiscoverWorkspace(rootDir, config, options) {
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

async function runSyncWatchlist(rootDir, config, options) {
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

async function runSyncAllWatchlists(rootDir, config, options) {
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

async function runReEvaluate(rootDir, config, options) {
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

async function runAutomationJobs(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { jobsPath, jobs } = await loadAutomationJobs(rootDir, config);
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      jobsPath: path.relative(rootDir, jobsPath),
      statePath: path.relative(rootDir, statePath),
      evaluations
    }, null, 2));
    return {
      generatedAt,
      evaluations
    };
  }

  const summary = renderAutomationJobsSummary({
    generatedAt,
    evaluations
  });
  console.log(summary);
  console.log(`- jobs_file: ${path.relative(rootDir, jobsPath)}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);

  return {
    generatedAt,
    evaluations
  };
}

async function writeAlertArtifacts(rootDir, config, generatedAt, evaluations, dryRun = false) {
  const alerts = buildAutomationAlerts(evaluations, {
    now: new Date(generatedAt)
  });
  const nextJob = selectNextDispatchableAutomationJob(evaluations) ?? evaluations.find((job) => job.status === "ready") ?? null;
  const payload = buildAutomationAlertPayload({
    generatedAt,
    alerts,
    nextJob
  });
  const paths = await writeAutomationAlertArtifacts(rootDir, config, payload, dryRun);
  return {
    alerts,
    nextJob,
    payload,
    paths
  };
}

async function enrichAutomationEvaluationsWithGovernance(rootDir, config, evaluations) {
  const next = [];
  for (const evaluation of evaluations) {
    if (evaluation.scope !== "project" || !evaluation.projectKey || !config.projects?.[evaluation.projectKey]) {
      next.push(evaluation);
      continue;
    }

    const { project, binding } = await loadProjectBinding(rootDir, config, evaluation.projectKey);
    const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
    const watchlistUrls = project.watchlistFile
      ? await loadWatchlistUrls(rootDir, project)
      : [];
    const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
      projectKey: evaluation.projectKey,
      sourceMode: "watchlist",
      explicitUrlCount: 0,
      watchlistCount: watchlistUrls.length,
      watchlistUrls,
      currentFingerprint: computeRulesFingerprint(alignmentRules),
      isAutomation: true
    });
    const governance = buildProjectRunGovernanceSnapshot({
      projectKey: evaluation.projectKey,
      lifecycle: diagnostics.lifecycle,
      drift: diagnostics.drift,
      stability: diagnostics.stability,
      scope: "automation",
      jobState: evaluation.jobState ?? null,
      job: evaluation
    });

    next.push({
      ...evaluation,
      jobState: {
        ...(evaluation.jobState ?? {}),
        runKind: diagnostics.lifecycle.runKind,
        recommendedFocus: diagnostics.lifecycle.recommendedFocus,
        driftStatus: diagnostics.drift.driftStatus,
        driftSignals: diagnostics.drift.signals.length,
        stabilityStatus: diagnostics.stability.status,
        stableStreak: diagnostics.stability.stableStreak,
        unstableStreak: diagnostics.stability.unstableStreak,
        governanceStatus: governance.status,
        autoDispatchAllowed: governance.autoDispatchAllowed,
        autoApplyAllowed: governance.autoApplyAllowed,
        governanceNextAction: governance.nextAction,
        recommendedGovernancePromotionMode: governance.recommendedPromotionMode
      },
      liveGovernance: governance
    });
  }
  return next;
}

async function runAutomationDispatch(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { jobsPath, jobs } = await loadAutomationJobs(rootDir, config);
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);
  let selection = resolveAutomationDispatchJob(evaluations, options.automationJob);
  if (!options.automationJob && selection.job?.liveGovernance?.autoDispatchAllowed === false) {
    const nextDispatchableJob = selectNextDispatchableAutomationJob(evaluations);
    if (nextDispatchableJob) {
      selection = {
        status: "selected",
        reason: `Selected next dispatchable job '${nextDispatchableJob.name}'.`,
        job: nextDispatchableJob
      };
    }
  }
  if (selection.job?.liveGovernance?.autoDispatchAllowed === false) {
    selection = {
      status: "governance_blocked",
      reason: selection.job.liveGovernance.nextAction ?? `${selection.job.name} currently requires a manual governance gate.`,
      job: selection.job
    };
  }
  const alertArtifacts = await writeAlertArtifacts(rootDir, config, generatedAt, evaluations, options.dryRun);

  console.log(`# Patternpilot Automation Dispatch`);
  console.log(``);
  console.log(`- generated_at: ${generatedAt}`);
  console.log(`- jobs_file: ${path.relative(rootDir, jobsPath)}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- alerts_json: ${path.relative(rootDir, alertArtifacts.paths.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- alerts_markdown: ${path.relative(rootDir, alertArtifacts.paths.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- selection_status: ${selection.status}`);
  console.log(`- selection_reason: ${selection.reason}`);

  if (!selection.job) {
    return {
      generatedAt,
      selection,
      alertArtifacts
    };
  }

  console.log(`- selected_job: ${selection.job.name}`);
  console.log(`- selected_command: ${selection.job.command}`);
  if (selection.job.liveGovernance) {
    console.log(`- governance_status: ${selection.job.liveGovernance.status}`);
    console.log(`- governance_next_action: ${selection.job.liveGovernance.nextAction}`);
  }

  if (selection.status === "governance_blocked") {
    return {
      generatedAt,
      selection,
      alertArtifacts
    };
  }

  if (options.dryRun) {
    console.log(`- dispatch_status: dry_run_preview`);
    return {
      generatedAt,
      selection,
      alertArtifacts
    };
  }

  console.log(``);
  console.log(`## Dispatch Run`);
  const result = await runShellCommand(selection.job.command, {
    cwd: rootDir,
    env: process.env,
    stdio: "inherit"
  });

  console.log(``);
  console.log(`## Dispatch Result`);
  console.log(`- exit_code: ${result.code}`);
  console.log(`- signal: ${result.signal ?? "-"}`);

  if (result.code !== 0) {
    const error = new Error(`Dispatched automation job '${selection.job.name}' failed with exit code ${result.code}.`);
    error.exitCode = result.code;
    throw error;
  }

  const postRunGeneratedAt = new Date().toISOString();
  const { state: refreshedState } = await loadAutomationJobState(rootDir, config);
  const refreshedEvaluations = evaluateAutomationJobs(jobs, refreshedState, new Date(postRunGeneratedAt));
  const refreshedAlertArtifacts = await writeAlertArtifacts(rootDir, config, postRunGeneratedAt, refreshedEvaluations, false);
  console.log(`- next_ready_job_after_dispatch: ${refreshedAlertArtifacts.nextJob?.name ?? "-"}`);

  return {
    generatedAt,
    selection,
    result,
    alertArtifacts: refreshedAlertArtifacts
  };
}

async function runAutomationAlerts(rootDir, config, options) {
  const generatedAt = new Date().toISOString();
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const { jobs } = await loadAutomationJobs(rootDir, config);
  const baseEvaluations = evaluateAutomationJobs(jobs, state, new Date(generatedAt));
  const evaluations = await enrichAutomationEvaluationsWithGovernance(rootDir, config, baseEvaluations);
  const alertArtifacts = await writeAlertArtifacts(rootDir, config, generatedAt, evaluations, options.dryRun);
  const { alerts, nextJob, paths } = alertArtifacts;

  if (options.json) {
    console.log(JSON.stringify({
      generatedAt,
      statePath: path.relative(rootDir, statePath),
      jsonPath: path.relative(rootDir, paths.jsonPath),
      markdownPath: path.relative(rootDir, paths.markdownPath),
      alerts,
      nextJob
    }, null, 2));
    return { generatedAt, alerts, nextJob };
  }

  const summary = renderAutomationAlertSummary({
    generatedAt,
    alerts,
    nextJob
  });
  console.log(summary);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- alerts_json: ${path.relative(rootDir, paths.jsonPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- alerts_markdown: ${path.relative(rootDir, paths.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);

  return { generatedAt, alerts, nextJob };
}

async function runAutomationJobClear(rootDir, config, options) {
  if (!options.automationJob) {
    throw new Error("automation-job-clear requires --automation-job <job-name>.");
  }

  const clearedAt = new Date().toISOString();
  const { statePath, state } = await loadAutomationJobState(rootDir, config);
  const out = clearAutomationJobState(state, options.automationJob, {
    clearedAt,
    reason: options.notes || "manual_clear"
  });

  if (out.result.status === "missing") {
    console.log(`# Patternpilot Automation Job Clear`);
    console.log(``);
    console.log(`- job: ${options.automationJob}`);
    console.log(`- status: missing`);
    console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
    return out.result;
  }

  await writeAutomationJobState(rootDir, config, out.state, options.dryRun);

  console.log(`# Patternpilot Automation Job Clear`);
  console.log(``);
  console.log(`- job: ${options.automationJob}`);
  console.log(`- status: cleared`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- state_file: ${path.relative(rootDir, statePath)}`);
  console.log(`- previous_blocked_manual: ${out.result.previous.blockedManual ? "yes" : "no"}`);
  console.log(`- previous_requalification_required: ${out.result.previous.requalificationRequired ? "yes" : "no"}`);
  console.log(`- previous_next_retry_at: ${out.result.previous.nextRetryAt ?? "-"}`);
  console.log(`- clear_reason: ${out.result.current.manualClearReason ?? "-"}`);

  return out.result;
}

async function runAutomation(rootDir, config, options) {
  const projectEntries = Object.entries(config.projects ?? {});
  const targetEntries = options.project && !options.allProjects
    ? projectEntries.filter(([projectKey]) => projectKey === options.project)
    : projectEntries;
  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const promotionMode = options.promotionMode ?? "skip";
  const projectRuns = [];
  const failures = [];
  const lockInfo = await acquireAutomationLock(rootDir, config, {
    project: options.project || null,
    allProjects: options.allProjects,
    dryRun: options.dryRun,
    forceLock: options.automationForceLock,
    lockTimeoutMinutes: options.automationLockTimeoutMinutes
  });

  function skipPendingPhases(projectRun, reason) {
    for (const [phase, phaseState] of Object.entries(projectRun.phases)) {
      if (phaseState.status === "pending") {
        setAutomationPhase(projectRun, phase, {
          status: "skipped",
          reason
        });
      }
    }
  }

  console.log(`# Patternpilot Automation Run`);
  console.log(``);
  console.log(`- run_id: ${runId}`);
  console.log(`- automation_job: ${options.automationJob ?? "-"}`);
  console.log(`- projects: ${targetEntries.length}`);
  console.log(`- promotion_mode: ${promotionMode}`);
  console.log(`- dry_run: ${options.dryRun ? "yes" : "no"}`);
  console.log(`- skip_discovery: ${options.skipDiscovery ? "yes" : "no"}`);
  console.log(`- skip_review: ${options.skipReview ? "yes" : "no"}`);
  console.log(`- automation_min_confidence: ${options.automationMinConfidence}`);
  console.log(`- automation_max_new_candidates: ${options.automationMaxNewCandidates}`);
  console.log(`- automation_continue_on_project_error: ${options.automationContinueOnProjectError ? "yes" : "no"}`);
  console.log(`- automation_force_lock: ${options.automationForceLock ? "yes" : "no"}`);
  console.log(`- automation_lock_timeout_minutes: ${options.automationLockTimeoutMinutes}`);
  console.log(`- automation_re_evaluate_limit: ${options.automationReevaluateLimit ?? "-"}`);
  console.log(`- automation_lock_status: ${lockInfo.status}`);
  console.log(`- automation_lock_path: ${path.relative(rootDir, lockInfo.lockPath)}`);
  console.log(``);

  try {
    for (const [projectKey, project] of targetEntries) {
    const projectRun = createAutomationProjectRun(projectKey);
    projectRuns.push(projectRun);
    let currentPhase = null;

    if (!project.watchlistFile) {
      console.log(`- ${projectKey}: skipped (no watchlist_file configured)`);
      skipPendingPhases(projectRun, "no_watchlist_file");
      finalizeAutomationProjectRun(projectRun);
      continue;
    }

    try {
      const { binding } = await loadProjectBinding(rootDir, config, projectKey);
      const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
      const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);

      const watchlistUrls = await collectUrls(rootDir, {
        ...options,
        file: project.watchlistFile,
        urls: []
      });
      const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
        projectKey,
        sourceMode: "watchlist",
        explicitUrlCount: 0,
        watchlistCount: watchlistUrls.length,
        watchlistUrls,
        currentFingerprint: computeRulesFingerprint(alignmentRules),
        isAutomation: true
      });
      const runPlan = diagnostics.lifecycle;
      const runDrift = diagnostics.drift;
      const runStability = diagnostics.stability;
      const runGovernance = buildProjectRunGovernanceSnapshot({
        projectKey,
        lifecycle: runPlan,
        drift: runDrift,
        stability: runStability,
        scope: "automation",
        job: {
          name: options.automationJob ?? null,
          command: `automation-run --project ${projectKey} --promotion-mode ${promotionMode}`
        }
      });
      projectRun.metrics.runKind = runPlan.runKind;
      projectRun.metrics.recommendedFocus = runPlan.recommendedFocus;
      projectRun.metrics.defaultPhases = runPlan.defaultPhases;
      projectRun.metrics.executionPolicy = runPlan.executionPolicy;
      projectRun.metrics.defaultPromotionMode = runPlan.defaultPromotionMode;
      projectRun.metrics.runDriftStatus = runDrift.driftStatus;
      projectRun.metrics.runDriftSignals = runDrift.signals.length;
      projectRun.metrics.runStabilityStatus = runStability.status;
      projectRun.metrics.stableStreak = runStability.stableStreak;
      projectRun.metrics.unstableStreak = runStability.unstableStreak;
      projectRun.metrics.resumeGuidance = runDrift.resumeGuidance;
      projectRun.metrics.runGovernanceStatus = runGovernance.status;
      projectRun.metrics.autoDispatchAllowed = runGovernance.autoDispatchAllowed;
      projectRun.metrics.autoApplyAllowed = runGovernance.autoApplyAllowed;
      projectRun.metrics.recommendedPromotionMode = runGovernance.recommendedPromotionMode;
      projectRun.metrics.governanceNextAction = runGovernance.nextAction;

      console.log(`- ${projectKey}: run_kind=${runPlan.runKind} | focus=${runPlan.recommendedFocus} | drift=${runDrift.driftStatus} | stability=${runStability.status} | governance=${runGovernance.status}`);
      let discoveredUrls = [];

      if (options.skipDiscovery) {
        setAutomationPhase(projectRun, "discover", {
          status: "skipped",
          reason: "cli_skip_discovery"
        });
        setAutomationPhase(projectRun, "gate", {
          status: "skipped",
          reason: "discovery_skipped"
        });
        setAutomationPhase(projectRun, "watchlist_handoff", {
          status: "skipped",
          reason: "discovery_skipped"
        });
      } else {
        currentPhase = "discover";
        console.log(`## Discover ${projectKey}`);
        const discoveryRun = await runDiscover(rootDir, config, {
          ...options,
          project: projectKey,
          appendWatchlist: false,
          intake: false
        });
        setAutomationPhase(projectRun, "discover", {
          status: "completed",
          reason: "run_complete",
          count: discoveryRun.discovery?.candidates?.length ?? 0,
          runConfidence: discoveryRun.discovery?.runConfidence ?? "unknown",
          reportPath: discoveryRun.htmlReportPath
        });

        currentPhase = "gate";
        const gate = selectAutomationDiscoveryCandidates(discoveryRun.discovery, {
          minConfidence: options.automationMinConfidence,
          maxCandidates: options.automationMaxNewCandidates,
          policy: discoveryPolicy
        });

        console.log(``);
        console.log(`## Discovery Gate ${projectKey}`);
        console.log(`- status: ${gate.status}`);
        console.log(`- reason: ${gate.reason}`);
        console.log(`- considered: ${gate.considered}`);
        console.log(`- actionable: ${gate.actionable}`);
        console.log(`- rejected: ${gate.rejected}`);
        console.log(`- policy_blocked: ${gate.policyBlocked ?? 0}`);
        console.log(`- policy_preferred: ${gate.policyPreferred ?? 0}`);

        setAutomationPhase(projectRun, "gate", {
          status: gate.status.startsWith("blocked_") ? "blocked" : gate.selectedUrls.length > 0 ? "completed" : "skipped",
          reason: gate.reason,
          count: gate.considered,
          selected: gate.selectedUrls.length,
          policyBlocked: gate.policyBlocked ?? 0,
          policyPreferred: gate.policyPreferred ?? 0
        });

        currentPhase = "watchlist_handoff";
        if (gate.selectedUrls.length > 0) {
          const watchlistResult = await appendUrlsToWatchlist(
            rootDir,
            project,
            gate.selectedUrls,
            options.dryRun
          );
          console.log(`- selected_urls: ${gate.selectedUrls.length}`);
          console.log(`- watchlist_status: ${watchlistResult.status}`);
          console.log(`- watchlist_appended: ${watchlistResult.appended}`);
          console.log(`- watchlist_kept_existing: ${watchlistResult.keptExisting}`);
          discoveredUrls = gate.selectedUrls;
          setAutomationPhase(projectRun, "watchlist_handoff", {
            status: "completed",
            reason: watchlistResult.status,
            selected: gate.selectedUrls.length,
            appended: watchlistResult.appended,
            keptExisting: watchlistResult.keptExisting
          });
        } else {
          console.log(`- selected_urls: 0`);
          setAutomationPhase(projectRun, "watchlist_handoff", {
            status: "skipped",
            reason: "no_selected_urls",
            selected: 0
          });
        }
        console.log(``);
      }

      const effectiveUrls = [...new Set([...watchlistUrls, ...discoveredUrls])];
      projectRun.metrics.watchlistUrls = watchlistUrls.length;
      projectRun.metrics.discoveredUrls = discoveredUrls.length;
      projectRun.metrics.effectiveUrls = effectiveUrls.length;

      if (effectiveUrls.length === 0) {
        console.log(`- ${projectKey}: skipped (no effective watchlist or discovery handoff)`);
        setAutomationPhase(projectRun, "intake", {
          status: "skipped",
          reason: "no_effective_urls"
        });
        setAutomationPhase(projectRun, "re_evaluate", {
          status: "skipped",
          reason: "no_effective_urls"
        });
        setAutomationPhase(projectRun, "review", {
          status: "skipped",
          reason: "no_effective_urls"
        });
        setAutomationPhase(projectRun, "promote", {
          status: "skipped",
          reason: "no_effective_urls"
        });
        finalizeAutomationProjectRun(projectRun);
        console.log(``);
        continue;
      }

      currentPhase = "intake";
      console.log(`## Intake ${projectKey}`);
      const intakeRun = await runIntake(rootDir, config, {
        ...options,
        project: projectKey,
        file: null,
        urls: effectiveUrls
      });
      setAutomationPhase(projectRun, "intake", {
        status: "completed",
        reason: "run_complete",
        count: intakeRun.items.length,
        runDir: path.relative(rootDir, intakeRun.runDir)
      });

      if (options.dryRun) {
        setAutomationPhase(projectRun, "re_evaluate", {
          status: "skipped",
          reason: "dry_run_follow_up_skipped"
        });
        setAutomationPhase(projectRun, "review", {
          status: options.skipReview ? "skipped" : "skipped",
          reason: options.skipReview ? "cli_skip_review" : "dry_run_follow_up_skipped"
        });
        setAutomationPhase(projectRun, "promote", {
          status: promotionMode === "skip" ? "skipped" : "skipped",
          reason: promotionMode === "skip" ? "promotion_disabled" : "dry_run_follow_up_skipped"
        });
        if (!options.skipReview) {
          console.log(``);
          console.log(`## Review ${projectKey}`);
          console.log(`Skipped review because dry-run intake does not persist queue entries for the follow-up comparison.`);
        }
        if (promotionMode === "prepared" || promotionMode === "apply") {
          console.log(``);
          console.log(`## Promote ${projectKey}`);
          console.log(`Skipped promotion because dry-run intake does not persist queue entries.`);
        }
        finalizeAutomationProjectRun(projectRun);
        console.log(``);
        continue;
      }

      currentPhase = "re_evaluate";
      console.log(``);
      console.log(`## Re-Evaluate ${projectKey}`);
      const reEvaluateRun = await runReEvaluate(rootDir, config, {
        ...options,
        project: projectKey,
        allowedUrls: effectiveUrls,
        limit: options.automationReevaluateLimit,
        staleOnly: runPlan.executionPolicy?.reEvaluateScope === "stale_only"
      });
      setAutomationPhase(projectRun, "re_evaluate", {
        status: reEvaluateRun.targetRows > 0 ? "completed" : "skipped",
        reason: reEvaluateRun.targetRows > 0
          ? (runPlan.executionPolicy?.reEvaluateScope === "stale_only" ? "recomputed_stale_targets" : "recomputed_targets")
          : "no_targets",
        count: reEvaluateRun.updates.length,
        targetRows: reEvaluateRun.targetRows
      });

      if (options.skipReview) {
        setAutomationPhase(projectRun, "review", {
          status: "skipped",
          reason: "cli_skip_review"
        });
      } else {
        currentPhase = "review";
        console.log(``);
        console.log(`## Review ${projectKey}`);
        const reviewRun = await runReviewWatchlist(rootDir, config, {
          ...options,
          project: projectKey
        });
        setAutomationPhase(projectRun, "review", {
          status: "completed",
          reason: "run_complete",
          count: reviewRun.review?.items?.length ?? 0,
          reportPath: reviewRun.htmlReportPath
        });
      }

      if (promotionMode === "prepared" || promotionMode === "apply") {
        currentPhase = "promote";
        console.log(``);
        console.log(`## Promote ${projectKey}`);
        try {
          const promoteRun = await runPromote(rootDir, config, {
            ...options,
            project: projectKey,
            apply: promotionMode === "apply"
          });
          setAutomationPhase(projectRun, "promote", {
            status: "completed",
            reason: promotionMode === "apply" ? "promotion_applied" : "promotion_prepared",
            count: promoteRun.items.length,
            runDir: path.relative(rootDir, promoteRun.runDir)
          });
        } catch (error) {
          if (error.message.includes("No matching queue entries found for promotion")) {
            console.log(`No promotion candidates for ${projectKey}.`);
            setAutomationPhase(projectRun, "promote", {
              status: "skipped",
              reason: "no_promotion_candidates"
            });
          } else {
            throw error;
          }
        }
      } else {
        setAutomationPhase(projectRun, "promote", {
          status: "skipped",
          reason: "promotion_disabled"
        });
      }

      finalizeAutomationProjectRun(projectRun);
      console.log(``);
    } catch (error) {
      const failureClass = classifyAutomationFailure(error);
      const resumeRecommendation = buildRunResumeRecommendation({
        lifecycle: projectRun.metrics,
        failedPhase: currentPhase,
        failure: failureClass
      });
      if (currentPhase) {
        setAutomationPhase(projectRun, currentPhase, {
          status: "failed",
          reason: error.message
        });
      }
      projectRun.error = error.message;
      projectRun.errorClassification = failureClass;
      projectRun.errorResumeRecommendation = resumeRecommendation;
      skipPendingPhases(projectRun, "automation_aborted_after_phase_failure");
      finalizeAutomationProjectRun(projectRun);
      failures.push({
        projectKey,
        phase: currentPhase,
        error: error.message,
        resumeRecommendation,
        ...failureClass
      });
      console.log(``);
      console.log(`## Automation Failure ${projectKey}`);
      console.log(`- phase: ${currentPhase ?? "setup"}`);
      console.log(`- error: ${error.message}`);
      console.log(`- category: ${failureClass.category}`);
      console.log(`- retryable: ${failureClass.retryable ? "yes" : "no"}`);
      console.log(`- recommended_delay_minutes: ${failureClass.recommendedDelayMinutes ?? "-"}`);
      console.log(`- resume_strategy: ${resumeRecommendation.strategy}`);
      console.log(`- resume_next_action: ${resumeRecommendation.nextAction}`);
      console.log(``);
      if (!options.automationContinueOnProjectError) {
        break;
      }
    }
  }

  const counts = summarizeAutomationProjects(projectRuns);
  const summary = renderAutomationRunSummary({
    runId,
    createdAt,
    dryRun: options.dryRun,
    automationJob: options.automationJob,
    promotionMode,
    continueOnProjectError: options.automationContinueOnProjectError,
    reEvaluateLimit: options.automationReevaluateLimit,
    lockInfo: {
      status: lockInfo.status,
      lockPath: path.relative(rootDir, lockInfo.lockPath)
    },
    projectRuns
  });
  const opsReport = buildAutomationOpsReport({
    runId,
    createdAt,
    dryRun: options.dryRun,
    automationJob: options.automationJob,
    promotionMode,
    continueOnProjectError: options.automationContinueOnProjectError,
    reEvaluateLimit: options.automationReevaluateLimit,
    lockInfo: {
      status: lockInfo.status,
      lockPath: path.relative(rootDir, lockInfo.lockPath)
    },
    counts,
    failures,
    projectRuns
  });
  const manifest = {
    command: "automation-run",
    runId,
    createdAt,
    dryRun: options.dryRun,
    automationJob: options.automationJob,
    promotionMode,
    continueOnProjectError: options.automationContinueOnProjectError,
    forceLock: options.automationForceLock,
    lockTimeoutMinutes: options.automationLockTimeoutMinutes,
    reEvaluateLimit: options.automationReevaluateLimit,
    lockInfo: {
      status: lockInfo.status,
      lockPath: path.relative(rootDir, lockInfo.lockPath)
    },
    counts,
    failures,
    projectRuns
  };
  const runDir = await writeRunArtifacts({
    rootDir,
    config,
    projectKey: "automation",
    runId,
    manifest,
    summary,
    projectProfile: null,
    dryRun: options.dryRun,
    extraFiles: [
      {
        name: "ops.json",
        content: `${JSON.stringify(opsReport, null, 2)}\n`
      }
    ]
  });

  console.log(summary);
  console.log(`Automation run directory: ${path.relative(rootDir, runDir)}`);

  if (options.automationJob) {
    const { statePath, state } = await loadAutomationJobState(rootDir, config);
    const nextState = updateAutomationJobState(state, {
      jobName: options.automationJob,
      runId,
      createdAt,
      counts,
      failures,
      projectRuns
    });
    await writeAutomationJobState(rootDir, config, nextState, options.dryRun);
    console.log(`Automation job state: ${path.relative(rootDir, statePath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "automation-run",
    projectKey: options.project || config.defaultProject,
    mode: failures.length > 0 ? "partial_failure" : options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, runDir)
  });

  if (failures.length > 0) {
    const retryableFailures = failures.filter((failure) => failure.retryable);
    const nonRetryableFailures = failures.filter((failure) => !failure.retryable);
    const automationError = new Error(
      `Automation run had ${failures.length} failed project(s): ${failures.map((failure) => `${failure.projectKey}${failure.phase ? `@${failure.phase}` : ""}`).join(", ")}`
    );
    automationError.exitCode = nonRetryableFailures.length > 0
      ? Math.max(...nonRetryableFailures.map((failure) => failure.exitCode ?? 1))
      : retryableFailures.length > 0
        ? Math.max(...retryableFailures.map((failure) => failure.exitCode ?? 75))
        : 1;
    automationError.retryable = nonRetryableFailures.length === 0 && retryableFailures.length > 0;
    automationError.failures = failures;
    throw automationError;
  }

  return {
    runId,
    createdAt,
    runDir,
    projectRuns,
    counts
  };
  } finally {
    await releaseAutomationLock(lockInfo);
  }
}

function buildPromotionSummary({ runId, projectKey, createdAt, items, dryRun, apply }) {
  const lines = items.map((item) => {
    const mode = item.applied ? "applied" : "prepared";
    return `- ${item.repo.owner}/${item.repo.name} -> ${item.promotionDocRelativePath} (${mode}; queue_status=${item.queueStatus})`;
  });

  return `# Patternpilot Promotion Run

- run_id: ${runId}
- project: ${projectKey}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}
- apply: ${apply ? "yes" : "no"}

## Items

${lines.join("\n")}
`;
}

async function runPromote(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const queueRows = await loadQueueEntries(rootDir, config);
  const requestedUrls = options.urls.map((url) => normalizeGithubUrl(url).normalizedRepoUrl);

  let targets = queueRows.filter((row) => row.project_key === projectKey);
  if (requestedUrls.length > 0) {
    targets = targets.filter((row) => requestedUrls.includes(row.normalized_repo_url || row.repo_url));
  } else {
    const fromStatus = options.fromStatus || "pending_review";
    targets = targets.filter((row) => row.status === fromStatus);
  }

  if (options.limit && Number.isFinite(options.limit) && options.limit > 0) {
    targets = targets.slice(0, options.limit);
  }

  if (targets.length === 0) {
    throw new Error("No matching queue entries found for promotion. Run intake first or adjust --from-status.");
  }

  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const items = [];

  await ensureDirectory(path.join(rootDir, project.promotionRoot), options.dryRun);

  for (const queueEntry of targets) {
    const promotion = buildPromotionCandidate(queueEntry, binding);
    const promotionDocPath = buildPromotionDocPath(rootDir, project, promotion.repo);
    const promotionDocRelativePath = path.relative(rootDir, promotionDocPath);
    const promotionPacket = renderPromotionPacket({
      queueEntry,
      promotion,
      binding,
      createdAt,
      applyMode: options.apply
    });

    await writePromotionPacket({
      promotionDocPath,
      content: promotionPacket,
      dryRun: options.dryRun
    });

    let nextStatus = "promotion_prepared";
    if (options.apply) {
      await upsertLandkarteEntry(rootDir, promotion.landkarteRow, options.dryRun);
      await upsertManagedMarkdownBlock({
        filePath: resolveLearningsPath(rootDir, config),
        sectionKey: "learning-candidates",
        sectionTitle: "Patternpilot Candidate Learnings",
        blockKey: promotion.repo.slug,
        blockContent: renderLearningBlock(promotion, queueEntry),
        dryRun: options.dryRun
      });
      await upsertManagedMarkdownBlock({
        filePath: resolveDecisionsPath(rootDir, config),
        sectionKey: "decision-candidates",
        sectionTitle: "Patternpilot Candidate Decisions",
        blockKey: promotion.repo.slug,
        blockContent: renderDecisionBlock(promotion, queueEntry, binding),
        dryRun: options.dryRun
      });
      nextStatus = "promoted";
    }

    const queueUpdate = {
      ...queueEntry,
      project_key: projectKey,
      status: nextStatus,
      updated_at: createdAt,
      promotion_status: options.apply ? "applied" : "prepared",
      promotion_packet: promotionDocRelativePath,
      promoted_at: options.apply ? createdAt : queueEntry.promoted_at ?? ""
    };

    if (!options.dryRun) {
      await upsertQueueEntry(rootDir, config, queueUpdate);
    }

    items.push({
      repo: promotion.repo,
      applied: options.apply,
      queueStatus: nextStatus,
      promotionDocRelativePath
    });
  }

  const summary = buildPromotionSummary({
    runId,
    projectKey,
    createdAt,
    items,
    dryRun: options.dryRun,
    apply: options.apply
  });
  const manifest = {
    runId,
    projectKey,
    createdAt,
    dryRun: options.dryRun,
    apply: options.apply,
    items
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
  if (options.dryRun) {
    console.log("Dry run only: promotion files and curated artifacts were not written.");
  }
  await refreshContext(rootDir, config, {
    command: "promote",
    projectKey,
    mode: options.dryRun ? "dry_run" : options.apply ? "apply" : "prepare",
    reportPath: path.relative(rootDir, runDir)
  });

  return {
    runId,
    projectKey,
    createdAt,
    items,
    runDir
  };
}

async function main() {
  const rootDir = await loadPatternpilotRoot(import.meta.url);
  const envFiles = await loadEnvFiles(rootDir);
  const config = await loadConfig(rootDir);
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === "help" || command === "--help" || command === "-h") {
    printHelp();
    return;
  }

  if (command === "intake") {
    await runIntake(rootDir, config, options);
    return;
  }

  if (command === "on-demand" || command === "analyze") {
    await runOnDemand(rootDir, config, options);
    return;
  }

  if (command === "run-plan") {
    await runPlan(rootDir, config, options);
    return;
  }

  if (command === "run-drift") {
    await runDrift(rootDir, config, options);
    return;
  }

  if (command === "run-stability") {
    await runStability(rootDir, config, options);
    return;
  }

  if (command === "run-governance") {
    await runGovernance(rootDir, config, options);
    return;
  }
  if (command === "run-requalify") {
    await runRequalify(rootDir, config, options);
    return;
  }

  if (command === "doctor") {
    await runDoctor(rootDir, config, options, envFiles);
    return;
  }

  if (command === "automation-jobs") {
    await runAutomationJobs(rootDir, config, options);
    return;
  }

  if (command === "automation-dispatch") {
    await runAutomationDispatch(rootDir, config, options);
    return;
  }

  if (command === "automation-alerts") {
    await runAutomationAlerts(rootDir, config, options);
    return;
  }

  if (command === "automation-job-clear") {
    await runAutomationJobClear(rootDir, config, options);
    return;
  }

  if (command === "discover") {
    await runDiscover(rootDir, config, options);
    return;
  }

  if (command === "discover-import") {
    await runDiscoverImport(rootDir, config, options);
    return;
  }

  if (command === "policy-audit") {
    await runDiscover(rootDir, config, {
      ...options,
      commandName: "policy-audit",
      discoveryPolicyMode: "audit"
    });
    return;
  }

  if (command === "policy-review") {
    await runPolicyReview(rootDir, config, options);
    return;
  }

  if (command === "policy-compare") {
    await runPolicyCompare(rootDir, config, options);
    return;
  }

  if (command === "policy-calibrate") {
    await runPolicyCalibrate(rootDir, config, options);
    return;
  }

  if (command === "policy-pack") {
    await runPolicyPack(rootDir, config, options);
    return;
  }

  if (command === "policy-workbench") {
    await runPolicyWorkbench(rootDir, config, options);
    return;
  }

  if (command === "policy-workbench-review") {
    await runPolicyWorkbenchReview(rootDir, config, options);
    return;
  }

  if (command === "policy-suggest") {
    await runPolicySuggest(rootDir, config, options);
    return;
  }

  if (command === "policy-trial") {
    await runPolicyTrial(rootDir, config, options);
    return;
  }

  if (command === "policy-cycle") {
    await runPolicyCycle(rootDir, config, options);
    return;
  }

  if (command === "policy-handoff") {
    await runPolicyHandoff(rootDir, config, options);
    return;
  }

  if (command === "policy-curate") {
    await runPolicyCurate(rootDir, config, options);
    return;
  }

  if (command === "policy-curation-review") {
    await runPolicyCurationReview(rootDir, config, options);
    return;
  }

  if (command === "policy-curation-batch-review") {
    await runPolicyCurationBatchReview(rootDir, config, options);
    return;
  }

  if (command === "policy-curation-batch-plan") {
    await runPolicyCurationBatchPlan(rootDir, config, options);
    return;
  }

  if (command === "policy-curation-batch-apply") {
    await runPolicyCurationBatchApply(rootDir, config, options);
    return;
  }

  if (command === "policy-curation-apply") {
    await runPolicyCurationApply(rootDir, config, options);
    return;
  }

  if (command === "policy-apply") {
    await runPolicyApply(rootDir, config, options);
    return;
  }

  if (command === "review-watchlist") {
    await runReviewWatchlist(rootDir, config, options);
    return;
  }

  if (command === "re-evaluate") {
    await runReEvaluate(rootDir, config, options);
    return;
  }

  if (command === "refresh-context") {
    await runRefreshContext(rootDir, config);
    return;
  }

  if (command === "init-env") {
    await runInitEnv(rootDir, options);
    return;
  }

  if (command === "automation-run") {
    await runAutomation(rootDir, config, options);
    return;
  }

  if (command === "init-project") {
    await runInitProject(rootDir, config, options);
    return;
  }

  if (command === "discover-workspace") {
    await runDiscoverWorkspace(rootDir, config, options);
    return;
  }

  if (command === "setup-checklist") {
    runSetupChecklist(options);
    return;
  }

  if (command === "sync-watchlist") {
    await runSyncWatchlist(rootDir, config, options);
    return;
  }

  if (command === "sync-all-watchlists") {
    await runSyncAllWatchlists(rootDir, config, options);
    return;
  }

  if (command === "list-projects") {
    printProjectList(rootDir, config);
    return;
  }

  if (command === "show-project") {
    await runShowProject(rootDir, config, options);
    return;
  }

  if (command === "promote") {
    await runPromote(rootDir, config, options);
    return;
  }

  throw new Error(`Unknown command '${command}'.`);
}

main().catch((error) => {
  console.error(`Patternpilot failed: ${error.message}`);
  process.exitCode = error.exitCode ?? 1;
});
