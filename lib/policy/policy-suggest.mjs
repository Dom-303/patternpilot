import { buildDiscoveryPolicyComparisonReport } from "./discovery-policy-compare.mjs";

const VERDICT_ALIASES = new Map([
  ["false_block", "false_block"],
  ["unblock", "false_block"],
  ["keep_visible", "false_block"],
  ["confirm_block", "confirm_block"],
  ["keep_block", "confirm_block"],
  ["blocked_ok", "confirm_block"],
  ["good_prefer", "good_prefer"],
  ["prefer_keep", "good_prefer"],
  ["strong_match", "good_prefer"],
  ["noise_visible", "noise_visible"],
  ["too_noisy", "noise_visible"],
  ["should_hide", "noise_visible"],
  ["needs_review", "needs_review"],
  ["unsure", "needs_review"]
]);

function canonicalizeVerdict(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return VERDICT_ALIASES.get(normalized) ?? normalized;
}

function clonePolicy(policy) {
  return JSON.parse(JSON.stringify(policy ?? {}));
}

function uniqueValues(values = []) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => left.localeCompare(right));
}

function pushUnique(target, value) {
  if (!value) {
    return false;
  }
  if (!Array.isArray(target)) {
    return false;
  }
  if (target.includes(value)) {
    return false;
  }
  target.push(value);
  target.sort((left, right) => left.localeCompare(right));
  return true;
}

function ensureArray(policy, key) {
  if (!Array.isArray(policy[key])) {
    policy[key] = [];
  }
  return policy[key];
}

function blockerValue(blocker, prefix) {
  const raw = String(blocker ?? "");
  if (!raw.startsWith(prefix)) {
    return "";
  }
  return raw.slice(prefix.length);
}

function rowsForHeuristicFalseBlock(rows = [], hasManualVerdicts = false) {
  if (hasManualVerdicts) {
    return [];
  }
  return rows.filter((row) =>
    row.policyAllowed === false &&
    row.focus === "check_false_block" &&
    row.fitBand === "high" &&
    (row.preferenceHits?.length ?? 0) >= 2
  );
}

function sharedValue(rows = [], key) {
  const values = uniqueValues(rows.map((row) => row[key]));
  return values.length === 1 ? values[0] : "";
}

function buildWorkbenchCommand(projectKey, workbenchId, commandName) {
  return `npm run patternpilot -- ${commandName} --project ${projectKey} --workbench-dir projects/${projectKey}/calibration/workbench/${workbenchId}`;
}

export function buildPolicySuggestion({ rows = [], currentPolicy = {}, sourceRecord = null }) {
  const nextPolicy = clonePolicy(currentPolicy);
  const verdictRows = rows.filter((row) => canonicalizeVerdict(row.manualVerdict));
  const hasManualVerdicts = verdictRows.length > 0;
  const suggestions = [];
  const verdictBuckets = {
    false_block: rows.filter((row) => canonicalizeVerdict(row.manualVerdict) === "false_block"),
    confirm_block: rows.filter((row) => canonicalizeVerdict(row.manualVerdict) === "confirm_block"),
    noise_visible: rows.filter((row) => canonicalizeVerdict(row.manualVerdict) === "noise_visible"),
    good_prefer: rows.filter((row) => canonicalizeVerdict(row.manualVerdict) === "good_prefer")
  };
  const heuristicFalseBlocks = rowsForHeuristicFalseBlock(rows, hasManualVerdicts);

  const dispositionRows = [...verdictBuckets.false_block, ...heuristicFalseBlocks].filter((row) =>
    row.blockers.some((blocker) => blocker.startsWith("disposition_not_allowed:"))
  );
  const dispositionsToAllow = uniqueValues(
    dispositionRows.flatMap((row) =>
      row.blockers
        .map((blocker) => blockerValue(blocker, "disposition_not_allowed:"))
        .filter(Boolean)
    )
  );
  for (const disposition of dispositionsToAllow) {
    const changed = pushUnique(ensureArray(nextPolicy, "allowDispositions"), disposition);
    suggestions.push({
      type: "allow_disposition",
      changed,
      confidence: hasManualVerdicts ? "high" : "medium",
      heuristicOnly: !hasManualVerdicts,
      value: disposition,
      sources: uniqueValues(dispositionRows.map((row) => row.repoRef)),
      rationale: changed
        ? `Allow disposition '${disposition}' so strong blocked candidates remain visible.`
        : `Disposition '${disposition}' is already allowed.`
    });
  }

  const fitRows = verdictBuckets.false_block.filter((row) =>
    row.blockers.some((blocker) => blocker.startsWith("below_min_fit"))
  );
  const suggestedMinFit = fitRows.reduce((min, row) => {
    const score = Number(row.fitScore ?? 0) || 0;
    if (score <= 0) {
      return min;
    }
    return min == null ? score : Math.min(min, score);
  }, null);
  if (suggestedMinFit != null && suggestedMinFit < (Number(nextPolicy.minProjectFitScore ?? 0) || 0)) {
    nextPolicy.minProjectFitScore = suggestedMinFit;
    suggestions.push({
      type: "lower_min_project_fit_score",
      changed: true,
      confidence: "high",
      heuristicOnly: false,
      value: suggestedMinFit,
      sources: uniqueValues(fitRows.map((row) => row.repoRef)),
      rationale: `Lower minProjectFitScore to ${suggestedMinFit} to avoid filtering manually approved high-signal rows.`
    });
  }

  const starRows = verdictBuckets.false_block.filter((row) =>
    row.blockers.some((blocker) => blocker.startsWith("below_min_stars"))
  );
  const suggestedMinStars = starRows.reduce((min, row) => {
    const stars = Number(row.stars ?? 0) || 0;
    return min == null ? stars : Math.min(min, stars);
  }, null);
  if (suggestedMinStars != null && suggestedMinStars < (Number(nextPolicy.minStars ?? 0) || 0)) {
    nextPolicy.minStars = suggestedMinStars;
    suggestions.push({
      type: "lower_min_stars",
      changed: true,
      confidence: "high",
      heuristicOnly: false,
      value: suggestedMinStars,
      sources: uniqueValues(starRows.map((row) => row.repoRef)),
      rationale: `Lower minStars to ${suggestedMinStars} to keep manually approved candidates visible.`
    });
  }

  for (const bucket of ["confirm_block", "noise_visible"]) {
    const rowsInBucket = verdictBuckets[bucket];
    if (rowsInBucket.length < 2) {
      continue;
    }
    const sharedPatternFamily = sharedValue(rowsInBucket, "patternFamily");
    if (sharedPatternFamily && pushUnique(ensureArray(nextPolicy, "blockedPatternFamilies"), sharedPatternFamily)) {
      suggestions.push({
        type: "block_pattern_family",
        changed: true,
        confidence: "medium",
        heuristicOnly: false,
        value: sharedPatternFamily,
        sources: uniqueValues(rowsInBucket.map((row) => row.repoRef)),
        rationale: `Rows marked ${bucket} share pattern family '${sharedPatternFamily}', which is a good candidate for a harder block.`
      });
    }
  }

  const goodPreferRows = verdictBuckets.good_prefer;
  if (goodPreferRows.length >= 2) {
    const sharedGap = sharedValue(goodPreferRows, "gapArea");
    if (sharedGap && pushUnique(ensureArray(nextPolicy, "preferredGapAreas"), sharedGap)) {
      suggestions.push({
        type: "prefer_gap_area",
        changed: true,
        confidence: "medium",
        heuristicOnly: false,
        value: sharedGap,
        sources: uniqueValues(goodPreferRows.map((row) => row.repoRef)),
        rationale: `Rows marked good_prefer share gap area '${sharedGap}', so it should likely stay or become a preferred gap.`
      });
    }
  }

  const comparison = sourceRecord
    ? buildDiscoveryPolicyComparisonReport([sourceRecord], currentPolicy, nextPolicy)
    : null;

  const changed = JSON.stringify(nextPolicy) !== JSON.stringify(currentPolicy);
  const recommendations = [];
  if (suggestions.length === 0) {
    recommendations.push("No concrete policy suggestion was derived from the current workbench rows.");
  } else {
    if (dispositionsToAllow.length > 0) {
      recommendations.push(`Test whether allowing ${dispositionsToAllow.join(", ")} reveals strong candidates without introducing too much noise.`);
    }
    if (comparison) {
      if (comparison.delta.enforceHidden < 0) {
        recommendations.push(`Suggested policy would reveal ${Math.abs(comparison.delta.enforceHidden)} candidate slots on the source run.`);
      } else if (comparison.delta.enforceHidden > 0) {
        recommendations.push(`Suggested policy would hide ${comparison.delta.enforceHidden} more candidate slots on the source run.`);
      }
    }
  }

  const decisionStatus =
    !changed ? "no_change"
      : suggestionHasRisk(suggestions) ? "trial_recommended"
        : "trial_ready";

  return {
    rowCount: rows.length,
    manualVerdictCount: verdictRows.length,
    heuristicFalseBlockCount: heuristicFalseBlocks.length,
    suggestions,
    changed,
    decisionStatus,
    nextPolicy,
    comparison,
    recommendations
  };
}

function suggestionHasRisk(suggestions = []) {
  return suggestions.some((item) => item.type === "block_pattern_family" || item.type === "lower_min_project_fit_score" || item.type === "lower_min_stars");
}

export function renderPolicySuggestionSummary({
  projectKey,
  workbenchId,
  sourceRunId,
  suggestion
}) {
  const suggestionLines = suggestion.suggestions.length > 0
    ? suggestion.suggestions.map((item) =>
      `- ${item.type} :: value=${item.value} :: changed=${item.changed ? "yes" : "no"} :: confidence=${item.confidence} :: heuristic_only=${item.heuristicOnly ? "yes" : "no"} :: sources=${item.sources.join(", ") || "-"}`
    ).join("\n")
    : "- none";
  const recommendationLines = suggestion.recommendations.length > 0
    ? suggestion.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";
  const comparisonLines = suggestion.comparison
    ? [
        `- delta_audit_flagged: ${suggestion.comparison.delta.auditFlagged}`,
        `- delta_enforce_hidden: ${suggestion.comparison.delta.enforceHidden}`,
        `- delta_preferred_hits: ${suggestion.comparison.delta.auditPreferred}`
      ].join("\n")
    : "- none";
  const nextCommand =
    suggestion.changed
      ? buildWorkbenchCommand(projectKey, workbenchId, "policy-trial")
      : buildWorkbenchCommand(projectKey, workbenchId, "policy-workbench-review");

  return `# Patternpilot Policy Suggestion

- project: ${projectKey}
- workbench_id: ${workbenchId}
- source_run: ${sourceRunId ?? "-"}
- rows: ${suggestion.rowCount}
- manual_verdicts: ${suggestion.manualVerdictCount}
- heuristic_false_blocks: ${suggestion.heuristicFalseBlockCount}
- changed: ${suggestion.changed ? "yes" : "no"}
- decision_status: ${suggestion.decisionStatus}

## Suggestions

${suggestionLines}

## Suggested Policy Comparison

${comparisonLines}

## Recommendations

${recommendationLines}

## Next Step

- next_command: ${nextCommand}
`;
}
