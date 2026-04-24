import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import https from "node:https";

import { fetchJsonWithRetry, shouldRetryGithubError } from "../lib/github/api-client.mjs";

function mockHttps(responses) {
  const original = https.request;
  let callIndex = 0;
  const calls = [];
  https.request = (url, _options, callback) => {
    const request = new EventEmitter();
    request.destroy = (error) => {
      if (error) request.emit("error", error);
    };
    request.end = () => {
      setImmediate(() => {
        const entry = responses[callIndex] ?? responses[responses.length - 1];
        callIndex += 1;
        calls.push(url.toString());
        const response = new EventEmitter();
        response.setEncoding = () => {};
        response.statusCode = entry.statusCode;
        response.statusMessage = entry.statusMessage ?? "";
        response.headers = entry.headers ?? {};
        callback(response);
        response.emit("data", entry.body ?? "");
        response.emit("end");
      });
    };
    return request;
  };
  return {
    restore: () => {
      https.request = original;
    },
    calls,
  };
}

test("fetchJsonWithRetry surfaces statusCode and headers on a 4xx error", async () => {
  const mock = mockHttps([
    {
      statusCode: 404,
      statusMessage: "Not Found",
      headers: { "x-ratelimit-remaining": "42" },
      body: JSON.stringify({ message: "Not Found" }),
    },
  ]);
  try {
    await assert.rejects(
      fetchJsonWithRetry("https://api.github.com/repos/x/y", {}, 500, 1),
      (error) => {
        assert.equal(error.statusCode, 404);
        assert.equal(error.responseHeaders["x-ratelimit-remaining"], "42");
        assert.match(error.message, /404.*Not Found/);
        return true;
      },
    );
  } finally {
    mock.restore();
  }
});

test("fetchJsonWithRetry retries on 403 rate-limit and succeeds on second attempt", async () => {
  const now = 1_700_000_000_000;
  const resetEpoch = Math.floor(now / 1000) + 1; // 1 s in the future
  const mock = mockHttps([
    {
      statusCode: 403,
      statusMessage: "Forbidden",
      headers: {
        "x-ratelimit-remaining": "0",
        "x-ratelimit-reset": String(resetEpoch),
      },
      body: JSON.stringify({ message: "API rate limit exceeded for user" }),
    },
    {
      statusCode: 200,
      headers: {},
      body: JSON.stringify({ full_name: "x/y" }),
    },
  ]);
  try {
    // Use a fake wait function so the test doesn't actually sleep.
    let waited = 0;
    const data = await fetchJsonWithRetry(
      "https://api.github.com/repos/x/y",
      {},
      500,
      3,
      {
        waitFn: async (ms) => {
          waited += ms;
        },
      },
    );
    assert.deepEqual(data, { full_name: "x/y" });
    assert.equal(mock.calls.length, 2, "should have retried once");
    assert.ok(waited > 0, "should have waited for backoff");
  } finally {
    mock.restore();
  }
});

test("fetchJsonWithRetry does not retry a plain 404 (not rate-limit, not network)", async () => {
  const mock = mockHttps([
    { statusCode: 404, headers: {}, body: JSON.stringify({ message: "Not Found" }) },
    { statusCode: 200, headers: {}, body: JSON.stringify({ ok: true }) },
  ]);
  try {
    let waited = 0;
    await assert.rejects(
      fetchJsonWithRetry(
        "https://api.github.com/repos/x/y",
        {},
        500,
        3,
        {
          waitFn: async (ms) => {
            waited += ms;
          },
        },
      ),
      /404/,
    );
    assert.equal(mock.calls.length, 1, "should not have retried a 404");
    assert.equal(waited, 0);
  } finally {
    mock.restore();
  }
});

test("fetchJsonWithRetry gives up after attempts for persistent rate limit", async () => {
  const persistent = {
    statusCode: 403,
    headers: { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "1" },
    body: JSON.stringify({ message: "rate limit exceeded" }),
  };
  const mock = mockHttps([persistent, persistent, persistent]);
  try {
    await assert.rejects(
      fetchJsonWithRetry(
        "https://api.github.com/repos/x/y",
        {},
        500,
        3,
        { waitFn: async () => {} },
      ),
      (error) => {
        assert.equal(error.statusCode, 403);
        return true;
      },
    );
    assert.equal(mock.calls.length, 3, "should use all 3 attempts");
  } finally {
    mock.restore();
  }
});

test("shouldRetryGithubError is true for rate-limit, false for ordinary 4xx", () => {
  assert.equal(
    shouldRetryGithubError({
      statusCode: 403,
      responseHeaders: { "x-ratelimit-remaining": "0" },
      message: "rate limit exceeded",
    }),
    true,
  );
  assert.equal(
    shouldRetryGithubError({
      statusCode: 404,
      responseHeaders: {},
      message: "Not Found",
    }),
    false,
  );
  assert.equal(
    shouldRetryGithubError({ message: "ENOTFOUND api.github.com" }),
    true,
  );
});
