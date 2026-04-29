import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { summarizeStaleData } from "../../lib/stale-data/detect.mjs";

describe("summarizeStaleData", () => {
  test("returns zero counts when no rows are stale", () => {
    const rows = [
      { project_key: "p", decision_data_state: "live", drift_reasons: [] },
      { project_key: "p", decision_data_state: "live", drift_reasons: [] }
    ];
    const summary = summarizeStaleData(rows, "p");
    assert.equal(summary.totalStale, 0);
    assert.deepEqual(summary.byReason, {});
    assert.deepEqual(summary.examples, []);
  });

  test("counts stale rows and groups by drift reason", () => {
    const rows = [
      { project_key: "p", decision_data_state: "fallback", drift_reasons: ["fallback_decision_data"], repo_url: "https://github.com/a/b" },
      { project_key: "p", decision_data_state: "stale", drift_reasons: ["rules_fingerprint_drift"], repo_url: "https://github.com/c/d" },
      { project_key: "p", decision_data_state: "stale", drift_reasons: ["rules_fingerprint_drift"], repo_url: "https://github.com/e/f" },
      { project_key: "p", decision_data_state: "live", drift_reasons: [], repo_url: "https://github.com/g/h" }
    ];
    const summary = summarizeStaleData(rows, "p");
    assert.equal(summary.totalStale, 3);
    assert.equal(summary.byReason.fallback_decision_data, 1);
    assert.equal(summary.byReason.rules_fingerprint_drift, 2);
    assert.equal(summary.examples.length, 3);
  });

  test("limits examples to maxExamples (default 3)", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      project_key: "p",
      decision_data_state: "stale",
      drift_reasons: ["stale_decision_data"],
      repo_url: `https://github.com/x/${i}`
    }));
    const summary = summarizeStaleData(rows, "p");
    assert.equal(summary.totalStale, 10);
    assert.equal(summary.examples.length, 3);
  });

  test("filters by project key", () => {
    const rows = [
      { project_key: "a", decision_data_state: "stale", drift_reasons: ["x"], repo_url: "url-a" },
      { project_key: "b", decision_data_state: "stale", drift_reasons: ["x"], repo_url: "url-b" }
    ];
    const summary = summarizeStaleData(rows, "a");
    assert.equal(summary.totalStale, 1);
    assert.equal(summary.examples[0], "url-a");
  });
});
