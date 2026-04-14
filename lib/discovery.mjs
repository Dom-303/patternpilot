import fs from "node:fs/promises";
import path from "node:path";
import { DISCOVERY_STOPWORDS, resolveDiscoveryProfile } from "./constants.mjs";
import { uniqueStrings, clamp, safeReadText } from "./utils.mjs";
import { resolveGithubToken, createHeaders, fetchJsonWithRetry, enrichGithubRepo } from "./github.mjs";
import { normalizeGithubUrl, loadQueueEntries } from "./queue.mjs";
import { resolveLandkartePath } from "./config.mjs";
import {
  evaluateDiscoveryCandidatePolicy,
  summarizeDiscoveryPolicyResults,
  buildDiscoveryPolicyCalibration
} from "./discovery-policy.mjs";
import {
  deriveActivityStatus,
  buildClassificationText,
  guessClassification,
  buildProjectAlignment,
  buildLandkarteCandidate,
  buildCandidateEvaluation,
  deriveDisposition,
  buildRunConfidence,
  normalizeGapAreaCanonical,
  buildRunGapSignals
} from "./classification.mjs";

function parseCandidateRisks(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function decorateDiscoveryCandidate(candidate, alignmentRules) {
  const evaluation = buildCandidateEvaluation(
    candidate.repo,
    candidate.guess,
    candidate.enrichment,
    candidate.projectAlignment,
    alignmentRules
  );
  const { disposition, dispositionReason } = deriveDisposition(
    evaluation,
    candidate.risks ?? [],
    candidate.projectAlignment?.fitBand ?? "unknown"
  );

  Object.assign(candidate, {
    gapAreaCanonical: normalizeGapAreaCanonical(candidate.guess?.gapArea, alignmentRules),
    effortBand: evaluation.effortBand,
    effortScore: evaluation.effortScore,
    valueBand: evaluation.valueBand,
    valueScore: evaluation.valueScore,
    discoveryDisposition: disposition,
    dispositionReason,
    decisionDataState: "complete",
    decisionSummary: evaluation.decisionSummary,
    effortReasons: evaluation.effortReasons,
    valueReasons: evaluation.valueReasons
  });

  return candidate;
}

export function buildDiscoveryRunFields(candidates, alignmentRules) {
  const confidence = buildRunConfidence(candidates, alignmentRules?.capabilities?.length ?? 0);
  const itemsDataStateSummary = candidates.reduce(
    (acc, candidate) => {
      const state = candidate?.decisionDataState ?? "complete";
      acc[state] = (acc[state] ?? 0) + 1;
      return acc;
    },
    { complete: 0, fallback: 0, stale: 0 }
  );

  return {
    reportSchemaVersion: 2,
    runConfidence: confidence.runConfidence,
    runConfidenceReason: confidence.runConfidenceReason,
    confidenceFactors: confidence.confidenceFactors,
    itemsDataStateSummary,
    runGapSignals: buildRunGapSignals(candidates, alignmentRules)
  };
}

function buildPolicyPreview(candidates = [], limit = 6) {
  return candidates.slice(0, limit).map((candidate) => ({
    repoRef: candidate?.full_name ?? `${candidate?.repo?.owner ?? "unknown"}/${candidate?.repo?.name ?? "unknown"}`,
    blockers: candidate?.discoveryPolicyGate?.blockers ?? [],
    summary: candidate?.discoveryPolicyGate?.summary ?? "blocked"
  }));
}

export function applyDiscoveryPolicyToCandidates(candidates = [], discoveryPolicy, mode = "enforce") {
  const normalizedMode = ["enforce", "audit", "off"].includes(mode) ? mode : "enforce";

  if (!discoveryPolicy || normalizedMode === "off") {
    const policySummary = {
      enabled: false,
      mode: "off",
      evaluated: candidates.length,
      visible: candidates.length,
      allowed: candidates.length,
      blocked: 0,
      preferred: 0,
      blockerCounts: [],
      preferenceCounts: [],
      blockedPreview: [],
      enforcedBlocked: 0
    };
    return {
      visibleCandidates: candidates,
      blockedCandidates: [],
      policySummary,
      policyCalibration: buildDiscoveryPolicyCalibration(policySummary)
    };
  }

  const policyEvaluations = [];
  const blockedCandidates = [];
  const allowedCandidates = [];

  for (const candidate of candidates) {
    const policyGate = evaluateDiscoveryCandidatePolicy(candidate, discoveryPolicy);
    candidate.discoveryPolicyGate = policyGate;
    policyEvaluations.push(policyGate);
    if (policyGate.allowed) {
      allowedCandidates.push(candidate);
    } else {
      blockedCandidates.push(candidate);
    }
  }

  const visibleCandidates = normalizedMode === "audit" ? candidates : allowedCandidates;
  const summary = summarizeDiscoveryPolicyResults(policyEvaluations);
  const policySummary = {
    enabled: true,
    mode: normalizedMode,
    visible: visibleCandidates.length,
    ...summary,
    blockedPreview: buildPolicyPreview(blockedCandidates),
    enforcedBlocked: normalizedMode === "enforce" ? blockedCandidates.length : 0
  };

  return {
    visibleCandidates,
    blockedCandidates,
    policySummary,
    policyCalibration: buildDiscoveryPolicyCalibration(policySummary)
  };
}

function normalizeImportedRepoCandidate(seed = {}, index = 0) {
  const normalizedUrl = seed.normalizedRepoUrl || seed.repoUrl || seed.url || seed.html_url || "";
  let owner = seed.owner ?? seed.repo?.owner ?? "";
  let name = seed.name ?? seed.repo?.name ?? "";
  let fullName = seed.full_name ?? seed.fullName ?? seed.repoRef ?? "";

  if ((!owner || !name) && normalizedUrl) {
    try {
      const normalized = normalizeGithubUrl(normalizedUrl);
      owner = owner || normalized.owner;
      name = name || normalized.name;
      fullName = fullName || `${normalized.owner}/${normalized.name}`;
      return {
        owner: normalized.owner,
        name: normalized.name,
        normalizedRepoUrl: normalized.normalizedRepoUrl,
        slug: normalized.slug,
        host: normalized.host,
        fullName,
        description: seed.description ?? "",
        homepage: seed.homepage ?? "",
        topics: seed.topics ?? [],
        defaultBranch: seed.defaultBranch ?? "",
        visibility: seed.visibility ?? "public",
        archived: Boolean(seed.archived),
        fork: Boolean(seed.fork),
        stars: Number(seed.stars ?? 0) || 0,
        forks: Number(seed.forks ?? 0) || 0,
        openIssues: Number(seed.openIssues ?? 0) || 0,
        watchers: Number(seed.watchers ?? 0) || 0,
        language: seed.language ?? "",
        license: seed.license ?? "",
        createdAt: seed.createdAt ?? "",
        updatedAt: seed.updatedAt ?? "",
        pushedAt: seed.pushedAt ?? ""
      };
    } catch {
      // fall through to manual parsing below
    }
  }

  if ((!owner || !name) && fullName.includes("/")) {
    const [parsedOwner, parsedName] = fullName.split("/", 2);
    owner = owner || parsedOwner;
    name = name || parsedName;
  }

  owner = owner || `imported-owner-${index + 1}`;
  name = name || `imported-repo-${index + 1}`;
  fullName = fullName || `${owner}/${name}`;

  return {
    owner,
    name,
    normalizedRepoUrl: normalizedUrl || `https://github.com/${owner}/${name}`,
    slug: `${owner}__${name}`.toLowerCase(),
    host: "github.com",
    fullName,
    description: seed.description ?? "",
    homepage: seed.homepage ?? "",
    topics: seed.topics ?? [],
    defaultBranch: seed.defaultBranch ?? "",
    visibility: seed.visibility ?? "public",
    archived: Boolean(seed.archived),
    fork: Boolean(seed.fork),
    stars: Number(seed.stars ?? 0) || 0,
    forks: Number(seed.forks ?? 0) || 0,
    openIssues: Number(seed.openIssues ?? 0) || 0,
    watchers: Number(seed.watchers ?? 0) || 0,
    language: seed.language ?? "",
    license: seed.license ?? "",
    createdAt: seed.createdAt ?? "",
    updatedAt: seed.updatedAt ?? "",
    pushedAt: seed.pushedAt ?? ""
  };
}

function buildImportedEnrichment(repoData, seed = {}, meta = {}) {
  return {
    status: "success",
    source: meta.source ?? "imported_candidates",
    authMode: meta.authMode ?? "offline",
    authSource: meta.authSource ?? null,
    fetchedAt: meta.fetchedAt ?? new Date().toISOString(),
    repo: {
      fullName: repoData.fullName ?? `${repoData.owner}/${repoData.name}`,
      description: seed.description ?? repoData.description ?? "",
      homepage: seed.homepage ?? repoData.homepage ?? "",
      topics: seed.topics ?? repoData.topics ?? [],
      defaultBranch: seed.defaultBranch ?? repoData.defaultBranch ?? "",
      visibility: seed.visibility ?? repoData.visibility ?? "public",
      archived: Boolean(seed.archived ?? repoData.archived),
      fork: Boolean(seed.fork ?? repoData.fork),
      stars: seed.stars ?? repoData.stars ?? 0,
      forks: seed.forks ?? repoData.forks ?? 0,
      openIssues: seed.openIssues ?? repoData.openIssues ?? 0,
      watchers: seed.watchers ?? repoData.watchers ?? 0,
      language: seed.language ?? repoData.language ?? "",
      license: seed.license ?? repoData.license ?? "",
      createdAt: seed.createdAt ?? repoData.createdAt ?? "",
      updatedAt: seed.updatedAt ?? repoData.updatedAt ?? "",
      pushedAt: seed.pushedAt ?? repoData.pushedAt ?? ""
    },
    languages: seed.languages ?? (repoData.language ? [repoData.language] : []),
    readme: {
      path: null,
      htmlUrl: null,
      excerpt: seed.readmeExcerpt ?? seed.readme?.excerpt ?? ""
    }
  };
}

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

function buildDiscoveryPlan(binding, alignmentRules, projectProfile, options = {}) {
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

async function loadKnownRepoUrls(rootDir, config, project) {
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

function buildDiscoveryReasoning(candidate, domainKeywords) {
  const reasons = [];
  if (candidate.queryLabels.length > 0) {
    reasons.push(`Matched discovery lenses: ${candidate.queryLabels.join(", ")}.`);
  }
  if (candidate.projectAlignment?.fitBand) {
    reasons.push(
      `Project fit is ${candidate.projectAlignment.fitBand} (${candidate.projectAlignment.fitScore}).`
    );
  }
  if (candidate.projectAlignment?.matchedCapabilities?.length > 0) {
    reasons.push(
      `Matched capabilities: ${candidate.projectAlignment.matchedCapabilities.join(", ")}.`
    );
  }
  if (candidate.enrichment?.repo?.stars) {
    reasons.push(`Stars: ${candidate.enrichment.repo.stars}.`);
  }
  const keywordHits = domainKeywords.filter((keyword) =>
    buildClassificationText(candidate.repo, candidate.enrichment).toLowerCase().includes(keyword)
  );
  if (keywordHits.length > 0) {
    reasons.push(`Project-keyword overlap: ${keywordHits.slice(0, 5).join(", ")}.`);
  }
  if (candidate.enrichment?.repo?.archived) {
    reasons.push("Archived repos are downgraded to pattern-signal only.");
  }
  return reasons;
}

function scoreDiscoveryCandidate(candidate, domainKeywords) {
  let score = 12;
  score += candidate.queryLabels.length * 8;
  score += discoveryStarScore(candidate.enrichment?.repo?.stars ?? 0);
  score += discoveryActivityScore(candidate.enrichment);
  score += Math.round((candidate.projectAlignment?.fitScore ?? 0) * 0.45);
  score += (candidate.projectAlignment?.matchedCapabilities?.length ?? 0) * 5;

  const repoText = buildClassificationText(candidate.repo, candidate.enrichment).toLowerCase();
  const keywordHits = domainKeywords.filter((keyword) => repoText.includes(keyword)).length;
  score += Math.min(keywordHits * 2, 12);

  if (candidate.enrichment?.repo?.fork) {
    score -= 12;
  }
  if (candidate.enrichment?.repo?.archived) {
    score -= 20;
  }
  if (candidate.guess.buildVsBorrow === "adapt_pattern") {
    score += 6;
  }
  if (candidate.guess.priority === "now") {
    score += 6;
  }

  return clamp(score, 0, 100);
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
  const existingContent = await safeReadText(watchlistPath);
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

export async function discoverImportedCandidates(
  rootDir,
  config,
  project,
  binding,
  alignmentRules,
  projectProfile,
  importPayload,
  options = {}
) {
  const createdAt = new Date().toISOString();
  const plan = buildDiscoveryPlan(binding, alignmentRules, projectProfile, options);
  const seeds = Array.isArray(importPayload)
    ? importPayload
    : Array.isArray(importPayload?.candidates)
      ? importPayload.candidates
      : [];
  const importLabel = importPayload?.label ?? importPayload?.source ?? options.file ?? "imported-candidates";
  const knownUrls = await loadKnownRepoUrls(rootDir, config, project);
  const candidates = [];

  for (const [index, seed] of seeds.entries()) {
    const repo = normalizeImportedRepoCandidate(seed, index);
    const enrichment = seed.enrichment ?? buildImportedEnrichment(repo, seed, {
      source: "imported_candidates",
      authMode: "offline",
      fetchedAt: createdAt
    });
    const guess = seed.guess ?? guessClassification(repo, enrichment);
    const projectAlignment = seed.projectAlignment ?? buildProjectAlignment(
      repo,
      guess,
      enrichment,
      projectProfile,
      alignmentRules
    );
    const landkarteCandidate = buildLandkarteCandidate(repo, guess, enrichment);
    const candidate = {
      repo,
      enrichment,
      guess,
      landkarteCandidate,
      risks: parseCandidateRisks(seed.risks ?? landkarteCandidate?.risks),
      projectAlignment,
      queryIds: seed.queryIds ?? ["imported_candidates"],
      queryLabels: seed.queryLabels ?? [importLabel],
      capabilityIds: seed.capabilityIds ?? [],
      discoveryScore: Number(seed.discoveryScore ?? 0) || 0,
      discoveryDisposition: "watch_only",
      reasoning: Array.isArray(seed.reasoning) ? seed.reasoning : [],
      importedCandidate: true,
      alreadyKnown: knownUrls.has(repo.normalizedRepoUrl)
    };
    candidate.discoveryScore = candidate.discoveryScore || scoreDiscoveryCandidate(candidate, plan.domainKeywords);
    decorateDiscoveryCandidate(candidate, alignmentRules);
    if (candidate.reasoning.length === 0) {
      candidate.reasoning = buildDiscoveryReasoning(candidate, plan.domainKeywords);
    }
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
    offline: true,
    imported: true,
    importSource: importLabel,
    plan: {
      ...plan,
      plans: [
        {
          id: "imported-candidates",
          label: "Imported candidates",
          capabilityId: null,
          query: importLabel,
          terms: [importLabel],
          reasons: ["Built from an imported candidate fixture instead of a live GitHub search."]
        }
      ]
    },
    discoveryProfile: plan.discoveryProfile,
    scanned: candidates.length,
    knownUrlCount: knownUrls.size,
    candidateCount: visibleCandidates.length,
    rawCandidateCount: candidates.length,
    evaluatedCandidates: candidates,
    blockedCandidates,
    searchErrors: [],
    candidates: visibleCandidates.slice(0, plan.discoveryProfile.limit),
    policySummary,
    policyCalibration
  };

  Object.assign(discovery, buildDiscoveryRunFields(discovery.candidates, alignmentRules));

  return discovery;
}
