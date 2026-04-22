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
