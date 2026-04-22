import fs from "node:fs/promises";
import path from "node:path";
import { resolveProblemDir } from "./paths.mjs";
import { readProblem } from "./store.mjs";

async function setStatus({ rootDir, projectKey, slug, status }) {
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const jsonPath = path.join(dir, "problem.json");
  const current = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  current.status = status;
  current.updated_at = new Date().toISOString().slice(0, 10);
  await fs.writeFile(jsonPath, `${JSON.stringify(current, null, 2)}\n`);

  const mdPath = path.join(dir, "problem.md");
  let md = await fs.readFile(mdPath, "utf8");
  md = md.replace(/^status:\s*.*$/m, `status: ${status}`);
  await fs.writeFile(mdPath, md);
}

function buildResolutionMarkdown({ problem, note, landscapeRef }) {
  const resolvedAt = new Date().toISOString().slice(0, 10);
  const landscapeLine = landscapeRef ? `landscape_ref: ${landscapeRef}\n` : "";
  return `---
problem: ${problem.slug}
resolved_at: ${resolvedAt}
${landscapeLine}---

## chosen_approach
${note ?? ""}

## why
<why this approach won over alternatives>

## links_to_cluster
- <cluster label or landscape reference>
`;
}

export async function resolveProblem({ rootDir, projectKey, slug, note }) {
  await setStatus({ rootDir, projectKey, slug, status: "resolved" });
  if (!note) return;
  const problem = await readProblem({ rootDir, projectKey, slug });
  const dir = resolveProblemDir({ rootDir, projectKey, slug });
  const markdown = buildResolutionMarkdown({
    problem,
    note,
    landscapeRef: problem.latest_landscape ?? null
  });
  await fs.writeFile(path.join(dir, "resolution.md"), markdown);
}

export async function archiveProblem({ rootDir, projectKey, slug }) {
  await setStatus({ rootDir, projectKey, slug, status: "archived" });
}
