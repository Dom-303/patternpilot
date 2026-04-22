import fs from "node:fs/promises";
import path from "node:path";
import { uniqueStrings, clamp } from "../utils.mjs";
import { resolveGithubToken, createHeaders, fetchJsonWithRetry, enrichGithubRepo } from "../github.mjs";
import { normalizeGithubUrl } from "../queue.mjs";
import {
  buildClassificationText,
  deriveActivityStatus,
  guessClassification,
  buildLandkarteCandidate
} from "../classification/core.mjs";
import { buildProjectAlignment } from "../classification/alignment.mjs";
import {
  parseCandidateRisks,
  decorateDiscoveryCandidate,
  buildDiscoveryRunFields,
  applyDiscoveryPolicyToCandidates,
  buildDiscoveryReasoning,
  scoreDiscoveryCandidate
} from "./candidates.mjs";
import {
  buildDiscoveryPlan,
  loadKnownRepoUrls,
  loadWatchlistUrls,
  resolveDiscoveryStrategy
} from "./shared.mjs";

function normalizeDiscoverySignalToken(value) {
  const token = String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!token || token.length < 3) {
    return "";
  }
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("s") && !token.endsWith("ss") && !token.endsWith("ness")) {
    return token.slice(0, -1);
  }
  return token;
}

function buildSeedDiscoverySignals(binding, plan) {
  const strategy = resolveDiscoveryStrategy(binding);
  const strongSignals = new Set();
  const allSignals = new Set();
  const sourceParts = [];

  if (strategy.seedSignalSources.includes("discoveryhints")) {
    sourceParts.push(...(binding.discoveryHints ?? []));
  }
  if (strategy.seedSignalSources.includes("domainkeywords")) {
    sourceParts.push(...(plan.domainKeywords ?? []));
  }
  if (strategy.seedSignalSources.includes("targetcapabilities")) {
    sourceParts.push(...(binding.targetCapabilities ?? []));
  }
  if (strategy.seedSignalSources.includes("analysisquestions")) {
    sourceParts.push(...(binding.analysisQuestions ?? []));
  }

  for (const part of sourceParts) {
    for (const rawToken of String(part ?? "").split(/\s+/)) {
      const token = normalizeDiscoverySignalToken(rawToken);
      if (!token) {
        continue;
      }
      allSignals.add(token);
      if (
        token.length >= 6 ||
        strategy.defaultStrongSignals.includes(token)
      ) {
        strongSignals.add(token);
      }
    }
  }

  return {
    all: [...allSignals],
    strong: [...strongSignals]
  };
}

function buildSeedRepoText(seedRepoData, strategy) {
  const fields = [];

  if (strategy.seedRepoFields.includes("fullName")) {
    fields.push(seedRepoData.fullName);
  }
  if (strategy.seedRepoFields.includes("name")) {
    fields.push(seedRepoData.name);
  }
  if (strategy.seedRepoFields.includes("description")) {
    fields.push(seedRepoData.description);
  }
  if (strategy.seedRepoFields.includes("homepage")) {
    fields.push(seedRepoData.homepage);
  }
  if (strategy.seedRepoFields.includes("topics")) {
    fields.push(...(seedRepoData.topics ?? []));
  }

  return fields.join(" ").toLowerCase();
}

function computeSeedTopicalFit(seedRepoData, discoverySignals, strategy) {
  if (seedRepoData.seedKind === "priority") {
    return {
      allHits: ["curated_seed_priority"],
      strongHits: ["curated_seed_priority"],
      passes: true
    };
  }
  const repoText = buildSeedRepoText(seedRepoData, strategy);
  const allHits = discoverySignals.all.filter((signal) => repoText.includes(signal));
  const strongHits = discoverySignals.strong.filter((signal) => repoText.includes(signal));
  return {
    allHits,
    strongHits,
    passes:
      strongHits.length >= strategy.minStrongSeedSignalHits ||
      allHits.length >= strategy.minSeedSignalHits
  };
}

function buildSearchSeedEnrichment(repoData, meta = {}) {
  return {
    status: "success",
    source: meta.source ?? "github_search",
    authMode: meta.authMode ?? "anonymous",
    authSource: meta.authSource ?? null,
    fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
    repo: {
      fullName: repoData.fullName ?? `${repoData.owner}/${repoData.name}`,
      description: repoData.description ?? "",
      homepage: repoData.homepage ?? "",
      topics: repoData.topics ?? [],
      defaultBranch: repoData.defaultBranch ?? "",
      visibility: repoData.visibility ?? "public",
      archived: Boolean(repoData.archived),
      fork: Boolean(repoData.fork),
      stars: repoData.stars ?? 0,
      forks: repoData.forks ?? 0,
      openIssues: repoData.openIssues ?? 0,
      watchers: repoData.watchers ?? 0,
      language: repoData.language ?? "",
      license: repoData.license ?? "",
      createdAt: repoData.createdAt ?? "",
      updatedAt: repoData.updatedAt ?? "",
      pushedAt: repoData.pushedAt ?? ""
    },
    languages: repoData.language ? [repoData.language] : [],
    readme: {
      path: null,
      htmlUrl: null,
      excerpt: ""
    }
  };
}

function normalizeGithubSearchItem(item) {
  return {
    owner: item?.owner?.login ?? "",
    name: item?.name ?? "",
    normalizedRepoUrl: item?.html_url ?? "",
    slug: `${item?.owner?.login ?? ""}__${item?.name ?? ""}`.toLowerCase(),
    host: "github.com",
    fullName: item?.full_name ?? "",
    description: item?.description ?? "",
    homepage: item?.homepage ?? "",
    topics: item?.topics ?? [],
    defaultBranch: item?.default_branch ?? "",
    visibility: item?.visibility ?? "public",
    archived: Boolean(item?.archived),
    fork: Boolean(item?.fork),
    stars: item?.stargazers_count ?? 0,
    forks: item?.forks_count ?? 0,
    openIssues: item?.open_issues_count ?? 0,
    watchers: item?.watchers_count ?? 0,
    language: item?.language ?? "",
    license: item?.license?.spdx_id || item?.license?.name || "",
    createdAt: item?.created_at ?? "",
    updatedAt: item?.updated_at ?? "",
    pushedAt: item?.pushed_at ?? ""
  };
}

function normalizeCuratedSeedRepo(entry, index = 0, seedKind = "priority") {
  const repoRef = String(entry?.repo ?? entry?.fullName ?? "").trim().replace(/^\/+|\/+$/g, "");
  const parts = repoRef.split("/");
  const owner = parts[0] ?? `seed-owner-${index}`;
  const name = parts[1] ?? parts[0] ?? `seed-repo-${index}`;
  const normalizedRepoUrl = String(entry?.url ?? "").trim() || `https://github.com/${owner}/${name}`;

  return {
    owner,
    name,
    normalizedRepoUrl,
    slug: `${owner}__${name}`.toLowerCase(),
    host: "github.com",
    fullName: repoRef || `${owner}/${name}`,
    description: String(entry?.description ?? entry?.why ?? "").trim(),
    homepage: String(entry?.homepage ?? "").trim(),
    topics: Array.isArray(entry?.topics) ? entry.topics : [],
    defaultBranch: String(entry?.defaultBranch ?? "").trim(),
    visibility: "public",
    archived: Boolean(entry?.archived),
    fork: Boolean(entry?.fork),
    stars: Number(entry?.stars ?? 0) || 0,
    forks: Number(entry?.forks ?? 0) || 0,
    openIssues: Number(entry?.openIssues ?? 0) || 0,
    watchers: Number(entry?.watchers ?? 0) || 0,
    language: String(entry?.language ?? "").trim(),
    license: String(entry?.license ?? "").trim(),
    createdAt: String(entry?.createdAt ?? "").trim(),
    updatedAt: String(entry?.updatedAt ?? "").trim(),
    pushedAt: String(entry?.pushedAt ?? "").trim(),
    seedKind,
    seedWhy: String(entry?.why ?? "").trim()
  };
}

export function buildFallbackSearchQueries(query, minPositiveTerms = 2) {
  const tokens = String(query ?? "")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean);
  const positiveTerms = [];
  const qualifiers = [];
  let qualifierMode = false;

  for (const token of tokens) {
    if (!qualifierMode && (token.startsWith("-") || token.includes(":"))) {
      qualifierMode = true;
    }
    if (qualifierMode) {
      qualifiers.push(token);
    } else {
      positiveTerms.push(token);
    }
  }

  const queries = [];
  for (let count = positiveTerms.length; count >= Math.max(1, minPositiveTerms); count -= 1) {
    const nextQuery = [
      positiveTerms.slice(0, count).join(" "),
      qualifiers.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (nextQuery && !queries.includes(nextQuery)) {
      queries.push(nextQuery);
    }
  }

  return queries.length > 0 ? queries : [String(query ?? "").trim()].filter(Boolean);
}

export function buildSearchQuerySequence(plan, minPositiveTerms = 2) {
  const primaryFallbacks = buildFallbackSearchQueries(plan?.query, minPositiveTerms);
  const [primaryQuery, ...truncatedFallbacks] = primaryFallbacks;
  return uniqueStrings([
    primaryQuery,
    ...((Array.isArray(plan?.fallbackQueries) ? plan.fallbackQueries : []).filter(Boolean)),
    ...truncatedFallbacks
  ].filter(Boolean));
}

export async function searchGithubRepositories(config, plan, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  const headers = createHeaders(githubConfig, auth);
  const baseUrl = githubConfig.apiBaseUrl ?? "https://api.github.com";
  const timeoutMs = Math.min(githubConfig.requestTimeoutMs ?? 12000, options.timeoutMs ?? 4500);
  const perPage = Math.max(1, Math.min(options.perPage ?? 10, 25));
  const attemptedQueries = [];
  const fallbackQueries = buildSearchQuerySequence(plan, options.minPositiveTerms ?? 2);
  const minSearchResults = Math.max(1, Number(plan.minSearchResults ?? options.minSearchResults ?? 1) || 1);
  const collectedItems = new Map();
  let maxTotalCount = 0;
  let incompleteResults = false;
  let effectiveQuery = fallbackQueries.at(-1) ?? plan.query;
  let fetchedAt = new Date().toISOString();

  for (const [index, query] of fallbackQueries.entries()) {
    const requestUrl = new URL(`${baseUrl}/search/repositories`);
    requestUrl.searchParams.set("q", query);
    requestUrl.searchParams.set("sort", "updated");
    requestUrl.searchParams.set("order", "desc");
    requestUrl.searchParams.set("per_page", String(perPage));
    requestUrl.searchParams.set("page", "1");

    const response = await fetchJsonWithRetry(
      requestUrl.toString(),
      headers,
      timeoutMs,
      options.attempts ?? 1
    );
    const items = (response.items ?? []).map(normalizeGithubSearchItem);
    for (const item of items) {
      if (item.normalizedRepoUrl && !collectedItems.has(item.normalizedRepoUrl)) {
        collectedItems.set(item.normalizedRepoUrl, item);
      }
    }
    attemptedQueries.push({
      query,
      totalCount: response.total_count ?? 0,
      resultCount: items.length
    });
    maxTotalCount = Math.max(maxTotalCount, response.total_count ?? 0);
    incompleteResults = incompleteResults || Boolean(response.incomplete_results);
    effectiveQuery = query;
    fetchedAt = new Date().toISOString();

    const isLastQuery = index === fallbackQueries.length - 1;
    if (collectedItems.size >= minSearchResults || isLastQuery) {
      return {
        authMode: auth.authMode,
        authSource: auth.envName,
        fetchedAt,
        totalCount: maxTotalCount,
        incompleteResults,
        effectiveQuery,
        attemptedQueries,
        items: [...collectedItems.values()]
      };
    }
  }

  return {
    authMode: auth.authMode,
    authSource: auth.envName,
    fetchedAt,
    totalCount: maxTotalCount,
    incompleteResults,
    effectiveQuery,
    attemptedQueries,
    items: [...collectedItems.values()]
  };
}

function discoveryStarScore(stars) {
  if (!stars || stars <= 0) {
    return 0;
  }
  return Math.min(18, Math.round(Math.log10(stars + 1) * 8));
}

function discoveryActivityScore(enrichment) {
  const activity = deriveActivityStatus(enrichment);
  if (activity === "current") {
    return 12;
  }
  if (activity === "moderate") {
    return 6;
  }
  if (activity === "stale") {
    return -6;
  }
  if (activity === "archived") {
    return -18;
  }
  return 0;
}

function mergeDiscoveryHit(target, plan, item, fetchedAt, authMeta) {
  const existing = target.get(item.normalizedRepoUrl);
  if (existing) {
    existing.queryIds.add(plan.id);
    existing.queryLabels.add(plan.label);
    existing.queryFamilies.add(plan.family ?? "broad");
    if (plan.capabilityId) {
      existing.capabilityIds.add(plan.capabilityId);
    }
    existing.planTerms.push(...plan.terms);
    if (!existing.seedKind && item.seedKind) {
      existing.seedKind = item.seedKind;
    }
    return existing;
  }

  const seedEnrichment = buildSearchSeedEnrichment(item, {
    source: "github_search",
    fetchedAt,
    authMode: authMeta.authMode,
    authSource: authMeta.authSource
  });
  const record = {
    repo: {
      owner: item.owner,
      name: item.name,
      normalizedRepoUrl: item.normalizedRepoUrl,
      slug: item.slug,
      host: item.host
    },
    seedRepoData: item,
    seedEnrichment,
    queryIds: new Set([plan.id]),
    queryLabels: new Set([plan.label]),
    queryFamilies: new Set([plan.family ?? "broad"]),
    capabilityIds: new Set(plan.capabilityId ? [plan.capabilityId] : []),
    planTerms: [...plan.terms],
    seedKind: item.seedKind ?? null
  };
  target.set(item.normalizedRepoUrl, record);
  return record;
}

function rawDiscoveryPreScore(record) {
  let score = 8;
  score += record.queryIds.size * 6;
  if (record.seedKind === "priority") {
    score += 48;
  } else if (record.seedKind === "reference") {
    score += 18;
  }
  score += discoveryStarScore(record.seedEnrichment.repo.stars);
  score += discoveryActivityScore(record.seedEnrichment);
  if (record.seedEnrichment.repo.fork) {
    score -= 12;
  }
  if (record.seedEnrichment.repo.archived) {
    score -= 20;
  }
  return clamp(score, 0, 100);
}

function injectCuratedDiscoverySeeds(hits, discoverySeeds, knownUrls = new Set()) {
  if (!discoverySeeds || typeof discoverySeeds !== "object") {
    return { injected: 0, priority: 0, reference: 0 };
  }

  const groups = [
    {
      key: "priorityRepos",
      seedKind: "priority",
      plan: {
        id: "curated-seed-priority",
        label: "Curated seed priority cohort",
        family: "curated_seed",
        capabilityId: null,
        terms: ["curated seed", "priority"]
      }
    },
    {
      key: "referenceRepos",
      seedKind: "reference",
      plan: {
        id: "curated-seed-reference",
        label: "Curated seed reference cohort",
        family: "curated_seed",
        capabilityId: null,
        terms: ["curated seed", "reference"]
      }
    }
  ];

  const meta = {
    authMode: "curated_seed",
    authSource: "project_seed_file"
  };
  const fetchedAt = new Date().toISOString();
  let injected = 0;
  let priority = 0;
  let reference = 0;

  for (const group of groups) {
    const entries = Array.isArray(discoverySeeds[group.key]) ? discoverySeeds[group.key] : [];
    for (const [index, entry] of entries.entries()) {
      const normalized = normalizeCuratedSeedRepo(entry, index, group.seedKind);
      const isKnown = knownUrls.has(normalized.normalizedRepoUrl);
      const includeKnownSeed =
        Boolean(entry?.includeKnown)
        || group.seedKind === "priority";
      if (!normalized.normalizedRepoUrl || (isKnown && !includeKnownSeed)) {
        continue;
      }
      normalized.alreadyKnown = isKnown;
      const before = hits.size;
      mergeDiscoveryHit(hits, group.plan, normalized, fetchedAt, meta);
      if (hits.size > before) {
        injected += 1;
        if (group.seedKind === "priority") {
          priority += 1;
        } else if (group.seedKind === "reference") {
          reference += 1;
        }
      }
    }
  }

  return { injected, priority, reference };
}

function candidatePolicyPreferenceScore(candidate) {
  return (candidate?.discoveryPolicyGate?.preferenceHits?.length ?? 0) * 20;
}

function candidateCuratedSeedPriority(candidate) {
  if (candidate?.discoverySeedKind === "priority") {
    return 40;
  }
  if (candidate?.discoverySeedKind === "reference") {
    return 12;
  }
  return 0;
}

function candidateCohortPriority(candidate) {
  const preferenceHits = Array.isArray(candidate?.discoveryPolicyGate?.preferenceHits)
    ? candidate.discoveryPolicyGate.preferenceHits
    : [];
  let score = 0;
  for (const hit of preferenceHits) {
    if (hit.startsWith("preferred_cohort:")) {
      score += 36;
    } else if (hit.startsWith("preferred_lane:")) {
      score += 22;
    } else if (hit.startsWith("preferred_main_layer:") || hit.startsWith("preferred_gap_area:")) {
      score += 10;
    } else if (hit.startsWith("preferred_capability")) {
      score += 8;
    }
  }
  return score;
}

function candidateLaneEvidencePriority(candidate) {
  const queryIds = new Set(Array.isArray(candidate?.queryIds) ? candidate.queryIds : []);
  const sourceFamilyHits = Number(candidate?.discoveryEvidence?.sourceFamilyHits ?? 0) || 0;
  const publicEventIntakeHits = Number(candidate?.discoveryEvidence?.publicEventIntakeHits ?? 0) || 0;
  const governanceHits = Number(candidate?.discoveryEvidence?.governanceHits ?? 0) || 0;
  const normalizationHits = Number(candidate?.discoveryEvidence?.normalizationHits ?? 0) || 0;

  let score = 0;

  if (queryIds.has("signal-lane-public_event_intake")) {
    if (publicEventIntakeHits >= 1) score += 28;
    else score -= 32;
    if (normalizationHits >= 1) score += 12;
    if (sourceFamilyHits >= 1) score += 8;
  }

  if (queryIds.has("signal-lane-adapter_family")) {
    if (sourceFamilyHits >= 2) score += 24;
    else if (sourceFamilyHits >= 1) score += 10;
    else score -= 28;
    if (normalizationHits >= 1 || governanceHits >= 1) score += 8;
  }

  if (queryIds.has("signal-lane-normalization_schema")) {
    if (normalizationHits >= 2) score += 24;
    else if (normalizationHits >= 1) score += 10;
    else score -= 28;
    if (publicEventIntakeHits >= 1 || sourceFamilyHits >= 1) score += 8;
  }

  return score;
}

function candidateCorePriority(candidate) {
  const layer = String(candidate?.guess?.mainLayer ?? "").toLowerCase();
  const gapArea = String(candidate?.gapAreaCanonical ?? candidate?.guess?.gapArea ?? "").toLowerCase();
  const sourceFamilyHits = Number(candidate?.discoveryEvidence?.sourceFamilyHits ?? 0) || 0;
  const publicEventIntakeHits = Number(candidate?.discoveryEvidence?.publicEventIntakeHits ?? 0) || 0;
  const governanceHits = Number(candidate?.discoveryEvidence?.governanceHits ?? 0) || 0;
  const normalizationHits = Number(candidate?.discoveryEvidence?.normalizationHits ?? 0) || 0;
  const nicheVerticalHits = Number(candidate?.discoveryEvidence?.nicheVerticalHits ?? 0) || 0;

  let score = 0;
  if (layer === "source_intake") score += 24;
  if (layer === "access_fetch") score += 20;
  if (layer === "parsing_extraction") score += 16;
  if (layer === "location_place_enrichment") score += 10;
  if (layer === "export_feed_api") score -= 6;
  if (layer === "distribution_plugin") score -= 12;
  if (layer === "ui_discovery_surface") score -= 18;

  if (gapArea === "source_systems_and_families") score += 14;
  if (gapArea === "connector_families") score += 10;
  if (gapArea === "distribution_surfaces") score -= 8;
  if (sourceFamilyHits >= 4) score += 18;
  else if (sourceFamilyHits >= 2) score += 10;
  if (publicEventIntakeHits >= 1) score += 10;
  if (governanceHits >= 1) score += 10;
  if (normalizationHits >= 2) score += 8;
  if (layer === "location_place_enrichment" && sourceFamilyHits >= 3 && publicEventIntakeHits >= 1) {
    score += 16;
  }
  if (nicheVerticalHits > 0 && governanceHits === 0 && normalizationHits < 3) {
    score -= 18;
  }

  return score;
}

function candidateActionabilityScore(candidate) {
  const disposition = String(candidate?.discoveryDisposition ?? "").toLowerCase();
  const candidateClass = String(candidate?.discoveryClass ?? "").toLowerCase();
  const risks = Array.isArray(candidate?.risks) ? candidate.risks.map((item) => String(item).toLowerCase()) : [];

  let score = 0;
  if (candidateClass === "fit_candidate") score += 24;
  if (candidateClass === "research_signal") score += 14;
  if (candidateClass === "boundary_signal") score += 4;
  if (candidateClass === "risk_signal") score -= 10;
  if (candidateClass === "weak_signal") score -= 16;

  if (disposition === "intake_now") score += 18;
  if (disposition === "review_queue") score += 10;
  if (disposition === "observe_only") score -= 4;
  if (disposition === "skip") score -= 10;

  if (risks.some((risk) => risk.includes("source_lock_in"))) score -= 8;
  if (risks.some((risk) => risk.includes("plattform") || risk.includes("platform"))) score -= 4;

  return score;
}

export function compareDiscoveryCandidates(left, right) {
  const curatedSeedDiff = candidateCuratedSeedPriority(right) - candidateCuratedSeedPriority(left);
  if (curatedSeedDiff !== 0) {
    return curatedSeedDiff;
  }

  const laneEvidenceDiff = candidateLaneEvidencePriority(right) - candidateLaneEvidencePriority(left);
  if (laneEvidenceDiff !== 0) {
    return laneEvidenceDiff;
  }

  const cohortDiff = candidateCohortPriority(right) - candidateCohortPriority(left);
  if (cohortDiff !== 0) {
    return cohortDiff;
  }

  const actionabilityDiff = candidateActionabilityScore(right) - candidateActionabilityScore(left);
  if (actionabilityDiff !== 0) {
    return actionabilityDiff;
  }

  const projectBindingDiff = (right?.projectBindingScore ?? 0) - (left?.projectBindingScore ?? 0);
  if (projectBindingDiff !== 0) {
    return projectBindingDiff;
  }

  const fitDiff = (right?.projectAlignment?.fitScore ?? 0) - (left?.projectAlignment?.fitScore ?? 0);
  if (fitDiff !== 0) {
    return fitDiff;
  }

  const coreDiff = candidateCorePriority(right) - candidateCorePriority(left);
  if (coreDiff !== 0) {
    return coreDiff;
  }

  const preferenceDiff = candidatePolicyPreferenceScore(right) - candidatePolicyPreferenceScore(left);
  if (preferenceDiff !== 0) {
    return preferenceDiff;
  }

  return (right?.discoveryScore ?? 0) - (left?.discoveryScore ?? 0);
}

export async function appendUrlsToWatchlist(rootDir, project, urls, dryRun = false) {
  if (!project.watchlistFile) {
    return { status: "skipped_no_watchlist", appended: 0, keptExisting: urls.length };
  }

  const watchlistPath = path.join(rootDir, project.watchlistFile);
  const existingContent = await fs.readFile(watchlistPath, "utf8").catch(() => "");
  const existingLines = (existingContent ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const existingSet = new Set(existingLines);
  const normalizedUrls = uniqueStrings(urls.map((url) => {
    try {
      return normalizeGithubUrl(url).normalizedRepoUrl;
    } catch {
      return null;
    }
  }).filter(Boolean));
  const appended = normalizedUrls.filter((url) => !existingSet.has(url));

  if (!dryRun && appended.length > 0) {
    const header = existingContent && existingContent.trim().length > 0
      ? existingContent.trimEnd()
      : "# GitHub repo URLs fuer spaetere Watchlist-Intakes";
    const nextContent = `${header}\n${appended.join("\n")}\n`;
    await fs.writeFile(watchlistPath, nextContent, "utf8");
  }

  return {
    status: appended.length > 0 ? (dryRun ? "planned" : "updated") : "unchanged",
    appended: appended.length,
    keptExisting: normalizedUrls.length - appended.length,
    urls: appended
  };
}

export async function discoverGithubCandidates(
  rootDir,
  config,
  project,
  binding,
  alignmentRules,
  projectProfile,
  options = {}
) {
  const createdAt = new Date().toISOString();
  const plan = buildDiscoveryPlan(binding, alignmentRules, projectProfile, options);
  const discoveryFeedback = options.discoveryFeedback ?? null;
  const discoverySeeds = options.discoverySeeds ?? null;
  const discoveryProfile = plan.discoveryProfile;
  const discoveryStrategy = resolveDiscoveryStrategy(binding);
  const knownUrls = await loadKnownRepoUrls(rootDir, config, project);
  const seedDiscoverySignals = buildSeedDiscoverySignals(binding, plan);
  const hits = new Map();
  const searchErrors = [];
  let scanned = 0;
  const curatedSeedSummary = injectCuratedDiscoverySeeds(hits, discoverySeeds, knownUrls);

  if (!options.offline) {
    const searchResults = await Promise.all(
      plan.plans.map(async (queryPlan) => {
        try {
          const response = await searchGithubRepositories(config, queryPlan, {
            perPage: discoveryProfile.perQuery,
            attempts: 1,
            timeoutMs: 4500
          });
          return { queryPlan, response, error: null };
        } catch (error) {
          return { queryPlan, response: null, error };
        }
      })
    );

    for (const result of searchResults) {
      if (result.error) {
        searchErrors.push({
          queryId: result.queryPlan.id,
          label: result.queryPlan.label,
          query: result.queryPlan.query,
          error: result.error.message ?? String(result.error)
        });
        continue;
      }

      const { queryPlan, response } = result;
      scanned += response.items.length;
      for (const item of response.items) {
        if (!item.normalizedRepoUrl || knownUrls.has(item.normalizedRepoUrl)) {
          continue;
        }
        mergeDiscoveryHit(hits, queryPlan, item, response.fetchedAt, {
          authMode: response.authMode,
          authSource: response.authSource
        });
      }
    }
  }

  const enrichmentPoolSize = Math.max(
    Math.round(discoveryProfile.limit * discoveryProfile.shortlistMultiplier),
    12
  );
  const shortlisted = [...hits.values()]
    .map((record) => ({
      record,
      seedTopicalFit: computeSeedTopicalFit(record.seedRepoData, seedDiscoverySignals, discoveryStrategy)
    }))
    .filter(({ seedTopicalFit }) => seedTopicalFit.passes)
    .map(({ record }) => record)
    .sort((left, right) => rawDiscoveryPreScore(right) - rawDiscoveryPreScore(left))
    .slice(0, enrichmentPoolSize);
  const candidates = [];

  const enrichedPool = options.skipEnrich
    ? shortlisted.map((record) => ({ record, enrichment: record.seedEnrichment }))
    : await Promise.all(
        shortlisted.map(async (record) => {
          const detailed = await enrichGithubRepo(record.repo, config, { skipEnrich: false });
          if (detailed.status === "success") {
            return { record, enrichment: detailed };
          }
          return {
            record,
            enrichment: {
              ...record.seedEnrichment,
              detailStatus: detailed.status,
              detailError: detailed.error ?? "",
              authMode: detailed.authMode ?? record.seedEnrichment.authMode,
              authSource: detailed.authSource ?? record.seedEnrichment.authSource
            }
          };
        })
      );

  for (const { record, enrichment } of enrichedPool) {
    const guess = guessClassification(record.repo, enrichment);
    const projectAlignment = buildProjectAlignment(
      record.repo,
      guess,
      enrichment,
      projectProfile,
      alignmentRules,
      binding.projectLabel ?? binding.projectKey
    );
    const landkarteCandidate = buildLandkarteCandidate(
      record.repo,
      guess,
      enrichment,
      binding.projectLabel ?? binding.projectKey
    );
    const candidate = {
      repo: record.repo,
      enrichment,
      guess,
      landkarteCandidate,
      discoverySeedKind: record.seedKind ?? null,
      alreadyKnown: knownUrls.has(record.repo.normalizedRepoUrl),
      discoveryTrack: knownUrls.has(record.repo.normalizedRepoUrl) ? "baseline_anchor" : "new_discovery",
      risks: parseCandidateRisks(landkarteCandidate?.risks),
      projectAlignment,
      queryIds: [...record.queryIds],
      queryLabels: [...record.queryLabels],
      queryFamilies: [...record.queryFamilies],
      capabilityIds: [...record.capabilityIds],
      discoveryScore: 0,
      discoveryDisposition: "watch_only",
      reasoning: []
    };
    candidate.discoveryScore = scoreDiscoveryCandidate(candidate, plan.domainKeywords, discoveryFeedback, {
      binding,
      discoveryPolicy: options.discoveryPolicy
    });
    decorateDiscoveryCandidate(candidate, alignmentRules);
    candidate.reasoning = buildDiscoveryReasoning(candidate, plan.domainKeywords);
    candidates.push(candidate);
  }

  const policyMode = options.discoveryPolicyMode ?? "enforce";
  const {
    visibleCandidates,
    blockedCandidates,
    policySummary,
    policyCalibration
  } = applyDiscoveryPolicyToCandidates(candidates, options.discoveryPolicy, policyMode);

  visibleCandidates.sort(compareDiscoveryCandidates);
  const shortlistedCandidates = visibleCandidates.slice(0, discoveryProfile.limit);
  const baselineAnchors = shortlistedCandidates.filter((candidate) => candidate.discoveryTrack === "baseline_anchor");
  const newCandidates = shortlistedCandidates.filter((candidate) => candidate.discoveryTrack === "new_discovery");

  const discovery = {
    createdAt,
    offline: Boolean(options.offline),
    plan,
    discoveryProfile,
    scanned,
    curatedSeedCount: curatedSeedSummary.injected,
    curatedPrioritySeedCount: curatedSeedSummary.priority,
    curatedReferenceSeedCount: curatedSeedSummary.reference,
    knownUrlCount: knownUrls.size,
    candidateCount: visibleCandidates.length,
    rawCandidateCount: candidates.length,
    evaluatedCandidates: candidates,
    blockedCandidates,
    searchErrors,
    candidates: shortlistedCandidates,
    baselineAnchors,
    newCandidates,
    baselineAnchorCount: baselineAnchors.length,
    newCandidateCount: newCandidates.length,
    policySummary,
    policyCalibration,
    feedback: discoveryFeedback
  };

  Object.assign(discovery, buildDiscoveryRunFields(discovery.candidates, alignmentRules));

  return discovery;
}

export { loadWatchlistUrls } from "./shared.mjs";
