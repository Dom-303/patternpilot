// lib/problem/paths.mjs
import path from "node:path";

export function isStandalone(problem) {
  return !problem?.projectKey;
}

export function resolveProblemDir({ rootDir, projectKey, slug }) {
  if (!rootDir || !slug) {
    throw new Error("resolveProblemDir requires rootDir and slug");
  }
  if (projectKey) {
    return path.join(rootDir, "projects", projectKey, "problems", slug);
  }
  return path.join(rootDir, "state", "standalone-problems", slug);
}

export function resolveLandscapeDir({ rootDir, projectKey, slug, runId }) {
  return path.join(resolveProblemDir({ rootDir, projectKey, slug }), "landscape", runId);
}
