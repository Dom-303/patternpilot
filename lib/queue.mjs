import fs from "node:fs/promises";
import path from "node:path";
import {
  parseCsvLine,
  csvEscape,
  safeReadText,
  safeReadDirEntries,
  safeStat,
  asRelativeFromRoot,
  safeExecGit
} from "./utils.mjs";
import { resolveQueuePath, resolveLandkartePath } from "./config.mjs";

const ENGINE_DECISION_COLUMNS = [
  "effort_band",
  "effort_score",
  "value_band",
  "value_score",
  "review_disposition",
  "rules_fingerprint"
];

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

function canonicalizeGithubRepoPath(owner, name) {
  return {
    owner: String(owner ?? "").trim().toLowerCase(),
    name: String(name ?? "").trim().toLowerCase()
  };
}

function canonicalizeGithubRepoUrl(rawUrl) {
  const url = new URL(rawUrl);
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error(`GitHub URL must point to a repository: ${rawUrl}`);
  }
  const repoPath = canonicalizeGithubRepoPath(parts[0], parts[1].replace(/\.git$/i, ""));
  return `https://github.com/${repoPath.owner}/${repoPath.name}`;
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

  const { owner, name } = canonicalizeGithubRepoPath(parts[0], parts[1].replace(/\.git$/i, ""));
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

function normalizeQueueStatusRank(status) {
  switch (String(status ?? "")) {
    case "promoted":
      return 3;
    case "promotion_prepared":
      return 2;
    case "pending_review":
      return 1;
    default:
      return 0;
  }
}

function normalizePromotionStatusRank(status) {
  switch (String(status ?? "")) {
    case "applied":
      return 2;
    case "prepared":
      return 1;
    default:
      return 0;
  }
}

function isEmptyQueueValue(value) {
  return value === undefined || value === null || value === "";
}

function mergeQueueEntries(previous, entry) {
  const merged = { ...previous };

  for (const [key, value] of Object.entries(entry)) {
    if (key === "created_at" && previous.created_at) {
      continue;
    }
    if (isEmptyQueueValue(value)) {
      if (!(key in merged)) {
        merged[key] = value ?? "";
      }
      continue;
    }
    merged[key] = value;
  }

  if (normalizeQueueStatusRank(previous.status) > normalizeQueueStatusRank(entry.status)) {
    merged.status = previous.status;
  }
  if (normalizePromotionStatusRank(previous.promotion_status) > normalizePromotionStatusRank(entry.promotion_status)) {
    merged.promotion_status = previous.promotion_status;
  }
  if (previous.promoted_at && normalizeQueueStatusRank(previous.status) >= normalizeQueueStatusRank(entry.status)) {
    merged.promoted_at = previous.promoted_at;
  }
  if (previous.promotion_packet && normalizeQueueStatusRank(previous.status) >= normalizeQueueStatusRank(entry.status)) {
    merged.promotion_packet = previous.promotion_packet;
  }

  try {
    merged.normalized_repo_url = canonicalizeGithubRepoUrl(merged.normalized_repo_url || merged.repo_url);
  } catch {
    merged.normalized_repo_url = merged.normalized_repo_url || merged.repo_url || "";
  }

  return merged;
}

export function createRunId(now = new Date()) {
  return now.toISOString().replace(/[:.]/g, "-");
}

async function readQueue(queuePath) {
  const raw = await fs.readFile(queuePath, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines[0].split(";");
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row = Object.fromEntries(header.map((key, index) => [key, values[index] ?? ""]));
    for (const column of ENGINE_DECISION_COLUMNS) {
      if (!(column in row)) {
        row[column] = "";
      }
    }
    return row;
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
  const queuePath = resolveQueuePath(rootDir, config);
  const { header, rows } = await readQueue(queuePath);
  let canonicalEntryUrl = "";
  try {
    canonicalEntryUrl = canonicalizeGithubRepoUrl(entry.normalized_repo_url || entry.repo_url);
  } catch {
    canonicalEntryUrl = entry.normalized_repo_url || entry.repo_url || "";
  }

  for (const key of Object.keys(entry)) {
    if (!header.includes(key)) {
      header.push(key);
    }
  }
  const index = rows.findIndex(
    (row) => {
      if (row.project_key !== entry.project_key) {
        return false;
      }
      try {
        return canonicalizeGithubRepoUrl(row.normalized_repo_url || row.repo_url) === canonicalEntryUrl;
      } catch {
        return (row.normalized_repo_url || row.repo_url) === canonicalEntryUrl;
      }
    }
  );

  if (index >= 0) {
    const previous = rows[index];
    rows[index] = mergeQueueEntries(previous, {
      ...entry,
      normalized_repo_url: canonicalEntryUrl
    });
  } else {
    rows.push({
      ...entry,
      normalized_repo_url: canonicalEntryUrl
    });
  }

  await writeQueue(queuePath, header, rows);
}

export async function loadQueueEntries(rootDir, config) {
  const queuePath = resolveQueuePath(rootDir, config);
  const { rows } = await readQueue(queuePath);
  return rows;
}

export async function loadLandkarteEntries(rootDir, config) {
  try {
    const { rows } = await readQueue(resolveLandkartePath(rootDir, config));
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
    "workspace_mode",
    "problem_mode"
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

## Current Interpretation

- target_repo_context_model: run_scoped_context_sources
- hardwired_project_surface: none
- primary_operating_mode: on_demand
- context_rule: Patternpilot reads configured repo context for each target project and exposes what it read in dossiers and HTML reports.
- handoff_next_step: run_real_policy_audits_and_tune_project_defaults

## Project Surfaces

${projectSnapshots.map((project) => `- ${project.projectKey}: context_files=${project.contextFileCount} | context_dirs=${project.contextDirectoryCount} | watchlist=${project.watchlistCount} | intake_root=${project.intakeRoot} | promotion_root=${project.promotionRoot} | review_root=${project.reviewRoot} | report_root=${project.reportRoot}`).join("\n")}

## Quick Links

- agent_context: AGENT_CONTEXT.md
- claude_context: CLAUDE.md
- operating_model: docs/foundation/OPERATING_MODEL.md
- v1_status: docs/foundation/V1_STATUS.md
- release_checklist: docs/foundation/RELEASE_CHECKLIST.md
- report_output_model: docs/reference/REPORT_OUTPUT_MODEL.md
- report_ui_framework: docs/reference/REPORT_UI_FRAMEWORK.md
- automation_operating_mode: docs/foundation/AUTOMATION_OPERATING_MODE.md
- open_questions: OPEN_QUESTION.md
- config: patternpilot.config.json
- queue: ${config.queueFile}
- landkarte: ${config.landkarteFile ?? "knowledge/repo_landkarte.csv"}
- learnings: ${config.learningsFile ?? "knowledge/repo_learnings.md"}
- decisions: ${config.decisionsFile ?? "knowledge/repo_decisions.md"}
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

## Handoff Note

- settled_now: target-repo context is run-scoped and transparent, not a hardwired product identity.
- settled_now_too: chain-run automation, discovery quality policy, decision-data re-evaluation and scheduler-ready ops signals are now part of the kernel.
- settled_now_three: scheduler job-state, manual clear and alert views are now available for the automation layer.
- settled_now_four: external scheduler glue and alert artifacts are now available via automation-dispatch and automation-alerts.
- settled_now_five: the on-demand primary flow can now run explicit repo URLs end-to-end and writes stable report pointers per project.
- settled_now_six: the last Decision Summary gap heuristic has been replaced by engine-level \`gapAreaCanonical\` and weighted \`runGapSignals\`.
- settled_now_seven: discovery policies now gate repo, license, host, signal, risk and capability quality directly inside discovery and surface those results in reports.
- settled_now_eight: policy-audit and discovery calibration hints now turn policy blocker counts into concrete tuning guidance per run.
- next_recommended_step: run real policy audits and tune project-specific defaults before adding more onboarding or product-shell surface.

## Aktuell offene Fragen

### OQ-001 — REPORT_UI_DIRECTION

- prioritaet: BALD
- frage: Welche finale visuelle Richtung soll die HTML-Report-Schicht bekommen, bevor daraus eine spaetere App- oder Web-Oberflaeche wird?
- warum_offen: Die technische HTML-Schicht steht, aber Designsystem, visuelle Sprache und moegliche Branding-Regeln sind noch nicht final entschieden.
- naechster_sinnvoller_schritt: Ein verbindliches Report-UI-Framework mit Farben, Typografie, Komponenten und Chart-Patterns festziehen.

### OQ-002 — CHAIN_RUN_AUTOMATION

- prioritaet: BALD
- frage: Wie wird der vorhandene Kettenlauf \`discover -> watchlist -> intake -> re-evaluate -> review\` operativ belastbar gemacht?
- warum_offen: Der Kernlauf existiert, aber Run-Frequenz, Failure-Recovery, Projekt-uebergreifende Zeitfenster und spaetere Scheduling-Regeln sind noch offen. Diese Schicht bleibt bewusst optional gegenueber dem primaeren On-Demand-Modus.
- naechster_sinnvoller_schritt: Betriebsmodus fuer wiederkehrende Laeufe, Retry-Regeln und projektweise Limits definieren, ohne den Produktkern scheduler-zentriert zu bauen.

### OQ-003 — QUALITY_FILTERS_FOR_DISCOVERY

- prioritaet: BALD
- frage: Wie fein muessen projektbezogene Discovery-Policies spaeter werden, damit sie echte Produktqualitaet tragen?
- warum_offen: Die zweite Policy-Stufe und ein eigener Audit-/Calibration-Flow existieren jetzt. Offen ist vor allem noch die Kalibrierung an echten Discovery-Runs und die Frage, welche Gates pro Projekt wirklich hart statt nur bevorzugend wirken sollen.
- naechster_sinnvoller_schritt: Mit echten Policy-Audit-Laeufen die auffaelligsten Blocker pruefen, daraus Projekt-Defaults schaerfen und erst dann weitere Gate-Typen hinzufuegen.

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

### OQ-006 — FIRST_RUN_ONBOARDING_AND_PROJECT_SETUP_FLOW

- prioritaet: SPAETER
- frage: Wie soll der erste Einstieg fuer neue Nutzer oder neue Projekte aussehen, ohne den stabilen Kern zu frueh zu ueberformen?
- warum_offen: Ein gefuehrter Erststart mit Projektwahl, Kontextabfragen, Default-Profilen und klarer Pipeline ist sinnvoll, aber erst dann, wenn die innere Engine und der Kettenlauf wirklich stehen.
- naechster_sinnvoller_schritt: Erst nach weiterer Kernel-Haertung den Setup-Flow gegen \`init-project\`, \`doctor\`, \`setup-checklist\` und spaetere Chain-Defaults modellieren.

### OQ-007 — DECISION_DATA_REEVALUATION_OPERATIONS

- prioritaet: JETZT
- frage: Wann und wodurch sollen stale oder fallback Decision-Daten automatisch neu berechnet werden?
- warum_offen: Ein Re-Evaluate-Flow existiert jetzt, aber Trigger wie Regel-Aenderungen, Batch-Groessen, Audit-Spuren und Benachrichtigung ueber Drift sind noch nicht final festgelegt.
- naechster_sinnvoller_schritt: Operative Regeln fuer Drift-Erkennung, Batch-Limits, Logging und spaetere Scheduling-Hooks definieren.

### OQ-008 — SCHEDULER_AND_FAILURE_RECOVERY_POLICY

- prioritaet: JETZT
- frage: Wie soll Patternpilot sich unter wiederkehrender Automation bei Teilfehlern, API-Ausfaellen oder projektweisen Blockern verhalten?
- warum_offen: Locking, Retry-Klassifikation, Job-State, Alerting, Manual-Clear und Dispatch-Glue existieren jetzt, aber echte Benachrichtigungskanaele und spaetere Auto-Resume-Regeln sind noch nicht final festgelegt.
- naechster_sinnvoller_schritt: Den ersten echten Kanal fuer Alerts festlegen, etwa GitHub Actions Summary oder Mail/Slack, und bestimmen, ob bestimmte Retry-Faelle nach genug Abstand automatisch wieder freigegeben werden duerfen.
`;
}

export async function refreshOperationalDocs(rootDir, config, context = {}) {
  const queueEntries = await loadQueueEntries(rootDir, config);
  const landkarteEntries = await loadLandkarteEntries(rootDir, config);
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
  const runtimeStateDir = path.join(rootDir, "state");
  const runtimeContextPath = path.join(runtimeStateDir, "runtime_context.json");

  await fs.mkdir(runtimeStateDir, { recursive: true });
  await fs.writeFile(path.join(rootDir, "STATUS.md"), `${statusContent}\n`, "utf8");
  await fs.writeFile(path.join(rootDir, "OPEN_QUESTION.md"), `${openQuestionsContent}\n`, "utf8");
  await fs.writeFile(runtimeContextPath, `${JSON.stringify({
    generatedAt,
    lastContext: context
  }, null, 2)}\n`, "utf8");
}

// Re-export readQueue and writeQueue for promotion module
export { readQueue, writeQueue };
