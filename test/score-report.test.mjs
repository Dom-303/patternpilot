import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AXIS_NAMES,
  SCHEMA_VERSION,
  scoreFromJson,
  scoreLandscape,
  scoreReview,
} from "../lib/scoring/score-report.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_ROOT = path.join(REPO_ROOT, "test", "fixtures", "score-baseline");

function readFixture(name, file) {
  const full = path.join(FIXTURE_ROOT, name, file);
  return JSON.parse(readFileSync(full, "utf8"));
}

// Each baseline fixture's expected score.  If a Phase-1-4 change causes a
// regression on a passing baseline, this test breaks the build.  That is
// the intended behavior — the scorer is the gate, not a suggestion.
const BASELINE_EXPECTATIONS = [
  {
    fixture: "01-event-dedup-landscape",
    file: "landscape.json",
    kind: "landscape",
    total: 6,
    axes: {
      "cluster-diversity": 2,
      "pattern-family-coverage": 0,
      "lens-richness": 2,
      "context-alignment": 2,
      "visual-completeness": 0,
    },
  },
  {
    fixture: "02-schema-extraction-landscape",
    file: "landscape.json",
    kind: "landscape",
    total: 8,
    axes: {
      "cluster-diversity": 2,
      "pattern-family-coverage": 1,
      "lens-richness": 2,
      "context-alignment": 2,
      "visual-completeness": 1,
    },
  },
  {
    fixture: "03-self-healing-landscape",
    file: "landscape.json",
    kind: "landscape",
    total: 7,
    axes: {
      "cluster-diversity": 2,
      "pattern-family-coverage": 1,
      "lens-richness": 2,
      "context-alignment": 2,
      "visual-completeness": 0,
    },
  },
  {
    fixture: "04-watchlist-review-empty",
    file: "manifest.json",
    kind: "review",
    total: 2,
    axes: {
      "cluster-diversity": 0,
      "pattern-family-coverage": 0,
      "lens-richness": 0,
      "context-alignment": 2,
      "visual-completeness": 0,
    },
  },
];

describe("scoreLandscape", () => {
  test("returns schemaVersion + five axes + meta", () => {
    const landscape = readFixture("02-schema-extraction-landscape", "landscape.json");
    const result = scoreLandscape(landscape);
    assert.equal(result.schemaVersion, SCHEMA_VERSION);
    assert.equal(result.kind, "landscape");
    assert.ok(typeof result.total === "number");
    assert.ok(result.total >= 0 && result.total <= 10);
    for (const name of AXIS_NAMES) {
      assert.ok(result.axes[name], `axis ${name} present`);
      assert.ok(result.axes[name].score >= 0 && result.axes[name].score <= 2);
      assert.ok(result.axes[name].measured, `axis ${name} has measured payload`);
    }
    assert.equal(result.meta.problem, "schema-exact-extraction-into-40-column-masterlist");
    assert.equal(result.meta.project, "eventbear-worker");
  });

  test("handles empty landscape gracefully", () => {
    const result = scoreLandscape({});
    assert.equal(result.kind, "landscape");
    assert.equal(result.total, 0);
    for (const name of AXIS_NAMES) {
      assert.equal(result.axes[name].score, 0);
    }
  });

  test("cluster-diversity: single cluster returns 0", () => {
    const result = scoreLandscape({
      clusters: [{ label: "solo", pattern_family: "x", member_ids: ["a"] }],
      axis_view: { axes: [] },
    });
    assert.equal(result.axes["cluster-diversity"].score, 0);
  });

  test("cluster-diversity: three lexically distinct clusters return 2", () => {
    const result = scoreLandscape({
      clusters: [
        { label: "json schema parser", pattern_family: "structured-parser", member_ids: ["a"] },
        { label: "ical rrule engine", pattern_family: "calendar-engine", member_ids: ["b"] },
        { label: "address normalizer", pattern_family: "geo-normalizer", member_ids: ["c"] },
      ],
      axis_view: { axes: [] },
    });
    assert.equal(result.axes["cluster-diversity"].score, 2);
  });

  test("cluster-diversity: three highly overlapping clusters return 1", () => {
    const result = scoreLandscape({
      clusters: [
        { label: "event dedup one", pattern_family: "event-dedup", member_ids: ["a"] },
        { label: "event dedup two", pattern_family: "event-dedup", member_ids: ["b"] },
        { label: "event dedup three", pattern_family: "event-dedup", member_ids: ["c"] },
      ],
      axis_view: { axes: [] },
    });
    assert.equal(result.axes["cluster-diversity"].score, 1);
  });

  test("pattern-family-coverage: weighted by member count, not cluster count", () => {
    // 2 clusters of 10 members each.  One is unknown.  Ratio = 10/20 = 0.5 → 0.
    const result = scoreLandscape({
      clusters: [
        {
          label: "a",
          pattern_family: "known-family",
          member_ids: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10"],
        },
        {
          label: "b",
          pattern_family: "unknown",
          member_ids: ["11", "12", "13", "14", "15", "16", "17", "18", "19", "20"],
        },
      ],
      axis_view: { axes: [] },
    });
    assert.equal(result.axes["pattern-family-coverage"].score, 0);
    assert.equal(result.axes["pattern-family-coverage"].measured.unknown_ratio, 0.5);
  });

  test("pattern-family-coverage: all known → 2", () => {
    const result = scoreLandscape({
      clusters: [
        { label: "a", pattern_family: "alpha", member_ids: ["1"] },
        { label: "b", pattern_family: "beta", member_ids: ["2"] },
      ],
      axis_view: { axes: [] },
    });
    assert.equal(result.axes["pattern-family-coverage"].score, 2);
  });

  test("context-alignment: accepts mission/deliverable/context as arrays", () => {
    const result = scoreLandscape({
      clusters: [],
      axis_view: { axes: [] },
      agentView: {
        mission: ["Do the thing"],
        deliverable: ["Ship it"],
        context: ["Because"],
      },
    });
    assert.equal(result.axes["context-alignment"].score, 2);
  });

  test("visual-completeness: <5% fallback ratio → 2", () => {
    const clusters = [];
    for (let i = 0; i < 20; i += 1) {
      clusters.push({ label: `c${i}`, pattern_family: "known", member_ids: [`m${i}`] });
    }
    const result = scoreLandscape({ clusters, axis_view: { axes: [] } });
    assert.equal(result.axes["visual-completeness"].score, 2);
  });

  test("visual-completeness: 20% fallback ratio → 1", () => {
    const clusters = [];
    for (let i = 0; i < 8; i += 1) {
      clusters.push({ label: `c${i}`, pattern_family: "known", member_ids: [`m${i}`] });
    }
    clusters.push({ label: "u1", pattern_family: "unknown", member_ids: ["mu1"] });
    clusters.push({ label: "u2", pattern_family: "unknown", member_ids: ["mu2"] });
    const result = scoreLandscape({ clusters, axis_view: { axes: [] } });
    assert.equal(result.axes["visual-completeness"].score, 1);
    assert.equal(result.axes["visual-completeness"].measured.fallback_label_ratio, 0.2);
  });
});

describe("scoreReview", () => {
  test("empty watchlist review: only context-alignment survives", () => {
    const manifest = readFixture("04-watchlist-review-empty", "manifest.json");
    const result = scoreReview(manifest);
    assert.equal(result.kind, "review");
    assert.equal(result.total, 2);
    assert.equal(result.axes["context-alignment"].score, 2);
    assert.equal(result.axes["cluster-diversity"].score, 0);
    assert.equal(result.axes["lens-richness"].score, 0);
    assert.equal(result.axes["visual-completeness"].score, 0);
  });

  test("context-alignment: needs binding + profile + coverage", () => {
    const result = scoreReview({
      reviewScope: "watchlist",
      review: {
        binding: { projectKey: "x" },
        projectProfileSummary: { summary: "s" },
        coverage: { uncoveredCapabilities: ["a", "b"] },
      },
    });
    assert.equal(result.axes["context-alignment"].score, 2);
  });

  test("visual-completeness: items + main layers → 2", () => {
    const result = scoreReview({
      reviewScope: "watchlist",
      review: {
        items: [{ id: "a" }, { id: "b" }],
        coverage: { mainLayers: ["ingestion"] },
      },
    });
    assert.equal(result.axes["visual-completeness"].score, 2);
  });
});

describe("scoreFromJson (autodetect)", () => {
  test("routes landscape payloads to scoreLandscape", () => {
    const landscape = readFixture("01-event-dedup-landscape", "landscape.json");
    const auto = scoreFromJson(landscape);
    const explicit = scoreLandscape(landscape);
    assert.equal(auto.kind, "landscape");
    assert.deepEqual(auto.axes, explicit.axes);
  });

  test("routes review manifests to scoreReview", () => {
    const manifest = readFixture("04-watchlist-review-empty", "manifest.json");
    const auto = scoreFromJson(manifest);
    const explicit = scoreReview(manifest);
    assert.equal(auto.kind, "review");
    assert.deepEqual(auto.axes, explicit.axes);
  });

  test("rejects unsupported payloads", () => {
    assert.throws(() => scoreFromJson({}), /UNSUPPORTED_RUN_KIND|neither/);
    assert.throws(() => scoreFromJson({ foo: "bar" }), /UNSUPPORTED_RUN_KIND|neither/);
  });
});

describe("scorer determinism", () => {
  test("scoring the same fixture twice returns identical results", () => {
    for (const expectation of BASELINE_EXPECTATIONS) {
      const payload = readFixture(expectation.fixture, expectation.file);
      const first = scoreFromJson(payload);
      const second = scoreFromJson(payload);
      assert.deepEqual(first, second, `fixture ${expectation.fixture} must be deterministic`);
    }
  });
});

describe("baseline expectations", () => {
  for (const expectation of BASELINE_EXPECTATIONS) {
    test(`${expectation.fixture} total = ${expectation.total}/10`, () => {
      const payload = readFixture(expectation.fixture, expectation.file);
      const result = scoreFromJson(payload);
      assert.equal(result.kind, expectation.kind);
      assert.equal(
        result.total,
        expectation.total,
        `${expectation.fixture}: total expected ${expectation.total}, got ${result.total}. Axes: ${JSON.stringify(Object.fromEntries(AXIS_NAMES.map((n) => [n, result.axes[n].score])))}`,
      );
      for (const [axisName, axisScore] of Object.entries(expectation.axes)) {
        assert.equal(
          result.axes[axisName].score,
          axisScore,
          `${expectation.fixture}: axis ${axisName} expected ${axisScore}, got ${result.axes[axisName].score}`,
        );
      }
    });
  }
});
