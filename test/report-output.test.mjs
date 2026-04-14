import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import {
  buildBrowserLinkTarget,
  writeLatestReportPointers
} from "../lib/report-output.mjs";

describe("buildBrowserLinkTarget", () => {
  test("renders a wsl browser path when WSL_DISTRO_NAME is present", () => {
    const previous = process.env.WSL_DISTRO_NAME;
    process.env.WSL_DISTRO_NAME = "Ubuntu-24.04";

    try {
      const out = buildBrowserLinkTarget("/home/domi/eventbaer/dev/patternpilot/projects/demo/reports/report.html");
      assert.equal(
        out,
        "\\\\wsl.localhost\\Ubuntu-24.04\\home\\domi\\eventbaer\\dev\\patternpilot\\projects\\demo\\reports\\report.html"
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
  test("writes browser-link and latest-report metadata", async () => {
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
        dryRun: false
      });

      const browserLinkContent = fs.readFileSync(out.browserLinkPath, "utf8").trim();
      const latestReport = JSON.parse(fs.readFileSync(out.latestReportPath, "utf8"));

      assert.equal(browserLinkContent, out.browserLink);
      assert.equal(latestReport.projectKey, "demo");
      assert.equal(latestReport.command, "on-demand");
      assert.equal(latestReport.reportKind, "review");
      assert.equal(latestReport.reportPath, "projects/demo/reports/patternpilot-report-demo-2026-04-14-on-demand.html");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
