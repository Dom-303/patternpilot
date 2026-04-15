import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  buildProjectRunDriftFromState,
  renderProjectRunDriftSummary
} from "../lib/run/run-drift.mjs";

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

test("buildProjectRunDriftFromState reports watchlist and stale queue drift", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-run-drift-"));
  const projectKey = "sample-project";
  const latestReviewDir = path.join(rootDir, "runs", projectKey, "review-latest");
  const previousReviewDir = path.join(rootDir, "runs", projectKey, "review-previous");

  await writeJson(path.join(latestReviewDir, "manifest.json"), {
    runId: "review-latest",
    reviewScope: "selected_urls",
    review: {
      items: [{ repoRef: "org/new-hotness" }, { repoRef: "org/existing" }],
      topItems: [{ repoRef: "org/new-hotness" }],
      runConfidence: "medium"
    }
  });
  await writeJson(path.join(previousReviewDir, "manifest.json"), {
    runId: "review-previous",
    reviewScope: "selected_urls",
    review: {
      items: [{ repoRef: "org/existing" }],
      topItems: [{ repoRef: "org/existing" }],
      runConfidence: "medium"
    }
  });

  const history = [
    {
      runId: "2026-04-15T12-00-00-000Z",
      createdAt: "2026-04-15T12:00:00.000Z",
      command: "on-demand",
      sourceMode: "watchlist",
      manifestPath: "runs/sample-project/latest-manifest.json"
    },
    {
      runId: "2026-04-14T12-00-00-000Z",
      createdAt: "2026-04-14T12:00:00.000Z",
      command: "on-demand",
      sourceMode: "watchlist",
      manifestPath: "runs/sample-project/previous-manifest.json"
    }
  ];

  await writeJson(path.join(rootDir, "runs", projectKey, "latest-manifest.json"), {
    runId: history[0].runId,
    createdAt: history[0].createdAt,
    sourceMode: "watchlist",
    effectiveUrls: [
      "https://github.com/org/existing",
      "https://github.com/org/new-hotness"
    ],
    runPlan: {
      runKind: "maintenance_run"
    },
    reviewRun: {
      runDir: path.relative(rootDir, latestReviewDir)
    }
  });
  await writeJson(path.join(rootDir, "runs", projectKey, "previous-manifest.json"), {
    runId: history[1].runId,
    createdAt: history[1].createdAt,
    sourceMode: "watchlist",
    effectiveUrls: [
      "https://github.com/org/existing"
    ],
    runPlan: {
      runKind: "follow_up_run"
    },
    reviewRun: {
      runDir: path.relative(rootDir, previousReviewDir)
    }
  });

  const drift = await buildProjectRunDriftFromState(rootDir, {
    projectKey,
    history,
    watchlistUrls: [
      "https://github.com/org/existing",
      "https://github.com/org/new-hotness",
      "https://github.com/org/watchlist-extra"
    ],
    currentFingerprint: "current-rules",
    queueRows: [
      {
        project_key: projectKey,
        status: "pending_review",
        effort_band: "medium",
        value_band: "medium",
        review_disposition: "observe_only",
        rules_fingerprint: "old-rules",
        project_fit_band: "high",
        risks: ""
      },
      {
        project_key: projectKey,
        status: "promotion_prepared",
        effort_band: "",
        value_band: "high",
        review_disposition: "",
        rules_fingerprint: "",
        project_fit_band: "medium",
        risks: ""
      }
    ]
  });

  assert.equal(drift.driftStatus, "attention_required");
  assert.ok(drift.signals.some((item) => item.id === "run_kind_shift"));
  assert.ok(drift.signals.some((item) => item.id === "effective_url_delta"));
  assert.ok(drift.signals.some((item) => item.id === "watchlist_delta"));
  assert.ok(drift.signals.some((item) => item.id === "stale_decision_signals"));
  assert.ok(drift.signals.some((item) => item.id === "fallback_decision_signals"));
  assert.equal(drift.resumeGuidance.mode, "re_evaluate_stale_queue");
  assert.match(drift.resumeGuidance.recommendedCommand, /re-evaluate/);

  const markdown = renderProjectRunDriftSummary({
    projectKey,
    drift
  });
  assert.match(markdown, /drift_status: attention_required/);
  assert.match(markdown, /stale decision signals/i);
});

test("buildProjectRunDriftFromState reports stable projects without active drift", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-run-drift-stable-"));
  const projectKey = "stable-project";
  const history = [
    {
      runId: "2026-04-15T12-00-00-000Z",
      createdAt: "2026-04-15T12:00:00.000Z",
      command: "on-demand",
      sourceMode: "explicit_urls",
      manifestPath: "runs/stable-project/latest-manifest.json"
    },
    {
      runId: "2026-04-14T12-00-00-000Z",
      createdAt: "2026-04-14T12:00:00.000Z",
      command: "on-demand",
      sourceMode: "explicit_urls",
      manifestPath: "runs/stable-project/previous-manifest.json"
    }
  ];

  await writeJson(path.join(rootDir, "runs", projectKey, "latest-manifest.json"), {
    runId: history[0].runId,
    createdAt: history[0].createdAt,
    sourceMode: "explicit_urls",
    effectiveUrls: ["https://github.com/org/stable"],
    runPlan: { runKind: "follow_up_run" },
    reviewRun: {
      items: 1,
      reviewScope: "selected_urls"
    }
  });
  await writeJson(path.join(rootDir, "runs", projectKey, "previous-manifest.json"), {
    runId: history[1].runId,
    createdAt: history[1].createdAt,
    sourceMode: "explicit_urls",
    effectiveUrls: ["https://github.com/org/stable"],
    runPlan: { runKind: "follow_up_run" },
    reviewRun: {
      items: 1,
      reviewScope: "selected_urls"
    }
  });

  const drift = await buildProjectRunDriftFromState(rootDir, {
    projectKey,
    history,
    queueRows: [],
    watchlistUrls: [],
    currentFingerprint: "same"
  });

  assert.equal(drift.driftStatus, "stable");
  assert.equal(drift.signals.length, 0);
  assert.equal(drift.resumeGuidance.mode, "continue_default_lifecycle");
});
