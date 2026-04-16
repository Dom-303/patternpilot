import {
  findInstallationRecord,
  normalizeInstallationOperations,
  normalizeInstallationRuntime,
  normalizeInstallationServiceLane,
  unique
} from "./shared.mjs";

export function assessGithubAppInstallationServiceLane(state, contract, options = {}) {
  const installationId = Number.isFinite(contract?.installationId)
    ? Number(contract.installationId)
    : null;

  if (!installationId) {
    return {
      status: "no_installation_context",
      installationId: null,
      allowed: true,
      laneMode: "unscoped_lane",
      tickDisposition: "auto_tick",
      maxConcurrentClaims: null,
      nextAction: "This contract has no installation context, so installation-scoped service lanes do not apply."
    };
  }

  const installation = findInstallationRecord(state, installationId);
  if (!installation) {
    return {
      status: "installation_unregistered",
      installationId,
      allowed: false,
      laneMode: "unknown_lane",
      tickDisposition: "skip",
      maxConcurrentClaims: null,
      nextAction: "Persist or refresh the installation registry before this installation can participate in scoped service lanes."
    };
  }

  const lane = normalizeInstallationServiceLane(installation);
  const contractKind = contract?.contractKind ?? "unknown";

  if (lane.status !== "lane_governed") {
    return {
      status: "lane_inferred_ready",
      installationId,
      installation,
      allowed: true,
      laneMode: "auto_lane",
      tickDisposition: "auto_tick",
      maxConcurrentClaims: 1,
      nextAction: "No explicit installation service lane is stored yet, so the service loop falls back to a conservative single-claim default."
    };
  }

  if (lane.tickDisposition === "skip") {
    return {
      status: "lane_disabled",
      installationId,
      installation,
      allowed: false,
      laneMode: lane.laneMode,
      tickDisposition: lane.tickDisposition,
      maxConcurrentClaims: lane.maxConcurrentClaims,
      nextAction: "This installation is currently outside automated service lanes."
    };
  }

  if (lane.tickDisposition === "manual_only") {
    return {
      status: "lane_manual_guard",
      installationId,
      installation,
      allowed: false,
      laneMode: lane.laneMode,
      tickDisposition: lane.tickDisposition,
      maxConcurrentClaims: lane.maxConcurrentClaims,
      nextAction: "This installation stays behind a manual service lane until the current repo set is explicitly released."
    };
  }

  if (lane.tickDisposition === "recovery_tick" && contractKind === "execution_contract") {
    return {
      status: "lane_recovery_focus",
      installationId,
      installation,
      allowed: false,
      laneMode: lane.laneMode,
      tickDisposition: lane.tickDisposition,
      maxConcurrentClaims: lane.maxConcurrentClaims,
      nextAction: "This installation currently allows only recovery/resume work through the service lane, not fresh execution contracts."
    };
  }

  return {
    status: "lane_ready",
    installationId,
    installation,
    allowed: true,
    laneMode: lane.laneMode,
    tickDisposition: lane.tickDisposition,
    maxConcurrentClaims: lane.maxConcurrentClaims,
    priority: lane.priority,
    nextAction: "Installation service lane allows this contract to be considered by the local service tick."
  };
}

function classifyQueueEntryForInstallationLane(entry = {}) {
  const queueState = entry.queueState ?? "pending";
  const contractKind = entry.contract?.contractKind ?? "unknown";

  return {
    queueState,
    contractKind,
    actionableReady: queueState === "pending"
      && (
        (contractKind === "execution_contract" && [
          "dispatch_ready",
          "dispatch_ready_dry_run",
          "dispatch_ready_contract_only"
        ].includes(entry.contract?.contractStatus))
        || (contractKind === "resume_contract" && entry.contract?.contractStatus === "dispatch_ready_resume_contract")
        || (contractKind === "recovery_contract" && entry.contract?.contractStatus === "dispatch_ready_recovery_contract")
      )
  };
}

export function buildGithubAppInstallationServiceLanePlan(state, queueEntries = [], options = {}) {
  const installations = Array.isArray(state.installations) ? state.installations : [];
  const selectedInstallations = installations.filter((installation) => {
    if (!Number.isFinite(options.installationId)) {
      return true;
    }
    return installation.installationId === options.installationId;
  });

  const entries = selectedInstallations.map((installation) => {
    const operations = normalizeInstallationOperations(installation);
    const runtime = normalizeInstallationRuntime(installation);
    const lane = normalizeInstallationServiceLane(installation);
    const repositories = Array.isArray(installation.repositories) ? installation.repositories : [];
    const installationQueueEntries = queueEntries.filter((entry) => {
      return Number(entry.contract?.installationId) === Number(installation.installationId);
    });
    const queueStats = installationQueueEntries.map(classifyQueueEntryForInstallationLane);
    const pendingCount = queueStats.filter((entry) => entry.queueState === "pending").length;
    const claimedCount = queueStats.filter((entry) => entry.queueState === "claimed").length;
    const blockedCount = queueStats.filter((entry) => entry.queueState === "blocked").length;
    const deadLetterCount = queueStats.filter((entry) => entry.queueState === "dead_letter").length;
    const actionablePendingCount = queueStats.filter((entry) => entry.actionableReady).length;

    let suggestedLaneMode = "manual_lane";
    let suggestedTickDisposition = "manual_only";
    let suggestedStatus = "lane_governed";
    let suggestedPriority = "normal";
    let suggestedMaxConcurrentClaims = 1;
    let recommendation = "Keep this installation on a manual service lane until installation operations and queue pressure become clearer.";

    if (operations.status !== "operations_governed") {
      suggestedStatus = "lane_blocked";
      suggestedLaneMode = "blocked_lane";
      suggestedTickDisposition = "skip";
      suggestedPriority = "low";
      recommendation = "Persist installation operations policy first before this installation participates in service lanes.";
    } else if (operations.serviceStatus === "service_disabled") {
      suggestedLaneMode = "disabled_lane";
      suggestedTickDisposition = "skip";
      suggestedPriority = "low";
      recommendation = "Service is disabled for this installation, so its lane should stay out of automatic ticks.";
    } else if (operations.serviceStatus === "service_manual_guard") {
      suggestedLaneMode = "manual_lane";
      suggestedTickDisposition = "manual_only";
      suggestedPriority = blockedCount > 0 || deadLetterCount > 0 ? "elevated" : "normal";
      recommendation = "Keep this installation on a manual service lane until the guarded repo set has been explicitly reviewed and released.";
    } else if (operations.serviceStatus === "service_ready") {
      if (deadLetterCount > 0 || blockedCount > 0) {
        suggestedLaneMode = "recovery_lane";
        suggestedTickDisposition = "recovery_tick";
        suggestedPriority = "elevated";
        recommendation = "This installation is service-ready, but the current queue shape suggests a recovery-focused lane until blocked/dead-letter contracts are worked down.";
      } else {
        suggestedLaneMode = "auto_lane";
        suggestedTickDisposition = "auto_tick";
        suggestedPriority = actionablePendingCount > 2 ? "high" : actionablePendingCount > 0 ? "normal" : "idle";
        recommendation = "This installation can run through an automatic service lane because operations are ready and the queue is not currently in a recovery-heavy state.";
      }

      if (suggestedTickDisposition !== "skip") {
        const queuePressure = Math.max(actionablePendingCount, claimedCount, repositories.length > 0 ? 1 : 0);
        suggestedMaxConcurrentClaims = queuePressure >= 5 ? 3 : queuePressure >= 2 ? 2 : 1;
      }
    }

    return {
      installationId: installation.installationId,
      accountLogin: installation.accountLogin ?? null,
      targetType: installation.targetType ?? null,
      repositoryCount: repositories.length,
      operationsStatus: operations.status,
      serviceStatus: operations.serviceStatus,
      runtimeStatus: runtime.status,
      runtimeMode: runtime.mode,
      currentLaneStatus: lane.status,
      currentLaneMode: lane.laneMode,
      currentTickDisposition: lane.tickDisposition,
      currentMaxConcurrentClaims: lane.maxConcurrentClaims,
      currentPriority: lane.priority,
      queueCount: installationQueueEntries.length,
      pendingCount,
      claimedCount,
      blockedCount,
      deadLetterCount,
      actionablePendingCount,
      suggestedLaneStatus: suggestedStatus,
      suggestedLaneMode,
      suggestedTickDisposition,
      suggestedMaxConcurrentClaims,
      suggestedPriority,
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
      ? "Review the installation service lanes and persist them before treating multi-installation service ticks as a stable runtime surface."
      : "No installation records match the current service-lane filter."
  };
}

export function renderGithubAppInstallationServiceLaneSummary(plan, receipts = []) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => `- installation=${entry.installationId}: ops=${entry.operationsStatus}:${entry.serviceStatus} | current_lane=${entry.currentLaneStatus}:${entry.currentLaneMode}/${entry.currentTickDisposition} | suggested_lane=${entry.suggestedLaneStatus}:${entry.suggestedLaneMode}/${entry.suggestedTickDisposition} | concurrency=${entry.suggestedMaxConcurrentClaims} | queue=${entry.queueCount} | pending=${entry.pendingCount} | claimed=${entry.claimedCount} | blocked=${entry.blockedCount} | dead_letter=${entry.deadLetterCount}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- installation=${receipt.installationId}: status=${receipt.status} | lane=${receipt.laneMode}/${receipt.tickDisposition} | concurrency=${receipt.maxConcurrentClaims} | priority=${receipt.priority} | notes=${receipt.notes ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Service Lanes

- generated_at: ${plan.generatedAt}
- installation_filter: ${plan.installationId ?? "-"}
- project_filter: ${plan.project ?? "-"}
- installation_count: ${plan.installationCount}

## Lane Entries

${entryLines}

## Lane Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function applyGithubAppInstallationServiceLaneToState(currentState, plan, options = {}) {
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

    const lane = normalizeInstallationServiceLane(installation, {
      override: {
        status: entry.suggestedLaneStatus,
        laneMode: entry.suggestedLaneMode,
        tickDisposition: entry.suggestedTickDisposition,
        maxConcurrentClaims: entry.suggestedMaxConcurrentClaims,
        priority: entry.suggestedPriority,
        lastReviewedAt: reviewedAt,
        notes: unique([...(installation.serviceLane?.notes ?? []), options.notes?.trim() || null]),
        history: [
          ...((installation.serviceLane?.history ?? [])),
          {
            at: reviewedAt,
            action: "service_lane_reviewed",
            laneMode: entry.suggestedLaneMode,
            tickDisposition: entry.suggestedTickDisposition,
            maxConcurrentClaims: entry.suggestedMaxConcurrentClaims,
            priority: entry.suggestedPriority,
            notes: options.notes?.trim() || null
          }
        ]
      }
    });

    installation.serviceLane = lane;
    receipts.push({
      installationId: installation.installationId,
      status: lane.status,
      laneMode: lane.laneMode,
      tickDisposition: lane.tickDisposition,
      maxConcurrentClaims: lane.maxConcurrentClaims,
      priority: lane.priority,
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
