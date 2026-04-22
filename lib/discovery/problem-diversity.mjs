import { jaccard } from "../clustering/stage2-keyword.mjs";

function isDivergent(repo, signature, threshold) {
  const sigSet = new Set(signature);
  return jaccard(repo.keywords ?? new Set(), sigSet) < threshold;
}

export function selectWithDiversity({ repos, signature, windowSize, divergenceThreshold, minProblemFit }) {
  const sorted = [...repos].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const half = Math.floor(windowSize / 2);
  const topHalf = sorted.slice(0, half);

  const remaining = sorted.slice(half);
  const divergent = remaining.filter(
    (r) => (r.problemFit ?? 0) >= minProblemFit && isDivergent(r, signature ?? [], divergenceThreshold)
  );

  const selectedByScore = topHalf.length;
  let selectedByDivergence = 0;
  const divergentSelection = [];
  for (const r of divergent) {
    divergentSelection.push(r);
    selectedByDivergence += 1;
    if (selectedByDivergence >= windowSize - half) break;
  }

  let diversity_gap = null;
  if (selectedByDivergence === 0) {
    diversity_gap = "no_divergent_candidates_met_threshold";
  }

  const filler = [];
  if (selectedByDivergence < windowSize - half) {
    const used = new Set([...topHalf.map((r) => r.id), ...divergentSelection.map((r) => r.id)]);
    for (const r of remaining) {
      if (used.has(r.id)) continue;
      filler.push(r);
      if (topHalf.length + divergentSelection.length + filler.length >= windowSize) break;
    }
  }

  return {
    selected: [...topHalf, ...divergentSelection, ...filler],
    selectedByScore,
    selectedByDivergence,
    diversity_gap
  };
}
