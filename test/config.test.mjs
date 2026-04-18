import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { loadConfig, writeConfig } from "../lib/config.mjs";

async function makeTempRoot() {
  return fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-config-"));
}

test("loadConfig merges local overlay into the product default config", async () => {
  const rootDir = await makeTempRoot();
  await fs.writeFile(
    path.join(rootDir, "patternpilot.config.json"),
    `${JSON.stringify({
      version: 1,
      defaultProject: null,
      github: {
        userAgent: "base-agent"
      },
      projects: {}
    }, null, 2)}\n`,
    "utf8"
  );
  await fs.writeFile(
    path.join(rootDir, "patternpilot.config.local.json"),
    `${JSON.stringify({
      defaultProject: "demo",
      projects: {
        demo: {
          label: "Demo",
          projectRoot: "../demo"
        }
      }
    }, null, 2)}\n`,
    "utf8"
  );

  const config = await loadConfig(rootDir);

  assert.equal(config.defaultProject, "demo");
  assert.equal(config.github.userAgent, "base-agent");
  assert.equal(config.projects.demo.projectRoot, "../demo");
});

test("writeConfig with preferLocal writes a local overlay file", async () => {
  const rootDir = await makeTempRoot();
  await fs.writeFile(
    path.join(rootDir, "patternpilot.config.json"),
    `${JSON.stringify({
      version: 1,
      defaultProject: null,
      projects: {}
    }, null, 2)}\n`,
    "utf8"
  );

  const config = await loadConfig(rootDir);
  config.defaultProject = "demo";
  config.projects.demo = {
    label: "Demo",
    projectRoot: "../demo"
  };

  await writeConfig(rootDir, config, { preferLocal: true });

  const localRaw = await fs.readFile(path.join(rootDir, "patternpilot.config.local.json"), "utf8");
  const localConfig = JSON.parse(localRaw);
  assert.equal(localConfig.defaultProject, "demo");
  assert.equal(localConfig.projects.demo.label, "Demo");
});
