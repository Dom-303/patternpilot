import fs from "node:fs/promises";
import path from "node:path";

async function writeBundle(rootDir, relativeDir, files, options = {}) {
  const rootPath = path.join(rootDir, relativeDir, options.runId);
  const resolved = Object.fromEntries(
    Object.entries(files).map(([key, fileName]) => [key, path.join(rootPath, fileName)])
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
    if (value === undefined) {
      continue;
    }
    if (typeof value === "string") {
      await fs.writeFile(filePath, key === "summaryPath" ? `${value}\n` : value, "utf8");
    } else {
      await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    }
  }

  return {
    rootPath,
    ...resolved
  };
}

export async function writeGithubWebhookServiceArtifacts(rootDir, options) {
  return writeBundle(rootDir, path.join("runs", "integration", "github-app-service"), {
    planPath: "service-plan.json",
    receiptsPath: "service-receipts.json",
    summaryPath: "summary.md"
  }, {
    runId: options.runId,
    planPath: options.plan,
    receiptsPath: options.receipts ?? [],
    summaryPath: options.summary,
    dryRun: options.dryRun
  });
}

export async function writeGithubWebhookServiceAdminArtifacts(rootDir, options) {
  return writeBundle(rootDir, path.join("runs", "integration", "github-app-service-admin"), {
    planPath: `${options.artifactPrefix}-plan.json`,
    receiptsPath: `${options.artifactPrefix}-receipts.json`,
    summaryPath: "summary.md"
  }, {
    runId: options.runId,
    planPath: options.plan,
    receiptsPath: options.receipts ?? [],
    summaryPath: options.summary,
    dryRun: options.dryRun
  });
}
