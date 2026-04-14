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
  buildDiscoveryRunFields
} from "../lib/discovery.mjs";

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
  });

  test("buildDiscoveryRunFields adds schema version 2 and itemsDataStateSummary", () => {
    const candidates = [
      {
        projectAlignment: { fitBand: "high", matchedCapabilities: ["source_first"] },
        risks: [],
        decisionDataState: "complete"
      },
      {
        projectAlignment: { fitBand: "high", matchedCapabilities: ["candidate_first"] },
        risks: [],
        decisionDataState: "complete"
      },
      {
        projectAlignment: { fitBand: "high", matchedCapabilities: ["evidence_acquisition"] },
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
  });
});
