import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import {
  makeFakeRepo,
  makeFakeGuess,
  makeFakeEnrichment,
  makeFakeAlignmentRules,
  makeFakeProjectAlignment
} from "./helpers/fixtures.mjs";
import {
  decorateDiscoveryCandidate,
  buildDiscoveryRunFields,
  applyDiscoveryPolicyToCandidates
} from "../lib/discovery.mjs";
import { defaultDiscoveryPolicy } from "../lib/discovery-policy.mjs";

describe("discovery run-level engine fields", () => {
  test("decorateDiscoveryCandidate attaches effort/value bands and disposition", () => {
    const candidate = {
      repo: makeFakeRepo(),
      guess: makeFakeGuess({ mainLayer: "source_intake", gapArea: "source_systems_and_families" }),
      enrichment: makeFakeEnrichment(),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "high",
        matchedCapabilities: ["source_first", "candidate_first"]
      }),
      risks: [],
      discoveryScore: 60,
      reasoning: ["seed match"]
    };

    const decorated = decorateDiscoveryCandidate(candidate, makeFakeAlignmentRules());

    assert.ok(["low", "medium", "high"].includes(decorated.effortBand));
    assert.ok(["low", "medium", "high"].includes(decorated.valueBand));
    assert.ok(["intake_now", "review_queue", "observe_only", "skip"].includes(decorated.discoveryDisposition));
    assert.equal(decorated.decisionDataState, "complete");
    assert.equal(typeof decorated.dispositionReason, "string");
    assert.equal(decorated.gapAreaCanonical, "source_systems_and_families");
  });

  test("buildDiscoveryRunFields adds schema version 2, itemsDataStateSummary, and weighted gap signals", () => {
    const candidates = [
      {
        gapAreaCanonical: "source_systems_and_families",
        projectAlignment: { fitBand: "high", matchedCapabilities: ["source_first"] },
        projectFitScore: 86,
        valueScore: 78,
        risks: [],
        decisionDataState: "complete"
      },
      {
        gapAreaCanonical: "source_systems_and_families",
        projectAlignment: { fitBand: "high", matchedCapabilities: ["candidate_first"] },
        projectFitScore: 74,
        valueScore: 70,
        risks: [],
        decisionDataState: "complete"
      },
      {
        gapAreaCanonical: "risk_and_dependency_awareness",
        projectAlignment: { fitBand: "high", matchedCapabilities: ["evidence_acquisition"] },
        projectFitScore: 52,
        valueScore: 40,
        risks: [],
        decisionDataState: "complete"
      }
    ];

    const run = buildDiscoveryRunFields(candidates, makeFakeAlignmentRules());
    assert.equal(run.reportSchemaVersion, 2);
    assert.equal(typeof run.runConfidence, "string");
    assert.equal(typeof run.runConfidenceReason, "string");
    assert.ok(run.confidenceFactors);
    assert.deepEqual(run.itemsDataStateSummary, { complete: 3, fallback: 0, stale: 0 });
    assert.deepEqual(run.runGapSignals[0], {
      gap: "source_systems_and_families",
      count: 2,
      strength: run.runGapSignals[0].strength
    });
    assert.ok(run.runGapSignals[0].strength >= run.runGapSignals[1].strength);
  });
});

describe("applyDiscoveryPolicyToCandidates", () => {
  test("enforce mode hides blocked candidates", () => {
    const candidates = [
      {
        full_name: "keep/strong",
        repo: { owner: "keep", name: "strong" },
        guess: { patternFamily: "local_source_infra_framework", mainLayer: "source_intake", gapArea: "source_systems_and_families" },
        enrichment: { repo: { topics: ["events"], license: "MIT", homepage: "" }, readme: { excerpt: "" } },
        projectAlignment: { fitScore: 80, matchedCapabilities: ["source_first"] },
        discoveryDisposition: "review_queue",
        risks: []
      },
      {
        full_name: "drop/template",
        repo: { owner: "drop", name: "template" },
        guess: { patternFamily: "event_discovery_frontend", mainLayer: "ui_discovery_surface", gapArea: "frontend_and_surface_design" },
        enrichment: { repo: { topics: ["events"], license: "MIT", homepage: "" }, readme: { excerpt: "starter template" } },
        projectAlignment: { fitScore: 75, matchedCapabilities: ["distribution_surfaces"] },
        discoveryDisposition: "review_queue",
        risks: []
      }
    ];
    const policy = {
      ...defaultDiscoveryPolicy("eventbear-worker"),
      blockedSignalPatterns: ["starter template"]
    };

    const out = applyDiscoveryPolicyToCandidates(candidates, policy, "enforce");
    assert.equal(out.visibleCandidates.length, 1);
    assert.equal(out.blockedCandidates.length, 1);
    assert.equal(out.policySummary.mode, "enforce");
    assert.equal(out.policySummary.enforcedBlocked, 1);
  });

  test("audit mode keeps blocked candidates visible for calibration", () => {
    const candidates = [
      {
        full_name: "drop/template",
        repo: { owner: "drop", name: "template" },
        guess: { patternFamily: "event_discovery_frontend", mainLayer: "ui_discovery_surface", gapArea: "frontend_and_surface_design" },
        enrichment: { repo: { topics: ["events"], license: "GPL-3.0", homepage: "" }, readme: { excerpt: "starter template" } },
        projectAlignment: { fitScore: 75, matchedCapabilities: ["distribution_surfaces"] },
        discoveryDisposition: "review_queue",
        risks: []
      }
    ];
    const policy = {
      ...defaultDiscoveryPolicy("eventbear-worker"),
      blockedSignalPatterns: ["starter template"],
      blockedLicenseCategories: ["copyleft"]
    };

    const out = applyDiscoveryPolicyToCandidates(candidates, policy, "audit");
    assert.equal(out.visibleCandidates.length, 1);
    assert.equal(out.blockedCandidates.length, 1);
    assert.equal(out.policySummary.mode, "audit");
    assert.equal(out.policySummary.blocked, 1);
    assert.equal(out.policySummary.enforcedBlocked, 0);
    assert.equal(out.visibleCandidates[0].discoveryPolicyGate.allowed, false);
  });
});
