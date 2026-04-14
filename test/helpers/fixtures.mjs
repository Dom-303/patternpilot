import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export function makeFakeRepo(overrides = {}) {
  return {
    owner: "acme",
    name: "eventbear-worker",
    normalizedRepoUrl: "https://github.com/acme/eventbear-worker",
    description: "Event discovery and intake worker",
    size: 500,
    ...overrides
  };
}

export function makeFakeGuess(overrides = {}) {
  return {
    category: "connector",
    patternFamily: "cms_distribution_plugin",
    mainLayer: "source_intake",
    gapArea: "source_systems_and_families",
    buildVsBorrow: "adapt_pattern",
    priority: "now",
    ...overrides
  };
}

export function makeFakeEnrichment(overrides = {}) {
  const now = new Date().toISOString();
  const repo = {
    description: "Event discovery and intake infrastructure",
    topics: ["event", "worker"],
    stars: 120,
    size: 500,
    primaryLanguage: "JavaScript",
    license: "MIT",
    archived: false,
    pushedAt: now,
    ...overrides.repo
  };

  return {
    status: "success",
    fetchedAt: now,
    repo,
    readme: {
      excerpt: "A focused worker for discovery and intake.",
      ...overrides.readme
    },
    languages: overrides.languages ?? ["JavaScript"],
    ...overrides,
    repo
  };
}

export function makeFakeProjectAlignment(overrides = {}) {
  return {
    status: "ready",
    fitBand: "high",
    fitScore: 78,
    matchedCapabilities: ["source_first", "candidate_first"],
    recommendedWorkerAreas: ["docs/SOURCE_MASTERLIST_POLICY.md", "lib/fetch.mjs"],
    reviewDocs: ["WORKER_CONTRACT.md"],
    tensions: [],
    suggestedNextStep: "Review the repo against the target worker architecture.",
    rationale: ["Strong source-family and candidate-flow signals."],
    ...overrides
  };
}

export function makeFakeAlignmentRules(overrides = {}) {
  return {
    projectKey: "eventbear-worker",
    capabilities: [
      {
        id: "source_first",
        label: "source-first",
        signals: ["source", "sources", "source system", "source systems", "connector", "family"],
        review_docs: ["WORKER_CONTRACT.md", "docs/SOURCE_MASTERLIST_POLICY.md", "docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md"]
      },
      {
        id: "candidate_first",
        label: "candidate-first",
        signals: ["candidate", "candidates", "listing", "detail"],
        review_docs: ["WORKER_CONTRACT.md", "WORKER_FLOW.md"]
      },
      {
        id: "evidence_acquisition",
        label: "evidence acquisition",
        signals: ["fetch", "scrape", "scraper", "crawler", "browser", "evidence", "json-ld", "html"],
        review_docs: ["WORKER_FLOW.md", "docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md"]
      },
      {
        id: "quality_governance",
        label: "quality and governance",
        signals: ["quality", "review", "dedupe", "reject", "validation", "governance", "identity"],
        review_docs: ["WORKER_CONTRACT.md", "docs/WORKER_MEMORY_ARCHITECTURE.md"]
      },
      {
        id: "location_intelligence",
        label: "location and gastro intelligence",
        signals: ["place", "location", "venue", "gastro", "maps", "geo"],
        review_docs: ["WORKER_CONTRACT.md", "docs/SOURCE_GEO_REFERENCE.md"]
      },
      {
        id: "distribution_surfaces",
        label: "distribution surfaces",
        signals: ["api", "feed", "plugin", "wordpress", "frontend", "widget", "embed"],
        review_docs: ["docs/UI_FRAMEWORK.md", "docs/WEB_PLATFORM_OVERVIEW.md"]
      }
    ],
    layerMappings: {
      access_fetch: {
        fit_bias: 26,
        effort_bias: 8,
        worker_areas: ["lib/fetch.mjs", "lib/headless-scraper.mjs", "lib/firecrawl.mjs"],
        review_docs: ["WORKER_FLOW.md", "docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md"],
        next_step: "Compare the external access pattern against the worker's fetch, browser and fallback chain."
      },
      source_intake: {
        fit_bias: 28,
        effort_bias: -5,
        worker_areas: ["docs/SOURCE_MASTERLIST_POLICY.md", "docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md", "sources/"],
        review_docs: ["docs/SOURCE_MASTERLIST_POLICY.md", "docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md"],
        next_step: "Check whether the repo suggests a reusable source-family or intake contract for EventBaer."
      },
      parsing_extraction: {
        fit_bias: 22,
        effort_bias: 0,
        worker_areas: ["lib/parse-jsonld.mjs", "lib/heuristic-registry.mjs", "lib/evidence.mjs"],
        review_docs: ["WORKER_FLOW.md", "WORKER_CONTRACT.md"],
        next_step: "Inspect whether extraction tactics improve evidence quality without weakening worker guardrails."
      },
      export_feed_api: {
        fit_bias: 14,
        effort_bias: -3,
        worker_areas: ["lib/export.mjs", "lib/report.mjs", "templates/"],
        review_docs: ["WORKER_CONTRACT.md", "docs/WEB_PLATFORM_OVERVIEW.md"],
        next_step: "Treat as a distribution or export pattern layered on top of the worker core."
      },
      distribution_plugin: {
        fit_bias: 8,
        effort_bias: 15,
        worker_areas: ["docs/WEB_PLATFORM_OVERVIEW.md", "docs/UI_FRAMEWORK.md"],
        review_docs: ["docs/WEB_PLATFORM_OVERVIEW.md"],
        next_step: "Evaluate as an adjacent product surface, not as worker core logic."
      },
      ui_discovery_surface: {
        fit_bias: 7,
        effort_bias: 12,
        worker_areas: ["docs/UI_FRAMEWORK.md", "docs/WEB_PLATFORM_OVERVIEW.md"],
        review_docs: ["docs/UI_FRAMEWORK.md"],
        next_step: "Keep the discovery surface conceptually separate from the ingestion and truth core."
      },
      location_place_enrichment: {
        fit_bias: 18,
        effort_bias: 3,
        worker_areas: ["lib/geo-validator.mjs", "scripts/run-locations.mjs", "templates/locations_template.csv"],
        review_docs: ["WORKER_CONTRACT.md", "docs/SOURCE_GEO_REFERENCE.md"],
        next_step: "Evaluate as a controlled secondary layer for place and venue intelligence."
      }
    },
    gapMappings: {
      connector_families: {
        fit_bias: 18,
        value_bias: 18,
        suggested_next_step: "Check whether the repo should influence connector-family conventions, not the worker core."
      },
      source_systems_and_families: {
        fit_bias: 24,
        value_bias: 22,
        suggested_next_step: "Compare the repo against EventBaer's source-system target architecture and family scaling goals."
      },
      adapter_handoff_contracts: {
        fit_bias: 20,
        value_bias: 15,
        suggested_next_step: "Inspect handoff contracts into a common candidate or evidence layer."
      },
      distribution_surfaces: {
        fit_bias: 12,
        value_bias: 8,
        suggested_next_step: "Treat as a product-surface signal sitting on top of the worker, not inside it."
      },
      wordpress_plugin_distribution: {
        fit_bias: 10,
        value_bias: 6,
        suggested_next_step: "Review as partner/distribution leverage, separate from worker truth logic."
      },
      frontend_and_surface_design: {
        fit_bias: 8,
        value_bias: 4,
        suggested_next_step: "Evaluate as an external discovery surface, not as worker architecture."
      },
      location_and_gastro_intelligence: {
        fit_bias: 18,
        value_bias: 14,
        suggested_next_step: "Review against location/gastro layers and geo-validation capabilities."
      },
      secondary_enrichment_layers: {
        fit_bias: 14,
        value_bias: 10,
        suggested_next_step: "Evaluate as optional enrichment behind strong evidence and governance constraints."
      },
      vertical_depth_connectors: {
        fit_bias: 11,
        value_bias: 10,
        suggested_next_step: "Use to judge whether niche connectors deserve a later family slot."
      },
      risk_and_dependency_awareness: {
        fit_bias: 6,
        value_bias: 2,
        suggested_next_step: "Read primarily as a risk or anti-pattern signal for EventBaer."
      }
    },
    patternTensions: {
      cms_distribution_plugin: "Strong adjacent surface signal, but should stay outside worker core.",
      event_discovery_frontend: "Discovery UX can be valuable, but it is not evidence or quality-gate architecture.",
      platform_based_place_enrichment: "Useful as enrichment, but should not become the truth core."
    },
    ...overrides
  };
}

export function makeTempQueueWorkspace({ header, rows = [], queueFile = "state/repo_intake_queue.csv" } = {}) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-"));
  const queuePath = path.join(rootDir, queueFile);
  fs.mkdirSync(path.dirname(queuePath), { recursive: true });

  if (header) {
    const lines = [
      header.join(";"),
      ...rows.map((row) => header.map((column) => String(row[column] ?? "")).join(";"))
    ];
    fs.writeFileSync(queuePath, `${lines.join("\n")}\n`, "utf8");
  }

  return {
    rootDir,
    queuePath,
    config: { queueFile },
    cleanup() {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  };
}
