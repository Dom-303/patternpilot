import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubAppIntegrationPlan,
  renderGithubAppIntegrationPlanSummary,
  writeGithubAppIntegrationPlanArtifacts
} from "../lib/github.mjs";

test("buildGithubAppIntegrationPlan includes ready-now and phase-4 webhook bindings", () => {
  const previousToken = process.env.PATTERNPILOT_GITHUB_TOKEN;
  process.env.PATTERNPILOT_GITHUB_TOKEN = "test-token";

  try {
    const plan = buildGithubAppIntegrationPlan({
      github: {
        authEnvVars: ["PATTERNPILOT_GITHUB_TOKEN"]
      }
    });

    assert.equal(plan.status, "cli_bridge_app_missing");
    assert.ok(plan.eventBindings.some((item) => item.eventKey === "repository_dispatch.patternpilot_on_demand"));
    assert.ok(plan.eventBindings.some((item) => item.eventKey === "installation.created"));
    assert.ok(plan.requiredPermissions.some((item) => item.area === "contents"));

    const markdown = renderGithubAppIntegrationPlanSummary({
      generatedAt: "2026-04-15T12:00:00.000Z",
      plan
    });
    assert.match(markdown, /Patternpilot GitHub App Plan/);
    assert.match(markdown, /installation\.created/);
  } finally {
    if (previousToken) {
      process.env.PATTERNPILOT_GITHUB_TOKEN = previousToken;
    } else {
      delete process.env.PATTERNPILOT_GITHUB_TOKEN;
    }
  }
});

test("writeGithubAppIntegrationPlanArtifacts writes plan artifacts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-github-app-plan-"));
  const plan = {
    schemaVersion: 1,
    status: "phase_4_bridge",
    readiness: { status: "cli_ready_app_missing" },
    requiredPermissions: [],
    laterPermissions: [],
    eventBindings: [],
    installationModel: {
      repoSelection: "selected_repositories",
      notes: []
    },
    nextAction: "Keep going."
  };
  const summary = renderGithubAppIntegrationPlanSummary({
    generatedAt: "2026-04-15T12:00:00.000Z",
    plan
  });

  const artifacts = await writeGithubAppIntegrationPlanArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    plan,
    summary,
    dryRun: false
  });

  const writtenJson = JSON.parse(await fs.readFile(artifacts.jsonPath, "utf8"));
  const writtenSummary = await fs.readFile(artifacts.summaryPath, "utf8");

  assert.equal(writtenJson.status, "phase_4_bridge");
  assert.match(writtenSummary, /Patternpilot GitHub App Plan/);
});
