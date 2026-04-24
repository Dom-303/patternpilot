// lib/clustering/pattern-family-classifier.mjs
//
// Phase-2-Kern aus docs/foundation/SCORE_STABILITY_PLAN.md:
// Zuweisen eines pattern_family-Labels an ein Repo, bevor es ins Stage-1-
// Structural-Clustering geht — damit ungroupierte Repos nicht pauschal in
// einen "unknown|unknown"-Cluster kippen.
//
// Stage 1 (bestehend ausserhalb dieses Moduls: classification/core.mjs)
// ist im Worker-Intake-Pfad aktiv, NICHT im problem:explore-Pfad. Das hier
// schliesst die Luecke fuer den Landscape-Pfad: wir klassifizieren direkt
// im problem-explore-Flow zwischen enrichment und clustering.
//
// Das Modul ist rein lesend und deterministisch. Das Lexikon kommt als
// Argument herein — der Aufrufer liest die JSON-Datei.

const DEFAULT_README_LIMIT = 800;
const DEFAULT_TOPIC_WEIGHT = 2;

function buildMatchText(repo, { readmeLimit = DEFAULT_README_LIMIT } = {}) {
  if (!repo || typeof repo !== 'object') return '';
  const parts = [];
  if (Array.isArray(repo.topics)) {
    parts.push(repo.topics.filter((t) => typeof t === 'string').join(' '));
  }
  if (typeof repo.description === 'string') {
    parts.push(repo.description);
  }
  if (typeof repo.readme === 'string') {
    parts.push(repo.readme.slice(0, readmeLimit));
  }
  if (typeof repo.name === 'string') {
    parts.push(repo.name.replace(/[-_]+/g, ' '));
  }
  return parts.join(' ').toLowerCase();
}

function countKeywordHits(text, keywords) {
  let hits = 0;
  const hitKeywords = [];
  for (const keyword of keywords) {
    if (typeof keyword !== 'string' || keyword.length === 0) continue;
    const lower = keyword.toLowerCase();
    if (text.includes(lower)) {
      hits += 1;
      hitKeywords.push(keyword);
    }
  }
  return { hits, hitKeywords };
}

function scoreFamily(text, topicText, family, { topicWeight = DEFAULT_TOPIC_WEIGHT } = {}) {
  const keywords = Array.isArray(family?.keywords) ? family.keywords : [];
  if (keywords.length === 0) return { score: 0, hits: 0, hitKeywords: [] };
  const textResult = countKeywordHits(text, keywords);
  const topicResult = countKeywordHits(topicText, keywords);
  // Topic-Treffer sind stabilere Signale als Flowing-Text — sie zaehlen doppelt.
  const score = textResult.hits + topicResult.hits * (topicWeight - 1);
  const hitKeywords = new Set([...textResult.hitKeywords, ...topicResult.hitKeywords]);
  return { score, hits: textResult.hits, hitKeywords: [...hitKeywords] };
}

export function classifyRepoPatternFamily(repo, lexicon, options = {}) {
  const families = Array.isArray(lexicon?.families) ? lexicon.families : [];
  if (families.length === 0) {
    return { label: null, score: 0, reason: 'empty_lexicon', hitKeywords: [] };
  }
  const text = buildMatchText(repo, options);
  if (text.length === 0) {
    return { label: null, score: 0, reason: 'empty_repo_text', hitKeywords: [] };
  }
  const topicText = Array.isArray(repo?.topics)
    ? repo.topics.filter((t) => typeof t === 'string').join(' ').toLowerCase()
    : '';

  let best = { label: null, score: 0, hitKeywords: [], minMatches: 2 };
  for (const family of families) {
    if (!family?.label || typeof family.label !== 'string') continue;
    const result = scoreFamily(text, topicText, family, options);
    const minMatches = typeof family.min_matches === 'number' ? family.min_matches : 2;
    if (result.hits < minMatches) continue;
    if (result.score > best.score) {
      best = {
        label: family.label,
        score: result.score,
        hitKeywords: result.hitKeywords,
        minMatches,
      };
    }
  }
  if (best.label === null) {
    return { label: null, score: 0, reason: 'no_family_reached_threshold', hitKeywords: [] };
  }
  return {
    label: best.label,
    score: best.score,
    hitKeywords: best.hitKeywords,
    reason: 'matched',
  };
}

export function classifyRepos(repos, lexicon, options = {}) {
  if (!Array.isArray(repos)) return { repos: [], summary: { total: 0, classified: 0, unknown: 0 } };
  const labeled = [];
  let classified = 0;
  for (const repo of repos) {
    if (repo?.pattern_family && repo.pattern_family !== 'unknown') {
      labeled.push(repo);
      classified += 1;
      continue;
    }
    const result = classifyRepoPatternFamily(repo, lexicon, options);
    if (result.label) {
      labeled.push({ ...repo, pattern_family: result.label, pattern_family_source: 'lexicon-stage2' });
      classified += 1;
    } else {
      labeled.push(repo);
    }
  }
  return {
    repos: labeled,
    summary: {
      total: repos.length,
      classified,
      unknown: repos.length - classified,
      classified_ratio: repos.length === 0 ? 0 : Number((classified / repos.length).toFixed(3)),
    },
  };
}

export { DEFAULT_README_LIMIT, DEFAULT_TOPIC_WEIGHT };
