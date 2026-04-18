import test from "node:test";
import assert from "node:assert/strict";

import {
  buildValidationCohortReport,
  buildValidationCloseoutMarkdown,
  buildValidationRepoAssessment,
  normalizeValidationCohort,
  renderValidationCohortSummary
} from "../lib/validation/cohort.mjs";

test("normalizeValidationCohort canonicalizes repo URLs and applies a limit", () => {
  const normalized = normalizeValidationCohort([
    {
      category: "AI",
      repoUrl: "https://github.com/OpenAI/OpenAI-Cookbook"
    },
    {
      category: "Automation",
      url: "https://github.com/n8n-io/n8n/"
    }
  ], { limit: 1 });

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].repoUrl, "https://github.com/openai/openai-cookbook");
  assert.equal(normalized[0].repoRef, "openai/openai-cookbook");
  assert.equal(normalized[0].slug, "openai__openai-cookbook");
});

test("buildValidationRepoAssessment marks a clean repo flow as passed_with_followups when governance stays conservative", () => {
  const assessment = buildValidationRepoAssessment({
    category: "AI",
    repoUrl: "https://github.com/openai/openai-cookbook",
    repoRef: "openai/openai-cookbook",
    intakeItems: 1,
    enrichmentFailed: 0,
    reviewItems: 1,
    missingUrls: 0,
    readinessOverallStatus: "ready_with_followups",
    readinessNextAction: "npm run patternpilot -- product-readiness",
    governanceStatus: "manual_gate",
    governanceNextAction: "npm run run-governance -- --project sample-project"
  });

  assert.equal(assessment.validationStatus, "passed_with_followups");
  assert.equal(assessment.needsFix, false);
  assert.equal(assessment.intakeStatus, "sensible");
  assert.equal(assessment.reviewStatus, "usable");
  assert.equal(assessment.readinessStatus, "helpful");
  assert.match(assessment.biggestStrength, /golden path/i);
  assert.ok(assessment.issueTags.includes("governance_manual_gate"));
});

test("buildValidationRepoAssessment marks enrichment and review gaps as needs_fix", () => {
  const assessment = buildValidationRepoAssessment({
    category: "Platforms",
    repoUrl: "https://github.com/example/repo",
    repoRef: "example/repo",
    intakeItems: 1,
    enrichmentFailed: 1,
    reviewItems: 0,
    missingUrls: 1,
    readinessOverallStatus: "not_ready",
    readinessNextAction: null,
    governanceStatus: "unknown"
  });

  assert.equal(assessment.validationStatus, "needs_fix");
  assert.equal(assessment.needsFix, true);
  assert.equal(assessment.intakeStatus, "degraded");
  assert.equal(assessment.reviewStatus, "weak");
  assert.equal(assessment.readinessStatus, "weak");
  assert.ok(assessment.issueTags.includes("intake_enrichment_failed"));
  assert.ok(assessment.issueTags.includes("review_empty"));
  assert.ok(assessment.issueTags.includes("readiness_not_ready"));
});

test("renderValidationCohortSummary and closeout show aggregate status", () => {
  const report = buildValidationCohortReport({
    runId: "2026-04-18T20-00-00-000Z",
    generatedAt: "2026-04-18T20:00:00.000Z",
    manifestLabel: "built_in_default",
    results: [
      buildValidationRepoAssessment({
        category: "AI",
        repoUrl: "https://github.com/openai/openai-cookbook",
        repoRef: "openai/openai-cookbook",
        intakeItems: 1,
        enrichmentFailed: 0,
        reviewItems: 1,
        missingUrls: 0,
        readinessOverallStatus: "ready_with_followups",
        readinessNextAction: "npm run patternpilot -- product-readiness",
        governanceStatus: "manual_gate"
      }),
      buildValidationRepoAssessment({
        category: "Platforms",
        repoUrl: "https://github.com/example/repo",
        repoRef: "example/repo",
        intakeItems: 0,
        enrichmentFailed: 0,
        reviewItems: 0,
        missingUrls: 0,
        readinessOverallStatus: "not_ready",
        readinessNextAction: null,
        governanceStatus: "unknown"
      })
    ]
  });

  const summary = renderValidationCohortSummary(report);
  const closeout = buildValidationCloseoutMarkdown(report);

  assert.match(summary, /repos_validated: 2/);
  assert.match(summary, /needs_fix: 1/);
  assert.match(summary, /openai\/openai-cookbook/);
  assert.match(closeout, /Phase 4 ist als breite Fremdprojekt-Welle gelaufen/);
  assert.match(closeout, /Phase 5/);
});
