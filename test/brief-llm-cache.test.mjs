// test/brief-llm-cache.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { clusterFingerprint, readLlmCache, writeLlmCache, getCached, setCached } from "../lib/brief/llm-cache.mjs";

async function tmpRoot() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "llm-cache-"));
}

test("clusterFingerprint is stable for identical member sets regardless of order", () => {
  const a = clusterFingerprint({ members: [{ id: "r1" }, { id: "r2" }] });
  const b = clusterFingerprint({ members: [{ id: "r2" }, { id: "r1" }] });
  assert.equal(a, b);
});

test("clusterFingerprint differs for different member sets", () => {
  const a = clusterFingerprint({ members: [{ id: "r1" }] });
  const b = clusterFingerprint({ members: [{ id: "r2" }] });
  assert.notEqual(a, b);
});

test("readLlmCache returns empty object when file missing", async () => {
  const dir = await tmpRoot();
  const cache = await readLlmCache(dir);
  assert.deepEqual(cache, {});
});

test("writeLlmCache + readLlmCache round-trip", async () => {
  const dir = await tmpRoot();
  await writeLlmCache(dir, { "c1|fp": { narrative: "x" } });
  const cache = await readLlmCache(dir);
  assert.deepEqual(cache, { "c1|fp": { narrative: "x" } });
});

test("getCached/setCached keys by cluster id + fingerprint", async () => {
  const dir = await tmpRoot();
  await setCached(dir, "c1", "fp", { narrative: "n" });
  assert.deepEqual(await getCached(dir, "c1", "fp"), { narrative: "n" });
  assert.equal(await getCached(dir, "c1", "other"), null);
});
