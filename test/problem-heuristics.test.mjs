import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  expandTechAliases,
  normalizeSearchTerms,
  lintGenericPhrases,
  lintSingleWords,
  lintLongPhrases,
  lintDuplicates,
  applyHeuristics
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

describe("lintGenericPhrases", () => {
  test("flags known generic phrases", () => {
    const warnings = lintGenericPhrases(["web scraper", "self-healing scraper"]);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("web scraper"));
    assert.ok(warnings[0].toLowerCase().includes("generic"));
  });

  test("case-insensitive match", () => {
    const warnings = lintGenericPhrases(["WEB SCRAPER"]);
    assert.equal(warnings.length, 1);
  });

  test("returns empty for clean input", () => {
    assert.deepEqual(lintGenericPhrases(["schema inference crawler"]), []);
  });

  test("handles missing input", () => {
    assert.deepEqual(lintGenericPhrases(undefined), []);
  });
});

describe("lintSingleWords", () => {
  test("flags single-word phrases", () => {
    const warnings = lintSingleWords(["scraper", "self-healing scraper"]);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes("scraper"));
    assert.ok(warnings[0].toLowerCase().includes("single word"));
  });

  test("handles extra whitespace", () => {
    assert.equal(lintSingleWords(["  scraper  "]).length, 1);
  });

  test("does not flag multi-word", () => {
    assert.deepEqual(lintSingleWords(["self-healing scraper"]), []);
  });
});

describe("lintLongPhrases", () => {
  test("flags phrases with more than 5 whitespace-separated tokens", () => {
    const warnings = lintLongPhrases(["one two three four five six"]);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].match(/\d+\s*words/));
  });

  test("does not flag exactly 5 words (boundary)", () => {
    assert.deepEqual(lintLongPhrases(["one two three four five"]), []);
  });

  test("does not flag short phrases", () => {
    assert.deepEqual(lintLongPhrases(["two words", "three word phrase"]), []);
  });
});

describe("lintDuplicates", () => {
  test("flags case-insensitive duplicates", () => {
    const warnings = lintDuplicates(["foo", "FOO"]);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].toLowerCase().includes("duplicate"));
  });

  test("returns empty for unique list", () => {
    assert.deepEqual(lintDuplicates(["foo", "bar"]), []);
  });

  test("handles whitespace-only-difference duplicates", () => {
    const warnings = lintDuplicates(["foo", "  foo  "]);
    assert.equal(warnings.length, 1);
  });
});

describe("applyHeuristics", () => {
  test("expands tech_tags and normalizes search_terms", () => {
    const { derived, warnings } = applyHeuristics({
      query_seeds: ["foo", "FOO", "  bar  "],
      tech_tags: ["nodejs"],
      constraint_tags: ["opensource"],
      approach_signature: ["self-healing"]
    });

    assert.deepEqual(derived.query_seeds, ["foo", "bar"]);
    assert.ok(derived.tech_tags.includes("nodejs"));
    assert.ok(derived.tech_tags.some((t) => t.toLowerCase() === "node"));
    assert.ok(derived.tech_tags.some((t) => t.toLowerCase() === "node.js"));
    assert.deepEqual(derived.constraint_tags, ["opensource"]);
    assert.deepEqual(derived.approach_signature, ["self-healing"]);

    assert.ok(warnings.some((w) => w.toLowerCase().includes("duplicate")));
  });

  test("handles missing fields gracefully", () => {
    const { derived, warnings } = applyHeuristics({});
    assert.deepEqual(derived.query_seeds, []);
    assert.deepEqual(derived.tech_tags, []);
    assert.deepEqual(derived.constraint_tags, []);
    assert.deepEqual(derived.approach_signature, []);
    assert.deepEqual(warnings, []);
  });

  test("emits all four lint categories when applicable", () => {
    const { warnings } = applyHeuristics({
      query_seeds: [
        "web scraper",
        "scraper",
        "one two three four five six",
        "foo",
        "FOO"
      ]
    });
    assert.ok(warnings.some((w) => w.toLowerCase().includes("generic")));
    assert.ok(warnings.some((w) => w.toLowerCase().includes("single word")));
    assert.ok(warnings.some((w) => w.match(/\d+\s*words/)));
    assert.ok(warnings.some((w) => w.toLowerCase().includes("duplicate")));
  });

  test("accepts undefined input without throwing", () => {
    const { derived, warnings } = applyHeuristics();
    assert.deepEqual(derived.query_seeds, []);
    assert.deepEqual(warnings, []);
  });
});
