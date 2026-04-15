import { applyDiscoveryPolicyToCandidates } from "../discovery/candidates.mjs";
import { getDiscoveryPolicySourceCandidates } from "./discovery-policy-review.mjs";
import { buildDiscoveryPolicyComparisonReport } from "./discovery-policy-compare.mjs";

function cloneCandidates(candidates) {
  return JSON.parse(JSON.stringify(candidates ?? []));
}

function repoRef(candidate) {
  if (candidate?.full_name) {
    return candidate.full_name;
  }
  if (candidate?.repo?.owner && candidate?.repo?.name) {
    return `${candidate.repo.owner}/${candidate.repo.name}`;
  }
  return candidate?.repoRef ?? "unknown";
}

function buildGateMap(candidates = []) {
  return new Map(candidates.map((candidate) => [repoRef(candidate), candidate?.discoveryPolicyGate ?? null]));
}

function fitScore(candidate) {
  return Number(candidate?.projectAlignment?.fitScore ?? candidate?.projectFitScore ?? 0) || 0;
}

export function buildPolicyTrial({ discovery, currentPolicy, trialPolicy, sourceRecord = null }) {
  const sourceCandidates = getDiscoveryPolicySourceCandidates(discovery);
  const baselineCandidates = cloneCandidates(sourceCandidates);
  const trialCandidates = cloneCandidates(sourceCandidates);
  const baseline = applyDiscoveryPolicyToCandidates(baselineCandidates, currentPolicy, "enforce");
  const trial = applyDiscoveryPolicyToCandidates(trialCandidates, trialPolicy, "enforce");
  const baselineGateMap = buildGateMap([...baseline.visibleCandidates, ...baseline.blockedCandidates]);
  const trialGateMap = buildGateMap([...trial.visibleCandidates, ...trial.blockedCandidates]);

  const rows = sourceCandidates.map((candidate) => {
    const reference = repoRef(candidate);
    const baselineGate = baselineGateMap.get(reference);
    const trialGate = trialGateMap.get(reference);
    const baselineAllowed = baselineGate?.allowed ?? true;
    const trialAllowed = trialGate?.allowed ?? true;
    const changed = baselineAllowed !== trialAllowed;
    return {
      repoRef: reference,
      repoUrl: candidate?.repo?.normalizedRepoUrl ?? "",
      fitBand: candidate?.projectAlignment?.fitBand ?? "unknown",
      fitScore: fitScore(candidate),
      disposition: candidate?.discoveryDisposition ?? candidate?.reviewDisposition ?? "unknown",
      baselineAllowed,
      trialAllowed,
      changed,
      visibilityChange:
        baselineAllowed === trialAllowed
          ? "unchanged"
          : baselineAllowed
            ? "newly_hidden"
            : "newly_visible",
      baselineBlockers: baselineGate?.blockers ?? [],
      trialBlockers: trialGate?.blockers ?? [],
      baselinePreferences: baselineGate?.preferenceHits ?? [],
      trialPreferences: trialGate?.preferenceHits ?? []
    };
  });

  rows.sort((left, right) => {
    if (left.changed !== right.changed) {
      return left.changed ? -1 : 1;
    }
    return right.fitScore - left.fitScore;
  });

  const newlyVisible = rows.filter((row) => row.visibilityChange === "newly_visible");
  const newlyHidden = rows.filter((row) => row.visibilityChange === "newly_hidden");
  const changedRows = rows.filter((row) => row.changed);
  const comparison = sourceRecord
    ? buildDiscoveryPolicyComparisonReport([sourceRecord], currentPolicy, trialPolicy)
    : null;

  const recommendations = [];
  if (sourceCandidates.length === 0) {
    recommendations.push("Source run has no candidates, so the trial cannot show a meaningful before/after difference yet.");
  } else {
    if (newlyVisible.length > 0) {
      recommendations.push(`Trial policy reveals ${newlyVisible.length} candidate slots that were previously hidden.`);
    }
    if (newlyHidden.length > 0) {
      recommendations.push(`Trial policy hides ${newlyHidden.length} candidate slots that were previously visible.`);
    }
    const highFitVisible = newlyVisible.filter((row) => row.fitBand === "high").length;
    if (highFitVisible > 0) {
      recommendations.push(`${highFitVisible} newly visible rows are high-fit candidates and should be reviewed carefully before applying.`);
    }
  }

  return {
    sourceCandidateCount: sourceCandidates.length,
    baselineVisible: baseline.visibleCandidates.length,
    baselineHidden: baseline.blockedCandidates.length,
    trialVisible: trial.visibleCandidates.length,
    trialHidden: trial.blockedCandidates.length,
    changedRows: changedRows.length,
    newlyVisibleCount: newlyVisible.length,
    newlyHiddenCount: newlyHidden.length,
    rows,
    comparison,
    recommendations
  };
}

export function renderPolicyTrialSummary({
  projectKey,
  workbenchId,
  sourceRunId,
  trialPolicyPath,
  trial
}) {
  const rowLines = trial.rows.length > 0
    ? trial.rows.map((row) => {
      const blockers = row.trialBlockers.length > 0 ? row.trialBlockers.slice(0, 3).join(", ") : "-";
      return `- ${row.repoRef} :: fit=${row.fitBand}/${row.fitScore} :: ${row.visibilityChange} :: trial_allowed=${row.trialAllowed ? "yes" : "no"} :: blockers=${blockers}`;
    }).join("\n")
    : "- none";
  const recommendationLines = trial.recommendations.length > 0
    ? trial.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";
  const comparisonLines = trial.comparison
    ? [
        `- delta_audit_flagged: ${trial.comparison.delta.auditFlagged}`,
        `- delta_enforce_hidden: ${trial.comparison.delta.enforceHidden}`,
        `- delta_preferred_hits: ${trial.comparison.delta.auditPreferred}`
      ].join("\n")
    : "- none";

  return `# Patternpilot Policy Trial

- project: ${projectKey}
- workbench_id: ${workbenchId}
- source_run: ${sourceRunId ?? "-"}
- trial_policy: ${trialPolicyPath}
- source_candidates: ${trial.sourceCandidateCount}
- baseline_visible: ${trial.baselineVisible}
- baseline_hidden: ${trial.baselineHidden}
- trial_visible: ${trial.trialVisible}
- trial_hidden: ${trial.trialHidden}
- changed_rows: ${trial.changedRows}
- newly_visible: ${trial.newlyVisibleCount}
- newly_hidden: ${trial.newlyHiddenCount}

## Comparison

${comparisonLines}

## Candidate Matrix

${rowLines}

## Recommendations

${recommendationLines}
`;
}
