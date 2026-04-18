import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildAutomationAlertDigest,
  loadAutomationAlertHookPayload,
  parseAutomationAlertHookArgs,
  renderAutomationAlertHookMarkdown,
  writeAutomationAlertHookOutputs
} from "../lib/automation/alert-hook.mjs";

test("parseAutomationAlertHookArgs parses payload and output flags", () => {
  const options = parseAutomationAlertHookArgs([
    "--payload-file", "state/payload.json",
    "--write-markdown", "state/digest.md",
    "--write-json", "state/digest.json",
    "--print"
  ]);

  assert.match(options.payloadFile, /payload\.json$/);
  assert.match(options.writeMarkdown, /digest\.md$/);
  assert.match(options.writeJson, /digest\.json$/);
  assert.equal(options.print, true);
});

test("loadAutomationAlertHookPayload prefers explicit payload file", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-hook-"));
  const payloadFile = path.join(tempDir, "payload.json");
  await fs.writeFile(payloadFile, `${JSON.stringify({ generatedAt: "2026-04-15T12:00:00.000Z", alerts: [] })}\n`, "utf8");

  const payload = await loadAutomationAlertHookPayload({
    payloadFile
  }, {});

  assert.equal(payload.generatedAt, "2026-04-15T12:00:00.000Z");
});

test("buildAutomationAlertDigest counts severities, categories and jobs", () => {
  const digest = buildAutomationAlertDigest({
    schemaVersion: 1,
    generatedAt: "2026-04-15T12:00:00.000Z",
    nextJob: {
      name: "sample-project-apply",
      status: "ready"
    },
    operatorReviewDigest: {
      openCount: 1,
      recentCloseoutCount: 1,
      openReviews: [
        {
          jobName: "sample-project-apply"
        }
      ],
      recentCloseouts: [
        {
          jobName: "all-project-watchlists"
        }
      ]
    },
    alerts: [
      { severity: "high", category: "blocked_manual", jobName: "sample-project-apply" },
      { severity: "medium", category: "blocked_manual", jobName: "sample-project-apply" },
      { severity: "low", category: "drift_attention", jobName: "all-project-watchlists" }
    ]
  });

  assert.equal(digest.alertCount, 3);
  assert.equal(digest.severityCounts.high, 1);
  assert.equal(digest.topCategories[0].category, "blocked_manual");
  assert.equal(digest.touchedJobs[0].jobName, "sample-project-apply");
  assert.equal(digest.attentionStatus, "operator_attention_required");
  assert.equal(digest.deliveryPriority, "urgent");
  assert.ok(digest.attentionSignals.includes("operator_review_open"));
  assert.equal(digest.operatorReviewOpenCount, 1);
  assert.equal(digest.operatorReviewRecentCloseoutCount, 1);
  assert.deepEqual(digest.operatorReviewOpenJobs, ["sample-project-apply"]);
});

test("writeAutomationAlertHookOutputs writes markdown and json digests", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-hook-out-"));
  const markdownPath = path.join(tempDir, "digest.md");
  const jsonPath = path.join(tempDir, "digest.json");
  const payload = {
    schemaVersion: 1,
    generatedAt: "2026-04-15T12:00:00.000Z",
    alerts: []
  };
  const digest = buildAutomationAlertDigest(payload);
  const markdown = renderAutomationAlertHookMarkdown(payload, digest);

  const writes = await writeAutomationAlertHookOutputs({
    payload,
    digest,
    markdown,
    writeMarkdown: markdownPath,
    writeJson: jsonPath
  });

  const writtenMarkdown = await fs.readFile(markdownPath, "utf8");
  const writtenJson = JSON.parse(await fs.readFile(jsonPath, "utf8"));

  assert.equal(writes.length, 2);
  assert.match(writtenMarkdown, /Patternpilot Alert Hook Digest/);
  assert.equal(writtenJson.digest.alertCount, 0);
});

test("renderAutomationAlertHookMarkdown includes operator review handoff", () => {
  const payload = {
    schemaVersion: 1,
    generatedAt: "2026-04-17T22:47:30.000Z",
    alerts: [],
    operatorReviewDigest: {
      openCount: 1,
      recentCloseoutCount: 1,
      openReviews: [
        {
          jobName: "sample-project-apply",
          category: "repeated_governance_block",
          sourceStatus: "governance_escalated",
          openedAt: "2026-04-17T22:46:15.614Z"
        }
      ],
      recentCloseouts: [
        {
          jobName: "all-project-watchlists",
          status: "acknowledged",
          resolvedAt: "2026-04-17T22:47:00.000Z",
          resolutionNotes: "review closed"
        }
      ]
    }
  };
  const digest = buildAutomationAlertDigest(payload);
  const markdown = renderAutomationAlertHookMarkdown(payload, digest);

  assert.match(markdown, /attention_status: operator_attention_required/);
  assert.match(markdown, /delivery_priority: urgent/);
  assert.match(markdown, /Priority Focus/);
  assert.match(markdown, /operator_reviews_open: 1/);
  assert.match(markdown, /operator_reviews_recent_closeouts: 1/);
  assert.match(markdown, /Operator Reviews Open/);
  assert.match(markdown, /review closed/);
});
