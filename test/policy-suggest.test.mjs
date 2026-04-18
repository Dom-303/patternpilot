import test from "node:test";
import assert from "node:assert/strict";
import { buildPolicySuggestion, renderPolicySuggestionSummary } from "../lib/policy/policy-suggest.mjs";

test("buildPolicySuggestion can heuristically unblock observe_only false blocks", () => {
  const currentPolicy = {
    allowDispositions: ["intake_now", "review_queue"],
    minProjectFitScore: 20
  };
  const suggestion = buildPolicySuggestion({
    rows: [
      {
        repoRef: "oc/openevents",
        policyAllowed: false,
        focus: "check_false_block",
        fitBand: "high",
        preferenceHits: ["preferred_pattern_family:place_data_infrastructure", "preferred_topic"],
        blockers: ["disposition_not_allowed:observe_only"],
        manualVerdict: ""
      },
      {
        repoRef: "citybureau/city-scrapers",
        policyAllowed: false,
        focus: "check_false_block",
        fitBand: "high",
        preferenceHits: ["preferred_pattern_family:local_source_infra_framework", "preferred_topic"],
        blockers: ["disposition_not_allowed:observe_only"],
        manualVerdict: ""
      }
    ],
    currentPolicy
  });

  assert.equal(suggestion.changed, true);
  assert.equal(suggestion.decisionStatus, "trial_ready");
  assert.ok(suggestion.nextPolicy.allowDispositions.includes("observe_only"));
  assert.equal(suggestion.heuristicFalseBlockCount, 2);
  assert.match(suggestion.recommendations.join("\n"), /allowing observe_only/i);
});

test("renderPolicySuggestionSummary renders suggestion details", () => {
  const markdown = renderPolicySuggestionSummary({
    projectKey: "eventbear-worker",
    workbenchId: "wb-1",
    sourceRunId: "run-1",
    suggestion: {
      rowCount: 2,
      manualVerdictCount: 0,
      heuristicFalseBlockCount: 2,
      changed: true,
      decisionStatus: "trial_ready",
      suggestions: [
        {
          type: "allow_disposition",
          value: "observe_only",
          changed: true,
          confidence: "medium",
          heuristicOnly: true,
          sources: ["oc/openevents", "citybureau/city-scrapers"]
        }
      ],
      comparison: {
        delta: {
          auditFlagged: -2,
          enforceHidden: -2,
          auditPreferred: 0
        }
      },
      recommendations: ["Test whether allowing observe_only reveals strong candidates without introducing too much noise."]
    }
  });

  assert.match(markdown, /allow_disposition :: value=observe_only/);
  assert.match(markdown, /delta_enforce_hidden: -2/);
  assert.match(markdown, /heuristic_false_blocks: 2/);
  assert.match(markdown, /decision_status: trial_ready/);
  assert.match(markdown, /next_command: npm run patternpilot -- policy-trial --project eventbear-worker --workbench-dir/);
});
