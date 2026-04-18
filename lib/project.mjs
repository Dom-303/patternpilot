import fs from "node:fs/promises";
import path from "node:path";
import {
  safeStat,
  pathExists,
  slugifyProjectKey,
  asRelativeFromRoot,
  uniqueStrings,
  safeReadText,
  safeReadDir,
  resolveProjectPath,
  stripMarkdown
} from "./utils.mjs";
import { writeConfig } from "./config.mjs";
import { defaultDiscoveryPolicy } from "./policy/discovery-policy.mjs";

export function resolveProjectKey(config, options = {}, commandName = "this command") {
  const projectKey = options.project || config.defaultProject || null;
  if (projectKey) {
    return projectKey;
  }

  throw new Error(
    `No project is configured for ${commandName}. Run 'npm run getting-started' or 'npm run bootstrap -- --project my-project --target ../my-project --label "My Project"' first.`
  );
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

export async function loadProjectDiscoveryPolicy(rootDir, project, binding) {
  const policyFile = binding.discoveryPolicyFile ?? project.discoveryPolicyFile;
  const fallback = defaultDiscoveryPolicy(binding.projectKey ?? project.label ?? "project");
  if (!policyFile) {
    return fallback;
  }

  try {
    const raw = await fs.readFile(path.join(rootDir, policyFile), "utf8");
    return {
      ...fallback,
      ...JSON.parse(raw)
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return fallback;
    }
    throw error;
  }
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
    discoveryStrategy: {
      broadAnchorCount: 2,
      broadSignalCount: 1,
      broadMaxTerms: 3,
      capabilityAnchorCount: 1,
      capabilitySignalCount: 2,
      capabilityMaxTerms: 4,
      manualAnchorCount: 1,
      manualMaxTerms: 4,
      seedSignalSources: ["discoveryHints"],
      seedRepoFields: ["fullName", "name", "description", "homepage", "topics"],
      minSeedSignalHits: 2,
      minStrongSeedSignalHits: 1,
      defaultStrongSignals: ["api", "calendar", "connector", "crawler", "event", "feed", "plugin", "scraper"]
    },
    alignmentRulesFile: `bindings/${projectKey}/ALIGNMENT_RULES.json`,
    discoveryPolicyFile: `bindings/${projectKey}/DISCOVERY_POLICY.json`,
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

Sie lebt bewusst im Projekt-Workspace unter \`projects/${projectKey}/\` und beschreibt damit die von Patternpilot erzeugte Arbeitslinse auf das Zielrepo.

## Zielrepo

- Label: ${projectLabel}
- Project Key: ${projectKey}
- Repo Path relativ zu Patternpilot: \`${projectRoot}\`
- Technische Projekt-Bindung: \`bindings/${projectKey}/\`

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
- Ablageort: \`bindings/${projectKey}/\` ist die technische Bindung, waehrend \`projects/${projectKey}/\` der Arbeits- und Ergebnisraum bleibt

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

## Discovery-Strategie

- Query-Breite und Seed-Gates koennen pro Projekt ueber \`discoveryStrategy\` in \`PROJECT_BINDING.json\` geschaerft werden.
- Damit bleibt Patternpilot als Produkt generisch, waehrend Zielprojekte ihre eigene Suchschaerfe und Rauschgrenzen setzen.

## Fragen, die Patternpilot fuer dieses Projekt beantworten soll

${binding.analysisQuestions.map((item) => `- ${item}`).join("\n")}

## Guardrails

${binding.guardrails.map((item) => `- ${item}`).join("\n")}

## Promotion-Fluss

- Watchlist-Datei liegt unter \`WATCHLIST.txt\`
- Intake-Dossiers landen unter \`../projects/${projectKey}/intake/\`
- Promotion-Pakete landen unter \`../projects/${projectKey}/promotions/\`
- Erst der Promotion-Schritt darf kuratierte Artefakte veraendern
`;
}

function renderGenericProjectWorkspaceReadme(projectKey) {
  return `# Project Workspace

Dieser Ordner ist der lokale Arbeits- und Ergebnisraum von \`patternpilot\` fuer \`${projectKey}\`.

Hier liegen bewusst nur projektbezogene Arbeitsartefakte und lesbare Ergebnisse, zum Beispiel:

- \`PROJECT_CONTEXT.md\`
- \`intake/\`
- \`promotions/\`
- \`reviews/\`
- \`reports/\`
- optionale Kalibrierungsartefakte

Die technische Bindung fuer dieses Zielprojekt liegt getrennt unter \`bindings/${projectKey}/\`.
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
  const discoveryPolicy = defaultDiscoveryPolicy(projectKey);
  const projectDirRelative = `projects/${projectKey}`;
  const bindingDirRelative = `bindings/${projectKey}`;
  const intakeRoot = `${projectDirRelative}/intake`;
  const promotionRoot = `${projectDirRelative}/promotions`;
  const willBecomeDefault = Boolean(options.makeDefault || !config.defaultProject);

  config.projects[projectKey] = {
    label: projectLabel,
    projectRoot,
    projectContextFile: `${projectDirRelative}/PROJECT_CONTEXT.md`,
    projectBindingFile: `${bindingDirRelative}/PROJECT_BINDING.json`,
    alignmentRulesFile: `${bindingDirRelative}/ALIGNMENT_RULES.json`,
    discoveryPolicyFile: `${bindingDirRelative}/DISCOVERY_POLICY.json`,
    watchlistFile: `${bindingDirRelative}/WATCHLIST.txt`,
    intakeRoot,
    promotionRoot
  };
  if (willBecomeDefault) {
    config.defaultProject = projectKey;
  }

  const outputs = [
    {
      path: path.join(rootDir, projectDirRelative, "README.md"),
      content: renderGenericProjectWorkspaceReadme(projectKey)
    },
    {
      path: path.join(rootDir, projectDirRelative, "PROJECT_CONTEXT.md"),
      content: renderGenericProjectContext({ projectKey, projectLabel, projectRoot, detected })
    },
    {
      path: path.join(rootDir, bindingDirRelative, "PROJECT_BINDING.md"),
      content: renderGenericBindingMd({ projectKey, projectLabel, projectRoot, binding })
    },
    {
      path: path.join(rootDir, bindingDirRelative, "PROJECT_BINDING.json"),
      content: `${JSON.stringify(binding, null, 2)}\n`
    },
    {
      path: path.join(rootDir, bindingDirRelative, "ALIGNMENT_RULES.json"),
      content: `${JSON.stringify(alignmentRules, null, 2)}\n`
    },
    {
      path: path.join(rootDir, bindingDirRelative, "DISCOVERY_POLICY.json"),
      content: `${JSON.stringify(discoveryPolicy, null, 2)}\n`
    },
    {
      path: path.join(rootDir, bindingDirRelative, "WATCHLIST.txt"),
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
    await writeConfig(rootDir, config, { preferLocal: true });
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
