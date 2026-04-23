import fs from "node:fs/promises";
import path from "node:path";
import {
  buildCandidateEvaluation,
  computeRulesFingerprint,
  deriveDisposition
} from "./classification/evaluation.mjs";
import { getProjectGapAreaGuess } from "./legacy-project-fields.mjs";
import { upsertQueueEntry } from "./queue.mjs";
import { replaceDecisionSignalsBlock } from "./intake.mjs";
import { classifyReviewItemState } from "./review.mjs";

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
    gapArea: getProjectGapAreaGuess(row, "risk_and_dependency_awareness"),
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

function buildNormalizedRepoUrl(row) {
  return row.normalized_repo_url || row.repo_url || null;
}

export function classifyReEvaluateTarget(row, alignmentRules, options = {}) {
  const currentFingerprint = options.currentFingerprint ?? computeRulesFingerprint(alignmentRules);
  const stateFields = classifyReviewItemState(row, alignmentRules, currentFingerprint);
  const previousRulesFingerprint = String(row.rules_fingerprint ?? "").trim();
  const driftReasons = [];

  if (stateFields.decisionDataState === "fallback") {
    driftReasons.push("fallback_decision_data");
  }

  if (stateFields.decisionDataState === "stale") {
    if (!previousRulesFingerprint) {
      driftReasons.push("missing_rules_fingerprint");
    } else if (previousRulesFingerprint !== currentFingerprint) {
      driftReasons.push("rules_fingerprint_drift");
    }
    if (driftReasons.length === 0) {
      driftReasons.push("stale_decision_data");
    }
  }

  return {
    ...stateFields,
    currentFingerprint,
    previousRulesFingerprint: previousRulesFingerprint || null,
    normalizedRepoUrl: buildNormalizedRepoUrl(row),
    repoRef: row.owner && row.name ? `${row.owner}/${row.name}` : "unknown/unknown",
    driftReasons
  };
}

export function selectReEvaluateTargets(queueRows, alignmentRules, options = {}) {
  const currentFingerprint = computeRulesFingerprint(alignmentRules);
  const requestedUrls = new Set(
    (options.urls ?? []).map((url) => String(url ?? "").trim()).filter(Boolean)
  );
  const allowedUrls = options.allowedUrls ? new Set(options.allowedUrls) : null;
  const states = { complete: 0, fallback: 0, stale: 0 };
  const driftCounts = {};
  const targets = [];

  for (const row of queueRows) {
    const target = classifyReEvaluateTarget(row, alignmentRules, { currentFingerprint });
    states[target.decisionDataState] += 1;
    const normalizedUrl = target.normalizedRepoUrl;

    if (requestedUrls.size > 0 && (!normalizedUrl || !requestedUrls.has(normalizedUrl))) {
      continue;
    }
    if (allowedUrls && (!normalizedUrl || !allowedUrls.has(normalizedUrl))) {
      continue;
    }
    if (options.staleOnly) {
      if (target.decisionDataState !== "stale") {
        continue;
      }
    } else if (target.decisionDataState !== "stale" && target.decisionDataState !== "fallback") {
      continue;
    }

    for (const reason of target.driftReasons) {
      driftCounts[reason] = (driftCounts[reason] ?? 0) + 1;
    }

    targets.push({
      row,
      target
    });
  }

  return {
    currentFingerprint,
    states,
    driftCounts,
    targets
  };
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
  if (dryRun) {
    return { status: "dry_run_preview", intakeDocPath };
  }

  await fs.writeFile(intakeDocPath, updated, "utf8");

  return { status: "updated", intakeDocPath };
}

export async function reEvaluateQueueEntries(rootDir, config, rows, alignmentRules, options = {}) {
  const updates = [];
  const targetMetadataByUrl = options.targetMetadataByUrl instanceof Map
    ? options.targetMetadataByUrl
    : new Map();

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
    const normalizedRepoUrl = buildNormalizedRepoUrl(row);
    const targetMetadata = normalizedRepoUrl ? targetMetadataByUrl.get(normalizedRepoUrl) ?? null : null;
    updates.push({
      row,
      decisionFields: result.decisionFields,
      intakeDocResult,
      audit: {
        repoRef: row.owner && row.name ? `${row.owner}/${row.name}` : "unknown/unknown",
        normalizedRepoUrl,
        previousRulesFingerprint: targetMetadata?.previousRulesFingerprint ?? (String(row.rules_fingerprint ?? "").trim() || null),
        nextRulesFingerprint: result.decisionFields.rulesFingerprint,
        previousDecisionDataState: targetMetadata?.decisionDataState ?? null,
        triggerReasons: targetMetadata?.driftReasons ?? [],
        batchPosition: updates.length + 1,
        batchSize: rows.length,
        intakeDocStatus: intakeDocResult.status,
        dryRun: Boolean(options.dryRun)
      }
    });
  }

  return updates;
}
