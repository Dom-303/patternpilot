import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { createWizardState, appendHistory, readHistory } from "../../lib/wizard/state.mjs";

describe("wizard state", () => {
  test("createWizardState returns empty object with started_at", () => {
    const s = createWizardState();
    assert.equal(typeof s.started_at, "string");
    assert.deepEqual(s.steps, []);
    assert.equal(s.outcome, "in_progress");
  });

  test("recordStep mutates the steps array", () => {
    const s = createWizardState();
    s.recordStep("target", { value: "../foo", source: "auto-scan-1" });
    assert.equal(s.steps.length, 1);
    assert.equal(s.steps[0].name, "target");
    assert.equal(s.steps[0].value, "../foo");
  });

  test("appendHistory writes to state/wizard-history.json", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-wizard-state-"));
    const s = createWizardState();
    s.recordStep("target", { value: "../bar" });
    s.outcome = "completed";
    s.completed_at = new Date().toISOString();

    appendHistory(rootDir, s);

    const file = path.join(rootDir, "state", "wizard-history.json");
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(data.runs.length, 1);
    assert.equal(data.runs[0].outcome, "completed");
    assert.equal(data.runs[0].steps[0].value, "../bar");
  });

  test("appendHistory appends without losing prior runs", () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-wizard-state-"));
    appendHistory(rootDir, { ...createWizardState(), outcome: "completed" });
    appendHistory(rootDir, { ...createWizardState(), outcome: "cancelled" });

    const data = readHistory(rootDir);
    assert.equal(data.runs.length, 2);
    assert.equal(data.runs[1].outcome, "cancelled");
  });
});
