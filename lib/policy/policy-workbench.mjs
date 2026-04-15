import { getDiscoveryPolicySourceCandidates, buildDiscoveryPolicyReview } from "./discovery-policy-review.mjs";

function repoRef(candidate) {
  if (candidate?.full_name) {
    return candidate.full_name;
  }
  if (candidate?.repo?.owner && candidate?.repo?.name) {
    return `${candidate.repo.owner}/${candidate.repo.name}`;
  }
  return candidate?.repoRef ?? "unknown";
}

function focusForCandidate(candidate) {
  const gate = candidate?.discoveryPolicyGate;
  if (!gate) {
    return "review_signals";
  }
  if (!gate.allowed && candidate?.projectAlignment?.fitBand === "high") {
    return "check_false_block";
  }
  if (!gate.allowed) {
    return "confirm_block";
  }
  if ((gate.preferenceHits?.length ?? 0) > 0) {
    return "confirm_prefer";
  }
  if ((candidate?.projectAlignment?.fitScore ?? 0) < 35) {
    return "check_noise";
  }
  return "review_signals";
}

export function buildPolicyWorkbench(discovery, discoveryPolicy) {
  const review = buildDiscoveryPolicyReview(discovery, discoveryPolicy);
  const sourceCandidates = getDiscoveryPolicySourceCandidates(discovery);
  const auditVisible = new Map(
    (review.audit?.policySummary?.visibleCandidates ?? []).map((candidate) => [repoRef(candidate), candidate])
  );
  const rows = sourceCandidates.map((candidate) => {
    const reference = repoRef(candidate);
    const gate = candidate?.discoveryPolicyGate ?? auditVisible.get(reference)?.discoveryPolicyGate ?? null;
    return {
      repoRef: reference,
      repoUrl: candidate?.repo?.normalizedRepoUrl ?? "",
      discoveryScore: candidate?.discoveryScore ?? null,
      disposition: candidate?.discoveryDisposition ?? candidate?.reviewDisposition ?? "unknown",
      fitBand: candidate?.projectAlignment?.fitBand ?? "unknown",
      fitScore: candidate?.projectAlignment?.fitScore ?? null,
      stars: candidate?.enrichment?.repo?.stars ?? candidate?.stars ?? null,
      mainLayer: candidate?.guess?.mainLayer ?? "",
      patternFamily: candidate?.guess?.patternFamily ?? "",
      gapArea: candidate?.gapAreaCanonical ?? candidate?.guess?.gapArea ?? "",
      license: candidate?.enrichment?.repo?.license ?? candidate?.license ?? "",
      topics: candidate?.enrichment?.repo?.topics ?? candidate?.topics ?? [],
      policyAllowed: gate?.allowed ?? true,
      policySummary: gate?.summary ?? "allowed",
      blockers: gate?.blockers ?? [],
      preferenceHits: gate?.preferenceHits ?? [],
      focus: focusForCandidate(candidate),
      manualVerdict: "",
      manualNotes: ""
    };
  });

  return {
    sourceCandidateCount: sourceCandidates.length,
    blockedCount: rows.filter((row) => !row.policyAllowed).length,
    preferredCount: rows.filter((row) => row.preferenceHits.length > 0).length,
    rows,
    review
  };
}

export function renderPolicyWorkbenchSummary({
  projectKey,
  sourceRunId,
  sourceManifestPath,
  workbench
}) {
  const rowLines = workbench.rows.length > 0
    ? workbench.rows.map((row) => {
      const blockers = row.blockers.length > 0 ? row.blockers.slice(0, 3).join(", ") : "-";
      const preferences = row.preferenceHits.length > 0 ? row.preferenceHits.slice(0, 3).join(", ") : "-";
      return `- ${row.repoRef} :: fit=${row.fitBand}/${row.fitScore ?? "-"} :: disposition=${row.disposition} :: allowed=${row.policyAllowed ? "yes" : "no"} :: focus=${row.focus} :: blockers=${blockers} :: prefers=${preferences}`;
    }).join("\n")
    : "- none";

  return `# Patternpilot Policy Workbench

- project: ${projectKey}
- source_run: ${sourceRunId}
- source_manifest: ${sourceManifestPath}
- source_candidates: ${workbench.sourceCandidateCount}
- policy_blocked: ${workbench.blockedCount}
- policy_preferred: ${workbench.preferredCount}

## Candidate Rows

${rowLines}

## Manual Workflow

- edit \`proposed-policy.json\` if you want to try a softer or stricter policy variant
- use \`manifest.json\` or \`rows.json\` as the structured candidate sheet for notes
- run \`policy:compare\` against \`proposed-policy.json\`
- run \`policy:pack\` after adjustments to freeze the next calibration packet
`;
}
