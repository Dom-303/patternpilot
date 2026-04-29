import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { detectWatchlistSeed } from "../../../lib/wizard/detect/npm-watchlist-seed.mjs";

function makeRepo({ deps = {}, devDeps = {} }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-seed-"));
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    dependencies: deps, devDependencies: devDeps
  }));
  return dir;
}

describe("detectWatchlistSeed", () => {
  test("returns github URLs from npm registry lookup", async () => {
    const dir = makeRepo({ deps: { "puppeteer": "^1", "cheerio": "^1" } });
    const result = await detectWatchlistSeed(dir, {
      cacheDir: path.join(dir, ".cache"),
      fetchPkg: async (name) => ({
        repository: { url: `git+https://github.com/example/${name}.git` }
      })
    });
    assert.equal(result.status, "ok");
    assert.equal(result.urls.length, 2);
    assert.ok(result.urls.includes("https://github.com/example/puppeteer"));
  });

  test("status=offline when fetcher rejects", async () => {
    const dir = makeRepo({ deps: { "puppeteer": "^1" } });
    const result = await detectWatchlistSeed(dir, {
      cacheDir: path.join(dir, ".cache"),
      fetchPkg: async () => { throw new Error("ECONNREFUSED"); }
    });
    assert.equal(result.status, "offline");
    assert.deepEqual(result.urls, []);
  });

  test("uses cache on second call when offline", async () => {
    const dir = makeRepo({ deps: { "puppeteer": "^1" } });
    const cacheDir = path.join(dir, ".cache");
    let callCount = 0;
    const fetcher = async (name) => {
      callCount++;
      return { repository: { url: `https://github.com/example/${name}` } };
    };

    await detectWatchlistSeed(dir, { cacheDir, fetchPkg: fetcher });
    assert.equal(callCount, 1);

    const second = await detectWatchlistSeed(dir, {
      cacheDir,
      fetchPkg: async () => { throw new Error("offline"); }
    });
    assert.equal(second.status, "ok");
    assert.equal(second.urls.length, 1);
  });

  test("filters out non-github registry entries", async () => {
    const dir = makeRepo({ deps: { "internal": "^1" } });
    const result = await detectWatchlistSeed(dir, {
      cacheDir: path.join(dir, ".cache"),
      fetchPkg: async () => ({ repository: { url: "https://gitlab.com/x/y" } })
    });
    assert.deepEqual(result.urls, []);
  });

  test("returns empty when no package.json", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-seed-no-"));
    const result = await detectWatchlistSeed(dir);
    assert.equal(result.status, "ok");
    assert.deepEqual(result.urls, []);
  });
});
