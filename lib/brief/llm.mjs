// lib/brief/llm.mjs
import { getCached, setCached, clusterFingerprint } from "./llm-cache.mjs";

function buildNarrativePrompt(cluster) {
  const keywords = cluster.signature_contrast?.join(", ") ?? "";
  const memberIds = (cluster.member_ids ?? []).join(", ");
  return `You analyze a cluster of open-source repositories.
Cluster label: ${cluster.label}
Distinguishing keywords: ${keywords}
Pattern family: ${cluster.pattern_family ?? "unknown"}
Member repo ids: ${memberIds}

Write exactly 3 sentences:
1. What is the core idea shared by these repos? (one sentence)
2. What is the typical strength of this approach? (one sentence)
3. What is the typical weakness or trade-off? (one sentence)

Keep each sentence factual and grounded in the given data. Do not invent new repos. Do not recommend an action.`;
}

function buildStrengthsPrompt(cluster) {
  return `For the cluster "${cluster.label}" with keywords [${(cluster.signature_contrast ?? []).join(", ")}]:
List exactly 2 strengths and 2 weaknesses as short bullets (one line each).
Format:
STRENGTHS:
- <bullet>
- <bullet>
WEAKNESSES:
- <bullet>
- <bullet>`;
}

export async function augmentClusterWithLlm({ cluster, cacheDir, generate }) {
  const fingerprint = clusterFingerprint(cluster);
  const cached = await getCached(cacheDir, cluster.key ?? cluster.label, fingerprint);
  if (cached) return cached;

  const narrative = await generate(buildNarrativePrompt(cluster));
  const strengthsRaw = await generate(buildStrengthsPrompt(cluster));

  const value = { narrative, strengths_weaknesses_raw: strengthsRaw };
  await setCached(cacheDir, cluster.key ?? cluster.label, fingerprint, value);
  return value;
}

export async function augmentLandscape({ landscape, cacheDir, generate }) {
  const out = {};
  for (const cluster of landscape.clusters ?? []) {
    out[cluster.key ?? cluster.label] = await augmentClusterWithLlm({ cluster, cacheDir, generate });
  }
  return out;
}
