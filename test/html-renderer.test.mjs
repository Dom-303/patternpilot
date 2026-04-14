import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import {
  classifyLicense,
  renderDataStateWarnBanner,
  renderDecisionSummary,
  renderLicenseTag,
  renderRecommendedActions,
  sortAdoptGroup
} from "../lib/html-renderer.mjs";

function makeRunRoot(overrides = {}) {
  return {
    reportSchemaVersion: 2,
    runConfidence: "medium",
    runConfidenceReason: "balanced signals",
    itemsDataStateSummary: { complete: 10, fallback: 0, stale: 0 },
    ...overrides
  };
}

function makeCandidate(overrides = {}) {
  return {
    full_name: "acme/base",
    discoveryDisposition: "intake_now",
    valueScore: 70,
    effortScore: 20,
    projectFitScore: 80,
    matchedCapabilities: ["source_intake"],
    license: "MIT",
    decisionSummary: "High value, low effort",
    ...overrides
  };
}

describe("decision summary cutover", () => {
  test("reportSchemaVersion !== 2 renders missing-data error state", () => {
    const html = renderDecisionSummary({
      reportType: "discovery",
      runRoot: { reportSchemaVersion: 1 },
      candidates: [makeCandidate()]
    });

    assert.match(html, /Engine-Daten unvollstaendig/);
    assert.match(html, /reportSchemaVersion/);
    assert.match(html, /section-card warn/);
  });

  test("missing run fields render missing-data error state", () => {
    const html = renderDecisionSummary({
      reportType: "review",
      runRoot: { reportSchemaVersion: 2, runConfidence: "high" },
      candidates: [makeCandidate({ reviewDisposition: "review_queue" })]
    });

    assert.match(html, /Engine-Daten unvollstaendig/);
    assert.match(html, /unvollständig|unvollstaendig/);
  });

  test("valid schema renders confidence and warn banner without heuristic label", () => {
    const html = renderDecisionSummary({
      reportType: "discovery",
      runRoot: makeRunRoot({ itemsDataStateSummary: { complete: 5, fallback: 3, stale: 2 } }),
      candidates: [makeCandidate()]
    });

    assert.match(html, /Run confidence/);
    assert.match(html, />medium</);
    assert.match(html, /balanced signals/);
    assert.match(html, /section-warn/);
    assert.match(html, /50%/);
    assert.ok(!html.includes("(heuristic)"));
  });
});

describe("data-state warning banner", () => {
  test("renderDataStateWarnBanner stays empty below threshold", () => {
    assert.equal(renderDataStateWarnBanner({ complete: 10, fallback: 2, stale: 1 }), "");
  });

  test("renderDataStateWarnBanner renders banner above threshold", () => {
    const html = renderDataStateWarnBanner({ complete: 5, fallback: 3, stale: 2 });
    assert.match(html, /section-warn/);
    assert.match(html, /3 Items mit Fallback-Bewertung/);
    assert.match(html, /2 Items gegen alte Regelversion bewertet/);
    assert.match(html, /50%/);
  });
});

describe("license classification and rendering", () => {
  test("classifyLicense maps permissive, copyleft, and unknown licenses", () => {
    assert.equal(classifyLicense("MIT"), "permissive");
    assert.equal(classifyLicense("Apache-2.0"), "permissive");
    assert.equal(classifyLicense("BSD-3-Clause"), "permissive");
    assert.equal(classifyLicense("GPL-3.0"), "copyleft");
    assert.equal(classifyLicense("AGPL-3.0"), "copyleft");
    assert.equal(classifyLicense(null), "unknown");
    assert.equal(classifyLicense("NOASSERTION"), "unknown");
  });

  test("renderLicenseTag always renders a span", () => {
    assert.match(renderLicenseTag("MIT"), /action-item__license license-permissive/);
    assert.match(renderLicenseTag("GPL-3.0"), /action-item__license license-copyleft/);
    assert.match(renderLicenseTag(null), /action-item__license license-unknown/);
    assert.match(renderLicenseTag(null), /License \?/);
  });
});

describe("recommended actions cutover", () => {
  test("adopt group is sorted by value minus effort, then fit, then capability count, then name", () => {
    const items = [
      makeCandidate({
        full_name: "zeta/low",
        discoveryDisposition: "intake_now",
        valueScore: 70,
        effortScore: 20,
        projectFitScore: 60,
        matchedCapabilities: ["a"],
        license: null,
        decisionSummary: "same net score"
      }),
      makeCandidate({
        full_name: "alpha/high-fit",
        discoveryDisposition: "intake_now",
        valueScore: 90,
        effortScore: 40,
        projectFitScore: 95,
        matchedCapabilities: ["a", "b"],
        license: "GPL-3.0",
        decisionSummary: "same net score but better fit"
      }),
      makeCandidate({
        full_name: "beta/alpha",
        reviewDisposition: "intake_now",
        valueScore: 80,
        effortScore: 30,
        projectFitScore: 95,
        matchedCapabilities: ["a", "b"],
        license: "NOASSERTION",
        decisionSummary: "same net score and fit as alpha/high-fit"
      }),
      makeCandidate({
        full_name: "delta/study",
        reviewDisposition: "review_queue",
        valueScore: 50,
        effortScore: 40,
        projectFitScore: 40,
        matchedCapabilities: [],
        license: "MIT",
        decisionSummary: "needs review"
      })
    ];

    sortAdoptGroup(items);

    assert.deepEqual(
      items.map((item) => item.full_name),
      ["alpha/high-fit", "beta/alpha", "zeta/low", "delta/study"]
    );
  });

  test("recommended actions render adopt licenses for discovery and review dispositions", () => {
    const html = renderRecommendedActions({
      reportType: "review",
      runRoot: makeRunRoot(),
      candidates: [
        makeCandidate({
          full_name: "alpha/permissive",
          discoveryDisposition: "intake_now",
          valueScore: 90,
          effortScore: 20,
          projectFitScore: 95,
          matchedCapabilities: ["source_intake", "source_systems"],
          license: "MIT",
          decisionSummary: "High value, low effort"
        }),
        makeCandidate({
          full_name: "beta/copyleft",
          discoveryDisposition: null,
          reviewDisposition: "intake_now",
          valueScore: 85,
          effortScore: 25,
          projectFitScore: 75,
          matchedCapabilities: ["source_intake", "source_systems"],
          license: "GPL-3.0",
          decisionSummary: "High value, medium effort"
        }),
        makeCandidate({
          full_name: "gamma/unknown",
          discoveryDisposition: null,
          reviewDisposition: "intake_now",
          valueScore: 75,
          effortScore: 25,
          projectFitScore: 75,
          matchedCapabilities: ["source_intake"],
          license: "NOASSERTION",
          decisionSummary: "High value, low effort"
        }),
        makeCandidate({
          full_name: "delta/watch",
          discoveryDisposition: null,
          reviewDisposition: "observe_only",
          valueScore: 30,
          effortScore: 35,
          projectFitScore: 40,
          matchedCapabilities: [],
          license: "MIT",
          decisionSummary: "Watch for later"
        })
      ]
    });

    assert.match(html, /Recommended Actions/);
    assert.ok(html.indexOf("alpha/permissive") < html.indexOf("beta/copyleft"));
    assert.ok(html.indexOf("beta/copyleft") < html.indexOf("gamma/unknown"));
    assert.match(html, /delta\/watch/);
    assert.match(html, /action-item__license license-permissive/);
    assert.match(html, /action-item__license license-copyleft/);
    assert.match(html, /action-item__license license-unknown/);
    assert.match(html, /License \?/);
  });

  test("recommended actions stay empty when run schema is missing", () => {
    const html = renderRecommendedActions({
      reportType: "discovery",
      runRoot: { reportSchemaVersion: 1 },
      candidates: [makeCandidate()]
    });

    assert.equal(html, "");
  });
});
