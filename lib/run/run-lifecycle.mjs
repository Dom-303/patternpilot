import fs from "node:fs/promises";
import path from "node:path";

const LIFECYCLE_RELEVANT_COMMANDS = new Set([
  "on-demand",
  "automation-run"
]);

function sortRecords(records = []) {
  return [...records].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

function countExplicitUrls(manifest = {}) {
  return Array.isArray(manifest.explicitUrls) ? manifest.explicitUrls.length : 0;
}

function inferRunCommandFromManifest(manifest = {}) {
  if (manifest.command) {
    return manifest.command;
  }
  if (manifest.lockInfo && Array.isArray(manifest.projectRuns)) {
    return "automation-run";
  }
  if (manifest.sourceMode && manifest.intakeRun && manifest.reviewRun) {
    return "on-demand";
  }
  if (manifest.review && manifest.reviewScope) {
    return "review-watchlist";
  }
  if (manifest.discovery) {
    return manifest.imported ? "discover-import" : "discover";
  }
  if (Array.isArray(manifest.items) && Object.prototype.hasOwnProperty.call(manifest, "apply")) {
    return "promote";
  }
  if (Array.isArray(manifest.items) && Object.prototype.hasOwnProperty.call(manifest, "notes")) {
    return "policy-curate";
  }
  return manifest.sourceMode ? "on-demand" : null;
}

function isLifecycleRelevantManifest(manifest = {}, command = null) {
  if (!command) {
    return false;
  }
  if (command === "automation-run") {
    return Boolean(manifest.lockInfo && Array.isArray(manifest.projectRuns));
  }
  if (command === "on-demand") {
    return Boolean(
      manifest.runPlan
      || (manifest.sourceMode && manifest.intakeRun && manifest.reviewRun)
    );
  }
  return LIFECYCLE_RELEVANT_COMMANDS.has(command);
}

function inferRunKind({
  priorRunCount = 0,
  sourceMode = "watchlist",
  explicitUrlCount = 0,
  isAutomation = false
}) {
  if (isAutomation) {
    return "maintenance_run";
  }
  if (priorRunCount === 0) {
    return "first_run";
  }
  if (sourceMode === "watchlist" && explicitUrlCount === 0) {
    return "maintenance_run";
  }
  return "follow_up_run";
}

function buildDefaultPhases(runKind, { isAutomation = false } = {}) {
  if (runKind === "first_run") {
    return {
      intake: "required",
      reEvaluate: "optional_light",
      review: "required",
      promote: "defer_or_prepare"
    };
  }
  if (runKind === "maintenance_run") {
    return {
      intake: isAutomation ? "required_watchlist_sync" : "required_watchlist_sync",
      reEvaluate: "required",
      review: "required",
      promote: isAutomation ? "prepared_only" : "prepare_or_skip"
    };
  }
  return {
    intake: "required",
    reEvaluate: "required",
    review: "required",
    promote: "prepare_or_apply_carefully"
  };
}

function buildLifecycleNotes(runKind, context) {
  const notes = [];
  if (runKind === "first_run") {
    notes.push("Treat this run as orientation first: keep the scope small and read the report before promoting anything.");
    notes.push("Prefer explicit repository URLs over broad watchlist churn until the first report feels directionally right.");
  } else if (runKind === "follow_up_run") {
    notes.push("Use this run to compare against earlier findings, not just to collect fresh candidates.");
    notes.push("Promotion is fine when the review stays strong, but the previous report should still be part of the decision.");
  } else {
    notes.push("This run is maintenance-shaped: expect re-evaluation, stale data cleanup and watchlist drift handling.");
    notes.push("Keep unattended promotion conservative unless the batch governance is explicitly clean.");
  }

  if (context.priorRunCount > 0 && context.latestRunRecord) {
    notes.push(`Most recent project run: ${context.latestRunRecord.runId} (${context.latestRunRecord.command ?? "unknown"}).`);
  }
  if ((context.watchlistCount ?? 0) > 0 && runKind !== "first_run") {
    notes.push(`Current watchlist size: ${context.watchlistCount}.`);
  }
  return notes;
}

function buildLifecycleReasons(runKind, context) {
  const reasons = [];
  if (context.isAutomation) {
    reasons.push("Automation runs are treated as maintenance-shaped by default.");
  }
  if (context.priorRunCount === 0) {
    reasons.push("No earlier project run artifacts were found.");
  } else {
    reasons.push(`${context.priorRunCount} earlier run artifact(s) exist for this project.`);
  }
  if (context.sourceMode === "watchlist") {
    reasons.push("The current scope is watchlist-backed rather than an explicit repo selection.");
  } else if ((context.explicitUrlCount ?? 0) > 0) {
    reasons.push(`The current scope contains ${context.explicitUrlCount} explicit URL(s).`);
  }
  if (runKind === "maintenance_run" && (context.queueStats?.promoted ?? 0) > 0) {
    reasons.push(`${context.queueStats.promoted} queue item(s) are already promoted, so drift control matters more than first-touch discovery.`);
  }
  return reasons;
}

function buildExecutionPolicy(runKind, context) {
  if (runKind === "first_run") {
    return {
      reEvaluateScope: "fallback_and_stale_if_present",
      promotionGuard: "manual_confirmation_before_apply",
      retryMode: "conservative_manual",
      autoResumeEligiblePhases: ["discover", "intake"],
      manualResumePhases: ["review", "promote"],
      driftChecks: ["initial_scope_sanity", "report_directionality"]
    };
  }
  if (runKind === "maintenance_run") {
    return {
      reEvaluateScope: "stale_only",
      promotionGuard: context.isAutomation ? "prepared_only_unless_clean_batch" : "review_first_then_prepare",
      retryMode: "maintenance_retry_ok",
      autoResumeEligiblePhases: ["discover", "intake", "re_evaluate"],
      manualResumePhases: ["review", "promote"],
      driftChecks: ["watchlist_delta", "rules_fingerprint_drift", "promoted_queue_guard"]
    };
  }
  return {
    reEvaluateScope: "fallback_and_stale",
    promotionGuard: "review_first_then_prepare_or_apply",
    retryMode: "balanced_retry",
    autoResumeEligiblePhases: ["discover", "intake", "re_evaluate"],
    manualResumePhases: ["review", "promote"],
    driftChecks: ["compare_previous_report", "queue_state_delta", "promotion_overlap"]
  };
}

export function buildRunResumeRecommendation({
  lifecycle,
  failedPhase = null,
  failure = null
}) {
  const retryable = Boolean(failure?.retryable);
  const failedInManualPhase = failedPhase && lifecycle?.executionPolicy?.manualResumePhases?.includes(failedPhase);
  const failedInAutoPhase = failedPhase && lifecycle?.executionPolicy?.autoResumeEligiblePhases?.includes(failedPhase);

  if (!failedPhase) {
    return {
      strategy: lifecycle?.runKind === "maintenance_run" ? "maintenance_monitoring" : "manual_review",
      autoResumeAllowed: false,
      nextAction: "Inspect the latest run summary before deciding whether to continue, retry, or narrow the scope."
    };
  }

  if (!retryable) {
    return {
      strategy: "manual_resume_after_fix",
      autoResumeAllowed: false,
      nextAction: `Fix the underlying ${failure?.category ?? "non-retryable"} issue before resuming phase '${failedPhase}'.`
    };
  }

  if (lifecycle?.runKind === "first_run") {
    return {
      strategy: "manual_resume_after_retryable_failure",
      autoResumeAllowed: false,
      nextAction: `Because this is a first run, inspect the failure in '${failedPhase}' manually before retrying even though it looks retryable.`
    };
  }

  if (failedInManualPhase) {
    return {
      strategy: "manual_resume_on_curated_phase",
      autoResumeAllowed: false,
      nextAction: `Retry '${failedPhase}' manually after checking the latest report and any curation side effects.`
    };
  }

  if (failedInAutoPhase) {
    return {
      strategy: "retry_after_backoff",
      autoResumeAllowed: true,
      nextAction: `Allow '${failedPhase}' to retry after backoff; no manual clear is needed unless the same failure repeats.`
    };
  }

  return {
    strategy: "manual_resume_after_fix",
    autoResumeAllowed: false,
    nextAction: `Inspect phase '${failedPhase}' manually before resuming.`
  };
}

export async function listProjectRunHistory(rootDir, config, projectKey, options = {}) {
  const includeNonLifecycle = Boolean(options.includeNonLifecycle);
  const runsRoot = path.join(rootDir, config.runtimeRoot ?? "runs", projectKey);
  const entries = await fs.readdir(runsRoot, { withFileTypes: true }).catch(() => []);
  const records = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = path.join(runsRoot, entry.name, "manifest.json");
    const raw = await fs.readFile(manifestPath, "utf8").catch(() => null);
    if (!raw) {
      continue;
    }
    try {
      const manifest = JSON.parse(raw);
      const command = inferRunCommandFromManifest(manifest);
      const lifecycleRelevant = isLifecycleRelevantManifest(manifest, command);
      if (!includeNonLifecycle && !lifecycleRelevant) {
        continue;
      }
      records.push({
        runId: manifest.runId ?? entry.name,
        createdAt: manifest.createdAt ?? entry.name,
        command,
        sourceMode: manifest.sourceMode ?? null,
        explicitUrlCount: countExplicitUrls(manifest),
        manifestRunKind: manifest.runPlan?.runKind ?? null,
        isAutomation: command === "automation-run",
        lifecycleRelevant,
        manifestPath: path.relative(rootDir, manifestPath)
      });
    } catch {
      continue;
    }
  }

  const sortedRecords = sortRecords(records);
  return sortedRecords.map((record, index, allRecords) => ({
    ...record,
    runKind: record.manifestRunKind ?? inferRunKind({
      priorRunCount: allRecords.slice(index + 1).length,
      sourceMode: record.sourceMode ?? "watchlist",
      explicitUrlCount: record.explicitUrlCount ?? 0,
      isAutomation: record.isAutomation
    })
  }));
}

export function buildProjectRunLifecycle(context = {}) {
  const priorRuns = sortRecords(context.priorRuns ?? []);
  const priorRunCount = priorRuns.length;
  const latestRunRecord = priorRuns[0] ?? null;
  const runKind = inferRunKind({
    priorRunCount,
    sourceMode: context.sourceMode,
    explicitUrlCount: context.explicitUrlCount,
    isAutomation: context.isAutomation
  });
  const defaultPhases = buildDefaultPhases(runKind, { isAutomation: context.isAutomation });
  const executionPolicy = buildExecutionPolicy(runKind, context);
  const reasons = buildLifecycleReasons(runKind, {
    ...context,
    priorRunCount,
    latestRunRecord
  });
  const notes = buildLifecycleNotes(runKind, {
    ...context,
    priorRunCount,
    latestRunRecord
  });

  return {
    runKind,
    priorRunCount,
    latestRunRecord,
    sourceMode: context.sourceMode ?? "watchlist",
    explicitUrlCount: context.explicitUrlCount ?? 0,
    watchlistCount: context.watchlistCount ?? 0,
    isAutomation: Boolean(context.isAutomation),
    queueStats: context.queueStats ?? {},
    defaultPhases,
    executionPolicy,
    recommendedFocus:
      runKind === "first_run"
        ? "orientation_and_scope"
        : runKind === "follow_up_run"
          ? "comparison_and_decision"
          : "maintenance_and_drift_control",
    defaultPromotionMode:
      runKind === "first_run"
        ? "prepared"
        : runKind === "maintenance_run"
          ? "skip"
          : "prepared",
    reasons,
    notes
  };
}

export function renderProjectRunLifecycleSummary({
  projectKey,
  generatedAt,
  lifecycle
}) {
  return `# Patternpilot Run Plan

- project: ${projectKey}
- generated_at: ${generatedAt}
- run_kind: ${lifecycle.runKind}
- source_mode: ${lifecycle.sourceMode}
- prior_runs: ${lifecycle.priorRunCount}
- latest_run: ${lifecycle.latestRunRecord?.runId ?? "-"}
- latest_run_command: ${lifecycle.latestRunRecord?.command ?? "-"}
- watchlist_count: ${lifecycle.watchlistCount}
- explicit_urls: ${lifecycle.explicitUrlCount}
- recommended_focus: ${lifecycle.recommendedFocus}
- default_promotion_mode: ${lifecycle.defaultPromotionMode}

## Execution Policy

- re_evaluate_scope: ${lifecycle.executionPolicy?.reEvaluateScope ?? "-"}
- promotion_guard: ${lifecycle.executionPolicy?.promotionGuard ?? "-"}
- retry_mode: ${lifecycle.executionPolicy?.retryMode ?? "-"}
- auto_resume_phases: ${(lifecycle.executionPolicy?.autoResumeEligiblePhases ?? []).join(", ") || "-"}
- manual_resume_phases: ${(lifecycle.executionPolicy?.manualResumePhases ?? []).join(", ") || "-"}
- drift_checks: ${(lifecycle.executionPolicy?.driftChecks ?? []).join(", ") || "-"}

## Default Phase Shape

- intake: ${lifecycle.defaultPhases.intake}
- re_evaluate: ${lifecycle.defaultPhases.reEvaluate}
- review: ${lifecycle.defaultPhases.review}
- promote: ${lifecycle.defaultPhases.promote}

## Why this run kind

${lifecycle.reasons.map((item) => `- ${item}`).join("\n") || "- none"}

## Notes

${lifecycle.notes.map((item) => `- ${item}`).join("\n") || "- none"}
`;
}
