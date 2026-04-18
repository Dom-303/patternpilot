import { classifyLicense } from "../classification/evaluation.mjs";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizePattern(value) {
  return String(value ?? "").trim().toLowerCase();
}

function matchesAnyPattern(value, patterns) {
  const source = normalizePattern(value);
  return patterns.some((pattern) => source.includes(pattern));
}

function getCandidateLicense(candidate) {
  return candidate?.enrichment?.repo?.license ?? candidate?.license ?? "";
}

function getCandidateLicenseCategory(candidate) {
  return classifyLicense(getCandidateLicense(candidate));
}

function getCandidateTopics(candidate) {
  return toArray(candidate?.enrichment?.repo?.topics ?? candidate?.topics).map((item) => String(item));
}

function getCandidateStars(candidate) {
  return Number(candidate?.enrichment?.repo?.stars ?? candidate?.stars ?? 0) || 0;
}

function getCandidateRepoRef(candidate) {
  if (candidate?.repo?.owner && candidate?.repo?.name) {
    return `${candidate.repo.owner}/${candidate.repo.name}`;
  }
  return candidate?.full_name ?? candidate?.repoRef ?? "";
}

function getCandidateFitScore(candidate) {
  return Number(candidate?.projectAlignment?.fitScore ?? candidate?.projectFitScore ?? 0) || 0;
}

function getCandidateDisposition(candidate) {
  return candidate?.discoveryDisposition ?? candidate?.reviewDisposition ?? "";
}

function getCandidatePatternFamily(candidate) {
  return candidate?.guess?.patternFamily ?? candidate?.patternFamily ?? "";
}

function getCandidateMainLayer(candidate) {
  return candidate?.guess?.mainLayer ?? candidate?.mainLayer ?? "";
}

function getCandidateGapArea(candidate) {
  return candidate?.gapAreaCanonical ?? candidate?.guess?.gapArea ?? candidate?.gapArea ?? "";
}

function getCandidateHomepage(candidate) {
  return candidate?.enrichment?.repo?.homepage ?? candidate?.repo?.homepage ?? candidate?.homepage ?? "";
}

function getCandidateDescription(candidate) {
  return candidate?.enrichment?.repo?.description ?? candidate?.repo?.description ?? candidate?.description ?? "";
}

function getCandidateReadmeExcerpt(candidate) {
  return candidate?.enrichment?.readme?.excerpt ?? candidate?.readme?.excerpt ?? "";
}

function getCandidateRisks(candidate) {
  return toArray(candidate?.risks).map((item) => String(item));
}

function getCandidateCapabilities(candidate) {
  return toArray(candidate?.projectAlignment?.matchedCapabilities ?? candidate?.matchedCapabilities).map((item) => String(item));
}

function getCandidateHomepageHost(candidate) {
  const raw = getCandidateHomepage(candidate);
  if (!raw) {
    return "";
  }

  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function buildCandidatePolicyText(candidate) {
  return [
    getCandidateRepoRef(candidate),
    getCandidateDescription(candidate),
    getCandidateHomepage(candidate),
    getCandidateReadmeExcerpt(candidate),
    ...getCandidateTopics(candidate)
  ]
    .filter(Boolean)
    .join(" ");
}

export function defaultDiscoveryPolicy(projectKey = "project") {
  return {
    projectKey,
    blockedOwners: [],
    blockedRepoPatterns: [],
    blockedTopics: [],
    blockedPatternFamilies: [],
    blockedMainLayers: [],
    blockedGapAreas: [],
    blockedLicenseCategories: [],
    blockedLicenses: [],
    blockedHomepageHosts: [],
    blockedSignalPatterns: [],
    blockedRiskFlags: [],
    minStars: 0,
    minProjectFitScore: 0,
    allowDispositions: ["intake_now", "review_queue"],
    allowGapAreas: [],
    allowCapabilitiesAny: [],
    preferredPatternFamilies: [],
    preferredMainLayers: [],
    preferredTopics: [],
    preferredGapAreas: [],
    preferredCapabilities: []
  };
}

export function validateDiscoveryPolicyShape(policy = {}) {
  const errors = [];
  const arrayKeys = [
    "blockedOwners",
    "blockedRepoPatterns",
    "blockedTopics",
    "blockedPatternFamilies",
    "blockedMainLayers",
    "blockedGapAreas",
    "blockedLicenseCategories",
    "blockedLicenses",
    "blockedHomepageHosts",
    "blockedSignalPatterns",
    "blockedRiskFlags",
    "allowDispositions",
    "allowGapAreas",
    "allowCapabilitiesAny",
    "preferredPatternFamilies",
    "preferredMainLayers",
    "preferredTopics",
    "preferredGapAreas",
    "preferredCapabilities"
  ];

  for (const key of arrayKeys) {
    if (policy[key] != null && !Array.isArray(policy[key])) {
      errors.push(`${key} must be an array`);
    }
  }

  for (const key of ["minStars", "minProjectFitScore"]) {
    if (policy[key] != null && !Number.isFinite(Number(policy[key]))) {
      errors.push(`${key} must be numeric`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function summarizeDiscoveryPolicyResults(results = []) {
  const blockerCounts = new Map();
  const preferenceCounts = new Map();
  let allowed = 0;
  let blocked = 0;
  let preferred = 0;

  for (const result of results) {
    if (result?.allowed) {
      allowed += 1;
    } else {
      blocked += 1;
    }
    if ((result?.preferenceHits?.length ?? 0) > 0) {
      preferred += 1;
    }
    for (const blocker of result?.blockers ?? []) {
      blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1);
    }
    for (const preference of result?.preferenceHits ?? []) {
      preferenceCounts.set(preference, (preferenceCounts.get(preference) ?? 0) + 1);
    }
  }

  const sortEntries = (map) =>
    [...map.entries()]
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .map(([value, count]) => ({ value, count }));

  return {
    evaluated: results.length,
    allowed,
    blocked,
    preferred,
    blockerCounts: sortEntries(blockerCounts),
    preferenceCounts: sortEntries(preferenceCounts)
  };
}

function blockerKind(value) {
  return String(value ?? "").split(":")[0];
}

const CALIBRATION_HINTS = {
  below_min_fit: "Project-fit threshold may be too aggressive or the discovery lenses are still too broad.",
  below_min_stars: "Star threshold may hide niche but useful repos; verify this against real project needs.",
  blocked_signal_pattern: "Signal-pattern blockers are firing often; inspect examples and split hard blockers from soft anti-pattern hints.",
  blocked_homepage_host: "Homepage-host blockers are firing; confirm these hosts should stay hard-blocked for this project.",
  blocked_license_category: "License-category blockers are active; check whether they belong in discovery or only later adoption review.",
  blocked_license: "Specific license blockers are active; verify whether SPDX-level blocking is worth the maintenance cost.",
  blocked_risk_flag: "Risk-flag blockers are firing; decide which risks should block discovery versus only annotate candidates.",
  blocked_topic: "Topic blockers are active; verify repository topics are reliable enough for hard filtering.",
  blocked_pattern_family: "Pattern-family blockers are active; confirm these families are truly out of scope.",
  blocked_main_layer: "Main-layer blockers are active; re-check whether these layers should be excluded or merely deprioritized.",
  blocked_gap_area: "Gap-area blockers are active; verify whether these project gaps should be excluded at discovery time.",
  capability_gate_not_matched: "Capability gating is hiding candidates; confirm the allowed capability list is not too narrow.",
  gap_area_not_allowed: "Allow-list gap gating is active; inspect whether the allowed gap set is too restrictive.",
  disposition_not_allowed: "Disposition gating is active; decide whether observe-only repos should stay visible in audit mode."
};

export function buildDiscoveryPolicyCalibration(summary = {}) {
  const evaluated = Number(summary.evaluated ?? 0) || 0;
  const blocked = Number(summary.blocked ?? 0) || 0;
  const preferred = Number(summary.preferred ?? 0) || 0;
  const enforcedBlocked = Number(summary.enforcedBlocked ?? 0) || 0;
  const blockedRatio = evaluated > 0 ? blocked / evaluated : 0;
  const preferredRatio = evaluated > 0 ? preferred / evaluated : 0;
  const topBlockers = toArray(summary.blockerCounts).slice(0, 3);
  const recommendations = [];

  if (!summary.enabled) {
    return {
      status: "policy_off",
      blockedRatio: 0,
      preferredRatio: 0,
      topBlockers: [],
      recommendations: ["No discovery policy is active for this run."]
    };
  }

  if (evaluated === 0) {
    return {
      status: "no_candidates",
      blockedRatio: 0,
      preferredRatio: 0,
      topBlockers: [],
      recommendations: ["No candidates were evaluated, so discovery policy calibration needs a real run with results."]
    };
  }

  if (summary.mode === "audit") {
    recommendations.push("Audit mode keeps flagged repos visible so blocker defaults can be calibrated before hiding candidates.");
  }

  if (blockedRatio >= 0.6) {
    recommendations.push(`Policy currently flags ${Math.round(blockedRatio * 100)}% of evaluated candidates; inspect top blocker reasons before turning more rules into hard gates.`);
  } else if (blockedRatio === 0) {
    recommendations.push("Policy flagged none of the evaluated candidates; it may still be too permissive for noisy discovery runs.");
  }

  if (preferredRatio === 0 && evaluated >= 5) {
    recommendations.push("No preference hits were recorded; derive preferred families, gaps or capabilities from the best real discovery hits.");
  }

  if (summary.mode === "enforce" && enforcedBlocked > 0) {
    recommendations.push(`Enforce mode hid ${enforcedBlocked} candidates; compare a matching audit run before cementing those blockers.`);
  }

  const hintedKinds = new Set();
  for (const blocker of topBlockers) {
    const kind = blockerKind(blocker.value);
    if (hintedKinds.has(kind)) {
      continue;
    }
    hintedKinds.add(kind);
    if (CALIBRATION_HINTS[kind]) {
      recommendations.push(CALIBRATION_HINTS[kind]);
    }
  }

  const status =
    blockedRatio >= 0.6 ? "strict_needs_review"
      : blockedRatio === 0 ? "permissive_needs_review"
        : "calibrating";

  return {
    status,
    blockedRatio,
    preferredRatio,
    topBlockers,
    recommendations: recommendations.slice(0, 6)
  };
}

export function evaluateDiscoveryCandidatePolicy(candidate, policy = {}) {
  const blockedOwners = toArray(policy.blockedOwners).map(normalizePattern);
  const blockedRepoPatterns = toArray(policy.blockedRepoPatterns).map(normalizePattern);
  const blockedTopics = toArray(policy.blockedTopics).map(normalizePattern);
  const blockedPatternFamilies = toArray(policy.blockedPatternFamilies).map(normalizePattern);
  const blockedMainLayers = toArray(policy.blockedMainLayers).map(normalizePattern);
  const blockedGapAreas = toArray(policy.blockedGapAreas).map(normalizePattern);
  const blockedLicenseCategories = toArray(policy.blockedLicenseCategories).map(normalizePattern);
  const blockedLicenses = toArray(policy.blockedLicenses).map(normalizePattern);
  const blockedHomepageHosts = toArray(policy.blockedHomepageHosts).map(normalizePattern);
  const blockedSignalPatterns = toArray(policy.blockedSignalPatterns).map(normalizePattern);
  const blockedRiskFlags = toArray(policy.blockedRiskFlags).map(normalizePattern);
  const allowedDispositions = toArray(policy.allowDispositions).map(normalizePattern);
  const allowedGapAreas = toArray(policy.allowGapAreas).map(normalizePattern);
  const allowedCapabilitiesAny = toArray(policy.allowCapabilitiesAny).map(normalizePattern);
  const preferredPatternFamilies = toArray(policy.preferredPatternFamilies).map(normalizePattern);
  const preferredMainLayers = toArray(policy.preferredMainLayers).map(normalizePattern);
  const preferredTopics = toArray(policy.preferredTopics).map(normalizePattern);
  const preferredGapAreas = toArray(policy.preferredGapAreas).map(normalizePattern);
  const preferredCapabilities = toArray(policy.preferredCapabilities).map(normalizePattern);

  const repoRef = getCandidateRepoRef(candidate);
  const owner = normalizePattern(candidate?.repo?.owner ?? repoRef.split("/")[0] ?? "");
  const repoPatternSource = `${repoRef} ${candidate?.repo?.normalizedRepoUrl ?? ""}`.trim();
  const policyText = normalizePattern(buildCandidatePolicyText(candidate));
  const topics = getCandidateTopics(candidate).map(normalizePattern);
  const patternFamily = normalizePattern(getCandidatePatternFamily(candidate));
  const mainLayer = normalizePattern(getCandidateMainLayer(candidate));
  const gapArea = normalizePattern(getCandidateGapArea(candidate));
  const disposition = normalizePattern(getCandidateDisposition(candidate));
  const license = normalizePattern(getCandidateLicense(candidate));
  const licenseCategory = normalizePattern(getCandidateLicenseCategory(candidate));
  const homepageHost = normalizePattern(getCandidateHomepageHost(candidate));
  const riskFlags = getCandidateRisks(candidate).map(normalizePattern);
  const capabilities = getCandidateCapabilities(candidate).map(normalizePattern);
  const stars = getCandidateStars(candidate);
  const fitScore = getCandidateFitScore(candidate);

  const blockers = [];
  if (blockedOwners.includes(owner)) {
    blockers.push(`blocked_owner:${owner}`);
  }
  if (blockedRepoPatterns.length > 0 && matchesAnyPattern(repoPatternSource, blockedRepoPatterns)) {
    blockers.push("blocked_repo_pattern");
  }
  if (blockedTopics.length > 0 && topics.some((topic) => blockedTopics.includes(topic))) {
    blockers.push("blocked_topic");
  }
  if (blockedPatternFamilies.includes(patternFamily)) {
    blockers.push(`blocked_pattern_family:${patternFamily}`);
  }
  if (blockedMainLayers.includes(mainLayer)) {
    blockers.push(`blocked_main_layer:${mainLayer}`);
  }
  if (blockedGapAreas.includes(gapArea)) {
    blockers.push(`blocked_gap_area:${gapArea}`);
  }
  if (blockedLicenseCategories.includes(licenseCategory)) {
    blockers.push(`blocked_license_category:${licenseCategory}`);
  }
  if (blockedLicenses.includes(license)) {
    blockers.push(`blocked_license:${license}`);
  }
  if (blockedHomepageHosts.length > 0 && blockedHomepageHosts.some((host) => homepageHost.includes(host))) {
    blockers.push(`blocked_homepage_host:${homepageHost || "unknown"}`);
  }
  if (blockedSignalPatterns.length > 0 && matchesAnyPattern(policyText, blockedSignalPatterns)) {
    blockers.push("blocked_signal_pattern");
  }
  if (blockedRiskFlags.length > 0 && riskFlags.some((risk) => blockedRiskFlags.includes(risk))) {
    blockers.push("blocked_risk_flag");
  }

  const minStars = Number(policy.minStars ?? 0) || 0;
  if (stars < minStars) {
    blockers.push(`below_min_stars:${stars}<${minStars}`);
  }

  const minProjectFitScore = Number(policy.minProjectFitScore ?? 0) || 0;
  if (fitScore < minProjectFitScore) {
    blockers.push(`below_min_fit:${fitScore}<${minProjectFitScore}`);
  }

  if (allowedDispositions.length > 0 && !allowedDispositions.includes(disposition)) {
    blockers.push(`disposition_not_allowed:${disposition || "unknown"}`);
  }
  if (allowedGapAreas.length > 0 && !allowedGapAreas.includes(gapArea)) {
    blockers.push(`gap_area_not_allowed:${gapArea || "unknown"}`);
  }
  if (allowedCapabilitiesAny.length > 0 && !capabilities.some((capability) => allowedCapabilitiesAny.includes(capability))) {
    blockers.push("capability_gate_not_matched");
  }

  const preferenceHits = [];
  if (preferredPatternFamilies.includes(patternFamily)) {
    preferenceHits.push(`preferred_pattern_family:${patternFamily}`);
  }
  if (preferredMainLayers.includes(mainLayer)) {
    preferenceHits.push(`preferred_main_layer:${mainLayer}`);
  }
  if (topics.some((topic) => preferredTopics.includes(topic))) {
    preferenceHits.push("preferred_topic");
  }
  if (preferredGapAreas.includes(gapArea)) {
    preferenceHits.push(`preferred_gap_area:${gapArea}`);
  }
  if (capabilities.some((capability) => preferredCapabilities.includes(capability))) {
    preferenceHits.push("preferred_capability");
  }

  return {
    allowed: blockers.length === 0,
    blockers,
    preferenceHits,
    summary: blockers.length === 0
      ? preferenceHits.length > 0
        ? `allowed_with_preferences:${preferenceHits.join(",")}`
        : "allowed"
      : `blocked:${blockers.join(",")}`
  };
}
