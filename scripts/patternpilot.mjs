import path from "node:path";
import {
  buildPromotionCandidate,
  buildPromotionDocPath,
  buildIntakeDocPath,
  buildLandkarteCandidate,
  buildProjectAlignment,
  buildProjectRelevanceNote,
  collectUrls,
  createRunId,
  discoverWorkspaceProjects,
  enrichGithubRepo,
  ensureDirectory,
  guessClassification,
  initializeProjectBinding,
  inspectGithubAuth,
  loadConfig,
  loadQueueEntries,
  loadProjectAlignmentRules,
  loadPatternpilotRoot,
  loadProjectBinding,
  loadProjectProfile,
  normalizeGithubUrl,
  parseArgs,
  renderIntakeDoc,
  renderLearningBlock,
  renderDecisionBlock,
  renderPromotionPacket,
  renderRunSummary,
  runGithubDoctor,
  upsertQueueEntry,
  upsertLandkarteEntry,
  upsertManagedMarkdownBlock,
  writeIntakeDoc,
  writePromotionPacket,
  writeRunArtifacts
} from "../lib/patternpilot-engine.mjs";

function printHelp() {
  console.log(`Patternpilot CLI

Commands:
  automation-run  Run watchlist intake across one or all projects and optionally promote
  doctor        Show GitHub auth, rate-limit and workspace readiness
  init-project  Bind a new local repo/workspace project to Patternpilot
  discover-workspace  Scan workspace roots for git repos and binding candidates
  list-projects Show configured Patternpilot project bindings
  intake        Create intake queue entries and dossiers from GitHub URLs
  promote       Prepare or apply promotion candidates from queue to curated artifacts
  sync-all-watchlists  Run watchlist intake across all configured projects
  sync-watchlist  Run intake against the configured project watchlist file
  show-project  Show the binding and reference context for a project

Examples:
  npm run automation:run -- --all-projects --promotion-mode prepared --dry-run
  npm run doctor -- --offline
  npm run init:project -- --project sample-worker --target ../sample-worker --label "Sample Worker"
  npm run discover:workspace
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

  await ensureDirectory(path.join(rootDir, project.intakeRoot), options.dryRun);

  for (const rawUrl of urls) {
    const repo = normalizeGithubUrl(rawUrl);
    let enrichment = await enrichGithubRepo(repo, config, {
      skipEnrich: options.skipEnrich
    });
    if (!options.skipEnrich && enrichment.status === "failed") {
      enrichment = await enrichGithubRepo(repo, config, {
        skipEnrich: false
      });
    }
    if (process.env.PATTERNPILOT_DEBUG === "1") {
      console.error(
        `[patternpilot-debug] enrichment ${repo.owner}/${repo.name}: ${JSON.stringify(enrichment)}`
      );
    }
    const guess = guessClassification(repo, enrichment);
    const landkarteCandidate = buildLandkarteCandidate(repo, guess, enrichment);
    const projectAlignment = buildProjectAlignment(
      repo,
      guess,
      enrichment,
      projectProfile,
      alignmentRules
    );
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
      notes: options.notes
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
      notes: options.notes
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
  console.log(`- watchlist_file: ${project.watchlistFile ?? "-"}`);
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

async function runDoctor(rootDir, config, options) {
  const auth = inspectGithubAuth(config);
  const doctor = await runGithubDoctor(config, { offline: options.offline });
  const discovered = await discoverWorkspaceProjects(rootDir, config, {
    workspaceRoot: options.workspaceRoot,
    maxDepth: options.maxDepth
  });
  const pluginScaffoldPath = path.join(rootDir, "plugins", "patternpilot-workspace", ".codex-plugin", "plugin.json");
  const marketplacePath = path.join(rootDir, ".agents", "plugins", "marketplace.json");
  const githubAppScaffoldPath = path.join(rootDir, "deployment", "github-app", "README.md");
  const automationOpsPath = path.join(rootDir, "automation", "README.md");

  console.log(`# Patternpilot Doctor`);
  console.log(``);
  console.log(`## GitHub Auth`);
  console.log(`- auth_mode: ${auth.authMode}`);
  console.log(`- auth_source: ${auth.authSource ?? "-"}`);
  console.log(`- token_present: ${auth.tokenPresent ? "yes" : "no"}`);
  console.log(`- configured_env_vars: ${auth.configuredEnvVars.join(", ") || "-"}`);
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
    return;
  }
  await runIntake(rootDir, config, {
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

async function runAutomation(rootDir, config, options) {
  const projectEntries = Object.entries(config.projects ?? {});
  const targetEntries = options.project && !options.allProjects
    ? projectEntries.filter(([projectKey]) => projectKey === options.project)
    : projectEntries;
  const promotionMode = options.promotionMode ?? "skip";

  console.log(`# Patternpilot Automation Run`);
  console.log(``);
  console.log(`- projects: ${targetEntries.length}`);
  console.log(`- promotion_mode: ${promotionMode}`);
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
      console.log(``);
      continue;
    }

    console.log(`## Intake ${projectKey}`);
    await runIntake(rootDir, config, {
      ...options,
      project: projectKey,
      file: null,
      urls: watchlistUrls
    });

    if (promotionMode === "prepared" || promotionMode === "apply") {
      if (options.dryRun) {
        console.log(``);
        console.log(`## Promote ${projectKey}`);
        console.log(`Skipped promotion because dry-run intake does not persist queue entries.`);
        console.log(``);
        continue;
      }
      console.log(``);
      console.log(`## Promote ${projectKey}`);
      try {
        await runPromote(rootDir, config, {
          ...options,
          project: projectKey,
          apply: promotionMode === "apply"
        });
      } catch (error) {
        if (error.message.includes("No matching queue entries found for promotion")) {
          console.log(`No promotion candidates for ${projectKey}.`);
        } else {
          throw error;
        }
      }
    }

    console.log(``);
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
        filePath: path.join(rootDir, "repo_learnings.md"),
        sectionKey: "learning-candidates",
        sectionTitle: "Patternpilot Candidate Learnings",
        blockKey: promotion.repo.slug,
        blockContent: renderLearningBlock(promotion, queueEntry),
        dryRun: options.dryRun
      });
      await upsertManagedMarkdownBlock({
        filePath: path.join(rootDir, "repo_decisions.md"),
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
}

async function main() {
  const rootDir = await loadPatternpilotRoot(import.meta.url);
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

  if (command === "doctor") {
    await runDoctor(rootDir, config, options);
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
  process.exitCode = 1;
});
