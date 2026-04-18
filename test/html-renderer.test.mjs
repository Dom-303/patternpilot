import { test, describe } from "node:test";
import { strict as assert } from "node:assert";
import {
  classifyLicense,
  renderDataStateWarnBanner,
  renderDiscoveryHtmlReport,
  renderDecisionSummary,
  renderLicenseTag,
  renderOnDemandRunHtmlReport,
  renderWatchlistReviewHtmlReport,
  renderRecommendedActions,
  sortAdoptGroup
} from "../lib/html-renderer.mjs";

function makeRunRoot(overrides = {}) {
  return {
    reportSchemaVersion: 2,
    runConfidence: "medium",
    runConfidenceReason: "balanced signals",
    itemsDataStateSummary: { complete: 10, fallback: 0, stale: 0 },
    runGapSignals: [{ gap: "source_systems_and_families", count: 2, strength: 81 }],
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

  test("valid schema renders confidence and top weighted gap signal without heuristic label", () => {
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
    assert.match(html, /Top gap signal/);
    assert.match(html, /source_systems_and_families/);
    assert.match(html, /count 2 · strength 81/);
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

describe("review html scope rendering", () => {
  test("selected-url review renders scope section and missing selected title", () => {
    const html = renderWatchlistReviewHtmlReport({
      projectKey: "sample-project",
      createdAt: "2026-04-14T18:00:00.000Z",
      analysisProfile: { id: "architecture", label: "Architecture" },
      analysisDepth: { id: "standard" },
      reviewScope: "selected_urls",
      selectedUrls: ["https://github.com/acme/demo"],
      inputUrlCount: 1,
      watchlistCount: 3,
      items: [
        {
          repoRef: "acme/demo",
          reviewScore: 72,
          projectFitBand: "high",
          mainLayer: "source_intake",
          gapArea: "source_systems_and_families",
          matchedCapabilities: ["source_first"],
          recommendedWorkerAreas: ["lib/fetch.mjs"],
          learningForEventbaer: "useful",
          possibleImplication: "adapt",
          strengths: "clear source model",
          weaknesses: "",
          risks: [],
          reason: "fit=high (82)",
          suggestedNextStep: "compare deeply",
          eventbaerRelevance: "high"
        }
      ],
      topItems: [
        {
          repoRef: "acme/demo",
          reviewScore: 72,
          projectFitBand: "high",
          mainLayer: "source_intake",
          gapArea: "source_systems_and_families",
          matchedCapabilities: ["source_first"],
          recommendedWorkerAreas: ["lib/fetch.mjs"],
          learningForEventbaer: "useful",
          possibleImplication: "adapt",
          strengths: "clear source model",
          weaknesses: "",
          risks: [],
          reason: "fit=high (82)",
          suggestedNextStep: "compare deeply",
          eventbaerRelevance: "high"
        }
      ],
      riskiestItems: [],
      missingUrls: ["https://github.com/acme/missing"],
      nextSteps: ["Review the selected repos."],
      coverage: {
        mainLayers: [{ value: "source_intake", count: 1 }],
        gapAreas: [{ value: "source_systems_and_families", count: 1 }],
        capabilities: [{ value: "source_first", count: 1 }],
        workerAreas: [],
        uncoveredCapabilities: []
      },
      projectProfile: { contextSources: { loadedFiles: [], missingFiles: [], scannedDirectories: [] }, capabilitiesPresent: [] },
      binding: { readBeforeAnalysis: [], referenceDirectories: [] },
      reportSchemaVersion: 2,
      runConfidence: "medium",
      runConfidenceReason: "balanced signals",
      itemsDataStateSummary: { complete: 1, fallback: 0, stale: 0 }
    }, "standard");

    assert.match(html, /Run scope/);
    assert.match(html, /Selected URLs/);
    assert.match(html, /Missing selected intake/);
    assert.match(html, /Input URLs/);
  });
});

describe("discovery html policy rendering", () => {
  test("discovery report renders discovery policy stats and section", () => {
    const html = renderDiscoveryHtmlReport({
      projectKey: "sample-project",
      createdAt: "2026-04-14T19:00:00.000Z",
      binding: { projectKey: "sample-project", readBeforeAnalysis: [], referenceDirectories: [] },
      projectProfile: { contextSources: { loadedFiles: [], missingFiles: [], scannedDirectories: [] }, capabilitiesPresent: [] },
      discovery: {
        discoveryProfile: { id: "balanced", limit: 8 },
        scanned: 12,
        plan: { plans: [] },
        searchErrors: [],
        rawCandidateCount: 5,
        candidates: [makeCandidate({
          repo: { owner: "acme", name: "demo", normalizedRepoUrl: "https://github.com/acme/demo" },
          guess: { mainLayer: "source_intake" },
          queryLabels: ["Broad project scan"],
          reasoning: ["seed match"],
          landkarteCandidate: { possible_implication: "adapt", strengths: "clear source model", risks: "needs_review" }
        })],
        policySummary: {
          enabled: true,
          mode: "audit",
          evaluated: 5,
          visible: 5,
          allowed: 1,
          blocked: 4,
          preferred: 1,
          enforcedBlocked: 0,
          blockerCounts: [{ value: "blocked_signal_pattern", count: 3 }],
          preferenceCounts: [{ value: "preferred_capability", count: 1 }],
          blockedPreview: [{ repoRef: "drop/demo", blockers: ["blocked_signal_pattern"], summary: "blocked:blocked_signal_pattern" }]
        },
        policyCalibration: {
          status: "strict_needs_review",
          topBlockers: [{ value: "blocked_signal_pattern", count: 3 }],
          recommendations: ["Audit mode keeps flagged repos visible so blocker defaults can be calibrated before hiding candidates."]
        },
        reportSchemaVersion: 2,
        runConfidence: "medium",
        runConfidenceReason: "balanced signals",
        itemsDataStateSummary: { complete: 1, fallback: 0, stale: 0 },
        runGapSignals: [{ gap: "source_systems_and_families", count: 1, strength: 80 }]
      }
    });

    assert.match(html, /Discovery policy/);
    assert.match(html, /Policy flagged/);
    assert.match(html, /Mode audit kept 5 of 5 evaluated candidates visible/);
    assert.match(html, /Policy calibration/);
    assert.match(html, /strict_needs_review/);
    assert.match(html, /Audit mode keeps flagged repos visible/);
    assert.match(html, /blocked_signal_pattern: 3/);
    assert.match(html, /drop\/demo: blocked_signal_pattern/);
    assert.match(html, /Raw found/);
  });
});

describe("on-demand run html rendering", () => {
  test("renders a landing page with artifacts and run summary", () => {
    const html = renderOnDemandRunHtmlReport({
      runId: "2026-04-14T18-30-00-000Z",
      projectKey: "sample-project",
      createdAt: "2026-04-14T18:30:00.000Z",
      sourceMode: "explicit_urls",
      explicitUrls: ["https://github.com/acme/demo"],
      effectiveUrls: ["https://github.com/acme/demo"],
      appendWatchlist: false,
      dryRun: false,
      intakeRun: { items: [{ repo: { owner: "acme", name: "demo" } }] },
      reEvaluateRun: { updates: [] },
      reviewRun: {
        review: {
          analysisProfile: { id: "architecture" },
          reviewScope: "selected_urls",
          inputUrlCount: 1,
          watchlistCount: 2,
          selectedUrls: ["https://github.com/acme/demo"],
          items: [
            {
              repoRef: "acme/demo",
              reviewScore: 72,
              projectFitBand: "high",
              mainLayer: "source_intake",
              gapArea: "source_systems_and_families",
              matchedCapabilities: ["source_first"],
              recommendedWorkerAreas: ["lib/fetch.mjs"],
              learningForEventbaer: "useful",
              possibleImplication: "adapt",
              strengths: "clear source model",
              weaknesses: "",
              risks: [],
              reason: "fit=high (82)",
              suggestedNextStep: "compare deeply",
              eventbaerRelevance: "high"
            }
          ],
          topItems: [
            {
              repoRef: "acme/demo",
              reviewScore: 72,
              projectFitBand: "high",
              mainLayer: "source_intake",
              gapArea: "source_systems_and_families",
              matchedCapabilities: ["source_first"],
              recommendedWorkerAreas: ["lib/fetch.mjs"],
              learningForEventbaer: "useful",
              possibleImplication: "adapt",
              strengths: "clear source model",
              weaknesses: "",
              risks: [],
              reason: "fit=high (82)",
              suggestedNextStep: "compare deeply",
              eventbaerRelevance: "high"
            }
          ],
          nextSteps: ["Open the review report and compare deeply."],
          reportSchemaVersion: 2,
          runConfidence: "medium",
          runConfidenceReason: "balanced signals",
          itemsDataStateSummary: { complete: 1, fallback: 0, stale: 0 }
        }
      },
      promoteRun: null,
      artifacts: {
        reviewReportHref: "../../../projects/sample-project/reports/patternpilot-report-sample-project-2026-04-14-on-demand.html",
        reviewReportLabel: "projects/sample-project/reports/patternpilot-report-sample-project-2026-04-14-on-demand.html",
        latestReportHref: "../../../projects/sample-project/reports/latest-report.json",
        latestReportLabel: "projects/sample-project/reports/latest-report.json",
        browserLinkHref: "../../../projects/sample-project/reports/browser-link",
        browserLinkLabel: "projects/sample-project/reports/browser-link"
      },
      nextActions: [
        "Open the review report first.",
        "Decide whether the repo should enter the watchlist."
      ]
    });

    assert.match(html, /ON-DEMAND RUN/);
    assert.match(html, /Run summary/);
    assert.match(html, /Artifacts/);
    assert.match(html, /What now/);
    assert.match(html, /Review report/);
    assert.match(html, /Latest report metadata/);
    assert.match(html, /Browser link/);
    assert.match(html, /Decide whether the repo should enter the watchlist/);
  });
});
