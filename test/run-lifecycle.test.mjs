import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  listProjectRunHistory,
  buildProjectRunLifecycle,
  buildRunResumeRecommendation,
  renderProjectRunLifecycleSummary
} from "../lib/run-lifecycle.mjs";

test("buildProjectRunLifecycle classifies first runs", () => {
  const lifecycle = buildProjectRunLifecycle({
    priorRuns: [],
    sourceMode: "explicit_urls",
    explicitUrlCount: 1,
    watchlistCount: 0,
    queueStats: { promoted: 0 }
  });

  assert.equal(lifecycle.runKind, "first_run");
  assert.equal(lifecycle.defaultPromotionMode, "prepared");
  assert.match(lifecycle.notes.join(" "), /orientation/i);
});

test("buildProjectRunLifecycle classifies follow-up runs for explicit repo analysis", () => {
  const lifecycle = buildProjectRunLifecycle({
    priorRuns: [
      { runId: "2026-04-14T10-00-00-000Z", createdAt: "2026-04-14T10:00:00.000Z", command: "on-demand" }
    ],
    sourceMode: "explicit_urls",
    explicitUrlCount: 1,
    watchlistCount: 2,
    queueStats: { promoted: 1 }
  });

  assert.equal(lifecycle.runKind, "follow_up_run");
  assert.equal(lifecycle.recommendedFocus, "comparison_and_decision");
});

test("buildProjectRunLifecycle classifies maintenance runs for automation", () => {
  const lifecycle = buildProjectRunLifecycle({
    priorRuns: [
      { runId: "2026-04-14T10-00-00-000Z", createdAt: "2026-04-14T10:00:00.000Z", command: "on-demand" }
    ],
    sourceMode: "watchlist",
    explicitUrlCount: 0,
    watchlistCount: 4,
    isAutomation: true,
    queueStats: { promoted: 2 }
  });

  assert.equal(lifecycle.runKind, "maintenance_run");
  assert.equal(lifecycle.defaultPhases.promote, "prepared_only");
  assert.match(lifecycle.reasons.join(" "), /Automation runs/i);
  assert.equal(lifecycle.executionPolicy.reEvaluateScope, "stale_only");
});

test("buildRunResumeRecommendation distinguishes auto-resume and manual phases", () => {
  const lifecycle = buildProjectRunLifecycle({
    priorRuns: [
      { runId: "2026-04-14T10-00-00-000Z", createdAt: "2026-04-14T10:00:00.000Z", command: "on-demand" }
    ],
    sourceMode: "watchlist",
    explicitUrlCount: 0,
    watchlistCount: 4,
    isAutomation: true,
    queueStats: { promoted: 2 }
  });

  const autoResume = buildRunResumeRecommendation({
    lifecycle,
    failedPhase: "discover",
    failure: { retryable: true, category: "network_transient" }
  });
  const manualResume = buildRunResumeRecommendation({
    lifecycle,
    failedPhase: "promote",
    failure: { retryable: true, category: "network_transient" }
  });

  assert.equal(autoResume.autoResumeAllowed, true);
  assert.equal(autoResume.strategy, "retry_after_backoff");
  assert.equal(manualResume.autoResumeAllowed, false);
  assert.equal(manualResume.strategy, "manual_resume_on_curated_phase");
});

test("listProjectRunHistory reads and sorts saved run manifests", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-run-history-"));
  const config = { runtimeRoot: "runs" };
  const projectKey = "sample-project";
  const olderDir = path.join(rootDir, "runs", projectKey, "2026-04-14T10-00-00-000Z");
  const newerDir = path.join(rootDir, "runs", projectKey, "2026-04-14T12-00-00-000Z");
  const ignoredDir = path.join(rootDir, "runs", projectKey, "2026-04-14T13-00-00-000Z");

  await fs.mkdir(olderDir, { recursive: true });
  await fs.mkdir(newerDir, { recursive: true });
  await fs.mkdir(ignoredDir, { recursive: true });
  await fs.writeFile(path.join(olderDir, "manifest.json"), JSON.stringify({
    runId: "2026-04-14T10-00-00-000Z",
    createdAt: "2026-04-14T10:00:00.000Z",
    sourceMode: "explicit_urls",
    intakeRun: { items: 1 },
    reviewRun: { items: 1 }
  }), "utf8");
  await fs.writeFile(path.join(newerDir, "manifest.json"), JSON.stringify({
    runId: "2026-04-14T12-00-00-000Z",
    createdAt: "2026-04-14T12:00:00.000Z",
    sourceMode: "watchlist",
    intakeRun: { items: 2 },
    reviewRun: { items: 2 }
  }), "utf8");
  await fs.writeFile(path.join(ignoredDir, "manifest.json"), JSON.stringify({
    runId: "2026-04-14T13-00-00-000Z",
    createdAt: "2026-04-14T13:00:00.000Z",
    imported: true,
    discovery: { candidates: [] }
  }), "utf8");

  const history = await listProjectRunHistory(rootDir, config, projectKey);
  assert.equal(history.length, 2);
  assert.equal(history[0].runId, "2026-04-14T12-00-00-000Z");
  assert.equal(history[1].runId, "2026-04-14T10-00-00-000Z");
  assert.equal(history[0].command, "on-demand");
});

test("renderProjectRunLifecycleSummary renders lifecycle fields", () => {
  const markdown = renderProjectRunLifecycleSummary({
    projectKey: "eventbear-worker",
    generatedAt: "2026-04-14T22:20:00.000Z",
    lifecycle: {
      runKind: "follow_up_run",
      sourceMode: "explicit_urls",
      priorRunCount: 2,
      latestRunRecord: { runId: "abc", command: "on-demand" },
      watchlistCount: 3,
      explicitUrlCount: 1,
      recommendedFocus: "comparison_and_decision",
      defaultPromotionMode: "prepared",
      defaultPhases: {
        intake: "required",
        reEvaluate: "required",
        review: "required",
        promote: "prepare_or_apply_carefully"
      },
      reasons: ["2 earlier runs exist."],
      notes: ["Compare against the earlier report."]
    }
  });

  assert.match(markdown, /run_kind: follow_up_run/);
  assert.match(markdown, /default_promotion_mode: prepared/);
  assert.match(markdown, /Compare against the earlier report/);
});
