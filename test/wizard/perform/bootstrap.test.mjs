import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { performBootstrap } from "../../../lib/wizard/perform/bootstrap.mjs";

function makeTarget() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pb-target-"));
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(dir, "README.md"), "# Demo\n");
  return dir;
}

describe("performBootstrap", () => {
  test("creates patternpilot.config.local.json + bindings + projects", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pb-root-"));
    const target = makeTarget();
    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    const result = await performBootstrap(rootDir, config, {
      target,
      label: "Demo Project"
    });

    assert.equal(result.projectKey, "demo-project");
    assert.ok(fs.existsSync(path.join(rootDir, "patternpilot.config.local.json")));
    assert.ok(fs.existsSync(path.join(rootDir, "bindings/demo-project/PROJECT_BINDING.json")));
    assert.ok(fs.existsSync(path.join(rootDir, "projects/demo-project/PROJECT_CONTEXT.md")));
    assert.equal(config.projects["demo-project"]?.label, "Demo Project");
    assert.equal(config.defaultProject, "demo-project");
  });

  test("appends watchlist seed URLs (one per line)", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pb-root-"));
    const target = makeTarget();
    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    const result = await performBootstrap(rootDir, config, {
      target,
      label: "Demo Project",
      watchlistUrls: ["https://github.com/x/a", "https://github.com/y/b"]
    });

    const watchlist = fs.readFileSync(
      path.join(rootDir, "bindings", result.projectKey, "WATCHLIST.txt"),
      "utf8"
    );
    assert.match(watchlist, /https:\/\/github\.com\/x\/a/);
    assert.match(watchlist, /https:\/\/github\.com\/y\/b/);
  });

  test("returns projectKey + label so caller can dispatch downstream actions", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pb-root-"));
    const target = makeTarget();
    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    const result = await performBootstrap(rootDir, config, {
      target,
      label: "My Cool App"
    });

    assert.equal(result.projectKey, "my-cool-app");
    assert.equal(result.projectLabel, "My Cool App");
    assert.equal(result.targetPath, target);
  });
});
