import fs from "node:fs/promises";
import path from "node:path";
import { asRelativeFromRoot, ensureDirectory } from "./utils.mjs";

export function resolveProjectReportRoot(rootDir, projectKey) {
  return path.join(rootDir, "projects", projectKey, "reports");
}

export function buildBrowserLinkTarget(reportPath) {
  const distroName = process.env.WSL_DISTRO_NAME;
  if (distroName && path.isAbsolute(reportPath) && reportPath.startsWith("/")) {
    return `\\\\wsl.localhost\\${distroName}${reportPath.replace(/\//g, "\\")}`;
  }
  return reportPath;
}

export async function pushBrowserLink(browserLinkPath, newLink, { maxLines = 20 } = {}) {
  let existingLines = [];
  try {
    const content = await fs.readFile(browserLinkPath, "utf8");
    existingLines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const deduped = [newLink, ...existingLines.filter((line) => line !== newLink)].slice(0, maxLines);
  await fs.writeFile(browserLinkPath, `${deduped.join("\n")}\n`, "utf8");
  return deduped;
}

export async function writeLatestReportPointers({
  rootDir,
  projectKey,
  reportPath,
  createdAt,
  runId,
  command,
  reportKind,
  agentHandoffPayload = null,
  dryRun = false
}) {
  const absoluteReportPath = path.isAbsolute(reportPath)
    ? reportPath
    : path.join(rootDir, reportPath);
  const reportRoot = resolveProjectReportRoot(rootDir, projectKey);
  const browserLinkPath = path.join(reportRoot, "browser-link");
  const latestReportPath = path.join(reportRoot, "latest-report.json");
  const agentHandoffPath = path.join(reportRoot, "agent-handoff.json");
  const relativeReportPath = asRelativeFromRoot(rootDir, absoluteReportPath);
  const relativeAgentHandoffPath = agentHandoffPayload
    ? asRelativeFromRoot(rootDir, agentHandoffPath)
    : null;
  const browserLink = buildBrowserLinkTarget(absoluteReportPath);
  const payload = {
    projectKey,
    reportKind,
    command,
    createdAt,
    runId,
    reportPath: relativeReportPath,
    browserLink,
    agentHandoffPath: relativeAgentHandoffPath
  };
  const handoffArtifact = agentHandoffPayload
    ? {
        schemaVersion: 1,
        projectKey,
        reportKind,
        command,
        createdAt,
        runId,
        reportPath: relativeReportPath,
        handoff: agentHandoffPayload
      }
    : null;

  if (!dryRun) {
    await ensureDirectory(reportRoot, false);
    await pushBrowserLink(browserLinkPath, browserLink);
    await fs.writeFile(latestReportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    if (handoffArtifact) {
      await fs.writeFile(agentHandoffPath, `${JSON.stringify(handoffArtifact, null, 2)}\n`, "utf8");
    }
  }

  return {
    browserLink,
    browserLinkPath,
    latestReportPath,
    agentHandoffPath,
    relativeAgentHandoffPath,
    handoffArtifact,
    payload,
    relativeReportPath
  };
}
