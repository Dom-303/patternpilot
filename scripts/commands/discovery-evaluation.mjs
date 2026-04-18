import path from "node:path";
import {
  createRunId,
  loadQueueEntries
} from "../../lib/index.mjs";
import {
  loadDiscoveryRunManifests,
  buildDiscoveryEvaluation,
  buildDiscoveryEvaluationReport,
  renderDiscoveryEvaluationSummary,
  writeDiscoveryEvaluationArtifacts
} from "../../lib/validation/discovery-evaluation.mjs";
import { renderNextCommandSections, buildGoldenPathCommands } from "../shared/golden-path.mjs";
import { refreshContext } from "../shared/runtime-helpers.mjs";

function buildDiscoveryEvaluationGuidance(projectKey, evaluation) {
  const commands = projectKey ? buildGoldenPathCommands(projectKey) : null;
  const bestFamily = evaluation.bestFamilies[0]?.value ?? null;
  const noisyFamily = evaluation.noisyFamilies[0]?.value ?? null;

  if (projectKey && noisyFamily) {
    return {
      primary: `npm run patternpilot -- discover --project ${projectKey} --dry-run`,
      additional: [
        commands?.reviewWatchlist,
        `Inspect and tighten the '${noisyFamily}' discovery family before the next live run.`
      ].filter(Boolean)
    };
  }

  if (projectKey && bestFamily) {
    return {
      primary: `npm run patternpilot -- discover --project ${projectKey} --dry-run`,
      additional: [
        commands?.reviewWatchlist,
        `Keep leaning on '${bestFamily}' because it currently performs best.`
      ].filter(Boolean)
    };
  }

  return {
    primary: "npm run validate:cohort",
    additional: [
      "Run another real discovery cycle with intake and review so the evaluation surface gets stronger evidence."
    ]
  };
}

export async function runDiscoveryEvaluate(rootDir, config, options) {
  const projectKey = options.allProjects ? null : (options.project || config.defaultProject);
  const createdAt = new Date().toISOString();
  const runId = createRunId(new Date(createdAt));
  const manifests = await loadDiscoveryRunManifests(rootDir, config, {
    projectKey,
    runId: options.runId,
    limit: options.limit
  });
  const queueRows = await loadQueueEntries(rootDir, config);
  const evaluation = buildDiscoveryEvaluation({
    projectKey,
    manifests,
    queueRows
  });
  const summary = renderDiscoveryEvaluationSummary(evaluation);
  const report = buildDiscoveryEvaluationReport(evaluation, rootDir);
  const artifactDir = await writeDiscoveryEvaluationArtifacts(
    rootDir,
    config,
    runId,
    report,
    summary,
    options.dryRun
  );

  console.log(summary);
  console.log(`Run directory: ${path.relative(rootDir, artifactDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`JSON report: ${path.relative(rootDir, path.join(artifactDir, "discovery-evaluation-report.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log("");
  console.log(renderNextCommandSections(buildDiscoveryEvaluationGuidance(projectKey, evaluation)));

  await refreshContext(rootDir, config, {
    command: "discover-evaluate",
    projectKey: projectKey ?? "all-projects",
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, artifactDir)
  });

  return {
    runId,
    createdAt,
    evaluation,
    artifactDir
  };
}
