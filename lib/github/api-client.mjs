import https from "node:https";
import { wait } from "../utils.mjs";

export function createHeaders(githubConfig, auth) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": githubConfig.userAgent ?? "patternpilot"
  };
  if (auth.token) {
    headers.Authorization = `Bearer ${auth.token}`;
  }
  return headers;
}

async function fetchJson(url, headers, timeoutMs, redirectsLeft = 4) {
  return new Promise((resolve, reject) => {
    const request = https.request(
      new URL(url),
      {
        method: "GET",
        headers,
        timeout: timeoutMs
      },
      (response) => {
        let payload = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          payload += chunk;
        });
        response.on("end", () => {
          try {
            const data = payload ? JSON.parse(payload) : {};
            const redirectLocation = response.headers?.location ?? null;
            const statusCode = response.statusCode ?? 500;
            if (statusCode >= 300 && statusCode < 400 && redirectLocation) {
              if (redirectsLeft <= 0) {
                reject(new Error(`GitHub API redirect loop detected: ${url}`));
                return;
              }
              const nextUrl = new URL(redirectLocation, url).toString();
              fetchJson(nextUrl, headers, timeoutMs, redirectsLeft - 1).then(resolve, reject);
              return;
            }
            if (statusCode < 200 || statusCode >= 300) {
              const message = data?.message || response.statusMessage || "request failed";
              reject(new Error(`GitHub API ${statusCode}: ${message}`));
              return;
            }
            resolve(data);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", (error) => {
      reject(error);
    });
    request.on("timeout", () => {
      request.destroy(new Error("request aborted"));
    });
    request.end();
  });
}

function shouldRetryGithubError(error) {
  const message = error?.message ?? "";
  return (
    message.includes("fetch failed") ||
    message.includes("aborted") ||
    message.includes("EAI_AGAIN") ||
    message.includes("ENOTFOUND") ||
    message.includes("ECONNRESET")
  );
}

export async function fetchJsonWithRetry(url, headers, timeoutMs, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchJson(url, headers, timeoutMs);
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !shouldRetryGithubError(error)) {
        throw error;
      }
      await wait(800 * attempt);
    }
  }
  throw lastError;
}
