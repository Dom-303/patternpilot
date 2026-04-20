import fs from "node:fs/promises";
import path from "node:path";
import { DISCOVERY_STOPWORDS } from "../constants.mjs";
import { loadQueueEntries } from "../queue.mjs";
import { getProjectGapAreaGuess } from "../legacy-project-fields.mjs";
import { clamp, uniqueStrings } from "../utils.mjs";

const DISCOVERY_FEEDBACK_STOPWORDS = new Set([
  "and",
  "api",
  "auth",
  "broad",
  "calendar",
  "crawler",
  "data",
  "design",
  "discovery",
  "docker",
  "distribution",
  "event",
  "events",
  "family",
  "families",
  "first",
  "for",
  "frontend",
  "framework",
  "homepage",
  "hosted",
  "infra",
  "intake",
  "layer",
  "layers",
  "local",
  "nextjs",
  "node",
  "open",
  "pattern",
  "patterns",
  "place",
  "postgresql",
  "prisma",
  "python",
  "react",
  "project",
  "scan",
  "scraper",
  "self",
  "source",
  "stack",
  "startpage",
  "surface",
  "surfaces",
  "tailwind",
  "tailwindcss",
  "trpc",
  "turborepo",
  "typescript",
  "venue",
  "web",
  "with",
  "zod",
  "ionic",
  "frameworks"
]);

const LEARNED_COHORT_CORE_HINTS = new Set([
  "access fetch",
  "adapter",
  "agenda",
  "audit",
  "civic",
  "community calendar",
  "connector",
  "connector families",
  "csv",
  "dedupe",
  "masterlist",
  "location",
  "location intelligence",
  "location place enrichment",
  "municipal",
  "ndjson",
  "normalize",
  "normalization",
  "open data",
  "parsing extraction",
  "playwright",
  "public event",
  "review",
  "schema",
  "source intake",
  "source systems and families",
  "validation"
]);

const LEARNED_COHORT_SUPPORT_HINTS = new Set([
  "data model",
  "governance",
  "quality governance",
  "risk and dependency awareness",
  "semantics"
]);

const LEARNED_COHORT_EXCLUDED_HINTS = new Set([
  "dashboard",
  "distribution",
  "distribution surfaces",
  "event discovery frontend",
  "export feed api",
  "homepage",
  "startpage",
  "surface",
  "surfaces",
  "ui discovery surface"
]);

function splitCsvValues(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function canonicalizeRepoRef(value) {
  const normalized = normalizeRepoRef(value);
  if (!normalized.includes("/")) {
    return normalized.replace(/[^a-z0-9]/g, "");
  }
  const [owner, name] = normalized.split("/", 2);
  return `${owner.replace(/[^a-z0-9]/g, "")}/${name.replace(/[^a-z0-9]/g, "")}`;
}

function extractRepoOwner(repoRef) {
  const normalized = normalizeRepoRef(repoRef);
  return normalized.includes("/") ? normalized.split("/", 2)[0] : normalized;
}

function normalizeFeedbackToken(token) {
  return String(token ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s_-]/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeFeedbackToken(token) {
  if (!token || token.length < 4) {
    return token;
  }
  if (token === "scraping" || token === "scrapy" || token === "scrapers") {
    return "scraper";
  }
  if (token.endsWith("ies") && token.length > 4) {
    return `${token.slice(0, -3)}y`;
  }
  if (token.endsWith("sses") || token.endsWith("ness")) {
    return token;
  }
  if (token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

function tokenizeFeedbackText(value) {
  return normalizeFeedbackToken(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .map((item) => singularizeFeedbackToken(item))
    .filter(Boolean)
    .filter((item) => item.length >= 3 && !DISCOVERY_STOPWORDS.has(item) && !DISCOVERY_FEEDBACK_STOPWORDS.has(item));
}

function deriveFeedbackOutcome(row) {
  const status = String(row.status ?? "");
  const promotionStatus = String(row.promotion_status ?? "");
  const reviewDisposition = String(row.review_disposition ?? "");
  const decisionGuess = String(row.decision_guess ?? "");

  if (status === "promoted" || promotionStatus === "applied") {
    return "positive";
  }
  if (status === "promotion_prepared" || promotionStatus === "prepared") {
    return "positive";
  }
  if (reviewDisposition === "skip" || decisionGuess === "ignore") {
    return "negative";
  }
  if (reviewDisposition === "observe_only") {
    return "observe";
  }
  return "pending";
}

function createCounterMap() {
  return new Map();
}

function tallyCounter(counter, value, outcome) {
  if (!value) {
    return;
  }
  const current = counter.get(value) ?? {
    value,
    positive: 0,
    negative: 0,
    observe: 0
  };
  if (outcome === "positive") {
    current.positive += 1;
  } else if (outcome === "negative") {
    current.negative += 1;
  } else if (outcome === "observe") {
    current.observe += 1;
  }
  counter.set(value, current);
}

function finalizeCounter(counter, limit = 8) {
  return [...counter.values()]
    .map((item) => ({
      ...item,
      score: item.positive * 3 + item.observe - item.negative * 3
    }))
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      if (right.positive !== left.positive) {
        return right.positive - left.positive;
      }
      return left.value.localeCompare(right.value);
    })
    .slice(0, limit);
}

function buildTokenCounters(rowsWithOutcome) {
  const tokens = createCounterMap();

  for (const { row, outcome } of rowsWithOutcome) {
    const sourceParts = [
      row.topics
    ];

    const uniqueTokens = uniqueStrings(sourceParts.flatMap((part) => tokenizeFeedbackText(part)));
    for (const token of uniqueTokens) {
      tallyCounter(tokens, token, outcome);
    }
  }

  const ranked = finalizeCounter(tokens, 30);

  return {
    preferredTerms: ranked
      .filter((item) => item.score > 0 && item.positive >= item.negative)
      .slice(0, 10)
      .map((item) => item.value),
    avoidTerms: ranked
      .filter((item) => item.score <= -4 && item.negative >= Math.max(2, item.positive + 1))
      .slice(0, 10)
      .map((item) => item.value)
  };
}

function buildFeedbackGroundingContext(options = {}) {
  const binding = options.binding ?? {};
  const projectProfile = options.projectProfile ?? {};
  const discoveryPolicy = options.discoveryPolicy ?? {};
  const discoveryBenchmark = options.discoveryBenchmark ?? {};
  const benchmarkPositiveParts = [
    ...(Array.isArray(discoveryBenchmark.positiveRepos) ? discoveryBenchmark.positiveRepos : [])
      .flatMap((entry) => [entry?.repo, entry?.why]),
    ...(Array.isArray(discoveryBenchmark.boundaryRepos) ? discoveryBenchmark.boundaryRepos : [])
      .flatMap((entry) => [entry?.repo, entry?.why])
  ];

  const groundingTerms = uniqueStrings([
    ...tokenizeFeedbackText(binding.projectKey),
    ...tokenizeFeedbackText(binding.projectLabel),
    ...(binding.discoveryHints ?? []).flatMap((item) => tokenizeFeedbackText(item)),
    ...(binding.targetCapabilities ?? []).flatMap((item) => tokenizeFeedbackText(item)),
    ...(binding.analysisQuestions ?? []).flatMap((item) => tokenizeFeedbackText(item)),
    ...(projectProfile.discoverySignals ?? []).flatMap((item) => tokenizeFeedbackText(item)),
    ...(projectProfile.manifestSignals?.keywords ?? []).flatMap((item) => tokenizeFeedbackText(item)),
    ...(projectProfile.manifestSignals?.dependencySignals ?? []).flatMap((item) => tokenizeFeedbackText(item)),
    ...(projectProfile.architectureSignals?.directorySignals ?? []).flatMap((item) => tokenizeFeedbackText(item)),
    ...benchmarkPositiveParts.flatMap((item) => tokenizeFeedbackText(item)),
    ...(discoveryPolicy.preferredSignalPatterns ?? []).flatMap((item) => tokenizeFeedbackText(item)),
    ...(discoveryPolicy.preferredTopics ?? []).flatMap((item) => tokenizeFeedbackText(item))
  ]);

  const groundingSignals = new Set(uniqueStrings([
    ...(discoveryPolicy.preferredMainLayers ?? []),
    ...(discoveryPolicy.preferredGapAreas ?? []),
    ...(discoveryPolicy.preferredCapabilities ?? []),
    ...(discoveryPolicy.preferredTopics ?? []).map((item) => normalizeFeedbackToken(item)),
    ...(discoveryPolicy.preferredSignalPatterns ?? []).map((item) => normalizeFeedbackToken(item))
  ].filter(Boolean)));

  return {
    hasGrounding: groundingTerms.length > 0 || groundingSignals.size > 0,
    groundingTerms: new Set(groundingTerms),
    groundingSignals
  };
}

function buildFeedbackRowLearningParts(row) {
  return uniqueStrings([
    row.description,
    ...splitCsvValues(row.topics),
    ...splitCsvValues(row.matched_capabilities),
    row.pattern_family_guess,
    row.main_layer_guess,
    getProjectGapAreaGuess(row, ""),
    ...splitCsvValues(row.discovery_query_families)
  ].filter(Boolean));
}

function scoreLearnedCohortActionability(parts = [], signals = []) {
  const values = uniqueStrings([...parts, ...signals]);
  let coreScore = 0;
  let supportScore = 0;
  let excludedScore = 0;

  for (const value of values) {
    const normalized = normalizeFeedbackToken(value);
    const tokens = tokenizeFeedbackText(normalized);
    const variants = uniqueStrings([normalized, ...tokens]);

    if (variants.some((variant) => LEARNED_COHORT_CORE_HINTS.has(variant))) {
      coreScore += 1;
    }
    if (variants.some((variant) => LEARNED_COHORT_SUPPORT_HINTS.has(variant))) {
      supportScore += 1;
    }
    if (variants.some((variant) => LEARNED_COHORT_EXCLUDED_HINTS.has(variant))) {
      excludedScore += 1;
    }
  }

  return {
    coreScore,
    supportScore,
    excludedScore
  };
}

function buildLearnedCohorts(rowsWithOutcome, groundingContext) {
  const outcomeRank = {
    positive: 4,
    observe: 3,
    negative: 2,
    pending: 1
  };
  const bestRowsByRepo = new Map();

  for (const item of rowsWithOutcome) {
    const repoRef = normalizeRepoRef(item.row.normalized_repo_url || item.row.repo_url || "");
    if (!repoRef) {
      continue;
    }
    const current = bestRowsByRepo.get(repoRef);
    const currentRank = current ? outcomeRank[current.outcome] ?? 0 : 0;
    const nextRank = outcomeRank[item.outcome] ?? 0;
    if (!current || nextRank > currentRank) {
      bestRowsByRepo.set(repoRef, item);
    }
  }

  const uniqueRowsWithOutcome = [...bestRowsByRepo.values()];
  const rankRows = (targetOutcome, limit = 5) =>
    uniqueRowsWithOutcome
      .filter((item) => item.outcome === targetOutcome)
      .map(({ row, outcome }) => {
        const rawParts = buildFeedbackRowLearningParts(row);
        const normalizedParts = uniqueStrings(rawParts.flatMap((part) => tokenizeFeedbackText(part)));
        const normalizedSignals = uniqueStrings([
          row.pattern_family_guess,
          row.main_layer_guess,
          getProjectGapAreaGuess(row, ""),
          ...splitCsvValues(row.matched_capabilities),
          ...splitCsvValues(row.discovery_query_families)
        ]);
        const filteredParts = outcome === "negative"
          ? normalizedParts
          : filterFeedbackTerms(normalizedParts, groundingContext);
        const filteredSignals = outcome === "negative"
          ? normalizedSignals
          : filterFeedbackSignals(normalizedSignals, groundingContext);
        const matchedGroundingTerms = outcome === "negative"
          ? []
          : filteredParts.filter((part) => groundingContext?.groundingTerms?.has(normalizeFeedbackToken(part)));
        const matchedGroundingSignals = outcome === "negative"
          ? []
          : filteredSignals.filter((signal) => {
            const normalized = normalizeFeedbackToken(signal);
            return groundingContext?.groundingSignals?.has(normalized)
              || tokenizeFeedbackText(normalized).some((token) => groundingContext?.groundingTerms?.has(token));
          });
        const groundingScore = outcome === "negative"
          ? 0
          : uniqueStrings(matchedGroundingTerms).length
            + uniqueStrings(matchedGroundingSignals).length * 2;
        const actionability = scoreLearnedCohortActionability(filteredParts, filteredSignals);

        return {
          repoRef: normalizeRepoRef(row.normalized_repo_url || row.repo_url || ""),
          outcome,
          fitScore: toNumber(row.project_fit_score),
          discoveryScore: toNumber(row.discovery_score),
          parts: filteredParts,
          signals: filteredSignals,
          matchedGroundingTerms: uniqueStrings(matchedGroundingTerms),
          matchedGroundingSignals: uniqueStrings(matchedGroundingSignals),
          groundingScore,
          cohortCoreScore: actionability.coreScore,
          cohortSupportScore: actionability.supportScore,
          cohortExcludedScore: actionability.excludedScore
        };
      })
      .filter((item) => item.repoRef && (item.parts.length > 0 || item.signals.length > 0))
      .sort((left, right) => {
        const rightScore = right.fitScore + right.discoveryScore;
        const leftScore = left.fitScore + left.discoveryScore;
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return left.repoRef.localeCompare(right.repoRef);
      })
      .slice(0, limit);

  const positive = rankRows("positive", 6);
  const negative = rankRows("negative", 6);
  const observe = rankRows("observe", 4);

  return {
    positive,
    negative,
    observe,
    positiveParts: uniqueStrings(positive.flatMap((item) => item.parts)).slice(0, 16),
    negativeParts: uniqueStrings(negative.flatMap((item) => item.parts)).slice(0, 16),
    positiveSignals: uniqueStrings(positive.flatMap((item) => item.signals)).slice(0, 12),
    negativeSignals: uniqueStrings(negative.flatMap((item) => item.signals)).slice(0, 12)
  };
}

function filterFeedbackTerms(terms = [], groundingContext) {
  if (!groundingContext?.hasGrounding) {
    return terms;
  }

  return terms.filter((term) => groundingContext.groundingTerms.has(normalizeFeedbackToken(term)));
}

function filterFeedbackSignals(signals = [], groundingContext) {
  if (!groundingContext?.hasGrounding) {
    return signals;
  }

  return signals.filter((signal) => {
    const normalized = normalizeFeedbackToken(signal);
    return groundingContext.groundingSignals.has(normalized)
      || tokenizeFeedbackText(normalized).some((token) => groundingContext.groundingTerms.has(token));
  });
}

function renderFeedbackSummary(feedback) {
  const preferredTermLines = feedback.preferredTerms.length > 0
    ? feedback.preferredTerms.map((item) => `- ${item}`).join("\n")
    : "- none";
  const avoidTermLines = feedback.avoidTerms.length > 0
    ? feedback.avoidTerms.map((item) => `- ${item}`).join("\n")
    : "- none";
  const queryFamilyLines = feedback.queryFamilyOutcomes.length > 0
    ? feedback.queryFamilyOutcomes.map((item) => `- ${item.value}: +${item.positive} / -${item.negative} / observe=${item.observe} | score=${item.score}`).join("\n")
    : "- none";
  const preferredLines = feedback.preferredSignals.length > 0
    ? feedback.preferredSignals.map((item) => `- ${item}`).join("\n")
    : "- none";
  const avoidLines = feedback.avoidSignals.length > 0
    ? feedback.avoidSignals.map((item) => `- ${item}`).join("\n")
    : "- none";
  const learnedPositiveLines = (feedback.learnedCohorts?.positive?.length ?? 0) > 0
    ? feedback.learnedCohorts.positive
      .map((item) => `- ${item.repoRef}: ${uniqueStrings([...item.parts.slice(0, 4), ...item.signals.slice(0, 2)]).join(", ")}`)
      .join("\n")
    : "- none";
  const learnedNegativeLines = (feedback.learnedCohorts?.negative?.length ?? 0) > 0
    ? feedback.learnedCohorts.negative
      .map((item) => `- ${item.repoRef}: ${uniqueStrings([...item.parts.slice(0, 4), ...item.signals.slice(0, 2)]).join(", ")}`)
      .join("\n")
    : "- none";

  return `# Discovery Feedback Snapshot

- project: ${feedback.projectKey}
- generated_at: ${feedback.generatedAt}
- positive_rows: ${feedback.totals.positive}
- negative_rows: ${feedback.totals.negative}
- observe_rows: ${feedback.totals.observe}
- pending_rows: ${feedback.totals.pending}

## Preferred Terms

${preferredTermLines}

## Avoid Terms

${avoidTermLines}

## Preferred Signals

${preferredLines}

## Avoid Signals

${avoidLines}

## Learned Positive Cohorts

${learnedPositiveLines}

## Learned Negative Cohorts

${learnedNegativeLines}

## Query Family Outcomes

${queryFamilyLines}
`;
}

export function buildDiscoverySeedMemory(projectKey, feedback, options = {}) {
  const binding = options.binding ?? {};
  const positive = Array.isArray(feedback?.learnedCohorts?.positive) ? feedback.learnedCohorts.positive : [];
  const observe = Array.isArray(feedback?.learnedCohorts?.observe) ? feedback.learnedCohorts.observe : [];
  const negative = Array.isArray(feedback?.learnedCohorts?.negative) ? feedback.learnedCohorts.negative : [];
  const isActionableLearnedItem = (item) => {
    const coreScore = item?.cohortCoreScore ?? 0;
    const supportScore = item?.cohortSupportScore ?? 0;
    const excludedScore = item?.cohortExcludedScore ?? 0;
    return coreScore >= 1 && (coreScore + supportScore) >= 2 && excludedScore <= coreScore;
  };
  const isStrongLearnedItem = (item) =>
    (item?.groundingScore ?? 0) >= 3
    && isActionableLearnedItem(item)
    && ((item?.fitScore ?? 0) >= 60 || (item?.discoveryScore ?? 0) >= 50);
  const isReferenceLearnedItem = (item) =>
    (item?.groundingScore ?? 0) >= 4
    && isActionableLearnedItem(item)
    && ((item?.fitScore ?? 0) >= 45 || (item?.discoveryScore ?? 0) >= 40);

  const toSeedEntry = (item) => ({
    repo: item.repoRef,
    topics: uniqueStrings([...(item.parts ?? []).slice(0, 4), ...(item.signals ?? []).slice(0, 3)]),
    why: uniqueStrings([
      ...(item.matchedGroundingTerms ?? []).slice(0, 4),
      ...(item.matchedGroundingSignals ?? []).slice(0, 3),
      ...(item.parts ?? []).slice(0, 2)
    ]).join(", "),
    description: `Learned discovery cohort from ${binding.projectLabel ?? projectKey}.`
  });

  const toCohortEntry = (item, kind = "priority") => {
    const owner = extractRepoOwner(item.repoRef);
    const signalPool = uniqueStrings([
      ...(item.signals ?? []).slice(0, 4),
      ...(item.parts ?? []).slice(0, 4)
    ]).slice(0, 5);
    const antiSignals = uniqueStrings(
      negative.flatMap((negativeItem) => [
        ...(negativeItem.signals ?? []).slice(0, 2),
        ...(negativeItem.parts ?? []).slice(0, 2)
      ])
    ).slice(0, 4);
    const titleCore = signalPool.slice(0, 2).join(" ").trim() || "learned family";
    const cohortId = `${kind}-${owner || "repo"}-${titleCore}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    return {
      id: cohortId,
      label: `${owner || "repo"} ${kind === "priority" ? "priority" : "reference"} cohort`,
      owners: owner ? [owner] : [],
      repoRefs: [item.repoRef],
      signals: signalPool,
      boundarySignals: uniqueStrings([...(item.parts ?? []).slice(2, 5)]).slice(0, 3),
      antiSignals,
      why: `Learned from ${binding.projectLabel ?? projectKey} review and promotion history.`
    };
  };

  const priorityItems = positive
    .filter((item) => (item.fitScore >= 70 || item.discoveryScore >= 60) && isStrongLearnedItem(item))
    .slice(0, 6);
  const referenceItems = [
    ...positive.filter((item) => item.fitScore < 70 && item.discoveryScore < 60 && isReferenceLearnedItem(item)).slice(0, 4),
    ...observe.filter((item) => isReferenceLearnedItem(item)).slice(0, 4)
  ];
  const protectedRepoKeys = new Set([
    ...positive.map((item) => canonicalizeRepoRef(item.repoRef)),
    ...priorityItems.map((item) => canonicalizeRepoRef(item.repoRef)),
    ...referenceItems.map((item) => canonicalizeRepoRef(item.repoRef))
  ]);
  const negativeItems = negative
    .filter((item) => !protectedRepoKeys.has(canonicalizeRepoRef(item.repoRef)))
    .slice(0, 6);

  return {
    projectKey,
    version: 1,
    generatedAt: new Date().toISOString(),
    intent: `Learned discovery seed memory for ${binding.projectLabel ?? projectKey} from queue and promotion history.`,
    priorityRepos: priorityItems.map(toSeedEntry),
    priorityCohorts: priorityItems.slice(0, 4).map((item) => toCohortEntry(item, "priority")),
    referenceRepos: referenceItems.map(toSeedEntry),
    referenceCohorts: referenceItems.slice(0, 3).map((item) => toCohortEntry(item, "reference")),
    negativeRepos: negativeItems.map(toSeedEntry)
  };
}

function renderSeedMemorySummary(seedMemory) {
  const renderGroup = (items) =>
    items.length > 0
      ? items.map((item) => `- ${item.repo}: ${item.why || "-"}`).join("\n")
      : "- none";

  return `# Discovery Seed Memory

- project: ${seedMemory.projectKey}
- generated_at: ${seedMemory.generatedAt}

## Priority Repos

${renderGroup(seedMemory.priorityRepos ?? [])}

## Reference Repos

${renderGroup(seedMemory.referenceRepos ?? [])}

## Negative Repos

${renderGroup(seedMemory.negativeRepos ?? [])}

## Priority Cohorts

${renderGroup((seedMemory.priorityCohorts ?? []).map((item) => ({
  repo: item.id,
  why: `${item.label}: ${(item.signals ?? []).join(", ")}`
})))}

## Reference Cohorts

${renderGroup((seedMemory.referenceCohorts ?? []).map((item) => ({
  repo: item.id,
  why: `${item.label}: ${(item.signals ?? []).join(", ")}`
})))}
`;
}

export async function loadDiscoveryFeedback(rootDir, config, projectKey, options = {}) {
  const rows = await loadQueueEntries(rootDir, config);
  const projectRows = rows.filter((row) => row.project_key === projectKey);
  const rowsWithOutcome = projectRows.map((row) => ({
    row,
    outcome: deriveFeedbackOutcome(row)
  }));

  const totals = rowsWithOutcome.reduce((acc, item) => {
    acc[item.outcome] = (acc[item.outcome] ?? 0) + 1;
    return acc;
  }, { positive: 0, negative: 0, observe: 0, pending: 0 });

  const patternFamilyCounter = createCounterMap();
  const mainLayerCounter = createCounterMap();
  const gapAreaCounter = createCounterMap();
  const capabilityCounter = createCounterMap();
  const queryFamilyCounter = createCounterMap();
  const topicCounter = createCounterMap();

  for (const { row, outcome } of rowsWithOutcome) {
    tallyCounter(patternFamilyCounter, row.pattern_family_guess, outcome);
    tallyCounter(mainLayerCounter, row.main_layer_guess, outcome);
    tallyCounter(gapAreaCounter, getProjectGapAreaGuess(row, ""), outcome);

    for (const capability of splitCsvValues(row.matched_capabilities)) {
      tallyCounter(capabilityCounter, capability, outcome);
    }
    for (const queryFamily of splitCsvValues(row.discovery_query_families)) {
      tallyCounter(queryFamilyCounter, queryFamily, outcome);
    }
    for (const topic of splitCsvValues(row.topics)) {
      tallyCounter(topicCounter, topic, outcome);
    }
  }

  const tokenFeedback = buildTokenCounters(rowsWithOutcome);
  const queryFamilyOutcomes = finalizeCounter(queryFamilyCounter, 12);
  const groundingContext = buildFeedbackGroundingContext(options);
  const learnedCohorts = buildLearnedCohorts(rowsWithOutcome, groundingContext);
  const preferredSignals = filterFeedbackSignals(uniqueStrings([
    ...finalizeCounter(patternFamilyCounter, 5).filter((item) => item.score > 0).map((item) => item.value),
    ...finalizeCounter(mainLayerCounter, 5).filter((item) => item.score > 0).map((item) => item.value),
    ...finalizeCounter(gapAreaCounter, 5).filter((item) => item.score > 0).map((item) => item.value),
    ...finalizeCounter(capabilityCounter, 8).filter((item) => item.score > 0).map((item) => item.value),
    ...finalizeCounter(topicCounter, 8).filter((item) => item.score > 0).map((item) => item.value),
    ...(learnedCohorts.positiveSignals ?? [])
  ]), groundingContext);
  const avoidSignals = uniqueStrings([
    ...finalizeCounter(patternFamilyCounter, 5).filter((item) => item.score < 0).map((item) => item.value),
    ...finalizeCounter(mainLayerCounter, 5).filter((item) => item.score < 0).map((item) => item.value),
    ...finalizeCounter(gapAreaCounter, 5).filter((item) => item.score < 0).map((item) => item.value),
    ...finalizeCounter(topicCounter, 8).filter((item) => item.score < 0).map((item) => item.value),
    ...(learnedCohorts.negativeSignals ?? [])
  ]);

  const feedbackStrength = clamp((totals.positive * 2 + totals.negative + totals.observe) / 12, 0, 1);

  return {
    projectKey,
    generatedAt: new Date().toISOString(),
    totals,
    feedbackStrength,
    preferredTerms: uniqueStrings([
      ...filterFeedbackTerms(tokenFeedback.preferredTerms, groundingContext),
      ...(learnedCohorts.positiveParts ?? [])
    ]),
    avoidTerms: uniqueStrings([
      ...tokenFeedback.avoidTerms,
      ...(learnedCohorts.negativeParts ?? [])
    ]),
    preferredSignals,
    avoidSignals,
    learnedCohorts,
    queryFamilyOutcomes,
    hasSignals: totals.positive + totals.negative + totals.observe > 0
  };
}

export async function writeDiscoveryFeedbackSnapshot(rootDir, projectKey, feedback, dryRun = false) {
  const feedbackDir = path.join(rootDir, "state", "discovery_feedback");
  const jsonPath = path.join(feedbackDir, `${projectKey}.json`);
  const markdownPath = path.join(feedbackDir, `${projectKey}.md`);

  if (!dryRun) {
    await fs.mkdir(feedbackDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(feedback, null, 2), "utf8");
    await fs.writeFile(markdownPath, renderFeedbackSummary(feedback), "utf8");
  }

  return {
    jsonPath,
    markdownPath
  };
}

export async function writeDiscoverySeedMemorySnapshot(rootDir, projectKey, seedMemory, dryRun = false) {
  const seedDir = path.join(rootDir, "state", "discovery_seeds");
  const jsonPath = path.join(seedDir, `${projectKey}.json`);
  const markdownPath = path.join(seedDir, `${projectKey}.md`);

  if (!dryRun) {
    await fs.mkdir(seedDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(seedMemory, null, 2), "utf8");
    await fs.writeFile(markdownPath, renderSeedMemorySummary(seedMemory), "utf8");
  }

  return {
    jsonPath,
    markdownPath
  };
}
