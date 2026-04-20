import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { discoverGithubCandidates } from "../lib/discovery/search.mjs";
import { defaultDiscoveryPolicy } from "../lib/policy/discovery-policy.mjs";
import { makeFakeAlignmentRules } from "./helpers/fixtures.mjs";

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-discovery-seeds-"));
}

test("discoverGithubCandidates injects curated seed cohorts into offline discovery", async () => {
  const rootDir = await makeTempRoot();
  await fs.mkdir(path.join(rootDir, "state"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "state", "repo_intake_queue.csv"),
    "repo_url;normalized_repo_url;project_key\n",
    "utf8"
  );

  const config = {
    queueFile: "state/repo_intake_queue.csv",
    landkarteFile: "knowledge/repo_landkarte.csv",
    github: {}
  };
  const project = {
    watchlistFile: null
  };
  const binding = {
    projectKey: "eventbear-worker",
    projectLabel: "EventBear Worker",
    discoveryHints: ["public event", "civic", "adapter", "normalize"],
    targetCapabilities: ["source family", "review governance"],
    analysisQuestions: ["Which repos show public-event intake and schema normalization patterns?"]
  };
  const alignmentRules = makeFakeAlignmentRules();
  const projectProfile = {
    corpus: "public event intake civic adapter normalization schema review governance source family",
    capabilitiesPresent: ["source_first", "quality_governance"],
    discoverySignals: ["public event", "civic", "adapter", "normalize", "schema"],
    manifestSignals: {
      packageNames: ["eventbear-worker"],
      descriptions: ["public event intake worker"],
      keywords: ["event", "intake", "normalize"],
      dependencySignals: ["playwright"],
      scriptSignals: ["review"]
    },
    architectureSignals: {
      directorySignals: ["sources", "adapters", "reviews"],
      extensionHints: ["ts", "md"]
    }
  };
  const discoverySeeds = {
    priorityRepos: [
      {
        repo: "City-Bureau/city-scrapers-events",
        description: "Static site with a calendar of scraped civic and public events.",
        topics: ["public-event", "civic", "scraper", "calendar", "open-data"],
        why: "Strong public-event intake and civic source-family signal."
      }
    ],
    referenceRepos: [
      {
        repo: "j-e-d/agenda-lumiton",
        description: "Agenda scraper for public-event calendars and exports.",
        topics: ["agenda", "public-event", "calendar", "scraper"],
        why: "Boundary repo for agenda-style intake patterns."
      }
    ]
  };

  const discovery = await discoverGithubCandidates(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    {
      offline: true,
      skipEnrich: true,
      discoveryProfile: "focused",
      discoveryPolicyMode: "audit",
      discoveryPolicy: defaultDiscoveryPolicy("eventbear-worker"),
      discoverySeeds
    }
  );

  const repoNames = discovery.evaluatedCandidates.map((candidate) =>
    `${candidate.repo.owner}/${candidate.repo.name}`.toLowerCase()
  );
  const cityCandidate = discovery.evaluatedCandidates.find(
    (candidate) => `${candidate.repo.owner}/${candidate.repo.name}`.toLowerCase() === "city-bureau/city-scrapers-events"
  );
  const topVisibleCandidate = discovery.candidates[0];

  assert.equal(discovery.offline, true);
  assert.equal(discovery.scanned, 0);
  assert.equal(discovery.curatedSeedCount, 2);
  assert.equal(discovery.curatedPrioritySeedCount, 1);
  assert.equal(discovery.curatedReferenceSeedCount, 1);
  assert.ok(repoNames.includes("city-bureau/city-scrapers-events"));
  assert.ok(repoNames.includes("j-e-d/agenda-lumiton"));
  assert.ok(cityCandidate);
  assert.equal(cityCandidate.discoverySeedKind, "priority");
  assert.ok(cityCandidate.queryFamilies.includes("curated_seed"));
  assert.ok(cityCandidate.queryLabels.some((label) => /curated seed/i.test(label)));
  assert.equal(
    `${topVisibleCandidate.repo.owner}/${topVisibleCandidate.repo.name}`.toLowerCase(),
    "city-bureau/city-scrapers-events"
  );
});

test("discoverGithubCandidates keeps curated priority seeds visible even when already known", async () => {
  const rootDir = await makeTempRoot();
  await fs.mkdir(path.join(rootDir, "state"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "state", "repo_intake_queue.csv"),
    [
      "repo_url;normalized_repo_url;project_key",
      "https://github.com/citybureau/city-scrapers;https://github.com/citybureau/city-scrapers;eventbear-worker"
    ].join("\n") + "\n",
    "utf8"
  );

  const config = {
    queueFile: "state/repo_intake_queue.csv",
    landkarteFile: "knowledge/repo_landkarte.csv",
    github: {}
  };
  const project = {
    watchlistFile: null
  };
  const binding = {
    projectKey: "eventbear-worker",
    projectLabel: "EventBear Worker",
    discoveryHints: ["public event", "civic", "adapter", "normalize"],
    targetCapabilities: ["source family", "review governance"],
    analysisQuestions: ["Which repos show public-event intake and schema normalization patterns?"]
  };
  const alignmentRules = makeFakeAlignmentRules();
  const projectProfile = {
    corpus: "public event intake civic adapter normalization schema review governance source family",
    capabilitiesPresent: ["source_first", "quality_governance"],
    discoverySignals: ["public event", "civic", "adapter", "normalize", "schema"],
    manifestSignals: {
      packageNames: ["eventbear-worker"],
      descriptions: ["public event intake worker"],
      keywords: ["event", "intake", "normalize"],
      dependencySignals: ["playwright"],
      scriptSignals: ["review"]
    },
    architectureSignals: {
      directorySignals: ["sources", "adapters", "reviews"],
      extensionHints: ["ts", "md"]
    }
  };
  const discoverySeeds = {
    priorityRepos: [
      {
        repo: "citybureau/city-scrapers",
        description: "Civic scraper family baseline.",
        topics: ["civic", "scraper", "adapter", "open-data"],
        why: "Strong adapter-family and source-family baseline."
      }
    ]
  };

  const discovery = await discoverGithubCandidates(
    rootDir,
    config,
    project,
    binding,
    alignmentRules,
    projectProfile,
    {
      offline: true,
      skipEnrich: true,
      discoveryProfile: "focused",
      discoveryPolicyMode: "audit",
      discoveryPolicy: defaultDiscoveryPolicy("eventbear-worker"),
      discoverySeeds
    }
  );

  assert.equal(discovery.curatedPrioritySeedCount, 1);
  assert.ok(discovery.candidates.some((candidate) =>
    `${candidate.repo.owner}/${candidate.repo.name}`.toLowerCase() === "citybureau/city-scrapers"
  ));
  assert.equal(discovery.candidates[0].alreadyKnown, true);
});
