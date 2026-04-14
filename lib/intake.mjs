import fs from "node:fs/promises";
import path from "node:path";
import { isoDate } from "./utils.mjs";
import { deriveActivityStatus, buildProjectRelevanceNote } from "./classification.mjs";
import { resolveDiscoveryProfile } from "./constants.mjs";

export function renderBulletMap(object) {
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

export function buildIntakeDocPath(rootDir, project, repo) {
  return path.join(rootDir, project.intakeRoot, `${repo.slug}.md`);
}

function renderDecisionSignalsBlock(candidate) {
  if (!candidate) {
    return "";
  }

  return `## Decision Signals

- effort: ${candidate.effortBand ?? "unknown"}
- value: ${candidate.valueBand ?? "unknown"}
- review_disposition: ${candidate.reviewDisposition ?? "unknown"}
- summary: ${candidate.decisionSummary ?? "-"}
- rules_fingerprint: ${candidate.rulesFingerprint ?? "-"}

### Reasons

- effort: ${(candidate.effortReasons ?? []).join(", ") || "-"}
- value: ${(candidate.valueReasons ?? []).join(", ") || "-"}
- disposition: ${candidate.dispositionReason ?? "-"}`;
}

export function renderIntakeDoc({
  repo,
  guess,
  enrichment,
  landkarteCandidate,
  candidate,
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

${renderDecisionSignalsBlock(candidate)}

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

## Promotion Candidate fuer knowledge/repo_landkarte.csv

${renderBulletMap(landkarteCandidate)}

## Promotion-Kriterien

- Nur nach Review in \`knowledge/repo_landkarte.csv\` uebernehmen
- Nur verdichtete Muster nach \`knowledge/repo_learnings.md\`
- Nur echte Richtungsentscheide nach \`knowledge/repo_decisions.md\`

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
