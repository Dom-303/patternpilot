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
  loadWatchlistUrls
} from "./shared.mjs";

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

async function searchGithubRepositories(config, plan, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  const headers = createHeaders(githubConfig, auth);
  const baseUrl = githubConfig.apiBaseUrl ?? "https://api.github.com";
  const timeoutMs = Math.min(githubConfig.requestTimeoutMs ?? 12000, options.timeoutMs ?? 4500);
  const perPage = Math.max(1, Math.min(options.perPage ?? 10, 25));
  const requestUrl = new URL(`${baseUrl}/search/repositories`);
  requestUrl.searchParams.set("q", plan.query);
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

  return {
    authMode: auth.authMode,
    authSource: auth.envName,
    fetchedAt: new Date().toISOString(),
    totalCount: response.total_count ?? 0,
    incompleteResults: Boolean(response.incomplete_results),
    items: (response.items ?? []).map(normalizeGithubSearchItem)
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
    if (plan.capabilityId) {
      existing.capabilityIds.add(plan.capabilityId);
    }
    existing.planTerms.push(...plan.terms);
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
    capabilityIds: new Set(plan.capabilityId ? [plan.capabilityId] : []),
    planTerms: [...plan.terms]
  };
  target.set(item.normalizedRepoUrl, record);
  return record;
}

function rawDiscoveryPreScore(record) {
  let score = 8;
  score += record.queryIds.size * 6;
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
  const discoveryProfile = plan.discoveryProfile;
  const knownUrls = await loadKnownRepoUrls(rootDir, config, project);
  const hits = new Map();
  const searchErrors = [];
  let scanned = 0;

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
      alignmentRules
    );
    const landkarteCandidate = buildLandkarteCandidate(record.repo, guess, enrichment);
    const candidate = {
      repo: record.repo,
      enrichment,
      guess,
      landkarteCandidate,
      risks: parseCandidateRisks(landkarteCandidate?.risks),
      projectAlignment,
      queryIds: [...record.queryIds],
      queryLabels: [...record.queryLabels],
      capabilityIds: [...record.capabilityIds],
      discoveryScore: 0,
      discoveryDisposition: "watch_only",
      reasoning: []
    };
    candidate.discoveryScore = scoreDiscoveryCandidate(candidate, plan.domainKeywords);
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

  visibleCandidates.sort((left, right) => right.discoveryScore - left.discoveryScore);

  const discovery = {
    createdAt,
    offline: Boolean(options.offline),
    plan,
    discoveryProfile,
    scanned,
    knownUrlCount: knownUrls.size,
    candidateCount: visibleCandidates.length,
    rawCandidateCount: candidates.length,
    evaluatedCandidates: candidates,
    blockedCandidates,
    searchErrors,
    candidates: visibleCandidates.slice(0, discoveryProfile.limit),
    policySummary,
    policyCalibration
  };

  Object.assign(discovery, buildDiscoveryRunFields(discovery.candidates, alignmentRules));

  return discovery;
}

export { loadWatchlistUrls } from "./shared.mjs";
