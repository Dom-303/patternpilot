import fs from "node:fs/promises";
import path from "node:path";
import { isoDate } from "./utils.mjs";
import { deriveActivityStatus, buildProjectRelevanceNote } from "./classification/core.mjs";
import { resolveDiscoveryProfile } from "./constants.mjs";

export function renderBulletMap(object) {
  return Object.entries(object)
    .map(([key, value]) => `- ${key}: ${value || "-"}`)
    .join("\n");
}

function buildEnrichmentFailureNote(enrichment) {
  const error = String(enrichment?.error ?? "");
  const authMode = String(enrichment?.authMode ?? "unknown");

  if (!error) {
    return "Intake kann weiterverwendet werden, aber Review braucht noch mehr manuelle Sichtung.";
  }

  if (/401|403|bad credentials|unauthorized|forbidden/i.test(error)) {
    return authMode === "token"
      ? "GitHub-Zugriff ist vorhanden, aber die Authentifizierung scheint ungueltig oder unzureichend. Nutze `npm run setup:checklist` und danach `npm run doctor`."
      : "GitHub-Zugriff scheint auth-seitig blockiert. Nutze `npm run setup:checklist` und danach `npm run doctor`."
  }

  if (/404/i.test(error)) {
    return "GitHub konnte das Repo oder einen Teil der Anreicherung nicht bestaetigen. Der Intake bleibt nutzbar, aber Review sollte den Repo-Zustand manuell gegenpruefen.";
  }

  if (/eai_again|getaddrinfo|timed out|timeout|network/i.test(error)) {
    return "Die GitHub-Anreicherung ist an Netzwerk- oder API-Erreichbarkeit gescheitert. Nutze `npm run doctor`, bevor du diesen Fund als stabil angereichert behandelst.";
  }

  return "Intake kann weiterverwendet werden, aber Review braucht noch mehr manuelle Sichtung.";
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
      `- note: ${buildEnrichmentFailureNote(enrichment)}`
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

export function renderDecisionSignalsBlock(candidate) {
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

export function replaceDecisionSignalsBlock(content, candidate) {
  const block = renderDecisionSignalsBlock(candidate).trim();
  if (!block) {
    return content;
  }

  const existingSectionPattern = /\n## Decision Signals\n[\s\S]*?(?=\n## |\s*$)/;
  if (existingSectionPattern.test(content)) {
    return content.replace(existingSectionPattern, `\n${block}\n`);
  }

  if (content.includes("\n## Alignment Rationale")) {
    return content.replace("\n## Alignment Rationale", `\n${block}\n\n## Alignment Rationale`);
  }

  return `${content.trimEnd()}\n\n${block}\n`;
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
- project_gap_area_guess: \`${guess.gapArea}\`
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
- Learning fuer das Zielprojekt:
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
  dryRun,
  extraFiles = []
}) {
  const runDir = path.join(rootDir, config.runtimeRoot, projectKey, runId);
  if (!dryRun) {
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
    await fs.writeFile(path.join(runDir, "summary.md"), summary, "utf8");
    if (projectProfile) {
      await fs.writeFile(path.join(runDir, "project_profile.json"), JSON.stringify(projectProfile, null, 2), "utf8");
    }
    for (const file of extraFiles) {
      await fs.writeFile(path.join(runDir, file.name), file.content, "utf8");
    }
  }
  return runDir;
}

export function renderRunSummary({ runId, projectKey, createdAt, items, dryRun }) {
  const counts = items.reduce((acc, item) => {
    const action = String(item.action ?? "");
    if (action.includes("known")) {
      acc.known += 1;
    }
    if (action.includes("new")) {
      acc.new += 1;
    }
    if (action.includes("reused_doc")) {
      acc.reusedDocs += 1;
    }
    if (item.enrichment?.status === "failed") {
      acc.enrichmentFailed += 1;
    }
    return acc;
  }, {
    known: 0,
    new: 0,
    reusedDocs: 0,
    enrichmentFailed: 0
  });
  const lines = items.map((item) => {
    const enrichment = item.enrichment?.status ?? "unknown";
    const fit = item.projectAlignment?.fitBand ?? "unknown";
    return `- ${item.repo.owner}/${item.repo.name} -> ${item.intakeDocRelativePath} (${item.action}; enrichment=${enrichment}; fit=${fit})`;
  });
  const outcome =
    items.length === 0
      ? "no_items"
      : counts.new === 0
        ? "already_known_only"
        : counts.known > 0
          ? "mixed_new_and_known"
          : "new_items_only";
  const whatNow =
    outcome === "already_known_only"
      ? "- All supplied repos were already known. Use review or re-evaluate before broadening the scope."
      : counts.enrichmentFailed > 0
        ? "- At least one repo needs manual review because GitHub enrichment failed."
        : "- Continue with review-watchlist to compare these repos in project context.";

  return `# Patternpilot Intake Run

- run_id: ${runId}
- project: ${projectKey}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}
- items: ${items.length}
- new_items: ${counts.new}
- known_items: ${counts.known}
- reused_docs: ${counts.reusedDocs}
- enrichment_failed: ${counts.enrichmentFailed}
- outcome: ${outcome}

## Items

${lines.join("\n")}

## What Now

${whatNow}
`;
}

export function renderDiscoverySummary({ runId, projectKey, createdAt, discovery, dryRun }) {
  const profile = discovery.discoveryProfile ?? resolveDiscoveryProfile("balanced", null);
  const policySummary = discovery.policySummary ?? {
    enabled: false,
    mode: "off",
    blocked: 0,
    preferred: 0,
    enforcedBlocked: 0
  };
  const policyCalibration = discovery.policyCalibration ?? {
    status: "policy_off",
    recommendations: ["No discovery policy calibration available yet."],
    topBlockers: []
  };
  const candidateLines = discovery.candidates.length > 0
    ? discovery.candidates.map((candidate) => {
        const fit = candidate.projectAlignment?.fitBand ?? "unknown";
        const disposition = candidate.discoveryDisposition ?? "watch_only";
        const evidence = candidate.discoveryEvidence?.grade ?? "-";
        const candidateClass = candidate.discoveryClass ?? "-";
        return `- ${candidate.repo.owner}/${candidate.repo.name} (${candidate.discoveryScore}; fit=${fit}; evidence=${evidence}; class=${candidateClass}; disposition=${disposition}; lenses=${candidate.queryLabels.join(", ") || "-"})`;
      }).join("\n")
    : "- none";
  const queryLines = discovery.plan.plans.length > 0
    ? discovery.plan.plans.map((plan) => `- ${plan.label}: ${plan.query}`).join("\n")
    : "- none";
  const errorLines = discovery.searchErrors.length > 0
    ? discovery.searchErrors.map((error) => `- ${error.label}: ${error.error}`).join("\n")
    : "- none";
  const calibrationLines = policyCalibration.recommendations.length > 0
    ? policyCalibration.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";
  const blockerLines = policyCalibration.topBlockers.length > 0
    ? policyCalibration.topBlockers.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const feedback = discovery.feedback ?? {
    totals: { positive: 0, negative: 0, observe: 0, pending: 0 },
    preferredTerms: [],
    avoidTerms: [],
    feedbackStrength: 0
  };
  const preferredFeedbackLines = feedback.preferredTerms.length > 0
    ? feedback.preferredTerms.slice(0, 6).map((item) => `- ${item}`).join("\n")
    : "- none";
  const avoidFeedbackLines = feedback.avoidTerms.length > 0
    ? feedback.avoidTerms.slice(0, 6).map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot Discovery Run

- run_id: ${runId}
- project: ${projectKey}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}
- offline: ${discovery.offline ? "yes" : "no"}
- imported: ${discovery.imported ? "yes" : "no"}
- import_source: ${discovery.importSource ?? "-"}
- discovery_profile: ${profile.id}
- profile_limit: ${profile.limit}
- queries: ${discovery.plan.plans.length}
- known_urls_catalogued: ${discovery.knownUrlCount}
- search_results_scanned: ${discovery.scanned}
- raw_candidates: ${discovery.rawCandidateCount ?? discovery.candidates.length}
- evaluated_candidates: ${discovery.evaluatedCandidates?.length ?? discovery.rawCandidateCount ?? discovery.candidates.length}
- candidates: ${discovery.candidates.length}
- discovery_policy_enabled: ${policySummary.enabled ? "yes" : "no"}
- discovery_policy_mode: ${policySummary.mode ?? "off"}
- policy_flagged: ${policySummary.blocked ?? 0}
- policy_enforced_blocked: ${policySummary.enforcedBlocked ?? 0}
- policy_preferred: ${policySummary.preferred ?? 0}
- feedback_positive_rows: ${feedback.totals.positive ?? 0}
- feedback_negative_rows: ${feedback.totals.negative ?? 0}
- feedback_observe_rows: ${feedback.totals.observe ?? 0}
- feedback_strength: ${feedback.feedbackStrength ?? 0}

## Discovery Plan

${queryLines}

## Search Errors

${errorLines}

## Policy Calibration

- calibration_status: ${policyCalibration.status ?? "unknown"}

### Top Policy Blockers

${blockerLines}

### Calibration Hints

${calibrationLines}

## Discovery Feedback

### Preferred Terms

${preferredFeedbackLines}

### Avoid Terms

${avoidFeedbackLines}

## Candidates

${candidateLines}
`;
}
