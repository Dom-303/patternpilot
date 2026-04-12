import { resolveAnalysisProfile, resolveAnalysisDepth } from "./constants.mjs";
import { clamp, uniqueStrings } from "./utils.mjs";
import { loadWatchlistUrls } from "./discovery.mjs";
import { loadQueueEntries } from "./queue.mjs";

function parseCsvList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreWatchlistItemForProfile(item, analysisProfileId) {
  let score = Number(item.projectFitScore ?? 0);
  score += item.eventbaerRelevance === "high" ? 12 : item.eventbaerRelevance === "medium" ? 6 : 0;
  score += item.activityStatus === "current" ? 8 : item.activityStatus === "moderate" ? 4 : 0;

  if (analysisProfileId === "architecture") {
    score += item.mainLayer === "source_intake" || item.mainLayer === "parsing_extraction" ? 12 : 0;
    score += item.matchedCapabilities.length * 3;
  }
  if (analysisProfileId === "sources") {
    score += item.gapArea === "connector_families" || item.gapArea === "source_systems_and_families" ? 16 : 0;
    score += item.mainLayer === "access_fetch" || item.mainLayer === "source_intake" ? 10 : 0;
  }
  if (analysisProfileId === "distribution") {
    score += item.gapArea === "distribution_surfaces" || item.gapArea === "wordpress_plugin_distribution" ? 16 : 0;
    score += item.mainLayer === "export_feed_api" || item.mainLayer === "distribution_plugin" || item.mainLayer === "ui_discovery_surface" ? 10 : 0;
  }
  if (analysisProfileId === "risk") {
    score += item.risks.includes("source_lock_in") ? 14 : 0;
    score += item.risks.includes("maintenance_risk") ? 12 : 0;
    score += item.risks.includes("archived_repo") ? 16 : 0;
  }

  return clamp(score, 0, 100);
}

function summarizeFrequencyMap(entries, key, limit = 6) {
  const counts = new Map();
  for (const entry of entries) {
    const values = Array.isArray(entry[key]) ? entry[key] : [entry[key]];
    for (const value of values) {
      if (!value) {
        continue;
      }
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function buildWatchlistReviewReason(item, profile) {
  const reasons = [];
  if (item.projectFitBand) {
    reasons.push(`fit=${item.projectFitBand} (${item.projectFitScore})`);
  }
  if (item.matchedCapabilities.length > 0) {
    reasons.push(`capabilities=${item.matchedCapabilities.join(", ")}`);
  }
  if (profile.id === "risk" && item.risks.length > 0) {
    reasons.push(`risks=${item.risks.join(", ")}`);
  } else if (item.suggestedNextStep) {
    reasons.push(item.suggestedNextStep);
  }
  return reasons.join(" | ");
}

function buildCoverageGaps(alignmentRules, reviewedItems) {
  const coveredCapabilities = new Set(reviewedItems.flatMap((item) => item.matchedCapabilities));
  return (alignmentRules?.capabilities ?? [])
    .filter((capability) => !coveredCapabilities.has(capability.id))
    .map((capability) => capability.label ?? capability.id)
    .slice(0, 6);
}

function buildWatchlistNextSteps(profile, topItems, coverageGaps, missingUrls) {
  const nextSteps = [];
  if (topItems.length > 0) {
    nextSteps.push(`Promote the top ${Math.min(topItems.length, 3)} candidates into focused manual review.`);
  }
  if (profile.id === "architecture") {
    nextSteps.push("Compare the strongest repos against worker areas before adopting any pattern.");
  }
  if (profile.id === "sources") {
    nextSteps.push("Use the review to sharpen connector-family and source-system conventions.");
  }
  if (profile.id === "distribution") {
    nextSteps.push("Keep distribution surfaces separate from the worker truth core during review.");
  }
  if (profile.id === "risk") {
    nextSteps.push("Flag lock-in and maintenance-heavy repos as pattern signals, not direct dependencies.");
  }
  if (coverageGaps.length > 0) {
    nextSteps.push(`Discovery can be widened for uncovered areas: ${coverageGaps.join(", ")}.`);
  }
  if (missingUrls.length > 0) {
    nextSteps.push(`Run sync-watchlist so all ${missingUrls.length} missing watchlist repos get intake dossiers.`);
  }
  return uniqueStrings(nextSteps).slice(0, 6);
}

export function buildWatchlistReviewReport(review) {
  const coverageLines = review.coverage.mainLayers.length > 0
    ? review.coverage.mainLayers.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const gapLines = review.coverage.gapAreas.length > 0
    ? review.coverage.gapAreas.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const capabilityLines = review.coverage.capabilities.length > 0
    ? review.coverage.capabilities.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const missingLines = review.missingUrls.length > 0
    ? review.missingUrls.map((url) => `- ${url}`).join("\n")
    : "- none";
  const topLines = review.topItems.length > 0
    ? review.topItems.map((item) => `- ${item.repoRef} (${item.reviewScore}) :: ${item.reason}`).join("\n")
    : "- none";
  const riskLines = review.riskiestItems.length > 0
    ? review.riskiestItems.map((item) => `- ${item.repoRef}: ${item.risks.join(", ") || "needs_review"}`).join("\n")
    : "- none";
  const strongerLines = review.strongestPatterns.length > 0
    ? review.strongestPatterns.map((item) => `- ${item.repoRef}: ${item.possibleImplication || item.learningForEventbaer}`).join("\n")
    : "- none";
  const gapCoverageLines = review.coverage.uncoveredCapabilities.length > 0
    ? review.coverage.uncoveredCapabilities.map((item) => `- ${item}`).join("\n")
    : "- none";
  const nextStepLines = review.nextSteps.length > 0
    ? review.nextSteps.map((item) => `- ${item}`).join("\n")
    : "- none";
  const matrixLines = review.analysisDepth.includeRepoMatrix && review.items.length > 0
    ? review.items.map((item) => `- ${item.repoRef} :: layer=${item.mainLayer || "-"} :: gap=${item.gapArea || "-"} :: fit=${item.projectFitBand || "-"} (${item.projectFitScore}) :: relevance=${item.eventbaerRelevance || "-"}`).join("\n")
    : "- omitted for this depth";

  return `# Patternpilot Watchlist Review

- project: ${review.projectKey}
- created_at: ${review.createdAt}
- analysis_profile: ${review.analysisProfile.id}
- analysis_profile_label: ${review.analysisProfile.label}
- analysis_depth: ${review.analysisDepth.id}
- watchlist_urls: ${review.watchlistCount}
- reviewed_items: ${review.items.length}
- missing_from_queue: ${review.missingUrls.length}

## Focus

- ${review.analysisProfile.summary}

## Main Layer Coverage

${coverageLines}

## Gap Area Coverage

${gapLines}

## Capability Coverage

${capabilityLines}

## Uncovered Capability Areas

${gapCoverageLines}

## Strongest Patterns Right Now

${strongerLines}

## Top Items For This Review Mode

${topLines}

## Highest Risk Signals

${riskLines}

## Missing Watchlist Intake

${missingLines}

## Repo Matrix

${matrixLines}

## Next Steps

${nextStepLines}
`;
}

export async function buildWatchlistReview(rootDir, config, project, binding, alignmentRules, projectProfile, options = {}) {
  const analysisProfile = resolveAnalysisProfile(options.analysisProfile);
  const analysisDepth = resolveAnalysisDepth(options.analysisDepth);
  const watchlistUrls = await loadWatchlistUrls(rootDir, project);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === binding.projectKey);
  const queueByUrl = new Map(
    queueRows.map((row) => [row.normalized_repo_url || row.repo_url, row])
  );
  const items = [];
  const missingUrls = [];

  for (const url of watchlistUrls) {
    const row = queueByUrl.get(url);
    if (!row) {
      missingUrls.push(url);
      continue;
    }
    const item = {
      repoRef: `${row.owner}/${row.name}`,
      repoUrl: row.normalized_repo_url || row.repo_url,
      status: row.status,
      projectFitBand: row.project_fit_band || "unknown",
      projectFitScore: Number(row.project_fit_score || 0),
      matchedCapabilities: parseCsvList(row.matched_capabilities),
      recommendedWorkerAreas: parseCsvList(row.recommended_worker_areas),
      gapArea: row.eventbaer_gap_area_guess || "",
      mainLayer: row.main_layer_guess || "",
      patternFamily: row.pattern_family_guess || "",
      buildVsBorrow: row.build_vs_borrow_guess || "",
      priority: row.priority_guess || "",
      activityStatus: row.activity_status || "",
      eventbaerRelevance: row.eventbaer_relevance_guess || "",
      strengths: row.strengths || "",
      weaknesses: row.weaknesses || "",
      risks: parseCsvList(row.risks),
      learningForEventbaer: row.learning_for_eventbaer || "",
      possibleImplication: row.possible_implication || "",
      suggestedNextStep: row.suggested_next_step || "",
      stars: Number(row.stars || 0)
    };
    item.reviewScore = scoreWatchlistItemForProfile(item, analysisProfile.id);
    item.reason = buildWatchlistReviewReason(item, analysisProfile);
    items.push(item);
  }

  items.sort((left, right) => right.reviewScore - left.reviewScore);
  const topItems = items.slice(0, analysisDepth.topItems);
  const strongestPatterns = items
    .filter((item) => item.projectFitBand === "high" || item.projectFitScore >= 60)
    .slice(0, Math.min(analysisDepth.topItems, 8));
  const riskiestItems = [...items]
    .filter((item) => item.risks.length > 0 || item.activityStatus === "stale")
    .sort((left, right) => right.risks.length - left.risks.length || right.reviewScore - left.reviewScore)
    .slice(0, Math.min(analysisDepth.topItems, 8));
  const coverage = {
    mainLayers: summarizeFrequencyMap(items, "mainLayer"),
    gapAreas: summarizeFrequencyMap(items, "gapArea"),
    capabilities: summarizeFrequencyMap(items, "matchedCapabilities"),
    workerAreas: summarizeFrequencyMap(items, "recommendedWorkerAreas"),
    uncoveredCapabilities: buildCoverageGaps(alignmentRules, items)
  };
  const nextSteps = buildWatchlistNextSteps(
    analysisProfile,
    topItems,
    coverage.uncoveredCapabilities,
    missingUrls
  );

  return {
    createdAt: new Date().toISOString(),
    projectKey: binding.projectKey,
    projectLabel: binding.projectLabel ?? binding.projectKey,
    binding,
    projectProfile,
    analysisProfile,
    analysisDepth,
    watchlistCount: watchlistUrls.length,
    items,
    topItems,
    strongestPatterns,
    riskiestItems,
    missingUrls,
    coverage,
    nextSteps,
    projectProfileSummary: {
      capabilitiesPresent: projectProfile?.capabilitiesPresent ?? []
    }
  };
}
