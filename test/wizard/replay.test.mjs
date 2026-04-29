import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { loadReplay } from "../../lib/wizard/replay.mjs";

function writeFixture(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-wizard-replay-"));
  const file = path.join(dir, "scenario.json");
  fs.writeFileSync(file, JSON.stringify(content), "utf8");
  return file;
}

describe("replay", () => {
  test("get returns the value for a known step", () => {
    const file = writeFixture({ target: "../foo", discovery: "balanced" });
    const r = loadReplay(file);
    assert.equal(r.get("target"), "../foo");
    assert.equal(r.get("discovery"), "balanced");
  });

  test("get throws with exit-3 reason when step is missing", () => {
    const file = writeFixture({ target: "../foo" });
    const r = loadReplay(file);
    assert.throws(
      () => r.get("github"),
      /Replay unvollständig: kein Wert für Step github/
    );
  });

  test("get supports nested objects via dot path", () => {
    const file = writeFixture({ github: { path: "G", gh_already_authed: true } });
    const r = loadReplay(file);
    assert.equal(r.get("github.path"), "G");
    assert.equal(r.get("github.gh_already_authed"), true);
  });
});
