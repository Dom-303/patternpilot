function statusRank(status) {
  switch (status) {
    case "fail":
      return 2;
    case "followup":
      return 1;
    default:
      return 0;
  }
}

function normalizeCheckStatus(status) {
  return status === "fail" || status === "followup" ? status : "pass";
}

function extractCommandKey(action) {
  const value = String(action ?? "").trim();
  if (!value) {
    return null;
  }

  const patternpilotMatch = value.match(/npm run patternpilot --\s+([a-z0-9-]+)/i);
  if (patternpilotMatch) {
    return patternpilotMatch[1].toLowerCase();
  }

  const genericMatch = value.match(/npm run\s+([a-z0-9-]+)/i);
  if (genericMatch) {
    return genericMatch[1].toLowerCase();
  }

  const bareCommandMatch = value.match(/^([a-z0-9-]+)$/i);
  if (bareCommandMatch) {
    return bareCommandMatch[1].toLowerCase();
  }

  return null;
}

function buildRecentCommandIndex(entries = []) {
  const index = new Map();

  for (const entry of entries) {
    const commandKey = extractCommandKey(entry?.command ?? entry?.nextAction ?? null);
    const createdAt = entry?.createdAt ?? null;
    if (!commandKey || !createdAt) {
      continue;
    }
    const previous = index.get(commandKey);
    if (!previous || previous < createdAt) {
      index.set(commandKey, createdAt);
    }
  }

  return index;
}

function isRecentlyCompleted(commandKey, recentCommandIndex, generatedAt, recencyHours = 6) {
  if (!commandKey) {
    return false;
  }
  const completedAt = recentCommandIndex.get(commandKey);
  if (!completedAt || !generatedAt) {
    return false;
  }
  const completedMs = new Date(completedAt).getTime();
  const generatedMs = new Date(generatedAt).getTime();
  if (!Number.isFinite(completedMs) || !Number.isFinite(generatedMs) || completedMs > generatedMs) {
    return false;
  }
  return (generatedMs - completedMs) <= recencyHours * 60 * 60 * 1000;
}

function selectFreshAction(actions = [], recentCommandIndex, generatedAt) {
  for (const action of actions) {
    if (!action) {
      continue;
    }
    const commandKey = extractCommandKey(action);
    if (isRecentlyCompleted(commandKey, recentCommandIndex, generatedAt)) {
      continue;
    }
    return action;
  }
  return null;
}

function buildCheck({
  scope = "global",
  projectKey = null,
  key,
  label,
  status,
  detail,
  nextAction = null,
  value = null
}) {
  return {
    scope,
    projectKey,
    key,
    label,
    status: normalizeCheckStatus(status),
    detail,
    nextAction,
    value
  };
}

function summarizeCheckCounts(checks = []) {
  return checks.reduce((acc, check) => {
    acc.total += 1;
    acc[check.status] += 1;
    return acc;
  }, {
    total: 0,
    pass: 0,
    followup: 0,
    fail: 0
  });
}

function selectTopAction(checks = []) {
  const sorted = [...checks].sort((left, right) =>
    statusRank(right.status) - statusRank(left.status)
  );
  return sorted.find((check) => check.nextAction)?.nextAction ?? null;
}

function buildGithubAccessCheck(context = {}) {
  const { auth = {}, githubApi = {} } = context;
  if (!auth.tokenPresent) {
    return buildCheck({
      key: "github_access",
      label: "GitHub auth and API reachability",
      status: "fail",
      detail: "No GitHub token is configured for live product operation.",
      nextAction: "Run `npm run patternpilot -- setup-checklist` and then `npm run doctor`."
    });
  }

  if (githubApi.networkStatus === "ok") {
    return buildCheck({
      key: "github_access",
      label: "GitHub auth and API reachability",
      status: "pass",
      detail: `Authenticated GitHub access is healthy via ${auth.authSource ?? auth.authMode ?? "configured auth"}.`,
      value: githubApi.rateLimit?.remaining ?? null
    });
  }

  if (githubApi.networkStatus === "skipped_offline") {
    return buildCheck({
      key: "github_access",
      label: "GitHub auth and API reachability",
      status: "followup",
      detail: "GitHub API reachability was skipped in offline mode, so live readiness is still unverified.",
      nextAction: "Re-run `npm run doctor` without `--offline` before claiming release readiness."
    });
  }

  return buildCheck({
    key: "github_access",
    label: "GitHub auth and API reachability",
    status: "fail",
    detail: `GitHub API check failed${githubApi.error ? `: ${githubApi.error}` : "."}`,
    nextAction: "Re-run `npm run doctor` and restore live GitHub connectivity before release."
  });
}

function buildAutomationJobsCheck(automation = {}) {
  if ((automation.jobsConfigured ?? 0) <= 0) {
    return buildCheck({
      key: "automation_jobs",
      label: "Automation jobs are configured",
      status: "fail",
      detail: "No automation jobs are configured.",
      nextAction: "Add at least one automation job to `automation/patternpilot-jobs.json`."
    });
  }

  return buildCheck({
    key: "automation_jobs",
    label: "Automation jobs are configured",
    status: "pass",
    detail: `${automation.jobsConfigured} job(s) configured; ready=${automation.jobsReady ?? 0}, blocked=${automation.jobsBlocked ?? 0}, backoff=${automation.jobsBackoff ?? 0}.`
  });
}

function buildAlertDeliveryCheck(alertDelivery = {}) {
  if (!alertDelivery.configured || (alertDelivery.targetCount ?? 0) <= 0) {
    return buildCheck({
      key: "alert_delivery",
      label: "Alert delivery surface is configured",
      status: "fail",
      detail: "No alert delivery preset or targets are configured.",
      nextAction: "Configure `automationAlertPreset` or `automationAlertTargets` in `patternpilot.config.json`."
    });
  }

  return buildCheck({
    key: "alert_delivery",
    label: "Alert delivery surface is configured",
    status: "pass",
    detail: `${alertDelivery.targetCount} alert target(s) available${alertDelivery.preset ? ` via preset '${alertDelivery.preset}'` : ""}.`
  });
}

function buildAutomationAttentionCheck(automation = {}, generatedAt, recentCommandIndex) {
  const attentionStatus = automation.attentionStatus ?? "routine";
  if (attentionStatus === "routine") {
    return buildCheck({
      key: "automation_attention",
      label: "Automation attention surface",
      status: "pass",
      detail: "No elevated automation attention signal is active."
    });
  }

  return buildCheck({
    key: "automation_attention",
    label: "Automation attention surface",
    status: "followup",
    detail: `Automation currently reports '${attentionStatus}' with delivery priority '${automation.deliveryPriority ?? "routine"}'.`,
    nextAction: selectFreshAction([
      automation.nextAction,
      automation.fallbackNextAction,
      "Inspect `automation-alerts` before unattended release claims."
    ], recentCommandIndex, generatedAt)
  });
}

function buildProjectPresenceCheck(projects = []) {
  if (projects.length > 0) {
    return buildCheck({
      key: "project_bindings",
      label: "At least one target project is configured",
      status: "pass",
      detail: `${projects.length} project binding(s) configured.`
    });
  }

  return buildCheck({
    key: "project_bindings",
    label: "At least one target project is configured",
    status: "fail",
    detail: "No target project is configured yet.",
    nextAction: "Run `npm run bootstrap -- --project my-project --target ../my-project --label \"My Project\"`."
  });
}

function buildWatchlistCheck(project = {}) {
  return (project.watchlistCount ?? 0) > 0
    ? buildCheck({
        scope: "project",
        projectKey: project.projectKey,
        key: "watchlist",
        label: "Watchlist coverage",
        status: "pass",
        detail: `${project.watchlistCount} watchlist URL(s) are configured.`
      })
    : buildCheck({
        scope: "project",
        projectKey: project.projectKey,
        key: "watchlist",
        label: "Watchlist coverage",
        status: "followup",
        detail: "No watchlist URLs are configured for this project.",
        nextAction: `Populate ${project.watchlistFile ?? "the watchlist file"} before unattended discovery loops.`
      });
}

function buildGovernanceCheck(project = {}, generatedAt, recentCommandIndex) {
  const status = project.governanceStatus ?? "baseline_required";
  if (status === "unattended_ready") {
    return buildCheck({
      scope: "project",
      projectKey: project.projectKey,
      key: "governance",
      label: "Run governance",
      status: "pass",
      detail: "Project governance currently allows unattended continuation."
    });
  }

  if (status === "limited_unattended") {
    return buildCheck({
      scope: "project",
      projectKey: project.projectKey,
      key: "governance",
      label: "Run governance",
      status: "followup",
      detail: "Project governance allows only limited unattended continuation.",
      nextAction: selectFreshAction([
        project.governanceNextAction,
        project.policyControlNextCommand,
        project.jobNextAction,
        project.topAlertNextAction
      ], recentCommandIndex, generatedAt)
    });
  }

  return buildCheck({
    scope: "project",
    projectKey: project.projectKey,
    key: "governance",
    label: "Run governance",
    status: status === "baseline_required" ? "fail" : "followup",
    detail: `Project governance is currently '${status}'.`,
    nextAction: selectFreshAction([
      project.governanceNextAction,
      project.policyControlNextCommand,
      project.jobNextAction,
      project.topAlertNextAction
    ], recentCommandIndex, generatedAt)
  });
}

function buildPolicyControlCheck(project = {}, generatedAt, recentCommandIndex) {
  const status = project.policyControlStatus ?? "no_policy_activity";
  if (status === "followup_ready" || status === "applied" || status === "handoff_executed") {
    return buildCheck({
      scope: "project",
      projectKey: project.projectKey,
      key: "policy_control",
      label: "Policy control chain",
      status: "pass",
      detail: `Policy control is currently '${status}'.`
    });
  }

  if (status === "chain_refresh_recommended") {
    return buildCheck({
      scope: "project",
      projectKey: project.projectKey,
      key: "policy_control",
      label: "Policy control chain",
      status: "fail",
      detail: "Policy control artifacts are out of sync and need a chain refresh.",
      nextAction: selectFreshAction([
        project.policyControlNextCommand,
        project.governanceNextAction,
        project.jobNextAction
      ], recentCommandIndex, generatedAt)
    });
  }

  return buildCheck({
    scope: "project",
    projectKey: project.projectKey,
    key: "policy_control",
    label: "Policy control chain",
    status: status === "no_policy_activity" ? "followup" : "followup",
    detail: `Policy control is currently '${status}'.`,
    nextAction: selectFreshAction([
      project.policyControlNextCommand,
      project.governanceNextAction,
      project.jobNextAction
    ], recentCommandIndex, generatedAt)
  });
}

function buildAutomationJobCheck(project = {}, generatedAt, recentCommandIndex) {
  const status = project.jobStatus ?? "unconfigured";
  if (status === "ready") {
    return buildCheck({
      scope: "project",
      projectKey: project.projectKey,
      key: "automation_job",
      label: "Automation job state",
      status: "pass",
      detail: `${project.jobName ?? "Automation job"} is ready.`
    });
  }

  return buildCheck({
    scope: "project",
    projectKey: project.projectKey,
    key: "automation_job",
    label: "Automation job state",
    status: status === "unconfigured" ? "followup" : "followup",
    detail: `${project.jobName ?? "Automation job"} is currently '${status}'${project.jobReason ? ` (${project.jobReason})` : ""}.`,
    nextAction: selectFreshAction([
      project.jobNextAction,
      project.governanceNextAction,
      project.policyControlNextCommand,
      project.topAlertNextAction
    ], recentCommandIndex, generatedAt)
  });
}

function buildAlertSurfaceCheck(project = {}, generatedAt, recentCommandIndex) {
  if ((project.alertCount ?? 0) <= 0) {
    return buildCheck({
      scope: "project",
      projectKey: project.projectKey,
      key: "alerts",
      label: "Project alert surface",
      status: "pass",
      detail: "No active automation alerts are attached to this project."
    });
  }

  return buildCheck({
    scope: "project",
    projectKey: project.projectKey,
    key: "alerts",
    label: "Project alert surface",
    status: (project.highAlertCount ?? 0) > 0 ? "followup" : "followup",
    detail: `${project.alertCount} alert(s) active${project.topAlertCategory ? `; top category '${project.topAlertCategory}'` : ""}.`,
    nextAction: selectFreshAction([
      project.topAlertNextAction,
      project.governanceNextAction,
      project.policyControlNextCommand,
      project.jobNextAction
    ], recentCommandIndex, generatedAt)
  });
}

function buildProjectReadiness(project = {}, generatedAt) {
  const recentCommandIndex = buildRecentCommandIndex(project.recentCompletedCommands ?? []);
  const checks = [
    buildWatchlistCheck(project),
    buildGovernanceCheck(project, generatedAt, recentCommandIndex),
    buildPolicyControlCheck(project, generatedAt, recentCommandIndex),
    buildAutomationJobCheck(project, generatedAt, recentCommandIndex),
    buildAlertSurfaceCheck(project, generatedAt, recentCommandIndex)
  ];
  const counts = summarizeCheckCounts(checks);
  const overallStatus =
    counts.fail > 0
      ? "not_ready"
      : counts.followup > 0
        ? "ready_with_followups"
        : "ready_for_v1";

  return {
    projectKey: project.projectKey,
    label: project.label ?? project.projectKey,
    checks,
    counts,
    overallStatus,
    nextAction: selectTopAction(checks),
    governanceStatus: project.governanceStatus ?? "baseline_required",
    policyControlStatus: project.policyControlStatus ?? "no_policy_activity",
    jobStatus: project.jobStatus ?? "unconfigured",
    alertCount: project.alertCount ?? 0
  };
}

export function buildPatternpilotProductReadinessReview(context = {}) {
  const recentCommandIndex = buildRecentCommandIndex(
    (context.projects ?? []).flatMap((project) => project.recentCompletedCommands ?? [])
  );
  const globalChecks = [
    buildProjectPresenceCheck(context.projects ?? []),
    buildGithubAccessCheck(context),
    buildAutomationJobsCheck(context.automation),
    buildAlertDeliveryCheck(context.alertDelivery),
    buildAutomationAttentionCheck(context.automation, context.generatedAt, recentCommandIndex)
  ];
  const projects = (context.projects ?? []).map((project) => buildProjectReadiness(project, context.generatedAt));
  const checks = [
    ...globalChecks,
    ...projects.flatMap((project) => project.checks)
  ];
  const counts = summarizeCheckCounts(checks);
  const overallStatus =
    counts.fail > 0
      ? "not_ready"
      : counts.followup > 0
        ? "ready_with_followups"
        : "ready_for_v1";

  return {
    generatedAt: context.generatedAt ?? new Date().toISOString(),
    overallStatus,
    releaseDecision:
      overallStatus === "ready_for_v1"
        ? "go"
        : overallStatus === "ready_with_followups"
          ? "go_with_followups"
          : "hold",
    counts,
    nextAction: selectTopAction(checks),
    globalChecks,
    projects,
    attentionStatus: context.automation?.attentionStatus ?? "routine",
    deliveryPriority: context.automation?.deliveryPriority ?? "routine"
  };
}

export function renderPatternpilotProductReadinessSummary(review) {
  const globalLines = review.globalChecks.length > 0
    ? review.globalChecks.map((check) =>
      `- ${check.status.toUpperCase()} | ${check.key} | ${check.detail}${check.nextAction ? ` | next_action=${check.nextAction}` : ""}`
    ).join("\n")
    : "- none";
  const projectStatusLines = review.projects.length > 0
    ? review.projects.map((project) =>
      `- ${project.projectKey}: ${project.overallStatus} | governance=${project.governanceStatus} | policy=${project.policyControlStatus} | job=${project.jobStatus} | alerts=${project.alertCount}${project.nextAction ? ` | next_action=${project.nextAction}` : ""}`
    ).join("\n")
    : "- none";
  const projectCheckLines = review.projects.length > 0
    ? review.projects.flatMap((project) =>
      project.checks.map((check) =>
        `- ${project.projectKey} | ${check.status.toUpperCase()} | ${check.key} | ${check.detail}${check.nextAction ? ` | next_action=${check.nextAction}` : ""}`
      )
    ).join("\n")
    : "- none";

  return `# Patternpilot Product Readiness

- generated_at: ${review.generatedAt}
- overall_status: ${review.overallStatus}
- release_decision: ${review.releaseDecision}
- checks_total: ${review.counts.total}
- checks_pass: ${review.counts.pass}
- checks_followup: ${review.counts.followup}
- checks_fail: ${review.counts.fail}
- projects: ${review.projects.length}
- attention_status: ${review.attentionStatus}
- delivery_priority: ${review.deliveryPriority}
- next_action: ${review.nextAction ?? "-"}

## Global Checks

${globalLines}

## Project Status

${projectStatusLines}

## Project Checks

${projectCheckLines}
`;
}
