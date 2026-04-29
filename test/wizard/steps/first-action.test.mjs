import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runFirstActionStep } from "../../../lib/wizard/steps/first-action.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runFirstActionStep", () => {
  test("nothing is the default and returns action=nothing", async () => {
    const { prompter } = pipedPrompter([""]);
    const state = createWizardState();
    const r = await runFirstActionStep({ prompter, state, githubAvailable: true });
    assert.equal(r.action, "nothing");
    prompter.close();
  });

  test("intake action prompts for url", async () => {
    const { prompter } = pipedPrompter(["intake", "https://github.com/foo/bar"]);
    const state = createWizardState();
    const r = await runFirstActionStep({ prompter, state, githubAvailable: true });
    assert.equal(r.action, "intake");
    assert.equal(r.url, "https://github.com/foo/bar");
    prompter.close();
  });

  test("problem action prompts for question", async () => {
    const { prompter } = pipedPrompter(["problem", "Wie lösen andere PDF-Extraktion?"]);
    const state = createWizardState();
    const r = await runFirstActionStep({ prompter, state, githubAvailable: true });
    assert.equal(r.action, "problem");
    assert.equal(r.question, "Wie lösen andere PDF-Extraktion?");
    prompter.close();
  });

  test("intake skipped when githubAvailable=false (downgrades to nothing)", async () => {
    const { prompter, captured } = pipedPrompter(["intake"]);
    const state = createWizardState();
    const r = await runFirstActionStep({ prompter, state, githubAvailable: false });
    assert.equal(r.action, "nothing");
    assert.match(captured(), /braucht einen GitHub-Token/);
    prompter.close();
  });
});
