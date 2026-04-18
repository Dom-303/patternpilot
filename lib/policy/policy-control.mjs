import path from "node:path";
import { asRelativeFromRoot, safeReadDirEntries, safeReadText } from "../utils.mjs";
import { describePolicyControlOperatingPosture } from "../automation/operating-mode.mjs";

const STAGE_DEFINITIONS = [
  { key: "cycle", dirName: "cycles", idField: "cycleId", rank: 1 },
  { key: "handoff", dirName: "handoffs", idField: "handoffId", rank: 2 },
  { key: "curation", dirName: "curation", idField: "curationId", rank: 3 },
  { key: "apply_review", dirName: "apply-review", idField: "reviewId", rank: 4 },
  { key: "apply", dirName: "apply", idField: "applyId", rank: 5 }
];

function getStageDefinition(stageKey) {
  return STAGE_DEFINITIONS.find((entry) => entry.key === stageKey) ?? null;
}

function parseTime(value) {
  const parsed = Date.parse(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeCommand(projectKey, command) {
  if (!command) {
    return null;
  }
  if (command.startsWith("npm run patternpilot -- ")) {
    return command;
  }
  return `npm run patternpilot -- ${command} --project ${projectKey}`;
}

function inferApplyReviewDecisionStatus(review = {}) {
  if (review.decisionStatus) {
    return review.decisionStatus;
  }
  const rows = review.rows ?? [];
  if (rows.length === 0) {
    return "no_candidates";
  }
  if (rows.some((row) => row.reviewDisposition === "observe_only")) {
    return "apply_with_care";
  }
  return "apply_ready";
}

function buildCycleStage(projectKey, artifact) {
  const manifest = artifact.manifest ?? {};
  const review = manifest.review ?? {};
  const trial = manifest.trial ?? {};
  const applyResult = manifest.applyResult ?? null;
  const rowsWithVerdict = review.rowsWithVerdict ?? 0;
  let decisionStatus = trial.decisionStatus ?? "cycle_recorded";
  let nextCommand = `npm run patternpilot -- policy-workbench-review --project ${projectKey}`;
  let blocker = null;

  if (trial.decisionStatus === "apply_ready" && applyResult?.changed) {
    decisionStatus = "handoff_ready";
    nextCommand = `npm run patternpilot -- policy-handoff --project ${projectKey} --cycle-dir ${artifact.relativeDir}`;
  } else if (trial.decisionStatus === "apply_ready") {
    decisionStatus = "policy_apply_pending";
    nextCommand = `npm run patternpilot -- policy-apply --project ${projectKey}`;
  } else if (rowsWithVerdict === 0) {
    decisionStatus = "manual_verdicts_missing";
  }

  if (rowsWithVerdict === 0) {
    blocker = "Manual verdicts are still missing in the latest workbench review.";
  }

  const highlight =
    blocker
    ?? trial.recommendations?.[0]
    ?? review.recommendations?.[0]
    ?? "Cycle recorded without an additional operator note.";

  return {
    stageKey: "cycle",
    artifactId: manifest.cycleId ?? artifact.artifactId,
    generatedAt: artifact.generatedAt,
    relativeDir: artifact.relativeDir,
    decisionStatus,
    nextCommand,
    blocker,
    highlight,
    summaryLine: `cycle=${manifest.cycleId ?? artifact.artifactId} :: verdicts=${rowsWithVerdict} :: newly_visible=${trial.newlyVisibleCount ?? 0} :: replay_visible=${manifest.replay?.visibleCount ?? 0}`
  };
}

function buildHandoffStage(projectKey, artifact) {
  const manifest = artifact.manifest ?? {};
  const selectionCount = manifest.selection?.count ?? manifest.selection?.selected?.length ?? 0;
  const reviewItems =
    manifest.onDemandResult?.reviewItems
    ?? manifest.onDemandResult?.reviewRun?.review?.items?.length
    ?? 0;
  let decisionStatus = "ready_for_on_demand";
  let nextCommand = `npm run patternpilot -- policy-handoff --project ${projectKey} --cycle-dir ${manifest.cycleDir ?? artifact.relativeDir}`;
  let blocker = null;

  if (selectionCount === 0) {
    decisionStatus = "no_candidates_selected";
    nextCommand = `npm run patternpilot -- policy-workbench-review --project ${projectKey}`;
    blocker = "The latest handoff selected no repositories.";
  } else if (!manifest.onDemandResult) {
    decisionStatus = "ready_for_on_demand";
  } else if (reviewItems > 0) {
    decisionStatus = "handoff_review_ready";
    nextCommand = `npm run patternpilot -- promote --project ${projectKey} --from-status pending_review`;
    blocker = `${reviewItems} handoff review item(s) are still pending promotion review.`;
  } else {
    decisionStatus = "handoff_executed";
    nextCommand = `npm run patternpilot -- review-watchlist --project ${projectKey}`;
  }

  const topRepo = manifest.selection?.selected?.[0]?.repoRef ?? null;
  const highlight =
    blocker
    ?? (topRepo ? `Top handoff candidate: ${topRepo}.` : "Handoff recorded without a selected repository.");

  return {
    stageKey: "handoff",
    artifactId: manifest.handoffId ?? artifact.artifactId,
    generatedAt: artifact.generatedAt,
    relativeDir: artifact.relativeDir,
    decisionStatus,
    nextCommand,
    blocker,
    highlight,
    summaryLine: `handoff=${manifest.handoffId ?? artifact.artifactId} :: selected=${selectionCount} :: review_items=${reviewItems} :: on_demand=${manifest.onDemandResult?.runId ?? "-"}`
  };
}

function buildCurationStage(projectKey, artifact) {
  const manifest = artifact.manifest ?? {};
  const curation = manifest.curation ?? {};
  const curatedCandidates = curation.curatedCandidates ?? [];
  const curatedCount = curation.curatedCount ?? curatedCandidates.length;
  const observeOnlyCount = curatedCandidates.filter((item) => item.reviewDisposition === "observe_only").length;
  const decisionStatus =
    curation.decisionStatus
    ?? (curatedCount === 0 ? "no_queue_backed_candidates" : observeOnlyCount > 0 ? "prepare_only" : "ready_for_promotion");
  const nextCommand = normalizeCommand(
    projectKey,
    curation.nextCommand ?? (curatedCount === 0 ? "policy-handoff" : "policy-curation-batch-review")
  );
  const blocker =
    decisionStatus === "no_queue_backed_candidates"
      ? "No queue-backed candidates are ready for curation."
      : observeOnlyCount > 0
        ? `${observeOnlyCount} curated candidate(s) still carry observe_only disposition.`
        : null;
  const topRepo = curatedCandidates[0]?.repoRef ?? null;
  const highlight =
    blocker
    ?? (topRepo ? `Top curated candidate: ${topRepo}.` : "Curation recorded without a leading candidate.");

  return {
    stageKey: "curation",
    artifactId: manifest.curationId ?? artifact.artifactId,
    generatedAt: artifact.generatedAt,
    relativeDir: artifact.relativeDir,
    decisionStatus,
    nextCommand,
    blocker,
    highlight,
    summaryLine: `curation=${manifest.curationId ?? artifact.artifactId} :: curated=${curatedCount} :: observe_only=${observeOnlyCount} :: promotion_run=${manifest.promotionRun?.runId ?? "-"}`
  };
}

function buildApplyReviewStage(projectKey, artifact) {
  const manifest = artifact.manifest ?? {};
  const review = manifest.review ?? {};
  const rows = review.rows ?? [];
  const observeOnlyCount = rows.filter((row) => row.reviewDisposition === "observe_only").length;
  const decisionStatus = inferApplyReviewDecisionStatus(review);
  const nextCommand = normalizeCommand(
    projectKey,
    review.nextCommand ?? (decisionStatus === "no_candidates" ? "policy-curate" : "policy-curation-apply")
  );
  const blocker =
    decisionStatus === "no_candidates"
      ? "No curated candidates are selected for apply review."
      : decisionStatus === "apply_with_care"
        ? `${observeOnlyCount} selected candidate(s) still require careful manual apply handling.`
        : null;
  const topRepo = rows[0]?.repoRef ?? null;
  const highlight =
    blocker
    ?? (topRepo ? `Current apply-review focus: ${topRepo}.` : "Apply review recorded without selected candidates.");

  return {
    stageKey: "apply_review",
    artifactId: manifest.reviewId ?? artifact.artifactId,
    generatedAt: artifact.generatedAt,
    relativeDir: artifact.relativeDir,
    decisionStatus,
    nextCommand,
    blocker,
    highlight,
    summaryLine: `apply_review=${manifest.reviewId ?? artifact.artifactId} :: selected=${review.candidateCount ?? rows.length} :: observe_only=${observeOnlyCount}`
  };
}

function buildApplyStage(projectKey, artifact) {
  const manifest = artifact.manifest ?? {};
  const selected = manifest.selectedCandidates ?? [];
  const observeOnlyCount = selected.filter((item) => item.reviewDisposition === "observe_only").length;
  const decisionStatus =
    selected.length === 0
      ? "applied_no_candidates"
      : observeOnlyCount > 0
        ? "applied_with_care"
        : "applied";
  const nextCommand = `npm run patternpilot -- re-evaluate --project ${projectKey} --stale-only`;
  const blocker =
    observeOnlyCount > 0
      ? `${observeOnlyCount} applied candidate(s) came through an observe_only path and should be monitored after promotion.`
      : null;
  const topRepo = selected[0]?.repoRef ?? null;
  const highlight =
    blocker
    ?? (topRepo ? `Latest applied candidate: ${topRepo}.` : "Apply step recorded without selected candidates.");

  return {
    stageKey: "apply",
    artifactId: manifest.applyId ?? artifact.artifactId,
    generatedAt: artifact.generatedAt,
    relativeDir: artifact.relativeDir,
    decisionStatus,
    nextCommand,
    blocker,
    highlight,
    summaryLine: `apply=${manifest.applyId ?? artifact.artifactId} :: selected=${selected.length} :: applied_items=${manifest.promotionRun?.items?.length ?? 0} :: promotion_run=${manifest.promotionRun?.runId ?? "-"}`
  };
}

function buildStageState(projectKey, artifact) {
  if (!artifact?.manifest) {
    return null;
  }
  switch (artifact.stageKey) {
    case "cycle":
      return buildCycleStage(projectKey, artifact);
    case "handoff":
      return buildHandoffStage(projectKey, artifact);
    case "curation":
      return buildCurationStage(projectKey, artifact);
    case "apply_review":
      return buildApplyReviewStage(projectKey, artifact);
    case "apply":
      return buildApplyStage(projectKey, artifact);
    default:
      return null;
  }
}

function compareStagePriority(left, right) {
  const leftDef = getStageDefinition(left?.stageKey);
  const rightDef = getStageDefinition(right?.stageKey);
  return (rightDef?.rank ?? 0) - (leftDef?.rank ?? 0);
}

function selectCurrentStage(stages) {
  return [...stages].sort((left, right) => {
    const timeDiff = parseTime(right.generatedAt) - parseTime(left.generatedAt);
    if (timeDiff !== 0) {
      return timeDiff;
    }
    return compareStagePriority(left, right);
  })[0] ?? null;
}

function buildApplyRefreshCommand(projectKey, curation) {
  if (curation?.relativeDir) {
    return `npm run patternpilot -- policy-curation-apply --project ${projectKey} --curation-dir ${curation.relativeDir}`;
  }
  return `npm run patternpilot -- policy-curation-apply --project ${projectKey}`;
}

function buildChainWarnings(projectKey, artifacts) {
  const warnings = [];
  const cycle = artifacts.cycle;
  const handoff = artifacts.handoff;
  const curation = artifacts.curation;
  const applyReview = artifacts.apply_review;
  const apply = artifacts.apply;

  if (cycle?.manifest && handoff?.manifest && handoff.manifest.cycleId && handoff.manifest.cycleId !== cycle.artifactId) {
    warnings.push({
      stageKey: "handoff",
      message: `Latest handoff still points to cycle ${handoff.manifest.cycleId}, not latest cycle ${cycle.artifactId}.`,
      nextCommand: `npm run patternpilot -- policy-handoff --project ${projectKey} --cycle-dir ${cycle.relativeDir}`
    });
  }
  if (handoff?.manifest && curation?.manifest && curation.manifest.handoffId && curation.manifest.handoffId !== handoff.artifactId) {
    warnings.push({
      stageKey: "curation",
      message: `Latest curation still points to handoff ${curation.manifest.handoffId}, not latest handoff ${handoff.artifactId}.`,
      nextCommand: `npm run patternpilot -- policy-curate --project ${projectKey} --handoff-dir ${handoff.relativeDir}`
    });
  }
  if (curation?.manifest && applyReview?.manifest && applyReview.manifest.curationId && applyReview.manifest.curationId !== curation.artifactId) {
    warnings.push({
      stageKey: "apply_review",
      message: `Latest apply review still points to curation ${applyReview.manifest.curationId}, not latest curation ${curation.artifactId}.`,
      nextCommand: `npm run patternpilot -- policy-curation-review --project ${projectKey} --curation-dir ${curation.relativeDir}`
    });
  }
  if (applyReview?.manifest && apply?.manifest && apply.manifest.reviewId && apply.manifest.reviewId !== applyReview.artifactId) {
    warnings.push({
      stageKey: "apply",
      message: `Latest apply still points to review ${apply.manifest.reviewId}, not latest apply review ${applyReview.artifactId}.`,
      nextCommand: buildApplyRefreshCommand(projectKey, curation)
    });
  }

  return warnings;
}

export async function loadPolicyStageArtifact(rootDir, stageKey, relativeDir) {
  const definition = getStageDefinition(stageKey);
  if (!definition) {
    throw new Error(`Unknown policy stage '${stageKey}'.`);
  }
  const absoluteDir = path.resolve(rootDir, relativeDir);
  const manifestText = await safeReadText(path.join(absoluteDir, "manifest.json"));
  const manifest = manifestText ? JSON.parse(manifestText) : null;
  const artifactId = manifest?.[definition.idField] ?? path.basename(absoluteDir);
  return {
    stageKey,
    artifactId,
    absoluteDir,
    relativeDir: asRelativeFromRoot(rootDir, absoluteDir),
    generatedAt: manifest?.generatedAt ?? artifactId,
    manifest
  };
}

export async function findLatestPolicyStageArtifact(rootDir, projectKey, stageKey) {
  const definition = getStageDefinition(stageKey);
  if (!definition) {
    throw new Error(`Unknown policy stage '${stageKey}'.`);
  }
  const stageRoot = path.join(rootDir, "projects", projectKey, "calibration", definition.dirName);
  const artifactId = (await safeReadDirEntries(stageRoot))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .reverse()[0];

  if (!artifactId) {
    return null;
  }

  const relativeDir = asRelativeFromRoot(rootDir, path.join(stageRoot, artifactId));
  return loadPolicyStageArtifact(rootDir, stageKey, relativeDir);
}

export function buildPolicyControlReview({
  projectKey = "project",
  cycle = null,
  handoff = null,
  curation = null,
  applyReview = null,
  apply = null
}) {
  const artifacts = {
    cycle,
    handoff,
    curation,
    apply_review: applyReview,
    apply
  };
  const stages = Object.values(artifacts)
    .map((artifact) => buildStageState(projectKey, artifact))
    .filter(Boolean)
    .sort((left, right) => {
      const leftDef = getStageDefinition(left.stageKey);
      const rightDef = getStageDefinition(right.stageKey);
      return (leftDef?.rank ?? 0) - (rightDef?.rank ?? 0);
    });
  const chainWarnings = buildChainWarnings(projectKey, artifacts);
  const currentStage = selectCurrentStage(stages);

  let overallStatus = "no_policy_activity";
  let nextCommand = `npm run patternpilot -- policy-cycle --project ${projectKey}`;
  let topBlocker = "No policy calibration artifacts found yet.";

  if (chainWarnings.length > 0) {
    overallStatus = "chain_refresh_recommended";
    nextCommand = chainWarnings[0].nextCommand;
    topBlocker = chainWarnings[0].message;
  } else if (currentStage) {
    overallStatus =
      currentStage.stageKey === "apply"
        ? currentStage.decisionStatus === "applied_with_care"
          ? "followup_with_care"
          : "followup_ready"
        : currentStage.decisionStatus;
    nextCommand = currentStage.nextCommand;
    topBlocker =
      currentStage.blocker
      ?? currentStage.highlight
      ?? "Continue with the recommended next step.";
  }

  const recommendations = stages
    .map((stage) => stage.highlight)
    .filter(Boolean)
    .slice(0, 5);
  const posture = describePolicyControlOperatingPosture({ overallStatus });

  return {
    projectKey,
    overallStatus,
    operatingPosture: posture.postureKey,
    operatorMode: posture.operatorMode,
    operatorSummary: posture.summary,
    currentStageKey: currentStage?.stageKey ?? null,
    currentDecisionStatus: currentStage?.decisionStatus ?? null,
    nextCommand,
    topBlocker,
    chainWarnings,
    stageCount: stages.length,
    stages,
    recommendations
  };
}

export function renderPolicyControlSummary({
  projectKey,
  controlId,
  generatedAt,
  review,
  dryRun = false
}) {
  const posture = describePolicyControlOperatingPosture(review);
  const stageLines = review.stages.length > 0
    ? review.stages.map((stage) =>
      `- ${stage.stageKey} :: ${stage.decisionStatus} :: ${stage.summaryLine} :: dir=${stage.relativeDir}`
    ).join("\n")
    : "- none";
  const chainWarningLines = review.chainWarnings.length > 0
    ? review.chainWarnings.map((warning) => `- ${warning.message}`).join("\n")
    : "- none";
  const recommendationLines = review.recommendations.length > 0
    ? review.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot Policy Control

- project: ${projectKey}
- control_id: ${controlId}
- generated_at: ${generatedAt}
- overall_status: ${review.overallStatus}
- operating_posture: ${review.operatingPosture ?? posture.postureKey}
- operator_mode: ${review.operatorMode ?? posture.operatorMode}
- current_stage: ${review.currentStageKey ?? "-"}
- current_decision_status: ${review.currentDecisionStatus ?? "-"}
- known_stages: ${review.stageCount}
- dry_run: ${dryRun ? "yes" : "no"}

## Current Focus

- top_blocker: ${review.topBlocker}
- next_command: ${review.nextCommand}
- posture_summary: ${review.operatorSummary ?? posture.summary}

## Stage Snapshot

${stageLines}

## Chain Warnings

${chainWarningLines}

## Highlights

${recommendationLines}
`;
}
