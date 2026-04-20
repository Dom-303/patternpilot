import {
  uniqueStrings,
  clamp,
  hasSignal
} from "../utils.mjs";
import {
  buildClassificationText,
  deriveActivityStatus
} from "./core.mjs";

const ALIGNMENT_SIGNAL_GROUPS = {
  sourceFamilies: [
    "source",
    "scrape",
    "scraper",
    "crawler",
    "connector",
    "adapter",
    "feed",
    "extract",
    "parser"
  ],
  publicEventIntake: [
    "open data",
    "public event",
    "public calendar",
    "municipal",
    "civic",
    "community",
    "government",
    "community calendar",
    "city council"
  ],
  governance: [
    "review",
    "validation",
    "governance",
    "audit",
    "policy",
    "dedupe",
    "contract"
  ],
  normalization: [
    "normalize",
    "schema",
    "entity",
    "taxonomy",
    "masterlist",
    "csv",
    "xlsx"
  ],
  nicheVerticals: [
    "climbing",
    "competition",
    "stadium",
    "arena",
    "ufc",
    "timetable",
    "course",
    "church",
    "forex",
    "investing.com"
  ]
};

function countSignalHits(text, signals = []) {
  return signals.reduce((total, signal) => total + (hasSignal(text, signal) ? 1 : 0), 0);
}

function repoMatchesCapability(repoText, projectProfile, capability) {
  const signals = capability.signals ?? [];
  if (signals.length === 0) {
    return {
      matched: false,
      repoHitCount: 0,
      projectHitCount: 0
    };
  }

  const repoHitCount = countSignalHits(repoText, signals);
  const projectHitCount = countSignalHits(projectProfile.corpus ?? "", signals);
  const capabilitiesPresent = projectProfile.capabilitiesPresent ?? [];
  const minimumHits = capability.min_signal_hits ?? (signals.length >= 6 ? 2 : 1);
  const projectHit =
    capabilitiesPresent.includes(capability.id) ||
    projectHitCount >= 1 ||
    capabilitiesPresent.length === 0;

  return {
    matched: repoHitCount >= minimumHits && projectHit,
    repoHitCount,
    projectHitCount
  };
}

function fitBand(score) {
  if (score >= 65) {
    return "high";
  }
  if (score >= 40) {
    return "medium";
  }
  return "low";
}

export function buildProjectAlignment(repo, guess, enrichment, projectProfile, alignmentRules, projectLabel = "the target project") {
  if (!alignmentRules || !projectProfile) {
    return {
      status: "unavailable",
      fitBand: "unknown",
      fitScore: 0,
      matchedCapabilities: [],
      recommendedWorkerAreas: [],
      reviewDocs: [],
      tensions: [],
      suggestedNextStep: "Add project alignment rules to enable Stage-3 analysis.",
      rationale: []
    };
  }

  const repoText = buildClassificationText(repo, enrichment);
  const layerMapping = alignmentRules.layerMappings?.[guess.mainLayer] ?? {};
  const gapMapping = alignmentRules.gapMappings?.[guess.gapArea] ?? {};
  const capabilityMatches = (alignmentRules.capabilities ?? []).map((capability) => ({
    capability,
    ...repoMatchesCapability(repoText, projectProfile, capability)
  }));
  const matchedCapabilities = capabilityMatches
    .filter((item) => item.matched)
    .map((item) => item.capability.id);
  const capabilityStrength = capabilityMatches
    .filter((item) => item.matched)
    .reduce((total, item) => total + Math.min(item.repoHitCount, 3), 0);
  const sourceFamilyHits = countSignalHits(repoText, ALIGNMENT_SIGNAL_GROUPS.sourceFamilies);
  const publicEventIntakeHits = countSignalHits(repoText, ALIGNMENT_SIGNAL_GROUPS.publicEventIntake);
  const governanceHits = countSignalHits(repoText, ALIGNMENT_SIGNAL_GROUPS.governance);
  const normalizationHits = countSignalHits(repoText, ALIGNMENT_SIGNAL_GROUPS.normalization);
  const nicheVerticalHits = countSignalHits(repoText, ALIGNMENT_SIGNAL_GROUPS.nicheVerticals);
  const hasLocationSignal = hasSignal(repoText, "location") || hasSignal(repoText, "venue") || hasSignal(repoText, "place");
  const hasEventSignal = hasSignal(repoText, "event") || hasSignal(repoText, "calendar");

  const reviewDocs = uniqueStrings([
    ...(layerMapping.review_docs ?? []),
    ...matchedCapabilities.flatMap((capabilityId) => {
      const capability = (alignmentRules.capabilities ?? []).find((item) => item.id === capabilityId);
      return capability?.review_docs ?? [];
    })
  ]);

  const tensions = uniqueStrings([
    alignmentRules.patternTensions?.[guess.patternFamily] ?? "",
    guess.mainLayer === "distribution_plugin" || guess.mainLayer === "ui_discovery_surface"
      ? "This pattern sits closer to distribution than to worker-core truth logic."
      : "",
    enrichment?.status === "success" && enrichment.repo.archived ? "Archived repositories should be treated as pattern signals, not dependencies." : ""
  ]);

  let score = 8;
  score += layerMapping.fit_bias ?? 0;
  score += gapMapping.fit_bias ?? 0;
  score += matchedCapabilities.length * 7;
  score += capabilityStrength * 2;
  if (guess.buildVsBorrow === "adapt_pattern") {
    score += 8;
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    score += 3;
  }
  if (guess.priority === "now") {
    score += 8;
  }
  if (enrichment?.status === "success" && enrichment.repo.stars >= 100) {
    score += 5;
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    score -= 8;
  }
  if (sourceFamilyHits >= 2) {
    score += 8;
  }
  if (publicEventIntakeHits >= 1) {
    score += 5;
  }
  if (governanceHits >= 1) {
    score += 6;
  }
  if (normalizationHits >= 1) {
    score += 6;
  }
  if (guess.mainLayer === "location_place_enrichment" && hasLocationSignal && hasEventSignal) {
    score += 6;
  }
  if (nicheVerticalHits > 0 && governanceHits === 0 && normalizationHits < 3) {
    score -= 20;
  }
  if (tensions.length > 0) {
    score -= 6;
  }
  score = clamp(score, 0, 100);

  const rationale = uniqueStrings([
    `Primary layer '${guess.mainLayer}' maps into ${projectLabel} work areas: ${(layerMapping.worker_areas ?? []).join(", ") || "none"}.`,
    `Gap area '${guess.gapArea}' suggests: ${gapMapping.suggested_next_step ?? "no explicit project next step yet"}.`,
    matchedCapabilities.length > 0
      ? `Matched project capabilities: ${matchedCapabilities.join(", ")}.`
      : "No strong capability match was found yet; review manually.",
    sourceFamilyHits >= 2 ? "Shows reusable source-family or adapter signals." : "",
    publicEventIntakeHits >= 1 ? "Looks closer to open/public event intake than to a private one-off surface." : "",
    governanceHits >= 1 ? "Contains visible review, validation or governance cues." : "",
    normalizationHits >= 1 ? "Contains visible normalization or schema cues." : "",
    nicheVerticalHits > 0 && governanceHits === 0 && normalizationHits < 3
      ? "Appears domain-narrow without enough reusable intake/governance depth."
      : "",
    tensions.length > 0 ? `Main tension: ${tensions.join(" | ")}` : ""
  ]);

  return {
    status: "ready",
    fitBand: fitBand(score),
    fitScore: score,
    matchedCapabilities,
    recommendedWorkerAreas: uniqueStrings(layerMapping.worker_areas ?? []),
    reviewDocs,
    tensions,
    suggestedNextStep:
      gapMapping.suggested_next_step ??
      layerMapping.next_step ??
      "Review the repo manually against the target project before promoting it.",
    rationale
  };
}
