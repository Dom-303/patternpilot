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

  test("emits a file:// URI for plain Linux/macOS absolute paths when no WSL distro is present", () => {
    const previous = process.env.WSL_DISTRO_NAME;
    delete process.env.WSL_DISTRO_NAME;
    try {
      const out = buildBrowserLinkTarget("/home/alice/patternpilot/projects/demo/reports/report.html");
      assert.equal(out, "file:///home/alice/patternpilot/projects/demo/reports/report.html");
    } finally {
      if (previous !== undefined) process.env.WSL_DISTRO_NAME = previous;
    }
  });

  test("URL-encodes unsafe chars in Linux/macOS paths (spaces, #, ?, %)", () => {
    const previous = process.env.WSL_DISTRO_NAME;
    delete process.env.WSL_DISTRO_NAME;
    try {
      const out = buildBrowserLinkTarget("/home/alice/my reports/r#1.html");
      assert.equal(out, "file:///home/alice/my%20reports/r%231.html");
    } finally {
      if (previous !== undefined) process.env.WSL_DISTRO_NAME = previous;
    }
  });

  test("leaves native Windows drive paths untouched (C:\\...)", () => {
    const previous = process.env.WSL_DISTRO_NAME;
    delete process.env.WSL_DISTRO_NAME;
    try {
      const out = buildBrowserLinkTarget("C:\\Users\\alice\\patternpilot\\report.html");
      assert.equal(out, "C:\\Users\\alice\\patternpilot\\report.html");
    } finally {
      if (previous !== undefined) process.env.WSL_DISTRO_NAME = previous;
    }
  });

  test("leaves native Windows UNC paths untouched (\\\\server\\share\\...)", () => {
    const previous = process.env.WSL_DISTRO_NAME;
    delete process.env.WSL_DISTRO_NAME;
    try {
      const out = buildBrowserLinkTarget("\\\\fileserver\\share\\report.html");
      assert.equal(out, "\\\\fileserver\\share\\report.html");
    } finally {
      if (previous !== undefined) process.env.WSL_DISTRO_NAME = previous;
    }
  });

  test("passes relative paths through unchanged", () => {
    const previous = process.env.WSL_DISTRO_NAME;
    delete process.env.WSL_DISTRO_NAME;
    try {
      assert.equal(buildBrowserLinkTarget("projects/demo/reports/report.html"), "projects/demo/reports/report.html");
    } finally {
      if (previous !== undefined) process.env.WSL_DISTRO_NAME = previous;
    }
  });
});

describe("pushBrowserLink", () => {
  test("writes structured markdown + sidecar state on first entry", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-browser-link-"));
    const browserLinkPath = path.join(rootDir, "browser-link");
    try {
      await pushBrowserLink(browserLinkPath, {
        section: "problem-explore",
        key: "virt-list",
        label: "virt-list",
        href: "\\\\wsl.localhost\\Ubuntu-24.04\\a\\landscape.html"
      });
      const md = fs.readFileSync(browserLinkPath, "utf8");
      assert.ok(md.startsWith("# Pattern Pilot — Browser Links"));
      assert.ok(md.includes("## Problem-Mode Landscapes"));
      assert.ok(md.includes("**virt-list**"));
      // Windows-UNC als Copy-Paste-Pfad in Backticks
      assert.ok(md.includes("Windows: `\\\\wsl.localhost\\Ubuntu-24.04\\a\\landscape.html`"));
      // POSIX-Pfad als zusaetzliche WSL/Linux-Option in Backticks
      assert.ok(md.includes("WSL:     `/a/landscape.html`"));
      // Anleitungs-Block oben im Dokument
      assert.ok(md.includes("So oeffnest du einen Report"));
      // Bewusst KEINE Markdown-file-Links — VS Code blockt die
      assert.ok(!md.includes("[Open report](file://"));

      const state = JSON.parse(fs.readFileSync(`${browserLinkPath}.state.json`, "utf8"));
      assert.ok(state.sections["problem-explore"]["virt-list"].href.includes("landscape.html"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("upsert replaces the entry for the same (section, key) instead of appending", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-browser-link-"));
    const browserLinkPath = path.join(rootDir, "browser-link");
    try {
      await pushBrowserLink(browserLinkPath, {
        section: "problem-explore",
        key: "p1",
        href: "HREF_V1"
      });
      await pushBrowserLink(browserLinkPath, {
        section: "problem-explore",
        key: "p1",
        href: "HREF_V2"
      });
      const md = fs.readFileSync(browserLinkPath, "utf8");
      assert.ok(md.includes("HREF_V2"), "new href appears");
      assert.ok(!md.includes("HREF_V1"), "old href is replaced, not retained");

      const state = JSON.parse(fs.readFileSync(`${browserLinkPath}.state.json`, "utf8"));
      const entries = state.sections["problem-explore"];
      assert.equal(Object.keys(entries).length, 1, "still one entry under key p1");
      assert.equal(entries.p1.href, "HREF_V2");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("groups multiple entries across sections with stable alphabetical order", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-browser-link-"));
    const browserLinkPath = path.join(rootDir, "browser-link");
    try {
      await pushBrowserLink(browserLinkPath, {
        section: "problem-explore",
        key: "zebra-problem",
        href: "HREF_Z"
      });
      await pushBrowserLink(browserLinkPath, {
        section: "problem-explore",
        key: "alpha-problem",
        href: "HREF_A"
      });
      await pushBrowserLink(browserLinkPath, {
        section: "review",
        key: "latest",
        label: "Latest review",
        href: "HREF_REVIEW"
      });
      const md = fs.readFileSync(browserLinkPath, "utf8");

      const landscapesIdx = md.indexOf("## Problem-Mode Landscapes");
      const reviewsIdx = md.indexOf("## Latest Review Reports");
      assert.ok(landscapesIdx >= 0 && reviewsIdx >= 0, "both sections rendered");

      // alpha before zebra inside the problem-explore section
      const alphaIdx = md.indexOf("alpha-problem");
      const zebraIdx = md.indexOf("zebra-problem");
      assert.ok(alphaIdx >= 0 && zebraIdx > alphaIdx, "entries sorted alphabetically");
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects malformed entries", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-browser-link-"));
    const browserLinkPath = path.join(rootDir, "browser-link");
    try {
      await assert.rejects(() => pushBrowserLink(browserLinkPath, "plain-string"));
      await assert.rejects(() => pushBrowserLink(browserLinkPath, { section: "x", key: "y" }));
      await assert.rejects(() => pushBrowserLink(browserLinkPath, { section: "", key: "y", href: "H" }));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe("writeLatestReportPointers", () => {
  test("writes browser-link (structured md), latest-report metadata, and agent handoff artifacts", async () => {
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

      const browserLinkContent = fs.readFileSync(out.browserLinkPath, "utf8");
      assert.ok(browserLinkContent.startsWith("# Pattern Pilot — Browser Links"));
      assert.ok(browserLinkContent.includes("## Latest Review Reports"));
      assert.ok(browserLinkContent.includes("**Latest review**"));
      assert.ok(browserLinkContent.includes(out.browserLink));

      const latestReport = JSON.parse(fs.readFileSync(out.latestReportPath, "utf8"));
      const agentHandoff = JSON.parse(fs.readFileSync(out.agentHandoffPath, "utf8"));

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
