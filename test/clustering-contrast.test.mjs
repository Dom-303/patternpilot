import test from "node:test";
import assert from "node:assert/strict";
import { buildSignatureContrast } from "../lib/clustering/contrast.mjs";

test("buildSignatureContrast returns tokens overrepresented in this cluster", () => {
  const target = { id: "virt", members: [{ keywords: new Set(["virtualization", "windowing"]) }, { keywords: new Set(["virtualization", "recycling"]) }] };
  const others = [
    { id: "pag", members: [{ keywords: new Set(["pagination", "ssr"]) }, { keywords: new Set(["pagination"]) }] }
  ];
  const contrast = buildSignatureContrast(target, others, { topN: 3 });
  assert.ok(contrast.includes("virtualization"));
  assert.ok(!contrast.includes("pagination"));
});

test("buildSignatureContrast returns empty array when no contrast possible", () => {
  const target = { id: "t", members: [{ keywords: new Set() }] };
  const others = [{ id: "o", members: [{ keywords: new Set() }] }];
  assert.deepEqual(buildSignatureContrast(target, others), []);
});
