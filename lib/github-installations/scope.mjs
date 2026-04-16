import {
  buildGithubRepoUrl,
  normalizeInstallationScopeDecision,
  unique
} from "./shared.mjs";

export function buildGithubAppInstallationScopePlan(config, state, options = {}) {
  const installations = Array.isArray(state.installations) ? state.installations : [];
  const selectedInstallations = installations.filter((installation) => {
    if (!Number.isFinite(options.installationId)) {
      return true;
    }
    return installation.installationId === options.installationId;
  });

  const entries = [];
  for (const installation of selectedInstallations) {
    for (const repository of installation.repositories ?? []) {
      const decision = normalizeInstallationScopeDecision(repository, installation);
      if (options.project && repository.mappedProjectKey !== options.project) {
        continue;
      }

      entries.push({
        installationId: installation.installationId,
        accountLogin: installation.accountLogin ?? null,
        targetType: installation.targetType ?? null,
        fullName: repository.fullName,
        repoUrl: buildGithubRepoUrl(repository.fullName),
        mappedProjectKey: repository.mappedProjectKey ?? null,
        mappedProjectSource: repository.mappedProjectSource ?? "none",
        visibility: repository.visibility ?? null,
        governanceStatus: installation.governance?.status ?? "ungoverned",
        runtimeStatus: installation.runtime?.status ?? "runtime_unset",
        runtimeMode: installation.runtime?.mode ?? "manual_only",
        decision,
        handoffStatus: repository.handoff?.status ?? null,
        lastHandoffAt: repository.handoff?.at ?? null
      });
    }
  }

  entries.sort((left, right) => {
    return `${left.installationId}:${left.fullName}`.localeCompare(`${right.installationId}:${right.fullName}`);
  });

  const actionableEntries = entries.filter((entry) => entry.decision === "watchlist_candidate");
  const limitedEntries = Number.isFinite(options.limit) && options.limit > 0
    ? actionableEntries.slice(0, Number(options.limit))
    : actionableEntries;

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    installationId: Number.isFinite(options.installationId) ? options.installationId : null,
    project: options.project ?? null,
    installationCount: selectedInstallations.length,
    totalEntries: entries.length,
    watchlistCandidateCount: actionableEntries.length,
    oneOffCandidateCount: entries.filter((entry) => entry.decision === "one_off_candidate").length,
    governanceBlockedCount: entries.filter((entry) => entry.decision === "governance_blocked" || entry.decision === "blocked_repository").length,
    runtimeBlockedCount: entries.filter((entry) => entry.decision === "runtime_blocked").length,
    alreadyHandedOffCount: entries.filter((entry) => entry.decision === "already_handed_off").length,
    manualReviewCount: entries.filter((entry) => entry.decision === "manual_review").length,
    selectedEntries: limitedEntries,
    entries,
    nextAction: limitedEntries.length > 0
      ? "Review the watchlist candidates and hand them off into project watchlists when the mappings look correct."
      : entries.length > 0
        ? "No watchlist candidates are ready; inspect the manual-review entries and refine installation/project mappings."
        : "No installation entries match the current scope filter."
  };
}

export function renderGithubAppInstallationScopeSummary(plan, receipts = []) {
  const entryLines = plan.entries.length > 0
    ? plan.entries.map((entry) => `- installation=${entry.installationId} | repo=${entry.fullName} | decision=${entry.decision} | project=${entry.mappedProjectKey ?? "-"} | governance=${entry.governanceStatus} | runtime=${entry.runtimeStatus}:${entry.runtimeMode} | handoff=${entry.handoffStatus ?? "-"}`).join("\n")
    : "- none";
  const receiptLines = receipts.length > 0
    ? receipts.map((receipt) => `- installation=${receipt.installationId} | project=${receipt.projectKey} | outcome=${receipt.outcome} | appended=${receipt.appended} | kept_existing=${receipt.keptExisting}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Scope

- generated_at: ${plan.generatedAt}
- installation_filter: ${plan.installationId ?? "-"}
- project_filter: ${plan.project ?? "-"}
- installation_count: ${plan.installationCount}
- total_entries: ${plan.totalEntries}
- watchlist_candidate_count: ${plan.watchlistCandidateCount}
- one_off_candidate_count: ${plan.oneOffCandidateCount ?? 0}
- governance_blocked_count: ${plan.governanceBlockedCount ?? 0}
- runtime_blocked_count: ${plan.runtimeBlockedCount ?? 0}
- already_handed_off_count: ${plan.alreadyHandedOffCount ?? 0}
- manual_review_count: ${plan.manualReviewCount}
- selected_count: ${plan.selectedEntries.length}

## Installation Entries

${entryLines}

## Handoff Receipts

${receiptLines}

## Next Action

- ${plan.nextAction}
`;
}

export async function applyGithubAppInstallationScopeHandoff(rootDir, config, currentState, plan, options = {}) {
  const installations = Array.isArray(currentState.installations)
    ? structuredClone(currentState.installations)
    : [];
  const receipts = [];
  const groupedByProject = new Map();

  for (const entry of plan.selectedEntries) {
    if (!entry.repoUrl || !entry.mappedProjectKey) {
      continue;
    }
    const urls = groupedByProject.get(entry.mappedProjectKey) ?? [];
    urls.push(entry.repoUrl);
    groupedByProject.set(entry.mappedProjectKey, urls);
  }

  for (const [projectKey, urls] of groupedByProject.entries()) {
    const project = config.projects?.[projectKey];
    if (!project) {
      receipts.push({
        installationId: null,
        projectKey,
        outcome: "skipped_missing_project",
        appended: 0,
        keptExisting: urls.length
      });
      continue;
    }

    const result = await options.appendUrlsToWatchlist(rootDir, project, urls, options.dryRun);
    const installationIds = unique(
      plan.selectedEntries
        .filter((entry) => entry.mappedProjectKey === projectKey)
        .map((entry) => entry.installationId)
    );

    receipts.push({
      installationId: installationIds.length === 1 ? installationIds[0] : null,
      installationIds,
      projectKey,
      outcome: result.status,
      appended: result.appended,
      keptExisting: result.keptExisting
    });

    for (const installation of installations) {
      if (!installationIds.includes(installation.installationId)) {
        continue;
      }
      installation.repositories = (installation.repositories ?? []).map((repo) => {
        const repoUrl = buildGithubRepoUrl(repo.fullName);
        if (!urls.includes(repoUrl)) {
          return repo;
        }
        return {
          ...repo,
          handoff: {
            status: result.status,
            target: "watchlist",
            projectKey,
            at: options.at ?? new Date().toISOString(),
            notes: options.notes?.trim() || null
          }
        };
      });
    }
  }

  return {
    receipts,
    nextState: {
      schemaVersion: 1,
      updatedAt: options.at ?? new Date().toISOString(),
      installations
    }
  };
}
