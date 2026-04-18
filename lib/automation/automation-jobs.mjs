import fs from "node:fs/promises";
import path from "node:path";
import {
  describeAutomationOperatingMode,
  describeGovernanceOperatingPosture,
  describePolicyControlOperatingPosture
} from "./operating-mode.mjs";

const ALERT_SEVERITY_ORDER = {
  high: 0,
  medium: 1,
  low: 2
};

const ALERT_CATEGORY_ORDER = {
  dispatch_ack_required: 0,
  repeated_governance_block: 1,
  repeated_policy_control_block: 2,
  blocked_manual: 3,
  blocked_requalify: 4,
  governance_manual_gate: 5,
  governance_requalify: 6,
  policy_control_chain_refresh: 7,
  policy_control_followup: 8,
  extended_backoff: 9,
  repeated_retryable_failures: 10,
  drift_attention: 11,
  no_ready_jobs: 12
};

const DELIVERY_PRIORITY_ORDER = {
  routine: 0,
  elevated: 1,
  urgent: 2
};

const OPERATOR_ATTENTION_ALERT_CATEGORIES = new Set([
  "dispatch_ack_required",
  "repeated_governance_block",
  "repeated_policy_control_block"
]);

function toIso(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function addMinutes(isoValue, minutes) {
  const base = new Date(isoValue);
  return new Date(base.getTime() + (minutes * 60 * 1000)).toISOString();
}

function diffMinutes(fromIso, toIso) {
  const fromDate = new Date(fromIso);
  const toDate = new Date(toIso);
  return Math.floor((toDate.getTime() - fromDate.getTime()) / (1000 * 60));
}

function isRecentIso(fromIso, toIso, windowMinutes) {
  if (!fromIso || !toIso) {
    return false;
  }
  const diff = diffMinutes(fromIso, toIso);
  return diff >= 0 && diff <= windowMinutes;
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function normalizeAlertSeverity(value) {
  const severity = String(value ?? "low").trim().toLowerCase();
  return ALERT_SEVERITY_ORDER[severity] != null ? severity : "low";
}

function normalizeDeliveryPriority(value) {
  const priority = String(value ?? "routine").trim().toLowerCase();
  return DELIVERY_PRIORITY_ORDER[priority] != null ? priority : "routine";
}

function promoteDeliveryPriority(current, candidate) {
  const normalizedCurrent = normalizeDeliveryPriority(current);
  const normalizedCandidate = normalizeDeliveryPriority(candidate);
  return DELIVERY_PRIORITY_ORDER[normalizedCandidate] > DELIVERY_PRIORITY_ORDER[normalizedCurrent]
    ? normalizedCandidate
    : normalizedCurrent;
}

function sortAutomationAlerts(alerts = []) {
  return [...alerts]
    .map((alert, index) => ({ alert, index }))
    .sort((left, right) => {
      const severityDiff =
        (ALERT_SEVERITY_ORDER[normalizeAlertSeverity(left.alert?.severity)] ?? 99)
        - (ALERT_SEVERITY_ORDER[normalizeAlertSeverity(right.alert?.severity)] ?? 99);
      if (severityDiff !== 0) {
        return severityDiff;
      }

      const categoryDiff =
        (ALERT_CATEGORY_ORDER[String(left.alert?.category ?? "")] ?? 99)
        - (ALERT_CATEGORY_ORDER[String(right.alert?.category ?? "")] ?? 99);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }

      const jobDiff = String(left.alert?.jobName ?? "").localeCompare(String(right.alert?.jobName ?? ""));
      if (jobDiff !== 0) {
        return jobDiff;
      }

      const messageDiff = String(left.alert?.message ?? "").localeCompare(String(right.alert?.message ?? ""));
      if (messageDiff !== 0) {
        return messageDiff;
      }

      return left.index - right.index;
    })
    .map(({ alert }) => alert);
}

function readPolicyControlState(job) {
  const jobState = job?.jobState ?? {};
  return {
    status: jobState.policyControlStatus ?? job?.livePolicyControl?.overallStatus ?? "no_policy_activity",
    stage: jobState.policyControlStage ?? job?.livePolicyControl?.currentStageKey ?? "-",
    decisionStatus: jobState.policyControlDecisionStatus ?? job?.livePolicyControl?.currentDecisionStatus ?? "-",
    nextCommand: jobState.policyControlNextCommand ?? job?.livePolicyControl?.nextCommand ?? "npm run patternpilot -- policy-control",
    topBlocker: jobState.policyControlTopBlocker ?? job?.livePolicyControl?.topBlocker ?? "Inspect the current policy-control state."
  };
}

function readDispatchHistoryState(job) {
  const jobState = job?.jobState ?? {};
  const liveHistory = job?.liveDispatchHistory ?? {};
  return {
    totalEntries: Number(jobState.dispatchDecisionCount ?? liveHistory.totalEntries ?? 0) || 0,
    blockedCount: Number(jobState.dispatchBlockedCount ?? liveHistory.blockedCount ?? 0) || 0,
    reroutedCount: Number(jobState.dispatchReroutedCount ?? liveHistory.reroutedCount ?? 0) || 0,
    governanceBlockedCount: Number(jobState.dispatchGovernanceBlockedCount ?? liveHistory.governanceBlockedCount ?? 0) || 0,
    policyBlockedCount: Number(jobState.dispatchPolicyBlockedCount ?? liveHistory.policyBlockedCount ?? 0) || 0,
    blockedStreak: Number(jobState.dispatchBlockedStreak ?? liveHistory.blockedStreak ?? 0) || 0,
    governanceBlockedStreak: Number(jobState.dispatchGovernanceBlockedStreak ?? liveHistory.governanceBlockedStreak ?? 0) || 0,
    policyBlockedStreak: Number(jobState.dispatchPolicyBlockedStreak ?? liveHistory.policyBlockedStreak ?? 0) || 0,
    blockedCountSinceAck: Number(jobState.dispatchBlockedSinceAckCount ?? liveHistory.blockedCountSinceAck ?? 0) || 0,
    governanceBlockedCountSinceAck: Number(jobState.dispatchGovernanceBlockedSinceAckCount ?? liveHistory.governanceBlockedCountSinceAck ?? 0) || 0,
    policyBlockedCountSinceAck: Number(jobState.dispatchPolicyBlockedSinceAckCount ?? liveHistory.policyBlockedCountSinceAck ?? 0) || 0,
    blockedStreakSinceAck: Number(jobState.dispatchBlockedSinceAckStreak ?? liveHistory.blockedStreakSinceAck ?? 0) || 0,
    governanceBlockedStreakSinceAck: Number(jobState.dispatchGovernanceBlockedSinceAckStreak ?? liveHistory.governanceBlockedStreakSinceAck ?? 0) || 0,
    policyBlockedStreakSinceAck: Number(jobState.dispatchPolicyBlockedSinceAckStreak ?? liveHistory.policyBlockedStreakSinceAck ?? 0) || 0,
    lastSelectionStatus: jobState.lastDispatchStatus ?? liveHistory.lastSelectionStatus ?? null,
    lastReason: jobState.lastDispatchReason ?? liveHistory.lastReason ?? null,
    lastDispatchGateStatus: jobState.lastDispatchGateStatus ?? liveHistory.lastDispatchGateStatus ?? null,
    acknowledgedAt: jobState.operatorAckAcknowledgedAt ?? null
  };
}

function readDispatchAckState(job) {
  const jobState = job?.jobState ?? {};
  const jobName = job?.name ?? jobState.jobName ?? "job";
  const defaultAckCommand = `npm run patternpilot -- automation-job-ack --automation-job ${jobName}`;
  return {
    required: Boolean(jobState.operatorAckRequired ?? false),
    category: jobState.operatorAckCategory ?? null,
    sourceStatus: jobState.operatorAckSourceStatus ?? null,
    triggeredAt: jobState.operatorAckTriggeredAt ?? null,
    acknowledgedAt: jobState.operatorAckAcknowledgedAt ?? null,
    reason: jobState.operatorAckReason ?? null,
    nextAction: jobState.operatorAckNextAction ?? `Acknowledge the latch deliberately before unattended dispatch resumes: ${defaultAckCommand}`,
    command: jobState.operatorAckCommand ?? defaultAckCommand
  };
}

export function assessAutomationPolicyControl(job) {
  const policy = readPolicyControlState(job);
  const dispatchAllowed = policy.status === "no_policy_activity" || policy.status === "followup_ready";
  const blockedCategory = policy.status === "chain_refresh_recommended"
    ? "policy_control_chain_refresh_blocked"
    : "policy_control_followup_blocked";

  return {
    ...policy,
    autoDispatchAllowed: dispatchAllowed,
    blocked: !dispatchAllowed,
    dispatchStatus: dispatchAllowed ? "dispatch_allowed" : blockedCategory,
    reason: dispatchAllowed
      ? `Policy control is '${policy.status}', so unattended dispatch may continue.`
      : `${job?.name ?? "job"} has policy-control status '${policy.status}' at stage '${policy.stage}' and requires operator follow-up before unattended dispatch.`,
    nextAction: dispatchAllowed
      ? null
      : `${policy.topBlocker} Next: ${policy.nextCommand}`
  };
}

function buildAutomationDispatchEscalation(job, gate, options = {}) {
  if (!gate || gate.autoDispatchAllowed) {
    return null;
  }

  const history = readDispatchHistoryState(job);
  const governanceThreshold = Math.max(2, Number(options.governanceBlockedThreshold ?? 2) || 2);
  const policyThreshold = Math.max(2, Number(options.policyBlockedThreshold ?? 2) || 2);
  const governanceBlockedStreak = history.acknowledgedAt ? history.governanceBlockedStreakSinceAck : history.governanceBlockedStreak;
  const policyBlockedStreak = history.acknowledgedAt ? history.policyBlockedStreakSinceAck : history.policyBlockedStreak;
  const governanceBlockedCount = history.acknowledgedAt ? history.governanceBlockedCountSinceAck : history.governanceBlockedCount;
  const policyBlockedCount = history.acknowledgedAt ? history.policyBlockedCountSinceAck : history.policyBlockedCount;

  if (gate.status === "governance_blocked" && governanceBlockedStreak >= governanceThreshold) {
    return {
      status: "governance_escalated",
      category: "repeated_governance_block",
      blocked: true,
      streak: governanceBlockedStreak,
      totalBlocked: governanceBlockedCount,
      reason: `${job?.name ?? "job"} has been governance-blocked ${governanceBlockedStreak} dispatch attempts in a row.`,
      nextAction: gate.nextAction
        ? `Repeated governance block detected. ${gate.nextAction}`
        : "Inspect the repeated governance-blocked dispatch attempts before letting unattended dispatch continue."
    };
  }

  if (gate.status === "policy_control_blocked" && policyBlockedStreak >= policyThreshold) {
    return {
      status: "policy_control_escalated",
      category: "repeated_policy_control_block",
      blocked: true,
      streak: policyBlockedStreak,
      totalBlocked: policyBlockedCount,
      reason: `${job?.name ?? "job"} has been policy-control-blocked ${policyBlockedStreak} dispatch attempts in a row.`,
      nextAction: gate.nextAction
        ? `Repeated policy-control block detected. ${gate.nextAction}`
        : "Inspect the repeated policy-control-blocked dispatch attempts before letting unattended dispatch continue."
    };
  }

  return null;
}

export function assessAutomationDispatchGate(job) {
  if (!job) {
    return {
      status: "missing_job",
      autoDispatchAllowed: false,
      reason: "Automation job is missing.",
      nextAction: null
    };
  }

  if (job.status !== "ready") {
    return {
      status: "job_not_ready",
      autoDispatchAllowed: false,
      reason: `${job.name} is currently '${job.status}' (${job.reason}).`,
      nextAction: null
    };
  }

  const ackState = readDispatchAckState(job);
  if (ackState.required) {
    return {
      status: "operator_ack_required",
      autoDispatchAllowed: false,
      reason: ackState.reason
        ?? `${job.name} has a latched dispatch escalation and requires deliberate operator acknowledgment before unattended dispatch may continue.`,
      nextAction: ackState.nextAction,
      ackState
    };
  }

  if (job.liveGovernance?.autoDispatchAllowed === false) {
    const gate = {
      status: "governance_blocked",
      autoDispatchAllowed: false,
      reason: job.liveGovernance.nextAction ?? `${job.name} currently requires a manual governance gate.`,
      nextAction: job.liveGovernance.nextAction ?? null
    };
    const escalation = buildAutomationDispatchEscalation(job, gate);
    return escalation
      ? {
          ...gate,
          status: escalation.status,
          reason: `${escalation.reason} ${gate.reason}`.trim(),
          nextAction: escalation.nextAction,
          escalation
        }
      : gate;
  }

  const policyGate = assessAutomationPolicyControl(job);
  if (!policyGate.autoDispatchAllowed) {
    const gate = {
      status: "policy_control_blocked",
      autoDispatchAllowed: false,
      reason: policyGate.reason,
      nextAction: policyGate.nextAction,
      policyGate
    };
    const escalation = buildAutomationDispatchEscalation(job, gate);
    return escalation
      ? {
          ...gate,
          status: escalation.status,
          reason: `${escalation.reason} ${gate.reason}`.trim(),
          nextAction: escalation.nextAction,
          escalation
        }
      : gate;
  }

  return {
    status: "dispatch_allowed",
    autoDispatchAllowed: true,
    reason: `${job.name} is dispatchable.`,
    nextAction: null,
    policyGate
  };
}

export async function loadAutomationJobs(rootDir, config) {
  const jobsPath = path.join(rootDir, config.automationJobsFile ?? "automation/patternpilot-jobs.json");
  const raw = await fs.readFile(jobsPath, "utf8");
  const parsed = JSON.parse(raw);
  return {
    jobsPath,
    jobs: Array.isArray(parsed.jobs) ? parsed.jobs : []
  };
}

export async function loadAutomationJobState(rootDir, config) {
  const statePath = path.join(rootDir, config.automationJobStateFile ?? "state/automation_jobs_state.json");
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      statePath,
      state: parsed
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        statePath,
        state: {
          schemaVersion: 1,
          updatedAt: null,
          jobs: {}
        }
      };
    }
    throw error;
  }
}

export async function writeAutomationJobState(rootDir, config, state, dryRun = false) {
  const statePath = path.join(rootDir, config.automationJobStateFile ?? "state/automation_jobs_state.json");
  if (dryRun) {
    return statePath;
  }
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return statePath;
}

export async function writeAutomationAlertArtifacts(rootDir, config, payload, dryRun = false) {
  const jsonPath = path.join(rootDir, config.automationAlertsJsonFile ?? "state/automation_alerts.json");
  const markdownPath = path.join(rootDir, config.automationAlertsMarkdownFile ?? "state/automation_alerts.md");
  if (dryRun) {
    return {
      jsonPath,
      markdownPath
    };
  }
  await fs.mkdir(path.dirname(jsonPath), { recursive: true });
  await fs.mkdir(path.dirname(markdownPath), { recursive: true });
  await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await fs.writeFile(markdownPath, `${payload.markdown}\n`, "utf8");
  return {
    jsonPath,
    markdownPath
  };
}

export async function loadAutomationDispatchHistory(rootDir, config) {
  const historyPath = path.join(rootDir, config.automationDispatchHistoryFile ?? "state/automation_dispatch_history.json");
  try {
    const raw = await fs.readFile(historyPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      historyPath,
      history: {
        schemaVersion: 1,
        updatedAt: parsed.updatedAt ?? null,
        entries: Array.isArray(parsed.entries) ? parsed.entries : []
      }
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        historyPath,
        history: {
          schemaVersion: 1,
          updatedAt: null,
          entries: []
        }
      };
    }
    throw error;
  }
}

export async function writeAutomationDispatchHistory(rootDir, config, history, dryRun = false) {
  const historyPath = path.join(rootDir, config.automationDispatchHistoryFile ?? "state/automation_dispatch_history.json");
  if (dryRun) {
    return historyPath;
  }
  await fs.mkdir(path.dirname(historyPath), { recursive: true });
  await fs.writeFile(historyPath, `${JSON.stringify(history, null, 2)}\n`, "utf8");
  return historyPath;
}

function isBlockedDispatchStatus(status) {
  return status === "governance_blocked"
    || status === "policy_control_blocked"
    || status === "governance_escalated"
    || status === "policy_control_escalated"
    || status === "operator_ack_required"
    || status === "job_not_ready";
}

function isGovernanceBlockedDispatchStatus(status) {
  return status === "governance_blocked" || status === "governance_escalated";
}

function isPolicyBlockedDispatchStatus(status) {
  return status === "policy_control_blocked" || status === "policy_control_escalated";
}

function normalizeDispatchHistoryEntries(history) {
  return Array.isArray(history?.entries) ? history.entries : [];
}

function sortDispatchHistoryEntries(entries = []) {
  return [...entries].sort((left, right) => {
    const leftTime = new Date(left?.recordedAt ?? 0).getTime();
    const rightTime = new Date(right?.recordedAt ?? 0).getTime();
    return rightTime - leftTime;
  });
}

function countLeadingEntries(entries, predicate) {
  let count = 0;
  for (const entry of entries) {
    if (!predicate(entry)) {
      break;
    }
    count += 1;
  }
  return count;
}

export function buildAutomationDispatchHistoryEntry({
  generatedAt,
  requestedJobName = null,
  selection,
  evaluations = [],
  dryRun = false
}) {
  const nextReadyJob = selectNextAutomationJob(evaluations);
  const nextDispatchableJob = selectNextDispatchableAutomationJob(evaluations);
  const selectedJob = selection?.job ?? null;
  const dispatchGate = selectedJob ? assessAutomationDispatchGate(selectedJob) : null;
  const reroutedFromJobName =
    !requestedJobName
    && selection?.status === "selected"
    && nextReadyJob?.name
    && selectedJob?.name
    && selectedJob.name !== nextReadyJob.name
      ? nextReadyJob.name
      : null;
  const focusJobName =
    requestedJobName
    ?? reroutedFromJobName
    ?? selectedJob?.name
    ?? nextReadyJob?.name
    ?? nextDispatchableJob?.name
    ?? null;

  return {
    recordedAt: generatedAt,
    dryRun,
    requestedJobName,
    focusJobName,
    nextReadyJobName: nextReadyJob?.name ?? null,
    nextDispatchableJobName: nextDispatchableJob?.name ?? null,
    selectionStatus: selection?.status ?? "unknown",
    selectionReason: selection?.reason ?? null,
    selectedJobName: selectedJob?.name ?? null,
    selectedCommand: selectedJob?.command ?? null,
    reroutedFromJobName,
    reroutedToJobName: reroutedFromJobName ? selectedJob?.name ?? null : null,
    governanceStatus: selectedJob?.liveGovernance?.status ?? null,
    governanceNextAction: selectedJob?.liveGovernance?.nextAction ?? null,
    policyControlStatus: selectedJob?.livePolicyControl?.overallStatus ?? null,
    policyControlStage: selectedJob?.livePolicyControl?.currentStageKey ?? null,
    dispatchGateStatus: dispatchGate?.status ?? null,
    dispatchGateReason: dispatchGate?.reason ?? null,
    dispatchGateNextAction: dispatchGate?.nextAction ?? null
  };
}

export async function appendAutomationDispatchHistory(rootDir, config, entry, options = {}) {
  const maxEntries = Math.max(20, Number(options.maxEntries ?? 500) || 500);
  const { historyPath, history } = await loadAutomationDispatchHistory(rootDir, config);
  const nextHistory = {
    schemaVersion: 1,
    updatedAt: entry.recordedAt ?? new Date().toISOString(),
    entries: [entry, ...normalizeDispatchHistoryEntries(history)].slice(0, maxEntries)
  };
  await writeAutomationDispatchHistory(rootDir, config, nextHistory, false);
  return {
    historyPath,
    history: nextHistory
  };
}

export function summarizeAutomationDispatchHistoryForJob(history, jobName, options = {}) {
  const referenceAt = options.referenceAt ?? null;
  const sortedEntries = sortDispatchHistoryEntries(
    normalizeDispatchHistoryEntries(history).filter((entry) =>
      entry.focusJobName === jobName
      || entry.selectedJobName === jobName
      || entry.reroutedFromJobName === jobName
      || entry.reroutedToJobName === jobName
    )
  );
  const focusEntries = sortedEntries.filter((entry) => entry.focusJobName === jobName);
  const lastEntry = focusEntries[0] ?? sortedEntries[0] ?? null;
  const blockedEntries = focusEntries.filter((entry) => isBlockedDispatchStatus(entry.selectionStatus));
  const governanceBlockedEntries = focusEntries.filter((entry) => isGovernanceBlockedDispatchStatus(entry.selectionStatus));
  const policyBlockedEntries = focusEntries.filter((entry) => isPolicyBlockedDispatchStatus(entry.selectionStatus));
  const focusEntriesSinceReference = referenceAt
    ? focusEntries.filter((entry) => new Date(entry.recordedAt).getTime() > new Date(referenceAt).getTime())
    : focusEntries;
  const blockedEntriesSinceReference = focusEntriesSinceReference.filter((entry) => isBlockedDispatchStatus(entry.selectionStatus));
  const governanceBlockedEntriesSinceReference = focusEntriesSinceReference.filter((entry) => isGovernanceBlockedDispatchStatus(entry.selectionStatus));
  const policyBlockedEntriesSinceReference = focusEntriesSinceReference.filter((entry) => isPolicyBlockedDispatchStatus(entry.selectionStatus));

  return {
    jobName,
    referenceAt,
    totalEntries: focusEntries.length,
    selectedCount: focusEntries.filter((entry) => entry.selectionStatus === "selected" && !entry.reroutedToJobName).length,
    blockedCount: blockedEntries.length,
    reroutedCount: focusEntries.filter((entry) => Boolean(entry.reroutedToJobName)).length,
    receivedRerouteCount: sortedEntries.filter((entry) => entry.reroutedToJobName === jobName).length,
    dryRunCount: focusEntries.filter((entry) => entry.dryRun).length,
    governanceBlockedCount: governanceBlockedEntries.length,
    policyBlockedCount: policyBlockedEntries.length,
    blockedStreak: countLeadingEntries(focusEntries, (entry) => isBlockedDispatchStatus(entry.selectionStatus)),
    governanceBlockedStreak: countLeadingEntries(focusEntries, (entry) => isGovernanceBlockedDispatchStatus(entry.selectionStatus)),
    policyBlockedStreak: countLeadingEntries(focusEntries, (entry) => isPolicyBlockedDispatchStatus(entry.selectionStatus)),
    blockedCountSinceAck: blockedEntriesSinceReference.length,
    governanceBlockedCountSinceAck: governanceBlockedEntriesSinceReference.length,
    policyBlockedCountSinceAck: policyBlockedEntriesSinceReference.length,
    blockedStreakSinceAck: countLeadingEntries(focusEntriesSinceReference, (entry) => isBlockedDispatchStatus(entry.selectionStatus)),
    governanceBlockedStreakSinceAck: countLeadingEntries(focusEntriesSinceReference, (entry) => isGovernanceBlockedDispatchStatus(entry.selectionStatus)),
    policyBlockedStreakSinceAck: countLeadingEntries(focusEntriesSinceReference, (entry) => isPolicyBlockedDispatchStatus(entry.selectionStatus)),
    lastRecordedAt: lastEntry?.recordedAt ?? null,
    lastSelectionStatus: lastEntry?.selectionStatus ?? null,
    lastReason: lastEntry?.selectionReason ?? null,
    lastDispatchGateStatus: lastEntry?.dispatchGateStatus ?? null
  };
}

export function summarizeAutomationDispatchHistory(history, options = {}) {
  const limit = Math.max(1, Number(options.limit ?? 20) || 20);
  const jobName = options.jobName ?? null;
  const entries = sortDispatchHistoryEntries(normalizeDispatchHistoryEntries(history));
  const filteredEntries = jobName
    ? entries.filter((entry) =>
      entry.focusJobName === jobName
      || entry.selectedJobName === jobName
      || entry.reroutedFromJobName === jobName
      || entry.reroutedToJobName === jobName
    )
    : entries;
  const jobNames = [...new Set(filteredEntries.map((entry) => entry.focusJobName).filter(Boolean))];

  return {
    jobName,
    totalEntries: filteredEntries.length,
    blockedCount: filteredEntries.filter((entry) => isBlockedDispatchStatus(entry.selectionStatus)).length,
    governanceBlockedCount: filteredEntries.filter((entry) => isGovernanceBlockedDispatchStatus(entry.selectionStatus)).length,
    policyBlockedCount: filteredEntries.filter((entry) => isPolicyBlockedDispatchStatus(entry.selectionStatus)).length,
    reroutedCount: filteredEntries.filter((entry) => Boolean(entry.reroutedToJobName)).length,
    selectedCount: filteredEntries.filter((entry) => entry.selectionStatus === "selected").length,
    dryRunCount: filteredEntries.filter((entry) => entry.dryRun).length,
    jobSummaries: jobNames.map((name) => summarizeAutomationDispatchHistoryForJob(history, name)),
    recentEntries: filteredEntries.slice(0, limit)
  };
}

export function renderAutomationDispatchHistorySummary({ generatedAt, summary }) {
  const recentLines = summary.recentEntries.length > 0
    ? summary.recentEntries.map((entry) =>
      `- ${entry.recordedAt} :: focus=${entry.focusJobName ?? "-"} :: selection=${entry.selectionStatus} :: selected=${entry.selectedJobName ?? "-"} :: rerouted_from=${entry.reroutedFromJobName ?? "-"} :: dispatch_gate=${entry.dispatchGateStatus ?? "-"} :: reason=${entry.selectionReason ?? "-"}`
    ).join("\n")
    : "- none";
  const jobLines = summary.jobSummaries.length > 0
    ? summary.jobSummaries.map((job) =>
      `- ${job.jobName}: entries=${job.totalEntries} | blocked=${job.blockedCount} | governance_blocked=${job.governanceBlockedCount} | policy_blocked=${job.policyBlockedCount} | blocked_streak=${job.blockedStreak} | rerouted=${job.reroutedCount} | selected=${job.selectedCount} | last_status=${job.lastSelectionStatus ?? "-"}`
    ).join("\n")
    : "- none";

  return `# Patternpilot Automation Dispatch History

- generated_at: ${generatedAt}
- filter_job: ${summary.jobName ?? "-"}
- entries: ${summary.totalEntries}
- blocked: ${summary.blockedCount}
- governance_blocked: ${summary.governanceBlockedCount}
- policy_blocked: ${summary.policyBlockedCount}
- rerouted: ${summary.reroutedCount}
- selected: ${summary.selectedCount}
- dry_runs: ${summary.dryRunCount}

## Job Totals

${jobLines}

## Recent Decisions

${recentLines}
`;
}

export function updateAutomationJobState(state, update) {
  const next = {
    schemaVersion: 1,
    updatedAt: update.createdAt,
    jobs: {
      ...(state?.jobs ?? {})
    }
  };
  const previous = next.jobs[update.jobName] ?? {};
  const retryableFailures = Array.isArray(update.failures)
    ? update.failures.filter((failure) => failure.retryable)
    : [];
  const blockingFailures = Array.isArray(update.failures)
    ? update.failures.filter((failure) => !failure.retryable)
    : [];
  const recommendedDelayMinutes = retryableFailures.length > 0
    ? Math.max(...retryableFailures.map((failure) => Number(failure.recommendedDelayMinutes ?? 0) || 0))
    : null;
  const blockedManual = blockingFailures.length > 0;
  const lastStatus = update.counts?.failed > 0 ? "failed" : update.counts?.completed_with_blocks > 0 ? "completed_with_blocks" : "completed";
  const primaryProjectRun = Array.isArray(update.projectRuns) && update.projectRuns.length === 1
    ? update.projectRuns[0]
    : null;
  const resumeRecommendation = update.failures?.[0]?.resumeRecommendation ?? primaryProjectRun?.errorResumeRecommendation ?? null;
  const consecutiveRetryableFailures = blockedManual
    ? 0
    : retryableFailures.length > 0
      ? Number(previous.consecutiveRetryableFailures ?? 0) + 1
      : 0;
  const governanceStatus = primaryProjectRun?.metrics?.runGovernanceStatus ?? previous.governanceStatus ?? null;
  const policyControlStatus = primaryProjectRun?.metrics?.policyControlStatus ?? previous.policyControlStatus ?? "no_policy_activity";
  const policyControlStage = primaryProjectRun?.metrics?.policyControlStage ?? previous.policyControlStage ?? null;
  const policyControlDecisionStatus = primaryProjectRun?.metrics?.policyControlDecisionStatus ?? previous.policyControlDecisionStatus ?? null;
  const policyControlNextCommand = primaryProjectRun?.metrics?.policyControlNextCommand ?? previous.policyControlNextCommand ?? null;
  const policyControlTopBlocker = primaryProjectRun?.metrics?.policyControlTopBlocker ?? previous.policyControlTopBlocker ?? null;
  const stableStreak = Number(primaryProjectRun?.metrics?.stableStreak ?? previous.stableStreak ?? 0);
  const unstableStreak = Number(primaryProjectRun?.metrics?.unstableStreak ?? previous.unstableStreak ?? 0);
  const requalificationTriggered = governanceStatus === "manual_requalify";
  const requalificationCanClear = !blockedManual
    && retryableFailures.length === 0
    && governanceStatus
    && governanceStatus !== "manual_requalify"
    && stableStreak >= 2;
  const requalificationRequired = requalificationTriggered
    ? true
    : requalificationCanClear
      ? false
      : Boolean(previous.requalificationRequired ?? false);
  const requalificationTriggeredAt = requalificationTriggered
    ? previous.requalificationTriggeredAt ?? update.createdAt
    : previous.requalificationTriggeredAt ?? null;
  const requalificationClearedAt = requalificationCanClear
    ? update.createdAt
    : previous.requalificationClearedAt ?? null;
  const requalificationReason = requalificationTriggered
    ? (primaryProjectRun?.metrics?.governanceNextAction ?? previous.requalificationReason ?? "manual_requalify")
    : previous.requalificationReason ?? null;

  next.jobs[update.jobName] = {
    jobName: update.jobName,
    updatedAt: update.createdAt,
    lastRunId: update.runId,
    lastRunAt: update.createdAt,
    lastStatus,
    lastProjectCounts: update.counts ?? {},
    lastFailures: update.failures ?? [],
    retryable: retryableFailures.length > 0 && !blockedManual,
    recommendedDelayMinutes,
    nextRetryAt: recommendedDelayMinutes != null ? addMinutes(update.createdAt, recommendedDelayMinutes) : null,
    blockedManual,
    consecutiveRetryableFailures,
    runKind: primaryProjectRun?.metrics?.runKind ?? previous.runKind ?? null,
    recommendedFocus: primaryProjectRun?.metrics?.recommendedFocus ?? previous.recommendedFocus ?? null,
    executionPolicy: primaryProjectRun?.metrics?.executionPolicy ?? previous.executionPolicy ?? null,
    defaultPromotionMode: primaryProjectRun?.metrics?.defaultPromotionMode ?? previous.defaultPromotionMode ?? null,
    driftStatus: primaryProjectRun?.metrics?.runDriftStatus ?? previous.driftStatus ?? null,
    driftSignals: primaryProjectRun?.metrics?.runDriftSignals ?? previous.driftSignals ?? 0,
    stabilityStatus: primaryProjectRun?.metrics?.runStabilityStatus ?? previous.stabilityStatus ?? null,
    stableStreak,
    unstableStreak,
    governanceStatus,
    policyControlStatus,
    policyControlStage,
    policyControlDecisionStatus,
    policyControlNextCommand,
    policyControlTopBlocker,
    autoDispatchAllowed: primaryProjectRun?.metrics?.autoDispatchAllowed ?? previous.autoDispatchAllowed ?? null,
    autoApplyAllowed: primaryProjectRun?.metrics?.autoApplyAllowed ?? previous.autoApplyAllowed ?? null,
    governanceNextAction: primaryProjectRun?.metrics?.governanceNextAction ?? previous.governanceNextAction ?? null,
    recommendedGovernancePromotionMode: primaryProjectRun?.metrics?.recommendedPromotionMode ?? previous.recommendedGovernancePromotionMode ?? null,
    operatorAckRequired: previous.operatorAckRequired ?? false,
    operatorAckCategory: previous.operatorAckCategory ?? null,
    operatorAckSourceStatus: previous.operatorAckSourceStatus ?? null,
    operatorAckTriggeredAt: previous.operatorAckTriggeredAt ?? null,
    operatorAckReason: previous.operatorAckReason ?? null,
    operatorAckNextAction: previous.operatorAckNextAction ?? null,
    operatorAckCommand: previous.operatorAckCommand ?? null,
    operatorAckAcknowledgedAt: previous.operatorAckAcknowledgedAt ?? null,
    operatorAckAcknowledgedReason: previous.operatorAckAcknowledgedReason ?? null,
    requalificationRequired,
    requalificationTriggeredAt,
    requalificationClearedAt,
    requalificationReason,
    resumeRecommendation,
    clearedAfterSuccess: retryableFailures.length === 0 && !blockedManual,
    lastSuccessAt: retryableFailures.length === 0 && !blockedManual ? update.createdAt : previous.lastSuccessAt ?? null
  };

  return next;
}

export function evaluateAutomationJobs(jobs, state, now = new Date()) {
  const nowIso = now.toISOString();
  const evaluations = jobs.map((job) => {
    const jobState = state?.jobs?.[job.name] ?? null;
    const intervalMinutes = Number(job.intervalMinutes ?? 0) || 0;
    const priority = Number(job.priority ?? 50) || 50;
    let status = "ready";
    let reason = "never_run";
    let nextEligibleAt = null;

    if (jobState?.blockedManual) {
      status = "blocked_manual";
      reason = "manual_intervention_required";
    } else if (jobState?.requalificationRequired) {
      status = "blocked_requalify";
      reason = "manual_requalification_required";
    } else if (jobState?.nextRetryAt && jobState.nextRetryAt > nowIso) {
      status = "backoff";
      reason = "retry_backoff_active";
      nextEligibleAt = toIso(jobState.nextRetryAt);
    } else if (intervalMinutes > 0 && jobState?.lastRunAt) {
      const nextIntervalAt = addMinutes(jobState.lastRunAt, intervalMinutes);
      if (nextIntervalAt > nowIso) {
        status = "waiting_interval";
        reason = "interval_not_elapsed";
        nextEligibleAt = nextIntervalAt;
      } else {
        status = "ready";
        reason = "interval_elapsed";
      }
    }

    return {
      ...job,
      priority,
      status,
      reason,
      nextEligibleAt,
      jobState
    };
  });

  evaluations.sort((left, right) => {
    const statusRank = { ready: 0, backoff: 1, waiting_interval: 2, blocked_requalify: 3, blocked_manual: 4 };
    const statusDiff = (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    const priorityDiff = right.priority - left.priority;
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return left.name.localeCompare(right.name);
  });

  return evaluations;
}

export function selectNextAutomationJob(evaluations) {
  return evaluations.find((job) => job.status === "ready") ?? null;
}

export function selectNextDispatchableAutomationJob(evaluations) {
  return evaluations.find((job) => assessAutomationDispatchGate(job).autoDispatchAllowed) ?? null;
}

export function resolveAutomationDispatchJob(evaluations, requestedJobName = null) {
  if (requestedJobName) {
    const job = evaluations.find((item) => item.name === requestedJobName);
    if (!job) {
      return {
        status: "missing_job",
        reason: `Unknown automation job '${requestedJobName}'.`,
        job: null
      };
    }
    const gate = assessAutomationDispatchGate(job);
    if (gate.status === "job_not_ready") {
      return {
        status: gate.status,
        reason: gate.reason,
        job
      };
    }
    if (!gate.autoDispatchAllowed) {
      return {
        status: gate.status,
        reason: gate.reason,
        job
      };
    }
    return {
      status: "selected",
      reason: `Selected requested job '${job.name}'.`,
      job
    };
  }

  const nextDispatchableJob = selectNextDispatchableAutomationJob(evaluations);
  if (nextDispatchableJob) {
    return {
      status: "selected",
      reason: `Selected next dispatchable job '${nextDispatchableJob.name}'.`,
      job: nextDispatchableJob
    };
  }

  const nextReadyJob = selectNextAutomationJob(evaluations);
  if (!nextReadyJob) {
    return {
      status: "no_ready_job",
      reason: "No automation job is currently ready.",
      job: null
    };
  }

  const gate = assessAutomationDispatchGate(nextReadyJob);
  return {
    status: gate.status,
    reason: gate.reason,
    job: nextReadyJob
  };
}

export function clearAutomationJobState(state, jobName, options = {}) {
  const existing = state?.jobs?.[jobName];
  if (!existing) {
    return {
      state,
      result: {
        status: "missing",
        jobName
      }
    };
  }

  const clearedAt = options.clearedAt ?? new Date().toISOString();
  const cleared = {
    ...existing,
    updatedAt: clearedAt,
    retryable: false,
    recommendedDelayMinutes: null,
    nextRetryAt: null,
    blockedManual: false,
    consecutiveRetryableFailures: 0,
    requalificationRequired: false,
    requalificationTriggeredAt: options.keepRequalificationHistory ? existing.requalificationTriggeredAt ?? null : null,
    requalificationClearedAt: clearedAt,
    operatorAckRequired: false,
    operatorAckAcknowledgedAt: existing.operatorAckRequired ? clearedAt : existing.operatorAckAcknowledgedAt ?? null,
    operatorAckAcknowledgedReason: existing.operatorAckRequired ? (options.reason ?? "manual_clear") : existing.operatorAckAcknowledgedReason ?? null,
    manualClearAt: clearedAt,
    manualClearReason: options.reason ?? "manual_clear"
  };

  return {
    state: {
      schemaVersion: 1,
      updatedAt: clearedAt,
      jobs: {
        ...(state?.jobs ?? {}),
        [jobName]: cleared
      }
    },
    result: {
      status: "cleared",
      jobName,
      previous: existing,
      current: cleared
    }
  };
}

export function latchAutomationJobOperatorAck(state, jobName, gate, options = {}) {
  if (!jobName) {
    return {
      state,
      result: {
        status: "missing_job"
      }
    };
  }

  const latchedAt = options.latchedAt ?? new Date().toISOString();
  const reason = gate?.reason ?? options.reason ?? `Repeated dispatch escalation observed for '${jobName}'.`;
  const command = options.command ?? `npm run patternpilot -- automation-job-ack --automation-job ${jobName}`;
  const defaultNextAction = gate?.nextAction
    ? `${gate.nextAction} After review, acknowledge the latch deliberately: ${command}`
    : `Acknowledge the latch deliberately before unattended dispatch resumes: ${command}`;
  const nextAction = options.nextAction ?? defaultNextAction;
  const category = gate?.escalation?.category ?? options.category ?? "dispatch_escalation";
  const sourceStatus = gate?.status ?? options.sourceStatus ?? "operator_ack_required";
  const previous = state?.jobs?.[jobName] ?? {
    jobName
  };
  const alreadyLatched = previous.operatorAckRequired
    && previous.operatorAckCategory === category
    && previous.operatorAckSourceStatus === sourceStatus;
  const current = {
    ...previous,
    jobName,
    updatedAt: latchedAt,
    operatorAckRequired: true,
    operatorAckCategory: category,
    operatorAckSourceStatus: sourceStatus,
    operatorAckTriggeredAt: previous.operatorAckRequired
      ? previous.operatorAckTriggeredAt ?? latchedAt
      : latchedAt,
    operatorAckReason: reason,
    operatorAckNextAction: nextAction,
    operatorAckCommand: command,
    operatorAckAcknowledgedAt: null,
    operatorAckAcknowledgedReason: null
  };

  return {
    state: {
      schemaVersion: 1,
      updatedAt: latchedAt,
      jobs: {
        ...(state?.jobs ?? {}),
        [jobName]: current
      }
    },
    result: {
      status: alreadyLatched ? "already_latched" : "latched",
      jobName,
      previous,
      current
    }
  };
}

export function acknowledgeAutomationJobState(state, jobName, options = {}) {
  const existing = state?.jobs?.[jobName];
  if (!existing) {
    return {
      state,
      result: {
        status: "missing",
        jobName
      }
    };
  }

  if (!existing.operatorAckRequired) {
    return {
      state,
      result: {
        status: "not_required",
        jobName,
        current: existing
      }
    };
  }

  const acknowledgedAt = options.acknowledgedAt ?? new Date().toISOString();
  const current = {
    ...existing,
    updatedAt: acknowledgedAt,
    operatorAckRequired: false,
    operatorAckAcknowledgedAt: acknowledgedAt,
    operatorAckAcknowledgedReason: options.reason ?? "manual_ack"
  };

  return {
    state: {
      schemaVersion: 1,
      updatedAt: acknowledgedAt,
      jobs: {
        ...(state?.jobs ?? {}),
        [jobName]: current
      }
    },
    result: {
      status: "acknowledged",
      jobName,
      previous: existing,
      current
    }
  };
}

export function buildAutomationAlerts(evaluations, options = {}) {
  const nowIso = (options.now ?? new Date()).toISOString();
  const backoffAlertMinutes = Math.max(1, Number(options.backoffAlertMinutes ?? 60) || 60);
  const retryFailureThreshold = Math.max(1, Number(options.retryFailureThreshold ?? 2) || 2);
  const alerts = [];

  for (const job of evaluations) {
    const jobState = job.jobState ?? {};
    const policyGate = assessAutomationPolicyControl(job);
    const dispatchGate = assessAutomationDispatchGate(job);
    const policyControlStatus = policyGate.status;
    const policyControlStage = policyGate.stage;
    const policyControlNextCommand = policyGate.nextCommand;
    const policyControlTopBlocker = policyGate.topBlocker;
    if (job.status === "blocked_manual") {
      alerts.push({
        severity: "high",
        category: "blocked_manual",
        jobName: job.name,
        message: `${job.name} is blocked for manual intervention.`,
        nextAction: jobState.resumeRecommendation?.nextAction ?? "Inspect the last failure, then clear the job state once the underlying issue is fixed."
      });
      continue;
    }

    if (job.status === "blocked_requalify") {
      alerts.push({
        severity: "high",
        category: "blocked_requalify",
        jobName: job.name,
        message: `${job.name} is paused until manual requalification is cleared.`,
        nextAction: jobState.requalificationReason ?? jobState.governanceNextAction ?? "Run requalification review, then clear the job state once the loop is judged stable again."
      });
      continue;
    }

    if (dispatchGate.status === "operator_ack_required") {
      alerts.push({
        severity: "high",
        category: "dispatch_ack_required",
        jobName: job.name,
        message: `${job.name} has a latched dispatch escalation and requires deliberate acknowledgment before unattended dispatch resumes.`,
        nextAction: dispatchGate.nextAction ?? readDispatchAckState(job).nextAction
      });
      continue;
    }

    if (
      job.status === "backoff" &&
      jobState.nextRetryAt &&
      diffMinutes(jobState.lastRunAt ?? nowIso, jobState.nextRetryAt) >= backoffAlertMinutes
    ) {
      alerts.push({
        severity: "medium",
        category: "extended_backoff",
        jobName: job.name,
        message: `${job.name} is in extended backoff until ${jobState.nextRetryAt}.`,
        nextAction: "Check whether the retryable error still makes sense or whether the job should be manually cleared."
      });
    }

    if ((jobState.consecutiveRetryableFailures ?? 0) >= retryFailureThreshold) {
      alerts.push({
        severity: "medium",
        category: "repeated_retryable_failures",
        jobName: job.name,
        message: `${job.name} has ${jobState.consecutiveRetryableFailures} consecutive retryable failures.`,
        nextAction: jobState.resumeRecommendation?.nextAction ?? "Inspect ops.json and the last failing run before retrying again."
      });
    }

    if (job.status === "ready" && jobState.driftStatus === "attention_required") {
      alerts.push({
        severity: "low",
        category: "drift_attention",
        jobName: job.name,
        message: `${job.name} is ready, but its last known drift status still needs attention.`,
        nextAction: jobState.resumeRecommendation?.nextAction ?? "Inspect run drift before letting unattended promotion continue."
      });
    }

    if (dispatchGate.status === "governance_escalated") {
      alerts.push({
        severity: "high",
        category: "repeated_governance_block",
        jobName: job.name,
        message: `${job.name} has hit a repeated governance dispatch block (${dispatchGate.escalation?.streak ?? 0} consecutive attempts).`,
        nextAction: dispatchGate.nextAction ?? jobState.governanceNextAction ?? "Inspect governance before dispatching this job again."
      });
      continue;
    }

    if (dispatchGate.status === "policy_control_escalated") {
      alerts.push({
        severity: "high",
        category: "repeated_policy_control_block",
        jobName: job.name,
        message: `${job.name} has hit a repeated policy-control dispatch block (${dispatchGate.escalation?.streak ?? 0} consecutive attempts).`,
        nextAction: dispatchGate.nextAction ?? `${policyControlTopBlocker} Next: ${policyControlNextCommand}`
      });
      continue;
    }

    if (job.status === "ready" && jobState.governanceStatus === "manual_gate") {
      alerts.push({
        severity: "high",
        category: "governance_manual_gate",
        jobName: job.name,
        message: `${job.name} is ready by scheduler timing, but governance still requires a manual gate.`,
        nextAction: jobState.governanceNextAction ?? jobState.resumeRecommendation?.nextAction ?? "Inspect governance before dispatching this job."
      });
    }

    if (job.status === "ready" && jobState.governanceStatus === "manual_requalify") {
      alerts.push({
        severity: "high",
        category: "governance_requalify",
        jobName: job.name,
        message: `${job.name} requires manual requalification before another unattended loop.`,
        nextAction: jobState.governanceNextAction ?? "Inspect the recent stability and governance artifacts before dispatching again."
      });
    }

    if (policyControlStatus === "chain_refresh_recommended") {
      alerts.push({
        severity: "high",
        category: "policy_control_chain_refresh",
        jobName: job.name,
        message: `${job.name} has a stale policy-operator chain and should be refreshed before the next unattended loop.`,
        nextAction: `${policyControlTopBlocker} Next: ${policyControlNextCommand}`
      });
      continue;
    }

    if (policyControlStatus !== "no_policy_activity" && policyControlStatus !== "followup_ready") {
      alerts.push({
        severity: "medium",
        category: "policy_control_followup",
        jobName: job.name,
        message: `${job.name} has policy-control status '${policyControlStatus}' at stage '${policyControlStage}'.`,
        nextAction: `${policyControlTopBlocker} Next: ${policyControlNextCommand}`
      });
    }
  }

  if (alerts.length === 0 && !selectNextAutomationJob(evaluations)) {
    alerts.push({
      severity: "low",
      category: "no_ready_jobs",
      jobName: null,
      message: "No automation job is currently ready to run.",
      nextAction: "Wait for interval/backoff to elapse or clear a manually blocked job."
    });
  }

  return sortAutomationAlerts(alerts);
}

export function buildAutomationOperatorReviewDigest(evaluations, options = {}) {
  const nowIso = (options.now ?? new Date()).toISOString();
  const recentCloseoutHours = Math.max(1, Number(options.recentCloseoutHours ?? 24) || 24);
  const recentCloseoutWindowMinutes = recentCloseoutHours * 60;
  const jobs = Array.isArray(evaluations) ? evaluations : [];
  const openReviews = jobs
    .filter((job) => job?.jobState?.operatorReviewStatus === "open")
    .map((job) => ({
      jobName: job.name,
      category: job.jobState?.operatorReviewCategory ?? null,
      sourceStatus: job.jobState?.operatorReviewSourceStatus ?? null,
      openedAt: job.jobState?.operatorReviewOpenedAt ?? null,
      nextAction: job.jobState?.operatorReviewNextAction ?? null,
      nextCommand: job.jobState?.operatorReviewNextCommand ?? null
    }))
    .sort((left, right) => new Date(right.openedAt ?? 0).getTime() - new Date(left.openedAt ?? 0).getTime());
  const recentCloseouts = jobs
    .filter((job) =>
      (job?.jobState?.operatorReviewStatus === "acknowledged" || job?.jobState?.operatorReviewStatus === "cleared")
      && isRecentIso(job.jobState?.operatorReviewResolvedAt, nowIso, recentCloseoutWindowMinutes)
    )
    .map((job) => ({
      jobName: job.name,
      status: job.jobState?.operatorReviewStatus ?? null,
      category: job.jobState?.operatorReviewCategory ?? null,
      resolvedAt: job.jobState?.operatorReviewResolvedAt ?? null,
      resolutionNotes: job.jobState?.operatorReviewResolutionNotes ?? null
    }))
    .sort((left, right) => new Date(right.resolvedAt ?? 0).getTime() - new Date(left.resolvedAt ?? 0).getTime());

  return {
    generatedAt: nowIso,
    recentCloseoutHours,
    openCount: openReviews.length,
    recentCloseoutCount: recentCloseouts.length,
    openReviews,
    recentCloseouts
  };
}

export function buildAutomationAlertAttention({ alerts, operatorReviewDigest = null, nextJob = null }) {
  const normalizedAlerts = sortAutomationAlerts(Array.isArray(alerts) ? alerts : []);
  const openReviews = Array.isArray(operatorReviewDigest?.openReviews) ? operatorReviewDigest.openReviews : [];
  const recentCloseouts = Array.isArray(operatorReviewDigest?.recentCloseouts) ? operatorReviewDigest.recentCloseouts : [];
  const highSeverityAlerts = normalizedAlerts.filter((alert) => normalizeAlertSeverity(alert?.severity) === "high");
  const operatorAttentionAlerts = normalizedAlerts.filter((alert) => OPERATOR_ATTENTION_ALERT_CATEGORIES.has(String(alert?.category ?? "")));
  const promotedJobs = new Set();
  const signals = [];
  const summaries = [];
  const nextActions = [];
  let status = "routine";
  let deliveryPriority = "routine";

  const addSignal = (value) => {
    if (!value || signals.includes(value)) {
      return;
    }
    signals.push(value);
  };

  const addSummary = (value) => {
    if (!value) {
      return;
    }
    summaries.push(value);
  };

  const addJobNames = (items) => {
    for (const item of items) {
      if (item?.jobName) {
        promotedJobs.add(item.jobName);
      }
    }
  };

  if (openReviews.length > 0) {
    status = "operator_attention_required";
    deliveryPriority = "urgent";
    addSignal("operator_review_open");
    addSummary(`${openReviews.length} open operator review${openReviews.length === 1 ? "" : "s"} require deliberate follow-up.`);
    addJobNames(openReviews);
    nextActions.push(openReviews[0]?.nextAction, openReviews[0]?.nextCommand);
  }

  if (operatorAttentionAlerts.length > 0) {
    if (status === "routine") {
      status = "operator_attention_required";
    }
    deliveryPriority = promoteDeliveryPriority(deliveryPriority, "urgent");
    addSignal("operator_attention_alert");
    addSummary(`${operatorAttentionAlerts.length} operator-facing alert${operatorAttentionAlerts.length === 1 ? "" : "s"} should be promoted in delivery.`);
    addJobNames(operatorAttentionAlerts);
    nextActions.push(operatorAttentionAlerts[0]?.nextAction);
  }

  if (highSeverityAlerts.length > 0) {
    if (status === "routine") {
      status = "elevated_alerting";
    }
    deliveryPriority = promoteDeliveryPriority(deliveryPriority, "elevated");
    addSignal("high_severity_alert");
    addSummary(`${highSeverityAlerts.length} high-severity alert${highSeverityAlerts.length === 1 ? " needs" : "s need"} elevated delivery.`);
    addJobNames(highSeverityAlerts);
    nextActions.push(highSeverityAlerts[0]?.nextAction);
  }

  if (recentCloseouts.length > 0) {
    if (status === "routine") {
      status = "review_closeout_followup";
    }
    deliveryPriority = promoteDeliveryPriority(deliveryPriority, "elevated");
    addSignal("operator_review_recent_closeout");
    addSummary(`${recentCloseouts.length} recent operator review closeout${recentCloseouts.length === 1 ? "" : "s"} should stay visible in delivery digests.`);
    addJobNames(recentCloseouts);
  }

  if (promotedJobs.size === 0 && nextJob?.name) {
    promotedJobs.add(nextJob.name);
  }

  return {
    status,
    deliveryPriority,
    signals,
    promotedJobs: Array.from(promotedJobs),
    openReviewCount: openReviews.length,
    recentCloseoutCount: recentCloseouts.length,
    highSeverityAlertCount: highSeverityAlerts.length,
    operatorAttentionAlertCount: operatorAttentionAlerts.length,
    summary: summaries.length > 0 ? summaries.join(" ") : "Routine automation alert delivery is sufficient.",
    nextAction: uniqueStrings(nextActions)[0] ?? nextJob?.command ?? null
  };
}

export function buildAutomationAlertPayload({ generatedAt, alerts, nextJob, operatorReviewDigest = null }) {
  const sortedAlerts = sortAutomationAlerts(Array.isArray(alerts) ? alerts : []);
  const attention = buildAutomationAlertAttention({
    alerts: sortedAlerts,
    operatorReviewDigest,
    nextJob
  });
  const nextJobDispatchGate = nextJob ? assessAutomationDispatchGate(nextJob) : null;
  const markdown = renderAutomationAlertSummary({
    generatedAt,
    alerts: sortedAlerts,
    nextJob,
    operatorReviewDigest,
    attention
  });

  return {
    schemaVersion: 1,
    generatedAt,
    nextJob: nextJob
        ? {
          name: nextJob.name,
          status: nextJob.status,
          reason: nextJob.reason,
          command: nextJob.command,
          dispatchGateStatus: nextJobDispatchGate?.status ?? null,
          dispatchGateReason: nextJobDispatchGate?.reason ?? null,
          policyControlStatus: nextJob.jobState?.policyControlStatus ?? nextJob.livePolicyControl?.overallStatus ?? null,
          policyControlNextCommand: nextJob.jobState?.policyControlNextCommand ?? nextJob.livePolicyControl?.nextCommand ?? null
        }
      : null,
    operatorReviewDigest,
    attention,
    alerts: sortedAlerts,
    markdown
  };
}

export function renderAutomationAlertSummary({ generatedAt, alerts, nextJob, operatorReviewDigest = null, attention = null }) {
  const alertLines = alerts.length > 0
    ? alerts.map((alert) => `- ${alert.severity.toUpperCase()} | ${alert.category} | ${alert.jobName ?? "-"} | ${alert.message} | next_action=${alert.nextAction}`).join("\n")
    : "- none";
  const openReviewLines = operatorReviewDigest?.openReviews?.length > 0
    ? operatorReviewDigest.openReviews.map((review) =>
      `- ${review.jobName}: category=${review.category ?? "-"} | source_status=${review.sourceStatus ?? "-"} | opened_at=${review.openedAt ?? "-"} | next_action=${review.nextAction ?? "-"}`
    ).join("\n")
    : "- none";
  const recentCloseoutLines = operatorReviewDigest?.recentCloseouts?.length > 0
    ? operatorReviewDigest.recentCloseouts.map((review) =>
      `- ${review.jobName}: status=${review.status ?? "-"} | category=${review.category ?? "-"} | resolved_at=${review.resolvedAt ?? "-"} | notes=${review.resolutionNotes ?? "-"}`
    ).join("\n")
    : "- none";
  const attentionSignals = uniqueStrings(attention?.signals).join(", ") || "-";
  const attentionJobs = uniqueStrings(attention?.promotedJobs).join(", ") || "-";

  return `# Patternpilot Automation Alerts

- generated_at: ${generatedAt}
- alerts: ${alerts.length}
- next_ready_job: ${nextJob?.name ?? "-"}
- attention_status: ${attention?.status ?? "routine"}
- delivery_priority: ${attention?.deliveryPriority ?? "routine"}
- attention_signals: ${attentionSignals}
- attention_jobs: ${attentionJobs}
- operator_reviews_open: ${operatorReviewDigest?.openCount ?? 0}
- operator_reviews_recent_closeouts: ${operatorReviewDigest?.recentCloseoutCount ?? 0}

## Priority Focus

- summary: ${attention?.summary ?? "Routine automation alert delivery is sufficient."}
- next_action: ${attention?.nextAction ?? "-"}

## Alerts

${alertLines}

## Operator Reviews Open

${openReviewLines}

## Operator Reviews Recent Closeouts

${recentCloseoutLines}
`;
}

export function renderAutomationJobsSummary({ generatedAt, evaluations }) {
  const nextJob = selectNextAutomationJob(evaluations);
  const nextDispatchableJob = selectNextDispatchableAutomationJob(evaluations);
  const dispatchGates = evaluations.map((job) => assessAutomationDispatchGate(job));
  const automationMode = describeAutomationOperatingMode({
    jobsConfigured: evaluations.length,
    jobsReady: evaluations.filter((job) => job.status === "ready").length,
    jobsBlocked: evaluations.filter((job) => job.status === "blocked_manual" || job.status === "blocked_requalify").length,
    jobsBackoff: evaluations.filter((job) => job.status === "backoff").length,
    ackRequiredJobs: dispatchGates.filter((gate) => gate.status === "operator_ack_required").length,
    guardedJobs: dispatchGates.filter((gate) => gate.status === "governance_blocked" || gate.status === "policy_control_blocked" || gate.status === "governance_escalated" || gate.status === "policy_control_escalated").length
  });
  const lines = evaluations.length > 0
    ? evaluations.map((job, index) => {
      const dispatchGate = dispatchGates[index];
      const governanceStatus = job.liveGovernance?.status ?? job.jobState?.governanceStatus ?? null;
      const policyStatus = job.livePolicyControl?.overallStatus ?? job.jobState?.policyControlStatus ?? null;
      const governancePosture = describeGovernanceOperatingPosture({
        status: governanceStatus
      });
      const policyPosture = describePolicyControlOperatingPosture({
        overallStatus: policyStatus
      });
      return `- ${job.name}: ${job.status} | priority=${job.priority} | reason=${job.reason} | next_eligible_at=${job.nextEligibleAt ?? "-"} | last_status=${job.jobState?.lastStatus ?? "-"} | run_kind=${job.jobState?.runKind ?? "-"} | focus=${job.jobState?.recommendedFocus ?? "-"} | drift=${job.jobState?.driftStatus ?? "-"} | drift_signals=${job.jobState?.driftSignals ?? 0} | stability=${job.jobState?.stabilityStatus ?? "-"} | stable_streak=${job.jobState?.stableStreak ?? 0} | unstable_streak=${job.jobState?.unstableStreak ?? 0} | governance=${job.jobState?.governanceStatus ?? "-"} | governance_posture=${governanceStatus ? governancePosture.postureKey : "-"} | policy_control=${job.jobState?.policyControlStatus ?? "-"} | policy_posture=${policyStatus ? policyPosture.postureKey : "-"} | policy_stage=${job.jobState?.policyControlStage ?? "-"} | operator_review=${job.jobState?.operatorReviewStatus ?? "-"} | dispatch_gate=${dispatchGate.status} | dispatch_ack=${job.jobState?.operatorAckRequired ? "required" : "no"} | dispatch_block_streak=${job.jobState?.dispatchBlockedStreak ?? job.liveDispatchHistory?.blockedStreak ?? 0} | dispatch_blocks=${job.jobState?.dispatchBlockedCount ?? 0} | dispatch_reroutes=${job.jobState?.dispatchReroutedCount ?? 0} | last_dispatch=${job.jobState?.lastDispatchStatus ?? "-"} | requalify=${job.jobState?.requalificationRequired ? "yes" : "no"} | auto_dispatch=${dispatchGate.autoDispatchAllowed ? "yes" : "no"}`;
    }).join("\n")
    : "- none";

  return `# Patternpilot Automation Jobs

- generated_at: ${generatedAt}
- jobs: ${evaluations.length}
- next_ready_job: ${nextJob?.name ?? "-"}
- next_dispatchable_job: ${nextDispatchableJob?.name ?? "-"}
- automation_mode: ${automationMode.modeKey}
- operator_mode: ${automationMode.operatorMode}

## Operating Boundary

- summary: ${automationMode.summary}

## Job Readiness

${lines}
`;
}
