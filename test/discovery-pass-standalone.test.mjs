import { test } from "node:test";
import assert from "node:assert/strict";
import { runDiscoveryPass } from "../lib/discovery/pass.mjs";

test("runDiscoveryPass issues one verbatim search per problem phrase", async () => {
  const calls = [];
  const fakeSearchFn = async (_config, plan) => {
    calls.push({ query: plan.query });
    return { items: [] };
  };

  const result = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["virtualized list", "react window", "infinite scroll"],
    searchFn: fakeSearchFn
  });

  assert.equal(result.error, undefined, "no error expected");
  assert.equal(calls.length, 3, "one call per phrase");
  assert.equal(calls[0].query, "virtualized list");
  assert.equal(calls[1].query, "react window");
  assert.equal(calls[2].query, "infinite scroll");
});

test("runDiscoveryPass dedupes repos surfacing via multiple phrases", async () => {
  const fakeSearchFn = async (_config, plan) => {
    if (plan.query === "virtualized list") {
      return {
        items: [
          { normalizedRepoUrl: "https://github.com/foo/bar", owner: "foo", name: "bar", description: "a", language: "TypeScript", topics: [] },
          { normalizedRepoUrl: "https://github.com/foo/baz", owner: "foo", name: "baz", description: "b", language: "JavaScript", topics: [] }
        ]
      };
    }
    if (plan.query === "react window") {
      return {
        items: [
          { normalizedRepoUrl: "https://github.com/foo/bar", owner: "foo", name: "bar", description: "a", language: "TypeScript", topics: [] },
          { normalizedRepoUrl: "https://github.com/foo/qux", owner: "foo", name: "qux", description: "c", language: "Rust", topics: [] }
        ]
      };
    }
    return { items: [] };
  };

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["virtualized list", "react window"],
    searchFn: fakeSearchFn
  });

  const urls = repos.map((repo) => repo.url).sort();
  assert.deepEqual(urls, [
    "https://github.com/foo/bar",
    "https://github.com/foo/baz",
    "https://github.com/foo/qux"
  ], "each repo appears exactly once");
});
