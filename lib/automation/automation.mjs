import fs from "node:fs/promises";
import path from "node:path";
import { evaluateDiscoveryCandidatePolicy } from "../policy/discovery-policy.mjs";

const AUTOMATION_PHASES = [
  "discover",
  "gate",
  "watchlist_handoff",
  "intake",
  "re_evaluate",
  "review",
  "promote"
];

const RETRYABLE_PATTERNS = [
  { category: "scheduler_lock", pattern: /automation lock/i, retryable: true, recommendedDelayMinutes: 15, exitCode: 3 },
  { category: "rate_limit", pattern: /rate limit|429|secondary rate limit/i, retryable: true, recommendedDelayMinutes: 15, exitCode: 75 },
  { category: "network_transient", pattern: /timed out|timeout|ECONNRESET|EAI_AGAIN|ENOTFOUND|network_status: offline|fetch failed/i, retryable: true, recommendedDelayMinutes: 15, exitCode: 75 },
  { category: "auth", pattern: /401|403|token|auth|github app|missing scopes/i, retryable: false, recommendedDelayMinutes: null, exitCode: 2 },
  { category: "project_config", pattern: /unknown project|no watchlist_file|invalid url|only github\.com|target project path does not exist|already exists in patternpilot\.config/i, retryable: false, recommendedDelayMinutes: null, exitCode: 2 }
];

function confidenceRank(value) {
  if (value === "high") {
    return 2;
  }
  if (value === "medium") {
    return 1;
  }
  return 0;
}

function candidateNetScore(candidate) {
  const valueScore = Number(candidate?.valueScore ?? 0) || 0;
  const effortScore = Number(candidate?.effortScore ?? 0) || 0;
  return valueScore - effortScore;
}

function candidateFitScore(candidate) {
  return Number(candidate?.projectAlignment?.fitScore ?? candidate?.projectFitScore ?? 0) || 0;
}

function candidateName(candidate) {
  if (candidate?.full_name) {
    return candidate.full_name;
  }
  if (candidate?.repo?.owner && candidate?.repo?.name) {
    return `${candidate.repo.owner}/${candidate.repo.name}`;
  }
  return candidate?.repoRef ?? "unknown";
}

export function compareConfidence(left, right) {
  return confidenceRank(left) - confidenceRank(right);
}

export function sortAutomationCandidates(candidates = []) {
  candidates.sort((left, right) => {
    const netDiff = candidateNetScore(right) - candidateNetScore(left);
    if (netDiff !== 0) {
      return netDiff;
    }

    const fitDiff = candidateFitScore(right) - candidateFitScore(left);
    if (fitDiff !== 0) {
      return fitDiff;
    }

    return candidateName(left).localeCompare(candidateName(right));
  });

  return candidates;
}

export function selectAutomationDiscoveryCandidates(discovery, options = {}) {
  const candidates = Array.isArray(discovery?.candidates) ? [...discovery.candidates] : [];
  const maxCandidates = Math.max(1, Number(options.maxCandidates ?? 5) || 5);
  const minConfidence = options.minConfidence ?? "medium";
  const runConfidence = discovery?.runConfidence ?? "low";
  const policy = options.policy ?? null;

  if (compareConfidence(runConfidence, minConfidence) < 0) {
    return {
      status: "blocked_low_confidence",
      reason: `Discovery confidence '${runConfidence}' is below required '${minConfidence}'.`,
      selected: [],
      selectedUrls: [],
      considered: candidates.length,
      actionable: 0,
      rejected: candidates.length
    };
  }

  let policyBlocked = 0;
  let policyPreferred = 0;

  const actionable = candidates.filter((candidate) => {
    const disposition = candidate?.discoveryDisposition;
    const fitBand = candidate?.projectAlignment?.fitBand ?? "unknown";
    const policyGate = policy ? evaluateDiscoveryCandidatePolicy(candidate, policy) : null;

    if (policyGate) {
      candidate.discoveryPolicyGate = policyGate;
      if (!policyGate.allowed) {
        policyBlocked += 1;
        return false;
      }
      if (policyGate.preferenceHits.length > 0) {
        policyPreferred += 1;
      }
    }

    if (candidate?.decisionDataState && candidate.decisionDataState !== "complete") {
      return false;
    }
    if (disposition !== "intake_now" && disposition !== "review_queue") {
      return false;
    }
    if (fitBand === "low" || fitBand === "unknown") {
      return false;
    }
    return Boolean(candidate?.repo?.normalizedRepoUrl);
  });

  sortAutomationCandidates(actionable);
  const selected = actionable.slice(0, maxCandidates);

  return {
    status: selected.length > 0 ? "selected" : "no_actionable_candidates",
    reason: selected.length > 0
      ? `Selected ${selected.length} discovery candidates for watchlist handoff.`
      : "No discovery candidates passed the automation gate.",
    selected,
    selectedUrls: selected.map((candidate) => candidate.repo.normalizedRepoUrl),
    considered: candidates.length,
    actionable: actionable.length,
    rejected: Math.max(0, candidates.length - actionable.length),
    policyBlocked,
    policyPreferred
  };
}

function normalizeAutomationJobProjectKeys(job = {}) {
  const explicitKeys = Array.isArray(job.projectKeys)
    ? job.projectKeys
    : job.projectKey ? [job.projectKey] : [];
  return Array.from(new Set(explicitKeys.map((item) => String(item ?? "").trim()).filter(Boolean)));
}

export function selectAutomationProjectWindow(projectEntries, job = {}, jobState = {}) {
  const entries = Array.isArray(projectEntries) ? [...projectEntries] : [];
  const allowedProjectKeys = normalizeAutomationJobProjectKeys(job);
  const filteredEntries = allowedProjectKeys.length > 0
    ? entries.filter(([projectKey]) => allowedProjectKeys.includes(projectKey))
    : entries;
  const totalProjects = filteredEntries.length;
  const rawLimit = Number(job.maxProjectsPerRun ?? totalProjects) || totalProjects;
  const maxProjectsPerRun = totalProjects === 0
    ? 0
    : Math.min(totalProjects, Math.max(1, rawLimit));
  const requestedCursor = Number(jobState?.nextProjectCursor ?? 0) || 0;
  const startCursor = totalProjects === 0
    ? 0
    : ((requestedCursor % totalProjects) + totalProjects) % totalProjects;

  if (totalProjects === 0 || maxProjectsPerRun === 0) {
    return {
      entries: [],
      totalProjects,
      maxProjectsPerRun,
      truncated: false,
      projectKeys: [],
      startCursor: 0,
      nextProjectCursor: 0
    };
  }

  if (maxProjectsPerRun >= totalProjects) {
    return {
      entries: filteredEntries,
      totalProjects,
      maxProjectsPerRun,
      truncated: false,
      projectKeys: filteredEntries.map(([projectKey]) => projectKey),
      startCursor,
      nextProjectCursor: 0
    };
  }

  const selectedEntries = [];
  for (let offset = 0; offset < maxProjectsPerRun; offset += 1) {
    selectedEntries.push(filteredEntries[(startCursor + offset) % totalProjects]);
  }

  return {
    entries: selectedEntries,
    totalProjects,
    maxProjectsPerRun,
    truncated: true,
    projectKeys: selectedEntries.map(([projectKey]) => projectKey),
    startCursor,
    nextProjectCursor: (startCursor + selectedEntries.length) % totalProjects
  };
}

export function createAutomationProjectRun(projectKey) {
  return {
    projectKey,
    status: "pending",
    phases: Object.fromEntries(
      AUTOMATION_PHASES.map((phase) => [
        phase,
        {
          status: "pending",
          reason: "not_started"
        }
      ])
    ),
    metrics: {},
    error: null
  };
}

export function setAutomationPhase(run, phase, fields = {}) {
  if (!run?.phases?.[phase]) {
    throw new Error(`Unknown automation phase '${phase}'.`);
  }

  run.phases[phase] = {
    ...run.phases[phase],
    ...fields
  };

  return run;
}

export function finalizeAutomationProjectRun(run) {
  const phases = Object.values(run?.phases ?? {});
  const failed = phases.some((phase) => phase.status === "failed");
  const completed = phases.some((phase) => phase.status === "completed");
  const blocked = phases.some((phase) => phase.status === "blocked");
  const skipped = phases.every((phase) => phase.status === "skipped" || phase.status === "pending");

  if (failed) {
    run.status = "failed";
  } else if (completed) {
    run.status = blocked ? "completed_with_blocks" : "completed";
  } else if (skipped) {
    run.status = "skipped";
  } else if (blocked) {
    run.status = "blocked";
  } else {
    run.status = "pending";
  }

  return run;
}

export function summarizeAutomationProjects(projectRuns = []) {
  return projectRuns.reduce(
    (acc, projectRun) => {
      const status = projectRun?.status ?? "pending";
      acc.total += 1;
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    },
    {
      total: 0,
      completed: 0,
      completed_with_blocks: 0,
      blocked: 0,
      failed: 0,
      skipped: 0,
      pending: 0
    }
  );
}

export function renderAutomationRunSummary({
  runId,
  createdAt,
  dryRun,
  automationJob,
  promotionMode,
  continueOnProjectError,
  reEvaluateLimit,
  lockInfo,
  projectRuns
}) {
  const counts = summarizeAutomationProjects(projectRuns);
  const projectLines = projectRuns.length > 0
    ? projectRuns.map((projectRun) => {
        const phaseLines = AUTOMATION_PHASES.map((phase) => {
          const phaseResult = projectRun.phases[phase];
          const detailParts = [];
          if (phaseResult.reason) {
            detailParts.push(`reason=${phaseResult.reason}`);
          }
          if (phaseResult.count != null) {
            detailParts.push(`count=${phaseResult.count}`);
          }
          if (phaseResult.selected != null) {
            detailParts.push(`selected=${phaseResult.selected}`);
          }
          if (phaseResult.targetRows != null) {
            detailParts.push(`target_rows=${phaseResult.targetRows}`);
          }
          return `  - ${phase}: ${phaseResult.status}${detailParts.length > 0 ? ` (${detailParts.join("; ")})` : ""}`;
        }).join("\n");

        const lifecycleBits = [];
        if (projectRun.metrics?.runKind) {
          lifecycleBits.push(`run_kind=${projectRun.metrics.runKind}`);
        }
        if (projectRun.metrics?.recommendedFocus) {
          lifecycleBits.push(`focus=${projectRun.metrics.recommendedFocus}`);
        }
        if (projectRun.metrics?.runDriftStatus) {
          lifecycleBits.push(`drift=${projectRun.metrics.runDriftStatus}`);
        }
        if (projectRun.metrics?.runGovernanceStatus) {
          lifecycleBits.push(`governance=${projectRun.metrics.runGovernanceStatus}`);
        }
        if (projectRun.metrics?.policyControlStatus) {
          lifecycleBits.push(`policy=${projectRun.metrics.policyControlStatus}`);
        }

        return `- ${projectRun.projectKey}: ${projectRun.status}${lifecycleBits.length > 0 ? ` (${lifecycleBits.join("; ")})` : ""}\n${phaseLines}`;
      }).join("\n")
    : "- none";

  return `# Patternpilot Automation Run

- run_id: ${runId}
- created_at: ${createdAt}
- dry_run: ${dryRun ? "yes" : "no"}
- automation_job: ${automationJob ?? "-"}
- promotion_mode: ${promotionMode}
- continue_on_project_error: ${continueOnProjectError ? "yes" : "no"}
- re_evaluate_limit: ${reEvaluateLimit ?? "-"}
- lock_status: ${lockInfo?.status ?? "-"}
- lock_path: ${lockInfo?.lockPath ?? "-"}
- projects_total: ${counts.total}
- projects_completed: ${counts.completed}
- projects_completed_with_blocks: ${counts.completed_with_blocks}
- projects_blocked: ${counts.blocked}
- projects_failed: ${counts.failed}
- projects_skipped: ${counts.skipped}

## Projects

${projectLines}
`;
}

export function classifyAutomationFailure(error) {
  const message = String(error?.message ?? "");

  for (const rule of RETRYABLE_PATTERNS) {
    if (rule.pattern.test(message)) {
      return {
        category: rule.category,
        retryable: rule.retryable,
        recommendedDelayMinutes: rule.recommendedDelayMinutes,
        exitCode: rule.exitCode
      };
    }
  }

  return {
    category: "unknown",
    retryable: false,
    recommendedDelayMinutes: null,
    exitCode: 1
  };
}

export function buildAutomationOpsReport({
  runId,
  createdAt,
  dryRun,
  automationJob,
  promotionMode,
  continueOnProjectError,
  reEvaluateLimit,
  lockInfo,
  counts,
  failures,
  projectRuns
}) {
  return {
    schemaVersion: 1,
    runId,
    createdAt,
    dryRun,
    automationJob,
    promotionMode,
    continueOnProjectError,
    reEvaluateLimit,
    lockInfo,
    counts,
    failures: failures.map((failure) => ({
      ...failure,
      classification: classifyAutomationFailure(failure.error)
    })),
    projectRuns
  };
}

export async function acquireAutomationLock(rootDir, config, options = {}) {
  const lockPath = path.join(rootDir, config.automationLockFile ?? "state/automation.lock.json");
  const timeoutMinutes = Math.max(1, Number(options.lockTimeoutMinutes ?? 180) || 180);
  const now = new Date();
  const payload = {
    schemaVersion: 1,
    createdAt: now.toISOString(),
    pid: process.pid,
    project: options.project ?? null,
    allProjects: Boolean(options.allProjects),
    dryRun: Boolean(options.dryRun),
    runMode: "automation-run"
  };

  await fs.mkdir(path.dirname(lockPath), { recursive: true });

  try {
    const existingRaw = await fs.readFile(lockPath, "utf8");
    const existing = JSON.parse(existingRaw);
    const existingCreatedAt = new Date(existing.createdAt ?? 0);
    const ageMinutes = Number.isFinite(existingCreatedAt.getTime())
      ? (now.getTime() - existingCreatedAt.getTime()) / (1000 * 60)
      : Number.POSITIVE_INFINITY;
    const stale = !Number.isFinite(ageMinutes) || ageMinutes > timeoutMinutes;

    if (!options.forceLock && !stale) {
      const error = new Error(
        `Automation lock already active at ${lockPath} (created_at=${existing.createdAt ?? "unknown"} pid=${existing.pid ?? "unknown"}).`
      );
      error.exitCode = 3;
      throw error;
    }

    payload.previousLock = existing;
    payload.replacedStaleLock = stale;
  } catch (error) {
    if (error?.code !== "ENOENT") {
      if (error.exitCode) {
        throw error;
      }
      payload.previousLockError = error.message;
    }
  }

  await fs.writeFile(lockPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  return {
    status: payload.replacedStaleLock ? "replaced_stale_lock" : "acquired",
    lockPath,
    payload
  };
}

export async function releaseAutomationLock(lockInfo) {
  if (!lockInfo?.lockPath) {
    return { status: "skipped_no_lock" };
  }

  try {
    await fs.unlink(lockInfo.lockPath);
    return { status: "released", lockPath: lockInfo.lockPath };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return { status: "missing", lockPath: lockInfo.lockPath };
    }
    throw error;
  }
}
