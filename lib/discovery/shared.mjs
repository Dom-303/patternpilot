import path from "node:path";
import { DISCOVERY_STOPWORDS, resolveDiscoveryProfile } from "../constants.mjs";
import { uniqueStrings, safeReadText } from "../utils.mjs";
import { normalizeGithubUrl, loadQueueEntries } from "../queue.mjs";
import { resolveLandkartePath } from "../config.mjs";

export const DEFAULT_DISCOVERY_STRATEGY = {
  broadAnchorCount: 2,
  broadSignalCount: 1,
  broadMaxTerms: 3,
  signalLaneAnchorCount: 1,
  signalLaneSignalCount: 2,
  signalLaneMaxTerms: 4,
  signalLaneLimit: 3,
  signalLaneMinResults: 4,
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
  capabilityLaneAnchorCount: 2,
  capabilityLaneSignalCount: 2,
  capabilityLaneMaxTerms: 4,
  capabilityFallbackBudgetFloor: 8,
  capabilityLaneMinResults: 4,
  manualAnchorCount: 1,
  manualMaxTerms: 4,
  negativeTermCount: 3,
  architectureGroundingMinScore: 4,
  dependencyGroundingMinScore: 5,
  capabilityGroundingMinScore: 4,
  prioritySignalLaneIds: ["public_event_intake", "adapter_family", "normalization_schema"],
  seedSignalSources: ["discoveryHints"],
  seedRepoFields: ["fullName", "name", "description", "homepage", "topics"],
  preferredQueryFamilies: ["signal_lane", "archetype", "architecture", "capability", "dependency", "broad"],
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
    id: "civic_public_event_intake",
    label: "Civic and public-event intake",
    matchTokens: ["municipal", "civic", "community", "agenda", "government", "public", "meeting", "event"],
    querySignals: ["municipal", "civic", "agenda", "community"]
  },
  {
    id: "structured_data_pipeline",
    label: "Structured data pipeline",
    matchTokens: ["schema", "normalize", "model", "entity", "taxonomy", "pipeline", "transform"],
    querySignals: ["schema", "model", "normalize", "pipeline"]
  },
  {
    id: "governed_normalization",
    label: "Governed normalization and QA",
    matchTokens: ["review", "audit", "quality", "validation", "governance", "dedupe", "contract", "masterlist", "csv", "xlsx"],
    querySignals: ["review", "validation", "governance", "masterlist"]
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

const DISCOVERY_SIGNAL_LANES = [
  {
    id: "public_event_intake",
    label: "Public-event intake signals",
    capabilityIds: ["ingestion"],
    matchTokens: ["public", "event", "municipal", "civic", "community", "agenda", "calendar"],
    querySignals: ["public event", "municipal", "civic", "agenda"],
    capabilitySignalHints: ["scraper", "crawler", "source", "feed", "extract"]
  },
  {
    id: "adapter_family",
    label: "Adapter family signals",
    capabilityIds: ["ingestion"],
    matchTokens: ["adapter", "connector", "crawler", "scraper", "feed", "source"],
    querySignals: ["adapter", "connector", "source family", "feed"],
    capabilitySignalHints: ["adapter", "connector", "source", "feed", "sync"]
  },
  {
    id: "governance_review",
    label: "Governance and review signals",
    capabilityIds: ["quality_governance"],
    matchTokens: ["governance", "review", "audit", "validation", "policy", "dedupe"],
    querySignals: ["governance", "review workflow", "validation", "dedupe"],
    capabilitySignalHints: ["review", "audit", "validation", "dedupe", "policy"]
  },
  {
    id: "normalization_schema",
    label: "Normalization and schema signals",
    capabilityIds: ["data_model"],
    matchTokens: ["normalize", "normalization", "schema", "taxonomy", "entity", "masterlist", "csv", "xlsx"],
    querySignals: ["normalize", "schema", "masterlist", "taxonomy"],
    capabilitySignalHints: ["normalize", "schema", "entity", "taxonomy", "masterlist"]
  }
];

const DISCOVERY_GENERIC_QUERY_TERMS = new Set([
  "data",
  "first",
  "open",
  "python",
  "web"
]);

const DEPENDENCY_CORE_TOKENS = new Set([
  "adapter",
  "agenda",
  "audit",
  "calendar",
  "civic",
  "community",
  "connector",
  "crawler",
  "csv",
  "dedupe",
  "event",
  "extract",
  "feed",
  "governance",
  "intake",
  "masterlist",
  "municipal",
  "normalize",
  "normalization",
  "parser",
  "public",
  "review",
  "schema",
  "scrape",
  "scraper",
  "source",
  "taxonomy",
  "validation"
]);

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
    const filteredTokens = tokens.filter((token) => !DISCOVERY_STOPWORDS.has(token) && !DISCOVERY_GENERIC_QUERY_TERMS.has(token));
    if (filteredTokens.length === 0) {
      continue;
    }
    const effectiveTokens = filteredTokens;
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

function filterNegativeDiscoveryTerms(terms, protectedParts, limit = 3) {
  const protectedTokens = buildCanonicalDiscoverySet(protectedParts);

  return sanitizeDiscoverySignals(terms, Math.max(limit * 3, limit))
    .filter((term) => {
      const termTokens = extractSearchQueryTokens([term], 6);
      return termTokens.every((token) => !protectedTokens.has(token));
    })
    .slice(0, limit);
}

function buildCanonicalDiscoverySet(parts) {
  return new Set(
    extractSearchQueryTokens(parts, 80).map((token) => token.toLowerCase())
  );
}

function extractBenchmarkRepoName(repo) {
  const normalized = String(repo ?? "").trim().replace(/^\/+|\/+$/g, "");
  const parts = normalized.split("/");
  return parts[parts.length - 1] ?? normalized;
}

function normalizeBenchmarkPhrase(value) {
  return String(value ?? "")
    .replace(/[-_/]+/g, " ")
    .trim();
}

function normalizeDiscoveryRepoRef(value) {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function extractDiscoveryRepoOwner(repo) {
  const normalized = normalizeDiscoveryRepoRef(repo);
  const [owner] = normalized.split("/", 2);
  return String(owner ?? "").trim().toLowerCase();
}

function buildSeedOwnerQualifiers(entries = []) {
  const qualifiers = [];
  const seen = new Set();

  for (const entry of entries) {
    const owner = String(extractDiscoveryRepoOwner(entry?.repo) ?? "").trim().toLowerCase();
    if (!owner || seen.has(owner)) {
      continue;
    }
    seen.add(owner);
    qualifiers.push({
      owner,
      orgQualifier: `org:${owner}`,
      userQualifier: `user:${owner}`
    });
  }

  return qualifiers;
}

function buildBenchmarkDiscoveryContext(benchmark) {
  if (!benchmark || typeof benchmark !== "object") {
    return null;
  }

  const positiveEntries = Array.isArray(benchmark.positiveRepos) ? benchmark.positiveRepos : [];
  const negativeEntries = Array.isArray(benchmark.negativeRepos) ? benchmark.negativeRepos : [];
  const boundaryEntries = Array.isArray(benchmark.boundaryRepos) ? benchmark.boundaryRepos : [];
  const positiveParts = positiveEntries.flatMap((entry) => [
    normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo)),
    normalizeBenchmarkPhrase(entry?.why)
  ]);
  const negativeParts = negativeEntries.flatMap((entry) => [
    normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo)),
    normalizeBenchmarkPhrase(entry?.why)
  ]);
  const boundaryParts = boundaryEntries.flatMap((entry) => [
    normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo)),
    normalizeBenchmarkPhrase(entry?.why)
  ]);
  const preferredLanes = inferSignalLanes(positiveParts, 4);

  return {
    positiveParts,
    negativeParts,
    boundaryParts,
    positiveAnchors: sanitizeDiscoverySignals([
      ...positiveEntries.map((entry) => entry?.why),
      ...positiveEntries.map((entry) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo)))
    ], 8),
    positiveSignals: sanitizeDiscoverySignals([
      ...positiveEntries.map((entry) => entry?.why),
      ...positiveEntries.map((entry) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo))),
      ...boundaryEntries.map((entry) => entry?.why)
    ], 10),
    negativeTerms: sanitizeDiscoverySignals([
      ...negativeEntries.map((entry) => entry?.why),
      ...negativeEntries.map((entry) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo)))
    ], 8),
    preferredLaneIds: preferredLanes.map((lane) => lane.id),
    preferredLanes
  };
}

function buildSeedDiscoveryContext(discoverySeeds) {
  if (!discoverySeeds || typeof discoverySeeds !== "object") {
    return null;
  }

  const priorityEntries = Array.isArray(discoverySeeds.priorityRepos) ? discoverySeeds.priorityRepos : [];
  const referenceEntries = Array.isArray(discoverySeeds.referenceRepos) ? discoverySeeds.referenceRepos : [];
  const priorityCohorts = Array.isArray(discoverySeeds.priorityCohorts) ? discoverySeeds.priorityCohorts : [];
  const referenceCohorts = Array.isArray(discoverySeeds.referenceCohorts) ? discoverySeeds.referenceCohorts : [];
  const positiveRepoRefs = new Set(priorityEntries.map((entry) => normalizeDiscoveryRepoRef(entry?.repo)).filter(Boolean));
  const referenceRepoRefs = new Set(referenceEntries.map((entry) => normalizeDiscoveryRepoRef(entry?.repo)).filter(Boolean));
  const negativeEntries = (Array.isArray(discoverySeeds.negativeRepos) ? discoverySeeds.negativeRepos : [])
    .filter((entry) => {
      const repoRef = normalizeDiscoveryRepoRef(entry?.repo);
      if (!repoRef) {
        return false;
      }
      return !positiveRepoRefs.has(repoRef) && !referenceRepoRefs.has(repoRef);
    });
  if (
    priorityEntries.length === 0
    && referenceEntries.length === 0
    && priorityCohorts.length === 0
    && referenceCohorts.length === 0
    && negativeEntries.length === 0
  ) {
    return null;
  }

  const ownerAnchors = sanitizeDiscoverySignals([
    ...priorityEntries.map((entry) => extractDiscoveryRepoOwner(entry?.repo)),
    ...referenceEntries.map((entry) => extractDiscoveryRepoOwner(entry?.repo)),
    ...priorityCohorts.flatMap((cohort) => Array.isArray(cohort?.owners) ? cohort.owners : []),
    ...referenceCohorts.flatMap((cohort) => Array.isArray(cohort?.owners) ? cohort.owners : [])
  ], 6);
  const familySignals = sanitizeDiscoverySignals([
    ...priorityEntries.flatMap((entry) => Array.isArray(entry?.topics) ? entry.topics : []),
    ...priorityEntries.map((entry) => entry?.description),
    ...priorityEntries.map((entry) => entry?.why),
    ...referenceEntries.flatMap((entry) => Array.isArray(entry?.topics) ? entry.topics : []),
    ...referenceEntries.map((entry) => entry?.description),
    ...referenceEntries.map((entry) => entry?.why),
    ...priorityCohorts.flatMap((cohort) => Array.isArray(cohort?.signals) ? cohort.signals : []),
    ...priorityCohorts.flatMap((cohort) => Array.isArray(cohort?.boundarySignals) ? cohort.boundarySignals : []),
    ...priorityCohorts.map((cohort) => cohort?.why),
    ...referenceCohorts.flatMap((cohort) => Array.isArray(cohort?.signals) ? cohort.signals : []),
    ...referenceCohorts.flatMap((cohort) => Array.isArray(cohort?.boundarySignals) ? cohort.boundarySignals : []),
    ...referenceCohorts.map((cohort) => cohort?.why)
  ], 12);

  const positiveParts = priorityEntries.flatMap((entry) => [
    normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo)),
    normalizeBenchmarkPhrase(entry?.description),
    normalizeBenchmarkPhrase(entry?.why),
    ...(Array.isArray(entry?.topics) ? entry.topics.map((topic) => normalizeBenchmarkPhrase(topic)) : [])
  ]).concat(
    priorityCohorts.flatMap((cohort) => [
      normalizeBenchmarkPhrase(cohort?.label ?? cohort?.id),
      normalizeBenchmarkPhrase(cohort?.description),
      normalizeBenchmarkPhrase(cohort?.why),
      ...(Array.isArray(cohort?.owners) ? cohort.owners.map((owner) => normalizeBenchmarkPhrase(owner)) : []),
      ...(Array.isArray(cohort?.repoRefs) ? cohort.repoRefs.map((repo) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(repo))) : []),
      ...(Array.isArray(cohort?.signals) ? cohort.signals.map((signal) => normalizeBenchmarkPhrase(signal)) : []),
      ...(Array.isArray(cohort?.boundarySignals) ? cohort.boundarySignals.map((signal) => normalizeBenchmarkPhrase(signal)) : [])
    ])
  );
  const boundaryParts = referenceEntries.flatMap((entry) => [
    normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo)),
    normalizeBenchmarkPhrase(entry?.description),
    normalizeBenchmarkPhrase(entry?.why),
    ...(Array.isArray(entry?.topics) ? entry.topics.map((topic) => normalizeBenchmarkPhrase(topic)) : [])
  ]).concat(
    referenceCohorts.flatMap((cohort) => [
      normalizeBenchmarkPhrase(cohort?.label ?? cohort?.id),
      normalizeBenchmarkPhrase(cohort?.description),
      normalizeBenchmarkPhrase(cohort?.why),
      ...(Array.isArray(cohort?.owners) ? cohort.owners.map((owner) => normalizeBenchmarkPhrase(owner)) : []),
      ...(Array.isArray(cohort?.repoRefs) ? cohort.repoRefs.map((repo) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(repo))) : []),
      ...(Array.isArray(cohort?.signals) ? cohort.signals.map((signal) => normalizeBenchmarkPhrase(signal)) : []),
      ...(Array.isArray(cohort?.boundarySignals) ? cohort.boundarySignals.map((signal) => normalizeBenchmarkPhrase(signal)) : [])
    ])
  );
  const negativeParts = negativeEntries.flatMap((entry) => [
    normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo)),
    normalizeBenchmarkPhrase(entry?.description),
    normalizeBenchmarkPhrase(entry?.why),
    ...(Array.isArray(entry?.topics) ? entry.topics.map((topic) => normalizeBenchmarkPhrase(topic)) : [])
  ]);
  const preferredLanes = inferSignalLanes([...positiveParts, ...boundaryParts], 4);
  const ownerQualifiers = uniqueStrings([
    ...buildSeedOwnerQualifiers(priorityEntries).map((item) => item.owner),
    ...priorityCohorts.flatMap((cohort) => Array.isArray(cohort?.owners) ? cohort.owners : [])
  ]).map((owner) => ({
    owner,
    orgQualifier: `org:${owner}`,
    userQualifier: `user:${owner}`
  }));

  return {
    priorityCohorts,
    referenceCohorts,
    positiveParts,
    boundaryParts,
    negativeParts,
    ownerAnchors,
    familySignals,
    positiveAnchors: sanitizeDiscoverySignals([
      ...priorityEntries.map((entry) => entry?.why),
      ...priorityEntries.map((entry) => entry?.description),
      ...priorityEntries.flatMap((entry) => Array.isArray(entry?.topics) ? entry.topics : []),
      ...priorityEntries.map((entry) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo))),
      ...priorityCohorts.map((cohort) => cohort?.label ?? cohort?.id),
      ...priorityCohorts.map((cohort) => cohort?.why),
      ...priorityCohorts.flatMap((cohort) => Array.isArray(cohort?.signals) ? cohort.signals : [])
    ], 10),
    positiveSignals: sanitizeDiscoverySignals([
      ...priorityEntries.map((entry) => entry?.why),
      ...priorityEntries.map((entry) => entry?.description),
      ...priorityEntries.flatMap((entry) => Array.isArray(entry?.topics) ? entry.topics : []),
      ...referenceEntries.map((entry) => entry?.why),
      ...referenceEntries.map((entry) => entry?.description),
      ...referenceEntries.flatMap((entry) => Array.isArray(entry?.topics) ? entry.topics : []),
      ...priorityEntries.map((entry) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo))),
      ...referenceEntries.map((entry) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo))),
      ...priorityCohorts.map((cohort) => cohort?.label ?? cohort?.id),
      ...priorityCohorts.map((cohort) => cohort?.why),
      ...priorityCohorts.flatMap((cohort) => Array.isArray(cohort?.signals) ? cohort.signals : []),
      ...priorityCohorts.flatMap((cohort) => Array.isArray(cohort?.boundarySignals) ? cohort.boundarySignals : []),
      ...referenceCohorts.map((cohort) => cohort?.label ?? cohort?.id),
      ...referenceCohorts.map((cohort) => cohort?.why),
      ...referenceCohorts.flatMap((cohort) => Array.isArray(cohort?.signals) ? cohort.signals : []),
      ...referenceCohorts.flatMap((cohort) => Array.isArray(cohort?.boundarySignals) ? cohort.boundarySignals : [])
    ], 12),
    negativeTerms: sanitizeDiscoverySignals([
      ...negativeEntries.map((entry) => entry?.why),
      ...negativeEntries.map((entry) => entry?.description),
      ...negativeEntries.flatMap((entry) => Array.isArray(entry?.topics) ? entry.topics : []),
      ...negativeEntries.map((entry) => normalizeBenchmarkPhrase(extractBenchmarkRepoName(entry?.repo))),
      ...priorityCohorts.flatMap((cohort) => Array.isArray(cohort?.antiSignals) ? cohort.antiSignals : []),
      ...referenceCohorts.flatMap((cohort) => Array.isArray(cohort?.antiSignals) ? cohort.antiSignals : [])
    ], 8),
    ownerQualifiers,
    preferredLaneIds: preferredLanes.map((lane) => lane.id),
    preferredLanes
  };
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
    "signalLaneAnchorCount",
    "signalLaneSignalCount",
    "signalLaneMaxTerms",
    "signalLaneLimit",
    "signalLaneMinResults",
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
    "capabilityLaneAnchorCount",
    "capabilityLaneSignalCount",
    "capabilityLaneMaxTerms",
    "capabilityFallbackBudgetFloor",
    "capabilityLaneMinResults",
    "manualAnchorCount",
    "manualMaxTerms",
    "negativeTermCount",
    "architectureGroundingMinScore",
    "dependencyGroundingMinScore",
    "capabilityGroundingMinScore",
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
  strategy.prioritySignalLaneIds = uniqueStrings(
    (Array.isArray(strategy.prioritySignalLaneIds) ? strategy.prioritySignalLaneIds : DEFAULT_DISCOVERY_STRATEGY.prioritySignalLaneIds)
      .map((item) => normalizeDiscoveryTerm(item).replace(/\s+/g, "_"))
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

  const qualifiers = [
    ...(options.qualifiers ?? ["archived:false", "fork:false", "stars:>=3"])
  ];
  const negativeQualifiers = extractSearchQueryTokens(
    (options.negativeTerms ?? [])
      .map((term) => normalizeDiscoveryTerm(term))
      .filter((term) => term && term.length >= 3),
    options.maxNegativeTerms ?? 3
  )
    .filter((term) => !queryTerms.includes(term))
    .map((term) => `-${term}`);

  return `${[...queryTerms, ...negativeQualifiers, ...qualifiers].join(" ")}`.trim();
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

function inferSignalLanes(signalParts, limit = 3) {
  const canonicalSignals = buildCanonicalDiscoverySet(signalParts);
  return DISCOVERY_SIGNAL_LANES
    .map((lane) => {
      const score = lane.matchTokens.reduce((total, token) => total + (canonicalSignals.has(token) ? 1 : 0), 0);
      return {
        ...lane,
        score
      };
    })
    .filter((lane) => lane.score >= 2)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.id.localeCompare(right.id);
    })
    .slice(0, limit);
}

function buildCapabilityPriority(capability, canonicalSignals) {
  const normalizedSignals = extractSearchQueryTokens(capability.signals ?? [], 12);
  const overlap = normalizedSignals.filter((signal) => canonicalSignals.has(signal)).length;
  return overlap * 10 + normalizedSignals.length;
}

function scoreDiscoverySignalGrounding(signals, canonicalSignals, groundingAnchors) {
  const normalizedSignals = sanitizeDiscoverySignals(signals, Math.max(signals?.length ?? 0, 4));
  const tokens = uniqueStrings(
    normalizedSignals.flatMap((signal) => extractSearchQueryTokens([signal], 6))
  );
  let score = 0;

  for (const token of tokens) {
    if (groundingAnchors.has(token)) {
      score += 5;
    }
    if (canonicalSignals.has(token)) {
      score += 3;
    }
    if (DISCOVERY_GENERIC_QUERY_TERMS.has(token)) {
      score -= 4;
    }
    if (token.length <= 4 && !groundingAnchors.has(token)) {
      score -= 1;
    }
  }

  return {
    score: Math.max(score, 0),
    matchedAnchors: tokens.filter((token) => groundingAnchors.has(token)),
    matchedCanonicalSignals: tokens.filter((token) => canonicalSignals.has(token))
  };
}

function rankSignalsByGrounding(signals, canonicalSignals, groundingAnchors) {
  return sanitizeDiscoverySignals(signals, Math.max(signals?.length ?? 0, 4))
    .map((signal) => ({
      signal,
      ...scoreDiscoverySignalGrounding([signal], canonicalSignals, groundingAnchors)
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.signal.localeCompare(right.signal);
    });
}

function isDependencySignalCoreGrounded(signal, canonicalSignals, groundingAnchors, benchmarkContext = null) {
  const tokens = extractSearchQueryTokens([signal], 6);
  if (tokens.length === 0) {
    return false;
  }

  const benchmarkTokens = buildCanonicalDiscoverySet([
    ...(benchmarkContext?.positiveAnchors ?? []),
    ...(benchmarkContext?.positiveSignals ?? [])
  ]);
  const hasCoreToken = tokens.some((token) => DEPENDENCY_CORE_TOKENS.has(token));
  const hasProjectGrounding = tokens.some((token) => canonicalSignals.has(token) || groundingAnchors.has(token));
  const hasBenchmarkGrounding = tokens.some((token) => benchmarkTokens.has(token));

  return hasCoreToken && (hasProjectGrounding || hasBenchmarkGrounding);
}

function buildFamilyPriority(family, strategy, feedback = null) {
  const preferredIndex = strategy.preferredQueryFamilies.indexOf(family);
  let priority = preferredIndex === -1
    ? 10
    : Math.max(100 - preferredIndex * 10, 20);
  const familyFeedback = feedback?.queryFamilyOutcomes?.find((item) => item.value === family);
  if (familyFeedback) {
    priority += familyFeedback.score * 5;
  }
  return priority;
}

function selectDiscoveryPlansWithQuotas(plans, strategy, budget) {
  const sortedPlans = [...plans].sort((left, right) => {
    if ((right.priority ?? 0) !== (left.priority ?? 0)) {
      return (right.priority ?? 0) - (left.priority ?? 0);
    }
    return left.label.localeCompare(right.label);
  });

  const selected = [];
  const selectedIds = new Set();
  const addPlan = (plan) => {
    if (!plan || selectedIds.has(plan.id) || selected.length >= budget) {
      return;
    }
    selected.push(plan);
    selectedIds.add(plan.id);
  };

  for (const plan of sortedPlans) {
    if (plan.guaranteedSlot) {
      addPlan(plan);
    }
  }

  for (const laneId of strategy.prioritySignalLaneIds ?? []) {
    addPlan(sortedPlans.find((plan) => plan.id === `signal-lane-${laneId}`));
  }

  for (const plan of sortedPlans) {
    addPlan(plan);
    if (selected.length >= budget) {
      break;
    }
  }

  return selected;
}

function buildDiscoveryQueryTerms(anchorTerms, signalTerms, anchorCount = 1, options = {}) {
  const normalizedSignals = sanitizeDiscoverySignals(signalTerms, Math.max(signalTerms.length || 0, 4));
  const normalizedAnchors = sanitizeDiscoverySignals(anchorTerms, Math.max(anchorCount, 2));
  const keepAnchors = options.preserveAnchors === true;
  const effectiveAnchors = !keepAnchors && normalizedSignals.length >= 2
    ? []
    : normalizedAnchors.slice(0, anchorCount);
  const combinedTerms = uniqueStrings([
    ...effectiveAnchors,
    ...normalizedSignals
  ]);

  if (!options.maxQueryTokens || combinedTerms.length === 0) {
    return combinedTerms;
  }

  const limitedTerms = [];
  let tokenCount = 0;
  for (const term of combinedTerms) {
    const termTokens = extractSearchQueryTokens([term], 6);
    if (limitedTerms.length > 0 && tokenCount + termTokens.length > options.maxQueryTokens) {
      continue;
    }
    limitedTerms.push(term);
    tokenCount += termTokens.length;
    if (tokenCount >= options.maxQueryTokens) {
      break;
    }
  }

  return limitedTerms.length > 0 ? limitedTerms : combinedTerms.slice(0, 1);
}

function laneSupportsCapability(capability, lane) {
  const explicitCapabilityIds = Array.isArray(lane?.capabilityIds) ? lane.capabilityIds : [];
  if (explicitCapabilityIds.includes(capability?.id)) {
    return true;
  }

  const capabilityTokens = buildCanonicalDiscoverySet([
    capability?.id,
    capability?.label,
    ...(capability?.signals ?? [])
  ]);
  const laneTokens = buildCanonicalDiscoverySet([
    ...(lane?.matchTokens ?? []),
    ...(lane?.querySignals ?? []),
    ...(lane?.capabilitySignalHints ?? [])
  ]);
  const overlap = [...capabilityTokens].filter((token) => laneTokens.has(token)).length;
  return overlap >= 2;
}

function buildCapabilityLaneSignalPool(capability, lane, canonicalSignals, groundingAnchors) {
  const laneTokens = buildCanonicalDiscoverySet([
    ...(lane?.matchTokens ?? []),
    ...(lane?.querySignals ?? []),
    ...(lane?.capabilitySignalHints ?? [])
  ]);
  const rankedCapabilitySignals = rankSignalsByGrounding(
    capability?.signals ?? [],
    canonicalSignals,
    groundingAnchors
  );

  const laneSpecificCapabilitySignals = rankedCapabilitySignals
    .filter((item) =>
      extractSearchQueryTokens([item.signal], 6).some((token) => laneTokens.has(token))
    )
    .map((item) => item.signal);

  return uniqueStrings([
    ...sanitizeDiscoverySignals(lane?.capabilitySignalHints ?? [], 4),
    ...sanitizeDiscoverySignals(lane?.querySignals ?? [], 4),
    ...laneSpecificCapabilitySignals
  ]);
}

function buildLaneFallbackQueries(anchorTerms, lane, signalPool, options = {}) {
  const laneSignals = sanitizeDiscoverySignals(lane?.querySignals ?? [], 4);
  const fallbackSignals = sanitizeDiscoverySignals(signalPool ?? [], 4);
  const fallbackTermGroups = [
    buildDiscoveryQueryTerms(
      laneSignals,
      fallbackSignals.slice(0, 2),
      1,
      { preserveAnchors: true, maxQueryTokens: options.maxTerms ?? 4 }
    ),
    buildDiscoveryQueryTerms(
      uniqueStrings([
        ...anchorTerms.slice(0, 1),
        ...laneSignals.slice(0, 2)
      ]),
      fallbackSignals.slice(0, 1),
      1,
      { preserveAnchors: true, maxQueryTokens: options.maxTerms ?? 4 }
    ),
    buildDiscoveryQueryTerms(
      laneSignals.slice(0, 2),
      fallbackSignals.slice(1, 3),
      1,
      { preserveAnchors: true, maxQueryTokens: options.maxTerms ?? 4 }
    )
  ];

  return uniqueStrings(
    fallbackTermGroups
      .map((terms) => buildDiscoveryQueryString(terms, {
        maxTerms: options.maxTerms ?? 4,
        negativeTerms: options.negativeTerms ?? [],
        maxNegativeTerms: options.maxNegativeTerms ?? 3
      }))
      .filter(Boolean)
  );
}

export function buildDiscoveryPlan(binding, alignmentRules, projectProfile, options = {}) {
  const discoveryStrategy = resolveDiscoveryStrategy(binding);
  const discoveryProfile = resolveDiscoveryProfile(options.discoveryProfile, options.limit);
  const discoveryFeedback = options.discoveryFeedback ?? null;
  const benchmarkContext = buildBenchmarkDiscoveryContext(options.discoveryBenchmark);
  const seedContext = buildSeedDiscoveryContext(options.discoverySeeds);
  const learnedPositiveParts = discoveryFeedback?.learnedCohorts?.positiveParts ?? [];
  const learnedNegativeParts = discoveryFeedback?.learnedCohorts?.negativeParts ?? [];
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
    ...learnedPositiveParts,
    ...(seedContext?.positiveParts ?? []),
    ...(benchmarkContext?.positiveParts ?? []),
    ...profileSignals,
    projectProfile?.corpus ?? ""
  ];
  const domainKeywords = extractDiscoveryKeywords(corpusParts, 10);
  const canonicalSignals = buildCanonicalDiscoverySet([
    ...corpusParts,
    ...(alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? [])
  ]);
  const coreDiscoveryAnchors = uniqueStrings([
    ...sanitizeDiscoverySignals(binding.discoveryHints ?? [], 6),
    ...sanitizeDiscoverySignals(profileSignals, 8),
    ...sanitizeDiscoverySignals(manifestSignals.packageNames ?? [], 4),
    ...sanitizeDiscoverySignals(manifestSignals.keywords ?? [], 6),
    ...domainKeywords.slice(0, 4)
  ]);
  const seedDiscoveryAnchors = seedContext?.positiveAnchors ?? [];
  const benchmarkDiscoveryAnchors = benchmarkContext?.positiveAnchors ?? [];
  const discoveryAnchors = uniqueStrings([
    ...coreDiscoveryAnchors,
    ...seedDiscoveryAnchors,
    ...benchmarkDiscoveryAnchors
  ]);
  const broadSignals = sanitizeDiscoverySignals(
    [
      ...learnedPositiveParts,
      ...(seedContext?.positiveSignals ?? []),
      ...(benchmarkContext?.positiveSignals ?? []),
      ...(alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? []),
      ...(manifestSignals.dependencySignals ?? []).slice(0, 8),
      ...(architectureSignals.directorySignals ?? []).slice(0, 8)
    ],
    8
  );
  const rawArchitectureSignals = sanitizeDiscoverySignals([
    ...(architectureSignals.directorySignals ?? []),
    ...(alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? []).slice(0, 6)
  ], 10);
  const rawDependencySignals = sanitizeDiscoverySignals([
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
    ...learnedPositiveParts,
    ...(seedContext?.positiveParts ?? []),
    ...(benchmarkContext?.positiveParts ?? []),
    ...(binding.discoveryHints ?? [])
  ]);
  const inferredSignalLanes = inferSignalLanes([
    ...domainKeywords,
    ...profileSignals,
    ...(manifestSignals.keywords ?? []),
    ...(manifestSignals.dependencySignals ?? []),
    ...(architectureSignals.directorySignals ?? []),
    ...learnedPositiveParts,
    ...(seedContext?.positiveParts ?? []),
    ...(benchmarkContext?.positiveParts ?? []),
    ...(binding.discoveryHints ?? []),
    ...(binding.analysisQuestions ?? []),
    ...(binding.targetCapabilities ?? [])
  ], discoveryStrategy.signalLaneLimit);
  const negativeTerms = filterNegativeDiscoveryTerms([
    ...learnedNegativeParts,
    ...(seedContext?.negativeTerms ?? []),
    ...(benchmarkContext?.negativeTerms ?? []),
    ...(binding.discoveryStrategy?.defaultNegativeTerms ?? []),
    ...discoveryStrategy.defaultNegativeTerms,
    ...(discoveryFeedback?.avoidTerms ?? [])
  ], [
    binding.projectLabel,
    binding.projectKey,
    ...(binding.discoveryHints ?? []),
    ...(binding.targetCapabilities ?? []),
    ...(binding.analysisQuestions ?? []),
    ...domainKeywords,
    ...(seedContext?.positiveAnchors ?? []),
    ...(seedContext?.positiveSignals ?? []),
    ...(benchmarkContext?.positiveAnchors ?? []),
    ...(benchmarkContext?.positiveSignals ?? []),
    ...(alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? []),
    ...discoveryStrategy.defaultStrongSignals
  ], discoveryStrategy.negativeTermCount);
  const broadTerms = uniqueStrings([
    ...coreDiscoveryAnchors.slice(0, discoveryStrategy.broadAnchorCount),
    ...seedDiscoveryAnchors.slice(0, 1),
    ...benchmarkDiscoveryAnchors.slice(0, 1),
    ...broadSignals.slice(0, discoveryStrategy.broadSignalCount)
  ]);
  const groundingAnchors = buildCanonicalDiscoverySet([
    ...discoveryAnchors,
    ...domainKeywords,
    ...(binding.discoveryHints ?? []),
    ...(binding.analysisQuestions ?? []),
    ...(binding.targetCapabilities ?? []),
    ...learnedPositiveParts,
    ...(seedContext?.positiveAnchors ?? []),
    ...(seedContext?.positiveSignals ?? []),
    ...(benchmarkContext?.positiveAnchors ?? []),
    ...(benchmarkContext?.positiveSignals ?? []),
    ...inferredSignalLanes.flatMap((lane) => lane.querySignals ?? []),
    ...inferredArchetypes.flatMap((archetype) => archetype.querySignals ?? [])
  ]);
  const effectivePrioritySignalLaneIds = uniqueStrings([
    ...(seedContext?.preferredLaneIds ?? []),
    ...(benchmarkContext?.preferredLaneIds ?? []),
    ...(discoveryStrategy.prioritySignalLaneIds ?? [])
  ]);
  const rankedArchitectureSignals = rankSignalsByGrounding(rawArchitectureSignals, canonicalSignals, groundingAnchors);
  const architectureSignalPool = rankedArchitectureSignals.map((item) => item.signal);
  const rankedDependencySignals = rankSignalsByGrounding(rawDependencySignals, canonicalSignals, groundingAnchors);
  const dependencySignalPool = rankedDependencySignals
    .filter((item) => isDependencySignalCoreGrounded(item.signal, canonicalSignals, groundingAnchors, benchmarkContext))
    .map((item) => item.signal);
  const plans = [];
  let manualPlan = null;

  const addPlan = (plan) => {
    if (!plan.query) {
      return;
    }
    const dupeIndex = plans.findIndex((item) => item.query === plan.query);
    if (dupeIndex >= 0) {
      // When a caller-driven guaranteed-slot plan (e.g. a problem-mode cohort)
      // collides with an earlier plan that absorbed the same signals incidentally,
      // keep the guaranteed one so its label and id survive for downstream reporting.
      if (plan.guaranteedSlot && !plans[dupeIndex].guaranteedSlot) {
        plans[dupeIndex] = plan;
      }
      return;
    }
    plans.push(plan);
  };

  addPlan({
    id: "broad-project-scan",
    label: "Broad project scan",
    family: "broad",
    priority: buildFamilyPriority("broad", discoveryStrategy, discoveryFeedback),
    capabilityId: null,
    query: buildDiscoveryQueryString(broadTerms, {
      maxTerms: discoveryStrategy.broadMaxTerms,
      negativeTerms,
      maxNegativeTerms: discoveryStrategy.negativeTermCount
    }),
    terms: broadTerms,
    reasons: ["Project-wide query built from recurring project keywords and discovery hints."]
  });

  if ((seedContext?.positiveAnchors?.length ?? 0) > 0) {
    const seedFamilyTerms = buildDiscoveryQueryTerms(
      uniqueStrings([
        ...coreDiscoveryAnchors.slice(0, 1),
        ...(seedContext?.ownerAnchors ?? []).slice(0, 1),
        ...seedDiscoveryAnchors.slice(0, 2),
        ...benchmarkDiscoveryAnchors.slice(0, 1)
      ]),
      uniqueStrings([
        ...(seedContext?.familySignals ?? []).slice(0, 2),
        ...(seedContext?.positiveSignals ?? []).slice(0, 2),
        ...(seedContext?.boundaryParts ?? []).slice(0, 1)
      ]),
      1,
      { preserveAnchors: true, maxQueryTokens: 4 }
    );
    addPlan({
      id: "curated-seed-neighbors",
      label: "Kuratiertes Seed-Umfeld",
      family: "signal_lane",
      priority: buildFamilyPriority("signal_lane", discoveryStrategy, discoveryFeedback) + 34,
      capabilityId: null,
      query: buildDiscoveryQueryString(seedFamilyTerms, {
        maxTerms: discoveryStrategy.signalLaneMaxTerms,
        negativeTerms,
        maxNegativeTerms: discoveryStrategy.negativeTermCount
      }),
      terms: seedFamilyTerms,
      reasons: [
        "Sucht Nachbar-Repos rund um kuratierte Positiv-Seeds statt nur dieselben Baselines wiederzufinden.",
        (seedContext?.familySignals?.length ?? 0) > 0
          ? `Seed-Familien: ${seedContext.familySignals.slice(0, 4).join(", ")}.`
          : null,
        (seedContext?.positiveSignals?.length ?? 0) > 0
          ? `Seed-Signale: ${seedContext.positiveSignals.slice(0, 4).join(", ")}.`
          : "Keine zusaetzlichen Seed-Signale vorhanden."
      ].filter(Boolean)
    });
  }

  for (const ownerScope of (seedContext?.ownerQualifiers ?? []).slice(0, 2)) {
    const ownerNeighborTerms = buildDiscoveryQueryTerms(
      uniqueStrings([
        ...coreDiscoveryAnchors.slice(0, 1),
        ownerScope.owner,
        ...seedDiscoveryAnchors.slice(0, 1)
      ]),
      uniqueStrings([
        ...(seedContext?.familySignals ?? []).slice(0, 2),
        ...(seedContext?.positiveSignals ?? []).slice(0, 1)
      ]),
      1,
      { preserveAnchors: true, maxQueryTokens: 4 }
    );
    const userScopedQuery = buildDiscoveryQueryString(ownerNeighborTerms, {
      maxTerms: discoveryStrategy.signalLaneMaxTerms,
      negativeTerms,
      maxNegativeTerms: discoveryStrategy.negativeTermCount,
      qualifiers: [ownerScope.userQualifier, "archived:false", "fork:false", "stars:>=1"]
    });
    addPlan({
      id: `seed-owner-${ownerScope.owner}`,
      label: `Seed-Familie ${ownerScope.owner}`,
      family: "signal_lane",
      priority: buildFamilyPriority("signal_lane", discoveryStrategy, discoveryFeedback) + 22,
      capabilityId: null,
      query: buildDiscoveryQueryString(ownerNeighborTerms, {
        maxTerms: discoveryStrategy.signalLaneMaxTerms,
        negativeTerms,
        maxNegativeTerms: discoveryStrategy.negativeTermCount,
        qualifiers: [ownerScope.orgQualifier, "archived:false", "fork:false", "stars:>=1"]
      }),
      fallbackQueries: userScopedQuery ? [userScopedQuery] : [],
      terms: ownerNeighborTerms,
      reasons: [
        `Prueft direkte Repo-Nachbarschaft im Seed-Owner '${ownerScope.owner}'.`,
        (seedContext?.familySignals?.length ?? 0) > 0
          ? `Owner-Familien-Signale: ${seedContext.familySignals.slice(0, 3).join(", ")}.`
          : "Keine zusaetzlichen Owner-Familien-Signale vorhanden."
      ]
    });
  }

  for (const cohort of (seedContext?.priorityCohorts ?? []).slice(0, 2)) {
    const cohortOwners = Array.isArray(cohort?.owners) ? cohort.owners.filter(Boolean) : [];
    const cohortSignals = uniqueStrings([
      ...(Array.isArray(cohort?.signals) ? cohort.signals : []),
      ...(Array.isArray(cohort?.boundarySignals) ? cohort.boundarySignals : [])
    ]);
    const cohortTerms = buildDiscoveryQueryTerms(
      uniqueStrings([
        ...coreDiscoveryAnchors.slice(0, 1),
        ...(cohortOwners.length > 0 ? [cohortOwners[0]] : []),
        cohort?.label ?? cohort?.id,
        ...seedDiscoveryAnchors.slice(0, 1)
      ]),
      cohortSignals.slice(0, 3),
      1,
      { preserveAnchors: true, maxQueryTokens: 4 }
    );
    const cohortQualifiers = cohortOwners.length > 0
      ? [`org:${String(cohortOwners[0]).trim().toLowerCase()}`, "archived:false", "fork:false", "stars:>=1"]
      : ["archived:false", "fork:false", "stars:>=3"];
    addPlan({
      id: `seed-cohort-${String(cohort?.id ?? "cohort").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      label: `Kohorte ${cohort?.label ?? cohort?.id ?? "Seed"}`,
      family: "signal_lane",
      priority: buildFamilyPriority("signal_lane", discoveryStrategy, discoveryFeedback) + 26,
      capabilityId: null,
      // Explicit caller intent: problem-mode and similar callers inject cohorts as
      // their primary query surface. Guarantee the slot so tight budgets don't
      // drown them out under project-level priority lanes.
      guaranteedSlot: true,
      query: buildDiscoveryQueryString(cohortTerms, {
        maxTerms: discoveryStrategy.signalLaneMaxTerms,
        negativeTerms,
        maxNegativeTerms: discoveryStrategy.negativeTermCount,
        qualifiers: cohortQualifiers
      }),
      terms: cohortTerms,
      reasons: [
        `Zielt auf die Projekt-Kohorte '${cohort?.label ?? cohort?.id ?? "Seed"}'.`,
        cohort?.why ? `Kohorten-Ziel: ${cohort.why}` : null,
        cohortSignals.length > 0 ? `Kohorten-Signale: ${cohortSignals.slice(0, 4).join(", ")}.` : null
      ].filter(Boolean)
    });
  }

  for (const lane of inferredSignalLanes) {
    const laneTerms = buildDiscoveryQueryTerms(
      uniqueStrings([
        ...coreDiscoveryAnchors,
        ...(seedContext?.preferredLaneIds?.includes(lane.id) ? seedDiscoveryAnchors.slice(0, 1) : []),
        ...(benchmarkContext?.preferredLaneIds?.includes(lane.id) ? benchmarkDiscoveryAnchors.slice(0, 1) : [])
      ]),
      lane.querySignals.slice(0, discoveryStrategy.signalLaneSignalCount),
      discoveryStrategy.signalLaneAnchorCount,
      { preserveAnchors: true, maxQueryTokens: 3 }
    );
    addPlan({
      id: `signal-lane-${lane.id}`,
      label: lane.label,
      family: "signal_lane",
      priority:
        buildFamilyPriority("signal_lane", discoveryStrategy, discoveryFeedback) +
        lane.score * 2 +
        (seedContext?.preferredLaneIds?.includes(lane.id) ? 8 : 0) +
        (benchmarkContext?.preferredLaneIds?.includes(lane.id) ? 10 : 0),
      capabilityId: null,
      minSearchResults: discoveryStrategy.signalLaneMinResults,
      fallbackQueries: buildLaneFallbackQueries(
        uniqueStrings([
          ...coreDiscoveryAnchors,
          ...(seedContext?.preferredLaneIds?.includes(lane.id) ? seedDiscoveryAnchors.slice(0, 1) : []),
          ...(benchmarkContext?.preferredLaneIds?.includes(lane.id) ? benchmarkDiscoveryAnchors.slice(0, 1) : [])
        ]),
        lane,
        lane.capabilitySignalHints ?? [],
        {
          maxTerms: discoveryStrategy.signalLaneMaxTerms,
          negativeTerms,
          maxNegativeTerms: discoveryStrategy.negativeTermCount
        }
      ),
      query: buildDiscoveryQueryString(laneTerms, {
        maxTerms: discoveryStrategy.signalLaneMaxTerms,
        negativeTerms,
        maxNegativeTerms: discoveryStrategy.negativeTermCount
      }),
      terms: laneTerms,
      reasons: [
        `Targets separated signal lane '${lane.label}'.`,
        seedContext?.preferredLaneIds?.includes(lane.id)
          ? "Kuratiertes Seed-Pack verstaerkt diese Lane."
          : null,
        benchmarkContext?.preferredLaneIds?.includes(lane.id)
          ? "Benchmark-positive cohorts reinforce this lane."
          : null,
        `Matched signals: ${lane.matchTokens.filter((token) => canonicalSignals.has(token)).join(", ")}.`
      ].filter(Boolean)
    });
  }

  for (const archetype of inferredArchetypes) {
    const archetypeTerms = buildDiscoveryQueryTerms(
      coreDiscoveryAnchors,
      archetype.querySignals.slice(0, discoveryStrategy.archetypeSignalCount),
      discoveryStrategy.archetypeAnchorCount,
      { preserveAnchors: true, maxQueryTokens: 3 }
    );
    addPlan({
      id: `archetype-${archetype.id}`,
      label: archetype.label,
      family: "archetype",
      priority: buildFamilyPriority("archetype", discoveryStrategy, discoveryFeedback) + archetype.score,
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

  const architectureTerms = buildDiscoveryQueryTerms(
    coreDiscoveryAnchors,
    architectureSignalPool.slice(0, discoveryStrategy.architectureSignalCount),
    discoveryStrategy.architectureAnchorCount
  );
  const architectureGrounding = scoreDiscoverySignalGrounding(
    architectureSignalPool.slice(0, discoveryStrategy.architectureSignalCount),
    canonicalSignals,
    groundingAnchors
  );
  addPlan({
    id: "architecture-patterns",
    label: "Architecture and layer patterns",
    family: "architecture",
    priority:
      buildFamilyPriority("architecture", discoveryStrategy, discoveryFeedback) +
      architectureGrounding.score +
      (architectureGrounding.score < discoveryStrategy.architectureGroundingMinScore ? -35 : 0),
    capabilityId: null,
    query: buildDiscoveryQueryString(architectureTerms, {
      maxTerms: discoveryStrategy.architectureMaxTerms,
      negativeTerms,
      maxNegativeTerms: discoveryStrategy.negativeTermCount
    }),
    terms: architectureTerms,
    reasons: [
      "Targets likely layer and architecture patterns derived from directories and scripts.",
      architectureGrounding.matchedAnchors.length > 0
        ? `Grounded in project signals: ${architectureGrounding.matchedAnchors.slice(0, 4).join(", ")}.`
        : "Grounding to project-specific signals is weak.",
      architectureSignalPool.length > 0
        ? `Signals: ${architectureSignalPool.slice(0, 4).join(", ")}.`
        : "No explicit architecture signals were extracted."
    ]
  });

  if (dependencySignalPool.length > 0) {
    const dependencyTerms = buildDiscoveryQueryTerms(
      coreDiscoveryAnchors,
      dependencySignalPool.slice(0, discoveryStrategy.dependencySignalCount),
      discoveryStrategy.dependencyAnchorCount
    );
    const dependencyGrounding = scoreDiscoverySignalGrounding(
      dependencySignalPool.slice(0, discoveryStrategy.dependencySignalCount),
      canonicalSignals,
      groundingAnchors
    );
    addPlan({
      id: "dependency-neighbors",
      label: "Dependency and tooling neighbors",
      family: "dependency",
      priority:
        buildFamilyPriority("dependency", discoveryStrategy, discoveryFeedback) +
        dependencyGrounding.score +
        (dependencyGrounding.score < discoveryStrategy.dependencyGroundingMinScore ? -45 : 0),
      capabilityId: null,
      query: buildDiscoveryQueryString(dependencyTerms, {
        maxTerms: discoveryStrategy.dependencyMaxTerms,
        negativeTerms,
        maxNegativeTerms: discoveryStrategy.negativeTermCount
      }),
      terms: dependencyTerms,
      reasons: [
        "Targets repos that share important dependencies, tooling or workflow scripts.",
        dependencyGrounding.matchedAnchors.length > 0
          ? `Grounded in project signals: ${dependencyGrounding.matchedAnchors.slice(0, 4).join(", ")}.`
          : "Grounding to project-specific signals is weak.",
        `Signals: ${dependencySignalPool.slice(0, 4).join(", ")}.`
      ]
    });
  }

  if (options.query) {
    const manualTerms = buildDiscoveryQueryTerms(
      coreDiscoveryAnchors,
      extractManualDiscoveryTerms(options.query, 4),
      discoveryStrategy.manualAnchorCount
    );
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
    .flatMap((capability) => {
      const rankedCapabilitySignals = rankSignalsByGrounding(
        capability.signals ?? [],
        canonicalSignals,
        groundingAnchors
      );
      const capabilitySignals = rankedCapabilitySignals.map((item) => item.signal).slice(0, 4);
      const capabilityGrounding = scoreDiscoverySignalGrounding(
        capabilitySignals,
        canonicalSignals,
        groundingAnchors
      );
      const matchingSignalLanes = inferredSignalLanes.filter((lane) => laneSupportsCapability(capability, lane));

      const lanePlans = matchingSignalLanes
        .map((lane) => {
          const laneCapabilitySignals = buildCapabilityLaneSignalPool(
            capability,
            lane,
            canonicalSignals,
            groundingAnchors
          ).slice(0, Math.max(discoveryStrategy.capabilityLaneSignalCount, 1));
          const laneCapabilityTerms = buildDiscoveryQueryTerms(
            uniqueStrings([
              ...coreDiscoveryAnchors.slice(0, 1),
              ...(seedContext?.preferredLaneIds?.includes(lane.id) ? seedDiscoveryAnchors.slice(0, 1) : []),
              ...(benchmarkContext?.preferredLaneIds?.includes(lane.id) ? benchmarkDiscoveryAnchors.slice(0, 1) : []),
              ...sanitizeDiscoverySignals(lane.querySignals ?? [], 2),
              ...coreDiscoveryAnchors.slice(1)
            ]),
            laneCapabilitySignals,
            discoveryStrategy.capabilityLaneAnchorCount,
            {
              preserveAnchors: true,
              maxQueryTokens: discoveryStrategy.capabilityLaneMaxTerms
            }
          );
          const laneCapabilityGrounding = scoreDiscoverySignalGrounding(
            laneCapabilitySignals,
            canonicalSignals,
            groundingAnchors
          );

          return {
            id: `capability-${capability.id}-${lane.id}`,
            label: `${capability.label ?? capability.id} · ${lane.label}`,
            family: "capability",
            priority:
              buildFamilyPriority("capability", discoveryStrategy, discoveryFeedback) +
              buildCapabilityPriority(capability, canonicalSignals) +
              lane.score * 3 +
              laneCapabilityGrounding.score +
              (seedContext?.preferredLaneIds?.includes(lane.id) ? 8 : 0) +
              (benchmarkContext?.preferredLaneIds?.includes(lane.id) ? 10 : 0) +
              6,
            capabilityId: capability.id,
            laneId: lane.id,
            minSearchResults: discoveryStrategy.capabilityLaneMinResults,
            fallbackQueries: buildLaneFallbackQueries(
              uniqueStrings([
                ...coreDiscoveryAnchors,
                ...(seedContext?.preferredLaneIds?.includes(lane.id) ? seedDiscoveryAnchors.slice(0, 1) : []),
                ...(benchmarkContext?.preferredLaneIds?.includes(lane.id) ? benchmarkDiscoveryAnchors.slice(0, 1) : [])
              ]),
              lane,
              laneCapabilitySignals,
              {
                maxTerms: discoveryStrategy.capabilityLaneMaxTerms,
                negativeTerms,
                maxNegativeTerms: discoveryStrategy.negativeTermCount
              }
            ),
            query: buildDiscoveryQueryString(laneCapabilityTerms, {
              maxTerms: discoveryStrategy.capabilityLaneMaxTerms,
              negativeTerms,
              maxNegativeTerms: discoveryStrategy.negativeTermCount
            }),
            terms: laneCapabilityTerms,
            reasons: [
              `Splits broad capability '${capability.label ?? capability.id}' into the lane '${lane.label}'.`,
              seedContext?.preferredLaneIds?.includes(lane.id)
                ? "Kuratiertes Seed-Pack verstaerkt diese Lane."
                : null,
              benchmarkContext?.preferredLaneIds?.includes(lane.id)
                ? "Benchmark-positive cohorts reinforce this lane."
                : null,
              laneCapabilityGrounding.matchedAnchors.length > 0
                ? `Grounded in project signals: ${laneCapabilityGrounding.matchedAnchors.slice(0, 4).join(", ")}.`
                : "Grounding to project-specific signals is weak.",
              laneCapabilitySignals.length > 0
                ? `Lane-shaped signals: ${laneCapabilitySignals.join(", ")}.`
                : "No lane-shaped capability signals were extracted."
            ].filter(Boolean)
          };
        })
        .filter((plan) => plan.query);
      const includeFallbackPlan =
        lanePlans.length === 0 ||
        discoveryProfile.queryBudget >= discoveryStrategy.capabilityFallbackBudgetFloor;

      const capabilityTerms = buildDiscoveryQueryTerms(
        coreDiscoveryAnchors,
        capabilitySignals.slice(0, discoveryStrategy.capabilitySignalCount),
        discoveryStrategy.capabilityAnchorCount
      );

      const fallbackPlan = {
        id: `capability-${capability.id}`,
        label: capability.label ?? capability.id,
        family: "capability",
        priority:
          buildFamilyPriority("capability", discoveryStrategy, discoveryFeedback) +
          buildCapabilityPriority(capability, canonicalSignals) +
          capabilityGrounding.score +
          (capabilityGrounding.score < discoveryStrategy.capabilityGroundingMinScore ? -40 : 0) -
          lanePlans.length * 14,
        capabilityId: capability.id,
        query: buildDiscoveryQueryString(capabilityTerms, {
          maxTerms: discoveryStrategy.capabilityMaxTerms,
          negativeTerms,
          maxNegativeTerms: discoveryStrategy.negativeTermCount
        }),
        terms: capabilityTerms,
        reasons: [
          `Keeps a broad fallback query for capability '${capability.label ?? capability.id}'.`,
          lanePlans.length > 0
            ? `Lower priority because ${lanePlans.length} lane-specific subqueries already cover this capability.`
            : "No narrower lane split was available for this capability.",
          capabilityGrounding.matchedAnchors.length > 0
            ? `Grounded in project signals: ${capabilityGrounding.matchedAnchors.slice(0, 4).join(", ")}.`
            : "Grounding to project-specific signals is weak.",
          capabilitySignals.length > 0
            ? `Signals: ${capabilitySignals.join(", ")}.`
            : "No explicit signals configured."
        ]
      };

      return includeFallbackPlan ? [...lanePlans, fallbackPlan] : lanePlans;
    })
    .sort((left, right) => right.priority - left.priority);

  for (const capabilityPlan of capabilityPlans) {
    addPlan(capabilityPlan);
  }

  const planned = selectDiscoveryPlansWithQuotas(
    plans,
    {
      ...discoveryStrategy,
      prioritySignalLaneIds: effectivePrioritySignalLaneIds
    },
    discoveryProfile.queryBudget
  );
  if (manualPlan?.query && !planned.some((plan) => plan.id === manualPlan.id)) {
    return {
      projectKey: binding.projectKey,
      domainKeywords,
      inferredSignalLanes,
      inferredArchetypes,
      discoveryProfile,
      discoveryStrategy,
      seedContext,
      benchmarkContext,
      discoveryFeedback,
      plans: [
        ...planned.slice(0, Math.max(discoveryProfile.queryBudget - 1, 0)),
        manualPlan
      ]
    };
  }

  return {
    projectKey: binding.projectKey,
    domainKeywords,
    inferredSignalLanes,
    inferredArchetypes,
    discoveryStrategy,
    seedContext,
    benchmarkContext,
    discoveryProfile,
    discoveryFeedback,
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
