// patternpilot engine — barrel re-export
// Each module is listed in dependency order for clarity.

export { ensureDirectory } from "./utils.mjs";

export {
  resolveDiscoveryProfile,
  resolveAnalysisProfile,
  resolveAnalysisDepth,
  resolveReportView
} from "./constants.mjs";

export {
  loadPatternpilotRoot,
  loadConfig,
  loadEnvFiles,
  parseArgs
} from "./config.mjs";

export {
  resolveGithubToken,
  inspectGithubAuth,
  inspectGithubAppAuth,
  buildSetupChecklist,
  initializeEnvFiles,
  enrichGithubRepo,
  runGithubDoctor
} from "./github.mjs";

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
  guessClassification,
  buildProjectRelevanceNote,
  buildProjectAlignment,
  buildLandkarteCandidate
} from "./classification.mjs";

export {
  loadProjectBinding,
  loadProjectAlignmentRules,
  initializeProjectBinding,
  discoverWorkspaceProjects,
  loadProjectProfile
} from "./project.mjs";

export {
  loadWatchlistUrls,
  appendUrlsToWatchlist,
  discoverGithubCandidates
} from "./discovery.mjs";

export {
  buildWatchlistReviewReport,
  buildWatchlistReview
} from "./review.mjs";

export {
  renderDiscoveryHtmlReport,
  renderWatchlistReviewHtmlReport
} from "./html-renderer.mjs";

export {
  buildIntakeDocPath,
  renderIntakeDoc,
  writeIntakeDoc,
  writeRunArtifacts,
  renderRunSummary,
  renderDiscoverySummary
} from "./intake.mjs";

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
