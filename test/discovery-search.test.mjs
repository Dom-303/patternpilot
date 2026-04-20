import test from "node:test";
import assert from "node:assert/strict";

import { buildFallbackSearchQueries, buildSearchQuerySequence } from "../lib/discovery/search.mjs";

test("buildFallbackSearchQueries broadens overly strict GitHub queries step by step", () => {
  const queries = buildFallbackSearchQueries(
    "event ingestion connector sync -awesome -boilerplate archived:false fork:false stars:>=3",
    2
  );

  assert.deepEqual(queries, [
    "event ingestion connector sync -awesome -boilerplate archived:false fork:false stars:>=3",
    "event ingestion connector -awesome -boilerplate archived:false fork:false stars:>=3",
    "event ingestion -awesome -boilerplate archived:false fork:false stars:>=3"
  ]);
});

test("buildSearchQuerySequence inserts explicit lane backoff queries before generic truncation", () => {
  const queries = buildSearchQuerySequence({
    query: "municipal event public archived:false fork:false stars:>=3",
    fallbackQueries: [
      "public event scraper archived:false fork:false stars:>=3",
      "municipal agenda crawler archived:false fork:false stars:>=3"
    ]
  }, 2);

  assert.deepEqual(queries, [
    "municipal event public archived:false fork:false stars:>=3",
    "public event scraper archived:false fork:false stars:>=3",
    "municipal agenda crawler archived:false fork:false stars:>=3",
    "municipal event archived:false fork:false stars:>=3"
  ]);
});
