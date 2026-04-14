import fs from "node:fs/promises";
import path from "node:path";
import { safeReadDirEntries, safeStat, asRelativeFromRoot } from "./utils.mjs";
import { buildDiscoveryPolicyReview } from "./discovery-policy-review.mjs";

export async function listDiscoveryManifests(rootDir, config, projectKey) {
  const runsRoot = path.join(rootDir, config.runtimeRoot ?? "runs", projectKey);
  const entries = await safeReadDirEntries(runsRoot);
  const manifests = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const manifestPath = path.join(runsRoot, entry.name, "manifest.json");
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      const manifest = JSON.parse(raw);
      if (!manifest.discovery) {
        continue;
      }
      const stat = await safeStat(manifestPath);
      manifests.push({
        runId: manifest.runId ?? entry.name,
        manifestPath,
        relativeManifestPath: asRelativeFromRoot(rootDir, manifestPath),
        manifest,
        modifiedAt: stat?.mtime?.toISOString?.() ?? manifest.createdAt ?? ""
      });
    } catch {
      // ignore malformed manifests
    }
  }

  manifests.sort((left, right) => {
    const modifiedDiff = right.modifiedAt.localeCompare(left.modifiedAt);
    if (modifiedDiff !== 0) {
      return modifiedDiff;
    }
    return right.runId.localeCompare(left.runId);
  });

  return manifests;
}

function sumCounts(entries = []) {
  return entries.reduce((sum, entry) => sum + (Number(entry?.count ?? 0) || 0), 0);
}

function aggregateCounts(values = []) {
  const counts = new Map();
  for (const value of values) {
    if (!value) {
      continue;
    }
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .map(([value, count]) => ({ value, count }));
}

export function buildDiscoveryPolicyCalibrationReport(records = [], discoveryPolicy) {
  const runs = records.map((record) => {
    const review = buildDiscoveryPolicyReview(record.manifest.discovery, discoveryPolicy);
    return {
      runId: record.runId,
      manifestPath: record.relativeManifestPath,
      createdAt: record.manifest.createdAt ?? null,
      sourceCandidateCount: review.sourceCandidateCount,
      audit: review.audit,
      enforce: review.enforce,
      hiddenByEnforce: review.hiddenByEnforce
    };
  });

  const reviewedRuns = runs.length;
  const runsWithCandidates = runs.filter((run) => run.sourceCandidateCount > 0).length;
  const sourceCandidates = runs.reduce((sum, run) => sum + run.sourceCandidateCount, 0);
  const auditFlagged = runs.reduce((sum, run) => sum + (run.audit.policySummary?.blocked ?? 0), 0);
  const enforceHidden = runs.reduce((sum, run) => sum + (run.enforce.policySummary?.enforcedBlocked ?? 0), 0);
  const preferredHits = runs.reduce((sum, run) => sum + (run.audit.policySummary?.preferred ?? 0), 0);

  const blockerCounts = aggregateCounts(
    runs.flatMap((run) =>
      (run.audit.policySummary?.blockerCounts ?? []).flatMap((entry) =>
        Array.from({ length: Number(entry.count ?? 0) || 0 }, () => entry.value)
      )
    )
  );
  const auditStatusCounts = aggregateCounts(runs.map((run) => run.audit.policyCalibration?.status ?? "unknown"));
  const enforceStatusCounts = aggregateCounts(runs.map((run) => run.enforce.policyCalibration?.status ?? "unknown"));

  const recommendations = [];
  if (reviewedRuns === 0) {
    recommendations.push("No saved discovery runs were found for this project.");
  } else if (runsWithCandidates === 0) {
    recommendations.push("Saved discovery runs exist, but none contain candidates yet; run real discovery before tuning project defaults.");
  } else {
    if (enforceHidden > 0) {
      recommendations.push(`Current policy would hide ${enforceHidden} candidate slots across reviewed runs; compare audit versus enforce before tightening more gates.`);
    }
    if (auditFlagged === 0) {
      recommendations.push("Current policy flagged none of the reviewed candidate slots; it may still be too permissive for noisy discovery.");
    }
    if (preferredHits === 0) {
      recommendations.push("No preference hits were observed across reviewed runs; derive prefer-signals from the strongest real matches.");
    }
    if (blockerCounts[0]) {
      recommendations.push(`Top blocker to inspect next: ${blockerCounts[0].value} (${blockerCounts[0].count} hits across reviewed runs).`);
    }
  }

  return {
    reviewedRuns,
    runsWithCandidates,
    sourceCandidates,
    auditFlagged,
    enforceHidden,
    preferredHits,
    blockerCounts,
    auditStatusCounts,
    enforceStatusCounts,
    recommendations: recommendations.slice(0, 6),
    runs
  };
}

export function renderDiscoveryPolicyCalibrationReport({
  projectKey,
  generatedAt,
  limit,
  report
}) {
  const blockerLines = report.blockerCounts.length > 0
    ? report.blockerCounts.slice(0, 10).map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const auditStatusLines = report.auditStatusCounts.length > 0
    ? report.auditStatusCounts.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const enforceStatusLines = report.enforceStatusCounts.length > 0
    ? report.enforceStatusCounts.map((item) => `- ${item.value}: ${item.count}`).join("\n")
    : "- none";
  const recommendationLines = report.recommendations.length > 0
    ? report.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";
  const runLines = report.runs.length > 0
    ? report.runs.map((run) => `- ${run.runId} :: candidates=${run.sourceCandidateCount} :: audit=${run.audit.policyCalibration?.status ?? "unknown"} :: enforce=${run.enforce.policyCalibration?.status ?? "unknown"} :: hidden=${run.enforce.policySummary?.enforcedBlocked ?? 0}`).join("\n")
    : "- none";

  return `# Patternpilot Discovery Policy Calibration

- project: ${projectKey}
- generated_at: ${generatedAt}
- reviewed_runs: ${report.reviewedRuns}
- runs_with_candidates: ${report.runsWithCandidates}
- source_candidates: ${report.sourceCandidates}
- limit: ${limit ?? "all"}

## Aggregate Signals

- audit_flagged: ${report.auditFlagged}
- enforce_hidden: ${report.enforceHidden}
- preferred_hits: ${report.preferredHits}

## Top Blockers

${blockerLines}

## Audit Statuses

${auditStatusLines}

## Enforce Statuses

${enforceStatusLines}

## Recommendations

${recommendationLines}

## Reviewed Runs

${runLines}
`;
}
