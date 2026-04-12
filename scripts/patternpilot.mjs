import path from "node:path";
import {
  buildIntakeDocPath,
  buildLandkarteCandidate,
  buildProjectRelevanceNote,
  collectUrls,
  createRunId,
  enrichGithubRepo,
  ensureDirectory,
  guessClassification,
  loadConfig,
  loadPatternpilotRoot,
  loadProjectBinding,
  normalizeGithubUrl,
  parseArgs,
  renderIntakeDoc,
  renderRunSummary,
  upsertQueueEntry,
  writeIntakeDoc,
  writeRunArtifacts
} from "../lib/patternpilot-engine.mjs";

function printHelp() {
  console.log(`Patternpilot CLI

Commands:
  intake        Create intake queue entries and dossiers from GitHub URLs
  show-project  Show the binding and reference context for a project

Examples:
  npm run intake -- --project eventbear-worker https://github.com/City-Bureau/city-scrapers
  npm run intake -- --project eventbear-worker --file links.txt --dry-run
  npm run intake -- --project eventbear-worker --skip-enrich https://github.com/City-Bureau/city-scrapers
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

  if (command === "show-project") {
    await runShowProject(rootDir, config, options);
    return;
  }

  throw new Error(`Unknown command '${command}'.`);
}

main().catch((error) => {
  console.error(`Patternpilot failed: ${error.message}`);
  process.exitCode = 1;
});
