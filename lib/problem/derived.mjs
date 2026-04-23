const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "be", "to", "of", "in", "on", "for",
  "with", "and", "or", "it", "that", "this", "as", "at", "by", "from",
  "we", "you", "they", "i", "me", "my", "our", "your", "their",
  "do", "does", "did", "has", "have", "had", "was", "were", "been",
  "should", "would", "could", "can", "will", "thing", "things",
  // Filler words, die als Einzel-Token auf GitHub-Suche nur Noise erzeugen
  "across", "into", "via", "over", "under", "between", "among"
]);

function tokenizeTitle(title) {
  if (!title) return [];
  return title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

// Baut 2-gram-Phrasen aus benachbarten Title-Tokens. Single-Token-Queries
// auf GitHub rate-limiten aggressiv und liefern zu breite Treffer — 2-grams
// sind der billigste sichere Fallback, wenn hints.search_terms fehlt oder
// duenn besetzt ist.
function extractTitleBigrams(title) {
  const tokens = tokenizeTitle(title);
  if (tokens.length < 2) return [];
  const bigrams = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    bigrams.push(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return bigrams;
}

// Zaehlt wie viele Hint-Search-Terms bereits solide Multi-Wort-Queries sind.
// Liegt diese Zahl >= 3, ist der Title-Fallback nicht noetig — die Hints
// liefern genug Suchqualitaet und das Budget sollte nicht mit fallback-2-
// grams verwaessert werden.
function hasStrongHints(searchTerms) {
  if (!Array.isArray(searchTerms)) return false;
  const strong = searchTerms.filter((term) => {
    if (typeof term !== "string") return false;
    const parts = term.trim().split(/\s+/).filter(Boolean);
    return parts.length >= 2;
  });
  return strong.length >= 3;
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
  const hintTerms = Array.isArray(hints.search_terms) ? hints.search_terms : [];

  // Title-Fallback nur einziehen, wenn Hints zu schwach sind. Dadurch
  // wird der Discovery-Budget nicht mit noise-behafteten 2-grams
  // verwaessert, wenn hand-kuratierte Hints bereits solide sind.
  const titleFallback = hasStrongHints(hintTerms) ? [] : extractTitleBigrams(title);
  const seeds = [...hintTerms, ...titleFallback];
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
