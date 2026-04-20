import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  acquireAutomationLock,
  classifyAutomationFailure,
  compareConfidence,
  createAutomationProjectRun,
  finalizeAutomationProjectRun,
  releaseAutomationLock,
  renderAutomationRunSummary,
  selectAutomationDiscoveryCandidates,
  setAutomationPhase,
  summarizeAutomationProjects,
  sortAutomationCandidates
} from "../lib/automation/automation.mjs";
import {
  defaultDiscoveryPolicy,
  evaluateDiscoveryCandidatePolicy,
  summarizeDiscoveryPolicyResults,
  buildDiscoveryPolicyCalibration
} from "../lib/policy/discovery-policy.mjs";

function makeCandidate(overrides = {}) {
  return {
    repo: {
      owner: "acme",
      name: "demo",
      normalizedRepoUrl: "https://github.com/acme/demo"
    },
    discoveryDisposition: "review_queue",
    decisionDataState: "complete",
    valueScore: 70,
    effortScore: 30,
    projectAlignment: {
      fitBand: "high",
      fitScore: 80
    },
    ...overrides
  };
}

describe("compareConfidence", () => {
  test("orders low < medium < high", () => {
    assert.ok(compareConfidence("low", "medium") < 0);
    assert.ok(compareConfidence("medium", "high") < 0);
    assert.equal(compareConfidence("high", "high"), 0);
  });
});

describe("sortAutomationCandidates", () => {
  test("sorts by net score, then fit, then name", () => {
    const candidates = [
      makeCandidate({
        repo: { owner: "zeta", name: "one", normalizedRepoUrl: "https://github.com/zeta/one" },
        valueScore: 80,
        effortScore: 30,
        projectAlignment: { fitBand: "high", fitScore: 70 }
      }),
      makeCandidate({
        repo: { owner: "alpha", name: "two", normalizedRepoUrl: "https://github.com/alpha/two" },
        valueScore: 80,
        effortScore: 30,
        projectAlignment: { fitBand: "high", fitScore: 90 }
      }),
      makeCandidate({
        repo: { owner: "beta", name: "three", normalizedRepoUrl: "https://github.com/beta/three" },
        valueScore: 60,
        effortScore: 40,
        projectAlignment: { fitBand: "high", fitScore: 95 }
      })
    ];

    sortAutomationCandidates(candidates);

    assert.deepEqual(
      candidates.map((candidate) => `${candidate.repo.owner}/${candidate.repo.name}`),
      ["alpha/two", "zeta/one", "beta/three"]
    );
  });
});

describe("selectAutomationDiscoveryCandidates", () => {
  test("blocks handoff below minimum confidence", () => {
    const out = selectAutomationDiscoveryCandidates(
      { runConfidence: "low", candidates: [makeCandidate()] },
      { minConfidence: "medium", maxCandidates: 5 }
    );

    assert.equal(out.status, "blocked_low_confidence");
    assert.equal(out.selected.length, 0);
  });

  test("accepts only actionable dispositions with non-low fit", () => {
    const out = selectAutomationDiscoveryCandidates(
      {
        runConfidence: "high",
        candidates: [
          makeCandidate({
            repo: { owner: "keep", name: "one", normalizedRepoUrl: "https://github.com/keep/one" },
            discoveryDisposition: "intake_now",
            valueScore: 85,
            effortScore: 20
          }),
          makeCandidate({
            repo: { owner: "drop", name: "observe", normalizedRepoUrl: "https://github.com/drop/observe" },
            discoveryDisposition: "observe_only"
          }),
          makeCandidate({
            repo: { owner: "drop", name: "lowfit", normalizedRepoUrl: "https://github.com/drop/lowfit" },
            discoveryDisposition: "review_queue",
            projectAlignment: { fitBand: "low", fitScore: 20 }
          }),
          makeCandidate({
            repo: { owner: "keep", name: "two", normalizedRepoUrl: "https://github.com/keep/two" },
            discoveryDisposition: "review_queue",
            valueScore: 70,
            effortScore: 25,
            projectAlignment: { fitBand: "medium", fitScore: 60 }
          })
        ]
      },
      { minConfidence: "medium", maxCandidates: 5 }
    );

    assert.equal(out.status, "selected");
    assert.deepEqual(out.selectedUrls, [
      "https://github.com/keep/one",
      "https://github.com/keep/two"
    ]);
  });

  test("caps the handoff to the configured maximum", () => {
    const out = selectAutomationDiscoveryCandidates(
      {
        runConfidence: "high",
        candidates: [
          makeCandidate({
            repo: { owner: "one", name: "a", normalizedRepoUrl: "https://github.com/one/a" },
            valueScore: 90,
            effortScore: 20
          }),
          makeCandidate({
            repo: { owner: "two", name: "b", normalizedRepoUrl: "https://github.com/two/b" },
            valueScore: 85,
            effortScore: 20
          }),
          makeCandidate({
            repo: { owner: "three", name: "c", normalizedRepoUrl: "https://github.com/three/c" },
            valueScore: 80,
            effortScore: 20
          })
        ]
      },
      { minConfidence: "medium", maxCandidates: 2 }
    );

    assert.equal(out.selected.length, 2);
  });

  test("applies discovery policy blockers before watchlist handoff", () => {
    const policy = {
      ...defaultDiscoveryPolicy("sample-project"),
      blockedRepoPatterns: ["demo"],
      minProjectFitScore: 60
    };
    const out = selectAutomationDiscoveryCandidates(
      {
        runConfidence: "high",
        candidates: [
          makeCandidate({
            repo: { owner: "keep", name: "strong", normalizedRepoUrl: "https://github.com/keep/strong" },
            projectAlignment: { fitBand: "high", fitScore: 80 }
          }),
          makeCandidate({
            repo: { owner: "drop", name: "demo-template", normalizedRepoUrl: "https://github.com/drop/demo-template" },
            projectAlignment: { fitBand: "high", fitScore: 85 }
          }),
          makeCandidate({
            repo: { owner: "drop", name: "weak", normalizedRepoUrl: "https://github.com/drop/weak" },
            projectAlignment: { fitBand: "medium", fitScore: 45 }
          })
        ]
      },
      { minConfidence: "medium", maxCandidates: 5, policy }
    );

    assert.equal(out.status, "selected");
    assert.deepEqual(out.selectedUrls, ["https://github.com/keep/strong"]);
    assert.equal(out.policyBlocked, 2);
  });
});

describe("evaluateDiscoveryCandidatePolicy", () => {
  test("reports preference hits for preferred family, layer and topics", () => {
    const candidate = makeCandidate({
      repo: { owner: "keep", name: "source-worker", normalizedRepoUrl: "https://github.com/keep/source-worker" },
      guess: {
        patternFamily: "local_source_infra_framework",
        mainLayer: "source_intake"
      },
      enrichment: {
        repo: {
          topics: ["events", "scraper"]
        }
      },
      projectAlignment: {
        fitBand: "high",
        fitScore: 90
      },
      discoveryEvidence: {
        sourceFamilyHits: 2,
        publicEventIntakeHits: 1,
        governanceHits: 0,
        normalizationHits: 1
      }
    });
    const policy = {
      ...defaultDiscoveryPolicy("sample-project"),
      preferredPatternFamilies: ["local_source_infra_framework"],
      preferredMainLayers: ["source_intake"],
      preferredTopics: ["events"]
    };

    const out = evaluateDiscoveryCandidatePolicy(candidate, policy);
    assert.equal(out.allowed, true);
    assert.equal(out.preferenceHits.length, 3);
    assert.match(out.summary, /allowed_with_preferences/);
  });

  test("blocks by license category, homepage host, signal patterns and risk flags", () => {
    const candidate = makeCandidate({
      repo: { owner: "drop", name: "platform-wrapper", normalizedRepoUrl: "https://github.com/drop/platform-wrapper" },
      guess: {
        patternFamily: "local_source_infra_framework",
        mainLayer: "source_intake",
        gapArea: "source_systems_and_families"
      },
      enrichment: {
        repo: {
          license: "GPL-3.0",
          homepage: "https://facebook.com/some-app",
          description: "A starter boilerplate for platform-bound sourcing",
          topics: ["events"]
        },
        readme: {
          excerpt: "starter template for social scraping"
        }
      },
      risks: ["source_lock_in", "archived_repo"],
      projectAlignment: {
        fitBand: "high",
        fitScore: 90,
        matchedCapabilities: ["source_first"]
      }
    });
    const policy = {
      ...defaultDiscoveryPolicy("sample-project"),
      blockedLicenseCategories: ["copyleft"],
      blockedHomepageHosts: ["facebook.com"],
      blockedSignalPatterns: ["starter boilerplate"],
      blockedRiskFlags: ["source_lock_in"]
    };

    const out = evaluateDiscoveryCandidatePolicy(candidate, policy);
    assert.equal(out.allowed, false);
    assert.ok(out.blockers.some((item) => item.startsWith("blocked_license_category:copyleft")));
    assert.ok(out.blockers.some((item) => item.startsWith("blocked_homepage_host:facebook.com")));
    assert.ok(out.blockers.includes("blocked_signal_pattern"));
    assert.ok(out.blockers.includes("blocked_risk_flag"));
  });

  test("blocks when capability or gap-area gates are not matched", () => {
    const candidate = makeCandidate({
      guess: {
        patternFamily: "event_discovery_frontend",
        mainLayer: "ui_discovery_surface",
        gapArea: "frontend_and_surface_design"
      },
      projectAlignment: {
        fitBand: "medium",
        fitScore: 62,
        matchedCapabilities: ["distribution_surfaces"]
      }
    });
    const policy = {
      ...defaultDiscoveryPolicy("sample-project"),
      allowGapAreas: ["source_systems_and_families"],
      allowCapabilitiesAny: ["source_first", "candidate_first"]
    };

    const out = evaluateDiscoveryCandidatePolicy(candidate, policy);
    assert.equal(out.allowed, false);
    assert.ok(out.blockers.some((item) => item.startsWith("gap_area_not_allowed:frontend_and_surface_design")));
    assert.ok(out.blockers.includes("capability_gate_not_matched"));
  });
});

describe("summarizeDiscoveryPolicyResults", () => {
  test("aggregates blocker and preference counts", () => {
    const summary = summarizeDiscoveryPolicyResults([
      { allowed: true, blockers: [], preferenceHits: ["preferred_topic", "preferred_capability"] },
      { allowed: false, blockers: ["blocked_signal_pattern", "blocked_risk_flag"], preferenceHits: [] },
      { allowed: false, blockers: ["blocked_signal_pattern"], preferenceHits: ["preferred_topic"] }
    ]);

    assert.equal(summary.evaluated, 3);
    assert.equal(summary.allowed, 1);
    assert.equal(summary.blocked, 2);
    assert.equal(summary.preferred, 2);
    assert.deepEqual(summary.blockerCounts[0], { value: "blocked_signal_pattern", count: 2 });
    assert.deepEqual(summary.preferenceCounts[0], { value: "preferred_topic", count: 2 });
  });
});

describe("buildDiscoveryPolicyCalibration", () => {
  test("returns strict_needs_review for heavily flagged audit runs", () => {
    const out = buildDiscoveryPolicyCalibration({
      enabled: true,
      mode: "audit",
      evaluated: 10,
      blocked: 7,
      preferred: 1,
      enforcedBlocked: 0,
      blockerCounts: [{ value: "blocked_signal_pattern", count: 5 }]
    });

    assert.equal(out.status, "strict_needs_review");
    assert.ok(out.recommendations.some((item) => item.includes("flags 70%")));
    assert.ok(out.recommendations.some((item) => item.includes("Audit mode keeps flagged repos visible")));
  });

  test("returns permissive_needs_review when nothing is flagged", () => {
    const out = buildDiscoveryPolicyCalibration({
      enabled: true,
      mode: "enforce",
      evaluated: 6,
      blocked: 0,
      preferred: 0,
      enforcedBlocked: 0,
      blockerCounts: []
    });

    assert.equal(out.status, "permissive_needs_review");
    assert.ok(out.recommendations.some((item) => item.includes("too permissive")));
  });
});

describe("automation project run state", () => {
  test("marks completed_with_blocks when completed and blocked phases coexist", () => {
    const run = createAutomationProjectRun("sample-project");
    setAutomationPhase(run, "discover", { status: "completed", reason: "run_complete", count: 4 });
    setAutomationPhase(run, "gate", { status: "blocked", reason: "low_confidence" });
    setAutomationPhase(run, "watchlist_handoff", { status: "skipped", reason: "no_selected_urls" });
    setAutomationPhase(run, "intake", { status: "skipped", reason: "no_effective_urls" });
    setAutomationPhase(run, "re_evaluate", { status: "skipped", reason: "no_effective_urls" });
    setAutomationPhase(run, "review", { status: "skipped", reason: "no_effective_urls" });
    setAutomationPhase(run, "promote", { status: "skipped", reason: "no_effective_urls" });

    finalizeAutomationProjectRun(run);

    assert.equal(run.status, "completed_with_blocks");
  });

  test("summarizes project runs for audit output", () => {
    const completed = finalizeAutomationProjectRun(Object.assign(createAutomationProjectRun("one"), {
      metrics: {
        runKind: "maintenance_run",
        recommendedFocus: "maintenance_and_drift_control",
        runDriftStatus: "attention_required",
        runGovernanceStatus: "manual_gate",
        policyControlStatus: "followup_with_care"
      },
      phases: {
        discover: { status: "completed", reason: "run_complete" },
        gate: { status: "completed", reason: "selected" },
        watchlist_handoff: { status: "completed", reason: "updated" },
        intake: { status: "completed", reason: "run_complete" },
        re_evaluate: { status: "completed", reason: "recomputed_targets" },
        review: { status: "completed", reason: "run_complete" },
        promote: { status: "skipped", reason: "promotion_disabled" }
      }
    }));
    const failed = createAutomationProjectRun("two");
    setAutomationPhase(failed, "discover", { status: "failed", reason: "network" });
    finalizeAutomationProjectRun(failed);

    const summary = summarizeAutomationProjects([completed, failed]);
    const rendered = renderAutomationRunSummary({
      runId: "2026-04-14T17-00-00-000Z",
      createdAt: "2026-04-14T17:00:00.000Z",
      dryRun: false,
      promotionMode: "prepared",
      continueOnProjectError: true,
      reEvaluateLimit: 20,
      projectRuns: [completed, failed]
    });

    assert.equal(summary.completed, 1);
    assert.equal(summary.failed, 1);
    assert.match(rendered, /projects_failed: 1/);
    assert.match(rendered, /one: completed \(run_kind=maintenance_run; focus=maintenance_and_drift_control; drift=attention_required; governance=manual_gate; policy=followup_with_care\)/);
    assert.match(rendered, /two: failed/);
  });
});

describe("automation ops helpers", () => {
  test("classifies transient and configuration failures", () => {
    const transient = classifyAutomationFailure(new Error("GitHub API timed out with 429"));
    const config = classifyAutomationFailure(new Error("Unknown project 'demo'."));

    assert.equal(transient.retryable, true);
    assert.equal(transient.category, "rate_limit");
    assert.equal(config.retryable, false);
    assert.equal(config.category, "project_config");
  });

  test("acquires and releases automation locks and blocks active overlaps", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "patternpilot-automation-lock-"));
    const config = { automationLockFile: "state/automation.lock.json" };

    try {
      const first = await acquireAutomationLock(rootDir, config, {
        project: "sample-project",
        allProjects: false,
        dryRun: true,
        forceLock: false,
        lockTimeoutMinutes: 180
      });

      assert.equal(first.status, "acquired");
      assert.ok(fs.existsSync(path.join(rootDir, config.automationLockFile)));

      await assert.rejects(
        () => acquireAutomationLock(rootDir, config, {
          project: "sample-project",
          allProjects: false,
          dryRun: true,
          forceLock: false,
          lockTimeoutMinutes: 180
        }),
        (error) => error.exitCode === 3
      );

      const released = await releaseAutomationLock(first);
      assert.equal(released.status, "released");
      assert.equal(fs.existsSync(path.join(rootDir, config.automationLockFile)), false);
    } finally {
      fs.rmSync(rootDir, { recursive: true, force: true });
    }
  });
});
