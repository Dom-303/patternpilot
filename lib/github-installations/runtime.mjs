import {
  normalizeInstallationGovernance,
  normalizeInstallationRuntime,
  normalizeInstallationScopeDecision,
  unique
} from "./shared.mjs";

export function buildGithubAppInstallationRuntimePlan(state, options = {}) {
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
    const repositories = Array.isArray(installation.repositories) ? installation.repositories : [];
    const rawDecisions = repositories.map((repository) => normalizeInstallationScopeDecision(repository, installation, {
      runtimeAware: false
    }));
    const watchlistCandidateCount = rawDecisions.filter((decision) => decision === "watchlist_candidate").length;
    const oneOffCandidateCount = rawDecisions.filter((decision) => decision === "one_off_candidate").length;
    const manualReviewCount = rawDecisions.filter((decision) => decision === "manual_review").length;
    const governanceBlockedCount = rawDecisions.filter((decision) => decision === "governance_blocked" || decision === "blocked_repository").length;
    const alreadyHandedOffCount = rawDecisions.filter((decision) => decision === "already_handed_off").length;

    let suggestedMode = "manual_only";
    let suggestedAutoWatchlistSync = false;
    let suggestedAutoServiceEnabled = false;
    let suggestedRequeueBlockedAllowed = false;
    let suggestedRequeueDeadLetterAllowed = false;
    let suggestedRequeueClaimedAllowed = false;
    let recommendation = "Keep this installation in manual mode until the repo/project bindings are clearer.";

    if (governance.status === "ungoverned") {
      recommendation = "Persist installation governance first before allowing any runtime or watchlist behavior.";
    } else if (watchlistCandidateCount === 0 && alreadyHandedOffCount === 0) {
      recommendation = "No governed watchlist-ready repos are available yet, so runtime should stay manual.";
    } else if (manualReviewCount > 0 || governanceBlockedCount > 0) {
      suggestedMode = "watchlist_sync_only";
      suggestedAutoWatchlistSync = true;
      suggestedRequeueBlockedAllowed = true;
      recommendation = "Allow governed watchlist sync, but keep the installation out of unattended service mode while manual-review or blocked repos remain.";
    } else {
      suggestedMode = "limited_unattended";
      suggestedAutoWatchlistSync = true;
      suggestedAutoServiceEnabled = true;
      suggestedRequeueBlockedAllowed = true;
      suggestedRequeueDeadLetterAllowed = true;
      recommendation = "This installation can move into limited unattended mode because the governed repo set is cleanly mapped and watchlist-ready.";
    }

    return {
      installationId: installation.installationId,
      accountLogin: installation.accountLogin ?? null,
      targetType: installation.targetType ?? null,
      repositoryCount: repositories.length,
      governanceStatus: governance.status,
      mappedProjects: unique(installation.mappedProjects ?? []),
      currentStatus: runtime.status,
      currentMode: runtime.mode,
      currentAutoWatchlistSync: runtime.autoWatchlistSync,
      currentAutoServiceEnabled: runtime.autoServiceEnabled,
      suggestedMode,
      suggestedAutoWatchlistSync,
      suggestedAutoServiceEnabled,
      suggestedRequeueBlockedAllowed,
      suggestedRequeueDeadLetterAllowed,
      suggestedRequeueClaimedAllowed,
      watchlistCandidateCount,
      oneOffCandidateCount,
      manualReviewCount,
      governanceBlockedCount,
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
      ? "Review the suggested runtime mode and persist it before treating this installation as part of ongoing app operations."
      : "No installation records match the current runtime filter."
  };
}

export function renderGithubAppInstallationRuntimeSummary(plan, receipts = []) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => `- installation=${entry.installationId}: governance=${entry.governanceStatus} | current=${entry.currentStatus}:${entry.currentMode} | suggested=${entry.suggestedMode} | watchlist_candidates=${entry.watchlistCandidateCount} | manual_review=${entry.manualReviewCount} | blocked=${entry.governanceBlockedCount} | handed_off=${entry.alreadyHandedOffCount}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- installation=${receipt.installationId}: status=${receipt.status} | mode=${receipt.mode} | auto_watchlist_sync=${receipt.autoWatchlistSync ? "yes" : "no"} | auto_service=${receipt.autoServiceEnabled ? "yes" : "no"} | notes=${receipt.notes ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Runtime

- generated_at: ${plan.generatedAt}
- installation_filter: ${plan.installationId ?? "-"}
- project_filter: ${plan.project ?? "-"}
- installation_count: ${plan.installationCount}

## Runtime Entries

${entryLines}

## Runtime Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function applyGithubAppInstallationRuntimeToState(currentState, plan, options = {}) {
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

    const runtime = normalizeInstallationRuntime(installation, {
      override: {
        status: "runtime_governed",
        mode: entry.suggestedMode,
        autoWatchlistSync: entry.suggestedAutoWatchlistSync,
        autoServiceEnabled: entry.suggestedAutoServiceEnabled,
        lastReviewedAt: reviewedAt,
        notes: unique([...(installation.runtime?.notes ?? []), options.notes?.trim() || null]),
        history: [
          ...((installation.runtime?.history ?? [])),
          {
            at: reviewedAt,
            action: "runtime_reviewed",
            mode: entry.suggestedMode,
            autoWatchlistSync: entry.suggestedAutoWatchlistSync,
            autoServiceEnabled: entry.suggestedAutoServiceEnabled,
            notes: options.notes?.trim() || null
          }
        ]
      }
    });

    installation.runtime = runtime;
    receipts.push({
      installationId: installation.installationId,
      status: runtime.status,
      mode: runtime.mode,
      autoWatchlistSync: runtime.autoWatchlistSync,
      autoServiceEnabled: runtime.autoServiceEnabled,
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
