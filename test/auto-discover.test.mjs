import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { assessWatchlistHealth, HEALTH_STATE } from "../lib/review/watchlist-health.mjs";
import {
  runAutoDiscoverForReview,
  AUTO_DISCOVER_REASON,
  DEFAULT_DISCOVERY_PROFILE,
  DEFAULT_ANALYSIS_DEPTH,
} from "../lib/review/auto-discover.mjs";

const SILENT_LOGGER = { log: () => {}, warn: () => {} };

function makeFakeRunDiscover(returnValue) {
  const calls = [];
  const fn = async (rootDir, config, options) => {
    calls.push({ rootDir, config, options });
    if (returnValue instanceof Error) throw returnValue;
    return returnValue;
  };
  return { fn, calls };
}

describe("runAutoDiscoverForReview — gating", () => {
  test("returns flag_off when options.autoDiscover is false", async () => {
    const fake = makeFakeRunDiscover({ candidateUrls: ["x"] });
    const result = await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: {},
      projectKey: "demo",
      health: assessWatchlistHealth({ watchlistCount: 0 }),
      options: { autoDiscover: false },
      runDiscoverFn: fake.fn,
      logger: SILENT_LOGGER,
    });
    assert.equal(result.triggered, false);
    assert.equal(result.reason, AUTO_DISCOVER_REASON.FLAG_OFF);
    assert.equal(fake.calls.length, 0);
  });

  test("returns watchlist_healthy when health is healthy", async () => {
    const fake = makeFakeRunDiscover({ candidateUrls: ["x"] });
    const result = await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: {},
      projectKey: "demo",
      health: assessWatchlistHealth({ watchlistCount: 5 }),
      options: { autoDiscover: true },
      runDiscoverFn: fake.fn,
      logger: SILENT_LOGGER,
    });
    assert.equal(result.triggered, false);
    assert.equal(result.reason, AUTO_DISCOVER_REASON.HEALTHY);
    assert.equal(fake.calls.length, 0);
  });

  test("returns failed when runDiscoverFn dependency missing", async () => {
    const result = await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: {},
      projectKey: "demo",
      health: assessWatchlistHealth({ watchlistCount: 0 }),
      options: { autoDiscover: true },
      runDiscoverFn: null,
      logger: SILENT_LOGGER,
    });
    assert.equal(result.triggered, false);
    assert.equal(result.reason, AUTO_DISCOVER_REASON.FAILED);
    assert.match(result.error, /runDiscoverFn/);
  });
});

describe("runAutoDiscoverForReview — execution path", () => {
  test("on empty watchlist + flag, calls runDiscover with focused/quick/intake/appendWatchlist", async () => {
    const fake = makeFakeRunDiscover({
      runId: "run-1",
      candidateUrls: ["https://github.com/a/b", "https://github.com/c/d"],
    });
    const health = assessWatchlistHealth({ watchlistCount: 0 });
    const result = await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: { foo: "bar" },
      projectKey: "demo",
      health,
      options: { autoDiscover: true, project: "demo" },
      runDiscoverFn: fake.fn,
      logger: SILENT_LOGGER,
    });
    assert.equal(result.triggered, true);
    assert.equal(result.reason, AUTO_DISCOVER_REASON.EXECUTED);
    assert.equal(result.candidates_added, 2);
    assert.equal(result.run_id, "run-1");
    assert.equal(result.profile, DEFAULT_DISCOVERY_PROFILE);

    assert.equal(fake.calls.length, 1);
    const passedOptions = fake.calls[0].options;
    assert.equal(passedOptions.project, "demo");
    assert.equal(passedOptions.discoveryProfile, "focused");
    assert.equal(passedOptions.analysisDepth, "quick");
    assert.equal(passedOptions.appendWatchlist, true);
    assert.equal(passedOptions.intake, true);
    assert.equal(passedOptions.dryRun, false);
    assert.equal(passedOptions.commandName, "review-watchlist:auto-discover");
    // Should NOT pass through the original urls array (review wasn't asked to filter URLs).
    assert.deepEqual(passedOptions.urls, []);
  });

  test("respects user-provided discoveryProfile + analysisDepth overrides", async () => {
    const fake = makeFakeRunDiscover({ runId: "run-1", candidateUrls: ["https://github.com/x/y"] });
    await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: {},
      projectKey: "demo",
      health: assessWatchlistHealth({ watchlistCount: 0 }),
      options: {
        autoDiscover: true,
        discoveryProfile: "expansive",
        analysisDepth: "deep",
      },
      runDiscoverFn: fake.fn,
      logger: SILENT_LOGGER,
    });
    const passed = fake.calls[0].options;
    assert.equal(passed.discoveryProfile, "expansive");
    assert.equal(passed.analysisDepth, "deep");
  });

  test("zero-candidate result reports no_candidates_returned without claiming new entries", async () => {
    const fake = makeFakeRunDiscover({ runId: "run-empty", candidateUrls: [] });
    const result = await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: {},
      projectKey: "demo",
      health: assessWatchlistHealth({ watchlistCount: 0 }),
      options: { autoDiscover: true },
      runDiscoverFn: fake.fn,
      logger: SILENT_LOGGER,
    });
    assert.equal(result.triggered, true);
    assert.equal(result.reason, AUTO_DISCOVER_REASON.NO_CANDIDATES);
    assert.equal(result.candidates_added, 0);
    assert.equal(result.run_id, "run-empty");
  });

  test("runDiscoverFn rejection is caught and reported as failed", async () => {
    const fake = makeFakeRunDiscover(new Error("github API down"));
    const result = await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: {},
      projectKey: "demo",
      health: assessWatchlistHealth({ watchlistCount: 0 }),
      options: { autoDiscover: true },
      runDiscoverFn: fake.fn,
      logger: SILENT_LOGGER,
    });
    assert.equal(result.triggered, false);
    assert.equal(result.reason, AUTO_DISCOVER_REASON.FAILED);
    assert.match(result.error, /github API down/);
  });

  test("sparse health (count=1, threshold=3) still triggers", async () => {
    const fake = makeFakeRunDiscover({ candidateUrls: ["https://github.com/a/b"] });
    const result = await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: {},
      projectKey: "demo",
      health: assessWatchlistHealth({ watchlistCount: 1 }),
      options: { autoDiscover: true },
      runDiscoverFn: fake.fn,
      logger: SILENT_LOGGER,
    });
    assert.equal(result.triggered, true);
    assert.equal(result.reason, AUTO_DISCOVER_REASON.EXECUTED);
    assert.equal(fake.calls.length, 1);
  });

  test("candidate_urls is capped to first 20", async () => {
    const urls = Array.from({ length: 50 }, (_, i) => `https://github.com/a/b${i}`);
    const fake = makeFakeRunDiscover({ candidateUrls: urls });
    const result = await runAutoDiscoverForReview({
      rootDir: "/tmp",
      config: {},
      projectKey: "demo",
      health: assessWatchlistHealth({ watchlistCount: 0 }),
      options: { autoDiscover: true },
      runDiscoverFn: fake.fn,
      logger: SILENT_LOGGER,
    });
    assert.equal(result.candidates_added, 50);
    assert.equal(result.candidate_urls.length, 20);
    assert.equal(result.candidate_urls[0], urls[0]);
  });
});

describe("default constants", () => {
  test("DEFAULT_DISCOVERY_PROFILE is 'focused' (cheapest)", () => {
    assert.equal(DEFAULT_DISCOVERY_PROFILE, "focused");
  });

  test("DEFAULT_ANALYSIS_DEPTH is 'quick'", () => {
    assert.equal(DEFAULT_ANALYSIS_DEPTH, "quick");
  });
});
