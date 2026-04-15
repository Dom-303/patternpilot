import {
  buildAutomationAlertPayload,
  buildAutomationAlerts,
  loadProjectAlignmentRules,
  loadProjectBinding,
  loadWatchlistUrls,
  selectNextDispatchableAutomationJob,
  writeAutomationAlertArtifacts
} from "../../../lib/index.mjs";
import { computeRulesFingerprint } from "../../../lib/classification.mjs";
import {
  buildProjectRunDiagnostics,
  buildProjectRunGovernanceSnapshot
} from "../../shared/runtime-helpers.mjs";

export async function writeAlertArtifacts(rootDir, config, generatedAt, evaluations, dryRun = false) {
  const alerts = buildAutomationAlerts(evaluations, {
    now: new Date(generatedAt)
  });
  const nextJob = selectNextDispatchableAutomationJob(evaluations) ?? evaluations.find((job) => job.status === "ready") ?? null;
  const payload = buildAutomationAlertPayload({
    generatedAt,
    alerts,
    nextJob
  });
  const paths = await writeAutomationAlertArtifacts(rootDir, config, payload, dryRun);
  return {
    alerts,
    nextJob,
    payload,
    paths
  };
}

export async function enrichAutomationEvaluationsWithGovernance(rootDir, config, evaluations) {
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
        recommendedGovernancePromotionMode: governance.recommendedPromotionMode
      },
      liveGovernance: governance
    });
  }
  return next;
}
