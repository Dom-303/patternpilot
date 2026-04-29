import fs from "node:fs";
import path from "node:path";
import { scanForTargets } from "../detect/target-scan.mjs";

const MANUAL_KEY = "M";

export async function runTargetStep({
  prompter,
  state,
  replay = null,
  scanFn = scanForTargets,
  pathExists = (p) => { try { fs.accessSync(p); return true; } catch { return false; } },
  scanPaths = defaultScanPaths()
} = {}) {
  if (replay) {
    const value = replay.get("target");
    state.recordStep("target", { value, source: "replay" });
    return { path: path.resolve(value) };
  }

  const hits = await scanFn({ paths: scanPaths });
  prompter.write("\n[1/5] Welches Repo soll Patternpilot analysieren?\n\n");

  if (hits.length === 0) {
    prompter.write("Keine Repos automatisch gefunden.\n");
    prompter.write("Anderen Pfad eingeben…\n\n");
    return await readManualPath(prompter, state, pathExists);
  }

  const options = hits.map((h, i) => ({
    key: String(i + 1),
    label: `${h.path}   (${humanMtime(h.mtimeMs)})`,
    default: i === 0
  }));
  options.push({ key: MANUAL_KEY, label: "Anderen Pfad eingeben…" });

  const choice = await prompter.choose("> ", options);
  if (choice !== MANUAL_KEY) {
    const idx = Number(choice) - 1;
    const picked = hits[idx].path;
    state.recordStep("target", { value: picked, source: `auto-scan-${idx + 1}` });
    return { path: picked };
  }
  return await readManualPath(prompter, state, pathExists);
}

async function readManualPath(prompter, state, pathExists) {
  while (true) {
    const manual = await prompter.ask("Pfad:");
    const abs = path.resolve(manual);
    if (pathExists(abs)) {
      state.recordStep("target", { value: abs, source: "manual" });
      return { path: abs };
    }
    prompter.write(`Pfad nicht gefunden: ${abs}\n`);
  }
}

function defaultScanPaths() {
  const home = process.env.HOME || process.env.USERPROFILE || "/";
  return [
    path.resolve(".."),
    path.join(home, "dev"),
    path.join(home, "projects"),
    path.join(home, "code"),
    path.join(home, "src")
  ];
}

function humanMtime(ms) {
  if (!ms) return "unbekannt";
  const days = Math.floor((Date.now() - ms) / 86400000);
  if (days === 0) return "heute";
  if (days === 1) return "gestern";
  if (days < 30) return `vor ${days} Tagen`;
  return `vor ${Math.floor(days / 30)} Monaten`;
}
