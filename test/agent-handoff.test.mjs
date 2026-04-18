import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runAgentHandoff } from "../scripts/commands/agent-handoff.mjs";

describe("runAgentHandoff", () => {
  test("reads the canonical handoff artifact and can copy it to a custom output path", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-agent-handoff-"));
    const reportRoot = path.join(rootDir, "projects", "demo", "reports");
    fs.mkdirSync(reportRoot, { recursive: true });
    fs.writeFileSync(
      path.join(reportRoot, "latest-report.json"),
      JSON.stringify({
        projectKey: "demo",
        reportKind: "review",
        command: "review-watchlist",
        reportPath: "projects/demo/reports/patternpilot-report-demo.html"
      }, null, 2),
      "utf8"
    );
    fs.writeFileSync(
      path.join(reportRoot, "agent-handoff.json"),
      JSON.stringify({
        schemaVersion: 1,
        projectKey: "demo",
        reportKind: "review",
        command: "review-watchlist",
        reportPath: "projects/demo/reports/patternpilot-report-demo.html",
        handoff: {
          topRepos: [
            { repo: "acme/demo", nextStep: "Gezielt pruefen." }
          ],
          nextActions: [
            "Oeffne zuerst den Review-Bericht."
          ]
        }
      }, null, 2),
      "utf8"
    );

    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(" "));

    try {
      const result = await runAgentHandoff(rootDir, { defaultProject: "demo" }, {
        output: "exports/demo-agent-handoff.json",
        dryRun: false
      });

      assert.equal(result.projectKey, "demo");
      assert.match(logs.join("\n"), /Patternpilot Agent Hand-Off/);
      assert.match(logs.join("\n"), /top_repos: 1/);
      assert.ok(fs.existsSync(path.join(rootDir, "exports", "demo-agent-handoff.json")));
      const copied = JSON.parse(fs.readFileSync(path.join(rootDir, "exports", "demo-agent-handoff.json"), "utf8"));
      assert.equal(copied.projectKey, "demo");
      assert.deepEqual(copied.handoff.topRepos, [{ repo: "acme/demo", nextStep: "Gezielt pruefen." }]);
    } finally {
      console.log = originalLog;
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
