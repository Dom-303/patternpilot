// lib/clustering/labels.mjs
//
// Phase-7.0-Label-Fidelity-Fix:
// Vorher waehlte buildClusterLabel die top-N Tokens nach roher Frequenz
// (Token-Instanzen ueber alle Members summiert). Das hatte zwei Probleme:
//   1) Member mit vielen Keywords haben das Ranking dominiert — selten
//      gemeinsam-genutzte Tokens kletterten nach oben, gut-verbreitete
//      blieben unsichtbar.
//   2) `query:*`-Provenance-Tokens (clustering-internes Signal aus
//      Stage-0-Provenance) wanderten ins Label, obwohl sie in den
//      Member-Topics/Description nie sichtbar sind. Das laesst die
//      Label-Fidelity-Achse strukturell schlecht aussehen.
//
// Neue Logik:
//   - Token-Ranking nach **Member-Coverage**: in wievielen DISTINCT
//     Members kommt der Token vor (statt rohe Frequenz). Das bevorzugt
//     Tokens, die ueber den Cluster hinweg konsistent vorkommen.
//   - Protected-Tokens ausschliessen: `query:*` ist Internal-Signal.
//   - Wenn pattern_family gesetzt ist (Phase-2-Klassifikation), wird sie
//     als erstes Label-Element verwendet (snake-form), dazu die top-N-1
//     coverage-staerksten Tokens. Das macht Labels semantisch reicher
//     und gibt dem Reader sofort die Familie + zwei distinguierende
//     Token-Anker.

const PROTECTED_TOKEN_PREFIXES = ["query:"];

function isProtectedLabelToken(token) {
  if (typeof token !== "string") return false;
  return PROTECTED_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix));
}

function familyTokenForm(family) {
  if (typeof family !== "string") return null;
  const trimmed = family.trim();
  if (trimmed.length === 0 || trimmed.toLowerCase() === "unknown") return null;
  return trimmed.toLowerCase().replace(/\s+/g, "-");
}

export function buildClusterLabel(cluster, { topN = 3 } = {}) {
  const members = Array.isArray(cluster?.members) ? cluster.members : [];
  if (members.length === 0) {
    return familyTokenForm(cluster?.pattern_family) ?? "unlabeled";
  }

  const memberCoverage = new Map();
  for (const member of members) {
    const tokens = member?.keywords;
    const iterable = tokens instanceof Set
      ? tokens
      : Array.isArray(tokens) ? tokens : [];
    const seen = new Set();
    for (const token of iterable) {
      if (typeof token !== "string" || token.length === 0) continue;
      if (isProtectedLabelToken(token)) continue;
      if (seen.has(token)) continue;
      seen.add(token);
      memberCoverage.set(token, (memberCoverage.get(token) ?? 0) + 1);
    }
  }

  const familyToken = familyTokenForm(cluster?.pattern_family);
  if (memberCoverage.size === 0) {
    return familyToken ?? "unlabeled";
  }

  const tokenSlots = familyToken ? Math.max(1, topN - 1) : topN;
  const ranked = [...memberCoverage.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]))
    .slice(0, tokenSlots)
    .map(([token]) => token);

  if (familyToken) {
    return [familyToken, ...ranked.sort()].join("+");
  }
  return ranked.sort().join("+");
}
