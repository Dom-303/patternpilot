import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { tickAutoResume } from "../../lib/automation/automation-jobs.mjs";

describe("tickAutoResume", () => {
  test("releases locks older than autoResumeMinutes", () => {
    const now = new Date("2026-04-29T12:00:00Z").getTime();
    const oldLock = new Date(now - 7 * 60 * 60 * 1000).toISOString();
    const recentLock = new Date(now - 1 * 60 * 60 * 1000).toISOString();

    const state = {
      jobs: {
        "job-old": { locked_at: oldLock, autoResumeMinutes: 360 },
        "job-recent": { locked_at: recentLock, autoResumeMinutes: 360 }
      }
    };

    const result = tickAutoResume(state, { now });

    assert.equal(result.released.length, 1);
    assert.equal(result.released[0].jobId, "job-old");
    assert.equal(state.jobs["job-old"].locked_at, null);
    assert.equal(state.jobs["job-recent"].locked_at, recentLock);
  });

  test("respects per-job autoResumeMinutes=0 (disabled)", () => {
    const now = new Date("2026-04-29T12:00:00Z").getTime();
    const veryOld = new Date(now - 99 * 60 * 60 * 1000).toISOString();

    const state = {
      jobs: {
        "job-disabled": { locked_at: veryOld, autoResumeMinutes: 0 }
      }
    };

    const result = tickAutoResume(state, { now });
    assert.equal(result.released.length, 0);
    assert.equal(state.jobs["job-disabled"].locked_at, veryOld);
  });

  test("uses default 360 minutes when autoResumeMinutes is undefined", () => {
    const now = new Date("2026-04-29T12:00:00Z").getTime();
    const oldLock = new Date(now - 7 * 60 * 60 * 1000).toISOString();

    const state = {
      jobs: {
        "job-default": { locked_at: oldLock }
      }
    };

    const result = tickAutoResume(state, { now });
    assert.equal(result.released.length, 1);
  });

  test("does not touch jobs without a lock", () => {
    const state = {
      jobs: {
        "job-free": { locked_at: null }
      }
    };

    const result = tickAutoResume(state);
    assert.equal(result.released.length, 0);
  });
});
