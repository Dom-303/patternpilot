import { resolveProjectKeyForInstallationRepository } from "./state.mjs";
import { unique } from "./shared.mjs";

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
    ? installations.map((item) => `- installation=${item.installationId}: account=${item.accountLogin ?? "-"} | target_type=${item.targetType ?? "-"} | repos=${item.repositories?.length ?? 0} | mapped_projects=${(item.mappedProjects ?? []).join(", ") || "-"} | governance=${item.governance?.status ?? "ungoverned"} | runtime=${item.runtime?.status ?? "runtime_unset"}:${item.runtime?.mode ?? "manual_only"} | operations=${item.operations?.status ?? "operations_unset"}:${item.operations?.serviceStatus ?? "service_disabled"} | lane=${item.serviceLane?.status ?? "lane_unset"}:${item.serviceLane?.laneMode ?? "manual_lane"}/${item.serviceLane?.tickDisposition ?? "manual_only"} | plan=${item.servicePlan?.status ?? "schedule_unset"}:${item.servicePlan?.priority ?? "normal"}/budget=${item.servicePlan?.tickBudget ?? 1} | routing=${item.workerRouting?.status ?? "routing_unset"}:${item.workerRouting?.schedulerLane ?? "shared_default"}/${item.workerRouting?.workerMode ?? "any_worker"}${item.workerRouting?.assignedWorkerId ? `:${item.workerRouting.assignedWorkerId}` : ""} | last_status=${item.packetStatus ?? "-"}`).join("\n")
    : "- none";

  return `# Patternpilot GitHub App Installation State

- generated_at: ${options.generatedAt ?? new Date().toISOString()}
- installation_count: ${installations.length}
- state_updated_at: ${state.updatedAt ?? "-"}

## Installations

${installationLines}
`;
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
