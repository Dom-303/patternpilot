import { clamp } from "./utils.mjs";

export const CATEGORY_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "plugin" },
  { match: /(aggregator|calendar|compiled|portal|hub)/i, value: "aggregator" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "enricher" },
  { match: /(framework|sdk|infra|standardize|family|families)/i, value: "framework" },
  { match: /(\bui\b|frontend|discovery|website|web app|webui|widget|embed)/i, value: "product_surface" },
  { match: /(scraper|crawler|connector|adapter)/i, value: "connector" }
];

export const PATTERN_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "cms_distribution_plugin" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "place_data_infrastructure" },
  { match: /(aggregator|compiled|calendar|events-hub|portal)/i, value: "local_multi_source_aggregator" },
  { match: /(framework|city-|infra|sdk|standardize|family|families)/i, value: "local_source_infra_framework" },
  { match: /(frontend|discovery|website|web app|webui|widget|embed)/i, value: "event_discovery_frontend" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "single_source_connector" }
];

export const MAIN_LAYER_RULES = [
  { match: /(plugin|wordpress)/i, value: "distribution_plugin" },
  { match: /(framework|infra|intake|source system|source systems|family|families|standardize)/i, value: "source_intake" },
  { match: /(place|maps|geo(code)?|venue|location)/i, value: "location_place_enrichment" },
  { match: /(scraper|fetch|crawler)/i, value: "access_fetch" },
  { match: /(parse|extract|json-ld|schema\.org)/i, value: "parsing_extraction" },
  { match: /(aggregator|calendar|feed|\bapi\b|\bical\b|\bics\b|json feed)/i, value: "export_feed_api" },
  { match: /(frontend|discovery|website|web app|webui|widget|embed)/i, value: "ui_discovery_surface" }
];

export const GAP_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "wordpress_plugin_distribution" },
  { match: /(framework|infra|source system|source systems|family|families|standardize)/i, value: "source_systems_and_families" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "connector_families" },
  { match: /(place|maps|geo(code)?|venue|location|gastro)/i, value: "location_and_gastro_intelligence" },
  { match: /(aggregator|calendar|feed|\bapi\b|\bical\b|\bics\b|widget|embed)/i, value: "distribution_surfaces" },
  { match: /(frontend|discovery|website|web app|webui)/i, value: "frontend_and_surface_design" }
];

export const BUILD_RULES = [
  { match: /(wordpress|\bwp\b|wp-|plugin)/i, value: "adapt_pattern" },
  { match: /(place|maps|geo(code)?|location)/i, value: "borrow_optional" },
  { match: /(framework|infra|aggregator|calendar|feed|\bapi\b|family|families|source system)/i, value: "adapt_pattern" },
  { match: /(scraper|connector|adapter|crawler)/i, value: "adapt_pattern" }
];

export const PRIORITY_RULES = [
  { match: /(aggregator|framework|infra|plugin|\bapi\b|feed|source system|family|families)/i, value: "now" },
  { match: /(place|maps|location|frontend|discovery|website|webui)/i, value: "soon" },
  { match: /(scraper|connector|crawler)/i, value: "soon" }
];

export const DISCOVERY_STOPWORDS = new Set([
  "about",
  "adapter",
  "adapters",
  "analysis",
  "analyze",
  "another",
  "architecture",
  "architektur",
  "based",
  "become",
  "because",
  "between",
  "build",
  "candidate",
  "candidates",
  "clear",
  "compare",
  "core",
  "decision",
  "decisions",
  "eine",
  "einer",
  "einem",
  "einen",
  "dieses",
  "diese",
  "durch",
  "eventbaer",
  "eventbär",
  "external",
  "family",
  "families",
  "finden",
  "fokus",
  "fuer",
  "github",
  "help",
  "hier",
  "ihre",
  "ihren",
  "immer",
  "layer",
  "layers",
  "local",
  "logic",
  "loesung",
  "lösung",
  "mehr",
  "mehrere",
  "muster",
  "next",
  "nicht",
  "noch",
  "oder",
  "pattern",
  "patternpilot",
  "platform",
  "project",
  "quality",
  "question",
  "questions",
  "reference",
  "references",
  "repo",
  "repos",
  "review",
  "reviews",
  "schicht",
  "schon",
  "sein",
  "signal",
  "signals",
  "soll",
  "sollen",
  "source",
  "sources",
  "stage",
  "step",
  "steps",
  "ueber",
  "unter",
  "system",
  "systems",
  "target",
  "their",
  "these",
  "this",
  "through",
  "truth",
  "ung",
  "useful",
  "uses",
  "using",
  "werden",
  "welche",
  "weiter",
  "wird",
  "worker",
  "ziel",
  "zielprojekt"
]);

export const DISCOVERY_PROFILES = {
  focused: {
    label: "Focused",
    defaultLimit: 12,
    maxLimit: 20,
    perQuery: 8,
    queryBudget: 5,
    shortlistMultiplier: 1.5
  },
  balanced: {
    label: "Balanced",
    defaultLimit: 24,
    maxLimit: 40,
    perQuery: 12,
    queryBudget: 7,
    shortlistMultiplier: 2
  },
  expansive: {
    label: "Expansive",
    defaultLimit: 40,
    maxLimit: 75,
    perQuery: 15,
    queryBudget: 8,
    shortlistMultiplier: 2.25
  },
  max: {
    label: "Max",
    defaultLimit: 60,
    maxLimit: 100,
    perQuery: 18,
    queryBudget: 9,
    shortlistMultiplier: 2.5
  }
};

export const ANALYSIS_PROFILES = {
  balanced: {
    label: "Balanced",
    summary: "Architecture, opportunities and risks in one pass."
  },
  architecture: {
    label: "Architecture",
    summary: "Focus on worker layers, fit, and reusable architectural patterns."
  },
  sources: {
    label: "Sources",
    summary: "Focus on connector families, source systems and acquisition flow."
  },
  distribution: {
    label: "Distribution",
    summary: "Focus on APIs, feeds, plugins and discovery surfaces."
  },
  risk: {
    label: "Risk",
    summary: "Focus on lock-in, maintenance risk and weak dependency signals."
  }
};

export const ANALYSIS_DEPTHS = {
  quick: {
    label: "Quick",
    topItems: 5,
    includeRepoMatrix: false
  },
  standard: {
    label: "Standard",
    topItems: 10,
    includeRepoMatrix: true
  },
  deep: {
    label: "Deep",
    topItems: 20,
    includeRepoMatrix: true
  }
};

export const REPORT_VIEWS = {
  compact: {
    label: "Compact",
    candidateCount: 8,
    showQueries: false,
    showMatrix: false,
    showCoverage: true
  },
  standard: {
    label: "Standard",
    candidateCount: 16,
    showQueries: true,
    showMatrix: true,
    showCoverage: true
  },
  full: {
    label: "Full",
    candidateCount: 32,
    showQueries: true,
    showMatrix: true,
    showCoverage: true
  }
};

export function resolveDiscoveryProfile(profileName = "balanced", requestedLimit = null) {
  const profile = DISCOVERY_PROFILES[profileName] ?? DISCOVERY_PROFILES.balanced;
  const requested = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? requestedLimit
    : profile.defaultLimit;
  const limit = clamp(requested, 1, profile.maxLimit);

  return {
    id: Object.entries(DISCOVERY_PROFILES).find(([, value]) => value === profile)?.[0] ?? "balanced",
    ...profile,
    limit
  };
}

export function resolveAnalysisProfile(profileName = "balanced") {
  const profile = ANALYSIS_PROFILES[profileName] ?? ANALYSIS_PROFILES.balanced;
  return {
    id: Object.entries(ANALYSIS_PROFILES).find(([, value]) => value === profile)?.[0] ?? "balanced",
    ...profile
  };
}

export function resolveAnalysisDepth(depthName = "standard") {
  const depth = ANALYSIS_DEPTHS[depthName] ?? ANALYSIS_DEPTHS.standard;
  return {
    id: Object.entries(ANALYSIS_DEPTHS).find(([, value]) => value === depth)?.[0] ?? "standard",
    ...depth
  };
}

export function resolveReportView(viewName = "standard") {
  const view = REPORT_VIEWS[viewName] ?? REPORT_VIEWS.standard;
  return {
    id: Object.entries(REPORT_VIEWS).find(([, value]) => value === view)?.[0] ?? "standard",
    ...view
  };
}
