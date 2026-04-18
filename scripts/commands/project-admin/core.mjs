import path from "node:path";

import {
  buildSetupChecklist,
  discoverWorkspaceProjects,
  initializeEnvFiles,
  initializeProjectBinding,
  inspectGithubAppAuth,
  inspectGithubAuth,
  loadProjectBinding,
  runGithubDoctor
} from "../../../lib/index.mjs";
import { refreshContext } from "./shared.mjs";

export async function runRefreshContext(rootDir, config) {
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

export function runGettingStarted(rootDir, config) {
  const projects = Object.entries(config.projects ?? {});
  const hasProjects = projects.length > 0;
  const defaultProject = config.defaultProject ?? null;

  console.log(`# Patternpilot Getting Started`);
  console.log(``);
  console.log(`Patternpilot arbeitet immer auf ein Zielprojekt hin.`);
  console.log(`Du bindest zuerst ein eigenes Repo an und nutzt danach Intake, Watchlist und Review fuer dieses Ziel.`);
  console.log(``);

  console.log(`## Frischer Start`);
  console.log(`1. Repository installieren und Abhaengigkeiten laden`);
  console.log(`   npm install`);
  console.log(`2. Lokale Voraussetzungen pruefen`);
  console.log(`   npm run doctor -- --offline`);
  console.log(`3. Eigenes Zielrepo anbinden`);
  console.log(`   npm run init:project -- --project my-project --target ../my-project --label "My Project"`);
  console.log(`4. Dann entweder direkt ein Repo intaken`);
  console.log(`   npm run intake -- --project my-project https://github.com/example/repo`);
  console.log(`5. Oder zuerst eine Watchlist pflegen`);
  console.log(`   edit bindings/my-project/WATCHLIST.txt`);
  console.log(`   npm run sync:watchlist -- --project my-project`);
  console.log(``);

  console.log(`## Was Danach Entsteht`);
  console.log(`- bindings/<project>/: technische Zielrepo-Bindung`);
  console.log(`- projects/<project>/: lesbarer Arbeits- und Ergebnisraum`);
  console.log(`- runs/<project>/: Laufprotokolle`);
  console.log(`- state/repo_intake_queue.csv: operative Intake-Queue`);
  console.log(``);

  if (!hasProjects) {
    console.log(`## Aktueller Zustand`);
    console.log(`- configured_projects: 0`);
    console.log(`- next_command: npm run init:project -- --project my-project --target ../my-project --label "My Project"`);
    return;
  }

  console.log(`## Aktueller Zustand`);
  console.log(`- configured_projects: ${projects.length}`);
  console.log(`- default_project: ${defaultProject ?? "-"}`);
  for (const [projectKey, project] of projects) {
    console.log(`- ${projectKey}: ${path.resolve(rootDir, project.projectRoot)} (${project.label ?? projectKey})`);
  }
  console.log(``);
  console.log(`## Naechste Sinnvolle Befehle`);
  console.log(`- show current binding: npm run show:project -- --project ${defaultProject ?? "<project>"}`);
  console.log(`- intake one repo: npm run intake -- --project ${defaultProject ?? "<project>"} https://github.com/example/repo`);
  console.log(`- sync watchlist: npm run sync:watchlist -- --project ${defaultProject ?? "<project>"}`);
  console.log(`- review watchlist: npm run review:watchlist -- --project ${defaultProject ?? "<project>"} --dry-run`);
}

export async function runShowProject(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const { project, binding, bindingPath } = await loadProjectBinding(rootDir, config, projectKey);
  const projectRoot = path.resolve(rootDir, project.projectRoot);
  const workspaceRoot = project.projectContextFile
    ? path.resolve(rootDir, path.dirname(project.projectContextFile))
    : path.join(rootDir, "projects", projectKey);

  console.log(`# Patternpilot Project Binding`);
  console.log(``);
  console.log(`- project: ${projectKey}`);
  console.log(`- label: ${binding.projectLabel ?? project.label}`);
  console.log(`- project_root: ${projectRoot}`);
  console.log(`- workspace_root: ${workspaceRoot}`);
  console.log(`- binding_file: ${path.relative(rootDir, bindingPath)}`);
  console.log(`- context_file: ${project.projectContextFile ?? "-"}`);
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

export function printProjectList(rootDir, config) {
  console.log(`# Patternpilot Projects`);
  console.log(``);
  console.log(`- default_project: ${config.defaultProject ?? "-"}`);
  console.log(``);
  console.log(`## Configured Projects`);
  for (const [projectKey, project] of Object.entries(config.projects ?? {})) {
    console.log(`- ${projectKey}: ${path.resolve(rootDir, project.projectRoot)} (${project.label ?? projectKey})`);
  }
}

export async function runDoctor(rootDir, config, options, envFiles) {
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

export async function runInitEnv(rootDir, options) {
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

export function runSetupChecklist(options) {
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

export async function runInitProject(rootDir, config, options) {
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

export async function runDiscoverWorkspace(rootDir, config, options) {
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
