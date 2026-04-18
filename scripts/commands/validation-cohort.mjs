import fs from "node:fs/promises";
import path from "node:path";
import { inspect } from "node:util";

import {
  createRunId,
  ensureDirectory,
  loadConfig
} from "../../lib/index.mjs";
import {
  buildValidationCloseoutMarkdown,
  buildValidationCohortReport,
  buildValidationRepoAssessment,
  DEFAULT_VALIDATION_COHORT,
  normalizeValidationCohort,
  renderValidationCohortSummary
} from "../../lib/validation/cohort.mjs";
import {
  buildGoldenPathCommands,
  renderNextCommandSections
} from "../shared/golden-path.mjs";
import { runBootstrap } from "./project-admin/core.mjs";
import { runProductReadiness } from "./product-readiness.mjs";
import { runGovernance } from "./run-diagnostics.mjs";
import { runReviewWatchlist, runSyncWatchlist } from "./watchlist.mjs";

function formatCapturedArg(value) {
  if (typeof value === "string") {
    return value;
  }
  return inspect(value, {
    depth: 6,
    breakLength: 120,
    colors: false,
    compact: false
  });
}

function serializeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null
  };
}

async function captureCommandOutput(fn) {
  const events = [];
  const original = {
    log: console.log,
    error: console.error,
    warn: console.warn
  };

  console.log = (...args) => {
    events.push(args.map(formatCapturedArg).join(" "));
  };
  console.error = (...args) => {
    events.push(args.map(formatCapturedArg).join(" "));
  };
  console.warn = (...args) => {
    events.push(args.map(formatCapturedArg).join(" "));
  };

  try {
    const result = await fn();
    return {
      ok: true,
      result,
      output: events.join("\n")
    };
  } catch (error) {
    return {
      ok: false,
      error,
      output: events.join("\n")
    };
  } finally {
    console.log = original.log;
    console.error = original.error;
    console.warn = original.warn;
  }
}

async function readJsonFile(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function resolveValidationEntries(rootDir, options) {
  if (!options.manifest) {
    return {
      manifestLabel: "built_in_default",
      entries: normalizeValidationCohort(DEFAULT_VALIDATION_COHORT, { limit: options.limit ?? null })
    };
  }

  const manifestPath = path.resolve(rootDir, options.manifest);
  const parsed = await readJsonFile(manifestPath);
  const rawEntries = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed.repos)
      ? parsed.repos
      : [];

  return {
    manifestLabel: path.relative(rootDir, manifestPath),
    entries: normalizeValidationCohort(rawEntries, { limit: options.limit ?? null })
  };
}

async function seedValidationWorkspace({
  rootDir,
  workspaceRoot,
  queueHeader,
  landkarteHeader
}) {
  const baseConfigRaw = await fs.readFile(path.join(rootDir, "patternpilot.config.json"), "utf8");
  await ensureDirectory(workspaceRoot, false);
  await ensureDirectory(path.join(workspaceRoot, "automation"), false);
  await ensureDirectory(path.join(workspaceRoot, "state"), false);
  await ensureDirectory(path.join(workspaceRoot, "knowledge"), false);

  await fs.writeFile(path.join(workspaceRoot, "patternpilot.config.json"), baseConfigRaw, "utf8");
  await fs.writeFile(path.join(workspaceRoot, "automation", "patternpilot-jobs.json"), `${JSON.stringify({ jobs: [] }, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(workspaceRoot, "state", "repo_intake_queue.csv"), `${queueHeader}\n`, "utf8");
  await fs.writeFile(path.join(workspaceRoot, "knowledge", "repo_landkarte.csv"), `${landkarteHeader}\n`, "utf8");
  await fs.writeFile(path.join(workspaceRoot, "knowledge", "repo_learnings.md"), "# Repo Learnings\n", "utf8");
  await fs.writeFile(path.join(workspaceRoot, "knowledge", "repo_decisions.md"), "# Repo Decisions\n", "utf8");
}

async function createSyntheticTarget(workspaceRoot, projectKey, repoRef) {
  const targetRoot = path.join(workspaceRoot, "targets", projectKey);
  await ensureDirectory(path.join(targetRoot, "src"), false);
  await ensureDirectory(path.join(targetRoot, "docs"), false);

  await fs.writeFile(path.join(targetRoot, "README.md"), `# ${projectKey}\n\nSynthetic local target for validating ${repoRef}.\n`, "utf8");
  await fs.writeFile(path.join(targetRoot, "package.json"), `${JSON.stringify({
    name: projectKey,
    private: true,
    version: "0.0.0",
    description: `Synthetic target workspace for validating ${repoRef}.`
  }, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(targetRoot, "src", "index.js"), "export function placeholder() { return 'patternpilot-validation'; }\n", "utf8");
  await fs.writeFile(path.join(targetRoot, "docs", "PROJECT_NOTES.md"), `Validation target created for ${repoRef}.\n`, "utf8");
  return targetRoot;
}

async function writeStageLog(repoArtifactRoot, stageName, captured) {
  const logPath = path.join(repoArtifactRoot, `${stageName}.log`);
  const header = [`# ${stageName}`, ""];
  if (!captured.ok) {
    header.push(`- status: failed`);
    header.push(`- error: ${captured.error?.message ?? "unknown error"}`);
    header.push("");
  }
  const content = `${header.join("\n")}${captured.output ? `${captured.output}\n` : ""}`;
  await fs.writeFile(logPath, content, "utf8");
  return logPath;
}

async function validateSingleRepo({
  rootDir,
  artifactRoot,
  queueHeader,
  landkarteHeader,
  entry
}) {
  const workspaceRoot = path.join(artifactRoot, "workspaces", entry.slug);
  const repoArtifactRoot = path.join(artifactRoot, "repos", entry.slug);
  const projectKey = `cohort-${entry.slug}`.slice(0, 80);

  await seedValidationWorkspace({
    rootDir,
    workspaceRoot,
    queueHeader,
    landkarteHeader
  });
  await ensureDirectory(repoArtifactRoot, false);
  const targetRoot = await createSyntheticTarget(workspaceRoot, projectKey, entry.repoRef);

  let config = await loadConfig(workspaceRoot);
  let completedStage = null;

  const bootstrap = await captureCommandOutput(() => runBootstrap(workspaceRoot, config, {
    project: projectKey,
    target: path.relative(workspaceRoot, targetRoot),
    label: `${entry.label} Validation Target`,
    makeDefault: true,
    dryRun: false
  }));
  const bootstrapLog = await writeStageLog(repoArtifactRoot, "bootstrap", bootstrap);
  if (!bootstrap.ok) {
    return buildValidationRepoAssessment({
      category: entry.category,
      repoUrl: entry.repoUrl,
      repoRef: entry.repoRef,
      workspaceRoot: path.relative(rootDir, workspaceRoot),
      projectKey,
      errorStage: "bootstrap",
      errorMessage: bootstrap.error?.message ?? "Bootstrap failed.",
      completedStage,
      logs: {
        bootstrap: path.relative(rootDir, bootstrapLog)
      }
    });
  }
  completedStage = "bootstrap";

  config = await loadConfig(workspaceRoot);
  const activeProjectKey = config.defaultProject ?? Object.keys(config.projects ?? {})[0] ?? projectKey;
  const watchlistPath = path.join(workspaceRoot, "bindings", activeProjectKey, "WATCHLIST.txt");
  await fs.writeFile(watchlistPath, `${entry.repoUrl}\n`, "utf8");

  const sync = await captureCommandOutput(() => runSyncWatchlist(workspaceRoot, config, {
    project: activeProjectKey,
    dryRun: false
  }));
  const syncLog = await writeStageLog(repoArtifactRoot, "sync-watchlist", sync);
  if (!sync.ok) {
    return buildValidationRepoAssessment({
      category: entry.category,
      repoUrl: entry.repoUrl,
      repoRef: entry.repoRef,
      workspaceRoot: path.relative(rootDir, workspaceRoot),
      projectKey,
      errorStage: "sync",
      errorMessage: sync.error?.message ?? "Watchlist sync failed.",
      completedStage,
      logs: {
        bootstrap: path.relative(rootDir, bootstrapLog),
        sync: path.relative(rootDir, syncLog)
      }
    });
  }
  completedStage = "sync";

  const review = await captureCommandOutput(() => runReviewWatchlist(workspaceRoot, config, {
    project: activeProjectKey,
    dryRun: false,
    reportView: "standard"
  }));
  const reviewLog = await writeStageLog(repoArtifactRoot, "review-watchlist", review);
  if (!review.ok) {
    return buildValidationRepoAssessment({
      category: entry.category,
      repoUrl: entry.repoUrl,
      repoRef: entry.repoRef,
      workspaceRoot: path.relative(rootDir, workspaceRoot),
      projectKey,
      errorStage: "review",
      errorMessage: review.error?.message ?? "Review failed.",
      completedStage,
      logs: {
        bootstrap: path.relative(rootDir, bootstrapLog),
        sync: path.relative(rootDir, syncLog),
        review: path.relative(rootDir, reviewLog)
      }
    });
  }
  completedStage = "review";

  const readiness = await captureCommandOutput(() => runProductReadiness(workspaceRoot, config, {
    project: activeProjectKey,
    dryRun: false,
    offline: false,
    json: false
  }));
  const readinessLog = await writeStageLog(repoArtifactRoot, "product-readiness", readiness);
  if (!readiness.ok) {
    return buildValidationRepoAssessment({
      category: entry.category,
      repoUrl: entry.repoUrl,
      repoRef: entry.repoRef,
      workspaceRoot: path.relative(rootDir, workspaceRoot),
      projectKey,
      errorStage: "readiness",
      errorMessage: readiness.error?.message ?? "Product readiness failed.",
      completedStage,
      logs: {
        bootstrap: path.relative(rootDir, bootstrapLog),
        sync: path.relative(rootDir, syncLog),
        review: path.relative(rootDir, reviewLog),
        readiness: path.relative(rootDir, readinessLog)
      }
    });
  }
  completedStage = "readiness";

  const governance = await captureCommandOutput(() => runGovernance(workspaceRoot, config, {
    project: activeProjectKey,
    dryRun: false,
    scope: null,
    urls: []
  }));
  const governanceLog = await writeStageLog(repoArtifactRoot, "run-governance", governance);
  if (!governance.ok) {
    return buildValidationRepoAssessment({
      category: entry.category,
      repoUrl: entry.repoUrl,
      repoRef: entry.repoRef,
      workspaceRoot: path.relative(rootDir, workspaceRoot),
      projectKey,
      errorStage: "governance",
      errorMessage: governance.error?.message ?? "Governance review failed.",
      completedStage,
      logs: {
        bootstrap: path.relative(rootDir, bootstrapLog),
        sync: path.relative(rootDir, syncLog),
        review: path.relative(rootDir, reviewLog),
        readiness: path.relative(rootDir, readinessLog),
        governance: path.relative(rootDir, governanceLog)
      }
    });
  }

  const intakeItems = sync.result?.items ?? [];
  const reviewPayload = review.result?.review ?? {};
  const readinessReview = readiness.result?.review ?? {};
  const governancePayload = governance.result?.governance ?? {};

  const detailedResult = buildValidationRepoAssessment({
    category: entry.category,
    repoUrl: entry.repoUrl,
    repoRef: entry.repoRef,
    workspaceRoot: path.relative(rootDir, workspaceRoot),
    projectKey: activeProjectKey,
    completedStage: "governance",
    intakeItems: intakeItems.length,
    enrichmentFailed: intakeItems.filter((item) => item.enrichment?.status === "failed").length,
    reviewItems: reviewPayload.items?.length ?? 0,
    missingUrls: reviewPayload.missingUrls?.length ?? 0,
    readinessOverallStatus: readinessReview.overallStatus ?? "unknown",
    readinessReleaseDecision: readinessReview.releaseDecision ?? null,
    readinessNextAction: readinessReview.nextAction ?? null,
    governanceStatus: governancePayload.status ?? "unknown",
    governanceNextAction: governancePayload.nextAction ?? null,
    logs: {
      bootstrap: path.relative(rootDir, bootstrapLog),
      sync: path.relative(rootDir, syncLog),
      review: path.relative(rootDir, reviewLog),
      readiness: path.relative(rootDir, readinessLog),
      governance: path.relative(rootDir, governanceLog)
    },
    metrics: {
      intakeItems: intakeItems.length,
      newItems: intakeItems.filter((item) => String(item.action ?? "").includes("new")).length,
      knownItems: intakeItems.filter((item) => String(item.action ?? "").includes("known")).length,
      reviewItems: reviewPayload.items?.length ?? 0,
      topFitBand: reviewPayload.topItems?.[0]?.projectFitBand ?? "unknown",
      missingUrls: reviewPayload.missingUrls?.length ?? 0,
      readinessOverallStatus: readinessReview.overallStatus ?? "unknown",
      readinessReleaseDecision: readinessReview.releaseDecision ?? null,
      governanceStatus: governancePayload.status ?? "unknown"
    }
  });

  await fs.writeFile(path.join(repoArtifactRoot, "result.json"), `${JSON.stringify(detailedResult, null, 2)}\n`, "utf8");
  return detailedResult;
}

export async function runValidateCohort(rootDir, _config, options) {
  const { manifestLabel, entries } = await resolveValidationEntries(rootDir, options);
  const generatedAt = new Date().toISOString();
  const runId = createRunId(new Date(generatedAt));
  const artifactRoot = path.join(rootDir, "runs", "validation-cohort", runId);

  if (entries.length === 0) {
    console.log(`# Patternpilot Validation Cohort`);
    console.log(``);
    console.log(`- status: empty_manifest`);
    console.log(`- manifest: ${manifestLabel}`);
    console.log(``);
    console.log(renderNextCommandSections({
      primary: "Add at least one GitHub repo URL to the cohort manifest or use the built-in default cohort.",
      additional: [
        "npm run validate:cohort",
        "npm run getting-started"
      ]
    }));
    return {
      runId,
      report: buildValidationCohortReport({
        runId,
        generatedAt,
        manifestLabel,
        results: []
      }),
      artifacts: null
    };
  }

  if (options.dryRun) {
    console.log(`# Patternpilot Validation Cohort`);
    console.log(``);
    console.log(`- run_id: ${runId}`);
    console.log(`- manifest: ${manifestLabel}`);
    console.log(`- repos_planned: ${entries.length}`);
    console.log(``);
    console.log(`## Planned Cohort`);
    for (const entry of entries) {
      console.log(`- ${entry.repoRef} (${entry.category})`);
    }
    console.log(``);
    console.log(renderNextCommandSections({
      primary: "Run the same command without --dry-run to execute the full validation cohort.",
      additional: [
        "npm run release:smoke",
        "npm run patternpilot -- product-readiness"
      ]
    }));
    return {
      runId,
      report: buildValidationCohortReport({
        runId,
        generatedAt,
        manifestLabel,
        results: entries.map((entry) => ({
          repoRef: entry.repoRef,
          category: entry.category,
          validationStatus: "planned",
          setupStatus: "planned",
          bootstrapStatus: "planned",
          intakeStatus: "planned",
          reviewStatus: "planned",
          readinessStatus: "planned",
          needsFix: false,
          biggestStrength: "Planned cohort validation.",
          biggestBreak: "Not executed yet."
        }))
      }),
      artifacts: null
    };
  }

  await ensureDirectory(artifactRoot, false);
  const queueHeader = (await fs.readFile(path.join(rootDir, "state", "repo_intake_queue.csv"), "utf8")).split(/\r?\n/, 1)[0];
  const landkarteHeader = (await fs.readFile(path.join(rootDir, "knowledge", "repo_landkarte.csv"), "utf8")).split(/\r?\n/, 1)[0];

  console.log(`# Patternpilot Validation Cohort`);
  console.log(``);
  console.log(`- run_id: ${runId}`);
  console.log(`- manifest: ${manifestLabel}`);
  console.log(`- repos_validated: ${entries.length}`);
  console.log(`- artifact_root: ${path.relative(rootDir, artifactRoot)}`);
  console.log(``);

  const results = [];
  for (const [index, entry] of entries.entries()) {
    console.log(`## [${index + 1}/${entries.length}] ${entry.repoRef}`);
    console.log(`- category: ${entry.category}`);
    const result = await validateSingleRepo({
      rootDir,
      artifactRoot,
      queueHeader,
      landkarteHeader,
      entry
    });
    results.push(result);
    console.log(`- validation_status: ${result.validationStatus}`);
    console.log(`- intake: ${result.intakeStatus}`);
    console.log(`- review: ${result.reviewStatus}`);
    console.log(`- readiness: ${result.readinessStatus}`);
    console.log(`- governance: ${result.governanceStatus ?? "-"}`);
    console.log(`- fix_needed: ${result.needsFix ? "yes" : "no"}`);
    console.log(``);
  }

  const report = buildValidationCohortReport({
    runId,
    generatedAt,
    manifestLabel,
    results
  });
  const summary = renderValidationCohortSummary(report);
  const closeout = buildValidationCloseoutMarkdown(report);

  await fs.writeFile(path.join(artifactRoot, "validation-cohort-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await fs.writeFile(path.join(artifactRoot, "summary.md"), `${summary}\n`, "utf8");
  await fs.writeFile(path.join(artifactRoot, "closeout.md"), `${closeout}\n`, "utf8");

  console.log(summary);
  console.log(`- report_json: ${path.relative(rootDir, path.join(artifactRoot, "validation-cohort-report.json"))}`);
  console.log(`- summary_md: ${path.relative(rootDir, path.join(artifactRoot, "summary.md"))}`);
  console.log(`- closeout_md: ${path.relative(rootDir, path.join(artifactRoot, "closeout.md"))}`);
  console.log(``);
  console.log(renderNextCommandSections({
    primary: report.fixCount > 0 || report.statuses.failed > 0
      ? "Review the cohort closeout and fix any repo rows that still say needs_fix or failed."
      : "Use the cohort closeout as the Phase 4 proof point and move into the final Phase 5 core closeout.",
    additional: report.fixCount > 0 || report.statuses.failed > 0
      ? [
        "npm run release:smoke",
        "npm run patternpilot -- product-readiness",
        buildGoldenPathCommands("my-project").reviewWatchlist
      ]
      : [
        "npm run release:smoke",
        "npm run patternpilot -- product-readiness",
        "Review docs/foundation/V1_STATUS.md and fold any product-relevant findings into the stable docs."
      ]
  }));

  return {
    runId,
    report,
    artifacts: {
      artifactRoot,
      reportPath: path.join(artifactRoot, "validation-cohort-report.json"),
      summaryPath: path.join(artifactRoot, "summary.md"),
      closeoutPath: path.join(artifactRoot, "closeout.md")
    }
  };
}
