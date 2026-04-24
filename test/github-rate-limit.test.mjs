import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  isRateLimitError,
  extractResetDelayMs,
  computeRateLimitBackoffMs,
  computeNetworkBackoffMs,
  MAX_BACKOFF_MS,
} from "../lib/github/rate-limit.mjs";

describe("isRateLimitError", () => {
  test("returns false for null / undefined / plain strings", () => {
    assert.equal(isRateLimitError(null), false);
    assert.equal(isRateLimitError(undefined), false);
    assert.equal(isRateLimitError("boom"), false);
    assert.equal(isRateLimitError({}), false);
  });

  test("detects 403 with x-ratelimit-remaining=0", () => {
    const error = {
      statusCode: 403,
      responseHeaders: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1800000000" },
      message: "something else",
    };
    assert.equal(isRateLimitError(error), true);
  });

  test("detects 403 with primary rate limit message", () => {
    const error = {
      statusCode: 403,
      responseHeaders: {},
      message: "API rate limit exceeded for 1.2.3.4",
    };
    assert.equal(isRateLimitError(error), true);
  });

  test("detects secondary rate limit", () => {
    const error = {
      statusCode: 403,
      responseHeaders: {},
      message: "You have triggered the secondary rate limit",
    };
    assert.equal(isRateLimitError(error), true);
  });

  test("detects 429 with rate limit message", () => {
    const error = {
      statusCode: 429,
      responseHeaders: {},
      message: "rate limit exceeded",
    };
    assert.equal(isRateLimitError(error), true);
  });

  test("returns false for 403 that is just a permission error", () => {
    const error = {
      statusCode: 403,
      responseHeaders: {},
      message: "Resource not accessible by integration",
    };
    assert.equal(isRateLimitError(error), false);
  });

  test("returns false for 4xx that is not 403/429", () => {
    assert.equal(isRateLimitError({ statusCode: 404, message: "Not Found" }), false);
    assert.equal(isRateLimitError({ statusCode: 500, message: "Internal" }), false);
  });
});

describe("extractResetDelayMs", () => {
  test("retry-after seconds wins over x-ratelimit-reset", () => {
    const error = {
      responseHeaders: {
        "retry-after": "30",
        "x-ratelimit-reset": String(Math.floor((Date.now() + 999999) / 1000)),
      },
    };
    const delay = extractResetDelayMs(error, { now: () => 1_000_000 });
    assert.equal(delay, 30_000);
  });

  test("x-ratelimit-reset yields delay-until-reset", () => {
    const now = 1_000_000_000_000;
    const resetEpoch = Math.floor(now / 1000) + 45; // 45 s in the future
    const error = { responseHeaders: { "x-ratelimit-reset": String(resetEpoch) } };
    const delay = extractResetDelayMs(error, { now: () => now });
    assert.equal(delay, 45_000);
  });

  test("returns null when no usable header is present", () => {
    const error = { responseHeaders: {} };
    assert.equal(extractResetDelayMs(error), null);
  });

  test("clamps excessive reset delays to MAX_BACKOFF_MS", () => {
    const now = 1_000_000_000_000;
    const farFuture = Math.floor(now / 1000) + 99_999; // way beyond cap
    const error = { responseHeaders: { "x-ratelimit-reset": String(farFuture) } };
    const delay = extractResetDelayMs(error, { now: () => now });
    assert.equal(delay, MAX_BACKOFF_MS);
  });

  test("handles retry-after in HTTP-date format", () => {
    const now = 1_700_000_000_000;
    const date = new Date(now + 10_000).toUTCString();
    const error = { responseHeaders: { "retry-after": date } };
    const delay = extractResetDelayMs(error, { now: () => now });
    assert.ok(delay !== null);
    assert.ok(delay >= 9_500 && delay <= 10_500, `expected ~10s, got ${delay}`);
  });
});

describe("computeRateLimitBackoffMs", () => {
  test("uses reset-header when present", () => {
    const now = 1_000_000_000_000;
    const resetEpoch = Math.floor(now / 1000) + 5;
    const error = { responseHeaders: { "x-ratelimit-reset": String(resetEpoch) } };
    const backoff = computeRateLimitBackoffMs(error, 1, { now: () => now, random: () => 0.5 });
    // 0.5 random = no jitter shift — backoff exactly 5000ms.
    assert.equal(backoff, 5_000);
  });

  test("falls back to exponential backoff when no reset header", () => {
    const error = { responseHeaders: {} };
    const b1 = computeRateLimitBackoffMs(error, 1, { random: () => 0.5 });
    const b2 = computeRateLimitBackoffMs(error, 2, { random: () => 0.5 });
    const b3 = computeRateLimitBackoffMs(error, 3, { random: () => 0.5 });
    assert.equal(b1, 2_000);
    assert.equal(b2, 4_000);
    assert.equal(b3, 8_000);
  });

  test("caps at MAX_BACKOFF_MS", () => {
    const error = { responseHeaders: {} };
    const backoff = computeRateLimitBackoffMs(error, 20, { random: () => 0.5 });
    assert.equal(backoff, MAX_BACKOFF_MS);
  });

  test("applies jitter via random function", () => {
    const error = { responseHeaders: {} };
    const lower = computeRateLimitBackoffMs(error, 1, { random: () => 0 });
    const upper = computeRateLimitBackoffMs(error, 1, { random: () => 1 });
    assert.ok(lower < 2_000, `expected lower jitter, got ${lower}`);
    assert.ok(upper > 2_000, `expected upper jitter, got ${upper}`);
  });
});

describe("computeNetworkBackoffMs", () => {
  test("grows linearly with attempt", () => {
    const a1 = computeNetworkBackoffMs(1, { random: () => 0.5 });
    const a2 = computeNetworkBackoffMs(2, { random: () => 0.5 });
    const a3 = computeNetworkBackoffMs(3, { random: () => 0.5 });
    assert.equal(a1, 800);
    assert.equal(a2, 1600);
    assert.equal(a3, 2400);
  });

  test("caps at MAX_BACKOFF_MS", () => {
    const delay = computeNetworkBackoffMs(1000, { random: () => 0.5 });
    assert.equal(delay, MAX_BACKOFF_MS);
  });
});
