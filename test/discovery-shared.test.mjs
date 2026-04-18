import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { buildDiscoveryPlan, resolveDiscoveryStrategy } from "../lib/discovery/shared.mjs";

describe("buildDiscoveryPlan", () => {
  test("keeps manual query visible inside the discovery budget", () => {
    const binding = {
      projectKey: "sample-project",
      projectLabel: "Sample Project",
      discoveryHints: ["events", "calendar", "scraper", "venue"]
    };
    const alignmentRules = {
      capabilities: [
        { id: "source_first", label: "source-first", signals: ["source systems", "connector"] },
        { id: "candidate_first", label: "candidate-first", signals: ["candidate", "listing"] },
        { id: "evidence_acquisition", label: "evidence acquisition", signals: ["scraper", "crawler"] },
        { id: "quality_governance", label: "quality and governance", signals: ["quality", "review"] },
        { id: "location_intelligence", label: "location intelligence", signals: ["venue", "location"] },
        { id: "distribution_surfaces", label: "distribution surfaces", signals: ["feed", "plugin"] }
      ]
    };

    const plan = buildDiscoveryPlan(binding, alignmentRules, { corpus: "" }, {
      discoveryProfile: "balanced",
      query: "calendar scrapers venues"
    });

    const manualPlan = plan.plans.find((item) => item.id === "manual-query");
    assert.ok(manualPlan);
    assert.match(manualPlan.query, /event/);
    assert.match(manualPlan.query, /calendar/);
    assert.match(manualPlan.query, /scraper/);
    assert.match(manualPlan.query, /venue/);
  });

  test("builds broader github search queries without quoted phrases", () => {
    const binding = {
      projectKey: "sample-project",
      projectLabel: "Sample Project",
      discoveryHints: ["events", "calendar", "scraper", "connector", "venue"]
    };
    const alignmentRules = {
      capabilities: [
        { id: "source_first", label: "source-first", signals: ["source systems", "connector", "family"] }
      ]
    };

    const plan = buildDiscoveryPlan(binding, alignmentRules, { corpus: "" }, {
      discoveryProfile: "focused"
    });
    const broadPlan = plan.plans.find((item) => item.id === "broad-project-scan");
    const archetypePlan = plan.plans.find((item) => item.family === "archetype");
    const layerPlan = plan.plans.find((item) => item.id === "architecture-patterns" || item.id === "capability-source_first");

    assert.ok(broadPlan);
    assert.ok(archetypePlan);
    assert.ok(layerPlan);
    assert.match(broadPlan.query, /^event calendar source /);
    assert.match(broadPlan.query, /-awesome/);
    assert.match(layerPlan.query, /connector|source/);
    assert.doesNotMatch(layerPlan.query, /"/);
  });

  test("allows per-project discovery strategy overrides", () => {
    const binding = {
      projectKey: "demo",
      projectLabel: "Demo",
      discoveryHints: ["events", "calendar", "scraper", "venue"],
      discoveryStrategy: {
        broadAnchorCount: 1,
        broadSignalCount: 0,
        broadMaxTerms: 2,
        manualAnchorCount: 0,
        manualMaxTerms: 3,
        minSeedSignalHits: 3,
        minStrongSeedSignalHits: 2,
        seedSignalSources: ["discoveryHints", "targetCapabilities"],
        defaultStrongSignals: ["scraper", "venue"]
      },
      targetCapabilities: ["distribution surfaces"]
    };
    const strategy = resolveDiscoveryStrategy(binding);
    const plan = buildDiscoveryPlan(binding, { capabilities: [] }, { corpus: "" }, {
      query: "calendar scraper venue"
    });
    const broadPlan = plan.plans.find((item) => item.id === "broad-project-scan");
    const manualPlan = plan.plans.find((item) => item.id === "manual-query");

    assert.equal(strategy.broadAnchorCount, 1);
    assert.equal(strategy.minSeedSignalHits, 3);
    assert.deepEqual(strategy.seedSignalSources, ["discoveryhints", "targetcapabilities"]);
    assert.ok(broadPlan);
    assert.ok(manualPlan);
    assert.equal(broadPlan.query, "event -awesome -boilerplate -starter archived:false fork:false stars:>=3");
    assert.equal(
      manualPlan.query,
      "calendar scraper venue -awesome -boilerplate -starter archived:false fork:false stars:>=3"
    );
  });

  test("uses richer project profile discovery signals as query anchors", () => {
    const binding = {
      projectKey: "sample-project",
      projectLabel: "Sample Project",
      discoveryHints: ["ingestion"]
    };

    const plan = buildDiscoveryPlan(binding, { capabilities: [] }, {
      corpus: "",
      discoverySignals: ["calendar", "adapter", "venue"],
      manifestSignals: {
        packageNames: ["@demo/calendar-sync"],
        descriptions: ["calendar ingestion worker"],
        keywords: ["calendar", "venue"],
        dependencySignals: ["airtable", "rss-parser"],
        scriptSignals: ["ingest"]
      },
      architectureSignals: {
        directorySignals: ["connectors", "feeds"],
        extensionHints: ["ts", "md"]
      }
    }, {
      discoveryProfile: "focused"
    });
    const broadPlan = plan.plans.find((item) => item.id === "broad-project-scan");

    assert.ok(broadPlan);
    assert.match(broadPlan.query, /ingestion/);
    assert.match(broadPlan.query, /calendar/);
  });

  test("builds archetype, architecture and dependency query families with anti-noise filters", () => {
    const binding = {
      projectKey: "sample-project",
      projectLabel: "Sample Project",
      discoveryHints: ["calendar", "connector", "review"],
      discoveryStrategy: {
        negativeTermCount: 2
      }
    };

    const plan = buildDiscoveryPlan(binding, {
      capabilities: [
        { id: "source_first", label: "source-first", signals: ["connector", "adapter", "feed"] }
      ]
    }, {
      corpus: "",
      discoverySignals: ["calendar", "adapter", "review", "schema"],
      manifestSignals: {
        packageNames: ["calendar-sync"],
        descriptions: ["calendar connector and validation worker"],
        keywords: ["calendar", "connector", "validation"],
        dependencySignals: ["airtable", "rss-parser"],
        scriptSignals: ["ingest", "review"]
      },
      architectureSignals: {
        directorySignals: ["connectors", "parsers", "reviews"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "balanced"
    });

    const architecturePlan = plan.plans.find((item) => item.id === "architecture-patterns");
    const dependencyPlan = plan.plans.find((item) => item.id === "dependency-neighbors");
    const archetypePlan = plan.plans.find((item) => item.id.startsWith("archetype-"));

    assert.ok(archetypePlan);
    assert.ok(architecturePlan);
    assert.ok(dependencyPlan);
    assert.match(archetypePlan.query, /-awesome/);
    assert.match(architecturePlan.query, /connector|review|parser/);
    assert.match(dependencyPlan.query, /airtable|rss|ingest|review/);
    assert.ok(plan.inferredArchetypes.length >= 1);
  });
});
