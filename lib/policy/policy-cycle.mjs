import { getDiscoveryPolicySourceCandidates } from "./discovery-policy-review.mjs";

export function buildReplayImportPayloadFromDiscovery(discovery, label = "policy-cycle-replay") {
  return {
    schemaVersion: 1,
    label,
    candidates: getDiscoveryPolicySourceCandidates(discovery)
  };
}

function buildCycleNextCommand(projectKey, cycleId, trial, applyResult) {
  if (trial?.decisionStatus === "apply_ready" && applyResult?.changed) {
    return `npm run patternpilot -- policy-handoff --project ${projectKey} --cycle-dir projects/${projectKey}/calibration/cycles/${cycleId}`;
  }
  if (trial?.decisionStatus === "apply_ready") {
    return `npm run patternpilot -- policy-apply --project ${projectKey}`;
  }
  return `npm run patternpilot -- policy-workbench-review --project ${projectKey}`;
}

export function renderPolicyCycleSummary({
  projectKey,
  cycleId,
  generatedAt,
  workbenchId,
  sourceRunId,
  review,
  suggestion,
  trial,
  applyResult = null,
  replay = null
}) {
  const recommendationLines = [
    ...(review?.recommendations ?? []),
    ...(suggestion?.recommendations ?? []),
    ...(trial?.recommendations ?? [])
  ];
  const nextCommand = buildCycleNextCommand(projectKey, cycleId, trial, applyResult);

  return `# Patternpilot Policy Cycle

- project: ${projectKey}
- cycle_id: ${cycleId}
- generated_at: ${generatedAt}
- workbench_id: ${workbenchId}
- source_run: ${sourceRunId ?? "-"}
- workbench_rows_with_verdict: ${review?.rowsWithVerdict ?? 0}
- suggestion_changed: ${suggestion?.changed ? "yes" : "no"}
- trial_newly_visible: ${trial?.newlyVisibleCount ?? 0}
- trial_newly_hidden: ${trial?.newlyHiddenCount ?? 0}
- trial_decision_status: ${trial?.decisionStatus ?? "-"}
- policy_applied: ${applyResult ? (applyResult.changed ? "yes" : "no_change") : "no"}
- replay_candidates: ${replay?.candidateCount ?? "-"}
- replay_visible: ${replay?.visibleCount ?? "-"}

## Recommendations

${recommendationLines.length > 0 ? recommendationLines.map((item) => `- ${item}`).join("\n") : "- none"}

## Next Step

- next_command: ${nextCommand}
`;
}
