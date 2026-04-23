// scripts/generate-styleguide.mjs
//
// Erzeugt docs/reference/REPORT_UI_TOKENS.html aus den Cockpit-Night-
// Tokens + Komponenten-Primitives. Ein statischer visueller Styleguide.

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import {
  COCKPIT_NIGHT_FONTS_HEAD,
  COCKPIT_NIGHT_BASE_CSS
} from "../lib/html/tokens.mjs";
import {
  renderCockpitHero,
  renderSectionBreak,
  renderContentIntro,
  renderSidenav,
  renderInfoButton,
  renderInfoDialog,
  renderStatCard,
  renderStatGrid,
  renderSectionCard,
  renderRepoRow,
  renderAxisRow,
  renderMetaGrid,
  renderInfoCard,
  renderInfoGrid,
  INFO_DIALOG_SCRIPT
} from "../lib/html/components.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../docs/reference/REPORT_UI_TOKENS.html");

const tokenSwatches = [
  { name: "--bg", value: "#0e131f", role: "Body-Hintergrund" },
  { name: "--bg-card", value: "#1c2338", role: "Dunkle Content-Karte" },
  { name: "--ink", value: "#f1f3f9", role: "Primaere Schrift" },
  { name: "--ink-soft", value: "#aeb4c3", role: "Weiche Schrift" },
  { name: "--ink-muted", value: "#727891", role: "Gedaempfte Schrift" },
  { name: "--rule", value: "#323a56", role: "Trennlinie" },
  { name: "--neon-magenta", value: "#ff3d97", role: "Primaer-Akzent" },
  { name: "--neon-pink", value: "#ff7ab0", role: "Sekundaer-Akzent" },
  { name: "--neon-orange", value: "#ff9a48", role: "Warn-Akzent" },
  { name: "--neon-green", value: "#66e87a", role: "Adopt-Akzent" },
  { name: "--neon-purple", value: "#a97aff", role: "Observe-Akzent" },
  { name: "--neon-cyan", value: "#5de5ed", role: "Info-Akzent" },
  { name: "--card-bg", value: "#ffffff", role: "Weisse Daten-Karte" },
  { name: "--card-ink", value: "#0e131f", role: "Schrift auf Karte" },
  { name: "--card-green", value: "#1e8a33", role: "Adopt-Badge" },
  { name: "--card-orange", value: "#c24d00", role: "Adapt-Badge" },
  { name: "--card-purple", value: "#5b35c4", role: "Observe-Badge" }
];

const tokenSwatchGrid = `<div class="token-swatch-grid">
${tokenSwatches.map((t) => `<div class="token-swatch">
  <div class="token-swatch-chip" style="background: ${t.value}"></div>
  <div class="token-swatch-meta">
    <div class="token-swatch-name">${t.name}</div>
    <div class="token-swatch-role">${t.role}</div>
    <div class="token-swatch-value">${t.value}</div>
  </div>
</div>`).join("")}
</div>`;

const typographySample = `<div class="type-stack">
  <div class="type-row">
    <div class="type-row-demo"><span style="font-family:'Syne',sans-serif;font-weight:800;font-size:60px;line-height:0.95;letter-spacing:-0.04em;text-transform:uppercase;">Pattern</span></div>
    <div class="type-row-meta">Syne 800 · Hero H1 · clamp(60px, 9vw, 108px)</div>
  </div>
  <div class="type-row">
    <div class="type-row-demo"><span style="font-family:'Syne',sans-serif;font-weight:700;font-size:40px;letter-spacing:-0.025em;">Cluster — Record-Linkage</span></div>
    <div class="type-row-meta">Syne 700 · Content-Intro Subject · clamp(30px, 4vw, 50px)</div>
  </div>
  <div class="type-row">
    <div class="type-row-demo"><span style="font-family:'Syne',sans-serif;font-weight:700;font-size:22px;text-transform:uppercase;letter-spacing:-0.01em;">Section-Head</span></div>
    <div class="type-row-meta">Syne 700 · Section-Preview H2 · 22px</div>
  </div>
  <div class="type-row">
    <div class="type-row-demo"><span style="font-family:'IBM Plex Sans',sans-serif;font-weight:400;font-size:17px;line-height:1.55;">Die Intelligenz-Schicht zwischen externen Repos und Entscheidungen.</span></div>
    <div class="type-row-meta">IBM Plex Sans 400 · Slogan · 17px</div>
  </div>
  <div class="type-row">
    <div class="type-row-demo"><span style="font-family:'JetBrains Mono',monospace;font-weight:600;font-size:11px;letter-spacing:0.22em;text-transform:uppercase;color:var(--ink-muted);">Eyebrow / Meta</span></div>
    <div class="type-row-meta">JetBrains Mono 600 · Eyebrow · 10-12px</div>
  </div>
  <div class="type-row">
    <div class="type-row-demo"><span style="font-family:'Syne',sans-serif;font-weight:700;font-size:48px;letter-spacing:-0.03em;font-variant-numeric:tabular-nums;">12,4</span></div>
    <div class="type-row-meta">Syne 700 · KPI-Value · 48px tabular-nums</div>
  </div>
</div>`;

const heroSample = `<div class="sample-frame">
  ${renderCockpitHero({ title: "Pattern", pilotWord: "Pilot", slogan: "Die Intelligenz-Schicht zwischen externen Repos und konkreten Entscheidungen fuer dein Zielprojekt." })}
  ${renderSectionBreak()}
</div>`;

const contentIntroSample = `<div class="sample-frame">
  ${renderContentIntro({
    eyebrow: "Problem-Landkarte",
    subject: "Event-Deduplication ueber heterogene Quellen",
    subjectId: "event-deduplication-across-heterogenous-sources",
    meta: [
      { label: "12 Kandidaten" },
      { label: "3 Cluster" },
      { label: "1 divergent", accent: true }
    ]
  })}
</div>`;

const sidenavSample = `<div class="sample-frame sample-frame--sidenav">
  ${renderSidenav({
    eyebrow: "Inhalt",
    items: [
      { href: "#problem", label: "Problem-Landkarte", active: true },
      { href: "#uebersicht", label: "Übersicht" },
      { href: "#cluster", label: "Cluster" },
      { href: "#achsen", label: "Achsen-View" },
      { href: "#entscheidungen", label: "Entscheidungen" },
      { href: "#lauf", label: "Lauf-Info" }
    ]
  })}
</div>`;

const statGridSample = renderStatGrid([
  { key: "Kandidaten", value: 12, trend: "+4 gegenueber Vorlauf", accent: "magenta" },
  { key: "Cluster", value: 3, trend: "stabil", accent: "purple" },
  { key: "Eigenbau / Übernahme", value: "2 : 9", trend: "Uebernahme-Anteil niedrig", trendWarn: true, accent: "orange" },
  { key: "Lauf-Datum", value: "22. Apr 2026", trend: "19:41 · 2026-04-22", variant: "meta", accent: "green" },
  { key: "Ziel-Repo", value: "eventbear-worker", trend: "Projekt-Kontext aktiv", variant: "meta", accent: "cyan" },
  { key: "Profil", value: "balanced", trend: "V1 · standard", variant: "meta", accent: "mixed" }
]);

const sectionPreviewSample = renderSectionCard({
  id: "sample-cluster",
  title: "Cluster — Record-Linkage-Bibliotheken",
  sub: "Musterfamilie · python record linkage",
  countChip: "5 Repos",
  accent: "magenta",
  infoButton: { triggerId: "sample-cluster", label: "Was ist ein Cluster?" },
  bodyHtml: [
    renderRepoRow({
      name: "AI-team-UoA/pyJedAI",
      href: "https://github.com/AI-team-UoA/pyJedAI",
      meta: "Universelles Entity-Resolution-Toolkit · 1,2k Sterne · aktiv",
      decision: { tone: "adopt", label: "Uebernehmen" },
      score: "8,4"
    }),
    renderRepoRow({
      name: "example/goldenmatch",
      href: "https://github.com/example/goldenmatch",
      meta: "Probabilistisches Record-Linkage · 380 Sterne · aktiv",
      decision: { tone: "adapt", label: "Adaptieren" },
      score: "7,1"
    }),
    renderRepoRow({
      name: "example/trade-record-linker",
      href: "https://github.com/example/trade-record-linker",
      meta: "Domaenenspezifischer Matcher · 95 Sterne · gepflegt",
      decision: { tone: "observe", label: "Beobachten" },
      score: "5,8"
    })
  ].join("\n")
});

const axisSample = renderSectionCard({
  id: "sample-axis",
  title: "Achsen-View",
  sub: "axis-positions · 3 von 3 gematched",
  countChip: "3 Achsen",
  accent: "purple",
  bodyHtml: [
    renderAxisRow({ label: "Latenz", percent: 72, valueLabel: "Batch" }),
    renderAxisRow({ label: "Datenmodell", percent: 58, valueLabel: "relational" }),
    renderAxisRow({ label: "Distribution", percent: 34, valueLabel: "Library" })
  ].join("\n")
});

const metaGridSample = renderSectionCard({
  id: "sample-lauf",
  title: "Lauf-Info",
  sub: "eventbear-worker · balanced profile",
  countChip: "6 Felder",
  accent: "green",
  bodyHtml: renderMetaGrid([
    { key: "Lauf-ID", value: "2026-04-22T19-41" },
    { key: "Profil", value: "balanced · standard" },
    { key: "Repos gescannt", value: "48" },
    { key: "Dauer", value: "2 min 14 s" },
    { key: "Token-Budget", value: "LLM-Aug. aus" },
    { key: "Quelle", value: "GitHub Search API" }
  ])
});

const infoGridSample = renderSectionCard({
  id: "sample-info",
  title: "Info-Grid (Title + Bullets)",
  sub: "Fuer coverage-artige Kartengruppen",
  countChip: "3 Karten",
  accent: "orange",
  bodyHtml: renderInfoGrid([
    {
      title: "Umfang des Laufs",
      copy: "Dieser Lauf fokussiert nur die explizit uebergebenen URLs.",
      items: [
        "Umfang: Explizite URLs",
        "Eingangs-URLs: 5",
        "Beobachtungslisten-URLs: 0"
      ]
    },
    {
      title: "Qualitaet der Review-Daten",
      items: [
        "Laufvertrauen: hoch",
        "Vollstaendig: 5",
        "Fallback: 0",
        "Veraltet: 0"
      ]
    },
    {
      title: "Artefakt-Link",
      copy: "Zeigt auf eine Download-Ressource.",
      link: { href: "https://example.com/report.html", label: "report.html", external: true }
    }
  ])
});

const badgeSample = `<div class="sample-frame" style="padding: 28px 36px; background: var(--card-bg); border: 1px solid var(--card-rule); border-radius: 12px; display: flex; gap: 14px; flex-wrap: wrap; align-items: center;">
  <span class="badge adopt">Uebernehmen</span>
  <span class="badge adapt">Adaptieren</span>
  <span class="badge observe">Beobachten</span>
  ${renderInfoButton({ triggerId: "sample-demo", label: "Demo-Info" })}
  ${renderInfoButton({ triggerId: "sample-demo-dark", label: "Demo-Info Dark", darkVariant: true })}
</div>`;

const samples = [
  { id: "tokens", title: "Design-Tokens", body: tokenSwatchGrid },
  { id: "typography", title: "Typografie", body: typographySample },
  { id: "hero", title: "Hero + Section-Break", body: heroSample },
  { id: "intro", title: "Content-Intro", body: contentIntroSample },
  { id: "sidenav", title: "Sidenav", body: sidenavSample },
  { id: "stats", title: "Stat-Grid (Übersicht)", body: `<div class="sample-frame sample-frame--on-dark">${statGridSample}</div>` },
  { id: "section-preview", title: "Section-Preview mit Repo-Rows", body: sectionPreviewSample },
  { id: "axis", title: "Axis-Rows", body: axisSample },
  { id: "meta-grid", title: "Meta-Grid", body: metaGridSample },
  { id: "info-grid", title: "Info-Grid (Title + Bullets)", body: infoGridSample },
  { id: "badges", title: "Badges + Info-Buttons", body: badgeSample }
];

const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pattern Pilot — Report UI Tokens + Components</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${COCKPIT_NIGHT_FONTS_HEAD}
  <style>
${COCKPIT_NIGHT_BASE_CSS}

/* Styleguide chrome */
.styleguide-header {
  padding: 56px 0 24px;
  border-bottom: 1px solid var(--rule);
  margin-bottom: 56px;
}
.styleguide-header .eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--neon-magenta);
  margin-bottom: 12px;
  font-weight: 600;
}
.styleguide-header h1 {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: clamp(40px, 6vw, 72px);
  line-height: 1;
  letter-spacing: -0.03em;
  margin: 0 0 16px;
  color: var(--ink);
  text-transform: uppercase;
}
.styleguide-header p {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink-soft);
  max-width: 680px;
  margin: 0;
}

.styleguide-section {
  margin-bottom: 80px;
}
.styleguide-section-head {
  margin-bottom: 24px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--rule-soft);
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}
.styleguide-section-head h2 {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 22px;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--ink);
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.styleguide-section-head h2::before {
  content: '';
  width: 8px;
  height: 8px;
  background: var(--neon-magenta);
  box-shadow: 0 0 12px rgba(255,61,151,0.55);
  border-radius: 2px;
}
.styleguide-section-head .anchor {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  color: var(--ink-muted);
}

.token-swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}
.token-swatch {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px;
  background: var(--bg-card);
  border: 1px solid var(--rule);
  border-radius: 10px;
}
.token-swatch-chip {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  border: 1px solid var(--rule);
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.05);
}
.token-swatch-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.token-swatch-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--ink);
  font-weight: 600;
}
.token-swatch-role {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 12px;
  color: var(--ink-soft);
}
.token-swatch-value {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--ink-muted);
}

.type-stack {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 28px;
  background: var(--bg-card);
  border: 1px solid var(--rule);
  border-radius: 12px;
}
.type-row {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 24px;
  align-items: baseline;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--rule-soft);
}
.type-row:last-child { border-bottom: none; padding-bottom: 0; }
.type-row-demo { color: var(--ink); }
.type-row-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
}

.sample-frame { position: relative; }
.sample-frame--sidenav {
  padding: 28px;
  background: var(--bg-card);
  border: 1px solid var(--rule);
  border-radius: 12px;
  max-width: 320px;
}
.sample-frame--sidenav .sidenav {
  position: static;
  max-height: none;
  overflow: visible;
}
.sample-frame--sidenav .sidenav-logo-link {
  margin: 0 0 32px 12px;
}
.sample-frame--on-dark {
  padding: 32px;
  background: linear-gradient(180deg, rgba(16,18,31,0.6), rgba(16,18,31,0.3));
  border: 1px solid var(--rule-soft);
  border-radius: 16px;
}
  </style>
</head>
<body>
  <div class="shell">
    <nav class="sidenav">
      <div class="sidenav-eyebrow" style="margin-top: 80px;">Styleguide</div>
      <ul class="sidenav-list">
${samples.map((s, i) => `    <li><a href="#${s.id}"><span class="n">${String(i + 1).padStart(2, "0")}</span>${s.title.replace(/Ü/g, "U")}</a></li>`).join("\n")}
      </ul>
    </nav>
    <main class="wrap" id="top">
      <header class="styleguide-header">
        <div class="eyebrow">Pattern Pilot · Report UI</div>
        <h1>Cockpit Night<br>Styleguide</h1>
        <p>Automatisch generierter visueller Katalog der Design-Tokens, Typografie und Primitives aus <code>lib/html/tokens.mjs</code> und <code>lib/html/components.mjs</code>. Jede Sektion zeigt echte Primitives in der gleichen Form, wie sie von den drei Renderern (Haupt-Report, Watchlist-Review, Landscape) emittiert werden.</p>
      </header>

${samples.map((s) => `<section class="styleguide-section" id="${s.id}" data-nav-section>
  <div class="styleguide-section-head">
    <h2>${s.title}</h2>
    <div class="anchor">#${s.id}</div>
  </div>
  ${s.body}
</section>`).join("\n")}

    </main>
  </div>
  ${renderInfoDialog({})}
  <script>
${INFO_DIALOG_SCRIPT}
  </script>
</body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes)`);
