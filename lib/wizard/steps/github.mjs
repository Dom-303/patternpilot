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
      { key: "", label: "(Enter) übernehmen", default: true },
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
      { key: "", label: "(Enter) wenn fertig", default: true },
      { key: "P", label: "Doch lieber Token-Pfad nehmen" },
      { key: "S", label: "Überspringen" }
    ]);
    if (c === "P") return { source: "none", fallback: "P" };
    if (c === "S") return { source: "none", fallback: "S" };
  }

  prompter.pause?.();
  const ok = await ghLogin();
  prompter.resume?.();
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

const PAT_URL = "https://github.com/settings/tokens/new"
  + "?scopes=public_repo,read:user"
  + "&description=Patternpilot";

async function runPatPath(ctx) {
  const { prompter, state, configDir, validateToken, openBrowser } = ctx;

  // Schritt 1/4 — Browser
  prompter.write("\nSchritt 1 von 4 — Browser öffnen\n");
  prompter.write("─────────────────────────────────\n\n");
  prompter.write("Ich öffne gleich eine GitHub-Seite. Die richtigen Berechtigungen\n");
  prompter.write("sind dort schon vorausgewählt — du musst nur eingeloggt sein.\n\n");
  prompter.write(`  Link:  ${PAT_URL}\n\n`);

  const c1 = await prompter.choose("> ", [
    { key: "", label: "(Enter) Im Browser öffnen", default: true },
    { key: "C", label: "Nur Link kopieren (ich öffne selbst)" },
    { key: "Z", label: "Zurück" }
  ]);
  if (c1 === "Z") {
    state.recordStep("github", { path: "S", reason: "back-from-pat" });
    return { source: "skipped", token: null, user: null };
  }
  if (c1 !== "C") {
    const opened = await openBrowser(PAT_URL);
    if (!opened) prompter.write(`Konnte den Browser nicht öffnen. Link: ${PAT_URL}\n`);
  }

  // Schritt 2/4 — Konfigurieren
  prompter.write("\nSchritt 2 von 4 — Token konfigurieren\n");
  prompter.write("─────────────────────────────────────\n\n");
  prompter.write("Auf der GitHub-Seite siehst du ein Formular. Bitte prüfe:\n\n");
  prompter.write('  Note:        "Patternpilot"           ← schon ausgefüllt\n');
  prompter.write('  Expiration:  "90 days"                ← empfohlen, kannst du ändern\n');
  prompter.write("  Select scopes:\n");
  prompter.write("     [x] public_repo                    ← schon angehakt\n");
  prompter.write("     [x] read:user                      ← schon angehakt\n");
  prompter.write("     ↑ bitte NICHTS weiter ankreuzen\n\n");
  prompter.write('  Ganz unten: grüner Button "Generate token" — drück ihn.\n\n');
  await prompter.ask("[Enter] Habe den Button gedrückt");

  // Schritt 3/4 — Kopieren
  prompter.write("\nSchritt 3 von 4 — Token kopieren\n");
  prompter.write("─────────────────────────────────\n\n");
  prompter.write("⚠  WICHTIG: GitHub zeigt dir den Token nur EIN EINZIGES MAL.\n");
  prompter.write("    Verlässt du die Seite, ist er weg und du musst neu erstellen.\n\n");
  prompter.write("Du siehst jetzt einen grünen Kasten mit einem langen Text,\n");
  prompter.write('der mit "ghp_" beginnt. Daneben ein kleines Kopier-Symbol  ⧉\n\n');
  prompter.write("  → Klick auf das Symbol  (oder markieren + Strg+C)\n\n");
  await prompter.ask("[Enter] Token ist in der Zwischenablage");

  // Schritt 4/4 — Einfügen + validieren
  while (true) {
    prompter.write("\nSchritt 4 von 4 — Token einfügen\n");
    prompter.write("─────────────────────────────────\n\n");
    prompter.write("Hier einfügen mit Strg+V, dann Enter:\n\n");
    const token = await prompter.askMasked("> ");

    prompter.write("\n  Prüfe…\n");
    const v = await validateToken(token);
    if (v.ok) {
      writeTokenFile(configDir, token);
      prompter.write("  ✓ Format korrekt\n");
      prompter.write(`  ✓ Authentifiziert als ${v.user}\n`);
      prompter.write(`  ✓ Scopes: ${(v.scopes || []).join(", ") || "-"}\n\n`);
      prompter.write(`  Gespeichert: ${path.join(configDir, ".env")}\n`);
      state.recordStep("github", { path: "P", user: v.user });
      return { source: "pat", token, user: v.user };
    }

    prompter.write(`  ✗ Token wurde abgelehnt (HTTP ${v.status ?? "?"}).\n`);
    prompter.write("    Mögliche Ursachen:\n");
    prompter.write("      - Token wurde gelöscht oder ist abgelaufen\n");
    prompter.write("      - Token wurde unvollständig eingefügt (zu kurz)\n");
    prompter.write("      - Token ist für GitHub Enterprise, nicht github.com\n\n");

    const c = await prompter.choose("> ", [
      { key: "E", label: "Erneut eingeben", default: true },
      { key: "N", label: "Doch neuen erstellen" },
      { key: "S", label: "Überspringen" }
    ]);
    if (c === "S") {
      state.recordStep("github", { path: "S", reason: "pat-rejected" });
      return { source: "skipped", token: null, user: null };
    }
    if (c === "N") return runPatPath(ctx);
  }
}

function describeSource(d) {
  if (d.source === "gh-cli") return `gh CLI authentifiziert${d.user ? ` als ${d.user}` : ""} (Source: gh auth)`;
  if (d.source === "env") return "Token aus Umgebungsvariable $GITHUB_TOKEN";
  if (d.source === "dotenv") return `Token aus ${path.join("~", ".config", "patternpilot", ".env")}`;
  return d.source;
}

function writeTokenFile(configDir, token) {
  fs.mkdirSync(configDir, { recursive: true });
  const file = path.join(configDir, ".env");
  try { fs.unlinkSync(file); } catch { /* fresh write */ }
  fs.writeFileSync(file, `GITHUB_TOKEN=${token}\n`, { mode: 0o600 });
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
  const isWsl = process.platform === "linux" && /microsoft/i.test(process.env.WSL_DISTRO_NAME ?? "");
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : isWsl ? "wslview"
    : "xdg-open";

  return new Promise((resolve) => {
    const p = spawn(cmd, [url], { stdio: "ignore", shell: process.platform === "win32" });
    p.on("exit", (c) => resolve(c === 0));
    p.on("error", () => {
      if (cmd === "wslview") {
        const fallback = spawn("xdg-open", [url], { stdio: "ignore" });
        fallback.on("exit", (c2) => resolve(c2 === 0));
        fallback.on("error", () => resolve(false));
      } else {
        resolve(false);
      }
    });
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
    writeTokenFile(configDir, token);
    state.recordStep("github", { path: "P", source: "replay" });
    return { source: "pat", token, user: "@replay" };
  }
  state.recordStep("github", { path: "S", source: "replay-fallback" });
  return { source: "skipped", token: null, user: null };
}

export { writeTokenFile };
