import { test } from "node:test";
import assert from "node:assert/strict";

import {
  EVALUATION_VERSION,
  bandFromScore,
  classifyLicense,
  computeRulesFingerprint
} from "../lib/classification/evaluation.mjs";
import { upsertQueueEntry } from "../lib/queue.mjs";

test("smoke: core engine exports are wired", () => {
  assert.equal(typeof upsertQueueEntry, "function");
  assert.equal(typeof bandFromScore, "function");
  assert.equal(typeof classifyLicense, "function");
  assert.equal(typeof computeRulesFingerprint, "function");
  assert.equal(Number.isInteger(EVALUATION_VERSION), true);
});
