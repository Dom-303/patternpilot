import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import {
  makeFakeRepo,
  makeFakeGuess,
  makeFakeEnrichment,
  makeFakeProjectAlignment
} from "./helpers/fixtures.mjs";
import {
  renderIntakeDoc,
  replaceDecisionSignalsBlock
} from "../lib/intake.mjs";

function makeBinding() {
  return {
    projectKey: "eventbear-worker",
    readBeforeAnalysis: [],
    referenceDirectories: [],
    analysisQuestions: [],
    targetCapabilities: []
  };
}

describe("renderIntakeDoc decision signals block", () => {
  test("includes ## Decision Signals block with bands and fingerprint", () => {
    const repo = { ...makeFakeRepo(), host: "github.com" };
    const doc = renderIntakeDoc({
      repo,
      guess: makeFakeGuess(),
      enrichment: makeFakeEnrichment(),
      landkarteCandidate: {
        repo_url: repo.normalizedRepoUrl
      },
      projectAlignment: makeFakeProjectAlignment(),
      projectProfile: { referenceFiles: [] },
      binding: makeBinding(),
      projectLabel: "eventbear-worker",
      repoRoot: "../eventbear-worker",
      createdAt: "2026-04-13T00:00:00.000Z",
      notes: [],
      candidate: {
        effortBand: "low",
        effortScore: 25,
        valueBand: "high",
        valueScore: 80,
        reviewDisposition: "intake_now",
        rulesFingerprint: "a3f9c1b2d4e5",
        decisionSummary: "High value, low effort, candidate for direct intake",
        effortReasons: ["layer_bias:-5", "language_match:-8"],
        valueReasons: ["gap_bias:+22", "matched_capabilities:+16"],
        dispositionReason: "matrix:effort_low_value_high"
      }
    });

    assert.ok(doc.includes("## Decision Signals"));
    assert.ok(doc.includes("- effort: low"));
    assert.ok(doc.includes("- value: high"));
    assert.ok(doc.includes("- review_disposition: intake_now"));
    assert.ok(doc.includes("- rules_fingerprint: a3f9c1b2d4e5"));
    assert.ok(doc.includes("### Reasons"));
    assert.ok(doc.includes("layer_bias:-5"));
    assert.ok(doc.includes("matrix:effort_low_value_high"));
  });
});

describe("replaceDecisionSignalsBlock", () => {
  test("replaces an existing decision signals section in-place", () => {
    const content = `# Intake Dossier

## Decision Signals

- effort: unknown
- value: unknown

## Alignment Rationale

- placeholder`;

    const updated = replaceDecisionSignalsBlock(content, {
      effortBand: "low",
      valueBand: "high",
      reviewDisposition: "intake_now",
      rulesFingerprint: "abc123",
      decisionSummary: "strong signal",
      effortReasons: ["small"],
      valueReasons: ["high_fit"],
      dispositionReason: "matrix:effort_low_value_high"
    });

    assert.equal((updated.match(/## Decision Signals/g) ?? []).length, 1);
    assert.ok(updated.includes("- effort: low"));
    assert.ok(updated.includes("- rules_fingerprint: abc123"));
    assert.ok(!updated.includes("- effort: unknown"));
  });

  test("inserts decision signals before alignment rationale when missing", () => {
    const content = `# Intake Dossier

## Project Alignment

- alignment_status: ready

## Alignment Rationale

- rationale`;

    const updated = replaceDecisionSignalsBlock(content, {
      effortBand: "medium",
      valueBand: "medium",
      reviewDisposition: "review_queue",
      rulesFingerprint: "def456",
      decisionSummary: "review first",
      effortReasons: [],
      valueReasons: [],
      dispositionReason: "matrix:balanced"
    });

    assert.ok(updated.includes("## Decision Signals"));
    assert.ok(updated.indexOf("## Decision Signals") < updated.indexOf("## Alignment Rationale"));
    assert.ok(updated.includes("- review_disposition: review_queue"));
  });
});
