function unique(values) {
  return [...new Set((values ?? []).filter(Boolean))];
}

function appendReason(target, reason) {
  if (reason) {
    target.push(reason);
  }
}

export function buildProjectRunGovernance({
  projectKey,
  lifecycle,
  drift,
  stability = null,
  jobState = null,
  scope = "manual",
  job = null
}) {
  const reasons = [];
  const queueDecisionStateSummary = drift?.queueSnapshot?.decisionStateSummary ?? {};
  const queueByStatus = drift?.queueSnapshot?.byStatus ?? {};
  const hasPreparedQueue = Number(queueByStatus.promotion_prepared ?? 0) > 0;
  const hasPromotedQueue = Number(queueByStatus.promoted ?? 0) > 0;
  const staleCount = Number(queueDecisionStateSummary.stale ?? 0);
  const fallbackCount = Number(queueDecisionStateSummary.fallback ?? 0);
  const isApplyJob = /--promotion-mode\s+apply\b/.test(job?.command ?? "");
  const repeatedRetryableFailures = Number(jobState?.consecutiveRetryableFailures ?? 0);
  const stabilityStatus = stability?.status ?? "baseline_only";
  const requalificationRequired = Boolean(jobState?.requalificationRequired ?? false);

  let status = "manual_gate";
  let autoDispatchAllowed = false;
  let autoApplyAllowed = false;
  let recommendedPromotionMode = lifecycle?.defaultPromotionMode ?? "prepared";
  let unattendedPhases = [];
  let blockedPhases = [];
  let nextAction = "Inspect the latest run artifacts before deciding how to continue.";

  if (!drift?.latestRun) {
    appendReason(reasons, "No lifecycle-relevant baseline run exists yet.");
    return {
      projectKey,
      status: "baseline_required",
      autoDispatchAllowed: false,
      autoApplyAllowed: false,
      recommendedPromotionMode: "prepared",
      unattendedPhases: [],
      blockedPhases: ["discover", "intake", "re_evaluate", "review", "promote"],
      reasons,
      nextAction: `Create a deliberate baseline run first: npm run analyze -- --project ${projectKey} <github-url>`
    };
  }

  if (jobState?.blockedManual) {
    appendReason(reasons, "Job state is manually blocked from a previous failure.");
    return {
      projectKey,
      status: "manual_gate",
      autoDispatchAllowed: false,
      autoApplyAllowed: false,
      recommendedPromotionMode: recommendedPromotionMode ?? "prepared",
      unattendedPhases: [],
      blockedPhases: unique([
        ...(lifecycle?.executionPolicy?.autoResumeEligiblePhases ?? []),
        ...(lifecycle?.executionPolicy?.manualResumePhases ?? [])
      ]),
      reasons,
      nextAction: jobState.resumeRecommendation?.nextAction ?? "Fix the underlying issue and clear the job state before dispatching again."
    };
  }

  if (repeatedRetryableFailures >= 2) {
    appendReason(reasons, `${repeatedRetryableFailures} consecutive retryable automation failures require a manual requalification step.`);
    return {
      projectKey,
      status: "manual_requalify",
      autoDispatchAllowed: false,
      autoApplyAllowed: false,
      recommendedPromotionMode: "prepared",
      unattendedPhases: [],
      blockedPhases: unique([
        ...(lifecycle?.executionPolicy?.autoResumeEligiblePhases ?? []),
        ...(lifecycle?.executionPolicy?.manualResumePhases ?? [])
      ]),
      reasons,
      nextAction: jobState.resumeRecommendation?.nextAction ?? `Run a fresh governance check before dispatching again: npm run run-governance -- --project ${projectKey} --scope automation`
    };
  }

  if (requalificationRequired) {
    appendReason(reasons, "A previous follow-up loop already requested manual requalification and the latch has not been cleared yet.");
    return {
      projectKey,
      status: "manual_requalify",
      autoDispatchAllowed: false,
      autoApplyAllowed: false,
      recommendedPromotionMode: "prepared",
      stabilityStatus,
      stableStreak: Number(stability?.stableStreak ?? 0),
      unstableStreak: Number(stability?.unstableStreak ?? 0),
      unattendedPhases: stabilityStatus === "stable_streak" ? ["discover", "intake", "re_evaluate"] : [],
      blockedPhases: unique([
        ...(lifecycle?.executionPolicy?.autoResumeEligiblePhases ?? []),
        ...(lifecycle?.executionPolicy?.manualResumePhases ?? [])
      ]),
      reasons,
      nextAction: jobState.requalificationReason
        ?? `Run a requalification check and only clear the job after manual review: npm run run-requalify -- --project ${projectKey}`
    };
  }

  if (lifecycle?.runKind === "first_run") {
    appendReason(reasons, "First runs stay manual so the initial scope can be checked deliberately.");
    return {
      projectKey,
      status: "manual_gate",
      autoDispatchAllowed: false,
      autoApplyAllowed: false,
      recommendedPromotionMode: "prepared",
      unattendedPhases: [],
      blockedPhases: ["review", "promote"],
      reasons,
      nextAction: `Treat the next run as a manual orientation pass: npm run analyze -- --project ${projectKey} <github-url>`
    };
  }

  if (stabilityStatus === "unstable_streak") {
    appendReason(reasons, "Recent lifecycle-relevant runs show an instability streak, so unattended continuation should pause.");
    return {
      projectKey,
      status: "manual_requalify",
      autoDispatchAllowed: false,
      autoApplyAllowed: false,
      recommendedPromotionMode: "prepared",
      unattendedPhases: ["discover", "intake"],
      blockedPhases: ["re_evaluate", "review", "promote"],
      reasons,
      nextAction: `Requalify the project run model before dispatching again: npm run run-stability -- --project ${projectKey}`
    };
  }

  if (drift?.driftStatus === "attention_required") {
    appendReason(reasons, "Run drift currently needs attention before unattended continuation.");
    return {
      projectKey,
      status: "manual_gate",
      autoDispatchAllowed: false,
      autoApplyAllowed: false,
      recommendedPromotionMode: "prepared",
      unattendedPhases: ["discover", "intake"],
      blockedPhases: ["re_evaluate", "review", "promote"],
      reasons,
      nextAction: drift?.resumeGuidance?.nextAction ?? `Inspect run drift first: npm run run-drift -- --project ${projectKey}`
    };
  }

  if (staleCount > 0 || fallbackCount > 0) {
    appendReason(reasons, staleCount > 0
      ? `${staleCount} stale decision signal(s) still need refresh.`
      : `${fallbackCount} fallback decision signal(s) still need refresh.`);
    status = "limited_unattended";
    autoDispatchAllowed = true;
    autoApplyAllowed = false;
    recommendedPromotionMode = "skip";
    unattendedPhases = unique([
      ...(lifecycle?.executionPolicy?.autoResumeEligiblePhases ?? []),
      "re_evaluate"
    ]);
    blockedPhases = ["review", "promote"];
    nextAction = drift?.resumeGuidance?.nextAction ?? `Refresh the queue first: npm run re-evaluate -- --project ${projectKey}`;
  } else if (lifecycle?.runKind === "follow_up_run") {
    appendReason(reasons, "Follow-up runs can continue automatically, but promotion should still stay review-first.");
    status = "limited_unattended";
    autoDispatchAllowed = true;
    autoApplyAllowed = false;
    recommendedPromotionMode = "prepared";
    unattendedPhases = unique([
      ...(lifecycle?.executionPolicy?.autoResumeEligiblePhases ?? []),
      "review"
    ]);
    blockedPhases = ["promote"];
    nextAction = "Allow the follow-up run to continue, but keep final promotion as a deliberate review step.";
  } else {
    appendReason(reasons, "Lifecycle, queue state and drift currently support unattended maintenance flow.");
    status = "unattended_ready";
    autoDispatchAllowed = true;
    autoApplyAllowed = !hasPreparedQueue && scope === "automation";
    recommendedPromotionMode = hasPreparedQueue ? "prepared" : (scope === "automation" ? "apply" : "prepared");
    unattendedPhases = unique([
      ...(lifecycle?.executionPolicy?.autoResumeEligiblePhases ?? []),
      "review",
      "promote"
    ]);
    blockedPhases = [];
    nextAction = "Unattended continuation looks acceptable; keep monitoring drift and job alerts.";
  }

  if (stabilityStatus === "mixed" || stabilityStatus === "lightly_stable") {
    appendReason(reasons, `Recent lifecycle history is only ${stabilityStatus.replace(/_/g, " ")}, so unattended continuation should stay conservative.`);
    if (status === "unattended_ready") {
      status = "limited_unattended";
      autoApplyAllowed = false;
      recommendedPromotionMode = "prepared";
      blockedPhases = unique([...blockedPhases, "promote"]);
      nextAction = "Keep the next loop unattended only up to review/prepared level until the stability streak gets stronger.";
    }
  }

  if (hasPreparedQueue) {
    appendReason(reasons, `${queueByStatus.promotion_prepared} promotion-prepared repo(s) are waiting; prefer prepared-only continuation over blind apply.`);
    autoApplyAllowed = false;
    recommendedPromotionMode = "prepared";
    if (status === "unattended_ready") {
      status = "limited_unattended";
      blockedPhases = unique([...blockedPhases, "promote"]);
      nextAction = "Let maintenance continue, but keep promotion on prepared level until the prepared queue is resolved.";
    }
  }

  if (hasPromotedQueue && lifecycle?.runKind === "maintenance_run") {
    appendReason(reasons, `${queueByStatus.promoted} repo(s) are already promoted, so maintenance should protect the curated baseline.`);
  }

  if (scope === "automation" && isApplyJob && !autoApplyAllowed) {
    appendReason(reasons, "This automation job is configured with --promotion-mode apply, but governance does not currently allow unattended apply.");
    status = "manual_gate";
    autoDispatchAllowed = false;
    blockedPhases = unique([...blockedPhases, "promote"]);
    nextAction = "Switch the job to prepared mode or resolve the governance blockers before dispatching again.";
  }

  return {
    projectKey,
    status,
    autoDispatchAllowed,
    autoApplyAllowed,
    recommendedPromotionMode,
    stabilityStatus,
    stableStreak: Number(stability?.stableStreak ?? 0),
    unstableStreak: Number(stability?.unstableStreak ?? 0),
    unattendedPhases,
    blockedPhases,
    reasons,
    nextAction
  };
}

export function renderProjectRunGovernanceSummary({
  projectKey,
  generatedAt,
  governance
}) {
  return `# Patternpilot Run Governance

- project: ${projectKey}
- generated_at: ${generatedAt}
- status: ${governance.status}
- auto_dispatch_allowed: ${governance.autoDispatchAllowed ? "yes" : "no"}
- auto_apply_allowed: ${governance.autoApplyAllowed ? "yes" : "no"}
- recommended_promotion_mode: ${governance.recommendedPromotionMode}
- stability_status: ${governance.stabilityStatus ?? "-"}
- stable_streak: ${governance.stableStreak ?? 0}
- unstable_streak: ${governance.unstableStreak ?? 0}
- unattended_phases: ${governance.unattendedPhases.join(", ") || "-"}
- blocked_phases: ${governance.blockedPhases.join(", ") || "-"}

## Reasons

${governance.reasons.map((item) => `- ${item}`).join("\n") || "- none"}

## Next Action

- ${governance.nextAction}
`;
}
