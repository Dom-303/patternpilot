import test from "node:test";
import assert from "node:assert/strict";
import { buildDerived } from "../lib/problem/derived.mjs";

test("buildDerived prefers hints.search_terms and adds keyword extract from title", () => {
  const derived = buildDerived({
    title: "Long event lists are slow",
    fields: { hints: { search_terms: ["virtualization", "event feed"] } }
  });
  assert.ok(derived.query_seeds.includes("virtualization"));
  assert.ok(derived.query_seeds.includes("event feed"));
  assert.ok(derived.query_seeds.some((s) => /event|list|slow/i.test(s)));
});

test("buildDerived approach_signature returns hints.approach_keywords only", () => {
  const derived = buildDerived({
    title: "T",
    fields: {
      hints: { approach_keywords: ["client-virtualization", "react-window"] },
      current_approach: "We use react-window and custom virtualization."
    }
  });
  assert.deepEqual(derived.approach_signature, ["client-virtualization", "react-window"]);
});

test("buildDerived approach_signature empty when no hint", () => {
  const derived = buildDerived({
    title: "T",
    fields: { hints: {}, current_approach: "No hints here." }
  });
  assert.deepEqual(derived.approach_signature, []);
});

test("buildDerived uses hints.constraint_tags and tech_tags verbatim", () => {
  const derived = buildDerived({
    title: "T",
    fields: {
      hints: {
        constraint_tags: ["local-only", "license:apache-compatible"],
        tech_tags: ["nextjs", "react"]
      }
    }
  });
  assert.deepEqual(derived.constraint_tags, ["local-only", "license:apache-compatible"]);
  assert.deepEqual(derived.tech_tags, ["nextjs", "react"]);
});

test("buildDerived query_seeds filters out stopwords and short tokens from title", () => {
  const derived = buildDerived({
    title: "The lists are a slow thing",
    fields: { hints: {} }
  });
  for (const token of derived.query_seeds) {
    assert.ok(!["the", "are", "a"].includes(token), `token ${token} should be filtered`);
  }
});

test("buildDerived emits bigrams (not single words) when title fallback fires", () => {
  const derived = buildDerived({
    title: "event deduplication across heterogenous sources",
    fields: { hints: {} }
  });
  // Every fallback seed must be a multi-word phrase (>= 2 tokens),
  // never a polluting single word like "event" or "sources".
  for (const seed of derived.query_seeds) {
    const parts = seed.trim().split(/\s+/);
    assert.ok(parts.length >= 2, `seed "${seed}" must be a bigram, got ${parts.length} tokens`);
  }
  assert.ok(derived.query_seeds.some((s) => /event.*deduplication/.test(s)), "expected adjacent bigram present");
  // Filler word "across" should be stopword-filtered and not appear as a token
  assert.ok(!derived.query_seeds.includes("across"));
});

test("buildDerived skips title fallback entirely when hints are strong (>=3 multi-word phrases)", () => {
  const derived = buildDerived({
    title: "event deduplication across heterogenous sources",
    fields: {
      hints: {
        search_terms: [
          "record linkage library",
          "entity resolution deduplication",
          "probabilistic record matching",
          "fuzzy string matching"
        ]
      }
    }
  });
  // All seeds should come from hints only — no title-derived bigrams mixed in
  assert.deepEqual(derived.query_seeds, [
    "record linkage library",
    "entity resolution deduplication",
    "probabilistic record matching",
    "fuzzy string matching"
  ]);
});

test("buildDerived dedupes case-insensitively across hints + fallback", () => {
  const derived = buildDerived({
    title: "Event Dedup System",
    fields: { hints: { search_terms: ["event dedup"] } }
  });
  // hint "event dedup" + title-fallback could produce "event dedup" bigram — must dedupe
  const lowered = derived.query_seeds.map((s) => s.toLowerCase());
  const unique = new Set(lowered);
  assert.equal(unique.size, lowered.length, "no case-insensitive duplicates");
});
