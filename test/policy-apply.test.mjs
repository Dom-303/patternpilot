import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyProjectPolicy } from "../lib/policy/policy-apply.mjs";

test("applyProjectPolicy snapshots and overwrites policy file", async () => {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-policy-apply-"));
  try {
    const projectDir = path.join(rootDir, "projects", "eventbear-worker");
    fs.mkdirSync(path.join(projectDir, "calibration"), { recursive: true });
    const currentPolicyPath = path.join(projectDir, "DISCOVERY_POLICY.json");
    const nextPolicyPath = path.join(projectDir, "calibration", "proposed-policy.json");
    const notesPath = path.join(projectDir, "calibration", "DISCOVERY_POLICY_NOTES.md");
    fs.writeFileSync(currentPolicyPath, '{"allowDispositions":["intake_now","review_queue"]}\n', "utf8");
    fs.writeFileSync(nextPolicyPath, '{"allowDispositions":["intake_now","review_queue","observe_only"]}\n', "utf8");

    const out = await applyProjectPolicy({
      rootDir,
      projectKey: "eventbear-worker",
      currentPolicyPath,
      nextPolicyPath,
      notesPath,
      generatedAt: "2026-04-14T21:00:00.000Z",
      dryRun: false,
      summaryLines: ["Workbench review suggests unblocking observe_only candidates."]
    });

    const updated = fs.readFileSync(currentPolicyPath, "utf8");
    assert.match(updated, /observe_only/);
    assert.equal(out.changed, true);
    assert.ok(fs.existsSync(path.join(rootDir, out.summaryPath)));
  } finally {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});
