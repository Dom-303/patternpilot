import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { runRerunMenu } from "../../lib/wizard/rerun-menu.mjs";
import { createPrompter } from "../../lib/wizard/prompt.mjs";

function pipedPrompter(lines) {
  const input = Readable.from(lines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({ write(c, _e, cb) { chunks.push(c.toString()); cb(); } });
  return { prompter: createPrompter({ input, output }), captured: () => chunks.join("") };
}

describe("runRerunMenu", () => {
  const config = {
    defaultProject: "eventbear-worker",
    projects: { "eventbear-worker": {}, "pinflow": {} }
  };

  test("A returns add-project intent", async () => {
    const { prompter } = pipedPrompter(["A"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "add-project");
    prompter.close();
  });

  test("E with project pick returns edit intent with project key", async () => {
    const { prompter } = pipedPrompter(["E", "2"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "edit-project");
    assert.equal(r.project, "pinflow");
    prompter.close();
  });

  test("T returns reauth intent", async () => {
    const { prompter } = pipedPrompter(["T"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "reauth");
    prompter.close();
  });

  test("D with project pick returns set-default intent", async () => {
    const { prompter } = pipedPrompter(["D", "1"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "set-default");
    assert.equal(r.project, "eventbear-worker");
    prompter.close();
  });

  test("Z returns cancel intent", async () => {
    const { prompter } = pipedPrompter(["Z"]);
    const r = await runRerunMenu({ prompter, config });
    assert.equal(r.intent, "cancel");
    prompter.close();
  });

  test("lists all projects with default marker", async () => {
    const { prompter, captured } = pipedPrompter(["Z"]);
    await runRerunMenu({ prompter, config });
    assert.match(captured(), /eventbear-worker.*Default/);
    assert.match(captured(), /pinflow/);
    prompter.close();
  });
});
