import fs from "node:fs/promises";
import path from "node:path";

import {
  loadProjectBinding,
  loadQueueEntries,
  loadLandkarteEntries,
  normalizeGithubUrl
} from "../../lib/index.mjs";
import { buildDecidePrompt, decidePromptPath } from "../../lib/decide/prompt-builder.mjs";

export async function runDecidePrompt(rootDir, config, options) {
  const projectKey = options.project || config.defaultProject;
  if (!projectKey) {
    throw new Error("decide-prompt requires --project <key> or a default project in config.");
  }

  const inputUrl = (options.urls?.[0] ?? "").trim();
  if (!inputUrl) {
    throw new Error("decide-prompt requires a repo URL as positional argument.");
  }

  const repo = normalizeGithubUrl(inputUrl);
  const normalizedUrl = repo.normalizedRepoUrl;

  const { project } = await loadProjectBinding(rootDir, config, projectKey);
  const queueRows = await loadQueueEntries(rootDir, config);
  const landkarteRows = await loadLandkarteEntries(rootDir, config);

  const queueEntry = queueRows.find((row) =>
    row.project_key === projectKey
    && (row.normalized_repo_url === normalizedUrl || row.repo_url === inputUrl)
  );
  if (!queueEntry) {
    throw new Error(`Repo ${normalizedUrl} not found in queue for project '${projectKey}'. Run intake first.`);
  }

  const landkarteEntry = landkarteRows.find((row) =>
    row.repo_url === normalizedUrl || row.repo_url === inputUrl
  ) ?? null;

  const projectContextSnippet = await loadProjectContextSnippet(rootDir, project);

  const prompt = buildDecidePrompt({
    projectKey,
    projectLabel: project.label ?? projectKey,
    projectContextSnippet,
    queueEntry,
    landkarteEntry
  });

  const promptPath = decidePromptPath(rootDir, projectKey, normalizedUrl);
  await fs.mkdir(path.dirname(promptPath), { recursive: true });
  await fs.writeFile(promptPath, prompt, "utf8");

  console.log(`# Patternpilot Decide-Prompt`);
  console.log(``);
  console.log(`- project: ${projectKey}`);
  console.log(`- repo: ${normalizedUrl}`);
  console.log(`- queue_match: yes`);
  console.log(`- landkarte_match: ${landkarteEntry ? "yes" : "no"}`);
  console.log(`- prompt_file: ${path.relative(rootDir, promptPath)}`);
  console.log(``);
  console.log(`## Next Steps`);
  console.log(`1. Open ${path.relative(rootDir, promptPath)} and copy its content into your LLM (Claude / ChatGPT / Gemini).`);
  console.log(`2. Optionally add your own thoughts at the placeholder at the end.`);
  console.log(`3. Take the LLM's structured decision and paste it into knowledge/repo_decisions.md (or update the 'decision' column in knowledge/repo_landkarte.csv).`);
}

async function loadProjectContextSnippet(rootDir, project) {
  if (!project.projectContextFile) return "_(kein PROJECT_CONTEXT.md gefunden)_";
  const file = path.join(rootDir, project.projectContextFile);
  try {
    const content = await fs.readFile(file, "utf8");
    return content.length > 1500 ? content.slice(0, 1500) + "\n…(gekürzt)" : content;
  } catch {
    return "_(PROJECT_CONTEXT.md nicht lesbar)_";
  }
}
