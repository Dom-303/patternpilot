import fs from "node:fs/promises";
import path from "node:path";
import { buildAutomationAlertAttention } from "./automation-jobs.mjs";

function normalizePath(value) {
  return value ? path.resolve(value) : null;
}

export function parseAutomationAlertHookArgs(argv) {
  const args = [...argv];
  const options = {
    payloadFile: null,
    writeMarkdown: null,
    writeJson: null,
    print: false
  };

  while (args.length > 0) {
    const token = args.shift();
    if (token === "--payload-file") {
      options.payloadFile = normalizePath(args.shift() ?? null);
      continue;
    }
    if (token === "--write-markdown") {
      options.writeMarkdown = normalizePath(args.shift() ?? null);
      continue;
    }
    if (token === "--write-json") {
      options.writeJson = normalizePath(args.shift() ?? null);
      continue;
    }
    if (token === "--print") {
      options.print = true;
    }
  }

  return options;
}

export async function loadAutomationAlertHookPayload(options = {}, env = process.env) {
  const explicitPayloadFile = normalizePath(options.payloadFile);
  const envPayloadFile = normalizePath(env.PATTERNPILOT_ALERT_PAYLOAD_FILE);

  if (explicitPayloadFile) {
    const raw = await fs.readFile(explicitPayloadFile, "utf8");
    return JSON.parse(raw);
  }

  if (envPayloadFile) {
    const raw = await fs.readFile(envPayloadFile, "utf8");
    return JSON.parse(raw);
  }

  if (env.PATTERNPILOT_ALERT_JSON) {
    return JSON.parse(env.PATTERNPILOT_ALERT_JSON);
  }

  throw new Error("No alert payload found. Provide --payload-file or PATTERNPILOT_ALERT_PAYLOAD_FILE.");
}

export function buildAutomationAlertDigest(payload) {
  const alerts = Array.isArray(payload?.alerts) ? payload.alerts : [];
  const operatorReviewDigest = payload?.operatorReviewDigest ?? null;
  const attention = payload?.attention ?? buildAutomationAlertAttention({
    alerts,
    operatorReviewDigest,
    nextJob: payload?.nextJob ?? null
  });
  const severityCounts = { high: 0, medium: 0, low: 0 };
  const categoryCounts = {};
  const jobCounts = {};

  for (const alert of alerts) {
    const severity = String(alert?.severity ?? "low").toLowerCase();
    if (severityCounts[severity] != null) {
      severityCounts[severity] += 1;
    }
    const category = String(alert?.category ?? "uncategorized");
    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;
    if (alert?.jobName) {
      jobCounts[alert.jobName] = (jobCounts[alert.jobName] ?? 0) + 1;
    }
  }

  const topCategories = Object.entries(categoryCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([category, count]) => ({ category, count }));
  const touchedJobs = Object.entries(jobCounts)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([jobName, count]) => ({ jobName, count }));

  return {
    schemaVersion: 1,
    sourceSchemaVersion: payload?.schemaVersion ?? null,
    generatedAt: payload?.generatedAt ?? null,
    alertCount: alerts.length,
    severityCounts,
    nextJob: payload?.nextJob ?? null,
    topCategories,
    touchedJobs,
    attentionStatus: attention?.status ?? "routine",
    deliveryPriority: attention?.deliveryPriority ?? "routine",
    attentionSignals: Array.isArray(attention?.signals) ? attention.signals : [],
    attentionPromotedJobs: Array.isArray(attention?.promotedJobs) ? attention.promotedJobs : [],
    attentionSummary: attention?.summary ?? "Routine automation alert delivery is sufficient.",
    attentionNextAction: attention?.nextAction ?? null,
    operatorReviewOpenCount: Number(operatorReviewDigest?.openCount ?? 0) || 0,
    operatorReviewRecentCloseoutCount: Number(operatorReviewDigest?.recentCloseoutCount ?? 0) || 0,
    operatorReviewOpenJobs: Array.isArray(operatorReviewDigest?.openReviews)
      ? operatorReviewDigest.openReviews.map((item) => item.jobName).filter(Boolean)
      : [],
    operatorReviewRecentCloseoutJobs: Array.isArray(operatorReviewDigest?.recentCloseouts)
      ? operatorReviewDigest.recentCloseouts.map((item) => item.jobName).filter(Boolean)
      : []
  };
}

export function renderAutomationAlertHookMarkdown(payload, digest = buildAutomationAlertDigest(payload)) {
  const topCategoryLines = digest.topCategories.length > 0
    ? digest.topCategories.map((item) => `- ${item.category}: ${item.count}`).join("\n")
    : "- none";
  const touchedJobLines = digest.touchedJobs.length > 0
    ? digest.touchedJobs.map((item) => `- ${item.jobName}: ${item.count}`).join("\n")
    : "- none";
  const alertLines = Array.isArray(payload?.alerts) && payload.alerts.length > 0
    ? payload.alerts.slice(0, 10).map((alert) => `- ${String(alert.severity ?? "low").toUpperCase()} | ${alert.category ?? "-"} | ${alert.jobName ?? "-"} | ${alert.message ?? "-"} | next_action=${alert.nextAction ?? "-"}`).join("\n")
    : "- none";
  const operatorReviewOpenLines = Array.isArray(payload?.operatorReviewDigest?.openReviews) && payload.operatorReviewDigest.openReviews.length > 0
    ? payload.operatorReviewDigest.openReviews.map((review) =>
      `- ${review.jobName ?? "-"} | category=${review.category ?? "-"} | source_status=${review.sourceStatus ?? "-"} | opened_at=${review.openedAt ?? "-"}`
    ).join("\n")
    : "- none";
  const operatorReviewCloseoutLines = Array.isArray(payload?.operatorReviewDigest?.recentCloseouts) && payload.operatorReviewDigest.recentCloseouts.length > 0
    ? payload.operatorReviewDigest.recentCloseouts.map((review) =>
      `- ${review.jobName ?? "-"} | status=${review.status ?? "-"} | resolved_at=${review.resolvedAt ?? "-"} | notes=${review.resolutionNotes ?? "-"}`
    ).join("\n")
    : "- none";

  return `# Patternpilot Alert Hook Digest

- generated_at: ${digest.generatedAt ?? "-"}
- source_schema_version: ${digest.sourceSchemaVersion ?? "-"}
- alerts: ${digest.alertCount}
- severity_high: ${digest.severityCounts.high}
- severity_medium: ${digest.severityCounts.medium}
- severity_low: ${digest.severityCounts.low}
- attention_status: ${digest.attentionStatus}
- delivery_priority: ${digest.deliveryPriority}
- attention_signals: ${digest.attentionSignals.join(", ") || "-"}
- attention_jobs: ${digest.attentionPromotedJobs.join(", ") || "-"}
- operator_reviews_open: ${digest.operatorReviewOpenCount}
- operator_reviews_recent_closeouts: ${digest.operatorReviewRecentCloseoutCount}
- next_ready_job: ${digest.nextJob?.name ?? "-"}
- next_ready_job_status: ${digest.nextJob?.status ?? "-"}

## Priority Focus

- summary: ${digest.attentionSummary}
- next_action: ${digest.attentionNextAction ?? "-"}

## Top Categories

${topCategoryLines}

## Touched Jobs

${touchedJobLines}

## Alerts

${alertLines}

## Operator Reviews Open

${operatorReviewOpenLines}

## Operator Reviews Recent Closeouts

${operatorReviewCloseoutLines}
`;
}

export async function writeAutomationAlertHookOutputs(options) {
  const writes = [];
  if (options.writeMarkdown) {
    await fs.mkdir(path.dirname(options.writeMarkdown), { recursive: true });
    await fs.writeFile(options.writeMarkdown, `${options.markdown}\n`, "utf8");
    writes.push({
      type: "markdown",
      location: options.writeMarkdown
    });
  }

  if (options.writeJson) {
    await fs.mkdir(path.dirname(options.writeJson), { recursive: true });
    await fs.writeFile(options.writeJson, `${JSON.stringify({
      schemaVersion: 1,
      generatedAt: options.payload?.generatedAt ?? null,
      digest: options.digest,
      payload: options.payload
    }, null, 2)}\n`, "utf8");
    writes.push({
      type: "json",
      location: options.writeJson
    });
  }

  return writes;
}
