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

function isMeaningfulGrouping(clusters) {
  return clusters.filter((c) => c.members.length >= 2).length >= 2;
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
    if (count >= ratioThreshold) universal.add(kw);
  }
  if (repos.length >= topKMinCorpusSize) {
    const k = Math.max(1, Math.ceil(repos.length / topKFactor));
    const sorted = [...frequency.entries()].sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
    for (let i = 0; i < Math.min(k, sorted.length); i += 1) {
      // Nur Tokens strippen, die mehr als einmal vorkommen — einzelne
      // Singletons sollen nicht als "Topic" gebrandmarkt werden.
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
  stripUniversalRatio = 0.5
}) {
  const { clusters: structuralClusters, outliers } = clusterByStructure(repos);
  const flatClusters = [];

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
