import test from "node:test";
import assert from "node:assert/strict";
import { markRelation } from "../lib/clustering/anti-tunnel.mjs";

test("markRelation returns near_current_approach when >=66% of signature tokens present", () => {
  const cluster = { members: [{ keywords: new Set(["a", "b", "c"]) }, { keywords: new Set(["a", "d"]) }] };
  const signature = ["a", "b", "x"];
  assert.equal(markRelation(cluster, signature), "near_current_approach");
});

test("markRelation returns adjacent with one overlap only", () => {
  const cluster = { members: [{ keywords: new Set(["a", "x"]) }] };
  const signature = ["a", "b", "c"];
  assert.equal(markRelation(cluster, signature), "adjacent");
});

test("markRelation returns divergent with zero overlap", () => {
  const cluster = { members: [{ keywords: new Set(["z"]) }] };
  const signature = ["a", "b", "c"];
  assert.equal(markRelation(cluster, signature), "divergent");
});

test("markRelation returns divergent for empty signature", () => {
  const cluster = { members: [{ keywords: new Set(["z"]) }] };
  assert.equal(markRelation(cluster, []), "divergent");
});
