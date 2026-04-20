import fs from "node:fs/promises";
import path from "node:path";
import { loadQueueEntries } from "../queue.mjs";
import { asRelativeFromRoot, safeReadDirEntries, safeReadText, uniqueStrings } from "../utils.mjs";

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseCsvValues(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeRepoRef(value) {
  return String(value ?? "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^github\.com\//i, "")
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

function formatRepoRef(value) {
  return String(value ?? "").trim().replace(/^\/+|\/+$/g, "");
}

function extractCandidateRepoRefs(candidate) {
  const refs = uniqueStrings([
    candidate?.repo?.fullName,
    candidate?.repo?.normalizedRepoUrl,
    candidate?.repo?.url,
    candidate?.repo?.htmlUrl,
    candidate?.enrichment?.repo?.fullName,
    candidate?.enrichment?.repo?.normalizedRepoUrl,
    candidate?.enrichment?.repo?.url,
    candidate?.enrichment?.repo?.htmlUrl,
    candidate?.landkarteCandidate?.repo_url,
    candidate?.landkarteCandidate?.normalized_repo_url
  ])
    .map(normalizeRepoRef)
    .filter(Boolean);

  if (refs.length > 0) {
    return refs;
  }

  const owner = candidate?.repo?.owner ?? candidate?.landkarteCandidate?.owner ?? "";
  const name = candidate?.repo?.name ?? candidate?.landkarteCandidate?.name ?? "";
  const joined = owner && name ? `${owner}/${name}` : "";
  const normalized = normalizeRepoRef(joined);
  return normalized ? [normalized] : [];
}

function buildBenchmarkEntries(entries = [], kind) {
  return (Array.isArray(entries) ? entries : [])
    .map((entry) => {
      const repo = formatRepoRef(entry?.repo);
      const repoRef = normalizeRepoRef(repo);
      if (!repoRef) {
        return null;
      }
      return {
        kind,
        repo,
        repoRef,
        why: String(entry?.why ?? "").trim()
      };
    })
    .filter(Boolean);
}

function normalizeDiscoveryBenchmark(benchmark) {
  if (!benchmark || typeof benchmark !== "object") {
    return null;
  }

  const positiveRepos = buildBenchmarkEntries(benchmark.positiveRepos, "positive");
  const negativeRepos = buildBenchmarkEntries(benchmark.negativeRepos, "negative");
  const boundaryRepos = buildBenchmarkEntries(benchmark.boundaryRepos, "boundary");
  if (positiveRepos.length === 0 && negativeRepos.length === 0 && boundaryRepos.length === 0) {
    return null;
  }

  return {
    projectKey: String(benchmark.projectKey ?? "").trim() || null,
    version: benchmark.version ?? null,
    intent: String(benchmark.intent ?? "").trim(),
    evaluationQuestions: Array.isArray(benchmark.evaluationQuestions)
      ? benchmark.evaluationQuestions.map((item) => String(item ?? "").trim()).filter(Boolean)
      : [],
    positiveRepos,
    negativeRepos,
    boundaryRepos
  };
}

function matchBenchmarkEntries(candidates, entries) {
  const lookup = new Map(entries.map((entry) => [entry.repoRef, entry]));
  const seen = new Set();
  const matches = [];

  candidates.forEach((candidate, index) => {
    const candidateRefs = extractCandidateRepoRefs(candidate);
    const displayRepo = formatRepoRef(
      candidate?.repo?.fullName
        ?? candidate?.enrichment?.repo?.fullName
        ?? candidate?.repo?.normalizedRepoUrl
        ?? candidate?.landkarteCandidate?.repo_url
        ?? candidateRefs[0]
        ?? ""
    );
    for (const candidateRef of candidateRefs) {
      const matched = lookup.get(candidateRef);
      if (!matched || seen.has(matched.repoRef)) {
        continue;
      }
      seen.add(matched.repoRef);
      matches.push({
        ...matched,
        rank: index + 1,
        candidateRepo: displayRepo || matched.repo
      });
      break;
    }
  });

  return matches;
}

function summarizeBenchmarkLane(entries, matches) {
  const total = entries.length;
  return {
    total,
    hits: matches.length,
    misses: Math.max(total - matches.length, 0),
    coverage: total > 0 ? matches.length / total : 0,
    earliestRank: matches[0]?.rank ?? null,
    matches
  };
}

function partitionDiscoveryTracks(candidates = []) {
  const baseline = [];
  const novel = [];

  for (const candidate of Array.isArray(candidates) ? candidates : []) {
    if (candidate?.alreadyKnown) {
      baseline.push(candidate);
    } else {
      novel.push(candidate);
    }
  }

  return { baseline, novel };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeBoundaryBalance(laneSummary) {
  if (!laneSummary || laneSummary.total === 0) {
    return 0;
  }
  return 1 - Math.min(Math.abs(laneSummary.coverage - 0.5) * 2, 1);
}

function buildRunBenchmarkSummary(benchmark, visibleCandidates, evaluatedCandidates) {
  if (!benchmark) {
    return null;
  }

  const visibleTracks = partitionDiscoveryTracks(visibleCandidates);
  const evaluatedTracks = partitionDiscoveryTracks(evaluatedCandidates);

  const visible = {
    positive: summarizeBenchmarkLane(
      benchmark.positiveRepos,
      matchBenchmarkEntries(visibleCandidates, benchmark.positiveRepos)
    ),
    negative: summarizeBenchmarkLane(
      benchmark.negativeRepos,
      matchBenchmarkEntries(visibleCandidates, benchmark.negativeRepos)
    ),
    boundary: summarizeBenchmarkLane(
      benchmark.boundaryRepos,
      matchBenchmarkEntries(visibleCandidates, benchmark.boundaryRepos)
    )
  };
  const evaluated = {
    positive: summarizeBenchmarkLane(
      benchmark.positiveRepos,
      matchBenchmarkEntries(evaluatedCandidates, benchmark.positiveRepos)
    ),
    negative: summarizeBenchmarkLane(
      benchmark.negativeRepos,
      matchBenchmarkEntries(evaluatedCandidates, benchmark.negativeRepos)
    ),
    boundary: summarizeBenchmarkLane(
      benchmark.boundaryRepos,
      matchBenchmarkEntries(evaluatedCandidates, benchmark.boundaryRepos)
    )
  };

  const novelVisible = {
    positive: summarizeBenchmarkLane(
      benchmark.positiveRepos,
      matchBenchmarkEntries(visibleTracks.novel, benchmark.positiveRepos)
    ),
    negative: summarizeBenchmarkLane(
      benchmark.negativeRepos,
      matchBenchmarkEntries(visibleTracks.novel, benchmark.negativeRepos)
    ),
    boundary: summarizeBenchmarkLane(
      benchmark.boundaryRepos,
      matchBenchmarkEntries(visibleTracks.novel, benchmark.boundaryRepos)
    )
  };
  const baselineVisible = {
    positive: summarizeBenchmarkLane(
      benchmark.positiveRepos,
      matchBenchmarkEntries(visibleTracks.baseline, benchmark.positiveRepos)
    ),
    negative: summarizeBenchmarkLane(
      benchmark.negativeRepos,
      matchBenchmarkEntries(visibleTracks.baseline, benchmark.negativeRepos)
    ),
    boundary: summarizeBenchmarkLane(
      benchmark.boundaryRepos,
      matchBenchmarkEntries(visibleTracks.baseline, benchmark.boundaryRepos)
    )
  };
  const novelEvaluated = {
    positive: summarizeBenchmarkLane(
      benchmark.positiveRepos,
      matchBenchmarkEntries(evaluatedTracks.novel, benchmark.positiveRepos)
    ),
    negative: summarizeBenchmarkLane(
      benchmark.negativeRepos,
      matchBenchmarkEntries(evaluatedTracks.novel, benchmark.negativeRepos)
    ),
    boundary: summarizeBenchmarkLane(
      benchmark.boundaryRepos,
      matchBenchmarkEntries(evaluatedTracks.novel, benchmark.boundaryRepos)
    )
  };

  const score = clamp(
    50
      + visible.positive.coverage * 24
      + novelVisible.positive.coverage * 12
      + evaluated.positive.coverage * 10
      + novelEvaluated.positive.coverage * 5
      + computeBoundaryBalance(visible.boundary) * 10
      - visible.negative.coverage * 30
      - evaluated.negative.coverage * 10,
    0,
    100
  );

  return {
    score,
    visible,
    evaluated,
    novelVisible,
    baselineVisible,
    novelEvaluated
  };
}

function average(values) {
  if (!Array.isArray(values) || values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function averageRank(values) {
  const ranks = values.filter((value) => Number.isFinite(value) && value > 0);
  return ranks.length > 0 ? average(ranks) : null;
}

function buildBenchmarkSummary(runSummaries, benchmark) {
  if (!benchmark) {
    return null;
  }

  const benchmarkRuns = runSummaries.filter((run) => run.benchmark);
  const latestRun = benchmarkRuns[0] ?? null;

  return {
    available: benchmarkRuns.length > 0,
    projectKey: benchmark.projectKey,
    version: benchmark.version,
    intent: benchmark.intent,
    evaluationQuestions: benchmark.evaluationQuestions,
    totals: {
      positiveRepos: benchmark.positiveRepos.length,
      negativeRepos: benchmark.negativeRepos.length,
      boundaryRepos: benchmark.boundaryRepos.length
    },
    runCount: benchmarkRuns.length,
    averageScore: average(benchmarkRuns.map((run) => run.benchmark.score)),
    averageVisiblePositiveCoverage: average(benchmarkRuns.map((run) => run.benchmark.visible.positive.coverage)),
    averageNovelPositiveCoverage: average(benchmarkRuns.map((run) => run.benchmark.novelVisible.positive.coverage)),
    averageVisibleNegativeLeak: average(benchmarkRuns.map((run) => run.benchmark.visible.negative.coverage)),
    averageVisibleBoundaryCoverage: average(benchmarkRuns.map((run) => run.benchmark.visible.boundary.coverage)),
    runsWithVisiblePositiveHit: benchmarkRuns.filter((run) => run.benchmark.visible.positive.hits > 0).length,
    runsWithVisibleNovelPositiveHit: benchmarkRuns.filter((run) => run.benchmark.novelVisible.positive.hits > 0).length,
    runsWithVisibleNegativeLeak: benchmarkRuns.filter((run) => run.benchmark.visible.negative.hits > 0).length,
    averageTopPositiveRank: averageRank(benchmarkRuns.map((run) => run.benchmark.visible.positive.earliestRank)),
    averageTopNovelPositiveRank: averageRank(benchmarkRuns.map((run) => run.benchmark.novelVisible.positive.earliestRank)),
    averageTopNegativeRank: averageRank(benchmarkRuns.map((run) => run.benchmark.visible.negative.earliestRank)),
    latestRun: latestRun
      ? {
        runId: latestRun.runId,
        createdAt: latestRun.createdAt,
        score: latestRun.benchmark.score,
        visible: latestRun.benchmark.visible,
        novelVisible: latestRun.benchmark.novelVisible,
        baselineVisible: latestRun.benchmark.baselineVisible,
        evaluated: latestRun.benchmark.evaluated,
        novelEvaluated: latestRun.benchmark.novelEvaluated
      }
      : null
  };
}

function deriveQueueOutcome(row) {
  const status = String(row.status ?? "");
  const promotionStatus = String(row.promotion_status ?? "");
  const reviewDisposition = String(row.review_disposition ?? "");
  const decisionGuess = String(row.decision_guess ?? "");

  if (status === "promoted" || promotionStatus === "applied") {
    return "promoted";
  }
  if (status === "promotion_prepared" || promotionStatus === "prepared") {
    return "prepared";
  }
  if (reviewDisposition === "skip" || decisionGuess === "ignore") {
    return "negative";
  }
  if (reviewDisposition === "observe_only") {
    return "observe";
  }
  return "pending";
}

function createOutcomeCounter(value, kind) {
  return {
    value,
    kind,
    exposures: 0,
    promoted: 0,
    prepared: 0,
    negative: 0,
    observe: 0,
    pending: 0,
    fitCandidate: 0,
    researchSignals: 0,
    boundarySignals: 0,
    riskSignals: 0,
    weakSignals: 0,
    discoveryScoreTotal: 0,
    fitScoreTotal: 0,
    rows: 0
  };
}

function updateOutcomeCounter(counter, row) {
  counter.exposures += 1;
  counter.rows += 1;
  counter.discoveryScoreTotal += toNumber(row.discovery_score);
  counter.fitScoreTotal += toNumber(row.project_fit_score);
  const outcome = deriveQueueOutcome(row);
  counter[outcome] += 1;

  switch (String(row.discovery_class ?? "")) {
    case "fit_candidate":
      counter.fitCandidate += 1;
      break;
    case "research_signal":
      counter.researchSignals += 1;
      break;
    case "boundary_signal":
      counter.boundarySignals += 1;
      break;
    case "risk_signal":
      counter.riskSignals += 1;
      break;
    case "weak_signal":
      counter.weakSignals += 1;
      break;
    default:
      break;
  }
}

function finalizeOutcomeCounter(counter) {
  const exposures = Math.max(counter.exposures, 1);
  const avgDiscoveryScore = counter.discoveryScoreTotal / exposures;
  const avgFitScore = counter.fitScoreTotal / exposures;
  const positiveRows = counter.promoted + counter.prepared;
  const qualityScore = (
    positiveRows * 6
    + counter.observe
    + counter.fitCandidate * 2
    + avgDiscoveryScore / 20
    + avgFitScore / 25
    - counter.negative * 5
    - counter.riskSignals * 2
    - counter.weakSignals * 2
  );
  const noiseScore = (
    counter.negative * 5
    + counter.riskSignals * 3
    + counter.weakSignals * 2
    + counter.boundarySignals
    - positiveRows * 4
    - counter.fitCandidate * 2
  );

  return {
    ...counter,
    positiveRows,
    avgDiscoveryScore,
    avgFitScore,
    promotionRate: positiveRows / exposures,
    negativeRate: counter.negative / exposures,
    observeRate: counter.observe / exposures,
    fitRate: counter.fitCandidate / exposures,
    qualityScore,
    noiseScore
  };
}

function sortByQuality(items) {
  return [...items].sort((left, right) => {
    if (right.qualityScore !== left.qualityScore) {
      return right.qualityScore - left.qualityScore;
    }
    if (right.promotionRate !== left.promotionRate) {
      return right.promotionRate - left.promotionRate;
    }
    return left.value.localeCompare(right.value);
  });
}

function sortByNoise(items) {
  return [...items].sort((left, right) => {
    if (right.noiseScore !== left.noiseScore) {
      return right.noiseScore - left.noiseScore;
    }
    if (right.negativeRate !== left.negativeRate) {
      return right.negativeRate - left.negativeRate;
    }
    return left.value.localeCompare(right.value);
  });
}

function buildOutcomeStats(rows, extractor, kind) {
  const counter = new Map();
  for (const row of rows) {
    const values = uniqueStrings(extractor(row));
    for (const value of values) {
      const current = counter.get(value) ?? createOutcomeCounter(value, kind);
      updateOutcomeCounter(current, row);
      counter.set(value, current);
    }
  }
  return [...counter.values()].map(finalizeOutcomeCounter);
}

function createRunLensCounter(value, kind) {
  return {
    value,
    kind,
    matches: 0,
    discoveryScoreTotal: 0,
    fitScoreTotal: 0,
    fitCandidates: 0,
    riskSignals: 0,
    weakSignals: 0,
    highFit: 0,
    reviewQueue: 0
  };
}

function updateRunLensCounter(counter, candidate) {
  counter.matches += 1;
  counter.discoveryScoreTotal += toNumber(candidate.discoveryScore);
  counter.fitScoreTotal += toNumber(candidate.projectAlignment?.fitScore);
  if (candidate.discoveryClass === "fit_candidate") {
    counter.fitCandidates += 1;
  }
  if (candidate.discoveryClass === "risk_signal") {
    counter.riskSignals += 1;
  }
  if (candidate.discoveryClass === "weak_signal") {
    counter.weakSignals += 1;
  }
  if (candidate.projectAlignment?.fitBand === "high") {
    counter.highFit += 1;
  }
  if (candidate.discoveryDisposition === "review_queue" || candidate.discoveryDisposition === "intake_now") {
    counter.reviewQueue += 1;
  }
}

function finalizeRunLensCounter(counter) {
  const matches = Math.max(counter.matches, 1);
  const avgDiscoveryScore = counter.discoveryScoreTotal / matches;
  const avgFitScore = counter.fitScoreTotal / matches;
  return {
    ...counter,
    avgDiscoveryScore,
    avgFitScore,
    qualityScore: counter.fitCandidates * 3 + counter.highFit * 2 + counter.reviewQueue + avgDiscoveryScore / 25 + avgFitScore / 25 - counter.riskSignals * 2 - counter.weakSignals,
    noiseScore: counter.riskSignals * 3 + counter.weakSignals * 2 - counter.fitCandidates * 2 - counter.highFit
  };
}

function summarizeRunLenses(candidates, extractor, kind) {
  const counter = new Map();
  for (const candidate of candidates) {
    const values = uniqueStrings(extractor(candidate));
    for (const value of values) {
      const current = counter.get(value) ?? createRunLensCounter(value, kind);
      updateRunLensCounter(current, candidate);
      counter.set(value, current);
    }
  }
  return [...counter.values()].map(finalizeRunLensCounter);
}

async function safeReadJson(filePath) {
  const raw = await safeReadText(filePath);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function loadDiscoveryRunManifests(rootDir, config, options = {}) {
  const runsRoot = path.join(rootDir, config.runtimeRoot ?? "runs");
  const projectDirs = await safeReadDirEntries(runsRoot);
  const manifests = [];
  const targetProject = options.projectKey ?? null;
  const targetRunId = options.runId ?? null;

  for (const projectDir of projectDirs) {
    if (!projectDir.isDirectory()) {
      continue;
    }
    if (projectDir.name === "validation-cohort" || projectDir.name === "discovery-evaluation") {
      continue;
    }
    if (targetProject && projectDir.name !== targetProject) {
      continue;
    }
    const runEntries = await safeReadDirEntries(path.join(runsRoot, projectDir.name));
    for (const runEntry of runEntries) {
      if (!runEntry.isDirectory()) {
        continue;
      }
      if (targetRunId && runEntry.name !== targetRunId) {
        continue;
      }
      const manifestPath = path.join(runsRoot, projectDir.name, runEntry.name, "manifest.json");
      const manifest = await safeReadJson(manifestPath);
      if (!manifest?.discovery) {
        continue;
      }
      manifests.push({
        ...manifest,
        manifestPath
      });
    }
  }

  manifests.sort((left, right) => String(right.createdAt ?? "").localeCompare(String(left.createdAt ?? "")));

  if (options.limit && Number.isFinite(options.limit)) {
    return manifests.slice(0, options.limit);
  }
  return manifests;
}

function buildRunSummaries(manifests, benchmark = null) {
  return manifests.map((manifest) => {
    const candidates = [
      ...(Array.isArray(manifest.discovery?.evaluatedCandidates) ? manifest.discovery.evaluatedCandidates : []),
      ...(Array.isArray(manifest.discovery?.candidates) ? manifest.discovery.candidates : [])
    ];
    const visibleCandidates = Array.isArray(manifest.discovery?.candidates) ? manifest.discovery.candidates : [];
    const evaluatedCandidates = Array.isArray(manifest.discovery?.evaluatedCandidates) ? manifest.discovery.evaluatedCandidates : [];
    const familyStats = summarizeRunLenses(candidates, (candidate) => candidate.queryFamilies ?? [], "family");
    const labelStats = summarizeRunLenses(candidates, (candidate) => candidate.queryLabels ?? [], "label");
    const bestFamily = sortByQuality(familyStats)[0] ?? null;
    const noisyFamily = sortByNoise(familyStats)[0] ?? null;
    const bestLabel = sortByQuality(labelStats)[0] ?? null;
    const noisyLabel = sortByNoise(labelStats)[0] ?? null;
    const runBenchmark = buildRunBenchmarkSummary(benchmark, visibleCandidates, evaluatedCandidates);

    return {
      runId: manifest.runId,
      projectKey: manifest.projectKey,
      createdAt: manifest.createdAt,
      manifestPath: manifest.manifestPath,
      queryCount: manifest.discovery?.plan?.plans?.length ?? 0,
      searchResultsScanned: manifest.discovery?.scanned ?? 0,
      rawCandidateCount: manifest.discovery?.rawCandidateCount ?? 0,
      evaluatedCandidateCount: manifest.discovery?.evaluatedCandidates?.length ?? 0,
      visibleCandidateCount: manifest.discovery?.candidates?.length ?? 0,
      bestFamily,
      noisyFamily,
      bestLabel,
      noisyLabel,
      benchmark: runBenchmark
    };
  });
}

function buildRecommendations(familyStats, labelStats, runSummaries, benchmarkSummary = null) {
  const recommendations = [];
  const bestFamily = sortByQuality(familyStats)[0];
  const noisyFamily = sortByNoise(familyStats)[0];
  const bestLabel = sortByQuality(labelStats)[0];

  if (bestFamily && bestFamily.promotionRate > 0) {
    recommendations.push(`Lean more on query family '${bestFamily.value}' because it currently converts best (${Math.round(bestFamily.promotionRate * 100)}% positive outcomes).`);
  }
  if (noisyFamily && noisyFamily.negativeRate >= 0.5) {
    recommendations.push(`Tighten or demote query family '${noisyFamily.value}' because it is currently the noisiest (${Math.round(noisyFamily.negativeRate * 100)}% negative outcomes).`);
  }
  if (bestLabel && bestLabel.qualityScore > 0) {
    recommendations.push(`Preserve query label '${bestLabel.value}' as a reusable discovery lens; it currently shows the strongest outcome mix.`);
  }
  const emptyRuns = runSummaries.filter((run) => run.visibleCandidateCount === 0);
  if (emptyRuns.length > 0) {
    recommendations.push(`Review ${emptyRuns.length} empty discovery run(s) for query over-tightening or GitHub search starvation before widening the corpus further.`);
  }
  if (benchmarkSummary?.runCount > 0) {
    if (benchmarkSummary.runsWithVisiblePositiveHit === 0) {
      recommendations.push("Discovery is still missing every benchmark-positive repo in the visible shortlist. Fix seed quality and query grounding before tightening ranking any further.");
    } else if (benchmarkSummary.averageVisiblePositiveCoverage < 0.5) {
      recommendations.push(`Benchmark positives surface too weakly (${Math.round(benchmarkSummary.averageVisiblePositiveCoverage * 100)}% average visible coverage). Strengthen civic/public-event/source-family cohort signals earlier in discovery.`);
    }
    if (benchmarkSummary.averageNovelPositiveCoverage < 0.35) {
      recommendations.push(`Known baselines are surfacing, but genuinely new benchmark-positive hits remain weak (${Math.round(benchmarkSummary.averageNovelPositiveCoverage * 100)}% average novel coverage). Expand sibling cohorts around strong seeds instead of only replaying the same anchors.`);
    }
    if (benchmarkSummary.runsWithVisibleNegativeLeak > 0) {
      recommendations.push(`Benchmark negatives still leak into visible results in ${benchmarkSummary.runsWithVisibleNegativeLeak}/${benchmarkSummary.runCount} run(s). Keep demoting generic framework/list/tutorial families sooner in the search plan.`);
    }
    if ((benchmarkSummary.averageScore ?? 0) < 60) {
      recommendations.push(`Benchmark calibration is still weak (average score ${benchmarkSummary.averageScore.toFixed(1)}/100). Treat benchmark-guided candidate generation as the primary product lever, not more ranking polish.`);
    }
  }
  if (recommendations.length === 0) {
    recommendations.push("Run another real discovery cycle with intake/review to generate stronger evaluation evidence.");
  }
  return recommendations;
}

export function buildDiscoveryEvaluation({ projectKey, manifests, queueRows, benchmark = null }) {
  const relevantRows = queueRows.filter((row) => {
    if (projectKey && row.project_key !== projectKey) {
      return false;
    }
    return Boolean(String(row.discovery_query_families ?? "").trim() || String(row.discovery_query_labels ?? "").trim());
  });
  const normalizedBenchmark = normalizeDiscoveryBenchmark(benchmark);
  const familyStats = buildOutcomeStats(relevantRows, (row) => parseCsvValues(row.discovery_query_families), "family");
  const labelStats = buildOutcomeStats(relevantRows, (row) => parseCsvValues(row.discovery_query_labels), "label");
  const runSummaries = buildRunSummaries(manifests, normalizedBenchmark);
  const totals = relevantRows.reduce((acc, row) => {
    acc.rows += 1;
    const outcome = deriveQueueOutcome(row);
    acc[outcome] += 1;
    return acc;
  }, {
    rows: 0,
    promoted: 0,
    prepared: 0,
    negative: 0,
    observe: 0,
    pending: 0
  });

  const bestFamilies = sortByQuality(familyStats).slice(0, 5);
  const noisyFamilies = sortByNoise(familyStats).slice(0, 5);
  const bestLabels = sortByQuality(labelStats).slice(0, 5);
  const noisyLabels = sortByNoise(labelStats).slice(0, 5);
  const averageCandidatesPerRun = runSummaries.length > 0
    ? runSummaries.reduce((total, run) => total + run.visibleCandidateCount, 0) / runSummaries.length
    : 0;
  const benchmarkSummary = buildBenchmarkSummary(runSummaries, normalizedBenchmark);

  return {
    projectKey: projectKey ?? "all-projects",
    manifests,
    queueRows: relevantRows,
    totals,
    runCount: runSummaries.length,
    averageCandidatesPerRun,
    familyStats,
    labelStats,
    bestFamilies,
    noisyFamilies,
    bestLabels,
    noisyLabels,
    runSummaries,
    benchmark: benchmarkSummary,
    recommendations: buildRecommendations(familyStats, labelStats, runSummaries, benchmarkSummary)
  };
}

function formatPercent(value) {
  return `${Math.round((value ?? 0) * 100)}%`;
}

export function renderDiscoveryEvaluationSummary(evaluation) {
  const latestBenchmark = evaluation.benchmark?.latestRun ?? null;
  const benchmarkLines = evaluation.benchmark
    ? [
      `- benchmark_runs: ${evaluation.benchmark.runCount}`,
      `- average_benchmark_score: ${evaluation.benchmark.averageScore.toFixed(1)}`,
      `- visible_positive_coverage: ${formatPercent(evaluation.benchmark.averageVisiblePositiveCoverage)}`,
      `- visible_novel_positive_coverage: ${formatPercent(evaluation.benchmark.averageNovelPositiveCoverage)}`,
      `- visible_negative_leak: ${formatPercent(evaluation.benchmark.averageVisibleNegativeLeak)}`,
      `- visible_boundary_coverage: ${formatPercent(evaluation.benchmark.averageVisibleBoundaryCoverage)}`,
      `- runs_with_visible_positive_hit: ${evaluation.benchmark.runsWithVisiblePositiveHit}/${evaluation.benchmark.runCount}`,
      `- runs_with_visible_novel_positive_hit: ${evaluation.benchmark.runsWithVisibleNovelPositiveHit}/${evaluation.benchmark.runCount}`,
      `- runs_with_visible_negative_leak: ${evaluation.benchmark.runsWithVisibleNegativeLeak}/${evaluation.benchmark.runCount}`,
      `- average_top_positive_rank: ${evaluation.benchmark.averageTopPositiveRank?.toFixed(2) ?? "-"}`,
      `- average_top_novel_positive_rank: ${evaluation.benchmark.averageTopNovelPositiveRank?.toFixed(2) ?? "-"}`,
      `- average_top_negative_rank: ${evaluation.benchmark.averageTopNegativeRank?.toFixed(2) ?? "-"}`,
      latestBenchmark
        ? `- latest_run_benchmark: ${latestBenchmark.runId} score=${latestBenchmark.score.toFixed(1)} positive_hits=${latestBenchmark.visible.positive.hits}/${latestBenchmark.visible.positive.total} novel_positive_hits=${latestBenchmark.novelVisible.positive.hits}/${latestBenchmark.novelVisible.positive.total} negative_leaks=${latestBenchmark.visible.negative.hits}/${latestBenchmark.visible.negative.total}`
        : "- latest_run_benchmark: -"
    ].join("\n")
    : "- none";
  const bestFamilyLines = evaluation.bestFamilies.length > 0
    ? evaluation.bestFamilies.map((item) => `- ${item.value}: quality=${item.qualityScore.toFixed(1)} | positive=${formatPercent(item.promotionRate)} | negative=${formatPercent(item.negativeRate)} | avg_score=${item.avgDiscoveryScore.toFixed(1)}`).join("\n")
    : "- none";
  const noisyFamilyLines = evaluation.noisyFamilies.length > 0
    ? evaluation.noisyFamilies.map((item) => `- ${item.value}: noise=${item.noiseScore.toFixed(1)} | negative=${formatPercent(item.negativeRate)} | risk=${item.riskSignals + item.weakSignals}`).join("\n")
    : "- none";
  const bestLabelLines = evaluation.bestLabels.length > 0
    ? evaluation.bestLabels.map((item) => `- ${item.value}: quality=${item.qualityScore.toFixed(1)} | positive=${formatPercent(item.promotionRate)} | avg_score=${item.avgDiscoveryScore.toFixed(1)}`).join("\n")
    : "- none";
  const noisyLabelLines = evaluation.noisyLabels.length > 0
    ? evaluation.noisyLabels.map((item) => `- ${item.value}: noise=${item.noiseScore.toFixed(1)} | negative=${formatPercent(item.negativeRate)}`).join("\n")
    : "- none";
  const runLines = evaluation.runSummaries.length > 0
    ? evaluation.runSummaries.map((run) => `- ${run.projectKey}/${run.runId}: queries=${run.queryCount}; visible=${run.visibleCandidateCount}; best_family=${run.bestFamily?.value ?? "-"}; noisy_family=${run.noisyFamily?.value ?? "-"}`).join("\n")
    : "- none";
  const recommendationLines = evaluation.recommendations.length > 0
    ? evaluation.recommendations.map((item) => `- ${item}`).join("\n")
    : "- none";

  return `# Patternpilot Discovery Evaluation

- project_scope: ${evaluation.projectKey}
- analyzed_runs: ${evaluation.runCount}
- linked_queue_rows: ${evaluation.totals.rows}
- promoted_rows: ${evaluation.totals.promoted}
- prepared_rows: ${evaluation.totals.prepared}
- negative_rows: ${evaluation.totals.negative}
- observe_rows: ${evaluation.totals.observe}
- pending_rows: ${evaluation.totals.pending}
- average_visible_candidates_per_run: ${evaluation.averageCandidatesPerRun.toFixed(2)}

## Benchmark Calibration

${benchmarkLines}

## Best Query Families

${bestFamilyLines}

## Noisiest Query Families

${noisyFamilyLines}

## Best Query Labels

${bestLabelLines}

## Noisiest Query Labels

${noisyLabelLines}

## Run Highlights

${runLines}

## Recommendations

${recommendationLines}
`;
}

export function buildDiscoveryEvaluationReport(evaluation, rootDir = null) {
  return {
    projectKey: evaluation.projectKey,
    totals: evaluation.totals,
    runCount: evaluation.runCount,
    averageCandidatesPerRun: evaluation.averageCandidatesPerRun,
    benchmark: evaluation.benchmark,
    bestFamilies: evaluation.bestFamilies,
    noisyFamilies: evaluation.noisyFamilies,
    bestLabels: evaluation.bestLabels,
    noisyLabels: evaluation.noisyLabels,
    recommendations: evaluation.recommendations,
    runs: evaluation.runSummaries.map((run) => ({
      ...run,
      manifestPath: rootDir ? asRelativeFromRoot(rootDir, run.manifestPath) : run.manifestPath
    }))
  };
}

export async function writeDiscoveryEvaluationArtifacts(rootDir, config, runId, report, summary, dryRun = false) {
  const runDir = path.join(rootDir, config.runtimeRoot ?? "runs", "discovery-evaluation", runId);
  if (!dryRun) {
    await fs.mkdir(runDir, { recursive: true });
    await fs.writeFile(path.join(runDir, "summary.md"), summary, "utf8");
    await fs.writeFile(path.join(runDir, "discovery-evaluation-report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  return runDir;
}
