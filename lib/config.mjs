import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeReadFile, parseEnvContent } from "./utils.mjs";

const CONFIG_META = Symbol("patternpilot.config.meta");

export async function loadPatternpilotRoot(scriptUrl) {
  if (process.env.PATTERNPILOT_ROOT) {
    return path.resolve(process.env.PATTERNPILOT_ROOT);
  }
  return path.resolve(path.dirname(fileURLToPath(scriptUrl)), "..");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function mergeConfigLayers(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return overlay ?? base;
  }

  const merged = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value === undefined) {
      continue;
    }
    if (isPlainObject(value) && isPlainObject(base[key])) {
      merged[key] = mergeConfigLayers(base[key], value);
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

function attachConfigMeta(config, meta) {
  Object.defineProperty(config, CONFIG_META, {
    value: meta,
    enumerable: false
  });
  return config;
}

export function getConfigMeta(config) {
  return config?.[CONFIG_META] ?? null;
}

export async function loadConfig(rootDir) {
  const basePath = path.join(rootDir, "patternpilot.config.json");
  const localPath = path.join(rootDir, "patternpilot.config.local.json");
  const baseRaw = await fs.readFile(basePath, "utf8");
  const baseConfig = JSON.parse(baseRaw);
  const localRaw = await safeReadFile(localPath);
  const localConfig = localRaw ? JSON.parse(localRaw) : {};
  const merged = mergeConfigLayers(baseConfig, localConfig);
  return attachConfigMeta(merged, {
    basePath,
    localPath,
    localExists: Boolean(localRaw)
  });
}

export async function writeConfig(rootDir, config, options = {}) {
  const meta = getConfigMeta(config);
  const configPath = options.configPath
    ?? (options.preferLocal
      ? meta?.localPath ?? path.join(rootDir, "patternpilot.config.local.json")
      : meta?.basePath ?? path.join(rootDir, "patternpilot.config.json"));
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
    clearBudget: false,
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
    workerIds: [],
    schedulerLane: null,
    runtimeLeaseMinutes: 30,
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 3,
    runtimeLoopLimit: 2,
    coordinationEscalationSeconds: 3600,
    coordinationBackpressureSeconds: 1800,
    coordinationGroupBudget: 2,
    coordinationGroupEscalationSeconds: 3600,
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
    discoveryPolicyMode: null,
    analysisProfile: "balanced",
    analysisDepth: "standard",
    reportView: "standard",
    query: "",
    scope: null,
    output: null,
    stdout: false,
    urls: [],
    applyReviewDir: null,
    applyDir: null,
    title: null,
    slug: null,
    note: null,
    status: null,
    depth: null,
    withLlm: false,
    perPage: null,
    run: null,
    problem: null
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
    if (token === "--clear-budget") {
      options.clearBudget = true;
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
    if (token === "--coordination-escalation-seconds") {
      const rawValue = args.shift();
      options.coordinationEscalationSeconds = rawValue ? Number.parseInt(rawValue, 10) : options.coordinationEscalationSeconds;
      continue;
    }
    if (token === "--coordination-backpressure-seconds") {
      const rawValue = args.shift();
      options.coordinationBackpressureSeconds = rawValue ? Number.parseInt(rawValue, 10) : options.coordinationBackpressureSeconds;
      continue;
    }
    if (token === "--coordination-group-budget") {
      const rawValue = args.shift();
      options.coordinationGroupBudget = rawValue ? Number.parseInt(rawValue, 10) : options.coordinationGroupBudget;
      continue;
    }
    if (token === "--coordination-group-escalation-seconds") {
      const rawValue = args.shift();
      options.coordinationGroupEscalationSeconds = rawValue ? Number.parseInt(rawValue, 10) : options.coordinationGroupEscalationSeconds;
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
    if (token === "--output") {
      options.output = args.shift() ?? null;
      continue;
    }
    if (token === "--stdout") {
      options.stdout = true;
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
    if (token === "--scheduler-lane") {
      options.schedulerLane = args.shift() ?? null;
      continue;
    }
    if (token === "--runtime-lease-minutes") {
      const rawValue = args.shift();
      options.runtimeLeaseMinutes = rawValue ? Number.parseInt(rawValue, 10) : 30;
      continue;
    }
    if (token === "--runtime-cycle-limit") {
      const rawValue = args.shift();
      options.runtimeCycleLimit = rawValue ? Number.parseInt(rawValue, 10) : 3;
      continue;
    }
    if (token === "--runtime-session-limit") {
      const rawValue = args.shift();
      options.runtimeSessionLimit = rawValue ? Number.parseInt(rawValue, 10) : 3;
      continue;
    }
    if (token === "--runtime-loop-limit") {
      const rawValue = args.shift();
      options.runtimeLoopLimit = rawValue ? Number.parseInt(rawValue, 10) : 2;
      continue;
    }
    if (token === "--recovery-max-attempts") {
      const rawValue = args.shift();
      options.recoveryMaxAttempts = rawValue ? Number.parseInt(rawValue, 10) : 3;
      continue;
    }
    if (token === "--recovery-backoff-seconds") {
      const rawValue = args.shift();
      options.recoveryBackoffSeconds = rawValue ? Number.parseInt(rawValue, 10) : 300;
      continue;
    }
    if (token === "--reset-attempts") {
      options.resetAttempts = true;
      continue;
    }
    if (token === "--worker-id") {
      options.workerId = args.shift() ?? "local-worker";
      continue;
    }
    if (token === "--worker-ids") {
      const rawValue = args.shift() ?? "";
      options.workerIds = rawValue.split(",").map((value) => value.trim()).filter(Boolean);
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
    if (token === "--apply-review-dir") {
      options.applyReviewDir = args.shift() ?? null;
      continue;
    }
    if (token === "--apply-dir") {
      options.applyDir = args.shift() ?? null;
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
    if (token === "--title") {
      options.title = args.shift() ?? null;
      continue;
    }
    if (token === "--slug") {
      options.slug = args.shift() ?? null;
      continue;
    }
    if (token === "--note") {
      options.note = args.shift() ?? null;
      continue;
    }
    if (token === "--status") {
      options.status = args.shift() ?? null;
      continue;
    }
    if (token === "--depth") {
      options.depth = args.shift() ?? null;
      continue;
    }
    if (token === "--with-llm") {
      options.withLlm = true;
      continue;
    }
    if (token === "--per-page") {
      // GitHub Search API erlaubt 1..100 Items pro Seite. Hoeher = mehr
      // Kandidaten pro Query-Linse, aber auch schneller Rate-Limit.
      // Default = 20 (Produktions-Balance, siehe lib/discovery/pass.mjs).
      const raw = args.shift();
      const parsed = Number.parseInt(raw, 10);
      if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
        console.error(`--per-page erwartet eine Zahl zwischen 1 und 100 (GitHub-Limit), bekam: ${raw}`);
        process.exit(2);
      }
      options.perPage = parsed;
      continue;
    }
    if (token === "--run") {
      options.run = args.shift() ?? null;
      continue;
    }
    if (token === "--problem") {
      options.problem = args.shift() ?? null;
      continue;
    }
    options.urls.push(token);
  }

  return { command, options };
}
