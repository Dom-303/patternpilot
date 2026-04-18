import fs from "node:fs/promises";
import path from "node:path";
import {
  appendUrlsToWatchlist,
  buildIntakeDocPath,
  buildLandkarteCandidate,
  buildProjectAlignment,
  buildProjectRelevanceNote,
  collectUrls,
  createRunId,
  discoverGithubCandidates,
  discoverImportedCandidates,
  enrichGithubRepo,
  ensureDirectory,
  guessClassification,
  indexPreloadedCandidates,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadProjectDiscoveryPolicy,
  loadProjectProfile,
  loadQueueEntries,
  normalizeGithubUrl,
  renderDiscoveryHtmlReport,
  renderDiscoverySummary,
  renderIntakeDoc,
  renderRunSummary,
  upsertQueueEntry,
  writeIntakeDoc,
  writeLatestReportPointers,
  writeRunArtifacts
} from "../../lib/index.mjs";
import {
  buildGoldenPathCommands,
  renderNextCommandSections
} from "../shared/golden-path.mjs";
import {
  buildCandidateEvaluation,
  computeRulesFingerprint,
  deriveDisposition
} from "../../lib/classification/evaluation.mjs";
import {
  loadDiscoveryFeedback,
  writeDiscoveryFeedbackSnapshot
} from "../../lib/discovery/feedback.mjs";
import { refreshContext } from "../shared/runtime-helpers.mjs";

function buildIntakeCommandGuidance(projectKey, items = []) {
  const commands = buildGoldenPathCommands(projectKey);
  const hasNew = items.some((item) => String(item.action ?? "").includes("new"));
  const hasKnown = items.some((item) => String(item.action ?? "").includes("known"));
  const hasEnrichmentFailures = items.some((item) => item.enrichment?.status === "failed");

  if (!hasNew && hasKnown) {
    return {
      primary: "npm run re-evaluate -- --project " + projectKey,
      additional: [commands.reviewWatchlist, commands.showProject]
    };
  }

  if (hasEnrichmentFailures) {
    return {
      primary: commands.reviewWatchlist,
      additional: ["npm run doctor", commands.releaseCheck]
    };
  }

  return {
    primary: commands.reviewWatchlist,
    additional: [commands.releaseCheck]
  };
}

export async function runIntake(rootDir, config, options) {
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
  const existingQueueRows = await loadQueueEntries(rootDir, config);
  const knownProjectUrls = new Set(
    existingQueueRows
      .filter((row) => row.project_key === projectKey)
      .map((row) => row.normalized_repo_url || row.repo_url)
      .filter(Boolean)
  );

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
      discovery_score: preloadedCandidate ? String(preloadedCandidate.discoveryScore ?? "") : "",
      discovery_class: preloadedCandidate?.discoveryClass ?? "",
      discovery_evidence_grade: preloadedCandidate?.discoveryEvidence?.grade ?? "",
      discovery_query_labels: preloadedCandidate?.queryLabels?.join(",") ?? "",
      discovery_query_families: preloadedCandidate?.queryFamilies?.join(",") ?? "",
      discovery_feedback_positive: preloadedCandidate?.discoveryFeedbackMatch?.positiveSignals?.join(",") ?? "",
      discovery_feedback_negative: preloadedCandidate?.discoveryFeedbackMatch?.negativeSignals?.join(",") ?? "",
      category_guess: guess.category,
      pattern_family_guess: guess.patternFamily,
      main_layer_guess: guess.mainLayer,
      project_gap_area_guess: guess.gapArea,
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
      learning_for_project: landkarteCandidate.learning_for_project,
      possible_implication: landkarteCandidate.possible_implication,
      decision_guess: landkarteCandidate.decision,
      project_relevance_guess: landkarteCandidate.project_relevance,
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
    const wasKnown = knownProjectUrls.has(repo.normalizedRepoUrl);
    const action =
      options.dryRun
        ? wasKnown
          ? "planned_known_repo"
          : "planned_new_repo"
        : wasKnown
          ? docWrite.created
            ? "known_repo_doc_refreshed"
            : "known_repo_reused_doc"
          : docWrite.created
            ? "new_repo_created"
            : "new_repo_reused_doc";

    items.push({
      repo,
      guess,
      enrichment,
      landkarteCandidate,
      candidate: decisionFields,
      projectAlignment,
      action,
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
    command: "intake",
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
  console.log(``);
  console.log(renderNextCommandSections(buildIntakeCommandGuidance(projectKey, items)));
  await refreshContext(rootDir, config, {
    command: "intake",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, runDir)
  });

  return { runId, projectKey, createdAt, items, runDir };
}

export async function runDiscover(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const commandName = options.commandName ?? "discover";
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);
  const discoveryFeedback = await loadDiscoveryFeedback(rootDir, config, projectKey);
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
      discoveryPolicy,
      discoveryFeedback
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
  const feedbackSummaryMarkdown = [
    "# Discovery Feedback Snapshot",
    "",
    `- project: ${projectKey}`,
    `- created_at: ${createdAt}`,
    `- positive_rows: ${discoveryFeedback.totals?.positive ?? 0}`,
    `- negative_rows: ${discoveryFeedback.totals?.negative ?? 0}`,
    `- observe_rows: ${discoveryFeedback.totals?.observe ?? 0}`,
    `- pending_rows: ${discoveryFeedback.totals?.pending ?? 0}`,
    `- feedback_strength: ${discoveryFeedback.feedbackStrength ?? 0}`,
    "",
    "## Preferred Terms",
    "",
    (discoveryFeedback.preferredTerms?.length ?? 0) > 0
      ? discoveryFeedback.preferredTerms.map((item) => `- ${item}`).join("\n")
      : "- none",
    "",
    "## Avoid Terms",
    "",
    (discoveryFeedback.avoidTerms?.length ?? 0) > 0
      ? discoveryFeedback.avoidTerms.map((item) => `- ${item}`).join("\n")
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
    discovery,
    discoveryFeedback
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
      },
      {
        name: "discovery-feedback.md",
        content: feedbackSummaryMarkdown
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
  const feedbackSnapshot = await writeDiscoveryFeedbackSnapshot(
    rootDir,
    projectKey,
    discoveryFeedback,
    options.dryRun
  );

  console.log(summary);
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);
  console.log(`Policy calibration: ${path.relative(rootDir, path.join(runDir, "policy-calibration.md"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`Discovery feedback: ${path.relative(rootDir, feedbackSnapshot.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
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

export async function runDiscoverImport(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  if (!options.file) {
    throw new Error("discover-import requires --file <candidate-json>.");
  }
  const { project, binding } = await loadProjectBinding(rootDir, config, projectKey);
  const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
  const discoveryPolicy = await loadProjectDiscoveryPolicy(rootDir, project, binding);
  const projectProfile = await loadProjectProfile(rootDir, project, binding, alignmentRules);
  const discoveryFeedback = await loadDiscoveryFeedback(rootDir, config, projectKey);
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
      discoveryPolicy,
      discoveryFeedback
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
  const feedbackSummaryMarkdown = [
    "# Discovery Feedback Snapshot",
    "",
    `- project: ${projectKey}`,
    `- created_at: ${createdAt}`,
    `- imported: yes`,
    `- positive_rows: ${discoveryFeedback.totals?.positive ?? 0}`,
    `- negative_rows: ${discoveryFeedback.totals?.negative ?? 0}`,
    `- observe_rows: ${discoveryFeedback.totals?.observe ?? 0}`,
    `- pending_rows: ${discoveryFeedback.totals?.pending ?? 0}`,
    "",
    "## Preferred Terms",
    "",
    (discoveryFeedback.preferredTerms?.length ?? 0) > 0
      ? discoveryFeedback.preferredTerms.map((item) => `- ${item}`).join("\n")
      : "- none",
    "",
    "## Avoid Terms",
    "",
    (discoveryFeedback.avoidTerms?.length ?? 0) > 0
      ? discoveryFeedback.avoidTerms.map((item) => `- ${item}`).join("\n")
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
    discovery,
    discoveryFeedback
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
      },
      {
        name: "discovery-feedback.md",
        content: feedbackSummaryMarkdown
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
  const feedbackSnapshot = await writeDiscoveryFeedbackSnapshot(
    rootDir,
    projectKey,
    discoveryFeedback,
    options.dryRun
  );

  console.log(summary);
  console.log(`Run directory: ${path.relative(rootDir, runDir)}`);
  console.log(`Policy calibration: ${path.relative(rootDir, path.join(runDir, "policy-calibration.md"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`Discovery feedback: ${path.relative(rootDir, feedbackSnapshot.markdownPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
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
