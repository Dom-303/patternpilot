import test from "node:test";
import assert from "node:assert/strict";
import { selectPolicyHandoffCandidates, renderPolicyHandoffSummary } from "../lib/policy-handoff.mjs";

test("selectPolicyHandoffCandidates prefers newly visible trial rows by default", () => {
  const selection = selectPolicyHandoffCandidates({
    trialRows: [
      {
        repoRef: "alpha/repo",
        repoUrl: "https://github.com/alpha/repo",
        visibilityChange: "newly_visible"
      },
      {
        repoRef: "beta/repo",
        repoUrl: "https://github.com/beta/repo",
        visibilityChange: "unchanged"
      }
    ]
  });

  assert.equal(selection.scope, "newly_visible");
  assert.deepEqual(selection.repoRefs, ["alpha/repo"]);
  assert.deepEqual(selection.urls, ["https://github.com/alpha/repo"]);
});

test("selectPolicyHandoffCandidates can use replay visible candidates", () => {
  const selection = selectPolicyHandoffCandidates({
    scope: "replay_visible",
    replayManifest: {
      candidates: [
        {
          repo: {
            fullName: "alpha/repo",
            normalizedRepoUrl: "https://github.com/alpha/repo"
          }
        },
        {
          repo: {
            fullName: "beta/repo",
            normalizedRepoUrl: "https://github.com/beta/repo"
          }
        }
      ]
    }
  });

  assert.equal(selection.count, 2);
  assert.deepEqual(selection.repoRefs, ["alpha/repo", "beta/repo"]);
});

test("renderPolicyHandoffSummary shows selected repos and on-demand linkage", () => {
  const markdown = renderPolicyHandoffSummary({
    projectKey: "eventbear-worker",
    handoffId: "handoff-1",
    generatedAt: "2026-04-14T21:30:00.000Z",
    cycleId: "cycle-1",
    workbenchId: "wb-1",
    scope: "newly_visible",
    selection: {
      count: 1,
      selected: [
        {
          repoRef: "alpha/repo",
          url: "https://github.com/alpha/repo",
          reason: "newly_visible"
        }
      ],
      recommendations: ["Use the focused handoff."]
    },
    onDemandResult: {
      runId: "on-demand-1",
      effectiveUrls: ["https://github.com/alpha/repo"],
      reviewRun: {
        review: {
          items: [{ repoRef: "alpha/repo" }],
          topItems: [{ repoRef: "alpha/repo" }]
        }
      },
      promoteRun: {
        items: []
      }
    }
  });

  assert.match(markdown, /selected_repos: 1/);
  assert.match(markdown, /on_demand_run: on-demand-1/);
  assert.match(markdown, /alpha\/repo :: newly_visible/);
});
