export function problemFit(repo, problemTokens) {
  const tokens = new Set(problemTokens ?? []);
  if (tokens.size === 0) return 0;
  const repoKeywords = repo.keywords ?? new Set();
  if (repoKeywords.size === 0) return 0;
  let intersect = 0;
  for (const t of tokens) if (repoKeywords.has(t)) intersect += 1;
  const union = new Set([...tokens, ...repoKeywords]).size;
  return union === 0 ? 0 : intersect / union;
}

export function combinedScore({ projectFit = 0, problemFit = 0, standalone = false, weights }) {
  if (standalone) return problemFit;
  const w = weights ?? { project: 0.5, problem: 0.5 };
  return projectFit * w.project + problemFit * w.problem;
}
