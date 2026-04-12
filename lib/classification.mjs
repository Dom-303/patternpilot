import {
  CATEGORY_RULES,
  PATTERN_RULES,
  MAIN_LAYER_RULES,
  GAP_RULES,
  BUILD_RULES,
  PRIORITY_RULES
} from "./constants.mjs";
import {
  uniqueStrings,
  clamp,
  hasSignal,
  calculateDaysSince,
  isoDate
} from "./utils.mjs";

function matchValue(rules, text, fallback) {
  for (const rule of rules) {
    if (rule.match.test(text)) {
      return rule.value;
    }
  }
  return fallback;
}

export function buildClassificationText(repo, enrichment) {
  const repoData = enrichment?.repo ?? {};
  const topics = Array.isArray(repoData.topics) ? repoData.topics.join(" ") : "";
  const readmeText = enrichment?.readme?.excerpt ?? "";
  const description = repoData.description ?? "";
  const languageText = Array.isArray(enrichment?.languages) ? enrichment.languages.join(" ") : "";
  return [
    repo.owner,
    repo.name,
    repo.normalizedRepoUrl,
    description,
    topics,
    readmeText,
    languageText
  ]
    .filter(Boolean)
    .join(" ");
}

export function guessClassification(repo, enrichment = null) {
  const text = buildClassificationText(repo, enrichment);
  const category = matchValue(CATEGORY_RULES, text, "research_signal");
  const patternFamily = matchValue(PATTERN_RULES, text, "research_signal");
  const mainLayer = matchValue(MAIN_LAYER_RULES, text, "research_signal");
  const gapArea = matchValue(GAP_RULES, text, "risk_and_dependency_awareness");
  const buildVsBorrow = matchValue(BUILD_RULES, text, "observe_only");
  const priority = matchValue(PRIORITY_RULES, text, "soon");

  return {
    category,
    patternFamily,
    mainLayer,
    gapArea,
    buildVsBorrow,
    priority
  };
}

export function buildProjectRelevanceNote(projectBinding, guess) {
  const projectLabel = projectBinding.projectLabel ?? projectBinding.projectKey;
  return [
    `Likely relevant for ${projectLabel} because it may inform '${guess.gapArea}'`,
    `and the worker/project layer '${guess.mainLayer}'.`
  ].join(" ");
}

function repoMatchesCapability(repoText, projectProfile, capability) {
  const signals = capability.signals ?? [];
  if (signals.length === 0) {
    return false;
  }

  const repoHit = signals.some((signal) => hasSignal(repoText, signal));
  const projectHit =
    projectProfile.capabilitiesPresent?.includes(capability.id) ||
    signals.some((signal) => hasSignal(projectProfile.corpus ?? "", signal));

  return repoHit && projectHit;
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

export function deriveActivityStatus(enrichment) {
  if (enrichment?.status !== "success") {
    return "unknown";
  }
  if (enrichment.repo.archived) {
    return "archived";
  }
  const days = calculateDaysSince(enrichment.repo.pushedAt);
  if (days === null) {
    return "unknown";
  }
  if (days <= 90) {
    return "current";
  }
  if (days <= 365) {
    return "moderate";
  }
  return "stale";
}

function deriveMaturity(enrichment) {
  if (enrichment?.status !== "success") {
    return "needs_review";
  }
  if (enrichment.repo.archived) {
    return "archived";
  }
  if (enrichment.repo.stars >= 500 && deriveActivityStatus(enrichment) === "current") {
    return "infra_grade";
  }
  if (enrichment.repo.stars >= 50) {
    return "solid";
  }
  return "narrow_but_useful";
}

function deriveSourceFocus(text) {
  if (/(place|maps|geo|venue|location|business)/i.test(text)) {
    return "places";
  }
  if (/(event|calendar|meetup|festival|show|gig)/i.test(text)) {
    return "events";
  }
  return "mixed_or_unclear";
}

function deriveGeographicModel(text) {
  if (/(city|local|regional|munich|berlin|mcr)/i.test(text)) {
    return "regional";
  }
  if (/(facebook|meetup|resident advisor|google|maps|platform)/i.test(text)) {
    return "platform_bound";
  }
  return "global";
}

function deriveDataModel(text) {
  if (/(place|maps|geo|venue|location|business)/i.test(text)) {
    return "places_only";
  }
  if (/(event|calendar|meetup|festival|show|gig)/i.test(text)) {
    return "events_only";
  }
  return "mixed_entities";
}

function deriveDistributionType(text) {
  if (/(wordpress|wp-|plugin)/i.test(text)) {
    return "wordpress_plugin";
  }
  if (/(feed|ical|ics)/i.test(text)) {
    return "feed_export";
  }
  if (/(api|rest)/i.test(text)) {
    return "api";
  }
  if (/(frontend|site|website|discovery|web)/i.test(text)) {
    return "website";
  }
  return "none_visible";
}

function deriveSecondaryLayers(guess, enrichment) {
  const values = new Set();
  const text = buildClassificationText(
    {
      owner: "",
      name: "",
      normalizedRepoUrl: ""
    },
    enrichment
  );

  if (guess.mainLayer !== "parsing_extraction" && /(parse|extract|scrape|crawler)/i.test(text)) {
    values.add("parsing_extraction");
  }
  if (guess.mainLayer !== "export_feed_api" && /(feed|api|ical|ics|json)/i.test(text)) {
    values.add("export_feed_api");
  }
  if (guess.mainLayer !== "ui_discovery_surface" && /(frontend|site|website|discovery|web)/i.test(text)) {
    values.add("ui_discovery_surface");
  }
  if (guess.mainLayer !== "location_place_enrichment" && /(place|maps|geo|venue|location)/i.test(text)) {
    values.add("location_place_enrichment");
  }

  return [...values].join(",");
}

function deriveEventbaerRelevance(guess, enrichment) {
  if (guess.priority === "now") {
    return "high";
  }
  if (enrichment?.status === "success" && enrichment.repo.stars >= 100) {
    return "high";
  }
  if (guess.priority === "soon") {
    return "medium";
  }
  return "low";
}

function deriveDecision(guess) {
  if (guess.buildVsBorrow === "adapt_pattern") {
    return "adapt";
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    return "observe";
  }
  if (guess.buildVsBorrow === "observe_only") {
    return "observe";
  }
  if (guess.buildVsBorrow === "build_core") {
    return "adopt";
  }
  return "ignore";
}

function buildStrengths(guess, enrichment) {
  if (enrichment?.status !== "success") {
    return "Needs review with remote metadata unavailable";
  }
  const bits = [];
  if (enrichment.repo.description) {
    bits.push(enrichment.repo.description);
  }
  if (enrichment.repo.topics.length > 0) {
    bits.push(`Topics: ${enrichment.repo.topics.slice(0, 5).join(", ")}`);
  }
  if (enrichment.languages.length > 0) {
    bits.push(`Languages: ${enrichment.languages.slice(0, 3).join(", ")}`);
  }
  if (guess.priority === "now") {
    bits.push("Likely decision-relevant for EventBaer soon");
  }
  return bits.join(" | ") || "Visible public repo with enough surface for review";
}

function buildWeaknesses(guess, enrichment) {
  if (enrichment?.status !== "success") {
    return "Remote enrichment failed, so repo context is still shallow";
  }
  const bits = [];
  if (guess.category === "connector") {
    bits.push("Potentially narrow platform scope");
  }
  if (guess.category === "plugin") {
    bits.push("Distribution-heavy but likely not a truth core");
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    bits.push("Repo activity looks stale");
  }
  if (enrichment.repo.archived) {
    bits.push("Repository is archived");
  }
  return bits.join(" | ") || "Needs deeper repo reading to confirm system depth";
}

function buildRisks(guess, enrichment) {
  const bits = [];
  const text = buildClassificationText(
    {
      owner: "",
      name: "",
      normalizedRepoUrl: ""
    },
    enrichment
  );
  if (guess.category === "connector" || /(facebook|meetup|maps|resident advisor)/i.test(text)) {
    bits.push("source_lock_in");
  }
  if (/(scraper|crawler|browser)/i.test(text)) {
    bits.push("brittle_platform_changes");
  }
  if (enrichment?.status === "success" && enrichment.repo.archived) {
    bits.push("archived_repo");
  }
  if (deriveActivityStatus(enrichment) === "stale") {
    bits.push("maintenance_risk");
  }
  return bits.join(",") || "needs_review";
}

function buildLearningForEventbaer(guess) {
  if (guess.gapArea === "distribution_surfaces" || guess.gapArea === "wordpress_plugin_distribution") {
    return "Distribution should be treated as a separate leverage layer on top of the worker core.";
  }
  if (guess.gapArea === "location_and_gastro_intelligence") {
    return "Location and venue intelligence deserve their own deliberate layer next to event truth.";
  }
  if (guess.gapArea === "source_systems_and_families") {
    return "Source infrastructure should be built as reusable families instead of isolated one-off connectors.";
  }
  return "This repo should be read as a pattern signal for EventBaer rather than copied as-is.";
}

function buildPossibleImplication(guess) {
  if (guess.buildVsBorrow === "adapt_pattern") {
    return "Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.";
  }
  if (guess.buildVsBorrow === "borrow_optional") {
    return "Treat as optional supporting layer, not as system core.";
  }
  if (guess.buildVsBorrow === "build_core") {
    return "Check whether EventBaer should own this capability directly in its core.";
  }
  return "Keep on review watchlist until there is a sharper project need.";
}

export function buildProjectAlignment(repo, guess, enrichment, projectProfile, alignmentRules) {
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
  const matchedCapabilities = (alignmentRules.capabilities ?? [])
    .filter((capability) => repoMatchesCapability(repoText, projectProfile, capability))
    .map((capability) => capability.id);

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
  if (tensions.length > 0) {
    score -= 6;
  }
  score = clamp(score, 0, 100);

  const rationale = uniqueStrings([
    `Primary layer '${guess.mainLayer}' maps into EventBaer worker areas: ${(layerMapping.worker_areas ?? []).join(", ") || "none"}.`,
    `Gap area '${guess.gapArea}' suggests: ${gapMapping.suggested_next_step ?? "no explicit project next step yet"}.`,
    matchedCapabilities.length > 0
      ? `Matched project capabilities: ${matchedCapabilities.join(", ")}.`
      : "No strong capability match was found yet; review manually.",
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

export function buildLandkarteCandidate(repo, guess, enrichment) {
  const classificationText = buildClassificationText(repo, enrichment);
  return {
    name: repo.name,
    repo_url: repo.normalizedRepoUrl,
    owner: repo.owner,
    category: guess.category,
    pattern_family: guess.patternFamily,
    main_layer: guess.mainLayer,
    secondary_layers: deriveSecondaryLayers(guess, enrichment),
    source_focus: deriveSourceFocus(classificationText),
    geographic_model: deriveGeographicModel(classificationText),
    data_model: deriveDataModel(classificationText),
    distribution_type: deriveDistributionType(classificationText),
    stars: String(enrichment?.repo?.stars ?? ""),
    activity_status: deriveActivityStatus(enrichment),
    last_checked_at: isoDate(enrichment?.fetchedAt ?? new Date().toISOString()),
    maturity: deriveMaturity(enrichment),
    strengths: buildStrengths(guess, enrichment),
    weaknesses: buildWeaknesses(guess, enrichment),
    risks: buildRisks(guess, enrichment),
    learning_for_eventbaer: buildLearningForEventbaer(guess),
    possible_implication: buildPossibleImplication(guess),
    eventbaer_gap_area: guess.gapArea,
    build_vs_borrow: guess.buildVsBorrow,
    priority_for_review: guess.priority,
    eventbaer_relevance: deriveEventbaerRelevance(guess, enrichment),
    decision: deriveDecision(guess),
    notes: `stage2_candidate:${enrichment?.status ?? "unknown"}`
  };
}
