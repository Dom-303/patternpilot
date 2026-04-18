import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPolicyControlReview,
  createRunId,
  ensureDirectory,
  findLatestPolicyStageArtifact,
  loadPolicyStageArtifact,
  renderPolicyControlSummary
} from "../../../lib/index.mjs";
import { refreshContext } from "../../shared/runtime-helpers.mjs";

async function resolvePolicyStage(rootDir, projectKey, stageKey, explicitDir) {
  if (explicitDir) {
    return loadPolicyStageArtifact(rootDir, stageKey, explicitDir);
  }
  return findLatestPolicyStageArtifact(rootDir, projectKey, stageKey);
}

export async function runPolicyControl(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const cycle = await resolvePolicyStage(rootDir, projectKey, "cycle", options.cycleDir);
  const handoff = await resolvePolicyStage(rootDir, projectKey, "handoff", options.handoffDir);
  const curation = await resolvePolicyStage(rootDir, projectKey, "curation", options.curationDir);
  const applyReview = await resolvePolicyStage(rootDir, projectKey, "apply_review", options.applyReviewDir);
  const apply = await resolvePolicyStage(rootDir, projectKey, "apply", options.applyDir);

  const generatedAt = new Date().toISOString();
  const controlId = createRunId(new Date(generatedAt));
  const review = buildPolicyControlReview({
    projectKey,
    cycle,
    handoff,
    curation,
    applyReview,
    apply
  });
  const controlDir = path.join(rootDir, "projects", projectKey, "calibration", "control", controlId);
  const summary = renderPolicyControlSummary({
    projectKey,
    controlId,
    generatedAt,
    review,
    dryRun: options.dryRun
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    controlId,
    artifacts: {
      cycle: cycle?.relativeDir ?? null,
      handoff: handoff?.relativeDir ?? null,
      curation: curation?.relativeDir ?? null,
      applyReview: applyReview?.relativeDir ?? null,
      apply: apply?.relativeDir ?? null
    },
    review
  };

  if (!options.dryRun) {
    await ensureDirectory(controlDir, false);
    await fs.writeFile(path.join(controlDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(controlDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- cycle_dir: ${cycle?.relativeDir ?? "-"}`);
  console.log(`- handoff_dir: ${handoff?.relativeDir ?? "-"}`);
  console.log(`- curation_dir: ${curation?.relativeDir ?? "-"}`);
  console.log(`- apply_review_dir: ${applyReview?.relativeDir ?? "-"}`);
  console.log(`- apply_dir: ${apply?.relativeDir ?? "-"}`);
  console.log(`- control_dir: ${path.relative(rootDir, controlDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- control_manifest: ${path.relative(rootDir, path.join(controlDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-control",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(controlDir, "summary.md"))
  });

  return {
    projectKey,
    controlId,
    review
  };
}
