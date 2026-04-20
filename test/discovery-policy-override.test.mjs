import test from "node:test";
import assert from "node:assert/strict";

import { evaluateDiscoveryCandidatePolicy, defaultDiscoveryPolicy } from "../lib/policy/discovery-policy.mjs";

test("high-fit preferred discovery candidates can stay visible despite skip disposition", () => {
  const policy = {
    ...defaultDiscoveryPolicy("sample-project"),
    minProjectFitScore: 35,
    preferredMainLayers: ["source_intake"],
    preferredGapAreas: ["source_systems_and_families"],
    preferredCapabilities: ["source_first"]
  };
  const candidate = {
    repo: { owner: "example", name: "repo" },
    guess: {
      mainLayer: "source_intake",
      gapArea: "source_systems_and_families"
    },
    discoveryDisposition: "skip",
    projectAlignment: {
      fitScore: 72,
      matchedCapabilities: ["source_first"]
    },
    projectBindingScore: 48,
    enrichment: {
      repo: {
        topics: ["calendar", "scraper"]
      },
      readme: {
        excerpt: "Calendar scraper pipeline"
      }
    },
    risks: []
  };

  const result = evaluateDiscoveryCandidatePolicy(candidate, policy);

  assert.equal(result.allowed, true);
  assert.ok(result.preferenceHits.includes("preferred_main_layer:source_intake"));
  assert.ok(result.preferenceHits.includes("preferred_gap_area:source_systems_and_families"));
  assert.ok(result.preferenceHits.includes("preferred_capability"));
  assert.ok(result.preferenceHits.includes("preferred_disposition_override:skip"));
});

test("observe-only candidates without strong cohort grounding stay blocked", () => {
  const policy = {
    ...defaultDiscoveryPolicy("sample-project"),
    minProjectFitScore: 35,
    preferredMainLayers: ["source_intake"],
    preferredGapAreas: ["source_systems_and_families"],
    preferredCapabilities: ["source_first"]
  };
  const candidate = {
    repo: { owner: "example", name: "generic-ui" },
    guess: {
      mainLayer: "source_intake",
      gapArea: "source_systems_and_families"
    },
    discoveryDisposition: "observe_only",
    projectAlignment: {
      fitScore: 71,
      matchedCapabilities: ["source_first"]
    },
    projectBindingScore: 18,
    enrichment: {
      repo: {
        topics: ["dashboard", "react"]
      },
      readme: {
        excerpt: "Dashboard framework for generic web projects"
      }
    },
    risks: []
  };

  const result = evaluateDiscoveryCandidatePolicy(candidate, policy);

  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes("disposition_not_allowed:observe_only"));
});

test("review candidates from public-event lane are blocked when promised lane evidence is missing", () => {
  const policy = {
    ...defaultDiscoveryPolicy("sample-project"),
    minProjectFitScore: 35,
    allowDispositions: ["intake_now", "review_queue"]
  };
  const candidate = {
    repo: { owner: "example", name: "generic-crawler" },
    queryIds: ["signal-lane-public_event_intake"],
    guess: {
      mainLayer: "source_intake",
      gapArea: "source_systems_and_families"
    },
    discoveryDisposition: "review_queue",
    projectAlignment: {
      fitScore: 74,
      matchedCapabilities: ["source_first"]
    },
    enrichment: {
      repo: {
        topics: ["crawler", "feed"],
        description: "Generic crawler feed pipeline"
      },
      readme: {
        excerpt: "Generic crawler feed pipeline"
      }
    },
    discoveryEvidence: {
      sourceFamilyHits: 0,
      publicEventIntakeHits: 0,
      governanceHits: 0,
      normalizationHits: 0
    },
    risks: []
  };

  const result = evaluateDiscoveryCandidatePolicy(candidate, policy);

  assert.equal(result.allowed, false);
  assert.ok(result.blockers.includes("lane_evidence_not_matched:public_event_intake"));
  assert.ok(result.blockers.includes("ungrounded_ingestion_candidate"));
});
