import { createHash } from "node:crypto";
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  EVALUATION_VERSION,
  bandFromScore,
  buildCandidateEvaluation,
  buildRunConfidence,
  classifyLicense,
  computeRulesFingerprint,
  deriveDisposition
} from "../lib/classification/evaluation.mjs";
import {
  makeFakeAlignmentRules,
  makeFakeEnrichment,
  makeFakeGuess,
  makeFakeProjectAlignment,
  makeFakeRepo
} from "./helpers/fixtures.mjs";

function canonicalStringify(value) {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalStringify(item)).join(",")}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalStringify(value[key])}`)
    .join(",")}}`;
}

function fingerprintWithVersion(rules, version) {
  const relevant = {
    capabilities: rules?.capabilities ?? [],
    layerMappings: rules?.layerMappings ?? {},
    gapMappings: rules?.gapMappings ?? {},
    patternTensions: rules?.patternTensions ?? {}
  };
  const payload = `${canonicalStringify(relevant)}::v${version}`;
  return createHash("sha1").update(payload).digest("hex").slice(0, 12);
}

function makeCandidates(specs) {
  return specs.map((spec, index) => ({
    repo: { owner: "acme", name: `candidate-${index}` },
    projectAlignment: {
      fitBand: spec.fit,
      matchedCapabilities: spec.caps ?? []
    },
    risks: spec.risks ?? []
  }));
}

describe("bandFromScore", () => {
  test("scores map to low, medium and high bands", () => {
    assert.equal(bandFromScore(0), "low");
    assert.equal(bandFromScore(35), "low");
    assert.equal(bandFromScore(36), "medium");
    assert.equal(bandFromScore(65), "medium");
    assert.equal(bandFromScore(66), "high");
    assert.equal(bandFromScore(100), "high");
  });
});

describe("classifyLicense", () => {
  test("recognizes permissive licenses", () => {
    for (const license of ["MIT", "Apache-2.0", "BSD-3-Clause", "ISC", "Unlicense"]) {
      assert.equal(classifyLicense(license), "permissive");
    }
  });

  test("recognizes copyleft licenses", () => {
    for (const license of ["GPL-3.0", "AGPL-3.0", "LGPL-2.1"]) {
      assert.equal(classifyLicense(license), "copyleft");
    }
  });

  test("returns unknown for empty or unsupported license strings", () => {
    for (const license of [null, undefined, "", "NOASSERTION", "Custom-License"]) {
      assert.equal(classifyLicense(license), "unknown");
    }
  });
});

describe("computeRulesFingerprint", () => {
  test("is deterministic and order-insensitive", () => {
    const rules = makeFakeAlignmentRules();
    const reordered = {
      patternTensions: rules.patternTensions,
      gapMappings: rules.gapMappings,
      capabilities: rules.capabilities,
      layerMappings: rules.layerMappings
    };

    assert.equal(computeRulesFingerprint(rules), computeRulesFingerprint(reordered));
  });

  test("changes when a layer bias changes", () => {
    const rules = makeFakeAlignmentRules();
    const mutated = makeFakeAlignmentRules({
      layerMappings: {
        ...rules.layerMappings,
        source_intake: {
          ...rules.layerMappings.source_intake,
          effort_bias: -4
        }
      }
    });

    assert.notEqual(computeRulesFingerprint(rules), computeRulesFingerprint(mutated));
  });

  test("is sensitive to EVALUATION_VERSION bumps", () => {
    const rules = makeFakeAlignmentRules();
    const real = computeRulesFingerprint(rules);
    const bumped = fingerprintWithVersion(rules, EVALUATION_VERSION + 1);
    assert.notEqual(real, bumped);
  });
});

describe("buildCandidateEvaluation", () => {
  test("returns unknown bands when no alignment rules are available", () => {
    const result = buildCandidateEvaluation(
      makeFakeRepo(),
      makeFakeGuess(),
      makeFakeEnrichment(),
      makeFakeProjectAlignment(),
      { layerMappings: {}, gapMappings: {}, capabilities: [] }
    );

    assert.equal(result.effortBand, "unknown");
    assert.equal(result.valueBand, "unknown");
    assert.equal(result.decisionSummary, "Insufficient signal for band decision");
  });

  test("source_intake plus source_systems_and_families yields low effort and high value", () => {
    const result = buildCandidateEvaluation(
      makeFakeRepo({ size: 500 }),
      makeFakeGuess({ mainLayer: "source_intake", gapArea: "source_systems_and_families" }),
      makeFakeEnrichment({
        repo: { size: 500, license: "MIT", primaryLanguage: "JavaScript", archived: false }
      }),
      makeFakeProjectAlignment({ matchedCapabilities: ["source_first", "candidate_first", "evidence_acquisition"] }),
      makeFakeAlignmentRules()
    );

    assert.equal(result.effortBand, "low");
    assert.equal(result.valueBand, "high");
  });

  test("archived repos score as more expensive and less valuable", () => {
    const archived = buildCandidateEvaluation(
      makeFakeRepo(),
      makeFakeGuess(),
      makeFakeEnrichment({ repo: { archived: true, pushedAt: "2020-01-01T00:00:00.000Z" } }),
      makeFakeProjectAlignment({ matchedCapabilities: ["source_first"] }),
      makeFakeAlignmentRules()
    );
    const fresh = buildCandidateEvaluation(
      makeFakeRepo(),
      makeFakeGuess(),
      makeFakeEnrichment(),
      makeFakeProjectAlignment({ matchedCapabilities: ["source_first"] }),
      makeFakeAlignmentRules()
    );

    assert.ok(archived.effortScore > fresh.effortScore);
    assert.ok(archived.valueScore < fresh.valueScore);
  });

  test("reasons include the active scoring tokens", () => {
    const result = buildCandidateEvaluation(
      makeFakeRepo({ size: 15000 }),
      makeFakeGuess({ mainLayer: "source_intake", gapArea: "source_systems_and_families" }),
      makeFakeEnrichment({
        repo: { size: 15000, license: "MIT", primaryLanguage: "JavaScript" }
      }),
      makeFakeProjectAlignment({ matchedCapabilities: ["source_first", "candidate_first"] }),
      makeFakeAlignmentRules()
    );

    assert.ok(result.effortReasons.some((token) => token.startsWith("layer_bias:")));
    assert.ok(result.effortReasons.some((token) => token.startsWith("size_penalty:+15")));
    assert.ok(result.effortReasons.some((token) => token.startsWith("language_match:-8")));
    assert.ok(result.effortReasons.some((token) => token.startsWith("license_adjustment:-3")));
    assert.ok(result.valueReasons.some((token) => token.startsWith("gap_bias:+22")));
    assert.ok(result.valueReasons.some((token) => token.startsWith("matched_capabilities:+16")));
    assert.ok(result.valueReasons.some((token) => token.startsWith("build_vs_borrow:+10")));
    assert.ok(result.valueReasons.some((token) => token.startsWith("priority:+8")));
  });

  test("scores are clamped to 0..100", () => {
    const huge = buildCandidateEvaluation(
      makeFakeRepo({ size: 99999 }),
      makeFakeGuess({ mainLayer: "distribution_plugin", gapArea: "source_systems_and_families" }),
      makeFakeEnrichment({
        repo: {
          size: 99999,
          license: "GPL-3.0",
          archived: true,
          primaryLanguage: "Haskell"
        }
      }),
      makeFakeProjectAlignment({
        matchedCapabilities: Array.from({ length: 20 }, (_, index) => `cap-${index}`)
      }),
      makeFakeAlignmentRules()
    );

    assert.ok(huge.effortScore >= 0 && huge.effortScore <= 100);
    assert.ok(huge.valueScore >= 0 && huge.valueScore <= 100);
  });
});

describe("deriveDisposition", () => {
  const matrixCases = [
    ["low", "low", "observe_only"],
    ["low", "medium", "review_queue"],
    ["low", "high", "intake_now"],
    ["medium", "low", "skip"],
    ["medium", "medium", "observe_only"],
    ["medium", "high", "review_queue"],
    ["high", "low", "skip"],
    ["high", "medium", "observe_only"],
    ["high", "high", "review_queue"]
  ];

  for (const [effortBand, valueBand, expected] of matrixCases) {
    test(`matrix ${effortBand}/${valueBand} -> ${expected}`, () => {
      const out = deriveDisposition({ effortBand, valueBand }, [], "medium");
      assert.equal(out.disposition, expected);
      assert.equal(out.dispositionReason, `matrix:effort_${effortBand}_value_${valueBand}`);
    });
  }

  test("high-fit medium-value candidates get the review override before the matrix", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "medium" }, [], "high");
    assert.equal(out.disposition, "review_queue");
    assert.equal(out.dispositionReason, "override:high_fit_medium_value");
  });

  test("archived_repo overrides matrix output", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "high" }, ["archived_repo"], "high");
    assert.equal(out.disposition, "observe_only");
    assert.equal(out.dispositionReason, "override:archived_cap");
  });

  test("source_lock_in caps non-high values", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "medium" }, ["source_lock_in"], "high");
    assert.equal(out.disposition, "observe_only");
    assert.equal(out.dispositionReason, "override:source_lock_in_cap");
  });

  test("unknown fit caps at observe_only", () => {
    const out = deriveDisposition({ effortBand: "low", valueBand: "high" }, [], "unknown");
    assert.equal(out.disposition, "observe_only");
    assert.equal(out.dispositionReason, "override:unknown_fit");
  });

  test("unknown effort or value bands cap at review_queue", () => {
    const byEffort = deriveDisposition({ effortBand: "unknown", valueBand: "high" }, [], "high");
    const byValue = deriveDisposition({ effortBand: "low", valueBand: "unknown" }, [], "high");

    assert.equal(byEffort.disposition, "review_queue");
    assert.equal(byEffort.dispositionReason, "override:unknown_band");
    assert.equal(byValue.disposition, "review_queue");
    assert.equal(byValue.dispositionReason, "override:unknown_band");
  });

  test("override priority prefers archived over source lock in over unknown fit and band", () => {
    const out = deriveDisposition(
      { effortBand: "unknown", valueBand: "unknown" },
      ["archived_repo", "source_lock_in"],
      "unknown"
    );

    assert.equal(out.dispositionReason, "override:archived_cap");
  });
});

describe("buildRunConfidence", () => {
  test("fewer than 3 candidates stays low", () => {
    const result = buildRunConfidence(makeCandidates([{ fit: "high" }, { fit: "high" }]), 6);
    assert.equal(result.runConfidence, "low");
    assert.match(result.runConfidenceReason, /too few/);
  });

  test("three high-fit candidates with enough diversity can go high", () => {
    const result = buildRunConfidence(
      makeCandidates([
        { fit: "high", caps: ["source_first", "candidate_first"] },
        { fit: "high", caps: ["evidence_acquisition"] },
        { fit: "high", caps: ["quality_governance"] }
      ]),
      6
    );

    assert.equal(result.runConfidence, "high");
  });

  test("two high-fit candidates can still land in medium", () => {
    const result = buildRunConfidence(
      makeCandidates([
        { fit: "high", caps: ["source_first"] },
        { fit: "high", caps: ["candidate_first"] },
        { fit: "medium", caps: [] },
        { fit: "medium", caps: [] }
      ]),
      6
    );

    assert.equal(result.runConfidence, "medium");
  });

  test("thin signals stay low", () => {
    const result = buildRunConfidence(
      makeCandidates([{ fit: "low" }, { fit: "low" }, { fit: "low" }, { fit: "medium" }]),
      6
    );

    assert.equal(result.runConfidence, "low");
  });

  test("unknown fit ratio caps a high run at medium", () => {
    const result = buildRunConfidence(
      makeCandidates([
        { fit: "high", caps: ["source_first", "candidate_first"] },
        { fit: "high", caps: ["evidence_acquisition"] },
        { fit: "high", caps: ["quality_governance"] },
        { fit: "unknown" },
        { fit: "unknown" }
      ]),
      6
    );

    assert.equal(result.runConfidence, "medium");
    assert.match(result.runConfidenceReason, /unknown fit/);
  });

  test("risky ratio caps a high run at medium", () => {
    const result = buildRunConfidence(
      makeCandidates([
        { fit: "high", caps: ["source_first", "candidate_first"], risks: ["archived_repo"] },
        { fit: "high", caps: ["evidence_acquisition"], risks: ["source_lock_in"] },
        { fit: "high", caps: ["quality_governance"], risks: ["source_lock_in"] },
        { fit: "high", caps: ["location_intelligence"] },
        { fit: "high", caps: ["distribution_surfaces"] }
      ]),
      6
    );

    assert.equal(result.runConfidence, "medium");
    assert.match(result.runConfidenceReason, /risk-flagged/);
  });

  test("confidence factors expose the raw counts", () => {
    const result = buildRunConfidence(
      makeCandidates([
        { fit: "high", caps: ["source_first"] },
        { fit: "medium", caps: ["candidate_first"] },
        { fit: "unknown" }
      ]),
      6
    );

    assert.equal(result.confidenceFactors.candidateCount, 3);
    assert.equal(result.confidenceFactors.highFitCount, 1);
    assert.equal(result.confidenceFactors.unknownFitCount, 1);
    assert.equal(result.confidenceFactors.riskyCount, 0);
    assert.equal(typeof result.confidenceFactors.capabilityDiversity, "number");
  });

  test("nested and flat candidate shapes behave the same", () => {
    const nested = [
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["source_first", "candidate_first"] }, risks: [] },
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["evidence_acquisition"] }, risks: [] },
      { projectAlignment: { fitBand: "high", matchedCapabilities: ["quality_governance"] }, risks: [] }
    ];
    const flat = [
      { projectFitBand: "high", matchedCapabilities: ["source_first", "candidate_first"], risks: [] },
      { projectFitBand: "high", matchedCapabilities: ["evidence_acquisition"], risks: [] },
      { projectFitBand: "high", matchedCapabilities: ["quality_governance"], risks: [] }
    ];

    const nestedResult = buildRunConfidence(nested, 6);
    const flatResult = buildRunConfidence(flat, 6);

    assert.equal(nestedResult.runConfidence, flatResult.runConfidence);
    assert.equal(nestedResult.confidenceFactors.highFitCount, flatResult.confidenceFactors.highFitCount);
    assert.equal(nestedResult.confidenceFactors.capabilityDiversity, flatResult.confidenceFactors.capabilityDiversity);
  });
});
