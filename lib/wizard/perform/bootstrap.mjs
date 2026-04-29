import fs from "node:fs/promises";
import path from "node:path";
import { initializeProjectBinding } from "../../project.mjs";
import { slugifyProjectKey } from "../../utils.mjs";

export async function performBootstrap(rootDir, config, {
  target,
  label,
  projectKey = null,
  watchlistUrls = [],
  makeDefault = true
}) {
  const derivedKey = projectKey || slugifyProjectKey(label);
  const result = await initializeProjectBinding(rootDir, config, {
    target,
    label,
    project: derivedKey,
    makeDefault,
    dryRun: false
  });

  if (watchlistUrls.length > 0) {
    const watchlistPath = path.join(rootDir, "bindings", result.projectKey, "WATCHLIST.txt");
    const existing = await fs.readFile(watchlistPath, "utf8").catch(() => "");
    const additions = watchlistUrls.map((u) => u.trim()).filter(Boolean).join("\n");
    await fs.writeFile(watchlistPath, existing + additions + "\n", "utf8");
  }

  return result;
}
