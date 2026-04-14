import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { discoverImportedCandidates } from "../lib/discovery.mjs";
import { defaultDiscoveryPolicy } from "../lib/discovery-policy.mjs";
import { makeFakeAlignmentRules } from "./helpers/fixtures.mjs";

test("discoverImportedCandidates builds a discovery run from imported candidates", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-discovery-import-"));
  try {
    fs.mkdirSync(path.join(rootDir, "state"), { recursive: true });
    fs.mkdirSync(path.join(rootDir, "knowledge"), { recursive: true });
    fs.writeFileSync(path.join(rootDir, "state", "repo_intake_queue.csv"), "repo_url;normalized_repo_url\n", "utf8");
    fs.writeFileSync(path.join(rootDir, "knowledge", "repo_landkarte.csv"), "repo_url\n", "utf8");

    const discovery = await discoverImportedCandidates(
      rootDir,
      {
        queueFile: "state/repo_intake_queue.csv",
        landkarteFile: "knowledge/repo_landkarte.csv"
      },
      {},
      {
        projectKey: "eventbear-worker",
        projectLabel: "Eventbear Worker",
        targetCapabilities: ["source-first"],
        analysisQuestions: ["What should this teach the worker?"],
        discoveryHints: ["events", "scraper"]
      },
      makeFakeAlignmentRules(),
      { corpus: "event sources scraper venue" },
      {
        label: "manual-test",
        candidates: [
          {
            repoUrl: "https://github.com/example/source-repo",
            description: "Structured event source system toolkit",
            topics: ["events", "scraper"],
            stars: 42,
            language: "JavaScript",
            license: "MIT",
            readmeExcerpt: "Source family toolkit for structured event extraction."
          }
        ]
      },
      {
        discoveryPolicy: defaultDiscoveryPolicy("eventbear-worker"),
        discoveryPolicyMode: "audit",
        discoveryProfile: "focused"
      }
    );

    assert.equal(discovery.imported, true);
    assert.equal(discovery.importSource, "manual-test");
    assert.equal(discovery.rawCandidateCount, 1);
    assert.equal(discovery.evaluatedCandidates.length, 1);
    assert.equal(discovery.candidates.length, 1);
    assert.equal(discovery.policySummary.mode, "audit");
    assert.equal(discovery.plan.plans[0].id, "imported-candidates");
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
