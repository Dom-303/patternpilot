import test from "node:test";
import assert from "node:assert/strict";
import { buildReplayImportPayloadFromDiscovery, renderPolicyCycleSummary } from "../lib/policy/policy-cycle.mjs";

test("buildReplayImportPayloadFromDiscovery uses evaluated candidates", () => {
  const payload = buildReplayImportPayloadFromDiscovery({
    evaluatedCandidates: [
      { full_name: "alpha/repo" },
      { full_name: "beta/repo" }
    ]
  }, "replay-case");

  assert.equal(payload.label, "replay-case");
  assert.equal(payload.candidates.length, 2);
  assert.equal(payload.candidates[0].full_name, "alpha/repo");
});

test("renderPolicyCycleSummary renders the end-to-end cycle state", () => {
  const markdown = renderPolicyCycleSummary({
    projectKey: "sample-project",
    cycleId: "cycle-1",
    generatedAt: "2026-04-14T21:00:00.000Z",
    workbenchId: "wb-1",
    sourceRunId: "run-1",
    review: { rowsWithVerdict: 1, recommendations: ["Review says false_block exists."] },
    suggestion: { changed: true, recommendations: ["Suggestion reveals 2 candidates."] },
    trial: { newlyVisibleCount: 2, newlyHiddenCount: 0, recommendations: ["Trial reveals 2 candidates."] },
    applyResult: { changed: true },
    replay: { candidateCount: 2, visibleCount: 2 }
  });

  assert.match(markdown, /policy_applied: yes/);
  assert.match(markdown, /trial_newly_visible: 2/);
  assert.match(markdown, /replay_visible: 2/);
  assert.match(markdown, /trial_decision_status: -/);
});

test("renderPolicyCycleSummary suggests handoff after successful apply-ready trial", () => {
  const markdown = renderPolicyCycleSummary({
    projectKey: "sample-project",
    cycleId: "cycle-1",
    generatedAt: "2026-04-14T21:00:00.000Z",
    workbenchId: "wb-1",
    sourceRunId: "run-1",
    review: { rowsWithVerdict: 1, recommendations: [] },
    suggestion: { changed: true, recommendations: [] },
    trial: { newlyVisibleCount: 2, newlyHiddenCount: 0, decisionStatus: "apply_ready", recommendations: [] },
    applyResult: { changed: true },
    replay: { candidateCount: 2, visibleCount: 2 }
  });

  assert.match(markdown, /trial_decision_status: apply_ready/);
  assert.match(markdown, /next_command: npm run patternpilot -- policy-handoff --project sample-project --cycle-dir projects\/sample-project\/calibration\/cycles\/cycle-1/);
});
