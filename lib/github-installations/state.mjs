import fs from "node:fs/promises";
import path from "node:path";

const INSTALLATION_STATE_FILE = path.join("state", "github-app-installations.json");

export function getGithubAppInstallationStatePath(rootDir) {
  return path.join(rootDir, INSTALLATION_STATE_FILE);
}

export async function loadGithubAppInstallationState(rootDir) {
  const statePath = getGithubAppInstallationStatePath(rootDir);
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    return {
      schemaVersion: 1,
      updatedAt: parsed.updatedAt ?? null,
      installations: Array.isArray(parsed.installations) ? parsed.installations : []
    };
  } catch (error) {
    if (error.code === "ENOENT") {
      return {
        schemaVersion: 1,
        updatedAt: null,
        installations: []
      };
    }
    throw error;
  }
}

export async function writeGithubAppInstallationState(rootDir, state, options = {}) {
  const statePath = getGithubAppInstallationStatePath(rootDir);
  if (options.dryRun) {
    return statePath;
  }
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  return statePath;
}

export function resolveProjectKeyForInstallationRepository(config, fullName, preferredProjectKey = null) {
  const projects = config.projects ?? {};

  if (preferredProjectKey && projects[preferredProjectKey]) {
    return {
      projectKey: preferredProjectKey,
      source: "explicit"
    };
  }

  const repoName = fullName ? String(fullName).split("/").pop() : null;
  if (!repoName) {
    return null;
  }

  for (const [projectKey, project] of Object.entries(projects)) {
    if (projectKey === repoName || path.basename(project.projectRoot ?? "") === repoName) {
      return {
        projectKey,
        source: "repository_match"
      };
    }
  }

  return null;
}
