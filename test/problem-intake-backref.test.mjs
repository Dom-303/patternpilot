// test/problem-intake-backref.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { addProblemBackref } from "../lib/problem/intake-backref.mjs";

test("addProblemBackref injects problem frontmatter into dossier", () => {
  const original = `---
url: https://github.com/org/repo
status: new
---

## body
`;
  const updated = addProblemBackref(original, "slow-lists");
  assert.match(updated, /problems:\n  - slow-lists/);
});

test("addProblemBackref appends slug when problems list exists", () => {
  const original = `---
url: https://github.com/org/repo
status: new
problems:
  - existing-slug
---
body`;
  const updated = addProblemBackref(original, "new-slug");
  assert.match(updated, /- existing-slug/);
  assert.match(updated, /- new-slug/);
});

test("addProblemBackref is idempotent when slug already present", () => {
  const original = `---
url: https://github.com/org/repo
status: new
problems:
  - slow-lists
---
body`;
  const updated = addProblemBackref(original, "slow-lists");
  const count = (updated.match(/- slow-lists/g) ?? []).length;
  assert.equal(count, 1);
});
