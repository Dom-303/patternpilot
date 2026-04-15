import fs from "node:fs/promises";
import path from "node:path";
import { listProjectRunHistory } from "./run-lifecycle.mjs";

function normalizeList(values) {
  return [...new Set((Array.isArray(values) ? values : []).filter(Boolean))].sort();
}

function diffLists(previousValues = [], latestValues = []) {
  const previous = new Set(normalizeList(previousValues));
  const latest = new Set(normalizeList(latestValues));
  return {
    added: [...latest].filter((value) => !previous.has(value)).sort(),
    removed: [...previous].filter((value) => !latest.has(value)).sort()
  };
}

async function safeLoadJson(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function loadManifestFromRecord(rootDir, record) {
  if (!record?.manifestPath) {
    return null;
  }
  return safeLoadJson(path.join(rootDir, record.manifestPath));
}

function buildReviewSnapshotFromManifest(manifest) {
  if (!manifest) {
    return {
      itemCount: 0,
      reviewScope: null
    };
  }
  if (manifest.review) {
    return {
      itemCount: Array.isArray(manifest.review.items) ? manifest.review.items.length : 0,
      reviewScope: manifest.review.reviewScope ?? manifest.reviewScope ?? null
    };
  }
  return {
    itemCount: Number(manifest.reviewRun?.items ?? 0) || 0,
    reviewScope: manifest.reviewRun?.reviewScope ?? manifest.reviewScope ?? null
  };
}

async function loadReviewSnapshot(rootDir, manifest) {
  const direct = buildReviewSnapshotFromManifest(manifest);
  if (direct.itemCount > 0 || direct.reviewScope) {
    return direct;
  }
  if (!manifest?.reviewRun?.runDir) {
    return direct;
  }
  const linkedManifest = await safeLoadJson(path.join(rootDir, manifest.reviewRun.runDir, "manifest.json"));
  return buildReviewSnapshotFromManifest(linkedManifest);
}

function buildRunSignature(record, manifest, review) {
  return {
    runId: record.runId,
    createdAt: record.createdAt,
    command: record.command,
    sourceMode: manifest?.sourceMode ?? record.sourceMode ?? null,
    runKind: manifest?.runPlan?.runKind ?? null,
    effectiveUrls: normalizeList(manifest?.effectiveUrls ?? []),
    explicitUrlCount: Array.isArray(manifest?.explicitUrls) ? manifest.explicitUrls.length : 0,
    reviewItemCount: review?.itemCount ?? 0,
    reviewScope: review?.reviewScope ?? null
  };
}

function compareRunSignatures(latest, previous) {
  const reasons = [];
  const effectiveUrlDelta = diffLists(previous.effectiveUrls, latest.effectiveUrls);
  if (latest.runKind !== previous.runKind) {
    reasons.push(`run_kind:${previous.runKind ?? "-"}->${latest.runKind ?? "-"}`);
  }
  if (latest.sourceMode !== previous.sourceMode) {
    reasons.push(`source_mode:${previous.sourceMode ?? "-"}->${latest.sourceMode ?? "-"}`);
  }
  if (effectiveUrlDelta.added.length > 0 || effectiveUrlDelta.removed.length > 0) {
    reasons.push(`effective_urls:+${effectiveUrlDelta.added.length}/-${effectiveUrlDelta.removed.length}`);
  }
  if (latest.reviewScope !== previous.reviewScope) {
    reasons.push(`review_scope:${previous.reviewScope ?? "-"}->${latest.reviewScope ?? "-"}`);
  }
  const reviewDelta = latest.reviewItemCount - previous.reviewItemCount;
  if (reviewDelta !== 0) {
    reasons.push(`review_items:${reviewDelta >= 0 ? "+" : ""}${reviewDelta}`);
  }

  return {
    latestRunId: latest.runId,
    previousRunId: previous.runId,
    stable: reasons.length === 0,
    reasons,
    effectiveUrlDelta,
    reviewItemDelta: reviewDelta
  };
}

function buildStreak(signatures, selector) {
  if (signatures.length === 0) {
    return 0;
  }
  const first = selector(signatures[0]);
  let streak = 1;
  for (let index = 1; index < signatures.length; index += 1) {
    if (selector(signatures[index]) !== first) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function buildPairStreak(pairs, shouldCount) {
  let streak = 0;
  for (const pair of pairs) {
    if (!shouldCount(pair)) {
      break;
    }
    streak += 1;
  }
  return streak;
}

function buildStabilityStatus({ signatures, stableStreak, unstableStreak }) {
  if (signatures.length <= 1) {
    return "baseline_only";
  }
  if (unstableStreak >= 2) {
    return "unstable_streak";
  }
  if (stableStreak >= 2) {
    return "stable_streak";
  }
  if (stableStreak === 1) {
    return "lightly_stable";
  }
  return "mixed";
}

export async function buildProjectRunStability(rootDir, config, {
  projectKey,
  limit = 6
}) {
  const history = await listProjectRunHistory(rootDir, config, projectKey);
  const slicedHistory = history.slice(0, Math.max(1, limit));
  const signatures = [];

  for (const record of slicedHistory) {
    const manifest = await loadManifestFromRecord(rootDir, record);
    const review = await loadReviewSnapshot(rootDir, manifest);
    signatures.push(buildRunSignature(record, manifest, review));
  }

  const pairs = [];
  for (let index = 0; index < signatures.length - 1; index += 1) {
    pairs.push(compareRunSignatures(signatures[index], signatures[index + 1]));
  }

  const stablePairs = pairs.filter((item) => item.stable).length;
  const unstablePairs = pairs.length - stablePairs;
  const stableStreak = buildPairStreak(pairs, (pair) => pair.stable);
  const unstableStreak = buildPairStreak(pairs, (pair) => !pair.stable);
  const runKindStreak = buildStreak(signatures, (item) => item.runKind ?? "-");
  const sourceModeStreak = buildStreak(signatures, (item) => item.sourceMode ?? "-");
  const status = buildStabilityStatus({
    signatures,
    stableStreak,
    unstableStreak
  });

  return {
    projectKey,
    generatedAt: new Date().toISOString(),
    limit,
    status,
    totalRuns: signatures.length,
    comparedPairs: pairs.length,
    stablePairs,
    unstablePairs,
    stableStreak,
    unstableStreak,
    runKindStreak,
    sourceModeStreak,
    signatures,
    pairs
  };
}

export function renderProjectRunStabilitySummary({
  projectKey,
  stability
}) {
  const runLines = stability.signatures.length > 0
    ? stability.signatures.map((item) => `- ${item.runId}: kind=${item.runKind ?? "-"} | source=${item.sourceMode ?? "-"} | urls=${item.effectiveUrls.length} | review_items=${item.reviewItemCount}`).join("\n")
    : "- none";
  const pairLines = stability.pairs.length > 0
    ? stability.pairs.map((pair) => `- ${pair.latestRunId} vs ${pair.previousRunId}: ${pair.stable ? "stable" : "changed"}${pair.reasons.length > 0 ? ` | ${pair.reasons.join(", ")}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot Run Stability

- project: ${projectKey}
- generated_at: ${stability.generatedAt}
- status: ${stability.status}
- total_runs: ${stability.totalRuns}
- compared_pairs: ${stability.comparedPairs}
- stable_pairs: ${stability.stablePairs}
- unstable_pairs: ${stability.unstablePairs}
- stable_streak: ${stability.stableStreak}
- unstable_streak: ${stability.unstableStreak}
- run_kind_streak: ${stability.runKindStreak}
- source_mode_streak: ${stability.sourceModeStreak}

## Recent Runs

${runLines}

## Pair Comparison

${pairLines}
`;
}
