import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { appendReEvaluateRun, readReEvaluateHistory } from "../lib/re-evaluate-history.mjs";

describe("re-evaluate history", () => {
  test("appendReEvaluateRun creates state/re-evaluate-history.json", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-reh-"));
    await appendReEvaluateRun(rootDir, {
      runId: "run-1",
      projectKey: "demo",
      targetCount: 5,
      driftReasons: { rules_fingerprint_drift: 5 }
    });
    const file = path.join(rootDir, "state", "re-evaluate-history.json");
    assert.ok(fs.existsSync(file));
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(data.runs.length, 1);
    assert.equal(data.runs[0].targetCount, 5);
    assert.equal(data.runs[0].runId, "run-1");
  });

  test("appendReEvaluateRun appends without losing prior runs", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-reh-"));
    await appendReEvaluateRun(rootDir, { runId: "r1", projectKey: "demo", targetCount: 1, driftReasons: {} });
    await appendReEvaluateRun(rootDir, { runId: "r2", projectKey: "demo", targetCount: 2, driftReasons: {} });
    const data = await readReEvaluateHistory(rootDir);
    assert.equal(data.runs.length, 2);
    assert.equal(data.runs[1].runId, "r2");
  });
});
