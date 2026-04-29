import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { performRerunDispatch } from "../../../lib/wizard/perform/rerun-dispatch.mjs";

describe("performRerunDispatch", () => {
  test("set-default updates config.defaultProject and persists", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-rd-"));
    const config = { projects: { "a": {}, "b": {} }, defaultProject: "a" };

    const result = await performRerunDispatch({
      intent: { intent: "set-default", project: "b" },
      rootDir, config
    });

    assert.equal(result.handled, true);
    assert.equal(config.defaultProject, "b");
    assert.ok(fs.existsSync(path.join(rootDir, "patternpilot.config.local.json")));
  });

  test("cancel returns handled=true with action=cancel", async () => {
    const result = await performRerunDispatch({
      intent: { intent: "cancel" },
      rootDir: "/tmp", config: {}
    });
    assert.equal(result.handled, true);
    assert.equal(result.action, "cancel");
  });

  test("add-project signals caller to run new wizard pass", async () => {
    const result = await performRerunDispatch({
      intent: { intent: "add-project" },
      rootDir: "/tmp", config: { projects: {} }
    });
    assert.equal(result.handled, false);
    assert.equal(result.continueAs, "fresh-setup");
  });

  test("reauth signals caller to re-run github step only", async () => {
    const result = await performRerunDispatch({
      intent: { intent: "reauth" },
      rootDir: "/tmp", config: {}
    });
    assert.equal(result.handled, false);
    assert.equal(result.continueAs, "github-only");
  });
});
