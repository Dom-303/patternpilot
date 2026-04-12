import fs from "node:fs/promises";
import https from "node:https";
import path from "node:path";
import {
  safeReadFile,
  asRelativeFromRoot,
  wait,
  decodeBase64Markdown,
  stripMarkdown
} from "./utils.mjs";

export function resolveGithubToken(githubConfig) {
  for (const envName of githubConfig.authEnvVars ?? []) {
    const value = process.env[envName];
    if (value) {
      return {
        token: value,
        envName,
        authMode: "token"
      };
    }
  }

  return {
    token: null,
    envName: null,
    authMode: "anonymous"
  };
}

export function inspectGithubAuth(config) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  return {
    authMode: auth.authMode,
    authSource: auth.envName,
    configuredEnvVars: githubConfig.authEnvVars ?? [],
    tokenPresent: Boolean(auth.token)
  };
}

export function inspectGithubAppAuth() {
  const requiredVars = [
    "PATTERNPILOT_GITHUB_APP_ID",
    "PATTERNPILOT_GITHUB_APP_CLIENT_ID",
    "PATTERNPILOT_GITHUB_APP_CLIENT_SECRET",
    "PATTERNPILOT_GITHUB_APP_PRIVATE_KEY_PATH",
    "PATTERNPILOT_GITHUB_WEBHOOK_SECRET"
  ];
  const presentVars = requiredVars.filter((name) => Boolean(process.env[name]));
  return {
    requiredVars,
    presentVars,
    missingVars: requiredVars.filter((name) => !process.env[name]),
    appReady: requiredVars.every((name) => Boolean(process.env[name]))
  };
}

export function buildSetupChecklist() {
  return {
    pat: {
      envVar: "PATTERNPILOT_GITHUB_TOKEN",
      filePath: ".env.local",
      whereToFind:
        "GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens",
      docsUrl:
        "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
      note:
        "Use a fine-grained PAT with repository read access for the repos Patternpilot should analyze."
    },
    githubApp: [
      {
        key: "PATTERNPILOT_GITHUB_APP_ID",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > App ID",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_CLIENT_ID",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Client ID",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_CLIENT_SECRET",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Generate a new client secret",
        docsUrl:
          "https://docs.github.com/enterprise-cloud@latest/apps/maintaining-github-apps/modifying-a-github-app-registration"
      },
      {
        key: "PATTERNPILOT_GITHUB_APP_PRIVATE_KEY_PATH",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "GitHub > Settings > Developer settings > GitHub Apps > <your app> > General > Private keys > Generate a private key",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps"
      },
      {
        key: "PATTERNPILOT_GITHUB_WEBHOOK_SECRET",
        filePath: "deployment/github-app/.env.local",
        whereToFind:
          "Choose your own secret value when configuring the webhook endpoint for the GitHub App",
        docsUrl:
          "https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries"
      }
    ]
  };
}

export async function initializeEnvFiles(rootDir, options = {}) {
  const templates = [
    {
      source: path.join(rootDir, ".env.example"),
      target: path.join(rootDir, ".env.local")
    },
    {
      source: path.join(rootDir, "deployment/github-app/.env.example"),
      target: path.join(rootDir, "deployment/github-app/.env.local")
    }
  ];
  const results = [];

  for (const template of templates) {
    const sourceContent = await safeReadFile(template.source);
    if (!sourceContent) {
      continue;
    }
    const existing = await safeReadFile(template.target);
    if (existing && !options.force) {
      results.push({
        path: asRelativeFromRoot(rootDir, template.target),
        status: "exists"
      });
      continue;
    }
    if (!options.dryRun) {
      await fs.mkdir(path.dirname(template.target), { recursive: true });
      await fs.writeFile(template.target, sourceContent, "utf8");
    }
    results.push({
      path: asRelativeFromRoot(rootDir, template.target),
      status: options.dryRun ? "planned" : "created"
    });
  }

  return results;
}

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

async function fetchJson(url, headers, timeoutMs) {
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
            if ((response.statusCode ?? 500) < 200 || (response.statusCode ?? 500) >= 300) {
              const message = data?.message || response.statusMessage || "request failed";
              reject(new Error(`GitHub API ${response.statusCode}: ${message}`));
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

export async function runGithubDoctor(config, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);
  const diagnosis = {
    authMode: auth.authMode,
    authSource: auth.envName,
    configuredEnvVars: githubConfig.authEnvVars ?? [],
    tokenPresent: Boolean(auth.token),
    apiBaseUrl: githubConfig.apiBaseUrl ?? "https://api.github.com",
    networkStatus: options.offline ? "skipped_offline" : "not_checked",
    rateLimit: null,
    error: null
  };

  if (options.offline) {
    return diagnosis;
  }

  try {
    const headers = createHeaders(githubConfig, auth);
    const data = await fetchJsonWithRetry(
      `${diagnosis.apiBaseUrl}/rate_limit`,
      headers,
      githubConfig.requestTimeoutMs ?? 12000,
      2
    );
    const core = data?.resources?.core ?? {};
    diagnosis.networkStatus = "ok";
    diagnosis.rateLimit = {
      limit: core.limit ?? null,
      remaining: core.remaining ?? null,
      used: core.used ?? null,
      reset: core.reset ? new Date(core.reset * 1000).toISOString() : null
    };
  } catch (error) {
    diagnosis.networkStatus = "failed";
    diagnosis.error = error.message;
  }

  return diagnosis;
}

export async function enrichGithubRepo(repo, config, options = {}) {
  const githubConfig = config.github ?? {};
  const auth = resolveGithubToken(githubConfig);

  if (options.skipEnrich) {
    return {
      status: "skipped",
      authMode: auth.authMode,
      authSource: auth.envName
    };
  }

  const headers = createHeaders(githubConfig, auth);
  const baseUrl = githubConfig.apiBaseUrl ?? "https://api.github.com";
  const timeoutMs = githubConfig.requestTimeoutMs ?? 12000;

  try {
    const repoData = await fetchJsonWithRetry(
      `${baseUrl}/repos/${repo.owner}/${repo.name}`,
      headers,
      timeoutMs
    );

    let readme = null;
    try {
      const readmeData = await fetchJsonWithRetry(
        `${baseUrl}/repos/${repo.owner}/${repo.name}/readme`,
        headers,
        timeoutMs
      );
      const rawReadme = decodeBase64Markdown(readmeData.content);
      readme = {
        path: readmeData.path,
        htmlUrl: readmeData.html_url,
        excerpt: stripMarkdown(rawReadme, githubConfig.readmeExcerptMaxChars ?? 1600)
      };
    } catch (error) {
      readme = {
        path: null,
        htmlUrl: null,
        excerpt: "",
        error: error.message
      };
    }

    let languages = [];
    try {
      const languagesData = await fetchJsonWithRetry(
        `${baseUrl}/repos/${repo.owner}/${repo.name}/languages`,
        headers,
        timeoutMs
      );
      languages = Object.keys(languagesData);
    } catch {
      languages = [];
    }

    return {
      status: "success",
      authMode: auth.authMode,
      authSource: auth.envName,
      fetchedAt: new Date().toISOString(),
      repo: {
        fullName: repoData.full_name,
        description: repoData.description ?? "",
        homepage: repoData.homepage ?? "",
        topics: repoData.topics ?? [],
        defaultBranch: repoData.default_branch ?? "",
        visibility: repoData.visibility ?? "public",
        archived: Boolean(repoData.archived),
        fork: Boolean(repoData.fork),
        stars: repoData.stargazers_count ?? 0,
        forks: repoData.forks_count ?? 0,
        openIssues: repoData.open_issues_count ?? 0,
        watchers: repoData.watchers_count ?? 0,
        language: repoData.language ?? "",
        license: repoData.license?.spdx_id || repoData.license?.name || "",
        createdAt: repoData.created_at ?? "",
        updatedAt: repoData.updated_at ?? "",
        pushedAt: repoData.pushed_at ?? ""
      },
      languages,
      readme
    };
  } catch (error) {
    return {
      status: "failed",
      authMode: auth.authMode,
      authSource: auth.envName,
      fetchedAt: new Date().toISOString(),
      error: error.message
    };
  }
}
