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

test("resolveAutomationAlertTargets expands the built-in local-operator preset", () => {
  const targets = resolveAutomationAlertTargets("/tmp/patternpilot", {
    automationAlertPreset: "local-operator",
    automationAlertTargets: []
  }, {});

  assert.equal(targets.length, 3);
  assert.equal(targets[0].name, "alerts-journal");
  assert.equal(targets[1].name, "operator-digest");
  assert.equal(targets[1].minDeliveryPriority, "elevated");
  assert.equal(targets[2].name, "operator-attention");
  assert.equal(targets[2].minDeliveryPriority, "urgent");
  assert.deepEqual(targets[2].attentionSignalsAny, ["operator_review_open", "operator_attention_alert"]);
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
    deliveries: delivery.deliveries,
    attention: {
      status: "routine",
      deliveryPriority: "routine",
      signals: []
    }
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
      name: "sample-project-apply",
      status: "ready",
      reason: "interval_elapsed",
      command: "npm run automation:run"
    },
    alerts: [
      {
        severity: "high",
        category: "blocked_manual",
        jobName: "sample-project-apply",
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
  assert.equal(writtenJson.digest.nextJob.name, "sample-project-apply");
});

test("deliverAutomationAlertPayload skips targets whose minimum delivery priority is not met", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-delivery-skip-"));
  const payload = {
    generatedAt: "2026-04-18T08:00:00.000Z",
    attention: {
      status: "review_closeout_followup",
      deliveryPriority: "elevated",
      signals: ["operator_review_recent_closeout"]
    },
    markdown: "# Alerts\n\n- attention"
  };

  const delivery = await deliverAutomationAlertPayload(rootDir, {
    automationAlertTargets: [
      {
        type: "file",
        name: "urgent-only",
        file: "state/urgent.md",
        minDeliveryPriority: "urgent"
      }
    ]
  }, payload, {
    dryRun: false
  });

  assert.equal(delivery.deliveries[0].status, "skipped_delivery_priority");
  assert.match(delivery.deliveries[0].reason, /below target minimum 'urgent'/);
});

test("deliverAutomationAlertPayload targets operator-review signals explicitly", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-delivery-signals-"));
  const payload = {
    generatedAt: "2026-04-18T08:00:00.000Z",
    attention: {
      status: "operator_attention_required",
      deliveryPriority: "urgent",
      signals: ["operator_review_open", "high_severity_alert"]
    },
    markdown: "# Alerts\n\n- attention"
  };

  const delivery = await deliverAutomationAlertPayload(rootDir, {
    automationAlertTargets: [
      {
        type: "file",
        name: "operator-review-only",
        file: "state/operator-review.md",
        attentionSignalsAny: ["operator_review_open"]
      },
      {
        type: "file",
        name: "closeout-only",
        file: "state/closeout.md",
        attentionSignalsAny: ["operator_review_recent_closeout"]
      }
    ]
  }, payload, {
    dryRun: false
  });

  assert.equal(delivery.deliveries[0].status, "written");
  assert.equal(delivery.deliveries[1].status, "skipped_attention_signals");
  assert.match(delivery.deliveries[1].reason, /operator_review_recent_closeout/);
});

test("deliverAutomationAlertPayload applies the built-in local-operator preset", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-delivery-preset-"));
  await fs.mkdir(path.join(rootDir, "automation", "hooks"), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, "automation", "hooks", "patternpilot-alert-hook.mjs"),
    `import fs from "node:fs/promises";
import path from "node:path";
const payloadPath = process.env.PATTERNPILOT_ALERT_PAYLOAD_FILE;
const payload = JSON.parse(await fs.readFile(payloadPath, "utf8"));
const markdownPath = process.argv[process.argv.indexOf("--write-markdown") + 1];
const jsonPath = process.argv[process.argv.indexOf("--write-json") + 1];
await fs.mkdir(path.dirname(markdownPath), { recursive: true });
await fs.mkdir(path.dirname(jsonPath), { recursive: true });
await fs.writeFile(markdownPath, "# Test Digest\\n", "utf8");
await fs.writeFile(jsonPath, JSON.stringify({ digest: { deliveryPriority: payload.attention?.deliveryPriority ?? null } }, null, 2), "utf8");
`,
    "utf8"
  );
  const payload = {
    generatedAt: "2026-04-18T08:00:00.000Z",
    attention: {
      status: "operator_attention_required",
      deliveryPriority: "urgent",
      signals: ["operator_review_open", "high_severity_alert"]
    },
    markdown: "# Alerts\n\n- preset delivery"
  };

  const delivery = await deliverAutomationAlertPayload(rootDir, {
    automationAlertPreset: "local-operator",
    automationAlertTargets: []
  }, payload, {
    dryRun: false
  });

  assert.equal(delivery.deliveries.length, 3);
  assert.equal(delivery.deliveries[0].status, "written");
  assert.equal(delivery.deliveries[1].status, "executed");
  assert.equal(delivery.deliveries[2].status, "written");

  const journal = await fs.readFile(path.join(rootDir, "state", "automation_alerts_published.md"), "utf8");
  const operatorAttention = await fs.readFile(path.join(rootDir, "state", "automation_operator_attention.md"), "utf8");
  const digestJson = JSON.parse(await fs.readFile(path.join(rootDir, "state", "automation_alert_digest.json"), "utf8"));

  assert.match(journal, /preset delivery/);
  assert.match(operatorAttention, /preset delivery/);
  assert.equal(digestJson.digest.deliveryPriority, "urgent");
});
