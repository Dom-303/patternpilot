export function buildProjectRunRequalification({
  projectKey,
  lifecycle,
  drift,
  stability,
  governance,
  releaseGovernance,
  jobName = null,
  jobState = null
}) {
  const reasons = [];
  const triggeredAt = jobState?.requalificationTriggeredAt ?? null;
  const clearedAt = jobState?.requalificationClearedAt ?? null;
  const latched = Boolean(jobState?.requalificationRequired ?? false) || governance?.status === "manual_requalify";
  let status = "not_required";
  let nextAction = "No requalification action is needed right now.";

  if (latched) {
    reasons.push("A previous run loop or the current governance result requires manual requalification.");
  }
  if (stability?.status === "unstable_streak") {
    reasons.push("Recent lifecycle history still shows an instability streak.");
  } else if (stability?.status === "stable_streak") {
    reasons.push("Recent lifecycle history now shows a stable streak.");
  }
  if (drift?.driftStatus === "attention_required") {
    reasons.push("Run drift still needs attention before unattended continuation can be trusted.");
  }

  if (!latched) {
    status = "not_required";
  } else if (stability?.status !== "stable_streak") {
    status = "blocked_by_stability";
    nextAction = `Run another deliberate follow-up loop and inspect stability again: npm run run-stability -- --project ${projectKey}`;
  } else if (releaseGovernance?.status === "manual_gate" || releaseGovernance?.status === "baseline_required" || releaseGovernance?.status === "manual_requalify") {
    status = "blocked_by_governance";
    nextAction = releaseGovernance?.nextAction ?? `Inspect governance blockers first: npm run run-governance -- --project ${projectKey} --scope automation`;
  } else {
    status = "ready_to_clear";
    nextAction = jobName
      ? `If the artifacts look right, clear the latch deliberately: npm run patternpilot -- automation-job-clear --automation-job ${jobName} --notes "manual requalification complete"`
      : "The run looks requalified. Clear the relevant automation job latch once the artifacts have been reviewed.";
  }

  return {
    projectKey,
    jobName,
    status,
    triggeredAt,
    clearedAt,
    latched,
    lifecycleRunKind: lifecycle?.runKind ?? null,
    driftStatus: drift?.driftStatus ?? null,
    stabilityStatus: stability?.status ?? null,
    stableStreak: Number(stability?.stableStreak ?? 0),
    unstableStreak: Number(stability?.unstableStreak ?? 0),
    governanceStatus: governance?.status ?? null,
    releaseGovernanceStatus: releaseGovernance?.status ?? null,
    reasons,
    nextAction
  };
}

export function renderProjectRunRequalificationSummary({
  projectKey,
  generatedAt,
  requalification
}) {
  return `# Patternpilot Run Requalification

- project: ${projectKey}
- generated_at: ${generatedAt}
- job: ${requalification.jobName ?? "-"}
- status: ${requalification.status}
- latched: ${requalification.latched ? "yes" : "no"}
- triggered_at: ${requalification.triggeredAt ?? "-"}
- cleared_at: ${requalification.clearedAt ?? "-"}
- lifecycle_run_kind: ${requalification.lifecycleRunKind ?? "-"}
- drift_status: ${requalification.driftStatus ?? "-"}
- stability_status: ${requalification.stabilityStatus ?? "-"}
- stable_streak: ${requalification.stableStreak ?? 0}
- unstable_streak: ${requalification.unstableStreak ?? 0}
- governance_status: ${requalification.governanceStatus ?? "-"}
- release_governance_status: ${requalification.releaseGovernanceStatus ?? "-"}

## Reasons

${requalification.reasons.map((item) => `- ${item}`).join("\n") || "- none"}

## Next Action

- ${requalification.nextAction}
`;
}
