import test from "node:test";
import assert from "node:assert/strict";
import { mapToAxes } from "../lib/clustering/stage3-axes.mjs";

test("mapToAxes assigns each repo to nearest axis by keyword overlap", () => {
  const axes = ["client-side virtualization", "server-side pagination", "lazy hydration"];
  const repos = [
    { id: "a", keywords: new Set(["virtualization", "client"]) },
    { id: "b", keywords: new Set(["pagination", "server"]) },
    { id: "c", keywords: new Set(["hydration", "lazy"]) }
  ];
  const result = mapToAxes(repos, axes);
  assert.equal(result.axes[0].members.map((m) => m.id).join(","), "a");
  assert.equal(result.axes[1].members.map((m) => m.id).join(","), "b");
  assert.equal(result.axes[2].members.map((m) => m.id).join(","), "c");
});

test("mapToAxes marks axes with no matches as axis_not_found_in_landscape", () => {
  const axes = ["known", "unknown"];
  const repos = [{ id: "a", keywords: new Set(["known"]) }];
  const result = mapToAxes(repos, axes);
  assert.equal(result.axes[0].members.length, 1);
  assert.equal(result.axes[1].members.length, 0);
  assert.equal(result.axes[1].status, "axis_not_found_in_landscape");
});

test("mapToAxes puts zero-overlap repos in unmatched bucket", () => {
  const axes = ["x", "y"];
  const repos = [{ id: "a", keywords: new Set(["z"]) }];
  const result = mapToAxes(repos, axes);
  assert.equal(result.unmatched.length, 1);
});
