import path from "node:path";
import { DISCOVERY_STOPWORDS, resolveDiscoveryProfile } from "../constants.mjs";
import { uniqueStrings, safeReadText } from "../utils.mjs";
import { normalizeGithubUrl, loadQueueEntries } from "../queue.mjs";
import { resolveLandkartePath } from "../config.mjs";

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

function quoteGithubSearchTerm(term) {
  return term.includes(" ") ? `"${term}"` : term;
}

function buildDiscoveryQueryString(terms) {
  const normalizedTerms = uniqueStrings(
    terms
      .map((term) => normalizeDiscoveryTerm(term))
      .filter((term) => term && term.length >= 3)
  ).slice(0, 6);

  if (normalizedTerms.length === 0) {
    return null;
  }

  return `${normalizedTerms.map(quoteGithubSearchTerm).join(" ")} archived:false fork:false stars:>=3`;
}

export function buildDiscoveryPlan(binding, alignmentRules, projectProfile, options = {}) {
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
    ...discoveryAnchors.slice(0, 3),
    ...broadSignals.slice(0, 2)
  ]);
  const plans = [];

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
    query: buildDiscoveryQueryString(broadTerms),
    terms: broadTerms,
    reasons: ["Project-wide query built from recurring project keywords and discovery hints."]
  });

  for (const capability of alignmentRules?.capabilities ?? []) {
    const capabilitySignals = sanitizeDiscoverySignals(capability.signals ?? [], 4);
    const capabilityTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, 2),
      ...capabilitySignals
    ]);

    addPlan({
      id: `capability-${capability.id}`,
      label: capability.label ?? capability.id,
      capabilityId: capability.id,
      query: buildDiscoveryQueryString(capabilityTerms),
      terms: capabilityTerms,
      reasons: [
        `Targets capability '${capability.label ?? capability.id}'.`,
        capabilitySignals.length > 0
          ? `Signals: ${capabilitySignals.join(", ")}.`
          : "No explicit signals configured."
      ]
    });
  }

  if (options.query) {
    const manualTerms = uniqueStrings([
      ...discoveryAnchors.slice(0, 2),
      ...sanitizeDiscoverySignals([options.query], 4)
    ]);
    addPlan({
      id: "manual-query",
      label: "Manual query boost",
      capabilityId: null,
      query: buildDiscoveryQueryString(manualTerms),
      terms: manualTerms,
      reasons: ["Extended by explicit --query input."]
    });
  }

  return {
    projectKey: binding.projectKey,
    domainKeywords,
    discoveryProfile,
    plans: plans.slice(0, discoveryProfile.queryBudget)
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
