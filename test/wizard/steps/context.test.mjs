import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runContextStep } from "../../../lib/wizard/steps/context.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runContextStep", () => {
  test("accept-path Y returns detected context unchanged", async () => {
    const { prompter } = pipedPrompter(["Y"]);
    const state = createWizardState();
    const detected = {
      label: "Foo", language: "Node.js (ESM)",
      domainHint: "events", contextFiles: ["README.md"],
      repoDir: "/abs"
    };
    const seed = { status: "ok", urls: ["https://github.com/x/y"] };
    const result = await runContextStep({
      prompter, state,
      detectFn: () => detected,
      seedFn: async () => seed
    });
    assert.deepEqual(result.context, detected);
    assert.deepEqual(result.watchlistSeed, seed);
    prompter.close();
  });

  test("offline seed shows '(übersprungen — kein Netz)' marker", async () => {
    const { prompter, captured } = pipedPrompter(["Y"]);
    const state = createWizardState();
    await runContextStep({
      prompter, state,
      detectFn: () => ({ label: "Foo", language: "x", domainHint: "", contextFiles: [], repoDir: "/abs" }),
      seedFn: async () => ({ status: "offline", urls: [] })
    });
    assert.match(captured(), /übersprungen.*kein Netz/);
    prompter.close();
  });

  test("E path lets user override label", async () => {
    const { prompter } = pipedPrompter(["E", "L", "New Label", "X"]);
    const state = createWizardState();
    const result = await runContextStep({
      prompter, state,
      detectFn: () => ({ label: "Old", language: "x", domainHint: "", contextFiles: [], repoDir: "/abs" }),
      seedFn: async () => ({ status: "ok", urls: [] })
    });
    assert.equal(result.context.label, "New Label");
    prompter.close();
  });
});
