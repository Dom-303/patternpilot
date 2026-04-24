// lib/github/rate-limit.mjs
//
// Phase-3-Kern aus docs/foundation/SCORE_STABILITY_PLAN.md:
// Pure Helper fuer Rate-Limit-Detection und Backoff-Berechnung.
//
// GitHub signalisiert Rate-Limits auf drei Wegen:
//   1) Primary rate limit — HTTP 403 mit "rate limit exceeded" im Body,
//      zusaetzlich Header `x-ratelimit-remaining: 0` und
//      `x-ratelimit-reset: <unix-ts>`.
//   2) Secondary rate limit — HTTP 403 mit "secondary rate limit" oder
//      "abuse detection". Optional `retry-after: <seconds>` Header.
//   3) Search API hard limit — 422 oder 403 mit "search rate limit".
//
// Dieses Modul erkennt alle drei Varianten und liefert eine empfohlene
// Wartezeit zurueck, gekappt auf MAX_BACKOFF_MS damit ein einzelner
// Request nie laenger als ~90s haengt.

export const MAX_BACKOFF_MS = 90_000;
const BASE_BACKOFF_MS = 2_000;
const JITTER_FACTOR = 0.2;

const RATE_LIMIT_MESSAGE_PATTERNS = [
  /api rate limit exceeded/i,
  /\brate limit exceeded\b/i,
  /secondary rate limit/i,
  /abuse detection/i,
  /search rate limit/i,
];

export function isRateLimitError(error) {
  if (!error || typeof error !== 'object') return false;
  if (error.statusCode === 403 || error.statusCode === 429) {
    const remaining = error.responseHeaders?.['x-ratelimit-remaining'];
    if (remaining !== undefined && Number(remaining) === 0) return true;
    if (typeof error.message === 'string') {
      return RATE_LIMIT_MESSAGE_PATTERNS.some((pattern) => pattern.test(error.message));
    }
  }
  return false;
}

function clampBackoff(ms) {
  if (!Number.isFinite(ms) || ms < 0) return BASE_BACKOFF_MS;
  return Math.min(ms, MAX_BACKOFF_MS);
}

function addJitter(ms, random = Math.random) {
  if (ms <= 0) return 0;
  const jitter = ms * JITTER_FACTOR * (random() - 0.5) * 2;
  return Math.max(0, Math.round(ms + jitter));
}

export function extractResetDelayMs(error, { now = Date.now } = {}) {
  const headers = error?.responseHeaders ?? {};
  const retryAfter = headers['retry-after'];
  if (retryAfter !== undefined) {
    const asNumber = Number(retryAfter);
    if (Number.isFinite(asNumber) && asNumber >= 0) {
      return clampBackoff(asNumber * 1000);
    }
    // Retry-After can also be an HTTP-date.
    const asDate = Date.parse(retryAfter);
    if (Number.isFinite(asDate)) {
      return clampBackoff(asDate - now());
    }
  }
  const reset = headers['x-ratelimit-reset'];
  if (reset !== undefined) {
    const epoch = Number(reset);
    if (Number.isFinite(epoch)) {
      return clampBackoff(epoch * 1000 - now());
    }
  }
  return null;
}

export function computeRateLimitBackoffMs(error, attempt, options = {}) {
  const { now = Date.now, random = Math.random } = options;
  const resetDelay = extractResetDelayMs(error, { now });
  if (resetDelay !== null && resetDelay > 0) {
    return addJitter(clampBackoff(resetDelay), random);
  }
  // No usable reset header — exponential backoff with jitter, up to MAX.
  const exp = BASE_BACKOFF_MS * Math.pow(2, Math.max(0, attempt - 1));
  return addJitter(clampBackoff(exp), random);
}

export function computeNetworkBackoffMs(attempt, options = {}) {
  const { random = Math.random } = options;
  const base = 800 * Math.max(1, attempt);
  return addJitter(clampBackoff(base), random);
}
