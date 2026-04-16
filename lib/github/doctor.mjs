import { resolveGithubToken } from "./auth.mjs";
import { createHeaders, fetchJsonWithRetry } from "./api-client.mjs";

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
