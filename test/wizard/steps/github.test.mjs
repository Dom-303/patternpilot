import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runGithubStep } from "../../../lib/wizard/steps/github.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runGithubStep", () => {
  test("skips dialog when pre-flight returns gh-cli", async () => {
    const { prompter } = pipedPrompter([""]);
    const state = createWizardState();
    const result = await runGithubStep({
      prompter, state,
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-gh-")),
      detectFn: async () => ({ source: "gh-cli", token: "ghp_x", user: "@u" })
    });
    assert.equal(result.source, "gh-cli");
    assert.equal(result.token, "ghp_x");
    prompter.close();
  });

  test("S path writes nothing and reports skip", async () => {
    const { prompter } = pipedPrompter(["S"]);
    const state = createWizardState();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-gh-"));
    const result = await runGithubStep({
      prompter, state,
      configDir: dir,
      detectFn: async () => ({ source: "none", token: null, user: null })
    });
    assert.equal(result.source, "skipped");
    assert.equal(fs.existsSync(path.join(dir, ".env")), false);
    prompter.close();
  });

  test("M (manual override) lets user enter token even when pre-flight succeeds", async () => {
    const { prompter } = pipedPrompter(["M", "P", "ghp_manualtoken"]);
    const state = createWizardState();
    const result = await runGithubStep({
      prompter, state,
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-gh-")),
      detectFn: async () => ({ source: "gh-cli", token: "ghp_x", user: "@u" }),
      validateToken: async (t) => ({ ok: true, user: "@manual", scopes: ["public_repo"] })
    });
    assert.equal(result.token, "ghp_manualtoken");
    prompter.close();
  });
});
