import fs from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CATEGORY_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "plugin" },
  { match: /(aggregator|calendar|compiled|portal|hub)/i, value: "aggregator" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "enricher" },
  { match: /(framework|sdk|infra|standardize|family|families)/i, value: "framework" },
  { match: /(\bui\b|frontend|discovery|website|web app|webui|widget|embed)/i, value: "product_surface" },
  { match: /(scraper|crawler|connector|adapter)/i, value: "connector" }
];

const PATTERN_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "cms_distribution_plugin" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "place_data_infrastructure" },
  { match: /(aggregator|compiled|calendar|events-hub|portal)/i, value: "local_multi_source_aggregator" },
  { match: /(framework|city-|infra|sdk|standardize|family|families)/i, value: "local_source_infra_framework" },
  { match: /(frontend|discovery|website|web app|webui|widget|embed)/i, value: "event_discovery_frontend" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "single_source_connector" }
];

const MAIN_LAYER_RULES = [
  { match: /(plugin|wordpress)/i, value: "distribution_plugin" },
  { match: /(framework|infra|intake|source system|source systems|family|families|standardize)/i, value: "source_intake" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "location_place_enrichment" },
  { match: /(scraper|fetch|crawler)/i, value: "access_fetch" },
  { match: /(parse|extract|json-ld|schema\.org)/i, value: "parsing_extraction" },
  { match: /(aggregator|calendar|feed|\bapi\b|\bical\b|\bics\b|json feed)/i, value: "export_feed_api" },
  { match: /(frontend|discovery|website|web app|webui|widget|embed)/i, value: "ui_discovery_surface" }
];

const GAP_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "wordpress_plugin_distribution" },
  { match: /(framework|infra|source system|source systems|family|families|standardize)/i, value: "source_systems_and_families" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "connector_families" },
  { match: /(place|maps|geo(code)?|venue|location|gastro)/i, value: "location_and_gastro_intelligence" },
  { match: /(aggregator|calendar|feed|\bapi\b|\bical\b|\bics\b|widget|embed)/i, value: "distribution_surfaces" },
  { match: /(frontend|discovery|website|web app|webui)/i, value: "frontend_and_surface_design" }
];

const BUILD_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "adapt_pattern" },
  { match: /(place|maps|geo(code)?|location)/i, value: "borrow_optional" },
  { match: /(framework|infra|aggregator|calendar|feed|\bapi\b|family|families|source system)/i, value: "adapt_pattern" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "adapt_pattern" }
];

const PRIORITY_RULES = [
  { match: /(aggregator|framework|infra|plugin|\bapi\b|feed|source system|family|families)/i, value: "now" },
  { match: /(place|maps|location|frontend|discovery|website|webui)/i, value: "soon" },
  { match: /(scraper|connector|crawler)/i, value: "soon" }
];

const DISCOVERY_STOPWORDS = new Set([
  "about",
  "adapter",
  "adapters",
  "analysis",
  "analyze",
  "another",
  "architecture",
  "architektur",
  "based",
  "become",
  "because",
  "between",
  "build",
  "candidate",
  "candidates",
  "clear",
  "compare",
  "core",
  "decision",
  "decisions",
  "eine",
  "einer",
  "einem",
  "einen",
  "dieses",
  "diese",
  "durch",
  "eventbaer",
  "eventbär",
  "external",
  "family",
  "families",
  "finden",
  "fokus",
  "fuer",
  "github",
  "help",
  "hier",
  "ihre",
  "ihren",
  "immer",
  "layer",
  "layers",
  "local",
  "logic",
  "loesung",
  "lösung",
  "mehr",
  "mehrere",
  "muster",
  "next",
  "nicht",
  "noch",
  "oder",
  "pattern",
  "patternpilot",
  "platform",
  "project",
  "quality",
  "question",
  "questions",
  "reference",
  "references",
  "repo",
  "repos",
  "review",
  "reviews",
  "schicht",
  "schon",
  "sein",
  "signal",
  "signals",
  "soll",
  "sollen",
  "source",
  "sources",
  "stage",
  "step",
  "steps",
  "ueber",
  "unter",
  "system",
  "systems",
  "target",
  "their",
  "these",
  "this",
  "through",
  "truth",
  "ung",
  "useful",
  "uses",
  "using",
  "werden",
  "welche",
  "weiter",
  "wird",
  "worker",
  "ziel",
  "zielprojekt"
]);

const DISCOVERY_PROFILES = {
  focused: {
    label: "Focused",
    defaultLimit: 12,
    maxLimit: 20,
    perQuery: 8,
    queryBudget: 5,
    shortlistMultiplier: 1.5
  },
  balanced: {
    label: "Balanced",
    defaultLimit: 24,
    maxLimit: 40,
    perQuery: 12,
    queryBudget: 7,
    shortlistMultiplier: 2
  },
  expansive: {
    label: "Expansive",
    defaultLimit: 40,
    maxLimit: 75,
    perQuery: 15,
    queryBudget: 8,
    shortlistMultiplier: 2.25
  },
  max: {
    label: "Max",
    defaultLimit: 60,
    maxLimit: 100,
    perQuery: 18,
    queryBudget: 9,
    shortlistMultiplier: 2.5
  }
};

const ANALYSIS_PROFILES = {
  balanced: {
    label: "Balanced",
    summary: "Architecture, opportunities and risks in one pass."
  },
  architecture: {
    label: "Architecture",
    summary: "Focus on worker layers, fit, and reusable architectural patterns."
  },
  sources: {
    label: "Sources",
    summary: "Focus on connector families, source systems and acquisition flow."
  },
  distribution: {
    label: "Distribution",
    summary: "Focus on APIs, feeds, plugins and discovery surfaces."
  },
  risk: {
    label: "Risk",
    summary: "Focus on lock-in, maintenance risk and weak dependency signals."
  }
};

const ANALYSIS_DEPTHS = {
  quick: {
    label: "Quick",
    topItems: 5,
    includeRepoMatrix: false
  },
  standard: {
    label: "Standard",
    topItems: 10,
    includeRepoMatrix: true
  },
  deep: {
    label: "Deep",
    topItems: 20,
    includeRepoMatrix: true
  }
};

const REPORT_VIEWS = {
  compact: {
    label: "Compact",
    candidateCount: 8,
    showQueries: false,
    showMatrix: false,
    showCoverage: true
  },
  standard: {
    label: "Standard",
    candidateCount: 16,
    showQueries: true,
    showMatrix: true,
    showCoverage: true
  },
  full: {
    label: "Full",
    candidateCount: 32,
    showQueries: true,
    showMatrix: true,
    showCoverage: true
  }
};

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

function safeExecGit(rootDir, args) {
  try {
    return execFileSync("git", ["-C", rootDir, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

async function safeReadDirEntries(dirPath) {
  try {
    return await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

function parseEnvContent(content) {
  const entries = [];
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push([key, value]);
  }
  return entries;
}

async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
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

export async function loadProjectBinding(rootDir, config, projectKey) {
  const project = config.projects[projectKey];
  if (!project) {
    throw new Error(`Unknown project '${projectKey}'.`);
  }

  const bindingPath = path.join(rootDir, project.projectBindingFile);
  const raw = await fs.readFile(bindingPath, "utf8");
  return {
    project,
    binding: JSON.parse(raw),
    bindingPath
  };
}

export async function loadProjectAlignmentRules(rootDir, project, binding) {
  const rulesFile = binding.alignmentRulesFile ?? project.alignmentRulesFile;
  if (!rulesFile) {
    return null;
  }
  const raw = await fs.readFile(path.join(rootDir, rulesFile), "utf8");
  return JSON.parse(raw);
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

function slugifyProjectKey(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toPosixPath(value) {
  return value.split(path.sep).join("/");
}

function asRelativeFromRoot(rootDir, targetPath) {
  const relative = toPosixPath(path.relative(rootDir, targetPath));
  return relative || ".";
}

async function pathExists(targetPath) {
  return Boolean(await safeStat(targetPath));
}

async function detectProjectFiles(targetRepoPath) {
  const preferredFiles = [
    "AGENT_CONTEXT.md",
    "README.md",
    "WORKER_CONTRACT.md",
    "WORKER_FLOW.md",
    "docs/ARCHITECTURE.md",
    "docs/README.md",
    "docs/SOURCE_MASTERLIST_POLICY.md",
    "docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md",
    "docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md",
    "package.json",
    "pyproject.toml"
  ];
  const preferredDirs = [
    "lib",
    "src",
    "scripts",
    "docs",
    "sources",
    "templates",
    "packages"
  ];

  const readBeforeAnalysis = [];
  for (const relativePath of preferredFiles) {
    if (await pathExists(path.join(targetRepoPath, relativePath))) {
      readBeforeAnalysis.push(relativePath);
    }
  }

  const referenceDirectories = [];
  for (const relativePath of preferredDirs) {
    const stat = await safeStat(path.join(targetRepoPath, relativePath));
    if (stat?.isDirectory()) {
      referenceDirectories.push(relativePath);
    }
  }

  return {
    readBeforeAnalysis,
    referenceDirectories
  };
}

function buildGenericAlignmentRules(projectKey) {
  return {
    projectKey,
    capabilities: [
      {
        id: "ingestion",
        label: "ingestion and adapters",
        signals: ["fetch", "source", "scrape", "crawler", "connector", "adapter"],
        review_docs: ["README.md"]
      },
      {
        id: "data_model",
        label: "data model and semantics",
        signals: ["schema", "model", "normalize", "entity", "identity", "taxonomy"],
        review_docs: ["README.md"]
      },
      {
        id: "quality_governance",
        label: "quality and governance",
        signals: ["review", "quality", "validation", "governance", "dedupe", "audit"],
        review_docs: ["README.md"]
      },
      {
        id: "distribution",
        label: "distribution and surfaces",
        signals: ["api", "feed", "plugin", "frontend", "widget", "embed"],
        review_docs: ["README.md"]
      }
    ],
    layerMappings: {
      access_fetch: {
        fit_bias: 20,
        worker_areas: ["lib/", "src/", "scripts/"],
        review_docs: ["README.md"],
        next_step: "Compare the external fetch pattern against the target repo's ingestion layer."
      },
      source_intake: {
        fit_bias: 22,
        worker_areas: ["docs/", "sources/", "src/"],
        review_docs: ["README.md"],
        next_step: "Check whether this repo suggests reusable source-system or adapter conventions."
      },
      parsing_extraction: {
        fit_bias: 18,
        worker_areas: ["lib/", "src/"],
        review_docs: ["README.md"],
        next_step: "Review whether parsing and normalization patterns improve data quality."
      },
      export_feed_api: {
        fit_bias: 14,
        worker_areas: ["api/", "templates/", "src/"],
        review_docs: ["README.md"],
        next_step: "Treat as a distribution pattern layered on top of the project core."
      },
      distribution_plugin: {
        fit_bias: 10,
        worker_areas: ["docs/", "src/"],
        review_docs: ["README.md"],
        next_step: "Evaluate as adjacent product surface rather than core system logic."
      },
      ui_discovery_surface: {
        fit_bias: 10,
        worker_areas: ["src/", "web/", "docs/"],
        review_docs: ["README.md"],
        next_step: "Keep surface ideas separate from ingestion or truth layers."
      },
      location_place_enrichment: {
        fit_bias: 12,
        worker_areas: ["src/", "lib/"],
        review_docs: ["README.md"],
        next_step: "Treat as enrichment unless the target project is explicitly place-first."
      }
    },
    gapMappings: {
      connector_families: {
        fit_bias: 16,
        suggested_next_step: "Review whether this should inform adapter families, not just one-off integrations."
      },
      source_systems_and_families: {
        fit_bias: 18,
        suggested_next_step: "Compare the repo against the target's source-system architecture."
      },
      distribution_surfaces: {
        fit_bias: 12,
        suggested_next_step: "Read as a surface/distribution signal layered on top of the core."
      },
      location_and_gastro_intelligence: {
        fit_bias: 10,
        suggested_next_step: "Treat as enrichment signal unless the project already has strong geo semantics."
      },
      risk_and_dependency_awareness: {
        fit_bias: 6,
        suggested_next_step: "Use primarily as a risk or anti-pattern signal."
      }
    },
    patternTensions: {
      cms_distribution_plugin: "Plugin-heavy patterns usually belong outside the core truth or ingestion engine.",
      event_discovery_frontend: "Discovery surfaces can be useful without changing the project core.",
      platform_based_place_enrichment: "Platform-bound enrichment should stay controlled and optional."
    }
  };
}

function buildGenericBinding({ projectKey, projectLabel, projectRoot, detected }) {
  const discoveryHints = uniqueStrings([
    ...detected.referenceDirectories.map((item) => item.replace(/[^a-z0-9]+/gi, " ")),
    ...detected.readBeforeAnalysis.map((item) => path.basename(item, path.extname(item)).replace(/[^a-z0-9]+/gi, " "))
  ]).slice(0, 8);

  return {
    projectKey,
    projectLabel,
    projectRoot,
    readBeforeAnalysis: detected.readBeforeAnalysis,
    referenceDirectories: detected.referenceDirectories,
    discoveryHints,
    alignmentRulesFile: `projects/${projectKey}/ALIGNMENT_RULES.json`,
    analysisQuestions: [
      "Welche Schicht im Zielrepo wird durch das externe Repo beleuchtet?",
      "Welche Luecke, Staerkung oder Spannungsflaeche zeigt sich?",
      "Ist das eher build_core, adapt_pattern, borrow_optional, observe_only oder avoid_as_core_dependency?",
      "Welche konkrete Folgearbeit sollte fuer das Zielprojekt entstehen?"
    ],
    targetCapabilities: [
      "ingestion and adapters",
      "data model and semantics",
      "quality and governance",
      "distribution and surfaces"
    ],
    guardrails: [
      "patternpilot bleibt Analyse- und Entscheidungsschicht, nicht Produktionslogik",
      "externe Repos nie blind als Kernarchitektur uebernehmen",
      "Distribution-, Surface- und Core-Logik bewusst getrennt halten"
    ]
  };
}

function renderGenericProjectContext({ projectKey, projectLabel, projectRoot, detected }) {
  const readFiles = detected.readBeforeAnalysis.length > 0
    ? detected.readBeforeAnalysis.map((item) => `- \`${item}\``).join("\n")
    : "- Noch keine offensichtlichen Leitdateien erkannt.";
  const dirs = detected.referenceDirectories.length > 0
    ? detected.referenceDirectories.map((item) => `- \`${item}/\``).join("\n")
    : "- Noch keine offensichtlichen Referenzverzeichnisse erkannt.";

  return `# PROJECT_CONTEXT — ${projectKey}

## Zweck

Diese Datei beschreibt den ersten Patternpilot-Kontext fuer \`${projectLabel}\`.

## Zielrepo

- Label: ${projectLabel}
- Project Key: ${projectKey}
- Repo Path relativ zu Patternpilot: \`${projectRoot}\`

## Erster Leseeinstieg

${readFiles}

## Wichtige Verzeichnisse

${dirs}

## Erste Hypothese

- Dieses Projekt ist frisch an Patternpilot gebunden und sollte nach dem ersten echten Intake weiter geschaerft werden.
`;
}

function renderGenericBindingMd({ projectKey, projectLabel, projectRoot, binding }) {
  return `# PROJECT_BINDING — ${projectKey}

## Zweck

Diese Datei beschreibt die operative Bindung zwischen \`patternpilot\` und \`${projectLabel}\`.

## Referenz-Repo

- Pfad: \`${projectRoot}\`
- Rolle: Zielsystem, fuer das Patternpilot externe Muster in verwertbare Entscheidungen uebersetzt

## Kontextgewinnung fuer dieses Projekt

- Patternpilot bleibt produktseitig generisch und verankert keine harte Primaeroberflaeche.
- Stattdessen liest es fuer dieses Zielprojekt zuerst die unten definierten Leitdateien und Verzeichnisse.
- Wenn ein \`docs/\`-Bereich vorhanden ist, ist er meist ein schneller, hochwertiger Kontextlieferant, aber nie Produktidentitaet von Patternpilot selbst.

## Vor jedem tieferen Review zuerst lesen

${binding.readBeforeAnalysis.length > 0 ? binding.readBeforeAnalysis.map((item) => `- \`${item}\``).join("\n") : "- Noch offen"}

## Besonders relevante Verzeichnisse

${binding.referenceDirectories.length > 0 ? binding.referenceDirectories.map((item) => `- \`${item}/\``).join("\n") : "- Noch offen"}

## Discovery-Hinweise

${binding.discoveryHints?.length > 0 ? binding.discoveryHints.map((item) => `- \`${item}\``).join("\n") : "- Noch offen"}

## Fragen, die Patternpilot fuer dieses Projekt beantworten soll

${binding.analysisQuestions.map((item) => `- ${item}`).join("\n")}

## Guardrails

${binding.guardrails.map((item) => `- ${item}`).join("\n")}

## Promotion-Fluss

- Intake-Dossiers landen unter \`intake/\`
- Promotion-Pakete landen unter \`promotions/\`
- Erst der Promotion-Schritt darf kuratierte Artefakte veraendern
`;
}

export async function initializeProjectBinding(rootDir, config, options) {
  const targetPath = options.target
    ? path.resolve(rootDir, options.target)
    : options.workspaceRoot
      ? path.resolve(rootDir, options.workspaceRoot)
      : null;
  if (!targetPath) {
    throw new Error("init-project requires --target <relative-or-absolute-path>.");
  }
  const targetStat = await safeStat(targetPath);
  if (!targetStat?.isDirectory()) {
    throw new Error(`Target project path does not exist or is not a directory: ${targetPath}`);
  }

  const projectKey = slugifyProjectKey(options.project || path.basename(targetPath));
  if (!projectKey) {
    throw new Error("Could not derive a valid project key. Pass --project explicitly.");
  }
  if (config.projects[projectKey]) {
    throw new Error(`Project '${projectKey}' already exists in patternpilot.config.json.`);
  }

  const projectLabel = options.label || path.basename(targetPath);
  const detected = await detectProjectFiles(targetPath);
  const projectRoot = asRelativeFromRoot(rootDir, targetPath) || ".";
  const binding = buildGenericBinding({
    projectKey,
    projectLabel,
    projectRoot,
    detected
  });
  const alignmentRules = buildGenericAlignmentRules(projectKey);
  const projectDirRelative = `projects/${projectKey}`;
  const intakeRoot = `${projectDirRelative}/intake`;
  const promotionRoot = `${projectDirRelative}/promotions`;
  const willBecomeDefault = Boolean(options.makeDefault || !config.defaultProject);

  config.projects[projectKey] = {
    label: projectLabel,
    projectRoot,
    projectContextFile: `${projectDirRelative}/PROJECT_CONTEXT.md`,
    projectBindingFile: `${projectDirRelative}/PROJECT_BINDING.json`,
    alignmentRulesFile: `${projectDirRelative}/ALIGNMENT_RULES.json`,
    watchlistFile: `${projectDirRelative}/WATCHLIST.txt`,
    intakeRoot,
    promotionRoot
  };
  if (willBecomeDefault) {
    config.defaultProject = projectKey;
  }

  const outputs = [
    {
      path: path.join(rootDir, projectDirRelative, "PROJECT_CONTEXT.md"),
      content: renderGenericProjectContext({ projectKey, projectLabel, projectRoot, detected })
    },
    {
      path: path.join(rootDir, projectDirRelative, "PROJECT_BINDING.md"),
      content: renderGenericBindingMd({ projectKey, projectLabel, projectRoot, binding })
    },
    {
      path: path.join(rootDir, projectDirRelative, "PROJECT_BINDING.json"),
      content: `${JSON.stringify(binding, null, 2)}\n`
    },
    {
      path: path.join(rootDir, projectDirRelative, "ALIGNMENT_RULES.json"),
      content: `${JSON.stringify(alignmentRules, null, 2)}\n`
    },
    {
      path: path.join(rootDir, projectDirRelative, "WATCHLIST.txt"),
      content: "# GitHub repo URLs fuer spaetere Watchlist-Intakes\n"
    },
    {
      path: path.join(rootDir, intakeRoot, "README.md"),
      content: `# Intake\n\nDieser Ordner enthaelt Intake-Dossiers fuer \`${projectKey}\`.\n`
    },
    {
      path: path.join(rootDir, promotionRoot, "README.md"),
      content: `# Promotions\n\nDieser Ordner enthaelt Promotion-Pakete fuer \`${projectKey}\`.\n`
    },
    {
      path: path.join(rootDir, projectDirRelative, "reviews", "README.md"),
      content: `# Reviews\n\nDieser Ordner enthaelt vergleichende Watchlist-Reviews fuer \`${projectKey}\`.\n`
    },
    {
      path: path.join(rootDir, projectDirRelative, "reports", "README.md"),
      content: `# Reports\n\nDieser Ordner enthaelt menschenfreundliche HTML-Reports fuer \`${projectKey}\`.\n`
    }
  ];

  if (!options.dryRun) {
    for (const output of outputs) {
      await fs.mkdir(path.dirname(output.path), { recursive: true });
      await fs.writeFile(output.path, output.content, "utf8");
    }
    await writeConfig(rootDir, config);
  }

  return {
    projectKey,
    projectLabel,
    targetPath,
    projectRoot,
    outputs: outputs.map((item) => asRelativeFromRoot(rootDir, item.path)),
    readBeforeAnalysis: binding.readBeforeAnalysis,
    referenceDirectories: binding.referenceDirectories,
    madeDefault: willBecomeDefault
  };
}

async function isGitRepo(dirPath) {
  const gitPath = path.join(dirPath, ".git");
  const stat = await safeStat(gitPath);
  return Boolean(stat);
}

async function walkWorkspace(rootPath, maxDepth, depth = 0, collected = []) {
  if (depth === 0 && await isGitRepo(rootPath)) {
    collected.push(rootPath);
    return collected;
  }
  let entries = [];
  try {
    entries = await fs.readdir(rootPath, { withFileTypes: true });
  } catch {
    return collected;
  }
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith(".") || entry.name === "node_modules") {
      continue;
    }
    const absolutePath = path.join(rootPath, entry.name);
    if (await isGitRepo(absolutePath)) {
      collected.push(absolutePath);
      continue;
    }
    if (depth + 1 <= maxDepth) {
      await walkWorkspace(absolutePath, maxDepth, depth + 1, collected);
    }
  }
  return collected;
}

export async function discoverWorkspaceProjects(rootDir, config, options = {}) {
  const roots = options.workspaceRoot
    ? [path.resolve(rootDir, options.workspaceRoot)]
    : (config.workspaceRoots ?? [".."]).map((item) => path.resolve(rootDir, item));
  const boundByProjectRoot = new Map(
    Object.entries(config.projects ?? {}).map(([projectKey, project]) => [
      path.resolve(rootDir, project.projectRoot),
      projectKey
    ])
  );
  const seen = new Set();
  const discovered = [];

  for (const rootPath of roots) {
    const rootStat = await safeStat(rootPath);
    if (!rootStat?.isDirectory()) {
      continue;
    }
    const repos = await walkWorkspace(rootPath, options.maxDepth ?? 2);
    for (const repoPath of repos) {
      if (seen.has(repoPath)) {
        continue;
      }
      seen.add(repoPath);
      const detected = await detectProjectFiles(repoPath);
      discovered.push({
        path: repoPath,
        relativePath: asRelativeFromRoot(rootDir, repoPath),
        suggestedProjectKey: slugifyProjectKey(path.basename(repoPath)),
        boundProjectKey: boundByProjectRoot.get(repoPath) ?? null,
        readBeforeAnalysisCount: detected.readBeforeAnalysis.length,
        referenceDirectoryCount: detected.referenceDirectories.length
      });
    }
  }

  discovered.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
  return discovered;
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

export async function collectUrls(rootDir, options) {
  const urls = [...options.urls];
  if (options.file) {
    const fileContent = await fs.readFile(path.resolve(rootDir, options.file), "utf8");
    for (const line of fileContent.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      urls.push(trimmed);
    }
  }
  return [...new Set(urls)];
}

export function normalizeGithubUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`Invalid URL: ${rawUrl}`);
  }

  if (url.hostname !== "github.com") {
    throw new Error(`Only github.com repository URLs are supported right now: ${rawUrl}`);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`GitHub URL must point to a repository: ${rawUrl}`);
  }

  const owner = parts[0];
  const name = parts[1].replace(/\.git$/i, "");
  const normalizedRepoUrl = `https://github.com/${owner}/${name}`;

  return {
    rawUrl,
    normalizedRepoUrl,
    owner,
    name,
    slug: `${owner}__${name}`.toLowerCase(),
    host: "github.com"
  };
}

export function createRunId(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, "-");
}

function matchValue(rules, text, fallback) {
  for (const rule of rules) {
    if (rule.match.test(text)) {
      return rule.value;
    }
  }
  return fallback;
}

function buildClassificationText(repo, enrichment) {
  const repoData = enrichment?.repo ?? {};
  const topics = Array.isArray(repoData.topics) ? repoData.topics.join(" ") : "";
  const readmeText = enrichment?.readme?.excerpt ?? "";
  const description = repoData.description ?? "";
  const languageText = Array.isArray(enrichment?.languages) ? enrichment.languages.join(" ") : "";
  return [
    repo.owner,
    repo.name,
    repo.normalizedRepoUrl,
    description,
    topics,
    readmeText,
    languageText
  ]
    .filter(Boolean)
    .join(" ");
}

export function guessClassification(repo, enrichment = null) {
  const text = buildClassificationText(repo, enrichment);
  const category = matchValue(CATEGORY_RULES, text, "research_signal");
  const patternFamily = matchValue(PATTERN_RULES, text, "research_signal");
  const mainLayer = matchValue(MAIN_LAYER_RULES, text, "research_signal");
  const gapArea = matchValue(GAP_RULES, text, "risk_and_dependency_awareness");
  const buildVsBorrow = matchValue(BUILD_RULES, text, "observe_only");
  const priority = matchValue(PRIORITY_RULES, text, "soon");

  return {
    category,
    patternFamily,
    mainLayer,
    gapArea,
    buildVsBorrow,
    priority
  };
}

export function buildProjectRelevanceNote(projectBinding, guess) {
  const projectLabel = projectBinding.projectLabel ?? projectBinding.projectKey;
  return [
    `Likely relevant for ${projectLabel} because it may inform '${guess.gapArea}'`,
    `and the worker/project layer '${guess.mainLayer}'.`
  ].join(" ");
}

function csvEscape(value) {
  const safe = String(value ?? "");
  if (!safe.includes(";") && !safe.includes('"') && !safe.includes("\n")) {
    return safe;
  }
  return `"${safe.replace(/"/g, '""')}"`;
}

function parseCsvLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ";" && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  values.push(current);
  return values;
}

async function readQueue(queuePath) {
  const raw = await fs.readFile(queuePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(";");
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]));
  });
  return { header, rows };
}

async function writeQueue(queuePath, header, rows) {
  const lines = [header.join(";")];
  for (const row of rows) {
    lines.push(header.map((key) => csvEscape(row[key] ?? "")).join(";"));
  }
  await fs.writeFile(queuePath, `${lines.join("\n")}\n`, "utf8");
}

export async function upsertQueueEntry(rootDir, config, entry) {
  const queuePath = path.join(rootDir, config.queueFile);
  const { header, rows } = await readQueue(queuePath);
  for (const key of Object.keys(entry)) {
    if (!header.includes(key)) {
      header.push(key);
    }
  }
  const index = rows.findIndex(
    (row) =>
      row.project_key === entry.project_key &&
      row.normalized_repo_url === entry.normalized_repo_url
  );

  if (index >= 0) {
    const previous = rows[index];
    rows[index] = {
      ...previous,
      ...entry,
      created_at: previous.created_at || entry.created_at
    };
  } else {
    rows.push(entry);
  }

  await writeQueue(queuePath, header, rows);
}

export async function loadQueueEntries(rootDir, config) {
  const queuePath = path.join(rootDir, config.queueFile);
  const { rows } = await readQueue(queuePath);
  return rows;
}

export async function loadLandkarteEntries(rootDir) {
  try {
    const { rows } = await readQueue(path.join(rootDir, "repo_landkarte.csv"));
    return rows;
  } catch {
    return [];
  }
}

async function countWatchlistEntries(rootDir, project) {
  if (!project.watchlistFile) {
    return 0;
  }
  const content = await safeReadText(path.join(rootDir, project.watchlistFile));
  if (!content) {
    return 0;
  }
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .length;
}

async function findLatestRun(rootDir, config) {
  const runsRoot = path.join(rootDir, config.runtimeRoot ?? "runs");
  const projectDirs = await safeReadDirEntries(runsRoot);
  const candidates = [];

  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) {
      continue;
    }
    const projectPath = path.join(runsRoot, projectDir.name);
    const runDirs = await safeReadDirEntries(projectPath);
    for (const runDir of runDirs) {
      if (!runDir.isDirectory()) {
        continue;
      }
      const runPath = path.join(projectPath, runDir.name);
      const stat = await safeStat(runPath);
      if (!stat) {
        continue;
      }
      candidates.push({
        projectKey: projectDir.name,
        runId: runDir.name,
        relativePath: asRelativeFromRoot(rootDir, runPath),
        modifiedAt: stat.mtime.toISOString()
      });
    }
  }

  candidates.sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt));
  return candidates[0] ?? null;
}

function buildPatternpilotStatusMarkdown({ generatedAt, gitInfo, config, queueEntries, landkarteEntries, projectSnapshots, latestRun, lastContext }) {
  const featureLine = [
    "intake",
    "promotion",
    "discovery",
    "watchlist_review",
    "html_reports",
    "workspace_mode"
  ].join(", ");

  return `# Patternpilot Status

<!-- Auto-generated by patternpilot CLI context refresh. Do not edit manually. -->

- last_updated: ${generatedAt}
- branch: ${gitInfo.branch || "-"} | head: ${gitInfo.head || "-"}
- default_project: ${config.defaultProject ?? "-"} | configured_projects: ${projectSnapshots.length}
- queue_entries: ${queueEntries.length} | curated_repos: ${landkarteEntries.length}
- capabilities: ${featureLine}
- discovery_profiles: focused, balanced, expansive, max
- analysis_profiles: balanced, architecture, sources, distribution, risk
- analysis_depths: quick, standard, deep
- report_views: compact, standard, full
- latest_run: ${latestRun ? `${latestRun.projectKey}/${latestRun.runId}` : "none"}
- latest_run_path: ${latestRun?.relativePath ?? "-"}
- last_command: ${lastContext.command ?? "-"} | last_project: ${lastContext.projectKey ?? "-"} | last_mode: ${lastContext.mode ?? "-"}
- last_report: ${lastContext.reportPath ?? "-"}

## Project Surfaces

${projectSnapshots.map((project) => `- ${project.projectKey}: context_files=${project.contextFileCount} | context_dirs=${project.contextDirectoryCount} | watchlist=${project.watchlistCount} | intake_root=${project.intakeRoot} | promotion_root=${project.promotionRoot} | review_root=${project.reviewRoot} | report_root=${project.reportRoot}`).join("\n")}

## Quick Links

- agent_context: AGENT_CONTEXT.md
- claude_context: CLAUDE.md
- mission_vision: docs/foundation/MISSION_VISION.md
- operating_model: docs/foundation/OPERATING_MODEL.md
- report_output_model: docs/reference/REPORT_OUTPUT_MODEL.md
- report_ui_framework: docs/reference/REPORT_UI_FRAMEWORK.md
- automation_roadmap: docs/foundation/AUTOMATION_ROADMAP.md
- open_questions: OPEN_QUESTION.md
- config: patternpilot.config.json
- queue: repo_intake_queue.csv
- landkarte: repo_landkarte.csv
`;
}

function buildPatternpilotOpenQuestionMarkdown({ generatedAt, latestRun }) {
  return `# Open Questions

*Arbeitsdokument fuer offene Architektur-, Produkt- und Betriebsfragen in \`patternpilot\`.*

## Zweck

Diese Datei haelt nur Fragen fest, die fuer die weitere Produktreife von Patternpilot wirklich relevant sind.

Sie ist bewusst kein Sammelbecken fuer beliebige Ideen.

## Aktualisierung

Diese Datei wird zusammen mit \`STATUS.md\` als operative Uebergabeflaeche mitgefuehrt.

- last_updated: ${generatedAt}
- latest_run_reference: ${latestRun ? `${latestRun.projectKey}/${latestRun.runId}` : "none"}

## Aktuell offene Fragen

### OQ-001 — REPORT_UI_DIRECTION

- prioritaet: BALD
- frage: Welche finale visuelle Richtung soll die HTML-Report-Schicht bekommen, bevor daraus eine spaetere App- oder Web-Oberflaeche wird?
- warum_offen: Die technische HTML-Schicht steht, aber Designsystem, visuelle Sprache und moegliche Branding-Regeln sind noch nicht final entschieden.
- naechster_sinnvoller_schritt: Ein verbindliches Report-UI-Framework mit Farben, Typografie, Komponenten und Chart-Patterns festziehen.

### OQ-002 — CHAIN_RUN_AUTOMATION

- prioritaet: JETZT
- frage: Wie soll der vollautomatische Kettenlauf \`discover -> watchlist -> intake -> review\` standardmaessig orchestriert werden?
- warum_offen: Die einzelnen Bausteine existieren, aber der integrierte End-to-End-Run mit sauberen Guards, Limits und Quality-Gates ist noch nicht gebaut.
- naechster_sinnvoller_schritt: Einen eigenen Chain-Run-Command mit Blacklist/Allowlist und Safety-Limits einfuehren.

### OQ-003 — QUALITY_FILTERS_FOR_DISCOVERY

- prioritaet: JETZT
- frage: Welche Blacklist-, Allowlist- und Qualitaetsregeln sollen Discovery-Kandidaten vor dem Watchlist-Handoff filtern?
- warum_offen: Discovery ist heuristisch stabil, aber fuer echte Produktnutzung fehlen noch harte Ausschluss- und Vertrauensregeln.
- naechster_sinnvoller_schritt: Policy-Dateien fuer ausgeschlossene Plattformen, Mindestsignale und bevorzugte Musterfamilien einfuehren.

### OQ-004 — GITHUB_APP_CUTOVER

- prioritaet: BALD
- frage: Wann soll Patternpilot vom PAT-Zwischenzustand auf echten GitHub-App-Betrieb umgestellt werden?
- warum_offen: Die Scaffolds sind da, aber App-Deployment, Webhooks und Installationsmodell sind noch nicht produktiv angeschlossen.
- naechster_sinnvoller_schritt: GitHub-App registrieren, Secrets setzen und einen ersten Live-Flow gegen reale Repos pruefen.

### OQ-005 — LLM_AUGMENTATION_BOUNDARY

- prioritaet: SPAETER
- frage: Wo ergaenzt spaeter eine LLM-Schicht die heuristische Engine sinnvoll, ohne den belastbaren Kern zu verwischen?
- warum_offen: Der aktuelle Fokus liegt bewusst auf einer halluzinationsarmen, reproduzierbaren Basis.
- naechster_sinnvoller_schritt: Erst nach stabiler Discovery-, Review- und Report-Schicht LLM-Einsatz nur fuer Verdichtung und Briefing pruefen.
`;
}

export async function refreshOperationalDocs(rootDir, config, context = {}) {
  const queueEntries = await loadQueueEntries(rootDir, config);
  const landkarteEntries = await loadLandkarteEntries(rootDir);
  const latestRun = await findLatestRun(rootDir, config);
  const projectSnapshots = [];

  for (const [projectKey, project] of Object.entries(config.projects ?? {})) {
    const bindingPath = project.projectBindingFile ? path.join(rootDir, project.projectBindingFile) : null;
    let contextFileCount = 0;
    let contextDirectoryCount = 0;
    if (bindingPath) {
      const bindingContent = await safeReadText(bindingPath);
      if (bindingContent) {
        try {
          const binding = JSON.parse(bindingContent);
          contextFileCount = binding.readBeforeAnalysis?.length ?? 0;
          contextDirectoryCount = binding.referenceDirectories?.length ?? 0;
        } catch {
          contextFileCount = 0;
          contextDirectoryCount = 0;
        }
      }
    }
    projectSnapshots.push({
      projectKey,
      contextFileCount,
      contextDirectoryCount,
      watchlistCount: await countWatchlistEntries(rootDir, project),
      intakeRoot: project.intakeRoot ?? "-",
      promotionRoot: project.promotionRoot ?? "-",
      reviewRoot: `projects/${projectKey}/reviews`,
      reportRoot: `projects/${projectKey}/reports`
    });
  }

  const generatedAt = new Date().toISOString();
  const gitInfo = {
    branch: safeExecGit(rootDir, ["branch", "--show-current"]),
    head: safeExecGit(rootDir, ["rev-parse", "--short", "HEAD"])
  };
  const statusContent = buildPatternpilotStatusMarkdown({
    generatedAt,
    gitInfo,
    config,
    queueEntries,
    landkarteEntries,
    projectSnapshots,
    latestRun,
    lastContext: context
  });
  const openQuestionsContent = buildPatternpilotOpenQuestionMarkdown({
    generatedAt,
    latestRun
  });

  await fs.writeFile(path.join(rootDir, "STATUS.md"), `${statusContent}\n`, "utf8");
  await fs.writeFile(path.join(rootDir, "OPEN_QUESTION.md"), `${openQuestionsContent}\n`, "utf8");
}

export async function ensureDirectory(dirPath, dryRun) {
  if (dryRun) {
    return;
  }
  await fs.mkdir(dirPath, { recursive: true });
}

export function buildIntakeDocPath(rootDir, project, repo) {
  return path.join(rootDir, project.intakeRoot, `${repo.slug}.md`);
}

async function safeReadText(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

async function safeReadDir(dirPath) {
  try {
    return await fs.readdir(dirPath);
  } catch {
    return [];
  }
}

function resolveProjectPath(projectRoot, relativePath) {
  return path.resolve(projectRoot, relativePath);
}

export async function loadProjectProfile(rootDir, project, binding, alignmentRules = null) {
  const projectRoot = path.resolve(rootDir, project.projectRoot);
  const referenceFiles = [];
  const referenceDirectories = [];
  const corpusParts = [];

  for (const relativePath of binding.readBeforeAnalysis ?? []) {
    const absolutePath = resolveProjectPath(projectRoot, relativePath);
    const content = await safeReadText(absolutePath);
    referenceFiles.push({
      path: relativePath,
      exists: Boolean(content),
      excerpt: content ? stripMarkdown(content, 700) : ""
    });
    if (content) {
      corpusParts.push(content);
    }
  }

  for (const relativePath of binding.referenceDirectories ?? []) {
    const absolutePath = resolveProjectPath(projectRoot, relativePath);
    const entries = await safeReadDir(absolutePath);
    referenceDirectories.push({
      path: relativePath,
      entries: entries.slice(0, 40)
    });
    if (entries.length > 0) {
      corpusParts.push(entries.join(" "));
    }
  }

  const corpus = corpusParts.join("\n");
  const capabilitiesPresent = (alignmentRules?.capabilities ?? [])
    .filter((capability) => capability.signals?.some((signal) => corpus.toLowerCase().includes(signal.toLowerCase())))
    .map((capability) => capability.id);

  return {
    projectKey: binding.projectKey,
    projectRoot,
    referenceFiles,
    referenceDirectories,
    contextSources: {
      declaredFiles: binding.readBeforeAnalysis ?? [],
      loadedFiles: referenceFiles.filter((item) => item.exists).map((item) => item.path),
      missingFiles: referenceFiles.filter((item) => !item.exists).map((item) => item.path),
      declaredDirectories: binding.referenceDirectories ?? [],
      scannedDirectories: referenceDirectories.map((item) => ({
        path: item.path,
        entryCount: item.entries.length
      }))
    },
    corpus,
    capabilitiesPresent
  };
}

function resolveGithubToken(githubConfig) {
  for (const envName of githubConfig.authEnvVars ?? []) {
    const value = process.env[envName];
    if (value) {
      return {
        token: value,
        envName,
        authMode: "token"
      };
    }
  }

  return {
    token: null,
    envName: null,
    authMode: "anonymous"
  };
}

export function inspectGithubAuth(config) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  return {
    authMode: auth.authMode,
    authSource: auth.envName,
    configuredEnvVars: githubConfig.authEnvVars ?? [],
    tokenPresent: Boolean(auth.token)
  };
}

export function inspectGithubAppAuth() {
  const requiredVars = [
    "PATTERNPILOT_GITHUB_APP_ID",
    "PATTERNPILOT_GITHUB_APP_CLIENT_ID",
    "PATTERNPILOT_GITHUB_APP_CLIENT_SECRET",
    "PATTERNPILOT_GITHUB_APP_PRIVATE_KEY_PATH",
    "PATTERNPILOT_GITHUB_WEBHOOK_SECRET"
  ];
  const presentVars = requiredVars.filter((name) => Boolean(process.env[name]));
  return {
    requiredVars,
    presentVars,
    missingVars: requiredVars.filter((name) => !process.env[name]),
    appReady: requiredVars.every((name) => Boolean(process.env[name]))
  };
}

export function buildSetupChecklist() {
  return {
    pat: {
      envVar: "PATTERNPILOT_GITHUB_TOKEN",
      filePath: ".env.local",
      whereToFind:
        "GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens",
      docsUrl:
        "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
      note:
        "Use a fine-grained PAT with repository read access for the repos Patternpilot should analyze."
    },
    githubApp: [
      {
        key: "PATTERNPILOT_GITHUB_APP_ID",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > App ID",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_CLIENT_ID",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Client ID",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_CLIENT_SECRET",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Generate a new client secret",
        docsUrl:
          "https://docs.github.com/enterprise-cloud@latest/apps/maintaining-github-apps/modifying-a-github-app-registration"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_PRIVATE_KEY_PATH",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Private keys > Generate a private key",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps"
      },
      {
        key: "PATTERNPILOT_GITHUB_WEBHOOK_SECRET",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "Choose your own secret value when configuring the webhook endpoint for the GitHub App",
        docsUrl:
          "https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries"
      }
    ]
  };
}

export async function initializeEnvFiles(rootDir, options = {}) {
  const templates = [
    {
      source: path.join(rootDir, ".env.example"),
      target: path.join(rootDir, ".env.local")
    },
    {
      source: path.join(rootDir, "deployment/github-app/.env.example"),
      target: path.join(rootDir, "deployment/github-app/.env.local")
    }
  ];
  const results = [];

  for (const template of templates) {
    const sourceContent = await safeReadFile(template.source);
    if (!sourceContent) {
      continue;
    }
    const existing = await safeReadFile(template.target);
    if (existing && !options.force) {
      results.push({
        path: asRelativeFromRoot(rootDir, template.target),
        status: "exists"
      });
      continue;
    }
    if (!options.dryRun) {
      await fs.mkdir(path.dirname(template.target), { recursive: true });
      await fs.writeFile(template.target, sourceContent, "utf8");
    }
    results.push({
      path: asRelativeFromRoot(rootDir, template.target),
      status: options.dryRun ? "planned" : "created"
    });
  }

  return results;
}

function createHeaders(githubConfig, auth) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": githubConfig.userAgent ?? "patternpilot"
  };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

async function fetchJson(url, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      new URL(url),
      {
        method: "GET",
        headers,
        timeout: timeoutMs
      },
      (response) => {
        let payload = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          payload += chunk;
        });
        response.on("end", () => {
          try {
            const data = payload ? JSON.parse(payload) : {};
            if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
              const message = data?.message || response.statusMessage || "request failed";
              reject(new Error(`GitHub API ${response.statusCode}: ${message}`));
              return;
            }
            resolve(data);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });
    request.on("timeout", () => {
      request.destroy(new Error("request aborted"));
    });
    request.end();
  });
}

function shouldRetryGithubError(error) {
  const message = error?.message ?? "";
  return (
    message.includes("fetch failed") ||
    message.includes("aborted") ||
    message.includes("EAI_AGAIN") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNRESET")
  );
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, headers, timeoutMs, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJson(url, headers, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetryGithubError(error)) {
        throw error;
      }
      await wait(800 * attempt);
    }
  }
  throw lastError;
}

export async function runGithubDoctor(config, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  const diagnosis = {
    authMode: auth.authMode,
    authSource: auth.envName,
    configuredEnvVars: githubConfig.authEnvVars ?? [],
    tokenPresent: Boolean(auth.token),
    apiBaseUrl: githubConfig.apiBaseUrl ?? "https://api.github.com",
    networkStatus: options.offline ? "skipped_offline" : "not_checked",
    rateLimit: null,
    error: null
  };

  if (options.offline) {
    return diagnosis;
  }

  try {
    const headers = createHeaders(githubConfig, auth);
    const data = await fetchJsonWithRetry(
      `${diagnosis.apiBaseUrl}/rate_limit`,
      headers,
      githubConfig.requestTimeoutMs ?? 12000,
      2
    );
    const core = data?.resources?.core ?? {};
    diagnosis.networkStatus = "ok";
    diagnosis.rateLimit = {
      limit: core.limit ?? null,
      remaining: core.remaining ?? null,
      used: core.used ?? null,
      reset: core.reset ? new Date(core.reset * 1000).toISOString() : null
    };
  } catch (error) {
    diagnosis.networkStatus = "failed";
    diagnosis.error = error.message;
  }

  return diagnosis;
}

function decodeBase64Markdown(content) {
  if (!content) {
    return "";
  }
  return Buffer.from(content.replace(/\n/g, ""), "base64").toString("utf8");
}

function stripMarkdown(markdown, maxChars) {
  const cleaned = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^[-*+]\s+/gm, "")
    .replace(/^\d+\.\s+/gm, "")
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  return `${cleaned.slice(0, maxChars).trim()}...`;
}

export async function enrichGithubRepo(repo, config, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);

  if (options.skipEnrich) {
    return {
      status: "skipped",
      authMode: auth.authMode,
      authSource: auth.envName
    };
  }

  const headers = createHeaders(githubConfig, auth);
  const baseUrl = githubConfig.apiBaseUrl ?? "https://api.github.com";
  const timeoutMs = githubConfig.requestTimeoutMs ?? 12000;

  try {
    const repoData = await fetchJsonWithRetry(
      `${baseUrl}/repos/${repo.owner}/${repo.name}`,
      headers,
      timeoutMs
    );

    let readme = null;
    try {
      const readmeData = await fetchJsonWithRetry(
        `${baseUrl}/repos/${repo.owner}/${repo.name}/readme`,
        headers,
        timeoutMs
      );
      const rawReadme = decodeBase64Markdown(readmeData.content);
      readme = {
        path: readmeData.path,
        htmlUrl: readmeData.html_url,
        excerpt: stripMarkdown(rawReadme, githubConfig.readmeExcerptMaxChars ?? 1600)
      };
    } catch (error) {
      readme = {
        path: null,
        htmlUrl: null,
        excerpt: "",
        error: error.message
      };
    }

    let languages = [];
    try {
      const languagesData = await fetchJsonWithRetry(
        `${baseUrl}/repos/${repo.owner}/${repo.name}/languages`,
        headers,
        timeoutMs
      );
      languages = Object.keys(languagesData);
    } catch {
      languages = [];
    }

    return {
      status: "success",
      authMode: auth.authMode,
      authSource: auth.envName,
      fetchedAt: new Date().toISOString(),
      repo: {
        fullName: repoData.full_name,
        description: repoData.description ?? "",
        homepage: repoData.homepage ?? "",
        topics: repoData.topics ?? [],
        defaultBranch: repoData.default_branch ?? "",
        visibility: repoData.visibility ?? "public",
        archived: Boolean(repoData.archived),
        fork: Boolean(repoData.fork),
        stars: repoData.stargazers_count ?? 0,
        forks: repoData.forks_count ?? 0,
        openIssues: repoData.open_issues_count ?? 0,
        watchers: repoData.watchers_count ?? 0,
        language: repoData.language ?? "",
        license: repoData.license?.spdx_id || repoData.license?.name || "",
        createdAt: repoData.created_at ?? "",
        updatedAt: repoData.updated_at ?? "",
        pushedAt: repoData.pushed_at ?? ""
      },
      languages,
      readme
    };
  } catch (error) {
    return {
      status: "failed",
      authMode: auth.authMode,
      authSource: auth.envName,
      fetchedAt: new Date().toISOString(),
      error: error.message
    };
  }
}

function tokenizeDiscoveryText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDiscoveryTerm(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDiscoveryKeywords(parts, limit = 10) {
  const counts = new Map();

  for (const part of parts) {
    for (const token of tokenizeDiscoveryText(part)) {
      if (
        token.length < 4 ||
        /^\d+$/.test(token) ||
        DISCOVERY_STOPWORDS.has(token)
      ) {
        continue;
      }
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

function sanitizeDiscoverySignals(signals, limit = 4) {
  const deduped = [];
  const seen = new Set();

  for (const rawSignal of signals ?? []) {
    const signal = normalizeDiscoveryTerm(rawSignal);
    if (!signal || signal.length < 4) {
      continue;
    }
    const canonical = signal.includes(" ")
      ? signal
      : signal.replace(/s$/, "");
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    deduped.push(signal);
  }

  return deduped.slice(0, limit);
}

function quoteGithubSearchTerm(term) {
  return term.includes(" ") ? `"${term}"` : term;
}

function buildDiscoveryQueryString(terms) {
  const normalizedTerms = uniqueStrings(
    terms
      .map((term) => normalizeDiscoveryTerm(term))
      .filter((term) => term && term.length >= 3)
  ).slice(0, 6);

  if (normalizedTerms.length === 0) {
    return null;
  }

  return `${normalizedTerms.map(quoteGithubSearchTerm).join(" ")} archived:false fork:false stars:>=3`;
}

function resolveDiscoveryProfile(profileName = "balanced", requestedLimit = null) {
  const profile = DISCOVERY_PROFILES[profileName] ?? DISCOVERY_PROFILES.balanced;
  const requested = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? requestedLimit
    : profile.defaultLimit;
  const limit = clamp(requested, 1, profile.maxLimit);

  return {
    id: Object.entries(DISCOVERY_PROFILES).find(([, value]) => value === profile)?.[0] ?? "balanced",
    ...profile,
    limit
  };
}

function resolveAnalysisProfile(profileName = "balanced") {
  const profile = ANALYSIS_PROFILES[profileName] ?? ANALYSIS_PROFILES.balanced;
  return {
    id: Object.entries(ANALYSIS_PROFILES).find(([, value]) => value === profile)?.[0] ?? "balanced",
    ...profile
  };
}

function resolveAnalysisDepth(depthName = "standard") {
  const depth = ANALYSIS_DEPTHS[depthName] ?? ANALYSIS_DEPTHS.standard;
  return {
    id: Object.entries(ANALYSIS_DEPTHS).find(([, value]) => value === depth)?.[0] ?? "standard",
    ...depth
  };
}

function resolveReportView(viewName = "standard") {
  const view = REPORT_VIEWS[viewName] ?? REPORT_VIEWS.standard;
  return {
    id: Object.entries(REPORT_VIEWS).find(([, value]) => value === view)?.[0] ?? "standard",
    ...view
  };
}

function buildDiscoveryPlan(binding, alignmentRules, projectProfile, options = {}) {
  const discoveryProfile = resolveDiscoveryProfile(options.discoveryProfile, options.limit);
  const corpusParts = [
    binding.projectLabel,
    binding.projectKey,
    ...(binding.targetCapabilities ?? []),
    ...(binding.analysisQuestions ?? []),
    ...(binding.discoveryHints ?? []),
    projectProfile?.corpus ?? ""
  ];
  const domainKeywords = extractDiscoveryKeywords(corpusParts, 10);
  const discoveryAnchors = uniqueStrings([
    ...sanitizeDiscoverySignals(binding.discoveryHints ?? [], 6),
    ...domainKeywords.slice(0, 4)
  ]);
  const broadSignals = sanitizeDiscoverySignals(
    (alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? []),
    8
  );
  const broadTerms = uniqueStrings([
    ...discoveryAnchors.slice(0, 3),
    ...broadSignals.slice(0, 2)
  ]);
  const plans = [];

  const addPlan = (plan) => {
    if (!plan.query) {
      return;
    }
    if (plans.some((item) => item.query === plan.query)) {
      return;
    }
    plans.push(plan);
  };

  addPlan({
    id: "broad-project-scan",
    label: "Broad project scan",
    capabilityId: null,
    query: buildDiscoveryQueryString(broadTerms),
    terms: broadTerms,
    reasons: ["Project-wide query built from recurring project keywords and discovery hints."]
  });

  for (const capability of alignmentRules?.capabilities ?? []) {
    const capabilitySignals = sanitizeDiscoverySignals(capability.signals ?? [], 4);
    const capabilityTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, 2),
      ...capabilitySignals
    ]);

    addPlan({
      id: `capability-${capability.id}`,
      label: capability.label ?? capability.id,
      capabilityId: capability.id,
      query: buildDiscoveryQueryString(capabilityTerms),
      terms: capabilityTerms,
      reasons: [
        `Targets capability '${capability.label ?? capability.id}'.`,
        capabilitySignals.length > 0
          ? `Signals: ${capabilitySignals.join(", ")}.`
          : "No explicit signals configured."
      ]
    });
  }

  if (options.query) {
    const manualTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, 2),
      ...sanitizeDiscoverySignals([options.query], 4)
    ]);
    addPlan({
      id: "manual-query",
      label: "Manual query boost",
      capabilityId: null,
      query: buildDiscoveryQueryString(manualTerms),
      terms: manualTerms,
      reasons: ["Extended by explicit --query input."]
    });
  }

  return {
    projectKey: binding.projectKey,
    domainKeywords,
    discoveryProfile,
    plans: plans.slice(0, discoveryProfile.queryBudget)
  };
}

function buildSearchSeedEnrichment(repoData, meta = {}) {
  return {
    status: "success",
    source: meta.source ?? "github_search",
    authMode: meta.authMode ?? "anonymous",
    authSource: meta.authSource ?? null,
    fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
    repo: {
      fullName: repoData.fullName ?? `${repoData.owner}/${repoData.name}`,
      description: repoData.description ?? "",
      homepage: repoData.homepage ?? "",
      topics: repoData.topics ?? [],
      defaultBranch: repoData.defaultBranch ?? "",
      visibility: repoData.visibility ?? "public",
      archived: Boolean(repoData.archived),
      fork: Boolean(repoData.fork),
      stars: repoData.stars ?? 0,
      forks: repoData.forks ?? 0,
      openIssues: repoData.openIssues ?? 0,
      watchers: repoData.watchers ?? 0,
      language: repoData.language ?? "",
      license: repoData.license ?? "",
      createdAt: repoData.createdAt ?? "",
      updatedAt: repoData.updatedAt ?? "",
      pushedAt: repoData.pushedAt ?? ""
    },
    languages: repoData.language ? [repoData.language] : [],
    readme: {
      path: null,
      htmlUrl: null,
      excerpt: ""
    }
  };
}

function normalizeGithubSearchItem(item) {
  return {
    owner: item?.owner?.login ?? "",
    name: item?.name ?? "",
    normalizedRepoUrl: item?.html_url ?? "",
    slug: `${item?.owner?.login ?? ""}__${item?.name ?? ""}`.toLowerCase(),
    host: "github.com",
    fullName: item?.full_name ?? "",
    description: item?.description ?? "",
    homepage: item?.homepage ?? "",
    topics: item?.topics ?? [],
    defaultBranch: item?.default_branch ?? "",
    visibility: item?.visibility ?? "public",
    archived: Boolean(item?.archived),
    fork: Boolean(item?.fork),
    stars: item?.stargazers_count ?? 0,
    forks: item?.forks_count ?? 0,
    openIssues: item?.open_issues_count ?? 0,
    watchers: item?.watchers_count ?? 0,
    language: item?.language ?? "",
    license: item?.license?.spdx_id || item?.license?.name || "",
    createdAt: item?.created_at ?? "",
    updatedAt: item?.updated_at ?? "",
    pushedAt: item?.pushed_at ?? ""
  };
}

async function searchGithubRepositories(config, plan, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  const headers = createHeaders(githubConfig, auth);
  const baseUrl = githubConfig.apiBaseUrl ?? "https://api.github.com";
  const timeoutMs = Math.min(githubConfig.requestTimeoutMs ?? 12000, options.timeoutMs ?? 4500);
  const perPage = Math.max(1, Math.min(options.perPage ?? 10, 25));
  const requestUrl = new URL(`${baseUrl}/search/repositories`);
  requestUrl.searchParams.set("q", plan.query);
  requestUrl.searchParams.set("sort", "updated");
  requestUrl.searchParams.set("order", "desc");
  requestUrl.searchParams.set("per_page", String(perPage));
  requestUrl.searchParams.set("page", "1");

  const response = await fetchJsonWithRetry(
    requestUrl.toString(),
    headers,
    timeoutMs,
    options.attempts ?? 1
  );

  return {
    authMode: auth.authMode,
    authSource: auth.envName,
    fetchedAt: new Date().toISOString(),
    totalCount: response.total_count ?? 0,
    incompleteResults: Boolean(response.incomplete_results),
    items: (response.items ?? []).map(normalizeGithubSearchItem)
  };
}

async function loadWatchlistUrls(rootDir, project) {
  if (!project.watchlistFile) {
    return [];
  }
  const content = await safeReadText(path.join(rootDir, project.watchlistFile));
  if (!content) {
    return [];
  }
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      try {
        return normalizeGithubUrl(line).normalizedRepoUrl;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function loadKnownRepoUrls(rootDir, config, project) {
  const known = new Set();
  const landkarteRaw = await safeReadText(path.join(rootDir, "repo_landkarte.csv"));
  if (landkarteRaw) {
    const matches = landkarteRaw.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g) ?? [];
    for (const match of matches) {
      try {
        known.add(normalizeGithubUrl(match).normalizedRepoUrl);
      } catch {
        // ignore malformed matches
      }
    }
  }

  for (const row of await loadQueueEntries(rootDir, config)) {
    if (row.normalized_repo_url) {
      known.add(row.normalized_repo_url);
    } else if (row.repo_url) {
      known.add(row.repo_url);
    }
  }

  for (const url of await loadWatchlistUrls(rootDir, project)) {
    known.add(url);
  }

  return known;
}

function discoveryStarScore(stars) {
  if (!stars || stars <= 0) {
    return 0;
  }
  return Math.min(18, Math.round(Math.log10(stars + 1) * 8));
}

function discoveryActivityScore(enrichment) {
  const activity = deriveActivityStatus(enrichment);
  if (activity === "current") {
    return 12;
  }
  if (activity === "moderate") {
    return 6;
  }
  if (activity === "stale") {
    return -6;
  }
  if (activity === "archived") {
    return -18;
  }
  return 0;
}

function buildDiscoveryReasoning(candidate, domainKeywords) {
  const reasons = [];
  if (candidate.queryLabels.length > 0) {
    reasons.push(`Matched discovery lenses: ${candidate.queryLabels.join(", ")}.`);
  }
  if (candidate.projectAlignment?.fitBand) {
    reasons.push(
      `Project fit is ${candidate.projectAlignment.fitBand} (${candidate.projectAlignment.fitScore}).`
    );
  }
  if (candidate.projectAlignment?.matchedCapabilities?.length > 0) {
    reasons.push(
      `Matched capabilities: ${candidate.projectAlignment.matchedCapabilities.join(", ")}.`
    );
  }
  if (candidate.enrichment?.repo?.stars) {
    reasons.push(`Stars: ${candidate.enrichment.repo.stars}.`);
  }
  const keywordHits = domainKeywords.filter((keyword) =>
    buildClassificationText(candidate.repo, candidate.enrichment).toLowerCase().includes(keyword)
  );
  if (keywordHits.length > 0) {
    reasons.push(`Project-keyword overlap: ${keywordHits.slice(0, 5).join(", ")}.`);
  }
  if (candidate.enrichment?.repo?.archived) {
    reasons.push("Archived repos are downgraded to pattern-signal only.");
  }
  return reasons;
}

function scoreDiscoveryCandidate(candidate, domainKeywords) {
  let score = 12;
  score += candidate.queryLabels.length * 8;
  score += discoveryStarScore(candidate.enrichment?.repo?.stars ?? 0);
  score += discoveryActivityScore(candidate.enrichment);
  score += Math.round((candidate.projectAlignment?.fitScore ?? 0) * 0.45);
  score += (candidate.projectAlignment?.matchedCapabilities?.length ?? 0) * 5;

  const repoText = buildClassificationText(candidate.repo, candidate.enrichment).toLowerCase();
  const keywordHits = domainKeywords.filter((keyword) => repoText.includes(keyword)).length;
  score += Math.min(keywordHits * 2, 12);

  if (candidate.enrichment?.repo?.fork) {
    score -= 12;
  }
  if (candidate.enrichment?.repo?.archived) {
    score -= 20;
  }
  if (candidate.guess.buildVsBorrow === "adapt_pattern") {
    score += 6;
  }
  if (candidate.guess.priority === "now") {
    score += 6;
  }

  return clamp(score, 0, 100);
}

function buildDiscoveryDisposition(candidate) {
  if (candidate.enrichment?.repo?.archived) {
    return "observe_only";
  }
  if (candidate.projectAlignment.fitBand === "high") {
    return "intake_now";
  }
  if (candidate.projectAlignment.fitBand === "medium") {
    return "review_queue";
  }
  return "watch_only";
}

function mergeDiscoveryHit(target, plan, item, fetchedAt, authMeta) {
  const existing = target.get(item.normalizedRepoUrl);
  if (existing) {
    existing.queryIds.add(plan.id);
    existing.queryLabels.add(plan.label);
    if (plan.capabilityId) {
      existing.capabilityIds.add(plan.capabilityId);
    }
    existing.planTerms.push(...plan.terms);
    return existing;
  }

  const seedEnrichment = buildSearchSeedEnrichment(item, {
    source: "github_search",
    fetchedAt,
    authMode: authMeta.authMode,
    authSource: authMeta.authSource
  });
  const record = {
    repo: {
      owner: item.owner,
      name: item.name,
      normalizedRepoUrl: item.normalizedRepoUrl,
      slug: item.slug,
      host: item.host
    },
    seedRepoData: item,
    seedEnrichment,
    queryIds: new Set([plan.id]),
    queryLabels: new Set([plan.label]),
    capabilityIds: new Set(plan.capabilityId ? [plan.capabilityId] : []),
    planTerms: [...plan.terms]
  };
  target.set(item.normalizedRepoUrl, record);
  return record;
}

function rawDiscoveryPreScore(record) {
  let score = 8;
  score += record.queryIds.size * 6;
  score += discoveryStarScore(record.seedEnrichment.repo.stars);
  score += discoveryActivityScore(record.seedEnrichment);
  if (record.seedEnrichment.repo.fork) {
    score -= 12;
  }
  if (record.seedEnrichment.repo.archived) {
    score -= 20;
  }
  return clamp(score, 0, 100);
}

export async function appendUrlsToWatchlist(rootDir, project, urls, dryRun = false) {
  if (!project.watchlistFile) {
    return { status: "skipped_no_watchlist", appended: 0, keptExisting: urls.length };
  }

  const watchlistPath = path.join(rootDir, project.watchlistFile);
  const existingContent = await safeReadText(watchlistPath);
  const existingLines = (existingContent ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const existingSet = new Set(existingLines);
  const normalizedUrls = uniqueStrings(urls.map((url) => {
    try {
      return normalizeGithubUrl(url).normalizedRepoUrl;
    } catch {
      return null;
    }
  }).filter(Boolean));
  const appended = normalizedUrls.filter((url) => !existingSet.has(url));

  if (!dryRun && appended.length > 0) {
    const header = existingContent && existingContent.trim().length > 0
      ? existingContent.trimEnd()
      : "# GitHub repo URLs fuer spaetere Watchlist-Intakes";
    const nextContent = `${header}\n${appended.join("\n")}\n`;
    await fs.writeFile(watchlistPath, nextContent, "utf8");
  }

  return {
    status: appended.length > 0 ? (dryRun ? "planned" : "updated") : "unchanged",
    appended: appended.length,
    keptExisting: normalizedUrls.length - appended.length,
    urls: appended
  };
}

export async function discoverGithubCandidates(
  rootDir,
  config,
  project,
  binding,
  alignmentRules,
  projectProfile,
  options = {}
) {
  const createdAt = new Date().toISOString();
  const plan = buildDiscoveryPlan(binding, alignmentRules, projectProfile, options);
  const discoveryProfile = plan.discoveryProfile;
  const knownUrls = await loadKnownRepoUrls(rootDir, config, project);
  const hits = new Map();
  const searchErrors = [];
  let scanned = 0;

  if (!options.offline) {
    const searchResults = await Promise.all(
      plan.plans.map(async (queryPlan) => {
        try {
          const response = await searchGithubRepositories(config, queryPlan, {
            perPage: discoveryProfile.perQuery,
            attempts: 1,
            timeoutMs: 4500
          });
          return { queryPlan, response, error: null };
        } catch (error) {
          return { queryPlan, response: null, error };
        }
      })
    );

    for (const result of searchResults) {
      if (result.error) {
        searchErrors.push({
          queryId: result.queryPlan.id,
          label: result.queryPlan.label,
          query: result.queryPlan.query,
          error: result.error.message ?? String(result.error)
        });
        continue;
      }

      const { queryPlan, response } = result;
      scanned += response.items.length;
      for (const item of response.items) {
        if (!item.normalizedRepoUrl || knownUrls.has(item.normalizedRepoUrl)) {
          continue;
        }
        mergeDiscoveryHit(hits, queryPlan, item, response.fetchedAt, {
          authMode: response.authMode,
          authSource: response.authSource
        });
      }
    }
  }

  const enrichmentPoolSize = Math.max(
    Math.round(discoveryProfile.limit * discoveryProfile.shortlistMultiplier),
    12
  );
  const shortlisted = [...hits.values()]
    .sort((left, right) => rawDiscoveryPreScore(right) - rawDiscoveryPreScore(left))
    .slice(0, enrichmentPoolSize);
  const candidates = [];

  const enrichedPool = options.skipEnrich
    ? shortlisted.map((record) => ({ record, enrichment: record.seedEnrichment }))
    : await Promise.all(
        shortlisted.map(async (record) => {
          const detailed = await enrichGithubRepo(record.repo, config, { skipEnrich: false });
          if (detailed.status === "success") {
            return { record, enrichment: detailed };
          }
          return {
            record,
            enrichment: {
              ...record.seedEnrichment,
              detailStatus: detailed.status,
              detailError: detailed.error ?? "",
              authMode: detailed.authMode ?? record.seedEnrichment.authMode,
              authSource: detailed.authSource ?? record.seedEnrichment.authSource
            }
          };
        })
      );

  for (const { record, enrichment } of enrichedPool) {

    const guess = guessClassification(record.repo, enrichment);
    const projectAlignment = buildProjectAlignment(
      record.repo,
      guess,
      enrichment,
      projectProfile,
      alignmentRules
    );
    const landkarteCandidate = buildLandkarteCandidate(record.repo, guess, enrichment);
    const candidate = {
      repo: record.repo,
      enrichment,
      guess,
      landkarteCandidate,
      projectAlignment,
      queryIds: [...record.queryIds],
      queryLabels: [...record.queryLabels],
      capabilityIds: [...record.capabilityIds],
      discoveryScore: 0,
      discoveryDisposition: "watch_only",
      reasoning: []
    };
    candidate.discoveryScore = scoreDiscoveryCandidate(candidate, plan.domainKeywords);
    candidate.discoveryDisposition = buildDiscoveryDisposition(candidate);
    candidate.reasoning = buildDiscoveryReasoning(candidate, plan.domainKeywords);
    candidates.push(candidate);
  }

  candidates.sort((left, right) => right.discoveryScore - left.discoveryScore);

  return {
    createdAt,
    offline: Boolean(options.offline),
    plan,
    discoveryProfile,
    scanned,
    knownUrlCount: knownUrls.size,
    candidateCount: candidates.length,
    searchErrors,
    candidates: candidates.slice(0, discoveryProfile.limit)
  };
}

function parseCsvList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreWatchlistItemForProfile(item, analysisProfileId) {
  let score = Number(item.projectFitScore ?? 0);
  score += item.eventbaerRelevance === "high" ? 12 : item.eventbaerRelevance === "medium" ? 6 : 0;
  score += item.activityStatus === "current" ? 8 : item.activityStatus === "moderate" ? 4 : 0;

  if (analysisProfileId === "architecture") {
    score += item.mainLayer === "source_intake" || item.mainLayer === "parsing_extraction" ? 12 : 0;
    score += item.matchedCapabilities.length * 3;
  }
  if (analysisProfileId === "sources") {
    score += item.gapArea === "connector_families" || item.gapArea === "source_systems_and_families" ? 16 : 0;
    score += item.mainLayer === "access_fetch" || item.mainLayer === "source_intake" ? 10 : 0;
  }
  if (analysisProfileId === "distribution") {
    score += item.gapArea === "distribution_surfaces" || item.gapArea === "wordpress_plugin_distribution" ? 16 : 0;
    score += item.mainLayer === "export_feed_api" || item.mainLayer === "distribution_plugin" || item.mainLayer === "ui_discovery_surface" ? 10 : 0;
  }
  if (analysisProfileId === "risk") {
    score += item.risks.includes("source_lock_in") ? 14 : 0;
    score += item.risks.includes("maintenance_risk") ? 12 : 0;
    score += item.risks.includes("archived_repo") ? 16 : 0;
  }

  return clamp(score, 0, 100);
}

function summarizeFrequencyMap(entries, key, limit = 6) {
  const counts = new Map();
  for (const entry of entries) {
    const values = Array.isArray(entry[key]) ? entry[key] : [entry[key]];
    for (const value of values) {
      if (!value) {
        continue;
      }
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildWatchlistReviewReason(item, profile) {
  const reasons = [];
  if (item.projectFitBand) {
    reasons.push(`fit=${item.projectFitBand} (${item.projectFitScore})`);
  }
  if (item.matchedCapabilities.length > 0) {
    reasons.push(`capabilities=${item.matchedCapabilities.join(", ")}`);
  }
  if (profile.id === "risk" && item.risks.length > 0) {
    reasons.push(`risks=${item.risks.join(", ")}`);
  } else if (item.suggestedNextStep) {
    reasons.push(item.suggestedNextStep);
  }
  return reasons.join(" | ");
}

function buildCoverageGaps(alignmentRules, reviewedItems) {
  const coveredCapabilities = new Set(reviewedItems.flatMap((item) => item.matchedCapabilities));
  return (alignmentRules?.capabilities ?? [])
    .filter((capability) => !coveredCapabilities.has(capability.id))
    .map((capability) => capability.label ?? capability.id)
    .slice(0, 6);
}

function buildWatchlistNextSteps(profile, topItems, coverageGaps, missingUrls) {
  const nextSteps = [];
  if (topItems.length > 0) {
    nextSteps.push(`Promote the top ${Math.min(topItems.length, 3)} candidates into focused manual review.`);
  }
  if (profile.id === "architecture") {
    nextSteps.push("Compare the strongest repos against worker areas before adopting any pattern.");
  }
  if (profile.id === "sources") {
    nextSteps.push("Use the review to sharpen connector-family and source-system conventions.");
  }
  if (profile.id === "distribution") {
    nextSteps.push("Keep distribution surfaces separate from the worker truth core during review.");
  }
  if (profile.id === "risk") {
    nextSteps.push("Flag lock-in and maintenance-heavy repos as pattern signals, not direct dependencies.");
  }
  if (coverageGaps.length > 0) {
    nextSteps.push(`Discovery can be widened for uncovered areas: ${coverageGaps.join(", ")}.`);
  }
  if (missingUrls.length > 0) {
    nextSteps.push(`Run sync-watchlist so all ${missingUrls.length} missing watchlist repos get intake dossiers.`);
  }
  return uniqueStrings(nextSteps).slice(0, 6);
}

export function buildWatchlistReviewReport(review) {
  const coverageLines = review.coverage.mainLayers.length > 0
    ? review.coverage.mainLayers.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const gapLines = review.coverage.gapAreas.length > 0
    ? review.coverage.gapAreas.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const capabilityLines = review.coverage.capabilities.length > 0
    ? review.coverage.capabilities.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const missingLines = review.missingUrls.length > 0
    ? review.missingUrls.map((url) => `- ${url}`).join("\n")
    : "- none";
  const topLines = review.topItems.length > 0
    ? review.topItems.map((item) => `- ${item.repoRef} (${item.reviewScore}) :: ${item.reason}`).join("\n")
    : "- none";
  const riskLines = review.riskiestItems.length > 0
    ? review.riskiestItems.map((item) => `- ${item.repoRef}: ${item.risks.join(", ") || "needs_review"}`).join("\n")
    : "- none";
  const strongerLines = review.strongestPatterns.length > 0
    ? review.strongestPatterns.map((item) => `- ${item.repoRef}: ${item.possibleImplication || item.learningForEventbaer}`).join("\n")
    : "- none";
  const gapCoverageLines = review.coverage.uncoveredCapabilities.length > 0
    ? review.coverage.uncoveredCapabilities.map((item) => `- ${item}`).join("\n")
    : "- none";
  const nextStepLines = review.nextSteps.length > 0
    ? review.nextSteps.map((item) => `- ${item}`).join("\n")
    : "- none";
  const matrixLines = review.analysisDepth.includeRepoMatrix && review.items.length > 0
    ? review.items.map((item) => `- ${item.repoRef} :: layer=${item.mainLayer || "-"} :: gap=${item.gapArea || "-"} :: fit=${item.projectFitBand || "-"} (${item.projectFitScore}) :: relevance=${item.eventbaerRelevance || "-"}`).join("\n")
    : "- omitted for this depth";

  return `# Patternpilot Watchlist Review

- project: ${review.projectKey}
- created_at: ${review.createdAt}
- analysis_profile: ${review.analysisProfile.id}
- analysis_profile_label: ${review.analysisProfile.label}
- analysis_depth: ${review.analysisDepth.id}
- watchlist_urls: ${review.watchlistCount}
- reviewed_items: ${review.items.length}
- missing_from_queue: ${review.missingUrls.length}

## Focus

- ${review.analysisProfile.summary}

## Main Layer Coverage

${coverageLines}

## Gap Area Coverage

${gapLines}

## Capability Coverage

${capabilityLines}

## Uncovered Capability Areas

${gapCoverageLines}

## Strongest Patterns Right Now

${strongerLines}

## Top Items For This Review Mode

${topLines}

## Highest Risk Signals

${riskLines}

## Missing Watchlist Intake

${missingLines}

## Repo Matrix

${matrixLines}

## Next Steps

${nextStepLines}
`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtmlList(items, emptyText = "none") {
  if (!items || items.length === 0) {
    return `<p class="empty">${escapeHtml(emptyText)}</p>`;
  }
  return `<ul class="bullets">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function renderHtmlStatCards(stats) {
  return stats
    .map(
      (stat) => `<article class="stat-card">
  <span class="stat-label">${escapeHtml(stat.label)}</span>
  <strong class="stat-value">${escapeHtml(stat.value)}</strong>
</article>`
    )
    .join("");
}

function renderHtmlSection(title, body, tone = "default", sectionId = "") {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}"` : "";
  return `<section class="section-card ${tone}"${idAttr}>
  <header class="section-head">
    <h2>${escapeHtml(title)}</h2>
  </header>
  <div class="section-body">
    ${body}
  </div>
</section>`;
}

function renderBadge(value, tone = "neutral") {
  return `<span class="badge ${tone}">${escapeHtml(value)}</span>`;
}

function slugifyForId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function dispositionTone(value) {
  if (value === "intake_now") {
    return "accent";
  }
  if (value === "review_queue") {
    return "info";
  }
  if (value === "observe_only") {
    return "warn";
  }
  return "neutral";
}

function fitTone(value) {
  if (value === "high") {
    return "accent";
  }
  if (value === "medium") {
    return "info";
  }
  if (value === "low") {
    return "warn";
  }
  return "neutral";
}

function renderDiscoveryCandidateCards(candidates, reportView) {
  const visible = candidates.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">No discovery candidates available in this run.</p>`;
  }
  return `<div class="repo-grid">${visible.map((candidate) => {
    const whyRelevant = candidate.reasoning[0] ?? "Needs manual review.";
    const transfer = candidate.landkarteCandidate?.possible_implication ?? candidate.projectAlignment?.suggestedNextStep ?? "-";
    const strengths = candidate.landkarteCandidate?.strengths ?? "-";
    const risks = candidate.landkarteCandidate?.risks ?? "needs_review";
    return `<article class="repo-card filter-card"
  data-search="${escapeHtml([candidate.repo.owner, candidate.repo.name, candidate.enrichment?.repo?.description ?? "", candidate.projectAlignment?.matchedCapabilities?.join(" ") ?? "", candidate.guess?.mainLayer ?? "", candidate.discoveryDisposition ?? ""].join(" ").toLowerCase())}"
  data-fit="${escapeHtml(candidate.projectAlignment?.fitBand ?? "unknown")}"
  data-mode="${escapeHtml(candidate.discoveryDisposition ?? "watch_only")}"
  data-layer="${escapeHtml(candidate.guess?.mainLayer ?? "unknown")}">
  <div class="repo-head">
    <h3>${escapeHtml(candidate.repo.owner)}/${escapeHtml(candidate.repo.name)}</h3>
    <div class="repo-badges">
      ${renderBadge(`Score ${candidate.discoveryScore}`, "accent")}
      ${renderBadge(`Fit ${candidate.projectAlignment?.fitBand ?? "unknown"}`, fitTone(candidate.projectAlignment?.fitBand))}
      ${renderBadge(candidate.discoveryDisposition, dispositionTone(candidate.discoveryDisposition))}
    </div>
  </div>
  <p class="repo-url"><a href="${escapeHtml(candidate.repo.normalizedRepoUrl)}">${escapeHtml(candidate.repo.normalizedRepoUrl)}</a></p>
  <p class="repo-copy">${escapeHtml(candidate.enrichment?.repo?.description || "No public description available.")}</p>
  <dl class="mini-grid">
    <div><dt>Why relevant</dt><dd>${escapeHtml(whyRelevant)}</dd></div>
    <div><dt>Strong area</dt><dd>${escapeHtml(strengths)}</dd></div>
    <div><dt>Transfer idea</dt><dd>${escapeHtml(transfer)}</dd></div>
    <div><dt>Risks</dt><dd>${escapeHtml(risks)}</dd></div>
  </dl>
  <details class="repo-details">
    <summary>Open repo reasoning</summary>
    ${renderHtmlList(candidate.reasoning, "No reasoning recorded.")}
  </details>
</article>`;
  }).join("")}</div>`;
}

function renderWatchlistTopCards(review, reportView) {
  const visible = review.topItems.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">No reviewed watchlist repositories yet.</p>`;
  }
  return `<div class="repo-grid">${visible.map((item) => `<article class="repo-card filter-card"
  data-search="${escapeHtml([item.repoRef, item.reason, item.learningForEventbaer, item.possibleImplication, item.mainLayer, item.gapArea, item.matchedCapabilities.join(" ")].join(" ").toLowerCase())}"
  data-fit="${escapeHtml(item.projectFitBand || "unknown")}"
  data-mode="${escapeHtml(item.gapArea || "unknown")}"
  data-layer="${escapeHtml(item.mainLayer || "unknown")}">
  <div class="repo-head">
    <h3>${escapeHtml(item.repoRef)}</h3>
    <div class="repo-badges">
      ${renderBadge(`Review ${item.reviewScore}`, "accent")}
      ${renderBadge(`Fit ${item.projectFitBand || "unknown"}`, fitTone(item.projectFitBand))}
      ${renderBadge(item.mainLayer || "unknown", "neutral")}
    </div>
  </div>
  <p class="repo-copy">${escapeHtml(item.reason || "Needs manual review.")}</p>
  <dl class="mini-grid">
    <div><dt>Why it matters</dt><dd>${escapeHtml(item.learningForEventbaer || item.strengths || "-")}</dd></div>
    <div><dt>What to take</dt><dd>${escapeHtml(item.possibleImplication || item.suggestedNextStep || "-")}</dd></div>
    <div><dt>Strength</dt><dd>${escapeHtml(item.strengths || "-")}</dd></div>
    <div><dt>Weakness / risk</dt><dd>${escapeHtml(item.weaknesses || item.risks.join(", ") || "-")}</dd></div>
  </dl>
  <details class="repo-details">
    <summary>Open comparison details</summary>
    ${renderHtmlList([
      `Matched capabilities: ${item.matchedCapabilities.join(", ") || "-"}`,
      `Worker areas: ${item.recommendedWorkerAreas.join(", ") || "-"}`,
      `Suggested next step: ${item.suggestedNextStep || "-"}`
    ], "No extra details.")}
  </details>
</article>`).join("")}</div>`;
}

function renderCoverageCards(coverage) {
  const groups = [
    { title: "Main layers", items: coverage.mainLayers.map((item) => `${item.value}: ${item.count}`) },
    { title: "Gap areas", items: coverage.gapAreas.map((item) => `${item.value}: ${item.count}`) },
    { title: "Capabilities", items: coverage.capabilities.map((item) => `${item.value}: ${item.count}`) }
  ];
  return `<div class="coverage-grid">${groups.map((group) => {
    const parsed = group.items.map((item) => {
      const [value, count] = item.split(": ");
      return { value, count: Number(count || 0) };
    });
    const maxCount = parsed.reduce((highest, item) => Math.max(highest, item.count), 1);
    return `<article class="coverage-card">
  <h3>${escapeHtml(group.title)}</h3>
  ${parsed.length === 0 ? renderHtmlList([], "none") : `<div class="bar-list">${parsed.map((item) => `<div class="bar-row">
    <span class="bar-label">${escapeHtml(item.value)}</span>
    <span class="bar-track"><span class="bar-fill" style="width:${Math.max(12, Math.round((item.count / maxCount) * 100))}%"></span></span>
    <span class="bar-count">${item.count}</span>
  </div>`).join("")}</div>`}
</article>`;
  }).join("")}</div>`;
}

function renderRepoMatrix(review, reportView) {
  if (!reportView.showMatrix) {
    return `<p class="empty">Repo matrix hidden in compact report view.</p>`;
  }
  const rows = review.items.slice(0, reportView.candidateCount);
  if (rows.length === 0) {
    return `<p class="empty">No review rows available.</p>`;
  }
  return `<div class="table-wrap"><table class="data-table">
  <thead>
    <tr>
      <th>Repo</th>
      <th>Layer</th>
      <th>Gap</th>
      <th>Fit</th>
      <th>Relevance</th>
      <th>Next step</th>
    </tr>
  </thead>
  <tbody>
    ${rows.map((item) => `<tr>
      <td data-search="${escapeHtml([item.repoRef, item.mainLayer, item.gapArea, item.suggestedNextStep].join(" ").toLowerCase())}">${escapeHtml(item.repoRef)}</td>
      <td>${escapeHtml(item.mainLayer || "-")}</td>
      <td>${escapeHtml(item.gapArea || "-")}</td>
      <td>${escapeHtml(`${item.projectFitBand || "-"} (${item.projectFitScore})`)}</td>
      <td>${escapeHtml(item.eventbaerRelevance || "-")}</td>
      <td>${escapeHtml(item.suggestedNextStep || "-")}</td>
    </tr>`).join("")}
  </tbody>
</table></div>`;
}

function renderProjectContextSources(projectProfile, binding) {
  const loadedFiles = projectProfile?.contextSources?.loadedFiles ?? [];
  const missingFiles = projectProfile?.contextSources?.missingFiles ?? [];
  const scannedDirectories = projectProfile?.contextSources?.scannedDirectories ?? [];
  const nonEmptyDirectories = scannedDirectories.filter((item) => item.entryCount > 0);
  const declaredFiles = projectProfile?.contextSources?.declaredFiles ?? binding?.readBeforeAnalysis ?? [];
  const declaredDirectories = projectProfile?.contextSources?.declaredDirectories ?? binding?.referenceDirectories ?? [];
  const capabilitiesPresent = projectProfile?.capabilitiesPresent ?? [];

  return `<div class="coverage-grid">
  <article class="coverage-card">
    <h3>Read first files</h3>
    ${renderHtmlList(
      loadedFiles.length > 0 ? loadedFiles : declaredFiles,
      "No target-repo context files configured."
    )}
  </article>
  <article class="coverage-card">
    <h3>Missing configured files</h3>
    ${renderHtmlList(missingFiles, "All configured context files were available.")}
  </article>
  <article class="coverage-card">
    <h3>Scanned directories</h3>
    ${renderHtmlList(
      nonEmptyDirectories.length > 0
        ? nonEmptyDirectories.map((item) => `${item.path}/ (${item.entryCount} entries sampled)`)
        : declaredDirectories.map((item) => `${item}/`),
      "No directory context configured."
    )}
  </article>
  <article class="coverage-card">
    <h3>Signals extracted</h3>
    ${renderHtmlList(
      capabilitiesPresent.map((item) => `capability: ${item}`),
      "No target-project capabilities were inferred from the current context."
    )}
  </article>
</div>`;
}

function renderReportToolbar({ modeOptions, layerOptions }) {
  return `<section class="toolbar-card">
  <div class="toolbar-grid">
    <label class="control">
      <span>Search</span>
      <input id="report-search" type="search" placeholder="Filter repos, layers, capabilities">
    </label>
    <label class="control">
      <span>Fit</span>
      <select id="report-fit">
        <option value="">All</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
        <option value="unknown">Unknown</option>
      </select>
    </label>
    <label class="control">
      <span>Mode</span>
      <select id="report-mode">
        <option value="">All</option>
        ${modeOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
      </select>
    </label>
    <label class="control">
      <span>Layer</span>
      <select id="report-layer">
        <option value="">All</option>
        ${layerOptions.map((item) => `<option value="${escapeHtml(item)}">${escapeHtml(item)}</option>`).join("")}
      </select>
    </label>
    <button class="ghost-button" id="report-reset" type="button">Reset filters</button>
  </div>
</section>`;
}

function renderHtmlDocument({ title, eyebrow, subtitle, lead, stats, sections, modeOptions = [], layerOptions = [] }) {
  const navItems = sections
    .map((section) => section.id ? `<a href="#${escapeHtml(section.id)}">${escapeHtml(section.navLabel ?? section.title)}</a>` : "")
    .filter(Boolean)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --panel: #fffdf8;
      --ink: #16202a;
      --muted: #5d6b78;
      --line: #ddd4c5;
      --accent: #bb4d00;
      --accent-soft: #ffe3cf;
      --info: #0b7285;
      --info-soft: #dff4f8;
      --warn: #8f3d2e;
      --warn-soft: #f8ddd7;
      --shadow: 0 22px 60px rgba(22, 32, 42, 0.08);
      --radius: 20px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "IBM Plex Sans", "Avenir Next", "Segoe UI", sans-serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(187, 77, 0, 0.12), transparent 32%),
        linear-gradient(180deg, #fbf8f2 0%, var(--bg) 100%);
    }
    .page {
      max-width: 1320px;
      margin: 0 auto;
      padding: 40px 24px 72px;
    }
    .hero {
      background: linear-gradient(135deg, rgba(255,255,255,0.96), rgba(255,249,240,0.96));
      border: 1px solid rgba(221, 212, 197, 0.9);
      border-radius: 28px;
      padding: 32px;
      box-shadow: var(--shadow);
      position: relative;
      overflow: hidden;
    }
    .hero::after {
      content: "";
      position: absolute;
      inset: auto -60px -80px auto;
      width: 240px;
      height: 240px;
      background: radial-gradient(circle, rgba(187, 77, 0, 0.18), transparent 66%);
    }
    .eyebrow {
      letter-spacing: 0.16em;
      text-transform: uppercase;
      font-size: 12px;
      color: var(--accent);
      margin: 0 0 12px;
      font-weight: 700;
    }
    h1 {
      margin: 0;
      font-size: clamp(32px, 5vw, 56px);
      line-height: 0.96;
      max-width: 900px;
    }
    .subtitle {
      margin: 16px 0 0;
      color: var(--muted);
      font-size: 18px;
      max-width: 900px;
      line-height: 1.5;
    }
    .stats-grid {
      margin-top: 24px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 14px;
    }
    .stat-card, .section-card, .coverage-card, .repo-card, .toolbar-card {
      background: var(--panel);
      border: 1px solid rgba(221, 212, 197, 0.95);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
    }
    .stat-card {
      padding: 18px;
    }
    .stat-label {
      display: block;
      color: var(--muted);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 26px;
    }
    .sections {
      margin-top: 24px;
      display: grid;
      gap: 20px;
    }
    .nav-pills {
      margin-top: 18px;
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .nav-pills a, .ghost-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 10px 14px;
      border-radius: 999px;
      text-decoration: none;
      color: var(--ink);
      background: rgba(255,255,255,0.82);
      border: 1px solid rgba(221, 212, 197, 0.9);
      font-weight: 600;
      cursor: pointer;
    }
    .toolbar-card {
      padding: 18px 20px;
    }
    .toolbar-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
      align-items: end;
    }
    .control {
      display: grid;
      gap: 8px;
    }
    .control span {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      font-weight: 700;
    }
    .control input, .control select {
      appearance: none;
      width: 100%;
      padding: 12px 14px;
      border-radius: 14px;
      border: 1px solid rgba(221, 212, 197, 0.95);
      background: rgba(255,255,255,0.96);
      color: var(--ink);
      font: inherit;
    }
    .section-card {
      padding: 24px;
      scroll-margin-top: 24px;
    }
    .section-head h2, .coverage-card h3, .repo-card h3 {
      margin: 0;
      font-size: 22px;
    }
    .section-body { margin-top: 16px; }
    .bullets {
      margin: 0;
      padding-left: 18px;
      line-height: 1.55;
    }
    .empty, .repo-copy, .repo-url, .mini-grid dd, .mini-grid dt, .table-wrap table {
      color: var(--muted);
    }
    .coverage-grid, .repo-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .coverage-card, .repo-card {
      padding: 20px;
    }
    .repo-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }
    .repo-badges {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 8px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 700;
      border: 1px solid transparent;
      white-space: nowrap;
    }
    .badge.accent { background: var(--accent-soft); color: var(--accent); border-color: rgba(187, 77, 0, 0.18); }
    .badge.info { background: var(--info-soft); color: var(--info); border-color: rgba(11, 114, 133, 0.18); }
    .badge.warn { background: var(--warn-soft); color: var(--warn); border-color: rgba(143, 61, 46, 0.16); }
    .badge.neutral { background: #f1ece4; color: #50606f; border-color: rgba(80, 96, 111, 0.12); }
    .repo-url a { color: var(--accent); text-decoration: none; }
    .mini-grid {
      margin: 14px 0 0;
      display: grid;
      gap: 12px;
    }
    .mini-grid dt {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .mini-grid dd { margin: 0; line-height: 1.5; }
    .table-wrap { overflow-x: auto; }
    .repo-details {
      margin-top: 14px;
      padding-top: 12px;
      border-top: 1px solid rgba(221, 212, 197, 0.9);
    }
    .repo-details summary {
      cursor: pointer;
      font-weight: 700;
      color: var(--accent);
    }
    .bar-list {
      display: grid;
      gap: 10px;
      margin-top: 12px;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(110px, 1fr) minmax(120px, 3fr) 40px;
      gap: 12px;
      align-items: center;
    }
    .bar-label, .bar-count {
      font-size: 13px;
      color: var(--muted);
    }
    .bar-track {
      position: relative;
      height: 10px;
      border-radius: 999px;
      background: #efe5d8;
      overflow: hidden;
    }
    .bar-fill {
      position: absolute;
      inset: 0 auto 0 0;
      background: linear-gradient(90deg, #ffb98c, #bb4d00);
      border-radius: inherit;
    }
    .hidden-by-filter {
      display: none !important;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .data-table th, .data-table td {
      padding: 12px 10px;
      text-align: left;
      border-bottom: 1px solid rgba(221, 212, 197, 0.9);
      vertical-align: top;
    }
    .data-table th {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
    }
    @media (max-width: 720px) {
      .page { padding: 18px 14px 44px; }
      .hero, .section-card, .coverage-card, .repo-card { padding: 18px; }
      .repo-head { flex-direction: column; }
      .repo-badges { justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <main class="page">
    <header class="hero">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(title)}</h1>
      <p class="subtitle">${escapeHtml(subtitle)}</p>
      <p class="subtitle">${escapeHtml(lead)}</p>
      <section class="stats-grid">
        ${renderHtmlStatCards(stats)}
      </section>
      ${navItems ? `<nav class="nav-pills">${navItems}</nav>` : ""}
    </header>
    <div class="sections">
      ${renderReportToolbar({ modeOptions, layerOptions })}
      ${sections.map((section) => renderHtmlSection(section.title, section.body, section.tone ?? "default", section.id ?? slugifyForId(section.title))).join("\n")}
    </div>
  </main>
  <script>
    (() => {
      const searchInput = document.getElementById("report-search");
      const fitSelect = document.getElementById("report-fit");
      const modeSelect = document.getElementById("report-mode");
      const layerSelect = document.getElementById("report-layer");
      const resetButton = document.getElementById("report-reset");
      const cards = Array.from(document.querySelectorAll(".filter-card"));
      const rows = Array.from(document.querySelectorAll(".data-table tbody tr"));

      const applyFilters = () => {
        const search = (searchInput?.value || "").trim().toLowerCase();
        const fit = fitSelect?.value || "";
        const mode = modeSelect?.value || "";
        const layer = layerSelect?.value || "";

        const matches = (node, rowSearch) => {
          const text = (node.dataset.search || rowSearch || "").toLowerCase();
          const fitValue = node.dataset.fit || "";
          const modeValue = node.dataset.mode || "";
          const layerValue = node.dataset.layer || "";
          return (!search || text.includes(search))
            && (!fit || fitValue === fit)
            && (!mode || modeValue === mode)
            && (!layer || layerValue === layer);
        };

        cards.forEach((card) => {
          card.classList.toggle("hidden-by-filter", !matches(card, ""));
        });

        rows.forEach((row) => {
          const firstCell = row.querySelector("td");
          const fitValue = row.children[3]?.textContent?.toLowerCase() || "";
          const layerValue = row.children[1]?.textContent?.toLowerCase() || "";
          const modeValue = row.children[2]?.textContent?.toLowerCase() || "";
          const rowSearch = [firstCell?.dataset.search || "", row.textContent || ""].join(" ").toLowerCase();
          const pseudoNode = { dataset: { search: rowSearch, fit: fitValue.includes("high") ? "high" : fitValue.includes("medium") ? "medium" : fitValue.includes("low") ? "low" : "unknown", mode: modeValue, layer: layerValue } };
          row.classList.toggle("hidden-by-filter", !matches(pseudoNode, rowSearch));
        });
      };

      [searchInput, fitSelect, modeSelect, layerSelect].forEach((node) => {
        node?.addEventListener("input", applyFilters);
        node?.addEventListener("change", applyFilters);
      });
      resetButton?.addEventListener("click", () => {
        if (searchInput) searchInput.value = "";
        if (fitSelect) fitSelect.value = "";
        if (modeSelect) modeSelect.value = "";
        if (layerSelect) layerSelect.value = "";
        applyFilters();
      });
      applyFilters();
    })();
  </script>
</body>
</html>`;
}

export async function buildWatchlistReview(rootDir, config, project, binding, alignmentRules, projectProfile, options = {}) {
  const analysisProfile = resolveAnalysisProfile(options.analysisProfile);
  const analysisDepth = resolveAnalysisDepth(options.analysisDepth);
  const watchlistUrls = await loadWatchlistUrls(rootDir, project);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === binding.projectKey);
  const queueByUrl = new Map(
    queueRows.map((row) => [row.normalized_repo_url || row.repo_url, row])
  );
  const items = [];
  const missingUrls = [];

  for (const url of watchlistUrls) {
    const row = queueByUrl.get(url);
    if (!row) {
      missingUrls.push(url);
      continue;
    }
    const item = {
      repoRef: `${row.owner}/${row.name}`,
      repoUrl: row.normalized_repo_url || row.repo_url,
      status: row.status,
      projectFitBand: row.project_fit_band || "unknown",
      projectFitScore: Number(row.project_fit_score || 0),
      matchedCapabilities: parseCsvList(row.matched_capabilities),
      recommendedWorkerAreas: parseCsvList(row.recommended_worker_areas),
      gapArea: row.eventbaer_gap_area_guess || "",
      mainLayer: row.main_layer_guess || "",
      patternFamily: row.pattern_family_guess || "",
      buildVsBorrow: row.build_vs_borrow_guess || "",
      priority: row.priority_guess || "",
      activityStatus: row.activity_status || "",
      eventbaerRelevance: row.eventbaer_relevance_guess || "",
      strengths: row.strengths || "",
      weaknesses: row.weaknesses || "",
      risks: parseCsvList(row.risks),
      learningForEventbaer: row.learning_for_eventbaer || "",
      possibleImplication: row.possible_implication || "",
      suggestedNextStep: row.suggested_next_step || "",
      stars: Number(row.stars || 0)
    };
    item.reviewScore = scoreWatchlistItemForProfile(item, analysisProfile.id);
    item.reason = buildWatchlistReviewReason(item, analysisProfile);
    items.push(item);
  }

  items.sort((left, right) => right.reviewScore - left.reviewScore);
  const topItems = items.slice(0, analysisDepth.topItems);
  const strongestPatterns = items
    .filter((item) => item.projectFitBand === "high" || item.projectFitScore >= 60)
    .slice(0, Math.min(analysisDepth.topItems, 8));
  const riskiestItems = [...items]
    .filter((item) => item.risks.length > 0 || item.activityStatus === "stale")
    .sort((left, right) => right.risks.length - left.risks.length || right.reviewScore - left.reviewScore)
    .slice(0, Math.min(analysisDepth.topItems, 8));
  const coverage = {
    mainLayers: summarizeFrequencyMap(items, "mainLayer"),
    gapAreas: summarizeFrequencyMap(items, "gapArea"),
    capabilities: summarizeFrequencyMap(items, "matchedCapabilities"),
    workerAreas: summarizeFrequencyMap(items, "recommendedWorkerAreas"),
    uncoveredCapabilities: buildCoverageGaps(alignmentRules, items)
  };
  const nextSteps = buildWatchlistNextSteps(
    analysisProfile,
    topItems,
    coverage.uncoveredCapabilities,
    missingUrls
  );

  return {
    createdAt: new Date().toISOString(),
    projectKey: binding.projectKey,
    projectLabel: binding.projectLabel ?? binding.projectKey,
    binding,
    projectProfile,
    analysisProfile,
    analysisDepth,
    watchlistCount: watchlistUrls.length,
    items,
    topItems,
    strongestPatterns,
    riskiestItems,
    missingUrls,
    coverage,
    nextSteps,
    projectProfileSummary: {
      capabilitiesPresent: projectProfile?.capabilitiesPresent ?? []
    }
  };
}

function hasSignal(text, signal) {
  return text.toLowerCase().includes(signal.toLowerCase());
}

function repoMatchesCapability(repoText, projectProfile, capability) {
  const signals = capability.signals ?? [];
  if (signals.length === 0) {
    return false;
  }

  const repoHit = signals.some((signal) => hasSignal(repoText, signal));
  const projectHit =
    projectProfile.capabilitiesPresent?.includes(capability.id) ||
    signals.some((signal) => hasSignal(projectProfile.corpus ?? "", signal));

  return repoHit && projectHit;
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean))];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function fitBand(score) {
  if (score >= 65) {
    return "high";
  }
  if (score >= 40) {
    return "medium";
  }
  return "low";
}

export function buildProjectAlignment(repo, guess, enrichment, projectProfile, alignmentRules) {
  if (!alignmentRules || !projectProfile) {
    return {
      status: "unavailable",
      fitBand: "unknown",
      fitScore: 0,
      matchedCapabilities: [],
      recommendedWorkerAreas: [],
      reviewDocs: [],
      tensions: [],
      suggestedNextStep: "Add project alignment rules to enable Stage-3 analysis.",
      rationale: []
    };
  }

  const repoText = buildClassificationText(repo, enrichment);
  const layerMapping = alignmentRules.layerMappings?.[guess.mainLayer] ?? {};
  const gapMapping = alignmentRules.gapMappings?.[guess.gapArea] ?? {};
  const matchedCapabilities = (alignmentRules.capabilities ?? [])
    .filter((capability) => repoMatchesCapability(repoText, projectProfile, capability))
    .map((capability) => capability.id);

  const reviewDocs = uniqueStrings([
    ...(layerMapping.review_docs ?? []),
    ...matchedCapabilities.flatMap((capabilityId) => {
      const capability = (alignmentRules.capabilities ?? []).find((item) => item.id === capabilityId);
      return capability?.review_docs ?? [];
    })
  ]);

  const tensions = uniqueStrings([
    alignmentRules.patternTensions?.[guess.patternFamily] ?? "",
    guess.mainLayer === "distribution_plugin" || guess.mainLayer === "ui_discovery_surface"
      ? "This pattern sits closer to distribution than to worker-core truth logic."
      : "",
    enrichment?.status === "success" && enrichment.repo.archived ? "Archived repositories should be treated as pattern signals, not dependencies." : ""
  ]);

  let score = 8;
  score += layerMapping.fit_bias ?? 0;
  score += gapMapping.fit_bias ?? 0;
  score += matchedCapabilities.length * 7;
  if (guess.buildVsBorrow === "adapt_pattern") {
    score += 8;
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    score += 3;
  }
  if (guess.priority === "now") {
    score += 8;
  }
  if (enrichment?.status === "success" && enrichment.repo.stars >= 100) {
    score += 5;
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    score -= 8;
  }
  if (tensions.length > 0) {
    score -= 6;
  }
  score = clamp(score, 0, 100);

  const rationale = uniqueStrings([
    `Primary layer '${guess.mainLayer}' maps into EventBaer worker areas: ${(layerMapping.worker_areas ?? []).join(", ") || "none"}.`,
    `Gap area '${guess.gapArea}' suggests: ${gapMapping.suggested_next_step ?? "no explicit project next step yet"}.`,
    matchedCapabilities.length > 0
      ? `Matched project capabilities: ${matchedCapabilities.join(", ")}.`
      : "No strong capability match was found yet; review manually.",
    tensions.length > 0 ? `Main tension: ${tensions.join(" | ")}` : ""
  ]);

  return {
    status: "ready",
    fitBand: fitBand(score),
    fitScore: score,
    matchedCapabilities,
    recommendedWorkerAreas: uniqueStrings(layerMapping.worker_areas ?? []),
    reviewDocs,
    tensions,
    suggestedNextStep:
      gapMapping.suggested_next_step ??
      layerMapping.next_step ??
      "Review the repo manually against the target project before promoting it.",
    rationale
  };
}

function isoDate(value) {
  return value ? String(value).slice(0, 10) : "";
}

function calculateDaysSince(dateValue) {
  if (!dateValue) {
    return null;
  }
  const delta = Date.now() - new Date(dateValue).getTime();
  return Math.floor(delta / (1000 * 60 * 60 * 24));
}

function deriveActivityStatus(enrichment) {
  if (enrichment?.status !== "success") {
    return "unknown";
  }
  if (enrichment.repo.archived) {
    return "archived";
  }
  const days = calculateDaysSince(enrichment.repo.pushedAt);
  if (days === null) {
    return "unknown";
  }
  if (days <= 90) {
    return "current";
  }
  if (days <= 365) {
    return "moderate";
  }
  return "stale";
}

function deriveMaturity(enrichment) {
  if (enrichment?.status !== "success") {
    return "needs_review";
  }
  if (enrichment.repo.archived) {
    return "archived";
  }
  if (enrichment.repo.stars >= 500 && deriveActivityStatus(enrichment) === "current") {
    return "infra_grade";
  }
  if (enrichment.repo.stars >= 50) {
    return "solid";
  }
  return "narrow_but_useful";
}

function deriveSourceFocus(text) {
  if (/(place|maps|geo|venue|location|business)/i.test(text)) {
    return "places";
  }
  if (/(event|calendar|meetup|festival|show|gig)/i.test(text)) {
    return "events";
  }
  return "mixed_or_unclear";
}

function deriveGeographicModel(text) {
  if (/(city|local|regional|munich|berlin|mcr)/i.test(text)) {
    return "regional";
  }
  if (/(facebook|meetup|resident advisor|google|maps|platform)/i.test(text)) {
    return "platform_bound";
  }
  return "global";
}

function deriveDataModel(text) {
  if (/(place|maps|geo|venue|location|business)/i.test(text)) {
    return "places_only";
  }
  if (/(event|calendar|meetup|festival|show|gig)/i.test(text)) {
    return "events_only";
  }
  return "mixed_entities";
}

function deriveDistributionType(text) {
  if (/(wordpress|wp-|plugin)/i.test(text)) {
    return "wordpress_plugin";
  }
  if (/(feed|ical|ics)/i.test(text)) {
    return "feed_export";
  }
  if (/(api|rest)/i.test(text)) {
    return "api";
  }
  if (/(frontend|site|website|discovery|web)/i.test(text)) {
    return "website";
  }
  return "none_visible";
}

function deriveSecondaryLayers(guess, enrichment) {
  const values = new Set();
  const text = buildClassificationText(
    {
      owner: "",
      name: "",
      normalizedRepoUrl: ""
    },
    enrichment
  );

  if (guess.mainLayer !== "parsing_extraction" && /(parse|extract|scrape|crawler)/i.test(text)) {
    values.add("parsing_extraction");
  }
  if (guess.mainLayer !== "export_feed_api" && /(feed|api|ical|ics|json)/i.test(text)) {
    values.add("export_feed_api");
  }
  if (guess.mainLayer !== "ui_discovery_surface" && /(frontend|site|website|discovery|web)/i.test(text)) {
    values.add("ui_discovery_surface");
  }
  if (guess.mainLayer !== "location_place_enrichment" && /(place|maps|geo|venue|location)/i.test(text)) {
    values.add("location_place_enrichment");
  }

  return [...values].join(",");
}

function deriveEventbaerRelevance(guess, enrichment) {
  if (guess.priority === "now") {
    return "high";
  }
  if (enrichment?.status === "success" && enrichment.repo.stars >= 100) {
    return "high";
  }
  if (guess.priority === "soon") {
    return "medium";
  }
  return "low";
}

function deriveDecision(guess) {
  if (guess.buildVsBorrow === "adapt_pattern") {
    return "adapt";
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    return "observe";
  }
  if (guess.buildVsBorrow === "observe_only") {
    return "observe";
  }
  if (guess.buildVsBorrow === "build_core") {
    return "adopt";
  }
  return "ignore";
}

function buildStrengths(guess, enrichment) {
  if (enrichment?.status !== "success") {
    return "Needs review with remote metadata unavailable";
  }
  const bits = [];
  if (enrichment.repo.description) {
    bits.push(enrichment.repo.description);
  }
  if (enrichment.repo.topics.length > 0) {
    bits.push(`Topics: ${enrichment.repo.topics.slice(0, 5).join(", ")}`);
  }
  if (enrichment.languages.length > 0) {
    bits.push(`Languages: ${enrichment.languages.slice(0, 3).join(", ")}`);
  }
  if (guess.priority === "now") {
    bits.push("Likely decision-relevant for EventBaer soon");
  }
  return bits.join(" | ") || "Visible public repo with enough surface for review";
}

function buildWeaknesses(guess, enrichment) {
  if (enrichment?.status !== "success") {
    return "Remote enrichment failed, so repo context is still shallow";
  }
  const bits = [];
  if (guess.category === "connector") {
    bits.push("Potentially narrow platform scope");
  }
  if (guess.category === "plugin") {
    bits.push("Distribution-heavy but likely not a truth core");
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    bits.push("Repo activity looks stale");
  }
  if (enrichment.repo.archived) {
    bits.push("Repository is archived");
  }
  return bits.join(" | ") || "Needs deeper repo reading to confirm system depth";
}

function buildRisks(guess, enrichment) {
  const bits = [];
  const text = buildClassificationText(
    {
      owner: "",
      name: "",
      normalizedRepoUrl: ""
    },
    enrichment
  );
  if (guess.category === "connector" || /(facebook|meetup|maps|resident advisor)/i.test(text)) {
    bits.push("source_lock_in");
  }
  if (/(scraper|crawler|browser)/i.test(text)) {
    bits.push("brittle_platform_changes");
  }
  if (enrichment?.status === "success" && enrichment.repo.archived) {
    bits.push("archived_repo");
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    bits.push("maintenance_risk");
  }
  return bits.join(",") || "needs_review";
}

function buildLearningForEventbaer(guess) {
  if (guess.gapArea === "distribution_surfaces" || guess.gapArea === "wordpress_plugin_distribution") {
    return "Distribution should be treated as a separate leverage layer on top of the worker core.";
  }
  if (guess.gapArea === "location_and_gastro_intelligence") {
    return "Location and venue intelligence deserve their own deliberate layer next to event truth.";
  }
  if (guess.gapArea === "source_systems_and_families") {
    return "Source infrastructure should be built as reusable families instead of isolated one-off connectors.";
  }
  return "This repo should be read as a pattern signal for EventBaer rather than copied as-is.";
}

function buildPossibleImplication(guess) {
  if (guess.buildVsBorrow === "adapt_pattern") {
    return "Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.";
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    return "Treat as optional supporting layer, not as system core.";
  }
  if (guess.buildVsBorrow === "build_core") {
    return "Check whether EventBaer should own this capability directly in its core.";
  }
  return "Keep on review watchlist until there is a sharper project need.";
}

export function buildLandkarteCandidate(repo, guess, enrichment) {
  const classificationText = buildClassificationText(repo, enrichment);
  return {
    name: repo.name,
    repo_url: repo.normalizedRepoUrl,
    owner: repo.owner,
    category: guess.category,
    pattern_family: guess.patternFamily,
    main_layer: guess.mainLayer,
    secondary_layers: deriveSecondaryLayers(guess, enrichment),
    source_focus: deriveSourceFocus(classificationText),
    geographic_model: deriveGeographicModel(classificationText),
    data_model: deriveDataModel(classificationText),
    distribution_type: deriveDistributionType(classificationText),
    stars: String(enrichment?.repo?.stars ?? ""),
    activity_status: deriveActivityStatus(enrichment),
    last_checked_at: isoDate(enrichment?.fetchedAt ?? new Date().toISOString()),
    maturity: deriveMaturity(enrichment),
    strengths: buildStrengths(guess, enrichment),
    weaknesses: buildWeaknesses(guess, enrichment),
    risks: buildRisks(guess, enrichment),
    learning_for_eventbaer: buildLearningForEventbaer(guess),
    possible_implication: buildPossibleImplication(guess),
    eventbaer_gap_area: guess.gapArea,
    build_vs_borrow: guess.buildVsBorrow,
    priority_for_review: guess.priority,
    eventbaer_relevance: deriveEventbaerRelevance(guess, enrichment),
    decision: deriveDecision(guess),
    notes: `stage2_candidate:${enrichment?.status ?? "unknown"}`
  };
}

export function buildPromotionDocPath(rootDir, project, repo) {
  return path.join(rootDir, project.promotionRoot, `${repo.slug}.md`);
}

function buildRepoFromQueueEntry(queueEntry) {
  return {
    owner: queueEntry.owner,
    name: queueEntry.name,
    normalizedRepoUrl: queueEntry.normalized_repo_url || queueEntry.repo_url,
    slug: `${queueEntry.owner}__${queueEntry.name}`.toLowerCase(),
    host: queueEntry.host || "github.com"
  };
}

function buildLandkarteRowFromQueueEntry(queueEntry) {
  return {
    name: queueEntry.name,
    repo_url: queueEntry.normalized_repo_url || queueEntry.repo_url,
    owner: queueEntry.owner,
    category: queueEntry.category_guess,
    pattern_family: queueEntry.pattern_family_guess,
    main_layer: queueEntry.main_layer_guess,
    secondary_layers: queueEntry.secondary_layers || "",
    source_focus: queueEntry.source_focus || "",
    geographic_model: queueEntry.geographic_model || "",
    data_model: queueEntry.data_model || "",
    distribution_type: queueEntry.distribution_type || "",
    stars: queueEntry.stars,
    activity_status: queueEntry.activity_status || "",
    last_checked_at: isoDate(queueEntry.last_api_sync_at || queueEntry.updated_at || new Date().toISOString()),
    maturity: queueEntry.maturity || "",
    strengths: queueEntry.strengths || queueEntry.description || "",
    weaknesses: queueEntry.weaknesses || "",
    risks: queueEntry.risks || "",
    learning_for_eventbaer: queueEntry.learning_for_eventbaer || "",
    possible_implication: queueEntry.possible_implication || queueEntry.suggested_next_step || "",
    eventbaer_gap_area: queueEntry.eventbaer_gap_area_guess,
    build_vs_borrow: queueEntry.build_vs_borrow_guess,
    priority_for_review: queueEntry.priority_guess,
    eventbaer_relevance:
      queueEntry.eventbaer_relevance_guess ||
      (queueEntry.project_fit_band === "high" ? "high" : queueEntry.project_fit_band === "medium" ? "medium" : "low"),
    decision:
      queueEntry.decision_guess ||
      (queueEntry.build_vs_borrow_guess === "build_core"
        ? "adopt"
        : queueEntry.build_vs_borrow_guess === "adapt_pattern"
          ? "adapt"
          : queueEntry.build_vs_borrow_guess === "borrow_optional" || queueEntry.build_vs_borrow_guess === "observe_only"
            ? "observe"
            : "ignore"),
    notes: `stage4_promoted:${queueEntry.enrichment_status || "unknown"}`
  };
}

function buildLearningCandidate(queueEntry, binding) {
  const projectLabel = binding.projectLabel ?? binding.projectKey;
  const repoRef = `${queueEntry.owner}/${queueEntry.name}`;
  const matchedCapabilities = queueEntry.matched_capabilities
    ? queueEntry.matched_capabilities.split(",").filter(Boolean)
    : [];
  const workerAreas = queueEntry.recommended_worker_areas
    ? queueEntry.recommended_worker_areas.split(",").filter(Boolean)
    : [];

  return {
    title: `${repoRef} als Signal fuer ${queueEntry.eventbaer_gap_area_guess || "relevante Ausbauachsen"}`,
    observation:
      queueEntry.description ||
      `${repoRef} liefert ein erkennbares Muster in '${queueEntry.pattern_family_guess || "unknown"}'.`,
    repeatingPatterns: [
      queueEntry.pattern_family_guess
        ? `Pattern Family: ${queueEntry.pattern_family_guess}`
        : "",
      queueEntry.main_layer_guess ? `Main Layer: ${queueEntry.main_layer_guess}` : "",
      queueEntry.project_fit_band
        ? `Project Fit: ${queueEntry.project_fit_band} (${queueEntry.project_fit_score || "0"})`
        : "",
      matchedCapabilities.length > 0
        ? `Matched Capabilities: ${matchedCapabilities.join(", ")}`
        : "No strong capability match was auto-detected yet"
    ].filter(Boolean),
    meaningForProject:
      queueEntry.learning_for_eventbaer ||
      `${projectLabel} sollte dieses Repo als verwertbares Mustersignal lesen, nicht als Blaupause.`,
    implication:
      queueEntry.possible_implication ||
      queueEntry.suggested_next_step ||
      `Review fuer ${projectLabel} vertiefen und bei echtem Mehrwert spaeter kuratieren.`,
    workerAreas
  };
}

function buildDecisionCandidate(queueEntry, binding) {
  const projectLabel = binding.projectLabel ?? binding.projectKey;
  const repoRef = `${queueEntry.owner}/${queueEntry.name}`;
  const triggeredBy = [repoRef];
  if (queueEntry.pattern_family_guess) {
    triggeredBy.push(queueEntry.pattern_family_guess);
  }

  return {
    title: `${repoRef} fuer ${projectLabel} als '${queueEntry.build_vs_borrow_guess || "review"}' behandeln`,
    date: isoDate(queueEntry.updated_at || queueEntry.created_at || new Date().toISOString()),
    decision:
      queueEntry.build_vs_borrow_guess === "build_core"
        ? "adopt"
        : queueEntry.build_vs_borrow_guess === "adapt_pattern"
          ? "adapt"
          : queueEntry.build_vs_borrow_guess === "borrow_optional" || queueEntry.build_vs_borrow_guess === "observe_only"
            ? "observe"
            : "ignore",
    triggeredBy,
    rationale: [
      queueEntry.description ? queueEntry.description : "",
      queueEntry.project_fit_band
        ? `Project fit is '${queueEntry.project_fit_band}' with score ${queueEntry.project_fit_score || "0"}.`
        : "",
      queueEntry.matched_capabilities
        ? `Matched project capabilities: ${queueEntry.matched_capabilities}.`
        : "",
      queueEntry.project_relevance_note || ""
    ]
      .filter(Boolean)
      .join(" "),
    impact:
      queueEntry.learning_for_eventbaer ||
      `${projectLabel} sollte das Repo nur als gezielte Architekturhilfe behandeln.`,
    nextStep:
      queueEntry.suggested_next_step ||
      `Manuellen Review im Kontext von ${projectLabel} abschliessen.`,
    status: "proposed"
  };
}

export function buildPromotionCandidate(queueEntry, binding) {
  return {
    repo: buildRepoFromQueueEntry(queueEntry),
    landkarteRow: buildLandkarteRowFromQueueEntry(queueEntry),
    learning: buildLearningCandidate(queueEntry, binding),
    decision: buildDecisionCandidate(queueEntry, binding)
  };
}

export function renderPromotionPacket({ queueEntry, promotion, binding, createdAt, applyMode }) {
  const projectLabel = binding.projectLabel ?? binding.projectKey;
  const learning = promotion.learning;
  const decision = promotion.decision;

  return `# Promotion Packet — ${queueEntry.owner}/${queueEntry.name}

## Snapshot

- created_at: ${createdAt}
- project: ${binding.projectKey}
- source_status: ${queueEntry.status}
- apply_mode: ${applyMode ? "apply" : "prepare_only"}
- intake_doc: ${queueEntry.intake_doc || "-"}
- repo_url: ${queueEntry.normalized_repo_url || queueEntry.repo_url}

## Warum dieser Fund nach vorne gezogen wird

- ${queueEntry.project_relevance_note || `Das Repo wirkt relevant fuer ${projectLabel}.`}
- project_fit_band: ${queueEntry.project_fit_band || "-"}
- project_fit_score: ${queueEntry.project_fit_score || "-"}
- suggested_next_step: ${queueEntry.suggested_next_step || "-"}

## Kandidat fuer repo_landkarte.csv

${renderBulletMap(promotion.landkarteRow)}

## Kandidat fuer repo_learnings.md

### ${learning.title}

**Beobachtung**
- ${learning.observation}

**Wiederkehrende Muster**
${learning.repeatingPatterns.map((item) => `- ${item}`).join("\n")}

**Bedeutung fuer ${projectLabel}**
- ${learning.meaningForProject}

**Moegliche Konsequenz**
- ${learning.implication}

${learning.workerAreas.length > 0 ? `**Betroffene Worker-Areas**\n- ${learning.workerAreas.join("\n- ")}\n` : ""}
## Kandidat fuer repo_decisions.md

### ${decision.title}

**Datum**
- ${decision.date}

**Ausloeser**
${decision.triggeredBy.map((item) => `- ${item}`).join("\n")}

**Entscheidung**
- ${decision.decision}

**Begruendung**
- ${decision.rationale}

**Konkrete Bedeutung fuer ${projectLabel}**
- ${decision.impact}

**Naechster Schritt**
- ${decision.nextStep}

**Status**
- ${decision.status}
`;
}

export async function writePromotionPacket({ promotionDocPath, content, dryRun }) {
  if (dryRun) {
    return { created: true };
  }
  await fs.writeFile(promotionDocPath, content, "utf8");
  return { created: true };
}

async function readTextOrEmpty(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function upsertManagedBlock(document, sectionKey, sectionTitle, blockKey, blockContent) {
  const sectionStart = `<!-- patternpilot:${sectionKey}:start -->`;
  const sectionEnd = `<!-- patternpilot:${sectionKey}:end -->`;
  const blockStart = `<!-- patternpilot:${sectionKey}:${blockKey}:start -->`;
  const blockEnd = `<!-- patternpilot:${sectionKey}:${blockKey}:end -->`;
  const normalizedBlock = `${blockStart}\n${blockContent.trim()}\n${blockEnd}`;
  let working = document;

  if (!working.includes(sectionStart) || !working.includes(sectionEnd)) {
    working = `${working.trim()}\n\n## ${sectionTitle}\n\n${sectionStart}\n${sectionEnd}\n`;
  }

  const blockPattern = new RegExp(
    `${blockStart.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[\\s\\S]*?${blockEnd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
    "m"
  );
  if (blockPattern.test(working)) {
    return working.replace(blockPattern, normalizedBlock);
  }

  return working.replace(sectionEnd, `${normalizedBlock}\n\n${sectionEnd}`);
}

export async function upsertManagedMarkdownBlock({
  filePath,
  sectionKey,
  sectionTitle,
  blockKey,
  blockContent,
  dryRun
}) {
  const current = await readTextOrEmpty(filePath);
  const next = upsertManagedBlock(current, sectionKey, sectionTitle, blockKey, blockContent);
  if (!dryRun) {
    await fs.writeFile(filePath, next, "utf8");
  }
}

export async function upsertLandkarteEntry(rootDir, landkarteRow, dryRun = false) {
  const landkartePath = path.join(rootDir, "repo_landkarte.csv");
  const { header, rows } = await readQueue(landkartePath);
  for (const key of Object.keys(landkarteRow)) {
    if (!header.includes(key)) {
      header.push(key);
    }
  }
  const index = rows.findIndex((row) => row.repo_url === landkarteRow.repo_url);
  if (index >= 0) {
    rows[index] = { ...rows[index], ...landkarteRow };
  } else {
    rows.push(landkarteRow);
  }
  if (!dryRun) {
    await writeQueue(landkartePath, header, rows);
  }
}

export function renderLearningBlock(promotion, queueEntry) {
  return `### Candidate: ${queueEntry.owner}/${queueEntry.name}

**Quelle**
- ${queueEntry.normalized_repo_url || queueEntry.repo_url}

**Beobachtung**
- ${promotion.learning.observation}

**Wiederkehrende Muster**
${promotion.learning.repeatingPatterns.map((item) => `- ${item}`).join("\n")}

**Bedeutung fuer EventBaer**
- ${promotion.learning.meaningForProject}

**Moegliche Konsequenz**
- ${promotion.learning.implication}`;
}

export function renderDecisionBlock(promotion, queueEntry, binding) {
  const projectLabel = binding.projectLabel ?? binding.projectKey;
  return `### Candidate: ${promotion.decision.title}

**Datum**
- ${promotion.decision.date}

**Ausloeser**
${promotion.decision.triggeredBy.map((item) => `- ${item}`).join("\n")}

**Entscheidung**
- ${promotion.decision.decision}

**Begruendung**
- ${promotion.decision.rationale}

**Konkrete Bedeutung fuer ${projectLabel}**
- ${promotion.decision.impact}

**Naechster Schritt**
- ${promotion.decision.nextStep}

**Status**
- ${promotion.decision.status}`;
}

function renderBulletMap(object) {
  return Object.entries(object)
    .map(([key, value]) => `- ${key}: ${value || "-"}`)
    .join("\n");
}

function renderEnrichmentSection(enrichment) {
  if (!enrichment || enrichment.status === "skipped") {
    return [
      "## GitHub Enrichment",
      "",
      "- enrichment_status: skipped",
      "- note: Remote-Anreicherung wurde bewusst uebersprungen."
    ].join("\n");
  }

  if (enrichment.status !== "success") {
    return [
      "## GitHub Enrichment",
      "",
      `- enrichment_status: ${enrichment.status}`,
      `- auth_mode: ${enrichment.authMode ?? "unknown"}`,
      `- error: ${enrichment.error ?? "unknown"}`,
      "- note: Intake kann weiterverwendet werden, aber Review braucht noch mehr manuelle Sichtung."
    ].join("\n");
  }

  return [
    "## GitHub Enrichment",
    "",
    `- enrichment_status: ${enrichment.status}`,
    `- auth_mode: ${enrichment.authMode}`,
    `- auth_source: ${enrichment.authSource ?? "-"}`,
    `- stars: ${enrichment.repo.stars}`,
    `- forks: ${enrichment.repo.forks}`,
    `- watchers: ${enrichment.repo.watchers}`,
    `- open_issues: ${enrichment.repo.openIssues}`,
    `- primary_language: ${enrichment.repo.language || "-"}`,
    `- languages: ${enrichment.languages.join(", ") || "-"}`,
    `- topics: ${enrichment.repo.topics.join(", ") || "-"}`,
    `- license: ${enrichment.repo.license || "-"}`,
    `- default_branch: ${enrichment.repo.defaultBranch || "-"}`,
    `- visibility: ${enrichment.repo.visibility || "-"}`,
    `- archived: ${enrichment.repo.archived ? "yes" : "no"}`,
    `- updated_at: ${enrichment.repo.updatedAt || "-"}`,
    `- pushed_at: ${enrichment.repo.pushedAt || "-"}`,
    `- homepage: ${enrichment.repo.homepage || "-"}`,
    `- description: ${enrichment.repo.description || "-"}`
  ].join("\n");
}

function renderReadmeSection(enrichment) {
  if (!enrichment || enrichment.status !== "success") {
    return [
      "## README Snapshot",
      "",
      "- README konnte nicht automatisch geladen werden."
    ].join("\n");
  }

  if (!enrichment.readme?.excerpt) {
    return [
      "## README Snapshot",
      "",
      `- README not available: ${enrichment.readme?.error ?? "no content"}`
    ].join("\n");
  }

  return [
    "## README Snapshot",
    "",
    `- readme_path: ${enrichment.readme.path || "-"}`,
    `- readme_url: ${enrichment.readme.htmlUrl || "-"}`,
    "",
    enrichment.readme.excerpt
  ].join("\n");
}

function buildAutoHypotheses(repo, guess, enrichment, projectLabel) {
  const lines = [
    `- Dieses Repo wirkt primaer wie '${guess.patternFamily}' in der Kategorie '${guess.category}'.`,
    `- Fuer ${projectLabel} scheint besonders '${guess.gapArea}' relevant.`,
    `- Die staerkste beleuchtete Schicht wirkt aktuell wie '${guess.mainLayer}'.`,
    `- Vorlaeufige Tendenz fuer Build-vs-Borrow: '${guess.buildVsBorrow}'.`
  ];

  if (enrichment?.status === "success") {
    lines.push(`- Repo-Aktivitaet wirkt derzeit: '${deriveActivityStatus(enrichment)}'.`);
    if (enrichment.repo.description) {
      lines.push(`- Oeffentliche Kurzbeschreibung bestaetigt den Fokus: "${enrichment.repo.description}".`);
    }
  } else {
    lines.push("- Remote-Anreicherung fehlt oder ist gescheitert; diese Hypothesen sind entsprechend unsicherer.");
  }

  return lines.join("\n");
}

export function renderIntakeDoc({
  repo,
  guess,
  enrichment,
  landkarteCandidate,
  projectAlignment,
  projectProfile,
  binding,
  projectLabel,
  repoRoot,
  createdAt,
  notes
}) {
  const readFiles = binding.readBeforeAnalysis.map((item) => `- \`${item}\``).join("\n");
  const refDirs = binding.referenceDirectories.map((item) => `- \`${item}/\``).join("\n");
  const questions = binding.analysisQuestions.map((item) => `- ${item}`).join("\n");
  const capabilities = binding.targetCapabilities.map((item) => `- ${item}`).join("\n");
  const profileFilesLoaded = projectProfile?.referenceFiles?.filter((item) => item.exists).length ?? 0;

  return `# Intake Dossier — ${repo.owner}/${repo.name}

## Snapshot

- created_at: ${createdAt}
- status: pending_review
- project: ${binding.projectKey}
- repo_url: ${repo.normalizedRepoUrl}
- source_host: ${repo.host}
- repo_root_reference: \`${repoRoot}\`
- context_files_loaded: ${profileFilesLoaded}
- context_directories_scanned: ${projectProfile?.referenceDirectories?.filter((item) => item.entries.length > 0).length ?? 0}

## Warum das fuer ${projectLabel} relevant sein koennte

- ${buildProjectRelevanceNote(binding, guess)}
- Intake wurde automatisch aus einem GitHub-Link erzeugt und ist noch nicht kuratiert.

## Auto-Guesses — noch keine Wahrheit

- category_guess: \`${guess.category}\`
- pattern_family_guess: \`${guess.patternFamily}\`
- main_layer_guess: \`${guess.mainLayer}\`
- eventbaer_gap_area_guess: \`${guess.gapArea}\`
- build_vs_borrow_guess: \`${guess.buildVsBorrow}\`
- priority_guess: \`${guess.priority}\`

${renderEnrichmentSection(enrichment)}

${renderReadmeSection(enrichment)}

## Auto-Hypothesen fuer den Review

${buildAutoHypotheses(repo, guess, enrichment, projectLabel)}

## Project Alignment — ${projectLabel}

- alignment_status: ${projectAlignment?.status ?? "unavailable"}
- project_fit_band: ${projectAlignment?.fitBand ?? "unknown"}
- project_fit_score: ${projectAlignment?.fitScore ?? 0}
- matched_capabilities: ${projectAlignment?.matchedCapabilities?.join(", ") || "-"}
- recommended_worker_areas: ${projectAlignment?.recommendedWorkerAreas?.join(", ") || "-"}
- review_docs: ${projectAlignment?.reviewDocs?.join(", ") || "-"}
- tensions: ${projectAlignment?.tensions?.join(" | ") || "-"}
- suggested_next_step: ${projectAlignment?.suggestedNextStep ?? "-"}
- reference_files_loaded: ${profileFilesLoaded}

## Alignment Rationale

${(projectAlignment?.rationale ?? ["- No alignment rationale available."]).map((item) => `- ${item}`).join("\n")}

## Kontext, den Patternpilot aus dem Zielrepo gelesen hat

- geladene_leitdateien: ${(projectProfile?.contextSources?.loadedFiles ?? []).join(", ") || "-"}
- fehlende_kontextdateien: ${(projectProfile?.contextSources?.missingFiles ?? []).join(", ") || "-"}
- gescannte_verzeichnisse: ${(projectProfile?.contextSources?.scannedDirectories ?? []).filter((item) => item.entryCount > 0).map((item) => `${item.path}/ (${item.entryCount})`).join(", ") || "-"}

## Vor dem Review zuerst im Zielrepo lesen

${readFiles}

## Besonders relevante Verzeichnisse im Zielrepo

${refDirs}

## Zielbild und Staerkungsachsen

${capabilities}

## Review-Fragen

${questions}

## Review-Notizen

- Repo-Zweck:
- Kernfluss:
- Relevante Schichten:
- Staerken:
- Schwaechen:
- Risiken:
- Learning fuer EventBaer:
- Moegliche konkrete Folge:

## Promotion Candidate fuer repo_landkarte.csv

${renderBulletMap(landkarteCandidate)}

## Promotion-Kriterien

- Nur nach Review in \`repo_landkarte.csv\` uebernehmen
- Nur verdichtete Muster nach \`repo_learnings.md\`
- Nur echte Richtungsentscheide nach \`repo_decisions.md\`

## Intake-Notizen

${notes ? `- ${notes}` : "- Keine zusaetzlichen Intake-Notizen uebergeben."}
`;
}

export async function writeIntakeDoc({
  intakeDocPath,
  content,
  dryRun,
  force
}) {
  if (dryRun) {
    return { created: true, overwritten: false };
  }

  try {
    await fs.access(intakeDocPath);
    if (!force) {
      return { created: false, overwritten: false };
    }
  } catch {
    // file does not exist, continue
  }

  await fs.writeFile(intakeDocPath, content, "utf8");
  return { created: true, overwritten: force };
}

export async function writeRunArtifacts({
  rootDir,
  config,
  projectKey,
  runId,
  manifest,
  summary,
  projectProfile,
  dryRun
}) {
  const runDir = path.join(rootDir, config.runtimeRoot, projectKey, runId);
  if (!dryRun) {
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    await fs.writeFile(path.join(runDir, "summary.md"), summary, "utf8");
    if (projectProfile) {
      await fs.writeFile(path.join(runDir, "project_profile.json"), JSON.stringify(projectProfile, null, 2), "utf8");
    }
  }
  return runDir;
}

export function renderRunSummary({ runId, projectKey, createdAt, items, dryRun }) {
  const lines = items.map((item) => {
    const enrichment = item.enrichment?.status ?? "unknown";
    const fit = item.projectAlignment?.fitBand ?? "unknown";
    return `- ${item.repo.owner}/${item.repo.name} -> ${item.intakeDocRelativePath} (${item.action}; enrichment=${enrichment}; fit=${fit})`;
  });

  return `# Patternpilot Intake Run

- run_id: ${runId}
- project: ${projectKey}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}

## Items

${lines.join("\n")}
`;
}

export function renderDiscoverySummary({ runId, projectKey, createdAt, discovery, dryRun }) {
  const profile = discovery.discoveryProfile ?? resolveDiscoveryProfile("balanced", null);
  const candidateLines = discovery.candidates.length > 0
    ? discovery.candidates.map((candidate) => {
        const fit = candidate.projectAlignment?.fitBand ?? "unknown";
        const disposition = candidate.discoveryDisposition ?? "watch_only";
        return `- ${candidate.repo.owner}/${candidate.repo.name} (${candidate.discoveryScore}; fit=${fit}; disposition=${disposition}; lenses=${candidate.queryLabels.join(", ") || "-"})`;
      }).join("\n")
    : "- none";
  const queryLines = discovery.plan.plans.length > 0
    ? discovery.plan.plans.map((plan) => `- ${plan.label}: ${plan.query}`).join("\n")
    : "- none";
  const errorLines = discovery.searchErrors.length > 0
    ? discovery.searchErrors.map((error) => `- ${error.label}: ${error.error}`).join("\n")
    : "- none";

  return `# Patternpilot Discovery Run

- run_id: ${runId}
- project: ${projectKey}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}
- offline: ${discovery.offline ? "yes" : "no"}
- discovery_profile: ${profile.id}
- profile_limit: ${profile.limit}
- queries: ${discovery.plan.plans.length}
- known_urls_catalogued: ${discovery.knownUrlCount}
- search_results_scanned: ${discovery.scanned}
- candidates: ${discovery.candidates.length}

## Discovery Plan

${queryLines}

## Search Errors

${errorLines}

## Candidates

${candidateLines}
`;
}

export function renderDiscoveryHtmlReport({
  projectKey,
  createdAt,
  discovery,
  projectProfile,
  binding,
  reportView = "standard"
}) {
  const view = resolveReportView(reportView);
  const profile = discovery.discoveryProfile ?? resolveDiscoveryProfile("balanced", null);
  const topRecommendations = discovery.candidates
    .slice(0, Math.min(5, view.candidateCount))
    .map((candidate) => {
      const transfer = candidate.landkarteCandidate?.possible_implication ?? candidate.projectAlignment?.suggestedNextStep ?? "Review manually.";
      return `${candidate.repo.owner}/${candidate.repo.name}: ${transfer}`;
    });
  const sections = [
    {
      title: "Top recommendations",
      id: "top-recommendations",
      tone: "accent",
      body: renderHtmlList(
        topRecommendations,
        "No candidates yet. Run discovery with network access or widen the search profile."
      )
    },
    {
      title: "Target repo context used",
      id: "target-repo-context-used",
      tone: "info",
      body: renderProjectContextSources(projectProfile, binding)
    },
    {
      title: "Candidate overview",
      id: "candidate-overview",
      body: renderDiscoveryCandidateCards(discovery.candidates, view)
    }
  ];

  if (view.showQueries) {
    sections.push({
      title: "Discovery lenses",
      id: "discovery-lenses",
      tone: "info",
      body: `<div class="coverage-grid">${discovery.plan.plans.map((plan) => `<article class="coverage-card">
  <h3>${escapeHtml(plan.label)}</h3>
  <p class="repo-copy">${escapeHtml(plan.query)}</p>
  ${renderHtmlList(plan.reasons, "No reasons recorded.")}
</article>`).join("")}</div>`
    });
  }

  sections.push({
    title: "Search errors",
    id: "search-errors",
    tone: discovery.searchErrors.length > 0 ? "warn" : "default",
    body: renderHtmlList(
        discovery.searchErrors.map((item) => `${item.label}: ${item.error}`),
        "No search errors."
      )
  });

  return renderHtmlDocument({
    title: `${projectKey} discovery report`,
    eyebrow: "Patternpilot Discovery",
    subtitle: `Heuristic GitHub scan for ${projectKey}.`,
    lead: "This report turns discovery candidates into a readable shortlist with direct transfer ideas and next actions.",
    stats: [
      { label: "Profile", value: profile.id },
      { label: "Profile limit", value: profile.limit },
      { label: "Queries", value: discovery.plan.plans.length },
      { label: "Known repos skipped", value: discovery.knownUrlCount },
      { label: "Search results scanned", value: discovery.scanned },
      { label: "Candidates", value: discovery.candidates.length },
      { label: "Created", value: createdAt.slice(0, 16).replace("T", " ") },
      { label: "View", value: view.id }
    ],
    sections,
    modeOptions: uniqueStrings(discovery.candidates.map((candidate) => candidate.discoveryDisposition)),
    layerOptions: uniqueStrings(discovery.candidates.map((candidate) => candidate.guess?.mainLayer ?? ""))
  });
}

export function renderWatchlistReviewHtmlReport(review, reportView = "standard") {
  const view = resolveReportView(reportView);
  const sections = [
    {
      title: "Top recommendations",
      id: "top-recommendations",
      tone: "accent",
      body: renderHtmlList(review.nextSteps, "No recommendations yet.")
    },
    {
      title: "Target repo context used",
      id: "target-repo-context-used",
      tone: "info",
      body: renderProjectContextSources(review.projectProfile, review.binding)
    },
    {
      title: "Top compared repositories",
      id: "top-compared-repositories",
      body: renderWatchlistTopCards(review, view)
    }
  ];

  if (view.showCoverage) {
    sections.push({
      title: "Coverage",
      id: "coverage",
      body: renderCoverageCards(review.coverage)
    });
  }

  sections.push({
    title: "Highest risk signals",
    id: "highest-risk-signals",
    tone: review.riskiestItems.length > 0 ? "warn" : "default",
    body: renderHtmlList(
        review.riskiestItems.map((item) => `${item.repoRef}: ${item.risks.join(", ") || item.weaknesses || "needs_review"}`),
        "No strong risk signals in the current review set."
      )
  });

  sections.push({
    title: "Missing watchlist intake",
    id: "missing-watchlist-intake",
    body: renderHtmlList(review.missingUrls, "All current watchlist URLs already have queue coverage.")
  });

  if (view.showMatrix) {
    sections.push({
      title: "Repo matrix",
      id: "repo-matrix",
      body: renderRepoMatrix(review, view)
    });
  }

  return renderHtmlDocument({
    title: `${review.projectKey} watchlist review`,
    eyebrow: "Patternpilot Review",
    subtitle: `Watchlist comparison for ${review.projectLabel}.`,
    lead: "This report condenses watchlist-backed repository analysis into strengths, transfer opportunities, and next actions for the target project.",
    stats: [
      { label: "Analysis profile", value: review.analysisProfile.id },
      { label: "Depth", value: review.analysisDepth.id },
      { label: "Watchlist URLs", value: review.watchlistCount },
      { label: "Reviewed repos", value: review.items.length },
      { label: "Missing intake", value: review.missingUrls.length },
      { label: "Top items shown", value: Math.min(review.topItems.length, view.candidateCount) },
      { label: "Created", value: review.createdAt.slice(0, 16).replace("T", " ") },
      { label: "View", value: view.id }
    ],
    sections,
    modeOptions: uniqueStrings(review.items.map((item) => item.gapArea || "")),
    layerOptions: uniqueStrings(review.items.map((item) => item.mainLayer || ""))
  });
}
