import {
  buildGithubWebhookServiceRuntimePlan,
  claimGithubWebhookServiceRuntimeLanes,
  createRunId,
  loadGithubAppInstallationState,
  loadGithubWebhookServiceQueue,
  loadGithubWebhookServiceRuntimeClaims,
  reclaimExpiredGithubWebhookServiceRuntimeClaims,
  releaseGithubWebhookServiceRuntimeLanes,
  renderGithubWebhookServiceRuntimeSummary,
  writeGithubWebhookServiceRuntimeArtifacts
} from "../../../lib/index.mjs";
import {
  path,
  refreshContext
} from "./shared.mjs";
import {
  runGithubAppServiceTick
} from "./github-app-service.mjs";

function maybePrint(options, lines = []) {
  if (options.print === false) {
    return;
  }
  for (const line of lines) {
    console.log(line);
  }
}

export async function runGithubAppServiceRuntimeReview(rootDir, config, options) {
  const runId = createRunId();
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const installationState = await loadGithubAppInstallationState(rootDir);
  const runtimeClaimState = await loadGithubWebhookServiceRuntimeClaims(rootDir);
  const plan = buildGithubWebhookServiceRuntimePlan(queueState.queue, {
    generatedAt: new Date().toISOString(),
    workerId: options.workerId,
    workerIds: options.workerIds,
    schedulerLane: options.schedulerLane,
    installationState,
    runtimeClaimState
  });
  const summary = renderGithubWebhookServiceRuntimeSummary(plan);
  const artifacts = await writeGithubWebhookServiceRuntimeArtifacts(rootDir, {
    runId,
    plan,
    receipts: [],
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts: []
    }, null, 2));
    return { runId, plan, receipts: [], artifacts };
  }

  maybePrint(options, [
    summary,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-review",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, plan, receipts: [], artifacts };
}

export async function runGithubAppServiceRuntimeRun(rootDir, config, options) {
  const runId = createRunId();
  const runtimeClaimResult = await reclaimExpiredGithubWebhookServiceRuntimeClaims(rootDir, {
    dryRun: options.dryRun,
    now: new Date().toISOString()
  });
  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const installationState = await loadGithubAppInstallationState(rootDir);
  const plan = buildGithubWebhookServiceRuntimePlan(queueState.queue, {
    generatedAt: new Date().toISOString(),
    workerId: options.workerId,
    workerIds: options.workerIds,
    schedulerLane: options.schedulerLane,
    installationState,
    runtimeClaimState: runtimeClaimResult.state
  });
  const receipts = [];

  if (runtimeClaimResult.reclaimed.length > 0) {
    receipts.push(...runtimeClaimResult.reclaimed.map((claim) => ({
      workerId: claim.workerId,
      outcome: "runtime_claim_reclaimed",
      laneCount: 1,
      selectedCount: 0,
      lanes: [{ laneKey: claim.laneKey }]
    })));
  }

  if (options.apply) {
    for (const runtime of plan.runtimes.filter((item) => item.status === "dispatch_ready")) {
      const dispatchableLanes = runtime.lanes.filter((item) => item.status === "dispatch_ready");
      const claimResult = await claimGithubWebhookServiceRuntimeLanes(rootDir, dispatchableLanes, {
        dryRun: options.dryRun,
        workerId: runtime.workerId,
        leaseMinutes: options.runtimeLeaseMinutes,
        claimedAt: new Date().toISOString()
      });
      const runtimeLaneReceipts = [];
      for (const blocked of claimResult.blocked) {
        runtimeLaneReceipts.push({
          laneKey: blocked.laneKey,
          selectedCount: 0,
          outcome: blocked.outcome,
          claimedBy: blocked.claim?.workerId ?? null,
          summaryPath: null
        });
      }

      for (const lane of dispatchableLanes) {
        const claimReceipt = claimResult.claimed.find((item) => item.laneKey === lane.laneKey);
        if (!claimReceipt) {
          continue;
        }

        try {
          const tickResult = await runGithubAppServiceTick(rootDir, config, {
            ...options,
            workerId: runtime.workerId,
            schedulerLane: lane.laneKey,
            limit: lane.selectedCount,
            print: false,
            refreshContext: false
          });
          runtimeLaneReceipts.push({
            laneKey: lane.laneKey,
            selectedCount: tickResult.plan.selectedEntries.length,
            outcome: options.dryRun ? "lane_dry_run" : "lane_processed",
            summaryPath: path.relative(rootDir, tickResult.artifacts.summaryPath)
          });
        } finally {
          await releaseGithubWebhookServiceRuntimeLanes(rootDir, [lane.laneKey], {
            dryRun: options.dryRun,
            workerId: runtime.workerId
          });
        }
      }

      receipts.push({
        workerId: runtime.workerId,
        outcome: options.dryRun ? "runtime_dry_run" : "runtime_processed",
        laneCount: runtimeLaneReceipts.length,
        selectedCount: runtimeLaneReceipts.reduce((sum, receipt) => sum + Number(receipt.selectedCount ?? 0), 0),
        lanes: runtimeLaneReceipts,
        summaryPath: runtimeLaneReceipts[0]?.summaryPath ?? null
      });
    }
  }

  const summary = renderGithubWebhookServiceRuntimeSummary(plan, receipts);
  const artifacts = await writeGithubWebhookServiceRuntimeArtifacts(rootDir, {
    runId,
    plan,
    receipts,
    summary,
    dryRun: options.dryRun
  });

  if (options.json) {
    console.log(JSON.stringify({
      runId,
      artifacts: {
        rootPath: path.relative(rootDir, artifacts.rootPath),
        planPath: path.relative(rootDir, artifacts.planPath),
        receiptsPath: path.relative(rootDir, artifacts.receiptsPath),
        summaryPath: path.relative(rootDir, artifacts.summaryPath)
      },
      plan,
      receipts
    }, null, 2));
    return { runId, plan, receipts, artifacts };
  }

  maybePrint(options, [
    summary,
    `- artifact_root: ${path.relative(rootDir, artifacts.rootPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_plan: ${path.relative(rootDir, artifacts.planPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_receipts: ${path.relative(rootDir, artifacts.receiptsPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- artifact_summary: ${path.relative(rootDir, artifacts.summaryPath)}${options.dryRun ? " (dry-run not written)" : ""}`,
    `- reference_doc: docs/reference/GITHUB_APP_DEPLOYMENT.md`
  ]);

  if (options.refreshContext !== false) {
    await refreshContext(rootDir, config, {
      command: "github-app-service-runtime-run",
      projectKey: config.defaultProject,
      mode: options.dryRun ? "dry_run" : options.apply ? "write" : "manual",
      reportPath: path.relative(rootDir, artifacts.summaryPath)
    });
  }

  return { runId, plan, receipts, artifacts };
}
