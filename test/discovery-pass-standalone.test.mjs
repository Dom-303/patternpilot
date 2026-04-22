import { test } from "node:test";
import assert from "node:assert/strict";
import { runDiscoveryPass } from "../lib/discovery/pass.mjs";

const noopEnrichFn = async () => ({});

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
    searchFn: fakeSearchFn,
    enrichFn: noopEnrichFn
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
    searchFn: fakeSearchFn,
    enrichFn: noopEnrichFn
  });

  const urls = repos.map((repo) => repo.url).sort();
  assert.deepEqual(urls, [
    "https://github.com/foo/bar",
    "https://github.com/foo/baz",
    "https://github.com/foo/qux"
  ], "each repo appears exactly once");
});

test("runDiscoveryPass continues on single-phrase failure", async () => {
  const fakeSearchFn = async (_config, plan) => {
    if (plan.query === "flaky phrase") {
      throw new Error("rate_limited");
    }
    return {
      items: [
        { normalizedRepoUrl: `https://github.com/ok/${plan.query.replace(/\s+/g, "-")}`, owner: "ok", name: plan.query.replace(/\s+/g, "-"), description: null, language: null, topics: [] }
      ]
    };
  };

  const { repos, error } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["good one", "flaky phrase", "good two"],
    searchFn: fakeSearchFn,
    enrichFn: noopEnrichFn
  });

  assert.equal(error, undefined, "single-phrase failure is not fatal");
  assert.equal(repos.length, 2, "two surviving phrases produced two repos");
  assert.deepEqual(
    repos.map((repo) => repo.name).sort(),
    ["good-one", "good-two"]
  );
});

test("runDiscoveryPass returns flat repo shape with enrichment fields nulled", async () => {
  const fakeSearchFn = async () => ({
    items: [
      {
        normalizedRepoUrl: "https://github.com/foo/bar",
        owner: "foo",
        name: "bar",
        description: "desc",
        language: "TypeScript",
        topics: ["perf", "lists"]
      }
    ]
  });

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["anything"],
    searchFn: fakeSearchFn,
    enrichFn: noopEnrichFn
  });

  assert.equal(repos.length, 1);
  const repo = repos[0];
  assert.equal(repo.id, "https://github.com/foo/bar");
  assert.equal(repo.url, "https://github.com/foo/bar");
  assert.equal(repo.owner, "foo");
  assert.equal(repo.name, "bar");
  assert.equal(repo.description, "desc");
  assert.equal(repo.language, "TypeScript");
  assert.deepEqual(repo.topics, ["perf", "lists"]);
  assert.equal(repo.readme, null, "no README enrichment in standalone path");
  assert.equal(repo.license, null, "no license enrichment in standalone path");
  assert.deepEqual(repo.dependencies, [], "no dependencies enrichment in standalone path");
});

test("runDiscoveryPass returns projectKey error when missing", async () => {
  const { repos, error } = await runDiscoveryPass({
    config: {},
    queries: ["anything"],
    searchFn: async () => ({ items: [] }),
    enrichFn: noopEnrichFn
  });
  assert.deepEqual(repos, []);
  assert.match(error, /projectKey required/);
});

test("runDiscoveryPass returns empty repos on empty queries", async () => {
  let called = false;
  const { repos, error } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: [],
    searchFn: async () => { called = true; return { items: [] }; },
    enrichFn: noopEnrichFn
  });
  assert.deepEqual(repos, []);
  assert.equal(error, undefined);
  assert.equal(called, false, "no search calls for empty queries");
});
