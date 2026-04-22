const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "be", "to", "of", "in", "on", "for",
  "with", "and", "or", "it", "that", "this", "as", "at", "by", "from",
  "we", "you", "they", "i", "me", "my", "our", "your", "their",
  "do", "does", "did", "has", "have", "had", "was", "were", "been",
  "should", "would", "could", "can", "will", "thing", "things"
]);

function extractTitleKeywords(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function dedupe(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function buildDerived({ title, fields }) {
  const hints = fields?.hints ?? {};

  const seeds = [...(hints.search_terms ?? []), ...extractTitleKeywords(title)];
  const query_seeds = dedupe(seeds);

  const approach_signature = Array.isArray(hints.approach_keywords)
    ? [...hints.approach_keywords]
    : [];

  const constraint_tags = Array.isArray(hints.constraint_tags)
    ? [...hints.constraint_tags]
    : [];

  const tech_tags = Array.isArray(hints.tech_tags) ? [...hints.tech_tags] : [];

  return { query_seeds, approach_signature, constraint_tags, tech_tags };
}
