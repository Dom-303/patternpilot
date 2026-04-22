import test from "node:test";
import assert from "node:assert/strict";
import { buildSlug, validateSlug } from "../lib/problem/slug.mjs";

test("buildSlug lowercases and replaces spaces with dashes", () => {
  assert.equal(buildSlug("Slow Event Lists"), "slow-event-lists");
});

test("buildSlug strips punctuation and umlauts", () => {
  assert.equal(buildSlug("Lange Eventlisten für Ö-Städte!"), "lange-eventlisten-fur-o-stadte");
});

test("buildSlug collapses repeated dashes", () => {
  assert.equal(buildSlug("A  --  B"), "a-b");
});

test("buildSlug trims leading and trailing dashes", () => {
  assert.equal(buildSlug("---x---"), "x");
});

test("validateSlug rejects uppercase and invalid chars", () => {
  assert.equal(validateSlug("slow-lists"), true);
  assert.equal(validateSlug("Slow-Lists"), false);
  assert.equal(validateSlug("slow_lists"), false);
  assert.equal(validateSlug(""), false);
  assert.equal(validateSlug("slow--lists"), false);
});
