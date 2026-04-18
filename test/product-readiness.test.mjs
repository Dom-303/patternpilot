import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPatternpilotProductReadinessReview,
  renderPatternpilotProductReadinessSummary
} from "../lib/product-readiness.mjs";

test("buildPatternpilotProductReadinessReview returns ready_with_followups for healthy core plus pilot followups", () => {
  const review = buildPatternpilotProductReadinessReview({
    generatedAt: "2026-04-18T10:00:00.000Z",
    auth: {
      tokenPresent: true,
      authSource: "PATTERNPILOT_GITHUB_TOKEN"
    },
    githubApi: {
      networkStatus: "ok",
      rateLimit: {
        remaining: 4999
      }
    },
    alertDelivery: {
      configured: true,
      preset: "local-operator",
      targetCount: 3
    },
    automation: {
      jobsConfigured: 2,
      jobsReady: 1,
      jobsBlocked: 1,
      jobsBackoff: 0,
      attentionStatus: "elevated_alerting",
      deliveryPriority: "elevated",
      nextAction: "Run run-stability."
    },
    projects: [
      {
        projectKey: "sample-project",
        label: "Sample Project",
        watchlistCount: 12,
        governanceStatus: "manual_requalify",
        governanceNextAction: "Run run-stability.",
        policyControlStatus: "followup_with_care",
        policyControlNextCommand: "npm run patternpilot -- re-evaluate --project sample-project --stale-only",
        jobName: "sample-project-apply",
        jobStatus: "ready",
        alertCount: 2,
        highAlertCount: 1,
        topAlertCategory: "governance_requalify",
        topAlertNextAction: "Run run-stability."
      }
    ]
  });

  assert.equal(review.overallStatus, "ready_with_followups");
  assert.equal(review.releaseDecision, "go_with_followups");
  assert.equal(review.counts.fail, 0);
  assert.ok(review.counts.followup >= 1);
  assert.equal(review.automationMode, "guarded_automation");
  assert.equal(review.projects[0].overallStatus, "ready_with_followups");
  assert.match(review.nextAction ?? "", /run-stability/i);
});

test("buildPatternpilotProductReadinessReview returns not_ready when GitHub access fails", () => {
  const review = buildPatternpilotProductReadinessReview({
    generatedAt: "2026-04-18T10:00:00.000Z",
    auth: {
      tokenPresent: false
    },
    githubApi: {
      networkStatus: "failed",
      error: "getaddrinfo EAI_AGAIN"
    },
    alertDelivery: {
      configured: false,
      targetCount: 0
    },
    automation: {
      jobsConfigured: 0,
      attentionStatus: "routine",
      deliveryPriority: "routine"
    },
    projects: []
  });
  const rendered = renderPatternpilotProductReadinessSummary(review);

  assert.equal(review.overallStatus, "not_ready");
  assert.equal(review.releaseDecision, "hold");
  assert.ok(review.counts.fail >= 2);
  assert.match(rendered, /overall_status: not_ready/);
  assert.match(rendered, /FAIL \| github_access/);
});

test("buildPatternpilotProductReadinessReview blocks fresh installs without any configured project", () => {
  const review = buildPatternpilotProductReadinessReview({
    generatedAt: "2026-04-18T10:00:00.000Z",
    auth: {
      tokenPresent: true,
      authSource: "PATTERNPILOT_GITHUB_TOKEN"
    },
    githubApi: {
      networkStatus: "ok"
    },
    alertDelivery: {
      configured: true,
      preset: "local-operator",
      targetCount: 1
    },
    automation: {
      jobsConfigured: 0,
      attentionStatus: "routine",
      deliveryPriority: "routine"
    },
    projects: []
  });

  assert.equal(review.overallStatus, "not_ready");
  assert.equal(review.releaseDecision, "hold");
  assert.match(review.nextAction ?? "", /bootstrap/);
  assert.equal(review.automationMode, "core_only");
});

test("buildPatternpilotProductReadinessReview does not fail a healthy local core just because automation is unconfigured", () => {
  const review = buildPatternpilotProductReadinessReview({
    generatedAt: "2026-04-18T10:00:00.000Z",
    auth: {
      tokenPresent: true,
      authSource: "PATTERNPILOT_GITHUB_TOKEN"
    },
    githubApi: {
      networkStatus: "ok"
    },
    alertDelivery: {
      configured: false,
      targetCount: 0
    },
    automation: {
      jobsConfigured: 0,
      attentionStatus: "routine",
      deliveryPriority: "routine"
    },
    projects: [
      {
        projectKey: "sample-project",
        label: "Sample Project",
        watchlistCount: 3,
        governanceStatus: "unattended_ready",
        governanceNextAction: null,
        policyControlStatus: "followup_ready",
        policyControlNextCommand: "npm run patternpilot -- re-evaluate --project sample-project --stale-only",
        jobName: null,
        jobStatus: "unconfigured",
        jobReason: "No automation job is configured for this project.",
        alertCount: 0,
        highAlertCount: 0,
        recentCompletedCommands: []
      }
    ]
  });

  assert.equal(review.overallStatus, "ready_for_v1");
  assert.equal(review.releaseDecision, "go");
  assert.equal(review.automationMode, "core_only");
  assert.equal(review.globalChecks.find((check) => check.key === "automation_jobs")?.status, "pass");
  assert.equal(review.globalChecks.find((check) => check.key === "alert_delivery")?.status, "pass");
});

test("buildPatternpilotProductReadinessReview suppresses freshly completed next actions and advances to the next follow-up", () => {
  const review = buildPatternpilotProductReadinessReview({
    generatedAt: "2026-04-18T10:05:00.000Z",
    auth: {
      tokenPresent: true,
      authSource: "PATTERNPILOT_GITHUB_TOKEN"
    },
    githubApi: {
      networkStatus: "ok"
    },
    alertDelivery: {
      configured: true,
      preset: "local-operator",
      targetCount: 3
    },
    automation: {
      jobsConfigured: 1,
      jobsReady: 1,
      jobsBlocked: 0,
      jobsBackoff: 0,
      attentionStatus: "elevated_alerting",
      deliveryPriority: "elevated",
      nextAction: "npm run patternpilot -- review-watchlist --project sample-project",
      fallbackNextAction: "npm run patternpilot -- re-evaluate --project sample-project --stale-only"
    },
    projects: [
      {
        projectKey: "sample-project",
        label: "Sample Project",
        watchlistCount: 1,
        governanceStatus: "manual_gate",
        governanceNextAction: "npm run patternpilot -- review-watchlist --project sample-project",
        policyControlStatus: "followup_with_care",
        policyControlNextCommand: "npm run patternpilot -- re-evaluate --project sample-project --stale-only",
        jobName: "sample-project-apply",
        jobStatus: "ready",
        alertCount: 1,
        highAlertCount: 1,
        topAlertCategory: "governance_manual_gate",
        topAlertNextAction: "npm run patternpilot -- review-watchlist --project sample-project",
        recentCompletedCommands: [
          {
            command: "review-watchlist",
            createdAt: "2026-04-18T10:04:10.000Z"
          }
        ]
      }
    ]
  });

  assert.equal(review.overallStatus, "ready_with_followups");
  assert.match(review.nextAction ?? "", /re-evaluate/);
  assert.equal(review.projects[0].nextAction, "npm run patternpilot -- re-evaluate --project sample-project --stale-only");
});
