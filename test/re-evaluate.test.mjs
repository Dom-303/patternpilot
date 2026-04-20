import fs from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  makeFakeAlignmentRules,
  makeTempQueueWorkspace
} from "./helpers/fixtures.mjs";
import {
  reevaluateQueueRow,
  reEvaluateQueueEntries
} from "../lib/re-evaluate.mjs";
import { loadQueueEntries } from "../lib/queue.mjs";

function makeQueueRow(overrides = {}) {
  return {
    intake_id: "run__acme__demo",
    project_key: "sample-project",
    status: "pending_review",
    created_at: "2026-04-14T00:00:00.000Z",
    updated_at: "2026-04-14T00:00:00.000Z",
    last_api_sync_at: "2026-04-14T00:00:00.000Z",
    enrichment_status: "success",
    alignment_status: "ready",
    project_fit_band: "high",
    project_fit_score: "82",
    effort_band: "",
    effort_score: "",
    value_band: "",
    value_score: "",
    review_disposition: "",
    rules_fingerprint: "",
    decision_summary: "",
    effort_reasons: "",
    value_reasons: "",
    disposition_reason: "",
    matched_capabilities: "source_first,candidate_first",
    recommended_worker_areas: "lib/fetch.mjs,docs/SOURCE_MASTERLIST_POLICY.md",
    suggested_next_step: "Compare the repo against the worker architecture.",
    repo_url: "https://github.com/acme/demo",
    normalized_repo_url: "https://github.com/acme/demo",
    owner: "acme",
    name: "demo",
    host: "github.com",
    description: "Focused source intake worker",
    stars: "44",
    primary_language: "JavaScript",
    topics: "events,scraper",
    default_branch: "main",
    license: "MIT",
    pushed_at: "2026-04-13T00:00:00.000Z",
    archived: "no",
    homepage: "",
    category_guess: "connector",
    pattern_family_guess: "local_source_infra_framework",
    main_layer_guess: "source_intake",
    project_gap_area_guess: "source_systems_and_families",
    build_vs_borrow_guess: "adapt_pattern",
    priority_guess: "now",
    secondary_layers: "",
    source_focus: "",
    geographic_model: "",
    data_model: "",
    distribution_type: "",
    activity_status: "current",
    maturity: "active",
    strengths: "source focus",
    weaknesses: "",
    risks: "",
    learning_for_project: "useful source-family signal",
    possible_implication: "adapt family conventions",
    decision_guess: "adapt_pattern",
    project_relevance_guess: "high",
    project_relevance_note: "Strong fit",
    intake_doc: "projects/sample-project/intake/acme__demo.md",
    run_id: "2026-04-14T00-00-00-000Z",
    notes: "",
    ...overrides
  };
}

describe("reevaluateQueueRow", () => {
  test("rebuilds decision fields and queue update payload", () => {
    const result = reevaluateQueueRow(makeQueueRow(), makeFakeAlignmentRules());

    assert.equal(result.decisionFields.reviewDisposition, "intake_now");
    assert.equal(result.queueUpdate.review_disposition, "intake_now");
    assert.equal(result.queueUpdate.rules_fingerprint.length, 12);
    assert.notEqual(result.queueUpdate.decision_summary, "");
  });
});

describe("reEvaluateQueueEntries", () => {
  test("updates queue entries and rewrites intake decision signals", async () => {
    const row = makeQueueRow();
    const header = Object.keys(row);
    const workspace = makeTempQueueWorkspace({
      header,
      rows: [row]
    });

    try {
      const intakePath = path.join(workspace.rootDir, row.intake_doc);
      fs.mkdirSync(path.dirname(intakePath), { recursive: true });
      fs.writeFileSync(intakePath, `# Intake Dossier

## Decision Signals

- effort: unknown
- value: unknown

## Alignment Rationale

- placeholder
`, "utf8");

      const updates = await reEvaluateQueueEntries(
        workspace.rootDir,
        workspace.config,
        [row],
        makeFakeAlignmentRules(),
        { dryRun: false }
      );

      const queueRows = await loadQueueEntries(workspace.rootDir, workspace.config);
      const updatedRow = queueRows[0];
      const intakeContent = fs.readFileSync(intakePath, "utf8");

      assert.equal(updates.length, 1);
      assert.equal(updates[0].intakeDocResult.status, "updated");
      assert.equal(updatedRow.review_disposition, "intake_now");
      assert.notEqual(updatedRow.rules_fingerprint, "");
      assert.ok(intakeContent.includes("- review_disposition: intake_now"));
      assert.ok(!intakeContent.includes("- effort: unknown"));
    } finally {
      workspace.cleanup();
    }
  });

  test("reports dry-run previews without mutating the intake doc", async () => {
    const row = makeQueueRow();
    const header = Object.keys(row);
    const workspace = makeTempQueueWorkspace({
      header,
      rows: [row]
    });

    try {
      const intakePath = path.join(workspace.rootDir, row.intake_doc);
      fs.mkdirSync(path.dirname(intakePath), { recursive: true });
      const originalContent = `# Intake Dossier

## Decision Signals

- effort: unknown
- value: unknown
`;
      fs.writeFileSync(intakePath, originalContent, "utf8");

      const updates = await reEvaluateQueueEntries(
        workspace.rootDir,
        workspace.config,
        [row],
        makeFakeAlignmentRules(),
        { dryRun: true }
      );

      assert.equal(updates[0].intakeDocResult.status, "dry_run_preview");
      assert.equal(fs.readFileSync(intakePath, "utf8"), originalContent);
    } finally {
      workspace.cleanup();
    }
  });

  test("reports missing intake docs without failing the queue refresh", async () => {
    const row = makeQueueRow({
      intake_doc: "projects/sample-project/intake/missing.md"
    });
    const header = Object.keys(row);
    const workspace = makeTempQueueWorkspace({
      header,
      rows: [row]
    });

    try {
      const updates = await reEvaluateQueueEntries(
        workspace.rootDir,
        workspace.config,
        [row],
        makeFakeAlignmentRules(),
        { dryRun: false }
      );

      assert.equal(updates[0].intakeDocResult.status, "missing_intake_doc");
    } finally {
      workspace.cleanup();
    }
  });
});
