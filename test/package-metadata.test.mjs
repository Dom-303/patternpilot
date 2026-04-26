import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("npm package allowlist keeps local workspace state out of published artifacts", async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
  const files = packageJson.files ?? [];

  assert.ok(files.length > 0, "package.json should define an npm files allowlist");
  assert.ok(!files.some((entry) => entry === "projects" || entry.startsWith("projects/")));
  assert.ok(!files.some((entry) => entry === "runs" || entry.startsWith("runs/")));
  assert.ok(!files.some((entry) => entry === "state" || entry.startsWith("state/")));
});

test("package license matches the committed license document", async () => {
  const packageJson = JSON.parse(await fs.readFile(new URL("../package.json", import.meta.url), "utf8"));
  const licenseText = await fs.readFile(new URL("../LICENSE", import.meta.url), "utf8");
  const noticeText = await fs.readFile(new URL("../NOTICE", import.meta.url), "utf8");

  assert.equal(packageJson.license, "MIT");
  assert.match(licenseText, /^MIT License/);
  assert.match(noticeText, /MIT License/);
});
