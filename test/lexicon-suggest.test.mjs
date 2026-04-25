import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  tokenizeForSuggestion,
  collectUnknownMemberSignals,
  aggregateTokenFrequency,
  buildSuggestions,
} from "../lib/scoring/lexicon-suggest.mjs";

describe("tokenizeForSuggestion", () => {
  test("strips short tokens (< 4 chars)", () => {
    const tokens = tokenizeForSuggestion("a be cat dogs elephant");
    assert.deepEqual(tokens, ["dogs", "elephant"]);
  });

  test("strips stop tokens (the, and, library, etc.)", () => {
    const tokens = tokenizeForSuggestion("the library and framework for nodejs");
    assert.deepEqual(tokens, []);
  });

  test("lowercases + splits on punctuation", () => {
    const tokens = tokenizeForSuggestion("Wrapper-Induction (System) v2.0");
    assert.ok(tokens.includes("wrapper"));
    assert.ok(tokens.includes("induction"));
    assert.ok(tokens.includes("system"));
  });

  test("returns empty array on non-string", () => {
    assert.deepEqual(tokenizeForSuggestion(null), []);
    assert.deepEqual(tokenizeForSuggestion(undefined), []);
    assert.deepEqual(tokenizeForSuggestion(123), []);
  });
});

describe("collectUnknownMemberSignals", () => {
  test("returns empty for empty landscape", () => {
    assert.deepEqual(collectUnknownMemberSignals({}), []);
    assert.deepEqual(collectUnknownMemberSignals(null), []);
  });

  test("identifies member from unknown-cluster as unknown signal", () => {
    const landscape = {
      clusters: [
        { pattern_family: "unknown", member_ids: ["repo-a"] },
        { pattern_family: "scraper", member_ids: ["repo-b"] },
      ],
      axis_view: {
        axes: [
          {
            label: "x",
            members: [
              { id: "repo-a", topics: ["wrapper-induction", "automatic"], description: "wrapper learning system" },
              { id: "repo-b", topics: ["scraping", "selenium"], description: "scraper" },
            ],
          },
        ],
      },
    };
    const signals = collectUnknownMemberSignals(landscape);
    assert.equal(signals.length, 1);
    assert.equal(signals[0].id, "repo-a");
    assert.ok(signals[0].tokens.includes("wrapper"));
  });

  test("identifies member with pattern_family=unknown directly", () => {
    const landscape = {
      clusters: [{ pattern_family: "scraper", member_ids: ["repo-a"] }],
      axis_view: {
        axes: [
          {
            label: "x",
            members: [
              { id: "repo-a", pattern_family: "unknown", topics: ["lazy-loading"], description: "" },
            ],
          },
        ],
      },
    };
    const signals = collectUnknownMemberSignals(landscape);
    assert.equal(signals.length, 1);
    assert.ok(signals[0].tokens.includes("lazy"));
  });

  test("dedups members across multiple axes", () => {
    const landscape = {
      clusters: [{ pattern_family: "unknown", member_ids: ["repo-a"] }],
      axis_view: {
        axes: [
          { label: "axis1", members: [{ id: "repo-a", topics: ["wrapper-induction"], description: "" }] },
          { label: "axis2", members: [{ id: "repo-a", topics: ["wrapper-induction"], description: "" }] },
        ],
      },
    };
    const signals = collectUnknownMemberSignals(landscape);
    assert.equal(signals.length, 1);
  });

  test("skips members without resolvable tokens", () => {
    const landscape = {
      clusters: [{ pattern_family: "unknown", member_ids: ["repo-empty"] }],
      axis_view: {
        axes: [
          { label: "x", members: [{ id: "repo-empty", topics: [], description: "" }] },
        ],
      },
    };
    const signals = collectUnknownMemberSignals(landscape);
    assert.equal(signals.length, 0);
  });
});

describe("aggregateTokenFrequency", () => {
  test("counts tokens across signals", () => {
    const signals = [
      { id: "a", tokens: ["wrapper", "induction"] },
      { id: "b", tokens: ["wrapper", "scraper"] },
      { id: "c", tokens: ["scraper"] },
    ];
    const counts = aggregateTokenFrequency(signals);
    assert.equal(counts.get("wrapper"), 2);
    assert.equal(counts.get("scraper"), 2);
    assert.equal(counts.get("induction"), 1);
  });

  test("empty input returns empty Map", () => {
    assert.equal(aggregateTokenFrequency([]).size, 0);
    assert.equal(aggregateTokenFrequency(null).size, 0);
  });
});

describe("buildSuggestions", () => {
  test("filters tokens below min-members threshold", () => {
    const counts = new Map([["wrapper", 5], ["induction", 2], ["rare", 1]]);
    const suggestions = buildSuggestions(counts, 10, { minMembers: 3 });
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].candidate_token, "wrapper");
    assert.equal(suggestions[0].appears_in_members, 5);
    assert.equal(suggestions[0].coverage_ratio, 0.5);
  });

  test("respects maxSuggestions cap", () => {
    const counts = new Map();
    for (let i = 0; i < 30; i += 1) counts.set(`token${i}`, 5);
    const suggestions = buildSuggestions(counts, 10, { minMembers: 3, maxSuggestions: 5 });
    assert.equal(suggestions.length, 5);
  });

  test("each suggestion includes a proposed_lexicon_entry stub", () => {
    const counts = new Map([["selector-healing", 4]]);
    const suggestions = buildSuggestions(counts, 10, { minMembers: 3 });
    const proposed = suggestions[0].proposed_lexicon_entry;
    assert.equal(proposed.label, "selector-healing");
    assert.deepEqual(proposed.keywords, ["selector-healing"]);
    assert.equal(proposed.min_matches, 1);
    assert.match(proposed.note, /curate/);
  });

  test("sorts by frequency descending, then alphabetically", () => {
    const counts = new Map([
      ["beta", 5],
      ["alpha", 5],
      ["gamma", 3],
    ]);
    const suggestions = buildSuggestions(counts, 10, { minMembers: 3 });
    assert.equal(suggestions[0].candidate_token, "alpha");
    assert.equal(suggestions[1].candidate_token, "beta");
    assert.equal(suggestions[2].candidate_token, "gamma");
  });

  test("empty counts yield empty suggestions", () => {
    assert.deepEqual(buildSuggestions(new Map(), 10), []);
  });

  test("respects min-members default of 3", () => {
    const counts = new Map([["x", 2], ["y", 3]]);
    const suggestions = buildSuggestions(counts, 10);
    assert.equal(suggestions.length, 1);
    assert.equal(suggestions[0].candidate_token, "y");
  });
});
