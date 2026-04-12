import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeReadFile, parseEnvContent } from "./utils.mjs";

export async function loadPatternpilotRoot(scriptUrl) {
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

export async function loadConfig(rootDir) {
  const raw = await fs.readFile(path.join(rootDir, "patternpilot.config.json"), "utf8");
  return JSON.parse(raw);
}

export async function writeConfig(rootDir, config) {
  const configPath = path.join(rootDir, "patternpilot.config.json");
  await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export function resolveQueuePath(rootDir, config) {
  return path.join(rootDir, config.queueFile);
}

export function resolveLandkartePath(rootDir, config) {
  return path.join(rootDir, config.landkarteFile ?? "knowledge/repo_landkarte.csv");
}

export function resolveLearningsPath(rootDir, config) {
  return path.join(rootDir, config.learningsFile ?? "knowledge/repo_learnings.md");
}

export function resolveDecisionsPath(rootDir, config) {
  return path.join(rootDir, config.decisionsFile ?? "knowledge/repo_decisions.md");
}

export async function loadEnvFiles(rootDir) {
  const relativePaths = [
    ".env",
    ".env.local",
    "deployment/github-app/.env",
    "deployment/github-app/.env.local"
  ];
  const loaded = [];

  for (const relativePath of relativePaths) {
    const absolutePath = path.join(rootDir, relativePath);
    const content = await safeReadFile(absolutePath);
    if (!content) {
      continue;
    }
    let count = 0;
    for (const [key, value] of parseEnvContent(content)) {
      if (!process.env[key]) {
        process.env[key] = value;
      }
      count += 1;
    }
    loaded.push({
      path: relativePath,
      entries: count
    });
  }

  return loaded;
}

export function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  const options = {
    project: null,
    file: null,
    notes: "",
    dryRun: false,
    force: false,
    skipEnrich: false,
    apply: false,
    fromStatus: null,
    limit: null,
    target: null,
    label: null,
    workspaceRoot: null,
    makeDefault: false,
    offline: false,
    maxDepth: 2,
    promotionMode: "skip",
    allProjects: false,
    json: false,
    intake: false,
    appendWatchlist: false,
    discoveryProfile: "balanced",
    analysisProfile: "balanced",
    analysisDepth: "standard",
    reportView: "standard",
    query: "",
    urls: []
  };

  while (args.length > 0) {
    const token = args.shift();
    if (token === "--project") {
      options.project = args.shift() ?? null;
      continue;
    }
    if (token === "--file") {
      options.file = args.shift() ?? null;
      continue;
    }
    if (token === "--notes") {
      options.notes = args.shift() ?? "";
      continue;
    }
    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }
    if (token === "--force") {
      options.force = true;
      continue;
    }
    if (token === "--skip-enrich") {
      options.skipEnrich = true;
      continue;
    }
    if (token === "--apply") {
      options.apply = true;
      continue;
    }
    if (token === "--from-status") {
      options.fromStatus = args.shift() ?? null;
      continue;
    }
    if (token === "--limit") {
      const rawValue = args.shift();
      options.limit = rawValue ? Number.parseInt(rawValue, 10) : null;
      continue;
    }
    if (token === "--target") {
      options.target = args.shift() ?? null;
      continue;
    }
    if (token === "--label") {
      options.label = args.shift() ?? null;
      continue;
    }
    if (token === "--workspace-root") {
      options.workspaceRoot = args.shift() ?? null;
      continue;
    }
    if (token === "--make-default") {
      options.makeDefault = true;
      continue;
    }
    if (token === "--offline") {
      options.offline = true;
      continue;
    }
    if (token === "--max-depth") {
      const rawValue = args.shift();
      options.maxDepth = rawValue ? Number.parseInt(rawValue, 10) : 2;
      continue;
    }
    if (token === "--promotion-mode") {
      options.promotionMode = args.shift() ?? "skip";
      continue;
    }
    if (token === "--all-projects") {
      options.allProjects = true;
      continue;
    }
    if (token === "--json") {
      options.json = true;
      continue;
    }
    if (token === "--intake") {
      options.intake = true;
      continue;
    }
    if (token === "--append-watchlist") {
      options.appendWatchlist = true;
      continue;
    }
    if (token === "--discovery-profile") {
      options.discoveryProfile = args.shift() ?? "balanced";
      continue;
    }
    if (token === "--analysis-profile") {
      options.analysisProfile = args.shift() ?? "balanced";
      continue;
    }
    if (token === "--analysis-depth") {
      options.analysisDepth = args.shift() ?? "standard";
      continue;
    }
    if (token === "--report-view") {
      options.reportView = args.shift() ?? "standard";
      continue;
    }
    if (token === "--query") {
      options.query = args.shift() ?? "";
      continue;
    }
    options.urls.push(token);
  }

  return { command, options };
}
