import fs from "node:fs/promises";
import path from "node:path";
import { resolveProblemDir } from "./paths.mjs";
import { parseProblemMarkdown } from "./parser.mjs";
import { buildDerived } from "./derived.mjs";

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

function buildProblemJson({ frontmatter, fields, derived, latestLandscape, lastExploreResult }) {
  return {
    slug: frontmatter.slug,
    title: frontmatter.title,
    status: frontmatter.status ?? "active",
    project: frontmatter.project ?? null,
    created_at: frontmatter.created_at ?? null,
    updated_at: new Date().toISOString().slice(0, 10),
    latest_landscape: latestLandscape ?? null,
    last_explore_result: lastExploreResult ?? null,
    fields,
    derived
  };
}

export async function writeProblem({ rootDir, projectKey, slug, markdown }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, "problem.md"), markdown);
  await refreshProblemJson({ rootDir, projectKey, slug });
}

export async function refreshProblemJson({ rootDir, projectKey, slug }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const markdown = await fs.readFile(path.join(dir, "problem.md"), "utf8");
  const { frontmatter, fields } = parseProblemMarkdown(markdown);
  const derived = buildDerived({ title: frontmatter.title, fields });

  const jsonPath = path.join(dir, "problem.json");
  let latestLandscape = null;
  let lastExploreResult = null;
  try {
    const existing = JSON.parse(await fs.readFile(jsonPath, "utf8"));
    latestLandscape = existing.latest_landscape ?? null;
    lastExploreResult = existing.last_explore_result ?? null;
  } catch {
    // no existing file — defaults stay null
  }

  const json = buildProblemJson({ frontmatter, fields, derived, latestLandscape, lastExploreResult });
  await fs.writeFile(jsonPath, `${JSON.stringify(json, null, 2)}\n`);
  return json;
}

export async function readProblem({ rootDir, projectKey, slug }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const raw = await fs.readFile(path.join(dir, "problem.json"), "utf8");
  return JSON.parse(raw);
}

export async function updateProblemPointer({ rootDir, projectKey, slug, latestLandscape, lastExploreResult }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const jsonPath = path.join(dir, "problem.json");
  const current = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  if (latestLandscape !== undefined) current.latest_landscape = latestLandscape;
  if (lastExploreResult !== undefined) current.last_explore_result = lastExploreResult;
  current.updated_at = new Date().toISOString().slice(0, 10);
  await fs.writeFile(jsonPath, `${JSON.stringify(current, null, 2)}\n`);
  return current;
}
