import { createHash } from "node:crypto";
import { clamp } from "../utils.mjs";
import { deriveActivityStatus } from "./core.mjs";

/**
 * EVALUATION_VERSION is a manually maintained version counter for the engine
 * logic in this module. Bump it when changing scoring, matrix rules, or
 * classification semantics that should invalidate old fingerprints.
 */
export const EVALUATION_VERSION = 1;

const PERMISSIVE_LICENSE_PATTERNS = [/^MIT\b/i, /^Apache\b/i, /^BSD\b/i, /^ISC\b/i, /^Unlicense\b/i];
const COPYLEFT_LICENSE_PATTERNS = [/^A?GPL\b/i, /^LGPL\b/i];

export function classifyLicense(licenseString) {
  if (typeof licenseString !== "string") {
    return "unknown";
  }

  const normalized = licenseString.trim();
  if (!normalized || normalized.toUpperCase() === "NOASSERTION") {
    return "unknown";
  }

  if (PERMISSIVE_LICENSE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "permissive";
  }
  if (COPYLEFT_LICENSE_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return "copyleft";
  }
  return "unknown";
}

export function bandFromScore(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return "low";
  }
  if (numericScore <= 35) {
    return "low";
  }
  if (numericScore <= 65) {
    return "medium";
  }
  return "high";
}

function canonicalStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }

  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(",")}}`;
}

export function computeRulesFingerprint(alignmentRules) {
  const relevant = {
    capabilities: alignmentRules?.capabilities ?? [],
    layerMappings: alignmentRules?.layerMappings ?? {},
    gapMappings: alignmentRules?.gapMappings ?? {},
    patternTensions: alignmentRules?.patternTensions ?? {}
  };

  const payload = `${canonicalStringify(relevant)}::v${EVALUATION_VERSION}`;
  return createHash("sha1").update(payload).digest("hex").slice(0, 12);
}

export function normalizeGapAreaCanonical(gapArea, alignmentRules) {
  const raw = String(gapArea ?? "").trim();
  if (!raw) {
    return "unknown";
  }

  const gapMappings = alignmentRules?.gapMappings ?? {};
  if (gapMappings[raw]) {
    return raw;
  }

  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  const mappedKey = Object.keys(gapMappings).find((key) => key.toLowerCase() === normalized);
  return mappedKey ?? normalized ?? "unknown";
}

function getCandidateFitBand(candidate) {
  return candidate?.projectAlignment?.fitBand ?? candidate?.projectFitBand ?? "unknown";
}

function getCandidateMatchedCapabilities(candidate) {
  return candidate?.projectAlignment?.matchedCapabilities ?? candidate?.matchedCapabilities ?? [];
}

function getCandidateRisks(candidate) {
  return Array.isArray(candidate?.risks) ? candidate.risks : [];
}

function getCandidateGapArea(candidate) {
  return candidate?.gapAreaCanonical ?? candidate?.gapArea ?? candidate?.guess?.gapArea ?? "";
}

function getGapSignalStrength(candidate, alignmentRules, gapAreaCanonical) {
  const gapMapping = alignmentRules?.gapMappings?.[gapAreaCanonical] ?? {};
  const fitScore = Number(candidate?.projectAlignment?.fitScore ?? candidate?.projectFitScore ?? 0) || 0;
  const valueScore = Number(candidate?.valueScore ?? 0) || 0;
  const capabilityCount = getCandidateMatchedCapabilities(candidate).length;
  const fitBias = Number(gapMapping.fit_bias ?? 0) || 0;
  const valueBias = Number(gapMapping.value_bias ?? 0) || 0;
  const stateBoost =
    candidate?.decisionDataState === "complete"
      ? 4
      : candidate?.decisionDataState === "stale"
        ? 1
        : 0;

  return clamp(
    Math.round(fitScore * 0.35 + valueScore * 0.35 + capabilityCount * 5 + fitBias + valueBias + stateBoost),
    0,
    100
  );
}

export function buildRunGapSignals(candidates = [], alignmentRules) {
  const aggregates = new Map();

  for (const candidate of candidates) {
    const gap = normalizeGapAreaCanonical(getCandidateGapArea(candidate), alignmentRules);
    const current = aggregates.get(gap) ?? { gap, count: 0, totalStrength: 0 };
    current.count += 1;
    current.totalStrength += getGapSignalStrength(candidate, alignmentRules, gap);
    aggregates.set(gap, current);
  }

  return [...aggregates.values()]
    .map((entry) => ({
      gap: entry.gap,
      count: entry.count,
      strength: Math.round(entry.totalStrength / Math.max(entry.count, 1))
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      if (right.strength !== left.strength) {
        return right.strength - left.strength;
      }
      return left.gap.localeCompare(right.gap);
    });
}

function buildDecisionSummary(effortBand, valueBand) {
  if (effortBand === "unknown" || valueBand === "unknown") {
    return "Insufficient signal for band decision";
  }

  const effortLabel =
    effortBand === "low" ? "low effort" : effortBand === "medium" ? "medium effort" : "high effort";
  if (effortBand === "low" && valueBand === "high") {
    return "High value, low effort, candidate for direct intake";
  }
  if (valueBand === "high") {
    return `High value, ${effortLabel}, review before adoption`;
  }
  if (valueBand === "medium") {
    return `Medium value, ${effortLabel}, observe or defer`;
  }
  return `Low value, ${effortLabel}, skip`;
}

function formatSignedBias(value) {
  return value >= 0 ? `+${value}` : `${value}`;
}

function effortSizePenalty(sizeValue) {
  if (!Number.isFinite(sizeValue)) {
    return { delta: 0, token: null };
  }
  if (sizeValue > 10000) {
    return { delta: 15, token: "size_penalty:+15" };
  }
  if (sizeValue > 1000) {
    return { delta: 5, token: "size_penalty:+5" };
  }
  return { delta: -5, token: "size_penalty:-5" };
}

function effortLanguageDelta(primaryLanguage) {
  if (!primaryLanguage) {
    return { delta: 0, token: null };
  }

  if (["JavaScript", "TypeScript"].includes(primaryLanguage)) {
    return { delta: -8, token: "language_match:-8" };
  }
  if (["Python", "Go", "Ruby"].includes(primaryLanguage)) {
    return { delta: 5, token: "language_match:+5" };
  }
  if (["Rust", "C++", "Elixir", "Haskell"].includes(primaryLanguage)) {
    return { delta: 12, token: "language_match:+12" };
  }
  return { delta: 0, token: null };
}

function effortActivityDelta(activityStatus) {
  if (activityStatus === "archived") {
    return { delta: 12, token: "activity_penalty:+12" };
  }
  if (activityStatus === "stale") {
    return { delta: 8, token: "activity_penalty:+8" };
  }
  return { delta: 0, token: null };
}

function effortLicenseDelta(licenseString) {
  const category = classifyLicense(licenseString);
  if (category === "permissive") {
    return { delta: -3, token: "license_adjustment:-3" };
  }
  if (category === "copyleft") {
    return { delta: 8, token: "license_adjustment:+8" };
  }
  return { delta: 4, token: "license_adjustment:+4" };
}

function valueBuildVsBorrowDelta(buildVsBorrow) {
  if (buildVsBorrow === "adapt_pattern") {
    return { delta: 10, token: "build_vs_borrow:+10" };
  }
  if (buildVsBorrow === "borrow_optional") {
    return { delta: 5, token: "build_vs_borrow:+5" };
  }
  return { delta: 0, token: null };
}

function valuePriorityDelta(priority) {
  if (priority === "now") {
    return { delta: 8, token: "priority:+8" };
  }
  return { delta: 0, token: null };
}

function valueFitDelta(fitScore) {
  const numeric = Number(fitScore);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { delta: 0, token: null };
  }
  if (numeric >= 85) {
    return { delta: 26, token: "project_fit:+26" };
  }
  if (numeric >= 70) {
    return { delta: 18, token: "project_fit:+18" };
  }
  if (numeric >= 55) {
    return { delta: 10, token: "project_fit:+10" };
  }
  if (numeric >= 40) {
    return { delta: 4, token: "project_fit:+4" };
  }
  return { delta: 0, token: null };
}

export function buildCandidateEvaluation(repo, guess, enrichment, projectAlignment, alignmentRules) {
  const layerMapping = alignmentRules?.layerMappings?.[guess?.mainLayer] ?? null;
  const gapMapping = alignmentRules?.gapMappings?.[guess?.gapArea] ?? null;
  const hasMappings = Boolean(layerMapping || gapMapping);

  let effortScore = 50;
  const effortReasons = [];

  if (layerMapping && typeof layerMapping.effort_bias === "number") {
    effortScore += layerMapping.effort_bias;
    effortReasons.push(`layer_bias:${formatSignedBias(layerMapping.effort_bias)}`);
  }

  const sizeValue = Number(enrichment?.repo?.size ?? repo?.size ?? Number.NaN);
  const sizePenalty = effortSizePenalty(sizeValue);
  if (sizePenalty.token) {
    effortScore += sizePenalty.delta;
    effortReasons.push(sizePenalty.token);
  }

  const languageDelta = effortLanguageDelta(
    enrichment?.repo?.primaryLanguage ??
    enrichment?.repo?.language ??
    enrichment?.languages?.[0]
  );
  if (languageDelta.token) {
    effortScore += languageDelta.delta;
    effortReasons.push(languageDelta.token);
  }

  const activityDelta = effortActivityDelta(deriveActivityStatus(enrichment));
  if (activityDelta.token) {
    effortScore += activityDelta.delta;
    effortReasons.push(activityDelta.token);
  }

  const licenseDelta = effortLicenseDelta(enrichment?.repo?.license);
  effortScore += licenseDelta.delta;
  effortReasons.push(licenseDelta.token);

  effortScore = clamp(effortScore, 0, 100);

  let valueScore = 8;
  const valueReasons = [];

  if (gapMapping && typeof gapMapping.value_bias === "number") {
    valueScore += gapMapping.value_bias;
    valueReasons.push(`gap_bias:+${gapMapping.value_bias}`);
  }

  const matchedCapabilities = Array.isArray(projectAlignment?.matchedCapabilities)
    ? projectAlignment.matchedCapabilities
    : [];
  if (matchedCapabilities.length > 0) {
    const capabilityDelta = matchedCapabilities.length * 8;
    valueScore += capabilityDelta;
    valueReasons.push(`matched_capabilities:+${capabilityDelta}`);
  }

  const buildVsBorrowDeltaResult = valueBuildVsBorrowDelta(guess?.buildVsBorrow);
  if (buildVsBorrowDeltaResult.token) {
    valueScore += buildVsBorrowDeltaResult.delta;
    valueReasons.push(buildVsBorrowDeltaResult.token);
  }

  const priorityDeltaResult = valuePriorityDelta(guess?.priority);
  if (priorityDeltaResult.token) {
    valueScore += priorityDeltaResult.delta;
    valueReasons.push(priorityDeltaResult.token);
  }

  const fitDeltaResult = valueFitDelta(projectAlignment?.fitScore);
  if (fitDeltaResult.token) {
    valueScore += fitDeltaResult.delta;
    valueReasons.push(fitDeltaResult.token);
  }

  if ((projectAlignment?.tensions?.length ?? 0) > 0) {
    valueScore -= 6;
    valueReasons.push("tension_penalty:-6");
  }

  if (enrichment?.repo?.archived) {
    valueScore -= 15;
    valueReasons.push("archive_value_drop:-15");
  }

  valueScore = clamp(valueScore, 0, 100);

  const effortBand = hasMappings ? bandFromScore(effortScore) : "unknown";
  const valueBand = hasMappings ? bandFromScore(valueScore) : "unknown";

  return {
    effortScore,
    effortBand,
    valueScore,
    valueBand,
    effortReasons,
    valueReasons,
    decisionSummary: buildDecisionSummary(effortBand, valueBand)
  };
}

function normalizeDispositionBand(band) {
  return band === "low" || band === "medium" || band === "high" ? band : "unknown";
}

const DISPOSITION_MATRIX = {
  low: {
    low: "observe_only",
    medium: "review_queue",
    high: "intake_now"
  },
  medium: {
    low: "skip",
    medium: "observe_only",
    high: "review_queue"
  },
  high: {
    low: "skip",
    medium: "observe_only",
    high: "review_queue"
  }
};

export function deriveDisposition(evaluation, risks, projectFitBand) {
  const effortBand = normalizeDispositionBand(evaluation?.effortBand);
  const valueBand = normalizeDispositionBand(evaluation?.valueBand);
  const riskList = Array.isArray(risks) ? risks : [];

  if (riskList.includes("archived_repo")) {
    return {
      disposition: "observe_only",
      dispositionReason: "override:archived_cap"
    };
  }

  if (riskList.includes("source_lock_in") && valueBand !== "high") {
    return {
      disposition: "observe_only",
      dispositionReason: "override:source_lock_in_cap"
    };
  }

  if (projectFitBand === "unknown") {
    return {
      disposition: "observe_only",
      dispositionReason: "override:unknown_fit"
    };
  }

  if (effortBand === "unknown" || valueBand === "unknown") {
    return {
      disposition: "review_queue",
      dispositionReason: "override:unknown_band"
    };
  }

  if (projectFitBand === "high" && valueBand === "medium" && effortBand !== "high") {
    return {
      disposition: "review_queue",
      dispositionReason: "override:high_fit_medium_value"
    };
  }

  return {
    disposition: DISPOSITION_MATRIX[effortBand]?.[valueBand] ?? "observe_only",
    dispositionReason: `matrix:effort_${effortBand}_value_${valueBand}`
  };
}

function minConfidence(left, right) {
  const order = { low: 0, medium: 1, high: 2 };
  return order[left] <= order[right] ? left : right;
}

export function buildRunConfidence(candidates, totalCapabilitiesInRules) {
  const items = Array.isArray(candidates) ? candidates : [];
  const candidateCount = items.length;
  const highFitCount = items.filter((candidate) => getCandidateFitBand(candidate) === "high").length;
  const unknownFitCount = items.filter((candidate) => getCandidateFitBand(candidate) === "unknown").length;
  const riskyCount = items.filter((candidate) =>
    getCandidateRisks(candidate).some((risk) => risk === "archived_repo" || risk === "source_lock_in")
  ).length;

  const capabilitySet = new Set();
  for (const candidate of items) {
    for (const capability of getCandidateMatchedCapabilities(candidate)) {
      capabilitySet.add(capability);
    }
  }

  const totalCapabilities = Math.max(1, Number(totalCapabilitiesInRules) || 1);
  const capabilityDiversity = capabilitySet.size / totalCapabilities;

  let runConfidence;
  let runConfidenceReason;

  if (candidateCount < 3) {
    runConfidence = "low";
    runConfidenceReason = `Only ${candidateCount} candidate(s) evaluated - too few to draw a pattern`;
  } else if (highFitCount >= 3 && capabilityDiversity >= 0.4) {
    runConfidence = "high";
    runConfidenceReason = `${highFitCount} high-fit candidates across ${capabilitySet.size} capabilities`;
  } else if (highFitCount >= 2 || capabilityDiversity >= 0.25) {
    runConfidence = "medium";
    runConfidenceReason = `${highFitCount} high-fit candidates, capability diversity ${Math.round(capabilityDiversity * 100)}%`;
  } else {
    runConfidence = "low";
    runConfidenceReason = `${highFitCount} high-fit in ${candidateCount} total - signals are thin`;
  }

  if (candidateCount > 0 && unknownFitCount / candidateCount > 0.3) {
    runConfidence = minConfidence(runConfidence, "medium");
    runConfidenceReason += ` - capped: ${unknownFitCount}/${candidateCount} candidates unknown fit`;
  }

  if (candidateCount > 0 && riskyCount / candidateCount > 0.4) {
    runConfidence = minConfidence(runConfidence, "medium");
    runConfidenceReason += ` - capped: ${riskyCount}/${candidateCount} candidates risk-flagged`;
  }

  return {
    runConfidence,
    runConfidenceReason,
    confidenceFactors: {
      candidateCount,
      highFitCount,
      unknownFitCount,
      riskyCount,
      capabilityDiversity
    }
  };
}
