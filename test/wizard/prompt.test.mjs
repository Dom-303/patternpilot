import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";

import { createPrompter } from "../../lib/wizard/prompt.mjs";

function pipedStreams(inputLines) {
  const input = Readable.from(inputLines.map((l) => l + "\n"));
  const chunks = [];
  const output = new Writable({
    write(chunk, _enc, cb) { chunks.push(chunk.toString()); cb(); }
  });
  return { input, output, captured: () => chunks.join("") };
}

describe("prompter", () => {
  test("ask returns the typed line, trimmed", async () => {
    const { input, output } = pipedStreams(["  hello world  "]);
    const p = createPrompter({ input, output });
    const answer = await p.ask("Frage:");
    assert.equal(answer, "hello world");
    p.close();
  });

  test("choose returns the chosen key when valid", async () => {
    const { input, output } = pipedStreams(["B"]);
    const p = createPrompter({ input, output });
    const choice = await p.choose("Was?", [
      { key: "A", label: "Apfel" },
      { key: "B", label: "Birne" }
    ]);
    assert.equal(choice, "B");
    p.close();
  });

  test("choose accepts default on empty input", async () => {
    const { input, output } = pipedStreams([""]);
    const p = createPrompter({ input, output });
    const choice = await p.choose("Was?", [
      { key: "A", label: "Apfel", default: true },
      { key: "B", label: "Birne" }
    ]);
    assert.equal(choice, "A");
    p.close();
  });

  test("choose re-asks on invalid input", async () => {
    const { input, output, captured } = pipedStreams(["X", "A"]);
    const p = createPrompter({ input, output });
    const choice = await p.choose("Was?", [{ key: "A", label: "Apfel" }]);
    assert.equal(choice, "A");
    assert.match(captured(), /Bitte/);
    p.close();
  });

  test("confirm yes-default", async () => {
    const { input, output } = pipedStreams([""]);
    const p = createPrompter({ input, output });
    assert.equal(await p.confirm("Ok?", { default: true }), true);
    p.close();
  });
});
