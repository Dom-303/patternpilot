import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  assessWatchlistHealth,
  buildWatchlistHealthGapSignal,
  buildWatchlistHealthNextSteps,
  HEALTH_STATE,
  DEFAULT_THRESHOLD,
} from "../lib/review/watchlist-health.mjs";

describe("assessWatchlistHealth", () => {
  test("reports empty when watchlistCount=0", () => {
    const health = assessWatchlistHealth({ watchlistCount: 0 });
    assert.equal(health.state, HEALTH_STATE.EMPTY);
    assert.equal(health.count, 0);
    assert.equal(health.threshold, DEFAULT_THRESHOLD);
    assert.equal(health.recommended_action, "discovery");
  });

  test("reports sparse when 1 ≤ count < threshold", () => {
    for (let n = 1; n < DEFAULT_THRESHOLD; n += 1) {
      const health = assessWatchlistHealth({ watchlistCount: n });
      assert.equal(health.state, HEALTH_STATE.SPARSE, `count=${n}`);
      assert.equal(health.count, n);
      assert.equal(health.recommended_action, "discovery");
    }
  });

  test("reports healthy when count >= threshold", () => {
    for (const n of [DEFAULT_THRESHOLD, DEFAULT_THRESHOLD + 1, 100]) {
      const health = assessWatchlistHealth({ watchlistCount: n });
      assert.equal(health.state, HEALTH_STATE.HEALTHY, `count=${n}`);
      assert.equal(health.recommended_action, null);
    }
  });

  test("respects custom threshold", () => {
    const health = assessWatchlistHealth({ watchlistCount: 4, threshold: 5 });
    assert.equal(health.state, HEALTH_STATE.SPARSE);
    assert.equal(health.threshold, 5);
  });

  test("captures queue_count for downstream diagnostics", () => {
    const health = assessWatchlistHealth({ watchlistCount: 0, queueCount: 7 });
    assert.equal(health.queue_count, 7);
  });

  test("clamps negative or non-numeric counts to 0", () => {
    const a = assessWatchlistHealth({ watchlistCount: -3 });
    const b = assessWatchlistHealth({ watchlistCount: "abc" });
    assert.equal(a.count, 0);
    assert.equal(b.count, 0);
    assert.equal(a.state, HEALTH_STATE.EMPTY);
  });

  test("default threshold is 3 when omitted", () => {
    const health = assessWatchlistHealth({ watchlistCount: 0 });
    assert.equal(health.threshold, 3);
  });
});

describe("buildWatchlistHealthGapSignal", () => {
  test("returns null for healthy state", () => {
    const signal = buildWatchlistHealthGapSignal({ state: HEALTH_STATE.HEALTHY }, "x");
    assert.equal(signal, null);
  });

  test("empty state produces high-strength gap signal with project key in detail", () => {
    const health = assessWatchlistHealth({ watchlistCount: 0 });
    const signal = buildWatchlistHealthGapSignal(health, "eventbear-worker");
    assert.equal(signal.gap, "watchlist_intake");
    assert.equal(signal.count, 1);
    assert.ok(signal.strength >= 80, `expected high strength, got ${signal.strength}`);
    assert.ok(signal.detail.includes("eventbear-worker"));
    assert.ok(signal.detail.toLowerCase().includes("0"));
    assert.match(signal.recommended_command, /npm run discover.*eventbear-worker/);
  });

  test("sparse state produces lower-strength signal than empty", () => {
    const empty = buildWatchlistHealthGapSignal(
      assessWatchlistHealth({ watchlistCount: 0 }),
      "x",
    );
    const sparse = buildWatchlistHealthGapSignal(
      assessWatchlistHealth({ watchlistCount: 2 }),
      "x",
    );
    assert.ok(sparse.strength < empty.strength);
  });

  test("uses fallback projectKey placeholder when omitted", () => {
    const signal = buildWatchlistHealthGapSignal(
      assessWatchlistHealth({ watchlistCount: 0 }),
      undefined,
    );
    assert.match(signal.recommended_command, /<project>/);
  });

  test("returns null on null health", () => {
    assert.equal(buildWatchlistHealthGapSignal(null, "x"), null);
    assert.equal(buildWatchlistHealthGapSignal(undefined, "x"), null);
  });
});

describe("buildWatchlistHealthNextSteps", () => {
  test("returns empty array for healthy state", () => {
    const steps = buildWatchlistHealthNextSteps({ state: HEALTH_STATE.HEALTHY }, "x");
    assert.deepEqual(steps, []);
  });

  test("empty state recommends discovery first then intake (string array)", () => {
    const health = assessWatchlistHealth({ watchlistCount: 0 });
    const steps = buildWatchlistHealthNextSteps(health, "eventbear-worker");
    assert.equal(steps.length, 2);
    for (const step of steps) {
      assert.equal(typeof step, "string", `nextSteps must be strings, got ${typeof step}`);
    }
    assert.match(steps[0], /npm run discover/);
    assert.match(steps[0], /eventbear-worker/);
    assert.match(steps[1], /npm run intake/);
  });

  test("sparse state still yields the same two-step recommendation", () => {
    const health = assessWatchlistHealth({ watchlistCount: 1 });
    const steps = buildWatchlistHealthNextSteps(health, "demo");
    assert.equal(steps.length, 2);
    assert.ok(steps[0].toLowerCase().includes("watchlist"));
  });

  test("sparse-state lead text mentions current count + threshold", () => {
    const health = assessWatchlistHealth({ watchlistCount: 1, threshold: 5 });
    const steps = buildWatchlistHealthNextSteps(health, "demo");
    assert.ok(steps[0].includes("1"), `expected "1" in step, got: ${steps[0]}`);
    assert.ok(steps[0].includes("5"), `expected "5" in step, got: ${steps[0]}`);
  });

  test("returns empty for null/undefined health", () => {
    assert.deepEqual(buildWatchlistHealthNextSteps(null, "x"), []);
    assert.deepEqual(buildWatchlistHealthNextSteps(undefined, "x"), []);
  });
});

describe("integration with the watchlist-review-empty fixture", () => {
  test("the empty fixture would produce empty health + actionable next steps", () => {
    // The fixture (test/fixtures/score-baseline/04-watchlist-review-empty/)
    // captures watchlistCount=0, queueCount=9. Confirm health detector
    // labels this as empty and yields useful guidance.
    const health = assessWatchlistHealth({ watchlistCount: 0, queueCount: 9 });
    const signal = buildWatchlistHealthGapSignal(health, "eventbear-worker");
    const steps = buildWatchlistHealthNextSteps(health, "eventbear-worker");

    assert.equal(health.state, HEALTH_STATE.EMPTY);
    assert.equal(health.queue_count, 9);
    assert.ok(signal !== null);
    assert.equal(signal.gap, "watchlist_intake");
    assert.equal(steps.length, 2);
  });
});
