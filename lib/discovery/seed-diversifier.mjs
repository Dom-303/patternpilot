// lib/discovery/seed-diversifier.mjs
//
// Phase-1-Kern aus docs/foundation/SCORE_STABILITY_PLAN.md:
// Wenn `problem.derived.query_seeds` lexikalisch zu aehnlich sind (weniger
// als N strukturell unterschiedliche Seeds), werden aus dem kuratierten
// seed-dictionary.json orthogonale Ersatz-Seeds hinzugefuegt — bis die
// Diversitaet reicht oder das Budget erschoepft ist.
//
// Das Modul ist rein lesend und deterministisch. Keine I/O, keine API-Calls.
// Die Dictionary-Datei wird vom CLI-Wrapper eingelesen und rein uebergeben.

const DEFAULT_MIN_ORTHOGONAL = 3;
const DEFAULT_ORTHOGONAL_THRESHOLD = 0.5;
const DEFAULT_BUDGET = 3;

function tokenize(phrase) {
  if (typeof phrase !== 'string' || phrase.length === 0) return new Set();
  const tokens = phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 3);
  return new Set(tokens);
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 && setB.size === 0) return 0;
  let intersection = 0;
  for (const token of setA) if (setB.has(token)) intersection += 1;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function maxJaccardAgainst(signature, pool) {
  let max = 0;
  for (const other of pool) {
    const value = jaccardSimilarity(signature, other);
    if (value > max) max = value;
  }
  return max;
}

function countOrthogonal(signatures, threshold) {
  // Count how many signatures are pairwise "orthogonal" (jaccard < threshold)
  // against at least (n-1) peers — i.e. sit outside the dominant cluster.
  if (signatures.length <= 1) return signatures.length;
  let count = 0;
  for (let i = 0; i < signatures.length; i += 1) {
    let isOrthogonal = true;
    for (let j = 0; j < signatures.length; j += 1) {
      if (i === j) continue;
      if (jaccardSimilarity(signatures[i], signatures[j]) >= threshold) {
        isOrthogonal = false;
        break;
      }
    }
    if (isOrthogonal) count += 1;
  }
  return count;
}

export function measureSeedDiversity(seeds, options = {}) {
  const threshold = options.orthogonalThreshold ?? DEFAULT_ORTHOGONAL_THRESHOLD;
  const signatures = (Array.isArray(seeds) ? seeds : [])
    .map((seed) => tokenize(seed));
  const orthogonalCount = countOrthogonal(signatures, threshold);
  let maxPairwise = 0;
  for (let i = 0; i < signatures.length; i += 1) {
    for (let j = i + 1; j < signatures.length; j += 1) {
      const value = jaccardSimilarity(signatures[i], signatures[j]);
      if (value > maxPairwise) maxPairwise = value;
    }
  }
  return {
    seed_count: signatures.length,
    orthogonal_count: orthogonalCount,
    max_pairwise_jaccard: Number(maxPairwise.toFixed(3)),
    threshold,
  };
}

export function diversifySeeds(seeds, dictionary, options = {}) {
  const minOrthogonal = options.minOrthogonal ?? DEFAULT_MIN_ORTHOGONAL;
  const threshold = options.orthogonalThreshold ?? DEFAULT_ORTHOGONAL_THRESHOLD;
  const budget = options.budget ?? DEFAULT_BUDGET;
  const existing = Array.isArray(seeds) ? [...seeds] : [];
  const dictPhrases = Array.isArray(dictionary?.phrases) ? dictionary.phrases : [];

  const baselineDiversity = measureSeedDiversity(existing, { orthogonalThreshold: threshold });

  if (baselineDiversity.orthogonal_count >= minOrthogonal) {
    return {
      seeds: existing,
      added: [],
      strategy: 'passthrough',
      reason: 'already_diverse',
      diversity_before: baselineDiversity,
      diversity_after: baselineDiversity,
    };
  }

  if (dictPhrases.length === 0) {
    return {
      seeds: existing,
      added: [],
      strategy: 'passthrough',
      reason: 'empty_dictionary',
      diversity_before: baselineDiversity,
      diversity_after: baselineDiversity,
    };
  }

  const existingSignatures = existing.map((seed) => tokenize(seed));
  const existingAxisSet = new Set();
  for (const entry of dictPhrases) {
    const entryTokens = tokenize(entry.phrase);
    const overlapsExisting = existingSignatures.some((sig) => jaccardSimilarity(entryTokens, sig) >= threshold);
    if (overlapsExisting && Array.isArray(entry.axes)) {
      for (const axis of entry.axes) existingAxisSet.add(axis);
    }
  }

  const pool = existing.map((seed) => tokenize(seed));
  const additions = [];
  // Two-pass walk: first prefer phrases whose axes are unrepresented; then
  // any phrase that is orthogonal to existing+added.
  const passes = [
    (entry) => Array.isArray(entry.axes) && entry.axes.some((axis) => !existingAxisSet.has(axis)),
    () => true,
  ];
  const used = new Set();

  for (const pass of passes) {
    for (const entry of dictPhrases) {
      if (additions.length >= budget) break;
      const phrase = entry?.phrase;
      if (typeof phrase !== 'string' || phrase.length === 0) continue;
      if (used.has(phrase)) continue;
      if (existing.includes(phrase)) continue;
      if (!pass(entry)) continue;
      const signature = tokenize(phrase);
      const maxOverlap = maxJaccardAgainst(signature, pool);
      if (maxOverlap >= threshold) continue;
      additions.push({ phrase, axes: Array.isArray(entry.axes) ? entry.axes : [] });
      pool.push(signature);
      used.add(phrase);
      if (Array.isArray(entry.axes)) {
        for (const axis of entry.axes) existingAxisSet.add(axis);
      }
      if (measureSeedDiversity([...existing, ...additions.map((a) => a.phrase)], {
        orthogonalThreshold: threshold,
      }).orthogonal_count >= minOrthogonal) {
        break;
      }
    }
    if (additions.length >= budget) break;
  }

  const combinedSeeds = [...existing, ...additions.map((a) => a.phrase)];
  const diversityAfter = measureSeedDiversity(combinedSeeds, { orthogonalThreshold: threshold });

  return {
    seeds: combinedSeeds,
    added: additions,
    strategy: additions.length > 0 ? 'diversified' : 'passthrough',
    reason: additions.length > 0 ? 'supplemented_from_dictionary' : 'no_orthogonal_candidates_found',
    diversity_before: baselineDiversity,
    diversity_after: diversityAfter,
  };
}

export { DEFAULT_MIN_ORTHOGONAL, DEFAULT_ORTHOGONAL_THRESHOLD, DEFAULT_BUDGET };
