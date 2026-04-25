import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  aggregateStability,
  summarizeAxisWeakness,
  describeAcceptance,
  ACCEPTANCE_THRESHOLDS,
} from "../lib/scoring/stability.mjs";

function fakeScore(total, axisOverrides = {}) {
  const axes = {
    "cluster-diversity": { score: 2 },
    "pattern-family-coverage": { score: 2 },
    "lens-richness": { score: 2 },
    "context-alignment": { score: 2 },
    "visual-completeness": { score: 2 },
    ...Object.fromEntries(
      Object.entries(axisOverrides).map(([key, score]) => [key, { score }]),
    ),
  };
  return { kind: "landscape", total, axes };
}

describe("aggregateStability", () => {
  test("empty input yields zero counts and false acceptance", () => {
    const result = aggregateStability([]);
    assert.equal(result.run_count, 0);
    assert.equal(result.total.median, null);
    assert.equal(result.acceptance.overall, false);
  });

  test("computes median, min, max, mean correctly", () => {
    const scores = [
      fakeScore(2),
      fakeScore(6),
      fakeScore(8),
      fakeScore(7),
      fakeScore(9),
    ];
    const stability = aggregateStability(scores);
    assert.equal(stability.run_count, 5);
    assert.equal(stability.total.median, 7);
    assert.equal(stability.total.min, 2);
    assert.equal(stability.total.max, 9);
    assert.equal(stability.total.mean, 6.4);
  });

  test("median for even-length sample averages the two middle values", () => {
    const stability = aggregateStability([fakeScore(6), fakeScore(8)]);
    assert.equal(stability.total.median, 7);
  });

  test("acceptance flags map to thresholds", () => {
    const passing = aggregateStability([fakeScore(8), fakeScore(9), fakeScore(10), fakeScore(7)]);
    assert.equal(passing.acceptance.median, true);
    assert.equal(passing.acceptance.min, true);
    assert.equal(passing.acceptance.max, true);
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

  test("per-axis stats reflect cross-run mean / min / max", () => {
    const stability = aggregateStability([
      fakeScore(6, { "pattern-family-coverage": 0 }),
      fakeScore(7, { "pattern-family-coverage": 1 }),
      fakeScore(8, { "pattern-family-coverage": 2 }),
    ]);
    const pf = stability.axes["pattern-family-coverage"];
    assert.equal(pf.min, 0);
    assert.equal(pf.max, 2);
    assert.equal(pf.mean, 1);
  });

  test("kinds count tracks landscape vs review", () => {
    const stability = aggregateStability([
      { kind: "landscape", total: 7, axes: {} },
      { kind: "landscape", total: 8, axes: {} },
      { kind: "review", total: 2, axes: {} },
    ]);
    assert.equal(stability.kinds.landscape, 2);
    assert.equal(stability.kinds.review, 1);
  });

  test("reproduces baseline-fixture aggregate exactly", () => {
    // Anchored against the four committed baseline fixtures.
    const stability = aggregateStability([
      fakeScore(6, { "pattern-family-coverage": 0, "visual-completeness": 0 }),
      fakeScore(8, { "pattern-family-coverage": 1, "visual-completeness": 1 }),
      fakeScore(7, { "pattern-family-coverage": 1, "visual-completeness": 0 }),
      { kind: "review", total: 2, axes: {
        "cluster-diversity": { score: 0 },
        "pattern-family-coverage": { score: 0 },
        "lens-richness": { score: 0 },
        "context-alignment": { score: 2 },
        "visual-completeness": { score: 0 },
      } },
    ]);
    assert.equal(stability.run_count, 4);
    assert.equal(stability.total.median, 6.5);
    assert.equal(stability.total.min, 2);
    assert.equal(stability.total.max, 8);
    assert.equal(stability.acceptance.overall, false);
  });
});

describe("summarizeAxisWeakness", () => {
  test("returns the three lowest-mean axes", () => {
    const stability = aggregateStability([
      fakeScore(7, { "visual-completeness": 0, "pattern-family-coverage": 0, "cluster-diversity": 1 }),
      fakeScore(8, { "visual-completeness": 0, "pattern-family-coverage": 1, "cluster-diversity": 2 }),
    ]);
    const weak = summarizeAxisWeakness(stability);
    assert.equal(weak.length, 3);
    assert.equal(weak[0].axis, "visual-completeness");
    assert.equal(weak[0].mean, 0);
    assert.ok(weak[0].mean <= weak[1].mean);
    assert.ok(weak[1].mean <= weak[2].mean);
  });

  test("empty stability yields empty weakness list", () => {
    assert.deepEqual(summarizeAxisWeakness(aggregateStability([])), []);
  });
});

describe("describeAcceptance", () => {
  test("PASS message when overall acceptance true", () => {
    const stability = aggregateStability([fakeScore(8), fakeScore(9), fakeScore(10), fakeScore(8)]);
    assert.match(describeAcceptance(stability), /^PASS/);
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
