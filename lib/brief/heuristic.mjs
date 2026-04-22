// lib/brief/heuristic.mjs
function oneSentence(description) {
  if (!description) return "";
  const firstLine = description.split("\n").map((l) => l.trim()).find((l) => l.length > 0) ?? "";
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}...` : firstLine;
}

function tableRow(cluster, topRepoByCluster, augmentation) {
  const key = cluster.key ?? cluster.label;
  const aug = augmentation?.[key];
  const kern = aug?.narrative ?? "needs_manual_read";
  const kontrast = (cluster.signature_contrast ?? []).join(", ") || "-";
  const beispiele = (cluster.member_ids ?? []).slice(0, 3).join(", ") || "-";
  const relation = cluster.relation ?? "-";
  return `| ${cluster.label} | ${kern} | ${kontrast} | ${beispiele} | ${relation} |`;
}

function pickRecommendationSignals(clusters) {
  if (clusters.length === 0) {
    return { highest: null, cleanConstraint: null, divergent: null };
  }
  const highest = [...clusters].sort((a, b) => (b.member_ids?.length ?? 0) - (a.member_ids?.length ?? 0))[0];
  const cleanConstraint = clusters.find((c) => !c.has_constraint_violation) ?? highest;
  const divergent = clusters.find((c) => c.relation === "divergent") ?? null;
  return { highest, cleanConstraint, divergent };
}

export function buildHeuristicBrief({ problem, landscape, topRepoByCluster, llmAugmentation }) {
  const oneLiner = oneSentence(problem.fields?.description ?? "");
  const totalRepos = landscape.clusters.reduce((sum, c) => sum + (c.member_ids?.length ?? 0), 0);
  const rc = landscape.relation_counts;

  const signals = pickRecommendationSignals(landscape.clusters);
  const recommendedCluster = signals.highest;
  const nextStepRepo = recommendedCluster ? topRepoByCluster[recommendedCluster.label] ?? null : null;
  const intakeLine = nextStepRepo
    ? `→ \`npm run intake -- --project ${problem.project ?? "<project>"} --problem ${problem.slug} ${nextStepRepo}\``
    : "→ (kein Repo — Landscape leer oder Empfehlung fehlt)";

  return `---
problem: ${problem.slug}
run_id: ${landscape.run_id}
project: ${problem.project ?? "(standalone)"}
generated_at: ${new Date().toISOString()}
llm_augmentation: ${llmAugmentation ? "true" : "false"}
---

## Problem (1 Satz)
${oneLiner}

## Landscape auf einen Blick
- ${landscape.clusters.length} Ansatz-Cluster aus ${totalRepos} bewerteten Repos
- Anti-Tunnel-Verteilung: ${rc.near_current_approach} near_current_approach, ${rc.adjacent} adjacent, ${rc.divergent} divergent
- Landscape-Signal: ${landscape.landscape_signal}

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
${landscape.clusters.map((c) => tableRow(c, topRepoByCluster, llmAugmentation)).join("\n")}

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: ${signals.highest?.label ?? "-"}
- constraint_clean_cluster: ${signals.cleanConstraint?.label ?? "-"}
- anti_tunnel_alternative: ${signals.divergent?.label ?? "-"}

## Nächster konkreter Schritt
${intakeLine}
${llmAugmentation ? `\n## KI-Ergänzung (optional)\n> [LLM-Zusammenfassung — keine Primärquelle]\n\n${Object.entries(llmAugmentation).map(([k, v]) => `### ${k}\n${v.strengths_weaknesses_raw ?? ""}\n`).join("\n")}\n` : ""}`;
}
