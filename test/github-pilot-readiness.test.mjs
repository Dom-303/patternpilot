import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGithubAppLivePilotReview,
  renderGithubAppLivePilotSummary
} from "../lib/github.mjs";

test("buildGithubAppLivePilotReview marks PAT bridge pilot as ready when runtime closeout is healthy", () => {
  const previousToken = process.env.PATTERNPILOT_GITHUB_TOKEN;

  process.env.PATTERNPILOT_GITHUB_TOKEN = "test-token";

  try {
    const review = buildGithubAppLivePilotReview({
      defaultProject: "eventbear-worker",
      github: {
        authEnvVars: ["PATTERNPILOT_GITHUB_TOKEN"]
      }
    }, {
      closeoutReview: {
        closeoutStatus: "closeout_ready",
        nextAction: "GitHub App runtime closeout is ready.",
        controlReview: {
          controlStatus: "runtime_control_healthy",
          nextAction: "GitHub App runtime control surface looks healthy."
        }
      },
      installationState: {
        installations: []
      },
      envState: {
        rootEnvLocalPresent: true,
        githubAppEnvLocalPresent: false
      },
      scaffoldState: {
        githubAppScaffoldPresent: true,
        automationOpsPresent: true
      }
    }, {
      generatedAt: "2026-04-17T10:00:00.000Z"
    });

    assert.equal(review.pilotStatus, "pilot_bridge_ready");
    assert.equal(review.pilotMode, "cli_bridge_pilot");
    assert.equal(review.closeoutReview.closeoutStatus, "closeout_ready");
    assert.ok(review.recommendedCommands.some((item) => item.includes("on-demand --project eventbear-worker")));

    const summary = renderGithubAppLivePilotSummary(review);
    assert.match(summary, /pilot_status: pilot_bridge_ready/);
    assert.match(summary, /pilot_mode: cli_bridge_pilot/);
  } finally {
    if (previousToken) {
      process.env.PATTERNPILOT_GITHUB_TOKEN = previousToken;
    } else {
      delete process.env.PATTERNPILOT_GITHUB_TOKEN;
    }
  }
});

test("buildGithubAppLivePilotReview blocks pilot when auth is missing or runtime is not ready", () => {
  const previousToken = process.env.PATTERNPILOT_GITHUB_TOKEN;
  delete process.env.PATTERNPILOT_GITHUB_TOKEN;

  try {
    const review = buildGithubAppLivePilotReview({
      defaultProject: "eventbear-worker",
      github: {
        authEnvVars: ["PATTERNPILOT_GITHUB_TOKEN"]
      }
    }, {
      closeoutReview: {
        closeoutStatus: "closeout_blocked",
        nextAction: "Runtime follow-up is still required.",
        controlReview: {
          controlStatus: "runtime_control_critical",
          nextAction: "Critical runtime issues remain."
        }
      },
      installationState: {
        installations: []
      },
      envState: {
        rootEnvLocalPresent: false,
        githubAppEnvLocalPresent: false
      },
      scaffoldState: {
        githubAppScaffoldPresent: true,
        automationOpsPresent: true
      }
    }, {
      generatedAt: "2026-04-17T10:05:00.000Z"
    });

    assert.equal(review.pilotStatus, "pilot_blocked");
    assert.equal(review.blockerCount, 3);
    assert.match(review.nextAction, /Configure PAT or GitHub App credentials|Critical runtime issues remain|Runtime follow-up is still required/);
  } finally {
    if (previousToken) {
      process.env.PATTERNPILOT_GITHUB_TOKEN = previousToken;
    }
  }
});
