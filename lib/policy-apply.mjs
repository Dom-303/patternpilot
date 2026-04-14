import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory, asRelativeFromRoot } from "./utils.mjs";

export async function applyProjectPolicy({
  rootDir,
  projectKey,
  currentPolicyPath,
  nextPolicyPath,
  notesPath,
  generatedAt,
  dryRun,
  summaryLines = []
}) {
  const absoluteCurrentPolicyPath = path.resolve(rootDir, currentPolicyPath);
  const absoluteNextPolicyPath = path.resolve(rootDir, nextPolicyPath);
  const historyDir = path.join(rootDir, "projects", projectKey, "calibration", "history");
  const stamp = generatedAt.replace(/[:.]/g, "-");
  const beforePath = path.join(historyDir, `discovery-policy-before-${stamp}.json`);
  const afterPath = path.join(historyDir, `discovery-policy-after-${stamp}.json`);
  const summaryPath = path.join(historyDir, `discovery-policy-apply-${stamp}.md`);

  const currentRaw = await fs.readFile(absoluteCurrentPolicyPath, "utf8");
  const nextRaw = await fs.readFile(absoluteNextPolicyPath, "utf8");
  const changed = currentRaw.trim() !== nextRaw.trim();

  const summary = [
    "# Patternpilot Discovery Policy Apply",
    "",
    `- project: ${projectKey}`,
    `- generated_at: ${generatedAt}`,
    `- changed: ${changed ? "yes" : "no"}`,
    `- current_policy: ${asRelativeFromRoot(rootDir, absoluteCurrentPolicyPath)}`,
    `- next_policy: ${asRelativeFromRoot(rootDir, absoluteNextPolicyPath)}`,
    "",
    "## Notes",
    "",
    ...(summaryLines.length > 0 ? summaryLines.map((item) => `- ${item}`) : ["- none"]),
    ""
  ].join("\n");

  if (!dryRun) {
    await ensureDirectory(historyDir, false);
    await fs.writeFile(beforePath, currentRaw.endsWith("\n") ? currentRaw : `${currentRaw}\n`, "utf8");
    await fs.writeFile(afterPath, nextRaw.endsWith("\n") ? nextRaw : `${nextRaw}\n`, "utf8");
    await fs.writeFile(summaryPath, `${summary}\n`, "utf8");
    if (changed) {
      await fs.writeFile(absoluteCurrentPolicyPath, nextRaw.endsWith("\n") ? nextRaw : `${nextRaw}\n`, "utf8");
    }
    if (notesPath) {
      const noteBlock = [
        `- generated_at: ${generatedAt}`,
        `- changed: ${changed ? "yes" : "no"}`,
        `- before_policy: ${asRelativeFromRoot(rootDir, beforePath)}`,
        `- after_policy: ${asRelativeFromRoot(rootDir, afterPath)}`,
        `- apply_summary: ${asRelativeFromRoot(rootDir, summaryPath)}`,
        ...summaryLines.map((item) => `- note: ${item}`)
      ].join("\n");
      const existing = await fs.readFile(notesPath, "utf8").catch(() => "");
      const next = `${existing.trimEnd()}\n\n## Applied Policy Updates\n\n${noteBlock}\n`;
      await fs.writeFile(notesPath, next, "utf8");
    }
  }

  return {
    changed,
    beforePath: asRelativeFromRoot(rootDir, beforePath),
    afterPath: asRelativeFromRoot(rootDir, afterPath),
    summaryPath: asRelativeFromRoot(rootDir, summaryPath),
    currentPolicyPath: asRelativeFromRoot(rootDir, absoluteCurrentPolicyPath),
    nextPolicyPath: asRelativeFromRoot(rootDir, absoluteNextPolicyPath),
    summary
  };
}
