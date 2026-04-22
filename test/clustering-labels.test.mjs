import test from "node:test";
import assert from "node:assert/strict";
import { buildClusterLabel } from "../lib/clustering/labels.mjs";

test("buildClusterLabel picks top-3 keywords sorted alphabetically", () => {
  const cluster = {
    members: [
      { keywords: new Set(["virtualization", "windowing", "react"]) },
      { keywords: new Set(["virtualization", "windowing"]) },
      { keywords: new Set(["virtualization"]) }
    ]
  };
  assert.equal(buildClusterLabel(cluster), "react+virtualization+windowing");
});

test("buildClusterLabel handles cluster with single keyword", () => {
  const cluster = { members: [{ keywords: new Set(["x"]) }] };
  assert.equal(buildClusterLabel(cluster), "x");
});

test("buildClusterLabel returns 'unlabeled' for empty keywords", () => {
  const cluster = { members: [{ keywords: new Set() }] };
  assert.equal(buildClusterLabel(cluster), "unlabeled");
});
