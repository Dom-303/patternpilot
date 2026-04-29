import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { detectGithubAuth } from "../detect/github-auth.mjs";

export async function runGithubStep({
  prompter, state, replay = null,
  configDir,
  detectFn = detectGithubAuth,
  validateToken = defaultValidate,
  ghLogin = defaultGhLogin,
  openBrowser = defaultOpenBrowser
} = {}) {
  if (replay) return runGithubReplay({ prompter, state, replay, configDir, validateToken });

  const detected = await detectFn({ configDir });

  if (detected.source !== "none") {
    prompter.write(`\n[3/5] GitHub-Zugang gefunden:\n  ✓ ${describeSource(detected)}\n\n`);
    const ans = await prompter.choose("> ", [
      { key: "Enter", label: "übernehmen", default: true },
      { key: "M", label: "manuell anderen Token eingeben" }
    ]);
    if (ans !== "M") {
      writeTokenFile(configDir, detected.token);
      state.recordStep("github", { source: detected.source, user: detected.user });
      return detected;
    }
  }

  return chooseAuthPath({ prompter, state, configDir, validateToken, ghLogin, openBrowser });
}

async function chooseAuthPath(ctx) {
  const { prompter, state, configDir, validateToken, ghLogin, openBrowser } = ctx;
  prompter.write("\n[3/5] GitHub-Zugang einrichten\n\n");
  prompter.write("  gh CLI ist der empfohlene Weg (sicherer, OS-Keychain).\n");
  prompter.write("  Personal Access Token funktioniert genauso, ist aber manueller.\n\n");

  const choice = await prompter.choose("> ", [
    { key: "G", label: "gh CLI verwenden          empfohlen", default: true },
    { key: "P", label: "Personal Access Token     funktioniert auch gut" },
    { key: "S", label: "Überspringen              läuft offline weiter" }
  ]);

  if (choice === "S") {
    state.recordStep("github", { path: "S" });
    return { source: "skipped", token: null, user: null };
  }

  if (choice === "G") {
    const r = await runGhPath({ prompter, ghLogin, configDir });
    if (r.source === "gh-cli") {
      writeTokenFile(configDir, r.token);
      state.recordStep("github", { path: "G", source: "gh-cli", user: r.user });
      return r;
    }
    if (r.fallback === "P") return runPatPath(ctx);
    state.recordStep("github", { path: "S" });
    return { source: "skipped", token: null, user: null };
  }

  return runPatPath(ctx);
}

async function runGhPath({ prompter, ghLogin, configDir }) {
  const installed = await isGhInstalled();
  if (!installed) {
    prompter.write("\ngh ist nicht installiert. Eine Zeile reicht:\n\n");
    prompter.write("    macOS:     brew install gh\n");
    prompter.write("    Linux:     sudo apt install gh    (oder dnf/pacman/yay)\n");
    prompter.write("    Windows:   winget install GitHub.cli\n\n");
    const c = await prompter.choose("> ", [
      { key: "Enter", label: "wenn fertig", default: true },
      { key: "P", label: "Doch lieber Token-Pfad nehmen" },
      { key: "S", label: "Überspringen" }
    ]);
    if (c === "P") return { source: "none", fallback: "P" };
    if (c === "S") return { source: "none", fallback: "S" };
  }

  const ok = await ghLogin();
  if (!ok) {
    prompter.write("gh-Anmeldung wurde abgebrochen oder ist fehlgeschlagen.\n");
    const c = await prompter.choose("> ", [
      { key: "R", label: "Wiederholen", default: true },
      { key: "P", label: "Doch Token-Pfad" },
      { key: "S", label: "Überspringen" }
    ]);
    if (c === "P") return { source: "none", fallback: "P" };
    if (c === "S") return { source: "none", fallback: "S" };
    return runGhPath({ prompter, ghLogin, configDir });
  }

  const token = await readGhToken();
  return { source: "gh-cli", token, user: null };
}

async function runPatPath(ctx) {
  // Placeholder: full 4-step flow comes in Task 10b
  const token = await ctx.prompter.ask("Token:");
  const v = await ctx.validateToken(token);
  if (v.ok) {
    writeTokenFile(ctx.configDir, token);
    ctx.state.recordStep("github", { path: "P", user: v.user });
    return { source: "pat", token, user: v.user };
  }
  return { source: "skipped", token: null, user: null };
}

function describeSource(d) {
  if (d.source === "gh-cli") return `gh CLI authentifiziert${d.user ? ` als ${d.user}` : ""} (Source: gh auth)`;
  if (d.source === "env") return "Token aus Umgebungsvariable $GITHUB_TOKEN";
  if (d.source === "dotenv") return `Token aus ${path.join("~", ".config", "patternpilot", ".env")}`;
  return d.source;
}

function writeTokenFile(configDir, token) {
  fs.mkdirSync(configDir, { recursive: true });
  fs.writeFileSync(path.join(configDir, ".env"), `GITHUB_TOKEN=${token}\n`, { mode: 0o600 });
}

function isGhInstalled() {
  return new Promise((resolve) => {
    const p = spawn(process.platform === "win32" ? "where" : "which", ["gh"], { stdio: "ignore" });
    p.on("exit", (c) => resolve(c === 0));
    p.on("error", () => resolve(false));
  });
}

function defaultGhLogin() {
  return new Promise((resolve) => {
    const p = spawn("gh", ["auth", "login"], { stdio: "inherit" });
    p.on("exit", (c) => resolve(c === 0));
    p.on("error", () => resolve(false));
  });
}

function readGhToken() {
  return new Promise((resolve) => {
    const p = spawn("gh", ["auth", "token"], { stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    p.stdout.on("data", (d) => { out += d.toString(); });
    p.on("exit", (c) => resolve(c === 0 ? out.trim() : null));
    p.on("error", () => resolve(null));
  });
}

function defaultOpenBrowser(url) {
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  return new Promise((resolve) => {
    const p = spawn(cmd, [url], { stdio: "ignore", shell: process.platform === "win32" });
    p.on("exit", (c) => resolve(c === 0));
    p.on("error", () => resolve(false));
  });
}

async function defaultValidate(token) {
  try {
    const res = await fetch("https://api.github.com/user", {
      headers: { Authorization: `token ${token}`, "User-Agent": "patternpilot-wizard" }
    });
    if (!res.ok) return { ok: false, status: res.status };
    const body = await res.json();
    const scopes = (res.headers.get("x-oauth-scopes") || "").split(",").map((s) => s.trim()).filter(Boolean);
    return { ok: true, user: `@${body.login}`, scopes };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function runGithubReplay({ replay, configDir, state, validateToken }) {
  const replayPath = replay.get("github.path");
  if (replayPath === "S") {
    state.recordStep("github", { path: "S", source: "replay" });
    return { source: "skipped", token: null, user: null };
  }
  if (replayPath === "G" && replay.get("github.gh_already_authed") === true) {
    const fakeToken = "ghp_replay_gh";
    writeTokenFile(configDir, fakeToken);
    state.recordStep("github", { path: "G", source: "replay" });
    return { source: "gh-cli", token: fakeToken, user: "@replay" };
  }
  if (replayPath === "P") {
    const token = replay.get("github.token");
    const v = await validateToken(token);
    if (v.ok) writeTokenFile(configDir, token);
    state.recordStep("github", { path: "P", source: "replay" });
    return { source: "pat", token, user: v.user };
  }
  state.recordStep("github", { path: "S", source: "replay-fallback" });
  return { source: "skipped", token: null, user: null };
}

export { writeTokenFile };
