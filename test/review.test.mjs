import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import { classifyReviewItemState, buildReviewRunFields } from "../lib/review.mjs";
import { computeRulesFingerprint } from "../lib/classification.mjs";
import { makeFakeAlignmentRules } from "./helpers/fixtures.mjs";

describe("classifyReviewItemState", () => {
  const rules = makeFakeAlignmentRules();
  const currentFingerprint = computeRulesFingerprint(rules);

  test("complete row with matching fingerprint -> complete", () => {
    const row = {
      effort_band: "low",
      effort_score: "25",
      value_band: "high",
      value_score: "80",
      review_disposition: "intake_now",
      rules_fingerprint: currentFingerprint,
      project_fit_band: "high"
    };

    const item = classifyReviewItemState(row, rules, currentFingerprint);
    assert.equal(item.decisionDataState, "complete");
    assert.equal(item.reviewDisposition, "intake_now");
  });

  test("row without review_disposition -> fallback (derives disposition)", () => {
    const row = {
      effort_band: "low",
      effort_score: "25",
      value_band: "high",
      value_score: "80",
      review_disposition: "",
      rules_fingerprint: currentFingerprint,
      project_fit_band: "high"
    };

    const item = classifyReviewItemState(row, rules, currentFingerprint);
    assert.equal(item.decisionDataState, "fallback");
    assert.equal(item.reviewDisposition, "intake_now");
  });

  test("row with empty effort/value bands -> fallback", () => {
    const row = {
      effort_band: "",
      effort_score: "",
      value_band: "",
      value_score: "",
      review_disposition: "review_queue",
      rules_fingerprint: currentFingerprint,
      project_fit_band: "high"
    };

    const item = classifyReviewItemState(row, rules, currentFingerprint);
    assert.equal(item.decisionDataState, "fallback");
  });

  test("row with mismatched fingerprint -> stale", () => {
    const row = {
      effort_band: "low",
      effort_score: "25",
      value_band: "high",
      value_score: "80",
      review_disposition: "intake_now",
      rules_fingerprint: "000000000000",
      project_fit_band: "high"
    };

    const item = classifyReviewItemState(row, rules, currentFingerprint);
    assert.equal(item.decisionDataState, "stale");
  });

  test("row with missing fingerprint -> stale", () => {
    const row = {
      effort_band: "low",
      effort_score: "25",
      value_band: "high",
      value_score: "80",
      review_disposition: "intake_now",
      rules_fingerprint: "",
      project_fit_band: "high"
    };

    const item = classifyReviewItemState(row, rules, currentFingerprint);
    assert.equal(item.decisionDataState, "stale");
  });
});

describe("buildReviewRunFields", () => {
  test("mixed run aggregates itemsDataStateSummary", () => {
    const items = [
      {
        decisionDataState: "complete",
        projectFitBand: "high",
        matchedCapabilities: ["source_first"],
        risks: []
      },
      {
        decisionDataState: "complete",
        projectFitBand: "high",
        matchedCapabilities: ["candidate_first"],
        risks: []
      },
      {
        decisionDataState: "fallback",
        projectFitBand: "medium",
        matchedCapabilities: [],
        risks: []
      },
      {
        decisionDataState: "stale",
        projectFitBand: "high",
        matchedCapabilities: ["evidence_acquisition"],
        risks: []
      }
    ];

    const out = buildReviewRunFields(items, makeFakeAlignmentRules());
    assert.equal(out.reportSchemaVersion, 2);
    assert.deepEqual(out.itemsDataStateSummary, { complete: 2, fallback: 1, stale: 1 });
  });
});
