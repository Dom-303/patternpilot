import test from "node:test";
import assert from "node:assert/strict";
import { applyHardConstraints, applySoftBoost } from "../lib/discovery/problem-constraints.mjs";

test("applyHardConstraints rejects repo with incompatible license", () => {
  const repo = { id: "r", license: "GPL-3.0", keywords: new Set() };
  const kept = applyHardConstraints([repo], ["license:apache-compatible"]);
  assert.equal(kept.length, 0);
});

test("applyHardConstraints keeps repo with unknown license but marks it", () => {
  const repo = { id: "r", license: null, keywords: new Set() };
  const kept = applyHardConstraints([repo], ["license:apache-compatible"]);
  assert.equal(kept.length, 1);
  assert.equal(kept[0].constraint_warnings?.includes("license_unknown"), true);
});

test("applyHardConstraints keeps repo with compatible license", () => {
  const repo = { id: "r", license: "Apache-2.0", keywords: new Set() };
  const kept = applyHardConstraints([repo], ["license:apache-compatible"]);
  assert.equal(kept.length, 1);
});

test("applySoftBoost adds score bonus per matching tech_tag", () => {
  const repo = { id: "r", keywords: new Set(["nextjs", "react"]), score: 0.5 };
  const boosted = applySoftBoost(repo, ["nextjs", "tailwind"], 0.05);
  assert.ok(Math.abs(boosted.score - 0.55) < 0.001);
});

test("applySoftBoost leaves score unchanged when no match", () => {
  const repo = { id: "r", keywords: new Set(["vue"]), score: 0.5 };
  const boosted = applySoftBoost(repo, ["nextjs"], 0.05);
  assert.equal(boosted.score, 0.5);
});
