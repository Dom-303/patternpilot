import {
  normalizeInstallationGovernance,
  unique
} from "./shared.mjs";

export function buildGithubAppInstallationGovernancePlan(state, options = {}) {
  const installations = Array.isArray(state.installations) ? state.installations : [];
  const selectedInstallations = installations.filter((installation) => {
    if (!Number.isFinite(options.installationId)) {
      return true;
    }
    return installation.installationId === options.installationId;
  });

  const entries = selectedInstallations.map((installation) => {
    const governance = normalizeInstallationGovernance(installation);
    const suggestedAllowedProjects = options.project
      ? [options.project]
      : unique(installation.mappedProjects ?? []);

    return {
      installationId: installation.installationId,
      accountLogin: installation.accountLogin ?? null,
      targetType: installation.targetType ?? null,
      repositoryCount: Array.isArray(installation.repositories) ? installation.repositories.length : 0,
      mappedProjects: unique(installation.mappedProjects ?? []),
      currentAllowedProjects: governance.allowedProjects,
      suggestedAllowedProjects,
      currentStatus: governance.status,
      defaultMappedAction: governance.defaultMappedAction,
      defaultUnmappedAction: governance.defaultUnmappedAction,
      blockedRepositoryCount: governance.blockedRepositories.length
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
      ? "Review the suggested allowed projects and then persist installation governance before further multi-repo handoffs."
      : "No installation records match the current governance filter."
  };
}

export function renderGithubAppInstallationGovernanceSummary(plan, receipts = []) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => `- installation=${entry.installationId}: current_status=${entry.currentStatus} | mapped_projects=${entry.mappedProjects.join(", ") || "-"} | current_allowed=${entry.currentAllowedProjects.join(", ") || "-"} | suggested_allowed=${entry.suggestedAllowedProjects.join(", ") || "-"} | repos=${entry.repositoryCount}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- installation=${receipt.installationId}: status=${receipt.status} | allowed_projects=${receipt.allowedProjects.join(", ") || "-"} | notes=${receipt.notes ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Governance

- generated_at: ${plan.generatedAt}
- installation_filter: ${plan.installationId ?? "-"}
- project_filter: ${plan.project ?? "-"}
- installation_count: ${plan.installationCount}

## Governance Entries

${entryLines}

## Governance Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export function applyGithubAppInstallationGovernanceToState(currentState, plan, options = {}) {
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

    const governance = normalizeInstallationGovernance(installation, {
      override: {
        status: "watchlist_governed",
        allowedProjects: entry.suggestedAllowedProjects,
        defaultMappedAction: "watchlist_candidate",
        defaultUnmappedAction: "manual_review",
        lastReviewedAt: reviewedAt,
        notes: unique([...(installation.governance?.notes ?? []), options.notes?.trim() || null]),
        history: [
          ...((installation.governance?.history ?? [])),
          {
            at: reviewedAt,
            action: "governance_reviewed",
            allowedProjects: entry.suggestedAllowedProjects,
            notes: options.notes?.trim() || null
          }
        ]
      }
    });

    installation.governance = governance;
    receipts.push({
      installationId: installation.installationId,
      status: governance.status,
      allowedProjects: governance.allowedProjects,
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
