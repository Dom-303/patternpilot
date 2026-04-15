import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGithubAppReadiness,
  renderGithubAppReadinessSummary
} from "../lib/github.mjs";

test("buildGithubAppReadiness reports cli_ready_app_missing when PAT is present but app env is incomplete", () => {
  const previousToken = process.env.PATTERNPILOT_GITHUB_TOKEN;
  const previousAppId = process.env.PATTERNPILOT_GITHUB_APP_ID;

  process.env.PATTERNPILOT_GITHUB_TOKEN = "test-token";
  delete process.env.PATTERNPILOT_GITHUB_APP_ID;

  try {
    const readiness = buildGithubAppReadiness({
      github: {
        authEnvVars: ["PATTERNPILOT_GITHUB_TOKEN"]
      }
    });

    assert.equal(readiness.status, "cli_ready_app_missing");
    assert.equal(readiness.auth.tokenPresent, true);

    const markdown = renderGithubAppReadinessSummary({
      generatedAt: "2026-04-15T12:00:00.000Z",
      readiness
    });
    assert.match(markdown, /cli_ready_app_missing/);
  } finally {
    if (previousToken) {
      process.env.PATTERNPILOT_GITHUB_TOKEN = previousToken;
    } else {
      delete process.env.PATTERNPILOT_GITHUB_TOKEN;
    }
    if (previousAppId) {
      process.env.PATTERNPILOT_GITHUB_APP_ID = previousAppId;
    }
  }
});
