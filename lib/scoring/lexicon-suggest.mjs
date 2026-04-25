// lib/scoring/lexicon-suggest.mjs
//
// Phase-7.2-Auto-Extension: pure Helfer fuer den Lexikon-Vorschlag-Helper.
//
// Walkt die in landscape.json gespeicherten Daten, sammelt Tokens aus
// Repos, die als pattern_family=unknown verblieben sind, und liefert
// Token-Frequenz-Aggregate + Familien-Kandidatenvorschlaege.
//
// Bewusst keine I/O — der CLI-Wrapper (scripts/suggest-lexicon.mjs)
// liest Dateien und ruft hier durch.

const STOP_TOKENS = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "are", "was",
  "have", "has", "use", "uses", "based", "library", "tool", "tools", "project",
  "package", "module", "framework", "https", "http", "github", "com",
  "your", "you", "all", "more", "any", "can", "via", "out",
  "javascript", "typescript", "python", "java", "ruby", "rust", "golang",
  "node", "nodejs", "npm", "version", "release", "released", "code", "codebase",
]);

export function tokenizeForSuggestion(value) {
  if (typeof value !== "string" || value.length === 0) return [];
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !STOP_TOKENS.has(token));
}

export function collectUnknownMemberSignals(landscape) {
  const clusters = Array.isArray(landscape?.clusters) ? landscape.clusters : [];
  const unknownClusterMemberIds = new Set();
  for (const cluster of clusters) {
    const family = cluster?.pattern_family;
    if (!family || family === "unknown") {
      const ids = Array.isArray(cluster?.member_ids) ? cluster.member_ids : [];
      for (const id of ids) unknownClusterMemberIds.add(id);
    }
  }

  const axes = Array.isArray(landscape?.axis_view?.axes) ? landscape.axis_view.axes : [];
  const seen = new Set();
  const signals = [];
  for (const axis of axes) {
    const members = Array.isArray(axis?.members) ? axis.members : [];
    for (const member of members) {
      const id = member?.id;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      // Ein Member zaehlt als "unknown", wenn ENTWEDER der Cluster
      // pattern_family=unknown traegt ODER der Member explizit
      // pattern_family="unknown" hat. Member ohne pattern_family-Feld
      // werden NICHT pauschal als unknown markiert (das waere zu
      // aggressiv und faelschlich auch klassifizierte Repos in
      // anderen, non-unknown Clustern erfassen).
      const memberFamily = member?.pattern_family;
      const isUnknown =
        unknownClusterMemberIds.has(id)
        || memberFamily === "unknown";
      if (!isUnknown) continue;
      const tokens = new Set();
      if (typeof member.description === "string") {
        for (const t of tokenizeForSuggestion(member.description)) tokens.add(t);
      }
      if (Array.isArray(member.topics)) {
        for (const topic of member.topics) {
          if (typeof topic !== "string") continue;
          for (const t of tokenizeForSuggestion(topic)) tokens.add(t);
        }
      }
      if (tokens.size === 0) continue;
      signals.push({ id, tokens: [...tokens] });
    }
  }
  return signals;
}

export function aggregateTokenFrequency(signals) {
  const counts = new Map();
  const sigs = Array.isArray(signals) ? signals : [];
  for (const signal of sigs) {
    const tokens = Array.isArray(signal?.tokens) ? signal.tokens : [];
    for (const token of tokens) {
      if (typeof token !== "string") continue;
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return counts;
}

export function buildSuggestions(counts, totalUnknownMembers, options = {}) {
  const minMembers = Math.max(1, options.minMembers ?? 3);
  const maxSuggestions = Math.max(1, options.maxSuggestions ?? 15);
  const total = Math.max(1, Number(totalUnknownMembers) || 1);
  const ranked = [...(counts instanceof Map ? counts : new Map()).entries()]
    .filter(([, count]) => count >= minMembers)
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, maxSuggestions);
  return ranked.map(([token, count]) => ({
    candidate_token: token,
    appears_in_members: count,
    coverage_ratio: Number((count / total).toFixed(3)),
    proposed_lexicon_entry: {
      label: token,
      keywords: [token],
      min_matches: 1,
      note: "auto-suggested — please curate keywords + label before merging",
    },
  }));
}
