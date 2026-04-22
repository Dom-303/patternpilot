import { test } from "node:test";
import assert from "node:assert/strict";
import { runDiscoveryPass } from "../lib/discovery/pass.mjs";

function fakeSearch(items) {
  return async () => ({ items });
}

test("runDiscoveryPass maps enrichment readme excerpt into flat repo shape", async () => {
  const items = [
    { normalizedRepoUrl: "https://github.com/foo/bar", owner: "foo", name: "bar", description: "d", language: "TypeScript", topics: ["x"] }
  ];
  const enrichFn = async (repo) => ({
    readme: { excerpt: `README for ${repo.owner}/${repo.name}` },
    licenseId: "MIT",
    dependencies: ["dep1"]
  });

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["q"],
    searchFn: fakeSearch(items),
    enrichFn
  });

  assert.equal(repos.length, 1);
  assert.equal(repos[0].readme, "README for foo/bar");
  assert.equal(repos[0].license, "MIT");
  assert.deepEqual(repos[0].dependencies, ["dep1"]);
});

test("runDiscoveryPass enriches multiple repos in parallel and preserves order", async () => {
  const items = [
    { normalizedRepoUrl: "https://github.com/a/1", owner: "a", name: "1", description: null, language: null, topics: [] },
    { normalizedRepoUrl: "https://github.com/b/2", owner: "b", name: "2", description: null, language: null, topics: [] },
    { normalizedRepoUrl: "https://github.com/c/3", owner: "c", name: "3", description: null, language: null, topics: [] }
  ];
  const enrichFn = async (repo) => ({
    readme: { excerpt: `EX-${repo.name}` }
  });

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["q"],
    searchFn: fakeSearch(items),
    enrichFn
  });

  assert.deepEqual(repos.map((r) => r.readme), ["EX-1", "EX-2", "EX-3"]);
});

test("runDiscoveryPass tolerates per-repo enrichment failure without dropping other repos", async () => {
  const items = [
    { normalizedRepoUrl: "https://github.com/ok/1", owner: "ok", name: "1", description: null, language: null, topics: [] },
    { normalizedRepoUrl: "https://github.com/bad/2", owner: "bad", name: "2", description: null, language: null, topics: [] },
    { normalizedRepoUrl: "https://github.com/ok/3", owner: "ok", name: "3", description: null, language: null, topics: [] }
  ];
  const enrichFn = async (repo) => {
    if (repo.owner === "bad") throw new Error("enrichment boom");
    return { readme: { excerpt: `EX-${repo.name}` } };
  };

  const { repos, error } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["q"],
    searchFn: fakeSearch(items),
    enrichFn
  });

  assert.equal(error, undefined, "single-repo enrichment failure is not fatal");
  assert.equal(repos.length, 3);
  assert.equal(repos[0].readme, "EX-1");
  assert.equal(repos[1].readme, null, "failed repo falls back to null");
  assert.equal(repos[2].readme, "EX-3");
});

test("runDiscoveryPass handles enrichment returning error-shaped readme", async () => {
  const items = [
    { normalizedRepoUrl: "https://github.com/x/y", owner: "x", name: "y", description: null, language: null, topics: [] }
  ];
  const enrichFn = async () => ({
    readme: { path: null, htmlUrl: null, excerpt: "", error: "404" }
  });

  const { repos } = await runDiscoveryPass({
    config: {},
    projectKey: "eventbear-worker",
    queries: ["q"],
    searchFn: fakeSearch(items),
    enrichFn
  });

  assert.equal(repos[0].readme, "", "empty excerpt passes through as empty string, not null");
});
