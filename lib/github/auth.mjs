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
