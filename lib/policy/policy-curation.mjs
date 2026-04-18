function numeric(value) {
  return Number(value ?? 0) || 0;
}

function parseCsv(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildCurationScore(row) {
  let score = numeric(row.project_fit_score);
  score += numeric(row.value_score) * 0.8;
  score -= numeric(row.effort_score) * 0.2;
  if ((row.project_relevance_guess ?? row.eventbaer_relevance_guess ?? "") === "high") {
    score += 12;
  } else if ((row.project_relevance_guess ?? row.eventbaer_relevance_guess ?? "") === "medium") {
    score += 6;
  }
  if ((row.decision_guess ?? "") === "adapt") {
    score += 8;
  } else if ((row.decision_guess ?? "") === "adopt") {
    score += 10;
  } else if ((row.decision_guess ?? "") === "observe") {
    score += 2;
  }
  score += parseCsv(row.matched_capabilities).length * 3;
  return Math.round(score);
}

export function buildPolicyCuration({ projectKey = "project", handoffManifest, queueRows = [], limit = null }) {
  const selectionUrls = new Set(handoffManifest?.selection?.urls ?? []);
  const candidates = queueRows
    .filter((row) => selectionUrls.has(row.normalized_repo_url || row.repo_url))
    .map((row) => ({
      repoRef: `${row.owner}/${row.name}`,
      url: row.normalized_repo_url || row.repo_url,
      projectFitBand: row.project_fit_band || "unknown",
      projectFitScore: numeric(row.project_fit_score),
      valueBand: row.value_band || "unknown",
      valueScore: numeric(row.value_score),
      effortBand: row.effort_band || "unknown",
      effortScore: numeric(row.effort_score),
      decisionGuess: row.decision_guess || "-",
      reviewDisposition: row.review_disposition || "-",
      relevance: row.project_relevance_guess || row.eventbaer_relevance_guess || "-",
      matchedCapabilities: parseCsv(row.matched_capabilities),
      suggestedNextStep: row.suggested_next_step || "-",
      promotionStatus: row.promotion_status || "-",
      curationScore: buildCurationScore(row),
      queueRow: row
    }))
    .sort((left, right) => {
      if (right.curationScore !== left.curationScore) {
        return right.curationScore - left.curationScore;
      }
      return right.projectFitScore - left.projectFitScore;
    });

  const limited = limit && limit > 0 ? candidates.slice(0, limit) : candidates;
  const recommendations = [];
  if (limited.length === 0) {
    recommendations.push("No queue-backed candidates matched the handoff selection yet.");
  } else {
    recommendations.push(`Prepare promotion packets for the top ${limited.length} curated candidate(s).`);
    if (limited[0]) {
      recommendations.push(`Start manual curation with ${limited[0].repoRef} because it currently leads the curation score.`);
    }
    const observeOnly = limited.filter((item) => item.reviewDisposition === "observe_only").length;
    if (observeOnly > 0) {
      recommendations.push(`${observeOnly} curated candidate(s) still carry observe_only disposition, so treat promotion as a deliberate review bridge rather than automatic adoption.`);
    }
  }

  const decisionStatus =
    limited.length === 0 ? "no_queue_backed_candidates"
      : limited.some((item) => item.reviewDisposition === "observe_only") ? "prepare_only"
        : "ready_for_promotion";
  const nextCommand =
    limited.length === 0
      ? `npm run patternpilot -- policy-handoff --project ${projectKey}`
      : `npm run patternpilot -- policy-curation-batch-review --project ${projectKey}`;

  return {
    selectionCount: selectionUrls.size,
    candidateCount: candidates.length,
    curatedCount: limited.length,
    candidates,
    curatedCandidates: limited,
    decisionStatus,
    nextCommand,
    recommendations
  };
}

export function renderPolicyCurationSummary({
  projectKey,
  curationId,
  generatedAt,
  handoffId,
  cycleId,
  curation,
  promotionRun = null,
  dryRun = false
}) {
  const candidateLines = curation.curatedCandidates.length > 0
    ? curation.curatedCandidates.map((item) =>
      `- ${item.repoRef} :: score=${item.curationScore} :: fit=${item.projectFitBand}/${item.projectFitScore} :: value=${item.valueBand}/${item.valueScore} :: disposition=${item.reviewDisposition} :: next=${item.suggestedNextStep}`
    ).join("\n")
    : "- none";
  const recommendationLines = curation.recommendations.length > 0
    ? curation.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot Policy Curation

- project: ${projectKey}
- curation_id: ${curationId}
- generated_at: ${generatedAt}
- handoff_id: ${handoffId}
- cycle_id: ${cycleId ?? "-"}
- selected_repos: ${curation.selectionCount}
- queue_candidates: ${curation.candidateCount}
- curated_candidates: ${curation.curatedCount}
- decision_status: ${curation.decisionStatus}
- promotion_run: ${promotionRun?.runId ?? "-"}
- promotion_items: ${promotionRun?.items?.length ?? 0}
- dry_run: ${dryRun ? "yes" : "no"}

## Curated Candidates

${candidateLines}

## Recommendations

${recommendationLines}

## Next Step

- next_command: ${curation.nextCommand}
`;
}
