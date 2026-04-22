import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  buildBrowserLinkTarget,
  pushBrowserLink,
  writeLatestReportPointers
} from "../lib/report-output.mjs";

describe("buildBrowserLinkTarget", () => {
  test("renders a wsl browser path when WSL_DISTRO_NAME is present", () => {
    const previous = process.env.WSL_DISTRO_NAME;
    process.env.WSL_DISTRO_NAME = "Ubuntu-24.04";

    try {
      const inputPath = "/home/example/patternpilot/projects/demo/reports/report.html";
      const out = buildBrowserLinkTarget(inputPath);
      assert.equal(
        out,
        "\\\\wsl.localhost\\Ubuntu-24.04\\home\\example\\patternpilot\\projects\\demo\\reports\\report.html"
      );
    } finally {
      if (previous === undefined) {
        delete process.env.WSL_DISTRO_NAME;
      } else {
        process.env.WSL_DISTRO_NAME = previous;
      }
    }
  });
});

describe("writeLatestReportPointers", () => {
  test("writes browser-link, latest-report metadata, and agent handoff artifacts", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-report-output-"));
    const reportPath = path.join(rootDir, "projects/demo/reports/patternpilot-report-demo-2026-04-14-on-demand.html");
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, "<html></html>\n", "utf8");

    try {
      const out = await writeLatestReportPointers({
        rootDir,
        projectKey: "demo",
        reportPath,
        createdAt: "2026-04-14T12:00:00.000Z",
        runId: "2026-04-14T12-00-00-000Z",
        command: "on-demand",
        reportKind: "review",
        agentHandoffPayload: {
          schemaVersion: 2,
          handoffType: "patternpilot_agent_brief",
          reportType: "review",
          projectKey: "demo",
          mission: ["Arbeite nur im Zielprojektkontext."],
          targetRepoContext: {
            projectRoot: "../demo",
            firstReadFiles: ["README.md"]
          },
          repos: [
            {
              repo: "acme/demo",
              fitBand: "high",
              nextStep: "Gezielt pruefen."
            }
          ]
        },
        dryRun: false
      });

      const browserLinkContent = fs.readFileSync(out.browserLinkPath, "utf8").trim();
      const latestReport = JSON.parse(fs.readFileSync(out.latestReportPath, "utf8"));
      const agentHandoff = JSON.parse(fs.readFileSync(out.agentHandoffPath, "utf8"));

      assert.equal(browserLinkContent, out.browserLink);
      assert.equal(latestReport.projectKey, "demo");
      assert.equal(latestReport.command, "on-demand");
      assert.equal(latestReport.reportKind, "review");
      assert.equal(latestReport.reportPath, "projects/demo/reports/patternpilot-report-demo-2026-04-14-on-demand.html");
      assert.equal(latestReport.agentHandoffPath, "projects/demo/reports/agent-handoff.json");
      assert.equal(agentHandoff.schemaVersion, 1);
      assert.equal(agentHandoff.projectKey, "demo");
      assert.equal(agentHandoff.reportKind, "review");
      assert.equal(agentHandoff.reportPath, "projects/demo/reports/patternpilot-report-demo-2026-04-14-on-demand.html");
      assert.equal(agentHandoff.handoff.schemaVersion, 2);
      assert.equal(agentHandoff.handoff.handoffType, "patternpilot_agent_brief");
      assert.equal(agentHandoff.handoff.targetRepoContext.projectRoot, "../demo");
      assert.deepEqual(agentHandoff.handoff.repos, [
        {
          repo: "acme/demo",
          fitBand: "high",
          nextStep: "Gezielt pruefen."
        }
      ]);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe("pushBrowserLink", () => {
  test("creates file on first call, prepends on second, dedupes and caps", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-browser-link-"));
    const browserLinkPath = path.join(rootDir, "browser-link");

    try {
      await pushBrowserLink(browserLinkPath, "LINK_A");
      assert.equal(fs.readFileSync(browserLinkPath, "utf8"), "LINK_A\n");

      await pushBrowserLink(browserLinkPath, "LINK_B");
      assert.equal(fs.readFileSync(browserLinkPath, "utf8"), "LINK_B\nLINK_A\n", "newest on top");

      await pushBrowserLink(browserLinkPath, "LINK_A");
      assert.equal(
        fs.readFileSync(browserLinkPath, "utf8"),
        "LINK_A\nLINK_B\n",
        "repeat move-to-top, no duplicate"
      );

      for (let i = 0; i < 25; i += 1) {
        await pushBrowserLink(browserLinkPath, `LINK_${i}`, { maxLines: 5 });
      }
      const lines = fs.readFileSync(browserLinkPath, "utf8").trim().split("\n");
      assert.equal(lines.length, 5, "cap holds");
      assert.equal(lines[0], "LINK_24", "newest first");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
