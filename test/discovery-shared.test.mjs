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
    const signalLanePlan = plan.plans.find((item) => item.id === "signal-lane-adapter_family");
    const capabilityLanePlan = plan.plans.find((item) => item.id === "capability-source_first-adapter_family");

    assert.ok(broadPlan);
    assert.ok(signalLanePlan);
    assert.ok(capabilityLanePlan);
    assert.match(broadPlan.query, /event/);
    assert.match(broadPlan.query, /calendar/);
    assert.match(broadPlan.query, /connector/);
    assert.match(broadPlan.query, /archived:false/);
    assert.match(broadPlan.query, /-awesome/);
    assert.match(signalLanePlan.query, /event/);
    assert.match(capabilityLanePlan.query, /connector|feed/);
    assert.doesNotMatch(capabilityLanePlan.query, /"/);
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
    assert.match(broadPlan.query, /^event /);
    assert.match(broadPlan.query, /archived:false/);
    assert.match(manualPlan.query, /calendar/);
    assert.match(manualPlan.query, /scraper/);
    assert.match(manualPlan.query, /venue/);
    assert.match(manualPlan.query, /archived:false/);
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
        dependencySignals: ["calendar parser", "schema review"],
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
    assert.match(archetypePlan.query, /archived:false/);
    assert.match(architecturePlan.query, /connector|review|parser/);
    assert.match(dependencyPlan.query, /calendar|parser|schema|review/);
    assert.ok(plan.inferredArchetypes.length >= 1);
  });

  test("feeds discovery feedback into planning priorities without overriding project anchors", () => {
    const binding = {
      projectKey: "sample-project",
      projectLabel: "Sample Project",
      discoveryHints: ["calendar", "connector"]
    };

    const plan = buildDiscoveryPlan(binding, { capabilities: [] }, {
      corpus: "",
      discoverySignals: ["calendar", "connector"],
      manifestSignals: {
        packageNames: [],
        descriptions: [],
        keywords: ["calendar"],
        dependencySignals: [],
        scriptSignals: []
      },
      architectureSignals: {
        directorySignals: ["connectors"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "focused",
      discoveryFeedback: {
        hasSignals: true,
        preferredTerms: ["governance", "review"],
        avoidTerms: ["frontend", "template"],
        queryFamilyOutcomes: [
          { value: "architecture", positive: 2, negative: 0, observe: 0, score: 6 }
        ]
      }
    });

    const broadPlan = plan.plans.find((item) => item.id === "broad-project-scan");
    const strongestPlan = plan.plans[0];

    assert.ok(broadPlan);
    assert.ok(strongestPlan);
    assert.match(broadPlan.query, /calendar/);
    assert.match(broadPlan.query, /connector/);
    assert.match(broadPlan.query, /archived:false/);
    assert.doesNotMatch(broadPlan.query, /-calendar|-connector/);
    assert.match(broadPlan.query, /-awesome/);
    assert.match(broadPlan.query, /-boilerplate/);
    assert.ok(plan.discoveryFeedback.hasSignals);
    assert.equal(plan.discoveryFeedback.preferredTerms[0], "governance");
  });

  test("reserves query slots for priority signal lanes when they are available", () => {
    const binding = {
      projectKey: "sample-project",
      projectLabel: "Sample Project",
      discoveryHints: ["municipal event", "adapter family", "normalization schema"],
      analysisQuestions: ["How does public event intake map into normalization?"],
      targetCapabilities: ["ingestion and adapters"],
      discoveryStrategy: {
        prioritySignalLaneIds: ["public_event_intake", "adapter_family", "normalization_schema"]
      }
    };

    const plan = buildDiscoveryPlan(binding, {
      capabilities: [
        { id: "ingestion", label: "ingestion", signals: ["crawler", "scraper", "feed"] },
        { id: "governance", label: "governance", signals: ["audit", "review", "dedupe"] },
        { id: "data_model", label: "data model", signals: ["schema", "normalize", "entity"] }
      ]
    }, {
      corpus: "",
      discoverySignals: ["municipal", "civic", "adapter", "normalize", "schema"],
      manifestSignals: {
        packageNames: [],
        descriptions: [],
        keywords: ["public event", "adapter", "normalize"],
        dependencySignals: ["rss-parser"],
        scriptSignals: ["ingest"]
      },
      architectureSignals: {
        directorySignals: ["sources", "connectors", "normalization"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "focused"
    });

    const planIds = plan.plans.map((item) => item.id);

    assert.ok(planIds.includes("signal-lane-public_event_intake"));
    assert.ok(planIds.includes("signal-lane-adapter_family"));
    assert.ok(planIds.includes("signal-lane-normalization_schema"));
  });

  test("splits broad ingestion capability queries into lane-shaped subplans", () => {
    const binding = {
      projectKey: "eventbear-worker",
      projectLabel: "Eventbaer Worker",
      discoveryHints: ["municipal event scraper", "adapter family review", "location event normalization"],
      analysisQuestions: ["Welche Intake- oder Adapter-Familie ist fuer das Zielprojekt wirklich relevant?"],
      targetCapabilities: ["ingestion and adapters", "data model and semantics"]
    };

    const plan = buildDiscoveryPlan(binding, {
      capabilities: [
        {
          id: "ingestion",
          label: "ingestion and adapters",
          signals: ["fetch", "ingest", "source", "scrape", "crawler", "connector", "adapter", "feed", "extract"]
        },
        {
          id: "data_model",
          label: "data model and semantics",
          signals: ["schema", "normalize", "entity", "taxonomy", "masterlist"]
        }
      ]
    }, {
      corpus: "",
      discoverySignals: ["municipal", "civic", "adapter", "connector", "normalize", "schema"],
      manifestSignals: {
        packageNames: [],
        descriptions: ["municipal event intake worker"],
        keywords: ["public event", "adapter family", "normalize"],
        dependencySignals: ["rss-parser"],
        scriptSignals: ["ingest"]
      },
      architectureSignals: {
        directorySignals: ["sources", "connectors", "normalization"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "balanced"
    });

    const publicEventCapabilityPlan = plan.plans.find((item) => item.id === "capability-ingestion-public_event_intake");
    const adapterCapabilityPlan = plan.plans.find((item) => item.id === "capability-ingestion-adapter_family");
    const normalizationCapabilityPlan = plan.plans.find((item) => item.id === "capability-data_model-normalization_schema");
    const publicEventSignalLanePlan = plan.plans.find((item) => item.id === "signal-lane-public_event_intake");

    assert.ok(publicEventCapabilityPlan);
    assert.ok(adapterCapabilityPlan);
    assert.ok(normalizationCapabilityPlan);
    assert.ok(publicEventSignalLanePlan);
    assert.match(publicEventCapabilityPlan.query, /municipal|civic|agenda|event/);
    assert.match(publicEventCapabilityPlan.query, /public|municipal|event/);
    assert.match(adapterCapabilityPlan.query, /adapter|connector|source/);
    assert.match(normalizationCapabilityPlan.query, /normalize|schema|taxonomy|masterlist/);
    assert.equal(publicEventSignalLanePlan.minSearchResults, 4);
    assert.equal(publicEventCapabilityPlan.minSearchResults, 4);
  });

  test("uses benchmark-positive cohorts as anchors and benchmark-negative cohorts as anti-seeds", () => {
    const binding = {
      projectKey: "eventbear-worker",
      projectLabel: "Eventbaer Worker",
      discoveryHints: ["worker", "parser"],
      analysisQuestions: ["Welche Intake-Muster sind fuer das Zielprojekt tragfaehig?"],
      targetCapabilities: ["ingestion and adapters"]
    };

    const plan = buildDiscoveryPlan(binding, {
      capabilities: [
        {
          id: "ingestion",
          label: "ingestion and adapters",
          signals: ["feed", "connector", "adapter", "crawler"]
        }
      ]
    }, {
      corpus: "",
      discoverySignals: ["parser"],
      manifestSignals: {
        packageNames: [],
        descriptions: [],
        keywords: [],
        dependencySignals: [],
        scriptSignals: []
      },
      architectureSignals: {
        directorySignals: ["sources"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "focused",
      discoveryBenchmark: {
        positiveRepos: [
          {
            repo: "City-Bureau/city-scrapers-events",
            why: "Public-event intake plus scraper-family signal with civic/open-data relevance."
          }
        ],
        negativeRepos: [
          {
            repo: "abangafdhu/ionic-framework",
            why: "Framework/UI noise and not target-relevant for EventBear worker core."
          }
        ],
        boundaryRepos: [
          {
            repo: "j-e-d/agenda-lumiton",
            why: "Potential agenda signal, but not the default top hit."
          }
        ]
      }
    });

    const publicEventLane = plan.plans.find((item) => item.id === "signal-lane-public_event_intake");
    const planQueries = plan.plans.map((item) => item.query).join(" ");

    assert.ok(publicEventLane);
    assert.ok(plan.benchmarkContext);
    assert.ok(plan.benchmarkContext.preferredLaneIds.includes("public_event_intake"));
    assert.match(planQueries, /public|event|civic|municipal/);
    assert.match(planQueries, /-framework|-ionic/);
    assert.match(publicEventLane.reasons.join(" "), /Benchmark-positive cohorts reinforce this lane/);
  });

  test("uses curated discovery seeds to open a neighbor query instead of only replaying exact baselines", () => {
    const binding = {
      projectKey: "eventbear-worker",
      projectLabel: "Eventbaer Worker",
      discoveryHints: ["worker", "parser"],
      analysisQuestions: ["Welche civic/public-event Muster sind fuer das Zielprojekt tragfaehig?"],
      targetCapabilities: ["ingestion and adapters"]
    };

    const plan = buildDiscoveryPlan(binding, {
      capabilities: [
        {
          id: "ingestion",
          label: "ingestion and adapters",
          signals: ["feed", "connector", "adapter", "crawler"]
        }
      ]
    }, {
      corpus: "",
      discoverySignals: ["parser"],
      manifestSignals: {
        packageNames: [],
        descriptions: [],
        keywords: [],
        dependencySignals: [],
        scriptSignals: []
      },
      architectureSignals: {
        directorySignals: ["sources"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "focused",
      discoverySeeds: {
        priorityRepos: [
          {
            repo: "City-Bureau/city-scrapers-events",
            description: "Static site with civic and public-event scraper families.",
            topics: ["public-event", "civic", "scraper", "open-data"],
            why: "Strong civic public-event intake baseline."
          }
        ],
        referenceRepos: [
          {
            repo: "j-e-d/agenda-lumiton",
            description: "Agenda-style boundary repo.",
            topics: ["agenda", "calendar", "scraper"],
            why: "Boundary agenda signal."
          }
        ]
      }
    });

    const publicEventLane = plan.plans.find((item) => item.id === "signal-lane-public_event_intake");
    const planQueries = plan.plans.map((item) => item.query).join(" ");

    assert.ok(plan.seedContext);
    assert.ok(plan.seedContext.preferredLaneIds.includes("public_event_intake"));
    assert.ok(plan.seedContext.ownerAnchors.length >= 1);
    assert.ok(plan.seedContext.ownerQualifiers.length >= 1);
    assert.ok(plan.seedContext.familySignals.length >= 1);
    assert.ok(plan.seedContext.ownerQualifiers.some((item) => /city-bureau|citybureau/.test(item.orgQualifier)));
    assert.match(planQueries, /public|event|civic|scraper|agenda/);
    assert.match(publicEventLane.reasons.join(" "), /Kuratiertes Seed-Pack verstaerkt diese Lane/);
  });

  test("filters contradictory negative seed memory when the same repo is already a positive seed", () => {
    const binding = {
      projectKey: "eventbear-worker",
      projectLabel: "Eventbaer Worker",
      discoveryHints: ["worker", "parser"]
    };

    const plan = buildDiscoveryPlan(binding, { capabilities: [] }, {
      corpus: "",
      discoverySignals: ["parser"],
      manifestSignals: {
        packageNames: [],
        descriptions: [],
        keywords: [],
        dependencySignals: [],
        scriptSignals: []
      },
      architectureSignals: {
        directorySignals: ["sources"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "focused",
      discoverySeeds: {
        priorityRepos: [
          {
            repo: "citybureau/city-scrapers",
            description: "Positive baseline.",
            topics: ["civic", "scraper"],
            why: "Strong source-family baseline."
          }
        ],
        negativeRepos: [
          {
            repo: "citybureau/city-scrapers",
            description: "Conflicting negative memory.",
            topics: ["noise"],
            why: "Should be ignored because it conflicts with the positive baseline."
          }
        ]
      }
    });

    assert.ok(plan.seedContext);
    assert.equal(plan.seedContext.negativeTerms.includes("noise"), false);
  });

  test("loads project cohorts into seed context and builds cohort-shaped plans", () => {
    const binding = {
      projectKey: "eventbear-worker",
      projectLabel: "Eventbaer Worker",
      discoveryHints: ["municipal event scraper", "adapter family review"]
    };

    const plan = buildDiscoveryPlan(binding, { capabilities: [] }, {
      corpus: "",
      discoverySignals: ["municipal", "civic", "adapter"],
      manifestSignals: {
        packageNames: [],
        descriptions: [],
        keywords: [],
        dependencySignals: [],
        scriptSignals: []
      },
      architectureSignals: {
        directorySignals: ["sources"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "balanced",
      discoverySeeds: {
        priorityCohorts: [
          {
            id: "civic-source-family",
            label: "Civic source family",
            owners: ["city-bureau"],
            repoRefs: ["City-Bureau/city-scrapers-events"],
            signals: ["civic", "public-event", "scraper"],
            boundarySignals: ["agenda", "calendar"]
          }
        ]
      }
    });

    const planQueries = plan.plans.map((item) => item.query).join(" ");
    assert.ok(plan.seedContext);
    assert.equal(plan.seedContext.priorityCohorts.length, 1);
    assert.ok(plan.seedContext.priorityCohorts[0].owners.includes("city-bureau"));
    assert.match(planQueries, /civic|public|event|scraper|agenda/);
  });

  test("uses learned positive cohorts from discovery feedback as additional discovery anchors", () => {
    const binding = {
      projectKey: "eventbear-worker",
      projectLabel: "Eventbaer Worker",
      discoveryHints: ["worker", "parser"],
      analysisQuestions: ["Welche Intake-Muster sind fuer das Zielprojekt tragfaehig?"],
      targetCapabilities: ["ingestion and adapters"]
    };

    const plan = buildDiscoveryPlan(binding, {
      capabilities: [
        {
          id: "ingestion",
          label: "ingestion and adapters",
          signals: ["feed", "connector", "adapter", "crawler"]
        }
      ]
    }, {
      corpus: "",
      discoverySignals: ["parser"],
      manifestSignals: {
        packageNames: [],
        descriptions: [],
        keywords: [],
        dependencySignals: [],
        scriptSignals: []
      },
      architectureSignals: {
        directorySignals: ["sources"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "focused",
      discoveryFeedback: {
        hasSignals: true,
        preferredTerms: [],
        avoidTerms: [],
        preferredSignals: [],
        avoidSignals: [],
        queryFamilyOutcomes: [],
        learnedCohorts: {
          positiveParts: ["civic", "public event", "validation"],
          negativeParts: ["template", "landing"],
          positive: [],
          negative: [],
          observe: []
        }
      }
    });

    const queries = plan.plans.map((item) => item.query).join(" ");
    assert.match(queries, /civic|public|validation/);
    assert.match(queries, /-template|-landing/);
  });

  test("drops dependency-neighbor plans when dependency signals are not core-grounded", () => {
    const binding = {
      projectKey: "eventbear-worker",
      projectLabel: "Eventbaer Worker",
      discoveryHints: ["municipal event scraper", "adapter family review"],
      analysisQuestions: ["Welche civic/public-event Intake-Muster sind tragfaehig?"],
      targetCapabilities: ["ingestion and adapters"]
    };

    const plan = buildDiscoveryPlan(binding, {
      capabilities: [
        {
          id: "ingestion",
          label: "ingestion and adapters",
          signals: ["feed", "connector", "adapter", "crawler"]
        }
      ]
    }, {
      corpus: "",
      discoverySignals: ["municipal", "civic", "adapter", "normalize"],
      manifestSignals: {
        packageNames: [],
        descriptions: ["generic worker"],
        keywords: [],
        dependencySignals: ["image", "mcp", "playwright"],
        scriptSignals: []
      },
      architectureSignals: {
        directorySignals: ["sources", "connectors"],
        extensionHints: ["ts"]
      }
    }, {
      discoveryProfile: "balanced"
    });

    assert.equal(
      plan.plans.some((item) => item.id === "dependency-neighbors"),
      false
    );
  });
});
