import {
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview,
  createRunId,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationSummary,
  writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination
} from "../../../lib/index.mjs";
import {
  fs,
  path,
  refreshContext
} from "./shared.mjs";

function maybePrint(options, lines = []) {
  if (options.print === false) {
    return;
  }
  for (const line of lines) {
    console.log(line);
  }
}

async function writeCoordinationArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination",
    payload.runId
  );
  const reviewPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-review.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-receipts.json");
  const summaryPath = path.join(rootPath, "summary.md");

  if (!options.dryRun) {
    await fs.mkdir(rootPath, { recursive: true });
    await fs.writeFile(reviewPath, `${JSON.stringify(payload.review, null, 2)}\n`, "utf8");
    await fs.writeFile(receiptsPath, `${JSON.stringify(payload.receipts, null, 2)}\n`, "utf8");
    await fs.writeFile(summaryPath, payload.summary, "utf8");
  }

  return {
    rootPath,
    reviewPath,
    receiptsPath,
    summaryPath
  };
}

async function buildCoordinationReviewResult(rootDir, options = {}) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const governanceState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir);
  const coordinationState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview(
    receiptState,
    governanceState,
    coordinationState,
    {
      generatedAt: new Date().toISOString(),
      now: options.now,
      workerIds: options.workerIds,
      workerId: options.workerId
    }
  );
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationSummary(review);
  const runId = createRunId();
  const artifacts = await writeCoordinationArtifacts(rootDir, {
    runId,
    review,
    receipts: review.familyReviews,
    summary
  }, options);

  return {
    runId,
    receiptState,
    governanceState,
    coordinationState,
    review,
    summary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview(rootDir, config, options) {
  const result = await buildCoordinationReviewResult(rootDir, options);

  maybePrint(options, [
    result.summary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- governance_state_path: ${path.relative(rootDir, result.governanceState.governancePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- coordination_state_path: ${path.relative(rootDir, result.coordinationState.coordinationPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, result.artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationApply(rootDir, config, options) {
  const result = await buildCoordinationReviewResult(rootDir, options);
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview(
    result.coordinationState,
    result.review,
    {
      appliedAt: new Date().toISOString(),
      notes: options.notes
    }
  );
  const coordinationPath = await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(
    rootDir,
    applied.nextState,
    options
  );
  const applySummary = [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Apply",
    "",
    `- generated_at: ${result.review.generatedAt}`,
    `- family_count: ${result.review.familyCount}`,
    `- persisted_receipt_count: ${applied.receipts.length}`,
    "",
    "## Applied Coordination",
    "",
    applied.receipts.length > 0
      ? applied.receipts.map((entry) =>
        `- family=${entry.workerFamilyKey}: status=${entry.status} | group=${entry.coordinationGroupKey}${entry.blockedByFamilyKey ? ` | blocked_by=${entry.blockedByFamilyKey}` : ""}${entry.effectiveWorkerIds.length > 0 ? ` | workers=${entry.effectiveWorkerIds.join(",")}` : ""}`
      ).join("\n")
      : "- none",
    "",
    "## Next Action",
    "",
    `- ${applied.receipts.length > 0
      ? "Run the family-aware cycle runtime again and verify that conflicting worker-pool families are now safely staggered."
      : "No coordination entry needed to be persisted from this review."}`
  ].join("\n");
  const artifacts = await writeCoordinationArtifacts(rootDir, {
    runId: result.runId,
    review: result.review,
    receipts: applied.receipts,
    summary: applySummary
  }, options);

  maybePrint(options, [
    applySummary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- coordination_state_path: ${path.relative(rootDir, coordinationPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-apply",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    ...result,
    coordinationPath,
    applied,
    artifacts,
    summary: applySummary
  };
}

async function buildCoordinationFollowupResult(rootDir, options = {}) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const governanceState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir);
  const coordinationState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview(
    receiptState,
    governanceState,
    coordinationState,
    {
      generatedAt: new Date().toISOString(),
      now: options.now,
      workerIds: options.workerIds,
      workerId: options.workerId,
      coordinationEscalationSeconds: options.coordinationEscalationSeconds
    }
  );
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupSummary(review);
  const runId = createRunId();
  const artifacts = await writeCoordinationArtifacts(rootDir, {
    runId,
    review,
    receipts: review.followups,
    summary
  }, options);

  return {
    runId,
    coordinationState,
    review,
    summary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview(rootDir, config, options) {
  const result = await buildCoordinationFollowupResult(rootDir, options);

  maybePrint(options, [
    result.summary,
    `- coordination_state_path: ${path.relative(rootDir, result.coordinationState.coordinationPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, result.artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-followup-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupApply(rootDir, config, options) {
  const result = await buildCoordinationFollowupResult(rootDir, options);
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview(
    result.coordinationState,
    result.review,
    {
      appliedAt: new Date().toISOString(),
      notes: options.notes
    }
  );
  const coordinationPath = await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(
    rootDir,
    applied.nextState,
    options
  );
  const applySummary = [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Follow-up Apply",
    "",
    `- generated_at: ${result.review.generatedAt}`,
    `- family_count: ${result.review.familyCount}`,
    `- applied_count: ${applied.receipts.length}`,
    "",
    "## Applied Follow-ups",
    "",
    applied.receipts.length > 0
      ? applied.receipts.map((entry) =>
        `- family=${entry.workerFamilyKey}: previous=${entry.previousStatus} | action=${entry.followupAction} | next=${entry.nextStatus}`
      ).join("\n")
      : "- none",
    "",
    "## Next Action",
    "",
    `- ${applied.receipts.length > 0
      ? "Re-run coordination and the family-aware cycle runtime to confirm released or escalated conflicts now behave correctly."
      : "No coordination follow-up needed to be persisted from this review."}`
  ].join("\n");
  const artifacts = await writeCoordinationArtifacts(rootDir, {
    runId: result.runId,
    review: result.review,
    receipts: applied.receipts,
    summary: applySummary
  }, options);

  maybePrint(options, [
    applySummary,
    `- coordination_state_path: ${path.relative(rootDir, coordinationPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-followup-apply",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    ...result,
    coordinationPath,
    applied,
    artifacts,
    summary: applySummary
  };
}
