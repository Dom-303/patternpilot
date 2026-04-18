import test from "node:test";
import assert from "node:assert/strict";
import { buildPolicyControlReview, renderPolicyControlSummary } from "../lib/policy/policy-control.mjs";

test("buildPolicyControlReview prioritizes chain refresh when newer upstream artifacts outpace downstream state", () => {
  const review = buildPolicyControlReview({
    projectKey: "sample-project",
    cycle: {
      stageKey: "cycle",
      artifactId: "cycle-2",
      generatedAt: "2026-04-17T19:45:00.000Z",
      relativeDir: "projects/sample-project/calibration/cycles/cycle-2",
      manifest: {
        cycleId: "cycle-2",
        generatedAt: "2026-04-17T19:45:00.000Z",
        workbenchId: "wb-2",
        review: { rowsWithVerdict: 1, recommendations: [] },
        trial: { newlyVisibleCount: 2, decisionStatus: "apply_ready", recommendations: [] },
        applyResult: { changed: true },
        replay: { visibleCount: 2 }
      }
    },
    handoff: {
      stageKey: "handoff",
      artifactId: "handoff-1",
      generatedAt: "2026-04-17T19:40:00.000Z",
      relativeDir: "projects/sample-project/calibration/handoffs/handoff-1",
      manifest: {
        handoffId: "handoff-1",
        generatedAt: "2026-04-17T19:40:00.000Z",
        cycleId: "cycle-1",
        selection: { count: 1, selected: [{ repoRef: "alpha/repo" }] },
        onDemandResult: { runId: "od-1", reviewItems: 1 }
      }
    }
  });

  assert.equal(review.overallStatus, "chain_refresh_recommended");
  assert.match(review.topBlocker, /Latest handoff still points to cycle cycle-1/i);
  assert.equal(
    review.nextCommand,
    "npm run patternpilot -- policy-handoff --project sample-project --cycle-dir projects/sample-project/calibration/cycles/cycle-2"
  );
});

test("buildPolicyControlReview follows the most recent downstream apply step when the chain is healthy", () => {
  const review = buildPolicyControlReview({
    projectKey: "sample-project",
    cycle: {
      stageKey: "cycle",
      artifactId: "cycle-1",
      generatedAt: "2026-04-17T19:00:00.000Z",
      relativeDir: "projects/sample-project/calibration/cycles/cycle-1",
      manifest: {
        cycleId: "cycle-1",
        generatedAt: "2026-04-17T19:00:00.000Z",
        workbenchId: "wb-1",
        review: { rowsWithVerdict: 1, recommendations: [] },
        trial: { newlyVisibleCount: 2, decisionStatus: "apply_ready", recommendations: [] },
        applyResult: { changed: true },
        replay: { visibleCount: 2 }
      }
    },
    handoff: {
      stageKey: "handoff",
      artifactId: "handoff-1",
      generatedAt: "2026-04-17T19:10:00.000Z",
      relativeDir: "projects/sample-project/calibration/handoffs/handoff-1",
      manifest: {
        handoffId: "handoff-1",
        generatedAt: "2026-04-17T19:10:00.000Z",
        cycleId: "cycle-1",
        selection: { count: 1, selected: [{ repoRef: "alpha/repo" }] },
        onDemandResult: { runId: "od-1", reviewItems: 1 }
      }
    },
    curation: {
      stageKey: "curation",
      artifactId: "curation-1",
      generatedAt: "2026-04-17T19:20:00.000Z",
      relativeDir: "projects/sample-project/calibration/curation/curation-1",
      manifest: {
        curationId: "curation-1",
        generatedAt: "2026-04-17T19:20:00.000Z",
        handoffId: "handoff-1",
        curation: {
          curatedCount: 1,
          curatedCandidates: [
            { repoRef: "alpha/repo", reviewDisposition: "observe_only" }
          ]
        }
      }
    },
    applyReview: {
      stageKey: "apply_review",
      artifactId: "review-1",
      generatedAt: "2026-04-17T19:25:00.000Z",
      relativeDir: "projects/sample-project/calibration/apply-review/review-1",
      manifest: {
        reviewId: "review-1",
        generatedAt: "2026-04-17T19:25:00.000Z",
        curationId: "curation-1",
        review: {
          candidateCount: 1,
          rows: [{ repoRef: "alpha/repo", reviewDisposition: "observe_only" }]
        }
      }
    },
    apply: {
      stageKey: "apply",
      artifactId: "apply-1",
      generatedAt: "2026-04-17T19:30:00.000Z",
      relativeDir: "projects/sample-project/calibration/apply/apply-1",
      manifest: {
        applyId: "apply-1",
        generatedAt: "2026-04-17T19:30:00.000Z",
        reviewId: "review-1",
        selectedCandidates: [{ repoRef: "alpha/repo", reviewDisposition: "observe_only" }],
        promotionRun: {
          runId: "promote-1",
          items: [{ repoRef: "alpha/repo" }]
        }
      }
    }
  });

  assert.equal(review.overallStatus, "followup_with_care");
  assert.equal(review.currentStageKey, "apply");
  assert.match(review.topBlocker, /observe_only path/i);
  assert.equal(
    review.nextCommand,
    "npm run patternpilot -- re-evaluate --project sample-project --stale-only"
  );
});

test("renderPolicyControlSummary renders the compact operator view", () => {
  const markdown = renderPolicyControlSummary({
    projectKey: "sample-project",
    controlId: "control-1",
    generatedAt: "2026-04-17T20:00:00.000Z",
    dryRun: true,
    review: {
      overallStatus: "followup_ready",
      currentStageKey: "apply",
      currentDecisionStatus: "applied",
      stageCount: 2,
      topBlocker: "No blocking issue detected in the latest apply step.",
      nextCommand: "npm run patternpilot -- re-evaluate --project sample-project --stale-only",
      chainWarnings: [],
      recommendations: ["Latest applied candidate: alpha/repo."],
      stages: [
        {
          stageKey: "cycle",
          decisionStatus: "handoff_ready",
          summaryLine: "cycle=cycle-1 :: verdicts=1 :: newly_visible=2 :: replay_visible=2",
          relativeDir: "projects/sample-project/calibration/cycles/cycle-1"
        },
        {
          stageKey: "apply",
          decisionStatus: "applied",
          summaryLine: "apply=apply-1 :: selected=1 :: applied_items=1 :: promotion_run=promote-1",
          relativeDir: "projects/sample-project/calibration/apply/apply-1"
        }
      ]
    }
  });

  assert.match(markdown, /overall_status: followup_ready/);
  assert.match(markdown, /current_stage: apply/);
  assert.match(markdown, /cycle :: handoff_ready/);
  assert.match(markdown, /apply :: applied/);
  assert.match(markdown, /next_command: npm run patternpilot -- re-evaluate --project sample-project --stale-only/);
});
