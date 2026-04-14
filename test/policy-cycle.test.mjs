import test from "node:test";
import assert from "node:assert/strict";
import { buildReplayImportPayloadFromDiscovery, renderPolicyCycleSummary } from "../lib/policy-cycle.mjs";

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
    projectKey: "eventbear-worker",
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
});
