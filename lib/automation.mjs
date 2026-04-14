function confidenceRank(value) {
  if (value === "high") {
    return 2;
  }
  if (value === "medium") {
    return 1;
  }
  return 0;
}

function candidateNetScore(candidate) {
  const valueScore = Number(candidate?.valueScore ?? 0) || 0;
  const effortScore = Number(candidate?.effortScore ?? 0) || 0;
  return valueScore - effortScore;
}

function candidateFitScore(candidate) {
  return Number(candidate?.projectAlignment?.fitScore ?? candidate?.projectFitScore ?? 0) || 0;
}

function candidateName(candidate) {
  if (candidate?.full_name) {
    return candidate.full_name;
  }
  if (candidate?.repo?.owner && candidate?.repo?.name) {
    return `${candidate.repo.owner}/${candidate.repo.name}`;
  }
  return candidate?.repoRef ?? "unknown";
}

export function compareConfidence(left, right) {
  return confidenceRank(left) - confidenceRank(right);
}

export function sortAutomationCandidates(candidates = []) {
  candidates.sort((left, right) => {
    const netDiff = candidateNetScore(right) - candidateNetScore(left);
    if (netDiff !== 0) {
      return netDiff;
    }

    const fitDiff = candidateFitScore(right) - candidateFitScore(left);
    if (fitDiff !== 0) {
      return fitDiff;
    }

    return candidateName(left).localeCompare(candidateName(right));
  });

  return candidates;
}

export function selectAutomationDiscoveryCandidates(discovery, options = {}) {
  const candidates = Array.isArray(discovery?.candidates) ? [...discovery.candidates] : [];
  const maxCandidates = Math.max(1, Number(options.maxCandidates ?? 5) || 5);
  const minConfidence = options.minConfidence ?? "medium";
  const runConfidence = discovery?.runConfidence ?? "low";

  if (compareConfidence(runConfidence, minConfidence) < 0) {
    return {
      status: "blocked_low_confidence",
      reason: `Discovery confidence '${runConfidence}' is below required '${minConfidence}'.`,
      selected: [],
      selectedUrls: [],
      considered: candidates.length,
      actionable: 0,
      rejected: candidates.length
    };
  }

  const actionable = candidates.filter((candidate) => {
    const disposition = candidate?.discoveryDisposition;
    const fitBand = candidate?.projectAlignment?.fitBand ?? "unknown";

    if (candidate?.decisionDataState && candidate.decisionDataState !== "complete") {
      return false;
    }
    if (disposition !== "intake_now" && disposition !== "review_queue") {
      return false;
    }
    if (fitBand === "low" || fitBand === "unknown") {
      return false;
    }
    return Boolean(candidate?.repo?.normalizedRepoUrl);
  });

  sortAutomationCandidates(actionable);
  const selected = actionable.slice(0, maxCandidates);

  return {
    status: selected.length > 0 ? "selected" : "no_actionable_candidates",
    reason: selected.length > 0
      ? `Selected ${selected.length} discovery candidates for watchlist handoff.`
      : "No discovery candidates passed the automation gate.",
    selected,
    selectedUrls: selected.map((candidate) => candidate.repo.normalizedRepoUrl),
    considered: candidates.length,
    actionable: actionable.length,
    rejected: Math.max(0, candidates.length - actionable.length)
  };
}
