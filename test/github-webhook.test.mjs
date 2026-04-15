import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubWebhookEnvelope,
  computeGithubWebhookSignature,
  derivePatternpilotEventKeyFromWebhook,
  parseWebhookHeadersContent,
  renderGithubWebhookEnvelopeSummary,
  verifyGithubWebhookSignature,
  writeGithubWebhookPreviewArtifacts
} from "../lib/github-webhook.mjs";

test("parseWebhookHeadersContent supports json input", () => {
  const headers = parseWebhookHeadersContent(JSON.stringify({
    "X-GitHub-Event": "installation",
    "X-GitHub-Delivery": "delivery-1"
  }));

  assert.equal(headers["x-github-event"], "installation");
  assert.equal(headers["x-github-delivery"], "delivery-1");
});

test("derivePatternpilotEventKeyFromWebhook derives default branch push and dispatch events", () => {
  assert.equal(derivePatternpilotEventKeyFromWebhook({
    rawEvent: "push",
    payload: {
      ref: "refs/heads/main",
      repository: {
        default_branch: "main"
      }
    }
  }), "push.default_branch");

  assert.equal(derivePatternpilotEventKeyFromWebhook({
    rawEvent: "repository_dispatch",
    payload: {
      event_type: "patternpilot_on_demand"
    }
  }), "repository_dispatch.patternpilot_on_demand");
});

test("verifyGithubWebhookSignature validates a correct sha256 signature", () => {
  const payloadText = JSON.stringify({ hello: "world" });
  const secret = "patternpilot-dev-secret";
  const signature = computeGithubWebhookSignature(secret, payloadText);

  const result = verifyGithubWebhookSignature({
    secret,
    payloadText,
    signature
  });

  assert.equal(result.status, "verified");
  assert.equal(result.valid, true);
});

test("buildGithubWebhookEnvelope builds a verified normalized envelope", () => {
  const payload = {
    action: "created",
    repository: {
      full_name: "Dom-303/patternpilot",
      default_branch: "main",
      visibility: "public"
    },
    installation: {
      id: 10101,
      account: {
        login: "Dom-303"
      }
    }
  };
  const payloadText = JSON.stringify(payload);
  const secret = "patternpilot-dev-secret";
  const signature = computeGithubWebhookSignature(secret, payloadText);

  const envelope = buildGithubWebhookEnvelope({
    generatedAt: "2026-04-15T12:00:00.000Z",
    headers: {
      "x-github-event": "installation",
      "x-github-delivery": "delivery-1",
      "x-hub-signature-256": signature
    },
    payload,
    payloadText,
    webhookSecret: secret
  });

  assert.equal(envelope.rawEvent, "installation");
  assert.equal(envelope.patternpilotEventKey, "installation.created");
  assert.equal(envelope.verification.valid, true);
});

test("writeGithubWebhookPreviewArtifacts writes envelope and preview artifacts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-webhook-preview-"));
  const envelope = {
    schemaVersion: 1,
    generatedAt: "2026-04-15T12:00:00.000Z",
    deliveryId: "delivery-1",
    rawEvent: "installation",
    githubAction: "created",
    patternpilotEventKey: "installation.created",
    verification: {
      status: "verified",
      valid: true
    },
    repository: {
      fullName: "Dom-303/patternpilot"
    },
    installation: {
      id: 10101
    }
  };
  const preview = {
    previewStatus: "planned_phase_4",
    route: {
      gate: "manual",
      commandPath: ["setup-checklist", "init-project", "show-project"],
      purpose: "Bootstrap installation metadata"
    },
    nextAction: "Keep in the plan layer."
  };
  const summary = renderGithubWebhookEnvelopeSummary({ envelope, preview });

  const artifacts = await writeGithubWebhookPreviewArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    envelope,
    preview,
    summary,
    dryRun: false
  });

  const writtenEnvelope = JSON.parse(await fs.readFile(artifacts.envelopePath, "utf8"));
  const writtenSummary = await fs.readFile(artifacts.summaryPath, "utf8");

  assert.equal(writtenEnvelope.patternpilotEventKey, "installation.created");
  assert.match(writtenSummary, /Patternpilot GitHub Webhook Preview/);
});
