import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import {
  makeFakeRepo,
  makeFakeGuess,
  makeFakeEnrichment,
  makeFakeProjectAlignment
} from "./helpers/fixtures.mjs";
import { renderIntakeDoc } from "../lib/intake.mjs";

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
