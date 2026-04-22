import { resolveProblem } from "../../lib/problem/lifecycle.mjs";

export async function runProblemResolve(rootDir, config, options) {
  const project = options.project ?? null;
  const slug = options.urls?.[0] ?? null;
  const note = options.note ?? null;
  if (!slug) {
    console.error("problem:resolve requires <slug>");
    process.exitCode = 2;
    return;
  }
  await resolveProblem({ rootDir, projectKey: project, slug, note });
  console.log(`Resolved ${slug}${note ? " with resolution.md" : ""}`);
}
