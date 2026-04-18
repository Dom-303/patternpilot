import test from "node:test";
import assert from "node:assert/strict";
import { buildPolicyWorkbenchReview, renderPolicyWorkbenchReviewSummary } from "../lib/policy/policy-workbench-review.mjs";

test("buildPolicyWorkbenchReview summarizes verdicts and recommendations", () => {
  const review = buildPolicyWorkbenchReview({
    rows: [
      { repoRef: "alpha/repo", manualVerdict: "false_block" },
      { repoRef: "beta/repo", manualVerdict: "confirm_block" },
      { repoRef: "gamma/repo", manualVerdict: "good_prefer" }
    ]
  });

  assert.equal(review.rowCount, 3);
  assert.equal(review.rowsWithVerdict, 3);
  assert.equal(review.verdictCounts.find((item) => item.verdict === "false_block")?.count, 1);
  assert.equal(review.decisionStatus, "needs_policy_adjustment");
  assert.match(review.recommendations.join("\n"), /false_block/i);
});

test("renderPolicyWorkbenchReviewSummary renders comparison and verdict counts", () => {
  const markdown = renderPolicyWorkbenchReviewSummary({
    projectKey: "eventbear-worker",
    workbenchId: "wb-1",
    sourceRunId: "run-1",
    review: {
      rowCount: 2,
      rowsWithVerdict: 2,
      decisionStatus: "ready_for_suggestion",
      verdictCounts: [{ verdict: "false_block", count: 1 }],
      recommendations: ["There are 1 rows marked false_block."],
      comparison: {
        delta: {
          auditFlagged: -1,
          enforceHidden: -1,
          auditPreferred: 0
        }
      }
    }
  });

  assert.match(markdown, /false_block: 1/);
  assert.match(markdown, /delta_enforce_hidden: -1/);
  assert.match(markdown, /rows_with_verdict: 2/);
  assert.match(markdown, /decision_status: ready_for_suggestion/);
  assert.match(markdown, /next_command: npm run patternpilot -- policy-suggest --project eventbear-worker --workbench-dir/);
});
