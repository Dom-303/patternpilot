import test from "node:test";
import assert from "node:assert/strict";
import { buildPolicyCuration, renderPolicyCurationSummary } from "../lib/policy/policy-curation.mjs";

test("buildPolicyCuration ranks selected queue rows by curation score", () => {
  const curation = buildPolicyCuration({
    projectKey: "sample-project",
    handoffManifest: {
      selection: {
        urls: [
          "https://github.com/alpha/repo",
          "https://github.com/beta/repo"
        ]
      }
    },
    queueRows: [
      {
        normalized_repo_url: "https://github.com/alpha/repo",
        repo_url: "https://github.com/alpha/repo",
        owner: "alpha",
        name: "repo",
        project_fit_score: "80",
        value_score: "60",
        effort_score: "40",
        project_relevance_guess: "high",
        decision_guess: "adapt",
        matched_capabilities: "source_first,distribution_surfaces",
        project_fit_band: "high",
        value_band: "medium",
        effort_band: "medium",
        review_disposition: "observe_only",
        suggested_next_step: "Inspect alpha"
      },
      {
        normalized_repo_url: "https://github.com/beta/repo",
        repo_url: "https://github.com/beta/repo",
        owner: "beta",
        name: "repo",
        project_fit_score: "50",
        value_score: "30",
        effort_score: "20",
        project_relevance_guess: "medium",
        decision_guess: "observe",
        matched_capabilities: "",
        project_fit_band: "medium",
        value_band: "low",
        effort_band: "low",
        review_disposition: "skip",
        suggested_next_step: "Inspect beta"
      }
    ]
  });

  assert.equal(curation.curatedCandidates.length, 2);
  assert.equal(curation.curatedCandidates[0].repoRef, "alpha/repo");
  assert.equal(curation.decisionStatus, "prepare_only");
  assert.match(curation.nextCommand, /policy-curation-batch-review --project sample-project/);
  assert.match(curation.recommendations[0], /Prepare promotion packets/);
});

test("renderPolicyCurationSummary includes promotion linkage", () => {
  const markdown = renderPolicyCurationSummary({
    projectKey: "sample-project",
    curationId: "cur-1",
    generatedAt: "2026-04-14T22:00:00.000Z",
    handoffId: "handoff-1",
    cycleId: "cycle-1",
    curation: {
      selectionCount: 2,
      candidateCount: 2,
      curatedCount: 1,
      decisionStatus: "prepare_only",
      nextCommand: "npm run patternpilot -- policy-curation-batch-review --project sample-project",
      curatedCandidates: [
        {
          repoRef: "alpha/repo",
          curationScore: 92,
          projectFitBand: "high",
          projectFitScore: 80,
          valueBand: "medium",
          valueScore: 60,
          reviewDisposition: "observe_only",
          suggestedNextStep: "Inspect alpha"
        }
      ],
      recommendations: ["Prepare alpha."]
    },
    promotionRun: {
      runId: "prom-1",
      items: [{}]
    }
  });

  assert.match(markdown, /promotion_run: prom-1/);
  assert.match(markdown, /decision_status: prepare_only/);
  assert.match(markdown, /alpha\/repo :: score=92/);
  assert.match(markdown, /next_command: npm run patternpilot -- policy-curation-batch-review --project sample-project/);
});
