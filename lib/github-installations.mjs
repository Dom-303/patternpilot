import fs from "node:fs/promises";
import path from "node:path";

const INSTALLATION_STATE_FILE = path.join("state", "github-app-installations.json");

function normalizeRepositoryEntry(repo = {}, config, options = {}) {
  const owner = repo?.owner?.login ?? repo?.owner?.name ?? null;
  const name = repo?.name ?? null;
  const fullName = repo?.full_name ?? (owner && name ? `${owner}/${name}` : null);
  const mappedProject = resolveProjectKeyForInstallationRepository(config, fullName, options.project);

  return {
    id: repo?.id ?? null,
    owner,
    name,
    fullName,
    defaultBranch: repo?.default_branch ?? null,
    visibility: repo?.visibility ?? null,
    private: repo?.private ?? null,
    mappedProjectKey: mappedProject?.projectKey ?? null,
    mappedProjectSource: mappedProject?.source ?? "none"
  };
}

function extractInstallationRepositories(payload = {}, config, options = {}) {
  const repositories = [];
  const seen = new Set();
  const rawRepositories = Array.isArray(payload.repositories) ? payload.repositories : [];
  const singletonRepository = payload.repository ? [payload.repository] : [];

  for (const repo of [...rawRepositories, ...singletonRepository]) {
    const normalized = normalizeRepositoryEntry(repo, config, options);
    if (!normalized.fullName || seen.has(normalized.fullName)) {
      continue;
    }
    seen.add(normalized.fullName);
    repositories.push(normalized);
  }

  repositories.sort((left, right) => String(left.fullName).localeCompare(String(right.fullName)));
  return repositories;
}

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function normalizeInstallationGovernance(record = {}, options = {}) {
  const existing = record.governance ?? {};
  return {
    status: existing.status ?? "ungoverned",
    allowedProjects: unique(existing.allowedProjects ?? []),
    blockedRepositories: unique(existing.blockedRepositories ?? []),
    defaultMappedAction: existing.defaultMappedAction ?? "watchlist_candidate",
    defaultUnmappedAction: existing.defaultUnmappedAction ?? "manual_review",
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

function normalizeInstallationRuntime(record = {}, options = {}) {
  const existing = record.runtime ?? {};
  return {
    status: existing.status ?? "runtime_unset",
    mode: existing.mode ?? "manual_only",
    autoWatchlistSync: existing.autoWatchlistSync ?? false,
    autoServiceEnabled: existing.autoServiceEnabled ?? false,
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

function normalizeInstallationOperations(record = {}, options = {}) {
  const existing = record.operations ?? {};
  return {
    status: existing.status ?? "operations_unset",
    watchlistSyncStatus: existing.watchlistSyncStatus ?? "watchlist_sync_blocked",
    serviceStatus: existing.serviceStatus ?? "service_disabled",
    requeueBlockedAllowed: existing.requeueBlockedAllowed ?? false,
    requeueDeadLetterAllowed: existing.requeueDeadLetterAllowed ?? false,
    requeueClaimedAllowed: existing.requeueClaimedAllowed ?? false,
    lastReviewedAt: existing.lastReviewedAt ?? null,
    notes: unique(existing.notes ?? []),
    history: Array.isArray(existing.history) ? existing.history : [],
    ...options.override
  };
}

export function getGithubAppInstallationStatePath(rootDir) {
  return path.join(rootDir, INSTALLATION_STATE_FILE);
}

export async function loadGithubAppInstallationState(rootDir) {
  const statePath = getGithubAppInstallationStatePath(rootDir);
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      updatedAt: parsed.updatedAt ?? null,
      installations: Array.isArray(parsed.installations) ? parsed.installations : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        updatedAt: null,
        installations: []
      };
    }
    throw error;
  }
}

export async function writeGithubAppInstallationState(rootDir, state, options = {}) {
  const statePath = getGithubAppInstallationStatePath(rootDir);
  if (options.dryRun) {
    return statePath;
  }
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return statePath;
}

export function resolveProjectKeyForInstallationRepository(config, fullName, preferredProjectKey = null) {
  const projects = config.projects ?? {};

  if (preferredProjectKey && projects[preferredProjectKey]) {
    return {
      projectKey: preferredProjectKey,
      source: "explicit"
    };
  }

  const repoName = fullName ? String(fullName).split("/").pop() : null;
  if (!repoName) {
    return null;
  }

  for (const [projectKey, project] of Object.entries(projects)) {
    if (projectKey === repoName || path.basename(project.projectRoot ?? "") === repoName) {
      return {
        projectKey,
        source: "repository_match"
      };
    }
  }

  return null;
}

export function buildGithubAppInstallationPacket(config, envelope, options = {}) {
  const repositories = extractInstallationRepositories(envelope.payload ?? {}, config, options);
  const installation = envelope.installation ?? null;
  const mappedProjects = unique(repositories.map((repo) => repo.mappedProjectKey));
  const eventKey = envelope.patternpilotEventKey ?? "unknown_event";

  let packetStatus = "blocked_missing_installation";
  let nextAction = "This event does not carry a GitHub App installation reference yet.";

  if (installation?.id) {
    if (mappedProjects.length === 1) {
      packetStatus = "single_project_candidate";
      nextAction = "One project mapping looks plausible; review and then persist the installation packet into local state.";
    } else if (mappedProjects.length > 1) {
      packetStatus = "multi_project_review";
      nextAction = "Multiple project bindings are plausible; keep this installation under explicit review before applying it.";
    } else if (repositories.length > 0) {
      packetStatus = "unmapped_installation";
      nextAction = "Repositories were detected, but none map cleanly onto an existing Patternpilot project binding yet.";
    } else {
      packetStatus = "empty_installation_packet";
      nextAction = "Installation exists, but no repository context was attached to this event.";
    }
  }

  return {
    schemaVersion: 1,
    generatedAt: options.generatedAt ?? envelope.generatedAt ?? new Date().toISOString(),
    deliveryId: envelope.deliveryId ?? null,
    eventKey,
    installation,
    repositories,
    mappedProjects,
    repositoryCount: repositories.length,
    packetStatus,
    nextAction
  };
}

function mergeInstallationRepositories(existingRepositories = [], incomingRepositories = [], updatedAt) {
  const byFullName = new Map();

  for (const repo of existingRepositories) {
    if (!repo?.fullName) {
      continue;
    }
    byFullName.set(repo.fullName, { ...repo });
  }

  for (const repo of incomingRepositories) {
    if (!repo?.fullName) {
      continue;
    }
    const previous = byFullName.get(repo.fullName) ?? {};
    byFullName.set(repo.fullName, {
      ...previous,
      ...repo,
      firstSeenAt: previous.firstSeenAt ?? updatedAt,
      lastSeenAt: updatedAt
    });
  }

  return [...byFullName.values()].sort((left, right) => String(left.fullName).localeCompare(String(right.fullName)));
}

export function applyGithubAppInstallationPacketToState(currentState, packet, options = {}) {
  const updatedAt = options.updatedAt ?? packet.generatedAt ?? new Date().toISOString();
  const installations = Array.isArray(currentState.installations)
    ? [...currentState.installations]
    : [];
  const existingIndex = installations.findIndex((item) => item.installationId === packet.installation?.id);
  const existing = existingIndex >= 0
    ? installations[existingIndex]
    : null;
  const mergedRepositories = mergeInstallationRepositories(existing?.repositories ?? [], packet.repositories ?? [], updatedAt);
  const mappedProjects = unique([
    ...(existing?.mappedProjects ?? []),
    ...(packet.mappedProjects ?? []),
    ...(mergedRepositories.map((repo) => repo.mappedProjectKey))
  ]);
  const sourceEvents = unique([...(existing?.sourceEvents ?? []), packet.eventKey]);
  const events = [
    ...(Array.isArray(existing?.events) ? existing.events : []),
    {
      at: updatedAt,
      deliveryId: packet.deliveryId ?? null,
      eventKey: packet.eventKey,
      repositoryCount: packet.repositoryCount
    }
  ].slice(-20);

  const installationRecord = {
    installationId: packet.installation?.id ?? null,
    accountLogin: packet.installation?.accountLogin ?? null,
    targetType: packet.installation?.targetType ?? null,
    packetStatus: packet.packetStatus,
    firstSeenAt: existing?.firstSeenAt ?? updatedAt,
    lastSeenAt: updatedAt,
    sourceEvents,
    mappedProjects,
    repositories: mergedRepositories,
    lastDeliveryId: packet.deliveryId ?? null,
    events
  };

  if (existingIndex >= 0) {
    installations[existingIndex] = installationRecord;
  } else {
    installations.push(installationRecord);
  }
  installations.sort((left, right) => Number(left.installationId ?? 0) - Number(right.installationId ?? 0));

  return {
    schemaVersion: 1,
    updatedAt,
    installations
  };
}

export function buildGithubAppInstallationStateSummary(state, options = {}) {
  const installations = Array.isArray(state.installations) ? state.installations : [];
  const installationLines = installations.length > 0
    ? installations.map((item) => `- installation=${item.installationId}: account=${item.accountLogin ?? "-"} | target_type=${item.targetType ?? "-"} | repos=${item.repositories?.length ?? 0} | mapped_projects=${(item.mappedProjects ?? []).join(", ") || "-"} | governance=${item.governance?.status ?? "ungoverned"} | runtime=${item.runtime?.status ?? "runtime_unset"}:${item.runtime?.mode ?? "manual_only"} | operations=${item.operations?.status ?? "operations_unset"}:${item.operations?.serviceStatus ?? "service_disabled"} | last_status=${item.packetStatus ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation State

- generated_at: ${options.generatedAt ?? new Date().toISOString()}
- installation_count: ${installations.length}
- state_updated_at: ${state.updatedAt ?? "-"}

## Installations

${installationLines}
`;
}

function findInstallationRecord(state, installationId) {
  const installations = Array.isArray(state?.installations) ? state.installations : [];
  if (!Number.isFinite(installationId)) {
    return null;
  }
  return installations.find((item) => item.installationId === installationId) ?? null;
}

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

export function renderGithubAppInstallationPacketSummary(packet, options = {}) {
  const repositoryLines = packet.repositories.length > 0
    ? packet.repositories.map((repo) => `- ${repo.fullName}: mapped_project=${repo.mappedProjectKey ?? "-"} | source=${repo.mappedProjectSource ?? "none"} | visibility=${repo.visibility ?? "-"} | default_branch=${repo.defaultBranch ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation Packet

- generated_at: ${packet.generatedAt}
- event_key: ${packet.eventKey}
- delivery_id: ${packet.deliveryId ?? "-"}
- installation_id: ${packet.installation?.id ?? "-"}
- account_login: ${packet.installation?.accountLogin ?? "-"}
- target_type: ${packet.installation?.targetType ?? "-"}
- packet_status: ${packet.packetStatus}
- repository_count: ${packet.repositoryCount}
- mapped_projects: ${packet.mappedProjects.join(", ") || "-"}
- apply_mode: ${options.apply ? "apply" : "review"}

## Repositories

${repositoryLines}

## Next Action

- ${packet.nextAction}
`;
}

export async function writeGithubAppInstallationArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-installations", options.runId);
  const packetPath = path.join(integrationRoot, "installation-packet.json");
  const statePath = path.join(integrationRoot, "installation-state.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      packetPath,
      statePath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(packetPath, `${JSON.stringify(options.packet, null, 2)}\n`, "utf8");
  await fs.writeFile(statePath, `${JSON.stringify(options.state, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    packetPath,
    statePath,
    summaryPath
  };
}

function buildGithubRepoUrl(fullName) {
  return fullName ? `https://github.com/${fullName}` : null;
}

function normalizeInstallationScopeDecision(repository, installation, options = {}) {
  const governance = normalizeInstallationGovernance(installation);
  const runtime = normalizeInstallationRuntime(installation);
  const handoffStatus = repository.handoff?.status ?? null;
  const runtimeEnforced = options.runtimeAware !== false && runtime.status !== "runtime_unset";

  if (handoffStatus === "appended_urls" || handoffStatus === "no_changes") {
    return "already_handed_off";
  }

  if (governance.blockedRepositories.includes(repository.fullName)) {
    return "blocked_repository";
  }

  if (repository.mappedProjectKey) {
    if (governance.allowedProjects.length > 0 && !governance.allowedProjects.includes(repository.mappedProjectKey)) {
      return "governance_blocked";
    }
    if (runtimeEnforced && (runtime.mode === "manual_only" || runtime.autoWatchlistSync !== true)) {
      return "runtime_blocked";
    }
    return governance.defaultMappedAction ?? "watchlist_candidate";
  }
  return governance.defaultUnmappedAction ?? "manual_review";
}

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
        recommendation = "This installation is ready for limited unattended app operations and service-side follow-through.";
      } else if (runtime.autoServiceEnabled) {
        suggestedServiceStatus = "service_manual_guard";
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

export async function writeGithubAppInstallationScopeArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-installation-scope", options.runId);
  const planPath = path.join(integrationRoot, "scope-plan.json");
  const receiptsPath = path.join(integrationRoot, "scope-receipts.json");
  const statePath = path.join(integrationRoot, "scope-state.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      planPath,
      receiptsPath,
      statePath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(planPath, `${JSON.stringify(options.plan, null, 2)}\n`, "utf8");
  await fs.writeFile(receiptsPath, `${JSON.stringify(options.receipts ?? [], null, 2)}\n`, "utf8");
  await fs.writeFile(statePath, `${JSON.stringify(options.state, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    planPath,
    receiptsPath,
    statePath,
    summaryPath
  };
}

export async function writeGithubAppInstallationRuntimeArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-installation-runtime", options.runId);
  const planPath = path.join(integrationRoot, "runtime-plan.json");
  const receiptsPath = path.join(integrationRoot, "runtime-receipts.json");
  const statePath = path.join(integrationRoot, "runtime-state.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      planPath,
      receiptsPath,
      statePath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(planPath, `${JSON.stringify(options.plan, null, 2)}\n`, "utf8");
  await fs.writeFile(receiptsPath, `${JSON.stringify(options.receipts ?? [], null, 2)}\n`, "utf8");
  await fs.writeFile(statePath, `${JSON.stringify(options.state, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    planPath,
    receiptsPath,
    statePath,
    summaryPath
  };
}

export async function writeGithubAppInstallationOperationsArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-installation-operations", options.runId);
  const planPath = path.join(integrationRoot, "operations-plan.json");
  const receiptsPath = path.join(integrationRoot, "operations-receipts.json");
  const statePath = path.join(integrationRoot, "operations-state.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      planPath,
      receiptsPath,
      statePath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(planPath, `${JSON.stringify(options.plan, null, 2)}\n`, "utf8");
  await fs.writeFile(receiptsPath, `${JSON.stringify(options.receipts ?? [], null, 2)}\n`, "utf8");
  await fs.writeFile(statePath, `${JSON.stringify(options.state, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    planPath,
    receiptsPath,
    statePath,
    summaryPath
  };
}
