import fs from "node:fs/promises";
import path from "node:path";
import {
  buildPolicyCuration,
  buildPolicyCurationApplyReview,
  buildPolicyCurationBatchReview,
  createRunId,
  ensureDirectory,
  loadQueueEntries,
  renderPolicyCurationApplyReviewSummary,
  renderPolicyCurationBatchPlanSummary,
  renderPolicyCurationBatchReviewSummary,
  renderPolicyCurationSummary,
  resolveDecisionsPath,
  resolveLearningsPath,
  selectPolicyCurationApplyCandidates,
  selectPolicyCurationBatchCandidates,
  upsertManagedMarkdownBlock
} from "../../lib/index.mjs";
import { refreshContext } from "../shared/runtime-helpers.mjs";
import { runPromote } from "./promotion.mjs";

async function resolveLatestCurationDir(rootDir, projectKey) {
  const curationRoot = path.join(rootDir, "projects", projectKey, "calibration", "curation");
  const entries = await fs.readdir(curationRoot, { withFileTypes: true }).catch(() => []);
  const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse()[0];
  if (!latest) {
    throw new Error(`No policy curation found for project '${projectKey}'.`);
  }
  return path.join("projects", projectKey, "calibration", "curation", latest);
}

async function loadCurationManifest(rootDir, curationDir) {
  return JSON.parse(await fs.readFile(path.resolve(rootDir, curationDir, "manifest.json"), "utf8"));
}

export async function runPolicyCurate(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  let resolvedHandoffDir = options.handoffDir;
  if (!resolvedHandoffDir) {
    const handoffRoot = path.join(rootDir, "projects", projectKey, "calibration", "handoffs");
    const entries = await fs.readdir(handoffRoot, { withFileTypes: true }).catch(() => []);
    const latest = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse()[0];
    if (!latest) {
      throw new Error(`No policy handoff found for project '${projectKey}'.`);
    }
    resolvedHandoffDir = path.join("projects", projectKey, "calibration", "handoffs", latest);
  }

  const handoffManifest = JSON.parse(
    await fs.readFile(path.resolve(rootDir, resolvedHandoffDir, "manifest.json"), "utf8")
  );
  const queueRows = await loadQueueEntries(rootDir, config);
  const curation = buildPolicyCuration({
    projectKey,
    handoffManifest,
    queueRows,
    limit: options.limit
  });
  const generatedAt = new Date().toISOString();
  const curationId = createRunId(new Date(generatedAt));
  const curationDir = path.join(rootDir, "projects", projectKey, "calibration", "curation", curationId);
  const notesPath = path.join(rootDir, "projects", projectKey, "calibration", "DISCOVERY_POLICY_NOTES.md");

  let promotionRun = null;
  if (options.preparePromotions || options.apply) {
    promotionRun = await runPromote(rootDir, config, {
      ...options,
      project: projectKey,
      urls: curation.curatedCandidates.map((item) => item.url),
      apply: Boolean(options.apply),
      limit: curation.curatedCandidates.length
    });
  }

  const summary = renderPolicyCurationSummary({
    projectKey,
    curationId,
    generatedAt,
    handoffId: handoffManifest.handoffId ?? path.basename(path.resolve(rootDir, resolvedHandoffDir)),
    cycleId: handoffManifest.cycleId ?? null,
    curation,
    promotionRun,
    dryRun: options.dryRun
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    curationId,
    handoffDir: resolvedHandoffDir,
    handoffId: handoffManifest.handoffId ?? null,
    cycleId: handoffManifest.cycleId ?? null,
    curation,
    promotionRun: promotionRun
      ? {
          runId: promotionRun.runId,
          runDir: path.relative(rootDir, promotionRun.runDir),
          items: promotionRun.items
        }
      : null
  };

  if (!options.dryRun) {
    await ensureDirectory(curationDir, false);
    await fs.writeFile(path.join(curationDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(curationDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    await fs.writeFile(path.join(curationDir, "curated-candidates.json"), `${JSON.stringify(curation.curatedCandidates, null, 2)}\n`, "utf8");
    await upsertManagedMarkdownBlock({
      filePath: notesPath,
      sectionKey: "policy-curation",
      sectionTitle: "Policy Curation",
      blockKey: curationId,
      blockContent: [
        `- generated_at: ${generatedAt}`,
        `- handoff_dir: ${resolvedHandoffDir}`,
        `- curated_candidates: ${curation.curatedCount}`,
        `- curation_dir: ${path.relative(rootDir, curationDir)}`,
        `- promotion_run: ${promotionRun?.runId ?? "-"}`,
        ...curation.curatedCandidates.map((item) => `- candidate: ${item.repoRef} :: score=${item.curationScore}`)
      ].join("\n"),
      dryRun: false
    });
  }

  console.log(summary);
  console.log(`- handoff_dir: ${resolvedHandoffDir}`);
  console.log(`- curation_dir: ${path.relative(rootDir, curationDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- curation_manifest: ${path.relative(rootDir, path.join(curationDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);
  if (promotionRun) {
    console.log(`- promotion_run_dir: ${path.relative(rootDir, promotionRun.runDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  }

  await refreshContext(rootDir, config, {
    command: "policy-curate",
    projectKey,
    mode: options.dryRun ? "dry_run" : options.apply ? "apply" : options.preparePromotions ? "prepare" : "write",
    reportPath: path.relative(rootDir, path.join(curationDir, "summary.md"))
  });

  return {
    projectKey,
    curationId,
    curation,
    promotionRun
  };
}

export async function runPolicyCurationReview(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const resolvedCurationDir = options.curationDir
    ? options.curationDir
    : await resolveLatestCurationDir(rootDir, projectKey);
  const curationManifest = await loadCurationManifest(rootDir, resolvedCurationDir);
  const selectedCandidates = selectPolicyCurationApplyCandidates(curationManifest, options);
  const landkarteText = await fs.readFile(path.join(rootDir, "knowledge", "repo_landkarte.csv"), "utf8").catch(() => "");
  const learningsText = await fs.readFile(resolveLearningsPath(rootDir, config), "utf8").catch(() => "");
  const decisionsText = await fs.readFile(resolveDecisionsPath(rootDir, config), "utf8").catch(() => "");
  const review = buildPolicyCurationApplyReview({
    candidates: selectedCandidates,
    landkarteText,
    learningsText,
    decisionsText
  });
  const generatedAt = new Date().toISOString();
  const reviewId = createRunId(new Date(generatedAt));
  const reviewDir = path.join(rootDir, "projects", projectKey, "calibration", "apply-review", reviewId);
  const summary = renderPolicyCurationApplyReviewSummary({
    projectKey,
    reviewId,
    generatedAt,
    curationId: curationManifest.curationId ?? null,
    review
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    reviewId,
    curationDir: resolvedCurationDir,
    curationId: curationManifest.curationId ?? null,
    selectedCandidates: selectedCandidates.map((item) => ({
      repoRef: item.repoRef,
      url: item.url
    })),
    review
  };

  if (!options.dryRun) {
    await ensureDirectory(reviewDir, false);
    await fs.writeFile(path.join(reviewDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(reviewDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- curation_dir: ${resolvedCurationDir}`);
  console.log(`- apply_review_dir: ${path.relative(rootDir, reviewDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- apply_review_manifest: ${path.relative(rootDir, path.join(reviewDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-review",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(reviewDir, "summary.md"))
  });

  return {
    projectKey,
    reviewId,
    review,
    selectedCandidates
  };
}

export async function runPolicyCurationApply(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const reviewRun = await runPolicyCurationReview(rootDir, config, options);
  const generatedAt = new Date().toISOString();
  const applyId = createRunId(new Date(generatedAt));
  const applyDir = path.join(rootDir, "projects", projectKey, "calibration", "apply", applyId);
  const promotionRun = await runPromote(rootDir, config, {
    ...options,
    project: projectKey,
    urls: reviewRun.selectedCandidates.map((item) => item.url),
    apply: true,
    limit: reviewRun.selectedCandidates.length
  });

  const summary = [
    "# Patternpilot Policy Curation Apply",
    "",
    `- project: ${projectKey}`,
    `- apply_id: ${applyId}`,
    `- generated_at: ${generatedAt}`,
    `- review_id: ${reviewRun.reviewId}`,
    `- selected_candidates: ${reviewRun.selectedCandidates.length}`,
    `- promotion_run: ${promotionRun.runId}`,
    `- promotion_items: ${promotionRun.items.length}`,
    `- decision_status: ${reviewRun.review.decisionStatus === "apply_ready" ? "applied" : "applied_with_care"}`,
    "",
    "## Applied Candidates",
    "",
    ...reviewRun.selectedCandidates.map((item) => `- ${item.repoRef} :: ${item.url}`),
    "",
    "## Next Step",
    "",
    `- next_command: npm run patternpilot -- re-evaluate --project ${projectKey} --stale-only`,
    ""
  ].join("\n");
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    applyId,
    reviewId: reviewRun.reviewId,
    selectedCandidates: reviewRun.selectedCandidates,
    promotionRun: {
      runId: promotionRun.runId,
      runDir: path.relative(rootDir, promotionRun.runDir),
      items: promotionRun.items
    }
  };

  if (!options.dryRun) {
    await ensureDirectory(applyDir, false);
    await fs.writeFile(path.join(applyDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(applyDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- apply_dir: ${path.relative(rootDir, applyDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- apply_manifest: ${path.relative(rootDir, path.join(applyDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-apply",
    projectKey,
    mode: options.dryRun ? "dry_run" : "apply",
    reportPath: path.relative(rootDir, path.join(applyDir, "summary.md"))
  });

  return {
    projectKey,
    applyId,
    promotionRun
  };
}

export async function runPolicyCurationBatchReview(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const resolvedCurationDir = options.curationDir
    ? options.curationDir
    : await resolveLatestCurationDir(rootDir, projectKey);
  const curationManifest = await loadCurationManifest(rootDir, resolvedCurationDir);
  const selectedCandidates = selectPolicyCurationBatchCandidates(curationManifest, options);
  const queueRows = (await loadQueueEntries(rootDir, config))
    .filter((row) => row.project_key === projectKey);
  const landkarteText = await fs.readFile(path.join(rootDir, "knowledge", "repo_landkarte.csv"), "utf8").catch(() => "");
  const learningsText = await fs.readFile(resolveLearningsPath(rootDir, config), "utf8").catch(() => "");
  const decisionsText = await fs.readFile(resolveDecisionsPath(rootDir, config), "utf8").catch(() => "");
  const review = buildPolicyCurationBatchReview({
    candidates: selectedCandidates,
    queueRows,
    landkarteText,
    learningsText,
    decisionsText
  });
  const generatedAt = new Date().toISOString();
  const reviewId = createRunId(new Date(generatedAt));
  const reviewDir = path.join(rootDir, "projects", projectKey, "calibration", "batch-review", reviewId);
  const summary = renderPolicyCurationBatchReviewSummary({
    projectKey,
    reviewId,
    generatedAt,
    curationId: curationManifest.curationId ?? null,
    review
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    reviewId,
    curationDir: resolvedCurationDir,
    curationId: curationManifest.curationId ?? null,
    review
  };

  if (!options.dryRun) {
    await ensureDirectory(reviewDir, false);
    await fs.writeFile(path.join(reviewDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(reviewDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- curation_dir: ${resolvedCurationDir}`);
  console.log(`- batch_review_dir: ${path.relative(rootDir, reviewDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- batch_review_manifest: ${path.relative(rootDir, path.join(reviewDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-batch-review",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(reviewDir, "summary.md"))
  });

  return {
    projectKey,
    reviewId,
    review
  };
}

export async function runPolicyCurationBatchPlan(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const resolvedCurationDir = options.curationDir
    ? options.curationDir
    : await resolveLatestCurationDir(rootDir, projectKey);
  const curationManifest = await loadCurationManifest(rootDir, resolvedCurationDir);
  const reviewRun = await runPolicyCurationBatchReview(rootDir, config, options);
  const generatedAt = new Date().toISOString();
  const planId = createRunId(new Date(generatedAt));
  const planDir = path.join(rootDir, "projects", projectKey, "calibration", "batch-plan", planId);
  const summary = renderPolicyCurationBatchPlanSummary({
    projectKey,
    planId,
    generatedAt,
    curationId: curationManifest.curationId ?? null,
    review: reviewRun.review
  });
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    planId,
    curationDir: resolvedCurationDir,
    curationId: curationManifest.curationId ?? null,
    reviewId: reviewRun.reviewId,
    governance: reviewRun.review.governance
  };

  if (!options.dryRun) {
    await ensureDirectory(planDir, false);
    await fs.writeFile(path.join(planDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(planDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- curation_dir: ${resolvedCurationDir}`);
  console.log(`- batch_plan_dir: ${path.relative(rootDir, planDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- batch_plan_manifest: ${path.relative(rootDir, path.join(planDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-batch-plan",
    projectKey,
    mode: options.dryRun ? "dry_run" : "write",
    reportPath: path.relative(rootDir, path.join(planDir, "summary.md"))
  });

  return {
    projectKey,
    planId,
    review: reviewRun.review
  };
}

export async function runPolicyCurationBatchApply(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  const reviewRun = await runPolicyCurationBatchReview(rootDir, config, options);
  const generatedAt = new Date().toISOString();
  const applyId = createRunId(new Date(generatedAt));
  const applyDir = path.join(rootDir, "projects", projectKey, "calibration", "batch-apply", applyId);
  const applyRows = options.force || options.scope === "all"
    ? reviewRun.review.rows.filter((item) => !item.alreadyPromoted)
    : reviewRun.review.governance.safeApplyCandidates;
  const applyUrls = applyRows.map((item) => item.url);

  let promotionRun = null;
  if (applyUrls.length > 0) {
    promotionRun = await runPromote(rootDir, config, {
      ...options,
      project: projectKey,
      urls: applyUrls,
      apply: true,
      limit: applyUrls.length
    });
  }

  const summary = [
    "# Patternpilot Policy Curation Batch Apply",
    "",
    `- project: ${projectKey}`,
    `- apply_id: ${applyId}`,
    `- generated_at: ${generatedAt}`,
    `- review_id: ${reviewRun.reviewId}`,
    `- selected_candidates: ${reviewRun.review.candidateCount}`,
    `- apply_candidates: ${reviewRun.review.applyCandidateCount}`,
    `- already_promoted: ${reviewRun.review.alreadyPromotedCount}`,
    `- manual_review: ${reviewRun.review.manualReviewCount}`,
    `- apply_scope: ${options.force || options.scope === "all" ? "all_non_promoted" : "safe_only"}`,
    `- promotion_run: ${promotionRun?.runId ?? "-"}`,
    `- promotion_items: ${promotionRun?.items?.length ?? 0}`,
    "",
    "## Batch Apply Candidates",
    "",
    ...(applyRows.length > 0
      ? applyRows.map((item) => `- ${item.repoRef} :: ${item.url}`)
      : ["- none"]),
    "",
    "## Manual Review Candidates",
    "",
    ...(reviewRun.review.governance.manualReviewCandidates.length > 0
      ? reviewRun.review.governance.manualReviewCandidates.map((item) => `- ${item.repoRef} :: risk=${item.conflictRisk} :: overlap=${item.overlapReasons.join(", ") || "-"}`)
      : ["- none"]),
    ""
  ].join("\n");
  const manifest = {
    schemaVersion: 1,
    projectKey,
    generatedAt,
    applyId,
    reviewId: reviewRun.reviewId,
    review: reviewRun.review,
    promotionRun: promotionRun
      ? {
          runId: promotionRun.runId,
          runDir: path.relative(rootDir, promotionRun.runDir),
          items: promotionRun.items
        }
      : null
  };

  if (!options.dryRun) {
    await ensureDirectory(applyDir, false);
    await fs.writeFile(path.join(applyDir, "summary.md"), `${summary}\n`, "utf8");
    await fs.writeFile(path.join(applyDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  }

  console.log(summary);
  console.log(`- batch_apply_dir: ${path.relative(rootDir, applyDir)}${options.dryRun ? " (dry-run not written)" : ""}`);
  console.log(`- batch_apply_manifest: ${path.relative(rootDir, path.join(applyDir, "manifest.json"))}${options.dryRun ? " (dry-run not written)" : ""}`);

  await refreshContext(rootDir, config, {
    command: "policy-curation-batch-apply",
    projectKey,
    mode: options.dryRun ? "dry_run" : "apply",
    reportPath: path.relative(rootDir, path.join(applyDir, "summary.md"))
  });

  return {
    projectKey,
    applyId,
    promotionRun
  };
}
