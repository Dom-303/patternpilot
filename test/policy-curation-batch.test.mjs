import test from "node:test";
import assert from "node:assert/strict";
import {
  selectPolicyCurationBatchCandidates,
  buildPolicyCurationBatchReview,
  renderPolicyCurationBatchReviewSummary,
  renderPolicyCurationBatchPlanSummary
} from "../lib/policy-curation-batch.mjs";

test("selectPolicyCurationBatchCandidates filters by target refs", () => {
  const manifest = {
    curation: {
      curatedCandidates: [
        { repoRef: "alpha/repo" },
        { repoRef: "beta/repo" }
      ]
    }
  };
  const selected = selectPolicyCurationBatchCandidates(manifest, { target: "beta/repo" });
  assert.equal(selected.length, 1);
  assert.equal(selected[0].repoRef, "beta/repo");
});

test("buildPolicyCurationBatchReview reports overlap, risk, and governance plan", () => {
  const review = buildPolicyCurationBatchReview({
    candidates: [
      {
        repoRef: "alpha/repo",
        url: "https://github.com/alpha/repo",
        curationScore: 90,
        projectFitBand: "high",
        projectFitScore: 80,
        matchedCapabilities: ["source_first", "distribution_surfaces"],
        reviewDisposition: "observe_only",
        queueRow: {
          main_layer_guess: "source_intake",
          eventbaer_gap_area_guess: "connector_families",
          pattern_family_guess: "local_source_infra_framework",
          promotion_status: "prepared",
          status: "promotion_prepared"
        }
      },
      {
        repoRef: "beta/repo",
        url: "https://github.com/beta/repo",
        curationScore: 70,
        projectFitBand: "high",
        projectFitScore: 75,
        matchedCapabilities: ["source_first"],
        reviewDisposition: "observe_only",
        queueRow: {
          main_layer_guess: "source_intake",
          eventbaer_gap_area_guess: "connector_families",
          pattern_family_guess: "local_source_infra_framework",
          promotion_status: "prepared",
          status: "promotion_prepared"
        }
      }
    ]
  });

  assert.equal(review.candidateCount, 2);
  assert.equal(review.applyCandidateCount, 0);
  assert.equal(review.manualReviewCount, 2);
  assert.equal(review.overlap.patternFamilies[0].value, "local_source_infra_framework");
  assert.equal(review.governance.manualReviewCandidates.length, 2);
  assert.equal(review.governance.safeApplyCandidates.length, 0);
});

test("buildPolicyCurationBatchReview prefers live queue state over stale manifest rows", () => {
  const review = buildPolicyCurationBatchReview({
    candidates: [
      {
        repoRef: "alpha/repo",
        url: "https://github.com/alpha/repo",
        curationScore: 90,
        projectFitBand: "high",
        projectFitScore: 80,
        matchedCapabilities: ["source_first"],
        reviewDisposition: "observe_only",
        queueRow: {
          normalized_repo_url: "https://github.com/alpha/repo",
          promotion_status: "prepared",
          status: "promotion_prepared"
        }
      }
    ],
    queueRows: [
      {
        normalized_repo_url: "https://github.com/alpha/repo",
        promotion_status: "applied",
        status: "promoted"
      }
    ]
  });

  assert.equal(review.applyCandidateCount, 0);
  assert.equal(review.alreadyPromotedCount, 1);
  assert.equal(review.rows[0].alreadyPromoted, true);
});

test("buildPolicyCurationBatchReview creates safe apply batches for low-risk candidates", () => {
  const review = buildPolicyCurationBatchReview({
    candidates: [
      {
        repoRef: "alpha/repo",
        url: "https://github.com/alpha/repo",
        curationScore: 90,
        projectFitBand: "high",
        projectFitScore: 80,
        matchedCapabilities: ["source_first"],
        reviewDisposition: "observe_only",
        queueRow: {
          main_layer_guess: "source_intake",
          eventbaer_gap_area_guess: "connector_families",
          pattern_family_guess: "family_a",
          promotion_status: "prepared",
          status: "promotion_prepared"
        }
      },
      {
        repoRef: "beta/repo",
        url: "https://github.com/beta/repo",
        curationScore: 70,
        projectFitBand: "high",
        projectFitScore: 75,
        matchedCapabilities: ["location_intelligence"],
        reviewDisposition: "observe_only",
        queueRow: {
          main_layer_guess: "location_place_enrichment",
          eventbaer_gap_area_guess: "venue_intelligence",
          pattern_family_guess: "family_b",
          promotion_status: "prepared",
          status: "promotion_prepared"
        }
      }
    ]
  });

  assert.equal(review.applyCandidateCount, 2);
  assert.equal(review.manualReviewCount, 0);
  assert.equal(review.governance.recommendedBatches.length, 2);
});

test("renderPolicyCurationBatchReviewSummary renders governance sections", () => {
  const markdown = renderPolicyCurationBatchReviewSummary({
    projectKey: "eventbear-worker",
    reviewId: "batch-1",
    generatedAt: "2026-04-14T22:30:00.000Z",
    curationId: "cur-1",
    review: {
      candidateCount: 2,
      applyCandidateCount: 1,
      alreadyPromotedCount: 1,
      manualReviewCount: 0,
      rows: [
        {
          repoRef: "alpha/repo",
          curationScore: 90,
          projectFitBand: "high",
          projectFitScore: 80,
          queueStatus: "promotion_prepared",
          promotionStatus: "prepared",
          reviewDisposition: "observe_only",
          conflictRisk: "low",
          canonicalTouchCount: 0,
          alreadyPromoted: false,
          manualReviewRequired: false
        }
      ],
      overlap: {
        patternFamilies: [],
        gapAreas: [],
        mainLayers: [],
        capabilities: []
      },
      governance: {
        recommendedBatches: [
          {
            batchKey: "connector_families",
            risk: "low",
            candidateCount: 1,
            repoRefs: ["alpha/repo"],
            rationale: "grouped around connector_families"
          }
        ],
        manualReviewCandidates: [],
        safeApplyCandidates: [
          { repoRef: "alpha/repo", repoUrl: "https://github.com/alpha/repo" }
        ],
        recommendations: ["Safe to apply."]
      },
      recommendations: ["Batch apply can advance 1 candidate."]
    }
  });

  assert.match(markdown, /manual_review: 0/);
  assert.match(markdown, /Recommended Batches/);
  assert.match(markdown, /connector_families :: risk=low/);
});

test("renderPolicyCurationBatchPlanSummary renders safe and manual review candidates", () => {
  const markdown = renderPolicyCurationBatchPlanSummary({
    projectKey: "eventbear-worker",
    planId: "plan-1",
    generatedAt: "2026-04-14T22:40:00.000Z",
    curationId: "cur-1",
    review: {
      governance: {
        safeApplyCandidates: [
          { repoRef: "alpha/repo", repoUrl: "https://github.com/alpha/repo" }
        ],
        manualReviewCandidates: [
          { repoRef: "beta/repo", conflictRisk: "high", overlapReasons: ["gap_area:test"] }
        ],
        recommendedBatches: [
          { batchKey: "connector_families", risk: "low", candidateCount: 1, repoRefs: ["alpha/repo"] }
        ],
        recommendations: ["Safe to apply."]
      }
    }
  });

  assert.match(markdown, /safe_apply_candidates: 1/);
  assert.match(markdown, /manual_review_candidates: 1/);
  assert.match(markdown, /beta\/repo :: risk=high/);
});
