import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubAppEventPreview,
  renderGithubAppEventPreviewSummary,
  writeGithubAppEventPreviewArtifacts
} from "../lib/github.mjs";

test("buildGithubAppEventPreview maps a known installation event to the planned route", () => {
  const preview = buildGithubAppEventPreview({
    github: {
      authEnvVars: []
    }
  }, {
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "installation.created",
    deliveryId: "delivery-123",
    payload: {
      action: "created",
      repository: {
        full_name: "Dom-303/patternpilot",
        default_branch: "main",
        owner: {
          login: "Dom-303"
        },
        name: "patternpilot"
      },
      installation: {
        id: 10101,
        account: {
          login: "Dom-303"
        },
        target_type: "Organization"
      }
    }
  });

  assert.equal(preview.previewStatus, "planned_phase_4");
  assert.equal(preview.route.eventKey, "installation.created");
  assert.deepEqual(preview.route.commandPath, [
    "github-app-installation-review",
    "github-app-installation-apply",
    "setup-checklist",
    "show-project"
  ]);

  const summary = renderGithubAppEventPreviewSummary({ preview });
  assert.match(summary, /installation\.created/);
  assert.match(summary, /github-app-installation-review -> github-app-installation-apply -> setup-checklist -> show-project/);
});

test("buildGithubAppEventPreview reports unknown events cleanly", () => {
  const preview = buildGithubAppEventPreview({
    github: {
      authEnvVars: []
    }
  }, {
    eventKey: "issues.opened",
    payload: {}
  });

  assert.equal(preview.previewStatus, "unknown_event");
  assert.equal(preview.route, null);
});

test("writeGithubAppEventPreviewArtifacts writes event preview files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-github-event-preview-"));
  const preview = {
    schemaVersion: 1,
    generatedAt: "2026-04-15T12:00:00.000Z",
    previewStatus: "mapped_now",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    githubAction: null,
    repository: {
      fullName: "Dom-303/patternpilot",
      defaultBranch: "main"
    },
    installation: null,
    route: {
      eventKey: "repository_dispatch.patternpilot_on_demand",
      transport: "synthetic_dispatch",
      gate: "manual",
      commandPath: ["on-demand"],
      purpose: "Run on demand",
      artifacts: ["projects/<project>/reports/latest-report.json"]
    },
    readinessStatus: "cli_ready_app_missing",
    nextAction: "Keep shipping."
  };
  const summary = renderGithubAppEventPreviewSummary({ preview });

  const artifacts = await writeGithubAppEventPreviewArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    preview,
    summary,
    dryRun: false
  });

  const writtenJson = JSON.parse(await fs.readFile(artifacts.jsonPath, "utf8"));
  const writtenSummary = await fs.readFile(artifacts.summaryPath, "utf8");

  assert.equal(writtenJson.eventKey, "repository_dispatch.patternpilot_on_demand");
  assert.match(writtenSummary, /Patternpilot GitHub App Event Preview/);
});
