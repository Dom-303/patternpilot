import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  compareConfidence,
  selectAutomationDiscoveryCandidates,
  sortAutomationCandidates
} from "../lib/automation.mjs";

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
});
