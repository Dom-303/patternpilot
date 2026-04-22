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

export function buildLandscape({ repos, problem, stage2Threshold = 0.35, stage2MinClusterSize = 4 }) {
  const { clusters: structuralClusters, outliers } = clusterByStructure(repos);
  const enrichedClusters = [];

  for (const cluster of structuralClusters) {
    let subClusters = null;
    if (cluster.members.length >= stage2MinClusterSize) {
      const withKeywords = cluster.members.map((r) => ({ ...r, keywords: r.keywords ?? new Set() }));
      subClusters = clusterByKeywords(withKeywords, { threshold: stage2Threshold });
    }
    enrichedClusters.push({ ...cluster, sub_clusters: subClusters });
  }

  for (const cluster of enrichedClusters) {
    cluster.label = buildClusterLabel(cluster);
    cluster.relation = markRelation(cluster, problem.approach_signature ?? []);
    const others = enrichedClusters.filter((c) => c !== cluster);
    cluster.signature_contrast = buildSignatureContrast(cluster, others);
  }

  const clustersWithMultipleMembers = enrichedClusters.filter((c) => c.members.length >= 2);
  const landscape_signal = clustersWithMultipleMembers.length < 2 ? "single_cluster_collapse" : "ok";

  const suspectedAxes = problem.suspected_approach_axes ?? [];
  let axis_view = null;
  if (suspectedAxes.length > 0) {
    const flatMembers = enrichedClusters.flatMap((c) => c.members);
    axis_view = mapToAxes(flatMembers, suspectedAxes);
  }

  return {
    clusters: enrichedClusters,
    outliers,
    relation_counts: summarizeRelations(enrichedClusters),
    landscape_signal,
    axis_view
  };
}
