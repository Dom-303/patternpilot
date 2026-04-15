import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { classifyReviewItemState, buildReviewRunFields, buildWatchlistReview } from "../lib/review.mjs";
import { computeRulesFingerprint } from "../lib/classification/evaluation.mjs";
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
  test("mixed run aggregates itemsDataStateSummary and weighted gap signals", () => {
    const items = [
      {
        decisionDataState: "complete",
        projectFitBand: "high",
        projectFitScore: 84,
        matchedCapabilities: ["source_first"],
        gapAreaCanonical: "source_systems_and_families",
        valueScore: 80,
        risks: []
      },
      {
        decisionDataState: "complete",
        projectFitBand: "high",
        projectFitScore: 74,
        matchedCapabilities: ["candidate_first"],
        gapAreaCanonical: "source_systems_and_families",
        valueScore: 72,
        risks: []
      },
      {
        decisionDataState: "fallback",
        projectFitBand: "medium",
        projectFitScore: 52,
        matchedCapabilities: [],
        gapAreaCanonical: "risk_and_dependency_awareness",
        valueScore: 30,
        risks: []
      },
      {
        decisionDataState: "stale",
        projectFitBand: "high",
        projectFitScore: 66,
        matchedCapabilities: ["evidence_acquisition"],
        gapAreaCanonical: "risk_and_dependency_awareness",
        valueScore: 50,
        risks: []
      }
    ];

    const out = buildReviewRunFields(items, makeFakeAlignmentRules());
    assert.equal(out.reportSchemaVersion, 2);
    assert.deepEqual(out.itemsDataStateSummary, { complete: 2, fallback: 1, stale: 1 });
    assert.equal(out.runGapSignals[0].gap, "source_systems_and_families");
    assert.equal(out.runGapSignals[0].count, 2);
  });
});

describe("buildWatchlistReview", () => {
  test("can focus review on explicitly selected urls", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-review-"));
    const config = {
      queueFile: "state/repo_intake_queue.csv"
    };
    const project = {
      watchlistFile: "projects/demo/WATCHLIST.txt"
    };
    const binding = {
      projectKey: "demo",
      projectLabel: "Demo",
      analysisQuestions: [],
      targetCapabilities: [],
      readBeforeAnalysis: [],
      referenceDirectories: []
    };
    const rules = makeFakeAlignmentRules({ projectKey: "demo" });
    const fingerprint = computeRulesFingerprint(rules);

    try {
      fs.mkdirSync(path.join(rootDir, "state"), { recursive: true });
      fs.mkdirSync(path.join(rootDir, "projects/demo"), { recursive: true });
      fs.writeFileSync(
        path.join(rootDir, "state/repo_intake_queue.csv"),
        [
          "project_key;repo_url;normalized_repo_url;owner;name;status;project_fit_band;project_fit_score;matched_capabilities;recommended_worker_areas;eventbaer_gap_area_guess;main_layer_guess;pattern_family_guess;build_vs_borrow_guess;priority_guess;activity_status;eventbaer_relevance_guess;strengths;weaknesses;risks;learning_for_eventbaer;possible_implication;suggested_next_step;stars;license;decision_summary;effort_band;effort_score;value_band;value_score;review_disposition;rules_fingerprint",
          `demo;https://github.com/acme/one;https://github.com/acme/one;acme;one;pending_review;high;82;source_first;lib/fetch.mjs;source_systems_and_families;source_intake;local_source_infra_framework;adapt_pattern;now;current;high;strong;;;learning;implication;next;42;MIT;strong fit;low;20;high;80;intake_now;${fingerprint}`
        ].join("\n"),
        "utf8"
      );
      fs.writeFileSync(
        path.join(rootDir, "projects/demo/WATCHLIST.txt"),
        "https://github.com/acme/one\nhttps://github.com/acme/two\n",
        "utf8"
      );

      const review = await buildWatchlistReview(
        rootDir,
        config,
        project,
        binding,
        rules,
        { capabilitiesPresent: [] },
        {
          reviewUrls: ["https://github.com/acme/one", "https://github.com/acme/missing"]
        }
      );

      assert.equal(review.reviewScope, "selected_urls");
      assert.equal(review.inputUrlCount, 2);
      assert.equal(review.watchlistCount, 2);
      assert.equal(review.items.length, 1);
      assert.deepEqual(review.missingUrls, ["https://github.com/acme/missing"]);
      assert.ok(review.nextSteps.some((step) => step.includes("missing selected repos")));
      assert.equal(review.items[0].gapAreaCanonical, "source_systems_and_families");
      assert.equal(review.runGapSignals[0].gap, "source_systems_and_families");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
