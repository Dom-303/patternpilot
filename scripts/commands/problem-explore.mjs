import fs from "node:fs/promises";
import path from "node:path";
import { buildGenerateFn } from "../shared/llm-provider.mjs";
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
import {
  buildLandscapeQueryPlans,
  buildLandscapeAgentView,
  buildLandscapeTechStatus
} from "../../lib/landscape/enrichment.mjs";

async function loadCandidateRepos({ rootDir, config, projectKey, slug, problem, skipDiscovery, options }) {
  if (skipDiscovery) {
    return { repos: [], queries: [], note: "skip_discovery" };
  }

  const depth = options.depth ?? "standard";
  const profile = resolveDiscoveryProfile(depth);
  const totalBudget = profile.limit;
  const split = splitBudget({ totalBudget, standalone: true });

  const problemQueries = buildProblemQueryFamily({
    seeds: problem.derived.query_seeds ?? [],
    budget: split.problem
  });

  const queries = problemQueries;

  if (queries.length === 0) {
    return { repos: [], queries: [], note: "problem_query_family: empty(reason: no_seeds)" };
  }

  const passResult = await runDiscoveryPass({
    config,
    projectKey,
    queries
  });

  if (passResult.error) {
    console.warn(`[problem:explore] discovery pass warning: ${passResult.error}`);
    return { repos: [], queries, note: passResult.error, passError: passResult.error };
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
    // applySoftBoost adds its boost to an existing score; start from 0 to extract just the boost.
    const boostOnly = applySoftBoost({ ...repo, score: 0 }, techTags).score;
    const score = combinedScore({ problemFit: pFit, standalone: true }) + boostOnly;
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
    queries,
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

  if (project) {
    const bindingPath = path.join(rootDir, "bindings", project, "PROJECT_BINDING.json");
    const exists = await fs.stat(bindingPath).then(() => true).catch(() => false);
    if (!exists) {
      console.error(`Project binding missing at ${bindingPath}.`);
      console.error("Either run bootstrap to restore the binding, or convert the problem to standalone by removing the 'project' field in its frontmatter and moving the directory to state/standalone-problems/.");
      process.exitCode = 2;
      return;
    }
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

  // Topmost Repo je Cluster — wird gebraucht fuer den agentView-Priority-Path,
  // ausserdem fuer den heuristischen Brief.
  const topRepoByCluster = {};
  for (const cluster of landscape.clusters ?? []) {
    if (cluster.members?.length > 0) {
      const top = cluster.members[0];
      topRepoByCluster[cluster.label] = top.url ?? top.html_url ?? top.id;
    }
  }

  // Renderer-seitige Sections: queryPlans / agentView / techStatus.
  // Ohne diese drei bleiben die neuen Cockpit-Night-Sections leer.
  const queryPlansValue = buildLandscapeQueryPlans(discoveryResult.queries ?? [], problem);
  output.queryPlans = queryPlansValue;
  output.agentView = buildLandscapeAgentView({
    problem,
    slug,
    project: problem?.project ?? project,
    clusters: output.clusters,
    topRepoByCluster,
    queryPlans: queryPlansValue
  });
  output.techStatus = buildLandscapeTechStatus({
    queries: discoveryResult.queries ?? [],
    candidateCount: reposWithKeywords.length,
    clusterCount: output.clusters.length,
    outlierCount: output.outliers.length,
    passError: discoveryResult.passError ?? null,
    landscapeSignal: output.landscape_signal
  });

  await fs.writeFile(path.join(landscapeDir, "landscape.json"), `${JSON.stringify(output, null, 2)}\n`);

  // Optionally augment with LLM
  let llmAugmentation = null;
  if (options.withLlm) {
    const { augmentLandscape } = await import("../../lib/brief/llm.mjs");
    const generate = await buildGenerateFn(config);
    llmAugmentation = await augmentLandscape({
      landscape: { clusters: landscape.clusters },
      cacheDir: landscapeDir,
      generate
    });
    output.llm_augmentation = llmAugmentation;
    await fs.writeFile(path.join(landscapeDir, "landscape.json"), `${JSON.stringify(output, null, 2)}\n`);
  }

  // Write brief.md
  const { buildHeuristicBrief } = await import("../../lib/brief/heuristic.mjs");
  const briefMd = buildHeuristicBrief({ problem, landscape: output, topRepoByCluster, llmAugmentation });
  await fs.writeFile(path.join(landscapeDir, "brief.md"), briefMd);

  // Zielrepo-Kontext fuer die HTML-Sicht laden (falls ein Projekt gebunden
  // ist). Stellt die gleiche Parity-Section bereit wie im Discovery-Report:
  // welche Projekt-Dateien Pattern Pilot wirklich gelesen hat.
  let projectProfile = null;
  let binding = null;
  if (project) {
    try {
      const { loadProjectBinding, loadProjectProfile } = await import("../../lib/project.mjs");
      const bindingInfo = await loadProjectBinding(rootDir, config, project);
      binding = bindingInfo?.binding ?? null;
      if (binding) {
        projectProfile = await loadProjectProfile(rootDir, project, binding);
      }
    } catch (err) {
      console.warn(`[problem-explore] could not load project context: ${err.message}`);
    }
  }

  // Write landscape.html
  const { renderLandscapeHtml } = await import("../../lib/landscape/html-report.mjs");
  const html = renderLandscapeHtml({ problem, landscape: output, runId, projectProfile, binding });
  const landscapeHtmlPath = path.join(landscapeDir, "landscape.html");
  await fs.writeFile(landscapeHtmlPath, html);

  if (project) {
    const {
      buildBrowserLinkTarget,
      pushBrowserLink,
      resolveProjectReportRoot
    } = await import("../../lib/report-output.mjs");
    const reportRoot = resolveProjectReportRoot(rootDir, project);
    try {
      await fs.mkdir(reportRoot, { recursive: true });
      await pushBrowserLink(
        path.join(reportRoot, "browser-link"),
        {
          section: "problem-explore",
          key: slug,
          label: slug,
          href: buildBrowserLinkTarget(path.resolve(landscapeHtmlPath))
        }
      );
    } catch (error) {
      console.warn(`[problem-explore] could not update browser-link: ${error.message}`);
    }
  }

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
