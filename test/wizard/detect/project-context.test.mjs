import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { detectProjectContext } from "../../../lib/wizard/detect/project-context.mjs";

function makeProject({ pkg, readme, files = [] } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-ctx-"));
  if (pkg) fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify(pkg));
  if (readme) fs.writeFileSync(path.join(dir, "README.md"), readme);
  for (const f of files) fs.writeFileSync(path.join(dir, f), "x");
  return dir;
}

describe("detectProjectContext", () => {
  test("derives label from package.json name", () => {
    const dir = makeProject({ pkg: { name: "eventbear-worker", type: "module" } });
    const ctx = detectProjectContext(dir);
    assert.equal(ctx.label, "Eventbear Worker");
    assert.equal(ctx.language, "Node.js (ESM)");
  });

  test("falls back to dirname title-case when no package.json", () => {
    const dir = makeProject({ readme: "# foo" });
    const ctx = detectProjectContext(dir);
    assert.match(ctx.label, /^[A-Z]/);
  });

  test("collects standard context files when present", () => {
    const dir = makeProject({
      readme: "# r",
      files: ["CLAUDE.md", "AGENT_CONTEXT.md"]
    });
    const ctx = detectProjectContext(dir);
    assert.ok(ctx.contextFiles.includes("CLAUDE.md"));
    assert.ok(ctx.contextFiles.includes("AGENT_CONTEXT.md"));
    assert.ok(ctx.contextFiles.includes("README.md"));
  });

  test("derives domain hint from README headline + body", () => {
    const dir = makeProject({
      readme: "# Event Scraping Worker\n\nDieser Worker sammelt Events aus verschiedenen Quellen."
    });
    const ctx = detectProjectContext(dir);
    assert.match(ctx.domainHint, /event|scrap/i);
  });

  test("language detected as Python when requirements.txt present", () => {
    const dir = makeProject({ files: ["requirements.txt"] });
    const ctx = detectProjectContext(dir);
    assert.equal(ctx.language, "Python");
  });
});
