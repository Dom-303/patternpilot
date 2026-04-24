import { jaccard } from "../clustering/stage2-keyword.mjs";

function isDivergent(repo, signature, threshold) {
  const sigSet = new Set(signature);
  return jaccard(repo.keywords ?? new Set(), sigSet) < threshold;
}

function primaryLens(repo) {
  const p = Array.isArray(repo?.discoveryProvenance) ? repo.discoveryProvenance : [];
  return p.length > 0 ? p[0] : null;
}

// Gruppiert die Repos nach ihrer primaeren Query-Provenance und waehlt
// round-robin aus: in jeder Runde bekommt jede Query-Linse EIN Repo
// (das mit dem hoechsten Score), bis die Ziel-Menge gefuellt ist.
//
// Dadurch landen auch orthogonale Query-Linsen, deren Repos einen
// niedrigeren problemFit haben, garantiert im Selection-Window —
// ohne sie verliert Stage-0-Provenance-Clustering die Grundlage.
function fairPickByLens(repos, targetSize) {
  if (targetSize <= 0 || repos.length === 0) return [];
  const lensQueues = new Map();
  const untagged = [];
  for (const repo of repos) {
    const lens = primaryLens(repo);
    if (!lens) {
      untagged.push(repo);
      continue;
    }
    if (!lensQueues.has(lens)) lensQueues.set(lens, []);
    lensQueues.get(lens).push(repo);
  }
  for (const queue of lensQueues.values()) {
    queue.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }
  untagged.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  const picked = [];
  let progress = true;
  while (picked.length < targetSize && progress) {
    progress = false;
    for (const queue of lensQueues.values()) {
      if (picked.length >= targetSize) break;
      if (queue.length === 0) continue;
      picked.push(queue.shift());
      progress = true;
    }
  }
  while (picked.length < targetSize && untagged.length > 0) {
    picked.push(untagged.shift());
  }
  return picked;
}

export function selectWithDiversity({ repos, signature, windowSize, divergenceThreshold, minProblemFit }) {
  const sorted = [...repos].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const half = Math.floor(windowSize / 2);
  const topHalf = sorted.slice(0, half);

  // Zweiter Teil des Fensters: query-faire Round-Robin-Auswahl aus allen
  // Repos, die nicht schon in der Score-Oberliga sind. Garantiert, dass
  // orthogonale Query-Linsen Mitglieder ins Fenster bringen, damit
  // Stage-0-Provenance-Clustering danach echte Sub-Familien findet.
  const usedIds = new Set(topHalf.map((r) => r.id));
  const remaining = sorted.filter((r) => !usedIds.has(r.id));
  const remainingSlots = windowSize - half;
  const fairPicks = fairPickByLens(remaining, remainingSlots);

  const combined = [...topHalf, ...fairPicks];
  // Zum Reporting: wieviele aus dem Fair-Picks-Teil sind divergent gegen
  // die Approach-Signature? Behaelt die alte selectedByDivergence-Metrik
  // ohne sie zur Gating-Bedingung zu machen.
  const selectedByDivergence = fairPicks.filter((r) =>
    (r.problemFit ?? 0) >= minProblemFit
    && isDivergent(r, signature ?? [], divergenceThreshold)
  ).length;

  const diversity_gap = fairPicks.length === 0 ? "no_candidates_after_top_half" : null;

  return {
    selected: combined,
    selectedByScore: topHalf.length,
    selectedByDivergence,
    diversity_gap
  };
}
