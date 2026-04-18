import fs from "node:fs/promises";
import path from "node:path";

function reviewStateShape() {
  return {
    schemaVersion: 1,
    updatedAt: null,
    reviews: {},
    events: []
  };
}

function normalizeReviews(state) {
  return state && typeof state.reviews === "object" && state.reviews
    ? state.reviews
    : {};
}

function normalizeEvents(state) {
  return Array.isArray(state?.events) ? state.events : [];
}

function sanitizeIdPart(value) {
  return String(value ?? "unknown")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "unknown";
}

function buildReviewId(jobName, timestamp) {
  return `arev_${sanitizeIdPart(jobName)}_${sanitizeIdPart(timestamp)}`;
}

function sortByMostRecent(items, dateKey) {
  return [...items].sort((left, right) => {
    const leftValue = new Date(left?.[dateKey] ?? 0).getTime();
    const rightValue = new Date(right?.[dateKey] ?? 0).getTime();
    return rightValue - leftValue;
  });
}

function trimEvents(events, maxEvents = 500) {
  const limit = Math.max(20, Number(maxEvents ?? 500) || 500);
  return events.slice(0, limit);
}

function buildReviewEvent({
  recordedAt,
  reviewId,
  jobName,
  type,
  statusAfter,
  category = null,
  sourceStatus = null,
  note = null,
  reason = null,
  nextAction = null,
  nextCommand = null
}) {
  return {
    eventId: `arev_evt_${sanitizeIdPart(jobName)}_${sanitizeIdPart(recordedAt)}_${sanitizeIdPart(type)}`,
    recordedAt,
    reviewId,
    jobName,
    type,
    statusAfter,
    category,
    sourceStatus,
    note,
    reason,
    nextAction,
    nextCommand
  };
}

export async function loadAutomationOperatorReviews(rootDir, config) {
  const reviewsPath = path.join(rootDir, config.automationOperatorReviewsFile ?? "state/automation_operator_reviews.json");
  try {
    const raw = await fs.readFile(reviewsPath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      reviewsPath,
      reviewState: {
        schemaVersion: 1,
        updatedAt: parsed.updatedAt ?? null,
        reviews: normalizeReviews(parsed),
        events: normalizeEvents(parsed)
      }
    };
  } catch (error) {
    if (error?.code === "ENOENT") {
      return {
        reviewsPath,
        reviewState: reviewStateShape()
      };
    }
    throw error;
  }
}

export async function writeAutomationOperatorReviews(rootDir, config, reviewState, dryRun = false) {
  const reviewsPath = path.join(rootDir, config.automationOperatorReviewsFile ?? "state/automation_operator_reviews.json");
  if (dryRun) {
    return reviewsPath;
  }
  await fs.mkdir(path.dirname(reviewsPath), { recursive: true });
  await fs.writeFile(reviewsPath, `${JSON.stringify(reviewState, null, 2)}\n`, "utf8");
  return reviewsPath;
}

export function recordAutomationOperatorReviewOpen(reviewState, review, options = {}) {
  const openedAt = review.openedAt ?? new Date().toISOString();
  const previous = normalizeReviews(reviewState)[review.jobName] ?? null;
  const nextReviewId = previous?.status === "open" && previous?.category === review.category && previous?.sourceStatus === review.sourceStatus
    ? previous.reviewId
    : buildReviewId(review.jobName, openedAt);
  const current = {
    reviewId: nextReviewId,
    jobName: review.jobName,
    status: "open",
    category: review.category ?? "dispatch_escalation",
    sourceStatus: review.sourceStatus ?? "operator_ack_required",
    openedAt: previous?.status === "open" ? previous.openedAt ?? openedAt : openedAt,
    updatedAt: openedAt,
    reason: review.reason ?? previous?.reason ?? null,
    nextAction: review.nextAction ?? previous?.nextAction ?? null,
    nextCommand: review.nextCommand ?? previous?.nextCommand ?? null,
    resolutionStatus: null,
    resolutionNotes: null,
    resolvedAt: null
  };
  const event = buildReviewEvent({
    recordedAt: openedAt,
    reviewId: nextReviewId,
    jobName: review.jobName,
    type: previous?.status === "open" ? "refreshed" : "opened",
    statusAfter: "open",
    category: current.category,
    sourceStatus: current.sourceStatus,
    note: review.note ?? null,
    reason: current.reason,
    nextAction: current.nextAction,
    nextCommand: current.nextCommand
  });
  const nextState = {
    schemaVersion: 1,
    updatedAt: openedAt,
    reviews: {
      ...normalizeReviews(reviewState),
      [review.jobName]: current
    },
    events: trimEvents([event, ...normalizeEvents(reviewState)], options.maxEvents)
  };

  return {
    state: nextState,
    result: {
      status: previous?.status === "open" ? "refreshed" : "opened",
      previous,
      current,
      event
    }
  };
}

export function recordAutomationOperatorReviewResolution(reviewState, resolution, options = {}) {
  const resolvedAt = resolution.resolvedAt ?? new Date().toISOString();
  const previous = normalizeReviews(reviewState)[resolution.jobName] ?? null;
  const fallbackReviewId = buildReviewId(resolution.jobName, resolvedAt);
  const current = {
    reviewId: previous?.reviewId ?? fallbackReviewId,
    jobName: resolution.jobName,
    status: resolution.status ?? "acknowledged",
    category: previous?.category ?? resolution.category ?? "dispatch_escalation",
    sourceStatus: previous?.sourceStatus ?? resolution.sourceStatus ?? null,
    openedAt: previous?.openedAt ?? resolvedAt,
    updatedAt: resolvedAt,
    reason: previous?.reason ?? resolution.reason ?? null,
    nextAction: previous?.nextAction ?? resolution.nextAction ?? null,
    nextCommand: resolution.nextCommand ?? previous?.nextCommand ?? null,
    resolutionStatus: resolution.status ?? "acknowledged",
    resolutionNotes: resolution.notes ?? null,
    resolvedAt
  };
  const event = buildReviewEvent({
    recordedAt: resolvedAt,
    reviewId: current.reviewId,
    jobName: resolution.jobName,
    type: resolution.status ?? "acknowledged",
    statusAfter: current.status,
    category: current.category,
    sourceStatus: current.sourceStatus,
    note: resolution.notes ?? null,
    reason: current.reason,
    nextAction: current.nextAction,
    nextCommand: current.nextCommand
  });
  const nextState = {
    schemaVersion: 1,
    updatedAt: resolvedAt,
    reviews: {
      ...normalizeReviews(reviewState),
      [resolution.jobName]: current
    },
    events: trimEvents([event, ...normalizeEvents(reviewState)], options.maxEvents)
  };

  return {
    state: nextState,
    result: {
      status: previous ? "resolved" : "resolved_without_open_review",
      previous,
      current,
      event
    }
  };
}

export function summarizeAutomationOperatorReviewsForJob(reviewState, jobName) {
  const current = normalizeReviews(reviewState)[jobName] ?? null;
  const events = sortByMostRecent(
    normalizeEvents(reviewState).filter((event) => event.jobName === jobName),
    "recordedAt"
  );
  const latestEvent = events[0] ?? null;
  return {
    jobName,
    currentStatus: current?.status ?? null,
    currentCategory: current?.category ?? null,
    currentSourceStatus: current?.sourceStatus ?? null,
    openedAt: current?.openedAt ?? null,
    resolvedAt: current?.resolvedAt ?? null,
    resolutionNotes: current?.resolutionNotes ?? null,
    nextAction: current?.status === "open" ? current?.nextAction ?? null : null,
    nextCommand: current?.status === "open" ? current?.nextCommand ?? null : null,
    latestEventAt: latestEvent?.recordedAt ?? null,
    latestEventType: latestEvent?.type ?? null,
    eventCount: events.length
  };
}

export function summarizeAutomationOperatorReviews(reviewState, options = {}) {
  const limit = Math.max(1, Number(options.limit ?? 10) || 10);
  const jobName = options.jobName ?? null;
  const allReviews = sortByMostRecent(
    Object.values(normalizeReviews(reviewState)).filter((review) => !jobName || review.jobName === jobName),
    "updatedAt"
  );
  const openReviews = allReviews.filter((review) => review.status === "open");
  const acknowledgedReviews = allReviews.filter((review) => review.status === "acknowledged");
  const clearedReviews = allReviews.filter((review) => review.status === "cleared");
  const recentEvents = sortByMostRecent(
    normalizeEvents(reviewState).filter((event) => !jobName || event.jobName === jobName),
    "recordedAt"
  ).slice(0, limit);

  return {
    jobName,
    totalReviews: allReviews.length,
    openCount: openReviews.length,
    acknowledgedCount: acknowledgedReviews.length,
    clearedCount: clearedReviews.length,
    openReviews: openReviews.slice(0, limit),
    recentCloseouts: allReviews.filter((review) => review.status !== "open").slice(0, limit),
    recentEvents
  };
}

export function renderAutomationOperatorReviewSummary({ generatedAt, summary }) {
  const openLines = summary.openReviews.length > 0
    ? summary.openReviews.map((review) =>
      `- ${review.jobName}: status=${review.status} | category=${review.category ?? "-"} | source_status=${review.sourceStatus ?? "-"} | opened_at=${review.openedAt ?? "-"} | next_action=${review.nextAction ?? "-"}`
    ).join("\n")
    : "- none";
  const closeoutLines = summary.recentCloseouts.length > 0
    ? summary.recentCloseouts.map((review) =>
      `- ${review.jobName}: status=${review.status} | category=${review.category ?? "-"} | resolved_at=${review.resolvedAt ?? "-"} | notes=${review.resolutionNotes ?? "-"}`
    ).join("\n")
    : "- none";
  const eventLines = summary.recentEvents.length > 0
    ? summary.recentEvents.map((event) =>
      `- ${event.recordedAt} :: job=${event.jobName} :: type=${event.type} :: status_after=${event.statusAfter} :: note=${event.note ?? "-"}`
    ).join("\n")
    : "- none";

  return `# Patternpilot Automation Operator Reviews

- generated_at: ${generatedAt}
- filter_job: ${summary.jobName ?? "-"}
- reviews: ${summary.totalReviews}
- open_reviews: ${summary.openCount}
- acknowledged: ${summary.acknowledgedCount}
- cleared: ${summary.clearedCount}

## Open Reviews

${openLines}

## Recent Closeouts

${closeoutLines}

## Recent Events

${eventLines}
`;
}
