// lib/brief/llm-cache.mjs
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const FILE_NAME = "llm-cache.json";

export function clusterFingerprint(cluster) {
  const ids = (cluster.members ?? []).map((m) => m.id).sort();
  return crypto.createHash("sha1").update(ids.join("|")).digest("hex");
}

export async function readLlmCache(dir) {
  try {
    const raw = await fs.readFile(path.join(dir, FILE_NAME), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function writeLlmCache(dir, data) {
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, FILE_NAME), `${JSON.stringify(data, null, 2)}\n`);
}

function keyOf(clusterId, fingerprint) {
  return `${clusterId}|${fingerprint}`;
}

export async function getCached(dir, clusterId, fingerprint) {
  const cache = await readLlmCache(dir);
  return cache[keyOf(clusterId, fingerprint)] ?? null;
}

export async function setCached(dir, clusterId, fingerprint, value) {
  const cache = await readLlmCache(dir);
  cache[keyOf(clusterId, fingerprint)] = value;
  await writeLlmCache(dir, cache);
}
