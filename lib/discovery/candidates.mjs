import { clamp, uniqueStrings } from "../utils.mjs";
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

function extractCandidateTextHits(candidate, domainKeywords = []) {
  const repoText = buildClassificationText(candidate.repo, candidate.enrichment).toLowerCase();
  const repoTopics = Array.isArray(candidate.enrichment?.repo?.topics)
    ? candidate.enrichment.repo.topics.map((item) => String(item).toLowerCase())
    : [];
  const readmeText = String(candidate.enrichment?.readme?.excerpt ?? "").toLowerCase();
  const languages = Array.isArray(candidate.enrichment?.languages)
    ? candidate.enrichment.languages.map((item) => String(item).toLowerCase())
    : [];

  const keywordHits = domainKeywords.filter((keyword) => repoText.includes(keyword));
  const topicHits = domainKeywords.filter((keyword) => repoTopics.some((topic) => topic.includes(keyword)));
  const readmeHits = domainKeywords.filter((keyword) => readmeText.includes(keyword));
  const languageHits = domainKeywords.filter((keyword) => languages.some((language) => language.includes(keyword)));

  return {
    keywordHits,
    topicHits,
    readmeHits,
    languageHits
  };
}

function buildCandidateEvidenceProfile(candidate, domainKeywords = []) {
  const hits = extractCandidateTextHits(candidate, domainKeywords);
  const repo = candidate.enrichment?.repo ?? {};
  const metadataSignals = [
    repo.description,
    Array.isArray(repo.topics) && repo.topics.length > 0 ? "topics" : "",
    candidate.enrichment?.readme?.excerpt ? "readme" : "",
    Array.isArray(candidate.enrichment?.languages) && candidate.enrichment.languages.length > 0 ? "languages" : "",
    repo.license ? "license" : "",
    repo.homepage ? "homepage" : ""
  ].filter(Boolean);
  const queryFamilyCount = Array.isArray(candidate.queryFamilies) ? candidate.queryFamilies.length : 0;
  const matchedCapabilities = candidate.projectAlignment?.matchedCapabilities?.length ?? 0;
  const tensions = candidate.projectAlignment?.tensions?.length ?? 0;
  const riskCount = candidate.risks?.length ?? 0;
  const reasoningSignals = [];

  if (hits.topicHits.length > 0) {
    reasoningSignals.push(`topics:${hits.topicHits.slice(0, 3).join(", ")}`);
  }
  if (hits.readmeHits.length > 0) {
    reasoningSignals.push(`readme:${hits.readmeHits.slice(0, 3).join(", ")}`);
  }
  if (matchedCapabilities > 0) {
    reasoningSignals.push(`capabilities:${candidate.projectAlignment.matchedCapabilities.slice(0, 3).join(", ")}`);
  }
  if (queryFamilyCount > 1) {
    reasoningSignals.push(`query_families:${queryFamilyCount}`);
  }

  let score = 0;
  score += Math.min(hits.keywordHits.length * 3, 12);
  score += Math.min(hits.topicHits.length * 4, 12);
  score += Math.min(hits.readmeHits.length * 3, 9);
  score += Math.min(metadataSignals.length * 2, 10);
  score += Math.min(queryFamilyCount * 3, 9);
  score += Math.min(matchedCapabilities * 4, 12);
  if (candidate.enrichment?.status === "success") {
    score += 6;
  }
  if (repo.homepage) {
    score += 2;
  }
  score -= tensions * 4;
  score -= riskCount * 2;
  score = clamp(score, 0, 100);

  let grade = "light";
  if (score >= 36) {
    grade = "strong";
  } else if (score >= 20) {
    grade = "solid";
  }

  return {
    score,
    grade,
    keywordHits: hits.keywordHits,
    topicHits: hits.topicHits,
    readmeHits: hits.readmeHits,
    languageHits: hits.languageHits,
    metadataSignals,
    queryFamilyCount,
    matchedCapabilityCount: matchedCapabilities,
    reasoningSignals
  };
}

function buildDiscoveryFeedbackMatch(candidate, discoveryFeedback) {
  if (!discoveryFeedback?.hasSignals) {
    return {
      positiveSignals: [],
      negativeSignals: [],
      score: 0
    };
  }

  const sourceValues = uniqueStrings([
    candidate.guess?.patternFamily,
    candidate.guess?.mainLayer,
    candidate.guess?.gapArea,
    ...(candidate.projectAlignment?.matchedCapabilities ?? []),
    ...(candidate.queryFamilies ?? []),
    ...((candidate.enrichment?.repo?.topics ?? []).map((item) => String(item).toLowerCase()))
  ]);

  const positiveSignals = sourceValues.filter((value) => discoveryFeedback.preferredSignals?.includes(value));
  const negativeSignals = sourceValues.filter((value) => discoveryFeedback.avoidSignals?.includes(value));
  const positiveTerms = sourceValues.filter((value) => discoveryFeedback.preferredTerms?.includes(value));
  const negativeTerms = sourceValues.filter((value) => discoveryFeedback.avoidTerms?.includes(value));
  const score = positiveSignals.length * 8 + positiveTerms.length * 3 - negativeSignals.length * 10 - negativeTerms.length * 4;

  return {
    positiveSignals: uniqueStrings([...positiveSignals, ...positiveTerms]),
    negativeSignals: uniqueStrings([...negativeSignals, ...negativeTerms]),
    score
  };
}

function classifyDiscoveryCandidate(candidate, evidenceProfile) {
  const fitBand = candidate.projectAlignment?.fitBand ?? "unknown";
  const disposition = candidate.discoveryDisposition ?? "watch_only";
  const tensions = candidate.projectAlignment?.tensions?.length ?? 0;
  const riskCount = candidate.risks?.length ?? 0;
  const fitScore = candidate.projectAlignment?.fitScore ?? 0;

  if (
    fitBand === "high" &&
    evidenceProfile.grade === "strong" &&
    fitScore >= 70 &&
    tensions === 0 &&
    ["intake_now", "review_queue", "watch_only"].includes(disposition)
  ) {
    return "fit_candidate";
  }
  if (riskCount >= 2 || candidate.enrichment?.repo?.archived) {
    return "risk_signal";
  }
  if (tensions > 0 || disposition === "observe_only") {
    return "boundary_signal";
  }
  if (evidenceProfile.grade === "strong" || evidenceProfile.grade === "solid") {
    return "research_signal";
  }
  return "weak_signal";
}

export function buildDiscoveryReasoning(candidate, domainKeywords) {
  const reasons = [];
  if (candidate.queryLabels.length > 0) {
    reasons.push(`Matched discovery lenses: ${candidate.queryLabels.join(", ")}.`);
  }
  if (candidate.queryFamilies?.length > 0) {
    reasons.push(`Query families: ${candidate.queryFamilies.join(", ")}.`);
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
  const evidenceProfile = candidate.discoveryEvidence ?? buildCandidateEvidenceProfile(candidate, domainKeywords);
  if (candidate.discoveryClass) {
    reasons.push(`Candidate class: ${candidate.discoveryClass.replace(/_/g, " ")}.`);
  }
  reasons.push(`Evidence grade is ${evidenceProfile.grade} (${evidenceProfile.score}).`);
  if (evidenceProfile.topicHits.length > 0) {
    reasons.push(`Topic overlap: ${evidenceProfile.topicHits.slice(0, 5).join(", ")}.`);
  }
  if (evidenceProfile.readmeHits.length > 0) {
    reasons.push(`README overlap: ${evidenceProfile.readmeHits.slice(0, 5).join(", ")}.`);
  }
  if (evidenceProfile.keywordHits.length > 0) {
    reasons.push(`Project-keyword overlap: ${evidenceProfile.keywordHits.slice(0, 5).join(", ")}.`);
  }
  if (candidate.projectAlignment?.tensions?.length > 0) {
    reasons.push(`Main tensions: ${candidate.projectAlignment.tensions.join(" | ")}.`);
  }
  if (candidate.discoveryFeedbackMatch?.positiveSignals?.length > 0) {
    reasons.push(`Feedback-loop positives: ${candidate.discoveryFeedbackMatch.positiveSignals.slice(0, 5).join(", ")}.`);
  }
  if (candidate.discoveryFeedbackMatch?.negativeSignals?.length > 0) {
    reasons.push(`Feedback-loop negatives: ${candidate.discoveryFeedbackMatch.negativeSignals.slice(0, 5).join(", ")}.`);
  }
  if (candidate.enrichment?.repo?.archived) {
    reasons.push("Archived repos are downgraded to pattern-signal only.");
  }
  return reasons;
}

export function scoreDiscoveryCandidate(candidate, domainKeywords, discoveryFeedback = null) {
  let score = 12;
  score += candidate.queryLabels.length * 8;
  score += (candidate.queryFamilies?.length ?? 0) * 4;
  score += discoveryStarScore(candidate.enrichment?.repo?.stars ?? 0);
  score += discoveryActivityScore(candidate.enrichment);
  score += Math.round((candidate.projectAlignment?.fitScore ?? 0) * 0.5);
  score += (candidate.projectAlignment?.matchedCapabilities?.length ?? 0) * 6;

  const evidenceProfile = buildCandidateEvidenceProfile(candidate, domainKeywords);
  candidate.discoveryEvidence = evidenceProfile;
  score += evidenceProfile.score;
  candidate.discoveryFeedbackMatch = buildDiscoveryFeedbackMatch(candidate, discoveryFeedback);
  score += candidate.discoveryFeedbackMatch.score;

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
  if ((candidate.projectAlignment?.tensions?.length ?? 0) > 0) {
    score -= 10;
  }
  if (candidate.enrichment?.status !== "success") {
    score -= 8;
  }
  if (!candidate.enrichment?.readme?.excerpt) {
    score -= 4;
  }

  candidate.discoveryClass = classifyDiscoveryCandidate(candidate, evidenceProfile);

  return clamp(score, 0, 100);
}
