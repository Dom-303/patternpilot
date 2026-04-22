// test/problem-paths.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { resolveProblemDir, isStandalone } from "../lib/problem/paths.mjs";

test("resolveProblemDir returns project-scoped path when project is given", () => {
  const result = resolveProblemDir({ rootDir: "/r", projectKey: "app", slug: "slow-lists" });
  assert.equal(result, "/r/projects/app/problems/slow-lists");
});

test("resolveProblemDir returns standalone path when project is null", () => {
  const result = resolveProblemDir({ rootDir: "/r", projectKey: null, slug: "slow-lists" });
  assert.equal(result, "/r/state/standalone-problems/slow-lists");
});

test("isStandalone reflects projectKey presence", () => {
  assert.equal(isStandalone({ projectKey: "app" }), false);
  assert.equal(isStandalone({ projectKey: null }), true);
  assert.equal(isStandalone({}), true);
});
