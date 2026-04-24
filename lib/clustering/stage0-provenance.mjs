// Stage 0: Provenance-first Clustering.
//
// Bevor strukturelle oder Keyword-basierte Clusterung laeuft, gruppiert
// diese Stage alle Repos nach der Query-Phrase, die sie zuerst gefunden
// hat (`discoveryProvenance[0]`). Query-Phrasen sind im Problem-Mode
// eigene Problem-Linsen — Repos aus derselben Linse gehoeren thematisch
// zusammen, auch wenn ihre Keyword-Distribution im Korpus sparse ist.
//
// Entscheidungslogik:
//   - Repos mit gemeinsamer Primary-Provenance und Gruppen-Groesse
//     >= minClusterSize bilden einen Cluster.
//   - Alles andere (Repos ohne Provenance ODER aus zu kleinen Gruppen)
//     landet im "ungrouped"-Rest und geht ins klassische Stage-1 weiter.
//
// Damit loesen wir das fundamentale Problem thematisch enger Korpusse:
// die Clusterung haengt nicht mehr von Keyword-Overlap ab, sondern
// nutzt das starke Signal "diese Repos kamen aus derselben Problem-
// Linse". Ohne neuen API-Aufruf, ohne Re-Scoring.

function primaryProvenance(repo) {
  const p = Array.isArray(repo?.discoveryProvenance) ? repo.discoveryProvenance : [];
  return p.length > 0 ? p[0] : null;
}

function slugifyPhrase(phrase) {
  return String(phrase).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * @param {Array} repos Repos mit optionalem `discoveryProvenance`-Feld.
 * @param {object} [opts]
 * @param {number} [opts.minClusterSize=3] Ab welcher Gruppengroesse aus einer Query
 *   ein echter Provenance-Cluster entsteht. Kleinere Gruppen landen im Rest.
 * @returns {{ clusters: Array, ungrouped: Array }}
 */
export function clusterByProvenance(repos, { minClusterSize = 3 } = {}) {
  if (!Array.isArray(repos) || repos.length === 0) {
    return { clusters: [], ungrouped: [] };
  }

  const groups = new Map();
  const untagged = [];
  for (const repo of repos) {
    const phrase = primaryProvenance(repo);
    if (!phrase) {
      untagged.push(repo);
      continue;
    }
    if (!groups.has(phrase)) groups.set(phrase, []);
    groups.get(phrase).push(repo);
  }

  const clusters = [];
  const ungrouped = [...untagged];
  // Stabile Reihenfolge: groesster Cluster zuerst, dann alphabetisch.
  const ordered = [...groups.entries()].sort((a, b) => (b[1].length - a[1].length) || a[0].localeCompare(b[0]));
  for (const [phrase, members] of ordered) {
    if (members.length >= minClusterSize) {
      clusters.push({
        key: `provenance|${slugifyPhrase(phrase)}`,
        stage: "provenance",
        pattern_family: phrase,
        main_layer: "problem_lens",
        provenance_query: phrase,
        members,
        has_suggested_members: false
      });
    } else {
      ungrouped.push(...members);
    }
  }

  return { clusters, ungrouped };
}
