import {
  findInstallationRecord,
  normalizeInstallationGovernance,
  normalizeInstallationOperations,
  normalizeInstallationRuntime,
  normalizeInstallationScopeDecision,
  unique
} from "./shared.mjs";

export function assessGithubAppInstallationOperations(state, contract, options = {}) {
  const installationId = Number.isFinite(contract?.installationId)
    ? Number(contract.installationId)
    : null;

  if (!installationId) {
    return {
      status: "no_installation_context",
      installationId: null,
      allowed: true,
      nextAction: "This contract has no installation context, so installation operations governance does not apply."
    };
  }

  const installation = findInstallationRecord(state, installationId);
  if (!installation) {
    return {
      status: "installation_unregistered",
      installationId,
      allowed: false,
      nextAction: "Persist or refresh the GitHub App installation registry before this contract is allowed into service execution."
    };
  }

  const operations = normalizeInstallationOperations(installation);
  if (operations.status !== "operations_governed") {
    return {
      status: "operations_not_governed",
      installationId,
      allowed: false,
      installation,
      nextAction: "Review and apply installation operations policy before allowing service-side execution."
    };
  }

  if (operations.serviceStatus !== "service_ready") {
    return {
      status: operations.serviceStatus ?? "service_disabled",
      installationId,
      allowed: false,
      installation,
      nextAction: operations.serviceStatus === "service_manual_guard"
        ? "This installation stays behind a manual service guard until remaining repo issues are resolved."
        : "Service execution is currently disabled for this installation."
    };
  }

  return {
    status: "service_ready",
    installationId,
    allowed: true,
    installation,
    nextAction: "Installation operations policy allows service-side execution."
  };
}

export function assessGithubAppInstallationServiceAdmin(state, contract, options = {}) {
  const installationId = Number.isFinite(contract?.installationId)
    ? Number(contract.installationId)
    : null;
  const queueState = options.queueState ?? null;

  if (!installationId) {
    return {
      status: "no_installation_context",
      installationId: null,
      allowed: true,
      nextAction: "This contract has no installation context, so installation admin policy does not apply."
    };
  }

  const installation = findInstallationRecord(state, installationId);
  if (!installation) {
    return {
      status: "installation_unregistered",
      installationId,
      allowed: false,
      nextAction: "Persist or refresh the installation registry before manually requeueing installation-scoped contracts."
    };
  }

  const operations = normalizeInstallationOperations(installation);
  if (operations.status !== "operations_governed") {
    return {
      status: "operations_not_governed",
      installationId,
      allowed: false,
      installation,
      nextAction: "Review and apply installation operations policy before manually requeueing this contract."
    };
  }

  let allowed = true;
  let status = "admin_release_allowed";
  let nextAction = "Installation admin policy allows this manual release.";

  if (queueState === "blocked" && !operations.requeueBlockedAllowed) {
    allowed = false;
    status = "blocked_requeue_disallowed";
    nextAction = "This installation does not currently allow manual requeue from blocked state.";
  } else if (queueState === "dead_letter" && !operations.requeueDeadLetterAllowed) {
    allowed = false;
    status = "dead_letter_requeue_disallowed";
    nextAction = "This installation keeps dead-letter contracts behind explicit installation-level review.";
  } else if (queueState === "claimed" && !operations.requeueClaimedAllowed) {
    allowed = false;
    status = "claimed_requeue_disallowed";
    nextAction = "This installation does not allow claimed contracts to be manually released.";
  }

  return {
    status,
    installationId,
    allowed,
    installation,
    nextAction
  };
}

export function buildGithubAppInstallationOperationsPlan(state, options = {}) {
  const installations = Array.isArray(state.installations) ? state.installations : [];
  const selectedInstallations = installations.filter((installation) => {
    if (!Number.isFinite(options.installationId)) {
      return true;
    }
    return installation.installationId === options.installationId;
  });

  const entries = selectedInstallations.map((installation) => {
    const governance = normalizeInstallationGovernance(installation);
    const runtime = normalizeInstallationRuntime(installation);
    const operations = normalizeInstallationOperations(installation);
    const repositories = Array.isArray(installation.repositories) ? installation.repositories : [];
    const runtimeDecisions = repositories.map((repository) => normalizeInstallationScopeDecision(repository, installation, {
      runtimeAware: true
    }));
    const watchlistReadyCount = runtimeDecisions.filter((decision) => decision === "watchlist_candidate").length;
    const runtimeBlockedCount = runtimeDecisions.filter((decision) => decision === "runtime_blocked").length;
    const governanceBlockedCount = runtimeDecisions.filter((decision) => decision === "governance_blocked" || decision === "blocked_repository").length;
    const manualReviewCount = runtimeDecisions.filter((decision) => decision === "manual_review").length;
    const alreadyHandedOffCount = runtimeDecisions.filter((decision) => decision === "already_handed_off").length;

    let suggestedWatchlistSyncStatus = "watchlist_sync_blocked";
    let suggestedServiceStatus = "service_disabled";
    let suggestedRequeueBlockedAllowed = false;
    let suggestedRequeueDeadLetterAllowed = false;
    let suggestedRequeueClaimedAllowed = false;
    let recommendation = "Keep this installation outside unattended app operations until runtime and scope become clearer.";

    if (governance.status === "ungoverned") {
      recommendation = "Persist installation governance first before enabling watchlist sync or service behavior.";
    } else if (runtime.status === "runtime_unset") {
      recommendation = "Persist installation runtime policy first before enabling operational behavior.";
    } else if (runtime.autoWatchlistSync && watchlistReadyCount > 0) {
      suggestedWatchlistSyncStatus = "watchlist_sync_ready";
      recommendation = "Watchlist sync can run for this installation because governed repos are mapped and runtime allows sync.";

      if (runtime.autoServiceEnabled && manualReviewCount === 0 && governanceBlockedCount === 0) {
        suggestedServiceStatus = "service_ready";
        suggestedRequeueBlockedAllowed = true;
        suggestedRequeueDeadLetterAllowed = true;
        recommendation = "This installation is ready for limited unattended app operations and service-side follow-through.";
      } else if (runtime.autoServiceEnabled) {
        suggestedServiceStatus = "service_manual_guard";
        suggestedRequeueBlockedAllowed = true;
        recommendation = "Watchlist sync is allowed, but unattended service flow should stay guarded until manual-review and blocked repos are resolved.";
      }
    } else if (runtime.mode === "watchlist_sync_only" || runtime.mode === "limited_unattended") {
      suggestedWatchlistSyncStatus = "watchlist_sync_manual_release";
      recommendation = "Runtime mode allows broader operations, but watchlist sync is still disabled and needs an explicit release.";
    }

    return {
      installationId: installation.installationId,
      accountLogin: installation.accountLogin ?? null,
      targetType: installation.targetType ?? null,
      repositoryCount: repositories.length,
      governanceStatus: governance.status,
      runtimeStatus: runtime.status,
      runtimeMode: runtime.mode,
      currentOperationsStatus: operations.status,
      currentWatchlistSyncStatus: operations.watchlistSyncStatus,
      currentServiceStatus: operations.serviceStatus,
      suggestedWatchlistSyncStatus,
      suggestedServiceStatus,
      suggestedRequeueBlockedAllowed,
      suggestedRequeueDeadLetterAllowed,
      suggestedRequeueClaimedAllowed,
      watchlistReadyCount,
      runtimeBlockedCount,
      governanceBlockedCount,
      manualReviewCount,
      alreadyHandedOffCount,
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
      ? "Review the installation operations plan and persist it before treating the installation as part of ongoing app runtime behavior."
      : "No installation records match the current operations filter."
  };
}

export function renderGithubAppInstallationOperationsSummary(plan, receipts = []) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => `- installation=${entry.installationId}: runtime=${entry.runtimeStatus}:${entry.runtimeMode} | current_ops=${entry.currentOperationsStatus}:${entry.currentServiceStatus} | suggested_watchlist=${entry.suggestedWatchlistSyncStatus} | suggested_service=${entry.suggestedServiceStatus} | requeue_blocked=${entry.suggestedRequeueBlockedAllowed ? "yes" : "no"} | requeue_dead_letter=${entry.suggestedRequeueDeadLetterAllowed ? "yes" : "no"} | requeue_claimed=${entry.suggestedRequeueClaimedAllowed ? "yes" : "no"} | watchlist_ready=${entry.watchlistReadyCount} | runtime_blocked=${entry.runtimeBlockedCount} | manual_review=${entry.manualReviewCount}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- installation=${receipt.installationId}: status=${receipt.status} | watchlist_sync=${receipt.watchlistSyncStatus} | service=${receipt.serviceStatus} | requeue_blocked=${receipt.requeueBlockedAllowed ? "yes" : "no"} | requeue_dead_letter=${receipt.requeueDeadLetterAllowed ? "yes" : "no"} | requeue_claimed=${receipt.requeueClaimedAllowed ? "yes" : "no"} | notes=${receipt.notes ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Operations

- generated_at: ${plan.generatedAt}
- installation_filter: ${plan.installationId ?? "-"}
- project_filter: ${plan.project ?? "-"}
- installation_count: ${plan.installationCount}

## Operations Entries

${entryLines}

## Operations Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function applyGithubAppInstallationOperationsToState(currentState, plan, options = {}) {
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

    const operations = normalizeInstallationOperations(installation, {
      override: {
        status: "operations_governed",
        watchlistSyncStatus: entry.suggestedWatchlistSyncStatus,
        serviceStatus: entry.suggestedServiceStatus,
        requeueBlockedAllowed: entry.suggestedRequeueBlockedAllowed,
        requeueDeadLetterAllowed: entry.suggestedRequeueDeadLetterAllowed,
        requeueClaimedAllowed: entry.suggestedRequeueClaimedAllowed,
        lastReviewedAt: reviewedAt,
        notes: unique([...(installation.operations?.notes ?? []), options.notes?.trim() || null]),
        history: [
          ...((installation.operations?.history ?? [])),
          {
            at: reviewedAt,
            action: "operations_reviewed",
            watchlistSyncStatus: entry.suggestedWatchlistSyncStatus,
            serviceStatus: entry.suggestedServiceStatus,
            requeueBlockedAllowed: entry.suggestedRequeueBlockedAllowed,
            requeueDeadLetterAllowed: entry.suggestedRequeueDeadLetterAllowed,
            requeueClaimedAllowed: entry.suggestedRequeueClaimedAllowed,
            notes: options.notes?.trim() || null
          }
        ]
      }
    });

    installation.operations = operations;
    receipts.push({
      installationId: installation.installationId,
      status: operations.status,
      watchlistSyncStatus: operations.watchlistSyncStatus,
      serviceStatus: operations.serviceStatus,
      requeueBlockedAllowed: operations.requeueBlockedAllowed,
      requeueDeadLetterAllowed: operations.requeueDeadLetterAllowed,
      requeueClaimedAllowed: operations.requeueClaimedAllowed,
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
