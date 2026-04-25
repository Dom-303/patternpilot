import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  aggregateStability,
  summarizeAxisWeakness,
  describeAcceptance,
  ACCEPTANCE_THRESHOLDS,
} from "../lib/scoring/stability.mjs";

function fakeScore(combined, options = {}) {
  const structure = options.structure ?? combined;
  const content = options.content ?? combined;
  const structureAxes = {
    "cluster-diversity": { score: 2, applicable: true },
    "pattern-family-coverage": { score: 2, applicable: true },
    "lens-richness": { score: 2, applicable: true },
    "context-alignment": { score: 2, applicable: true },
    "visual-completeness": { score: 2, applicable: true },
  };
  const contentAxes = {
    "problem-fit": { score: 2, applicable: true },
    "label-fidelity": { score: 2, applicable: true },
    "classification-confidence": { score: 2, applicable: true },
    "decision-readiness": { score: 2, applicable: true },
  };
  for (const [k, v] of Object.entries(options.structureAxes ?? {})) {
    structureAxes[k] = { score: v, applicable: true };
  }
  for (const [k, v] of Object.entries(options.contentAxes ?? {})) {
    contentAxes[k] = typeof v === "object" ? v : { score: v, applicable: true };
  }
  return {
    kind: options.kind ?? "landscape",
    total: combined,
    totals: { structure, content, combined },
    axes: { structure: structureAxes, content: contentAxes },
  };
}

describe("aggregateStability", () => {
  test("empty input yields zero counts and false acceptance", () => {
    const result = aggregateStability([]);
    assert.equal(result.run_count, 0);
    assert.equal(result.total.median, null);
    assert.equal(result.acceptance.overall, false);
  });

  test("computes median, min, max, mean correctly on combined totals", () => {
    const scores = [fakeScore(2), fakeScore(6), fakeScore(8), fakeScore(7), fakeScore(9)];
    const stability = aggregateStability(scores);
    assert.equal(stability.run_count, 5);
    assert.equal(stability.total.median, 7);
    assert.equal(stability.total.min, 2);
    assert.equal(stability.total.max, 9);
    assert.equal(stability.total.mean, 6.4);
  });

  test("acceptance is computed against combined totals", () => {
    const passing = aggregateStability([fakeScore(8), fakeScore(9), fakeScore(10), fakeScore(7)]);
    assert.equal(passing.acceptance.overall, true);

    const lowMedian = aggregateStability([fakeScore(7), fakeScore(7), fakeScore(9), fakeScore(7)]);
    assert.equal(lowMedian.acceptance.median, false);
    assert.equal(lowMedian.acceptance.overall, false);
  });

  test("custom thresholds override defaults", () => {
    const stability = aggregateStability(
      [fakeScore(6), fakeScore(7), fakeScore(7), fakeScore(8)],
      { thresholds: { median: 6, min: 5, max: 7 } },
    );
    assert.equal(stability.acceptance.overall, true);
    assert.equal(stability.thresholds.median, 6);
  });

  test("structure + content totals are tracked separately", () => {
    const stability = aggregateStability([
      fakeScore(7, { structure: 10, content: 4 }),
      fakeScore(8, { structure: 10, content: 6 }),
      fakeScore(9, { structure: 10, content: 8 }),
    ]);
    assert.equal(stability.structure.median, 10);
    assert.equal(stability.content.median, 6);
    assert.equal(stability.total.median, 8);
  });

  test("non-applicable content axes are excluded from per-axis stats", () => {
    const stability = aggregateStability([
      fakeScore(8, {
        contentAxes: {
          "problem-fit": { score: 0, applicable: false },
          "label-fidelity": { score: 1, applicable: true },
        },
      }),
      fakeScore(8, {
        contentAxes: {
          "problem-fit": { score: 0, applicable: false },
          "label-fidelity": { score: 1, applicable: true },
        },
      }),
    ]);
    assert.equal(stability.axes.content["problem-fit"].applicable_runs, 0);
    assert.equal(stability.axes.content["problem-fit"].mean, null);
    assert.equal(stability.axes.content["label-fidelity"].applicable_runs, 2);
    assert.equal(stability.axes.content["label-fidelity"].mean, 1);
  });

  test("kinds count tracks landscape vs review", () => {
    const stability = aggregateStability([
      fakeScore(8, { kind: "landscape" }),
      fakeScore(8, { kind: "landscape" }),
      fakeScore(2, { kind: "review" }),
    ]);
    assert.equal(stability.kinds.landscape, 2);
    assert.equal(stability.kinds.review, 1);
  });
});

describe("summarizeAxisWeakness", () => {
  test("returns the lowest-mean axes across structure + content", () => {
    const stability = aggregateStability([
      fakeScore(7, {
        structureAxes: { "cluster-diversity": 1 },
        contentAxes: { "label-fidelity": 0, "problem-fit": 1 },
      }),
      fakeScore(7, {
        structureAxes: { "cluster-diversity": 2 },
        contentAxes: { "label-fidelity": 0, "problem-fit": 1 },
      }),
    ]);
    const weak = summarizeAxisWeakness(stability);
    assert.ok(weak.length > 0);
    assert.equal(weak[0].axis, "label-fidelity");
    assert.equal(weak[0].perspective, "content");
    assert.equal(weak[0].mean, 0);
  });

  test("empty stability yields empty weakness list", () => {
    assert.deepEqual(summarizeAxisWeakness(aggregateStability([])), []);
  });
});

describe("describeAcceptance", () => {
  test("PASS message references combined", () => {
    const stability = aggregateStability([fakeScore(8), fakeScore(9), fakeScore(10), fakeScore(8)]);
    assert.match(describeAcceptance(stability), /^PASS.*combined median/);
  });

  test("FAIL message lists the failing thresholds", () => {
    const stability = aggregateStability([fakeScore(2), fakeScore(3)]);
    const description = describeAcceptance(stability);
    assert.match(description, /^FAIL/);
    assert.match(description, /median/);
    assert.match(description, /min/);
    assert.match(description, /max/);
  });
});

describe("ACCEPTANCE_THRESHOLDS", () => {
  test("matches the plan §5 Phase 5 acceptance bar", () => {
    assert.equal(ACCEPTANCE_THRESHOLDS.median, 8);
    assert.equal(ACCEPTANCE_THRESHOLDS.min, 7);
    assert.equal(ACCEPTANCE_THRESHOLDS.max, 9);
  });
});
