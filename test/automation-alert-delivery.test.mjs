import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  deliverAutomationAlertPayload,
  renderAutomationAlertDeliverySummary,
  resolveAutomationAlertTargets
} from "../lib/automation/alert-delivery.mjs";

test("resolveAutomationAlertTargets falls back to stdout when nothing is configured", () => {
  const targets = resolveAutomationAlertTargets("/tmp/patternpilot", {
    automationAlertTargets: []
  }, {});

  assert.deepEqual(targets, [{ type: "stdout" }]);
});

test("deliverAutomationAlertPayload writes markdown to a configured file target", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-delivery-"));
  const payload = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    markdown: "# Alerts\n\n- test"
  };

  const delivery = await deliverAutomationAlertPayload(rootDir, {
    automationAlertTargets: []
  }, payload, {
    target: "file",
    file: "state/published-alerts.md",
    dryRun: false
  });

  const written = await fs.readFile(path.join(rootDir, "state", "published-alerts.md"), "utf8");
  assert.match(written, /# Alerts/);
  assert.equal(delivery.deliveries[0].status, "written");

  const markdown = renderAutomationAlertDeliverySummary({
    generatedAt: payload.generatedAt,
    deliveries: delivery.deliveries
  });
  assert.match(markdown, /published-alerts\.md/);
});

test("deliverAutomationAlertPayload reports missing GITHUB_STEP_SUMMARY env for github-summary target", async () => {
  const payload = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    markdown: "# Alerts\n\n- test"
  };
  const previous = process.env.GITHUB_STEP_SUMMARY;
  delete process.env.GITHUB_STEP_SUMMARY;

  try {
    const delivery = await deliverAutomationAlertPayload("/tmp/patternpilot", {
      automationAlertTargets: []
    }, payload, {
      target: "github-summary",
      dryRun: false
    });

    assert.equal(delivery.deliveries[0].status, "missing_env");
  } finally {
    if (previous) {
      process.env.GITHUB_STEP_SUMMARY = previous;
    }
  }
});

test("deliverAutomationAlertPayload executes a local command target with payload file", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-hook-"));
  const hookOutput = path.join(rootDir, "state", "hook-output.txt");
  const payload = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    markdown: "# Alerts\n\n- command test"
  };

  const delivery = await deliverAutomationAlertPayload(rootDir, {
    automationAlertTargets: []
  }, payload, {
    target: "command",
    targetCommand: `node -e 'const fs=require("fs");fs.writeFileSync(${JSON.stringify(hookOutput)}, process.env.PATTERNPILOT_ALERT_PAYLOAD_FILE)'`,
    payloadFile: "state/hook-payload.json",
    dryRun: false
  });

  const payloadFile = await fs.readFile(path.join(rootDir, "state", "hook-payload.json"), "utf8");
  const hookFile = await fs.readFile(hookOutput, "utf8");
  assert.match(payloadFile, /command test/);
  assert.equal(delivery.deliveries[0].status, "executed");
  assert.match(hookFile, /hook-payload\.json/);
});

test("deliverAutomationAlertPayload executes the built-in patternpilot alert hook", async () => {
  const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-builtin-alert-hook-"));
  const payloadFile = path.join(tempDir, "payload.json");
  const markdownFile = path.join(tempDir, "hook-digest.md");
  const jsonFile = path.join(tempDir, "hook-digest.json");
  const payload = {
    schemaVersion: 1,
    generatedAt: "2026-04-15T12:00:00.000Z",
    nextJob: {
      name: "eventbear-worker-apply",
      status: "ready",
      reason: "interval_elapsed",
      command: "npm run automation:run"
    },
    alerts: [
      {
        severity: "high",
        category: "blocked_manual",
        jobName: "eventbear-worker-apply",
        message: "Blocked for manual intervention.",
        nextAction: "Inspect the failing run."
      }
    ],
    markdown: "# Patternpilot Automation Alerts\n\n- demo"
  };

  const delivery = await deliverAutomationAlertPayload(repoRoot, {
    automationAlertTargets: []
  }, payload, {
    target: "command",
    targetHook: "patternpilot-alert-hook",
    payloadFile,
    hookMarkdownFile: markdownFile,
    hookJsonFile: jsonFile,
    dryRun: false
  });

  const writtenMarkdown = await fs.readFile(markdownFile, "utf8");
  const writtenJson = JSON.parse(await fs.readFile(jsonFile, "utf8"));

  assert.equal(delivery.deliveries[0].status, "executed");
  assert.equal(delivery.deliveries[0].hookName, "patternpilot-alert-hook");
  assert.match(writtenMarkdown, /Patternpilot Alert Hook Digest/);
  assert.equal(writtenJson.digest.alertCount, 1);
  assert.equal(writtenJson.digest.nextJob.name, "eventbear-worker-apply");
});
