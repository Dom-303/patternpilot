import fs from "node:fs/promises";
import path from "node:path";
import { buildLandscape } from "../../lib/clustering/landscape.mjs";
import { extractRepoKeywords } from "../../lib/clustering/keywords.mjs";
import { refreshProblemJson, readProblem, updateProblemPointer } from "../../lib/problem/store.mjs";
import { resolveLandscapeDir } from "../../lib/problem/paths.mjs";

async function loadCandidateRepos({ rootDir, projectKey, slug, skipDiscovery }) {
  if (skipDiscovery) return [];
  // Task 26 will wire real discovery here
  return [];
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

  const rawRepos = await loadCandidateRepos({ rootDir, projectKey: project, slug, skipDiscovery });

  if (rawRepos.length === 0) {
    await updateProblemPointer({ rootDir, projectKey: project, slug, lastExploreResult: "no_candidates" });
    console.log("No candidates — landscape not written. Check query seeds.");
    return;
  }

  const reposWithKeywords = rawRepos.map((repo) => ({ ...repo, keywords: extractRepoKeywords(repo) }));

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
    axis_view: landscape.axis_view ?? null
  };

  await fs.writeFile(path.join(landscapeDir, "landscape.json"), `${JSON.stringify(output, null, 2)}\n`);

  await updateProblemPointer({
    rootDir,
    projectKey: project,
    slug,
    latestLandscape: `landscape/${runId}`,
    lastExploreResult: "ok"
  });

  console.log(`Wrote landscape to ${landscapeDir}/landscape.json`);
}
