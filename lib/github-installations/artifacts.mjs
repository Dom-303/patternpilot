import fs from "node:fs/promises";
import path from "node:path";

async function writeArtifactBundle(rootDir, relativeDir, fileMap, options = {}) {
  const rootPath = path.join(rootDir, relativeDir, options.runId);
  const resolved = Object.fromEntries(
    Object.entries(fileMap).map(([key, fileName]) => [key, path.join(rootPath, fileName)])
  );

  if (options.dryRun) {
    return {
      rootPath,
      ...resolved
    };
  }

  await fs.mkdir(rootPath, { recursive: true });
  for (const [key, filePath] of Object.entries(resolved)) {
    const value = options[key];
    if (key.endsWith("Path") && value !== undefined) {
      if (typeof value === "string") {
        await fs.writeFile(filePath, key === "summaryPath" ? `${value}\n` : value, "utf8");
      } else {
        await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
      }
    }
  }

  return {
    rootPath,
    ...resolved
  };
}

export async function writeGithubAppInstallationArtifacts(rootDir, options) {
  return writeArtifactBundle(rootDir, path.join("runs", "integration", "github-app-installations"), {
    packetPath: "installation-packet.json",
    statePath: "installation-state.json",
    summaryPath: "summary.md"
  }, {
    runId: options.runId,
    packetPath: options.packet,
    statePath: options.state,
    summaryPath: options.summary,
    dryRun: options.dryRun
  });
}

async function writePlanArtifacts(rootDir, directoryName, files, options) {
  return writeArtifactBundle(rootDir, path.join("runs", "integration", directoryName), {
    planPath: files.plan,
    receiptsPath: files.receipts,
    statePath: files.state,
    summaryPath: "summary.md"
  }, {
    runId: options.runId,
    planPath: options.plan,
    receiptsPath: options.receipts ?? [],
    statePath: options.state,
    summaryPath: options.summary,
    dryRun: options.dryRun
  });
}

export async function writeGithubAppInstallationScopeArtifacts(rootDir, options) {
  return writePlanArtifacts(rootDir, "github-app-installation-scope", {
    plan: "scope-plan.json",
    receipts: "scope-receipts.json",
    state: "scope-state.json"
  }, options);
}

export async function writeGithubAppInstallationRuntimeArtifacts(rootDir, options) {
  return writePlanArtifacts(rootDir, "github-app-installation-runtime", {
    plan: "runtime-plan.json",
    receipts: "runtime-receipts.json",
    state: "runtime-state.json"
  }, options);
}

export async function writeGithubAppInstallationOperationsArtifacts(rootDir, options) {
  return writePlanArtifacts(rootDir, "github-app-installation-operations", {
    plan: "operations-plan.json",
    receipts: "operations-receipts.json",
    state: "operations-state.json"
  }, options);
}

export async function writeGithubAppInstallationServiceLaneArtifacts(rootDir, options) {
  return writePlanArtifacts(rootDir, "github-app-installation-service-lanes", {
    plan: "service-lane-plan.json",
    receipts: "service-lane-receipts.json",
    state: "service-lane-state.json"
  }, options);
}

export async function writeGithubAppInstallationServicePlanArtifacts(rootDir, options) {
  return writePlanArtifacts(rootDir, "github-app-installation-service-plan", {
    plan: "service-plan.json",
    receipts: "service-plan-receipts.json",
    state: "service-plan-state.json"
  }, options);
}

export async function writeGithubAppInstallationWorkerRoutingArtifacts(rootDir, options) {
  return writePlanArtifacts(rootDir, "github-app-installation-worker-routing", {
    plan: "worker-routing-plan.json",
    receipts: "worker-routing-receipts.json",
    state: "worker-routing-state.json"
  }, options);
}
