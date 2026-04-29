const STALE_STATES = new Set(["fallback", "stale", "missing"]);

export function summarizeStaleData(queueRows, projectKey, { maxExamples = 3 } = {}) {
  const stale = queueRows.filter((row) =>
    row.project_key === projectKey
    && (STALE_STATES.has(row.decision_data_state) || (row.drift_reasons ?? []).length > 0)
  );

  const byReason = {};
  for (const row of stale) {
    const reasons = row.drift_reasons ?? [];
    for (const reason of reasons) {
      byReason[reason] = (byReason[reason] ?? 0) + 1;
    }
  }

  const examples = stale.slice(0, maxExamples).map((row) => row.repo_url || row.normalized_repo_url || "?");

  return {
    totalStale: stale.length,
    byReason,
    examples
  };
}
