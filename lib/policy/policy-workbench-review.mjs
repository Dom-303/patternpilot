import fs from "node:fs/promises";
import path from "node:path";
import { safeReadDirEntries, safeReadText, asRelativeFromRoot } from "../utils.mjs";
import { buildDiscoveryPolicyComparisonReport } from "./discovery-policy-compare.mjs";

const CANONICAL_VERDICTS = new Map([
  ["false_block", "false_block"],
  ["unblock", "false_block"],
  ["keep_visible", "false_block"],
  ["confirm_block", "confirm_block"],
  ["keep_block", "confirm_block"],
  ["blocked_ok", "confirm_block"],
  ["good_prefer", "good_prefer"],
  ["prefer_keep", "good_prefer"],
  ["strong_match", "good_prefer"],
  ["noise_visible", "noise_visible"],
  ["too_noisy", "noise_visible"],
  ["should_hide", "noise_visible"],
  ["needs_review", "needs_review"],
  ["unsure", "needs_review"]
]);

function canonicalizeVerdict(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  return CANONICAL_VERDICTS.get(normalized) ?? normalized;
}

function aggregateVerdicts(rows = []) {
  const counts = new Map();
  for (const row of rows) {
    const verdict = canonicalizeVerdict(row.manualVerdict);
    if (!verdict) {
      continue;
    }
    counts.set(verdict, (counts.get(verdict) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([verdict, count]) => ({ verdict, count }));
}

export async function findLatestPolicyWorkbench(rootDir, projectKey) {
  const workbenchRoot = path.join(rootDir, "projects", projectKey, "calibration", "workbench");
  const entries = await safeReadDirEntries(workbenchRoot);
  const dirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort().reverse();
  const workbenchId = dirs[0];
  if (!workbenchId) {
    return null;
  }
  const workbenchDir = path.join(workbenchRoot, workbenchId);
  return {
    workbenchId,
    workbenchDir,
    relativeWorkbenchDir: asRelativeFromRoot(rootDir, workbenchDir)
  };
}

export async function loadPolicyWorkbench(rootDir, workbenchDir) {
  const absoluteDir = path.resolve(rootDir, workbenchDir);
  const manifest = JSON.parse(await fs.readFile(path.join(absoluteDir, "manifest.json"), "utf8"));
  const rows = JSON.parse(await fs.readFile(path.join(absoluteDir, "rows.json"), "utf8"));
  const currentPolicy = JSON.parse(await fs.readFile(path.join(absoluteDir, "current-policy.json"), "utf8"));
  const proposedPolicyRaw = await safeReadText(path.join(absoluteDir, "proposed-policy.json"));
  const proposedPolicy = proposedPolicyRaw ? JSON.parse(proposedPolicyRaw) : null;

  return {
    workbenchDir: absoluteDir,
    relativeWorkbenchDir: asRelativeFromRoot(rootDir, absoluteDir),
    manifest,
    rows,
    currentPolicy,
    proposedPolicy
  };
}

export function buildPolicyWorkbenchReview({ rows = [], sourceRecord = null, currentPolicy = null, proposedPolicy = null }) {
  const verdictCounts = aggregateVerdicts(rows);
  const rowsWithVerdict = rows.filter((row) => canonicalizeVerdict(row.manualVerdict));
  const repoRefsByVerdict = Object.fromEntries(
    verdictCounts.map(({ verdict }) => [
      verdict,
      rows
        .filter((row) => canonicalizeVerdict(row.manualVerdict) === verdict)
        .map((row) => row.repoRef)
    ])
  );

  const recommendations = [];
  const falseBlockCount = verdictCounts.find((item) => item.verdict === "false_block")?.count ?? 0;
  const confirmBlockCount = verdictCounts.find((item) => item.verdict === "confirm_block")?.count ?? 0;
  const noiseVisibleCount = verdictCounts.find((item) => item.verdict === "noise_visible")?.count ?? 0;
  const goodPreferCount = verdictCounts.find((item) => item.verdict === "good_prefer")?.count ?? 0;

  if (rows.length === 0) {
    recommendations.push("Workbench has no candidate rows yet.");
  } else if (rowsWithVerdict.length === 0) {
    recommendations.push("No manual verdicts recorded yet; annotate rows.json before applying policy changes.");
  } else {
    if (falseBlockCount > 0) {
      recommendations.push(`There are ${falseBlockCount} rows marked false_block; soften or narrow the responsible gates before applying.`);
    }
    if (confirmBlockCount > 0) {
      recommendations.push(`There are ${confirmBlockCount} rows marked confirm_block; these blockers are likely worth keeping hard.`);
    }
    if (noiseVisibleCount > 0) {
      recommendations.push(`There are ${noiseVisibleCount} rows marked noise_visible; check whether the proposed policy is still too permissive.`);
    }
    if (goodPreferCount > 0) {
      recommendations.push(`There are ${goodPreferCount} rows marked good_prefer; preserve those prefer-signals in the next policy version.`);
    }
  }

  let comparison = null;
  if (sourceRecord && currentPolicy && proposedPolicy) {
    comparison = buildDiscoveryPolicyComparisonReport([sourceRecord], currentPolicy, proposedPolicy);
    if (comparison.delta.enforceHidden > 0) {
      recommendations.push(`Proposed policy would hide ${comparison.delta.enforceHidden} more candidate slots on the source run.`);
    } else if (comparison.delta.enforceHidden < 0) {
      recommendations.push(`Proposed policy would reveal ${Math.abs(comparison.delta.enforceHidden)} additional candidate slots on the source run.`);
    }
  }

  return {
    rowCount: rows.length,
    rowsWithVerdict: rowsWithVerdict.length,
    verdictCounts,
    repoRefsByVerdict,
    recommendations: recommendations.slice(0, 8),
    comparison
  };
}

export function renderPolicyWorkbenchReviewSummary({
  projectKey,
  workbenchId,
  sourceRunId,
  review
}) {
  const verdictLines = review.verdictCounts.length > 0
    ? review.verdictCounts.map((item) => `- ${item.verdict}: ${item.count}`).join("\n")
    : "- none";
  const recommendationLines = review.recommendations.length > 0
    ? review.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";
  const comparisonLines = review.comparison
    ? [
        `- delta_audit_flagged: ${review.comparison.delta.auditFlagged}`,
        `- delta_enforce_hidden: ${review.comparison.delta.enforceHidden}`,
        `- delta_preferred_hits: ${review.comparison.delta.auditPreferred}`
      ].join("\n")
    : "- none";

  return `# Patternpilot Policy Workbench Review

- project: ${projectKey}
- workbench_id: ${workbenchId}
- source_run: ${sourceRunId ?? "-"}
- rows: ${review.rowCount}
- rows_with_verdict: ${review.rowsWithVerdict}

## Verdict Counts

${verdictLines}

## Proposed Policy Comparison

${comparisonLines}

## Recommendations

${recommendationLines}
`;
}
