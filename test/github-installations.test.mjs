import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  assessGithubAppInstallationServiceAdmin,
  applyGithubAppInstallationGovernanceToState,
  applyGithubAppInstallationOperationsToState,
  applyGithubAppInstallationRuntimeToState,
  applyGithubAppInstallationServiceLaneToState,
  applyGithubAppInstallationServicePlanToState,
  applyGithubAppInstallationWorkerRoutingToState,
  applyGithubAppInstallationScopeHandoff,
  applyGithubAppInstallationPacketToState,
  buildGithubAppInstallationGovernancePlan,
  buildGithubAppInstallationOperationsPlan,
  buildGithubAppInstallationPacket,
  buildGithubAppInstallationRuntimePlan,
  buildGithubAppInstallationServiceLanePlan,
  buildGithubAppInstallationServicePlan,
  buildGithubAppInstallationWorkerRoutingPlan,
  buildGithubAppInstallationScopePlan,
  buildGithubAppInstallationStateSummary,
  loadGithubAppInstallationState,
  renderGithubAppInstallationGovernanceSummary,
  renderGithubAppInstallationOperationsSummary,
  renderGithubAppInstallationPacketSummary,
  renderGithubAppInstallationRuntimeSummary,
  renderGithubAppInstallationServiceLaneSummary,
  renderGithubAppInstallationServicePlanSummary,
  renderGithubAppInstallationWorkerRoutingSummary,
  renderGithubAppInstallationScopeSummary,
  writeGithubAppInstallationArtifacts,
  writeGithubAppInstallationServiceLaneArtifacts,
  writeGithubAppInstallationServicePlanArtifacts,
  writeGithubAppInstallationWorkerRoutingArtifacts,
  writeGithubAppInstallationScopeArtifacts,
  writeGithubAppInstallationState
} from "../lib/github-installations.mjs";

test("buildGithubAppInstallationPacket maps repositories to known projects", () => {
  const packet = buildGithubAppInstallationPacket({
    projects: {
      "eventbear-worker": {
        projectRoot: "../eventbear-worker"
      },
      "patternpilot": {
        projectRoot: "."
      }
    }
  }, {
    generatedAt: "2026-04-15T12:00:00.000Z",
    deliveryId: "delivery-1",
    patternpilotEventKey: "installation_repositories.added",
    installation: {
      id: 10101,
      accountLogin: "Dom-303",
      targetType: "Organization"
    },
    payload: {
      repositories: [
        {
          full_name: "Dom-303/eventbear-worker",
          name: "eventbear-worker",
          default_branch: "main",
          visibility: "public",
          owner: { login: "Dom-303" }
        },
        {
          full_name: "Dom-303/patternpilot",
          name: "patternpilot",
          default_branch: "main",
          visibility: "public",
          owner: { login: "Dom-303" }
        }
      ]
    }
  });

  assert.equal(packet.packetStatus, "multi_project_review");
  assert.deepEqual(packet.mappedProjects, ["eventbear-worker", "patternpilot"]);
  assert.equal(packet.repositoryCount, 2);
  assert.match(renderGithubAppInstallationPacketSummary(packet), /mapped_projects: eventbear-worker, patternpilot/);
});

test("applyGithubAppInstallationPacketToState merges repositories into installation registry", () => {
  const packet = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    deliveryId: "delivery-2",
    eventKey: "installation.created",
    installation: {
      id: 10101,
      accountLogin: "Dom-303",
      targetType: "Organization"
    },
    repositories: [
      {
        fullName: "Dom-303/eventbear-worker",
        mappedProjectKey: "eventbear-worker"
      }
    ],
    repositoryCount: 1,
    mappedProjects: ["eventbear-worker"],
    packetStatus: "single_project_candidate"
  };

  const initialState = {
    schemaVersion: 1,
    updatedAt: null,
    installations: []
  };

  const state = applyGithubAppInstallationPacketToState(initialState, packet, {
    updatedAt: "2026-04-15T12:05:00.000Z"
  });

  assert.equal(state.installations.length, 1);
  assert.equal(state.installations[0].installationId, 10101);
  assert.equal(state.installations[0].repositories.length, 1);
  assert.equal(state.installations[0].mappedProjects[0], "eventbear-worker");
  assert.match(buildGithubAppInstallationStateSummary(state, {
    generatedAt: "2026-04-15T12:06:00.000Z"
  }), /installation_count: 1/);
});

test("writeGithubAppInstallationState and artifacts persist registry outputs", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-github-installations-"));
  const state = {
    schemaVersion: 1,
    updatedAt: "2026-04-15T12:00:00.000Z",
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        targetType: "Organization",
        repositories: [],
        mappedProjects: [],
        sourceEvents: []
      }
    ]
  };
  const statePath = await writeGithubAppInstallationState(rootDir, state, { dryRun: false });
  const loaded = await loadGithubAppInstallationState(rootDir);

  const packet = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "installation.created",
    deliveryId: "delivery-3",
    installation: {
      id: 10101,
      accountLogin: "Dom-303",
      targetType: "Organization"
    },
    repositories: [],
    repositoryCount: 0,
    mappedProjects: [],
    packetStatus: "empty_installation_packet",
    nextAction: "Review manually."
  };
  const summary = renderGithubAppInstallationPacketSummary(packet, { apply: false });
  const artifacts = await writeGithubAppInstallationArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    packet,
    state,
    summary,
    dryRun: false
  });

  assert.match(statePath, /state\/github-app-installations\.json$/);
  assert.equal(loaded.installations.length, 1);
  assert.ok(JSON.parse(await fs.readFile(artifacts.packetPath, "utf8")));
  assert.match(await fs.readFile(artifacts.summaryPath, "utf8"), /Patternpilot GitHub App Installation Packet/);
});

test("buildGithubAppInstallationScopePlan selects watchlist candidates", () => {
  const plan = buildGithubAppInstallationScopePlan({
    projects: {
      "eventbear-worker": {
        projectRoot: "../eventbear-worker"
      }
    }
  }, {
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        targetType: "Organization",
        repositories: [
          {
            fullName: "Dom-303/eventbear-worker",
            mappedProjectKey: "eventbear-worker",
            mappedProjectSource: "repository_match",
            visibility: "public"
          },
          {
            fullName: "Dom-303/patternpilot",
            mappedProjectKey: null,
            mappedProjectSource: "none",
            visibility: "public"
          }
        ]
      }
    ]
  }, {
    installationId: 10101
  });

  assert.equal(plan.installationCount, 1);
  assert.equal(plan.watchlistCandidateCount, 1);
  assert.equal(plan.manualReviewCount, 1);
  assert.equal(plan.selectedEntries.length, 1);
  assert.equal(plan.selectedEntries[0].fullName, "Dom-303/eventbear-worker");
  assert.match(renderGithubAppInstallationScopeSummary(plan), /watchlist_candidate_count: 1/);
});

test("buildGithubAppInstallationGovernancePlan suggests allowed projects from mapped scope", () => {
  const plan = buildGithubAppInstallationGovernancePlan({
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        mappedProjects: ["eventbear-worker"]
      }
    ]
  }, {
    installationId: 10101
  });

  assert.equal(plan.installationCount, 1);
  assert.deepEqual(plan.entries[0].suggestedAllowedProjects, ["eventbear-worker"]);
  assert.match(renderGithubAppInstallationGovernanceSummary(plan), /suggested_allowed=eventbear-worker/);
});

test("applyGithubAppInstallationGovernanceToState persists installation governance", () => {
  const currentState = {
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        mappedProjects: ["eventbear-worker"],
        repositories: []
      }
    ]
  };
  const plan = buildGithubAppInstallationGovernancePlan(currentState, {
    installationId: 10101
  });
  const applied = applyGithubAppInstallationGovernanceToState(currentState, plan, {
    notes: "governed watchlist scope",
    at: "2026-04-15T12:10:00.000Z"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.installations[0].governance.status, "watchlist_governed");
  assert.deepEqual(applied.nextState.installations[0].governance.allowedProjects, ["eventbear-worker"]);
});

test("buildGithubAppInstallationRuntimePlan suggests limited unattended for governed clean scope", () => {
  const plan = buildGithubAppInstallationRuntimePlan({
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        mappedProjects: ["eventbear-worker"],
        governance: {
          status: "watchlist_governed",
          allowedProjects: ["eventbear-worker"]
        },
        repositories: [
          {
            fullName: "Dom-303/eventbear-worker",
            mappedProjectKey: "eventbear-worker"
          }
        ]
      }
    ]
  }, {
    installationId: 10101
  });

  assert.equal(plan.installationCount, 1);
  assert.equal(plan.entries[0].suggestedMode, "limited_unattended");
  assert.equal(plan.entries[0].suggestedAutoServiceEnabled, true);
  assert.match(renderGithubAppInstallationRuntimeSummary(plan), /suggested=limited_unattended/);
});

test("applyGithubAppInstallationRuntimeToState persists installation runtime policy", () => {
  const currentState = {
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        mappedProjects: ["eventbear-worker"],
        governance: {
          status: "watchlist_governed",
          allowedProjects: ["eventbear-worker"]
        },
        repositories: [
          {
            fullName: "Dom-303/eventbear-worker",
            mappedProjectKey: "eventbear-worker"
          }
        ]
      }
    ]
  };
  const plan = buildGithubAppInstallationRuntimePlan(currentState, {
    installationId: 10101
  });
  const applied = applyGithubAppInstallationRuntimeToState(currentState, plan, {
    notes: "runtime for governed installation",
    at: "2026-04-15T12:20:00.000Z"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.installations[0].runtime.status, "runtime_governed");
  assert.equal(applied.nextState.installations[0].runtime.mode, "limited_unattended");
  assert.equal(applied.nextState.installations[0].runtime.autoServiceEnabled, true);
});

test("buildGithubAppInstallationScopePlan respects manual-only runtime blocks", () => {
  const plan = buildGithubAppInstallationScopePlan({
    projects: {
      "eventbear-worker": {
        projectRoot: "../eventbear-worker"
      }
    }
  }, {
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        targetType: "Organization",
        governance: {
          status: "watchlist_governed",
          allowedProjects: ["eventbear-worker"]
        },
        runtime: {
          status: "runtime_governed",
          mode: "manual_only"
        },
        repositories: [
          {
            fullName: "Dom-303/eventbear-worker",
            mappedProjectKey: "eventbear-worker",
            mappedProjectSource: "repository_match",
            visibility: "public"
          }
        ]
      }
    ]
  }, {
    installationId: 10101
  });

  assert.equal(plan.watchlistCandidateCount, 0);
  assert.equal(plan.runtimeBlockedCount, 1);
  assert.equal(plan.entries[0].decision, "runtime_blocked");
  assert.match(renderGithubAppInstallationScopeSummary(plan), /runtime_blocked_count: 1/);
});

test("buildGithubAppInstallationOperationsPlan suggests service readiness for limited unattended installations", () => {
  const plan = buildGithubAppInstallationOperationsPlan({
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        governance: {
          status: "watchlist_governed",
          allowedProjects: ["eventbear-worker"]
        },
        runtime: {
          status: "runtime_governed",
          mode: "limited_unattended",
          autoWatchlistSync: true,
          autoServiceEnabled: true
        },
        repositories: [
          {
            fullName: "Dom-303/eventbear-worker",
            mappedProjectKey: "eventbear-worker"
          }
        ]
      }
    ]
  }, {
    installationId: 10101
  });

  assert.equal(plan.installationCount, 1);
  assert.equal(plan.entries[0].suggestedWatchlistSyncStatus, "watchlist_sync_ready");
  assert.equal(plan.entries[0].suggestedServiceStatus, "service_ready");
  assert.match(renderGithubAppInstallationOperationsSummary(plan), /suggested_service=service_ready/);
});

test("applyGithubAppInstallationOperationsToState persists operations policy", () => {
  const currentState = {
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        governance: {
          status: "watchlist_governed",
          allowedProjects: ["eventbear-worker"]
        },
        runtime: {
          status: "runtime_governed",
          mode: "limited_unattended",
          autoWatchlistSync: true,
          autoServiceEnabled: true
        },
        repositories: [
          {
            fullName: "Dom-303/eventbear-worker",
            mappedProjectKey: "eventbear-worker"
          }
        ]
      }
    ]
  };
  const plan = buildGithubAppInstallationOperationsPlan(currentState, {
    installationId: 10101
  });
  const applied = applyGithubAppInstallationOperationsToState(currentState, plan, {
    notes: "ops policy for governed installation",
    at: "2026-04-15T12:30:00.000Z"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.installations[0].operations.status, "operations_governed");
  assert.equal(applied.nextState.installations[0].operations.watchlistSyncStatus, "watchlist_sync_ready");
  assert.equal(applied.nextState.installations[0].operations.serviceStatus, "service_ready");
});

test("buildGithubAppInstallationServiceLanePlan suggests recovery lane for service-ready installations with blocked queue pressure", () => {
  const plan = buildGithubAppInstallationServiceLanePlan({
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        repositories: [
          { fullName: "Dom-303/eventbear-worker", mappedProjectKey: "eventbear-worker" }
        ],
        operations: {
          status: "operations_governed",
          serviceStatus: "service_ready"
        }
      }
    ]
  }, [
    {
      fileName: "blocked.json",
      contractPath: "/tmp/blocked.json",
      queueState: "blocked",
      contract: {
        contractKind: "recovery_contract",
        contractStatus: "recovery_manual_review",
        installationId: 10101
      }
    }
  ], {
    installationId: 10101
  });

  assert.equal(plan.installationCount, 1);
  assert.equal(plan.entries[0].suggestedLaneMode, "recovery_lane");
  assert.equal(plan.entries[0].suggestedTickDisposition, "recovery_tick");
  assert.match(renderGithubAppInstallationServiceLaneSummary(plan), /suggested_lane=lane_governed:recovery_lane\/recovery_tick/);
});

test("applyGithubAppInstallationServiceLaneToState persists lane policy", () => {
  const currentState = {
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        repositories: [
          { fullName: "Dom-303/eventbear-worker", mappedProjectKey: "eventbear-worker" }
        ],
        operations: {
          status: "operations_governed",
          serviceStatus: "service_ready"
        }
      }
    ]
  };
  const plan = buildGithubAppInstallationServiceLanePlan(currentState, [], {
    installationId: 10101
  });
  const applied = applyGithubAppInstallationServiceLaneToState(currentState, plan, {
    notes: "service lane for governed installation",
    at: "2026-04-16T10:00:00.000Z"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.installations[0].serviceLane.status, "lane_governed");
  assert.equal(applied.nextState.installations[0].serviceLane.tickDisposition, "auto_tick");
  assert.equal(applied.nextState.installations[0].serviceLane.maxConcurrentClaims, 1);
});

test("buildGithubAppInstallationServicePlan suggests urgent recovery-first scheduling for blocked installations", () => {
  const plan = buildGithubAppInstallationServicePlan({
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        operations: {
          status: "operations_governed",
          serviceStatus: "service_ready"
        },
        serviceLane: {
          status: "lane_governed",
          laneMode: "recovery_lane",
          tickDisposition: "recovery_tick",
          maxConcurrentClaims: 2
        }
      }
    ]
  }, [
    {
      fileName: "dead.json",
      contractPath: "/tmp/dead.json",
      queueState: "dead_letter",
      contract: {
        contractKind: "recovery_contract",
        installationId: 10101
      }
    }
  ], {
    installationId: 10101
  });

  assert.equal(plan.installationCount, 1);
  assert.equal(plan.entries[0].suggestedPriority, "urgent");
  assert.equal(plan.entries[0].suggestedTickBudget, 1);
  assert.deepEqual(plan.entries[0].suggestedPreferredContractKinds, ["recovery_contract", "resume_contract", "execution_contract"]);
  assert.match(renderGithubAppInstallationServicePlanSummary(plan), /suggested=schedule_governed:urgent\/budget=1/);
});

test("applyGithubAppInstallationServicePlanToState persists shared service plan", () => {
  const currentState = {
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        operations: {
          status: "operations_governed",
          serviceStatus: "service_ready"
        },
        serviceLane: {
          status: "lane_governed",
          laneMode: "auto_lane",
          tickDisposition: "auto_tick",
          maxConcurrentClaims: 2
        }
      }
    ]
  };
  const plan = buildGithubAppInstallationServicePlan(currentState, [], {
    installationId: 10101
  });
  const applied = applyGithubAppInstallationServicePlanToState(currentState, plan, {
    notes: "shared service plan for governed installation",
    at: "2026-04-16T10:05:00.000Z"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.installations[0].servicePlan.status, "schedule_governed");
  assert.equal(applied.nextState.installations[0].servicePlan.priority, "idle");
  assert.equal(applied.nextState.installations[0].servicePlan.tickBudget, 1);
});

test("buildGithubAppInstallationWorkerRoutingPlan suggests pinned recovery worker when worker id is provided", () => {
  const plan = buildGithubAppInstallationWorkerRoutingPlan({
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        serviceLane: {
          status: "lane_governed",
          laneMode: "recovery_lane",
          tickDisposition: "recovery_tick",
          maxConcurrentClaims: 1
        },
        servicePlan: {
          status: "schedule_governed",
          priority: "urgent",
          tickBudget: 1
        }
      }
    ]
  }, [
    {
      fileName: "dead.json",
      contractPath: "/tmp/dead.json",
      queueState: "dead_letter",
      contract: {
        contractKind: "recovery_contract",
        installationId: 10101
      }
    }
  ], {
    installationId: 10101,
    workerId: "worker-a"
  });

  assert.equal(plan.entries[0].suggestedSchedulerLane, "recovery_priority");
  assert.equal(plan.entries[0].suggestedWorkerMode, "pinned_worker");
  assert.equal(plan.entries[0].suggestedAssignedWorkerId, "worker-a");
  assert.match(renderGithubAppInstallationWorkerRoutingSummary(plan), /suggested=routing_governed:recovery_priority\/pinned_worker:worker-a/);
});

test("applyGithubAppInstallationWorkerRoutingToState persists worker routing", () => {
  const currentState = {
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
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
        }
      }
    ]
  };
  const plan = buildGithubAppInstallationWorkerRoutingPlan(currentState, [
    {
      fileName: "pending.json",
      contractPath: "/tmp/pending.json",
      queueState: "pending",
      contract: {
        contractKind: "execution_contract",
        installationId: 10101
      }
    }
  ], {
    installationId: 10101,
    workerId: "worker-a"
  });
  const applied = applyGithubAppInstallationWorkerRoutingToState(currentState, plan, {
    notes: "worker routing for governed installation",
    at: "2026-04-16T11:00:00.000Z"
  });

  assert.equal(applied.receipts.length, 1);
  assert.equal(applied.nextState.installations[0].workerRouting.status, "routing_governed");
  assert.equal(applied.nextState.installations[0].workerRouting.schedulerLane, "priority");
});

test("assessGithubAppInstallationServiceAdmin blocks dead-letter requeue when installation policy disallows it", () => {
  const assessment = assessGithubAppInstallationServiceAdmin({
    installations: [
      {
        installationId: 10101,
        operations: {
          status: "operations_governed",
          requeueDeadLetterAllowed: false
        }
      }
    ]
  }, {
    installationId: 10101
  }, {
    queueState: "dead_letter"
  });

  assert.equal(assessment.allowed, false);
  assert.equal(assessment.status, "dead_letter_requeue_disallowed");
});

test("buildGithubAppInstallationScopePlan respects installation governance blocks", () => {
  const plan = buildGithubAppInstallationScopePlan({
    projects: {
      "eventbear-worker": {
        projectRoot: "../eventbear-worker"
      }
    }
  }, {
    installations: [
      {
        installationId: 10101,
        governance: {
          status: "watchlist_governed",
          allowedProjects: [],
          blockedRepositories: ["Dom-303/eventbear-worker"],
          defaultMappedAction: "watchlist_candidate",
          defaultUnmappedAction: "manual_review"
        },
        repositories: [
          {
            fullName: "Dom-303/eventbear-worker",
            mappedProjectKey: "eventbear-worker",
            mappedProjectSource: "repository_match",
            visibility: "public"
          }
        ]
      }
    ]
  }, {
    installationId: 10101
  });

  assert.equal(plan.watchlistCandidateCount, 0);
  assert.equal(plan.governanceBlockedCount, 1);
  assert.equal(plan.entries[0].decision, "blocked_repository");
});

test("applyGithubAppInstallationScopeHandoff updates repo handoff status", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-github-installation-scope-"));
  const state = {
    schemaVersion: 1,
    updatedAt: "2026-04-15T12:00:00.000Z",
    installations: [
      {
        installationId: 10101,
        accountLogin: "Dom-303",
        targetType: "Organization",
        repositories: [
          {
            fullName: "Dom-303/eventbear-worker",
            mappedProjectKey: "eventbear-worker",
            mappedProjectSource: "repository_match",
            visibility: "public"
          }
        ]
      }
    ]
  };
  const plan = buildGithubAppInstallationScopePlan({
    projects: {
      "eventbear-worker": {
        projectRoot: "../eventbear-worker",
        watchlistFile: "projects/eventbear-worker/WATCHLIST.txt"
      }
    }
  }, state, {
    installationId: 10101
  });

  const handoff = await applyGithubAppInstallationScopeHandoff(rootDir, {
    projects: {
      "eventbear-worker": {
        projectRoot: "../eventbear-worker",
        watchlistFile: "projects/eventbear-worker/WATCHLIST.txt"
      }
    }
  }, state, plan, {
    dryRun: true,
    notes: "sync to watchlist",
    appendUrlsToWatchlist: async (_rootDir, _project, urls) => ({
      status: "appended_urls",
      appended: urls.length,
      keptExisting: 0
    })
  });

  assert.equal(handoff.receipts.length, 1);
  assert.equal(handoff.receipts[0].projectKey, "eventbear-worker");
  assert.equal(handoff.nextState.installations[0].repositories[0].handoff.status, "appended_urls");
  assert.match(renderGithubAppInstallationScopeSummary(plan, handoff.receipts), /appended_urls/);
});

test("writeGithubAppInstallationScopeArtifacts writes scope files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-github-installation-scope-artifacts-"));
  const plan = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    installationId: 10101,
    project: "eventbear-worker",
    installationCount: 1,
    totalEntries: 1,
    watchlistCandidateCount: 1,
    manualReviewCount: 0,
    selectedEntries: [],
    entries: [],
    nextAction: "Review it."
  };
  const state = {
    schemaVersion: 1,
    updatedAt: "2026-04-15T12:00:00.000Z",
    installations: []
  };
  const summary = renderGithubAppInstallationScopeSummary(plan, []);
  const artifacts = await writeGithubAppInstallationScopeArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    plan,
    receipts: [],
    state,
    summary,
    dryRun: false
  });

  assert.ok(JSON.parse(await fs.readFile(artifacts.planPath, "utf8")));
  assert.ok(JSON.parse(await fs.readFile(artifacts.statePath, "utf8")));
  assert.match(await fs.readFile(artifacts.summaryPath, "utf8"), /Patternpilot GitHub App Installation Scope/);
});

test("writeGithubAppInstallationServiceLaneArtifacts writes service lane files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-github-installation-lane-artifacts-"));
  const plan = {
    generatedAt: "2026-04-16T10:00:00.000Z",
    installationId: 10101,
    project: "eventbear-worker",
    installationCount: 1,
    entries: [],
    nextAction: "Review it."
  };
  const state = {
    schemaVersion: 1,
    updatedAt: "2026-04-16T10:00:00.000Z",
    installations: []
  };
  const summary = renderGithubAppInstallationServiceLaneSummary(plan, []);
  const artifacts = await writeGithubAppInstallationServiceLaneArtifacts(rootDir, {
    runId: "2026-04-16T10-00-00-000Z",
    plan,
    receipts: [],
    state,
    summary,
    dryRun: false
  });

  assert.ok(JSON.parse(await fs.readFile(artifacts.planPath, "utf8")));
  assert.ok(JSON.parse(await fs.readFile(artifacts.statePath, "utf8")));
  assert.match(await fs.readFile(artifacts.summaryPath, "utf8"), /Patternpilot GitHub App Installation Service Lanes/);
});

test("writeGithubAppInstallationServicePlanArtifacts writes service plan files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-github-installation-plan-artifacts-"));
  const plan = {
    generatedAt: "2026-04-16T10:00:00.000Z",
    installationId: 10101,
    project: "eventbear-worker",
    installationCount: 1,
    entries: [],
    nextAction: "Review it."
  };
  const state = {
    schemaVersion: 1,
    updatedAt: "2026-04-16T10:00:00.000Z",
    installations: []
  };
  const summary = renderGithubAppInstallationServicePlanSummary(plan, []);
  const artifacts = await writeGithubAppInstallationServicePlanArtifacts(rootDir, {
    runId: "2026-04-16T10-00-00-000Z",
    plan,
    receipts: [],
    state,
    summary,
    dryRun: false
  });

  assert.ok(JSON.parse(await fs.readFile(artifacts.planPath, "utf8")));
  assert.ok(JSON.parse(await fs.readFile(artifacts.statePath, "utf8")));
  assert.match(await fs.readFile(artifacts.summaryPath, "utf8"), /Patternpilot GitHub App Installation Service Plan/);
});

test("writeGithubAppInstallationWorkerRoutingArtifacts writes worker routing files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-github-installation-routing-artifacts-"));
  const plan = {
    generatedAt: "2026-04-16T11:00:00.000Z",
    installationId: 10101,
    project: "eventbear-worker",
    workerId: "worker-a",
    installationCount: 1,
    entries: [],
    nextAction: "Review it."
  };
  const state = {
    schemaVersion: 1,
    updatedAt: "2026-04-16T11:00:00.000Z",
    installations: []
  };
  const summary = renderGithubAppInstallationWorkerRoutingSummary(plan, []);
  const artifacts = await writeGithubAppInstallationWorkerRoutingArtifacts(rootDir, {
    runId: "2026-04-16T11-00-00-000Z",
    plan,
    receipts: [],
    state,
    summary,
    dryRun: false
  });

  assert.ok(JSON.parse(await fs.readFile(artifacts.planPath, "utf8")));
  assert.ok(JSON.parse(await fs.readFile(artifacts.statePath, "utf8")));
  assert.match(await fs.readFile(artifacts.summaryPath, "utf8"), /Patternpilot GitHub App Installation Worker Routing/);
});
