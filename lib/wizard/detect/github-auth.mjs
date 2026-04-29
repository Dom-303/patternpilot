import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

export async function detectGithubAuth({
  env = process.env,
  configDir = defaultConfigDir(),
  ghProbe = probeGhCli
} = {}) {
  const gh = await ghProbe();
  if (gh.ok) return { source: "gh-cli", user: gh.user, token: gh.token };

  const envToken = env.GITHUB_TOKEN || env.GH_TOKEN;
  if (envToken) return { source: "env", user: null, token: envToken };

  const dotenvToken = readDotenvToken(path.join(configDir, ".env"));
  if (dotenvToken) return { source: "dotenv", user: null, token: dotenvToken };

  return { source: "none", user: null, token: null };
}

export function defaultConfigDir() {
  if (process.platform === "win32") {
    return path.join(process.env.APPDATA || process.env.HOME, "patternpilot");
  }
  return path.join(process.env.HOME || "/", ".config", "patternpilot");
}

function readDotenvToken(file) {
  try {
    const text = fs.readFileSync(file, "utf8");
    const m = text.match(/^GITHUB_TOKEN=(.+)$/m);
    return m ? m[1].trim() : null;
  } catch { return null; }
}

function probeGhCli() {
  return new Promise((resolve) => {
    const status = spawn("gh", ["auth", "status"], { stdio: "ignore" });
    status.on("error", () => resolve({ ok: false }));
    status.on("exit", (code) => {
      if (code !== 0) return resolve({ ok: false });
      const tok = spawn("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"] });
      let out = "";
      tok.stdout.on("data", (d) => { out += d.toString(); });
      tok.on("error", () => resolve({ ok: false }));
      tok.on("exit", (c2) => {
        if (c2 !== 0) return resolve({ ok: false });
        resolve({ ok: true, user: null, token: out.trim() });
      });
    });
  });
}
