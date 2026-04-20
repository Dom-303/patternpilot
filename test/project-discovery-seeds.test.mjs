import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadProjectDiscoverySeeds } from "../lib/project.mjs";

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-project-seeds-"));
}

test("loadProjectDiscoverySeeds merges curated and generated seed packs", async () => {
  const rootDir = await makeTempRoot();
  await fs.mkdir(path.join(rootDir, "bindings", "sample-project"), { recursive: true });
  await fs.mkdir(path.join(rootDir, "state", "discovery_seeds"), { recursive: true });

  await fs.writeFile(
    path.join(rootDir, "bindings", "sample-project", "DISCOVERY_SEEDS.json"),
    `${JSON.stringify({
      projectKey: "sample-project",
      version: 1,
      intent: "Curated seeds",
      priorityRepos: [
        { repo: "City-Bureau/city-scrapers-events", why: "Curated civic source." }
      ],
      negativeRepos: [
        { repo: "ManojKumarPatnaik/Major-project-list", why: "Curated noise." }
      ]
    }, null, 2)}\n`,
    "utf8"
  );

  await fs.writeFile(
    path.join(rootDir, "bindings", "sample-project", "DISCOVERY_COHORTS.json"),
    `${JSON.stringify({
      projectKey: "sample-project",
      version: 1,
      intent: "Curated cohorts",
      priorityCohorts: [
        {
          id: "civic-source-family",
          label: "Civic source family",
          owners: ["city-bureau"],
          repoRefs: ["City-Bureau/city-scrapers-events"],
          signals: ["civic", "public-event", "scraper"]
        }
      ]
    }, null, 2)}\n`,
    "utf8"
  );

  await fs.writeFile(
    path.join(rootDir, "state", "discovery_seeds", "sample-project.json"),
    `${JSON.stringify({
      projectKey: "sample-project",
      version: 1,
      intent: "Learned seeds",
      priorityRepos: [
        { repo: "city-bureau/city-scrapers", why: "Learned source family." }
      ],
      referenceRepos: [
        { repo: "j-e-d/agenda-lumiton", why: "Learned reference." }
      ]
    }, null, 2)}\n`,
    "utf8"
  );

  const seeds = await loadProjectDiscoverySeeds(rootDir, {
    discoverySeedsFile: "bindings/sample-project/DISCOVERY_SEEDS.json",
    discoveryCohortsFile: "bindings/sample-project/DISCOVERY_COHORTS.json"
  }, {
    projectKey: "sample-project"
  });

  assert.ok(seeds);
  assert.equal(seeds.priorityRepos.length, 2);
  assert.equal(seeds.referenceRepos.length, 1);
  assert.equal(seeds.negativeRepos.length, 1);
  assert.equal(seeds.priorityCohorts.length, 1);
  assert.ok(seeds.priorityRepos.some((item) => item.repo.toLowerCase() === "city-bureau/city-scrapers-events"));
  assert.ok(seeds.priorityRepos.some((item) => item.repo.toLowerCase() === "city-bureau/city-scrapers"));
  assert.equal(seeds.priorityCohorts[0].id, "civic-source-family");
});
