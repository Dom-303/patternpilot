import {
  buildProjectRunDrift,
  buildProjectRunGovernance,
  buildProjectRunLifecycle,
  buildProjectRunStability,
  listProjectRunHistory,
  loadQueueEntries,
  refreshOperationalDocs
} from "../../lib/index.mjs";

function buildQueueLifecycleStats(queueRows = []) {
  return queueRows.reduce((acc, row) => {
    acc.total += 1;
    const status = row.status || "unknown";
    acc.byStatus[status] = (acc.byStatus[status] ?? 0) + 1;
    if (status === "promoted") {
      acc.promoted += 1;
    }
    if (status === "promotion_prepared") {
      acc.prepared += 1;
    }
    return acc;
  }, {
    total: 0,
    promoted: 0,
    prepared: 0,
    byStatus: {}
  });
}

export async function refreshContext(rootDir, config, context) {
  await refreshOperationalDocs(rootDir, config, context);
}

export async function buildProjectRunDiagnostics(rootDir, config, {
  projectKey,
  sourceMode,
  explicitUrlCount = 0,
  watchlistCount = 0,
  watchlistUrls = [],
  currentFingerprint = null,
  isAutomation = false
}) {
  const priorRuns = await listProjectRunHistory(rootDir, config, projectKey);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === projectKey);
  const stability = await buildProjectRunStability(rootDir, config, {
    projectKey
  });
  const lifecycle = buildProjectRunLifecycle({
    priorRuns,
    sourceMode,
    explicitUrlCount,
    watchlistCount,
    isAutomation,
    queueStats: buildQueueLifecycleStats(queueRows)
  });
  const drift = await buildProjectRunDrift(rootDir, config, {
    projectKey,
    watchlistUrls,
    currentFingerprint
  });

  return {
    priorRuns,
    queueRows,
    stability,
    lifecycle,
    drift
  };
}

export function buildProjectRunGovernanceSnapshot({
  projectKey,
  lifecycle,
  drift,
  stability,
  scope = "manual",
  jobState = null,
  job = null
}) {
  return buildProjectRunGovernance({
    projectKey,
    lifecycle,
    drift,
    stability,
    scope,
    jobState,
    job
  });
}
