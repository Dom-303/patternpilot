import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { detectGithubAuth } from "../../../lib/wizard/detect/github-auth.mjs";

describe("detectGithubAuth", () => {
  test("returns gh-cli source when gh subprocess succeeds", async () => {
    const result = await detectGithubAuth({
      env: {},
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-auth-")),
      ghProbe: async () => ({ ok: true, user: "@dom-303", token: "ghp_fake" })
    });
    assert.equal(result.source, "gh-cli");
    assert.equal(result.user, "@dom-303");
    assert.equal(result.token, "ghp_fake");
  });

  test("returns env source when GITHUB_TOKEN is set and gh fails", async () => {
    const result = await detectGithubAuth({
      env: { GITHUB_TOKEN: "ghp_envtoken" },
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-auth-")),
      ghProbe: async () => ({ ok: false })
    });
    assert.equal(result.source, "env");
    assert.equal(result.token, "ghp_envtoken");
  });

  test("returns dotenv source when ~/.config/patternpilot/.env exists", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-auth-"));
    fs.writeFileSync(path.join(dir, ".env"), "GITHUB_TOKEN=ghp_fromfile\n");

    const result = await detectGithubAuth({
      env: {},
      configDir: dir,
      ghProbe: async () => ({ ok: false })
    });
    assert.equal(result.source, "dotenv");
    assert.equal(result.token, "ghp_fromfile");
  });

  test("returns none when nothing found", async () => {
    const result = await detectGithubAuth({
      env: {},
      configDir: fs.mkdtempSync(path.join(os.tmpdir(), "pp-auth-")),
      ghProbe: async () => ({ ok: false })
    });
    assert.equal(result.source, "none");
    assert.equal(result.token, null);
  });
});
