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
    contractOnly: false,
    fromStatus: null,
    installationId: null,
    limit: null,
    target: null,
    targetCommand: null,
    targetHook: null,
    targetCwd: null,
    payloadFile: null,
    eventKey: null,
    deliveryId: null,
    githubAction: null,
    githubEvent: null,
    headersFile: null,
    webhookSecret: null,
    signature: null,
    hookMarkdownFile: null,
    hookJsonFile: null,
    hookPrint: false,
    runId: null,
    manifest: null,
    policyFile: null,
    contractFile: null,
    workerId: "local-worker",
    serviceLeaseMinutes: 15,
    maxServiceAttempts: 3,
    workbenchDir: null,
    handoffDir: null,
    cycleDir: null,
    curationDir: null,
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
    preparePromotions: false,
    skipDiscovery: false,
    skipReview: false,
    staleOnly: false,
    automationMaxNewCandidates: 5,
    automationMinConfidence: "medium",
    automationJob: null,
    automationContinueOnProjectError: false,
    automationForceLock: false,
    automationLockTimeoutMinutes: 180,
    automationReevaluateLimit: null,
    discoveryProfile: "balanced",
    discoveryPolicyMode: "enforce",
    analysisProfile: "balanced",
    analysisDepth: "standard",
    reportView: "standard",
    query: "",
    scope: null,
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
    if (token === "--contract-only") {
      options.contractOnly = true;
      continue;
    }
    if (token === "--from-status") {
      options.fromStatus = args.shift() ?? null;
      continue;
    }
    if (token === "--installation-id") {
      const rawValue = args.shift();
      options.installationId = rawValue ? Number.parseInt(rawValue, 10) : null;
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
    if (token === "--target-command") {
      options.targetCommand = args.shift() ?? null;
      continue;
    }
    if (token === "--target-hook") {
      options.targetHook = args.shift() ?? null;
      continue;
    }
    if (token === "--target-cwd") {
      options.targetCwd = args.shift() ?? null;
      continue;
    }
    if (token === "--payload-file") {
      options.payloadFile = args.shift() ?? null;
      continue;
    }
    if (token === "--event-key") {
      options.eventKey = args.shift() ?? null;
      continue;
    }
    if (token === "--delivery-id") {
      options.deliveryId = args.shift() ?? null;
      continue;
    }
    if (token === "--github-action") {
      options.githubAction = args.shift() ?? null;
      continue;
    }
    if (token === "--github-event") {
      options.githubEvent = args.shift() ?? null;
      continue;
    }
    if (token === "--headers-file") {
      options.headersFile = args.shift() ?? null;
      continue;
    }
    if (token === "--webhook-secret") {
      options.webhookSecret = args.shift() ?? null;
      continue;
    }
    if (token === "--signature") {
      options.signature = args.shift() ?? null;
      continue;
    }
    if (token === "--hook-markdown-file") {
      options.hookMarkdownFile = args.shift() ?? null;
      continue;
    }
    if (token === "--hook-json-file") {
      options.hookJsonFile = args.shift() ?? null;
      continue;
    }
    if (token === "--hook-print") {
      options.hookPrint = true;
      continue;
    }
    if (token === "--run-id") {
      options.runId = args.shift() ?? null;
      continue;
    }
    if (token === "--manifest") {
      options.manifest = args.shift() ?? null;
      continue;
    }
    if (token === "--policy-file") {
      options.policyFile = args.shift() ?? null;
      continue;
    }
    if (token === "--contract-file") {
      options.contractFile = args.shift() ?? null;
      continue;
    }
    if (token === "--worker-id") {
      options.workerId = args.shift() ?? "local-worker";
      continue;
    }
    if (token === "--service-lease-minutes") {
      const rawValue = args.shift();
      options.serviceLeaseMinutes = rawValue ? Number.parseInt(rawValue, 10) : 15;
      continue;
    }
    if (token === "--max-service-attempts") {
      const rawValue = args.shift();
      options.maxServiceAttempts = rawValue ? Number.parseInt(rawValue, 10) : 3;
      continue;
    }
    if (token === "--workbench-dir") {
      options.workbenchDir = args.shift() ?? null;
      continue;
    }
    if (token === "--handoff-dir") {
      options.handoffDir = args.shift() ?? null;
      continue;
    }
    if (token === "--cycle-dir") {
      options.cycleDir = args.shift() ?? null;
      continue;
    }
    if (token === "--curation-dir") {
      options.curationDir = args.shift() ?? null;
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
    if (token === "--prepare-promotions") {
      options.preparePromotions = true;
      continue;
    }
    if (token === "--skip-discovery") {
      options.skipDiscovery = true;
      continue;
    }
    if (token === "--skip-review") {
      options.skipReview = true;
      continue;
    }
    if (token === "--stale-only") {
      options.staleOnly = true;
      continue;
    }
    if (token === "--automation-max-new-candidates") {
      const rawValue = args.shift();
      options.automationMaxNewCandidates = rawValue ? Number.parseInt(rawValue, 10) : 5;
      continue;
    }
    if (token === "--automation-min-confidence") {
      options.automationMinConfidence = args.shift() ?? "medium";
      continue;
    }
    if (token === "--automation-job") {
      options.automationJob = args.shift() ?? null;
      continue;
    }
    if (token === "--automation-continue-on-project-error") {
      options.automationContinueOnProjectError = true;
      continue;
    }
    if (token === "--automation-force-lock") {
      options.automationForceLock = true;
      continue;
    }
    if (token === "--automation-lock-timeout-minutes") {
      const rawValue = args.shift();
      options.automationLockTimeoutMinutes = rawValue ? Number.parseInt(rawValue, 10) : 180;
      continue;
    }
    if (token === "--automation-re-evaluate-limit") {
      const rawValue = args.shift();
      options.automationReevaluateLimit = rawValue ? Number.parseInt(rawValue, 10) : null;
      continue;
    }
    if (token === "--discovery-profile") {
      options.discoveryProfile = args.shift() ?? "balanced";
      continue;
    }
    if (token === "--discovery-policy-mode") {
      options.discoveryPolicyMode = args.shift() ?? "enforce";
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
    if (token === "--scope") {
      options.scope = args.shift() ?? null;
      continue;
    }
    options.urls.push(token);
  }

  return { command, options };
}
