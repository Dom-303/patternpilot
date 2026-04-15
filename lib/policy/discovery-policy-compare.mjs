import fs from "node:fs/promises";
import path from "node:path";
import { defaultDiscoveryPolicy } from "./discovery-policy.mjs";
import { buildDiscoveryPolicyReview } from "./discovery-policy-review.mjs";

function toNumber(value) {
  return Number(value ?? 0) || 0;
}

function reviewMetrics(review) {
  return {
    sourceCandidates: toNumber(review.sourceCandidateCount),
    auditFlagged: toNumber(review.audit?.policySummary?.blocked),
    auditPreferred: toNumber(review.audit?.policySummary?.preferred),
    auditStatus: review.audit?.policyCalibration?.status ?? "unknown",
    enforceHidden: toNumber(review.enforce?.policySummary?.enforcedBlocked),
    enforcePreferred: toNumber(review.enforce?.policySummary?.preferred),
    enforceStatus: review.enforce?.policyCalibration?.status ?? "unknown"
  };
}

export async function loadDiscoveryPolicyFromFile(rootDir, projectKey, filePath) {
  const absolutePath = path.resolve(rootDir, filePath);
  const raw = await fs.readFile(absolutePath, "utf8");
  return {
    ...defaultDiscoveryPolicy(projectKey),
    ...JSON.parse(raw)
  };
}

export function buildDiscoveryPolicyComparisonReport(records = [], baselinePolicy, candidatePolicy) {
  const runs = records.map((record) => {
    const baselineReview = buildDiscoveryPolicyReview(record.manifest.discovery, baselinePolicy);
    const candidateReview = buildDiscoveryPolicyReview(record.manifest.discovery, candidatePolicy);
    const baseline = reviewMetrics(baselineReview);
    const candidate = reviewMetrics(candidateReview);
    const delta = {
      auditFlagged: candidate.auditFlagged - baseline.auditFlagged,
      auditPreferred: candidate.auditPreferred - baseline.auditPreferred,
      enforceHidden: candidate.enforceHidden - baseline.enforceHidden
    };

    return {
      runId: record.runId,
      manifestPath: record.relativeManifestPath,
      sourceCandidates: baseline.sourceCandidates,
      baseline,
      candidate,
      delta,
      changed:
        delta.auditFlagged !== 0 ||
        delta.auditPreferred !== 0 ||
        delta.enforceHidden !== 0 ||
        baseline.auditStatus !== candidate.auditStatus ||
        baseline.enforceStatus !== candidate.enforceStatus
    };
  });

  const total = (selector) => runs.reduce((sum, run) => sum + selector(run), 0);
  const reviewedRuns = runs.length;
  const changedRuns = runs.filter((run) => run.changed).length;
  const sourceCandidates = total((run) => run.sourceCandidates);
  const baseline = {
    auditFlagged: total((run) => run.baseline.auditFlagged),
    auditPreferred: total((run) => run.baseline.auditPreferred),
    enforceHidden: total((run) => run.baseline.enforceHidden)
  };
  const candidate = {
    auditFlagged: total((run) => run.candidate.auditFlagged),
    auditPreferred: total((run) => run.candidate.auditPreferred),
    enforceHidden: total((run) => run.candidate.enforceHidden)
  };
  const delta = {
    auditFlagged: candidate.auditFlagged - baseline.auditFlagged,
    auditPreferred: candidate.auditPreferred - baseline.auditPreferred,
    enforceHidden: candidate.enforceHidden - baseline.enforceHidden
  };

  const recommendations = [];
  if (reviewedRuns === 0) {
    recommendations.push("No saved discovery runs were found for this project.");
  } else if (sourceCandidates === 0) {
    recommendations.push("Compared runs exist, but none contain candidates yet; use the comparison packet after a real discovery pass.");
  } else if (changedRuns === 0) {
    recommendations.push("The candidate policy produces no observable difference on the reviewed runs.");
  } else {
    if (delta.enforceHidden > 0) {
      recommendations.push(`Candidate policy would hide ${delta.enforceHidden} more candidate slots in enforce mode.`);
    } else if (delta.enforceHidden < 0) {
      recommendations.push(`Candidate policy would reveal ${Math.abs(delta.enforceHidden)} candidate slots that the current policy would hide.`);
    }
    if (delta.auditFlagged > 0) {
      recommendations.push(`Candidate policy flags ${delta.auditFlagged} more candidate slots in audit mode.`);
    } else if (delta.auditFlagged < 0) {
      recommendations.push(`Candidate policy flags ${Math.abs(delta.auditFlagged)} fewer candidate slots in audit mode.`);
    }
    if (delta.auditPreferred > 0) {
      recommendations.push(`Candidate policy marks ${delta.auditPreferred} additional preferred hits.`);
    } else if (delta.auditPreferred < 0) {
      recommendations.push(`Candidate policy loses ${Math.abs(delta.auditPreferred)} preferred hits compared with the current policy.`);
    }
  }

  return {
    reviewedRuns,
    changedRuns,
    sourceCandidates,
    baseline,
    candidate,
    delta,
    recommendations: recommendations.slice(0, 6),
    runs
  };
}

export function renderDiscoveryPolicyComparisonReport({
  projectKey,
  generatedAt,
  limit,
  candidatePolicyPath,
  report
}) {
  const recommendationLines = report.recommendations.length > 0
    ? report.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";
  const runLines = report.runs.length > 0
    ? report.runs.map((run) =>
      `- ${run.runId} :: candidates=${run.sourceCandidates} :: changed=${run.changed ? "yes" : "no"} :: delta_hidden=${run.delta.enforceHidden} :: delta_flagged=${run.delta.auditFlagged} :: delta_preferred=${run.delta.auditPreferred}`
    ).join("\n")
    : "- none";

  return `# Patternpilot Discovery Policy Comparison

- project: ${projectKey}
- generated_at: ${generatedAt}
- reviewed_runs: ${report.reviewedRuns}
- changed_runs: ${report.changedRuns}
- source_candidates: ${report.sourceCandidates}
- limit: ${limit ?? "all"}
- candidate_policy: ${candidatePolicyPath}

## Baseline Totals

- audit_flagged: ${report.baseline.auditFlagged}
- enforce_hidden: ${report.baseline.enforceHidden}
- preferred_hits: ${report.baseline.auditPreferred}

## Candidate Totals

- audit_flagged: ${report.candidate.auditFlagged}
- enforce_hidden: ${report.candidate.enforceHidden}
- preferred_hits: ${report.candidate.auditPreferred}

## Delta

- audit_flagged_delta: ${report.delta.auditFlagged}
- enforce_hidden_delta: ${report.delta.enforceHidden}
- preferred_hits_delta: ${report.delta.auditPreferred}

## Recommendations

${recommendationLines}

## Reviewed Runs

${runLines}
`;
}
