import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  findLatestDiscoveryManifest,
  buildDiscoveryPolicyReview,
  renderDiscoveryPolicyReviewSummary
} from "../lib/policy/discovery-policy-review.mjs";
import { defaultDiscoveryPolicy } from "../lib/policy/discovery-policy.mjs";

describe("findLatestDiscoveryManifest", () => {
  test("selects the latest run that contains a discovery payload", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-policy-review-"));
    const runsRoot = path.join(rootDir, "runs/demo");
    fs.mkdirSync(path.join(runsRoot, "2026-04-14T10-00-00-000Z"), { recursive: true });
    fs.mkdirSync(path.join(runsRoot, "2026-04-14T11-00-00-000Z"), { recursive: true });
    fs.writeFileSync(
      path.join(runsRoot, "2026-04-14T10-00-00-000Z/manifest.json"),
      JSON.stringify({ runId: "2026-04-14T10-00-00-000Z", discovery: { candidates: [] } }),
      "utf8"
    );
    fs.writeFileSync(
      path.join(runsRoot, "2026-04-14T11-00-00-000Z/manifest.json"),
      JSON.stringify({ runId: "2026-04-14T11-00-00-000Z", discovery: { candidates: [{ full_name: "acme/demo" }] } }),
      "utf8"
    );

    try {
      const out = await findLatestDiscoveryManifest(rootDir, { runtimeRoot: "runs" }, "demo");
      assert.equal(out.runId, "2026-04-14T11-00-00-000Z");
      assert.ok(out.relativeManifestPath.endsWith("manifest.json"));
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});

describe("buildDiscoveryPolicyReview", () => {
  test("compares audit and enforce visibility against current policy", () => {
    const discovery = {
      candidates: [
        {
          full_name: "keep/strong",
          repo: { owner: "keep", name: "strong" },
          guess: { patternFamily: "local_source_infra_framework", mainLayer: "source_intake", gapArea: "source_systems_and_families" },
          enrichment: { repo: { topics: ["events"], license: "MIT", homepage: "" }, readme: { excerpt: "" } },
          projectAlignment: { fitScore: 82, matchedCapabilities: ["source_first"] },
          discoveryDisposition: "review_queue",
          risks: []
        },
        {
          full_name: "drop/template",
          repo: { owner: "drop", name: "template" },
          guess: { patternFamily: "event_discovery_frontend", mainLayer: "ui_discovery_surface", gapArea: "frontend_and_surface_design" },
          enrichment: { repo: { topics: ["events"], license: "MIT", homepage: "" }, readme: { excerpt: "starter template" } },
          projectAlignment: { fitScore: 70, matchedCapabilities: ["distribution_surfaces"] },
          discoveryDisposition: "review_queue",
          risks: []
        }
      ]
    };
    const policy = {
      ...defaultDiscoveryPolicy("demo"),
      blockedSignalPatterns: ["starter template"]
    };

    const out = buildDiscoveryPolicyReview(discovery, policy);
    assert.equal(out.sourceCandidateCount, 2);
    assert.equal(out.audit.policySummary.visible, 2);
    assert.equal(out.audit.policySummary.blocked, 1);
    assert.equal(out.enforce.policySummary.visible, 1);
    assert.equal(out.enforce.policySummary.enforcedBlocked, 1);
    assert.equal(out.hiddenByEnforce[0].repoRef, "drop/template");
  });

  test("renders a markdown review summary", () => {
    const summary = renderDiscoveryPolicyReviewSummary({
      projectKey: "demo",
      sourceRunId: "2026-04-14T11-00-00-000Z",
      sourceManifestPath: "runs/demo/2026-04-14T11-00-00-000Z/manifest.json",
      review: {
        sourceCandidateCount: 2,
        audit: {
          policySummary: { visible: 2, blocked: 1, preferred: 0 },
          policyCalibration: { status: "calibrating", recommendations: ["Inspect blocked examples."] }
        },
        enforce: {
          policySummary: { visible: 1, enforcedBlocked: 1, preferred: 0 },
          policyCalibration: { status: "calibrating", recommendations: ["Compare audit and enforce before tightening."] }
        },
        hiddenByEnforce: [{ repoRef: "drop/template", blockers: ["blocked_signal_pattern"] }]
      }
    });

    assert.match(summary, /Patternpilot Discovery Policy Review/);
    assert.match(summary, /Hidden By Enforce/);
    assert.match(summary, /drop\/template/);
  });
});
