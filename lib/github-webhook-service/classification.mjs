import path from "node:path";

import {
  assessGithubAppInstallationOperations,
  assessGithubAppInstallationServiceLane,
  assessGithubAppInstallationServicePlan,
  assessGithubAppInstallationServiceSchedule,
  assessGithubAppInstallationWorkerRouting
} from "../github-installations.mjs";
import { evaluateGithubWebhookRecoveryContract } from "../github-webhook-runner.mjs";
import {
  SERVICE_QUEUE_DIR,
  normalizeGithubWebhookQueueStateLabel
} from "./shared.mjs";

function rootDirFromEntry(entry) {
  const marker = `${path.sep}${SERVICE_QUEUE_DIR}${path.sep}`;
  const index = entry.contractPath.indexOf(marker);
  return index === -1 ? process.cwd() : entry.contractPath.slice(0, index);
}

function matchesGithubWebhookServiceEntryFilter(entry, options = {}) {
  const fromStatus = normalizeGithubWebhookQueueStateLabel(options.fromStatus);
  const fileFilter = options.file
    ? path.basename(options.file)
    : null;
  const entryRelativePath = path.relative(rootDirFromEntry(entry), entry.contractPath);

  const stateMatches = !fromStatus || fromStatus === "problematic"
    ? entry.queueState === "blocked" || entry.queueState === "dead_letter"
    : fromStatus === "all"
      ? true
      : entry.queueState === fromStatus;
  const projectMatches = !options.project || entry.contract?.selectedProjectKey === options.project;
  const fileMatches = !fileFilter
    ? true
    : entry.fileName === fileFilter || entry.contractPath === options.file || entryRelativePath.endsWith(fileFilter);

  return stateMatches && projectMatches && fileMatches;
}

export function selectGithubWebhookServiceQueueEntries(queueEntries = [], options = {}) {
  const selected = queueEntries.filter((entry) => matchesGithubWebhookServiceEntryFilter(entry, options));
  const limit = Number.isFinite(options.limit) && options.limit > 0 ? Number(options.limit) : null;
  const limited = limit ? selected.slice(0, limit) : selected;

  return {
    filter: {
      fromStatus: normalizeGithubWebhookQueueStateLabel(options.fromStatus) ?? "problematic",
      project: options.project ?? null,
      file: options.file ?? null,
      limit
    },
    totalMatches: selected.length,
    selectedEntries: limited
  };
}

export function classifyGithubWebhookServiceQueueEntry(entry, options = {}) {
  const contract = entry.contract ?? {};
  const kind = contract.contractKind ?? "unknown";
  const installationAssessment = assessGithubAppInstallationOperations(options.installationState, contract, options);
  const laneAssessment = assessGithubAppInstallationServiceLane(options.installationState, contract, options);
  const planAssessment = assessGithubAppInstallationServicePlan(options.installationState, contract, options);
  const routingAssessment = assessGithubAppInstallationWorkerRouting(options.installationState, contract, options);
  const scheduleAssessment = assessGithubAppInstallationServiceSchedule(options.installationState, contract, options);
  const base = {
    fileName: entry.fileName,
    contractPath: entry.contractPath,
    queueState: entry.queueState ?? "pending",
    contractKind: kind,
    contractStatus: contract.contractStatus ?? "unknown",
    deliveryId: contract.deliveryId ?? null,
    eventKey: contract.eventKey ?? null,
    selectedProjectKey: contract.selectedProjectKey ?? null,
    installationId: contract.installationId ?? null,
    installationStatus: installationAssessment.status,
    installationLaneStatus: laneAssessment.status,
    installationLaneMode: laneAssessment.laneMode,
    tickDisposition: laneAssessment.tickDisposition,
    maxConcurrentClaims: laneAssessment.maxConcurrentClaims,
    installationPlanStatus: planAssessment.status,
    installationPlanPriority: planAssessment.priority,
    installationPlanTickBudget: planAssessment.tickBudget,
    contractPreferenceRank: planAssessment.contractPreferenceRank,
    installationRoutingStatus: routingAssessment.status,
    schedulerLane: routingAssessment.schedulerLane,
    workerMode: routingAssessment.workerMode,
    assignedWorkerId: routingAssessment.assignedWorkerId,
    installationScheduleStatus: scheduleAssessment.status,
    installationScheduleLaneKey: scheduleAssessment.laneKey,
    tickStrategy: scheduleAssessment.tickStrategy,
    maxTicksPerCycle: scheduleAssessment.maxTicksPerCycle,
    serviceLease: contract.serviceLease ?? null,
    serviceState: contract.serviceState ?? null
  };

  if (base.queueState === "claimed") {
    return {
      ...base,
      action: "lease_held",
      actionable: false,
      blocked: true,
      nextAction: "This contract is already claimed by another worker lease."
    };
  }

  if (base.queueState === "dead_letter") {
    return {
      ...base,
      action: "dead_letter",
      actionable: false,
      blocked: true,
      nextAction: contract.nextAction ?? "This contract moved to dead-letter after repeated failures or a terminal conflict."
    };
  }

  if (base.queueState === "blocked") {
    return {
      ...base,
      action: "blocked_contract",
      actionable: false,
      blocked: true,
      nextAction: contract.nextAction ?? "This contract is currently blocked and needs manual review or later recovery."
    };
  }

  if (kind === "execution_contract") {
    if (contract.contractStatus === "dispatch_ready" || contract.contractStatus === "dispatch_ready_dry_run" || contract.contractStatus === "dispatch_ready_contract_only") {
      if (!installationAssessment.allowed) {
        return {
          ...base,
          action: "installation_blocked",
          actionable: false,
          blocked: true,
          nextAction: installationAssessment.nextAction
        };
      }
      if (!laneAssessment.allowed) {
        return {
          ...base,
          action: "installation_lane_blocked",
          actionable: false,
          blocked: true,
          nextAction: laneAssessment.nextAction
        };
      }
      if (!planAssessment.allowed) {
        return {
          ...base,
          action: "installation_plan_blocked",
          actionable: false,
          blocked: true,
          nextAction: planAssessment.nextAction
        };
      }
      if (!routingAssessment.allowed) {
        return {
          ...base,
          action: "installation_worker_blocked",
          actionable: false,
          blocked: true,
          nextAction: routingAssessment.nextAction
        };
      }
      if (!scheduleAssessment.allowed) {
        return {
          ...base,
          action: "installation_schedule_blocked",
          actionable: false,
          blocked: true,
          nextAction: scheduleAssessment.nextAction
        };
      }
      return {
        ...base,
        action: "run_execution",
        actionable: true,
        blocked: false,
        nextAction: "Consume this execution contract via the runner."
      };
    }
    return {
      ...base,
      action: "manual_review",
      actionable: false,
      blocked: true,
      nextAction: contract.nextAction ?? "Execution contract is not ready for the runner."
    };
  }

  if (kind === "resume_contract") {
    if (contract.contractStatus === "dispatch_ready_resume_contract") {
      if (!installationAssessment.allowed) {
        return {
          ...base,
          action: "installation_blocked",
          actionable: false,
          blocked: true,
          nextAction: installationAssessment.nextAction
        };
      }
      if (!laneAssessment.allowed) {
        return {
          ...base,
          action: "installation_lane_blocked",
          actionable: false,
          blocked: true,
          nextAction: laneAssessment.nextAction
        };
      }
      if (!planAssessment.allowed) {
        return {
          ...base,
          action: "installation_plan_blocked",
          actionable: false,
          blocked: true,
          nextAction: planAssessment.nextAction
        };
      }
      if (!routingAssessment.allowed) {
        return {
          ...base,
          action: "installation_worker_blocked",
          actionable: false,
          blocked: true,
          nextAction: routingAssessment.nextAction
        };
      }
      if (!scheduleAssessment.allowed) {
        return {
          ...base,
          action: "installation_schedule_blocked",
          actionable: false,
          blocked: true,
          nextAction: scheduleAssessment.nextAction
        };
      }
      return {
        ...base,
        action: "run_resume",
        actionable: true,
        blocked: false,
        nextAction: "Resume the interrupted runner flow."
      };
    }
    return {
      ...base,
      action: "manual_review",
      actionable: false,
      blocked: true,
      nextAction: contract.nextAction ?? "Resume contract is not ready."
    };
  }

  if (kind === "recovery_contract") {
    const recoveryEvaluation = evaluateGithubWebhookRecoveryContract(contract, {
      now: options.now
    });
    if (recoveryEvaluation.effectiveStatus === "dispatch_ready_recovery_contract") {
      if (!installationAssessment.allowed) {
        return {
          ...base,
          contractStatus: recoveryEvaluation.effectiveStatus,
          action: "installation_blocked",
          actionable: false,
          blocked: true,
          blockedUntil: recoveryEvaluation.blockedUntil,
          nextAction: installationAssessment.nextAction
        };
      }
      if (!laneAssessment.allowed) {
        return {
          ...base,
          contractStatus: recoveryEvaluation.effectiveStatus,
          action: "installation_lane_blocked",
          actionable: false,
          blocked: true,
          blockedUntil: recoveryEvaluation.blockedUntil,
          nextAction: laneAssessment.nextAction
        };
      }
      if (!planAssessment.allowed) {
        return {
          ...base,
          contractStatus: recoveryEvaluation.effectiveStatus,
          action: "installation_plan_blocked",
          actionable: false,
          blocked: true,
          blockedUntil: recoveryEvaluation.blockedUntil,
          nextAction: planAssessment.nextAction
        };
      }
      if (!routingAssessment.allowed) {
        return {
          ...base,
          contractStatus: recoveryEvaluation.effectiveStatus,
          action: "installation_worker_blocked",
          actionable: false,
          blocked: true,
          blockedUntil: recoveryEvaluation.blockedUntil,
          nextAction: routingAssessment.nextAction
        };
      }
      if (!scheduleAssessment.allowed) {
        return {
          ...base,
          contractStatus: recoveryEvaluation.effectiveStatus,
          action: "installation_schedule_blocked",
          actionable: false,
          blocked: true,
          blockedUntil: recoveryEvaluation.blockedUntil,
          nextAction: scheduleAssessment.nextAction
        };
      }
      return {
        ...base,
        contractStatus: recoveryEvaluation.effectiveStatus,
        action: "run_recover",
        actionable: true,
        blocked: false,
        blockedUntil: recoveryEvaluation.blockedUntil,
        nextAction: recoveryEvaluation.nextAction
      };
    }
    return {
      ...base,
      contractStatus: recoveryEvaluation.effectiveStatus,
      action: "hold_recovery",
      actionable: false,
      blocked: true,
      blockedUntil: recoveryEvaluation.blockedUntil,
      nextAction: recoveryEvaluation.nextAction
    };
  }

  return {
    ...base,
    action: "unsupported_contract",
    actionable: false,
    blocked: true,
    nextAction: "This queued contract kind is not supported by the local service tick."
  };
}
