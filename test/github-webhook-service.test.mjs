import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubWebhookServiceRequeuePlan,
  buildGithubWebhookServiceRuntimeClaim,
  buildGithubWebhookServiceRuntimeCyclePlan,
  buildGithubWebhookServiceRuntimeCloseoutReview,
  buildGithubWebhookServiceRuntimeControlReview,
  buildGithubWebhookServiceRuntimeMaintenancePlan,
  buildGithubWebhookServiceRuntimeIntegrityReview,
  buildGithubWebhookServiceRuntimeOpsReview,
  buildGithubWebhookServiceRuntimeLoopHistoryEntry,
  buildGithubWebhookServiceRuntimeLoopHistoryReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryAssessment,
  buildGithubWebhookServiceRuntimeLoopRecoveryContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryReceipt,
  buildGithubWebhookServiceRuntimeLoopRecoveryReceiptReleasePlan,
  buildGithubWebhookServiceRuntimeLoopRecoveryReceiptsReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryEntry,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleResumeContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryEntry,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResumeContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleState,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryEntry,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryAssessment,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResumeContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResumeContract,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionState,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimePlan,
  buildGithubWebhookServiceRuntimeLoopRecoveryReview,
  buildGithubWebhookServiceRuntimeLoopResumeContract,
  buildGithubWebhookServiceRuntimeLoopState,
  buildGithubWebhookServiceRuntimeSessionResumeContract,
  buildGithubWebhookServiceRuntimeSessionState,
  buildGithubWebhookServiceReviewPlan,
  buildGithubWebhookServiceRuntimePlan,
  buildGithubWebhookServiceSchedulerPlan,
  buildGithubWebhookServiceTickPlan,
  claimGithubWebhookServiceRuntimeLanes,
  claimGithubWebhookServiceQueueEntries,
  classifyGithubWebhookServiceQueueEntry,
  evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt,
  evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt,
  enqueueGithubWebhookServiceContractFromFile,
  loadGithubWebhookServiceRuntimeLoopHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryReceipts,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory,
  loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts,
  loadGithubWebhookServiceRuntimeClaims,
  loadGithubWebhookServiceQueue,
  queueGithubWebhookServiceContract,
  appendGithubWebhookServiceRuntimeLoopHistory,
  appendGithubWebhookServiceRuntimeLoopRecoveryReceipt,
  appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory,
  appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory,
  appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory,
  appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview,
  applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan,
  buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan,
  markGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptResumed,
  markGithubWebhookServiceRuntimeLoopRecoveryReceiptAttempted,
  reclaimExpiredGithubWebhookServiceRuntimeClaims,
  releaseGithubWebhookServiceRuntimeLoopRecoveryReceipts,
  releaseGithubWebhookServiceRuntimeLanes,
  reclaimExpiredGithubWebhookServiceClaims,
  requeueGithubWebhookServiceQueueEntries,
  renderGithubWebhookServiceRequeueSummary,
  renderGithubWebhookServiceRuntimeCycleSummary,
  renderGithubWebhookServiceRuntimeCloseoutSummary,
  renderGithubWebhookServiceRuntimeControlSummary,
  renderGithubWebhookServiceRuntimeMaintenanceSummary,
  renderGithubWebhookServiceRuntimeIntegritySummary,
  renderGithubWebhookServiceRuntimeOpsSummary,
  renderGithubWebhookServiceRuntimeLoopHistoryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryReceiptReleaseSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryReceiptsReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeSummary,
  renderGithubWebhookServiceRuntimeLoopRecoveryReviewSummary,
  renderGithubWebhookServiceRuntimeLoopSummary,
  renderGithubWebhookServiceRuntimeSessionSummary,
  renderGithubWebhookServiceReviewSummary,
  renderGithubWebhookServiceRuntimeSummary,
  renderGithubWebhookServiceSchedulerSummary,
  renderGithubWebhookServiceTickSummary,
  writeGithubWebhookServiceArtifacts
} from "../lib/github-webhook-service.mjs";

test("queueGithubWebhookServiceContract writes pending contracts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-queue-"));
  const queued = await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "execution_contract",
    contractStatus: "dispatch_ready_contract_only",
    deliveryId: "delivery-123"
  });

  const raw = JSON.parse(await fs.readFile(queued.targetPath, "utf8"));
  assert.equal(queued.targetState, "pending");
  assert.equal(raw.contractKind, "execution_contract");
});

test("enqueueGithubWebhookServiceContractFromFile loads and queues contract", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-file-"));
  const sourcePath = path.join(rootDir, "contract.json");
  await fs.writeFile(sourcePath, `${JSON.stringify({
    contractKind: "resume_contract",
    contractStatus: "dispatch_ready_resume_contract"
  }, null, 2)}\n`, "utf8");

  const result = await enqueueGithubWebhookServiceContractFromFile(rootDir, sourcePath);
  assert.equal(result.contract.contractKind, "resume_contract");
  assert.match(result.queued.targetPath, /pending/);
});

test("queueGithubWebhookServiceContract skips active duplicates", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-dup-"));
  await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "resume_contract",
    contractStatus: "dispatch_ready_resume_contract",
    deliveryId: "delivery-dup",
    selectedProjectKey: "sample-project",
    resumeFromCommand: "on-demand"
  }, {
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const duplicate = await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "resume_contract",
    contractStatus: "dispatch_ready_resume_contract",
    deliveryId: "delivery-dup",
    selectedProjectKey: "sample-project",
    resumeFromCommand: "on-demand"
  }, {
    timestamp: "2026-04-15T12-01-00-000Z"
  });

  assert.ok(duplicate.duplicate);
  assert.match(duplicate.targetPath, /pending/);
});

test("classifyGithubWebhookServiceQueueEntry marks backoff recovery as blocked", () => {
  const entry = classifyGithubWebhookServiceQueueEntry({
    fileName: "recovery.json",
    contractPath: "/tmp/recovery.json",
    contract: {
      contractKind: "recovery_contract",
      contractStatus: "recovery_backoff_pending",
      recoveryAssessment: {
        nextEligibleAt: "2099-01-01T00:00:00.000Z"
      }
    }
  }, {
    now: "2026-04-15T12:00:00.000Z"
  });

  assert.equal(entry.action, "hold_recovery");
  assert.equal(entry.actionable, false);
  assert.equal(entry.blocked, true);
});

test("classifyGithubWebhookServiceQueueEntry blocks installation-scoped execution when operations are not ready", () => {
  const entry = classifyGithubWebhookServiceQueueEntry({
    fileName: "execution.json",
    contractPath: "/tmp/execution.json",
    contract: {
      contractKind: "execution_contract",
      contractStatus: "dispatch_ready_contract_only",
      installationId: 10101,
      selectedProjectKey: "sample-project"
    }
  }, {
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_manual_guard"
          }
        }
      ]
    }
  });

  assert.equal(entry.action, "installation_blocked");
  assert.equal(entry.actionable, false);
  assert.equal(entry.installationStatus, "service_manual_guard");
});

test("classifyGithubWebhookServiceQueueEntry allows installation-scoped execution when operations are ready", () => {
  const entry = classifyGithubWebhookServiceQueueEntry({
    fileName: "execution.json",
    contractPath: "/tmp/execution.json",
    contract: {
      contractKind: "execution_contract",
      contractStatus: "dispatch_ready_contract_only",
      installationId: 10101,
      selectedProjectKey: "sample-project"
    }
  }, {
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          }
        }
      ]
    }
  });

  assert.equal(entry.action, "run_execution");
  assert.equal(entry.actionable, true);
  assert.equal(entry.installationStatus, "service_ready");
});

test("classifyGithubWebhookServiceQueueEntry respects installation service lane guards", () => {
  const entry = classifyGithubWebhookServiceQueueEntry({
    fileName: "execution.json",
    contractPath: "/tmp/execution.json",
    contract: {
      contractKind: "execution_contract",
      contractStatus: "dispatch_ready_contract_only",
      installationId: 10101,
      selectedProjectKey: "sample-project"
    }
  }, {
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "manual_lane",
            tickDisposition: "manual_only",
            maxConcurrentClaims: 1
          }
        }
      ]
    }
  });

  assert.equal(entry.action, "installation_lane_blocked");
  assert.equal(entry.actionable, false);
  assert.equal(entry.installationLaneStatus, "lane_manual_guard");
});

test("classifyGithubWebhookServiceQueueEntry respects scheduler-scoped installation service schedule filters", () => {
  const entry = classifyGithubWebhookServiceQueueEntry({
    fileName: "execution.json",
    contractPath: "/tmp/execution.json",
    contract: {
      contractKind: "execution_contract",
      contractStatus: "dispatch_ready_contract_only",
      installationId: 10101,
      selectedProjectKey: "sample-project"
    }
  }, {
    schedulerLane: "recovery_priority:worker:worker-a",
    workerId: "worker-a",
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "high",
            tickBudget: 1
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "priority",
            workerMode: "allowed_pool",
            allowedWorkerIds: ["worker-a"]
          },
          serviceSchedule: {
            status: "schedule_runtime_governed",
            schedulerLane: "priority",
            laneKey: "priority:allowed_pool",
            workerScope: "allowed_pool",
            allowedWorkerIds: ["worker-a"],
            tickStrategy: "priority_first",
            maxTicksPerCycle: 1
          }
        }
      ]
    }
  });

  assert.equal(entry.action, "installation_schedule_blocked");
  assert.equal(entry.actionable, false);
  assert.equal(entry.installationScheduleStatus, "schedule_lane_filtered");
});

test("buildGithubWebhookServiceTickPlan selects only actionable entries up to limit", () => {
  const plan = buildGithubWebhookServiceTickPlan([
    {
      fileName: "a.json",
      contractPath: "/tmp/a.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only"
      }
    },
    {
      fileName: "b.json",
      contractPath: "/tmp/b.json",
      contract: {
        contractKind: "recovery_contract",
        contractStatus: "recovery_backoff_pending",
        recoveryAssessment: {
          nextEligibleAt: "2099-01-01T00:00:00.000Z"
        }
      }
    }
  ], {
    limit: 1,
    now: "2026-04-15T12:00:00.000Z"
  });

  assert.equal(plan.queueCount, 2);
  assert.equal(plan.actionableCount, 1);
  assert.equal(plan.blockedCount, 1);
  assert.equal(plan.selectedEntries.length, 1);
  assert.equal(plan.selectedEntries[0].action, "run_execution");
});

test("buildGithubWebhookServiceTickPlan counts installation-blocked entries", () => {
  const plan = buildGithubWebhookServiceTickPlan([
    {
      fileName: "a.json",
      contractPath: "/tmp/a.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 10101
      }
    }
  ], {
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_disabled"
          }
        }
      ]
    }
  });

  assert.equal(plan.actionableCount, 0);
  assert.equal(plan.installationBlockedCount, 1);
  assert.match(renderGithubWebhookServiceTickSummary(plan), /installation_blocked_count: 1/);
});

test("buildGithubWebhookServiceTickPlan filters selected entries by scheduler lane", () => {
  const plan = buildGithubWebhookServiceTickPlan([
    {
      fileName: "priority.json",
      contractPath: "/tmp/priority.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 10101
      }
    },
    {
      fileName: "recovery.json",
      contractPath: "/tmp/recovery.json",
      contract: {
        contractKind: "recovery_contract",
        contractStatus: "dispatch_ready_recovery_contract",
        installationId: 20202
      }
    }
  ], {
    schedulerLane: "recovery_priority:worker:worker-a",
    workerId: "worker-a",
    limit: 2,
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "high",
            tickBudget: 1,
            preferredContractKinds: ["execution_contract", "resume_contract", "recovery_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "priority",
            workerMode: "allowed_pool",
            allowedWorkerIds: ["worker-a"]
          },
          serviceSchedule: {
            status: "schedule_runtime_governed",
            schedulerLane: "priority",
            laneKey: "priority:allowed_pool",
            workerScope: "allowed_pool",
            allowedWorkerIds: ["worker-a"],
            tickStrategy: "priority_first",
            maxTicksPerCycle: 1
          }
        },
        {
          installationId: 20202,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "recovery_lane",
            tickDisposition: "recovery_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "urgent",
            tickBudget: 1,
            preferredContractKinds: ["recovery_contract", "resume_contract", "execution_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "recovery_priority",
            workerMode: "pinned_worker",
            assignedWorkerId: "worker-a",
            allowedWorkerIds: ["worker-a"]
          },
          serviceSchedule: {
            status: "schedule_runtime_governed",
            schedulerLane: "recovery_priority",
            laneKey: "recovery_priority:worker:worker-a",
            workerScope: "pinned_worker",
            preferredWorkerId: "worker-a",
            allowedWorkerIds: ["worker-a"],
            tickStrategy: "recovery_first",
            maxTicksPerCycle: 1
          }
        }
      ]
    }
  });

  assert.equal(plan.installationScheduleBlockedCount, 1);
  assert.equal(plan.selectedEntries.length, 1);
  assert.equal(plan.selectedEntries[0].fileName, "recovery.json");
  assert.match(renderGithubWebhookServiceTickSummary(plan), /scheduler_lane_filter: recovery_priority:worker:worker-a/);
});

test("buildGithubWebhookServiceSchedulerPlan groups queue work by runtime lane", () => {
  const plan = buildGithubWebhookServiceSchedulerPlan([
    {
      fileName: "priority.json",
      contractPath: "/tmp/priority.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 10101
      }
    },
    {
      fileName: "recovery.json",
      contractPath: "/tmp/recovery.json",
      contract: {
        contractKind: "recovery_contract",
        contractStatus: "dispatch_ready_recovery_contract",
        installationId: 20202
      }
    }
  ], {
    workerId: "worker-a",
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "high",
            tickBudget: 1,
            preferredContractKinds: ["execution_contract", "resume_contract", "recovery_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "priority",
            workerMode: "allowed_pool",
            allowedWorkerIds: ["worker-a"]
          },
          serviceSchedule: {
            status: "schedule_runtime_governed",
            schedulerLane: "priority",
            laneKey: "priority:allowed_pool",
            workerScope: "allowed_pool",
            allowedWorkerIds: ["worker-a"],
            tickStrategy: "priority_first",
            maxTicksPerCycle: 1
          }
        },
        {
          installationId: 20202,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "recovery_lane",
            tickDisposition: "recovery_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "urgent",
            tickBudget: 1,
            preferredContractKinds: ["recovery_contract", "resume_contract", "execution_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "recovery_priority",
            workerMode: "pinned_worker",
            assignedWorkerId: "worker-a",
            allowedWorkerIds: ["worker-a"]
          },
          serviceSchedule: {
            status: "schedule_runtime_governed",
            schedulerLane: "recovery_priority",
            laneKey: "recovery_priority:worker:worker-a",
            workerScope: "pinned_worker",
            preferredWorkerId: "worker-a",
            allowedWorkerIds: ["worker-a"],
            tickStrategy: "recovery_first",
            maxTicksPerCycle: 1
          }
        }
      ]
    }
  });

  assert.equal(plan.laneCount, 2);
  assert.equal(plan.dispatchableLaneCount, 2);
  assert.equal(plan.lanes[0].laneKey, "recovery_priority:worker:worker-a");
  assert.equal(plan.lanes[0].status, "dispatch_ready");
  assert.match(renderGithubWebhookServiceSchedulerSummary(plan), /dispatchable_lane_count: 2/);
});

test("buildGithubWebhookServiceRuntimePlan assigns scheduler lanes across worker runtimes", () => {
  const plan = buildGithubWebhookServiceRuntimePlan([
    {
      fileName: "pinned.json",
      contractPath: "/tmp/pinned.json",
      queueState: "pending",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 10101
      }
    },
    {
      fileName: "shared.json",
      contractPath: "/tmp/shared.json",
      queueState: "pending",
      contract: {
        contractKind: "resume_contract",
        contractStatus: "dispatch_ready_resume_contract",
        installationId: 20202
      }
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "recovery_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "high",
            tickBudget: 1,
            preferredContractKinds: ["execution_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "recovery_priority",
            workerMode: "pinned_worker",
            assignedWorkerId: "worker-a",
            allowedWorkerIds: ["worker-a"]
          },
          serviceSchedule: {
            status: "schedule_runtime_governed",
            schedulerLane: "recovery_priority",
            laneKey: "recovery_priority:worker:worker-a",
            workerScope: "pinned_worker",
            preferredWorkerId: "worker-a",
            allowedWorkerIds: ["worker-a"],
            tickStrategy: "recovery_first",
            maxTicksPerCycle: 1
          }
        },
        {
          installationId: 20202,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "shared_tick",
            maxConcurrentClaims: 2
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "normal",
            tickBudget: 2,
            preferredContractKinds: ["resume_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "shared_default",
            workerMode: "shared_pool",
            assignedWorkerId: null,
            allowedWorkerIds: []
          },
          serviceSchedule: {
            status: "schedule_runtime_governed",
            schedulerLane: "shared_default",
            laneKey: "shared_default:shared_pool",
            workerScope: "shared_pool",
            preferredWorkerId: null,
            allowedWorkerIds: [],
            tickStrategy: "balanced",
            maxTicksPerCycle: 2
          }
        }
      ]
    }
  });

  assert.equal(plan.runtimeCount, 2);
  assert.equal(plan.dispatchableRuntimeCount, 1);
  assert.equal(plan.runtimes[0].workerId, "worker-a");
  assert.ok(plan.runtimes.some((runtime) => runtime.workerId === "worker-b"));
  assert.match(renderGithubWebhookServiceRuntimeSummary(plan), /dispatchable_runtime_count: 1/);
});

test("buildGithubWebhookServiceRuntimePlan blocks lanes already claimed by another worker", () => {
  const plan = buildGithubWebhookServiceRuntimePlan([
    {
      fileName: "shared.json",
      contractPath: "/tmp/shared.json",
      queueState: "pending",
      contract: {
        contractKind: "resume_contract",
        contractStatus: "dispatch_ready_resume_contract",
        installationId: 20202
      }
    }
  ], {
    now: "2026-04-16T10:05:00.000Z",
    workerIds: ["worker-a", "worker-b"],
    runtimeClaimState: {
      claims: [
        buildGithubWebhookServiceRuntimeClaim({
          laneKey: "shared_default:shared_pool",
          workerId: "worker-b",
          claimedAt: "2026-04-16T10:00:00.000Z",
          leaseMinutes: 30
        })
      ]
    },
    installationState: {
      installations: [
        {
          installationId: 20202,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "shared_tick",
            maxConcurrentClaims: 2
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "normal",
            tickBudget: 2,
            preferredContractKinds: ["resume_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "shared_default",
            workerMode: "shared_pool",
            assignedWorkerId: null,
            allowedWorkerIds: []
          },
          serviceSchedule: {
            status: "schedule_runtime_governed",
            schedulerLane: "shared_default",
            laneKey: "shared_default:shared_pool",
            workerScope: "shared_pool",
            preferredWorkerId: null,
            allowedWorkerIds: [],
            tickStrategy: "balanced",
            maxTicksPerCycle: 2
          }
        }
      ]
    }
  });

  assert.equal(plan.dispatchableRuntimeCount, 0);
  assert.equal(plan.blockedLaneCount, 1);
  assert.equal(plan.blockedLanes[0].runtimeStatus, "runtime_claimed_elsewhere");
});

test("runtime lane claims can be claimed, released and reclaimed after expiry", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-runtime-claims-"));
  const claimResult = await claimGithubWebhookServiceRuntimeLanes(rootDir, [
    { laneKey: "priority:worker:worker-a" },
    { laneKey: "shared_default:shared_pool" }
  ], {
    workerId: "worker-a",
    claimedAt: "2026-04-16T10:00:00.000Z",
    leaseMinutes: 10,
    now: "2026-04-16T10:01:00.000Z"
  });
  const blockedClaim = await claimGithubWebhookServiceRuntimeLanes(rootDir, [
    { laneKey: "priority:worker:worker-a" }
  ], {
    workerId: "worker-b",
    claimedAt: "2026-04-16T10:01:00.000Z",
    leaseMinutes: 10,
    now: "2026-04-16T10:01:00.000Z"
  });
  const released = await releaseGithubWebhookServiceRuntimeLanes(rootDir, ["shared_default:shared_pool"], {
    workerId: "worker-a"
  });
  const reclaimed = await reclaimExpiredGithubWebhookServiceRuntimeClaims(rootDir, {
    now: "2026-04-16T10:20:00.000Z"
  });
  const stored = await loadGithubWebhookServiceRuntimeClaims(rootDir);

  assert.equal(claimResult.claimed.length, 2);
  assert.equal(blockedClaim.blocked.length, 1);
  assert.equal(blockedClaim.blocked[0].outcome, "runtime_claimed_elsewhere");
  assert.equal(released.released.length, 1);
  assert.equal(reclaimed.reclaimed.length, 1);
  assert.equal(stored.claims.length, 0);
});

test("buildGithubWebhookServiceRuntimeCyclePlan summarizes multiple runtime rounds", () => {
  const plan = buildGithubWebhookServiceRuntimeCyclePlan([
    {
      cycleIndex: 1,
      runtimeCount: 2,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 4,
      stopReason: null,
      summaryPath: "runs/integration/github-app-service-runtime/one/summary.md"
    },
    {
      cycleIndex: 2,
      runtimeCount: 1,
      dispatchableRuntimeCount: 0,
      blockedLaneCount: 1,
      queueCount: 2,
      stopReason: "no_dispatchable_runtime",
      summaryPath: "runs/integration/github-app-service-runtime/two/summary.md"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 3,
    stopReason: "no_dispatchable_runtime"
  });

  assert.equal(plan.completedCycles, 2);
  assert.equal(plan.stopReason, "no_dispatchable_runtime");
  assert.match(renderGithubWebhookServiceRuntimeCycleSummary(plan), /completed_cycles: 2/);
});

test("buildGithubWebhookServiceRuntimeSessionState summarizes multiple runtime-session rounds", () => {
  const state = buildGithubWebhookServiceRuntimeSessionState([
    {
      sessionIndex: 1,
      completedCycles: 2,
      runtimeCount: 4,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 1,
      queueCount: 3,
      cycleStopReason: "cycle_limit_reached",
      stopReason: "session_round_complete",
      summaryPath: "runs/integration/github-app-service-runtime-cycle/round-1/summary.md"
    },
    {
      sessionIndex: 2,
      completedCycles: 1,
      runtimeCount: 2,
      dispatchableRuntimeCount: 0,
      blockedLaneCount: 0,
      queueCount: 1,
      cycleStopReason: "no_dispatchable_runtime",
      stopReason: "no_dispatchable_runtime",
      summaryPath: "runs/integration/github-app-service-runtime-cycle/round-2/summary.md"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    runtimeCycleLimit: 3,
    sessionLimit: 4
  });

  const summary = renderGithubWebhookServiceRuntimeSessionSummary(state, [
    {
      sessionIndex: 1,
      outcome: "session_round_processed",
      completedCycles: 2,
      selectedCount: 4,
      summaryPath: "runs/integration/github-app-service-runtime-cycle/round-1/summary.md"
    }
  ]);

  assert.equal(state.completedSessions, 2);
  assert.equal(state.totalCycles, 3);
  assert.equal(state.stopReason, "no_dispatchable_runtime");
  assert.equal(state.resumeReady, false);
  assert.match(summary, /completed_sessions: 2/);
  assert.match(summary, /total_cycles: 3/);
});

test("buildGithubWebhookServiceRuntimeSessionResumeContract exposes remaining session budget", () => {
  const state = buildGithubWebhookServiceRuntimeSessionState([
    {
      sessionIndex: 1,
      completedCycles: 2,
      stopReason: "session_limit_reached"
    }
  ], {
    workerIds: ["worker-a"],
    runtimeCycleLimit: 3,
    sessionLimit: 3,
    stopReason: "session_limit_reached"
  });

  const contract = buildGithubWebhookServiceRuntimeSessionResumeContract(state, {
    sessionStatePath: "runs/integration/github-app-service-runtime-session/run-1/service-runtime-session-state.json"
  });

  assert.equal(contract.contractKind, "runtime_session_resume_contract");
  assert.equal(contract.contractStatus, "dispatch_ready_runtime_session_resume_contract");
  assert.equal(contract.remainingSessionBudget, 2);
  assert.equal(contract.resumeFromSessionIndex, 2);
});

test("buildGithubWebhookServiceRuntimeLoopState summarizes multiple runtime-loop rounds", () => {
  const state = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalCycles: 3,
      runtimeCount: 6,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 1,
      queueCount: 2,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_round_complete",
      summaryPath: "runs/integration/github-app-service-runtime-session/round-1/summary.md"
    },
    {
      loopIndex: 2,
      completedSessions: 1,
      totalCycles: 1,
      runtimeCount: 2,
      dispatchableRuntimeCount: 0,
      blockedLaneCount: 0,
      queueCount: 0,
      sessionStopReason: "no_dispatchable_runtime",
      stopReason: "no_dispatchable_runtime",
      summaryPath: "runs/integration/github-app-service-runtime-session/round-2/summary.md"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 2,
    loopLimit: 3
  });

  const summary = renderGithubWebhookServiceRuntimeLoopSummary(state, [
    {
      loopIndex: 1,
      outcome: "loop_round_processed",
      completedSessions: 2,
      totalCycles: 3,
      selectedCount: 4,
      summaryPath: "runs/integration/github-app-service-runtime-session/round-1/summary.md"
    }
  ]);

  assert.equal(state.completedLoops, 2);
  assert.equal(state.totalSessions, 3);
  assert.equal(state.totalCycles, 4);
  assert.equal(state.stopReason, "no_dispatchable_runtime");
  assert.equal(state.resumeReady, false);
  assert.match(summary, /completed_loops: 2/);
  assert.match(summary, /total_sessions: 3/);
});

test("buildGithubWebhookServiceRuntimeLoopResumeContract exposes remaining loop budget", () => {
  const state = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 1,
      totalCycles: 2,
      stopReason: "loop_limit_reached"
    }
  ], {
    workerIds: ["worker-a"],
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 2,
    loopLimit: 3,
    stopReason: "loop_limit_reached"
  });

  const contract = buildGithubWebhookServiceRuntimeLoopResumeContract(state, {
    loopStatePath: "runs/integration/github-app-service-runtime-loop/run-1/service-runtime-loop-state.json"
  });

  assert.equal(contract.contractKind, "runtime_loop_resume_contract");
  assert.equal(contract.contractStatus, "dispatch_ready_runtime_loop_resume_contract");
  assert.equal(contract.remainingLoopBudget, 2);
  assert.equal(contract.resumeFromLoopIndex, 2);
});

test("runtime loop history can append and review recent loop entries", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-runtime-history-"));
  const entry = buildGithubWebhookServiceRuntimeLoopHistoryEntry({
    completedLoops: 2,
    totalSessions: 3,
    totalCycles: 4,
    remainingLoopBudget: 1,
    stopReason: "loop_limit_reached",
    resumeReady: true,
    workerIds: ["worker-a", "worker-b"]
  }, [
    { selectedCount: 2 },
    { selectedCount: 1 }
  ], {
    runId: "runtime-loop-1",
    commandName: "github-app-service-runtime-loop-run",
    summaryPath: "runs/integration/github-app-service-runtime-loop/runtime-loop-1/summary.md"
  });

  await appendGithubWebhookServiceRuntimeLoopHistory(rootDir, entry);
  const history = await loadGithubWebhookServiceRuntimeLoopHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopHistoryReview(history, { limit: 5 });
  const summary = renderGithubWebhookServiceRuntimeLoopHistoryReviewSummary(review);

  assert.equal(history.entries.length, 1);
  assert.equal(review.resumableCount, 1);
  assert.equal(review.recentEntries[0].selectedCount, 3);
  assert.match(summary, /resumable_count: 1/);
});

test("buildGithubWebhookServiceTickPlan respects per-installation lane concurrency", () => {
  const plan = buildGithubWebhookServiceTickPlan([
    {
      fileName: "a.json",
      contractPath: "/tmp/a.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 10101
      }
    },
    {
      fileName: "b.json",
      contractPath: "/tmp/b.json",
      contract: {
        contractKind: "resume_contract",
        contractStatus: "dispatch_ready_resume_contract",
        installationId: 10101
      }
    }
  ], {
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          }
        }
      ]
    }
  });

  assert.equal(plan.actionableCount, 2);
  assert.equal(plan.selectedEntries.length, 1);
  assert.equal(plan.selectedEntries[0].fileName, "a.json");
});

test("buildGithubWebhookServiceTickPlan prioritizes installations by shared service plan", () => {
  const plan = buildGithubWebhookServiceTickPlan([
    {
      fileName: "normal.json",
      contractPath: "/tmp/normal.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 10101
      }
    },
    {
      fileName: "urgent.json",
      contractPath: "/tmp/urgent.json",
      contract: {
        contractKind: "recovery_contract",
        contractStatus: "dispatch_ready_recovery_contract",
        installationId: 20202
      }
    }
  ], {
    limit: 1,
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "normal",
            tickBudget: 1,
            preferredContractKinds: ["execution_contract", "resume_contract", "recovery_contract"]
          }
        },
        {
          installationId: 20202,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "recovery_lane",
            tickDisposition: "recovery_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "urgent",
            tickBudget: 1,
            preferredContractKinds: ["recovery_contract", "resume_contract", "execution_contract"]
          }
        }
      ]
    }
  });

  assert.equal(plan.selectedEntries.length, 1);
  assert.equal(plan.selectedEntries[0].fileName, "urgent.json");
});

test("buildGithubWebhookServiceTickPlan counts installation-plan blocked entries", () => {
  const plan = buildGithubWebhookServiceTickPlan([
    {
      fileName: "a.json",
      contractPath: "/tmp/a.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 10101
      }
    }
  ], {
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "low",
            tickBudget: 0,
            preferredContractKinds: []
          }
        }
      ]
    }
  });

  assert.equal(plan.actionableCount, 0);
  assert.equal(plan.installationPlanBlockedCount, 1);
  assert.match(renderGithubWebhookServiceTickSummary(plan), /installation_plan_blocked_count: 1/);
});

test("classifyGithubWebhookServiceQueueEntry respects worker routing mismatches", () => {
  const entry = classifyGithubWebhookServiceQueueEntry({
    fileName: "execution.json",
    contractPath: "/tmp/execution.json",
    contract: {
      contractKind: "execution_contract",
      contractStatus: "dispatch_ready_contract_only",
      installationId: 10101
    }
  }, {
    workerId: "worker-b",
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "high",
            tickBudget: 1,
            preferredContractKinds: ["execution_contract", "resume_contract", "recovery_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "priority",
            workerMode: "pinned_worker",
            assignedWorkerId: "worker-a"
          }
        }
      ]
    }
  });

  assert.equal(entry.action, "installation_worker_blocked");
  assert.equal(entry.actionable, false);
  assert.equal(entry.installationRoutingStatus, "routing_worker_mismatch");
});

test("buildGithubWebhookServiceTickPlan respects worker routing and scheduler lanes", () => {
  const plan = buildGithubWebhookServiceTickPlan([
    {
      fileName: "shared.json",
      contractPath: "/tmp/shared.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 10101
      }
    },
    {
      fileName: "pinned.json",
      contractPath: "/tmp/pinned.json",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        installationId: 20202
      }
    }
  ], {
    workerId: "worker-a",
    limit: 2,
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "normal",
            tickBudget: 1,
            preferredContractKinds: ["execution_contract", "resume_contract", "recovery_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "shared_default",
            workerMode: "any_worker"
          }
        },
        {
          installationId: 20202,
          operations: {
            status: "operations_governed",
            serviceStatus: "service_ready"
          },
          serviceLane: {
            status: "lane_governed",
            laneMode: "auto_lane",
            tickDisposition: "auto_tick",
            maxConcurrentClaims: 1
          },
          servicePlan: {
            status: "schedule_governed",
            priority: "high",
            tickBudget: 1,
            preferredContractKinds: ["execution_contract", "resume_contract", "recovery_contract"]
          },
          workerRouting: {
            status: "routing_governed",
            schedulerLane: "priority",
            workerMode: "pinned_worker",
            assignedWorkerId: "worker-a"
          }
        }
      ]
    }
  });

  assert.equal(plan.selectedEntries.length, 2);
  assert.equal(plan.selectedEntries[0].fileName, "pinned.json");
  assert.equal(plan.selectedEntries[0].schedulerLane, "priority");
});

test("loadGithubWebhookServiceQueue reads pending queue entries", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-load-"));
  await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "execution_contract",
    contractStatus: "dispatch_ready_contract_only",
    deliveryId: "delivery-a"
  }, {
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  assert.equal(queueState.queue.length, 1);
  assert.equal(queueState.queue[0].contract.contractStatus, "dispatch_ready_contract_only");
});

test("claimGithubWebhookServiceQueueEntries moves pending contracts into claimed with lease metadata", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-claim-"));
  await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "execution_contract",
    contractStatus: "dispatch_ready_contract_only",
    deliveryId: "delivery-a"
  }, {
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const claimed = await claimGithubWebhookServiceQueueEntries(rootDir, queueState.queue, {
    workerId: "worker-a",
    claimedAt: "2026-04-15T12:00:00.000Z",
    leaseMinutes: 10
  });

  assert.equal(claimed.claimed.length, 1);
  assert.equal(claimed.claimed[0].contract.serviceLease.workerId, "worker-a");
  assert.match(claimed.claimed[0].contractPath, /claimed/);
  assert.equal(claimed.claimed[0].contract.serviceState.attemptCount, 1);
});

test("reclaimExpiredGithubWebhookServiceClaims returns expired claims to pending", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-reclaim-"));
  await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "execution_contract",
    contractStatus: "dispatch_ready_contract_only",
    deliveryId: "delivery-a"
  }, {
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  await claimGithubWebhookServiceQueueEntries(rootDir, queueState.queue, {
    workerId: "worker-a",
    claimedAt: "2026-04-15T12:00:00.000Z",
    leaseMinutes: 5
  });

  const reclaimed = await reclaimExpiredGithubWebhookServiceClaims(rootDir, {
    now: "2026-04-15T12:10:00.000Z"
  });
  const refreshed = await loadGithubWebhookServiceQueue(rootDir);

  assert.equal(reclaimed.length, 1);
  assert.equal(refreshed.queue.length, 1);
  assert.equal(refreshed.queue[0].contract.serviceLease, null);
});

test("claimGithubWebhookServiceQueueEntries dead-letters contracts after max service attempts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-dead-"));
  await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "execution_contract",
    contractStatus: "dispatch_ready_contract_only",
    deliveryId: "delivery-a",
    serviceState: {
      identity: "execution_contract::delivery-a::sample-project::-",
      attemptCount: 3,
      maxAttempts: 3,
      queuedAt: "2026-04-15T12:00:00.000Z",
      lastQueuedState: "pending",
      lastOutcome: null,
      deadLetterReason: null,
      lastWorkerId: null,
      lastClaimedAt: null
    }
  }, {
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const claimResult = await claimGithubWebhookServiceQueueEntries(rootDir, queueState.queue, {
    workerId: "worker-a",
    claimedAt: "2026-04-15T12:30:00.000Z",
    leaseMinutes: 10
  });

  assert.equal(claimResult.claimed.length, 0);
  assert.equal(claimResult.deadLettered.length, 1);
  assert.equal(claimResult.deadLettered[0].contract.serviceState.deadLetterReason, "max_service_attempts_exhausted");
});

test("buildGithubWebhookServiceReviewPlan defaults to problematic blocked states", () => {
  const plan = buildGithubWebhookServiceReviewPlan([
    {
      fileName: "blocked.json",
      contractPath: "/tmp/blocked.json",
      queueState: "blocked",
      contract: {
        contractKind: "recovery_contract",
        contractStatus: "recovery_backoff_pending",
        selectedProjectKey: "sample-project"
      }
    },
    {
      fileName: "pending.json",
      contractPath: "/tmp/pending.json",
      queueState: "pending",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        selectedProjectKey: "sample-project"
      }
    }
  ], {
    project: "sample-project"
  });

  assert.equal(plan.totalMatches, 1);
  assert.equal(plan.selectedCount, 1);
  assert.match(renderGithubWebhookServiceReviewSummary(plan), /review_from_status: problematic/);
});

test("requeueGithubWebhookServiceQueueEntries moves dead-letter contracts back to pending", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-requeue-dead-"));
  const queued = await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "recovery_contract",
    contractStatus: "recovery_manual_review",
    deliveryId: "delivery-z",
    serviceState: {
      identity: "recovery_contract::delivery-z::sample-project::-",
      attemptCount: 4,
      maxAttempts: 3,
      queuedAt: "2026-04-15T12:00:00.000Z",
      lastQueuedState: "dead_letter",
      lastOutcome: "max_service_attempts_exhausted",
      deadLetterReason: "max_service_attempts_exhausted",
      lastWorkerId: null,
      lastClaimedAt: null
    }
  }, {
    targetState: "dead_letter",
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const receipts = await requeueGithubWebhookServiceQueueEntries(rootDir, queueState.deadLetterQueue, {
    workerId: "worker-a",
    notes: "manual release",
    maxServiceAttempts: 5
  });
  const refreshed = await loadGithubWebhookServiceQueue(rootDir);

  assert.equal(receipts.length, 1);
  assert.equal(receipts[0].outcome, "requeued");
  assert.equal(refreshed.pendingQueue.length, 1);
  assert.equal(refreshed.pendingQueue[0].contract.serviceState.lastOutcome, "manually_requeued");
  assert.equal(refreshed.pendingQueue[0].contract.serviceState.deadLetterReason, null);
  assert.equal(refreshed.pendingQueue[0].contract.serviceAdminHistory.length, 1);
  assert.match(renderGithubWebhookServiceRequeueSummary(buildGithubWebhookServiceRequeuePlan(refreshed.queue, {
    fromStatus: "all"
  }), receipts), /requeued/);
  assert.match(queued.targetPath, /dead-letter/);
});

test("requeueGithubWebhookServiceQueueEntries requires force for claimed contracts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-requeue-claimed-"));
  await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "execution_contract",
    contractStatus: "dispatch_ready_contract_only",
    deliveryId: "delivery-a"
  }, {
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const initialQueue = await loadGithubWebhookServiceQueue(rootDir);
  await claimGithubWebhookServiceQueueEntries(rootDir, initialQueue.queue, {
    workerId: "worker-a",
    claimedAt: "2026-04-15T12:00:00.000Z",
    leaseMinutes: 10
  });

  const claimedQueue = await loadGithubWebhookServiceQueue(rootDir);
  const blocked = await requeueGithubWebhookServiceQueueEntries(rootDir, claimedQueue.claimedQueue, {
    workerId: "worker-b",
    notes: "no force"
  });
  const released = await requeueGithubWebhookServiceQueueEntries(rootDir, claimedQueue.claimedQueue, {
    workerId: "worker-b",
    notes: "forced release",
    force: true
  });
  const refreshed = await loadGithubWebhookServiceQueue(rootDir);

  assert.equal(blocked[0].outcome, "blocked_force_required");
  assert.equal(released[0].outcome, "requeued");
  assert.equal(refreshed.pendingQueue.length, 1);
});

test("buildGithubWebhookServiceRequeuePlan counts installation-admin blocked entries", () => {
  const plan = buildGithubWebhookServiceRequeuePlan([
    {
      fileName: "dead.json",
      contractPath: "/tmp/dead.json",
      queueState: "dead_letter",
      contract: {
        contractKind: "recovery_contract",
        contractStatus: "recovery_manual_review",
        installationId: 10101
      }
    }
  ], {
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            requeueDeadLetterAllowed: false
          }
        }
      ]
    }
  });

  assert.equal(plan.releaseableCount, 0);
  assert.equal(plan.installationBlockedCount, 1);
  assert.match(renderGithubWebhookServiceRequeueSummary(plan), /installation_blocked_count: 1/);
});

test("requeueGithubWebhookServiceQueueEntries respects installation admin policy", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-installation-admin-"));
  await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "recovery_contract",
    contractStatus: "recovery_manual_review",
    deliveryId: "delivery-installation",
    installationId: 10101
  }, {
    targetState: "dead_letter",
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const queueState = await loadGithubWebhookServiceQueue(rootDir);
  const receipts = await requeueGithubWebhookServiceQueueEntries(rootDir, queueState.deadLetterQueue, {
    workerId: "worker-a",
    notes: "manual release",
    installationState: {
      installations: [
        {
          installationId: 10101,
          operations: {
            status: "operations_governed",
            requeueDeadLetterAllowed: false
          }
        }
      ]
    }
  });

  assert.equal(receipts[0].outcome, "blocked_installation_policy");
});

test("runtime loop recovery contract is dispatch-ready when resume contract exists", () => {
  const loopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalCycles: 4,
      runtimeCount: 2,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 1,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_limit_reached"
    }
  ], {
    loopLimit: 3,
    stopReason: "loop_limit_reached"
  });
  const receipts = [{ selectedCount: 2 }];
  const resumeContract = buildGithubWebhookServiceRuntimeLoopResumeContract(loopState, {
    loopStatePath: "runs/integration/github-app-service-runtime-loop/demo/service-runtime-loop-state.json"
  });
  const recoveryAssessment = buildGithubWebhookServiceRuntimeLoopRecoveryAssessment(loopState, receipts, {
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/demo/service-runtime-loop-resume-contract.json",
    resumeContract
  });
  const recoveryContract = buildGithubWebhookServiceRuntimeLoopRecoveryContract({
    loopState,
    receipts,
    recoveryAssessment,
    resumeContract
  }, {
    runId: "demo-run",
    loopStatePath: "runs/integration/github-app-service-runtime-loop/demo/service-runtime-loop-state.json",
    receiptsPath: "runs/integration/github-app-service-runtime-loop/demo/service-runtime-loop-receipts.json",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/demo/service-runtime-loop-resume-contract.json",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/demo/service-runtime-loop-recovery-contract.json"
  });

  assert.equal(recoveryAssessment.effectiveStatus, "dispatch_ready_runtime_loop_recovery_contract");
  assert.equal(recoveryContract.contractStatus, "dispatch_ready_runtime_loop_recovery_contract");
  assert.equal(recoveryContract.resumeContractPath, "runs/integration/github-app-service-runtime-loop/demo/service-runtime-loop-resume-contract.json");
});

test("runtime loop recovery review surfaces dispatch-ready loop candidates from history", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-"));
  const loopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 1,
      totalCycles: 2,
      runtimeCount: 1,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 1,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_limit_reached"
    }
  ], {
    loopLimit: 2,
    stopReason: "loop_limit_reached"
  });
  await appendGithubWebhookServiceRuntimeLoopHistory(rootDir, buildGithubWebhookServiceRuntimeLoopHistoryEntry(
    loopState,
    [{ selectedCount: 3 }],
    {
      runId: "recovery-demo",
      commandName: "github-app-service-runtime-loop-run",
      recoveryStatus: "dispatch_ready_runtime_loop_recovery_contract",
      statePath: "runs/integration/github-app-service-runtime-loop/recovery-demo/service-runtime-loop-state.json",
      receiptsPath: "runs/integration/github-app-service-runtime-loop/recovery-demo/service-runtime-loop-receipts.json",
      resumeContractPath: "runs/integration/github-app-service-runtime-loop/recovery-demo/service-runtime-loop-resume-contract.json",
      recoveryContractPath: "runs/integration/github-app-service-runtime-loop/recovery-demo/service-runtime-loop-recovery-contract.json",
      summaryPath: "runs/integration/github-app-service-runtime-loop/recovery-demo/summary.md"
    }
  ));

  const historyState = await loadGithubWebhookServiceRuntimeLoopHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryReview(historyState, { limit: 5 });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryReviewSummary(review);

  assert.equal(review.dispatchReadyCount, 1);
  assert.equal(review.bestCandidate?.runId, "recovery-demo");
  assert.match(summary, /dispatch_ready_count: 1/);
  assert.match(summary, /service-runtime-loop-recovery-contract.json/);
});

test("runtime loop recovery receipts can append and review open recovery work", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-receipts-"));
  const loopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalCycles: 4,
      runtimeCount: 2,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 1,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_limit_reached"
    }
  ], {
    loopLimit: 3,
    stopReason: "loop_limit_reached"
  });
  const recoveryContract = buildGithubWebhookServiceRuntimeLoopRecoveryContract({
    loopState,
    receipts: [{ selectedCount: 2 }]
  }, {
    runId: "loop-recovery-run",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/loop-recovery-run/service-runtime-loop-resume-contract.json",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/loop-recovery-run/service-runtime-loop-recovery-contract.json"
  });
  const receipt = buildGithubWebhookServiceRuntimeLoopRecoveryReceipt(loopState, recoveryContract, {
    runId: "loop-recovery-run",
    sourceCommand: "github-app-service-runtime-loop-run",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/loop-recovery-run/service-runtime-loop-recovery-contract.json",
    summaryPath: "runs/integration/github-app-service-runtime-loop/loop-recovery-run/summary.md"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryReceipt(rootDir, receipt);

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryReceiptsReview(receiptState, { limit: 5 });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryReceiptsReviewSummary(review);

  assert.equal(receiptState.receipts.length, 1);
  assert.equal(review.openCount, 1);
  assert.equal(review.bestReceipt?.runId, "loop-recovery-run");
  assert.match(summary, /open_count: 1/);
  assert.match(summary, /service-runtime-loop-recovery-contract.json/);
});

test("runtime loop recovery receipts become backoff-pending after an attempt", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-attempt-"));
  const loopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 1,
      totalCycles: 2,
      runtimeCount: 1,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 1,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_limit_reached"
    }
  ], {
    loopLimit: 2,
    stopReason: "loop_limit_reached"
  });
  const recoveryContract = buildGithubWebhookServiceRuntimeLoopRecoveryContract({
    loopState,
    receipts: [{ selectedCount: 1 }]
  }, {
    runId: "loop-attempt-run",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/loop-attempt-run/service-runtime-loop-resume-contract.json",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/loop-attempt-run/service-runtime-loop-recovery-contract.json"
  });
  await appendGithubWebhookServiceRuntimeLoopRecoveryReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryReceipt(loopState, recoveryContract, {
    runId: "loop-attempt-run",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/loop-attempt-run/service-runtime-loop-recovery-contract.json"
  }));

  await markGithubWebhookServiceRuntimeLoopRecoveryReceiptAttempted(rootDir, {
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/loop-attempt-run/service-runtime-loop-recovery-contract.json",
    attemptedAt: "2026-04-16T12:00:00.000Z",
    backoffSeconds: 300,
    maxAttempts: 3
  });

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const evaluated = evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt(receiptState.receipts[0], {
    now: "2026-04-16T12:01:00.000Z"
  });
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryReceiptsReview(receiptState, {
    limit: 5,
    now: "2026-04-16T12:01:00.000Z"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryReceiptsReviewSummary(review);

  assert.equal(receiptState.receipts[0].attemptCount, 1);
  assert.equal(evaluated.effectiveReceiptState, "backoff_pending");
  assert.equal(review.backoffPendingCount, 1);
  assert.equal(review.openCount, 0);
  assert.match(summary, /backoff_pending_count: 1/);
});

test("runtime loop recovery receipt release plan selects problematic receipts and can release exhausted ones", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-release-"));
  const loopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 1,
      totalCycles: 2,
      runtimeCount: 1,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 1,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_limit_reached"
    }
  ], {
    loopLimit: 2,
    stopReason: "loop_limit_reached"
  });
  const recoveryContract = buildGithubWebhookServiceRuntimeLoopRecoveryContract({
    loopState,
    receipts: [{ selectedCount: 1 }]
  }, {
    runId: "loop-release-run",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/loop-release-run/service-runtime-loop-resume-contract.json",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/loop-release-run/service-runtime-loop-recovery-contract.json"
  });
  await appendGithubWebhookServiceRuntimeLoopRecoveryReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryReceipt(loopState, recoveryContract, {
    runId: "loop-release-run",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/loop-release-run/service-runtime-loop-recovery-contract.json",
    attemptCount: 3,
    maxAttempts: 3
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryReceiptReleasePlan(receiptState, {
    fromStatus: "problematic",
    limit: 5,
    now: "2026-04-16T12:10:00.000Z",
    resetAttempts: true
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryReceiptReleaseSummary(plan);
  const result = await releaseGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir, {
    receiptIds: plan.selectedReceipts.map((entry) => entry.receipt.receiptId),
    recoveryContractPaths: plan.selectedReceipts.map((entry) => entry.receipt.recoveryContractPath).filter(Boolean),
    resetAttempts: true,
    notes: "manual override after review"
  });
  const refreshed = await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const evaluated = evaluateGithubWebhookServiceRuntimeLoopRecoveryReceipt(refreshed.receipts[0], {
    now: "2026-04-16T12:10:00.000Z"
  });

  assert.equal(plan.selectedCount, 1);
  assert.match(summary, /selected_count: 1/);
  assert.equal(result.releaseCount, 1);
  assert.equal(refreshed.receipts[0].attemptCount, 0);
  assert.equal(refreshed.receipts[0].receiptState, "open");
  assert.equal(evaluated.effectiveReceiptState, "open_ready");
});

test("runtime loop recovery runtime plan assigns open receipts across workers and lanes", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-"));
  const workerALoopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalCycles: 4,
      runtimeCount: 2,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 1,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_limit_reached"
    }
  ], {
    loopLimit: 3,
    stopReason: "loop_limit_reached",
    schedulerLane: "priority:worker-a",
    workerIds: ["worker-a"]
  });
  const workerBLoopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalCycles: 4,
      runtimeCount: 2,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 1,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_limit_reached"
    }
  ], {
    loopLimit: 3,
    stopReason: "loop_limit_reached",
    schedulerLane: "priority:worker-b",
    workerIds: ["worker-b"]
  });
  const workerAContract = buildGithubWebhookServiceRuntimeLoopRecoveryContract({
    loopState: workerALoopState,
    receipts: [{ selectedCount: 3 }]
  }, {
    runId: "lane-a-run",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/lane-a-run/service-runtime-loop-resume-contract.json",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/lane-a-run/service-runtime-loop-recovery-contract.json"
  });
  const workerBContract = buildGithubWebhookServiceRuntimeLoopRecoveryContract({
    loopState: workerBLoopState,
    receipts: [{ selectedCount: 2 }]
  }, {
    runId: "lane-b-run",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/lane-b-run/service-runtime-loop-resume-contract.json",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/lane-b-run/service-runtime-loop-recovery-contract.json"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryReceipt(workerALoopState, workerAContract, {
    runId: "lane-a-run",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/lane-a-run/service-runtime-loop-recovery-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryReceipt(workerBLoopState, workerBContract, {
    runId: "lane-b-run",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/lane-b-run/service-runtime-loop-recovery-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimePlan(receiptState, {
    workerIds: ["worker-a", "worker-b"],
    limit: 5
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeSummary(plan);

  assert.equal(plan.selectedCount, 2);
  assert.equal(plan.blockedCount, 0);
  assert.equal(plan.runtimes.find((runtime) => runtime.workerId === "worker-a")?.receiptCount, 1);
  assert.equal(plan.runtimes.find((runtime) => runtime.workerId === "worker-b")?.receiptCount, 1);
  assert.match(summary, /worker=worker-a: receipts=1/);
  assert.match(summary, /worker=worker-b: receipts=1/);
});

test("runtime loop recovery runtime plan blocks open receipts on lanes with backoff conflicts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-backoff-"));
  const loopState = buildGithubWebhookServiceRuntimeLoopState([
    {
      loopIndex: 1,
      completedSessions: 1,
      totalCycles: 2,
      runtimeCount: 1,
      dispatchableRuntimeCount: 1,
      blockedLaneCount: 0,
      queueCount: 1,
      sessionStopReason: "session_limit_reached",
      stopReason: "loop_limit_reached"
    }
  ], {
    loopLimit: 2,
    stopReason: "loop_limit_reached"
  });
  const openContract = buildGithubWebhookServiceRuntimeLoopRecoveryContract({
    loopState,
    receipts: [{ selectedCount: 5 }]
  }, {
    runId: "lane-conflict-open",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/lane-conflict-open/service-runtime-loop-resume-contract.json",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/lane-conflict-open/service-runtime-loop-recovery-contract.json"
  });
  const blockedContract = buildGithubWebhookServiceRuntimeLoopRecoveryContract({
    loopState,
    receipts: [{ selectedCount: 1 }]
  }, {
    runId: "lane-conflict-blocked",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop/lane-conflict-blocked/service-runtime-loop-resume-contract.json",
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/lane-conflict-blocked/service-runtime-loop-recovery-contract.json"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryReceipt(loopState, openContract, {
    runId: "lane-conflict-open",
    schedulerLane: "recovery-priority",
    workerIds: ["worker-a"],
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/lane-conflict-open/service-runtime-loop-recovery-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryReceipt(loopState, blockedContract, {
    runId: "lane-conflict-blocked",
    schedulerLane: "recovery-priority",
    workerIds: ["worker-a"],
    recoveryContractPath: "runs/integration/github-app-service-runtime-loop/lane-conflict-blocked/service-runtime-loop-recovery-contract.json",
    attemptCount: 1,
    maxAttempts: 3,
    lastAttemptAt: "2026-04-16T12:00:00.000Z",
    blockedUntil: "2026-04-16T12:05:00.000Z"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimePlan(receiptState, {
    workerIds: ["worker-a"],
    limit: 5,
    now: "2026-04-16T12:01:00.000Z"
  });

  assert.equal(plan.selectedCount, 0);
  assert.ok(plan.blockedReceipts.some((entry) => entry.runtimeStatus === "lane_backoff_pending"));
  assert.ok(plan.blockedReceipts.some((entry) => entry.runtimeStatus === "backoff_pending"));
});

test("runtime loop recovery runtime cycle state exposes remaining budget and resume readiness", () => {
  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 2,
      selectedCount: 3,
      executedCount: 3,
      blockedCount: 1,
      laneCount: 2,
      stopReason: "dry_run_preview",
      summaryPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime/round-1/summary.md"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 3,
    stopReason: "dry_run_preview"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleSummary(cycleState, []);

  assert.equal(cycleState.completedRounds, 1);
  assert.equal(cycleState.remainingCycleBudget, 2);
  assert.equal(cycleState.resumeReady, true);
  assert.match(summary, /remaining_cycle_budget: 2/);
});

test("runtime loop recovery runtime cycle resume contract becomes dispatch-ready when budget remains", () => {
  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 2,
      executedCount: 0,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const contract = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleResumeContract(cycleState, {
    cycleStatePath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/demo/service-runtime-loop-recovery-runtime-cycle-state.json"
  });

  assert.equal(contract.contractStatus, "dispatch_ready_runtime_loop_recovery_runtime_cycle_resume_contract");
  assert.equal(contract.remainingCycleBudget, 1);
  assert.match(contract.nextAction, /Resume the runtime-loop recovery runtime cycle/);
});

test("runtime loop recovery runtime cycle history can append and review resumable cycles", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-history-"));
  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 2,
      selectedCount: 3,
      executedCount: 0,
      blockedCount: 1,
      laneCount: 2,
      stopReason: "dry_run_preview"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 3,
    stopReason: "dry_run_preview"
  });
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryEntry(
    cycleState,
    [{ selectedCount: 3, executedCount: 0 }],
    {
      runId: "cycle-demo",
      commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-run",
      statePath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-demo/service-runtime-loop-recovery-runtime-cycle-state.json",
      receiptsPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-demo/service-runtime-loop-recovery-runtime-cycle-receipts.json",
      resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-demo/service-runtime-loop-recovery-runtime-cycle-resume-contract.json",
      summaryPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-demo/summary.md"
    }
  ));

  const historyState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview(historyState, { limit: 5 });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleHistoryReviewSummary(review);

  assert.equal(review.resumableCount, 1);
  assert.equal(review.recentEntries[0]?.runId, "cycle-demo");
  assert.match(summary, /resumable_count: 1/);
  assert.match(summary, /service-runtime-loop-recovery-runtime-cycle-resume-contract.json/);
});

test("runtime loop recovery runtime cycle receipts can append, review and mark resumed cycles", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-receipts-"));
  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 2,
      executedCount: 0,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const receipt = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(cycleState, {
    runId: "cycle-receipt-demo",
    sourceCommand: "github-app-service-runtime-loop-recovery-runtime-cycle-run",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-receipt-demo/service-runtime-loop-recovery-runtime-cycle-resume-contract.json",
    summaryPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-receipt-demo/summary.md"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, receipt);

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview(receiptState, { limit: 5 });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReviewSummary(review);
  const evaluated = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(receiptState.receipts[0]);

  assert.equal(review.openCount, 1);
  assert.equal(review.bestReceipt?.runId, "cycle-receipt-demo");
  assert.equal(evaluated.effectiveReceiptState, "open_ready");
  assert.match(summary, /open_count: 1/);

  await markGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceiptResumed(rootDir, {
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-receipt-demo/service-runtime-loop-recovery-runtime-cycle-resume-contract.json",
    resumedAt: "2026-04-17T12:30:00.000Z",
    resumedByRunId: "resume-run-id"
  });

  const refreshed = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const refreshedEvaluated = evaluateGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(refreshed.receipts[0]);
  assert.equal(refreshedEvaluated.effectiveReceiptState, "resumed");
  assert.equal(refreshed.receipts[0].resumedByRunId, "resume-run-id");
});

test("runtime loop recovery runtime cycle runtime plan assigns resumable cycle receipts across worker families", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-"));
  const workerACycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 4,
      executedCount: 2,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const workerBCycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 3,
      executedCount: 1,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(workerACycleState, {
    runId: "cycle-family-a",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-family-a/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(workerBCycleState, {
    runId: "cycle-family-b",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-family-b/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan(receiptState, {
    workerIds: ["worker-a", "worker-b"],
    limit: 5
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeSummary(plan);

  assert.equal(plan.selectedCount, 2);
  assert.equal(plan.blockedCount, 0);
  assert.equal(plan.runtimes.find((runtime) => runtime.workerId === "worker-a")?.receiptCount, 1);
  assert.equal(plan.runtimes.find((runtime) => runtime.workerId === "worker-b")?.receiptCount, 1);
  assert.match(summary, /worker=worker-a: receipts=1/);
  assert.match(summary, /worker=worker-b: receipts=1/);
});

test("runtime loop recovery runtime cycle runtime plan blocks lower-priority receipts in the same worker family", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-conflict-"));
  const primaryCycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 5,
      executedCount: 0,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const secondaryCycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 1,
      executedCount: 0,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(primaryCycleState, {
    runId: "cycle-family-primary",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-family-primary/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(secondaryCycleState, {
    runId: "cycle-family-secondary",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-family-secondary/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan(receiptState, {
    workerIds: ["worker-a", "worker-b"],
    limit: 5
  });

  assert.equal(plan.selectedCount, 1);
  assert.ok(plan.blockedReceipts.some((entry) => entry.runtimeStatus === "family_conflict"));
});

test("runtime loop recovery runtime cycle runtime governance review suggests backpressure for conflicting families", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-governance-"));
  const primaryCycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 6,
      executedCount: 0,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const secondaryCycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 2,
      executedCount: 0,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(primaryCycleState, {
    runId: "cycle-family-conflict-primary",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-family-conflict-primary/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(secondaryCycleState, {
    runId: "cycle-family-conflict-secondary",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-family-conflict-secondary/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview(receiptState, {
    families: []
  }, {
    now: "2026-04-17T12:00:00.000Z"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceSummary(review);

  assert.equal(review.persistedSuggestionCount, 1);
  assert.equal(review.statusCounts.family_backpressure, 1);
  assert.equal(review.familyReviews[0].suggestedStatus, "family_backpressure");
  assert.match(summary, /backpressure_count: 1/);
});

test("apply runtime loop recovery runtime cycle runtime governance review persists family entries", () => {
  const review = {
    familyReviews: [
      {
        workerFamilyKey: "worker-a|worker-b",
        shouldPersist: true,
        suggestedEntry: {
          workerFamilyKey: "worker-a|worker-b",
          status: "family_manual_hold",
          holdReason: "manual gate",
          blockedUntil: null,
          maxSelectedCount: 5,
          preferredWorkerId: "worker-a",
          allowedWorkerIds: ["worker-a", "worker-b"],
          notes: null
        }
      }
    ]
  };

  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview({
    families: []
  }, review, {
    appliedAt: "2026-04-17T12:10:00.000Z",
    notes: "family governance after review"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.families.length, 1);
  assert.equal(applied.nextState.families[0].status, "family_manual_hold");
  assert.equal(applied.nextState.families[0].preferredWorkerId, "worker-a");
  assert.equal(applied.nextState.families[0].notes, "family governance after review");
});

test("runtime loop recovery runtime cycle runtime plan respects family governance holds and worker preferences", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-governed-"));
  const heldCycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 4,
      executedCount: 0,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const preferredCycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    {
      roundIndex: 1,
      workerCount: 1,
      selectedCount: 3,
      executedCount: 0,
      blockedCount: 0,
      laneCount: 1,
      stopReason: "manual_preview"
    }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(heldCycleState, {
    runId: "cycle-held-family",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-held-family/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(preferredCycleState, {
    runId: "cycle-preferred-family",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/cycle-preferred-family/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan(receiptState, {
    workerIds: ["worker-a", "worker-b"],
    governanceState: {
      families: [
        {
          workerFamilyKey: "worker-a|worker-b",
          status: "family_manual_hold",
          holdReason: "manual hold for the shared family"
        },
        {
          workerFamilyKey: "worker-a",
          status: "family_ready",
          preferredWorkerId: "worker-a",
          allowedWorkerIds: ["worker-a"]
        }
      ]
    }
  });

  assert.equal(plan.selectedCount, 1);
  assert.equal(plan.selectedReceipts[0].runtimeWorkerId, "worker-a");
  assert.ok(plan.blockedReceipts.some((entry) => entry.runtimeStatus === "family_hold_manual"));
});

test("runtime loop recovery runtime cycle runtime coordination review suggests holds for oversubscribed worker pools", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-coordination-"));
  const familyAState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 6, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const familyBState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 5, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const familyCState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 4, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyAState, {
    runId: "coord-family-a",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/coord-family-a/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyBState, {
    runId: "coord-family-b",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/coord-family-b/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyCState, {
    runId: "coord-family-c",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/coord-family-c/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview(receiptState, {
    families: []
  }, {
    families: []
  }, {
    workerIds: ["worker-a", "worker-b"]
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationSummary(review);

  assert.equal(review.familyCount, 3);
  assert.equal(review.persistedSuggestionCount, 1);
  assert.equal(review.statusCounts.coordination_hold, 1);
  assert.match(summary, /hold_count: 1/);
});

test("apply runtime loop recovery runtime cycle runtime coordination review persists only held families", () => {
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview({
    families: []
  }, {
    familyReviews: [
      {
        suggestedEntry: {
          workerFamilyKey: "worker-a|worker-b",
          coordinationGroupKey: "pool:worker-a|worker-b",
          status: "coordination_hold",
          blockedByFamilyKey: "worker-a",
          effectiveWorkerIds: ["worker-a", "worker-b"],
          preferredWorkerId: null
        }
      },
      {
        suggestedEntry: {
          workerFamilyKey: "worker-c",
          coordinationGroupKey: "pool:worker-c",
          status: "coordination_ready",
          blockedByFamilyKey: null,
          effectiveWorkerIds: ["worker-c"],
          preferredWorkerId: null
        }
      }
    ]
  }, {
    appliedAt: "2026-04-17T12:40:00.000Z",
    notes: "coordination after review"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.families.length, 1);
  assert.equal(applied.nextState.families[0].status, "coordination_hold");
  assert.equal(applied.nextState.families[0].blockedByFamilyKey, "worker-a");
});

test("runtime loop recovery runtime cycle runtime coordination followup review suggests auto release and escalation", () => {
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview({
    receipts: []
  }, {
    families: []
  }, {
    families: [
      {
        workerFamilyKey: "worker-a",
        coordinationGroupKey: "overlap:worker-a|worker-b",
        status: "coordination_hold",
        blockedByFamilyKey: "worker-b",
        updatedAt: "2026-04-17T12:00:00.000Z"
      },
      {
        workerFamilyKey: "worker-b",
        coordinationGroupKey: "overlap:worker-a|worker-b",
        status: "coordination_hold",
        blockedByFamilyKey: "worker-a",
        updatedAt: "2026-04-17T10:00:00.000Z"
      }
    ]
  }, {
    generatedAt: "2026-04-17T13:30:00.000Z",
    coordinationEscalationSeconds: 3600
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupSummary(review);

  assert.equal(review.applyCount, 2);
  assert.equal(review.statusCounts.auto_release, 2);
  assert.match(summary, /auto_release_count: 2/);
});

test("runtime loop recovery runtime cycle runtime coordination followup escalates stale active conflicts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-coordination-followup-"));
  const familyAState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 6, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const familyBState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 5, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const familyCState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 4, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyAState, {
    runId: "followup-family-a",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/followup-family-a/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyBState, {
    runId: "followup-family-b",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/followup-family-b/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyCState, {
    runId: "followup-family-c",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/followup-family-c/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview(
    receiptState,
    { families: [] },
    {
      families: [
        {
          workerFamilyKey: "worker-b",
          coordinationGroupKey: "overlap:worker-a|worker-b",
          status: "coordination_hold",
          blockedByFamilyKey: "worker-a",
          updatedAt: "2026-04-17T10:00:00.000Z"
        }
      ]
    },
    {
      generatedAt: "2026-04-17T13:30:00.000Z",
      workerIds: ["worker-a", "worker-b"],
      coordinationEscalationSeconds: 3600
    }
  );

  assert.equal(review.applyCount, 1);
  assert.equal(review.followups[0].followupAction, "escalate");
  assert.equal(review.followups[0].nextStatus, "coordination_escalated");
});

test("apply runtime loop recovery runtime cycle runtime coordination followup review releases and escalates families", () => {
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview({
    families: [
      {
        workerFamilyKey: "worker-a",
        coordinationGroupKey: "overlap:worker-a|worker-b",
        status: "coordination_hold"
      },
      {
        workerFamilyKey: "worker-b",
        coordinationGroupKey: "overlap:worker-a|worker-b",
        status: "coordination_hold"
      }
    ]
  }, {
    followups: [
      {
        workerFamilyKey: "worker-a",
        currentStatus: "coordination_hold",
        followupAction: "auto_release",
        shouldApply: true
      },
      {
        workerFamilyKey: "worker-b",
        currentStatus: "coordination_hold",
        followupAction: "escalate",
        shouldApply: true,
        ageSeconds: 5400
      }
    ]
  }, {
    appliedAt: "2026-04-17T13:35:00.000Z",
    notes: "coordination follow-up"
  });

  assert.equal(applied.receipts.length, 2);
  assert.equal(applied.nextState.families.length, 1);
  assert.equal(applied.nextState.families[0].workerFamilyKey, "worker-b");
  assert.equal(applied.nextState.families[0].status, "coordination_escalated");
});

test("runtime loop recovery runtime cycle runtime coordination backpressure review suggests lower-priority group backpressure", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-coordination-backpressure-"));
  const groupA1 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 9, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const groupA2 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 8, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const groupA3 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 7, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a", "worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const groupB1 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 6, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-c"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const groupB2 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 5, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-d"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const groupB3 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 4, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-c", "worker-d"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const groupC1 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 3, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-e"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const groupC2 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 2, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-f"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const groupC3 = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 1, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-e", "worker-f"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  const receipts = [
    ["backpressure-group-a1", groupA1],
    ["backpressure-group-a2", groupA2],
    ["backpressure-group-a3", groupA3],
    ["backpressure-group-b1", groupB1],
    ["backpressure-group-b2", groupB2],
    ["backpressure-group-b3", groupB3],
    ["backpressure-group-c1", groupC1],
    ["backpressure-group-c2", groupC2],
    ["backpressure-group-c3", groupC3]
  ];
  for (const [runId, state] of receipts) {
    await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(state, {
      runId,
      resumeContractPath: `runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/${runId}/service-runtime-loop-recovery-runtime-cycle-resume-contract.json`
    }));
  }

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview(
    receiptState,
    { families: [] },
    { families: [] },
    { groups: [] },
    {
      workerIds: ["worker-a", "worker-b", "worker-c", "worker-d", "worker-e", "worker-f"],
      coordinationGroupBudget: 2,
      coordinationBackpressureSeconds: 1800,
      generatedAt: "2026-04-17T14:00:00.000Z"
    }
  );
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSummary(review);

  assert.equal(review.groupCount, 3);
  assert.equal(review.persistedSuggestionCount, 1);
  assert.equal(review.statusCounts.group_backpressure, 1);
  assert.equal(review.groupReviews.find((item) => item.coordinationGroupKey === "overlap:worker-e|worker-f")?.suggestedStatus, "group_backpressure");
  assert.match(summary, /backpressure_count: 1/);
});

test("apply runtime loop recovery runtime cycle runtime coordination backpressure review persists only blocked groups", () => {
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview({
    groups: []
  }, {
    groupReviews: [
      {
        suggestedEntry: {
          coordinationGroupKey: "overlap:worker-a|worker-b",
          status: "group_backpressure",
          blockedUntil: "2026-04-17T15:00:00.000Z",
          primaryWorkerFamilyKey: "worker-a",
          workerFamilyKeys: ["worker-a", "worker-b", "worker-a|worker-b"],
          effectiveWorkerIds: ["worker-a", "worker-b"]
        }
      },
      {
        suggestedEntry: {
          coordinationGroupKey: "overlap:worker-c|worker-d",
          status: "group_ready",
          blockedUntil: null,
          primaryWorkerFamilyKey: "worker-c",
          workerFamilyKeys: ["worker-c", "worker-d", "worker-c|worker-d"],
          effectiveWorkerIds: ["worker-c", "worker-d"]
        }
      }
    ]
  }, {
    appliedAt: "2026-04-17T14:05:00.000Z",
    notes: "group backpressure after review"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.groups.length, 1);
  assert.equal(applied.nextState.groups[0].coordinationGroupKey, "overlap:worker-a|worker-b");
  assert.equal(applied.nextState.groups[0].status, "group_backpressure");
});

test("runtime loop recovery runtime cycle runtime coordination backpressure followup review suggests release, refresh and escalation", () => {
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview({
    receipts: []
  }, {
    families: []
  }, {
    families: []
  }, {
    groups: [
      {
        coordinationGroupKey: "overlap:worker-a|worker-b",
        status: "group_backpressure",
        blockedUntil: "2026-04-17T12:15:00.000Z",
        updatedAt: "2026-04-17T12:00:00.000Z"
      },
      {
        coordinationGroupKey: "overlap:worker-c|worker-d",
        status: "group_backpressure",
        blockedUntil: "2026-04-17T12:15:00.000Z",
        updatedAt: "2026-04-17T13:00:00.000Z"
      },
      {
        coordinationGroupKey: "overlap:worker-e|worker-f",
        status: "group_backpressure",
        blockedUntil: "2026-04-17T12:15:00.000Z",
        updatedAt: "2026-04-17T14:00:00.000Z"
      }
    ]
  }, {
    baseReview: {
      groupReviews: [
        {
          coordinationGroupKey: "overlap:worker-c|worker-d",
          suggestedStatus: "group_backpressure"
        },
        {
          coordinationGroupKey: "overlap:worker-e|worker-f",
          suggestedStatus: "group_backpressure"
        }
      ]
    },
    generatedAt: "2026-04-17T14:30:00.000Z",
    coordinationBackpressureSeconds: 1800,
    coordinationGroupEscalationSeconds: 3600
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupSummary(review);

  assert.equal(review.applyCount, 3);
  assert.equal(review.statusCounts.auto_release, 1);
  assert.equal(review.statusCounts.refresh_backpressure, 1);
  assert.equal(review.statusCounts.escalate, 1);
  assert.match(summary, /refresh_backpressure_count: 1/);
  assert.match(summary, /escalate_count: 1/);
});

test("apply runtime loop recovery runtime cycle runtime coordination backpressure followup review releases, refreshes and escalates groups", () => {
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview({
    groups: [
      {
        coordinationGroupKey: "overlap:worker-a|worker-b",
        status: "group_backpressure"
      },
      {
        coordinationGroupKey: "overlap:worker-c|worker-d",
        status: "group_backpressure",
        blockedUntil: "2026-04-17T12:15:00.000Z",
        workerFamilyKeys: ["worker-c", "worker-d"]
      },
      {
        coordinationGroupKey: "overlap:worker-e|worker-f",
        status: "group_backpressure",
        blockedUntil: "2026-04-17T15:00:00.000Z",
        workerFamilyKeys: ["worker-e", "worker-f"]
      }
    ]
  }, {
    followups: [
      {
        coordinationGroupKey: "overlap:worker-a|worker-b",
        currentStatus: "group_backpressure",
        followupAction: "auto_release",
        shouldApply: true
      },
      {
        coordinationGroupKey: "overlap:worker-c|worker-d",
        currentStatus: "group_backpressure",
        followupAction: "refresh_backpressure",
        shouldApply: true,
        nextStatus: "group_backpressure",
        nextBlockedUntil: "2026-04-17T15:00:00.000Z"
      },
      {
        coordinationGroupKey: "overlap:worker-e|worker-f",
        currentStatus: "group_backpressure",
        followupAction: "escalate",
        shouldApply: true,
        nextStatus: "group_escalated",
        nextBlockedUntil: "2026-04-17T15:00:00.000Z",
        ageSeconds: 7200
      }
    ]
  }, {
    appliedAt: "2026-04-17T14:35:00.000Z",
    notes: "group backpressure follow-up"
  });

  assert.equal(applied.receipts.length, 3);
  assert.equal(applied.nextState.groups.length, 2);
  assert.equal(applied.nextState.groups.find((item) => item.coordinationGroupKey === "overlap:worker-c|worker-d")?.blockedUntil, "2026-04-17T15:00:00.000Z");
  assert.equal(applied.nextState.groups.find((item) => item.coordinationGroupKey === "overlap:worker-e|worker-f")?.status, "group_escalated");
});

test("runtime loop recovery runtime cycle runtime coordination backpressure history review summarizes apply and followup runs", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-coordination-backpressure-history-"));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(
    rootDir,
    buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryEntry(
      {
        generatedAt: "2026-04-17T15:00:00.000Z",
        groupCount: 3,
        coordinationGroupBudget: 2,
        backpressureSeconds: 1800
      },
      [
        { followupAction: "auto_release" },
        { followupAction: "refresh_backpressure" }
      ],
      {
        runId: "coord-backpressure-history-1",
        commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-followup-apply",
        summaryPath: "runs/integration/backpressure/one/summary.md"
      }
    )
  );
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(
    rootDir,
    buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryEntry(
      {
        generatedAt: "2026-04-17T16:00:00.000Z",
        groupCount: 2,
        coordinationGroupBudget: 2,
        backpressureSeconds: 1800,
        escalationSeconds: 3600
      },
      [
        { followupAction: "escalate" }
      ],
      {
        runId: "coord-backpressure-history-2",
        commandName: "github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-auto-followup",
        summaryPath: "runs/integration/backpressure/two/summary.md"
      }
    )
  );

  const historyState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview(historyState, {
    generatedAt: "2026-04-17T16:30:00.000Z",
    limit: 5
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReviewSummary(review);

  assert.equal(review.historyCount, 2);
  assert.equal(review.applyCount, 3);
  assert.equal(review.autoReleaseCount, 1);
  assert.equal(review.refreshCount, 1);
  assert.equal(review.escalatedCount, 1);
  assert.match(summary, /escalated_count: 1/);
  assert.match(summary, /coord-backpressure-history-2/);
});

test("runtime loop recovery runtime cycle runtime coordination backpressure cycle state exposes resume contract", () => {
  const cycleState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleState([
    {
      passIndex: 1,
      groupCount: 3,
      selectedCount: 2,
      appliedCount: 0,
      autoReleaseCount: 1,
      refreshCount: 1,
      escalatedCount: 0,
      stopReason: "manual_preview",
      summaryPath: "runs/integration/backpressure-cycle/one/summary.md"
    }
  ], {
    generatedAt: "2026-04-17T17:00:00.000Z",
    cycleLimit: 3,
    stopReason: "manual_preview"
  });
  const resumeContract = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResumeContract(cycleState, {
    generatedAt: "2026-04-17T17:01:00.000Z",
    cycleStatePath: "runs/integration/backpressure-cycle/service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-state.json"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleSummary(cycleState, []);

  assert.equal(cycleState.resumeReady, true);
  assert.equal(cycleState.remainingCycleBudget, 2);
  assert.equal(cycleState.totalSelectedCount, 2);
  assert.equal(resumeContract.contractStatus, "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_cycle_resume_contract");
  assert.match(summary, /completed_passes: 1/);
  assert.match(summary, /total_auto_release_count: 1/);
});

test("runtime loop recovery runtime cycle runtime coordination backpressure session state exposes resume contract", () => {
  const sessionState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionState([
    {
      sessionIndex: 1,
      completedPasses: 2,
      totalGroupCount: 4,
      totalSelectedCount: 3,
      totalAppliedCount: 2,
      totalAutoReleaseCount: 1,
      totalRefreshCount: 1,
      totalEscalatedCount: 0,
      cycleStopReason: "cycle_limit_reached",
      stopReason: "session_limit_reached",
      summaryPath: "runs/integration/backpressure-session/one/summary.md"
    }
  ], {
    generatedAt: "2026-04-17T18:00:00.000Z",
    runtimeCycleLimit: 3,
    sessionLimit: 3,
    stopReason: "session_limit_reached"
  });
  const resumeContract = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResumeContract(sessionState, {
    generatedAt: "2026-04-17T18:01:00.000Z",
    sessionStatePath: "runs/integration/backpressure-session/service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-state.json"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionSummary(sessionState, []);

  assert.equal(sessionState.resumeReady, true);
  assert.equal(sessionState.remainingSessionBudget, 2);
  assert.equal(sessionState.totalPasses, 2);
  assert.equal(resumeContract.contractStatus, "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_session_resume_contract");
  assert.match(summary, /completed_sessions: 1/);
  assert.match(summary, /total_passes: 2/);
});

test("runtime loop recovery runtime cycle runtime coordination backpressure loop state exposes resume contract", () => {
  const loopState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalPasses: 3,
      totalAppliedCount: 1,
      totalAutoReleaseCount: 1,
      totalRefreshCount: 0,
      totalEscalatedCount: 0,
      sessionStopReason: "dry_run_preview",
      stopReason: "loop_limit_reached",
      summaryPath: "runs/integration/backpressure-loop/one/summary.md"
    }
  ], {
    generatedAt: "2026-04-17T20:00:00.000Z",
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 2,
    loopLimit: 3,
    stopReason: "loop_limit_reached"
  });
  const resumeContract = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResumeContract(loopState, {
    generatedAt: "2026-04-17T20:01:00.000Z",
    loopStatePath: "runs/integration/backpressure-loop/service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-state.json"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopSummary(loopState, []);

  assert.equal(loopState.resumeReady, true);
  assert.equal(loopState.remainingLoopBudget, 2);
  assert.equal(loopState.totalSessions, 2);
  assert.equal(loopState.totalPasses, 3);
  assert.equal(resumeContract.contractStatus, "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_resume_contract");
  assert.match(summary, /completed_loops: 1/);
  assert.match(summary, /total_sessions: 2/);
});

test("runtime loop recovery runtime cycle runtime coordination backpressure loop history review summarizes recent loop entries", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-backpressure-loop-history-"));
  const firstLoopState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState([
    {
      loopIndex: 1,
      completedSessions: 1,
      totalPasses: 2,
      totalAppliedCount: 1,
      totalAutoReleaseCount: 1,
      totalRefreshCount: 0,
      totalEscalatedCount: 0,
      sessionStopReason: "no_due_group_backpressure_followup",
      stopReason: "no_due_group_backpressure_followup",
      summaryPath: "runs/integration/backpressure-loop/one/summary.md"
    }
  ], {
    generatedAt: "2026-04-17T20:00:00.000Z",
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 2,
    loopLimit: 3,
    stopReason: "no_due_group_backpressure_followup"
  });
  const secondLoopState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalPasses: 3,
      totalAppliedCount: 2,
      totalAutoReleaseCount: 1,
      totalRefreshCount: 1,
      totalEscalatedCount: 0,
      sessionStopReason: "loop_limit_reached",
      stopReason: "loop_limit_reached",
      summaryPath: "runs/integration/backpressure-loop/two/summary.md"
    }
  ], {
    generatedAt: "2026-04-17T20:10:00.000Z",
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 2,
    loopLimit: 3,
    stopReason: "loop_limit_reached"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(
    rootDir,
    buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryEntry(firstLoopState, [
      { totalAppliedCount: 1 }
    ], {
      runId: "backpressure-loop-one",
      recoveryStatus: "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_not_required",
      summaryPath: "runs/integration/backpressure-loop/one/summary.md"
    })
  );
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(
    rootDir,
    buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryEntry(secondLoopState, [
      { totalAppliedCount: 2 }
    ], {
      runId: "backpressure-loop-two",
      recoveryStatus: "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract",
      recoveryContractPath: "runs/integration/backpressure-loop/two/recovery-contract.json",
      summaryPath: "runs/integration/backpressure-loop/two/summary.md"
    })
  );

  const historyState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview(historyState, {
    generatedAt: "2026-04-17T20:20:00.000Z",
    limit: 5
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReviewSummary(review);

  assert.equal(review.historyCount, 2);
  assert.equal(review.reviewCount, 2);
  assert.equal(review.resumableCount, 1);
  assert.equal(review.drainedCount, 1);
  assert.equal(review.recoveryReadyCount, 1);
  assert.match(summary, /backpressure-loop-two/);
  assert.match(summary, /recovery_ready_count: 1/);
});

test("runtime loop recovery runtime cycle runtime coordination backpressure loop recovery assessment emits dispatch-ready contracts", () => {
  const loopState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalPasses: 3,
      totalAppliedCount: 2,
      totalAutoReleaseCount: 1,
      totalRefreshCount: 1,
      totalEscalatedCount: 0,
      sessionStopReason: "loop_limit_reached",
      stopReason: "loop_limit_reached",
      summaryPath: "runs/integration/backpressure-loop/two/summary.md"
    }
  ], {
    generatedAt: "2026-04-17T20:30:00.000Z",
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 2,
    loopLimit: 3,
    stopReason: "loop_limit_reached"
  });
  const resumeContract = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResumeContract(loopState, {
    generatedAt: "2026-04-17T20:31:00.000Z",
    loopStatePath: "runs/integration/backpressure-loop/two/state.json"
  });
  const assessment = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryAssessment(loopState, [
    { totalAppliedCount: 2 }
  ], {
    generatedAt: "2026-04-17T20:32:00.000Z",
    resumeContractPath: "runs/integration/backpressure-loop/two/resume-contract.json",
    resumeContract
  });
  const contract = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryContract({
    loopState,
    receipts: [{ totalAppliedCount: 2 }],
    recoveryAssessment: assessment,
    resumeContract
  }, {
    generatedAt: "2026-04-17T20:33:00.000Z",
    runId: "backpressure-loop-two",
    loopStatePath: "runs/integration/backpressure-loop/two/state.json",
    receiptsPath: "runs/integration/backpressure-loop/two/receipts.json",
    resumeContractPath: "runs/integration/backpressure-loop/two/resume-contract.json",
    recoveryContractPath: "runs/integration/backpressure-loop/two/recovery-contract.json",
    summaryPath: "runs/integration/backpressure-loop/two/summary.md"
  });

  assert.equal(assessment.effectiveStatus, "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract");
  assert.equal(assessment.action, "recover_via_resume");
  assert.equal(contract.contractStatus, "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract");
  assert.equal(contract.resumeReady, true);
  assert.equal(contract.remainingLoopBudget, 2);
});

test("runtime loop recovery runtime cycle runtime coordination backpressure loop recovery review picks the best recovery candidate", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-backpressure-loop-recovery-review-"));
  const previewLoopState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState([
    {
      loopIndex: 1,
      completedSessions: 1,
      totalPasses: 1,
      totalAppliedCount: 0,
      totalAutoReleaseCount: 0,
      totalRefreshCount: 0,
      totalEscalatedCount: 0,
      sessionStopReason: "dry_run_preview",
      stopReason: "dry_run_preview",
      summaryPath: "runs/integration/backpressure-loop/preview/summary.md"
    }
  ], {
    generatedAt: "2026-04-17T20:40:00.000Z",
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 2,
    loopLimit: 3,
    stopReason: "dry_run_preview"
  });
  const resumableLoopState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopState([
    {
      loopIndex: 1,
      completedSessions: 2,
      totalPasses: 3,
      totalAppliedCount: 2,
      totalAutoReleaseCount: 1,
      totalRefreshCount: 1,
      totalEscalatedCount: 0,
      sessionStopReason: "loop_limit_reached",
      stopReason: "loop_limit_reached",
      summaryPath: "runs/integration/backpressure-loop/resumable/summary.md"
    }
  ], {
    generatedAt: "2026-04-17T20:41:00.000Z",
    runtimeCycleLimit: 3,
    runtimeSessionLimit: 2,
    loopLimit: 3,
    stopReason: "loop_limit_reached"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(
    rootDir,
    buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryEntry(previewLoopState, [], {
      runId: "backpressure-loop-preview",
      recoveryStatus: "runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_preview_only",
      summaryPath: "runs/integration/backpressure-loop/preview/summary.md"
    })
  );
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(
    rootDir,
    buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryEntry(resumableLoopState, [
      { totalAppliedCount: 2 }
    ], {
      runId: "backpressure-loop-resumable",
      recoveryStatus: "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract",
      recoveryContractPath: "runs/integration/backpressure-loop/resumable/recovery-contract.json",
      summaryPath: "runs/integration/backpressure-loop/resumable/summary.md"
    })
  );

  const historyState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistory(rootDir);
  const review = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview(historyState, {
    generatedAt: "2026-04-17T20:42:00.000Z",
    limit: 5
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReviewSummary(review);

  assert.equal(review.dispatchReadyCount, 1);
  assert.equal(review.previewOnlyCount, 1);
  assert.equal(review.bestCandidate?.runId, "backpressure-loop-resumable");
  assert.match(summary, /dispatch_ready_count: 1/);
  assert.match(summary, /backpressure-loop-resumable/);
});

test("runtime loop recovery runtime cycle runtime plan respects coordination holds between families", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-coordination-plan-"));
  const familyAState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 6, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const familyBState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 5, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyAState, {
    runId: "coord-plan-family-a",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/coord-plan-family-a/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyBState, {
    runId: "coord-plan-family-b",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/coord-plan-family-b/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan(receiptState, {
    workerIds: ["worker-a", "worker-b"],
    coordinationState: {
      families: [
        {
          workerFamilyKey: "worker-a",
          coordinationGroupKey: "overlap:worker-a|worker-b",
          status: "coordination_hold",
          blockedByFamilyKey: "worker-a|worker-b"
        }
      ]
    }
  });

  assert.equal(plan.selectedCount, 1);
  assert.ok(plan.blockedReceipts.some((entry) => entry.runtimeStatus === "coordination_hold"));
});

test("runtime loop recovery runtime cycle runtime plan respects coordination group backpressure", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-coordination-backpressure-plan-"));
  const familyAState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 6, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });
  const familyBState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 5, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-b"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyAState, {
    runId: "coord-backpressure-plan-family-a",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/coord-backpressure-plan-family-a/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));
  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyBState, {
    runId: "coord-backpressure-plan-family-b",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/coord-backpressure-plan-family-b/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan(receiptState, {
    workerIds: ["worker-a", "worker-b"],
    coordinationBackpressureState: {
      groups: [
        {
          coordinationGroupKey: "overlap:worker-a|worker-b",
          status: "group_backpressure",
          blockedUntil: "2099-01-01T00:00:00.000Z",
          workerFamilyKeys: ["worker-a"]
        }
      ]
    }
  });

  assert.equal(plan.selectedCount, 1);
  assert.equal(plan.coordinationBackpressureCount, 1);
  assert.ok(plan.blockedReceipts.some((entry) => entry.runtimeStatus === "coordination_backpressure"));
});

test("runtime loop recovery runtime cycle runtime plan respects escalated coordination group backpressure", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-loop-recovery-runtime-cycle-runtime-coordination-backpressure-escalated-plan-"));
  const familyAState = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleState([
    { roundIndex: 1, workerCount: 1, selectedCount: 6, executedCount: 0, blockedCount: 0, laneCount: 1, stopReason: "manual_preview" }
  ], {
    workerIds: ["worker-a"],
    cycleLimit: 2,
    stopReason: "manual_preview"
  });

  await appendGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(rootDir, buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipt(familyAState, {
    runId: "coord-backpressure-escalated-plan-family-a",
    resumeContractPath: "runs/integration/github-app-service-runtime-loop-recovery-runtime-cycle/coord-backpressure-escalated-plan-family-a/service-runtime-loop-recovery-runtime-cycle-resume-contract.json"
  }));

  const receiptState = await loadGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleReceipts(rootDir);
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimePlan(receiptState, {
    workerIds: ["worker-a"],
    coordinationBackpressureState: {
      groups: [
        {
          coordinationGroupKey: "overlap:worker-a",
          status: "group_escalated",
          blockedUntil: "2099-01-01T00:00:00.000Z",
          workerFamilyKeys: ["worker-a"]
        }
      ]
    }
  });

  assert.equal(plan.selectedCount, 0);
  assert.equal(plan.coordinationGroupEscalatedCount, 1);
  assert.ok(plan.blockedReceipts.some((entry) => entry.runtimeStatus === "coordination_group_escalated"));
});

test("runtime loop recovery runtime cycle runtime governance release plan requires clear-budget for budget exhausted families", () => {
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan({
    families: [
      {
        workerFamilyKey: "worker-a",
        status: "family_budget_exhausted",
        maxSelectedCount: 3
      }
    ]
  }, {
    fromStatus: "problematic"
  });
  const summary = renderGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseSummary(plan);

  assert.equal(plan.selectedCount, 0);
  assert.equal(plan.blockedCount, 1);
  assert.equal(plan.blockedFamilies[0].releaseAction, "needs_clear_budget");
  assert.match(summary, /blocked_count: 1/);
});

test("runtime loop recovery runtime cycle runtime governance release plan selects held families and can clear budgets", () => {
  const plan = buildGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan({
    families: [
      {
        workerFamilyKey: "worker-a|worker-b",
        status: "family_manual_hold",
        holdReason: "manual gate"
      },
      {
        workerFamilyKey: "worker-c",
        status: "family_budget_exhausted",
        maxSelectedCount: 2
      }
    ]
  }, {
    fromStatus: "problematic",
    clearBudget: true
  });

  assert.equal(plan.selectedCount, 2);
  assert.equal(plan.blockedCount, 0);
  assert.equal(plan.selectedFamilies.find((item) => item.workerFamilyKey === "worker-c")?.clearBudget, true);
});

test("apply runtime loop recovery runtime cycle runtime governance release removes fully released families", () => {
  const applied = applyGithubWebhookServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleasePlan({
    families: [
      {
        workerFamilyKey: "worker-a|worker-b",
        status: "family_manual_hold",
        holdReason: "manual gate"
      },
      {
        workerFamilyKey: "worker-c",
        status: "family_budget_exhausted",
        maxSelectedCount: 2,
        preferredWorkerId: "worker-c"
      }
    ]
  }, {
    selectedFamilies: [
      {
        workerFamilyKey: "worker-a|worker-b",
        currentEntry: {
          workerFamilyKey: "worker-a|worker-b",
          status: "family_manual_hold",
          holdReason: "manual gate"
        },
        clearBudget: false
      },
      {
        workerFamilyKey: "worker-c",
        currentEntry: {
          workerFamilyKey: "worker-c",
          status: "family_budget_exhausted",
          maxSelectedCount: 2,
          preferredWorkerId: "worker-c"
        },
        clearBudget: true
      }
    ]
  }, {
    releasedAt: "2026-04-17T12:20:00.000Z",
    notes: "family release after review"
  });

  assert.equal(applied.receipts.length, 2);
  assert.equal(applied.nextState.families.length, 1);
  assert.equal(applied.nextState.families[0].workerFamilyKey, "worker-c");
  assert.equal(applied.nextState.families[0].status, "family_ready");
  assert.equal(applied.nextState.families[0].maxSelectedCount, null);
  assert.equal(applied.nextState.families[0].preferredWorkerId, "worker-c");
});

test("writeGithubWebhookServiceArtifacts writes service files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-gh-service-artifacts-"));
  const plan = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    queueCount: 1,
    actionableCount: 1,
    blockedCount: 0,
    selectedEntries: []
  };
  const summary = renderGithubWebhookServiceTickSummary(plan, []);
  const artifacts = await writeGithubWebhookServiceArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    plan,
    receipts: [],
    summary,
    dryRun: false
  });

  const writtenPlan = JSON.parse(await fs.readFile(artifacts.planPath, "utf8"));
  const writtenReceipts = JSON.parse(await fs.readFile(artifacts.receiptsPath, "utf8"));
  const writtenSummary = await fs.readFile(artifacts.summaryPath, "utf8");

  assert.equal(writtenPlan.queueCount, 1);
  assert.deepEqual(writtenReceipts, []);
  assert.match(writtenSummary, /Patternpilot GitHub App Service Tick/);
});

test("runtime ops review prioritizes dead-letter and open recovery work", () => {
  const review = buildGithubWebhookServiceRuntimeOpsReview({
    queueState: {
      queue: [{}, {}, {}],
      pendingQueue: [{}],
      claimedQueue: [{}],
      blockedQueue: [],
      deadLetterQueue: [{}]
    },
    runtimeClaimsState: {
      claims: [
        { laneKey: "priority:worker-a", workerId: "worker-a" }
      ]
    },
    runtimeLoopHistoryState: {
      entries: []
    },
    runtimeLoopRecoveryReceiptsState: {
      receipts: [
        {
          receiptId: "runtime-open",
          receiptState: "open",
          recoveryStatus: "dispatch_ready_runtime_loop_recovery_contract",
          maxAttempts: 3,
          attemptCount: 0
        }
      ]
    },
    runtimeLoopRecoveryRuntimeCycleHistoryState: {
      entries: []
    },
    runtimeLoopRecoveryRuntimeCycleReceiptsState: {
      receipts: []
    },
    coordinationBackpressureHistoryState: {
      entries: []
    },
    coordinationBackpressureLoopHistoryState: {
      entries: [
        {
          runId: "backpressure-loop-one",
          stopReason: "loop_limit_reached",
          recoveryStatus: "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract",
          completedLoops: 1,
          totalSessions: 2,
          totalPasses: 3,
          appliedCount: 2,
          remainingLoopBudget: 2,
          resumeReady: true
        }
      ]
    }
  }, {
    generatedAt: "2026-04-17T18:00:00.000Z",
    limit: 5
  });

  assert.equal(review.healthStatus, "critical_attention");
  assert.equal(review.queueSummary.deadLetterCount, 1);
  assert.equal(review.runtimeLoopRecoveryReceiptsReview.openCount, 1);
  assert.equal(review.coordinationBackpressureLoopRecoveryReview.dispatchReadyCount, 1);
  assert.equal(review.prioritizedActions[0].key, "queue_dead_letter");
  assert.ok(review.prioritizedActions.some((item) => item.key === "runtime_loop_recovery_open"));
});

test("runtime ops summary renders consolidated health counts", () => {
  const review = buildGithubWebhookServiceRuntimeOpsReview({
    queueState: {
      queue: [],
      pendingQueue: [],
      claimedQueue: [],
      blockedQueue: [],
      deadLetterQueue: []
    },
    runtimeClaimsState: {
      claims: []
    },
    runtimeLoopHistoryState: {
      entries: []
    },
    runtimeLoopRecoveryReceiptsState: {
      receipts: []
    },
    runtimeLoopRecoveryRuntimeCycleHistoryState: {
      entries: []
    },
    runtimeLoopRecoveryRuntimeCycleReceiptsState: {
      receipts: []
    },
    coordinationBackpressureHistoryState: {
      entries: []
    },
    coordinationBackpressureLoopHistoryState: {
      entries: []
    }
  }, {
    generatedAt: "2026-04-17T18:05:00.000Z",
    limit: 5
  });
  const summary = renderGithubWebhookServiceRuntimeOpsSummary(review);

  assert.equal(review.healthStatus, "healthy");
  assert.match(summary, /health_status: healthy/);
  assert.match(summary, /queue_count: 0/);
  assert.match(summary, /Prioritized Actions/);
});

test("runtime integrity review detects duplicate identities, duplicate lane claims and missing contracts", () => {
  const review = buildGithubWebhookServiceRuntimeIntegrityReview({
    queueState: {
      queue: [
        {
          fileName: "pending.json",
          queueState: "pending",
          contract: {
            contractKind: "execution_contract",
            deliveryId: "delivery-1",
            selectedProjectKey: "sample-project",
            serviceState: { identity: "execution_contract::delivery-1::sample-project::-" }
          }
        },
        {
          fileName: "dead-letter.json",
          queueState: "dead_letter",
          contract: {
            contractKind: "execution_contract",
            deliveryId: "delivery-1",
            selectedProjectKey: "sample-project",
            serviceState: { identity: "execution_contract::delivery-1::sample-project::-" }
          }
        }
      ],
      claimedQueue: [
        {
          fileName: "claimed.json",
          queueState: "claimed",
          contract: {
            contractKind: "resume_contract",
            serviceState: { identity: "resume_contract::delivery-2::sample-project::on-demand" }
          }
        }
      ]
    },
    runtimeClaimsState: {
      claims: [
        { laneKey: "lane:a", workerId: "worker-a", leaseExpiresAt: "2099-01-01T00:00:00.000Z" },
        { laneKey: "lane:a", workerId: "worker-b", leaseExpiresAt: "2099-01-01T00:00:00.000Z" }
      ]
    },
    runtimeLoopHistoryState: {
      entries: [
        {
          runId: "loop-1",
          resumeReady: true,
          resumeContractPath: null,
          recoveryStatus: "dispatch_ready_runtime_loop_recovery_contract",
          recoveryContractPath: null
        }
      ]
    },
    runtimeLoopRecoveryReceiptsState: {
      receipts: [
        {
          receiptId: "receipt-1",
          receiptState: "open",
          recoveryStatus: "dispatch_ready_runtime_loop_recovery_contract",
          attemptCount: 0,
          maxAttempts: 3,
          recoveryContractPath: null,
          resumeContractPath: null
        }
      ]
    },
    runtimeLoopRecoveryRuntimeCycleHistoryState: { entries: [] },
    runtimeLoopRecoveryRuntimeCycleReceiptsState: {
      receipts: [
        {
          receiptId: "cycle-receipt-1",
          receiptState: "open",
          resumeReady: true,
          resumeContractPath: null
        }
      ]
    },
    coordinationBackpressureLoopHistoryState: {
      entries: [
        {
          runId: "bp-loop-1",
          resumeReady: true,
          resumeContractPath: null,
          recoveryStatus: "dispatch_ready_runtime_loop_recovery_runtime_cycle_runtime_coordination_backpressure_loop_recovery_contract",
          recoveryContractPath: null
        }
      ]
    },
    referenceChecks: [
      {
        sourceType: "runtime_loop_history",
        sourceId: "loop-1",
        field: "summaryPath",
        referencePath: "runs/integration/missing-summary.md",
        exists: false
      }
    ]
  }, {
    generatedAt: "2026-04-17T09:00:00.000Z"
  });

  assert.equal(review.integrityStatus, "integrity_critical");
  assert.ok(review.prioritizedIssues.some((issue) => issue.key === "duplicate_queue_identity"));
  assert.ok(review.prioritizedIssues.some((issue) => issue.key === "duplicate_runtime_lane_claims"));
  assert.ok(review.prioritizedIssues.some((issue) => issue.key === "runtime_loop_recovery_receipt_missing_recovery_contract"));
  assert.ok(review.prioritizedIssues.some((issue) => issue.key === "missing_runtime_artifact_files"));
});

test("runtime integrity summary renders consolidated integrity counts", () => {
  const summary = renderGithubWebhookServiceRuntimeIntegritySummary({
    generatedAt: "2026-04-17T09:00:00.000Z",
    integrityStatus: "integrity_attention",
    queueCount: 2,
    runtimeClaimCount: 1,
    referenceCheckCount: 4,
    missingReferenceCount: 1,
    duplicateQueueIdentityCount: 0,
    duplicateRuntimeLaneClaimCount: 0,
    prioritizedIssues: [
      {
        severity: "medium",
        key: "missing_runtime_artifact_files",
        title: "Runtime states point to missing artifact files",
        detail: "1 referenced runtime state/receipt/summary artifact file is missing.",
        nextAction: "Refresh or clean up stale artifact pointers so runtime review remains trustworthy.",
        examples: ["runtime_loop_history:loop-1:summaryPath -> runs/integration/missing-summary.md"]
      }
    ],
    nextAction: "Refresh or clean up stale artifact pointers so runtime review remains trustworthy."
  });

  assert.match(summary, /integrity_status: integrity_attention/);
  assert.match(summary, /missing_reference_count: 1/);
  assert.match(summary, /missing_runtime_artifact_files/);
});

test("runtime maintenance plan separates safe reclaim actions from manual follow-up", () => {
  const plan = buildGithubWebhookServiceRuntimeMaintenancePlan({
    integrityState: {
      queueState: {
        queue: [],
        claimedQueue: [
          {
            fileName: "claimed-old.json",
            queueState: "claimed",
            contract: {
              serviceLease: {
                leaseExpiresAt: "2026-04-17T08:00:00.000Z"
              }
            }
          }
        ]
      },
      runtimeClaimsState: {
        claims: [
          {
            laneKey: "lane:a",
            workerId: "worker-a",
            leaseExpiresAt: "2026-04-17T08:00:00.000Z"
          }
        ]
      },
      runtimeLoopHistoryState: {
        entries: [
          {
            runId: "loop-1",
            resumeReady: true,
            resumeContractPath: null
          }
        ]
      },
      runtimeLoopRecoveryReceiptsState: { receipts: [] },
      runtimeLoopRecoveryRuntimeCycleHistoryState: { entries: [] },
      runtimeLoopRecoveryRuntimeCycleReceiptsState: { receipts: [] },
      coordinationBackpressureHistoryState: { entries: [] },
      coordinationBackpressureLoopHistoryState: { entries: [] },
      referenceChecks: []
    }
  }, {
    generatedAt: "2026-04-17T09:00:00.000Z"
  });

  assert.equal(plan.safeActionCount, 2);
  assert.equal(plan.manualActionCount, 1);
  assert.equal(plan.maintenanceStatus, "maintenance_attention");
  assert.ok(plan.safeActions.some((action) => action.key === "reclaim_expired_queue_claims"));
  assert.ok(plan.safeActions.some((action) => action.key === "reclaim_expired_runtime_lane_claims"));
  assert.ok(plan.manualActions.some((action) => action.key === "runtime_loop_history_missing_resume_contract"));
});

test("runtime maintenance summary renders safe and manual sections", () => {
  const summary = renderGithubWebhookServiceRuntimeMaintenanceSummary({
    generatedAt: "2026-04-17T09:00:00.000Z",
    maintenanceStatus: "maintenance_attention",
    integrityStatus: "integrity_attention",
    safeActionCount: 1,
    manualActionCount: 1,
    expiredClaimedQueueCount: 1,
    expiredRuntimeClaimCount: 0,
    safeActions: [
      {
        severity: "high",
        key: "reclaim_expired_queue_claims",
        detail: "1 claimed queue entry has an expired lease and can safely move back to pending.",
        examples: ["claimed-old.json"]
      }
    ],
    manualActions: [
      {
        severity: "high",
        key: "runtime_loop_history_missing_resume_contract",
        detail: "1 runtime loop history entry is resume-ready without a resume contract path.",
        examples: ["loop-1"]
      }
    ],
    nextAction: "Apply maintenance to reclaim stale queue leases before the next service tick."
  }, {
    appliedAt: "2026-04-17T09:05:00.000Z",
    queueClaimsReclaimed: 1,
    runtimeClaimsReclaimed: 0,
    plannedSafeActionCount: 1,
    remainingManualActionCount: 1
  });

  assert.match(summary, /maintenance_status: maintenance_attention/);
  assert.match(summary, /Safe Actions/);
  assert.match(summary, /Manual Follow-up/);
  assert.match(summary, /queue_claims_reclaimed: 1/);
});

test("runtime control review combines ops integrity and maintenance into one closing view", () => {
  const review = buildGithubWebhookServiceRuntimeControlReview({
    queueState: {
      queue: [{}, {}],
      pendingQueue: [],
      claimedQueue: [],
      blockedQueue: [],
      deadLetterQueue: [{}]
    },
    runtimeClaimsState: { claims: [] },
    runtimeLoopHistoryState: { entries: [] },
    runtimeLoopRecoveryReceiptsState: { receipts: [] },
    runtimeLoopRecoveryRuntimeCycleHistoryState: { entries: [] },
    runtimeLoopRecoveryRuntimeCycleReceiptsState: { receipts: [] },
    coordinationBackpressureHistoryState: { entries: [] },
    coordinationBackpressureLoopHistoryState: { entries: [] },
    referenceChecks: []
  }, {
    generatedAt: "2026-04-17T09:00:00.000Z"
  });

  assert.equal(review.controlStatus, "runtime_control_critical");
  assert.equal(review.opsReview.healthStatus, "critical_attention");
  assert.ok(review.highlights.some((item) => item.source === "ops"));
});

test("runtime control summary renders combined control surface", () => {
  const summary = renderGithubWebhookServiceRuntimeControlSummary({
    generatedAt: "2026-04-17T09:00:00.000Z",
    controlStatus: "runtime_control_healthy",
    opsReview: {
      healthStatus: "healthy",
      queueSummary: { queueCount: 0 },
      runtimeClaimsSummary: { activeClaimCount: 0 }
    },
    integrityReview: {
      integrityStatus: "integrity_healthy",
      prioritizedIssues: []
    },
    maintenancePlan: {
      maintenanceStatus: "maintenance_clear",
      safeActionCount: 0,
      manualActionCount: 0
    },
    highlights: [],
    nextAction: "GitHub App runtime control surface looks healthy."
  });

  assert.match(summary, /control_status: runtime_control_healthy/);
  assert.match(summary, /ops_status: healthy/);
  assert.match(summary, /maintenance_status: maintenance_clear/);
});

test("runtime closeout review reaches 100 percent when control is healthy", () => {
  const review = buildGithubWebhookServiceRuntimeCloseoutReview({
    queueState: {
      queue: [],
      pendingQueue: [],
      claimedQueue: [],
      blockedQueue: [],
      deadLetterQueue: []
    },
    runtimeClaimsState: { claims: [] },
    runtimeLoopHistoryState: { entries: [] },
    runtimeLoopRecoveryReceiptsState: { receipts: [] },
    runtimeLoopRecoveryRuntimeCycleHistoryState: { entries: [] },
    runtimeLoopRecoveryRuntimeCycleReceiptsState: { receipts: [] },
    coordinationBackpressureHistoryState: { entries: [] },
    coordinationBackpressureLoopHistoryState: { entries: [] },
    referenceChecks: []
  }, {
    generatedAt: "2026-04-17T09:00:00.000Z"
  });

  assert.equal(review.closeoutStatus, "closeout_ready");
  assert.equal(review.completionPercent, 100);
  assert.equal(review.followupCount, 0);
});

test("runtime closeout summary renders final completion state", () => {
  const summary = renderGithubWebhookServiceRuntimeCloseoutSummary({
    generatedAt: "2026-04-17T09:00:00.000Z",
    closeoutStatus: "closeout_ready",
    completionPercent: 100,
    controlReview: {
      controlStatus: "runtime_control_healthy"
    },
    checklist: [
      {
        key: "ops_surface",
        status: "pass",
        label: "Runtime ops surface is healthy",
        detail: "GitHub App runtime control surface looks healthy."
      }
    ],
    passCount: 1,
    followupCount: 0,
    nextAction: "GitHub App runtime closeout is ready."
  });

  assert.match(summary, /closeout_status: closeout_ready/);
  assert.match(summary, /completion_percent: 100/);
  assert.match(summary, /Closeout Checklist/);
});
