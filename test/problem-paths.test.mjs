// test/problem-paths.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { resolveProblemDir, isStandalone, resolveLandscapeDir } from "../lib/problem/paths.mjs";

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

test("resolveLandscapeDir returns landscape subpath under project-scoped problem", () => {
  const result = resolveLandscapeDir({ rootDir: "/r", projectKey: "app", slug: "slow-lists", runId: "run-1" });
  assert.equal(result, "/r/projects/app/problems/slow-lists/landscape/run-1");
});

test("resolveLandscapeDir returns landscape subpath under standalone problem", () => {
  const result = resolveLandscapeDir({ rootDir: "/r", projectKey: null, slug: "slow-lists", runId: "run-1" });
  assert.equal(result, "/r/state/standalone-problems/slow-lists/landscape/run-1");
});

test("resolveLandscapeDir throws when runId is missing", () => {
  assert.throws(() => {
    resolveLandscapeDir({ rootDir: "/r", projectKey: "app", slug: "slow-lists" });
  }, /runId/);
});
