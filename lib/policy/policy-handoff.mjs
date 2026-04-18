import fs from "node:fs/promises";
import path from "node:path";
import { asRelativeFromRoot, safeReadDirEntries, safeReadText } from "../utils.mjs";

export async function findLatestPolicyCycle(rootDir, projectKey) {
  const cycleRoot = path.join(rootDir, "projects", projectKey, "calibration", "cycles");
  const entries = await safeReadDirEntries(cycleRoot);
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  const cycleId = dirs[0];
  if (!cycleId) {
    return null;
  }
  const cycleDir = path.join(cycleRoot, cycleId);
  return {
    cycleId,
    cycleDir,
    relativeCycleDir: asRelativeFromRoot(rootDir, cycleDir)
  };
}

export async function loadPolicyCycle(rootDir, cycleDir) {
  const absoluteDir = path.resolve(rootDir, cycleDir);
  const manifest = JSON.parse(await fs.readFile(path.join(absoluteDir, "manifest.json"), "utf8"));
  const trialRows = JSON.parse(await fs.readFile(path.join(absoluteDir, "trial-candidate-matrix.json"), "utf8"));
  const replayRaw = await safeReadText(path.join(absoluteDir, "replay-manifest.json"));
  const replayManifest = replayRaw ? JSON.parse(replayRaw) : null;

  return {
    cycleDir: absoluteDir,
    relativeCycleDir: asRelativeFromRoot(rootDir, absoluteDir),
    manifest,
    trialRows,
    replayManifest
  };
}

function replayCandidateUrl(candidate) {
  return candidate?.repo?.normalizedRepoUrl
    ?? candidate?.repoUrl
    ?? candidate?.normalizedRepoUrl
    ?? candidate?.url
    ?? "";
}

function replayCandidateRef(candidate) {
  return candidate?.repo?.fullName
    ?? candidate?.full_name
    ?? candidate?.repoRef
    ?? candidate?.repo?.normalizedRepoUrl
    ?? "unknown";
}

function replayCandidateFitScore(candidate) {
  return Number(candidate?.projectAlignment?.fitScore ?? candidate?.projectFitScore ?? 0) || 0;
}

function replayCandidateFitBand(candidate) {
  return candidate?.projectAlignment?.fitBand ?? candidate?.projectFitBand ?? "unknown";
}

function uniqueByUrl(items = []) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    if (!item.url || seen.has(item.url)) {
      continue;
    }
    seen.add(item.url);
    out.push(item);
  }
  return out;
}

function sortSelectedCandidates(items = []) {
  return [...items].sort((left, right) => {
    const fitDiff = (right.fitScore ?? 0) - (left.fitScore ?? 0);
    if (fitDiff !== 0) {
      return fitDiff;
    }
    return String(left.repoRef ?? "").localeCompare(String(right.repoRef ?? ""));
  });
}

function buildPolicyHandoffNextCommand({ projectKey, cycleId, selection, onDemandResult, dryRun }) {
  if ((selection?.count ?? 0) === 0) {
    return `npm run patternpilot -- policy-workbench-review --project ${projectKey}`;
  }
  if (!onDemandResult) {
    return `npm run patternpilot -- policy-handoff --project ${projectKey} --cycle-dir projects/${projectKey}/calibration/cycles/${cycleId}${dryRun ? " --dry-run" : ""}`;
  }
  if ((onDemandResult?.reviewRun?.review?.items?.length ?? 0) > 0) {
    return `npm run patternpilot -- promote --project ${projectKey} --from-status pending_review`;
  }
  return `npm run patternpilot -- review-watchlist --project ${projectKey}`;
}

export function selectPolicyHandoffCandidates({
  scope = "newly_visible",
  trialRows = [],
  replayManifest = null
}) {
  let selected = [];

  if (scope === "replay_visible") {
    selected = uniqueByUrl(
      (replayManifest?.candidates ?? []).map((candidate) => ({
        repoRef: replayCandidateRef(candidate),
        url: replayCandidateUrl(candidate),
        reason: "replay_visible",
        fitScore: replayCandidateFitScore(candidate),
        fitBand: replayCandidateFitBand(candidate)
      }))
    );
  } else if (scope === "changed_rows") {
    selected = uniqueByUrl(
      trialRows
        .filter((row) => row.changed)
        .map((row) => ({
          repoRef: row.repoRef,
          url: row.repoUrl,
          reason: row.visibilityChange ?? "changed",
          fitScore: Number(row.fitScore ?? 0) || 0,
          fitBand: row.fitBand ?? "unknown"
        }))
    );
  } else {
    selected = uniqueByUrl(
      trialRows
        .filter((row) => row.visibilityChange === "newly_visible")
        .map((row) => ({
          repoRef: row.repoRef,
          url: row.repoUrl,
          reason: "newly_visible",
          fitScore: Number(row.fitScore ?? 0) || 0,
          fitBand: row.fitBand ?? "unknown"
        }))
    );
    scope = "newly_visible";
  }
  selected = sortSelectedCandidates(selected);

  const recommendations = [];
  if (selected.length === 0 && scope === "newly_visible") {
    recommendations.push("No newly visible candidates were found in this cycle; try scope=replay_visible if you want all replay-visible repos.");
  }
  if (selected.length === 0 && scope === "replay_visible") {
    recommendations.push("Replay manifest has no visible candidates, so there is nothing to hand off yet.");
  }
  if (selected.length > 0 && scope === "newly_visible") {
    recommendations.push(`Use the ${selected.length} newly visible repo(s) as the focused bridge into intake and review.`);
  }
  if (selected.length > 0 && scope === "replay_visible") {
    recommendations.push(`Use the full replay-visible set of ${selected.length} repo(s) when you want a broader handoff into the normal review path.`);
  }
  if (selected.length > 0 && selected[0].fitBand === "high") {
    recommendations.push(`Start with the highest-fit candidate first: ${selected[0].repoRef}.`);
  }

  return {
    scope,
    count: selected.length,
    urls: selected.map((item) => item.url),
    repoRefs: selected.map((item) => item.repoRef),
    selected,
    recommendations
  };
}

export function renderPolicyHandoffSummary({
  projectKey,
  handoffId,
  generatedAt,
  cycleId,
  workbenchId,
  scope,
  selection,
  onDemandResult = null,
  dryRun = false
}) {
  const decisionStatus =
    (selection?.count ?? 0) === 0 ? "no_candidates_selected"
      : !onDemandResult ? "ready_for_on_demand"
        : (onDemandResult?.reviewRun?.review?.items?.length ?? 0) > 0 ? "handoff_review_ready"
          : "handoff_executed";
  const nextCommand = buildPolicyHandoffNextCommand({
    projectKey,
    cycleId,
    selection,
    onDemandResult,
    dryRun
  });
  const nextLines = [
    ...(selection?.recommendations ?? []),
    ...(onDemandResult?.reviewRun?.review?.topItems?.[0]?.repoRef
      ? [`Review top item after handoff: ${onDemandResult.reviewRun.review.topItems[0].repoRef}.`]
      : [])
  ];

  return `# Patternpilot Policy Handoff

- project: ${projectKey}
- handoff_id: ${handoffId}
- generated_at: ${generatedAt}
- cycle_id: ${cycleId}
- workbench_id: ${workbenchId ?? "-"}
- scope: ${scope}
- selected_repos: ${selection?.count ?? 0}
- decision_status: ${decisionStatus}
- on_demand_run: ${onDemandResult?.runId ?? "-"}
- on_demand_effective_urls: ${onDemandResult?.effectiveUrls?.length ?? 0}
- review_items: ${onDemandResult?.reviewRun?.review?.items?.length ?? 0}
- promotion_items: ${onDemandResult?.promoteRun?.items?.length ?? 0}
- dry_run: ${dryRun ? "yes" : "no"}

## Selected Repositories

${selection?.selected?.length ? selection.selected.map((item) => `- ${item.repoRef} :: ${item.reason} :: fit=${item.fitBand ?? "unknown"}/${item.fitScore ?? 0} :: ${item.url}`).join("\n") : "- none"}

## Next Moves

${nextLines.length ? nextLines.map((item) => `- ${item}`).join("\n") : "- none"}

## Next Step

- next_command: ${nextCommand}
`;
}
