import fs from "node:fs";
import path from "node:path";

export function createWizardState() {
  return {
    started_at: new Date().toISOString(),
    completed_at: null,
    outcome: "in_progress",
    steps: [],
    recordStep(name, payload) {
      this.steps.push({ name, ...payload });
    }
  };
}

export function appendHistory(rootDir, state) {
  const dir = path.join(rootDir, "state");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "wizard-history.json");

  const existing = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : { runs: [] };

  const { recordStep, ...persisted } = state;
  existing.runs.push(persisted);
  fs.writeFileSync(file, JSON.stringify(existing, null, 2), "utf8");
}

export function readHistory(rootDir) {
  const file = path.join(rootDir, "state", "wizard-history.json");
  if (!fs.existsSync(file)) return { runs: [] };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
