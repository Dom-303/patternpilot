// scripts/generate-styleguide.mjs
//
// Erzeugt docs/reference/REPORT_UI_TOKENS.html — den Cockpit-Night-
// Styleguide als Editorial-Design-Deliverable.
//
// Aesthetik: dunkles Editorial-Layout mit weissen Daten-Karten und Neon-
// Akzenten. Kapitel-Numerik in Syne-Display, dichte Farbfamilien, Pull-
// Quotes bei Prinzipien, Side-by-Side-Vergleiche bei Accents + Do/Dont.
//
// Quelle der Wahrheit: lib/html/tokens.mjs (Design-Tokens) und
// lib/html/components.mjs (Renderer-Primitives).
//
// ============================================================================
// STRUKTUR EINGEFROREN — NICHT AENDERN OHNE EXPLIZITEN USER-FREIGABE
// ----------------------------------------------------------------------------
// Der Styleguide ist eins von drei strukturell gefrorenen Report-UI-
// Deliverables (Landscape-Template, Discovery/Review-Template, Styleguide).
// Stand: commit 11d596b (24.04.2026). Details: docs/reference/TEMPLATE_LOCK.md
// Erlaubt: Token-Werte + Beispiel-Inhalte aktualisieren, wenn die Base-Tokens
//   in lib/html/tokens.mjs sich aendern.
// Nicht erlaubt ohne User-Freigabe: Umbau der 17-Kapitel-Struktur, Entfernen
//   von Kapiteln, Aesthetik-Drift weg von Cockpit Night.
// ============================================================================

import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import {
  COCKPIT_NIGHT_FONTS_HEAD,
  COCKPIT_NIGHT_BASE_CSS
} from "../lib/html/tokens.mjs";
import { LOGO_BASE64 } from "../lib/html/shared.mjs";
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
  renderTabs,
  INFO_DIALOG_SCRIPT
} from "../lib/html/components.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../docs/reference/REPORT_UI_TOKENS.html");

const VERSION = "1.0";
const LAST_UPDATED = "2026-04-24";

// --- Design-Tokens gruppiert ----------------------------------------------
// Farben sortiert nach Verwendung, nicht alphabetisch. Neon-Familie wird
// in einem eigenen Block gezeigt, weil sie das Identitaets-Moment traegt.

const tokenGroups = [
  {
    id: "dark-surface",
    title: "Dunkle Oberflaeche",
    hint: "Body, Hero, Sidenav — der Bereich um den Content.",
    swatches: [
      { name: "--bg", value: "#0e131f", usage: "Body-Hintergrund. Tief genug, dass Sterne und Grain sichtbar werden." },
      { name: "--bg-card", value: "#1c2338", usage: "Dunkle Cards: Token-Swatches, Sidenav-Umgebung, Token-Panels." },
      { name: "--bg-card-alt", value: "#232b45", usage: "Alternative Fuell-Flaeche im dunklen Raum." },
      { name: "--ink", value: "#f1f3f9", usage: "Primaere Schrift auf dunkel." },
      { name: "--ink-soft", value: "#aeb4c3", usage: "Sekundaere Schrift, Subtitel, Meta-Text." },
      { name: "--ink-muted", value: "#727891", usage: "Gedaempfte Schrift: Captions, Token-Werte." },
      { name: "--rule", value: "#323a56", usage: "Trennlinien zwischen Sektionen." },
      { name: "--rule-soft", value: "#262c44", usage: "Sehr zarte Trennlinien zwischen Untergruppen." }
    ]
  },
  {
    id: "light-surface",
    title: "Helle Datenkarten",
    hint: "Das Herzstueck jedes Reports. Weiss, beruhigt, lesbar.",
    swatches: [
      { name: "--card-bg", value: "#ffffff", usage: "Datenkarte: jeder Preview-Block, Info-Grid-Zelle, Agent-Snapshot." },
      { name: "--card-bg-alt", value: "#f6f7fb", usage: "Alternative Fuell-Flaeche auf weiss: Toolbar, Agent-JSON-Block." },
      { name: "--card-ink", value: "#0e131f", usage: "Hauptschrift auf weiss — identisch zum Body-Bg fuer visuelle Klammer." },
      { name: "--card-ink-soft", value: "#3f465e", usage: "Sekundaere Schrift auf weiss, Lauf-Values, Bullets." },
      { name: "--card-ink-muted", value: "#7a819a", usage: "Gedaempfte Schrift: Karten-Captions, Meta." },
      { name: "--card-rule", value: "#e3e6ef", usage: "Karten-Raender, Badge-Outlines, Code-Spans." },
      { name: "--card-rule-soft", value: "#eef0f7", usage: "Sehr zarte Flaechentrenner innerhalb weiss." }
    ]
  },
  {
    id: "neon-accents",
    title: "Neon-Akzente",
    hint: "Die Identitaet. Fuenf Farben, streng rationiert — hoechstens eine dominante Accent-Farbe pro Section.",
    neon: true,
    swatches: [
      { name: "--neon-magenta", value: "#ff3d97", usage: "Primaer-Akzent. Section-Marker, Active Nav-Link, Empfehlungen." },
      { name: "--neon-pink", value: "#ff7ab0", usage: "Sekundaer-Akzent. Hover-Highlights, dezente Hervorhebungen." },
      { name: "--neon-orange", value: "#ff9a48", usage: "Warn-Akzent. Risikosignale, Constraint-Warnungen, Attention." },
      { name: "--neon-green", value: "#66e87a", usage: "Adopt-Akzent. Agent-View, positive States, stabile Signale." },
      { name: "--neon-purple", value: "#a97aff", usage: "Observe-Akzent. Linsen, Cluster-Umfeld, sekundaere Sektionen." },
      { name: "--neon-cyan", value: "#5de5ed", usage: "Info-Akzent. Uebersicht, Stats, neutrale Meta-Sektionen." }
    ]
  },
  {
    id: "status-inks",
    title: "Status-Inks fuer Badges",
    hint: "Dunkle, saturierte Toene fuer Badge-Text auf hellem Badge-Fill.",
    swatches: [
      { name: "--card-green", value: "#1e8a33", usage: "Badge 'Uebernehmen' — dunkelgruen auf hellem Fill." },
      { name: "--card-orange", value: "#c24d00", usage: "Badge 'Adaptieren' — dunkelorange auf hellem Fill." },
      { name: "--card-purple", value: "#5b35c4", usage: "Badge 'Beobachten' — dunkellila auf hellem Fill." }
    ]
  }
];

// --- Typografie-Skala ------------------------------------------------------

const typeScale = [
  {
    name: "Hero Display",
    spec: "Syne · 800 · 60–108px · lh 0.95 · tracking -0.04em · UPPERCASE",
    css: "font-family:'Syne',sans-serif; font-weight:800; font-size:clamp(60px,9vw,108px); line-height:0.95; letter-spacing:-0.04em; text-transform:uppercase;",
    demo: "Pattern Pilot"
  },
  {
    name: "Display Subject",
    spec: "Syne · 700 · 30–50px · tracking -0.025em",
    css: "font-family:'Syne',sans-serif; font-weight:700; font-size:clamp(30px,4vw,50px); letter-spacing:-0.025em;",
    demo: "Event-Deduplication"
  },
  {
    name: "Section Head",
    spec: "Syne · 700 · 22px · tracking -0.01em · UPPERCASE",
    css: "font-family:'Syne',sans-serif; font-weight:700; font-size:22px; letter-spacing:-0.01em; text-transform:uppercase;",
    demo: "Empfehlungen"
  },
  {
    name: "KPI Value",
    spec: "Syne · 700 · 48px · tabular-nums · tracking -0.03em",
    css: "font-family:'Syne',sans-serif; font-weight:700; font-size:48px; font-variant-numeric:tabular-nums; letter-spacing:-0.03em;",
    demo: "12,4"
  },
  {
    name: "Body Intro",
    spec: "IBM Plex Sans · 400 · 17px · lh 1.55",
    css: "font-family:'IBM Plex Sans',sans-serif; font-weight:400; font-size:17px; line-height:1.55;",
    demo: "Pattern Pilot ist die Intelligenz-Schicht zwischen externen Repos und Entscheidungen."
  },
  {
    name: "Body Card",
    spec: "IBM Plex Sans · 400 · 14px · lh 1.6",
    css: "font-family:'IBM Plex Sans',sans-serif; font-weight:400; font-size:14px; line-height:1.6;",
    demo: "Divergente Cluster bieten hoechstes Lern-Potenzial, aber hoeheren Transfer-Aufwand."
  },
  {
    name: "Eyebrow / Meta",
    spec: "JetBrains Mono · 600 · 10–12px · tracking 0.22em · UPPERCASE",
    css: "font-family:'JetBrains Mono',monospace; font-weight:600; font-size:11px; letter-spacing:0.22em; text-transform:uppercase;",
    demo: "Problem-Landkarte"
  },
  {
    name: "Code / Value",
    spec: "JetBrains Mono · 500 · 12px · tracking 0.05em",
    css: "font-family:'JetBrains Mono',monospace; font-weight:500; font-size:12px; letter-spacing:0.05em;",
    demo: "renderLandscapeHtml()"
  }
];

// --- Prinzipien ------------------------------------------------------------

const principles = [
  {
    n: "I",
    title: "Eine Akzentfarbe fuehrt.",
    body: "Jede Section hat EINEN dominanten Neon-Akzent. Der Rest bleibt kuehl. Niemals zwei Neons gleichberechtigt in derselben Flaeche."
  },
  {
    n: "II",
    title: "Karten atmen, Daten fluessig.",
    body: "Weiss ist das Feld, auf dem Daten sichtbar werden. Dichte Zahlenraster nur wo der Inhalt es braucht — sonst Abstand, Ruhe, Sprache."
  },
  {
    n: "III",
    title: "Schrift traegt die Struktur.",
    body: "Syne markiert, JetBrains Mono klassifiziert, IBM Plex Sans erklaert. Drei Stimmen, drei Aufgaben."
  },
  {
    n: "IV",
    title: "Maximal zwei Spalten.",
    body: "Ausser Stat-Cards (die duerfen drei). Alles andere bleibt im 2-Col-Raster — Lesbarkeit vor Kompaktheit."
  }
];

// --- Section-Accents ------------------------------------------------------

const sectionAccents = [
  { accent: "magenta", label: "Magenta", usage: "Empfehlungen, Entscheidungen, aktive Nav." },
  { accent: "cyan", label: "Cyan", usage: "Uebersicht, Stats, Problem-Details." },
  { accent: "purple", label: "Purple", usage: "Problem-Linsen, Coverage, Cluster-Defaults." },
  { accent: "orange", label: "Orange", usage: "Risikosignale, Zielrepo-Kontext, Attention." },
  { accent: "green", label: "Green", usage: "Agent-View, Lauf-Info, Success / Action-Steps." }
];

const accentShowcase = `<div class="accent-grid">
${sectionAccents.map((a) => `<article class="accent-card accent-${a.accent}">
  <div class="accent-card-head">
    <span class="accent-card-marker"></span>
    <h3 class="accent-card-title">${a.label}</h3>
  </div>
  <p class="accent-card-usage">${a.usage}</p>
  <div class="accent-card-token">accent-${a.accent}</div>
</article>`).join("")}
</div>`;

// --- Component Showcases --------------------------------------------------

const heroSample = `<div class="sample-frame">
  ${renderCockpitHero({
    title: "Pattern",
    pilotWord: "Pilot",
    slogan: "Die Intelligenz-Schicht zwischen externen Repos und konkreten Entscheidungen."
  })}
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
      { href: "#problem", label: "Problem", active: true },
      { href: "#uebersicht", label: "Uebersicht" },
      { href: "#entscheidungen", label: "Entscheidungen" },
      { href: "#cluster-1", label: "python record linkage" },
      { href: "#cluster-2", label: "sorted-neighborhood" },
      { href: "#coverage", label: "Coverage" },
      { href: "#agent", label: "Agenten" },
      { href: "#what-now", label: "Was jetzt" }
    ]
  })}
</div>`;

const statGridSample = renderStatGrid([
  { key: "Kandidaten", value: 12, trend: "+4 gegenueber Vorlauf", accent: "magenta" },
  { key: "Cluster", value: 3, trend: "stabil", accent: "purple" },
  { key: "Uebernahme-Verhaeltnis", value: "2 : 9", trend: "Uebernahme-Anteil niedrig", trendWarn: true, accent: "orange" },
  { key: "Lauf-Datum", value: "24. Apr 2026", trend: "18:42 · v1.0", variant: "meta", accent: "green" },
  { key: "Ziel-Repo", value: "eventbear-worker", trend: "Projekt-Kontext aktiv", variant: "meta", accent: "cyan" },
  { key: "Profil", value: "balanced", trend: "standard-depth", variant: "meta", accent: "mixed" }
]);

const repoRowsSample = renderSectionCard({
  id: "sample-repos",
  title: "Repo-Rows mit Badges + Score",
  sub: "Standard-Listenzeile fuer Cluster-Mitglieder",
  countChip: "3 Varianten",
  accent: "magenta",
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
  title: "Axis-Rows",
  sub: "Visualisierung von Achsen-Positionen 0–100%",
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
  title: "Meta-Grid",
  sub: "Kompakte Key-Value-Zellen fuer Lauf-Meta",
  countChip: "6 Felder",
  accent: "green",
  bodyHtml: renderMetaGrid([
    { key: "Lauf-ID", value: "2026-04-24T18-42" },
    { key: "Profil", value: "balanced · standard" },
    { key: "Repos gescannt", value: "48" },
    { key: "Dauer", value: "2 min 14 s" },
    { key: "Token-Budget", value: "LLM-Aug. aus" },
    { key: "Quelle", value: "GitHub Search API" }
  ])
});

const infoGridSample = renderSectionCard({
  id: "sample-info",
  title: "Info-Grid",
  sub: "Title + Copy + Bullets. Fuer Problem-Linsen, Context-Sources, usw.",
  countChip: "3 Karten",
  accent: "orange",
  bodyHtml: renderInfoGrid([
    {
      title: "Umfang des Laufs",
      copy: "Dieser Lauf fokussiert nur die explizit uebergebenen URLs.",
      items: [
        "Umfang: Explizite URLs",
        "Eingangs-URLs: 5",
        "Watchlist-URLs: 0"
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

const tabsSample = renderSectionCard({
  id: "sample-tabs",
  title: "Tabs mit Count-Chip",
  sub: "Konsolidierte Section mit mehreren Sichten",
  countChip: "3 Tabs · 12 Items",
  accent: "cyan",
  bodyHtml: renderTabs([
    {
      label: "Top-Rang",
      body: `<ul class="bullets"><li>AI-team-UoA/pyJedAI — Entity-Resolution-Toolkit</li><li>example/goldenmatch — Probabilistisches Matching</li><li>example/trade-record-linker — Domaenen-Matcher</li></ul>`
    },
    {
      label: "Nach Disposition",
      body: `<p class="info-card-copy">Gruppiert nach adopt / adapt / observe. Die Disposition wird aus Relation + Evidence abgeleitet.</p>`
    },
    {
      label: "Begruendung",
      body: `<p class="info-card-copy">Pro Top-Kandidat ein Pro/Contra-Block mit Impact-Klassifikation.</p>`
    }
  ])
});

const badgeSample = `<div class="sample-frame sample-frame--inline">
  <div class="demo-row">
    <span class="badge adopt">Uebernehmen</span>
    <span class="badge adapt">Adaptieren</span>
    <span class="badge observe">Beobachten</span>
  </div>
  <div class="demo-row">
    ${renderInfoButton({ triggerId: "sg-light", label: "Info-Button Light" })}
    ${renderInfoButton({ triggerId: "sg-dark", label: "Info-Button Dark", darkVariant: true })}
    <button type="button" class="ghost-button">Ghost-Button</button>
  </div>
  <div class="demo-row">
    <span class="context-status context-status--ok"><span class="context-status-icon">●</span><span class="context-status-text">6 von 6 Pflicht-Dateien gelesen</span></span>
  </div>
  <div class="demo-row">
    <span class="context-status context-status--attention"><span class="context-status-icon">◆</span><span class="context-status-text">4 von 6 gelesen — 2 fehlen</span></span>
  </div>
  <div class="demo-row">
    <span class="context-status context-status--warn"><span class="context-status-icon">▲</span><span class="context-status-text">Keine Dateien gelesen</span></span>
  </div>
</div>`;

const agentSnapshotSample = `<div class="sample-frame">
  <div class="info-card wide agent-snapshot">
    <div class="info-card-title">Maschinenlesbares Snapshot</div>
    <p class="info-card-copy">JSON-Sicht fuer Coding Agents mit Auftrag, Prioritaeten, Kontext, Leitplanken und Unsicherheiten in stabiler Form.</p>
    <div class="agent-snapshot-toolbar">
      <div class="agent-snapshot-file">
        <svg class="agent-file-icon" viewBox="0 0 20 20" aria-hidden="true"><path d="M4 2h7l4 4v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M11 2v4h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><text x="5" y="14.5" font-family="JetBrains Mono, monospace" font-size="4.2" font-weight="700" fill="currentColor" letter-spacing="0.2">JSON</text></svg>
        <div class="agent-snapshot-file-meta">
          <span class="agent-snapshot-file-name">patternpilot-agent-handoff.json</span>
          <span class="agent-snapshot-file-stats">3.2 KB · 138 Zeilen · stabiles JSON-Schema</span>
        </div>
      </div>
      <div class="agent-snapshot-actions">
        <button type="button" class="agent-action-button"><svg class="agent-action-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 1.5A1.5 1.5 0 0 1 6.5 0h6A1.5 1.5 0 0 1 14 1.5v9A1.5 1.5 0 0 1 12.5 12H11v1.5A2.5 2.5 0 0 1 8.5 16h-6A2.5 2.5 0 0 1 0 13.5V6.5A2.5 2.5 0 0 1 2.5 4H4V1.5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg><span>Kopieren</span></button>
        <button type="button" class="agent-action-button"><svg class="agent-action-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M9 1h6v6M15 1 7.5 8.5M12 9v4.5A1.5 1.5 0 0 1 10.5 15h-8A1.5 1.5 0 0 1 1 13.5v-8A1.5 1.5 0 0 1 2.5 4H7" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Oeffnen</span></button>
        <button type="button" class="agent-action-button agent-action-button--primary"><svg class="agent-action-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1v9m0 0 3.5-3.5M8 10 4.5 6.5M1.5 11v2.5A1.5 1.5 0 0 0 3 15h10a1.5 1.5 0 0 0 1.5-1.5V11" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>Herunterladen</span></button>
      </div>
    </div>
  </div>
</div>`;

const descriptionCollapseSample = `<div class="sample-frame">
  <details class="section-description" open>
    <summary><span class="section-description-label">Beschreibung</span></summary>
    <div class="section-description-body"><p>Die Beschreibungs-Dropdown zeigt den vollen Hilfe-Text einer Section, bleibt aber standardmaessig versteckt — damit die Sektion selbst nicht von Meta-Text ueberladen wird.</p></div>
  </details>
  <details class="section-description">
    <summary><span class="section-description-label">Beschreibung (zugeklappt)</span></summary>
    <div class="section-description-body"><p>Dieser Text ist aktuell nicht sichtbar.</p></div>
  </details>
</div>`;

// --- Do & Don't Paare -----------------------------------------------------

const doDontPairs = [
  {
    topic: "Accent-Dichte",
    do: { label: "Do", text: "Genau eine Akzentfarbe pro Section — Marker, Count-Chip-Rahmen, aktive Elemente folgen ihr." },
    dont: { label: "Don't", text: "Zwei Neons nebeneinander (Magenta + Cyan + Orange = Karneval). Das Auge verliert Fuehrung." }
  },
  {
    topic: "Nav-Labels",
    do: { label: "Do", text: "1–2 Woerter pro Nav-Eintrag: 'Kontext', 'Status', 'Linsen'. Gleiche Kadenz in beiden Templates." },
    dont: { label: "Don't", text: "Ganze Satzteile ('Technischer Lauf-Status fuer diesen Run') — die rutschen in 2 Zeilen und stoeren den Rhythmus." }
  },
  {
    topic: "Spalten-Zahl",
    do: { label: "Do", text: "Maximal 2 Spalten fuer Info-Karten. Nur Stats-Uebersicht darf 3 Spalten (enger Zahlen-Raster)." },
    dont: { label: "Don't", text: "3-4 Info-Karten nebeneinander. Karten-Inhalte werden zu breit, Copy bricht mitten im Gedanken." }
  },
  {
    topic: "Badges vs. Text",
    do: { label: "Do", text: "Disposition als Badge (adopt/adapt/observe), Relation im Sub-Text. Klare Hierarchie." },
    dont: { label: "Don't", text: "Alles als Badge. Wenn jede Zeile 3 Badges traegt, haben Badges keinen Signalwert mehr." }
  }
];

const doDontGrid = `<div class="dodont-grid">
${doDontPairs.map((pair) => `<article class="dodont-card">
  <div class="dodont-topic">${pair.topic}</div>
  <div class="dodont-columns">
    <div class="dodont-col dodont-col--do">
      <div class="dodont-label">${pair.do.label}</div>
      <p class="dodont-text">${pair.do.text}</p>
    </div>
    <div class="dodont-col dodont-col--dont">
      <div class="dodont-label">${pair.dont.label}</div>
      <p class="dodont-text">${pair.dont.text}</p>
    </div>
  </div>
</article>`).join("")}
</div>`;

// --- Struktur -------------------------------------------------------------
// Jede Section hat: id, chapter-Nummer (Roman), title, optionaler lead,
// body-HTML. Nav wird aus dieser Liste abgeleitet.

// Chapter-Nummern werden aus dem Array-Index abgeleitet (01, 02, ...),
// damit sie 1:1 zur Sidenav-Auto-Nummerierung passen (renderSidenav
// nummeriert von 01 an). So entsteht keine Asymmetrie Chapter ↔ Nav.
const sections = [
  { id: "principles", title: "Prinzipien", lead: "Vier Regeln, die jede Entscheidung im Design-System tragen.", body: `<div class="principles-grid">
${principles.map((p) => `<article class="principle">
  <div class="principle-number">${p.n}</div>
  <h3 class="principle-title">${p.title}</h3>
  <p class="principle-body">${p.body}</p>
</article>`).join("")}
</div>` },
  { id: "colors", title: "Farbsystem", lead: "Vier Familien. Die dunkle Oberflaeche traegt, weisse Karten erklaeren, Neons markieren.", body: tokenGroups.map((g) => `<section class="token-family${g.neon ? " token-family--neon" : ""}">
  <header class="token-family-head">
    <h3 class="token-family-title">${g.title}</h3>
    <p class="token-family-hint">${g.hint}</p>
  </header>
  <div class="token-grid">
${g.swatches.map((s) => `    <div class="token-swatch">
      <div class="token-chip" style="background: ${s.value}"></div>
      <div class="token-meta">
        <div class="token-name">${s.name}</div>
        <div class="token-value">${s.value}</div>
        <div class="token-usage">${s.usage}</div>
      </div>
    </div>`).join("\n")}
  </div>
</section>`).join("\n") },
  { id: "typography", title: "Typografie", lead: "Drei Schriften teilen sich die Arbeit — Syne setzt die Haltung, JetBrains Mono gibt Struktur, IBM Plex Sans traegt den Fliesstext.", body: `<div class="type-scale">
${typeScale.map((t) => `<div class="type-row">
  <div class="type-demo" style="${t.css}">${t.demo}</div>
  <div class="type-meta">
    <div class="type-name">${t.name}</div>
    <div class="type-spec">${t.spec}</div>
  </div>
</div>`).join("\n")}
</div>` },
  { id: "accents", title: "Section-Accents", lead: "Fuenf Akzente decken die semantischen Felder ab. Jede Section waehlt genau einen.", body: accentShowcase },
  { id: "hero", title: "Hero & Section-Break", lead: "Grosse Geste oben. Leichte Geste zwischen Bloecken.", body: heroSample },
  { id: "intro", title: "Content-Intro", lead: "Die Ueberleitung vom Hero in den Report-Korpus.", body: contentIntroSample },
  { id: "sidenav", title: "Sidenav", lead: "Links am Rand, eng gesetzt, Labels einzeilig mit Ellipsis als Safety-Net.", body: sidenavSample },
  { id: "stats", title: "Stat-Grid", lead: "Das einzige Raster, das 3 Spalten darf. Kompakte Zahlenmeta auf einen Blick.", body: `<div class="sample-frame sample-frame--on-dark">${statGridSample}</div>` },
  { id: "repo-rows", title: "Repo-Rows", lead: "Klickbare Listenzeile mit Name, Meta, Disposition-Badge, optionalem Score.", body: repoRowsSample },
  { id: "axis", title: "Axis-Rows", lead: "Fuer Achsen-Views: Label links, 0–100% Bar, Wert rechts.", body: axisSample },
  { id: "meta-grid", title: "Meta-Grid", lead: "Dichte Key-Value-Zellen fuer Lauf-Info und sekundaere Metriken.", body: metaGridSample },
  { id: "info-grid", title: "Info-Grid", lead: "Info-Karten mit Title + Copy + Bullets. Max 2 Spalten.", body: infoGridSample },
  { id: "tabs", title: "Tabs", lead: "Konsolidiert mehrere Sichten einer Section in einem Block.", body: tabsSample },
  { id: "badges", title: "Badges & Buttons", lead: "Disposition-Badges (adopt/adapt/observe), Info-Buttons (light/dark), Ghost-Button, Kontext-Status.", body: badgeSample },
  { id: "agent-snapshot", title: "Agent Snapshot", lead: "Toolbar + JSON-Datei-Meta + 3 Action-Buttons (Copy/Open/Download). Primary-Button traegt Magenta-Gradient.", body: agentSnapshotSample },
  { id: "description-collapse", title: "Description Collapse", lead: "Hilfetexte pro Section — standardmaessig zugeklappt, damit die Sektion nicht ueberladen wirkt.", body: descriptionCollapseSample },
  { id: "dodont", title: "Do & Don't", lead: "Vier Regelfaelle, die in Reviews immer wieder auftauchen.", body: doDontGrid }
];

// --- Section-Nav (abgeleitet) ---------------------------------------------
const navItems = sections.map((s) => ({ href: `#${s.id}`, label: s.title }));

// --- Sektion-Render -------------------------------------------------------
// data-nav-section-Attribut ist entscheidend: INFO_DIALOG_SCRIPT beobachtet
// diese Sections mit einem IntersectionObserver und togglet die .active-
// Klasse auf dem passenden Sidenav-Link — das ist der Magenta-Balken, der
// links neben dem aktuellen Kapitel mitwandert.
//
// Kapitel-Num wird aus dem Index abgeleitet (01, 02, ...), damit sie 1:1
// zur Sidenav-Auto-Nummerierung passt.
const sectionsHtml = sections.map((s, i) => {
  const num = String(i + 1).padStart(2, "0");
  return `<section class="chapter" id="${s.id}" data-nav-section>
  <header class="chapter-head">
    <span class="chapter-num">${num}</span>
    <h2 class="chapter-title">${s.title}</h2>
  </header>
  ${s.lead ? `<p class="chapter-lead">${s.lead}</p>` : ""}
  <div class="chapter-body">${s.body}</div>
</section>`;
}).join("\n");

// --- Sidenav fuer Styleguide ----------------------------------------------
// Nutzt renderSidenav (dieselbe Primitive wie die Templates), damit echtes
// Pattern-Pilot-Logo, Border-Left-Regel und Active-Indikator konsistent
// sind. Logo kommt aus assets/logo-icon.png via LOGO_BASE64.
const sidenavHtml = renderSidenav({
  logoSrc: LOGO_BASE64,
  logoAlt: "Pattern Pilot",
  eyebrow: "Styleguide",
  items: navItems
});

const styleguideCss = `
/* ==========================================================================
   Styleguide-Chrome: Editorial-Magazin-Layout fuer das Cockpit-Night-System.
   Respektiert die Base-CSS — keine Token-Aenderungen, nur layout um sie herum.
   ========================================================================== */

.styleguide-shell { max-width: 1400px; margin: 0 auto; padding: 40px 40px 120px 10px;
  display: grid; grid-template-columns: 252px minmax(0, 1fr); gap: 64px; position: relative; z-index: 2; }
@media (max-width: 960px) {
  .styleguide-shell { grid-template-columns: 1fr; gap: 24px; padding: 24px 20px 80px; }
  .styleguide-shell .sidenav { display: none; }
}

/* Hero */
.sg-hero { padding: 64px 0 40px; position: relative; }
.sg-hero-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase;
  color: var(--neon-magenta); font-weight: 600; margin: 0 0 16px;
}
.sg-hero-title {
  font-family: 'Syne', sans-serif; font-weight: 800;
  font-size: clamp(56px, 9vw, 120px); line-height: 0.92;
  letter-spacing: -0.04em; text-transform: uppercase;
  margin: 0 0 20px; color: var(--ink);
}
.sg-hero-title .accent { color: var(--neon-magenta); font-style: italic; font-weight: 700; }
.sg-hero-lead {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 19px; line-height: 1.55;
  color: var(--ink-soft); max-width: 720px; margin: 0 0 36px;
}
.sg-hero-lead strong { color: var(--ink); font-weight: 600; }
.sg-hero-meta {
  display: flex; gap: 24px; flex-wrap: wrap; padding: 20px 0;
  border-top: 1px solid var(--rule); border-bottom: 1px solid var(--rule);
  font-family: 'JetBrains Mono', monospace; font-size: 11px;
  letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted);
}
.sg-hero-meta-item { display: flex; flex-direction: column; gap: 4px; }
.sg-hero-meta-key { color: var(--ink-muted); font-weight: 500; }
.sg-hero-meta-value { color: var(--ink); font-weight: 600; letter-spacing: 0.06em; }
.sg-hero-meta-value a { color: var(--neon-cyan); text-decoration: none; border-bottom: 1px dashed var(--rule); }
.sg-hero-meta-value a:hover { color: var(--neon-magenta); border-bottom-color: var(--neon-magenta); }

/* Kapitel-Kopf */
.chapter { margin: 96px 0; scroll-margin-top: 24px; }
.chapter:first-of-type { margin-top: 56px; }
.chapter-head { display: flex; align-items: baseline; gap: 28px; margin-bottom: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--rule-soft); }
.chapter-num {
  font-family: 'Syne', sans-serif; font-weight: 800; font-size: 64px; line-height: 1;
  letter-spacing: -0.03em; color: transparent; -webkit-text-stroke: 1px var(--rule);
  text-stroke: 1px var(--rule); flex-shrink: 0; font-variant-numeric: tabular-nums;
}
.chapter-title {
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: clamp(28px, 3.5vw, 44px);
  line-height: 1.05; letter-spacing: -0.025em; margin: 0; color: var(--ink);
  text-transform: uppercase;
}
.chapter-lead {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 17px; line-height: 1.6;
  color: var(--ink-soft); max-width: 720px; margin: 16px 0 32px;
  padding-left: 92px;
}
.chapter-body { position: relative; }

/* Prinzipien */
.principles-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px; }
@media (max-width: 720px) { .principles-grid { grid-template-columns: 1fr; } }
.principle {
  padding: 28px 28px 32px; background: var(--bg-card); border: 1px solid var(--rule);
  border-radius: 12px; position: relative; overflow: hidden;
}
.principle::before {
  content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 2px;
  background: linear-gradient(90deg, var(--neon-magenta), transparent 60%);
}
.principle-number {
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 48px; line-height: 1;
  color: var(--neon-magenta); letter-spacing: -0.04em; margin-bottom: 16px;
  font-style: italic;
}
.principle-title {
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 22px;
  letter-spacing: -0.015em; margin: 0 0 12px; color: var(--ink); text-transform: uppercase;
}
.principle-body {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 14.5px; line-height: 1.6;
  color: var(--ink-soft); margin: 0;
}

/* Farbsystem */
.token-family { margin: 0 0 40px; }
.token-family:last-child { margin-bottom: 0; }
.token-family-head { margin-bottom: 18px; }
.token-family-title {
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px;
  letter-spacing: -0.01em; text-transform: uppercase; margin: 0 0 6px; color: var(--ink);
}
.token-family-hint {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; line-height: 1.5;
  color: var(--ink-muted); margin: 0; max-width: 640px;
}
.token-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.token-swatch {
  display: grid; grid-template-columns: 64px 1fr; gap: 16px; align-items: stretch;
  padding: 14px; background: var(--bg-card); border: 1px solid var(--rule); border-radius: 10px;
  transition: border-color 0.2s, transform 0.2s;
}
.token-swatch:hover { border-color: var(--neon-magenta); transform: translateY(-1px); }
.token-chip {
  width: 64px; height: 64px; border-radius: 8px;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
  flex-shrink: 0;
}
.token-family--neon .token-chip {
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1), 0 0 20px rgba(255,255,255,0.08);
}
.token-meta { display: flex; flex-direction: column; gap: 3px; min-width: 0; justify-content: center; }
.token-name {
  font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-weight: 600;
  color: var(--ink); letter-spacing: 0.02em;
}
.token-value {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-muted);
  letter-spacing: 0.06em;
}
.token-usage {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 12.5px; line-height: 1.45;
  color: var(--ink-soft); margin-top: 4px;
}

/* Typografie-Skala */
.type-scale {
  display: flex; flex-direction: column; gap: 28px;
  padding: 32px; background: var(--bg-card); border: 1px solid var(--rule); border-radius: 12px;
}
.type-row {
  display: grid; grid-template-columns: 1fr 280px; gap: 32px; align-items: baseline;
  padding-bottom: 24px; border-bottom: 1px solid var(--rule-soft);
}
.type-row:last-child { border-bottom: none; padding-bottom: 0; }
@media (max-width: 720px) { .type-row { grid-template-columns: 1fr; gap: 12px; } }
.type-demo { color: var(--ink); overflow: hidden; word-break: break-word; }
.type-meta { display: flex; flex-direction: column; gap: 4px; }
.type-name {
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px;
  letter-spacing: 0.02em; text-transform: uppercase; color: var(--neon-magenta);
}
.type-spec {
  font-family: 'JetBrains Mono', monospace; font-size: 11.5px; line-height: 1.5;
  color: var(--ink-muted); letter-spacing: 0.05em;
}

/* Accent-Grid */
.accent-grid {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;
}
.accent-card {
  position: relative; padding: 22px 22px 24px;
  background: var(--card-bg); border: 1px solid var(--card-rule); border-radius: 10px;
  color: var(--card-ink); overflow: hidden;
}
.accent-card::before {
  content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
  background: var(--accent-color, var(--neon-magenta));
}
.accent-card.accent-magenta { --accent-color: var(--neon-magenta); }
.accent-card.accent-purple { --accent-color: var(--neon-purple); }
.accent-card.accent-orange { --accent-color: var(--neon-orange); }
.accent-card.accent-green { --accent-color: var(--neon-green); }
.accent-card.accent-cyan { --accent-color: var(--neon-cyan); }
.accent-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.accent-card-marker {
  width: 10px; height: 10px; border-radius: 2px;
  background: var(--accent-color);
  box-shadow: 0 0 12px var(--accent-color), 0 0 22px var(--accent-color);
}
.accent-card-title {
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 16px;
  text-transform: uppercase; letter-spacing: -0.01em; margin: 0; color: var(--card-ink);
}
.accent-card-usage {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 13px; line-height: 1.55;
  color: var(--card-ink-soft); margin: 0 0 14px;
}
.accent-card-token {
  font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.1em;
  color: var(--card-ink-muted); text-transform: uppercase; font-weight: 600;
  padding-top: 12px; border-top: 1px solid var(--card-rule);
}

/* Sample-Frames */
.sample-frame { position: relative; }
.sample-frame--sidenav {
  padding: 24px; background: var(--bg-card); border: 1px solid var(--rule); border-radius: 12px;
  max-width: 300px;
}
.sample-frame--sidenav .sidenav {
  position: static; max-height: none; overflow: visible;
  scrollbar-width: auto;
}
.sample-frame--sidenav .sidenav::-webkit-scrollbar { display: initial; }
.sample-frame--sidenav .sidenav-logo-link { margin: 0 0 20px 2px; }
.sample-frame--on-dark {
  padding: 36px; background: linear-gradient(180deg, rgba(16,18,31,0.6), rgba(16,18,31,0.3));
  border: 1px solid var(--rule-soft); border-radius: 16px;
}
.sample-frame--inline {
  padding: 24px 28px; background: var(--card-bg); border: 1px solid var(--card-rule);
  border-radius: 12px; display: flex; flex-direction: column; gap: 18px;
}
.demo-row { display: flex; gap: 14px; flex-wrap: wrap; align-items: center; }

/* Do & Don't */
.dodont-grid { display: flex; flex-direction: column; gap: 16px; }
.dodont-card {
  background: var(--bg-card); border: 1px solid var(--rule); border-radius: 12px;
  padding: 20px 24px 24px;
}
.dodont-topic {
  font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.2em;
  text-transform: uppercase; color: var(--neon-magenta); font-weight: 600; margin-bottom: 14px;
}
.dodont-columns {
  display: grid; grid-template-columns: 1fr 1fr; gap: 0;
  border: 1px solid var(--rule-soft); border-radius: 8px; overflow: hidden;
}
@media (max-width: 720px) { .dodont-columns { grid-template-columns: 1fr; } }
.dodont-col { padding: 18px 22px; position: relative; }
.dodont-col--do { background: rgba(102, 232, 122, 0.06); border-right: 1px solid var(--rule-soft); }
.dodont-col--dont { background: rgba(255, 154, 72, 0.06); }
@media (max-width: 720px) {
  .dodont-col--do { border-right: none; border-bottom: 1px solid var(--rule-soft); }
}
.dodont-label {
  font-family: 'Syne', sans-serif; font-weight: 700; font-size: 13px; letter-spacing: 0.02em;
  text-transform: uppercase; margin-bottom: 8px;
}
.dodont-col--do .dodont-label { color: var(--neon-green); }
.dodont-col--dont .dodont-label { color: var(--neon-orange); }
.dodont-text {
  font-family: 'IBM Plex Sans', sans-serif; font-size: 13.5px; line-height: 1.55;
  color: var(--ink-soft); margin: 0;
}
`;

const html = `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Cockpit Night Styleguide — Pattern Pilot</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${COCKPIT_NIGHT_FONTS_HEAD}
  <style>
${COCKPIT_NIGHT_BASE_CSS}
${styleguideCss}
  </style>
</head>
<body>
  <a class="skip-to-content" href="#top">Zum Inhalt springen</a>
  <div class="styleguide-shell">
    ${sidenavHtml}
    <main class="wrap" id="top">
      <header class="sg-hero">
        <div class="sg-hero-eyebrow">Pattern Pilot · Design System · v${VERSION}</div>
        <h1 class="sg-hero-title">Cockpit<br><span class="accent">Night</span></h1>
        <p class="sg-hero-lead">Ein dunkles, ruhiges Interface mit weissen Daten-Karten und <strong>rationiertem Neon</strong>. Drei Schriften, vier Farbfamilien, fuenf Accent-Register. Dieser Guide zeigt alle Primitives in ihrer kanonischen Form — jede Entscheidung ist nachvollziehbar in <code>lib/html/tokens.mjs</code> und <code>lib/html/components.mjs</code> verankert.</p>
        <div class="sg-hero-meta">
          <div class="sg-hero-meta-item">
            <span class="sg-hero-meta-key">Version</span>
            <span class="sg-hero-meta-value">${VERSION}</span>
          </div>
          <div class="sg-hero-meta-item">
            <span class="sg-hero-meta-key">Last Updated</span>
            <span class="sg-hero-meta-value">${LAST_UPDATED}</span>
          </div>
          <div class="sg-hero-meta-item">
            <span class="sg-hero-meta-key">Tokens</span>
            <span class="sg-hero-meta-value"><a href="../../lib/html/tokens.mjs">lib/html/tokens.mjs</a></span>
          </div>
          <div class="sg-hero-meta-item">
            <span class="sg-hero-meta-key">Components</span>
            <span class="sg-hero-meta-value"><a href="../../lib/html/components.mjs">lib/html/components.mjs</a></span>
          </div>
          <div class="sg-hero-meta-item">
            <span class="sg-hero-meta-key">Templates</span>
            <span class="sg-hero-meta-value">Landscape + Discovery <em>(strukturell eingefroren)</em></span>
          </div>
        </div>
      </header>

${sectionsHtml}

    </main>
  </div>
  ${renderInfoDialog({})}
  <script>
${INFO_DIALOG_SCRIPT}
  </script>
</body>
</html>`;

writeFileSync(outPath, html, "utf8");
console.log(`Wrote ${outPath} (${html.length} bytes, ${sections.length} chapters)`);
