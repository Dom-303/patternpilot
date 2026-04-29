import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runWizard } from "../../../lib/wizard/index.mjs";

function makeTarget() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-target-"));
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(dir, "README.md"), "# Real Demo\n");
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    name: "real-demo", type: "module"
  }));
  return dir;
}

describe("wizard creates real, usable project setup", () => {
  test("after wizard run, config + bindings + projects all exist", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-root-"));
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-cfg-"));
    const target = makeTarget();

    const replayDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-replay-"));
    const replayPath = path.join(replayDir, "s.json");
    fs.writeFileSync(replayPath, JSON.stringify({
      target,
      context: "accept",
      github: { path: "S" },
      discovery: "balanced",
      first_action: "nothing"
    }));

    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    const result = await runWizard(rootDir, {
      flags: { replay: replayPath },
      config,
      isInteractive: true,
      configDir
    });

    const projectKey = result.bootstrap.projectKey;

    assert.ok(fs.existsSync(path.join(rootDir, "patternpilot.config.local.json")), "config must be written");
    assert.ok(fs.existsSync(path.join(rootDir, "bindings", projectKey, "PROJECT_BINDING.json")), "binding json");
    assert.ok(fs.existsSync(path.join(rootDir, "bindings", projectKey, "PROJECT_BINDING.md")), "binding md");
    assert.ok(fs.existsSync(path.join(rootDir, "bindings", projectKey, "WATCHLIST.txt")), "watchlist");
    assert.ok(fs.existsSync(path.join(rootDir, "projects", projectKey, "PROJECT_CONTEXT.md")), "project context");

    assert.ok(config.projects[projectKey], "project must be in config object");
    assert.equal(config.defaultProject, projectKey, "must become default");

    assert.equal(fs.existsSync(path.join(configDir, ".env")), false);
  });

  test("when first_action=intake, runIntake is dispatched with the URL", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-intake-"));
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-intake-cfg-"));
    const target = makeTarget();

    const replayDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-intake-replay-"));
    const replayPath = path.join(replayDir, "s.json");
    fs.writeFileSync(replayPath, JSON.stringify({
      target,
      context: "accept",
      github: { path: "S" },
      discovery: "balanced",
      first_action: "intake",
      first_action_url: "https://github.com/octocat/Hello-World"
    }));

    let intakeCalled = null;
    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    await runWizard(rootDir, {
      flags: { replay: replayPath },
      config,
      isInteractive: true,
      configDir,
      runIntake: (rootDir, config, options) => { intakeCalled = options; },
      runDiscover: () => {},
      runProblemCreate: () => {},
      runProblemExplore: () => {}
    });

    assert.ok(intakeCalled, "runIntake must be dispatched");
    assert.deepEqual(intakeCalled.urls, ["https://github.com/octocat/Hello-World"]);
  });
});
