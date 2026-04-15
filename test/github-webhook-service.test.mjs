import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubWebhookServiceRequeuePlan,
  buildGithubWebhookServiceReviewPlan,
  buildGithubWebhookServiceTickPlan,
  claimGithubWebhookServiceQueueEntries,
  classifyGithubWebhookServiceQueueEntry,
  enqueueGithubWebhookServiceContractFromFile,
  loadGithubWebhookServiceQueue,
  queueGithubWebhookServiceContract,
  reclaimExpiredGithubWebhookServiceClaims,
  requeueGithubWebhookServiceQueueEntries,
  renderGithubWebhookServiceRequeueSummary,
  renderGithubWebhookServiceReviewSummary,
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
