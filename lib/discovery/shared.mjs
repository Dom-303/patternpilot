import path from "node:path";
import { DISCOVERY_STOPWORDS, resolveDiscoveryProfile } from "../constants.mjs";
import { uniqueStrings, safeReadText } from "../utils.mjs";
import { normalizeGithubUrl, loadQueueEntries } from "../queue.mjs";
import { resolveLandkartePath } from "../config.mjs";

export const DEFAULT_DISCOVERY_STRATEGY = {
  broadAnchorCount: 2,
  broadSignalCount: 1,
  broadMaxTerms: 3,
  capabilityAnchorCount: 1,
  capabilitySignalCount: 2,
  capabilityMaxTerms: 4,
  manualAnchorCount: 1,
  manualMaxTerms: 4,
  seedSignalSources: ["discoveryHints"],
  seedRepoFields: ["fullName", "name", "description", "homepage", "topics"],
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
  ]
};

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
    const signal = normalizeDiscoveryTerm(rawSignal);
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
    "capabilityAnchorCount",
    "capabilitySignalCount",
    "capabilityMaxTerms",
    "manualAnchorCount",
    "manualMaxTerms",
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

  return `${queryTerms.join(" ")} archived:false fork:false stars:>=3`;
}

export function buildDiscoveryPlan(binding, alignmentRules, projectProfile, options = {}) {
  const discoveryStrategy = resolveDiscoveryStrategy(binding);
  const discoveryProfile = resolveDiscoveryProfile(options.discoveryProfile, options.limit);
  const corpusParts = [
    binding.projectLabel,
    binding.projectKey,
    ...(binding.targetCapabilities ?? []),
    ...(binding.analysisQuestions ?? []),
    ...(binding.discoveryHints ?? []),
    projectProfile?.corpus ?? ""
  ];
  const domainKeywords = extractDiscoveryKeywords(corpusParts, 10);
  const discoveryAnchors = uniqueStrings([
    ...sanitizeDiscoverySignals(binding.discoveryHints ?? [], 6),
    ...domainKeywords.slice(0, 4)
  ]);
  const broadSignals = sanitizeDiscoverySignals(
    (alignmentRules?.capabilities ?? []).flatMap((capability) => capability.signals ?? []),
    8
  );
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
    capabilityId: null,
    query: buildDiscoveryQueryString(broadTerms, { maxTerms: discoveryStrategy.broadMaxTerms }),
    terms: broadTerms,
    reasons: ["Project-wide query built from recurring project keywords and discovery hints."]
  });

  if (options.query) {
    const manualTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, discoveryStrategy.manualAnchorCount),
      ...extractManualDiscoveryTerms(options.query, 4)
    ]);
    manualPlan = {
      id: "manual-query",
      label: "Manual query boost",
      capabilityId: null,
      query: buildDiscoveryQueryString(manualTerms, { maxTerms: discoveryStrategy.manualMaxTerms }),
      terms: manualTerms,
      reasons: ["Extended by explicit --query input."]
    };
    addPlan(manualPlan);
  }

  for (const capability of alignmentRules?.capabilities ?? []) {
    const capabilitySignals = sanitizeDiscoverySignals(capability.signals ?? [], 4);
    const capabilityTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, discoveryStrategy.capabilityAnchorCount),
      ...capabilitySignals.slice(0, discoveryStrategy.capabilitySignalCount)
    ]);

    addPlan({
      id: `capability-${capability.id}`,
      label: capability.label ?? capability.id,
      capabilityId: capability.id,
      query: buildDiscoveryQueryString(capabilityTerms, { maxTerms: discoveryStrategy.capabilityMaxTerms }),
      terms: capabilityTerms,
      reasons: [
        `Targets capability '${capability.label ?? capability.id}'.`,
        capabilitySignals.length > 0
          ? `Signals: ${capabilitySignals.join(", ")}.`
          : "No explicit signals configured."
      ]
    });
  }

  const planned = plans.slice(0, discoveryProfile.queryBudget);
  if (manualPlan?.query && !planned.some((plan) => plan.id === manualPlan.id)) {
    return {
      projectKey: binding.projectKey,
      domainKeywords,
      discoveryProfile,
      plans: [
        ...planned.slice(0, Math.max(discoveryProfile.queryBudget - 1, 0)),
        manualPlan
      ]
    };
  }

  return {
    projectKey: binding.projectKey,
    domainKeywords,
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
