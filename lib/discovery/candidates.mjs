import { clamp } from "../utils.mjs";
import {
  evaluateDiscoveryCandidatePolicy,
  summarizeDiscoveryPolicyResults,
  buildDiscoveryPolicyCalibration
} from "../policy/discovery-policy.mjs";
import {
  deriveActivityStatus,
  buildClassificationText
} from "../classification/core.mjs";
import {
  buildCandidateEvaluation,
  deriveDisposition,
  buildRunConfidence,
  normalizeGapAreaCanonical,
  buildRunGapSignals
} from "../classification/evaluation.mjs";

export function parseCandidateRisks(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function decorateDiscoveryCandidate(candidate, alignmentRules) {
  const evaluation = buildCandidateEvaluation(
    candidate.repo,
    candidate.guess,
    candidate.enrichment,
    candidate.projectAlignment,
    alignmentRules
  );
  const { disposition, dispositionReason } = deriveDisposition(
    evaluation,
    candidate.risks ?? [],
    candidate.projectAlignment?.fitBand ?? "unknown"
  );

  Object.assign(candidate, {
    gapAreaCanonical: normalizeGapAreaCanonical(candidate.guess?.gapArea, alignmentRules),
    effortBand: evaluation.effortBand,
    effortScore: evaluation.effortScore,
    valueBand: evaluation.valueBand,
    valueScore: evaluation.valueScore,
    discoveryDisposition: disposition,
    dispositionReason,
    decisionDataState: "complete",
    decisionSummary: evaluation.decisionSummary,
    effortReasons: evaluation.effortReasons,
    valueReasons: evaluation.valueReasons
  });

  return candidate;
}

export function buildDiscoveryRunFields(candidates, alignmentRules) {
  const confidence = buildRunConfidence(candidates, alignmentRules?.capabilities?.length ?? 0);
  const itemsDataStateSummary = candidates.reduce(
    (acc, candidate) => {
      const state = candidate?.decisionDataState ?? "complete";
      acc[state] = (acc[state] ?? 0) + 1;
      return acc;
    },
    { complete: 0, fallback: 0, stale: 0 }
  );

  return {
    reportSchemaVersion: 2,
    runConfidence: confidence.runConfidence,
    runConfidenceReason: confidence.runConfidenceReason,
    confidenceFactors: confidence.confidenceFactors,
    itemsDataStateSummary,
    runGapSignals: buildRunGapSignals(candidates, alignmentRules)
  };
}

function buildPolicyPreview(candidates = [], limit = 6) {
  return candidates.slice(0, limit).map((candidate) => ({
    repoRef: candidate?.full_name ?? `${candidate?.repo?.owner ?? "unknown"}/${candidate?.repo?.name ?? "unknown"}`,
    blockers: candidate?.discoveryPolicyGate?.blockers ?? [],
    summary: candidate?.discoveryPolicyGate?.summary ?? "blocked"
  }));
}

export function applyDiscoveryPolicyToCandidates(candidates = [], discoveryPolicy, mode = "enforce") {
  const normalizedMode = ["enforce", "audit", "off"].includes(mode) ? mode : "enforce";

  if (!discoveryPolicy || normalizedMode === "off") {
    const policySummary = {
      enabled: false,
      mode: "off",
      evaluated: candidates.length,
      visible: candidates.length,
      allowed: candidates.length,
      blocked: 0,
      preferred: 0,
      blockerCounts: [],
      preferenceCounts: [],
      blockedPreview: [],
      enforcedBlocked: 0
    };
    return {
      visibleCandidates: candidates,
      blockedCandidates: [],
      policySummary,
      policyCalibration: buildDiscoveryPolicyCalibration(policySummary)
    };
  }

  const policyEvaluations = [];
  const blockedCandidates = [];
  const allowedCandidates = [];

  for (const candidate of candidates) {
    const policyGate = evaluateDiscoveryCandidatePolicy(candidate, discoveryPolicy);
    candidate.discoveryPolicyGate = policyGate;
    policyEvaluations.push(policyGate);
    if (policyGate.allowed) {
      allowedCandidates.push(candidate);
    } else {
      blockedCandidates.push(candidate);
    }
  }

  const visibleCandidates = normalizedMode === "audit" ? candidates : allowedCandidates;
  const summary = summarizeDiscoveryPolicyResults(policyEvaluations);
  const policySummary = {
    enabled: true,
    mode: normalizedMode,
    visible: visibleCandidates.length,
    ...summary,
    blockedPreview: buildPolicyPreview(blockedCandidates),
    enforcedBlocked: normalizedMode === "enforce" ? blockedCandidates.length : 0
  };

  return {
    visibleCandidates,
    blockedCandidates,
    policySummary,
    policyCalibration: buildDiscoveryPolicyCalibration(policySummary)
  };
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

export function buildDiscoveryReasoning(candidate, domainKeywords) {
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

export function scoreDiscoveryCandidate(candidate, domainKeywords) {
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
