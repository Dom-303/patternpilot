import fs from "node:fs/promises";
import path from "node:path";
import {
  buildCandidateEvaluation,
  computeRulesFingerprint,
  deriveDisposition
} from "./classification/evaluation.mjs";
import { upsertQueueEntry } from "./queue.mjs";
import { replaceDecisionSignalsBlock } from "./intake.mjs";

function parseCsvList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRepoFromRow(row) {
  return {
    owner: row.owner,
    name: row.name,
    normalizedRepoUrl: row.normalized_repo_url || row.repo_url,
    size: Number(row.size || 0) || 0
  };
}

function buildGuessFromRow(row) {
  return {
    category: row.category_guess || "research_signal",
    patternFamily: row.pattern_family_guess || "research_signal",
    mainLayer: row.main_layer_guess || "research_signal",
    gapArea: row.eventbaer_gap_area_guess || "risk_and_dependency_awareness",
    buildVsBorrow: row.build_vs_borrow_guess || "observe_only",
    priority: row.priority_guess || "soon"
  };
}

function buildEnrichmentFromRow(row) {
  const pushedAt = row.pushed_at || "";
  const topics = parseCsvList(row.topics);
  const license = row.license || "";
  const primaryLanguage = row.primary_language || "";
  const description = row.description || "";
  const archived = row.archived === "yes";
  const stars = Number(row.stars || 0) || 0;

  const hasSurface = Boolean(description || topics.length > 0 || primaryLanguage || license || pushedAt || stars);

  return {
    status: row.enrichment_status === "success" || hasSurface ? "success" : "skipped",
    fetchedAt: row.last_api_sync_at || row.updated_at || row.created_at || new Date().toISOString(),
    repo: {
      description,
      topics,
      size: Number(row.size || 0) || 0,
      archived,
      pushedAt,
      license,
      primaryLanguage,
      language: primaryLanguage,
      stars
    },
    languages: primaryLanguage ? [primaryLanguage] : [],
    readme: { excerpt: "" }
  };
}

function buildProjectAlignmentFromRow(row) {
  return {
    status: row.alignment_status || "ready",
    fitBand: row.project_fit_band || "unknown",
    fitScore: Number(row.project_fit_score || 0) || 0,
    matchedCapabilities: parseCsvList(row.matched_capabilities),
    recommendedWorkerAreas: parseCsvList(row.recommended_worker_areas),
    reviewDocs: [],
    tensions: [],
    suggestedNextStep: row.suggested_next_step || ""
  };
}

function parseRisks(row) {
  return parseCsvList(row.risks);
}

export function reevaluateQueueRow(row, alignmentRules) {
  const repo = buildRepoFromRow(row);
  const guess = buildGuessFromRow(row);
  const enrichment = buildEnrichmentFromRow(row);
  const projectAlignment = buildProjectAlignmentFromRow(row);
  const evaluation = buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules);
  const disposition = deriveDisposition(evaluation, parseRisks(row), projectAlignment.fitBand);
  const rulesFingerprint = computeRulesFingerprint(alignmentRules);

  const decisionFields = {
    effortBand: evaluation.effortBand,
    effortScore: evaluation.effortScore,
    valueBand: evaluation.valueBand,
    valueScore: evaluation.valueScore,
    reviewDisposition: disposition.disposition,
    rulesFingerprint,
    decisionSummary: evaluation.decisionSummary,
    effortReasons: evaluation.effortReasons,
    valueReasons: evaluation.valueReasons,
    dispositionReason: disposition.dispositionReason
  };

  return {
    repo,
    guess,
    enrichment,
    projectAlignment,
    decisionFields,
    queueUpdate: {
      ...row,
      effort_band: decisionFields.effortBand,
      effort_score: String(decisionFields.effortScore),
      value_band: decisionFields.valueBand,
      value_score: String(decisionFields.valueScore),
      review_disposition: decisionFields.reviewDisposition,
      rules_fingerprint: decisionFields.rulesFingerprint,
      decision_summary: decisionFields.decisionSummary,
      effort_reasons: decisionFields.effortReasons.join(","),
      value_reasons: decisionFields.valueReasons.join(","),
      disposition_reason: decisionFields.dispositionReason,
      updated_at: new Date().toISOString()
    }
  };
}

export async function rewriteIntakeDecisionSignals(rootDir, intakeDocRelativePath, decisionFields, dryRun = false) {
  if (!intakeDocRelativePath) {
    return { status: "skipped_no_intake_doc" };
  }

  const intakeDocPath = path.join(rootDir, intakeDocRelativePath);
  let existing;
  try {
    existing = await fs.readFile(intakeDocPath, "utf8");
  } catch {
    return { status: "missing_intake_doc", intakeDocPath };
  }

  const updated = replaceDecisionSignalsBlock(existing, decisionFields);
  if (!dryRun) {
    await fs.writeFile(intakeDocPath, updated, "utf8");
  }

  return { status: "updated", intakeDocPath };
}

export async function reEvaluateQueueEntries(rootDir, config, rows, alignmentRules, options = {}) {
  const updates = [];

  for (const row of rows) {
    const result = reevaluateQueueRow(row, alignmentRules);
    if (!options.dryRun) {
      await upsertQueueEntry(rootDir, config, result.queueUpdate);
    }
    const intakeDocResult = await rewriteIntakeDecisionSignals(
      rootDir,
      row.intake_doc,
      result.decisionFields,
      options.dryRun
    );
    updates.push({
      row,
      decisionFields: result.decisionFields,
      intakeDocResult
    });
  }

  return updates;
}
