import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

describe("print-mode regression", () => {
  test("`init --print` output matches baseline getting-started snapshot (deterministic prefix only)", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const repoRoot = path.resolve(here, "..", "..", "..");
    const result = spawnSync(
      "node",
      [path.join(repoRoot, "scripts", "patternpilot.mjs"), "init", "--print"],
      { input: "", encoding: "utf8" }
    );

    const expected = fs.readFileSync(
      path.join(repoRoot, "test", "fixtures", "wizard", "snapshots", "getting-started-print.txt"),
      "utf8"
    );

    // The "## Aktueller Zustand" section depends on the local config state
    // (number of configured projects) and would diverge between dev machines and CI.
    // Snapshot covers only the deterministic prefix up to that section.
    const trim = (text) => text.split("## Aktueller Zustand")[0];

    assert.equal(result.status, 0);
    assert.equal(trim(result.stdout), trim(expected));
  });
});
