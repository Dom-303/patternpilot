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
