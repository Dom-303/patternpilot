import { clusterByProvenance } from "./stage0-provenance.mjs";
import { clusterByStructure } from "./stage1-structural.mjs";
import { clusterByKeywords } from "./stage2-keyword.mjs";
import { mapToAxes } from "./stage3-axes.mjs";
import { buildClusterLabel } from "./labels.mjs";
import { markRelation } from "./anti-tunnel.mjs";
import { buildSignatureContrast } from "./contrast.mjs";

function summarizeRelations(clusters) {
  const counts = { near_current_approach: 0, adjacent: 0, divergent: 0 };
  for (const c of clusters) counts[c.relation] += 1;
  return counts;
}

// Ein Clustering gilt als "meaningful", wenn mindestens 2 Cluster mit
// einer Mindestgroesse entstehen. Die Mindestgroesse skaliert mit der
// Korpus-Groesse:
//   - Kleine Korpusse (< 10): ≥ 2 Mitglieder pro Cluster — weil mehr nicht
//     realistisch ist.
//   - Groessere Korpusse (≥ 10): ≥ 3 Mitglieder pro Cluster — verhindert,
//     dass Singleton-Fragmentierung (z.B. 18 Ein-Repo-Cluster bei 20 Repos)
//     als echte Landscape durchgeht; die ist meistens schlechtere UX als
//     ein ehrlicher single_cluster_collapse.
function isMeaningfulGrouping(clusters) {
  const total = clusters.reduce((sum, c) => sum + c.members.length, 0);
  const minSize = total >= 10 ? 3 : 2;
  return clusters.filter((c) => c.members.length >= minSize).length >= 2;
}

function promoteSubCluster(parent, subCluster, idx, stage) {
  return {
    key: `${parent.key}#${stage}-${idx}`,
    stage,
    pattern_family: parent.pattern_family,
    main_layer: parent.main_layer,
    members: subCluster.members,
    has_suggested_members: parent.has_suggested_members ?? false
  };
}

// Zieht "universelle" Keywords ab — also solche, die zu oft im Korpus
// vorkommen, um noch Unterscheidungskraft zu haben. Zwei komplementaere
// Strategien:
//
//   A) Ratio-Strip: Tokens, die in >= ratio * n Repos vorkommen (harter
//      Schwellwert fuer kleine Korpusse).
//   B) Top-K-Strip: zusaetzlich die K haeufigsten Tokens ausklammern, wenn
//      der Korpus gross genug ist (>= topKMinCorpusSize). Das faengt den
//      realen Patternpilot-Fall auf: Discovery liefert 20 thematisch nahe
//      Repos, deren Top-5-Tokens ("python", "deduplication", "linkage",
//      "record", "dedupe") im Bereich 35-60% liegen — ratio-basiertes
//      Stripping allein erwischt sie nicht, top-K schon.
//
// Ohne diesen Filter dominieren Topic-Tokens die Jaccard-Similarity und
// 20 thematisch nahe Repos kollabieren in einen Mega-Cluster.
// Tokens mit besonderer Semantik, die NIE vom Stripping erwischt werden
// duerfen:
//   - `query:*`  — Discovery-Provenance-Tags aus den Query-Phrasen; sie
//     sind das entscheidende Gruppierungssignal fuer thematisch nahe
//     Korpusse und ersetzen das fehlende pattern_family-Feld.
function isProtectedToken(token) {
  return typeof token === "string" && token.startsWith("query:");
}

function stripUniversalKeywords(repos, {
  ratio = 0.5,
  minCorpusSize = 4,
  topKMinCorpusSize = 10,
  topKFactor = 5
} = {}) {
  if (!Array.isArray(repos) || repos.length < minCorpusSize) return repos;
  const frequency = new Map();
  for (const repo of repos) {
    for (const kw of repo.keywords ?? []) {
      frequency.set(kw, (frequency.get(kw) ?? 0) + 1);
    }
  }
  const universal = new Set();
  const ratioThreshold = Math.ceil(repos.length * ratio);
  for (const [kw, count] of frequency) {
    if (isProtectedToken(kw)) continue;
    if (count >= ratioThreshold) universal.add(kw);
  }
  if (repos.length >= topKMinCorpusSize) {
    const k = Math.max(1, Math.ceil(repos.length / topKFactor));
    // Top-K wird nur ueber nicht-protected Tokens berechnet, damit seltene
    // query:-Provenance-Tags nicht ihren Listenplatz verlieren.
    const sorted = [...frequency.entries()]
      .filter(([kw]) => !isProtectedToken(kw))
      .sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
    for (let i = 0; i < Math.min(k, sorted.length); i += 1) {
      if (sorted[i][1] > 1) universal.add(sorted[i][0]);
    }
  }
  if (universal.size === 0) return repos;
  return repos.map((repo) => ({
    ...repo,
    keywords: new Set([...(repo.keywords ?? [])].filter((kw) => !universal.has(kw)))
  }));
}

export function buildLandscape({
  repos,
  problem,
  stage2Threshold = 0.35,
  stage2MinClusterSize = 4,
  rescueThreshold = 0.55,
  rescueMinClusterSize = 5,
  // Strip-Ratio = 0.5: Keywords, die in mindestens der Haelfte des Korpus
  // vorkommen, gelten als Topic-Hintergrund und dominieren die Jaccard-
  // Similarity zwischen den Sub-Familien. Echte Discovery-Daten zeigen
  // selten Keywords >= 70% — 0.5 ist der empirisch sinnvollere Cut.
  stripUniversalRatio = 0.5,
  // Stage 0: Pre-Clustering nach Query-Provenance. Wenn nicht explizit
  // gesetzt, skaliert die Mindestcluster-Groesse dynamisch mit der
  // Anzahl unterschiedlicher Query-Linsen im Korpus:
  //   - wenige Linsen (<= 5):   minSize = 3 (klassisch)
  //   - viele Linsen (>= 10):   minSize = 2 (erlaubt mehr kleine Cluster)
  // So bleiben bei breit gefaecherten Query-Familien die orthogonalen
  // Sub-Familien sichtbar, statt sie in Ungrouped zu verschenken.
  provenanceMinClusterSize = null
}) {
  const distinctLenses = new Set();
  for (const r of repos ?? []) {
    const p = Array.isArray(r?.discoveryProvenance) ? r.discoveryProvenance : [];
    if (p.length > 0) distinctLenses.add(p[0]);
  }
  const autoProvenanceMinSize = distinctLenses.size >= 10 ? 2 : 3;
  const effectiveProvenanceMinSize = provenanceMinClusterSize ?? autoProvenanceMinSize;

  // Stage 0: Gruppiere zuerst nach Query-Provenance. Repos, die aus einer
  // Query-Phrase mit >= effectiveProvenanceMinSize Treffern kommen, bilden
  // einen Cluster auf Problem-Linsen-Ebene. Der Rest wandert durch die
  // klassischen Stages.
  const { clusters: provenanceClusters, ungrouped } = clusterByProvenance(repos ?? [], {
    minClusterSize: effectiveProvenanceMinSize
  });

  const { clusters: structuralClusters, outliers } = clusterByStructure(ungrouped);
  const flatClusters = [...provenanceClusters];

  for (const cluster of structuralClusters) {
    if (cluster.members.length < stage2MinClusterSize) {
      flatClusters.push(cluster);
      continue;
    }

    const withKeywords = cluster.members.map((r) => ({
      ...r,
      keywords: r.keywords ?? new Set()
    }));

    // Bevor wir Jaccard auf den Members rechnen, ziehen wir Topic-level
    // Keywords ab, die alle/fast alle Repos teilen. Sonst dominieren die
    // gemeinsamen Topic-Tokens die Similarity und wir landen bei einem
    // einzigen Mega-Cluster trotz vorhandener Unter-Familien.
    const discriminatedMembers = stripUniversalRatio > 0
      ? stripUniversalKeywords(withKeywords, { ratio: stripUniversalRatio })
      : withKeywords;

    const primary = clusterByKeywords(discriminatedMembers, { threshold: stage2Threshold });
    let chosen = null;
    let chosenStage = "keyword";

    if (isMeaningfulGrouping(primary)) {
      chosen = primary;
    } else if (primary.length === 1 && primary[0].members.length >= rescueMinClusterSize) {
      // Stage 2 kollabiert in einen Mega-Cluster — strengere Schwelle versuchen,
      // damit Jaccard-Ketten nicht mehr alle Member unionen.
      const rescued = clusterByKeywords(discriminatedMembers, { threshold: rescueThreshold });
      if (isMeaningfulGrouping(rescued)) {
        chosen = rescued;
        chosenStage = "keyword-rescued";
      }
    } else if (primary.length > 1) {
      // Stage 2 zerfaellt in viele Singletons — sparse Keywords, keine Jaccard-
      // Kanten finden sich. Mit niedrigerer Schwelle waechst der Graph und
      // erzeugt ggf. echte Gruppen. Wenn auch das nicht reicht, ist die
      // Landschaft thematisch eng und "single_cluster_collapse" ist der
      // ehrliche Signal-Output.
      const loosened = clusterByKeywords(discriminatedMembers, { threshold: 0.2 });
      if (isMeaningfulGrouping(loosened)) {
        chosen = loosened;
        chosenStage = "keyword-loosened";
      }
    }

    if (chosen) {
      chosen.forEach((sc, idx) => {
        flatClusters.push(promoteSubCluster(cluster, sc, idx, chosenStage));
      });
    } else {
      flatClusters.push(cluster);
    }
  }

  for (const cluster of flatClusters) {
    cluster.label = buildClusterLabel(cluster);
    cluster.relation = markRelation(cluster, problem.approach_signature ?? []);
    const others = flatClusters.filter((c) => c !== cluster);
    cluster.signature_contrast = buildSignatureContrast(cluster, others);
    cluster.has_constraint_violation = cluster.members.some(
      (m) => Array.isArray(m.constraint_warnings) && m.constraint_warnings.length > 0
    );
  }

  const clustersWithMultipleMembers = flatClusters.filter((c) => c.members.length >= 2);
  const landscape_signal = clustersWithMultipleMembers.length < 2 ? "single_cluster_collapse" : "ok";

  const suspectedAxes = problem.suspected_approach_axes ?? [];
  let axis_view = null;
  if (suspectedAxes.length > 0) {
    const flatMembers = flatClusters.flatMap((c) => c.members);
    axis_view = mapToAxes(flatMembers, suspectedAxes);
  }

  return {
    clusters: flatClusters,
    outliers,
    relation_counts: summarizeRelations(flatClusters),
    landscape_signal,
    axis_view
  };
}
