import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { deliverWebhookPayload } from "../../lib/automation/alert-delivery.mjs";

describe("webhook alert channel", () => {
  test("posts JSON payload to configured URL via fetcher", async () => {
    let received = null;
    const fetcher = async (url, init) => {
      received = { url, body: init.body, headers: init.headers };
      return { ok: true, status: 200 };
    };

    const result = await deliverWebhookPayload({
      url: "https://hooks.slack.com/services/X/Y/Z",
      payload: { text: "Test alert", priority: "elevated" }
    }, { fetcher });

    assert.equal(result.ok, true);
    assert.equal(received.url, "https://hooks.slack.com/services/X/Y/Z");
    const ct = received.headers["content-type"] ?? received.headers["Content-Type"];
    assert.match(ct, /application\/json/);
    const body = JSON.parse(received.body);
    assert.equal(body.text, "Test alert");
  });

  test("returns ok=false on non-2xx response without throwing", async () => {
    const fetcher = async () => ({ ok: false, status: 500 });
    const result = await deliverWebhookPayload({
      url: "https://example.com/hook",
      payload: { text: "x" }
    }, { fetcher });
    assert.equal(result.ok, false);
    assert.equal(result.status, 500);
  });

  test("returns ok=false on network error without throwing", async () => {
    const fetcher = async () => { throw new Error("ECONNREFUSED"); };
    const result = await deliverWebhookPayload({
      url: "https://example.com/hook",
      payload: { text: "x" }
    }, { fetcher });
    assert.equal(result.ok, false);
    assert.match(result.error, /ECONNREFUSED/);
  });
});
