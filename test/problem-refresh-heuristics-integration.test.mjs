import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { refreshProblemJson } from "../lib/problem/store.mjs";

function createStandaloneProblem(rootDir, slug, markdown) {
  const dir = path.join(rootDir, "state", "standalone-problems", slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "problem.md"), markdown);
  return dir;
}

describe("refreshProblemJson + heuristics + sharpen-prompt backfill", () => {
  test("expanded tech_tags land in problem.json; warnings go to stderr", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-heuristics-"));
    const originalWarn = console.warn;
    const captured = [];
    console.warn = (...args) => captured.push(args.join(" "));

    try {
      const dir = createStandaloneProblem(rootDir, "test-heuristics", `---
slug: test-heuristics
title: Test heuristics
status: active
created_at: 2026-04-22
---

## hints
- search_terms: self-healing scraper, web scraper, scraper
- tech_tags: nodejs
`);
      await refreshProblemJson({ rootDir, projectKey: null, slug: "test-heuristics" });
      const json = JSON.parse(fs.readFileSync(path.join(dir, "problem.json"), "utf8"));

      assert.ok(json.derived.tech_tags.includes("nodejs"));
      assert.ok(json.derived.tech_tags.some((t) => t.toLowerCase() === "node"));
      assert.ok(json.derived.tech_tags.some((t) => t.toLowerCase() === "node.js"));
      assert.ok(captured.some((line) => line.toLowerCase().includes("generic")), "generic warning printed");
      assert.ok(captured.some((line) => line.toLowerCase().includes("single word")), "single-word warning printed");
    } finally {
      console.warn = originalWarn;
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("backfills sharpen-prompt.md when missing", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-backfill-"));
    try {
      const dir = createStandaloneProblem(rootDir, "needs-backfill", `---
slug: needs-backfill
title: Needs backfill
status: active
created_at: 2026-04-22
---

## hints
- search_terms: nothing special
`);
      assert.ok(!fs.existsSync(path.join(dir, "sharpen-prompt.md")), "no sharpen-prompt initially");
      await refreshProblemJson({ rootDir, projectKey: null, slug: "needs-backfill" });
      assert.ok(fs.existsSync(path.join(dir, "sharpen-prompt.md")), "sharpen-prompt backfilled");
      const content = fs.readFileSync(path.join(dir, "sharpen-prompt.md"), "utf8");
      assert.ok(content.includes("slug: needs-backfill"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("does not overwrite existing sharpen-prompt.md", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-nooverwrite-"));
    try {
      const dir = createStandaloneProblem(rootDir, "has-prompt", `---
slug: has-prompt
title: Has prompt
status: active
created_at: 2026-04-22
---

## hints
- search_terms: example
`);
      fs.writeFileSync(path.join(dir, "sharpen-prompt.md"), "USER_CUSTOMIZED_CONTENT");
      await refreshProblemJson({ rootDir, projectKey: null, slug: "has-prompt" });
      const content = fs.readFileSync(path.join(dir, "sharpen-prompt.md"), "utf8");
      assert.equal(content, "USER_CUSTOMIZED_CONTENT");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
