import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runTargetStep } from "../../../lib/wizard/steps/target.mjs";
import { createPrompter } from "../../../lib/wizard/prompt.mjs";
import { createWizardState } from "../../../lib/wizard/state.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runTargetStep", () => {
  test("uses replay value when provided", async () => {
    const { prompter } = pipedPrompter([]);
    const state = createWizardState();
    const result = await runTargetStep({
      prompter,
      state,
      replay: { get: () => "/abs/path" },
      scanFn: async () => [{ path: "/x", mtimeMs: 0 }]
    });
    assert.equal(result.path, "/abs/path");
    prompter.close();
  });

  test("offers scanned candidates and accepts selection by number", async () => {
    const { prompter } = pipedPrompter(["1"]);
    const state = createWizardState();
    const result = await runTargetStep({
      prompter,
      state,
      scanFn: async () => [
        { path: "/p/a", mtimeMs: Date.now() },
        { path: "/p/b", mtimeMs: Date.now() - 86400000 }
      ]
    });
    assert.equal(result.path, "/p/a");
    prompter.close();
  });

  test("only shows manual-input option when scan returns 0 hits", async () => {
    const { prompter, captured } = pipedPrompter(["/some/abs/path"]);
    const state = createWizardState();
    await runTargetStep({
      prompter, state,
      scanFn: async () => [],
      pathExists: () => true
    });
    assert.match(captured(), /Anderen Pfad/);
    prompter.close();
  });

  test("re-asks on non-existing manual path", async () => {
    const { prompter } = pipedPrompter(["M", "/does/not/exist", "/exists"]);
    const state = createWizardState();
    const result = await runTargetStep({
      prompter, state,
      scanFn: async () => [{ path: "/p/a", mtimeMs: 0 }],
      pathExists: (p) => p === "/exists"
    });
    assert.equal(result.path, "/exists");
    prompter.close();
  });
});
