import fs from "node:fs/promises";
import path from "node:path";
import { refreshProblemJson } from "../../lib/problem/store.mjs";
import { resolveProblemDir } from "../../lib/problem/paths.mjs";

async function findProblemProject({ rootDir, slug }) {
  const projectsDir = path.join(rootDir, "projects");
  try {
    const projects = await fs.readdir(projectsDir);
    for (const project of projects) {
      const candidate = path.join(projectsDir, project, "problems", slug);
      const exists = await fs.stat(candidate).then(() => true).catch(() => false);
      if (exists) return project;
    }
  } catch { /* projects dir missing */ }

  const standalone = path.join(rootDir, "state", "standalone-problems", slug);
  const standaloneExists = await fs.stat(standalone).then(() => true).catch(() => false);
  if (standaloneExists) return null;

  throw new Error(`Problem ${slug} not found in any project or standalone`);
}

export async function runProblemRefresh(rootDir, config, options) {
  const explicitProject = options.project ?? null;
  const slug = options.urls?.[0] ?? null;
  if (!slug) {
    console.error("problem:refresh requires <slug>");
    process.exitCode = 2;
    return;
  }
  const project = explicitProject ?? await findProblemProject({ rootDir, slug });
  await refreshProblemJson({ rootDir, projectKey: project, slug });
  const dir = resolveProblemDir({ rootDir, projectKey: project, slug });
  console.log(`Refreshed ${dir}/problem.json`);
}
