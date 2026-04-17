import {
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview,
  createRunId,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceSummary,
  writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance
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

async function writeGovernanceArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance",
    payload.runId
  );
  const reviewPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-governance-review.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-governance-receipts.json");
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

async function buildGovernanceReviewResult(rootDir, options = {}) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const governanceState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview(
    receiptState,
    governanceState,
    {
      generatedAt: new Date().toISOString(),
      now: options.now,
      workerIds: options.workerIds,
      workerId: options.workerId
    }
  );
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceSummary(review);
  const runId = createRunId();
  const artifacts = await writeGovernanceArtifacts(rootDir, {
    runId,
    review,
    receipts: review.familyReviews,
    summary
  }, options);

  return {
    runId,
    receiptState,
    governanceState,
    review,
    summary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview(rootDir, config, options) {
  const result = await buildGovernanceReviewResult(rootDir, options);

  maybePrint(options, [
    result.summary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- governance_state_path: ${path.relative(rootDir, result.governanceState.governancePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, result.artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceApply(rootDir, config, options) {
  const result = await buildGovernanceReviewResult(rootDir, options);
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview(
    result.governanceState,
    result.review,
    {
      appliedAt: new Date().toISOString(),
      notes: options.notes
    }
  );
  const governancePath = await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(
    rootDir,
    applied.nextState,
    options
  );
  const applySummary = [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Governance Apply",
    "",
    `- generated_at: ${result.review.generatedAt}`,
    `- family_count: ${result.review.familyCount}`,
    `- persisted_receipt_count: ${applied.receipts.length}`,
    "",
    "## Applied Governance",
    "",
    applied.receipts.length > 0
      ? applied.receipts.map((entry) =>
        `- family=${entry.workerFamilyKey}: status=${entry.status}${entry.blockedUntil ? ` | blocked_until=${entry.blockedUntil}` : ""}${entry.maxSelectedCount != null ? ` | max_selected=${entry.maxSelectedCount}` : ""}${entry.preferredWorkerId ? ` | preferred_worker=${entry.preferredWorkerId}` : ""}${entry.allowedWorkerIds.length > 0 ? ` | allowed_workers=${entry.allowedWorkerIds.join(",")}` : ""}`
      ).join("\n")
      : "- none",
    "",
    "## Next Action",
    "",
    `- ${applied.receipts.length > 0
      ? "Run the family-aware cycle runtime again and verify the new holds and throttles behave as expected."
      : "No governance entry needed to be persisted from this review."}`
  ].join("\n");
  const artifacts = await writeGovernanceArtifacts(rootDir, {
    runId: result.runId,
    review: result.review,
    receipts: applied.receipts,
    summary: applySummary
  }, options);

  maybePrint(options, [
    applySummary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- governance_state_path: ${path.relative(rootDir, governancePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-apply",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    ...result,
    governancePath,
    applied,
    artifacts,
    summary: applySummary
  };
}

async function buildGovernanceReleaseResult(rootDir, options = {}) {
  const governanceState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan(governanceState, {
    generatedAt: new Date().toISOString(),
    fromStatus: options.fromStatus,
    limit: options.limit,
    clearBudget: options.clearBudget
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseSummary(plan);
  const runId = createRunId();
  const artifacts = await writeGovernanceArtifacts(rootDir, {
    runId,
    review: plan,
    receipts: plan.selectedFamilies,
    summary
  }, options);

  return {
    runId,
    governanceState,
    plan,
    summary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseReview(rootDir, config, options) {
  const result = await buildGovernanceReleaseResult(rootDir, options);

  maybePrint(options, [
    result.summary,
    `- governance_state_path: ${path.relative(rootDir, result.governanceState.governancePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, result.artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-release-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceRelease(rootDir, config, options) {
  const result = await buildGovernanceReleaseResult(rootDir, options);
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan(
    result.governanceState,
    result.plan,
    {
      releasedAt: new Date().toISOString(),
      notes: options.notes
    }
  );
  const governancePath = await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(
    rootDir,
    applied.nextState,
    options
  );
  const releaseSummary = [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Governance Release",
    "",
    `- generated_at: ${result.plan.generatedAt}`,
    `- family_count: ${result.plan.familyCount}`,
    `- released_count: ${applied.receipts.length}`,
    `- clear_budget: ${options.clearBudget ? "yes" : "no"}`,
    "",
    "## Released Families",
    "",
    applied.receipts.length > 0
      ? applied.receipts.map((entry) =>
        `- family=${entry.workerFamilyKey}: previous=${entry.previousStatus} | released=${entry.releasedStatus}${entry.clearedBudget ? " | cleared_budget=yes" : ""}${entry.preferredWorkerId ? ` | preferred_worker=${entry.preferredWorkerId}` : ""}${entry.allowedWorkerIds.length > 0 ? ` | allowed_workers=${entry.allowedWorkerIds.join(",")}` : ""}`
      ).join("\n")
      : "- none",
    "",
    "## Next Action",
    "",
    `- ${applied.receipts.length > 0
      ? "Run the family-aware cycle runtime again and confirm the released families now participate as expected."
      : result.plan.nextAction}`
  ].join("\n");
  const artifacts = await writeGovernanceArtifacts(rootDir, {
    runId: result.runId,
    review: result.plan,
    receipts: applied.receipts,
    summary: releaseSummary
  }, options);

  maybePrint(options, [
    releaseSummary,
    `- governance_state_path: ${path.relative(rootDir, governancePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-release",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    ...result,
    governancePath,
    applied,
    artifacts,
    summary: releaseSummary
  };
}
