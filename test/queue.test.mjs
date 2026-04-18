import fs from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

import { loadQueueEntries, normalizeGithubUrl, upsertQueueEntry } from "../lib/queue.mjs";
import { makeTempQueueWorkspace } from "./helpers/fixtures.mjs";

test("normalizeGithubUrl canonicalizes GitHub owner and repo casing", () => {
  const normalized = normalizeGithubUrl("https://github.com/City-Bureau/City-Scrapers");

  assert.equal(normalized.owner, "city-bureau");
  assert.equal(normalized.name, "city-scrapers");
  assert.equal(normalized.normalizedRepoUrl, "https://github.com/city-bureau/city-scrapers");
  assert.equal(normalized.slug, "city-bureau__city-scrapers");
});

test("upsertQueueEntry auto-extends header with new engine-decision columns", async () => {
  const legacyHeader = [
    "intake_id",
    "project_key",
    "status",
    "created_at",
    "updated_at",
    "repo_url",
    "normalized_repo_url"
  ];
  const workspace = makeTempQueueWorkspace({
    header: legacyHeader,
    rows: [
      {
        intake_id: "1",
        project_key: "eventbear-worker",
        status: "queued",
        created_at: "2025-04-01T00:00:00.000Z",
        updated_at: "2025-04-01T00:00:00.000Z",
        repo_url: "https://github.com/acme/eventbear-worker",
        normalized_repo_url: "https://github.com/acme/eventbear-worker"
      }
    ]
  });

  try {
    await upsertQueueEntry(workspace.rootDir, workspace.config, {
      intake_id: "1",
      project_key: "eventbear-worker",
      status: "queued",
      created_at: "2025-04-01T00:00:00.000Z",
      updated_at: "2025-04-02T00:00:00.000Z",
      repo_url: "https://github.com/acme/eventbear-worker",
      normalized_repo_url: "https://github.com/acme/eventbear-worker",
      effort_band: "low",
      effort_score: 25,
      value_band: "high",
      value_score: 80,
      review_disposition: "intake_now",
      rules_fingerprint: "a3f9c1b2d4e5"
    });

    const headerLine = fs.readFileSync(workspace.queuePath, "utf8").split(/\r?\n/)[0];
    for (const column of [
      "effort_band",
      "effort_score",
      "value_band",
      "value_score",
      "review_disposition",
      "rules_fingerprint"
    ]) {
      assert.ok(headerLine.includes(column), `expected header to include ${column}`);
    }
  } finally {
    workspace.cleanup();
  }
});

test("loadQueueEntries returns empty strings for missing new columns in legacy rows", async () => {
  const legacyHeader = ["intake_id", "project_key", "status", "repo_url", "normalized_repo_url"];
  const workspace = makeTempQueueWorkspace({
    header: legacyHeader,
    rows: [
      {
        intake_id: "7",
        project_key: "eventbear-worker",
        status: "queued",
        repo_url: "https://github.com/acme/legacy",
        normalized_repo_url: "https://github.com/acme/legacy"
      }
    ]
  });

  try {
    const rows = await loadQueueEntries(workspace.rootDir, workspace.config);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].effort_band, "");
    assert.equal(rows[0].effort_score, "");
    assert.equal(rows[0].value_band, "");
    assert.equal(rows[0].value_score, "");
    assert.equal(rows[0].review_disposition, "");
    assert.equal(rows[0].rules_fingerprint, "");
  } finally {
    workspace.cleanup();
  }
});

test("upsertQueueEntry matches GitHub URLs case-insensitively and preserves stronger promotion state", async () => {
  const workspace = makeTempQueueWorkspace({
    header: [
      "intake_id",
      "project_key",
      "status",
      "created_at",
      "updated_at",
      "repo_url",
      "normalized_repo_url",
      "promotion_status",
      "promotion_packet",
      "promoted_at",
      "description",
      "enrichment_status"
    ],
    rows: [
      {
        intake_id: "old-run__city-bureau__city-scrapers",
        project_key: "eventbear-worker",
        status: "promoted",
        created_at: "2026-04-14T21:27:22.421Z",
        updated_at: "2026-04-14T21:38:26.541Z",
        repo_url: "https://github.com/city-bureau/city-scrapers",
        normalized_repo_url: "https://github.com/city-bureau/city-scrapers",
        promotion_status: "applied",
        promotion_packet: "projects/eventbear-worker/promotions/city-bureau__city-scrapers.md",
        promoted_at: "2026-04-14T21:38:26.541Z",
        description: "Existing promoted repo",
        enrichment_status: "success"
      }
    ]
  });

  try {
    await upsertQueueEntry(workspace.rootDir, workspace.config, {
      intake_id: "new-run__city-bureau__city-scrapers",
      project_key: "eventbear-worker",
      status: "pending_review",
      created_at: "2026-04-17T18:55:50.316Z",
      updated_at: "2026-04-17T18:55:50.316Z",
      repo_url: "https://github.com/City-Bureau/City-Scrapers",
      normalized_repo_url: "https://github.com/City-Bureau/City-Scrapers",
      promotion_status: "",
      promotion_packet: "",
      promoted_at: "",
      description: "",
      enrichment_status: "failed"
    });

    const rows = await loadQueueEntries(workspace.rootDir, workspace.config);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "promoted");
    assert.equal(rows[0].promotion_status, "applied");
    assert.equal(rows[0].promotion_packet, "projects/eventbear-worker/promotions/city-bureau__city-scrapers.md");
    assert.equal(rows[0].promoted_at, "2026-04-14T21:38:26.541Z");
    assert.equal(rows[0].normalized_repo_url, "https://github.com/city-bureau/city-scrapers");
    assert.equal(rows[0].description, "Existing promoted repo");
    assert.equal(rows[0].enrichment_status, "failed");
  } finally {
    workspace.cleanup();
  }
});
