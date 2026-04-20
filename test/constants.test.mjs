import test from "node:test";
import assert from "node:assert/strict";

import { resolveDiscoveryProfile } from "../lib/constants.mjs";

test("resolveDiscoveryProfile accepts public alias names and keeps public ids stable", () => {
  const quick = resolveDiscoveryProfile("quick");
  const standard = resolveDiscoveryProfile("standard");
  const deep = resolveDiscoveryProfile("deep", 999);

  assert.equal(quick.id, "focused");
  assert.equal(quick.publicId, "quick");
  assert.equal(quick.label, "Quick");

  assert.equal(standard.id, "balanced");
  assert.equal(standard.publicId, "standard");
  assert.equal(standard.label, "Standard");

  assert.equal(deep.id, "expansive");
  assert.equal(deep.publicId, "deep");
  assert.equal(deep.label, "Deep");
  assert.equal(deep.limit, deep.maxLimit);
});
