import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubWebhookServiceRequeuePlan,
  buildGithubWebhookServiceRuntimeClaim,
  buildGithubWebhookServiceRuntimeCyclePlan,
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
  enqueueGithubWebhookServiceContractFromFile,
  loadGithubWebhookServiceRuntimeClaims,
  loadGithubWebhookServiceQueue,
  queueGithubWebhookServiceContract,
  reclaimExpiredGithubWebhookServiceRuntimeClaims,
  releaseGithubWebhookServiceRuntimeLanes,
  reclaimExpiredGithubWebhookServiceClaims,
  requeueGithubWebhookServiceQueueEntries,
  renderGithubWebhookServiceRequeueSummary,
  renderGithubWebhookServiceRuntimeCycleSummary,
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
    selectedProjectKey: "eventbear-worker",
    resumeFromCommand: "on-demand"
  }, {
    timestamp: "2026-04-15T12-00-00-000Z"
  });

  const duplicate = await queueGithubWebhookServiceContract(rootDir, {
    contractKind: "resume_contract",
    contractStatus: "dispatch_ready_resume_contract",
    deliveryId: "delivery-dup",
    selectedProjectKey: "eventbear-worker",
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
      selectedProjectKey: "eventbear-worker"
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
      selectedProjectKey: "eventbear-worker"
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
      selectedProjectKey: "eventbear-worker"
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
      selectedProjectKey: "eventbear-worker"
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
      identity: "execution_contract::delivery-a::eventbear-worker::-",
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
        selectedProjectKey: "eventbear-worker"
      }
    },
    {
      fileName: "pending.json",
      contractPath: "/tmp/pending.json",
      queueState: "pending",
      contract: {
        contractKind: "execution_contract",
        contractStatus: "dispatch_ready_contract_only",
        selectedProjectKey: "eventbear-worker"
      }
    }
  ], {
    project: "eventbear-worker"
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
      identity: "recovery_contract::delivery-z::eventbear-worker::-",
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
