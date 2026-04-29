import fs from "node:fs";
import path from "node:path";

const REQUEST_TIMEOUT_MS = 2000;
const TOTAL_TIMEOUT_MS = 8000;

export async function detectWatchlistSeed(repoDir, {
  cacheDir = path.join(repoDir, ".wizard-cache"),
  fetchPkg = defaultFetcher,
  maxResults = 5
} = {}) {
  const pkg = readJsonSafe(path.join(repoDir, "package.json"));
  if (!pkg) return { status: "ok", urls: [] };

  const deps = scoreDependencies(pkg);
  if (deps.length === 0) return { status: "ok", urls: [] };

  fs.mkdirSync(cacheDir, { recursive: true });
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const urls = [];
  let networkFailed = false;

  for (const name of deps) {
    if (urls.length >= maxResults) break;
    if (Date.now() > deadline) break;

    const cached = readCache(cacheDir, name);
    if (cached !== undefined) {
      if (cached) urls.push(cached);
      continue;
    }

    try {
      const data = await fetchPkg(name);
      const url = extractGithubUrl(data?.repository?.url);
      writeCache(cacheDir, name, url ?? null);
      if (url) urls.push(url);
    } catch {
      networkFailed = true;
      break;
    }
  }

  if (networkFailed && urls.length === 0) {
    return { status: "offline", urls: [] };
  }
  return { status: "ok", urls };
}

function scoreDependencies(pkg) {
  const scores = new Map();
  for (const name of Object.keys(pkg.dependencies ?? {})) scores.set(name, 2);
  for (const name of Object.keys(pkg.devDependencies ?? {})) {
    scores.set(name, (scores.get(name) ?? 0) + 1);
  }
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

function extractGithubUrl(raw) {
  if (!raw) return null;
  const m = raw.match(/github\.com[:/]([^/]+)\/([^/.#]+)/);
  if (!m) return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}

function cachePath(cacheDir, name) {
  return path.join(cacheDir, encodeURIComponent(name) + ".json");
}

function readCache(cacheDir, name) {
  try {
    const raw = fs.readFileSync(cachePath(cacheDir, name), "utf8");
    return JSON.parse(raw).url;
  } catch { return undefined; }
}

function writeCache(cacheDir, name, url) {
  fs.writeFileSync(cachePath(cacheDir, name), JSON.stringify({ url }), "utf8");
}

function readJsonSafe(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); } catch { return null; }
}

async function defaultFetcher(name) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`https://registry.npmjs.org/${name}`, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally { clearTimeout(timer); }
}
