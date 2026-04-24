import fs from "node:fs/promises";
import path from "node:path";
import { asRelativeFromRoot, ensureDirectory } from "./utils.mjs";

export function resolveProjectReportRoot(rootDir, projectKey) {
  return path.join(rootDir, "projects", projectKey, "reports");
}

// Liefert den browser-tauglichen Pfad zu einem Report.
//
// Strategie:
//   1. WSL auf Windows: UNC-Pfad `\\wsl.localhost\<distro>\<path>` — wird
//      von Windows 11 Explorer, Chrome, Edge und Firefox als Datei-URL
//      aufgeloest, ohne dass der Nutzer etwas prefixen muss.
//      (Windows 10 hat analog `\\wsl$\<distro>\...` — beide Formen koennen
//      nebeneinander bestehen, `wsl.localhost` ist seit Win 11 der offizielle
//      Standard. Wer noch Win 10 nutzt, ersetzt einfach das Prefix.)
//   2. Native Windows-Pfad (`C:\...` o.ae.): unveraendert — Browser oeffnen
//      das direkt, die Datei-URL-Konvertierung uebernimmt Windows selbst.
//   3. Linux/macOS absoluter POSIX-Pfad ohne WSL: als `file://`-URI
//      ausliefern, damit er in Terminals, IDEs und Markdown-Viewern
//      klickbar ist. Leerzeichen werden URL-encoded, andere gueltige
//      Pfad-Zeichen bleiben lesbar.
//   4. Relativer Pfad oder sonstiges: unveraendert durchreichen.
export function buildBrowserLinkTarget(reportPath) {
  const distroName = process.env.WSL_DISTRO_NAME;
  if (distroName && path.isAbsolute(reportPath) && reportPath.startsWith("/")) {
    return `\\\\wsl.localhost\\${distroName}${reportPath.replace(/\//g, "\\")}`;
  }
  // Native Windows-Pfad — z.B. `C:\Users\...` oder `\\server\share\...`
  if (/^[a-zA-Z]:[\\/]/.test(reportPath) || reportPath.startsWith("\\\\")) {
    return reportPath;
  }
  // Linux / macOS absolute path → file:// URI damit klickbar
  if (path.isAbsolute(reportPath) && reportPath.startsWith("/")) {
    // Nur echte URL-unsafe Zeichen encoden — Leerzeichen, #, ?, %.
    // Slashes, Buchstaben, Zahlen, Bindestriche und Punkte bleiben
    // lesbar, damit der Pfad als Text weiterhin menschenfreundlich ist.
    const encoded = reportPath.replace(/[\s#?%]/g, (ch) => encodeURIComponent(ch));
    return `file://${encoded}`;
  }
  return reportPath;
}

const SECTION_TITLES = {
  "problem-explore": "Problem-Mode Landscapes",
  "review": "Latest Review Reports",
  "watchlist": "Watchlist Reviews",
  "on-demand": "On-Demand Runs",
  "discovery": "Discovery Runs"
};

function toTitleCase(s) {
  return String(s ?? "Other")
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

function sectionTitleFor(section) {
  return SECTION_TITLES[section] ?? toTitleCase(section);
}

// Wandelt einen Browser-Link-Href zurueck in den POSIX-Pfad, den ein
// WSL-/Linux-User im Terminal mit `wslview` oder `xdg-open` benutzen kann.
// Wird neben dem Windows-UNC-Pfad im Markdown ausgegeben, damit User in
// beiden Welten (Windows-Explorer UND WSL-Shell) direkt den passenden
// Copy-Paste-Wert greifen koennen.
//
// Grund fuer den Doppel-Pfad-Ansatz: VS Code blockiert `file://`-Links
// aus der Markdown-Preview seit 2020 aus Sicherheitsgruenden — ein
// `[Open report](file://...)` laesst sich nicht klicken, egal ob das
// URL-Format stimmt. Zwei klar beschriftete Code-Spans sind ehrlicher
// und auf beiden OS zuverlaessig.
function hrefToPosixPath(href) {
  if (typeof href !== "string" || !href) return null;
  // WSL UNC: \\wsl.localhost\Ubuntu-24.04\home\... -> /home/...
  const wslMatch = href.match(/^\\\\(?:wsl\.localhost|wsl\$)\\[^\\]+\\(.*)$/);
  if (wslMatch) return "/" + wslMatch[1].replace(/\\/g, "/");
  // file://wsl.localhost/<distro>/<path>         -> /<path>
  const wslFileMatch = href.match(/^file:\/\/(?:wsl\.localhost|wsl\$)\/[^/]+\/(.*)$/);
  if (wslFileMatch) return "/" + wslFileMatch[1];
  // POSIX-Pfad bleibt wie er ist
  if (href.startsWith("/")) return href;
  return null;
}

function renderBrowserLinkMarkdown(state) {
  const lines = [
    "# Pattern Pilot — Browser Links",
    "",
    "> **So oeffnest du einen Report:** Pfad markieren, Strg+C, in die Adressleiste deines Browsers oder Windows Explorers einfuegen.",
    "> Falls du aus WSL heraus oeffnen willst: `wslview <pfad>` (oeffnet im Windows-Browser) oder `xdg-open <pfad>` (Linux-Browser).",
    ""
  ];
  if (state.updated_at) {
    lines.push(`_Last updated: ${state.updated_at}_`, "");
  }
  const sectionEntries = Object.entries(state.sections ?? {})
    .filter(([, entries]) => entries && Object.keys(entries).length > 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (sectionEntries.length === 0) {
    lines.push("_No entries yet._", "");
    return `${lines.join("\n")}\n`;
  }
  for (const [sectionKey, entries] of sectionEntries) {
    lines.push(`## ${sectionTitleFor(sectionKey)}`, "");
    const entryList = Object.entries(entries).sort(([a], [b]) => a.localeCompare(b));
    for (const [entryKey, entry] of entryList) {
      const label = entry.label ?? entryKey;
      const updated = entry.updated_at ? ` _(updated ${entry.updated_at.slice(0, 10)})_` : "";
      // Plain-Text-Pfade, KEINE Backticks / Markdown-Links — beides hat
      // sich in VS Code als copy-paste-feindlich erwiesen. Dieses Format
      // hat vorher zuverlaessig funktioniert: markieren mit Maus, Strg+C,
      // direkt in Windows-Explorer-Adressleiste einfuegen — fertig.
      const posix = hrefToPosixPath(entry.href);
      const block = [`- **${label}**${updated}`, `  ${entry.href}`];
      if (posix) block.push(`  WSL: ${posix}`);
      block.push("");
      lines.push(...block);
    }
  }
  return `${lines.join("\n")}\n`;
}

function statePathFor(browserLinkPath) {
  return `${browserLinkPath}.state.json`;
}

async function readState(statePath) {
  try {
    const raw = await fs.readFile(statePath, "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.sections && typeof parsed.sections === "object") {
      return parsed;
    }
  } catch {
    // Corrupt or missing — start fresh.
  }
  return { updated_at: null, sections: {} };
}

export async function pushBrowserLink(browserLinkPath, entry) {
  if (!entry || typeof entry !== "object"
    || typeof entry.section !== "string" || !entry.section
    || typeof entry.key !== "string" || !entry.key
    || typeof entry.href !== "string" || !entry.href) {
    throw new Error("pushBrowserLink requires entry with non-empty { section, key, href } (label optional)");
  }
  const now = new Date().toISOString();
  const statePath = statePathFor(browserLinkPath);
  const state = await readState(statePath);
  state.sections[entry.section] = state.sections[entry.section] ?? {};
  state.sections[entry.section][entry.key] = {
    label: entry.label ?? entry.key,
    href: entry.href,
    updated_at: now
  };
  state.updated_at = now;
  await fs.writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await fs.writeFile(browserLinkPath, renderBrowserLinkMarkdown(state), "utf8");
  return state;
}

export async function writeLatestReportPointers({
  rootDir,
  projectKey,
  reportPath,
  createdAt,
  runId,
  command,
  reportKind,
  agentHandoffPayload = null,
  dryRun = false
}) {
  const absoluteReportPath = path.isAbsolute(reportPath)
    ? reportPath
    : path.join(rootDir, reportPath);
  const reportRoot = resolveProjectReportRoot(rootDir, projectKey);
  const browserLinkPath = path.join(reportRoot, "browser-link");
  const latestReportPath = path.join(reportRoot, "latest-report.json");
  const agentHandoffPath = path.join(reportRoot, "agent-handoff.json");
  const relativeReportPath = asRelativeFromRoot(rootDir, absoluteReportPath);
  const relativeAgentHandoffPath = agentHandoffPayload
    ? asRelativeFromRoot(rootDir, agentHandoffPath)
    : null;
  const browserLink = buildBrowserLinkTarget(absoluteReportPath);
  const payload = {
    projectKey,
    reportKind,
    command,
    createdAt,
    runId,
    reportPath: relativeReportPath,
    browserLink,
    agentHandoffPath: relativeAgentHandoffPath
  };
  const handoffArtifact = agentHandoffPayload
    ? {
        schemaVersion: 1,
        projectKey,
        reportKind,
        command,
        createdAt,
        runId,
        reportPath: relativeReportPath,
        handoff: agentHandoffPayload
      }
    : null;

  if (!dryRun) {
    await ensureDirectory(reportRoot, false);
    await pushBrowserLink(browserLinkPath, {
      section: reportKind ?? "other",
      key: "latest",
      label: reportKind ? `Latest ${reportKind}` : "Latest report",
      href: browserLink
    });
    await fs.writeFile(latestReportPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    if (handoffArtifact) {
      await fs.writeFile(agentHandoffPath, `${JSON.stringify(handoffArtifact, null, 2)}\n`, "utf8");
    }
  }

  return {
    browserLink,
    browserLinkPath,
    latestReportPath,
    agentHandoffPath,
    relativeAgentHandoffPath,
    handoffArtifact,
    payload,
    relativeReportPath
  };
}
