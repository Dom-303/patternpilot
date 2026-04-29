import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runWizard } from "../../../lib/wizard/index.mjs";

describe("wizard integration — fresh + skip github", () => {
  test("produces history without writing token file", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-skip-"));
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-skip-cfg-"));
    const target = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-skip-target-"));
    fs.mkdirSync(path.join(target, ".git"), { recursive: true });
    fs.writeFileSync(path.join(target, "README.md"), "# T\n");

    const replayDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-int-skip-replay-"));
    const replayPath = path.join(replayDir, "s.json");
    fs.writeFileSync(replayPath, JSON.stringify({
      target,
      context: "accept",
      github: { path: "S" },
      discovery: "balanced",
      first_action: "nothing"
    }));

    const result = await runWizard(rootDir, {
      flags: { replay: replayPath },
      config: null,
      isInteractive: true,
      configDir
    });

    assert.equal(result.github.source, "skipped");
    assert.equal(fs.existsSync(path.join(configDir, ".env")), false);

    const history = JSON.parse(fs.readFileSync(path.join(rootDir, "state", "wizard-history.json"), "utf8"));
    assert.equal(history.runs[0].outcome, "completed");
  });
});
