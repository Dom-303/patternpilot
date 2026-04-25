// lib/scoring/stability.mjs
//
// Phase-5-Aggregator aus docs/foundation/SCORE_STABILITY_PLAN.md:
// Nimmt N Score-Ergebnisse aus dem Phase-0-Scorer und verdichtet sie zu
// Stability-Statistiken (Median, Min, Max, Per-Axis-Mittelwerte).
//
// Reine Funktionen, keine I/O. Der Harness-Wrapper (scripts/run-
// stability-test.mjs) liest JSONs ein und ruft hier durch.

import { STRUCTURE_AXIS_NAMES, CONTENT_AXIS_NAMES } from "./score-report.mjs";

// Akzeptanzkriterien aus dem Plan §5 Phase 5:
//   Median ≥ 8, Min ≥ 7, Max ≥ 9 ueber 10 Runs
export const ACCEPTANCE_THRESHOLDS = {
  median: 8,
  min: 7,
  max: 9,
};

function median(values) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length / 2;
  if (Number.isInteger(mid)) {
    return Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(2));
  }
  return Number(sorted[Math.floor(mid)].toFixed(2));
}

function mean(values) {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Number((sum / values.length).toFixed(2));
}

function computeAxisStats(runs, perspective, axisNames) {
  const stats = {};
  for (const name of axisNames) {
    const scores = runs
      .map((run) => run?.axes?.[perspective]?.[name])
      .filter((axis) => axis && axis.applicable !== false)
      .map((axis) => Number(axis.score ?? 0));
    if (scores.length === 0) {
      stats[name] = { mean: null, min: null, max: null, applicable_runs: 0 };
      continue;
    }
    stats[name] = {
      mean: mean(scores),
      min: Math.min(...scores),
      max: Math.max(...scores),
      applicable_runs: scores.length,
    };
  }
  return stats;
}

function statsForTotalsField(runs, field) {
  const values = runs
    .map((run) => Number(run?.totals?.[field] ?? run?.total ?? 0))
    .filter((value) => Number.isFinite(value));
  if (values.length === 0) return { median: null, min: null, max: null, mean: null };
  return {
    median: median(values),
    min: Math.min(...values),
    max: Math.max(...values),
    mean: mean(values),
  };
}

export function aggregateStability(scoreResults, options = {}) {
  const thresholds = { ...ACCEPTANCE_THRESHOLDS, ...(options.thresholds ?? {}) };
  const runs = Array.isArray(scoreResults) ? scoreResults : [];
  if (runs.length === 0) {
    return {
      run_count: 0,
      total: { median: null, min: null, max: null, mean: null },
      structure: { median: null, min: null, max: null, mean: null },
      content: { median: null, min: null, max: null, mean: null },
      acceptance: { median: false, min: false, max: false, overall: false, thresholds },
      axes: { structure: {}, content: {} },
      kinds: {},
      thresholds,
    };
  }

  const totalStats = statsForTotalsField(runs, "combined");
  const structureStats = statsForTotalsField(runs, "structure");
  const contentStats = statsForTotalsField(runs, "content");

  const axesStats = {
    structure: computeAxisStats(runs, "structure", STRUCTURE_AXIS_NAMES),
    content: computeAxisStats(runs, "content", CONTENT_AXIS_NAMES),
  };

  const kinds = {};
  for (const run of runs) {
    const kind = run?.kind ?? "unknown";
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }

  const acceptance = {
    median: totalStats.median !== null && totalStats.median >= thresholds.median,
    min: totalStats.min !== null && totalStats.min >= thresholds.min,
    max: totalStats.max !== null && totalStats.max >= thresholds.max,
    thresholds,
  };
  acceptance.overall = acceptance.median && acceptance.min && acceptance.max;

  return {
    run_count: runs.length,
    total: totalStats,
    structure: structureStats,
    content: contentStats,
    acceptance,
    axes: axesStats,
    kinds,
    thresholds,
  };
}

export function summarizeAxisWeakness(stability) {
  // Gibt die schwaechsten Achsen quer ueber Struktur + Inhalt zurueck.
  if (!stability || stability.run_count === 0) return [];
  const collected = [];
  for (const [perspective, group] of Object.entries(stability.axes ?? {})) {
    for (const [name, stats] of Object.entries(group)) {
      if (stats?.mean === null || stats?.mean === undefined) continue;
      collected.push({
        perspective,
        axis: name,
        mean: stats.mean,
        min: stats.min ?? 0,
        applicable_runs: stats.applicable_runs ?? 0,
      });
    }
  }
  return collected
    .sort((left, right) => left.mean - right.mean)
    .slice(0, 4);
}

export function describeAcceptance(stability) {
  if (!stability || stability.run_count === 0) {
    return "no runs scored yet";
  }
  const { acceptance, total, thresholds } = stability;
  if (acceptance.overall) {
    return `PASS (combined median=${total.median} ≥ ${thresholds.median}, min=${total.min} ≥ ${thresholds.min}, max=${total.max} ≥ ${thresholds.max})`;
  }
  const failures = [];
  if (!acceptance.median) failures.push(`median=${total.median} < ${thresholds.median}`);
  if (!acceptance.min) failures.push(`min=${total.min} < ${thresholds.min}`);
  if (!acceptance.max) failures.push(`max=${total.max} < ${thresholds.max}`);
  return `FAIL (combined ${failures.join(", ")})`;
}
