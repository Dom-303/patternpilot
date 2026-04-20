import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { buildDiscoverySeedMemory, loadDiscoveryFeedback } from "../lib/discovery/feedback.mjs";

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
      "project_fit_score",
      "discovery_score",
      "description",
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
        "95",
        "84",
        "Civic public-event connector family with governance and validation",
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
        "24",
        "18",
        "Starter frontend template",
        "https://github.com/example/bad-fit",
        "https://github.com/example/bad-fit"
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
        "frontend,template,landing",
        "broad",
        "Broad project scan",
        "20",
        "15",
        "Landing-page template",
        "https://github.com/example/bad-fit-2",
        "https://github.com/example/bad-fit-2"
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
        "52",
        "44",
        "Location enrichment helper",
        "https://github.com/example/observe-fit",
        "https://github.com/example/observe-fit"
      ]
    ];
    const csv = [
      header.join(";"),
      ...rows.map((row) => row.join(";"))
    ].join("\n") + "\n";
    fs.writeFileSync(path.join(rootDir, "state", "repo_intake_queue.csv"), csv, "utf8");

    const feedback = await loadDiscoveryFeedback(rootDir, { queueFile: "state/repo_intake_queue.csv" }, "sample-project", {
      binding: {
        projectKey: "sample-project",
        projectLabel: "Sample Project",
        discoveryHints: ["calendar connector validation"],
        targetCapabilities: ["source first", "quality governance"]
      },
      projectProfile: {
        discoverySignals: ["calendar", "connector", "validation"]
      },
      discoveryPolicy: {
        preferredMainLayers: ["source_intake"],
        preferredGapAreas: ["source_systems_and_families"],
        preferredCapabilities: ["source_first", "quality_governance"],
        preferredTopics: ["calendar"],
        preferredSignalPatterns: ["connector", "validation"]
      }
    });

    assert.equal(feedback.totals.positive, 1);
    assert.equal(feedback.totals.negative, 2);
    assert.equal(feedback.totals.observe, 1);
    assert.ok(feedback.preferredTerms.includes("connector"));
    assert.ok(feedback.preferredTerms.includes("validation"));
    assert.ok(!feedback.preferredTerms.includes("frontend"));
    assert.ok(feedback.preferredSignals.includes("quality_governance"));
    assert.ok(feedback.avoidSignals.includes("ui_discovery_surface"));
    assert.ok(feedback.queryFamilyOutcomes.some((item) => item.value === "architecture"));
    assert.ok(feedback.learnedCohorts);
    assert.equal(feedback.learnedCohorts.positive.length, 1);
    assert.equal(feedback.learnedCohorts.negative.length, 2);
    assert.ok(feedback.learnedCohorts.positiveParts.includes("connector"));
    assert.ok(feedback.learnedCohorts.negativeParts.includes("starter"));
    assert.ok(feedback.learnedCohorts.negativeSignals.includes("ui_discovery_surface"));
    const seedMemory = buildDiscoverySeedMemory("sample-project", feedback, {
      binding: { projectLabel: "Sample Project" }
    });
    assert.equal(seedMemory.priorityRepos.length, 1);
    assert.equal(seedMemory.priorityCohorts.length, 1);
    assert.equal(seedMemory.referenceCohorts.length, 0);
    assert.equal(seedMemory.negativeRepos.length, 2);
    assert.equal(seedMemory.priorityRepos[0].repo, "example/high-fit");
    assert.equal(seedMemory.priorityCohorts[0].owners[0], "example");
    assert.ok(seedMemory.priorityCohorts[0].signals.includes("connector"));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

test("buildDiscoverySeedMemory keeps only coding-relevant learned reference cohorts", () => {
  const seedMemory = buildDiscoverySeedMemory("eventbear-worker", {
    learnedCohorts: {
      positive: [
        {
          repoRef: "citybureau/city-scrapers",
          fitScore: 95,
          discoveryScore: 40,
          groundingScore: 5,
          cohortCoreScore: 2,
          cohortSupportScore: 1,
          cohortExcludedScore: 0,
          parts: ["civic", "connector"],
          signals: ["source_intake"]
        }
      ],
      observe: [
        {
          repoRef: "oc/openevents",
          fitScore: 52,
          discoveryScore: 20,
          groundingScore: 5,
          cohortCoreScore: 2,
          cohortSupportScore: 1,
          cohortExcludedScore: 0,
          parts: ["location"],
          signals: ["location_intelligence"]
        },
        {
          repoRef: "calcom/cal.com",
          fitScore: 83,
          discoveryScore: 0,
          groundingScore: 6,
          cohortCoreScore: 0,
          cohortSupportScore: 2,
          cohortExcludedScore: 0,
          parts: ["ingestion", "governance"],
          signals: ["quality_governance"]
        },
        {
          repoRef: "gethomepage/homepage",
          fitScore: 63,
          discoveryScore: 0,
          groundingScore: 4,
          cohortCoreScore: 0,
          cohortSupportScore: 0,
          cohortExcludedScore: 2,
          parts: ["feed"],
          signals: ["export_feed_api", "distribution"]
        }
      ],
      negative: []
    }
  }, {
    binding: {
      projectLabel: "Eventbaer Worker"
    }
  });

  assert.deepEqual(
    seedMemory.referenceRepos.map((item) => item.repo),
    ["oc/openevents"]
  );
  assert.deepEqual(
    seedMemory.referenceCohorts.map((item) => item.owners[0]),
    ["oc"]
  );
});
