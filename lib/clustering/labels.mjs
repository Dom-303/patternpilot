// lib/clustering/labels.mjs
//
// Phase-7.0-Label-Fidelity-Fix:
// Vorher waehlte buildClusterLabel die top-N Tokens nach roher Frequenz
// (Token-Instanzen ueber alle Members summiert). Das hatte zwei Probleme:
//   1) Member mit vielen Keywords haben das Ranking dominiert — selten
//      gemeinsam-genutzte Tokens kletterten nach oben, gut-verbreitete
//      blieben unsichtbar.
//   2) `query:*`-Provenance-Tokens (clustering-internes Stage-0-Signal)
//      wanderten ins Label, obwohl sie in den Member-Topics/Description
//      nie sichtbar sind. Das laesst die Label-Fidelity-Achse strukturell
//      schlecht aussehen.
//
// Neue Logik:
//   - Token-Ranking nach **Member-Coverage**: in wievielen DISTINCT
//     Members kommt der Token vor (statt rohe Frequenz).
//   - Protected-Tokens ausschliessen: `query:*` ist Internal-Signal.
//   - Wenn pattern_family gesetzt ist, wird sie als erstes Label-Element
//     verwendet (snake-form), dazu top-N-1 coverage-staerkste Tokens.
//
// Phase-7.3-Member-Token-Diskriminator (TF-IDF):
//   buildAllClusterLabels nimmt ALLE Cluster entgegen und ranked Tokens
//   nicht nur nach Member-Coverage, sondern nach `coverage * idf`. IDF =
//   log(total_clusters / clusters_containing_token). Tokens, die in
//   diesem Cluster verbreitet sind ABER in anderen Clustern selten,
//   bekommen den hoechsten Score. So vermeiden Labels generische Tokens
//   wie "library" oder "javascript", die in jedem Cluster auftauchen.
//
//   Bei einem einzelnen Cluster oder wenn buildClusterLabel fuer einen
//   Cluster ohne globalen Kontext aufgerufen wird, faellt die Logik auf
//   reine Coverage zurueck (Phase-7.0-Verhalten).

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

function buildMemberCoverageMap(cluster) {
  const memberCoverage = new Map();
  const members = Array.isArray(cluster?.members) ? cluster.members : [];
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
  return memberCoverage;
}

function composeLabel(rankedTokens, family, topN) {
  const tokenSlots = family ? Math.max(1, topN - 1) : topN;
  // Family-Token-Wiederholung vermeiden: filter Tokens raus, die als
  // Substring in der family-form (snake-form) bereits enthalten sind.
  const familyForms = new Set();
  if (family) {
    familyForms.add(family);
    for (const part of family.split("-")) familyForms.add(part);
  }
  const filtered = rankedTokens.filter(([token]) => !familyForms.has(token));
  const picked = filtered.slice(0, tokenSlots).map(([token]) => token);
  if (family) {
    return [family, ...picked.sort()].join("+");
  }
  if (picked.length === 0) return "unlabeled";
  return picked.sort().join("+");
}

export function buildClusterLabel(cluster, { topN = 3 } = {}) {
  const members = Array.isArray(cluster?.members) ? cluster.members : [];
  if (members.length === 0) {
    return familyTokenForm(cluster?.pattern_family) ?? "unlabeled";
  }
  const memberCoverage = buildMemberCoverageMap(cluster);
  const familyToken = familyTokenForm(cluster?.pattern_family);
  if (memberCoverage.size === 0) {
    return familyToken ?? "unlabeled";
  }
  const ranked = [...memberCoverage.entries()]
    .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  return composeLabel(ranked, familyToken, topN);
}

export function buildAllClusterLabels(clusters, { topN = 3 } = {}) {
  if (!Array.isArray(clusters) || clusters.length === 0) return [];
  const coverageMaps = clusters.map((cluster) => buildMemberCoverageMap(cluster));
  const totalClusters = clusters.length;

  // Document Frequency: in wievielen Cluster-Coverage-Maps kommt der Token vor?
  const documentFrequency = new Map();
  for (const coverage of coverageMaps) {
    for (const token of coverage.keys()) {
      documentFrequency.set(token, (documentFrequency.get(token) ?? 0) + 1);
    }
  }

  // Bei <2 Clustern degeneriert IDF zu Konstante — Phase-7.0-Verhalten
  // ist dann optimal. Wir delegieren explizit.
  if (totalClusters < 2) {
    return clusters.map((cluster) => buildClusterLabel(cluster, { topN }));
  }

  return clusters.map((cluster, index) => {
    const coverage = coverageMaps[index];
    const familyToken = familyTokenForm(cluster?.pattern_family);
    const memberCount = Array.isArray(cluster?.members) ? cluster.members.length : 0;
    if (coverage.size === 0 || memberCount === 0) {
      return familyToken ?? "unlabeled";
    }
    const ranked = [...coverage.entries()]
      .map(([token, count]) => {
        const tf = count / memberCount;
        const df = documentFrequency.get(token) ?? 1;
        // log(N / df) ist 0 wenn df === N (Token in jedem Cluster).
        // Wir wollen einen kleinen positiven Wert haben, damit hohe
        // Coverage immer noch zaehlt — daher (df+1) im Nenner.
        const idf = Math.log(totalClusters / df) + 0.001;
        return [token, count, tf * idf];
      })
      .sort((a, b) => (b[2] - a[2]) || (b[1] - a[1]) || a[0].localeCompare(b[0]));
    return composeLabel(ranked, familyToken, topN);
  });
}
