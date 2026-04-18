import path from "node:path";
import { DISCOVERY_STOPWORDS, resolveDiscoveryProfile } from "../constants.mjs";
import { uniqueStrings, safeReadText } from "../utils.mjs";
import { normalizeGithubUrl, loadQueueEntries } from "../queue.mjs";
import { resolveLandkartePath } from "../config.mjs";

export const DEFAULT_DISCOVERY_STRATEGY = {
  broadAnchorCount: 2,
  broadSignalCount: 1,
  broadMaxTerms: 3,
  archetypeAnchorCount: 1,
  archetypeSignalCount: 2,
  archetypeMaxTerms: 4,
  architectureAnchorCount: 1,
  architectureSignalCount: 2,
  architectureMaxTerms: 4,
  dependencyAnchorCount: 1,
  dependencySignalCount: 2,
  dependencyMaxTerms: 4,
  capabilityAnchorCount: 1,
  capabilitySignalCount: 2,
  capabilityMaxTerms: 4,
  manualAnchorCount: 1,
  manualMaxTerms: 4,
  negativeTermCount: 3,
  seedSignalSources: ["discoveryHints"],
  seedRepoFields: ["fullName", "name", "description", "homepage", "topics"],
  preferredQueryFamilies: ["broad", "archetype", "architecture", "dependency", "capability"],
  minSeedSignalHits: 2,
  minStrongSeedSignalHits: 1,
  defaultStrongSignals: [
    "api",
    "calendar",
    "connector",
    "crawler",
    "event",
    "feed",
    "gastro",
    "plugin",
    "scraper",
    "venue",
    "wordpress"
  ],
  defaultNegativeTerms: [
    "awesome",
    "boilerplate",
    "starter",
    "template",
    "tutorial"
  ]
};

const DISCOVERY_ARCHETYPE_RULES = [
  {
    id: "ingestion_connectors",
    label: "Ingestion connector patterns",
    matchTokens: ["connector", "adapter", "feed", "fetch", "ingest", "scraper", "crawler", "sync"],
    querySignals: ["connector", "adapter", "sync", "feed"]
  },
  {
    id: "structured_data_pipeline",
    label: "Structured data pipeline",
    matchTokens: ["schema", "normalize", "model", "entity", "taxonomy", "pipeline", "transform"],
    querySignals: ["schema", "model", "normalize", "pipeline"]
  },
  {
    id: "governance_review",
    label: "Governance and review",
    matchTokens: ["review", "audit", "quality", "validation", "governance", "dedupe", "queue"],
    querySignals: ["review", "quality", "validation", "governance"]
  },
  {
    id: "distribution_surface",
    label: "Distribution and API surface",
    matchTokens: ["api", "feed", "plugin", "widget", "embed", "frontend", "surface"],
    querySignals: ["api", "feed", "plugin", "embed"]
  }
];

function tokenizeDiscoveryText(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDiscoveryTerm(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeDiscoveryToken(token) {
  if (!token || token.length < 4) {
    return token;
  }
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("sses") || token.endsWith("ness")) {
    return token;
  }
  if (token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function extractDiscoveryKeywords(parts, limit = 10) {
  const counts = new Map();

  for (const part of parts) {
    for (const token of tokenizeDiscoveryText(part)) {
      if (
        token.length < 4 ||
        /^\d+$/.test(token) ||
        DISCOVERY_STOPWORDS.has(token)
      ) {
        continue;
      }
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([token]) => token);
}

function sanitizeDiscoverySignals(signals, limit = 4) {
  const deduped = [];
  const seen = new Set();

  for (const rawSignal of signals ?? []) {
    const normalized = normalizeDiscoveryTerm(rawSignal);
    if (!normalized || normalized.length < 4) {
      continue;
    }
    const tokens = extractSearchQueryTokens([normalized], 6);
    if (tokens.length === 0) {
      continue;
    }
    if (tokens.length === 1 && DISCOVERY_STOPWORDS.has(tokens[0])) {
      continue;
    }
    const filteredTokens = tokens.filter((token) => !DISCOVERY_STOPWORDS.has(token));
    const effectiveTokens = filteredTokens.length > 0 ? filteredTokens : tokens;
    const signal = effectiveTokens.slice(0, 2).join(" ");
    if (!signal || signal.length < 4) {
      continue;
    }
    const canonical = signal.includes(" ")
      ? signal
      : signal.replace(/s$/, "");
    if (seen.has(canonical)) {
      continue;
    }
    seen.add(canonical);
    deduped.push(signal);
  }

  return deduped.slice(0, limit);
}

function buildCanonicalDiscoverySet(parts) {
  return new Set(
    extractSearchQueryTokens(parts, 80).map((token) => token.toLowerCase())
  );
}

function extractManualDiscoveryTerms(value, limit = 4) {
  return uniqueStrings(
    tokenizeDiscoveryText(value)
      .map((token) => singularizeDiscoveryToken(token))
      .filter((token) => token.length >= 3)
  ).slice(0, limit);
}

function extractSearchQueryTokens(parts, limit = 4) {
  return uniqueStrings(
    parts
      .flatMap((part) => tokenizeDiscoveryText(part))
      .map((token) => singularizeDiscoveryToken(token))
      .filter(Boolean)
  ).slice(0, limit);
}

function toFiniteNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveDiscoveryStrategy(binding = {}) {
  const input = binding.discoveryStrategy ?? {};
  const strategy = {
    ...DEFAULT_DISCOVERY_STRATEGY,
    ...input
  };

  for (const key of [
    "broadAnchorCount",
    "broadSignalCount",
    "broadMaxTerms",
    "archetypeAnchorCount",
    "archetypeSignalCount",
    "archetypeMaxTerms",
    "architectureAnchorCount",
    "architectureSignalCount",
    "architectureMaxTerms",
    "dependencyAnchorCount",
    "dependencySignalCount",
    "dependencyMaxTerms",
    "capabilityAnchorCount",
    "capabilitySignalCount",
    "capabilityMaxTerms",
    "manualAnchorCount",
    "manualMaxTerms",
    "negativeTermCount",
    "minSeedSignalHits",
    "minStrongSeedSignalHits"
  ]) {
    const parsed = toFiniteNumber(strategy[key]);
    strategy[key] = parsed == null ? DEFAULT_DISCOVERY_STRATEGY[key] : Math.max(0, Math.round(parsed));
  }

  strategy.seedSignalSources = uniqueStrings(
    (Array.isArray(strategy.seedSignalSources) ? strategy.seedSignalSources : DEFAULT_DISCOVERY_STRATEGY.seedSignalSources)
      .map((item) => normalizeDiscoveryTerm(item))
      .filter(Boolean)
  );
  strategy.seedRepoFields = uniqueStrings(
    (Array.isArray(strategy.seedRepoFields) ? strategy.seedRepoFields : DEFAULT_DISCOVERY_STRATEGY.seedRepoFields)
      .map((item) => String(item).trim())
      .filter(Boolean)
  );
  strategy.defaultStrongSignals = uniqueStrings(
    (Array.isArray(strategy.defaultStrongSignals) ? strategy.defaultStrongSignals : DEFAULT_DISCOVERY_STRATEGY.defaultStrongSignals)
      .map((item) => normalizeDiscoveryTerm(item))
      .filter(Boolean)
  );
  strategy.defaultNegativeTerms = uniqueStrings(
    (Array.isArray(strategy.defaultNegativeTerms) ? strategy.defaultNegativeTerms : DEFAULT_DISCOVERY_STRATEGY.defaultNegativeTerms)
      .map((item) => normalizeDiscoveryTerm(item))
      .filter(Boolean)
  );
  strategy.preferredQueryFamilies = uniqueStrings(
    (Array.isArray(strategy.preferredQueryFamilies) ? strategy.preferredQueryFamilies : DEFAULT_DISCOVERY_STRATEGY.preferredQueryFamilies)
      .map((item) => normalizeDiscoveryTerm(item))
      .filter(Boolean)
  );

  return strategy;
}

function buildDiscoveryQueryString(terms, options = {}) {
  const queryTerms = extractSearchQueryTokens(
    terms
      .map((term) => normalizeDiscoveryTerm(term))
      .filter((term) => term && term.length >= 3),
    options.maxTerms ?? 4
  );

  if (queryTerms.length === 0) {
    return null;
  }

  const negativeTerms = extractSearchQueryTokens(
    (options.negativeTerms ?? []).map((term) => normalizeDiscoveryTerm(term)),
    options.maxNegativeTerms ?? 3
  );
  const qualifiers = [
    ...negativeTerms.map((term) => `-${term}`),
    ...(options.qualifiers ?? ["archived:false", "fork:false", "stars:>=3"])
  ];

  return `${queryTerms.join(" ")} ${qualifiers.join(" ")}`.trim();
}

function inferProjectArchetypes(signalParts) {
  const canonicalSignals = buildCanonicalDiscoverySet(signalParts);
  return DISCOVERY_ARCHETYPE_RULES
    .map((rule) => {
      const score = rule.matchTokens.reduce((total, token) => total + (canonicalSignals.has(token) ? 1 : 0), 0);
      return {
        ...rule,
        score
      };
    })
    .filter((rule) => rule.score >= 2)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, 2);
}

function buildCapabilityPriority(capability, canonicalSignals) {
  const normalizedSignals = extractSearchQueryTokens(capability.signals ?? [], 12);
  const overlap = normalizedSignals.filter((signal) => canonicalSignals.has(signal)).length;
  return overlap * 10 + normalizedSignals.length;
}

function buildFamilyPriority(family, strategy) {
  const preferredIndex = strategy.preferredQueryFamilies.indexOf(family);
  return preferredIndex === -1
    ? 10
    : Math.max(100 - preferredIndex * 10, 20);
}

export function buildDiscoveryPlan(binding, alignmentRules, projectProfile, options = {}) {
  const discoveryStrategy = resolveDiscoveryStrategy(binding);
  const discoveryProfile = resolveDiscoveryProfile(options.discoveryProfile, options.limit);
  const manifestSignals = projectProfile?.manifestSignals ?? {};
  const architectureSignals = projectProfile?.architectureSignals ?? {};
  const profileSignals = projectProfile?.discoverySignals ?? [];
  const corpusParts = [
    binding.projectLabel,
    binding.projectKey,
    ...(binding.targetCapabilities ?? []),
    ...(binding.analysisQuestions ?? []),
    ...(binding.discoveryHints ?? []),
    ...(manifestSignals.packageNames ?? []),
    ...(manifestSignals.descriptions ?? []),
    ...(manifestSignals.keywords ?? []),
    ...(manifestSignals.dependencySignals ?? []),
    ...(manifestSignals.scriptSignals ?? []),
    ...(architectureSignals.directorySignals ?? []),
    ...(architectureSignals.extensionHints ?? []),
    ...profileSignals,
    projectProfile?.corpus ?? ""
  ];
  const domainKeywords = extractDiscoveryKeywords(corpusParts, 10);
  const canonicalSignals = buildCanonicalDiscoverySet([
    ...corpusParts,
    ...(alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? [])
  ]);
  const discoveryAnchors = uniqueStrings([
    ...sanitizeDiscoverySignals(binding.discoveryHints ?? [], 6),
    ...sanitizeDiscoverySignals(profileSignals, 8),
    ...sanitizeDiscoverySignals(manifestSignals.packageNames ?? [], 4),
    ...sanitizeDiscoverySignals(manifestSignals.keywords ?? [], 6),
    ...domainKeywords.slice(0, 4)
  ]);
  const broadSignals = sanitizeDiscoverySignals(
    [
      ...(alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? []),
      ...(manifestSignals.dependencySignals ?? []).slice(0, 8),
      ...(architectureSignals.directorySignals ?? []).slice(0, 8)
    ],
    8
  );
  const architectureSignalPool = sanitizeDiscoverySignals([
    ...(architectureSignals.directorySignals ?? []),
    ...(alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? []).slice(0, 6)
  ], 10);
  const dependencySignalPool = sanitizeDiscoverySignals([
    ...(manifestSignals.dependencySignals ?? []),
    ...(manifestSignals.scriptSignals ?? []),
    ...(manifestSignals.keywords ?? []).slice(0, 6)
  ], 10);
  const inferredArchetypes = inferProjectArchetypes([
    ...domainKeywords,
    ...profileSignals,
    ...(manifestSignals.keywords ?? []),
    ...(manifestSignals.dependencySignals ?? []),
    ...(architectureSignals.directorySignals ?? []),
    ...(binding.discoveryHints ?? [])
  ]);
  const negativeTerms = sanitizeDiscoverySignals([
    ...(binding.discoveryStrategy?.defaultNegativeTerms ?? []),
    ...discoveryStrategy.defaultNegativeTerms
  ], discoveryStrategy.negativeTermCount);
  const broadTerms = uniqueStrings([
    ...discoveryAnchors.slice(0, discoveryStrategy.broadAnchorCount),
    ...broadSignals.slice(0, discoveryStrategy.broadSignalCount)
  ]);
  const plans = [];
  let manualPlan = null;

  const addPlan = (plan) => {
    if (!plan.query) {
      return;
    }
    if (plans.some((item) => item.query === plan.query)) {
      return;
    }
    plans.push(plan);
  };

  addPlan({
    id: "broad-project-scan",
    label: "Broad project scan",
    family: "broad",
    priority: buildFamilyPriority("broad", discoveryStrategy),
    capabilityId: null,
    query: buildDiscoveryQueryString(broadTerms, {
      maxTerms: discoveryStrategy.broadMaxTerms,
      negativeTerms,
      maxNegativeTerms: discoveryStrategy.negativeTermCount
    }),
    terms: broadTerms,
    reasons: ["Project-wide query built from recurring project keywords and discovery hints."]
  });

  for (const archetype of inferredArchetypes) {
    const archetypeTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, discoveryStrategy.archetypeAnchorCount),
      ...sanitizeDiscoverySignals(archetype.querySignals, discoveryStrategy.archetypeSignalCount)
    ]);
    addPlan({
      id: `archetype-${archetype.id}`,
      label: archetype.label,
      family: "archetype",
      priority: buildFamilyPriority("archetype", discoveryStrategy) + archetype.score,
      capabilityId: null,
      query: buildDiscoveryQueryString(archetypeTerms, {
        maxTerms: discoveryStrategy.archetypeMaxTerms,
        negativeTerms,
        maxNegativeTerms: discoveryStrategy.negativeTermCount
      }),
      terms: archetypeTerms,
      reasons: [
        `Targets inferred project archetype '${archetype.label}'.`,
        `Matched signals: ${archetype.matchTokens.filter((token) => canonicalSignals.has(token)).join(", ")}.`
      ]
    });
  }

  const architectureTerms = uniqueStrings([
    ...discoveryAnchors.slice(0, discoveryStrategy.architectureAnchorCount),
    ...architectureSignalPool.slice(0, discoveryStrategy.architectureSignalCount)
  ]);
  addPlan({
    id: "architecture-patterns",
    label: "Architecture and layer patterns",
    family: "architecture",
    priority: buildFamilyPriority("architecture", discoveryStrategy),
    capabilityId: null,
    query: buildDiscoveryQueryString(architectureTerms, {
      maxTerms: discoveryStrategy.architectureMaxTerms,
      negativeTerms,
      maxNegativeTerms: discoveryStrategy.negativeTermCount
    }),
    terms: architectureTerms,
    reasons: [
      "Targets likely layer and architecture patterns derived from directories and scripts.",
      architectureSignalPool.length > 0
        ? `Signals: ${architectureSignalPool.slice(0, 4).join(", ")}.`
        : "No explicit architecture signals were extracted."
    ]
  });

  const dependencyTerms = uniqueStrings([
    ...discoveryAnchors.slice(0, discoveryStrategy.dependencyAnchorCount),
    ...dependencySignalPool.slice(0, discoveryStrategy.dependencySignalCount)
  ]);
  addPlan({
    id: "dependency-neighbors",
    label: "Dependency and tooling neighbors",
    family: "dependency",
    priority: buildFamilyPriority("dependency", discoveryStrategy),
    capabilityId: null,
    query: buildDiscoveryQueryString(dependencyTerms, {
      maxTerms: discoveryStrategy.dependencyMaxTerms,
      negativeTerms,
      maxNegativeTerms: discoveryStrategy.negativeTermCount
    }),
    terms: dependencyTerms,
    reasons: [
      "Targets repos that share important dependencies, tooling or workflow scripts.",
      dependencySignalPool.length > 0
        ? `Signals: ${dependencySignalPool.slice(0, 4).join(", ")}.`
        : "No dependency signals were extracted."
    ]
  });

  if (options.query) {
    const manualTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, discoveryStrategy.manualAnchorCount),
      ...extractManualDiscoveryTerms(options.query, 4)
    ]);
    manualPlan = {
      id: "manual-query",
      label: "Manual query boost",
      family: "manual",
      priority: 999,
      capabilityId: null,
      query: buildDiscoveryQueryString(manualTerms, {
        maxTerms: discoveryStrategy.manualMaxTerms,
        negativeTerms,
        maxNegativeTerms: discoveryStrategy.negativeTermCount
      }),
      terms: manualTerms,
      reasons: ["Extended by explicit --query input."]
    };
    addPlan(manualPlan);
  }

  const capabilityPlans = (alignmentRules?.capabilities ?? [])
    .map((capability) => {
    const capabilitySignals = sanitizeDiscoverySignals(capability.signals ?? [], 4);
    const capabilityTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, discoveryStrategy.capabilityAnchorCount),
      ...capabilitySignals.slice(0, discoveryStrategy.capabilitySignalCount)
    ]);

      return {
      id: `capability-${capability.id}`,
      label: capability.label ?? capability.id,
      family: "capability",
      priority: buildFamilyPriority("capability", discoveryStrategy) + buildCapabilityPriority(capability, canonicalSignals),
      capabilityId: capability.id,
      query: buildDiscoveryQueryString(capabilityTerms, {
        maxTerms: discoveryStrategy.capabilityMaxTerms,
        negativeTerms,
        maxNegativeTerms: discoveryStrategy.negativeTermCount
      }),
      terms: capabilityTerms,
      reasons: [
        `Targets capability '${capability.label ?? capability.id}'.`,
        capabilitySignals.length > 0
          ? `Signals: ${capabilitySignals.join(", ")}.`
          : "No explicit signals configured."
      ]
      };
    })
    .sort((left, right) => right.priority - left.priority);

  for (const capabilityPlan of capabilityPlans) {
    addPlan(capabilityPlan);
  }

  const planned = [...plans]
    .sort((left, right) => {
      if ((right.priority ?? 0) !== (left.priority ?? 0)) {
        return (right.priority ?? 0) - (left.priority ?? 0);
      }
      return left.label.localeCompare(right.label);
    })
    .slice(0, discoveryProfile.queryBudget);
  if (manualPlan?.query && !planned.some((plan) => plan.id === manualPlan.id)) {
    return {
      projectKey: binding.projectKey,
      domainKeywords,
      inferredArchetypes,
      discoveryProfile,
      discoveryStrategy,
      plans: [
        ...planned.slice(0, Math.max(discoveryProfile.queryBudget - 1, 0)),
        manualPlan
      ]
    };
  }

  return {
    projectKey: binding.projectKey,
    domainKeywords,
    inferredArchetypes,
    discoveryStrategy,
    discoveryProfile,
    plans: planned
  };
}

export async function loadWatchlistUrls(rootDir, project) {
  if (!project.watchlistFile) {
    return [];
  }
  const content = await safeReadText(path.join(rootDir, project.watchlistFile));
  if (!content) {
    return [];
  }
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      try {
        return normalizeGithubUrl(line).normalizedRepoUrl;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

export async function loadKnownRepoUrls(rootDir, config, project) {
  const known = new Set();
  const landkarteRaw = await safeReadText(resolveLandkartePath(rootDir, config));
  if (landkarteRaw) {
    const matches = landkarteRaw.match(/https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+/g) ?? [];
    for (const match of matches) {
      try {
        known.add(normalizeGithubUrl(match).normalizedRepoUrl);
      } catch {
        // ignore malformed matches
      }
    }
  }

  for (const row of await loadQueueEntries(rootDir, config)) {
    if (row.normalized_repo_url) {
      known.add(row.normalized_repo_url);
    } else if (row.repo_url) {
      known.add(row.repo_url);
    }
  }

  for (const url of await loadWatchlistUrls(rootDir, project)) {
    known.add(url);
  }

  return known;
}
