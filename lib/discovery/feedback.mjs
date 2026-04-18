import fs from "node:fs/promises";
import path from "node:path";
import { DISCOVERY_STOPWORDS } from "../constants.mjs";
import { loadQueueEntries } from "../queue.mjs";
import { getProjectGapAreaGuess } from "../legacy-project-fields.mjs";
import { clamp, uniqueStrings } from "../utils.mjs";

const DISCOVERY_FEEDBACK_STOPWORDS = new Set([
  "and",
  "broad",
  "design",
  "discovery",
  "distribution",
  "event",
  "family",
  "families",
  "framework",
  "infra",
  "intake",
  "layer",
  "layers",
  "local",
  "pattern",
  "patterns",
  "place",
  "project",
  "scan",
  "source",
  "surface",
  "surfaces"
]);

function splitCsvValues(value) {
  return String(value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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

function tokenizeFeedbackText(value) {
  return normalizeFeedbackToken(value)
    .split(/\s+/)
    .map((item) => item.trim())
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
  const preferred = createCounterMap();
  const avoid = createCounterMap();

  for (const { row, outcome } of rowsWithOutcome) {
    const sourceParts = [
      row.topics,
      row.matched_capabilities
    ];

    const uniqueTokens = uniqueStrings(sourceParts.flatMap((part) => tokenizeFeedbackText(part)));
    for (const token of uniqueTokens) {
      if (outcome === "positive" || outcome === "observe") {
        tallyCounter(preferred, token, outcome);
      }
      if (outcome === "negative") {
        tallyCounter(avoid, token, outcome);
      }
    }
  }

  return {
    preferredTerms: finalizeCounter(preferred, 10)
      .filter((item) => item.score > 0)
      .map((item) => item.value),
    avoidTerms: finalizeCounter(avoid, 10)
      .filter((item) => item.negative > 0)
      .map((item) => item.value)
  };
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

## Query Family Outcomes

${queryFamilyLines}
`;
}

export async function loadDiscoveryFeedback(rootDir, config, projectKey) {
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
  const preferredSignals = uniqueStrings([
    ...finalizeCounter(patternFamilyCounter, 5).filter((item) => item.score > 0).map((item) => item.value),
    ...finalizeCounter(mainLayerCounter, 5).filter((item) => item.score > 0).map((item) => item.value),
    ...finalizeCounter(gapAreaCounter, 5).filter((item) => item.score > 0).map((item) => item.value),
    ...finalizeCounter(capabilityCounter, 8).filter((item) => item.score > 0).map((item) => item.value),
    ...finalizeCounter(topicCounter, 8).filter((item) => item.score > 0).map((item) => item.value)
  ]);
  const avoidSignals = uniqueStrings([
    ...finalizeCounter(patternFamilyCounter, 5).filter((item) => item.score < 0).map((item) => item.value),
    ...finalizeCounter(mainLayerCounter, 5).filter((item) => item.score < 0).map((item) => item.value),
    ...finalizeCounter(gapAreaCounter, 5).filter((item) => item.score < 0).map((item) => item.value),
    ...finalizeCounter(topicCounter, 8).filter((item) => item.score < 0).map((item) => item.value)
  ]);

  const feedbackStrength = clamp((totals.positive * 2 + totals.negative + totals.observe) / 12, 0, 1);

  return {
    projectKey,
    generatedAt: new Date().toISOString(),
    totals,
    feedbackStrength,
    preferredTerms: tokenFeedback.preferredTerms,
    avoidTerms: tokenFeedback.avoidTerms,
    preferredSignals,
    avoidSignals,
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
