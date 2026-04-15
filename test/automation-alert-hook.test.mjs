import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildAutomationAlertDigest,
  loadAutomationAlertHookPayload,
  parseAutomationAlertHookArgs,
  renderAutomationAlertHookMarkdown,
  writeAutomationAlertHookOutputs
} from "../lib/automation/alert-hook.mjs";

test("parseAutomationAlertHookArgs parses payload and output flags", () => {
  const options = parseAutomationAlertHookArgs([
    "--payload-file", "state/payload.json",
    "--write-markdown", "state/digest.md",
    "--write-json", "state/digest.json",
    "--print"
  ]);

  assert.match(options.payloadFile, /payload\.json$/);
  assert.match(options.writeMarkdown, /digest\.md$/);
  assert.match(options.writeJson, /digest\.json$/);
  assert.equal(options.print, true);
});

test("loadAutomationAlertHookPayload prefers explicit payload file", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-hook-"));
  const payloadFile = path.join(tempDir, "payload.json");
  await fs.writeFile(payloadFile, `${JSON.stringify({ generatedAt: "2026-04-15T12:00:00.000Z", alerts: [] })}\n`, "utf8");

  const payload = await loadAutomationAlertHookPayload({
    payloadFile
  }, {});

  assert.equal(payload.generatedAt, "2026-04-15T12:00:00.000Z");
});

test("buildAutomationAlertDigest counts severities, categories and jobs", () => {
  const digest = buildAutomationAlertDigest({
    schemaVersion: 1,
    generatedAt: "2026-04-15T12:00:00.000Z",
    nextJob: {
      name: "eventbear-worker-apply",
      status: "ready"
    },
    alerts: [
      { severity: "high", category: "blocked_manual", jobName: "eventbear-worker-apply" },
      { severity: "medium", category: "blocked_manual", jobName: "eventbear-worker-apply" },
      { severity: "low", category: "drift_attention", jobName: "all-project-watchlists" }
    ]
  });

  assert.equal(digest.alertCount, 3);
  assert.equal(digest.severityCounts.high, 1);
  assert.equal(digest.topCategories[0].category, "blocked_manual");
  assert.equal(digest.touchedJobs[0].jobName, "eventbear-worker-apply");
});

test("writeAutomationAlertHookOutputs writes markdown and json digests", async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-alert-hook-out-"));
  const markdownPath = path.join(tempDir, "digest.md");
  const jsonPath = path.join(tempDir, "digest.json");
  const payload = {
    schemaVersion: 1,
    generatedAt: "2026-04-15T12:00:00.000Z",
    alerts: []
  };
  const digest = buildAutomationAlertDigest(payload);
  const markdown = renderAutomationAlertHookMarkdown(payload, digest);

  const writes = await writeAutomationAlertHookOutputs({
    payload,
    digest,
    markdown,
    writeMarkdown: markdownPath,
    writeJson: jsonPath
  });

  const writtenMarkdown = await fs.readFile(markdownPath, "utf8");
  const writtenJson = JSON.parse(await fs.readFile(jsonPath, "utf8"));

  assert.equal(writes.length, 2);
  assert.match(writtenMarkdown, /Patternpilot Alert Hook Digest/);
  assert.equal(writtenJson.digest.alertCount, 0);
});
