import { archiveProblem } from "../../lib/problem/lifecycle.mjs";

export async function runProblemArchive(rootDir, config, options) {
  const project = options.project ?? null;
  const slug = options.urls?.[0] ?? null;
  if (!slug) {
    console.error("problem:archive requires <slug>");
    process.exitCode = 2;
    return;
  }
  await archiveProblem({ rootDir, projectKey: project, slug });
  console.log(`Archived ${slug}`);
}
