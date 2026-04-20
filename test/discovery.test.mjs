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
  applyDiscoveryPolicyToCandidates,
  scoreDiscoveryCandidate,
  buildDiscoveryReasoning
} from "../lib/discovery/candidates.mjs";
import { defaultDiscoveryPolicy } from "../lib/policy/discovery-policy.mjs";

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

  test("scoreDiscoveryCandidate attaches evidence profile and candidate class", () => {
    const candidate = {
      repo: makeFakeRepo(),
      guess: makeFakeGuess({ mainLayer: "source_intake", gapArea: "source_systems_and_families" }),
      enrichment: makeFakeEnrichment({
        repo: {
          description: "Public event calendar ingestion connector with validation, schema normalization and governance tooling",
          topics: ["public-event", "calendar", "connector", "validation", "schema", "events"]
        },
        readme: {
          excerpt: "A public-event calendar connector with validation, governance, normalization and review flows."
        },
        languages: ["JavaScript", "TypeScript"]
      }),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "high",
        fitScore: 84,
        matchedCapabilities: ["source_first", "quality_governance"]
      }),
      queryLabels: ["Broad project scan", "Architecture and layer patterns"],
      queryFamilies: ["broad", "architecture"],
      risks: []
    };

    const score = scoreDiscoveryCandidate(
      candidate,
      ["calendar", "connector", "validation"],
      {
        hasSignals: true,
        preferredSignals: ["source_systems_and_families", "source_first", "broad"],
        avoidSignals: ["frontend_and_surface_design"],
        preferredTerms: ["calendar", "validation"],
        avoidTerms: ["template"]
      }
    );
    const reasoning = buildDiscoveryReasoning(candidate, ["calendar", "connector", "validation"]);

    assert.ok(score > 60);
    assert.equal(candidate.discoveryEvidence.grade, "strong");
    assert.equal(candidate.discoveryClass, "fit_candidate");
    assert.match(reasoning.join(" "), /Feedback-loop positives/i);
    assert.match(reasoning.join(" "), /Evidence grade is strong/i);
    assert.match(reasoning.join(" "), /Candidate class: fit candidate/i);
  });

  test("scoreDiscoveryCandidate downgrades risk and boundary signals", () => {
    const candidate = {
      repo: makeFakeRepo({ name: "archived-template" }),
      guess: makeFakeGuess({ buildVsBorrow: "observe_only", priority: "soon" }),
      enrichment: makeFakeEnrichment({
        repo: {
          archived: true,
          stars: 12,
          description: "Starter template for event sites",
          topics: ["template", "frontend"]
        },
        readme: {
          excerpt: ""
        }
      }),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "medium",
        fitScore: 44,
        matchedCapabilities: [],
        tensions: ["Surface-oriented and outside worker core."]
      }),
      queryLabels: ["Broad project scan"],
      queryFamilies: ["broad"],
      risks: ["archived", "template_heavy"]
    };

    const score = scoreDiscoveryCandidate(candidate, ["event", "template"]);

    assert.ok(score < 50);
    assert.equal(candidate.discoveryClass, "weak_signal");
    assert.ok(["light", "solid"].includes(candidate.discoveryEvidence.grade));
  });

  test("scoreDiscoveryCandidate favors reusable intake infra over niche vertical calendars", () => {
    const infraCandidate = {
      repo: makeFakeRepo({ owner: "city-bureau", name: "city-scrapers-events" }),
      guess: makeFakeGuess({
        patternFamily: "local_source_infra_framework",
        mainLayer: "source_intake",
        gapArea: "source_systems_and_families"
      }),
      enrichment: makeFakeEnrichment({
        repo: {
          description: "Open data event scraper adapter with validation, governance and schema normalization",
          topics: ["open-data", "events", "scraper", "adapter", "governance", "schema"]
        },
        readme: {
          excerpt: "Public event intake, review workflow, normalization, dedupe and masterlist CSV export."
        },
        languages: ["Python", "HTML"]
      }),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "high",
        fitScore: 88,
        matchedCapabilities: ["source_first", "evidence_acquisition", "quality_governance"]
      }),
      queryLabels: ["Broad project scan", "Architecture and layer patterns"],
      queryFamilies: ["broad", "architecture"],
      risks: []
    };
    const verticalCandidate = {
      repo: makeFakeRepo({ owner: "sportclimbing", name: "ifsc-calendar" }),
      guess: makeFakeGuess({
        patternFamily: "local_multi_source_aggregator",
        mainLayer: "export_feed_api",
        gapArea: "distribution_surfaces",
        priority: "soon"
      }),
      enrichment: makeFakeEnrichment({
        repo: {
          description: "Competition climbing timetable and stadium venue calendar",
          topics: ["climbing", "competition", "calendar", "stadium", "venue"]
        },
        readme: {
          excerpt: "Competition schedule for arena events and climbing venues."
        },
        languages: ["JavaScript"]
      }),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "medium",
        fitScore: 52,
        matchedCapabilities: ["distribution_surfaces"],
        tensions: ["Surface-oriented and outside worker core."]
      }),
      queryLabels: ["Broad project scan", "Architecture and layer patterns"],
      queryFamilies: ["broad", "architecture"],
      risks: []
    };

    const infraScore = scoreDiscoveryCandidate(infraCandidate, ["event", "scraper", "adapter", "governance", "schema"]);
    const verticalScore = scoreDiscoveryCandidate(verticalCandidate, ["event", "scraper", "adapter", "governance", "schema"]);

    assert.ok(infraScore > verticalScore);
    assert.equal(infraCandidate.discoveryEvidence.grade, "strong");
    assert.ok(infraCandidate.discoveryEvidence.sourceFamilyHits >= 2);
    assert.ok(infraCandidate.discoveryEvidence.governanceHits >= 1);
    assert.ok(infraCandidate.discoveryEvidence.normalizationHits >= 1);
    assert.ok(verticalCandidate.discoveryEvidence.nicheVerticalHits >= 1);
  });

  test("scoreDiscoveryCandidate downgrades ungrounded ingestion candidates in visible classing", () => {
    const candidate = {
      repo: makeFakeRepo({ owner: "generic", name: "crawler" }),
      guess: makeFakeGuess({
        mainLayer: "source_intake",
        gapArea: "source_systems_and_families"
      }),
      enrichment: makeFakeEnrichment({
        repo: {
          description: "Crawler and feed pipeline for ingestion jobs",
          topics: ["crawler", "feed", "pipeline"]
        },
        readme: {
          excerpt: "Crawler feed pipeline for generic ingestion."
        }
      }),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "high",
        fitScore: 82,
        matchedCapabilities: ["source_first"]
      }),
      queryIds: ["signal-lane-public_event_intake"],
      queryLabels: ["Public-event intake signals"],
      queryFamilies: ["signal_lane"],
      risks: []
    };

    scoreDiscoveryCandidate(candidate, ["municipal", "event", "normalize"]);

    assert.ok(["boundary_signal", "weak_signal"].includes(candidate.discoveryClass));
    assert.equal(candidate.discoveryEvidence.publicEventIntakeHits, 0);
    assert.equal(candidate.discoveryEvidence.normalizationHits, 0);
  });

  test("decorateDiscoveryCandidate upgrades prototype-ready core intake candidates to intake_now", () => {
    const candidate = {
      repo: makeFakeRepo({ owner: "citybureau", name: "city-scrapers" }),
      guess: makeFakeGuess({
        mainLayer: "source_intake",
        gapArea: "source_systems_and_families"
      }),
      enrichment: makeFakeEnrichment({
        repo: {
          description: "Civic public event source adapter with review workflow",
          topics: ["civic", "public-event", "adapter", "connector"]
        },
        readme: {
          excerpt: "Public event intake, source-family reuse and validation."
        }
      }),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "high",
        fitScore: 92,
        matchedCapabilities: ["source_first"]
      }),
      queryIds: ["signal-lane-public_event_intake", "signal-lane-adapter_family"],
      queryLabels: ["Public-event intake signals", "Adapter family signals"],
      queryFamilies: ["signal_lane"],
      risks: []
    };

    scoreDiscoveryCandidate(candidate, ["municipal", "public event", "adapter", "validation"]);
    const decorated = decorateDiscoveryCandidate(candidate, makeFakeAlignmentRules());

    assert.equal(decorated.prototypeReadiness.ready, true);
    assert.equal(decorated.discoveryDisposition, "intake_now");
    assert.ok(typeof decorated.dispositionReason === "string");
  });

  test("scoreDiscoveryCandidate penalizes dependency-neighbor hits without core project grounding", () => {
    const groundedCandidate = {
      repo: makeFakeRepo({ owner: "city-bureau", name: "city-scrapers-events" }),
      guess: makeFakeGuess({
        mainLayer: "source_intake",
        gapArea: "source_systems_and_families"
      }),
      enrichment: makeFakeEnrichment({
        repo: {
          description: "Public event adapter with civic source-family review and schema normalization",
          topics: ["public-event", "civic", "adapter", "schema", "review"]
        },
        readme: {
          excerpt: "Civic public-event intake, source-family reuse, review workflow and normalization."
        }
      }),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "high",
        fitScore: 88,
        matchedCapabilities: ["source_first", "quality_governance"]
      }),
      queryIds: ["dependency-neighbors"],
      queryLabels: ["Dependency and tooling neighbors"],
      queryFamilies: ["dependency"],
      risks: []
    };
    const noisyCandidate = {
      repo: makeFakeRepo({ owner: "sfedfcv", name: "redesigned-pancake" }),
      guess: makeFakeGuess({
        mainLayer: "source_intake",
        gapArea: "source_systems_and_families"
      }),
      enrichment: makeFakeEnrichment({
        repo: {
          description: "Image tooling helper with playwright and mcp scripts",
          topics: ["image", "tooling", "mcp"]
        },
        readme: {
          excerpt: "Image pipeline and generic tooling helpers."
        }
      }),
      projectAlignment: makeFakeProjectAlignment({
        fitBand: "high",
        fitScore: 80,
        matchedCapabilities: ["source_first"]
      }),
      queryIds: ["dependency-neighbors"],
      queryLabels: ["Dependency and tooling neighbors"],
      queryFamilies: ["dependency"],
      risks: []
    };

    const groundedScore = scoreDiscoveryCandidate(
      groundedCandidate,
      ["municipal", "public event", "adapter", "normalize", "schema"]
    );
    const noisyScore = scoreDiscoveryCandidate(
      noisyCandidate,
      ["municipal", "public event", "adapter", "normalize", "schema"]
    );

    assert.ok(groundedScore > noisyScore);
    assert.ok(["boundary_signal", "weak_signal"].includes(noisyCandidate.discoveryClass));
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
        discoveryEvidence: { sourceFamilyHits: 2, publicEventIntakeHits: 1, governanceHits: 0, normalizationHits: 1 },
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
      ...defaultDiscoveryPolicy("sample-project"),
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
      ...defaultDiscoveryPolicy("sample-project"),
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
