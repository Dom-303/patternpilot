import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runDiscoveryStep } from "../../../lib/wizard/steps/discovery.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runDiscoveryStep", () => {
  test("returns balanced when user accepts default", async () => {
    const { prompter } = pipedPrompter([""]);
    const state = createWizardState();
    const r = await runDiscoveryStep({ prompter, state, githubAvailable: true });
    assert.equal(r.profile, "balanced");
    prompter.close();
  });

  test("returns focused when chosen", async () => {
    const { prompter } = pipedPrompter(["focused"]);
    const state = createWizardState();
    const r = await runDiscoveryStep({ prompter, state, githubAvailable: true });
    assert.equal(r.profile, "focused");
    prompter.close();
  });

  test("when githubAvailable is false: shows note and stores balanced as default", async () => {
    const { prompter, captured } = pipedPrompter([]);
    const state = createWizardState();
    const r = await runDiscoveryStep({ prompter, state, githubAvailable: false });
    assert.equal(r.profile, "balanced");
    assert.match(captured(), /Discovery braucht einen GitHub-Token/);
    prompter.close();
  });
});
