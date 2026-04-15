import fs from "node:fs/promises";
import path from "node:path";

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
    autoDispatchAllowed: primaryProjectRun?.metrics?.autoDispatchAllowed ?? previous.autoDispatchAllowed ?? null,
    autoApplyAllowed: primaryProjectRun?.metrics?.autoApplyAllowed ?? previous.autoApplyAllowed ?? null,
    governanceNextAction: primaryProjectRun?.metrics?.governanceNextAction ?? previous.governanceNextAction ?? null,
    recommendedGovernancePromotionMode: primaryProjectRun?.metrics?.recommendedPromotionMode ?? previous.recommendedGovernancePromotionMode ?? null,
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
  return evaluations.find((job) => job.status === "ready" && job.liveGovernance?.autoDispatchAllowed !== false) ?? null;
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
    if (job.status !== "ready") {
      return {
        status: "job_not_ready",
        reason: `${job.name} is currently '${job.status}' (${job.reason}).`,
        job
      };
    }
    return {
      status: "selected",
      reason: `Selected requested job '${job.name}'.`,
      job
    };
  }

  const nextJob = selectNextAutomationJob(evaluations);
  if (!nextJob) {
    return {
      status: "no_ready_job",
      reason: "No automation job is currently ready.",
      job: null
    };
  }

  return {
    status: "selected",
    reason: `Selected next ready job '${nextJob.name}'.`,
    job: nextJob
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

export function buildAutomationAlerts(evaluations, options = {}) {
  const nowIso = (options.now ?? new Date()).toISOString();
  const backoffAlertMinutes = Math.max(1, Number(options.backoffAlertMinutes ?? 60) || 60);
  const retryFailureThreshold = Math.max(1, Number(options.retryFailureThreshold ?? 2) || 2);
  const alerts = [];

  for (const job of evaluations) {
    const jobState = job.jobState ?? {};
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

  return alerts;
}

export function buildAutomationAlertPayload({ generatedAt, alerts, nextJob }) {
  const markdown = renderAutomationAlertSummary({
    generatedAt,
    alerts,
    nextJob
  });

  return {
    schemaVersion: 1,
    generatedAt,
    nextJob: nextJob
      ? {
          name: nextJob.name,
          status: nextJob.status,
          reason: nextJob.reason,
          command: nextJob.command
        }
      : null,
    alerts,
    markdown
  };
}

export function renderAutomationAlertSummary({ generatedAt, alerts, nextJob }) {
  const alertLines = alerts.length > 0
    ? alerts.map((alert) => `- ${alert.severity.toUpperCase()} | ${alert.category} | ${alert.jobName ?? "-"} | ${alert.message} | next_action=${alert.nextAction}`).join("\n")
    : "- none";

  return `# Patternpilot Automation Alerts

- generated_at: ${generatedAt}
- alerts: ${alerts.length}
- next_ready_job: ${nextJob?.name ?? "-"}

## Alerts

${alertLines}
`;
}

export function renderAutomationJobsSummary({ generatedAt, evaluations }) {
  const nextJob = selectNextAutomationJob(evaluations);
  const nextDispatchableJob = selectNextDispatchableAutomationJob(evaluations);
  const lines = evaluations.length > 0
    ? evaluations.map((job) => `- ${job.name}: ${job.status} | priority=${job.priority} | reason=${job.reason} | next_eligible_at=${job.nextEligibleAt ?? "-"} | last_status=${job.jobState?.lastStatus ?? "-"} | run_kind=${job.jobState?.runKind ?? "-"} | focus=${job.jobState?.recommendedFocus ?? "-"} | drift=${job.jobState?.driftStatus ?? "-"} | drift_signals=${job.jobState?.driftSignals ?? 0} | stability=${job.jobState?.stabilityStatus ?? "-"} | stable_streak=${job.jobState?.stableStreak ?? 0} | unstable_streak=${job.jobState?.unstableStreak ?? 0} | governance=${job.jobState?.governanceStatus ?? "-"} | requalify=${job.jobState?.requalificationRequired ? "yes" : "no"} | auto_dispatch=${job.jobState?.autoDispatchAllowed == null ? "-" : job.jobState.autoDispatchAllowed ? "yes" : "no"}`).join("\n")
    : "- none";

  return `# Patternpilot Automation Jobs

- generated_at: ${generatedAt}
- jobs: ${evaluations.length}
- next_ready_job: ${nextJob?.name ?? "-"}
- next_dispatchable_job: ${nextDispatchableJob?.name ?? "-"}

## Job Readiness

${lines}
`;
}
