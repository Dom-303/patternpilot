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

const DISCOVERY_SYSTEM_PATTERN_SIGNALS = {
  sourceFamilies: ["source", "scrape", "scraper", "crawler", "connector", "adapter", "feed", "extract", "parser"],
  publicEventIntake: ["open data", "public event", "public calendar", "municipal", "civic", "community", "government", "community calendar", "city council"],
  governance: ["review", "validation", "governance", "audit", "policy", "dedupe", "contract"],
  normalization: ["normalize", "schema", "entity", "taxonomy", "masterlist", "csv", "xlsx", "ical", "ics"],
  nicheVerticals: ["climbing", "competition", "stadium", "arena", "ufc", "timetable", "course", "church", "forex", "investing.com"],
  surfaceNoise: ["frontend", "website", "homepage", "dashboard", "nextjs", "react", "tailwind", "ionic", "startpage", "widget", "embed"]
};

const PROJECT_BINDING_GENERIC_STOPWORDS = new Set([
  "and",
  "data",
  "event",
  "events",
  "for",
  "from",
  "open",
  "project",
  "review",
  "source",
  "system",
  "target",
  "the",
  "worker"
]);

function countSignalHits(text, signals = []) {
  const source = String(text ?? "").toLowerCase();
  return signals.reduce((total, signal) => total + (source.includes(String(signal).toLowerCase()) ? 1 : 0), 0);
}

function normalizeBindingToken(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenizeBindingText(value) {
  return normalizeBindingToken(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.length >= 4 && !PROJECT_BINDING_GENERIC_STOPWORDS.has(item));
}

function toPatternList(values = []) {
  return values
    .map((item) => normalizeBindingToken(item))
    .filter((item) => item.length >= 4);
}

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

  const evidence = candidate.discoveryEvidence ?? {};
  const lowProjectBinding = (candidate.projectBindingScore ?? 0) < 28;
  const lacksCoreProjectSignals = (evidence.sourceFamilyHits ?? 0) === 0
    && (evidence.publicEventIntakeHits ?? 0) === 0
    && (evidence.normalizationHits ?? 0) < 2;

  if (lowProjectBinding && lacksCoreProjectSignals) {
    if (candidate.discoveryDisposition === "review_queue") {
      candidate.discoveryDisposition = "observe_only";
      candidate.dispositionReason = "project_binding:observe_only";
    } else if (candidate.discoveryDisposition === "intake_now") {
      candidate.discoveryDisposition = "review_queue";
      candidate.dispositionReason = "project_binding:review_queue";
    }
  }

  const prototypeReadiness = evaluatePrototypeReadiness(candidate);
  candidate.prototypeReadiness = prototypeReadiness;

  if (
    prototypeReadiness.ready &&
    candidate.discoveryDisposition === "review_queue"
  ) {
    candidate.discoveryDisposition = "intake_now";
    candidate.dispositionReason = "prototype_ready:intake_now";
  }

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
  const repoText = buildClassificationText(candidate.repo, candidate.enrichment).toLowerCase();
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
  const sourceFamilyHits = countSignalHits(repoText, DISCOVERY_SYSTEM_PATTERN_SIGNALS.sourceFamilies);
  const publicEventIntakeHits = countSignalHits(repoText, DISCOVERY_SYSTEM_PATTERN_SIGNALS.publicEventIntake);
  const governanceHits = countSignalHits(repoText, DISCOVERY_SYSTEM_PATTERN_SIGNALS.governance);
  const normalizationHits = countSignalHits(repoText, DISCOVERY_SYSTEM_PATTERN_SIGNALS.normalization);
  const nicheVerticalHits = countSignalHits(repoText, DISCOVERY_SYSTEM_PATTERN_SIGNALS.nicheVerticals);
  const surfaceNoiseHits = countSignalHits(repoText, DISCOVERY_SYSTEM_PATTERN_SIGNALS.surfaceNoise);
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
  if (sourceFamilyHits > 0) {
    reasoningSignals.push(`source_family:${sourceFamilyHits}`);
  }
  if (governanceHits > 0) {
    reasoningSignals.push(`governance:${governanceHits}`);
  }
  if (normalizationHits > 0) {
    reasoningSignals.push(`normalization:${normalizationHits}`);
  }
  if (publicEventIntakeHits > 0) {
    reasoningSignals.push(`public_intake:${publicEventIntakeHits}`);
  }
  if (nicheVerticalHits > 0) {
    reasoningSignals.push(`niche_vertical:${nicheVerticalHits}`);
  }
  if (surfaceNoiseHits > 0) {
    reasoningSignals.push(`surface_noise:${surfaceNoiseHits}`);
  }

  let score = 0;
  score += Math.min(hits.keywordHits.length * 3, 12);
  score += Math.min(hits.topicHits.length * 4, 12);
  score += Math.min(hits.readmeHits.length * 3, 9);
  score += Math.min(metadataSignals.length * 2, 10);
  score += Math.min(queryFamilyCount * 3, 9);
  score += Math.min(matchedCapabilities * 4, 12);
  score += Math.min(sourceFamilyHits * 4, 12);
  score += Math.min(publicEventIntakeHits * 3, 9);
  score += Math.min(governanceHits * 5, 10);
  score += Math.min(normalizationHits * 4, 12);
  if (candidate.enrichment?.status === "success") {
    score += 6;
  }
  score -= tensions * 4;
  score -= riskCount * 2;
  if (nicheVerticalHits > 0 && governanceHits === 0 && normalizationHits < 3) {
    score -= nicheVerticalHits * 5;
  }
  if (surfaceNoiseHits > 0 && sourceFamilyHits === 0 && publicEventIntakeHits === 0 && normalizationHits < 2) {
    score -= Math.min(surfaceNoiseHits * 5, 20);
  }
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
    sourceFamilyHits,
    publicEventIntakeHits,
    governanceHits,
    normalizationHits,
    nicheVerticalHits,
    surfaceNoiseHits,
    reasoningSignals
  };
}

function evaluatePrototypeReadiness(candidate) {
  const evidence = candidate.discoveryEvidence ?? {};
  const fitBand = String(candidate?.projectAlignment?.fitBand ?? "unknown");
  const fitScore = Number(candidate?.projectAlignment?.fitScore ?? 0) || 0;
  const projectBindingScore = Number(candidate?.projectBindingScore ?? 0) || 0;
  const mainLayer = String(candidate?.guess?.mainLayer ?? "").toLowerCase();
  const riskFlags = Array.isArray(candidate?.risks) ? candidate.risks : [];
  const tensions = candidate?.projectAlignment?.tensions?.length ?? 0;
  const sourceFamilyHits = Number(evidence.sourceFamilyHits ?? 0) || 0;
  const publicEventIntakeHits = Number(evidence.publicEventIntakeHits ?? 0) || 0;
  const governanceHits = Number(evidence.governanceHits ?? 0) || 0;
  const normalizationHits = Number(evidence.normalizationHits ?? 0) || 0;
  const supportedLayers = new Set([
    "access_fetch",
    "source_intake",
    "parsing_extraction"
  ]);
  const blockers = [];

  if (fitBand !== "high" || fitScore < 80) blockers.push("fit_not_strong_enough");
  if (projectBindingScore < 60) blockers.push("binding_not_strong_enough");
  if (!supportedLayers.has(mainLayer)) blockers.push("layer_not_prototype_friendly");
  if (sourceFamilyHits < 2) blockers.push("source_family_too_thin");
  if (publicEventIntakeHits < 1 && normalizationHits < 1 && governanceHits < 1) blockers.push("missing_transferable_core_signal");
  if (tensions > 0) blockers.push("project_tension_present");
  if (riskFlags.includes("archived_repo") || riskFlags.includes("source_lock_in")) blockers.push("hard_risk_present");

  return {
    ready: blockers.length === 0,
    blockers
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
  const repoText = buildClassificationText(candidate.repo, candidate.enrichment).toLowerCase();
  const learnedPositiveTerms = toPatternList(discoveryFeedback.learnedCohorts?.positiveParts ?? [])
    .filter((value) => value.length >= 4 && repoText.includes(value));
  const learnedNegativeTerms = toPatternList(discoveryFeedback.learnedCohorts?.negativeParts ?? [])
    .filter((value) => value.length >= 4 && repoText.includes(value));
  const score =
    positiveSignals.length * 8 +
    positiveTerms.length * 3 +
    learnedPositiveTerms.length * 4 -
    negativeSignals.length * 10 -
    negativeTerms.length * 4 -
    learnedNegativeTerms.length * 6;

  return {
    positiveSignals: uniqueStrings([...positiveSignals, ...positiveTerms, ...learnedPositiveTerms]),
    negativeSignals: uniqueStrings([...negativeSignals, ...negativeTerms, ...learnedNegativeTerms]),
    score
  };
}

export function computeProjectBindingScore(candidate, binding = {}, discoveryPolicy = null) {
  const evidence = candidate.discoveryEvidence ?? {};
  const repoText = buildClassificationText(candidate.repo, candidate.enrichment).toLowerCase();
  const topics = Array.isArray(candidate.enrichment?.repo?.topics)
    ? candidate.enrichment.repo.topics.map((item) => String(item).toLowerCase())
    : [];
  const hintTerms = [
    ...(binding.discoveryHints ?? []),
    ...(binding.targetCapabilities ?? []),
    ...(binding.analysisQuestions ?? [])
  ];
  const preferredPatterns = [
    ...(discoveryPolicy?.preferredSignalPatterns ?? []),
    ...(discoveryPolicy?.preferredTopics ?? [])
  ];
  const projectTerms = new Set([
    ...hintTerms.flatMap((item) => tokenizeBindingText(item)),
    ...preferredPatterns.flatMap((item) => tokenizeBindingText(item))
  ]);

  const projectTermHits = [...projectTerms].filter((term) => repoText.includes(term) || topics.some((topic) => topic.includes(term)));
  const patternHits = toPatternList(discoveryPolicy?.preferredSignalPatterns ?? []).filter((pattern) => repoText.includes(pattern));
  const topicHits = toPatternList(discoveryPolicy?.preferredTopics ?? []).filter((pattern) => topics.some((topic) => topic.includes(pattern)));

  const sourceFamilyHits = Number(evidence.sourceFamilyHits ?? 0) || 0;
  const publicEventIntakeHits = Number(evidence.publicEventIntakeHits ?? 0) || 0;
  const governanceHits = Number(evidence.governanceHits ?? 0) || 0;
  const normalizationHits = Number(evidence.normalizationHits ?? 0) || 0;
  const nicheVerticalHits = Number(evidence.nicheVerticalHits ?? 0) || 0;
  const surfaceNoiseHits = Number(evidence.surfaceNoiseHits ?? 0) || 0;
  const layer = String(candidate?.guess?.mainLayer ?? "").toLowerCase();

  let score = 0;
  score += Math.min(projectTermHits.length * 3, 12);
  score += Math.min(patternHits.length * 4, 16);
  score += Math.min(topicHits.length * 3, 9);
  score += Math.min(sourceFamilyHits * 5, 20);
  score += Math.min(publicEventIntakeHits * 7, 21);
  score += Math.min(normalizationHits * 4, 12);

  if (sourceFamilyHits > 0 && publicEventIntakeHits > 0) score += 18;
  if (sourceFamilyHits > 0 && normalizationHits > 0) score += 12;
  if (publicEventIntakeHits > 0 && governanceHits > 0) score += 8;
  if (layer === "source_intake" || layer === "access_fetch" || layer === "location_place_enrichment") score += 6;

  if (governanceHits > 0 && sourceFamilyHits === 0 && publicEventIntakeHits === 0 && normalizationHits === 0) score -= 18;
  if (layer === "export_feed_api" && sourceFamilyHits === 0 && publicEventIntakeHits === 0) score -= 10;
  if (layer === "distribution_plugin" || layer === "ui_discovery_surface") score -= 12;
  if (projectTermHits.length === 0 && patternHits.length === 0 && sourceFamilyHits === 0 && publicEventIntakeHits === 0) score -= 18;
  if (nicheVerticalHits > 0 && publicEventIntakeHits === 0) score -= 10;
  if (surfaceNoiseHits > 0 && sourceFamilyHits === 0 && publicEventIntakeHits === 0 && normalizationHits < 2) score -= Math.min(surfaceNoiseHits * 6, 24);

  candidate.projectBindingScore = clamp(score, -40, 100);
  return candidate.projectBindingScore;
}

function classifyDiscoveryCandidate(candidate, evidenceProfile) {
  const fitBand = candidate.projectAlignment?.fitBand ?? "unknown";
  const disposition = candidate.discoveryDisposition ?? "watch_only";
  const tensions = candidate.projectAlignment?.tensions?.length ?? 0;
  const riskCount = candidate.risks?.length ?? 0;
  const fitScore = candidate.projectAlignment?.fitScore ?? 0;
  const projectBindingScore = candidate.projectBindingScore ?? 0;
  const mainLayer = String(candidate.guess?.mainLayer ?? "").toLowerCase();
  const queryIds = new Set(Array.isArray(candidate.queryIds) ? candidate.queryIds : []);
  const hasCoreProjectSignals = evidenceProfile.sourceFamilyHits >= 2
    || evidenceProfile.publicEventIntakeHits >= 1
    || evidenceProfile.normalizationHits >= 2;
  const hasPublicNormalizationContext =
    evidenceProfile.publicEventIntakeHits >= 1 || evidenceProfile.normalizationHits >= 1;
  const hasLaneSpecificEvidence =
    (queryIds.has("signal-lane-public_event_intake")
      && evidenceProfile.publicEventIntakeHits >= 1
      && evidenceProfile.normalizationHits >= 1) ||
    (queryIds.has("signal-lane-adapter_family")
      && evidenceProfile.sourceFamilyHits >= 2
      && (evidenceProfile.normalizationHits >= 1 || evidenceProfile.governanceHits >= 1)) ||
    (queryIds.has("signal-lane-normalization_schema")
      && evidenceProfile.normalizationHits >= 2
      && (evidenceProfile.publicEventIntakeHits >= 1 || evidenceProfile.sourceFamilyHits >= 1));
  const isCoreIngestionLayer = ["access_fetch", "source_intake", "parsing_extraction"].includes(mainLayer);

  if (isCoreIngestionLayer && !hasPublicNormalizationContext) {
    return evidenceProfile.grade === "strong" ? "boundary_signal" : "weak_signal";
  }

  if (isCoreIngestionLayer && !hasCoreProjectSignals && !hasLaneSpecificEvidence) {
    return evidenceProfile.grade === "strong" ? "boundary_signal" : "weak_signal";
  }

  if (
    (queryIds.has("signal-lane-public_event_intake")
      || queryIds.has("signal-lane-adapter_family")
      || queryIds.has("signal-lane-normalization_schema")) &&
    !hasLaneSpecificEvidence
  ) {
    return evidenceProfile.grade === "strong" ? "boundary_signal" : "weak_signal";
  }

  if (
    fitBand === "high" &&
    evidenceProfile.grade === "strong" &&
    fitScore >= 70 &&
    (hasCoreProjectSignals || hasLaneSpecificEvidence || projectBindingScore >= 55) &&
    tensions === 0 &&
    ["intake_now", "review_queue", "watch_only"].includes(disposition)
  ) {
    return "fit_candidate";
  }
  if (
    evidenceProfile.governanceHits > 0 &&
    evidenceProfile.sourceFamilyHits === 0 &&
    evidenceProfile.publicEventIntakeHits === 0 &&
    evidenceProfile.normalizationHits < 2
  ) {
    return "boundary_signal";
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

function scoreLaneSpecificEvidence(candidate, evidenceProfile) {
  const queryIds = new Set(Array.isArray(candidate.queryIds) ? candidate.queryIds : []);
  const sourceFamilyHits = Number(evidenceProfile.sourceFamilyHits ?? 0) || 0;
  const publicEventIntakeHits = Number(evidenceProfile.publicEventIntakeHits ?? 0) || 0;
  const governanceHits = Number(evidenceProfile.governanceHits ?? 0) || 0;
  const normalizationHits = Number(evidenceProfile.normalizationHits ?? 0) || 0;

  let score = 0;

  if (queryIds.has("signal-lane-public_event_intake")) {
    if (publicEventIntakeHits >= 1) score += 18;
    else score -= 24;

    if (normalizationHits >= 1) score += 8;
    else score -= 10;

    if (sourceFamilyHits >= 1) score += 6;
  }

  if (queryIds.has("signal-lane-adapter_family")) {
    if (sourceFamilyHits >= 2) score += 18;
    else if (sourceFamilyHits >= 1) score += 8;
    else score -= 22;

    if (normalizationHits >= 1 || governanceHits >= 1) score += 6;
  }

  if (queryIds.has("signal-lane-normalization_schema")) {
    if (normalizationHits >= 2) score += 18;
    else if (normalizationHits >= 1) score += 8;
    else score -= 22;

    if (publicEventIntakeHits >= 1 || sourceFamilyHits >= 1) score += 6;
  }

  if (queryIds.has("signal-lane-governance_review")) {
    if (governanceHits >= 1) score += 10;
    if (sourceFamilyHits === 0 && publicEventIntakeHits === 0 && normalizationHits === 0) score -= 16;
  }

  if (queryIds.has("dependency-neighbors")) {
    const hasCoreGrounding = sourceFamilyHits >= 1
      && (publicEventIntakeHits >= 1 || normalizationHits >= 1 || governanceHits >= 1);
    if (hasCoreGrounding) score += 10;
    else score -= 26;
  }

  return score;
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
  if (evidenceProfile.sourceFamilyHits > 0) {
    reasons.push(`Source-family signals: ${evidenceProfile.sourceFamilyHits}.`);
  }
  if (evidenceProfile.publicEventIntakeHits > 0) {
    reasons.push(`Public-event-intake signals: ${evidenceProfile.publicEventIntakeHits}.`);
  }
  if (evidenceProfile.governanceHits > 0) {
    reasons.push(`Governance signals: ${evidenceProfile.governanceHits}.`);
  }
  if (evidenceProfile.normalizationHits > 0) {
    reasons.push(`Normalization signals: ${evidenceProfile.normalizationHits}.`);
  }
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
  if (candidate.prototypeReadiness?.ready) {
    reasons.push("Prototype readiness: yes.");
  } else if ((candidate.prototypeReadiness?.blockers?.length ?? 0) > 0) {
    reasons.push(`Prototype blockers: ${candidate.prototypeReadiness.blockers.slice(0, 4).join(", ")}.`);
  }
  if (evidenceProfile.nicheVerticalHits > 0) {
    reasons.push(`Vertical-specialization signals: ${evidenceProfile.nicheVerticalHits}.`);
  }
  if (candidate.enrichment?.repo?.archived) {
    reasons.push("Archived repos are downgraded to pattern-signal only.");
  }
  return reasons;
}

export function scoreDiscoveryCandidate(candidate, domainKeywords, discoveryFeedback = null, context = {}) {
  let score = 12;
  score += candidate.queryLabels.length * 8;
  score += (candidate.queryFamilies?.length ?? 0) * 4;
  score += discoveryStarScore(candidate.enrichment?.repo?.stars ?? 0);
  score += discoveryActivityScore(candidate.enrichment);
  score += Math.round((candidate.projectAlignment?.fitScore ?? 0) * 0.35);
  score += (candidate.projectAlignment?.matchedCapabilities?.length ?? 0) * 6;

  const evidenceProfile = buildCandidateEvidenceProfile(candidate, domainKeywords);
  candidate.discoveryEvidence = evidenceProfile;
  score += Math.round(evidenceProfile.score * 0.35);
  score += Math.round(computeProjectBindingScore(candidate, context.binding, context.discoveryPolicy) * 0.45);
  score += scoreLaneSpecificEvidence(candidate, evidenceProfile);
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
