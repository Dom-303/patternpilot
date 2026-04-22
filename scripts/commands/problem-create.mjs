import fs from "node:fs/promises";
import path from "node:path";
import { buildSlug, validateSlug } from "../../lib/problem/slug.mjs";
import { buildProblemTemplate } from "../../lib/problem/template.mjs";
import { writeProblem } from "../../lib/problem/store.mjs";
import { resolveProblemDir } from "../../lib/problem/paths.mjs";

export async function runProblemCreate(rootDir, config, options) {
  const project = options.project ?? null;
  const title = options.title ?? null;
  const explicitSlug = options.slug ?? null;

  if (!title) {
    console.error("problem:create requires --title \"...\"");
    process.exitCode = 2;
    return;
  }
  const slug = explicitSlug ?? buildSlug(title);
  if (!validateSlug(slug)) {
    console.error(`Invalid slug: ${slug}. Use lowercase, dashes, no underscores.`);
    process.exitCode = 2;
    return;
  }

  const dir = resolveProblemDir({ rootDir, projectKey: project, slug });
  const exists = await fs.stat(dir).then(() => true).catch(() => false);
  if (exists) {
    console.error(`Problem already exists at ${dir}. Use a different --slug or delete manually.`);
    process.exitCode = 2;
    return;
  }

  const markdown = buildProblemTemplate({
    slug,
    title,
    projectKey: project,
    createdAt: new Date().toISOString().slice(0, 10)
  });
  await writeProblem({ rootDir, projectKey: project, slug, markdown });

  console.log(`Created problem at ${path.join(dir, "problem.md")}`);
  console.log("Edit the markdown, then run: npm run patternpilot -- problem-refresh " + slug);
}
