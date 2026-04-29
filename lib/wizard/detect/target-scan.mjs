import fs from "node:fs";
import path from "node:path";

export async function scanForTargets({
  paths = [],
  maxDepth = 2,
  maxResults = 3,
  timeoutMs = 3000
} = {}) {
  const deadline = Date.now() + timeoutMs;
  const hits = [];

  for (const root of paths) {
    if (Date.now() > deadline) break;
    if (!safeExists(root)) continue;
    walk(root, 0, maxDepth, deadline, hits);
  }

  hits.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return hits.slice(0, maxResults);
}

function walk(dir, depth, maxDepth, deadline, out) {
  if (depth >= maxDepth) return;
  if (Date.now() > deadline) return;

  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }

  for (const e of entries) {
    if (Date.now() > deadline) return;
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".")) continue;

    const child = path.join(dir, e.name);
    if (isCandidate(child)) {
      const mtimeMs = readableMtime(child);
      out.push({ path: child, mtimeMs });
    } else {
      walk(child, depth + 1, maxDepth, deadline, out);
    }
  }
}

function isCandidate(dir) {
  return safeExists(path.join(dir, ".git"))
    && (safeExists(path.join(dir, "README.md")) || safeExists(path.join(dir, "package.json")));
}

function readableMtime(dir) {
  const probes = ["README.md", "package.json"];
  let max = 0;
  for (const p of probes) {
    try {
      const st = fs.statSync(path.join(dir, p));
      if (st.mtimeMs > max) max = st.mtimeMs;
    } catch { /* skip */ }
  }
  return max;
}

function safeExists(p) {
  try { fs.accessSync(p); return true; } catch { return false; }
}
