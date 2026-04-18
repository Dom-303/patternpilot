import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { loadDiscoveryFeedback } from "../lib/discovery/feedback.mjs";

test("loadDiscoveryFeedback aggregates positive, negative and observe signals from queue history", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-discovery-feedback-"));
  try {
    fs.mkdirSync(path.join(rootDir, "state"), { recursive: true });
    const header = [
      "project_key",
      "status",
      "promotion_status",
      "review_disposition",
      "decision_guess",
      "pattern_family_guess",
      "main_layer_guess",
      "project_gap_area_guess",
      "matched_capabilities",
      "topics",
      "discovery_query_families",
      "discovery_query_labels",
      "repo_url",
      "normalized_repo_url"
    ];
    const rows = [
      [
        "sample-project",
        "promoted",
        "applied",
        "review_queue",
        "adapt",
        "local_source_infra_framework",
        "source_intake",
        "source_systems_and_families",
        "source_first,quality_governance",
        "calendar,connector,validation",
        "broad,architecture",
        "Broad project scan,Architecture and layer patterns",
        "https://github.com/example/high-fit",
        "https://github.com/example/high-fit"
      ],
      [
        "sample-project",
        "pending_review",
        "",
        "skip",
        "ignore",
        "event_discovery_frontend",
        "ui_discovery_surface",
        "frontend_and_surface_design",
        "distribution_surfaces",
        "frontend,template",
        "broad",
        "Broad project scan",
        "https://github.com/example/bad-fit",
        "https://github.com/example/bad-fit"
      ],
      [
        "sample-project",
        "pending_review",
        "",
        "observe_only",
        "observe",
        "platform_based_place_enrichment",
        "location_place_enrichment",
        "location_and_gastro_intelligence",
        "location_intelligence",
        "venue,maps",
        "dependency",
        "Dependency and tooling neighbors",
        "https://github.com/example/observe-fit",
        "https://github.com/example/observe-fit"
      ]
    ];
    const csv = [
      header.join(";"),
      ...rows.map((row) => row.join(";"))
    ].join("\n") + "\n";
    fs.writeFileSync(path.join(rootDir, "state", "repo_intake_queue.csv"), csv, "utf8");

    const feedback = await loadDiscoveryFeedback(rootDir, { queueFile: "state/repo_intake_queue.csv" }, "sample-project");

    assert.equal(feedback.totals.positive, 1);
    assert.equal(feedback.totals.negative, 1);
    assert.equal(feedback.totals.observe, 1);
    assert.ok(feedback.preferredTerms.includes("calendar"));
    assert.ok(feedback.avoidTerms.includes("frontend"));
    assert.ok(feedback.preferredSignals.includes("source_intake"));
    assert.ok(feedback.avoidSignals.includes("ui_discovery_surface"));
    assert.ok(feedback.queryFamilyOutcomes.some((item) => item.value === "architecture"));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
