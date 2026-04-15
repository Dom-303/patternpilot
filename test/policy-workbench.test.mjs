import test from "node:test";
import assert from "node:assert/strict";
import { buildPolicyWorkbench, renderPolicyWorkbenchSummary } from "../lib/policy/policy-workbench.mjs";
import { defaultDiscoveryPolicy } from "../lib/policy/discovery-policy.mjs";

test("buildPolicyWorkbench creates candidate rows with focus hints", () => {
  const discovery = {
    evaluatedCandidates: [
      {
        full_name: "alpha/high-fit",
        repo: { owner: "alpha", name: "high-fit", normalizedRepoUrl: "https://github.com/alpha/high-fit" },
        guess: { mainLayer: "source_intake", patternFamily: "place_data_infrastructure", gapArea: "source_systems_and_families" },
        gapAreaCanonical: "source_systems_and_families",
        enrichment: { repo: { topics: ["events"], license: "MIT" } },
        projectAlignment: { fitBand: "high", fitScore: 82 },
        discoveryDisposition: "intake_now"
      },
      {
        full_name: "beta/blocked",
        repo: { owner: "beta", name: "blocked", normalizedRepoUrl: "https://github.com/beta/blocked" },
        guess: { mainLayer: "ui_discovery_surface", patternFamily: "event_discovery_frontend", gapArea: "frontend_and_surface_design" },
        gapAreaCanonical: "frontend_and_surface_design",
        enrichment: { repo: { topics: ["events"], license: "MIT" }, readme: { excerpt: "starter template" } },
        projectAlignment: { fitBand: "high", fitScore: 76 },
        discoveryDisposition: "review_queue"
      }
    ]
  };
  const policy = {
    ...defaultDiscoveryPolicy("eventbear-worker"),
    blockedSignalPatterns: ["starter template"]
  };

  const workbench = buildPolicyWorkbench(discovery, policy);

  assert.equal(workbench.sourceCandidateCount, 2);
  assert.equal(workbench.blockedCount, 1);
  assert.equal(workbench.rows[1].policyAllowed, false);
  assert.equal(workbench.rows[1].focus, "check_false_block");
});

test("renderPolicyWorkbenchSummary renders manual workflow guidance", () => {
  const markdown = renderPolicyWorkbenchSummary({
    projectKey: "eventbear-worker",
    sourceRunId: "run-1",
    sourceManifestPath: "runs/eventbear-worker/run-1/manifest.json",
    workbench: {
      sourceCandidateCount: 1,
      blockedCount: 0,
      preferredCount: 1,
      rows: [
        {
          repoRef: "alpha/high-fit",
          fitBand: "high",
          fitScore: 82,
          disposition: "intake_now",
          policyAllowed: true,
          focus: "confirm_prefer",
          blockers: [],
          preferenceHits: ["preferred_pattern_family:place_data_infrastructure"]
        }
      ]
    }
  });

  assert.match(markdown, /Patternpilot Policy Workbench/);
  assert.match(markdown, /edit `proposed-policy\.json`/);
  assert.match(markdown, /alpha\/high-fit :: fit=high\/82 :: disposition=intake_now/);
});
