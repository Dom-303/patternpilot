#!/usr/bin/env node
import {
  loadConfig,
  loadEnvFiles,
  loadPatternpilotRoot,
  parseArgs
} from "../lib/index.mjs";
import {
  getPatternpilotCommand,
  renderPatternpilotHelp,
  resolvePatternpilotCommandName
} from "./shared/command-registry.mjs";
import { buildCommandFailureGuidance } from "./shared/error-guidance.mjs";
import {
  runIntake,
  runDiscover,
  runDiscoverImport
} from "./commands/discovery.mjs";
import {
  runReviewWatchlist,
  runSyncWatchlist,
  runSyncAllWatchlists,
  runReEvaluate
} from "./commands/watchlist.mjs";
import { runOnDemand } from "./commands/on-demand.mjs";
import { runAgentHandoff } from "./commands/agent-handoff.mjs";
import {
  runPlan,
  runDrift,
  runStability,
  runGovernance,
  runRequalify
} from "./commands/run-diagnostics.mjs";
import {
  runRefreshContext,
  runShowProject,
  printProjectList,
  runDoctor,
  runBootstrap,
  runGettingStarted,
  runGithubAppEventPreview,
  runGithubAppInstallationApply,
  runGithubAppInstallationGovernanceApply,
  runGithubAppInstallationGovernanceReview,
  runGithubAppInstallationHandoff,
  runGithubAppInstallationOperationsApply,
  runGithubAppInstallationOperationsReview,
  runGithubAppInstallationReview,
  runGithubAppInstallationServiceLaneApply,
  runGithubAppInstallationServiceLaneReview,
  runGithubAppInstallationServicePlanApply,
  runGithubAppInstallationServicePlanReview,
  runGithubAppInstallationServiceScheduleApply,
  runGithubAppInstallationServiceScheduleReview,
  runGithubAppInstallationWorkerRoutingApply,
  runGithubAppInstallationWorkerRoutingReview,
  runGithubAppInstallationRuntimeApply,
  runGithubAppInstallationRuntimeReview,
  runGithubAppInstallationScope,
  runGithubAppInstallationShow,
  runGithubAppExecutionEnqueue,
  runGithubAppExecutionRecover,
  runGithubAppExecutionRun,
  runGithubAppExecutionResume,
  runGithubAppLivePilotReview,
  runGithubAppPlan,
  runGithubAppReadiness,
  runGithubAppServiceReview,
  runGithubAppServiceRequeue,
  runGithubAppServiceRuntimeCloseoutReview,
  runGithubAppServiceRuntimeControlReview,
  runGithubAppServiceRuntimeMaintenanceApply,
  runGithubAppServiceRuntimeMaintenanceReview,
  runGithubAppServiceRuntimeIntegrityReview,
  runGithubAppServiceRuntimeOpsReview,
  runGithubAppServiceRuntimeReview,
  runGithubAppServiceRuntimeCycleReview,
  runGithubAppServiceRuntimeCycleRun,
  runGithubAppServiceRuntimeSessionReview,
  runGithubAppServiceRuntimeSessionRun,
  runGithubAppServiceRuntimeSessionResume,
  runGithubAppServiceRuntimeLoopReview,
  runGithubAppServiceRuntimeLoopRun,
  runGithubAppServiceRuntimeLoopResume,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRun,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleResume,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleAutoResume,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationApply,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRun,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResume,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecover,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionRun,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResume,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleRun,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResume,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureAutoFollowup,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureApply,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupApply,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupApply,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceApply,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceRelease,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeRun,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeReview,
  runGithubAppServiceRuntimeLoopRecoveryRuntimeRun,
  runGithubAppServiceRuntimeLoopRecoveryAuto,
  runGithubAppServiceRuntimeLoopRecoveryReceiptsRelease,
  runGithubAppServiceRuntimeLoopRecoveryReceiptsReleaseReview,
  runGithubAppServiceRuntimeLoopRecoveryReceiptsReview,
  runGithubAppServiceRuntimeLoopRecover,
  runGithubAppServiceRuntimeLoopRecoveryReview,
  runGithubAppServiceRuntimeLoopHistoryReview,
  runGithubAppServiceRuntimeRun,
  runGithubAppServiceSchedulerReview,
  runGithubAppServiceSchedulerRun,
  runGithubAppServiceTick,
  runGithubAppWebhookDispatch,
  runGithubAppWebhookRoute,
  runGithubAppWebhookPreview,
  runInitEnv,
  runSetupChecklist,
  runInitProject,
  runDiscoverWorkspace
} from "./commands/project-admin.mjs";
import {
  runAutomationJobs,
  runAutomationDispatch,
  runAutomationDispatchHistory,
  runAutomationAlerts,
  runAutomationAlertDeliver,
  runAutomationReviews,
  runAutomationJobAck,
  runAutomationJobClear
} from "./commands/automation/control-plane.mjs";
import { runAutomation } from "./commands/automation/run.mjs";
import {
  runPolicyReview,
  runPolicyCompare,
  runPolicyCalibrate,
  runPolicyPack,
  runPolicyWorkbench,
  runPolicyWorkbenchReview,
  runPolicySuggest,
  runPolicyTrial,
  runPolicyCycle,
  runPolicyHandoff,
  runPolicyApply,
  runPolicyControl
} from "./commands/policy-core.mjs";
import {
  runPolicyCurate,
  runPolicyCurationReview,
  runPolicyCurationApply,
  runPolicyCurationBatchReview,
  runPolicyCurationBatchPlan,
  runPolicyCurationBatchApply
} from "./commands/policy-curation.mjs";
import { runPromote } from "./commands/promotion.mjs";
import { runProductReadiness } from "./commands/product-readiness.mjs";
import { runValidateCohort } from "./commands/validation-cohort.mjs";
import { runDiscoveryEvaluate } from "./commands/discovery-evaluation.mjs";

function printHelp() {
  console.log(renderPatternpilotHelp());
}

const COMMANDS_ALLOWED_WITHOUT_PROJECT = new Set([
  "doctor",
  "bootstrap",
  "getting-started",
  "init-env",
  "init-project",
  "discover-workspace",
  "product-readiness",
  "setup-checklist",
  "list-projects",
  "automation-jobs",
  "automation-alerts",
  "automation-alert-deliver",
  "automation-dispatch",
  "automation-dispatch-history",
  "automation-reviews",
  "validate-cohort",
  "discover-evaluate"
]);

function buildCommandHandlers(envFiles) {
  return {
    runBootstrap,
    runAgentHandoff,
    runIntake,
    runOnDemand,
    runPlan,
    runDrift,
    runStability,
    runGovernance,
    runRequalify,
    runProductReadiness,
    runValidateCohort,
    runDiscoveryEvaluate,
    runGettingStarted,
    runDoctor: (rootDir, config, options) => runDoctor(rootDir, config, options, envFiles),
    runGithubAppEventPreview,
    runGithubAppInstallationApply,
    runGithubAppInstallationGovernanceApply,
    runGithubAppInstallationGovernanceReview,
    runGithubAppInstallationHandoff,
    runGithubAppInstallationOperationsApply,
    runGithubAppInstallationOperationsReview,
    runGithubAppInstallationReview,
    runGithubAppInstallationServiceLaneApply,
    runGithubAppInstallationServiceLaneReview,
    runGithubAppInstallationServicePlanApply,
    runGithubAppInstallationServicePlanReview,
    runGithubAppInstallationServiceScheduleApply,
    runGithubAppInstallationServiceScheduleReview,
    runGithubAppInstallationWorkerRoutingApply,
    runGithubAppInstallationWorkerRoutingReview,
    runGithubAppInstallationRuntimeApply,
    runGithubAppInstallationRuntimeReview,
    runGithubAppInstallationScope,
    runGithubAppInstallationShow,
    runGithubAppExecutionEnqueue,
    runGithubAppExecutionRecover,
    runGithubAppExecutionRun,
    runGithubAppExecutionResume,
    runGithubAppLivePilotReview,
    runGithubAppPlan,
    runGithubAppReadiness,
    runGithubAppServiceReview,
    runGithubAppServiceRequeue,
    runGithubAppServiceRuntimeCloseoutReview,
    runGithubAppServiceRuntimeControlReview,
    runGithubAppServiceRuntimeMaintenanceApply,
    runGithubAppServiceRuntimeMaintenanceReview,
    runGithubAppServiceRuntimeIntegrityReview,
    runGithubAppServiceRuntimeOpsReview,
    runGithubAppServiceRuntimeCycleReview,
    runGithubAppServiceRuntimeCycleRun,
    runGithubAppServiceRuntimeSessionReview,
    runGithubAppServiceRuntimeSessionRun,
    runGithubAppServiceRuntimeSessionResume,
    runGithubAppServiceRuntimeLoopReview,
    runGithubAppServiceRuntimeLoopRun,
    runGithubAppServiceRuntimeLoopResume,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRun,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleResume,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleHistoryReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleReceiptsReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleAutoResume,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationApply,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRun,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopResume,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopHistoryReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecoveryReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureLoopRecover,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionRun,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureSessionResume,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleRun,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureCycleResume,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureAutoFollowup,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureApply,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupApply,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureHistoryReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureFollowupReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationBackpressureReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupApply,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationFollowupReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeCoordinationReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceApply,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceRelease,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReleaseReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeGovernanceReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeCycleRuntimeRun,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeReview,
    runGithubAppServiceRuntimeLoopRecoveryRuntimeRun,
    runGithubAppServiceRuntimeLoopRecoveryAuto,
    runGithubAppServiceRuntimeLoopRecoveryReceiptsRelease,
    runGithubAppServiceRuntimeLoopRecoveryReceiptsReleaseReview,
    runGithubAppServiceRuntimeLoopRecoveryReceiptsReview,
    runGithubAppServiceRuntimeLoopRecover,
    runGithubAppServiceRuntimeLoopRecoveryReview,
    runGithubAppServiceRuntimeLoopHistoryReview,
    runGithubAppServiceRuntimeReview,
    runGithubAppServiceRuntimeRun,
    runGithubAppServiceSchedulerReview,
    runGithubAppServiceSchedulerRun,
    runGithubAppServiceTick,
    runGithubAppWebhookDispatch,
    runGithubAppWebhookRoute,
    runGithubAppWebhookPreview,
    runAutomationJobs,
    runAutomationDispatch,
    runAutomationDispatchHistory,
    runAutomationAlerts,
    runAutomationAlertDeliver,
    runAutomationReviews,
    runAutomationJobAck,
    runAutomationJobClear,
    runDiscover,
    runDiscoverImport,
    runPolicyAudit: (rootDir, config, options) => runDiscover(rootDir, config, {
      ...options,
      commandName: "policy-audit",
      discoveryPolicyMode: "audit"
    }),
    runPolicyReview,
    runPolicyCompare,
    runPolicyCalibrate,
    runPolicyPack,
    runPolicyWorkbench,
    runPolicyWorkbenchReview,
    runPolicySuggest,
    runPolicyTrial,
    runPolicyCycle,
    runPolicyHandoff,
    runPolicyControl,
    runPolicyCurate,
    runPolicyCurationReview,
    runPolicyCurationApply,
    runPolicyCurationBatchReview,
    runPolicyCurationBatchPlan,
    runPolicyCurationBatchApply,
    runPolicyApply,
    runReviewWatchlist,
    runReEvaluate,
    runRefreshContext: (rootDir, config) => runRefreshContext(rootDir, config),
    runInitEnv: (rootDir, _config, options) => runInitEnv(rootDir, options),
    runAutomation,
    runInitProject,
    runDiscoverWorkspace,
    runSetupChecklist,
    runSyncWatchlist,
    runSyncAllWatchlists,
    printProjectList,
    runShowProject,
    runPromote
  };
}

async function main() {
  const rootDir = await loadPatternpilotRoot(import.meta.url);
  const envFiles = await loadEnvFiles(rootDir);
  const config = await loadConfig(rootDir);
  const { command, options } = parseArgs(process.argv.slice(2));
  const resolvedCommandName = resolvePatternpilotCommandName(command);

  if (!resolvedCommandName || resolvedCommandName === "help" || resolvedCommandName === "--help" || resolvedCommandName === "-h") {
    printHelp();
    return;
  }

  const commandEntry = getPatternpilotCommand(resolvedCommandName);
  if (!commandEntry) {
    throw new Error(`Unknown command '${command}'.`);
  }

  const handlers = buildCommandHandlers(envFiles);
  const handler = handlers[commandEntry.handlerKey];
  if (!handler) {
    throw new Error(`No handler configured for command '${commandEntry.name}'.`);
  }

  const hasConfiguredProjects = Object.keys(config.projects ?? {}).length > 0;
  if (!hasConfiguredProjects && !COMMANDS_ALLOWED_WITHOUT_PROJECT.has(commandEntry.name)) {
    throw new Error(
      `No project is configured yet. Run 'npm run getting-started' or 'npm run bootstrap -- --project my-project --target ../my-project --label "My Project"' first.`
    );
  }

  try {
    await handler(rootDir, config, options);
  } catch (error) {
    error.patternpilotContext = {
      commandName: commandEntry.name,
      projectKey: options.project || config.defaultProject || null
    };
    throw error;
  }
}

main().catch((error) => {
  console.error(`Patternpilot failed: ${error.message}`);
  const guidance = buildCommandFailureGuidance(
    error.message,
    error.patternpilotContext ?? {}
  );
  if (guidance) {
    console.error("");
    console.error(guidance);
  }
  process.exitCode = error.exitCode ?? 1;
});
