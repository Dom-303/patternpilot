import fs from "node:fs/promises";
import path from "node:path";
import { isoDate } from "./utils.mjs";
import { readQueue, writeQueue } from "./queue.mjs";
import { renderBulletMap } from "./intake.mjs";
import { loadConfig, resolveLandkartePath } from "./config.mjs";

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
    learning_for_project: queueEntry.learning_for_project || queueEntry.learning_for_eventbaer || "",
    possible_implication: queueEntry.possible_implication || queueEntry.suggested_next_step || "",
    project_gap_area: queueEntry.project_gap_area_guess || queueEntry.eventbaer_gap_area_guess,
    build_vs_borrow: queueEntry.build_vs_borrow_guess,
    priority_for_review: queueEntry.priority_guess,
    project_relevance:
      queueEntry.project_relevance_guess ||
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
    title: `${repoRef} als Signal fuer ${queueEntry.project_gap_area_guess || queueEntry.eventbaer_gap_area_guess || "relevante Ausbauachsen"}`,
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
      queueEntry.learning_for_project ||
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
      queueEntry.learning_for_project ||
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

## Kandidat fuer knowledge/repo_landkarte.csv

${renderBulletMap(promotion.landkarteRow)}

## Kandidat fuer knowledge/repo_learnings.md

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
## Kandidat fuer knowledge/repo_decisions.md

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
  const config = await loadConfig(rootDir);
  const landkartePath = resolveLandkartePath(rootDir, config);
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

export function renderLearningBlock(promotion, queueEntry, binding = {}) {
  const projectLabel = binding.projectLabel ?? binding.projectKey ?? "das Zielprojekt";
  return `### Candidate: ${queueEntry.owner}/${queueEntry.name}

**Quelle**
- ${queueEntry.normalized_repo_url || queueEntry.repo_url}

**Beobachtung**
- ${promotion.learning.observation}

**Wiederkehrende Muster**
${promotion.learning.repeatingPatterns.map((item) => `- ${item}`).join("\n")}

**Bedeutung fuer ${projectLabel}**
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
