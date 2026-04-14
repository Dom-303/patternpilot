import { normalizeGithubUrl } from "./queue.mjs";

export function indexPreloadedCandidates(candidates = []) {
  const index = new Map();
  for (const candidate of candidates) {
    const normalizedRepoUrl = candidate?.repo?.normalizedRepoUrl
      ?? candidate?.repoUrl
      ?? candidate?.normalizedRepoUrl;
    if (!normalizedRepoUrl) {
      continue;
    }
    try {
      const repo = normalizeGithubUrl(normalizedRepoUrl);
      index.set(repo.normalizedRepoUrl, candidate);
    } catch {
      // ignore malformed seed candidate
    }
  }
  return index;
}

export function hasPreloadedCandidate(preloadedIndex, repo) {
  return Boolean(preloadedIndex?.get?.(repo.normalizedRepoUrl));
}
