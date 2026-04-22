import fs from "node:fs/promises";
import path from "node:path";
import { buildLandscape } from "../../lib/clustering/landscape.mjs";
import { extractRepoKeywords } from "../../lib/clustering/keywords.mjs";
import { refreshProblemJson, readProblem, updateProblemPointer } from "../../lib/problem/store.mjs";
import { resolveLandscapeDir } from "../../lib/problem/paths.mjs";
import { resolveDiscoveryProfile } from "../../lib/constants.mjs";
import {
  buildProblemQueryFamily,
  splitBudget
} from "../../lib/discovery/problem-queries.mjs";
import { applyHardConstraints, applySoftBoost } from "../../lib/discovery/problem-constraints.mjs";
import { problemFit as computeProblemFit, combinedScore } from "../../lib/discovery/problem-ranking.mjs";
import { selectWithDiversity } from "../../lib/discovery/problem-diversity.mjs";
import { runDiscoveryPass } from "../../lib/discovery/pass.mjs";

async function loadCandidateRepos({ rootDir, config, projectKey, slug, problem, skipDiscovery, options }) {
  if (skipDiscovery) {
    return { repos: [], note: "skip_discovery" };
  }

  const depth = options.depth ?? "standard";
  const profile = resolveDiscoveryProfile(depth);
  const totalBudget = profile.limit;
  const standalone = !projectKey;
  const split = splitBudget({ totalBudget, standalone });

  const problemQueries = buildProblemQueryFamily({
    seeds: problem.derived.query_seeds ?? [],
    budget: split.problem
  });

  // TODO: add cross-family queries when project seeds are loaded
  const queries = problemQueries;

  if (queries.length === 0) {
    return { repos: [], note: "problem_query_family: empty(reason: no_seeds)" };
  }

  const passResult = await runDiscoveryPass({
    rootDir,
    config,
    projectKey,
    queries,
    depth,
    standalone
  });

  if (passResult.error) {
    console.warn(`[problem:explore] discovery pass warning: ${passResult.error}`);
    return { repos: [], note: passResult.error };
  }

  const rawRepos = passResult.repos ?? [];

  // Attach keywords to each repo so the primitives can consume them
  const withKeywords = rawRepos.map((repo) => ({
    ...repo,
    keywords: extractRepoKeywords(repo)
  }));

  // Apply hard constraints (e.g. license filters)
  const filtered = applyHardConstraints(withKeywords, problem.derived.constraint_tags ?? []);

  // Score each filtered repo
  const problemTokens = problem.derived.query_seeds ?? [];
  const techTags = problem.derived.tech_tags ?? [];
  const scored = filtered.map((repo) => {
    const pFit = computeProblemFit(repo, problemTokens);
    const boosted = applySoftBoost({ ...repo, score: 0 }, techTags);
    const score = combinedScore({ problemFit: pFit, standalone: true }) + (boosted.score - 0);
    return { ...repo, problemFit: pFit, score };
  });

  const windowSize = Math.min(20, totalBudget);
  const selection = selectWithDiversity({
    repos: scored,
    signature: problem.derived.approach_signature ?? [],
    windowSize,
    divergenceThreshold: 0.3,
    minProblemFit: 0.4
  });

  return {
    repos: selection.selected,
    selectedByScore: selection.selectedByScore,
    selectedByDivergence: selection.selectedByDivergence,
    diversity_gap: selection.diversity_gap
  };
}

export async function runProblemExplore(rootDir, config, options) {
  const slug = options.urls[0] ?? null;
  const project = options.project ?? null;
  const skipDiscovery = options.skipDiscovery ?? false;

  if (!slug) {
    console.error("problem:explore requires <slug>");
    process.exitCode = 2;
    return;
  }

  await refreshProblemJson({ rootDir, projectKey: project, slug });
  const problem = await readProblem({ rootDir, projectKey: project, slug });

  const discoveryResult = await loadCandidateRepos({
    rootDir,
    config,
    projectKey: project,
    slug,
    problem,
    skipDiscovery,
    options
  });
  const rawRepos = discoveryResult.repos ?? [];

  if (rawRepos.length === 0) {
    await updateProblemPointer({ rootDir, projectKey: project, slug, lastExploreResult: "no_candidates" });
    console.log("No candidates — landscape not written. Check query seeds.");
    return;
  }

  // repos from loadCandidateRepos already carry keywords; re-extract for the
  // skipDiscovery path where rawRepos may come from external callers without them.
  const reposWithKeywords = rawRepos.map((repo) => ({
    ...repo,
    keywords: repo.keywords instanceof Set ? repo.keywords : extractRepoKeywords(repo)
  }));

  const landscape = buildLandscape({
    repos: reposWithKeywords,
    problem: {
      approach_signature: problem.derived.approach_signature,
      suspected_approach_axes: problem.fields.suspected_approach_axes ?? []
    }
  });

  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  const landscapeDir = resolveLandscapeDir({ rootDir, projectKey: project, slug, runId });

  await fs.mkdir(landscapeDir, { recursive: true });

  const output = {
    run_id: runId,
    problem: slug,
    project: problem.project,
    generated_at: new Date().toISOString(),
    clusters: landscape.clusters
      ? landscape.clusters.map((c) => ({
          key: c.key,
          label: c.label,
          pattern_family: c.pattern_family ?? null,
          main_layer: c.main_layer ?? null,
          relation: c.relation,
          signature_contrast: c.signature_contrast,
          has_suggested_members: c.has_suggested_members ?? false,
          member_ids: c.members.map((m) => m.id)
        }))
      : [],
    outliers: landscape.outliers ? landscape.outliers.map((r) => r.id) : [],
    relation_counts: (() => {
      const counts = { near_current_approach: 0, adjacent: 0, divergent: 0 };
      if (landscape.clusters) {
        for (const c of landscape.clusters) counts[c.relation] = (counts[c.relation] ?? 0) + 1;
      }
      return counts;
    })(),
    landscape_signal: landscape.landscape_signal ?? null,
    axis_view: landscape.axis_view ?? null,
    selection: {
      by_score: discoveryResult.selectedByScore ?? null,
      by_divergence: discoveryResult.selectedByDivergence ?? null,
      diversity_gap: discoveryResult.diversity_gap ?? null,
      note: discoveryResult.note ?? null
    }
  };

  await fs.writeFile(path.join(landscapeDir, "landscape.json"), `${JSON.stringify(output, null, 2)}\n`);

  // Write brief.md
  const { buildHeuristicBrief } = await import("../../lib/brief/heuristic.mjs");
  const topRepoByCluster = {};
  for (const cluster of landscape.clusters) {
    if (cluster.members.length > 0) {
      // members are the raw repos with .url/.html_url; pick the first
      const top = cluster.members[0];
      topRepoByCluster[cluster.label] = top.url ?? top.html_url ?? top.id;
    }
  }
  const briefMd = buildHeuristicBrief({ problem, landscape: output, topRepoByCluster });
  await fs.writeFile(path.join(landscapeDir, "brief.md"), briefMd);

  // Write landscape.html
  const { renderLandscapeHtml } = await import("../../lib/landscape/html-report.mjs");
  const html = renderLandscapeHtml({ problem, landscape: output, runId });
  await fs.writeFile(path.join(landscapeDir, "landscape.html"), html);

  // Write clusters.csv
  const csvLines = ["label,pattern_family,main_layer,relation,member_count,signature_contrast"];
  for (const c of output.clusters) {
    const contrast = (c.signature_contrast ?? []).join("|");
    csvLines.push(`${c.label},${c.pattern_family ?? ""},${c.main_layer ?? ""},${c.relation},${c.member_ids.length},${contrast}`);
  }
  await fs.writeFile(path.join(landscapeDir, "clusters.csv"), `${csvLines.join("\n")}\n`);

  await updateProblemPointer({
    rootDir,
    projectKey: project,
    slug,
    latestLandscape: `landscape/${runId}`,
    lastExploreResult: "ok"
  });

  console.log(`Wrote landscape to ${landscapeDir}/landscape.json`);
}
