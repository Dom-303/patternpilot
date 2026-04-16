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
  runGithubAppPlan,
  runGithubAppReadiness,
  runGithubAppServiceReview,
  runGithubAppServiceRequeue,
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
  runAutomationAlerts,
  runAutomationAlertDeliver,
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
  runPolicyApply
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

function printHelp() {
  console.log(renderPatternpilotHelp());
}

function buildCommandHandlers(envFiles) {
  return {
    runIntake,
    runOnDemand,
    runPlan,
    runDrift,
    runStability,
    runGovernance,
    runRequalify,
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
    runGithubAppPlan,
    runGithubAppReadiness,
    runGithubAppServiceReview,
    runGithubAppServiceRequeue,
    runGithubAppServiceTick,
    runGithubAppWebhookDispatch,
    runGithubAppWebhookRoute,
    runGithubAppWebhookPreview,
    runAutomationJobs,
    runAutomationDispatch,
    runAutomationAlerts,
    runAutomationAlertDeliver,
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
    runSetupChecklist: (_rootDir, _config, options) => runSetupChecklist(options),
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

  await handler(rootDir, config, options);
}

main().catch((error) => {
  console.error(`Patternpilot failed: ${error.message}`);
  process.exitCode = error.exitCode ?? 1;
});
