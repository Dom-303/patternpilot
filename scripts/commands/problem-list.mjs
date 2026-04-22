import fs from "node:fs/promises";
import path from "node:path";

async function readProblemDirs(rootDir) {
  const entries = [];
  const projectsDir = path.join(rootDir, "projects");
  try {
    const projects = await fs.readdir(projectsDir);
    for (const project of projects) {
      const problemsDir = path.join(projectsDir, project, "problems");
      const exists = await fs.stat(problemsDir).then(() => true).catch(() => false);
      if (!exists) continue;
      const slugs = await fs.readdir(problemsDir);
      for (const slug of slugs) entries.push({ project, slug, dir: path.join(problemsDir, slug) });
    }
  } catch { /* no projects yet */ }

  const standaloneRoot = path.join(rootDir, "state", "standalone-problems");
  try {
    const slugs = await fs.readdir(standaloneRoot);
    for (const slug of slugs) entries.push({ project: null, slug, dir: path.join(standaloneRoot, slug) });
  } catch { /* none */ }

  return entries;
}

async function loadProblemJson(dir) {
  try {
    return JSON.parse(await fs.readFile(path.join(dir, "problem.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function runProblemList(rootDir, config, options) {
  const project = options.project ?? null;
  const status = options.status ?? "active";
  const all = await readProblemDirs(rootDir);
  const rows = [];
  for (const entry of all) {
    if (project && entry.project !== project) continue;
    const json = await loadProblemJson(entry.dir);
    if (!json) continue;
    if (status !== "all" && json.status !== status) continue;
    rows.push({
      project: json.project ?? "(standalone)",
      slug: json.slug,
      status: json.status,
      title: json.title,
      latest: json.latest_landscape ?? "-",
      last_result: json.last_explore_result ?? "-"
    });
  }

  if (rows.length === 0) {
    console.log("(no problems match)");
    return;
  }

  console.log(`${"project".padEnd(20)} ${"slug".padEnd(26)} ${"status".padEnd(9)} ${"latest".padEnd(34)} title`);
  for (const r of rows) {
    console.log(`${r.project.padEnd(20)} ${r.slug.padEnd(26)} ${r.status.padEnd(9)} ${r.latest.padEnd(34)} ${r.title}`);
  }
}
