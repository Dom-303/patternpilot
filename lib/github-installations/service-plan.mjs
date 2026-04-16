import {
  findInstallationRecord,
  normalizeInstallationOperations,
  normalizeInstallationServiceLane,
  normalizeInstallationServicePlan,
  unique
} from "./shared.mjs";

export function assessGithubAppInstallationServicePlan(state, contract, options = {}) {
  const installationId = Number.isFinite(contract?.installationId)
    ? Number(contract.installationId)
    : null;

  if (!installationId) {
    return {
      status: "no_installation_context",
      installationId: null,
      allowed: true,
      priority: "normal",
      tickBudget: null,
      preferredContractKinds: ["execution_contract", "resume_contract", "recovery_contract"],
      contractPreferenceRank: 0,
      nextAction: "This contract has no installation context, so installation service planning does not apply."
    };
  }

  const installation = findInstallationRecord(state, installationId);
  if (!installation) {
    return {
      status: "installation_unregistered",
      installationId,
      allowed: false,
      priority: "low",
      tickBudget: 0,
      preferredContractKinds: [],
      contractPreferenceRank: Number.MAX_SAFE_INTEGER,
      nextAction: "Persist or refresh the installation registry before this installation participates in shared service planning."
    };
  }

  const servicePlan = normalizeInstallationServicePlan(installation);
  const contractKind = contract?.contractKind ?? "unknown";
  const preferenceRank = servicePlan.preferredContractKinds.indexOf(contractKind);

  if (servicePlan.status !== "schedule_governed") {
    return {
      status: "schedule_inferred_ready",
      installationId,
      installation,
      allowed: true,
      priority: "normal",
      tickBudget: 1,
      preferredContractKinds: ["execution_contract", "resume_contract", "recovery_contract"],
      contractPreferenceRank: 0,
      nextAction: "No explicit installation service plan is stored yet, so the shared tick falls back to a conservative default."
    };
  }

  if (servicePlan.tickBudget <= 0) {
    return {
      status: "schedule_paused",
      installationId,
      installation,
      allowed: false,
      priority: servicePlan.priority,
      tickBudget: servicePlan.tickBudget,
      preferredContractKinds: servicePlan.preferredContractKinds,
      contractPreferenceRank: preferenceRank === -1 ? Number.MAX_SAFE_INTEGER : preferenceRank,
      nextAction: "This installation currently has no shared tick budget, so it stays out of multi-installation service planning."
    };
  }

  return {
    status: "schedule_ready",
    installationId,
    installation,
    allowed: true,
    priority: servicePlan.priority,
    tickBudget: servicePlan.tickBudget,
    preferredContractKinds: servicePlan.preferredContractKinds,
    contractPreferenceRank: preferenceRank === -1 ? Number.MAX_SAFE_INTEGER : preferenceRank,
    nextAction: "Installation service plan allows this contract to participate in shared service selection."
  };
}

export function buildGithubAppInstallationServicePlan(state, queueEntries = [], options = {}) {
  const installations = Array.isArray(state.installations) ? state.installations : [];
  const selectedInstallations = installations.filter((installation) => {
    if (!Number.isFinite(options.installationId)) {
      return true;
    }
    return installation.installationId === options.installationId;
  });

  const entries = selectedInstallations.map((installation) => {
    const operations = normalizeInstallationOperations(installation);
    const lane = normalizeInstallationServiceLane(installation);
    const currentPlan = normalizeInstallationServicePlan(installation);
    const installationQueueEntries = queueEntries.filter((entry) => {
      return Number(entry.contract?.installationId) === Number(installation.installationId);
    });
    const pendingCount = installationQueueEntries.filter((entry) => entry.queueState === "pending").length;
    const claimedCount = installationQueueEntries.filter((entry) => entry.queueState === "claimed").length;
    const blockedCount = installationQueueEntries.filter((entry) => entry.queueState === "blocked").length;
    const deadLetterCount = installationQueueEntries.filter((entry) => entry.queueState === "dead_letter").length;
    const executionReadyCount = installationQueueEntries.filter((entry) => {
      return entry.queueState === "pending" && entry.contract?.contractKind === "execution_contract";
    }).length;
    const resumeReadyCount = installationQueueEntries.filter((entry) => {
      return entry.queueState === "pending" && entry.contract?.contractKind === "resume_contract";
    }).length;
    const recoveryReadyCount = installationQueueEntries.filter((entry) => {
      return entry.queueState === "pending" && entry.contract?.contractKind === "recovery_contract";
    }).length;

    let suggestedStatus = "schedule_governed";
    let suggestedPriority = "normal";
    let suggestedTickBudget = 1;
    let suggestedPreferredContractKinds = ["execution_contract", "resume_contract", "recovery_contract"];
    let recommendation = "Keep this installation on a conservative shared-service plan until queue pressure becomes clearer.";

    if (operations.status !== "operations_governed" || lane.status !== "lane_governed") {
      suggestedStatus = "schedule_blocked";
      suggestedPriority = "low";
      suggestedTickBudget = 0;
      suggestedPreferredContractKinds = [];
      recommendation = "Persist installation operations and lane policy first before this installation enters shared service planning.";
    } else if (lane.tickDisposition === "skip" || operations.serviceStatus === "service_disabled") {
      suggestedPriority = "low";
      suggestedTickBudget = 0;
      suggestedPreferredContractKinds = [];
      recommendation = "This installation should stay outside shared service ticks while service remains disabled.";
    } else if (lane.tickDisposition === "manual_only") {
      suggestedPriority = blockedCount > 0 || deadLetterCount > 0 ? "elevated" : "low";
      suggestedTickBudget = 0;
      suggestedPreferredContractKinds = [];
      recommendation = "This installation remains behind manual release, so the shared service plan should not allocate automatic claim budget.";
    } else if (lane.tickDisposition === "recovery_tick" || blockedCount > 0 || deadLetterCount > 0) {
      suggestedPriority = deadLetterCount > 0 ? "urgent" : "high";
      suggestedTickBudget = Math.max(1, Math.min(lane.maxConcurrentClaims, recoveryReadyCount + resumeReadyCount || 1));
      suggestedPreferredContractKinds = ["recovery_contract", "resume_contract", "execution_contract"];
      recommendation = "Use a recovery-focused shared plan until blocked and dead-letter work has been reduced for this installation.";
    } else {
      suggestedPriority = executionReadyCount >= 3 || pendingCount >= 4 ? "high" : pendingCount > 0 ? "normal" : "idle";
      suggestedTickBudget = Math.max(1, Math.min(lane.maxConcurrentClaims, Math.max(executionReadyCount + resumeReadyCount + recoveryReadyCount, 1)));
      suggestedPreferredContractKinds = ["execution_contract", "resume_contract", "recovery_contract"];
      recommendation = "This installation can participate in the shared automatic service plan with a budget based on current queue pressure.";
    }

    return {
      installationId: installation.installationId,
      accountLogin: installation.accountLogin ?? null,
      currentStatus: currentPlan.status,
      currentPriority: currentPlan.priority,
      currentTickBudget: currentPlan.tickBudget,
      currentPreferredContractKinds: currentPlan.preferredContractKinds,
      laneStatus: lane.status,
      laneMode: lane.laneMode,
      tickDisposition: lane.tickDisposition,
      operationsStatus: operations.status,
      serviceStatus: operations.serviceStatus,
      queueCount: installationQueueEntries.length,
      pendingCount,
      claimedCount,
      blockedCount,
      deadLetterCount,
      executionReadyCount,
      resumeReadyCount,
      recoveryReadyCount,
      suggestedStatus,
      suggestedPriority,
      suggestedTickBudget,
      suggestedPreferredContractKinds,
      recommendation
    };
  });

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    installationId: Number.isFinite(options.installationId) ? options.installationId : null,
    project: options.project ?? null,
    installationCount: selectedInstallations.length,
    entries,
    nextAction: entries.length > 0
      ? "Review the shared installation service plan and persist it before relying on multi-installation service ticks."
      : "No installation records match the current service-plan filter."
  };
}

export function renderGithubAppInstallationServicePlanSummary(plan, receipts = []) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => `- installation=${entry.installationId}: current=${entry.currentStatus}:${entry.currentPriority}/budget=${entry.currentTickBudget} | lane=${entry.laneStatus}:${entry.laneMode}/${entry.tickDisposition} | ops=${entry.operationsStatus}:${entry.serviceStatus} | suggested=${entry.suggestedStatus}:${entry.suggestedPriority}/budget=${entry.suggestedTickBudget} | preferred=${entry.suggestedPreferredContractKinds.join(",") || "-"} | pending=${entry.pendingCount} | blocked=${entry.blockedCount} | dead_letter=${entry.deadLetterCount}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- installation=${receipt.installationId}: status=${receipt.status} | priority=${receipt.priority} | tick_budget=${receipt.tickBudget} | preferred=${receipt.preferredContractKinds.join(",") || "-"} | notes=${receipt.notes ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Service Plan

- generated_at: ${plan.generatedAt}
- installation_filter: ${plan.installationId ?? "-"}
- project_filter: ${plan.project ?? "-"}
- installation_count: ${plan.installationCount}

## Plan Entries

${entryLines}

## Plan Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function applyGithubAppInstallationServicePlanToState(currentState, plan, options = {}) {
  const installations = Array.isArray(currentState.installations)
    ? structuredClone(currentState.installations)
    : [];
  const receipts = [];
  const reviewedAt = options.at ?? new Date().toISOString();

  for (const entry of plan.entries) {
    const installation = installations.find((item) => item.installationId === entry.installationId);
    if (!installation) {
      continue;
    }

    const servicePlan = normalizeInstallationServicePlan(installation, {
      override: {
        status: entry.suggestedStatus,
        priority: entry.suggestedPriority,
        tickBudget: entry.suggestedTickBudget,
        preferredContractKinds: entry.suggestedPreferredContractKinds,
        lastReviewedAt: reviewedAt,
        notes: unique([...(installation.servicePlan?.notes ?? []), options.notes?.trim() || null]),
        history: [
          ...((installation.servicePlan?.history ?? [])),
          {
            at: reviewedAt,
            action: "service_plan_reviewed",
            priority: entry.suggestedPriority,
            tickBudget: entry.suggestedTickBudget,
            preferredContractKinds: entry.suggestedPreferredContractKinds,
            notes: options.notes?.trim() || null
          }
        ]
      }
    });

    installation.servicePlan = servicePlan;
    receipts.push({
      installationId: installation.installationId,
      status: servicePlan.status,
      priority: servicePlan.priority,
      tickBudget: servicePlan.tickBudget,
      preferredContractKinds: servicePlan.preferredContractKinds,
      notes: options.notes?.trim() || null
    });
  }

  return {
    receipts,
    nextState: {
      schemaVersion: 1,
      updatedAt: reviewedAt,
      installations
    }
  };
}
