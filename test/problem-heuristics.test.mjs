import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  expandTechAliases,
  normalizeSearchTerms
} from "../lib/problem/heuristics.mjs";

describe("expandTechAliases", () => {
  test("expands nodejs to include node and node.js", () => {
    const result = expandTechAliases(["nodejs"]);
    assert.ok(result.includes("nodejs"));
    assert.ok(result.includes("node"));
    assert.ok(result.includes("node.js"));
  });

  test("case-insensitive lookup; keeps user's original casing", () => {
    const result = expandTechAliases(["NodeJS"]);
    assert.ok(result.includes("NodeJS"));
    assert.ok(result.some((t) => t.toLowerCase() === "node"));
    assert.ok(result.some((t) => t.toLowerCase() === "node.js"));
  });

  test("passes through unknown tags unchanged; no duplicates", () => {
    const result = expandTechAliases(["docker", "nodejs"]);
    assert.equal(result.filter((t) => t === "docker").length, 1);
  });

  test("case-insensitive dedup", () => {
    const result = expandTechAliases(["nodejs", "NODE"]);
    const lower = result.map((t) => t.toLowerCase());
    assert.equal(new Set(lower).size, result.length);
  });

  test("handles empty and missing input", () => {
    assert.deepEqual(expandTechAliases([]), []);
    assert.deepEqual(expandTechAliases(undefined), []);
    assert.deepEqual(expandTechAliases(null), []);
  });
});

describe("normalizeSearchTerms", () => {
  test("trims whitespace", () => {
    assert.deepEqual(normalizeSearchTerms(["  foo  "]), ["foo"]);
  });

  test("drops empty / whitespace-only entries", () => {
    assert.deepEqual(normalizeSearchTerms(["foo", "", "   "]), ["foo"]);
  });

  test("case-insensitive dedup preserves first occurrence casing", () => {
    const result = normalizeSearchTerms(["Self-Healing", "self-healing"]);
    assert.deepEqual(result, ["Self-Healing"]);
  });

  test("keeps order of first occurrences", () => {
    const result = normalizeSearchTerms(["beta", "alpha", "BETA"]);
    assert.deepEqual(result, ["beta", "alpha"]);
  });

  test("handles missing input", () => {
    assert.deepEqual(normalizeSearchTerms(undefined), []);
  });
});
