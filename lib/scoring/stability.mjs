// lib/scoring/stability.mjs
//
// Phase-5-Aggregator aus docs/foundation/SCORE_STABILITY_PLAN.md:
// Nimmt N Score-Ergebnisse aus dem Phase-0-Scorer und verdichtet sie zu
// Stability-Statistiken (Median, Min, Max, Per-Axis-Mittelwerte).
//
// Reine Funktionen, keine I/O. Der Harness-Wrapper (scripts/run-
// stability-test.mjs) liest JSONs ein und ruft hier durch.

import { AXIS_NAMES } from "./score-report.mjs";

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

export function aggregateStability(scoreResults, options = {}) {
  const thresholds = { ...ACCEPTANCE_THRESHOLDS, ...(options.thresholds ?? {}) };
  const runs = Array.isArray(scoreResults) ? scoreResults : [];
  if (runs.length === 0) {
    return {
      run_count: 0,
      total: { median: null, min: null, max: null, mean: null },
      acceptance: { median: false, min: false, max: false, overall: false, thresholds },
      axes: Object.fromEntries(AXIS_NAMES.map((name) => [name, { mean: null, min: null, max: null }])),
      kinds: {},
      thresholds,
    };
  }

  const totals = runs.map((run) => Number(run?.total ?? 0));
  const totalStats = {
    median: median(totals),
    min: Math.min(...totals),
    max: Math.max(...totals),
    mean: mean(totals),
  };

  const axesStats = {};
  for (const name of AXIS_NAMES) {
    const axisScores = runs.map((run) => Number(run?.axes?.[name]?.score ?? 0));
    axesStats[name] = {
      mean: mean(axisScores),
      min: Math.min(...axisScores),
      max: Math.max(...axisScores),
    };
  }

  const kinds = {};
  for (const run of runs) {
    const kind = run?.kind ?? "unknown";
    kinds[kind] = (kinds[kind] ?? 0) + 1;
  }

  const acceptance = {
    median: totalStats.median !== null && totalStats.median >= thresholds.median,
    min: totalStats.min >= thresholds.min,
    max: totalStats.max >= thresholds.max,
    thresholds,
  };
  acceptance.overall = acceptance.median && acceptance.min && acceptance.max;

  return {
    run_count: runs.length,
    total: totalStats,
    acceptance,
    axes: axesStats,
    kinds,
    thresholds,
  };
}

export function summarizeAxisWeakness(stability) {
  // Gibt die schwaechsten Achsen zurueck — die Achse mit dem niedrigsten
  // Mean-Score ist der wahrscheinlichste Folge-Hebel fuer eine weitere
  // Pipeline-Verbesserung.
  if (!stability || stability.run_count === 0) return [];
  return Object.entries(stability.axes)
    .map(([name, stats]) => ({ axis: name, mean: stats.mean ?? 0, min: stats.min ?? 0 }))
    .sort((left, right) => left.mean - right.mean)
    .slice(0, 3);
}

export function describeAcceptance(stability) {
  if (!stability || stability.run_count === 0) {
    return "no runs scored yet";
  }
  const { acceptance, total, thresholds } = stability;
  if (acceptance.overall) {
    return `PASS (median=${total.median} ≥ ${thresholds.median}, min=${total.min} ≥ ${thresholds.min}, max=${total.max} ≥ ${thresholds.max})`;
  }
  const failures = [];
  if (!acceptance.median) failures.push(`median=${total.median} < ${thresholds.median}`);
  if (!acceptance.min) failures.push(`min=${total.min} < ${thresholds.min}`);
  if (!acceptance.max) failures.push(`max=${total.max} < ${thresholds.max}`);
  return `FAIL (${failures.join(", ")})`;
}
