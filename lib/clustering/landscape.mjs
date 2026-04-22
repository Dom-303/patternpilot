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

export function buildLandscape({
  repos,
  problem,
  stage2Threshold = 0.35,
  stage2MinClusterSize = 4,
  rescueThreshold = 0.55,
  rescueMinClusterSize = 5
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

    const primary = clusterByKeywords(withKeywords, { threshold: stage2Threshold });
    let chosen = null;
    let chosenStage = "keyword";

    if (isMeaningfulGrouping(primary)) {
      chosen = primary;
    } else if (primary.length === 1 && primary[0].members.length >= rescueMinClusterSize) {
      const rescued = clusterByKeywords(withKeywords, { threshold: rescueThreshold });
      if (isMeaningfulGrouping(rescued)) {
        chosen = rescued;
        chosenStage = "keyword-rescued";
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
