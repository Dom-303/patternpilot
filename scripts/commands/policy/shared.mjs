import fs from "node:fs/promises";
import path from "node:path";
import {
  findLatestDiscoveryManifest,
  findLatestPolicyWorkbench,
  loadPolicyWorkbench
} from "../../../lib/index.mjs";

export async function resolveDiscoveryManifestRecord(rootDir, config, projectKey, options = {}) {
  if (options.manifest) {
    const manifestPath = path.resolve(rootDir, options.manifest);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    if (!manifest.discovery) {
      throw new Error(`Manifest '${options.manifest}' does not contain a discovery payload.`);
    }
    return {
      runId: manifest.runId ?? path.basename(path.dirname(manifestPath)),
      manifestPath,
      relativeManifestPath: path.relative(rootDir, manifestPath),
      manifest
    };
  }

  const manifestRecord = await findLatestDiscoveryManifest(rootDir, config, projectKey, options.runId, {
    preferCandidates: true
  });
  if (!manifestRecord) {
    throw new Error(`No discovery run manifest found for project '${projectKey}'.`);
  }
  return manifestRecord;
}

export async function resolveLoadedPolicyWorkbench(rootDir, projectKey, workbenchDir) {
  let resolvedWorkbenchDir = workbenchDir;
  if (!resolvedWorkbenchDir) {
    const latest = await findLatestPolicyWorkbench(rootDir, projectKey);
    if (!latest) {
      throw new Error(`No policy workbench found for project '${projectKey}'.`);
    }
    resolvedWorkbenchDir = latest.relativeWorkbenchDir;
  }

  return loadPolicyWorkbench(rootDir, resolvedWorkbenchDir);
}

export async function loadWorkbenchSourceRecord(rootDir, loadedWorkbench) {
  const sourceManifestPath = loadedWorkbench.manifest.sourceManifestPath
    ? path.resolve(rootDir, loadedWorkbench.manifest.sourceManifestPath)
    : null;
  if (!sourceManifestPath) {
    return null;
  }

  const manifest = JSON.parse(await fs.readFile(sourceManifestPath, "utf8"));
  return {
    runId: loadedWorkbench.manifest.sourceRunId,
    relativeManifestPath: loadedWorkbench.manifest.sourceManifestPath,
    manifest
  };
}
