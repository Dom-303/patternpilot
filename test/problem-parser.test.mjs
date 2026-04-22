import test from "node:test";
import assert from "node:assert/strict";
import { parseProblemMarkdown } from "../lib/problem/parser.mjs";

const SAMPLE = `---
slug: slow-lists
title: Long lists are slow
status: active
project: app
created_at: 2026-04-20
---

## description
Lists with 500+ items take 3-5 seconds.

## success_criteria
- first 50 items < 300 ms
- smooth scroll

## constraints
- no external service
- license: apache-compatible

## non_goals
- no SSR rewrite

## current_approach
We load everything at once and render it.

## hints
- search_terms: long list virtualization, event feed performance
- tech_tags: nextjs, react
- constraint_tags: local-only, license:apache-compatible
- approach_keywords: client-virtualization, react-window
`;

test("parseProblemMarkdown extracts frontmatter fields", () => {
  const parsed = parseProblemMarkdown(SAMPLE);
  assert.equal(parsed.frontmatter.slug, "slow-lists");
  assert.equal(parsed.frontmatter.title, "Long lists are slow");
  assert.equal(parsed.frontmatter.status, "active");
  assert.equal(parsed.frontmatter.project, "app");
  assert.equal(parsed.frontmatter.created_at, "2026-04-20");
});

test("parseProblemMarkdown extracts text fields as raw text", () => {
  const parsed = parseProblemMarkdown(SAMPLE);
  assert.match(parsed.fields.description, /Lists with 500/);
  assert.match(parsed.fields.current_approach, /everything at once/);
});

test("parseProblemMarkdown extracts list fields as bullet arrays", () => {
  const parsed = parseProblemMarkdown(SAMPLE);
  assert.deepEqual(parsed.fields.success_criteria, ["first 50 items < 300 ms", "smooth scroll"]);
  assert.deepEqual(parsed.fields.constraints, ["no external service", "license: apache-compatible"]);
  assert.deepEqual(parsed.fields.non_goals, ["no SSR rewrite"]);
});

test("parseProblemMarkdown parses hints into key-value entries", () => {
  const parsed = parseProblemMarkdown(SAMPLE);
  assert.deepEqual(parsed.fields.hints.search_terms, ["long list virtualization", "event feed performance"]);
  assert.deepEqual(parsed.fields.hints.tech_tags, ["nextjs", "react"]);
  assert.deepEqual(parsed.fields.hints.constraint_tags, ["local-only", "license:apache-compatible"]);
  assert.deepEqual(parsed.fields.hints.approach_keywords, ["client-virtualization", "react-window"]);
});

test("parseProblemMarkdown tolerates missing optional sections", () => {
  const minimal = `---
slug: x
title: X
status: active
created_at: 2026-04-20
---

## description
Just some text.
`;
  const parsed = parseProblemMarkdown(minimal);
  assert.equal(parsed.fields.description, "Just some text.");
  assert.deepEqual(parsed.fields.success_criteria, []);
  assert.deepEqual(parsed.fields.hints, {});
});

test("parseProblemMarkdown supports suspected_approach_axes as list", () => {
  const content = `---
slug: x
title: X
status: active
created_at: 2026-04-20
---

## description
d

## suspected_approach_axes
- client-side virtualization
- server-side pagination
`;
  const parsed = parseProblemMarkdown(content);
  assert.deepEqual(parsed.fields.suspected_approach_axes, [
    "client-side virtualization",
    "server-side pagination"
  ]);
});
