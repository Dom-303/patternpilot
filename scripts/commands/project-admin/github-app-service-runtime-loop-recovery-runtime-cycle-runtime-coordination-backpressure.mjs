import {
  appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryEntry,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview,
  createRunId,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSummary,
  writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure
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

async function writeBackpressureArtifacts(rootDir, payload, options = {}) {
  const rootPath = path.join(
    rootDir,
    "runs",
    "integration",
    "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure",
    payload.runId
  );
  const reviewPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-review.json");
  const receiptsPath = path.join(rootPath, "service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-receipts.json");
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

async function recordBackpressureHistory(rootDir, review, receipts, artifacts, options = {}) {
  return await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(
    rootDir,
    buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryEntry(
      review,
      receipts,
      {
        runId: options.runId,
        generatedAt: review.generatedAt,
        commandName: options.commandName,
        statePath: options.statePath,
        reviewPath: artifacts.reviewPath,
        summaryPath: artifacts.summaryPath
      }
    ),
    options
  );
}

async function buildBackpressureReviewResult(rootDir, options = {}) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const governanceState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir);
  const coordinationState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(rootDir);
  const backpressureState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview(
    receiptState,
    governanceState,
    coordinationState,
    backpressureState,
    {
      generatedAt: new Date().toISOString(),
      now: options.now,
      workerIds: options.workerIds,
      workerId: options.workerId,
      coordinationGroupBudget: options.coordinationGroupBudget,
      coordinationBackpressureSeconds: options.coordinationBackpressureSeconds
    }
  );
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSummary(review);
  const runId = createRunId();
  const artifacts = await writeBackpressureArtifacts(rootDir, {
    runId,
    review,
    receipts: review.groupReviews,
    summary
  }, options);

  return {
    runId,
    receiptState,
    governanceState,
    coordinationState,
    backpressureState,
    review,
    summary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview(rootDir, config, options) {
  const result = await buildBackpressureReviewResult(rootDir, options);

  maybePrint(options, [
    result.summary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- governance_state_path: ${path.relative(rootDir, result.governanceState.governancePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- coordination_state_path: ${path.relative(rootDir, result.coordinationState.coordinationPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- backpressure_state_path: ${path.relative(rootDir, result.backpressureState.backpressurePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, result.artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureApply(rootDir, config, options) {
  const result = await buildBackpressureReviewResult(rootDir, options);
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview(
    result.backpressureState,
    result.review,
    {
      appliedAt: new Date().toISOString(),
      notes: options.notes
    }
  );
  const backpressurePath = await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(
    rootDir,
    applied.nextState,
    options
  );
  const applySummary = [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Apply",
    "",
    `- generated_at: ${result.review.generatedAt}`,
    `- group_count: ${result.review.groupCount}`,
    `- persisted_receipt_count: ${applied.receipts.length}`,
    "",
    "## Applied Group Backpressure",
    "",
    applied.receipts.length > 0
      ? applied.receipts.map((entry) =>
        `- group=${entry.coordinationGroupKey}: status=${entry.status}${entry.blockedUntil ? ` | blocked_until=${entry.blockedUntil}` : ""}${entry.primaryWorkerFamilyKey ? ` | primary_family=${entry.primaryWorkerFamilyKey}` : ""}${entry.workerFamilyKeys.length > 0 ? ` | families=${entry.workerFamilyKeys.join(",")}` : ""}`
      ).join("\n")
      : "- none",
    "",
    "## Next Action",
    "",
    `- ${applied.receipts.length > 0
      ? "Run the family-aware cycle runtime again and verify that lower-priority coordination groups are now temporarily deferred."
      : "No coordination-group backpressure entry needed to be persisted from this review."}`
  ].join("\n");
  const artifacts = await writeBackpressureArtifacts(rootDir, {
    runId: result.runId,
    review: result.review,
    receipts: applied.receipts,
    summary: applySummary
  }, options);
  await recordBackpressureHistory(rootDir, result.review, applied.receipts, artifacts, {
    ...options,
    runId: result.runId,
    commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-apply",
    statePath: path.relative(rootDir, backpressurePath)
  });

  maybePrint(options, [
    applySummary,
    `- receipts_path: ${path.relative(rootDir, result.receiptState.receiptsPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- backpressure_state_path: ${path.relative(rootDir, backpressurePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-apply",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    ...result,
    backpressurePath,
    applied,
    artifacts,
    summary: applySummary
  };
}

async function buildBackpressureFollowupResult(rootDir, options = {}) {
  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const governanceState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernance(rootDir);
  const coordinationState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordination(rootDir);
  const backpressureState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview(
    receiptState,
    governanceState,
    coordinationState,
    backpressureState,
    {
      generatedAt: new Date().toISOString(),
      now: options.now,
      workerIds: options.workerIds,
      workerId: options.workerId,
      coordinationBackpressureSeconds: options.coordinationBackpressureSeconds,
      coordinationGroupEscalationSeconds: options.coordinationGroupEscalationSeconds,
      coordinationGroupBudget: options.coordinationGroupBudget
    }
  );
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupSummary(review);
  const runId = createRunId();
  const artifacts = await writeBackpressureArtifacts(rootDir, {
    runId,
    review,
    receipts: review.followups,
    summary
  }, options);

  return {
    runId,
    backpressureState,
    review,
    summary,
    artifacts
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview(rootDir, config, options) {
  const result = await buildBackpressureFollowupResult(rootDir, options);

  maybePrint(options, [
    result.summary,
    `- backpressure_state_path: ${path.relative(rootDir, result.backpressureState.backpressurePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, result.artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, result.artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, result.artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-followup-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, result.artifacts.summaryPath)
    });
  }

  return result;
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupApply(rootDir, config, options) {
  const result = await buildBackpressureFollowupResult(rootDir, options);
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview(
    result.backpressureState,
    result.review,
    {
      appliedAt: new Date().toISOString(),
      notes: options.notes
    }
  );
  const backpressurePath = await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(
    rootDir,
    applied.nextState,
    options
  );
  const applySummary = [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Follow-up Apply",
    "",
    `- generated_at: ${result.review.generatedAt}`,
    `- group_count: ${result.review.groupCount}`,
    `- applied_count: ${applied.receipts.length}`,
    "",
    "## Applied Group Follow-ups",
    "",
    applied.receipts.length > 0
      ? applied.receipts.map((entry) =>
        `- group=${entry.coordinationGroupKey}: previous=${entry.previousStatus} | action=${entry.followupAction} | next=${entry.nextStatus}${entry.blockedUntil ? ` | blocked_until=${entry.blockedUntil}` : ""}`
      ).join("\n")
      : "- none",
    "",
    "## Next Action",
    "",
    `- ${applied.receipts.length > 0
      ? "Run the family-aware cycle runtime again and verify that released, refreshed or escalated coordination groups now behave as expected."
      : "No coordination-group backpressure follow-up needed to be persisted from this review."}`
  ].join("\n");
  const artifacts = await writeBackpressureArtifacts(rootDir, {
    runId: result.runId,
    review: result.review,
    receipts: applied.receipts,
    summary: applySummary
  }, options);
  await recordBackpressureHistory(rootDir, result.review, applied.receipts, artifacts, {
    ...options,
    runId: result.runId,
    commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-followup-apply",
    statePath: path.relative(rootDir, backpressurePath)
  });

  maybePrint(options, [
    applySummary,
    `- backpressure_state_path: ${path.relative(rootDir, backpressurePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_review: ${path.relative(rootDir, artifacts.reviewPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-followup-apply",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    ...result,
    backpressurePath,
    applied,
    artifacts,
    summary: applySummary
  };
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview(rootDir, config, options) {
  const historyState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview(historyState, {
    generatedAt: new Date().toISOString(),
    limit: options.limit
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReviewSummary(review);

  maybePrint(options, [
    summary,
    `- history_path: ${path.relative(rootDir, historyState.historyPath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-history-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, historyState.historyPath)
    });
  }

  return { historyState, review, summary };
}

function getFollowupPriority(action) {
  switch (action) {
    case "auto_release":
      return 0;
    case "escalate":
      return 1;
    case "refresh_backpressure":
      return 2;
    default:
      return 3;
  }
}

function buildAutoFollowupSelection(review, options = {}) {
  const actionable = review.followups
    .filter((item) => item.shouldApply)
    .sort((left, right) => {
      const priorityDiff = getFollowupPriority(left.followupAction) - getFollowupPriority(right.followupAction);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      const ageDiff = Number(right.ageSeconds ?? 0) - Number(left.ageSeconds ?? 0);
      if (ageDiff !== 0) {
        return ageDiff;
      }
      return String(left.coordinationGroupKey).localeCompare(String(right.coordinationGroupKey));
    });
  const limit = Number.isFinite(options.limit) && options.limit > 0
    ? Number(options.limit)
    : actionable.length;
  const selectedFollowups = actionable.slice(0, limit);
  const selectedKeys = new Set(selectedFollowups.map((item) => item.coordinationGroupKey));
  const filteredReview = {
    ...review,
    applyCount: selectedFollowups.length,
    followups: review.followups.map((item) => ({
      ...item,
      shouldApply: selectedKeys.has(item.coordinationGroupKey)
    }))
  };

  return {
    review: filteredReview,
    selectedFollowups,
    skippedCount: actionable.length - selectedFollowups.length
  };
}

function renderAutoFollowupSummary(review, applied, selection) {
  const selectedLines = selection.selectedFollowups.length > 0
    ? selection.selectedFollowups.map((item) =>
      `- group=${item.coordinationGroupKey}: action=${item.followupAction} | current=${item.currentStatus} | next=${item.nextStatus}${item.nextBlockedUntil ? ` | blocked_until=${item.nextBlockedUntil}` : ""}`
    ).join("\n")
    : "- none";

  return [
    "# Patternpilot GitHub App Service Runtime Loop Recovery Runtime Cycle Runtime Coordination Backpressure Auto Follow-up",
    "",
    `- generated_at: ${review.generatedAt}`,
    `- group_count: ${review.groupCount}`,
    `- selected_count: ${selection.selectedFollowups.length}`,
    `- skipped_count: ${selection.skippedCount}`,
    `- applied_count: ${applied.receipts.length}`,
    "",
    "## Selected Group Follow-ups",
    "",
    selectedLines,
    "",
    "## Next Action",
    "",
    `- ${applied.receipts.length > 0
      ? "Run the recovery-runtime cycle runtime again and verify that released, refreshed or escalated coordination groups now influence worker-pool scheduling correctly."
      : "No due coordination-group backpressure follow-up is currently available for auto-apply."}`
  ].join("\n");
}

export async function runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureAutoFollowup(rootDir, config, options) {
  const result = await buildBackpressureFollowupResult(rootDir, options);
  const selection = buildAutoFollowupSelection(result.review, options);

  if (selection.selectedFollowups.length === 0) {
    maybePrint(options, [
      renderAutoFollowupSummary(result.review, { receipts: [] }, selection),
      `- backpressure_state_path: ${path.relative(rootDir, result.backpressureState.backpressurePath)}${options.dryRun ? " (dry-run read-only)" : ""}`,
      `- auto_followup: no_due_group`
    ]);
    return {
      ...result,
      selection,
      autoApplied: false
    };
  }

  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview(
    result.backpressureState,
    selection.review,
    {
      appliedAt: new Date().toISOString(),
      notes: options.notes
    }
  );
  const backpressurePath = await writeGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressure(
    rootDir,
    applied.nextState,
    options
  );
  const summary = renderAutoFollowupSummary(selection.review, applied, selection);
  const artifacts = await writeBackpressureArtifacts(rootDir, {
    runId: result.runId,
    review: selection.review,
    receipts: applied.receipts,
    summary
  }, options);
  await recordBackpressureHistory(rootDir, selection.review, applied.receipts, artifacts, {
    ...options,
    runId: result.runId,
    commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-auto-followup",
    statePath: path.relative(rootDir, backpressurePath)
  });

  maybePrint(options, [
    summary,
    `- backpressure_state_path: ${path.relative(rootDir, backpressurePath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-auto-followup",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return {
    ...result,
    selection,
    applied,
    backpressurePath,
    artifacts,
    summary,
    autoApplied: true
  };
}
