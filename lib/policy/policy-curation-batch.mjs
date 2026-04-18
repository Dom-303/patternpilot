function normalizeRef(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeRepoUrl(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseTargetRefs(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function summarizeCounts(values = [], minCount = 2) {
  const counts = new Map();
  for (const value of values) {
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= minCount)
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([value, count]) => ({ value, count }));
}

function countOccurrences(text, needle) {
  if (!text || !needle) {
    return 0;
  }
  let count = 0;
  let index = 0;
  while (true) {
    index = text.indexOf(needle, index);
    if (index === -1) {
      return count;
    }
    count += 1;
    index += needle.length;
  }
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function compareRows(left, right) {
  if (right.curationScore !== left.curationScore) {
    return right.curationScore - left.curationScore;
  }
  return left.repoRef.localeCompare(right.repoRef);
}

function buildBatchKey(row) {
  return row.gapArea || row.patternFamily || row.mainLayer || "misc";
}

function buildPairOverlap(left, right) {
  const reasons = [];
  let score = 0;

  if (left.gapArea && left.gapArea === right.gapArea) {
    reasons.push(`gap_area:${left.gapArea}`);
    score += 3;
  }
  if (left.patternFamily && left.patternFamily === right.patternFamily) {
    reasons.push(`pattern_family:${left.patternFamily}`);
    score += 3;
  }
  if (left.mainLayer && left.mainLayer === right.mainLayer) {
    reasons.push(`main_layer:${left.mainLayer}`);
    score += 2;
  }

  const sharedCapabilities = left.capabilities.filter((value) => right.capabilities.includes(value));
  for (const capability of sharedCapabilities) {
    reasons.push(`capability:${capability}`);
    score += 1;
  }

  let severity = "low";
  if (score >= 6) {
    severity = "high";
  } else if (score >= 3) {
    severity = "medium";
  }

  return {
    score,
    severity,
    reasons: unique(reasons)
  };
}

function summarizeBatchRisk(rows) {
  if (rows.some((row) => row.conflictRisk === "high")) {
    return "high";
  }
  if (rows.some((row) => row.conflictRisk === "medium")) {
    return "medium";
  }
  return "low";
}

function buildBatchRationale(batch) {
  const parts = [];
  if (batch.batchKey !== "misc") {
    parts.push(`grouped around ${batch.batchKey}`);
  }
  if (batch.sharedPatternFamilies.length > 0) {
    parts.push(`shared pattern family ${batch.sharedPatternFamilies.map((item) => item.value).join(", ")}`);
  }
  if (batch.sharedGapAreas.length > 0) {
    parts.push(`shared gap area ${batch.sharedGapAreas.map((item) => item.value).join(", ")}`);
  }
  if (batch.sharedCapabilities.length > 0) {
    parts.push(`shared capability ${batch.sharedCapabilities.map((item) => item.value).join(", ")}`);
  }
  return parts.length > 0 ? parts.join("; ") : "mixed batch without a dominant shared signal";
}

function buildGovernancePlan(rows) {
  const applyRows = rows.filter((row) => !row.alreadyPromoted);
  const manualReviewCandidates = applyRows
    .filter((row) => row.manualReviewRequired)
    .sort(compareRows);
  const safeApplyCandidates = applyRows
    .filter((row) => !row.manualReviewRequired)
    .sort(compareRows);

  const grouped = new Map();
  for (const row of safeApplyCandidates) {
    const batchKey = row.batchKey;
    const bucket = grouped.get(batchKey) ?? [];
    bucket.push(row);
    grouped.set(batchKey, bucket);
  }

  const recommendedBatches = [...grouped.entries()]
    .map(([batchKey, batchRows]) => {
      const sharedPatternFamilies = summarizeCounts(batchRows.map((row) => row.patternFamily));
      const sharedGapAreas = summarizeCounts(batchRows.map((row) => row.gapArea));
      const sharedMainLayers = summarizeCounts(batchRows.map((row) => row.mainLayer));
      const sharedCapabilities = summarizeCounts(batchRows.flatMap((row) => row.capabilities));
      const risk = summarizeBatchRisk(batchRows);
      const batch = {
        batchKey,
        risk,
        candidateCount: batchRows.length,
        repoRefs: batchRows.map((row) => row.repoRef),
        rows: batchRows,
        sharedPatternFamilies,
        sharedGapAreas,
        sharedMainLayers,
        sharedCapabilities
      };
      return {
        ...batch,
        rationale: buildBatchRationale(batch)
      };
    })
    .sort((left, right) => {
      if (right.candidateCount !== left.candidateCount) {
        return right.candidateCount - left.candidateCount;
      }
      return left.batchKey.localeCompare(right.batchKey);
    });

  const recommendations = [];
  if (safeApplyCandidates.length === 0) {
    recommendations.push("No safe batch-apply candidates remain after promoted and manual-review cases are removed.");
  } else {
    recommendations.push(`Batch apply can safely advance ${safeApplyCandidates.length} candidate(s) across ${recommendedBatches.length} recommended batch(es).`);
  }
  if (manualReviewCandidates.length > 0) {
    recommendations.push(`${manualReviewCandidates.length} candidate(s) should stay in manual review because their overlap risk is high.`);
  }
  if (recommendedBatches.some((batch) => batch.risk === "medium")) {
    recommendations.push("At least one recommended batch still carries medium overlap risk; keep the rationale explicit in review notes.");
  }

  return {
    safeApplyCandidates,
    manualReviewCandidates,
    recommendedBatches,
    recommendations
  };
}

export function selectPolicyCurationBatchCandidates(curationManifest, options = {}) {
  const repoRefs = new Set(parseTargetRefs(options.target).map(normalizeRef));
  let candidates = curationManifest?.curation?.curatedCandidates ?? [];
  if (repoRefs.size > 0) {
    candidates = candidates.filter((item) => repoRefs.has(normalizeRef(item.repoRef)));
  }
  if (options.limit && options.limit > 0) {
    candidates = candidates.slice(0, options.limit);
  }
  return candidates;
}

export function buildPolicyCurationBatchReview({
  candidates = [],
  queueRows = [],
  landkarteText = "",
  learningsText = "",
  decisionsText = ""
}) {
  const liveQueueByUrl = new Map(
    queueRows.map((row) => [normalizeRepoUrl(row.normalized_repo_url || row.repo_url), row])
  );

  const rows = candidates.map((candidate) => {
    const queueKey = normalizeRepoUrl(candidate.queueRow?.normalized_repo_url || candidate.url);
    const queueRow = liveQueueByUrl.get(queueKey) ?? candidate.queueRow ?? {};
    const repoRef = candidate.repoRef;
    const repoUrl = queueRow.normalized_repo_url || queueRow.repo_url || candidate.url;
    const landkarteAlreadyPresent = landkarteText.includes(repoUrl);
    const learningMentions = countOccurrences(learningsText, repoRef);
    const decisionMentions = countOccurrences(decisionsText, repoRef);
    const canonicalTouchCount = (landkarteAlreadyPresent ? 2 : 0) + learningMentions + decisionMentions;

    return {
      repoRef,
      url: candidate.url,
      repoUrl,
      curationScore: candidate.curationScore ?? 0,
      projectFitBand: candidate.projectFitBand ?? "unknown",
      projectFitScore: candidate.projectFitScore ?? 0,
      mainLayer: queueRow.main_layer_guess ?? "",
      gapArea: queueRow.eventbaer_gap_area_guess ?? "",
      patternFamily: queueRow.pattern_family_guess ?? "",
      capabilities: candidate.matchedCapabilities ?? [],
      reviewDisposition: candidate.reviewDisposition ?? "-",
      promotionStatus: queueRow.promotion_status || candidate.promotionStatus || "-",
      queueStatus: queueRow.status || "-",
      landkarteAlreadyPresent,
      learningMentions,
      decisionMentions,
      canonicalTouchCount,
      batchKey: "",
      overlapScore: 0,
      overlapPartners: [],
      overlapReasons: [],
      conflictRisk: "low",
      manualReviewRequired: false,
      alreadyPromoted: (queueRow.status || "") === "promoted" || (queueRow.promotion_status || "") === "applied"
    };
  });

  const activeRows = rows.filter((row) => !row.alreadyPromoted);
  for (let index = 0; index < activeRows.length; index += 1) {
    const current = activeRows[index];
    current.batchKey = buildBatchKey(current);
    for (let inner = 0; inner < activeRows.length; inner += 1) {
      if (inner === index) {
        continue;
      }
      const comparison = activeRows[inner];
      const overlap = buildPairOverlap(current, comparison);
      if (overlap.score <= 0) {
        continue;
      }
      current.overlapScore += overlap.score;
      current.overlapPartners.push(comparison.repoRef);
      current.overlapReasons.push(...overlap.reasons);
    }

    current.overlapPartners = unique(current.overlapPartners);
    current.overlapReasons = unique(current.overlapReasons);

    if (current.overlapScore >= 6 || (current.overlapPartners.length >= 2 && current.overlapScore >= 4)) {
      current.conflictRisk = "high";
    } else if (current.overlapScore >= 3 || current.canonicalTouchCount >= 2) {
      current.conflictRisk = "medium";
    } else {
      current.conflictRisk = "low";
    }
    current.manualReviewRequired = current.conflictRisk === "high";
  }

  for (const row of rows.filter((item) => item.alreadyPromoted)) {
    row.batchKey = buildBatchKey(row);
  }

  const overlap = {
    patternFamilies: summarizeCounts(rows.map((row) => row.patternFamily)),
    gapAreas: summarizeCounts(rows.map((row) => row.gapArea)),
    mainLayers: summarizeCounts(rows.map((row) => row.mainLayer)),
    capabilities: summarizeCounts(rows.flatMap((row) => row.capabilities))
  };

  const governance = buildGovernancePlan(rows);
  const applyCandidates = governance.safeApplyCandidates;
  const alreadyPromoted = rows.filter((row) => row.alreadyPromoted);
  const decisionStatus =
    rows.length === 0 ? "no_candidates"
      : governance.manualReviewCandidates.length > 0 ? "manual_review_required"
        : applyCandidates.length > 0 ? "apply_ready"
          : "nothing_to_apply";
  const nextCommand =
    decisionStatus === "apply_ready"
      ? "policy-curation-batch-apply"
      : decisionStatus === "manual_review_required"
        ? "policy-curation-batch-plan"
        : "policy-curation-review";

  const recommendations = [];
  if (rows.length === 0) {
    recommendations.push("No curated candidates selected for batch review.");
  } else {
    if (applyCandidates.length > 0) {
      recommendations.push(`Batch apply can advance ${applyCandidates.length} candidate(s) while leaving already promoted repos untouched.`);
    }
    if (alreadyPromoted.length > 0) {
      recommendations.push(`${alreadyPromoted.length} candidate(s) are already promoted and would be skipped during batch apply.`);
    }
    if (governance.manualReviewCandidates.length > 0) {
      recommendations.push(`${governance.manualReviewCandidates.length} candidate(s) should stay out of auto-apply because their overlap risk is high.`);
    }
    if (overlap.patternFamilies.length > 0) {
      recommendations.push(`Candidates share pattern family overlap in ${overlap.patternFamilies.map((item) => item.value).join(", ")}; keep the batch rationale explicit.`);
    }
    if (overlap.gapAreas.length > 0) {
      recommendations.push(`Candidates cluster around gap area ${overlap.gapAreas.map((item) => item.value).join(", ")}, which makes a coherent batch story possible.`);
    }
    if (rows.some((row) => row.reviewDisposition === "observe_only")) {
      recommendations.push("Observe-only candidates are still valid for curated documentation, but the batch should be framed as pattern adoption guidance rather than dependency adoption.");
    }
    recommendations.push(...governance.recommendations);
  }

  return {
    candidateCount: rows.length,
    applyCandidateCount: applyCandidates.length,
    alreadyPromotedCount: alreadyPromoted.length,
    manualReviewCount: governance.manualReviewCandidates.length,
    decisionStatus,
    nextCommand,
    rows: rows.sort(compareRows),
    overlap,
    applyCandidates,
    governance,
    recommendations: unique(recommendations)
  };
}

export function renderPolicyCurationBatchReviewSummary({
  projectKey,
  reviewId,
  generatedAt,
  curationId,
  review
}) {
  const rowLines = review.rows.length > 0
    ? review.rows.map((row) =>
      `- ${row.repoRef} :: score=${row.curationScore} :: fit=${row.projectFitBand}/${row.projectFitScore} :: status=${row.queueStatus}/${row.promotionStatus} :: disposition=${row.reviewDisposition} :: risk=${row.conflictRisk} :: canonical_touch=${row.canonicalTouchCount} :: apply=${row.alreadyPromoted ? "skip" : row.manualReviewRequired ? "manual_review" : "yes"}`
    ).join("\n")
    : "- none";
  const overlapLines = [
    review.overlap.patternFamilies.length > 0
      ? `- pattern_families: ${review.overlap.patternFamilies.map((item) => `${item.value} (${item.count})`).join(", ")}`
      : "- pattern_families: none",
    review.overlap.gapAreas.length > 0
      ? `- gap_areas: ${review.overlap.gapAreas.map((item) => `${item.value} (${item.count})`).join(", ")}`
      : "- gap_areas: none",
    review.overlap.mainLayers.length > 0
      ? `- main_layers: ${review.overlap.mainLayers.map((item) => `${item.value} (${item.count})`).join(", ")}`
      : "- main_layers: none",
    review.overlap.capabilities.length > 0
      ? `- capabilities: ${review.overlap.capabilities.map((item) => `${item.value} (${item.count})`).join(", ")}`
      : "- capabilities: none"
  ].join("\n");
  const batchLines = review.governance.recommendedBatches.length > 0
    ? review.governance.recommendedBatches.map((batch) =>
      `- ${batch.batchKey} :: risk=${batch.risk} :: candidates=${batch.candidateCount} :: repos=${batch.repoRefs.join(", ")} :: rationale=${batch.rationale}`
    ).join("\n")
    : "- none";
  const manualLines = review.governance.manualReviewCandidates.length > 0
    ? review.governance.manualReviewCandidates.map((row) =>
      `- ${row.repoRef} :: risk=${row.conflictRisk} :: overlap_score=${row.overlapScore} :: overlap_partners=${row.overlapPartners.join(", ") || "-"}`
    ).join("\n")
    : "- none";
  const recommendationLines = review.recommendations.length > 0
    ? review.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot Policy Curation Batch Review

- project: ${projectKey}
- review_id: ${reviewId}
- generated_at: ${generatedAt}
- curation_id: ${curationId}
- selected_candidates: ${review.candidateCount}
- apply_candidates: ${review.applyCandidateCount}
- already_promoted: ${review.alreadyPromotedCount}
- manual_review: ${review.manualReviewCount}
- decision_status: ${review.decisionStatus}

## Candidate Matrix

${rowLines}

## Batch Overlap

${overlapLines}

## Recommended Batches

${batchLines}

## Manual Review Candidates

${manualLines}

## Recommendations

${recommendationLines}

## Next Step

- next_command: npm run patternpilot -- ${review.nextCommand} --project ${projectKey}
`;
}

export function renderPolicyCurationBatchPlanSummary({
  projectKey,
  planId,
  generatedAt,
  curationId,
  review
}) {
  const batchLines = review.governance.recommendedBatches.length > 0
    ? review.governance.recommendedBatches.map((batch) =>
      `- ${batch.batchKey} :: risk=${batch.risk} :: candidates=${batch.candidateCount} :: repos=${batch.repoRefs.join(", ")}`
    ).join("\n")
    : "- none";
  const safeLines = review.governance.safeApplyCandidates.length > 0
    ? review.governance.safeApplyCandidates.map((row) => `- ${row.repoRef} :: ${row.repoUrl}`).join("\n")
    : "- none";
  const manualLines = review.governance.manualReviewCandidates.length > 0
    ? review.governance.manualReviewCandidates.map((row) =>
      `- ${row.repoRef} :: risk=${row.conflictRisk} :: overlap=${row.overlapReasons.join(", ") || "-"}`
    ).join("\n")
    : "- none";
  const recommendationLines = review.governance.recommendations.length > 0
    ? review.governance.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";
  const nextCommand =
    review.decisionStatus === "apply_ready"
      ? `npm run patternpilot -- policy-curation-batch-apply --project ${projectKey}`
      : `npm run patternpilot -- policy-curation-review --project ${projectKey}`;

  return `# Patternpilot Policy Curation Batch Plan

- project: ${projectKey}
- plan_id: ${planId}
- generated_at: ${generatedAt}
- curation_id: ${curationId}
- safe_apply_candidates: ${review.governance.safeApplyCandidates.length}
- manual_review_candidates: ${review.governance.manualReviewCandidates.length}
- recommended_batches: ${review.governance.recommendedBatches.length}
- decision_status: ${review.decisionStatus}

## Recommended Batches

${batchLines}

## Safe Apply Candidates

${safeLines}

## Manual Review Candidates

${manualLines}

## Governance Notes

${recommendationLines}

## Next Step

- next_command: ${nextCommand}
`;
}
