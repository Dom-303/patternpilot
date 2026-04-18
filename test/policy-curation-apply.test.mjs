import test from "node:test";
import assert from "node:assert/strict";
import {
  selectPolicyCurationApplyCandidates,
  buildPolicyCurationApplyReview,
  renderPolicyCurationApplyReviewSummary
} from "../lib/policy/policy-curation-apply.mjs";

test("selectPolicyCurationApplyCandidates respects target and limit", () => {
  const curationManifest = {
    curation: {
      curatedCandidates: [
        { repoRef: "alpha/repo" },
        { repoRef: "beta/repo" }
      ]
    }
  };

  const selected = selectPolicyCurationApplyCandidates(curationManifest, {
    target: "beta/repo",
    limit: 1
  });

  assert.equal(selected.length, 1);
  assert.equal(selected[0].repoRef, "beta/repo");
});

test("buildPolicyCurationApplyReview reports existing canonical mentions", () => {
  const review = buildPolicyCurationApplyReview({
    candidates: [
      {
        repoRef: "alpha/repo",
        url: "https://github.com/alpha/repo",
        reviewDisposition: "observe_only",
        queueRow: {
          normalized_repo_url: "https://github.com/alpha/repo"
        }
      }
    ],
    landkarteText: "https://github.com/alpha/repo",
    learningsText: "alpha/repo",
    decisionsText: "alpha/repo"
  });

  assert.equal(review.candidateCount, 1);
  assert.equal(review.rows[0].landkarteAlreadyPresent, true);
  assert.equal(review.rows[0].learningMentions, 1);
  assert.equal(review.rows[0].decisionMentions, 1);
  assert.equal(review.decisionStatus, "apply_with_care");
  assert.equal(review.nextCommand, "policy-curation-apply");
});

test("renderPolicyCurationApplyReviewSummary renders selection and recommendations", () => {
  const markdown = renderPolicyCurationApplyReviewSummary({
    projectKey: "eventbear-worker",
    reviewId: "rev-1",
    generatedAt: "2026-04-14T22:10:00.000Z",
    curationId: "cur-1",
    review: {
      candidateCount: 1,
      decisionStatus: "apply_with_care",
      nextCommand: "policy-curation-apply",
      rows: [
        {
          repoRef: "alpha/repo",
          landkarteAlreadyPresent: false,
          learningMentions: 0,
          decisionMentions: 0,
          reviewDisposition: "observe_only"
        }
      ],
      recommendations: ["Review before apply."]
    }
  });

  assert.match(markdown, /selected_candidates: 1/);
  assert.match(markdown, /decision_status: apply_with_care/);
  assert.match(markdown, /alpha\/repo :: landkarte_present=no/);
  assert.match(markdown, /Review before apply/);
  assert.match(markdown, /next_command: npm run patternpilot -- policy-curation-apply --project eventbear-worker/);
});
