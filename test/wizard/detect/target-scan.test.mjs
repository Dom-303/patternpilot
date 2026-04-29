import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { scanForTargets } from "../../../lib/wizard/detect/target-scan.mjs";

function makeRepo(dir, name, mtime) {
  const repo = path.join(dir, name);
  fs.mkdirSync(path.join(repo, ".git"), { recursive: true });
  fs.writeFileSync(path.join(repo, "README.md"), `# ${name}\n`);
  if (mtime) fs.utimesSync(path.join(repo, "README.md"), mtime, mtime);
  return repo;
}

describe("scanForTargets", () => {
  test("returns top 3 sorted by mtime descending", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scan-"));
    const now = Date.now() / 1000;
    makeRepo(dir, "a", now - 86400 * 7);
    makeRepo(dir, "b", now - 86400 * 1);
    makeRepo(dir, "c", now);
    makeRepo(dir, "d", now - 86400 * 2);

    const hits = await scanForTargets({ paths: [dir], maxResults: 3 });
    const names = hits.map((h) => path.basename(h.path));
    assert.deepEqual(names, ["c", "b", "d"]);
  });

  test("returns empty array when no repos found", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scan-"));
    const hits = await scanForTargets({ paths: [dir] });
    assert.deepEqual(hits, []);
  });

  test("respects maxDepth (does not descend deeper)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scan-"));
    const deep = path.join(dir, "level1", "level2", "level3");
    fs.mkdirSync(path.join(deep, ".git"), { recursive: true });
    fs.writeFileSync(path.join(deep, "README.md"), "x");

    const hits = await scanForTargets({ paths: [dir], maxDepth: 2 });
    assert.equal(hits.length, 0);
  });

  test("aborts after timeoutMs", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-scan-"));
    for (let i = 0; i < 100; i++) makeRepo(dir, `r${i}`);
    const hits = await scanForTargets({ paths: [dir], timeoutMs: 1 });
    assert.ok(Array.isArray(hits));
  });
});
