import { resolveAnalysisProfile, resolveAnalysisDepth } from "./constants.mjs";
import { clamp, uniqueStrings } from "./utils.mjs";
import { loadWatchlistUrls } from "./discovery/shared.mjs";
import { loadQueueEntries, normalizeGithubUrl } from "./queue.mjs";
import {
  deriveDisposition,
  buildRunConfidence,
  computeRulesFingerprint,
  normalizeGapAreaCanonical,
  buildRunGapSignals
} from "./classification/evaluation.mjs";

function parseCsvList(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreWatchlistItemForProfile(item, analysisProfileId) {
  let score = Number(item.projectFitScore ?? 0);
  score += item.projectRelevance === "high" ? 12 : item.projectRelevance === "medium" ? 6 : 0;
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

function buildWatchlistNextSteps(
  profile,
  topItems,
  coverageGaps,
  missingUrls,
  itemsDataStateSummary = {},
  reviewScope = "watchlist"
) {
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
  if (Number(itemsDataStateSummary.stale ?? 0) > 0) {
    nextSteps.push(`Run re-evaluate so ${itemsDataStateSummary.stale} stale items pick up the current rules fingerprint.`);
  }
  if (Number(itemsDataStateSummary.fallback ?? 0) > 0) {
    nextSteps.push(`Refresh ${itemsDataStateSummary.fallback} fallback items so review no longer relies on derived disposition only.`);
  }
  if (missingUrls.length > 0) {
    nextSteps.push(
      reviewScope === "selected_urls"
        ? `Run intake for all ${missingUrls.length} missing selected repos so they become reviewable.`
        : `Run sync-watchlist so all ${missingUrls.length} missing watchlist repos get intake dossiers.`
    );
  }
  return uniqueStrings(nextSteps).slice(0, 6);
}

export function classifyReviewItemState(row, alignmentRules, currentFingerprint) {
  const effortBand = row.effort_band || "unknown";
  const effortScore = Number(row.effort_score || 0);
  const valueBand = row.value_band || "unknown";
  const valueScore = Number(row.value_score || 0);
  const rulesFingerprint = row.rules_fingerprint || null;
  const projectFitBand = row.project_fit_band || "unknown";
  const risks = parseCsvList(row.risks);
  let reviewDisposition = row.review_disposition || null;
  let dispositionReason = null;
  let usedFallback = false;

  if (!reviewDisposition) {
    const fallback = deriveDisposition({ effortBand, valueBand }, risks, projectFitBand);
    reviewDisposition = fallback.disposition;
    dispositionReason = fallback.dispositionReason;
    usedFallback = true;
  }

  if (effortBand === "unknown" || valueBand === "unknown") {
    usedFallback = true;
  }

  let decisionDataState = "complete";
  if (usedFallback) {
    decisionDataState = "fallback";
  } else if (!rulesFingerprint || rulesFingerprint !== currentFingerprint) {
    decisionDataState = "stale";
  }

  return {
    effortBand,
    effortScore,
    valueBand,
    valueScore,
    reviewDisposition,
    rulesFingerprint,
    dispositionReason,
    decisionDataState
  };
}

export function buildReviewRunFields(items, alignmentRules) {
  const confidence = buildRunConfidence(items, alignmentRules?.capabilities?.length ?? 0);
  const itemsDataStateSummary = items.reduce(
    (acc, item) => {
      const state = item?.decisionDataState ?? "fallback";
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
    runGapSignals: buildRunGapSignals(items, alignmentRules)
  };
}

export function buildWatchlistReviewReport(review) {
  const missingSectionTitle = review.reviewScope === "selected_urls"
    ? "Missing Selected Intake"
    : "Missing Watchlist Intake";
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
    ? review.strongestPatterns.map((item) => `- ${item.repoRef}: ${item.possibleImplication || item.learningForProject}`).join("\n")
    : "- none";
  const gapCoverageLines = review.coverage.uncoveredCapabilities.length > 0
    ? review.coverage.uncoveredCapabilities.map((item) => `- ${item}`).join("\n")
    : "- none";
  const nextStepLines = review.nextSteps.length > 0
    ? review.nextSteps.map((item) => `- ${item}`).join("\n")
    : "- none";
  const matrixLines = review.analysisDepth.includeRepoMatrix && review.items.length > 0
    ? review.items.map((item) => `- ${item.repoRef} :: layer=${item.mainLayer || "-"} :: gap=${item.gapArea || "-"} :: fit=${item.projectFitBand || "-"} (${item.projectFitScore}) :: relevance=${item.projectRelevance || "-"}`).join("\n")
    : "- omitted for this depth";

  return `# Patternpilot Watchlist Review

- project: ${review.projectKey}
- created_at: ${review.createdAt}
- analysis_profile: ${review.analysisProfile.id}
- analysis_profile_label: ${review.analysisProfile.label}
- analysis_depth: ${review.analysisDepth.id}
- review_scope: ${review.reviewScope}
- input_urls: ${review.inputUrlCount}
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

## ${missingSectionTitle}

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
  const selectedUrls = uniqueStrings(
    (options.reviewUrls ?? [])
      .map((url) => {
        try {
          return normalizeGithubUrl(url).normalizedRepoUrl;
        } catch {
          return null;
        }
      })
      .filter(Boolean)
  );
  const inputUrls = selectedUrls.length > 0 ? selectedUrls : watchlistUrls;
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === binding.projectKey);
  const queueByUrl = new Map(
    queueRows.map((row) => [row.normalized_repo_url || row.repo_url, row])
  );
  const currentFingerprint = computeRulesFingerprint(alignmentRules);
  const items = [];
  const missingUrls = [];

  for (const url of inputUrls) {
    const row = queueByUrl.get(url);
    if (!row) {
      missingUrls.push(url);
      continue;
    }
    const stateFields = classifyReviewItemState(row, alignmentRules, currentFingerprint);
    const item = {
      repoRef: `${row.owner}/${row.name}`,
      full_name: `${row.owner}/${row.name}`,
      repoUrl: row.normalized_repo_url || row.repo_url,
      status: row.status,
      projectFitBand: row.project_fit_band || "unknown",
      projectFitScore: Number(row.project_fit_score || 0),
      matchedCapabilities: parseCsvList(row.matched_capabilities),
      recommendedWorkerAreas: parseCsvList(row.recommended_worker_areas),
      gapArea: row.project_gap_area_guess || row.eventbaer_gap_area_guess || "",
      gapAreaCanonical: normalizeGapAreaCanonical(row.project_gap_area_guess || row.eventbaer_gap_area_guess || "", alignmentRules),
      mainLayer: row.main_layer_guess || "",
      patternFamily: row.pattern_family_guess || "",
      buildVsBorrow: row.build_vs_borrow_guess || "",
      priority: row.priority_guess || "",
      activityStatus: row.activity_status || "",
      projectRelevance: row.project_relevance_guess || row.eventbaer_relevance_guess || "",
      strengths: row.strengths || "",
      weaknesses: row.weaknesses || "",
      risks: parseCsvList(row.risks),
      learningForProject: row.learning_for_project || row.learning_for_eventbaer || "",
      possibleImplication: row.possible_implication || "",
      suggestedNextStep: row.suggested_next_step || "",
      stars: Number(row.stars || 0),
      license: row.license || null,
      decisionSummary: row.decision_summary || "",
      ...stateFields
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
  const runFields = buildReviewRunFields(items, alignmentRules);
  const nextSteps = buildWatchlistNextSteps(
    analysisProfile,
    topItems,
    coverage.uncoveredCapabilities,
    missingUrls,
    runFields.itemsDataStateSummary,
    selectedUrls.length > 0 ? "selected_urls" : "watchlist"
  );

  const review = {
    createdAt: new Date().toISOString(),
    projectKey: binding.projectKey,
    projectLabel: binding.projectLabel ?? binding.projectKey,
    binding,
    projectProfile,
    analysisProfile,
    analysisDepth,
    reviewScope: selectedUrls.length > 0 ? "selected_urls" : "watchlist",
    selectedUrls,
    inputUrlCount: inputUrls.length,
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

  Object.assign(review, runFields);

  return review;
}
