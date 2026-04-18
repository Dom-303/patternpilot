import {
  buildPolicyControlReview,
  buildAutomationAlertPayload,
  buildAutomationAlerts,
  buildAutomationOperatorReviewDigest,
  findLatestPolicyStageArtifact,
  loadAutomationDispatchHistory,
  loadAutomationOperatorReviews,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadWatchlistUrls,
  selectNextDispatchableAutomationJob,
  summarizeAutomationDispatchHistoryForJob,
  summarizeAutomationOperatorReviewsForJob,
  writeAutomationAlertArtifacts
} from "../../../lib/index.mjs";
import { computeRulesFingerprint } from "../../../lib/classification/evaluation.mjs";
import {
  buildProjectRunDiagnostics,
  buildProjectRunGovernanceSnapshot
} from "../../shared/runtime-helpers.mjs";

export async function writeAlertArtifacts(rootDir, config, generatedAt, evaluations, dryRun = false) {
  const rawAlerts = buildAutomationAlerts(evaluations, {
    now: new Date(generatedAt)
  });
  const operatorReviewDigest = buildAutomationOperatorReviewDigest(evaluations, {
    now: new Date(generatedAt)
  });
  const nextJob = selectNextDispatchableAutomationJob(evaluations) ?? evaluations.find((job) => job.status === "ready") ?? null;
  const payload = buildAutomationAlertPayload({
    generatedAt,
    alerts: rawAlerts,
    nextJob,
    operatorReviewDigest
  });
  const paths = await writeAutomationAlertArtifacts(rootDir, config, payload, dryRun);
  return {
    alerts: payload.alerts,
    nextJob,
    payload,
    paths
  };
}

export async function loadProjectPolicyControlSnapshot(rootDir, projectKey) {
  const [cycle, handoff, curation, applyReview, apply] = await Promise.all([
    findLatestPolicyStageArtifact(rootDir, projectKey, "cycle"),
    findLatestPolicyStageArtifact(rootDir, projectKey, "handoff"),
    findLatestPolicyStageArtifact(rootDir, projectKey, "curation"),
    findLatestPolicyStageArtifact(rootDir, projectKey, "apply_review"),
    findLatestPolicyStageArtifact(rootDir, projectKey, "apply")
  ]);
  const review = buildPolicyControlReview({
    projectKey,
    cycle,
    handoff,
    curation,
    applyReview,
    apply
  });
  return review.stageCount > 0 ? review : null;
}

export async function enrichAutomationEvaluationsWithGovernance(rootDir, config, evaluations) {
  const { history: dispatchHistory } = await loadAutomationDispatchHistory(rootDir, config);
  const { reviewState } = await loadAutomationOperatorReviews(rootDir, config);
  const next = [];
  for (const evaluation of evaluations) {
    if (evaluation.scope !== "project" || !evaluation.projectKey || !config.projects?.[evaluation.projectKey]) {
      next.push(evaluation);
      continue;
    }

    const { project, binding } = await loadProjectBinding(rootDir, config, evaluation.projectKey);
    const alignmentRules = await loadProjectAlignmentRules(rootDir, project, binding);
    const watchlistUrls = project.watchlistFile
      ? await loadWatchlistUrls(rootDir, project)
      : [];
    const diagnostics = await buildProjectRunDiagnostics(rootDir, config, {
      projectKey: evaluation.projectKey,
      sourceMode: "watchlist",
      explicitUrlCount: 0,
      watchlistCount: watchlistUrls.length,
      watchlistUrls,
      currentFingerprint: computeRulesFingerprint(alignmentRules),
      isAutomation: true
    });
    const governance = buildProjectRunGovernanceSnapshot({
      projectKey: evaluation.projectKey,
      lifecycle: diagnostics.lifecycle,
      drift: diagnostics.drift,
      stability: diagnostics.stability,
      scope: "automation",
      jobState: evaluation.jobState ?? null,
      job: evaluation
    });
    const policyControl = await loadProjectPolicyControlSnapshot(rootDir, evaluation.projectKey);
    const dispatchHistorySummary = summarizeAutomationDispatchHistoryForJob(dispatchHistory, evaluation.name, {
      referenceAt: evaluation.jobState?.operatorAckAcknowledgedAt ?? null
    });
    const operatorReviewSummary = summarizeAutomationOperatorReviewsForJob(reviewState, evaluation.name);

    next.push({
      ...evaluation,
      jobState: {
        ...(evaluation.jobState ?? {}),
        runKind: diagnostics.lifecycle.runKind,
        recommendedFocus: diagnostics.lifecycle.recommendedFocus,
        driftStatus: diagnostics.drift.driftStatus,
        driftSignals: diagnostics.drift.signals.length,
        stabilityStatus: diagnostics.stability.status,
        stableStreak: diagnostics.stability.stableStreak,
        unstableStreak: diagnostics.stability.unstableStreak,
        governanceStatus: governance.status,
        autoDispatchAllowed: governance.autoDispatchAllowed,
        autoApplyAllowed: governance.autoApplyAllowed,
        governanceNextAction: governance.nextAction,
        recommendedGovernancePromotionMode: governance.recommendedPromotionMode,
        dispatchDecisionCount: dispatchHistorySummary.totalEntries,
        dispatchBlockedCount: dispatchHistorySummary.blockedCount,
        dispatchGovernanceBlockedCount: dispatchHistorySummary.governanceBlockedCount,
        dispatchPolicyBlockedCount: dispatchHistorySummary.policyBlockedCount,
        dispatchReroutedCount: dispatchHistorySummary.reroutedCount,
        dispatchReceivedRerouteCount: dispatchHistorySummary.receivedRerouteCount,
        dispatchBlockedStreak: dispatchHistorySummary.blockedStreak,
        dispatchGovernanceBlockedStreak: dispatchHistorySummary.governanceBlockedStreak,
        dispatchPolicyBlockedStreak: dispatchHistorySummary.policyBlockedStreak,
        dispatchBlockedSinceAckCount: dispatchHistorySummary.blockedCountSinceAck,
        dispatchGovernanceBlockedSinceAckCount: dispatchHistorySummary.governanceBlockedCountSinceAck,
        dispatchPolicyBlockedSinceAckCount: dispatchHistorySummary.policyBlockedCountSinceAck,
        dispatchBlockedSinceAckStreak: dispatchHistorySummary.blockedStreakSinceAck,
        dispatchGovernanceBlockedSinceAckStreak: dispatchHistorySummary.governanceBlockedStreakSinceAck,
        dispatchPolicyBlockedSinceAckStreak: dispatchHistorySummary.policyBlockedStreakSinceAck,
        lastDispatchAt: dispatchHistorySummary.lastRecordedAt,
        lastDispatchStatus: dispatchHistorySummary.lastSelectionStatus,
        lastDispatchReason: dispatchHistorySummary.lastReason,
        lastDispatchGateStatus: dispatchHistorySummary.lastDispatchGateStatus,
        operatorReviewStatus: operatorReviewSummary.currentStatus,
        operatorReviewCategory: operatorReviewSummary.currentCategory,
        operatorReviewSourceStatus: operatorReviewSummary.currentSourceStatus,
        operatorReviewOpenedAt: operatorReviewSummary.openedAt,
        operatorReviewResolvedAt: operatorReviewSummary.resolvedAt,
        operatorReviewResolutionNotes: operatorReviewSummary.resolutionNotes,
        operatorReviewNextAction: operatorReviewSummary.nextAction,
        operatorReviewNextCommand: operatorReviewSummary.nextCommand,
        operatorReviewLatestEventAt: operatorReviewSummary.latestEventAt,
        operatorReviewLatestEventType: operatorReviewSummary.latestEventType,
        policyControlStatus: policyControl?.overallStatus ?? "no_policy_activity",
        policyControlStage: policyControl?.currentStageKey ?? null,
        policyControlDecisionStatus: policyControl?.currentDecisionStatus ?? null,
        policyControlNextCommand: policyControl?.nextCommand ?? null,
        policyControlTopBlocker: policyControl?.topBlocker ?? null
      },
      liveGovernance: governance,
      livePolicyControl: policyControl,
      liveDispatchHistory: dispatchHistorySummary,
      liveOperatorReview: operatorReviewSummary
    });
  }
  return next;
}
