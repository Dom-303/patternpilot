import fs from "node:fs";
import path from "node:path";

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "of", "for", "to", "in", "on", "with", "from",
  "der", "die", "das", "ein", "eine", "und", "oder", "von", "fuer", "für",
  "im", "auf", "mit", "aus", "ist", "sind", "dieser", "diese", "dieses"
]);

const CONTEXT_CANDIDATES = [
  "CLAUDE.md", "AGENT_CONTEXT.md", "AGENTS.md", "GEMINI.md", "README.md"
];

export function detectProjectContext(repoDir) {
  const pkg = readJsonSafe(path.join(repoDir, "package.json"));
  const readme = readFileSafe(path.join(repoDir, "README.md"));

  return {
    label: deriveLabel(pkg, repoDir),
    language: deriveLanguage(repoDir, pkg),
    domainHint: deriveDomainHint(readme),
    contextFiles: collectContextFiles(repoDir),
    repoDir
  };
}

function deriveLabel(pkg, repoDir) {
  if (pkg?.name) return titleCase(pkg.name.replace(/[-_]/g, " "));
  return titleCase(path.basename(repoDir));
}

function deriveLanguage(repoDir, pkg) {
  if (pkg?.type === "module") return "Node.js (ESM)";
  if (pkg) return "Node.js (CommonJS)";
  if (existsSafe(path.join(repoDir, "requirements.txt"))) return "Python";
  if (existsSafe(path.join(repoDir, "pyproject.toml"))) return "Python";
  if (existsSafe(path.join(repoDir, "go.mod"))) return "Go";
  if (existsSafe(path.join(repoDir, "Cargo.toml"))) return "Rust";
  return "unbekannt";
}

function deriveDomainHint(readme) {
  if (!readme) return "";
  const headlineMatch = readme.match(/^#\s+(.+?)$/m);
  const headline = headlineMatch ? headlineMatch[1] : "";
  const body = readme.slice(0, 200);
  const text = (headline + " " + body).toLowerCase();
  const words = text.match(/[a-zäöüß]{4,}/g) ?? [];
  const counts = new Map();
  for (const w of words) {
    if (STOP_WORDS.has(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([w]) => w)
    .join(" / ");
}

function collectContextFiles(repoDir) {
  return CONTEXT_CANDIDATES.filter((f) => existsSafe(path.join(repoDir, f)));
}

function titleCase(s) {
  return s.split(/\s+/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function existsSafe(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
