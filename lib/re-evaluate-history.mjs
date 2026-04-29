import fs from "node:fs/promises";
import path from "node:path";

export async function appendReEvaluateRun(rootDir, entry) {
  const dir = path.join(rootDir, "state");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "re-evaluate-history.json");

  const existing = await readJsonSafe(file);
  const data = existing ?? { runs: [] };
  data.runs.push({
    timestamp: new Date().toISOString(),
    ...entry
  });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function readReEvaluateHistory(rootDir) {
  const file = path.join(rootDir, "state", "re-evaluate-history.json");
  return (await readJsonSafe(file)) ?? { runs: [] };
}

async function readJsonSafe(file) {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text);
  } catch { return null; }
}
