import fs from "node:fs/promises";
import path from "node:path";
import { asRelativeFromRoot, safeReadDirEntries, safeStat } from "./utils.mjs";
import { applyDiscoveryPolicyToCandidates } from "./discovery.mjs";

export function getDiscoveryPolicySourceCandidates(discovery) {
  if (Array.isArray(discovery?.evaluatedCandidates)) {
    return discovery.evaluatedCandidates;
  }
  return Array.isArray(discovery?.candidates) ? discovery.candidates : [];
}

function sourceCandidateCount(discovery) {
  return getDiscoveryPolicySourceCandidates(discovery).length;
}

function candidateRepoRef(candidate) {
  if (candidate?.full_name) {
    return candidate.full_name;
  }
  if (candidate?.repo?.owner && candidate?.repo?.name) {
    return `${candidate.repo.owner}/${candidate.repo.name}`;
  }
  return candidate?.repoRef ?? "unknown";
}

export async function findLatestDiscoveryManifest(rootDir, config, projectKey, runId = null, options = {}) {
  const runsRoot = path.join(rootDir, config.runtimeRoot ?? "runs", projectKey);

  if (runId) {
    const manifestPath = path.join(runsRoot, runId, "manifest.json");
    const raw = await fs.readFile(manifestPath, "utf8");
    const manifest = JSON.parse(raw);
    if (!manifest.discovery) {
      throw new Error(`Run '${runId}' does not contain a discovery payload.`);
    }
    return {
      runId,
      manifestPath,
      relativeManifestPath: asRelativeFromRoot(rootDir, manifestPath),
      manifest,
      sourceCandidateCount: sourceCandidateCount(manifest.discovery)
    };
  }

  const entries = await safeReadDirEntries(runsRoot);
  const candidates = [];
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
      candidates.push({
        runId: entry.name,
        manifestPath,
        relativeManifestPath: asRelativeFromRoot(rootDir, manifestPath),
        modifiedAt: stat?.mtime?.toISOString?.() ?? manifest.createdAt ?? "",
        manifest,
        sourceCandidateCount: sourceCandidateCount(manifest.discovery)
      });
    } catch {
      // ignore malformed or missing manifests
    }
  }

  const preferred = options.preferCandidates
    ? candidates.filter((candidate) => candidate.sourceCandidateCount > 0)
    : candidates;

  preferred.sort((left, right) => {
    const modifiedDiff = right.modifiedAt.localeCompare(left.modifiedAt);
    if (modifiedDiff !== 0) {
      return modifiedDiff;
    }
    return right.runId.localeCompare(left.runId);
  });
  return preferred[0] ?? candidates[0] ?? null;
}

export function buildDiscoveryPolicyReview(discovery, discoveryPolicy) {
  const sourceCandidates = getDiscoveryPolicySourceCandidates(discovery);
  const audit = applyDiscoveryPolicyToCandidates(sourceCandidates, discoveryPolicy, "audit");
  const enforce = applyDiscoveryPolicyToCandidates(sourceCandidates, discoveryPolicy, "enforce");
  const hiddenByEnforce = enforce.blockedCandidates.map((candidate) => ({
    repoRef: candidateRepoRef(candidate),
    blockers: candidate?.discoveryPolicyGate?.blockers ?? [],
    summary: candidate?.discoveryPolicyGate?.summary ?? "blocked"
  }));

  return {
    sourceCandidateCount: sourceCandidates.length,
    audit: {
      policySummary: audit.policySummary,
      policyCalibration: audit.policyCalibration
    },
    enforce: {
      policySummary: enforce.policySummary,
      policyCalibration: enforce.policyCalibration
    },
    hiddenByEnforce
  };
}

export function renderDiscoveryPolicyReviewSummary({
  projectKey,
  sourceRunId,
  sourceManifestPath,
  review
}) {
  const auditCalibration = review.audit.policyCalibration ?? {};
  const enforceCalibration = review.enforce.policyCalibration ?? {};
  const hiddenLines = review.hiddenByEnforce.length > 0
    ? review.hiddenByEnforce.map((item) => `- ${item.repoRef}: ${item.blockers.slice(0, 3).join(", ") || item.summary}`).join("\n")
    : "- none";
  const auditHintLines = (auditCalibration.recommendations ?? []).length > 0
    ? auditCalibration.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";
  const enforceHintLines = (enforceCalibration.recommendations ?? []).length > 0
    ? enforceCalibration.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot Discovery Policy Review

- project: ${projectKey}
- source_run: ${sourceRunId}
- source_manifest: ${sourceManifestPath}
- source_candidates: ${review.sourceCandidateCount}

## Audit Mode

- visible: ${review.audit.policySummary?.visible ?? 0}
- flagged: ${review.audit.policySummary?.blocked ?? 0}
- preferred: ${review.audit.policySummary?.preferred ?? 0}
- calibration_status: ${auditCalibration.status ?? "unknown"}

## Enforce Mode

- visible: ${review.enforce.policySummary?.visible ?? 0}
- hidden: ${review.enforce.policySummary?.enforcedBlocked ?? 0}
- preferred: ${review.enforce.policySummary?.preferred ?? 0}
- calibration_status: ${enforceCalibration.status ?? "unknown"}

## Hidden By Enforce

${hiddenLines}

## Audit Calibration Hints

${auditHintLines}

## Enforce Calibration Hints

${enforceHintLines}
`;
}
