// patternpilot engine — barrel re-export
// Each module is listed in dependency order for clarity.

export { ensureDirectory } from "./utils.mjs";
export { runShellCommand } from "./utils.mjs";

export {
  resolveDiscoveryProfile,
  resolveAnalysisProfile,
  resolveAnalysisDepth,
  resolveReportView
} from "./constants.mjs";

export {
  loadPatternpilotRoot,
  loadConfig,
  resolveQueuePath,
  resolveLandkartePath,
  resolveLearningsPath,
  resolveDecisionsPath,
  loadEnvFiles,
  parseArgs
} from "./config.mjs";

export {
  buildGithubAppReadiness,
  buildGithubAppIntegrationPlan,
  buildGithubAppEventPreview,
  resolveGithubToken,
  inspectGithubAuth,
  inspectGithubAppAuth,
  renderGithubAppEventPreviewSummary,
  renderGithubAppReadinessSummary,
  renderGithubAppIntegrationPlanSummary,
  writeGithubAppEventPreviewArtifacts,
  writeGithubAppIntegrationPlanArtifacts,
  buildSetupChecklist,
  initializeEnvFiles,
  enrichGithubRepo,
  runGithubDoctor
} from "./github.mjs";

export {
  assessGithubAppInstallationOperations,
  applyGithubAppInstallationScopeHandoff,
  applyGithubAppInstallationGovernanceToState,
  applyGithubAppInstallationOperationsToState,
  applyGithubAppInstallationRuntimeToState,
  applyGithubAppInstallationPacketToState,
  buildGithubAppInstallationPacket,
  buildGithubAppInstallationGovernancePlan,
  buildGithubAppInstallationOperationsPlan,
  buildGithubAppInstallationRuntimePlan,
  buildGithubAppInstallationScopePlan,
  buildGithubAppInstallationStateSummary,
  getGithubAppInstallationStatePath,
  loadGithubAppInstallationState,
  renderGithubAppInstallationPacketSummary,
  renderGithubAppInstallationGovernanceSummary,
  renderGithubAppInstallationOperationsSummary,
  renderGithubAppInstallationRuntimeSummary,
  renderGithubAppInstallationScopeSummary,
  resolveProjectKeyForInstallationRepository,
  writeGithubAppInstallationArtifacts,
  writeGithubAppInstallationOperationsArtifacts,
  writeGithubAppInstallationRuntimeArtifacts,
  writeGithubAppInstallationScopeArtifacts,
  writeGithubAppInstallationState
} from "./github-installations.mjs";

export {
  buildGithubWebhookEnvelope,
  computeGithubWebhookSignature,
  derivePatternpilotEventKeyFromWebhook,
  parseWebhookHeadersContent,
  renderGithubWebhookEnvelopeSummary,
  resolveGithubWebhookSecret,
  verifyGithubWebhookSignature,
  writeGithubWebhookPreviewArtifacts
} from "./github-webhook.mjs";

export {
  buildGithubWebhookRoutePlan,
  renderGithubWebhookRoutePlanSummary,
  resolveProjectKeyForWebhookRoute,
  writeGithubWebhookRouteArtifacts
} from "./github-webhook-route.mjs";

export {
  buildGithubWebhookExecutionContract,
  buildGithubWebhookDispatchPlan,
  classifyGithubWebhookCommand,
  executeGithubWebhookDispatchPlan,
  renderGithubWebhookDispatchSummary,
  summarizeGithubWebhookExecution,
  writeGithubWebhookDispatchArtifacts
} from "./github-webhook-dispatch.mjs";

export {
  buildGithubWebhookRecoveryAssessment,
  buildGithubWebhookRecoveryContract,
  buildGithubWebhookResumeContract,
  buildGithubWebhookRunnerState,
  buildGithubWebhookRunnerPlan,
  evaluateGithubWebhookRecoveryContract,
  executeGithubWebhookRunnerPlan,
  loadGithubWebhookExecutionContract,
  renderGithubWebhookRunnerSummary,
  summarizeGithubWebhookRunnerExecution,
  writeGithubWebhookRunnerArtifacts
} from "./github-webhook-runner.mjs";

export {
  buildGithubWebhookServiceReviewPlan,
  buildGithubWebhookServiceRequeuePlan,
  buildGithubWebhookServiceTickPlan,
  buildGithubWebhookServiceLease,
  classifyGithubWebhookServiceQueueEntry,
  claimGithubWebhookServiceQueueEntries,
  enqueueGithubWebhookServiceContractFromFile,
  getGithubWebhookServicePaths,
  loadGithubWebhookServiceQueue,
  queueGithubWebhookServiceContract,
  reclaimExpiredGithubWebhookServiceClaims,
  requeueGithubWebhookServiceQueueEntries,
  renderGithubWebhookServiceReviewSummary,
  renderGithubWebhookServiceRequeueSummary,
  renderGithubWebhookServiceTickSummary,
  selectGithubWebhookServiceQueueEntries,
  writeGithubWebhookServiceAdminArtifacts,
  writeGithubWebhookServiceArtifacts
} from "./github-webhook-service.mjs";

export {
  collectUrls,
  normalizeGithubUrl,
  createRunId,
  upsertQueueEntry,
  loadQueueEntries,
  loadLandkarteEntries,
  refreshOperationalDocs
} from "./queue.mjs";

export {
  indexPreloadedCandidates,
  hasPreloadedCandidate
} from "./intake-source.mjs";

export {
  guessClassification,
  buildProjectRelevanceNote,
  buildLandkarteCandidate
} from "./classification/core.mjs";
export { buildProjectAlignment } from "./classification/alignment.mjs";

export {
  loadProjectBinding,
  loadProjectAlignmentRules,
  loadProjectDiscoveryPolicy,
  initializeProjectBinding,
  discoverWorkspaceProjects,
  loadProjectProfile
} from "./project.mjs";

export {
  defaultDiscoveryPolicy,
  evaluateDiscoveryCandidatePolicy,
  summarizeDiscoveryPolicyResults,
  buildDiscoveryPolicyCalibration
} from "./policy/discovery-policy.mjs";

export {
  findLatestDiscoveryManifest,
  getDiscoveryPolicySourceCandidates,
  buildDiscoveryPolicyReview,
  renderDiscoveryPolicyReviewSummary
} from "./policy/discovery-policy-review.mjs";

export {
  listDiscoveryManifests,
  buildDiscoveryPolicyCalibrationReport,
  renderDiscoveryPolicyCalibrationReport
} from "./policy/discovery-policy-calibration.mjs";

export {
  loadDiscoveryPolicyFromFile,
  buildDiscoveryPolicyComparisonReport,
  renderDiscoveryPolicyComparisonReport
} from "./policy/discovery-policy-compare.mjs";

export {
  buildPolicyWorkbench,
  renderPolicyWorkbenchSummary
} from "./policy/policy-workbench.mjs";

export {
  findLatestPolicyWorkbench,
  loadPolicyWorkbench,
  buildPolicyWorkbenchReview,
  renderPolicyWorkbenchReviewSummary
} from "./policy/policy-workbench-review.mjs";

export {
  applyProjectPolicy
} from "./policy/policy-apply.mjs";

export {
  buildPolicySuggestion,
  renderPolicySuggestionSummary
} from "./policy/policy-suggest.mjs";

export {
  buildPolicyTrial,
  renderPolicyTrialSummary
} from "./policy/policy-trial.mjs";

export {
  buildReplayImportPayloadFromDiscovery,
  renderPolicyCycleSummary
} from "./policy/policy-cycle.mjs";

export {
  findLatestPolicyCycle,
  loadPolicyCycle,
  selectPolicyHandoffCandidates,
  renderPolicyHandoffSummary
} from "./policy/policy-handoff.mjs";

export {
  buildPolicyCuration,
  renderPolicyCurationSummary
} from "./policy/policy-curation.mjs";

export {
  selectPolicyCurationApplyCandidates,
  buildPolicyCurationApplyReview,
  renderPolicyCurationApplyReviewSummary
} from "./policy/policy-curation-apply.mjs";

export {
  selectPolicyCurationBatchCandidates,
  buildPolicyCurationBatchReview,
  renderPolicyCurationBatchReviewSummary,
  renderPolicyCurationBatchPlanSummary
} from "./policy/policy-curation-batch.mjs";

export {
  applyDiscoveryPolicyToCandidates
} from "./discovery/candidates.mjs";
export { appendUrlsToWatchlist, discoverGithubCandidates } from "./discovery/search.mjs";
export { discoverImportedCandidates } from "./discovery/imported.mjs";
export { loadWatchlistUrls } from "./discovery/shared.mjs";

export {
  buildAutomationAlertPayload,
  buildAutomationAlerts,
  clearAutomationJobState,
  evaluateAutomationJobs,
  loadAutomationJobs,
  loadAutomationJobState,
  resolveAutomationDispatchJob,
  renderAutomationAlertSummary,
  selectNextDispatchableAutomationJob,
  writeAutomationJobState,
  writeAutomationAlertArtifacts,
  selectNextAutomationJob,
  updateAutomationJobState,
  renderAutomationJobsSummary
} from "./automation/automation-jobs.mjs";

export {
  deliverAutomationAlertPayload,
  renderAutomationAlertDeliverySummary,
  resolveAutomationAlertTargets
} from "./automation/alert-delivery.mjs";

export {
  buildAutomationAlertDigest,
  loadAutomationAlertHookPayload,
  parseAutomationAlertHookArgs,
  renderAutomationAlertHookMarkdown,
  writeAutomationAlertHookOutputs
} from "./automation/alert-hook.mjs";

export {
  buildBrowserLinkTarget,
  writeLatestReportPointers
} from "./report-output.mjs";

export {
  listProjectRunHistory,
  buildProjectRunLifecycle,
  buildRunResumeRecommendation,
  renderProjectRunLifecycleSummary
} from "./run/run-lifecycle.mjs";

export {
  buildProjectRunDrift,
  buildProjectRunDriftFromState,
  renderProjectRunDriftSummary
} from "./run/run-drift.mjs";

export {
  buildProjectRunStability,
  renderProjectRunStabilitySummary
} from "./run/run-stability.mjs";

export {
  buildProjectRunGovernance,
  renderProjectRunGovernanceSummary
} from "./run/run-governance.mjs";

export {
  buildProjectRunRequalification,
  renderProjectRunRequalificationSummary
} from "./run/run-requalify.mjs";

export {
  classifyReviewItemState,
  buildReviewRunFields,
  buildWatchlistReviewReport,
  buildWatchlistReview
} from "./review.mjs";

export {
  renderDiscoveryHtmlReport,
  renderOnDemandRunHtmlReport,
  renderWatchlistReviewHtmlReport
} from "./html-renderer.mjs";

export {
  buildIntakeDocPath,
  renderDecisionSignalsBlock,
  replaceDecisionSignalsBlock,
  renderIntakeDoc,
  writeIntakeDoc,
  writeRunArtifacts,
  renderRunSummary,
  renderDiscoverySummary
} from "./intake.mjs";

export {
  reEvaluateQueueEntries,
  reevaluateQueueRow,
  rewriteIntakeDecisionSignals
} from "./re-evaluate.mjs";

export {
  buildPromotionDocPath,
  buildPromotionCandidate,
  renderPromotionPacket,
  writePromotionPacket,
  upsertManagedMarkdownBlock,
  upsertLandkarteEntry,
  renderLearningBlock,
  renderDecisionBlock
} from "./promotion.mjs";
