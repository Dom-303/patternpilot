import {
  normalizeGithubUrl
} from "../queue.mjs";
import {
  guessClassification,
  buildProjectAlignment,
  buildLandkarteCandidate
} from "../classification.mjs";
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
  loadKnownRepoUrls
} from "./shared.mjs";

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
