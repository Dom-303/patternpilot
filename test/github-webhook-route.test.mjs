import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubWebhookRoutePlan,
  renderGithubWebhookRoutePlanSummary,
  resolveProjectKeyForWebhookRoute,
  writeGithubWebhookRouteArtifacts
} from "../lib/github-webhook-route.mjs";

test("resolveProjectKeyForWebhookRoute can infer project from repository basename", () => {
  const selection = resolveProjectKeyForWebhookRoute({
    projects: {
      "eventbear-worker": {
        projectRoot: "../eventbear-worker"
      }
    }
  }, {
    repository: {
      fullName: "Dom-303/eventbear-worker"
    }
  });

  assert.equal(selection.projectKey, "eventbear-worker");
  assert.equal(selection.source, "repository_match");
});

test("buildGithubWebhookRoutePlan creates a dispatchable on-demand route from repository_dispatch", () => {
  const routePlan = buildGithubWebhookRoutePlan({
    projects: {
      "eventbear-worker": {
        projectRoot: "../eventbear-worker"
      }
    }
  }, {
    generatedAt: "2026-04-15T12:00:00.000Z",
    deliveryId: "delivery-1",
    patternpilotEventKey: "repository_dispatch.patternpilot_on_demand",
    verification: {
      status: "verified",
      valid: true
    },
    repository: {
      fullName: "Dom-303/patternpilot"
    },
    payload: {
      client_payload: {
        project: "eventbear-worker",
        urls: ["https://github.com/oc/openevents"]
      }
    }
  });

  assert.equal(routePlan.routeStatus, "dispatchable");
  assert.equal(routePlan.commands[0].commandName, "on-demand");
  assert.match(routePlan.commands[0].shellCommand, /oc\/openevents/);

  const summary = renderGithubWebhookRoutePlanSummary({
    routePlan,
    envelope: {
      repository: {
        fullName: "Dom-303/patternpilot"
      }
    }
  });
  assert.match(summary, /dispatchable/);
});

test("buildGithubWebhookRoutePlan guards invalid signatures before routing", () => {
  const routePlan = buildGithubWebhookRoutePlan({
    projects: {}
  }, {
    generatedAt: "2026-04-15T12:00:00.000Z",
    patternpilotEventKey: "installation.created",
    verification: {
      status: "invalid_signature",
      valid: false
    },
    repository: {
      fullName: "Dom-303/patternpilot"
    },
    payload: {}
  });

  assert.equal(routePlan.routeStatus, "blocked_invalid_signature");
});

test("writeGithubWebhookRouteArtifacts writes route plan artifacts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-webhook-route-"));
  const routePlan = {
    schemaVersion: 1,
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "push.default_branch",
    routeStatus: "governance_review",
    gate: "governance",
    commands: [
      {
        commandName: "run-drift",
        args: ["--project", "eventbear-worker"],
        shellCommand: "\"npm\" \"run\" \"patternpilot\" \"--\" \"run-drift\" \"--project\" \"eventbear-worker\""
      }
    ],
    artifacts: ["runs/<project>/<run-id>/summary.md"],
    nextAction: "Run governance first."
  };
  const summary = renderGithubWebhookRoutePlanSummary({
    routePlan,
    envelope: {
      repository: {
        fullName: "Dom-303/eventbear-worker"
      }
    }
  });

  const artifacts = await writeGithubWebhookRouteArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    routePlan,
    summary,
    dryRun: false
  });

  const writtenRoute = JSON.parse(await fs.readFile(artifacts.routePath, "utf8"));
  const writtenSummary = await fs.readFile(artifacts.summaryPath, "utf8");

  assert.equal(writtenRoute.routeStatus, "governance_review");
  assert.match(writtenSummary, /Patternpilot GitHub Webhook Route/);
});
