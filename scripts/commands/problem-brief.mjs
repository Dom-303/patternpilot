// scripts/commands/problem-brief.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { readProblem } from "../../lib/problem/store.mjs";
import { resolveLandscapeDir } from "../../lib/problem/paths.mjs";
import { buildHeuristicBrief } from "../../lib/brief/heuristic.mjs";
import { buildGenerateFn } from "../shared/llm-provider.mjs";

export async function runProblemBrief(rootDir, config, options) {
  const slug = options.urls[0] ?? null;
  const project = options.project ?? null;
  const run = options.run ?? null;

  if (!slug) {
    console.error("problem:brief requires <slug>");
    process.exitCode = 2;
    return;
  }

  const problem = await readProblem({ rootDir, projectKey: project, slug });
  const runId = run ?? problem.latest_landscape?.replace(/^landscape\//, "") ?? null;

  if (!runId) {
    console.error("No landscape run specified and none recorded. Run problem:explore first.");
    process.exitCode = 2;
    return;
  }

  const landscapeDir = resolveLandscapeDir({ rootDir, projectKey: project, slug, runId });
  const landscape = JSON.parse(await fs.readFile(path.join(landscapeDir, "landscape.json"), "utf8"));

  const topRepoByCluster = {};
  for (const c of landscape.clusters) {
    topRepoByCluster[c.label] = c.member_ids?.[0] ?? null;
  }

  let llmAugmentation = null;
  if (options.withLlm) {
    const { augmentLandscape } = await import("../../lib/brief/llm.mjs");
    const generate = await buildGenerateFn(config);
    llmAugmentation = await augmentLandscape({
      landscape: { clusters: landscape.clusters },
      cacheDir: landscapeDir,
      generate
    });
  }

  const markdown = buildHeuristicBrief({ problem, landscape, topRepoByCluster, llmAugmentation });
  await fs.writeFile(path.join(landscapeDir, "brief.md"), markdown);
  console.log(`Brief rewritten at ${landscapeDir}/brief.md`);
}
