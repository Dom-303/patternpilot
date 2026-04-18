import { test } from "node:test";
import assert from "node:assert/strict";

import {
  recordAutomationOperatorReviewOpen,
  recordAutomationOperatorReviewResolution,
  renderAutomationOperatorReviewSummary,
  summarizeAutomationOperatorReviews,
  summarizeAutomationOperatorReviewsForJob
} from "../lib/automation/automation-operator-reviews.mjs";

test("automation operator reviews track open reviews and closeouts with notes", () => {
  const initial = {
    schemaVersion: 1,
    updatedAt: null,
    reviews: {},
    events: []
  };

  const opened = recordAutomationOperatorReviewOpen(initial, {
    jobName: "eventbear-worker-apply",
    category: "repeated_governance_block",
    sourceStatus: "governance_escalated",
    openedAt: "2026-04-17T22:38:25.614Z",
    reason: "Repeated governance block detected.",
    nextAction: "Acknowledge after review.",
    nextCommand: "npm run patternpilot -- automation-job-ack --automation-job eventbear-worker-apply"
  });

  const acknowledged = recordAutomationOperatorReviewResolution(opened.state, {
    jobName: "eventbear-worker-apply",
    resolvedAt: "2026-04-17T22:38:33.000Z",
    status: "acknowledged",
    notes: "manual ack after dispatch escalation review",
    nextCommand: "npm run patternpilot -- automation-dispatch --dry-run"
  });

  const jobSummary = summarizeAutomationOperatorReviewsForJob(acknowledged.state, "eventbear-worker-apply");
  const summary = summarizeAutomationOperatorReviews(acknowledged.state, {
    jobName: "eventbear-worker-apply",
    limit: 5
  });
  const rendered = renderAutomationOperatorReviewSummary({
    generatedAt: "2026-04-17T22:39:00.000Z",
    summary
  });

  assert.equal(opened.result.status, "opened");
  assert.equal(acknowledged.result.current.status, "acknowledged");
  assert.equal(jobSummary.currentStatus, "acknowledged");
  assert.equal(jobSummary.resolutionNotes, "manual ack after dispatch escalation review");
  assert.equal(summary.openCount, 0);
  assert.equal(summary.acknowledgedCount, 1);
  assert.equal(summary.recentEvents.length, 2);
  assert.match(rendered, /Recent Closeouts/);
  assert.match(rendered, /manual ack after dispatch escalation review/);
});
