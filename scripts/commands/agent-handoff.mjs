import fs from "node:fs/promises";
import path from "node:path";
import { ensureDirectory } from "../../lib/index.mjs";
import { resolveProjectReportRoot } from "../../lib/report-output.mjs";
import {
  buildGoldenPathCommands,
  renderNextCommandSections
} from "../shared/golden-path.mjs";

function buildAgentHandoffGuidance(projectKey) {
  const commands = buildGoldenPathCommands(projectKey);
  return renderNextCommandSections({
    primary: commands.reviewWatchlist,
    additional: [commands.onDemand, commands.releaseCheck]
  });
}

export async function runAgentHandoff(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  if (!projectKey) {
    throw new Error("No project configured. Pass --project <key> first.");
  }

  const reportRoot = resolveProjectReportRoot(rootDir, projectKey);
  const handoffPath = path.join(reportRoot, "agent-handoff.json");
  const latestReportPath = path.join(reportRoot, "latest-report.json");

  let handoff;
  try {
    handoff = JSON.parse(await fs.readFile(handoffPath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      throw new Error(
        `No agent handoff exists yet for project '${projectKey}'. Run a report-producing flow first.\n\n${buildAgentHandoffGuidance(projectKey)}`
      );
    }
    throw error;
  }

  let latestReport = null;
  try {
    latestReport = JSON.parse(await fs.readFile(latestReportPath, "utf8"));
  } catch (error) {
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }

  let outputPath = null;
  if (options.output) {
    outputPath = path.isAbsolute(options.output)
      ? options.output
      : path.join(rootDir, options.output);
    if (!options.dryRun) {
      await ensureDirectory(path.dirname(outputPath), false);
      await fs.writeFile(outputPath, `${JSON.stringify(handoff, null, 2)}\n`, "utf8");
    }
  }

  if (options.stdout) {
    console.log(JSON.stringify(handoff, null, 2));
    return { projectKey, handoffPath, latestReportPath, outputPath, handoff, latestReport };
  }

  const topRepoCount = Array.isArray(handoff.handoff?.topRepos)
    ? handoff.handoff.topRepos.length
    : Array.isArray(handoff.handoff?.topCandidates)
      ? handoff.handoff.topCandidates.length
      : 0;
  const nextActionCount = Array.isArray(handoff.handoff?.nextActions)
    ? handoff.handoff.nextActions.length
    : 0;

  console.log(`# Patternpilot Agent Hand-Off`);
  console.log(``);
  console.log(`- project: ${projectKey}`);
  console.log(`- source_report: ${latestReport?.reportPath ?? handoff.reportPath ?? "-"}`);
  console.log(`- handoff_path: ${path.relative(rootDir, handoffPath)}`);
  console.log(`- report_kind: ${handoff.reportKind ?? "-"}`);
  console.log(`- command: ${handoff.command ?? "-"}`);
  console.log(`- top_repos: ${topRepoCount}`);
  console.log(`- next_actions: ${nextActionCount}`);
  if (outputPath) {
    console.log(`- copied_to: ${path.relative(rootDir, outputPath)}${options.dryRun ? " (dry-run not written)" : ""}`);
  }
  console.log(``);
  console.log(renderNextCommandSections({
    primary: `npm run patternpilot -- agent-handoff --project ${projectKey} --stdout`,
    additional: outputPath
      ? []
      : [`npm run patternpilot -- agent-handoff --project ${projectKey} --output exports/${projectKey}-agent-handoff.json`]
  }));

  return {
    projectKey,
    handoffPath,
    latestReportPath,
    outputPath,
    handoff,
    latestReport
  };
}
