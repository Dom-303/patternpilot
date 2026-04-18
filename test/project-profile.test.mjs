import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadProjectProfile } from "../lib/project.mjs";

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-project-profile-"));
}

test("loadProjectProfile extracts manifest, dependency and architecture signals", async () => {
  const rootDir = await makeTempRoot();
  const projectRoot = path.join(rootDir, "sample-project");
  await fs.mkdir(path.join(projectRoot, "src", "connectors"), { recursive: true });
  await fs.mkdir(path.join(projectRoot, "docs"), { recursive: true });

  await fs.writeFile(
    path.join(projectRoot, "README.md"),
    "# Sample Calendar Sync\n\nThis project ingests calendar feeds and normalizes venue data.\n",
    "utf8"
  );
  await fs.writeFile(
    path.join(projectRoot, "package.json"),
    `${JSON.stringify({
      name: "@demo/calendar-sync",
      description: "Calendar ingestion and venue sync worker",
      keywords: ["calendar", "sync", "venue"],
      scripts: {
        ingest: "node src/ingest.js",
        review: "node src/review.js"
      },
      dependencies: {
        airtable: "^1.0.0",
        "rss-parser": "^3.0.0"
      }
    }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(path.join(projectRoot, "src", "connectors", "airtable-adapter.ts"), "export {};\n", "utf8");
  await fs.writeFile(path.join(projectRoot, "docs", "ARCHITECTURE.md"), "# Architecture\n", "utf8");

  const project = {
    projectRoot: "./sample-project"
  };
  const binding = {
    projectKey: "sample-project",
    readBeforeAnalysis: ["README.md", "package.json"],
    referenceDirectories: ["src", "docs"]
  };
  const alignmentRules = {
    capabilities: [
      {
        id: "ingestion",
        signals: ["calendar", "ingest", "adapter"]
      }
    ]
  };

  const profile = await loadProjectProfile(rootDir, project, binding, alignmentRules);

  assert.ok(profile.discoverySignals.includes("calendar"));
  assert.ok(profile.discoverySignals.includes("venue"));
  assert.ok(profile.manifestSignals.packageNames.includes("@demo/calendar-sync"));
  assert.ok(profile.manifestSignals.dependencySignals.includes("airtable"));
  assert.ok(profile.manifestSignals.scriptSignals.includes("ingest"));
  assert.ok(profile.architectureSignals.directorySignals.includes("connector"));
  assert.ok(profile.architectureSignals.extensionHints.includes("ts"));
  assert.ok(profile.capabilitiesPresent.includes("ingestion"));
});
