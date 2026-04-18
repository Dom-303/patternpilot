import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildProjectRunStability,
  renderProjectRunStabilitySummary
} from "../lib/run/run-stability.mjs";

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("buildProjectRunStability detects stable streaks across recent lifecycle runs", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-run-stability-stable-"));
  const config = { runtimeRoot: "runs" };
  const projectKey = "stable-project";
  const runs = [
    "2026-04-15T10-00-00-000Z",
    "2026-04-14T10-00-00-000Z",
    "2026-04-13T10-00-00-000Z"
  ];

  for (const runId of runs) {
    await writeJson(path.join(rootDir, "runs", projectKey, runId, "manifest.json"), {
      runId,
      createdAt: runId.replace(/-/g, ":").replace("T10:00:00:000Z", "T10:00:00.000Z"),
      runPlan: { runKind: "maintenance_run" },
      sourceMode: "watchlist",
      effectiveUrls: ["https://github.com/org/stable"],
      intakeRun: { items: 1 },
      reviewRun: { items: 1, reviewScope: "watchlist" }
    });
  }

  const stability = await buildProjectRunStability(rootDir, config, {
    projectKey
  });

  assert.equal(stability.status, "stable_streak");
  assert.equal(stability.stableStreak, 2);
  assert.equal(stability.unstablePairs, 0);

  const summary = renderProjectRunStabilitySummary({
    projectKey,
    stability
  });
  assert.match(summary, /stable_streak: 2/);
});

test("buildProjectRunStability detects unstable streaks when recent loops keep changing", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-run-stability-unstable-"));
  const config = { runtimeRoot: "runs" };
  const projectKey = "unstable-project";
  const runSpecs = [
    {
      runId: "2026-04-15T10-00-00-000Z",
      createdAt: "2026-04-15T10:00:00.000Z",
      sourceMode: "watchlist",
      effectiveUrls: ["https://github.com/org/a", "https://github.com/org/b"]
    },
    {
      runId: "2026-04-14T10-00-00-000Z",
      createdAt: "2026-04-14T10:00:00.000Z",
      sourceMode: "explicit_urls",
      effectiveUrls: ["https://github.com/org/a"]
    },
    {
      runId: "2026-04-13T10-00-00-000Z",
      createdAt: "2026-04-13T10:00:00.000Z",
      sourceMode: "watchlist",
      effectiveUrls: ["https://github.com/org/c"]
    }
  ];

  for (const spec of runSpecs) {
    await writeJson(path.join(rootDir, "runs", projectKey, spec.runId, "manifest.json"), {
      runId: spec.runId,
      createdAt: spec.createdAt,
      sourceMode: spec.sourceMode,
      effectiveUrls: spec.effectiveUrls,
      intakeRun: { items: 1 },
      reviewRun: { items: 1, reviewScope: spec.sourceMode }
    });
  }

  const stability = await buildProjectRunStability(rootDir, config, {
    projectKey
  });

  assert.equal(stability.status, "unstable_streak");
  assert.equal(stability.unstableStreak, 2);
  assert.equal(stability.stablePairs, 0);
});

test("buildProjectRunStability ignores intake-like subruns without lifecycle signatures", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-run-stability-ignore-subruns-"));
  const config = { runtimeRoot: "runs" };
  const projectKey = "stable-project";

  await writeJson(path.join(rootDir, "runs", projectKey, "2026-04-15T10-00-00-000Z", "manifest.json"), {
    command: "on-demand",
    runId: "2026-04-15T10-00-00-000Z",
    createdAt: "2026-04-15T10:00:00.000Z",
    sourceMode: "explicit_urls",
    runPlan: { runKind: "follow_up_run" },
    effectiveUrls: ["https://github.com/org/stable"],
    intakeRun: { items: 1 },
    reviewRun: { items: 1, reviewScope: "selected_urls" }
  });
  await writeJson(path.join(rootDir, "runs", projectKey, "2026-04-15T10-00-01-000Z", "manifest.json"), {
    command: "on-demand",
    runId: "2026-04-15T10-00-01-000Z",
    createdAt: "2026-04-15T10:00:01.000Z",
    items: [{ slug: "subrun" }]
  });
  await writeJson(path.join(rootDir, "runs", projectKey, "2026-04-14T10-00-00-000Z", "manifest.json"), {
    command: "on-demand",
    runId: "2026-04-14T10-00-00-000Z",
    createdAt: "2026-04-14T10:00:00.000Z",
    sourceMode: "explicit_urls",
    runPlan: { runKind: "follow_up_run" },
    effectiveUrls: ["https://github.com/org/stable"],
    intakeRun: { items: 1 },
    reviewRun: { items: 1, reviewScope: "selected_urls" }
  });

  const stability = await buildProjectRunStability(rootDir, config, {
    projectKey
  });

  assert.equal(stability.totalRuns, 2);
  assert.equal(stability.status, "lightly_stable");
  assert.equal(stability.stableStreak, 1);
  assert.equal(stability.unstablePairs, 0);
});

test("buildProjectRunStability uses inferred legacy run kinds for lifecycle comparisons", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-run-stability-legacy-runkind-"));
  const config = { runtimeRoot: "runs" };
  const projectKey = "legacy-project";

  await writeJson(path.join(rootDir, "runs", projectKey, "2026-04-16T10-00-00-000Z", "manifest.json"), {
    runId: "2026-04-16T10-00-00-000Z",
    createdAt: "2026-04-16T10:00:00.000Z",
    sourceMode: "explicit_urls",
    explicitUrls: ["https://github.com/org/stable"],
    effectiveUrls: ["https://github.com/org/stable"],
    intakeRun: { items: 1 },
    reviewRun: { items: 1, reviewScope: "selected_urls" }
  });
  await writeJson(path.join(rootDir, "runs", projectKey, "2026-04-15T10-00-00-000Z", "manifest.json"), {
    runId: "2026-04-15T10-00-00-000Z",
    createdAt: "2026-04-15T10:00:00.000Z",
    sourceMode: "explicit_urls",
    explicitUrls: ["https://github.com/org/stable"],
    effectiveUrls: ["https://github.com/org/stable"],
    intakeRun: { items: 1 },
    reviewRun: { items: 1, reviewScope: "selected_urls" }
  });
  await writeJson(path.join(rootDir, "runs", projectKey, "2026-04-14T10-00-00-000Z", "manifest.json"), {
    runId: "2026-04-14T10-00-00-000Z",
    createdAt: "2026-04-14T10:00:00.000Z",
    sourceMode: "explicit_urls",
    explicitUrls: ["https://github.com/org/stable"],
    effectiveUrls: ["https://github.com/org/stable"],
    intakeRun: { items: 1 },
    reviewRun: { items: 1, reviewScope: "selected_urls" }
  });

  const stability = await buildProjectRunStability(rootDir, config, {
    projectKey
  });

  assert.equal(stability.status, "lightly_stable");
  assert.equal(stability.stablePairs, 1);
  assert.equal(stability.unstablePairs, 1);
  assert.equal(stability.signatures[0].runKind, "follow_up_run");
  assert.equal(stability.signatures[1].runKind, "follow_up_run");
  assert.equal(stability.signatures[2].runKind, "first_run");
});

test("buildProjectRunStability canonicalizes GitHub URL casing before comparing effective URLs", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-run-stability-github-casing-"));
  const config = { runtimeRoot: "runs" };
  const projectKey = "stable-project";

  await writeJson(path.join(rootDir, "runs", projectKey, "2026-04-15T10-00-00-000Z", "manifest.json"), {
    command: "on-demand",
    runId: "2026-04-15T10-00-00-000Z",
    createdAt: "2026-04-15T10:00:00.000Z",
    sourceMode: "explicit_urls",
    runPlan: { runKind: "follow_up_run" },
    effectiveUrls: ["https://github.com/City-Bureau/City-Scrapers"],
    intakeRun: { items: 1 },
    reviewRun: { items: 1, reviewScope: "selected_urls" }
  });
  await writeJson(path.join(rootDir, "runs", projectKey, "2026-04-14T10-00-00-000Z", "manifest.json"), {
    command: "on-demand",
    runId: "2026-04-14T10-00-00-000Z",
    createdAt: "2026-04-14T10:00:00.000Z",
    sourceMode: "explicit_urls",
    runPlan: { runKind: "follow_up_run" },
    effectiveUrls: ["https://github.com/city-bureau/city-scrapers"],
    intakeRun: { items: 1 },
    reviewRun: { items: 1, reviewScope: "selected_urls" }
  });

  const stability = await buildProjectRunStability(rootDir, config, {
    projectKey
  });

  assert.equal(stability.unstablePairs, 0);
  assert.equal(stability.stablePairs, 1);
});
