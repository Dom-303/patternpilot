import fs from "node:fs/promises";
import path from "node:path";
import { loadQueueEntries } from "./queue.mjs";
import { classifyReviewItemState } from "./review.mjs";
import { listProjectRunHistory } from "./run-lifecycle.mjs";

function normalizeList(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))].sort();
}

function diffLists(previousValues = [], latestValues = []) {
  const previous = new Set(normalizeList(previousValues));
  const latest = new Set(normalizeList(latestValues));

  return {
    added: [...latest].filter((value) => !previous.has(value)).sort(),
    removed: [...previous].filter((value) => !latest.has(value)).sort()
  };
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = row?.[key];
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([value, count]) => ({ value, count }));
}

async function safeLoadJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadManifestFromRecord(rootDir, record) {
  if (!record?.manifestPath) {
    return null;
  }
  return safeLoadJson(path.join(rootDir, record.manifestPath));
}

function buildReviewSnapshotFromManifest(manifest) {
  if (!manifest) {
    return {
      itemCount: 0,
      topRepo: null,
      reviewScope: null,
      runConfidence: null
    };
  }

  if (manifest.review) {
    return {
      itemCount: Array.isArray(manifest.review.items) ? manifest.review.items.length : 0,
      topRepo: manifest.review.topItems?.[0]?.repoRef ?? null,
      reviewScope: manifest.review.reviewScope ?? manifest.reviewScope ?? null,
      runConfidence: manifest.review.runConfidence ?? null
    };
  }

  return {
    itemCount: Number(manifest.reviewRun?.items ?? 0) || 0,
    topRepo: null,
    reviewScope: manifest.reviewRun?.reviewScope ?? manifest.reviewScope ?? null,
    runConfidence: null
  };
}

async function loadReviewSnapshot(rootDir, manifest) {
  const direct = buildReviewSnapshotFromManifest(manifest);
  if (direct.itemCount > 0 || direct.topRepo || direct.reviewScope || direct.runConfidence) {
    return direct;
  }

  if (!manifest?.reviewRun?.runDir) {
    return direct;
  }

  const linkedManifest = await safeLoadJson(path.join(rootDir, manifest.reviewRun.runDir, "manifest.json"));
  return buildReviewSnapshotFromManifest(linkedManifest);
}

function buildQueueDecisionStateSummary(queueRows = [], currentFingerprint = null) {
  const summary = {
    complete: 0,
    fallback: 0,
    stale: 0
  };

  for (const row of queueRows) {
    const effectiveFingerprint = currentFingerprint ?? row.rules_fingerprint ?? "__missing__";
    const state = classifyReviewItemState(row, null, effectiveFingerprint).decisionDataState;
    summary[state] = (summary[state] ?? 0) + 1;
  }

  return summary;
}

function buildQueueStatusSummary(queueRows = []) {
  return queueRows.reduce((acc, row) => {
    const status = row.status || "unknown";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
}

function buildDriftSignals({
  latestRecord,
  previousRecord,
  latestManifest,
  previousManifest,
  latestReview,
  previousReview,
  currentWatchlistUrls,
  queueRows,
  queueDecisionStateSummary,
  rulesFingerprintCounts
}) {
  if (!latestRecord) {
    return [];
  }

  const signals = [];
  if (!previousRecord) {
    signals.push({
      id: "single_run_baseline",
      severity: "low",
      message: "Only one lifecycle-relevant project run exists so far."
    });
  }

  const latestRunKind = latestManifest?.runPlan?.runKind ?? null;
  const previousRunKind = previousManifest?.runPlan?.runKind ?? null;
  if (latestRunKind && previousRunKind && latestRunKind !== previousRunKind) {
    signals.push({
      id: "run_kind_shift",
      severity: "medium",
      message: `Run kind changed from '${previousRunKind}' to '${latestRunKind}'.`
    });
  }

  const latestSourceMode = latestManifest?.sourceMode ?? null;
  const previousSourceMode = previousManifest?.sourceMode ?? null;
  if (latestSourceMode && previousSourceMode && latestSourceMode !== previousSourceMode) {
    signals.push({
      id: "source_mode_shift",
      severity: "medium",
      message: `Source mode changed from '${previousSourceMode}' to '${latestSourceMode}'.`
    });
  }

  const effectiveUrlDelta = diffLists(previousManifest?.effectiveUrls ?? [], latestManifest?.effectiveUrls ?? []);
  if (effectiveUrlDelta.added.length > 0 || effectiveUrlDelta.removed.length > 0) {
    signals.push({
      id: "effective_url_delta",
      severity: "medium",
      message: `Effective URL set changed (${effectiveUrlDelta.added.length} added, ${effectiveUrlDelta.removed.length} removed).`
    });
  }

  const latestRunWatchlistDelta = latestSourceMode === "watchlist"
    ? diffLists(latestManifest?.effectiveUrls ?? [], currentWatchlistUrls)
    : { added: [], removed: [] };
  if (latestRunWatchlistDelta.added.length > 0 || latestRunWatchlistDelta.removed.length > 0) {
    signals.push({
      id: "watchlist_delta",
      severity: "medium",
      message: `Current watchlist drifted away from the latest watchlist-backed run (${latestRunWatchlistDelta.added.length} added, ${latestRunWatchlistDelta.removed.length} removed).`
    });
  }

  if (latestReview.topRepo && previousReview.topRepo && latestReview.topRepo !== previousReview.topRepo) {
    signals.push({
      id: "top_repo_shift",
      severity: "low",
      message: `Top review repo changed from '${previousReview.topRepo}' to '${latestReview.topRepo}'.`
    });
  }

  const reviewItemDelta = Number(latestReview.itemCount ?? 0) - Number(previousReview.itemCount ?? 0);
  if (previousRecord && reviewItemDelta !== 0) {
    signals.push({
      id: "review_volume_shift",
      severity: Math.abs(reviewItemDelta) >= 3 ? "medium" : "low",
      message: `Review item count changed by ${reviewItemDelta >= 0 ? "+" : ""}${reviewItemDelta}.`
    });
  }

  if ((queueDecisionStateSummary.stale ?? 0) > 0) {
    signals.push({
      id: "stale_decision_signals",
      severity: "medium",
      message: `${queueDecisionStateSummary.stale} queue item(s) carry stale decision signals.`
    });
  }

  if ((queueDecisionStateSummary.fallback ?? 0) > 0) {
    signals.push({
      id: "fallback_decision_signals",
      severity: "medium",
      message: `${queueDecisionStateSummary.fallback} queue item(s) still rely on fallback decision signals.`
    });
  }

  if (rulesFingerprintCounts.length > 1) {
    signals.push({
      id: "rules_fingerprint_drift",
      severity: "medium",
      message: `${rulesFingerprintCounts.length} distinct rules fingerprints are still present in the live queue.`
    });
  }

  const preparedCount = queueRows.filter((row) => row.status === "promotion_prepared").length;
  const promotedCount = queueRows.filter((row) => row.status === "promoted").length;
  if (promotedCount > 0 && preparedCount > 0) {
    signals.push({
      id: "prepared_and_promoted_mix",
      severity: "low",
      message: `${preparedCount} prepared candidate(s) still sit beside ${promotedCount} already promoted repo(s).`
    });
  }

  return signals;
}

function buildDriftStatus(latestRecord, signals) {
  if (!latestRecord) {
    return "no_runs";
  }
  if (signals.length === 1 && signals[0].id === "single_run_baseline") {
    return "single_run_baseline";
  }
  if (signals.some((signal) => signal.severity === "medium" || signal.severity === "high")) {
    return "attention_required";
  }
  if (signals.length > 0) {
    return "light_drift";
  }
  return "stable";
}

function buildResumeGuidance({
  projectKey,
  driftStatus,
  signals,
  queueDecisionStateSummary,
  latestManifest
}) {
  const signalIds = new Set(signals.map((item) => item.id));

  if (!latestManifest) {
    return {
      mode: "run_first_on_demand",
      nextAction: `Start with an explicit on-demand run: npm run analyze -- --project ${projectKey} <github-url>`,
      recommendedCommand: `npm run analyze -- --project ${projectKey} <github-url>`
    };
  }

  if ((queueDecisionStateSummary.stale ?? 0) > 0) {
    return {
      mode: "re_evaluate_stale_queue",
      nextAction: `Refresh stale queue items before the next broader review: npm run re-evaluate -- --project ${projectKey} --stale-only`,
      recommendedCommand: `npm run re-evaluate -- --project ${projectKey} --stale-only`
    };
  }

  if ((queueDecisionStateSummary.fallback ?? 0) > 0) {
    return {
      mode: "re_evaluate_fallback_queue",
      nextAction: `Refresh fallback queue items so later runs stop relying on derived decisions only: npm run re-evaluate -- --project ${projectKey}`,
      recommendedCommand: `npm run re-evaluate -- --project ${projectKey}`
    };
  }

  if (signalIds.has("watchlist_delta") || signalIds.has("effective_url_delta")) {
    return {
      mode: "review_drift_before_promotion",
      nextAction: `Treat the next run as a drift check before broader promotion changes: npm run run-plan -- --project ${projectKey}`,
      recommendedCommand: `npm run run-plan -- --project ${projectKey}`
    };
  }

  if (signalIds.has("top_repo_shift") || signalIds.has("run_kind_shift") || signalIds.has("source_mode_shift")) {
    return {
      mode: "follow_up_review",
      nextAction: `Run a deliberate follow-up review before applying more curated changes: npm run patternpilot -- review-watchlist --project ${projectKey}`,
      recommendedCommand: `npm run patternpilot -- review-watchlist --project ${projectKey}`
    };
  }

  if (driftStatus === "stable") {
    return {
      mode: "continue_default_lifecycle",
      nextAction: `No major drift signal is active. Continue with the default lifecycle for the next ${latestManifest.runPlan?.runKind ?? "project"} run.`,
      recommendedCommand: null
    };
  }

  return {
    mode: "manual_check",
    nextAction: "Inspect the latest run summary and queue state before choosing the next step.",
    recommendedCommand: null
  };
}

export async function buildProjectRunDrift(rootDir, config, {
  projectKey,
  selectedRunId = null,
  watchlistUrls = [],
  currentFingerprint = null
}) {
  const history = await listProjectRunHistory(rootDir, config, projectKey);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === projectKey);

  return buildProjectRunDriftFromState(rootDir, {
    projectKey,
    history,
    queueRows,
    selectedRunId,
    watchlistUrls,
    currentFingerprint
  });
}

export async function buildProjectRunDriftFromState(rootDir, {
  projectKey,
  history = [],
  queueRows = [],
  selectedRunId = null,
  watchlistUrls = [],
  currentFingerprint = null
}) {
  const selectedIndex = selectedRunId
    ? history.findIndex((record) => record.runId === selectedRunId)
    : 0;
  const latestRecord = selectedIndex >= 0 ? history[selectedIndex] ?? null : history[0] ?? null;
  const previousRecord = selectedIndex >= 0 ? history[selectedIndex + 1] ?? null : history[1] ?? null;
  const latestManifest = await loadManifestFromRecord(rootDir, latestRecord);
  const previousManifest = await loadManifestFromRecord(rootDir, previousRecord);
  const latestReview = await loadReviewSnapshot(rootDir, latestManifest);
  const previousReview = await loadReviewSnapshot(rootDir, previousManifest);
  const queueDecisionStateSummary = buildQueueDecisionStateSummary(queueRows, currentFingerprint);
  const queueStatusSummary = buildQueueStatusSummary(queueRows);
  const rulesFingerprintCounts = countBy(queueRows, "rules_fingerprint");
  const signals = buildDriftSignals({
    latestRecord,
    previousRecord,
    latestManifest,
    previousManifest,
    latestReview,
    previousReview,
    currentWatchlistUrls: normalizeList(watchlistUrls),
    queueRows,
    queueDecisionStateSummary,
    rulesFingerprintCounts
  });
  const driftStatus = buildDriftStatus(latestRecord, signals);
  const effectiveUrlDelta = diffLists(previousManifest?.effectiveUrls ?? [], latestManifest?.effectiveUrls ?? []);
  const currentWatchlistDelta = latestManifest?.sourceMode === "watchlist"
    ? diffLists(latestManifest?.effectiveUrls ?? [], watchlistUrls)
    : { added: [], removed: [] };
  const resumeGuidance = buildResumeGuidance({
    projectKey,
    driftStatus,
    signals,
    queueDecisionStateSummary,
    latestManifest
  });

  return {
    projectKey,
    generatedAt: new Date().toISOString(),
    driftStatus,
    latestRun: latestRecord
      ? {
          ...latestRecord,
          runKind: latestManifest?.runPlan?.runKind ?? null,
          sourceMode: latestManifest?.sourceMode ?? latestRecord.sourceMode ?? null,
          effectiveUrls: normalizeList(latestManifest?.effectiveUrls ?? []),
          review: latestReview
        }
      : null,
    previousRun: previousRecord
      ? {
          ...previousRecord,
          runKind: previousManifest?.runPlan?.runKind ?? null,
          sourceMode: previousManifest?.sourceMode ?? previousRecord.sourceMode ?? null,
          effectiveUrls: normalizeList(previousManifest?.effectiveUrls ?? []),
          review: previousReview
        }
      : null,
    effectiveUrlDelta,
    currentWatchlistDelta,
    queueSnapshot: {
      total: queueRows.length,
      byStatus: queueStatusSummary,
      decisionStateSummary: queueDecisionStateSummary,
      rulesFingerprintCounts
    },
    signals,
    resumeGuidance
  };
}

export function renderProjectRunDriftSummary({
  projectKey,
  drift
}) {
  const signalLines = drift.signals.length > 0
    ? drift.signals.map((item) => `- ${item.severity.toUpperCase()} | ${item.id} | ${item.message}`).join("\n")
    : "- none";
  const rulesFingerprintLines = drift.queueSnapshot.rulesFingerprintCounts.length > 0
    ? drift.queueSnapshot.rulesFingerprintCounts.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const watchlistDeltaLines = drift.currentWatchlistDelta.added.length > 0 || drift.currentWatchlistDelta.removed.length > 0
    ? [
        ...drift.currentWatchlistDelta.added.map((item) => `- added_vs_latest_watchlist_run: ${item}`),
        ...drift.currentWatchlistDelta.removed.map((item) => `- removed_vs_latest_watchlist_run: ${item}`)
      ].join("\n")
    : "- none";
  const effectiveUrlDeltaLines = drift.effectiveUrlDelta.added.length > 0 || drift.effectiveUrlDelta.removed.length > 0
    ? [
        ...drift.effectiveUrlDelta.added.map((item) => `- added: ${item}`),
        ...drift.effectiveUrlDelta.removed.map((item) => `- removed: ${item}`)
      ].join("\n")
    : "- none";

  return `# Patternpilot Run Drift

- project: ${projectKey}
- generated_at: ${drift.generatedAt}
- drift_status: ${drift.driftStatus}
- latest_run: ${drift.latestRun?.runId ?? "-"}
- previous_run: ${drift.previousRun?.runId ?? "-"}
- latest_run_kind: ${drift.latestRun?.runKind ?? "-"}
- previous_run_kind: ${drift.previousRun?.runKind ?? "-"}

## Signals

${signalLines}

## Effective URL Delta

${effectiveUrlDeltaLines}

## Current Watchlist Delta

${watchlistDeltaLines}

## Queue Snapshot

- total: ${drift.queueSnapshot.total}
- by_status: ${Object.entries(drift.queueSnapshot.byStatus).map(([key, value]) => `${key}=${value}`).join(", ") || "-"}
- decision_states: complete=${drift.queueSnapshot.decisionStateSummary.complete ?? 0}, fallback=${drift.queueSnapshot.decisionStateSummary.fallback ?? 0}, stale=${drift.queueSnapshot.decisionStateSummary.stale ?? 0}

## Rules Fingerprints

${rulesFingerprintLines}

## Resume Guidance

- mode: ${drift.resumeGuidance.mode}
- next_action: ${drift.resumeGuidance.nextAction}
- recommended_command: ${drift.resumeGuidance.recommendedCommand ?? "-"}
`;
}
