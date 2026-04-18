import fs from "node:fs/promises";
import path from "node:path";
import { safeReadDirEntries, safeStat, asRelativeFromRoot } from "../utils.mjs";
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

function pickNextWorkbenchRun(runs = []) {
  const candidates = runs.filter((run) => run.sourceCandidateCount > 0);
  if (candidates.length === 0) {
    return null;
  }
  const sorted = [...candidates].sort((left, right) => {
    const hiddenDiff = (right.enforce.policySummary?.enforcedBlocked ?? 0) - (left.enforce.policySummary?.enforcedBlocked ?? 0);
    if (hiddenDiff !== 0) {
      return hiddenDiff;
    }
    const candidateDiff = right.sourceCandidateCount - left.sourceCandidateCount;
    if (candidateDiff !== 0) {
      return candidateDiff;
    }
    return String(right.runId).localeCompare(String(left.runId));
  });
  const winner = sorted[0];
  return {
    runId: winner.runId,
    manifestPath: winner.manifestPath,
    sourceCandidateCount: winner.sourceCandidateCount,
    hiddenByEnforce: winner.enforce.policySummary?.enforcedBlocked ?? 0,
    blockerStatus: winner.enforce.policyCalibration?.status ?? "unknown"
  };
}

function buildBlockerExamples(runs = [], limit = 3) {
  const examples = new Map();
  for (const run of runs) {
    for (const candidate of run.auditBlocked ?? []) {
      for (const blocker of candidate.blockers ?? []) {
        if (!examples.has(blocker)) {
          examples.set(blocker, []);
        }
        const bucket = examples.get(blocker);
        if (bucket.some((item) => item.repoRef === candidate.repoRef)) {
          continue;
        }
        bucket.push({
          repoRef: candidate.repoRef,
          runId: run.runId,
          fitBand: candidate.fitBand,
          fitScore: candidate.fitScore,
          disposition: candidate.disposition
        });
      }
    }
  }
  return [...examples.entries()].map(([blocker, repos]) => ({
    blocker,
    repos: repos
      .sort((left, right) => (right.fitScore ?? 0) - (left.fitScore ?? 0))
      .slice(0, limit)
  }));
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
      auditBlocked: review.auditBlocked,
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
  const blockerExamples = buildBlockerExamples(runs);
  const nextWorkbenchRun = pickNextWorkbenchRun(runs);
  const nextWorkbenchCommand = nextWorkbenchRun
    ? `npm run patternpilot -- policy-workbench --project ${discoveryPolicy?.projectKey ?? "project"} --run-id ${nextWorkbenchRun.runId}`
    : null;

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
    if (nextWorkbenchRun) {
      recommendations.push(`Best next workbench source is ${nextWorkbenchRun.runId} with ${nextWorkbenchRun.hiddenByEnforce} enforce-hidden candidates.`);
      recommendations.push(`Next command: ${nextWorkbenchCommand}`);
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
    blockerExamples,
    auditStatusCounts,
    enforceStatusCounts,
    nextWorkbenchRun,
    nextWorkbenchCommand,
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
  const blockerExampleLines = report.blockerExamples?.length > 0
    ? report.blockerExamples
      .slice(0, 5)
      .map((item) => `- ${item.blocker}: ${item.repos.map((repo) => `${repo.repoRef} [${repo.runId}] fit=${repo.fitBand}/${repo.fitScore}`).join(" | ") || "-"}`)
      .join("\n")
    : "- none";
  const nextWorkbenchLines = report.nextWorkbenchRun
    ? [
        `- run_id: ${report.nextWorkbenchRun.runId}`,
        `- source_manifest: ${report.nextWorkbenchRun.manifestPath}`,
        `- source_candidates: ${report.nextWorkbenchRun.sourceCandidateCount}`,
        `- enforce_hidden: ${report.nextWorkbenchRun.hiddenByEnforce}`,
        `- calibration_status: ${report.nextWorkbenchRun.blockerStatus}`,
        `- next_command: ${report.nextWorkbenchCommand ?? "-"}`
      ].join("\n")
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

## Blocker Examples

${blockerExampleLines}

## Audit Statuses

${auditStatusLines}

## Enforce Statuses

${enforceStatusLines}

## Recommendations

${recommendationLines}

## Next Workbench Candidate

${nextWorkbenchLines}

## Reviewed Runs

${runLines}
`;
}
