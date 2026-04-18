import fs from "node:fs/promises";
import path from "node:path";
import { safeReadFile, asRelativeFromRoot } from "../utils.mjs";

export function buildSetupChecklist() {
  return {
    pat: {
      envVar: "PATTERNPILOT_GITHUB_TOKEN",
      filePath: ".env.local",
      exampleLine: "PATTERNPILOT_GITHUB_TOKEN=github_pat_...",
      whereToFind:
        "GitHub > Settings > Developer settings > Personal access tokens > Fine-grained tokens",
      docsUrl:
        "https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens",
      note:
        "Use a fine-grained PAT with repository read access for the repos Patternpilot should analyze.",
      minimumAccess:
        "Repository access: read-only for the repositories Patternpilot should inspect.",
      verifyWith:
        "Run `npm run doctor`. A healthy result shows `auth_mode: token` and `network_status: ok`."
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
          "https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-your-github-app"
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
