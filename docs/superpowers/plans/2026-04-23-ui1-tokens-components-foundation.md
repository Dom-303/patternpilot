# UI-1: Cockpit Night Tokens + Components Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Legt die geteilte Token- und Komponenten-Basis fuer die Cockpit-Night-Migration der drei HTML-Renderer an, ohne die Reports visuell zu veraendern.

**Architecture:** Zwei neue Module unter `lib/html/` — `tokens.mjs` mit reinen CSS-Fragment-Strings (Variablen, Reset, Typo, Layout, Atmosphere, Print-Base) und `components.mjs` mit propbasierten HTML-Primitives (Hero, Sidenav, Content-Intro, Stat-Card, Section-Card, Repo-Row, Axis-Row, Meta-Grid, Info-Button + Dialog-Script). Kein Import aus `sections.mjs`/`shared.mjs`; keine Integration in bestehende Renderer. UI-2 wird die Adapter-Schicht zwischen Datenmodell und diesen Primitives bauen.

**Tech Stack:** Node.js ES Modules, reine Template-Strings, keine neuen NPM-Dependencies. Fonts: Syne + IBM Plex Sans + JetBrains Mono (Google Fonts, via `<link>`-Tags). Token-Quelle: `docs/reference/REPORT_UI_FRAMEWORK.md` + `docs/reference/ui-mockup-cockpit-night.html`.

---

## File Structure

- **Create:** `lib/html/tokens.mjs` — CSS-Fragmente als String-Exports. Keine Runtime-Logik, kein HTML.
- **Create:** `lib/html/components.mjs` — HTML-emittierende Primitive + ein JS-Konstanten-Export fuer Info-Dialog-Handler. Importiert nur `escapeHtml` lokal (duplizieren statt aus `shared.mjs` ziehen — entkoppelt UI-1 komplett von Legacy-CSS).
- **Nicht angefasst:** `lib/html/document.mjs`, `lib/html/sections.mjs`, `lib/html/shared.mjs`, `lib/html-renderer.mjs`, `lib/landscape/html-report.mjs`.

Die `escapeHtml`-Duplizierung ist bewusst: Die Komponenten-Library soll ohne Abhaengigkeit auf Legacy-Helpers lauffaehig sein. Bei UI-2a/b/c entscheiden wir pro Renderer, ob die lokale Kopie durch Import aus `shared.mjs` ersetzt wird oder `shared.mjs` auf `components.mjs` zurueckgefuehrt wird. Das Thema bleibt bis UI-2 offen und ist kein UI-1-Blocker.

---

## Verification Strategy

UI-1 aendert visuell nichts an bestehenden Reports, weil keine Import-Verdrahtung passiert. Trotzdem wird jeder Schritt wie folgt abgesichert:

1. **Syntax:** `node --check <file>` nach jedem Write.
2. **Module-Smoke:** `node --input-type=module -e "..."` importiert das Modul und ruft jede exportierte Komponente mit Dummy-Props auf — Assertion: Rueckgabewert ist nicht-leerer String und enthaelt erwartete CSS-Klasse.
3. **Regression:** Am Ende ein existierender Report-Run neu gerendert (`npm run on-demand` oder ein bestehender Lauf-HTML-Re-Render), Browser-Check dass nichts anders aussieht. Trivial wahr wegen Null-Import, fuengt aber versehentliche Seiteneffekte.

---

## Task 1: tokens.mjs — alle CSS-Fragmente

**Files:**
- Create: `lib/html/tokens.mjs`

- [ ] **Step 1.1: Datei schreiben**

Create `lib/html/tokens.mjs` with the following content:

```javascript
// lib/html/tokens.mjs
//
// Cockpit Night design tokens and base CSS fragments.
// Pure string exports, no runtime logic.
// Source of truth: docs/reference/REPORT_UI_FRAMEWORK.md
//                  docs/reference/ui-mockup-cockpit-night.html
//
// Renderers splice these into a single <style> block in canonical order:
//   COCKPIT_NIGHT_TOKENS_CSS
//   COCKPIT_NIGHT_RESET_CSS
//   COCKPIT_NIGHT_ATMOSPHERE_CSS
//   COCKPIT_NIGHT_TYPOGRAPHY_CSS
//   COCKPIT_NIGHT_LAYOUT_CSS
//   COCKPIT_NIGHT_COMPONENTS_CSS
//
// For convenience the combined string is exported as COCKPIT_NIGHT_BASE_CSS.
//
// Fonts are delivered as <link> tags via COCKPIT_NIGHT_FONTS_HEAD so renderers
// can drop the fragment straight into <head>.

export const COCKPIT_NIGHT_FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`;

export const COCKPIT_NIGHT_TOKENS_CSS = `:root {
  --bg: #0e131f;
  --bg-card: #1c2338;
  --bg-card-alt: #232b45;
  --ink: #f1f3f9;
  --ink-soft: #aeb4c3;
  --ink-muted: #727891;
  --rule: #323a56;
  --rule-soft: #262c44;
  --neon-magenta: #ff3d97;
  --neon-pink: #ff7ab0;
  --neon-orange: #ff9a48;
  --neon-green: #66e87a;
  --neon-purple: #a97aff;
  --neon-cyan: #5de5ed;
  --card-bg: #ffffff;
  --card-bg-alt: #f6f7fb;
  --card-ink: #0e131f;
  --card-ink-soft: #3f465e;
  --card-ink-muted: #7a819a;
  --card-rule: #e3e6ef;
  --card-rule-soft: #eef0f7;
  --card-green: #1e8a33;
  --card-orange: #c24d00;
  --card-purple: #5b35c4;
}`;

export const COCKPIT_NIGHT_RESET_CSS = `*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; scroll-padding-top: 40px; }
body {
  margin: 0;
  font-family: 'IBM Plex Sans', system-ui, sans-serif;
  background: var(--bg);
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  position: relative;
  overflow-x: hidden;
  min-height: 100vh;
}`;

export const COCKPIT_NIGHT_ATMOSPHERE_CSS = `body::before {
  content: '';
  position: fixed; inset: 0;
  background-image:
    radial-gradient(1px 1px at 12% 22%, rgba(255,255,255,0.5), transparent),
    radial-gradient(1px 1px at 78% 8%, rgba(255,255,255,0.35), transparent),
    radial-gradient(1px 1px at 48% 68%, rgba(255,255,255,0.3), transparent),
    radial-gradient(1px 1px at 8% 82%, rgba(255,255,255,0.42), transparent),
    radial-gradient(1px 1px at 92% 76%, rgba(255,255,255,0.32), transparent),
    radial-gradient(1px 1px at 32% 8%, rgba(255,255,255,0.28), transparent),
    radial-gradient(1.5px 1.5px at 62% 34%, rgba(169,122,255,0.55), transparent),
    radial-gradient(1.5px 1.5px at 24% 58%, rgba(93,229,237,0.4), transparent),
    radial-gradient(2px 2px at 85% 45%, rgba(255,61,151,0.35), transparent);
  pointer-events: none;
  z-index: 0;
}`;

export const COCKPIT_NIGHT_TYPOGRAPHY_CSS = `.cp-syne { font-family: 'Syne', sans-serif; }
.cp-mono { font-family: 'JetBrains Mono', monospace; }
.cp-body { font-family: 'IBM Plex Sans', sans-serif; }
.cp-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--ink-muted);
  font-weight: 600;
}`;

export const COCKPIT_NIGHT_LAYOUT_CSS = `.shell {
  display: grid;
  grid-template-columns: 252px minmax(0, 1fr);
  gap: 64px;
  max-width: 1400px;
  margin: 0 auto;
  padding: 40px 40px 96px 24px;
  position: relative;
  z-index: 2;
}
.wrap { min-width: 0; }
@media (max-width: 960px) {
  .shell { grid-template-columns: 1fr; gap: 24px; padding: 24px 20px 80px; }
  .sidenav { display: none; }
}
.section-break {
  position: relative;
  width: 240px;
  height: 1px;
  margin: 96px auto 72px;
  background: linear-gradient(90deg, transparent, var(--rule) 30%, var(--rule) 70%, transparent);
}
.section-break::before {
  content: '';
  position: absolute; left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--neon-magenta);
  box-shadow: 0 0 14px rgba(255,61,151,0.8), 0 0 30px rgba(255,61,151,0.35);
}
.group { margin-bottom: 72px; }
.group-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 20px;
  padding-bottom: 18px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--rule-soft);
}
.group-head h3 {
  font-family: 'Syne', sans-serif;
  font-weight: 700; text-transform: uppercase;
  font-size: 18px; letter-spacing: 0.005em;
  margin: 0;
  color: var(--ink);
  display: inline-flex; align-items: center; gap: 14px;
}
.group-head h3::before {
  content: '';
  display: inline-block;
  width: 8px; height: 8px;
  background: var(--neon-green);
  box-shadow: 0 0 12px rgba(102,232,122,0.55);
  border-radius: 2px;
}`;

export const COCKPIT_NIGHT_COMPONENTS_CSS = `/* Hero */
.hero { text-align: center; padding: 80px 0 32px; position: relative; }
.hero h1 {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: clamp(60px, 9vw, 108px);
  line-height: 0.9;
  letter-spacing: -0.04em;
  margin: 0 0 20px;
  color: var(--ink);
  text-transform: uppercase;
}
.hero h1 .pilot {
  display: inline-block;
  background: linear-gradient(120deg, var(--neon-magenta) 0%, var(--neon-pink) 30%, var(--neon-orange) 65%, var(--neon-green) 100%);
  -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
}
.hero .slogan {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 17px; line-height: 1.55;
  color: var(--ink-soft);
  max-width: 560px;
  margin: 0 auto;
  font-weight: 400;
}

/* Sidenav */
.sidenav {
  position: sticky;
  top: 32px;
  align-self: start;
  max-height: calc(100vh - 64px);
  overflow-y: auto;
}
.sidenav-logo-link {
  display: inline-block;
  margin: 80px 0 56px 12px;
  border-radius: 12px;
  transition: transform 0.2s, filter 0.2s;
  cursor: pointer;
}
.sidenav-logo-link:hover { transform: translateY(-2px); filter: brightness(1.1); }
.sidenav-logo { display: block; width: 72px; height: 72px; }
.sidenav-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--ink-muted);
  padding-left: 18px;
  margin-bottom: 14px;
  font-weight: 600;
}
.sidenav-list {
  list-style: none;
  padding: 0; margin: 0;
  border-left: 1px solid var(--rule);
}
.sidenav-list a {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px; letter-spacing: 0.1em;
  color: var(--ink-soft);
  text-decoration: none;
  border-left: 2px solid transparent;
  margin-left: -1px;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
  text-transform: uppercase;
  line-height: 1.3;
}
.sidenav-list a .n {
  font-size: 10.5px;
  color: var(--ink-muted);
  letter-spacing: 0.12em;
  transition: color 0.2s;
}
.sidenav-list a:hover { color: var(--ink); background: rgba(255,61,151,0.05); }
.sidenav-list a:hover .n { color: var(--ink-soft); }
.sidenav-list a.active {
  color: var(--neon-magenta);
  border-left-color: var(--neon-magenta);
  background: rgba(255,61,151,0.07);
  box-shadow: inset 0 0 20px rgba(255,61,151,0.05);
}
.sidenav-list a.active .n { color: var(--neon-magenta); }

/* Content Intro */
.content-intro {
  text-align: center;
  margin: 16px auto 84px;
  max-width: 760px;
  padding: 0 20px;
}
.content-intro .eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.24em; text-transform: uppercase;
  font-weight: 600;
  color: var(--neon-magenta);
  margin-bottom: 32px;
  display: inline-flex; align-items: center; gap: 14px;
  text-shadow: 0 0 24px rgba(255,61,151,0.35);
}
.content-intro .eyebrow::before,
.content-intro .eyebrow::after {
  content: '';
  width: 26px; height: 1px;
  background: linear-gradient(90deg, transparent, var(--neon-magenta), transparent);
  opacity: 0.55;
}
.content-intro .subject {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: clamp(30px, 4vw, 50px);
  line-height: 1.12;
  letter-spacing: -0.025em;
  color: var(--ink);
  margin: 0 0 18px;
  word-break: break-word;
}
.content-intro .subject-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  letter-spacing: 0.08em;
  color: var(--ink-muted);
  margin-bottom: 36px;
  word-break: break-all;
}
.content-intro .meta {
  display: inline-flex; gap: 14px; align-items: center;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--ink-soft);
  padding-top: 28px;
  border-top: 1px solid var(--rule-soft);
}
.content-intro .meta .sep { color: var(--ink-muted); }
.content-intro .meta .accent { color: var(--neon-orange); }
.content-intro .intro-actions {
  margin-top: 24px;
  display: inline-flex; align-items: center; gap: 8px;
}

/* Stat Card */
.preview {
  display: grid; grid-template-columns: repeat(3, 1fr);
  column-gap: 16px; row-gap: 20px;
  margin-bottom: 72px;
}
.stat {
  background: var(--card-bg);
  border: 1px solid var(--card-rule);
  border-radius: 10px; padding: 26px 24px;
  position: relative; overflow: hidden;
  box-shadow: 0 12px 32px rgba(0,0,0,0.35);
}
.stat::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--neon-magenta), var(--neon-pink));
}
.stat.accent-purple::before { background: linear-gradient(90deg, var(--neon-purple), var(--neon-magenta)); }
.stat.accent-orange::before { background: linear-gradient(90deg, var(--neon-orange), var(--neon-magenta)); }
.stat.accent-green::before { background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan)); }
.stat.accent-cyan::before { background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple)); }
.stat.accent-mixed::before { background: linear-gradient(90deg, var(--neon-green), var(--neon-orange)); }
.stat .k { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--card-ink-muted); margin-bottom: 10px; font-weight: 600; }
.stat .v { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 48px; line-height: 1; letter-spacing: -0.03em; color: var(--card-ink); }
.stat .trend { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--card-green); margin-top: 10px; letter-spacing: 0.04em; font-weight: 500; }
.stat .trend.warn { color: var(--card-orange); }
.stat.meta .v {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 18px;
  letter-spacing: -0.005em;
  line-height: 1.25;
  word-break: break-word;
}
.stat.meta .trend { color: var(--card-ink-muted); }

/* Section Card */
.section-preview {
  background: var(--card-bg);
  border: 1px solid var(--card-rule);
  border-radius: 12px;
  padding: 0;
  box-shadow: 0 18px 56px rgba(0,0,0,0.4);
  color: var(--card-ink);
  position: relative;
  overflow: hidden;
  counter-reset: row-counter;
}
.section-preview::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, var(--neon-magenta), var(--neon-orange));
}
.section-preview.accent-magenta::before { background: linear-gradient(90deg, var(--neon-magenta), var(--neon-pink)); }
.section-preview.accent-purple::before { background: linear-gradient(90deg, var(--neon-purple), var(--neon-magenta)); }
.section-preview.accent-orange::before { background: linear-gradient(90deg, var(--neon-orange), var(--neon-magenta)); }
.section-preview.accent-green::before { background: linear-gradient(90deg, var(--neon-green), var(--neon-cyan)); }
.section-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 20px; flex-wrap: wrap;
  padding: 28px 36px 22px;
  border-bottom: 1px solid var(--card-rule);
  background: linear-gradient(180deg, #f8f9fc, #ffffff);
}
.section-head .title { display: flex; flex-direction: column; gap: 6px; }
.section-preview h2 {
  font-family: 'Syne', sans-serif;
  font-weight: 700; text-transform: uppercase;
  font-size: 22px; letter-spacing: -0.01em;
  margin: 0; color: var(--card-ink);
  display: inline-flex; align-items: center; gap: 12px;
}
.section-preview h2 .marker {
  display: inline-block;
  width: 10px; height: 10px;
  background: var(--neon-magenta);
  box-shadow: 0 0 12px rgba(255,61,151,0.55);
  border-radius: 2px;
}
.section-preview.accent-purple h2 .marker { background: var(--neon-purple); box-shadow: 0 0 12px rgba(169,122,255,0.5); }
.section-preview.accent-orange h2 .marker { background: var(--neon-orange); box-shadow: 0 0 12px rgba(255,154,72,0.5); }
.section-preview.accent-green h2 .marker { background: var(--neon-green); box-shadow: 0 0 12px rgba(102,232,122,0.5); }
.section-preview .sub {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--card-ink-muted);
  margin: 0;
}
.section-head .count-chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--card-ink-soft);
  padding: 6px 12px;
  background: var(--card-rule-soft);
  border: 1px solid var(--card-rule);
  border-radius: 5px;
  font-weight: 700;
}
.head-actions { display: inline-flex; align-items: center; gap: 12px; flex-shrink: 0; }
.section-body { padding: 4px 0 8px; }
.section-preview + .section-preview { margin-top: 56px; }

/* Info Button + Dialog */
.info-btn, .dark-info-btn {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: 1px solid var(--card-rule);
  background: transparent;
  color: var(--card-ink-muted);
  font-family: 'JetBrains Mono', monospace;
  font-style: italic;
  font-weight: 500;
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  display: inline-flex;
  align-items: center; justify-content: center;
  padding: 0;
  transition: color 0.2s, border-color 0.2s, background 0.2s, transform 0.2s;
  flex-shrink: 0;
}
.dark-info-btn { border-color: var(--rule); color: var(--ink-muted); }
.info-btn:hover, .dark-info-btn:hover {
  border-color: var(--neon-magenta);
  color: var(--neon-magenta);
  background: rgba(255,61,151,0.08);
  transform: scale(1.06);
}
[data-info-panel] { display: none; }
.info-modal {
  border: 1px solid var(--rule);
  border-radius: 14px;
  padding: 0;
  background: var(--bg-card);
  color: var(--ink-soft);
  max-width: 540px;
  width: calc(100% - 48px);
  margin: auto;
  box-shadow: 0 30px 90px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,61,151,0.08);
}
.info-modal::backdrop { background: rgba(4, 6, 14, 0.72); backdrop-filter: blur(6px); }
.info-modal[open] { animation: cpModalPop 0.22s cubic-bezier(0.4, 0, 0.2, 1); }
@keyframes cpModalPop {
  from { opacity: 0; transform: translateY(8px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0)   scale(1); }
}
.info-modal .modal-head {
  display: flex; justify-content: space-between; align-items: center; gap: 20px;
  padding: 22px 28px;
  border-bottom: 1px solid var(--rule);
  background: linear-gradient(180deg, rgba(255,61,151,0.05), transparent);
}
.info-modal .modal-head h3 {
  font-family: 'Syne', sans-serif;
  font-weight: 700; text-transform: uppercase;
  font-size: 18px; color: var(--ink); margin: 0;
  display: inline-flex; align-items: center; gap: 12px;
  letter-spacing: 0.005em;
}
.info-modal .modal-head h3::before {
  content: '';
  width: 8px; height: 8px;
  background: var(--neon-magenta);
  box-shadow: 0 0 12px rgba(255,61,151,0.6);
  border-radius: 2px;
}
.info-modal .modal-close {
  width: 32px; height: 32px;
  border: 1px solid var(--rule);
  background: transparent;
  color: var(--ink-muted);
  font-size: 20px;
  cursor: pointer;
  border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  transition: color 0.2s, border-color 0.2s, background 0.2s;
  padding: 0; line-height: 1; font-family: inherit;
}
.info-modal .modal-close:hover {
  border-color: var(--neon-magenta);
  color: var(--neon-magenta);
  background: rgba(255,61,151,0.08);
}
.info-modal .modal-body {
  padding: 24px 28px 28px;
  font-size: 14px;
  line-height: 1.65;
  color: var(--ink-soft);
}
.info-modal .modal-body p { margin: 0 0 12px; }
.info-modal .modal-body p:last-child { margin-bottom: 0; }
.info-modal .modal-body strong { color: var(--ink); font-weight: 600; }
.info-modal .modal-body em { color: var(--neon-magenta); font-style: normal; font-weight: 500; }

/* Repo Row */
.repo-row {
  display: grid;
  grid-template-columns: 32px 1fr auto auto;
  gap: 20px; align-items: center;
  padding: 18px 36px;
  border-top: 1px solid var(--card-rule-soft);
  counter-increment: row-counter;
  position: relative;
}
.repo-row:nth-child(even) { background: #f9fafc; }
.repo-row:first-of-type { border-top: none; }
.repo-row::before {
  content: counter(row-counter, decimal-leading-zero);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.08em;
  color: var(--card-ink-muted);
  font-weight: 600;
}
.repo-row .name {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 600;
  font-size: 14.5px;
  color: var(--card-ink);
  letter-spacing: -0.005em;
}
a.name {
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: color 0.15s;
}
a.name::after {
  content: '↗';
  font-size: 11px;
  color: var(--card-ink-muted);
  transition: color 0.15s, transform 0.15s;
}
a.name:hover { color: var(--neon-magenta); }
a.name:hover::after { color: var(--neon-magenta); transform: translate(1px, -1px); }
.repo-row .meta { font-size: 12px; color: var(--card-ink-muted); margin-top: 5px; line-height: 1.45; }
.repo-row .badge {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase;
  padding: 6px 11px; border-radius: 4px;
  font-weight: 700;
  display: inline-flex; align-items: center; gap: 7px;
}
.repo-row .badge::before {
  content: '';
  width: 6px; height: 6px; border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
}
.badge.adopt { background: rgba(30, 138, 51, 0.1); color: var(--card-green); border: 1px solid rgba(30, 138, 51, 0.3); }
.badge.adapt { background: rgba(194, 77, 0, 0.1); color: var(--card-orange); border: 1px solid rgba(194, 77, 0, 0.3); }
.badge.observe { background: rgba(91, 53, 196, 0.1); color: var(--card-purple); border: 1px solid rgba(91, 53, 196, 0.3); }
.score-cell {
  display: flex; flex-direction: column; align-items: flex-end;
  padding-left: 20px;
  border-left: 1px solid var(--card-rule-soft);
  min-width: 76px;
}
.score-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--card-ink-muted);
  font-weight: 700;
  margin-bottom: 2px;
}
.score {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 28px;
  line-height: 1;
  letter-spacing: -0.025em;
  color: var(--card-ink);
  font-variant-numeric: tabular-nums;
}

/* Axis Row */
.axis-row {
  display: grid;
  grid-template-columns: 32px 160px 1fr 72px 70px;
  gap: 20px; align-items: center;
  padding: 16px 36px;
  border-top: 1px solid var(--card-rule-soft);
  counter-increment: row-counter;
}
.axis-row:nth-child(even) { background: #f9fafc; }
.axis-row:first-of-type { border-top: none; }
.axis-row::before {
  content: counter(row-counter, decimal-leading-zero);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; letter-spacing: 0.08em;
  color: var(--card-ink-muted);
  font-weight: 600;
}
.axis-label { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: var(--card-ink); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
.axis-track {
  height: 8px; background: var(--card-rule); border-radius: 4px; position: relative;
  background-image: linear-gradient(90deg, var(--card-rule-soft) 1px, transparent 1px);
  background-size: 10% 100%;
}
.axis-fill {
  position: absolute; left: 0; top: 0; bottom: 0;
  background: linear-gradient(90deg, var(--neon-magenta), var(--neon-orange));
  border-radius: 4px;
}
.axis-fill::after {
  content: '';
  position: absolute; right: -3px; top: 50%;
  transform: translateY(-50%);
  width: 10px; height: 10px;
  background: #fff;
  border: 2px solid var(--neon-orange);
  border-radius: 50%;
  box-shadow: 0 0 10px rgba(255,154,72,0.55);
}
.axis-percent { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; color: var(--card-ink); letter-spacing: -0.02em; text-align: right; }
.axis-value { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--card-ink-soft); text-align: right; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }

/* Meta Grid */
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  margin: 6px 36px 20px;
  gap: 1px;
  background: var(--card-rule-soft);
  border: 1px solid var(--card-rule-soft);
  border-radius: 6px;
  overflow: hidden;
}
.meta-grid > div {
  padding: 18px 22px;
  background: var(--card-bg);
  position: relative;
}
.meta-grid > div::before {
  content: '';
  position: absolute; left: 0; top: 22px; bottom: 22px;
  width: 2px;
  background: var(--neon-green);
  opacity: 0.55;
  border-radius: 2px;
}
.meta-grid .k {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase;
  color: var(--card-ink-muted);
  margin-bottom: 8px;
  font-weight: 600;
}
.meta-grid .v {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--card-ink);
  font-weight: 600;
}`;

export const COCKPIT_NIGHT_BASE_CSS = [
  COCKPIT_NIGHT_TOKENS_CSS,
  COCKPIT_NIGHT_RESET_CSS,
  COCKPIT_NIGHT_ATMOSPHERE_CSS,
  COCKPIT_NIGHT_TYPOGRAPHY_CSS,
  COCKPIT_NIGHT_LAYOUT_CSS,
  COCKPIT_NIGHT_COMPONENTS_CSS
].join("\n\n");
```

- [ ] **Step 1.2: Syntax-Check**

Run: `node --check lib/html/tokens.mjs`
Expected: kein Fehler, exit 0.

- [ ] **Step 1.3: Smoke-Import**

Run:
```bash
node --input-type=module -e "
import('./lib/html/tokens.mjs').then(m => {
  const required = [
    'COCKPIT_NIGHT_FONTS_HEAD',
    'COCKPIT_NIGHT_TOKENS_CSS',
    'COCKPIT_NIGHT_RESET_CSS',
    'COCKPIT_NIGHT_ATMOSPHERE_CSS',
    'COCKPIT_NIGHT_TYPOGRAPHY_CSS',
    'COCKPIT_NIGHT_LAYOUT_CSS',
    'COCKPIT_NIGHT_COMPONENTS_CSS',
    'COCKPIT_NIGHT_BASE_CSS'
  ];
  for (const key of required) {
    if (typeof m[key] !== 'string' || m[key].length === 0) {
      throw new Error('Missing or empty export: ' + key);
    }
  }
  if (!m.COCKPIT_NIGHT_TOKENS_CSS.includes('--bg: #0e131f')) {
    throw new Error('Base token --bg missing');
  }
  if (!m.COCKPIT_NIGHT_BASE_CSS.includes('.section-preview')) {
    throw new Error('Combined CSS missing component rule');
  }
  console.log('tokens.mjs OK');
});
"
```
Expected output: `tokens.mjs OK`

---

## Task 2: components.mjs — Layout-Primitive

**Files:**
- Create: `lib/html/components.mjs`

- [ ] **Step 2.1: Datei mit Layout-Komponenten schreiben**

Create `lib/html/components.mjs` with the following content (weitere Primitives kommen in Task 3 dazu, daher schreibe nur bis inklusive `renderInfoDialog` + `INFO_DIALOG_SCRIPT`):

```javascript
// lib/html/components.mjs
//
// Cockpit Night visual primitives. Pure HTML-emitting functions with flat props.
// No dependency on sections.mjs / shared.mjs — UI-2 will write the adapter
// layer that maps report data shapes onto these primitives.
//
// Grouped into two families:
//   - Layout primitives     (hero, section-break, content-intro, sidenav,
//                           info-button, info-dialog, INFO_DIALOG_SCRIPT)
//   - Data-display primitives (stat-card, stat-grid, meta-grid,
//                             section-card, repo-row, axis-row)
//
// Every function is prop-first: no hidden couplings, no report-shape knowledge.

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Layout primitives -----------------------------------------------------

export function renderCockpitHero({ title = "Pattern", pilotWord = "Pilot", slogan = "" }) {
  const safeTitle = escapeHtml(title);
  const safePilot = escapeHtml(pilotWord);
  const sloganFragment = slogan
    ? `<p class="slogan">${escapeHtml(slogan)}</p>`
    : "";
  return `<section class="hero">
  <h1>${safeTitle}<br><span class="pilot">${safePilot}</span></h1>
  ${sloganFragment}
</section>`;
}

export function renderSectionBreak() {
  return `<div class="section-break"></div>`;
}

export function renderContentIntro({
  eyebrow,
  subject,
  subjectId = "",
  meta = [],
  actions = "",
  infoPanel = null
} = {}) {
  const subjectIdFragment = subjectId
    ? `<div class="subject-id">${escapeHtml(subjectId)}</div>`
    : "";
  const metaFragment = renderIntroMeta(meta);
  const actionsFragment = actions
    ? `<div class="intro-actions">${actions}</div>`
    : "";
  const panelFragment = renderInfoPanel(infoPanel);
  const sectionId = infoPanel?.id
    ? ` id="${escapeHtml(infoPanel.id)}" data-nav-section`
    : "";
  return `<section class="content-intro"${sectionId}>
  <div class="eyebrow">${escapeHtml(eyebrow ?? "")}</div>
  <h2 class="subject">${escapeHtml(subject ?? "")}</h2>
  ${subjectIdFragment}
  ${metaFragment}
  ${actionsFragment}
  ${panelFragment}
</section>`;
}

function renderIntroMeta(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const parts = [];
  items.forEach((item, index) => {
    if (index > 0) {
      parts.push(`<span class="sep">·</span>`);
    }
    const cls = item?.accent ? ` class="accent"` : "";
    parts.push(`<span${cls}>${escapeHtml(item?.label ?? item ?? "")}</span>`);
  });
  return `<div class="meta">${parts.join("\n  ")}</div>`;
}

function renderInfoPanel(panel) {
  if (!panel || !panel.id || !panel.bodyHtml) return "";
  return `<div class="info-panel" hidden data-info-panel="${escapeHtml(panel.id)}">
    ${panel.bodyHtml}
  </div>`;
}

export function renderSidenav({ logoSrc, logoAlt = "Pattern Pilot", eyebrow = "Inhalt", items = [] } = {}) {
  const logoFragment = logoSrc
    ? `<a href="#top" class="sidenav-logo-link" aria-label="Zum Seitenanfang">
      <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(logoAlt)}" class="sidenav-logo">
    </a>`
    : "";
  const links = items
    .map((item, index) => {
      const number = String(index + 1).padStart(2, "0");
      const activeCls = item?.active ? ' class="active"' : "";
      const href = item?.href ?? `#${item?.id ?? ""}`;
      const label = escapeHtml(item?.label ?? "");
      return `    <li><a href="${escapeHtml(href)}"${activeCls}><span class="n">${number}</span>${label}</a></li>`;
    })
    .join("\n");
  return `<nav class="sidenav">
  ${logoFragment}
  <div class="sidenav-eyebrow">${escapeHtml(eyebrow)}</div>
  <ul class="sidenav-list">
${links}
  </ul>
</nav>`;
}

export function renderInfoButton({ triggerId, label, darkVariant = false } = {}) {
  const cls = darkVariant ? "dark-info-btn" : "info-btn";
  return `<button class="${cls}" aria-label="${escapeHtml(label ?? "Info")}" aria-expanded="false" data-info-trigger="${escapeHtml(triggerId ?? "")}">i</button>`;
}

export function renderInfoDialog({ id = "info-modal", closeLabel = "Schliessen" } = {}) {
  return `<dialog class="info-modal" id="${escapeHtml(id)}" aria-labelledby="${escapeHtml(id)}-title">
  <div class="modal-head">
    <h3 id="${escapeHtml(id)}-title">Info</h3>
    <button class="modal-close" aria-label="${escapeHtml(closeLabel)}">&times;</button>
  </div>
  <div class="modal-body" id="${escapeHtml(id)}-body"></div>
</dialog>`;
}

export const INFO_DIALOG_SCRIPT = `(() => {
  const links = document.querySelectorAll('.sidenav-list a');
  const sections = document.querySelectorAll('[data-nav-section]');
  const setActive = (id) => {
    links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
  };
  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(s => observer.observe(s));
  }

  const logoLink = document.querySelector('.sidenav-logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const modal = document.getElementById('info-modal');
  if (!modal) return;
  const modalTitle = document.getElementById('info-modal-title');
  const modalBody = document.getElementById('info-modal-body');
  const modalClose = modal.querySelector('.modal-close');
  document.querySelectorAll('[data-info-trigger]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-info-trigger');
      const panel = document.querySelector('[data-info-panel="' + id + '"]');
      if (!panel) return;
      const titleAttr = btn.getAttribute('data-info-title') || modalTitle.textContent;
      modalTitle.textContent = titleAttr;
      modalBody.replaceChildren(...Array.from(panel.cloneNode(true).children));
      if (typeof modal.showModal === 'function') modal.showModal();
      else modal.setAttribute('open', '');
    });
  });
  if (modalClose) modalClose.addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => {
    const rect = modal.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right
                && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) modal.close();
  });
})();`;
```

- [ ] **Step 2.2: Syntax-Check**

Run: `node --check lib/html/components.mjs`
Expected: exit 0.

- [ ] **Step 2.3: Smoke-Import (partial, nur Layout-Primitives)**

Run:
```bash
node --input-type=module -e "
import('./lib/html/components.mjs').then(m => {
  const layoutFns = [
    'renderCockpitHero',
    'renderSectionBreak',
    'renderContentIntro',
    'renderSidenav',
    'renderInfoButton',
    'renderInfoDialog'
  ];
  for (const name of layoutFns) {
    if (typeof m[name] !== 'function') throw new Error('Missing function: ' + name);
  }
  const hero = m.renderCockpitHero({ slogan: 'test' });
  if (!hero.includes('class=\"hero\"')) throw new Error('Hero missing class');
  const brk = m.renderSectionBreak();
  if (!brk.includes('section-break')) throw new Error('Section break missing class');
  const intro = m.renderContentIntro({ eyebrow: 'X', subject: 'Y', subjectId: 'z' });
  if (!intro.includes('content-intro')) throw new Error('Intro missing class');
  const nav = m.renderSidenav({ logoSrc: '/a.png', items: [{ href: '#q', label: 'Q' }] });
  if (!nav.includes('sidenav-list')) throw new Error('Sidenav missing list');
  const btn = m.renderInfoButton({ triggerId: 'x', label: 'Info' });
  if (!btn.includes('data-info-trigger')) throw new Error('Info button missing trigger attr');
  const dlg = m.renderInfoDialog({});
  if (!dlg.includes('info-modal')) throw new Error('Dialog missing modal class');
  if (typeof m.INFO_DIALOG_SCRIPT !== 'string' || !m.INFO_DIALOG_SCRIPT.includes('data-info-trigger')) {
    throw new Error('INFO_DIALOG_SCRIPT invalid');
  }
  console.log('components.mjs layout primitives OK');
});
"
```
Expected output: `components.mjs layout primitives OK`

---

## Task 3: components.mjs — Data-Display-Primitive

**Files:**
- Modify: `lib/html/components.mjs` (append below INFO_DIALOG_SCRIPT)

- [ ] **Step 3.1: Data-Display-Primitive anhaengen**

Append to `lib/html/components.mjs`:

```javascript

// ---- Data-display primitives ----------------------------------------------

const STAT_ACCENTS = new Set(["magenta", "purple", "orange", "green", "cyan", "mixed"]);

export function renderStatCard({
  key,
  value,
  trend = "",
  variant = "primary",
  accent,
  trendWarn = false
} = {}) {
  const classes = ["stat"];
  if (variant === "meta") classes.push("meta");
  if (accent && STAT_ACCENTS.has(accent) && accent !== "magenta") {
    classes.push(`accent-${accent}`);
  }
  const trendFragment = trend
    ? `<div class="trend${trendWarn ? " warn" : ""}">${escapeHtml(trend)}</div>`
    : "";
  return `<div class="${classes.join(" ")}">
  <div class="k">${escapeHtml(key ?? "")}</div>
  <div class="v">${escapeHtml(value ?? "")}</div>
  ${trendFragment}
</div>`;
}

export function renderStatGrid(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return "";
  const html = cards.map((card) => renderStatCard(card)).join("\n");
  return `<div class="preview">
${html}
</div>`;
}

const SECTION_ACCENTS = new Set(["magenta", "purple", "orange", "green"]);
const BADGE_TONES = new Set(["adopt", "adapt", "observe"]);

export function renderSectionCard({
  id,
  title,
  sub = "",
  countChip = "",
  accent = "magenta",
  infoButton = null,
  bodyHtml = "",
  infoPanel = null
} = {}) {
  const classes = ["section-preview"];
  if (accent && SECTION_ACCENTS.has(accent) && accent !== "magenta") {
    classes.push(`accent-${accent}`);
  }
  const idAttr = id ? ` id="${escapeHtml(id)}" data-nav-section` : "";
  const subFragment = sub ? `<div class="sub">${escapeHtml(sub)}</div>` : "";
  const countFragment = countChip
    ? `<span class="count-chip">${escapeHtml(countChip)}</span>`
    : "";
  const infoFragment = infoButton
    ? renderInfoButton({
        triggerId: infoButton.triggerId ?? id ?? "",
        label: infoButton.label,
        darkVariant: infoButton.darkVariant ?? false
      })
    : "";
  const panelFragment = renderInfoPanel(infoPanel);
  return `<div class="${classes.join(" ")}"${idAttr}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>${escapeHtml(title ?? "")}</h2>
      ${subFragment}
    </div>
    <div class="head-actions">
      ${countFragment}
      ${infoFragment}
    </div>
  </div>
  ${panelFragment}
  <div class="section-body">
    ${bodyHtml}
  </div>
</div>`;
}

export function renderRepoRow({
  name,
  href = "",
  meta = "",
  decision = null,
  score = null,
  scoreLabel = "Score"
} = {}) {
  const nameFragment = href
    ? `<a class="name" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name ?? "")}</a>`
    : `<div class="name">${escapeHtml(name ?? "")}</div>`;
  const metaFragment = meta ? `<div class="meta">${escapeHtml(meta)}</div>` : "";
  const badgeFragment = decision && BADGE_TONES.has(decision.tone)
    ? `<span class="badge ${decision.tone}">${escapeHtml(decision.label ?? decision.tone)}</span>`
    : "";
  const scoreFragment = score != null
    ? `<div class="score-cell">
    <div class="score-label">${escapeHtml(scoreLabel)}</div>
    <div class="score">${escapeHtml(score)}</div>
  </div>`
    : "";
  return `<div class="repo-row">
  <div>
    ${nameFragment}
    ${metaFragment}
  </div>
  ${badgeFragment}
  ${scoreFragment}
</div>`;
}

export function renderAxisRow({ label, percent, valueLabel = "" } = {}) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="axis-row">
  <div class="axis-label">${escapeHtml(label ?? "")}</div>
  <div class="axis-track"><div class="axis-fill" style="width: ${safePercent}%;"></div></div>
  <div class="axis-percent">${safePercent}%</div>
  <div class="axis-value">${escapeHtml(valueLabel)}</div>
</div>`;
}

export function renderMetaGrid(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const cells = items
    .map((item) => `  <div>
    <div class="k">${escapeHtml(item?.key ?? "")}</div>
    <div class="v">${escapeHtml(item?.value ?? "")}</div>
  </div>`)
    .join("\n");
  return `<div class="meta-grid">
${cells}
</div>`;
}
```

- [ ] **Step 3.2: Syntax-Check**

Run: `node --check lib/html/components.mjs`
Expected: exit 0.

- [ ] **Step 3.3: Smoke-Import (full)**

Run:
```bash
node --input-type=module -e "
import('./lib/html/components.mjs').then(m => {
  const allFns = [
    'renderCockpitHero',
    'renderSectionBreak',
    'renderContentIntro',
    'renderSidenav',
    'renderInfoButton',
    'renderInfoDialog',
    'renderStatCard',
    'renderStatGrid',
    'renderSectionCard',
    'renderRepoRow',
    'renderAxisRow',
    'renderMetaGrid'
  ];
  for (const name of allFns) {
    if (typeof m[name] !== 'function') throw new Error('Missing function: ' + name);
  }
  const stat = m.renderStatCard({ key: 'Kandidaten', value: 12, trend: 'stabil' });
  if (!stat.includes('class=\"stat\"')) throw new Error('Stat card class missing');
  if (!stat.includes('Kandidaten')) throw new Error('Stat card key not escaped into output');
  const meta = m.renderStatCard({ key: 'Lauf-Datum', value: '22. Apr 2026', variant: 'meta' });
  if (!meta.includes('stat meta')) throw new Error('Meta variant class missing');
  const grid = m.renderStatGrid([{ key: 'A', value: 1 }, { key: 'B', value: 2 }]);
  if (!grid.includes('class=\"preview\"')) throw new Error('Stat grid class missing');
  const section = m.renderSectionCard({ id: 'cluster', title: 'Cluster', countChip: '5 Repos', accent: 'magenta', bodyHtml: '<div>body</div>' });
  if (!section.includes('data-nav-section')) throw new Error('Section card missing nav attr');
  if (!section.includes('class=\"marker\"')) throw new Error('Section card missing marker');
  const row = m.renderRepoRow({ name: 'pyJedAI', href: 'https://github.com/x/y', meta: 'A · B', decision: { tone: 'adopt', label: 'Uebernehmen' }, score: '8,4' });
  if (!row.includes('badge adopt')) throw new Error('Repo row badge missing');
  if (!row.includes('a class=\"name\"')) throw new Error('Repo row link missing');
  const rowPlain = m.renderRepoRow({ name: 'no-link', meta: 'x' });
  if (rowPlain.includes('<a class=\"name\"')) throw new Error('Plain repo row should not emit anchor');
  const axis = m.renderAxisRow({ label: 'Latenz', percent: 72, valueLabel: 'Batch' });
  if (!axis.includes('72%')) throw new Error('Axis percent missing');
  if (!axis.includes('width: 72%')) throw new Error('Axis fill width missing');
  const axisClamped = m.renderAxisRow({ label: 'X', percent: 150 });
  if (!axisClamped.includes('100%')) throw new Error('Axis percent not clamped');
  const metaGrid = m.renderMetaGrid([{ key: 'Lauf-ID', value: '2026-04-22' }]);
  if (!metaGrid.includes('class=\"meta-grid\"')) throw new Error('Meta grid missing class');
  const xss = m.renderStatCard({ key: '<script>', value: '\"&\"' });
  if (xss.includes('<script>')) throw new Error('Escape failed for key');
  if (!xss.includes('&lt;script&gt;')) throw new Error('Escape did not convert < to &lt;');
  console.log('components.mjs full OK');
});
"
```
Expected output: `components.mjs full OK`

---

## Task 4: Verification + Commit

**Files:** none modified

- [ ] **Step 4.1: Pruefen dass bestehende Renderer unveraendert sind**

Run: `git diff --name-only lib/html/document.mjs lib/html/sections.mjs lib/html/shared.mjs lib/html-renderer.mjs lib/landscape/html-report.mjs`
Expected output: leer (keine Dateien gelistet). Sonst: Stopp, Fehler klaeren.

- [ ] **Step 4.2: Pruefen dass kein Renderer die neuen Module bereits importiert**

Run: `grep -rn "tokens.mjs\|components.mjs" lib/ scripts/ --include="*.mjs" | grep -v "lib/html/tokens.mjs\|lib/html/components.mjs"`
Expected output: leer. Sonst ist versehentlich eine Verdrahtung reingekommen.

- [ ] **Step 4.3: Bestehenden Report-Lauf re-rendern (Regression-Probe)**

Optionale sanity-Probe — laeuft nur wenn der letzte Lauf lokal vorhanden ist.
Run:
```bash
LATEST=$(ls -t runs/eventbear-worker 2>/dev/null | head -1)
if [ -n "$LATEST" ]; then
  ls -la "runs/eventbear-worker/$LATEST/summary.html" 2>/dev/null && \
    echo "Vorhandener Report: runs/eventbear-worker/$LATEST/summary.html" && \
    echo "Im Browser oeffnen und bestaetigen dass er aussieht wie vor UI-1."
else
  echo "Kein Bestands-Lauf vorhanden, Regression-Probe skippen."
fi
```
Bestaetigung: im Browser oeffnen, grobe Sichtpruefung (kein JS-Fehler, Layout steht) — da kein Import passiert, ist dieser Schritt trivial OK. Nur Alarm wenn irgendwas kaputt ist.

- [ ] **Step 4.4: Smoke-Tests nochmal zusammen laufen**

Run:
```bash
node --check lib/html/tokens.mjs && \
node --check lib/html/components.mjs && \
node --input-type=module -e "
Promise.all([
  import('./lib/html/tokens.mjs'),
  import('./lib/html/components.mjs')
]).then(([t, c]) => {
  if (!t.COCKPIT_NIGHT_BASE_CSS.includes('.repo-row')) throw new Error('tokens base CSS missing repo-row');
  if (typeof c.renderRepoRow !== 'function') throw new Error('components repo row missing');
  if (typeof c.INFO_DIALOG_SCRIPT !== 'string') throw new Error('info dialog script missing');
  console.log('UI-1 foundation OK');
});
"
```
Expected output ends with: `UI-1 foundation OK`

- [ ] **Step 4.5: Commit**

```bash
git add lib/html/tokens.mjs lib/html/components.mjs docs/superpowers/plans/2026-04-23-ui1-tokens-components-foundation.md
git commit -m "$(cat <<'EOF'
feat(report-ui): UI-1 tokens + components foundation

Legt die geteilte Cockpit-Night-Basis fuer die drei Renderer-Migrationen
an (UI-2a/b/c). Zwei neue Module:

- lib/html/tokens.mjs: reine CSS-Fragment-Strings (Tokens, Reset, Typo,
  Layout, Atmosphere, Components) plus Combined COCKPIT_NIGHT_BASE_CSS.
  Fonts als COCKPIT_NIGHT_FONTS_HEAD (Syne + IBM Plex Sans + JetBrains
  Mono).

- lib/html/components.mjs: propbasierte HTML-Primitive fuer Hero,
  Sidenav, Content-Intro, Section-Break, Stat-Card, Stat-Grid,
  Section-Card, Repo-Row, Axis-Row, Meta-Grid, Info-Button +
  Info-Dialog. INFO_DIALOG_SCRIPT als ES-Snippet fuer Scroll-Tracking,
  Logo-Click und Info-Modal.

Keine bestehenden Renderer angefasst, keine Imports — Reports rendern
pixel-gleich. UI-2 wird die Adapter-Schicht zwischen Datenmodell und
Primitives pro Renderer verdrahten.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4.6: Push**

Run: `git push origin main`
Expected: push success.

---

## Self-Review Checklist

1. **Spec coverage:** Alle Mockup-Primitive aus REPORT_UI_FRAMEWORK.md „Komponenten" abgedeckt (Hero, Problem-Intro, Stat-Cards, Section-Cards, Repo-Row, Axis-Row, Meta-Grid, Info-Button + Modal, Sidenav). Keine offenen Luecken fuer UI-2.
2. **Placeholder scan:** Keine TODO/TBD/„implement later" — jede Komponente hat vollen Markup-Code; jedes Smoke-Test-Snippet hat echte Assertions; Commit-Message ausgeschrieben.
3. **Type consistency:** Props-Keys konsistent zwischen Plan-Prosa und Code (`renderRepoRow({ decision: { tone, label } })`, `renderStatCard({ key, value, trend, variant, accent })`, `renderSectionCard({ id, title, sub, countChip, accent, infoButton, bodyHtml, infoPanel })`). `STAT_ACCENTS` passt zu den CSS-Klassen `.stat.accent-*` aus `COCKPIT_NIGHT_COMPONENTS_CSS`. `SECTION_ACCENTS` passt zu `.section-preview.accent-*`.
4. **Scope discipline:** Null Import aus neuer Modulen in bestehende Renderer; `escapeHtml` lokal dupliziert statt aus `shared.mjs` gezogen — haelt UI-1 vollstaendig selbst-contained.
