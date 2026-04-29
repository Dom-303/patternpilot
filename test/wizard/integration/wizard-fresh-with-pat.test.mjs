import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { Readable } from "node:stream";

import { runWizard } from "../../../lib/wizard/index.mjs";

function setupTargetRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-target-"));
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    name: "test-project", type: "module", dependencies: {}
  }));
  fs.writeFileSync(path.join(dir, "README.md"), "# Test Project\n");
  return dir;
}

function writeReplayWithTarget(targetPath, scenarioPath) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-replay-"));
  const out = path.join(dir, "scenario.json");
  const raw = fs.readFileSync(scenarioPath, "utf8");
  const replaced = raw.replaceAll("TARGET_PATH_PLACEHOLDER", targetPath);
  fs.writeFileSync(out, replaced);
  return out;
}

describe("wizard integration — fresh + PAT", () => {
  test("end-to-end produces config + token file + history entry", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-root-"));
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-config-"));
    const target = setupTargetRepo();

    const replayPath = writeReplayWithTarget(
      target,
      new URL("../../fixtures/wizard/replays/fresh-with-pat.json", import.meta.url).pathname
    );

    const result = await runWizard(rootDir, {
      flags: { replay: replayPath },
      config: null,
      isInteractive: true,
      configDir,
      // empty stdin so the prompter does not block on close
      _stdin: Readable.from([])
    });

    assert.equal(result.discovery, "balanced");
    assert.equal(result.github.source, "pat");
    assert.equal(result.firstAction.action, "nothing");

    assert.ok(fs.existsSync(path.join(configDir, ".env")), "token .env must be written");
    const env = fs.readFileSync(path.join(configDir, ".env"), "utf8");
    assert.match(env, /GITHUB_TOKEN=ghp_replay_pat_token/);

    const historyPath = path.join(rootDir, "state", "wizard-history.json");
    assert.ok(fs.existsSync(historyPath), "history file must be written");
    const history = JSON.parse(fs.readFileSync(historyPath, "utf8"));
    assert.equal(history.runs.length, 1);
    assert.equal(history.runs[0].outcome, "completed");
    // 5 user-facing steps + 1 bootstrap-perform step recorded after step 2
    assert.equal(history.runs[0].steps.length, 6);
    assert.ok(history.runs[0].steps.some((s) => s.name === "bootstrap-perform"));
  });
});
