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

export async function writeLatestReportPointers({
  rootDir,
  projectKey,
  reportPath,
  createdAt,
  runId,
  command,
  reportKind,
  dryRun = false
}) {
  const absoluteReportPath = path.isAbsolute(reportPath)
    ? reportPath
    : path.join(rootDir, reportPath);
  const reportRoot = resolveProjectReportRoot(rootDir, projectKey);
  const browserLinkPath = path.join(reportRoot, "browser-link");
  const latestReportPath = path.join(reportRoot, "latest-report.json");
  const relativeReportPath = asRelativeFromRoot(rootDir, absoluteReportPath);
  const browserLink = buildBrowserLinkTarget(absoluteReportPath);
  const payload = {
    projectKey,
    reportKind,
    command,
    createdAt,
    runId,
    reportPath: relativeReportPath,
    browserLink
  };

  if (!dryRun) {
    await ensureDirectory(reportRoot, false);
    await fs.writeFile(browserLinkPath, `${browserLink}\n`, "utf8");
    await fs.writeFile(latestReportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  }

  return {
    browserLink,
    browserLinkPath,
    latestReportPath,
    payload,
    relativeReportPath
  };
}
