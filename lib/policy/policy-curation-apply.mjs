function normalizeRef(value) {
  return String(value ?? "").trim().toLowerCase();
}

function parseTargetRefs(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

export function selectPolicyCurationApplyCandidates(curationManifest, options = {}) {
  const repoRefs = parseTargetRefs(options.target);
  let candidates = curationManifest?.curation?.curatedCandidates ?? [];
  if (repoRefs.length > 0) {
    const wanted = new Set(repoRefs.map(normalizeRef));
    candidates = candidates.filter((item) => wanted.has(normalizeRef(item.repoRef)));
  }
  if (options.limit && options.limit > 0) {
    candidates = candidates.slice(0, options.limit);
  }
  return candidates;
}

export function buildPolicyCurationApplyReview({
  candidates = [],
  landkarteText = "",
  learningsText = "",
  decisionsText = ""
}) {
  const rows = candidates.map((candidate) => {
    const repoUrl = candidate.queueRow?.normalized_repo_url || candidate.url || "";
    const repoRef = candidate.repoRef;
    return {
      repoRef,
      repoUrl,
      decisionGuess: candidate.decisionGuess,
      reviewDisposition: candidate.reviewDisposition,
      landkarteAlreadyPresent: landkarteText.includes(repoUrl),
      learningMentions: countOccurrences(learningsText, repoRef),
      decisionMentions: countOccurrences(decisionsText, repoRef)
    };
  });

  const recommendations = [];
  if (rows.length === 0) {
    recommendations.push("No curated candidates selected for apply review.");
  } else {
    const newLandkarte = rows.filter((row) => !row.landkarteAlreadyPresent).length;
    if (newLandkarte > 0) {
      recommendations.push(`${newLandkarte} selected candidate(s) would be new additions to the repo landkarte.`);
    }
    const observeOnly = rows.filter((row) => row.reviewDisposition === "observe_only").length;
    if (observeOnly > 0) {
      recommendations.push(`${observeOnly} selected candidate(s) still carry observe_only disposition, so apply should be treated as curated documentation, not automatic adoption.`);
    }
  }

  return {
    candidateCount: rows.length,
    rows,
    recommendations
  };
}

export function renderPolicyCurationApplyReviewSummary({
  projectKey,
  reviewId,
  generatedAt,
  curationId,
  review
}) {
  const rowLines = review.rows.length > 0
    ? review.rows.map((row) =>
      `- ${row.repoRef} :: landkarte_present=${row.landkarteAlreadyPresent ? "yes" : "no"} :: learning_mentions=${row.learningMentions} :: decision_mentions=${row.decisionMentions} :: disposition=${row.reviewDisposition}`
    ).join("\n")
    : "- none";
  const recommendationLines = review.recommendations.length > 0
    ? review.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot Policy Curation Apply Review

- project: ${projectKey}
- review_id: ${reviewId}
- generated_at: ${generatedAt}
- curation_id: ${curationId}
- selected_candidates: ${review.candidateCount}

## Candidate Review

${rowLines}

## Recommendations

${recommendationLines}
`;
}
