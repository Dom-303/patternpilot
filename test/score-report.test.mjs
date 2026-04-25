import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  AXIS_NAMES,
  STRUCTURE_AXIS_NAMES,
  CONTENT_AXIS_NAMES,
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

// Phase-6-Baseline-Erwartungen (Schema v2): jeder Eintrag enthaelt
// strukturelle UND inhaltliche Score-Erwartungen sowie das kombinierte
// Total. Die Baseline-Fixtures enthalten KEIN problem_derived und KEIN
// pattern_family_summary, weil sie vor Phase 1+2 erzeugt wurden — daher
// werden problem-fit und classification-confidence als applicable=false
// gemeldet und sind aus dem content-Total ausgeschlossen.
const BASELINE_EXPECTATIONS = [
  {
    fixture: "01-event-dedup-landscape",
    file: "landscape.json",
    kind: "landscape",
    structureTotal: 6,
    contentTotal: 5,
    combinedTotal: 5.5,
    structureAxes: {
      "cluster-diversity": 2,
      "pattern-family-coverage": 0,
      "lens-richness": 2,
      "context-alignment": 2,
      "visual-completeness": 0,
    },
    contentAxes: {
      "problem-fit": { applicable: false },
      "label-fidelity": { score: 0 },
      "classification-confidence": { applicable: false },
      "decision-readiness": { score: 2 },
    },
  },
  {
    fixture: "02-schema-extraction-landscape",
    file: "landscape.json",
    kind: "landscape",
    structureTotal: 8,
    contentTotal: 5,
    combinedTotal: 6.5,
    structureAxes: {
      "cluster-diversity": 2,
      "pattern-family-coverage": 1,
      "lens-richness": 2,
      "context-alignment": 2,
      "visual-completeness": 1,
    },
    contentAxes: {
      "problem-fit": { applicable: false },
      "label-fidelity": { score: 0 },
      "classification-confidence": { applicable: false },
      "decision-readiness": { score: 2 },
    },
  },
  {
    fixture: "03-self-healing-landscape",
    file: "landscape.json",
    kind: "landscape",
    structureTotal: 7,
    contentTotal: 5,
    combinedTotal: 6,
    structureAxes: {
      "cluster-diversity": 2,
      "pattern-family-coverage": 1,
      "lens-richness": 2,
      "context-alignment": 2,
      "visual-completeness": 0,
    },
    contentAxes: {
      "problem-fit": { applicable: false },
      "label-fidelity": { score: 0 },
      "classification-confidence": { applicable: false },
      "decision-readiness": { score: 2 },
    },
  },
  {
    fixture: "04-watchlist-review-empty",
    file: "manifest.json",
    kind: "review",
    structureTotal: 2,
    contentTotal: 0,
    combinedTotal: 1,
    structureAxes: {
      "cluster-diversity": 0,
      "pattern-family-coverage": 0,
      "lens-richness": 0,
      "context-alignment": 2,
      "visual-completeness": 0,
    },
    contentAxes: {
      "problem-fit": { applicable: false },
      "label-fidelity": { applicable: false },
      "classification-confidence": { applicable: false },
      "decision-readiness": { score: 0 },
    },
  },
];

describe("scoreLandscape", () => {
  test("returns schemaVersion v2 + split structure/content axes + meta", () => {
    const landscape = readFixture("02-schema-extraction-landscape", "landscape.json");
    const result = scoreLandscape(landscape);
    assert.equal(result.schemaVersion, SCHEMA_VERSION);
    assert.equal(SCHEMA_VERSION, 2);
    assert.equal(result.kind, "landscape");
    assert.ok(typeof result.total === "number");
    assert.ok(result.total >= 0 && result.total <= 10);
    assert.ok(result.totals);
    assert.ok(typeof result.totals.structure === "number");
    assert.ok(typeof result.totals.content === "number");
    assert.ok(typeof result.totals.combined === "number");
    assert.ok(result.axes.structure);
    assert.ok(result.axes.content);
    for (const name of STRUCTURE_AXIS_NAMES) {
      assert.ok(result.axes.structure[name], `structure axis ${name} present`);
      assert.ok(result.axes.structure[name].score >= 0 && result.axes.structure[name].score <= 2);
    }
    for (const name of CONTENT_AXIS_NAMES) {
      assert.ok(result.axes.content[name], `content axis ${name} present`);
      assert.ok(result.axes.content[name].score >= 0 && result.axes.content[name].score <= 2);
      assert.equal(typeof result.axes.content[name].applicable, "boolean");
    }
  });

  test("AXIS_NAMES backwards-compat alias points to STRUCTURE_AXIS_NAMES", () => {
    assert.deepEqual(AXIS_NAMES, STRUCTURE_AXIS_NAMES);
  });

  test("handles empty landscape gracefully", () => {
    const result = scoreLandscape({});
    assert.equal(result.kind, "landscape");
    assert.equal(result.totals.structure, 0);
    for (const name of STRUCTURE_AXIS_NAMES) {
      assert.equal(result.axes.structure[name].score, 0);
    }
  });

  test("cluster-diversity: single cluster returns 0", () => {
    const result = scoreLandscape({
      clusters: [{ label: "solo", pattern_family: "x", member_ids: ["a"] }],
      axis_view: { axes: [] },
    });
    assert.equal(result.axes.structure["cluster-diversity"].score, 0);
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
    assert.equal(result.axes.structure["cluster-diversity"].score, 2);
  });

  test("pattern-family-coverage: weighted by member count, not cluster count", () => {
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
    assert.equal(result.axes.structure["pattern-family-coverage"].score, 0);
    assert.equal(result.axes.structure["pattern-family-coverage"].measured.unknown_ratio, 0.5);
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
    assert.equal(result.axes.structure["context-alignment"].score, 2);
  });

  test("problem-fit: applicable=false when problem_derived missing", () => {
    const result = scoreLandscape({ clusters: [], axis_view: { axes: [] } });
    assert.equal(result.axes.content["problem-fit"].applicable, false);
  });

  test("problem-fit: applicable=true when problem_derived present, scores by jaccard", () => {
    const landscape = {
      clusters: [],
      axis_view: {
        axes: [
          {
            label: "x",
            members: [
              {
                id: "https://github.com/foo/parser",
                topics: ["parser", "json", "schema"],
                description: "json schema parser",
              },
            ],
          },
        ],
      },
      problem_derived: {
        query_seeds: ["json schema parser library"],
        approach_signature: ["parser"],
        tech_tags: ["nodejs"],
      },
    };
    const result = scoreLandscape(landscape);
    assert.equal(result.axes.content["problem-fit"].applicable, true);
    assert.ok(result.axes.content["problem-fit"].score >= 1);
  });

  test("classification-confidence: applicable=false when pattern_family_summary missing", () => {
    const result = scoreLandscape({ clusters: [], axis_view: { axes: [] } });
    assert.equal(result.axes.content["classification-confidence"].applicable, false);
  });

  test("classification-confidence: 95%+ classified -> 2", () => {
    const result = scoreLandscape({
      clusters: [],
      axis_view: { axes: [] },
      pattern_family_summary: { strategy: "auto", total: 20, classified: 20, classified_ratio: 1 },
    });
    assert.equal(result.axes.content["classification-confidence"].score, 2);
  });

  test("decision-readiness: counts agentView checks", () => {
    const result = scoreLandscape({
      clusters: [],
      axis_view: { axes: [] },
      relation_counts: { divergent: 1, adjacent: 1, near_current_approach: 0 },
      agentView: {
        priorityRepos: ["a", "b", "c"],
        codingStarter: { mission: "x" },
        deliverable: ["one", "two"],
        uncertainties: ["something"],
      },
    });
    assert.equal(result.axes.content["decision-readiness"].score, 2);
  });
});

describe("scoreReview", () => {
  test("empty watchlist review: structure 2/10, content 0/10 (only decision-readiness applicable)", () => {
    const manifest = readFixture("04-watchlist-review-empty", "manifest.json");
    const result = scoreReview(manifest);
    assert.equal(result.kind, "review");
    assert.equal(result.totals.structure, 2);
    assert.equal(result.totals.content, 0);
    assert.equal(result.axes.structure["context-alignment"].score, 2);
    // Only decision-readiness is applicable on the empty fixture.
    assert.equal(result.axes.content["problem-fit"].applicable, false);
    assert.equal(result.axes.content["label-fidelity"].applicable, false);
    assert.equal(result.axes.content["classification-confidence"].applicable, false);
    assert.equal(result.axes.content["decision-readiness"].applicable, true);
  });

  test("review with items: problem-fit + label-fidelity + classification-confidence become applicable", () => {
    const manifest = {
      runId: "x",
      reviewScope: "watchlist",
      review: {
        items: [
          { projectFitBand: "high", projectFitScore: 80, matchedCapabilities: ["a"], patternFamily: "scraper", reviewDisposition: "adopt" },
          { projectFitBand: "high", projectFitScore: 70, matchedCapabilities: ["b"], patternFamily: "deduper", reviewDisposition: "adapt" },
        ],
        topItems: [{}, {}],
        strongestPatterns: [{}, {}],
        riskiestItems: [{}],
        coverage: { mainLayers: ["x"], capabilities: ["a", "b"], uncoveredCapabilities: [] },
        nextSteps: ["one", "two"],
        binding: { projectKey: "demo" },
        projectProfileSummary: { capabilitiesPresent: ["a"] },
      },
    };
    const result = scoreReview(manifest);
    for (const name of CONTENT_AXIS_NAMES) {
      assert.equal(result.axes.content[name].applicable, true, `axis ${name} should be applicable`);
    }
    assert.equal(result.axes.content["problem-fit"].score, 2, "high fit ratio = 2");
    assert.equal(result.axes.content["classification-confidence"].score, 2, "all items classified");
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

describe("baseline expectations (Phase 6 schema v2)", () => {
  for (const expectation of BASELINE_EXPECTATIONS) {
    test(`${expectation.fixture} combined ${expectation.combinedTotal}/10 = structure ${expectation.structureTotal} + content ${expectation.contentTotal}`, () => {
      const payload = readFixture(expectation.fixture, expectation.file);
      const result = scoreFromJson(payload);
      assert.equal(result.kind, expectation.kind);
      assert.equal(result.total, expectation.combinedTotal);
      assert.equal(result.totals.structure, expectation.structureTotal);
      assert.equal(result.totals.content, expectation.contentTotal);
      assert.equal(result.totals.combined, expectation.combinedTotal);
      for (const [axisName, axisScore] of Object.entries(expectation.structureAxes)) {
        assert.equal(
          result.axes.structure[axisName].score,
          axisScore,
          `${expectation.fixture}: structure axis ${axisName} expected ${axisScore}, got ${result.axes.structure[axisName].score}`,
        );
      }
      for (const [axisName, axisExpect] of Object.entries(expectation.contentAxes)) {
        const got = result.axes.content[axisName];
        if ("applicable" in axisExpect) {
          assert.equal(
            got.applicable,
            axisExpect.applicable,
            `${expectation.fixture}: content axis ${axisName} applicable expected ${axisExpect.applicable}, got ${got.applicable}`,
          );
        }
        if ("score" in axisExpect) {
          assert.equal(
            got.score,
            axisExpect.score,
            `${expectation.fixture}: content axis ${axisName} score expected ${axisExpect.score}, got ${got.score}`,
          );
        }
      }
    });
  }
});
