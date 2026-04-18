import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import https from "node:https";

import { fetchJsonWithRetry } from "../lib/github/api-client.mjs";

test("fetchJsonWithRetry follows GitHub API redirects before resolving JSON", async () => {
  const originalRequest = https.request;
  const requestedUrls = [];

  https.request = (url, options, callback) => {
    const request = new EventEmitter();
    request.destroy = (error) => {
      if (error) {
        request.emit("error", error);
      }
    };
    request.end = () => {
      setImmediate(() => {
        const response = new EventEmitter();
        response.setEncoding = () => {};
        requestedUrls.push(url.toString());

        if (requestedUrls.length === 1) {
          response.statusCode = 301;
          response.statusMessage = "Moved Permanently";
          response.headers = {
            location: "https://api.github.com/repos/calcom/cal"
          };
          callback(response);
          response.emit("data", JSON.stringify({ message: "Moved Permanently" }));
          response.emit("end");
          return;
        }

        response.statusCode = 200;
        response.statusMessage = "OK";
        response.headers = {};
        callback(response);
        response.emit("data", JSON.stringify({ full_name: "calcom/cal" }));
        response.emit("end");
      });
    };
    return request;
  };

  try {
    const data = await fetchJsonWithRetry("https://api.github.com/repos/calcom/cal.com", {}, 1000);
    assert.deepEqual(data, { full_name: "calcom/cal" });
    assert.deepEqual(requestedUrls, [
      "https://api.github.com/repos/calcom/cal.com",
      "https://api.github.com/repos/calcom/cal"
    ]);
  } finally {
    https.request = originalRequest;
  }
});
