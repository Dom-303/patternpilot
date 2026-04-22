import test from "node:test";
import assert from "node:assert/strict";
import { extractRepoKeywords, normalizeKeyword } from "../lib/clustering/keywords.mjs";

test("extractRepoKeywords pulls from topics, readme headings, dependencies", () => {
  const repo = {
    topics: ["Virtualization", "react"],
    readme: "# Fast Lists\n## Windowing Under the Hood\nSome prose about virtualized tables.",
    dependencies: ["react-window", "react"]
  };
  const kw = extractRepoKeywords(repo);
  assert.ok(kw.has("virtualization"));
  assert.ok(kw.has("react"));
  assert.ok(kw.has("windowing"));
  assert.ok(kw.has("react-window"));
});

test("normalizeKeyword applies synonym map", () => {
  assert.equal(normalizeKeyword("virtualisation"), "virtualization");
  assert.equal(normalizeKeyword("Windowing"), "virtualization");
  assert.equal(normalizeKeyword("react-window"), "react-window");
});

test("extractRepoKeywords filters stopwords and short tokens", () => {
  const repo = { topics: [], readme: "# A and to be", dependencies: [] };
  const kw = extractRepoKeywords(repo);
  assert.equal(kw.size, 0);
});
