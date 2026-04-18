function normalizeStatus(value, fallback) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized || fallback;
}

export function describeGovernanceOperatingPosture(governance = {}) {
  const status = normalizeStatus(governance.status, "manual_gate");

  switch (status) {
    case "baseline_required":
      return {
        postureKey: "manual_only",
        operatorMode: "baseline_first",
        summary: "No deliberate baseline run exists yet, so automation stays manual until the first real run is reviewed."
      };
    case "manual_requalify":
      return {
        postureKey: "manual_requalify",
        operatorMode: "manual_requalification",
        summary: "Automation is deliberately paused until a human requalifies the project state."
      };
    case "limited_unattended":
      return {
        postureKey: "guarded_unattended",
        operatorMode: "manual_promotion",
        summary: "Automation may continue conservatively, but follow-up review or promotion still stays human-gated."
      };
    case "unattended_ready":
      return {
        postureKey: "unattended_ready",
        operatorMode: "unattended_allowed",
        summary: "Automation may continue unattended right now, with normal monitoring still in place."
      };
    case "manual_gate":
    default:
      return {
        postureKey: "manual_only",
        operatorMode: "manual_first",
        summary: "Automation is currently in a manual-first posture and should not continue unattended yet."
      };
  }
}

export function describePolicyControlOperatingPosture(review = {}) {
  const status = normalizeStatus(review.overallStatus, "no_policy_activity");

  if (status === "no_policy_activity") {
    return {
      postureKey: "dormant",
      operatorMode: "optional",
      summary: "No active policy-control chain is present right now, which is acceptable until policy calibration is intentionally used."
    };
  }

  if (status === "chain_refresh_recommended") {
    return {
      postureKey: "chain_blocked",
      operatorMode: "manual_refresh",
      summary: "The policy-control chain is out of sync and needs a manual refresh before unattended claims are safe."
    };
  }

  if (status === "followup_ready" || status === "applied" || status === "handoff_executed") {
    return {
      postureKey: "clear_followup",
      operatorMode: "guided_followup",
      summary: "The latest policy-control state is coherent and only needs the normal next guided follow-up."
    };
  }

  if (status === "followup_with_care" || status === "apply_with_care") {
    return {
      postureKey: "careful_followup",
      operatorMode: "manual_care",
      summary: "Policy-control is usable, but the current chain still carries a careful manual follow-up requirement."
    };
  }

  return {
    postureKey: "active_followup",
    operatorMode: "guided_manual",
    summary: "Policy-control is active and should continue through the guided next step before unattended claims expand."
  };
}

export function describeAutomationOperatingMode(context = {}) {
  const jobsConfigured = Number(context.jobsConfigured ?? 0) || 0;
  const jobsReady = Number(context.jobsReady ?? 0) || 0;
  const jobsBlocked = Number(context.jobsBlocked ?? 0) || 0;
  const jobsBackoff = Number(context.jobsBackoff ?? 0) || 0;
  const attentionStatus = normalizeStatus(context.attentionStatus, "routine");
  const deliveryPriority = normalizeStatus(context.deliveryPriority, "routine");
  const ackRequiredJobs = Number(context.ackRequiredJobs ?? 0) || 0;
  const guardedJobs = Number(context.guardedJobs ?? 0) || 0;

  if (jobsConfigured <= 0) {
    return {
      modeKey: "core_only",
      operatorMode: "manual_first",
      summary: "Automation is not configured. Patternpilot is operating in local core mode only, which is a healthy default."
    };
  }

  if (ackRequiredJobs > 0 || attentionStatus === "operator_attention_required" || deliveryPriority === "urgent") {
    return {
      modeKey: "operator_attention_required",
      operatorMode: "manual_attention",
      summary: "Automation is configured, but a latched or urgent operator attention signal currently outranks unattended execution."
    };
  }

  if (jobsReady > 0 && guardedJobs === 0 && jobsBlocked === 0 && jobsBackoff === 0) {
    return {
      modeKey: "unattended_capable",
      operatorMode: "conservative_unattended",
      summary: "Automation is configured and currently has clean dispatchable capacity."
    };
  }

  if (jobsReady > 0 || guardedJobs > 0) {
    return {
      modeKey: "guarded_automation",
      operatorMode: "guided_manual",
      summary: "Automation is configured, but it is intentionally running in a guarded mode with manual checkpoints."
    };
  }

  if (jobsBlocked > 0 || jobsBackoff > 0) {
    return {
      modeKey: "paused_automation",
      operatorMode: "manual_recovery",
      summary: "Automation is configured, but current jobs are blocked or waiting in recovery/backoff."
    };
  }

  return {
    modeKey: "configured_idle",
    operatorMode: "manual_optional",
    summary: "Automation is configured, but nothing is actively dispatchable right now."
  };
}
