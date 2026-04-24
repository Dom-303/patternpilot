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
  /* padding-left bewusst klein (10px), damit die Sidebar weiter links am
     Viewport-Rand sitzt und der Content mehr Raum bekommt. */
  padding: 40px 40px 96px 10px;
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
.group { margin-bottom: 56px; }
.group:last-child { margin-bottom: 0; }
.report-overview { margin-bottom: 56px; }
.sections > *:last-child { margin-bottom: 0; }
.report-footer {
  margin-top: 72px;
  padding-top: 32px;
  border-top: 1px solid var(--rule-soft);
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}
.report-footer img {
  width: 48px;
  height: 48px;
  opacity: 0.7;
}
.report-footer p {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-muted);
  margin: 0;
}
.report-footer .footer-cta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin-top: 22px;
  max-width: 820px;
}
.report-footer .footer-cta-link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px 20px;
  min-width: 150px;
  border: 1px solid var(--rule);
  border-radius: 8px;
  background: rgba(28, 35, 56, 0.45);
  color: var(--ink);
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
}
.report-footer .footer-cta-link:hover {
  border-color: var(--neon-magenta);
  background: rgba(255,61,151,0.06);
  transform: translateY(-1px);
}
.report-footer .footer-cta-label {
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  color: var(--ink);
}
.report-footer .footer-cta-hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-muted);
}
.report-footer .footer-next-run {
  margin-top: 20px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  letter-spacing: 0;
  text-transform: none;
  color: var(--ink-soft);
}
.report-footer .footer-next-run-label {
  color: var(--ink-muted);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  margin-right: 8px;
}
.report-footer .footer-next-run code {
  padding: 4px 10px;
  background: var(--bg-card);
  border: 1px solid var(--rule);
  border-radius: 4px;
  color: var(--neon-magenta);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}

/* Clickable recommendation badge (opens explain modal) */
.repo-row .badge.badge--clickable,
.badge.badge--clickable {
  cursor: help;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
  position: relative;
}
.badge.badge--clickable::after {
  content: 'ⓘ';
  margin-left: 6px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 12px;
  font-weight: 400;
  opacity: 0.55;
  transition: opacity 0.15s, transform 0.15s;
  line-height: 1;
}
.badge.badge--clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.35), 0 0 0 1px currentColor;
}
.badge.badge--clickable:hover::after {
  opacity: 1;
  transform: scale(1.1);
}
.badge.badge--clickable:focus-visible {
  outline: 2px solid var(--neon-magenta);
  outline-offset: 2px;
}
.group-head {
  display: flex; align-items: center; justify-content: flex-start;
  gap: 16px;
  padding-bottom: 18px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--rule-soft);
}
.group-head h3 { flex: 1 1 auto; min-width: 0; }
.group-head .info-btn,
.group-head .dark-info-btn { flex-shrink: 0; }
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
  top: 16px;
  align-self: start;
  max-height: calc(100vh - 24px);
  overflow-y: auto;
  overflow-x: hidden;
  /* Scrollbar visuell entfernen: kompaktes Layout soll bei normalen
     Viewport-Hoehen ohne Scrollbar auskommen. Auf sehr kleinen Displays
     bleibt natives Scrollen funktional, aber ohne sichtbare Scrollbar.
     Firefox / Chromium / Safari jeweils abgedeckt. */
  scrollbar-width: none;
  -ms-overflow-style: none;
}
.sidenav::-webkit-scrollbar {
  display: none;
  width: 0;
  height: 0;
}
.sidenav-logo-link {
  display: inline-block;
  /* Kompakt: wenig Platz verschwenden, damit viele Nav-Items auch auf
     kleineren Laptop-Displays ohne Scrollbar reinpassen. P-Logo steht
     links (margin-left 2px), oben nur noch 12px Luft, unten 16px. */
  margin: 12px 0 16px 2px;
  border-radius: 10px;
  transition: transform 0.2s, filter 0.2s;
  cursor: pointer;
}
.sidenav-logo-link:hover { transform: translateY(-2px); filter: brightness(1.1); }
.sidenav-logo { display: block; width: 44px; height: 44px; }
.sidenav-eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px; letter-spacing: 0.2em; text-transform: uppercase;
  color: var(--ink-muted);
  padding-left: 14px;
  margin-bottom: 8px;
  font-weight: 600;
}
.sidenav-list {
  list-style: none;
  padding: 0; margin: 0;
  border-left: 1px solid var(--rule);
}
.sidenav-list a {
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px; letter-spacing: 0.08em;
  color: var(--ink-soft);
  text-decoration: none;
  border-left: 2px solid transparent;
  margin-left: -1px;
  transition: color 0.2s, background 0.2s, border-color 0.2s;
  text-transform: uppercase;
  line-height: 1.2;
  /* Garantiert einzeilig: lange Labels werden mit Ellipsis gekappt statt
     zu umbrechen. Sidebar-Breite (252px) minus Paddings (28px) minus
     Nummernspalte (32px inkl gap) laesst ~190px fuer den Label-Text —
     passt fuer die allermeisten Labels bis ~24 Zeichen. */
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sidenav-list a > *:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}
.sidenav-list a .n {
  font-size: 10.5px;
  color: var(--ink-muted);
  letter-spacing: 0.1em;
  transition: color 0.2s;
  min-width: 22px;
  flex-shrink: 0;
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

/* Stat Card.
   Default: max 2 Cards pro Reihe (User-Regel: max 2 Boxen nebeneinander). */
.preview {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px; row-gap: 16px;
  margin-bottom: 72px;
  width: 100%;
}
.preview--three {
  grid-template-columns: repeat(3, minmax(0, 1fr));
  column-gap: 14px;
}
@media (max-width: 960px) {
  .preview--three { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 600px) {
  .preview--three { grid-template-columns: 1fr; }
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
.section-preview.accent-cyan::before { background: linear-gradient(90deg, var(--neon-cyan), var(--neon-purple)); }
.section-preview.accent-cyan h2 .marker { background: var(--neon-cyan); box-shadow: 0 0 12px rgba(93,229,237,0.5); }
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

/* Cluster-Signature-Contrast-Strip: einmal pro Cluster zwischen Head und
   Repo-Liste, zeigt die unterscheidenden Keywords als Chips. Damit bleibt
   der Cluster-Kontext sichtbar ohne auf jeder Repo-Zeile wiederholt zu werden. */
.landscape-cluster-contrast {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding: 12px 36px 4px;
  font-family: 'JetBrains Mono', monospace;
}
.landscape-cluster-contrast-label {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--card-ink-muted);
  font-weight: 600;
  margin-right: 4px;
}
.landscape-cluster-contrast-chip {
  font-size: 11px;
  padding: 4px 10px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule);
  border-radius: 4px;
  color: var(--card-ink-soft);
  letter-spacing: 0.05em;
}
.head-actions { display: inline-flex; align-items: center; gap: 12px; flex-shrink: 0; }
.section-body { padding: 4px 0 8px; }
.section-body--padded { padding: 24px 28px 28px; }
.section-body--padded .preview { margin-bottom: 0; }
.section-preview { margin-bottom: 56px; }
.section-preview:last-child { margin-bottom: 0; }

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
  line-height: 1;
}
/* Button-Reset for badges that are <button> elements (keeping badge visual) */
button.badge {
  font-family: 'JetBrains Mono', monospace;
  border: 1px solid transparent;
  color: inherit;
  cursor: pointer;
}
button.badge:focus-visible {
  outline: 2px solid var(--neon-magenta);
  outline-offset: 2px;
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

/* Discovery "Weitere Kandidaten"-Dropdown (Top 3 + Rest) */
details.candidates-rest {
  border-top: 1px solid var(--card-rule-soft);
  background: var(--card-bg-alt);
}
details.candidates-rest > summary.candidates-rest-toggle {
  list-style: none;
  cursor: pointer;
  padding: 16px 36px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--card-ink-soft);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: color 0.15s, background 0.15s;
}
details.candidates-rest > summary.candidates-rest-toggle::marker { content: ""; }
details.candidates-rest > summary.candidates-rest-toggle::-webkit-details-marker { display: none; }
details.candidates-rest > summary.candidates-rest-toggle:hover {
  color: var(--neon-magenta);
  background: rgba(255,61,151,0.04);
}
details.candidates-rest .candidates-rest-chevron {
  font-family: 'JetBrains Mono', monospace;
  color: var(--neon-magenta);
  transition: transform 0.2s;
}
details.candidates-rest[open] .candidates-rest-chevron { transform: rotate(180deg); }
details.candidates-rest .candidates-rest-body { background: var(--card-bg); }

/* Repo-Row as expandable <details> element (deep content) */
details.repo-row {
  display: block;
  padding: 0;
  counter-increment: row-counter;
  position: relative;
  border-top: 1px solid var(--card-rule-soft);
}
details.repo-row:first-child { border-top: none; }
details.repo-row:nth-child(even) { background: #f9fafc; }
details.repo-row > summary {
  list-style: none;
  display: grid;
  grid-template-columns: 32px 1fr auto auto 28px;
  gap: 20px;
  align-items: center;
  padding: 18px 36px;
  cursor: pointer;
  transition: background 0.15s;
}
details.repo-row > summary::-webkit-details-marker { display: none; }
details.repo-row > summary::marker { content: ""; }
details.repo-row > summary::before {
  content: counter(row-counter, decimal-leading-zero);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--card-ink-muted);
  font-weight: 600;
}
details.repo-row > summary:hover {
  background: rgba(255,61,151,0.03);
}
details.repo-row .row-toggle {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  line-height: 1;
  color: var(--card-ink-muted);
  text-align: center;
  transition: transform 0.2s, color 0.15s;
  user-select: none;
}
details.repo-row[open] .row-toggle {
  transform: rotate(90deg);
  color: var(--neon-magenta);
}
details.repo-row[open] > summary {
  background: var(--card-bg-alt);
  border-bottom: 1px solid var(--card-rule-soft);
}
details.repo-row > summary > div:first-of-type {
  min-width: 0;
}
details.repo-row .repo-body {
  padding: 22px 36px 26px;
  background: var(--card-bg-alt);
}
details.repo-row .repo-body-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 14px;
}
details.repo-row .repo-body-cell {
  padding: 14px 16px;
  background: var(--card-bg);
  border: 1px solid var(--card-rule);
  border-radius: 6px;
  position: relative;
  overflow: hidden;
}
details.repo-row .repo-body-cell::before {
  content: '';
  position: absolute;
  left: 0; top: 10px; bottom: 10px;
  width: 2px;
  background: var(--neon-purple);
  opacity: 0.6;
  border-radius: 2px;
}
details.repo-row .repo-body-cell.wide { grid-column: 1 / -1; }
details.repo-row .repo-body-key {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--card-ink-muted);
  margin-bottom: 7px;
  font-weight: 600;
}
details.repo-row .repo-body-value {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  line-height: 1.55;
  color: var(--card-ink);
  word-wrap: break-word;
}
details.repo-row .repo-body-value--empty {
  color: var(--card-ink-muted);
  font-style: italic;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
details.repo-row .repo-body-empty-reason {
  font-family: 'JetBrains Mono', monospace;
  font-style: normal;
  font-size: 11px;
  color: var(--card-ink-muted);
  letter-spacing: 0.02em;
}
details.repo-row .repo-body-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
details.repo-row .repo-body-list li {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--card-ink);
  padding-left: 12px;
  position: relative;
}
details.repo-row .repo-body-list li::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--neon-magenta);
  font-weight: 700;
}
/* Secondary details inside repo-body: "Mehr zeigen" toggle */
details.repo-row .repo-body-secondary {
  margin-top: 14px;
  border-top: 1px dashed var(--card-rule);
  padding-top: 12px;
}
details.repo-row .repo-body-secondary > summary {
  list-style: none;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--card-ink-muted);
  padding: 4px 0 8px;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  transition: color 0.15s;
}
details.repo-row .repo-body-secondary > summary::marker { content: ""; }
details.repo-row .repo-body-secondary > summary::-webkit-details-marker { display: none; }
details.repo-row .repo-body-secondary > summary::before {
  content: '▸';
  color: var(--neon-magenta);
  transition: transform 0.2s;
  display: inline-block;
}
details.repo-row .repo-body-secondary[open] > summary::before { transform: rotate(90deg); }
details.repo-row .repo-body-secondary > summary:hover { color: var(--neon-magenta); }
details.repo-row .repo-body-secondary .repo-body-grid {
  margin-top: 8px;
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
.axis-percent { font-family: 'Syne', sans-serif; font-weight: 700; font-size: 18px; color: var(--card-ink); letter-spacing: -0.02em; text-align: right; display: inline-flex; justify-content: flex-end; align-items: baseline; gap: 4px; }
.axis-percent .axis-percent-hint { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: var(--card-ink-muted); }
.axis-value { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--card-ink-soft); text-align: right; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600; }

/* Agent "Start-Hier"-Block: der klare Einstieg fuer KI-Coding-Agenten,
   sitzt oben im agent-view-section-body, faellt visuell auf. */
.agent-start-here {
  margin: 16px 36px 20px;
  padding: 16px 20px;
  background: linear-gradient(135deg, rgba(255,61,151,0.08), rgba(169,122,255,0.06));
  border: 1px solid rgba(255,61,151,0.25);
  border-left: 4px solid var(--neon-magenta);
  border-radius: 6px;
}
.agent-start-here-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.24em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--neon-magenta);
  margin-bottom: 8px;
}
.agent-start-here-body {
  margin: 0;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 14px;
  line-height: 1.55;
  color: var(--card-ink);
}
.agent-start-here-body strong { color: var(--card-ink); font-weight: 600; }

/* =======================================================================
   Agent-Snapshot — maschinenlesbarer JSON-Hand-Off
   Eigenes Layout-Modul mit Toolbar (Dateiname + Aktionen) und
   einklappbarer JSON-Vorschau. Zentrale Styles, damit der Landscape-
   und der Main-Report beide dieselbe Darstellung bekommen.
   ======================================================================= */
.info-grid .info-card.agent-snapshot { padding-bottom: 26px; }

.agent-snapshot-toolbar {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 20px;
  margin-top: 14px;
  padding: 14px 16px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule);
  border-radius: 8px;
}
@media (max-width: 720px) {
  .agent-snapshot-toolbar {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}

.agent-snapshot-file {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}
.agent-file-icon {
  flex-shrink: 0;
  width: 34px;
  height: 34px;
  color: var(--neon-magenta);
}
.agent-snapshot-file-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.agent-snapshot-file-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 600;
  color: var(--card-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.agent-snapshot-file-stats {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--card-ink-muted);
}

.agent-snapshot-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
@media (max-width: 720px) {
  .agent-snapshot-actions { justify-content: flex-start; }
}

.agent-action-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 14px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  background: var(--card-bg);
  border: 1px solid var(--card-rule);
  border-radius: 6px;
  color: var(--card-ink-soft);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s, transform 0.12s;
}
.agent-action-button:hover {
  border-color: var(--neon-magenta);
  color: var(--neon-magenta);
  background: rgba(255,61,151,0.06);
}
.agent-action-button:active { transform: translateY(1px); }
.agent-action-button:focus-visible {
  outline: 2px solid var(--neon-cyan);
  outline-offset: 2px;
}
.agent-action-button--primary {
  background: linear-gradient(135deg, rgba(255,61,151,0.18), rgba(169,122,255,0.12));
  border-color: rgba(255,61,151,0.45);
  color: var(--card-ink);
}
.agent-action-button--primary:hover {
  border-color: var(--neon-magenta);
  background: linear-gradient(135deg, rgba(255,61,151,0.28), rgba(169,122,255,0.18));
  color: var(--card-ink);
}
.agent-action-button.is-copied {
  border-color: var(--neon-green);
  color: var(--neon-green);
  background: rgba(128,255,192,0.08);
}
.agent-action-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.agent-json {
  margin-top: 14px;
  border: 1px solid var(--card-rule);
  border-radius: 8px;
  overflow: hidden;
  background: var(--card-bg-alt);
}
.agent-json > summary {
  list-style: none;
  cursor: pointer;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--card-ink-soft);
  transition: color 0.15s, background 0.15s;
}
.agent-json > summary::marker { content: ""; }
.agent-json > summary::-webkit-details-marker { display: none; }
.agent-json > summary:hover {
  color: var(--neon-magenta);
  background: rgba(255,61,151,0.04);
}
.agent-json-chevron {
  display: inline-block;
  font-size: 18px;
  line-height: 1;
  color: var(--neon-magenta);
  transition: transform 0.2s ease;
}
.agent-json[open] > summary .agent-json-chevron {
  transform: rotate(90deg);
}
.agent-json-label { flex: 1; }
.agent-json-hint {
  font-size: 10px;
  color: var(--card-ink-muted);
  letter-spacing: 0.1em;
  text-transform: none;
  font-weight: 500;
}
.agent-json-body {
  border-top: 1px solid var(--card-rule);
  background: var(--card-bg);
  padding: 16px;
}
.agent-pre {
  margin: 0;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--card-ink);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  line-height: 1.6;
  max-height: 440px;
  overflow: auto;
  white-space: pre;
  tab-size: 2;
}
.agent-pre::-webkit-scrollbar { width: 10px; height: 10px; }
.agent-pre::-webkit-scrollbar-track { background: var(--card-bg-alt); }
.agent-pre::-webkit-scrollbar-thumb {
  background: var(--card-rule);
  border-radius: 4px;
  border: 2px solid var(--card-bg-alt);
}
.agent-pre::-webkit-scrollbar-thumb:hover { background: var(--neon-magenta); }
.agent-code {
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  background: transparent;
  padding: 0;
  border: none;
  display: block;
  min-width: max-content;
}

/* Inline-code in info-card-lists (z.B. Tech-Stack, Success-Criteria) */
.info-card .info-card-list li code {
  padding: 2px 6px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule);
  border-radius: 3px;
  color: var(--neon-magenta);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
}

/* Decision-Reasoning-Tab (Entscheidungs-Begruendung pro Top-Kandidat) */
.decision-reasoning-list {
  padding: 24px 36px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.decision-reasoning-item {
  padding: 18px 20px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule-soft);
  border-radius: 8px;
  border-left: 3px solid var(--neon-magenta);
}
.decision-reasoning-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.decision-reasoning-rank {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--neon-magenta);
  color: #fff;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 13px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.decision-reasoning-name {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 600;
  color: var(--card-ink);
  flex: 1 1 auto;
  min-width: 0;
  word-break: break-all;
}
.decision-reasoning-impact {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid;
}
.decision-reasoning-impact.impact-hoch { color: var(--card-green); border-color: rgba(30,138,51,0.4); background: rgba(30,138,51,0.08); }
.decision-reasoning-impact.impact-mittel { color: var(--card-orange); border-color: rgba(194,77,0,0.4); background: rgba(194,77,0,0.08); }
.decision-reasoning-impact.impact-niedrig { color: var(--card-ink-muted); border-color: var(--card-rule); background: transparent; }
.decision-reasoning-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}
@media (max-width: 720px) {
  .decision-reasoning-body { grid-template-columns: 1fr; }
}
.decision-reasoning-col-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--card-ink-muted);
  margin-bottom: 8px;
}
.decision-reasoning-col ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.decision-reasoning-col li {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  line-height: 1.5;
  color: var(--card-ink);
  padding-left: 14px;
  position: relative;
}
.decision-reasoning-col li::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--neon-magenta);
  font-weight: 700;
}
.decision-reasoning-col li.empty-hint {
  color: var(--card-ink-muted);
  font-style: italic;
}
.decision-reasoning-alt {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed var(--card-rule);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--card-ink-muted);
  letter-spacing: 0.04em;
}
.decision-reasoning-alt strong { color: var(--card-ink); font-weight: 600; }

/* What-Now-Section-spezifische Listen */
.what-now-compact {
  list-style: none;
  padding: 24px 36px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.what-now-compact li {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 15px;
  line-height: 1.55;
  color: var(--card-ink);
}
.what-now-compact .what-now-rank {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--neon-magenta);
  color: #fff;
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 14px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 16px rgba(255,61,151,0.3);
}
.what-now-checklist {
  list-style: none;
  padding: 24px 36px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.what-now-checklist-item {
  display: grid;
  grid-template-columns: 22px 80px 1fr;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule-soft);
  border-radius: 6px;
  position: relative;
}
.what-now-checklist-item.impact-hoch { border-left: 3px solid var(--neon-magenta); }
.what-now-checklist-item.impact-mittel { border-left: 3px solid var(--neon-orange); }
.what-now-checklist-item.impact-niedrig { border-left: 3px solid var(--card-ink-muted); }
.what-now-checklist .checklist-box {
  width: 18px; height: 18px;
  border: 2px solid var(--card-rule);
  border-radius: 4px;
  background: var(--card-bg);
}
.what-now-checklist .checklist-impact {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--card-ink-muted);
}
.what-now-checklist .impact-hoch .checklist-impact { color: var(--neon-magenta); }
.what-now-checklist .impact-mittel .checklist-impact { color: var(--card-orange); }
.what-now-checklist .checklist-text {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: var(--card-ink);
}
.what-now-commands {
  list-style: none;
  padding: 24px 36px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.what-now-commands li {
  padding: 14px 16px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule);
  border-radius: 8px;
}
.what-now-commands .what-now-command-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--card-ink-muted);
  font-weight: 600;
  margin-bottom: 8px;
}
.what-now-commands .what-now-command-code {
  display: block;
  padding: 10px 12px;
  background: var(--bg-card);
  border: 1px solid var(--rule);
  border-radius: 4px;
  color: var(--neon-green);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  line-height: 1.4;
  word-break: break-all;
  user-select: all;
}

/* Tabs (innerhalb section-body) */
.tabs { width: 100%; }
.tabs .tab-list {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 14px 36px 0;
  border-bottom: 1px solid var(--card-rule-soft);
  margin-bottom: 4px;
}
.tabs .tab-button {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 10px 14px;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--card-ink-muted);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}
.tabs .tab-button:hover { color: var(--card-ink); }
.tabs .tab-button.active {
  color: var(--neon-magenta);
  border-bottom-color: var(--neon-magenta);
}
.tabs .tab-button:focus-visible {
  outline: 2px solid var(--neon-magenta);
  outline-offset: 2px;
}
.tabs .tab-panels { position: relative; }
.tabs .tab-panel { display: none; }
.tabs .tab-panel.active { display: block; }

/* Empty-Sections-Toggle (Filter-Toolbar-Switch) */
body.hide-empty-sections [data-section-empty="true"] { display: none; }
body.hide-empty-sections .sidenav-list a.nav-hidden-when-empty { display: none; }

.toolbar-toggle {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  padding: 6px 0;
  margin-top: 6px;
  user-select: none;
}
.toolbar-toggle input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 36px;
  height: 20px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule);
  border-radius: 999px;
  position: relative;
  cursor: pointer;
  transition: background 0.2s, border-color 0.2s;
  flex-shrink: 0;
}
.toolbar-toggle input[type="checkbox"]::after {
  content: "";
  position: absolute;
  top: 2px; left: 2px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: var(--card-ink-muted);
  transition: transform 0.2s, background 0.2s;
}
.toolbar-toggle input[type="checkbox"]:checked {
  background: rgba(255,61,151,0.15);
  border-color: var(--neon-magenta);
}
.toolbar-toggle input[type="checkbox"]:checked::after {
  transform: translateX(16px);
  background: var(--neon-magenta);
}
.toolbar-toggle input[type="checkbox"]:focus-visible {
  outline: 2px solid var(--neon-magenta);
  outline-offset: 2px;
}
.toolbar-toggle-label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--card-ink-soft);
  font-weight: 600;
}
.toolbar-toggle input[type="checkbox"]:checked + .toolbar-toggle-label {
  color: var(--neon-magenta);
}
.toolbar-toggle--prominent {
  padding: 10px 16px;
  border: 1px solid var(--neon-magenta);
  border-radius: 999px;
  background: rgba(255,61,151,0.08);
  transition: border-color 0.15s, background 0.15s, transform 0.15s;
  box-shadow: 0 0 12px rgba(255,61,151,0.15);
}
.toolbar-toggle--prominent:hover {
  background: rgba(255,61,151,0.14);
  transform: translateY(-1px);
  box-shadow: 0 4px 18px rgba(255,61,151,0.25);
}
.toolbar-toggle--prominent .toolbar-toggle-label {
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--neon-magenta);
}
.section-head .toolbar-toggle--prominent {
  align-self: center;
}

/* Section-Description: inline collapsible Dropdown, default geschlossen.
   Ersetzt den frueheren Info-Button + Modal-Mechanismus pro Section. */
.section-description {
  margin: -6px 36px 18px;
  padding: 0;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule-soft);
  border-radius: 6px;
  overflow: hidden;
}
.section-description > summary {
  list-style: none;
  cursor: pointer;
  padding: 10px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--card-ink-soft);
  transition: color 0.15s, background 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  user-select: none;
}
.section-description > summary::marker { content: ""; }
.section-description > summary::-webkit-details-marker { display: none; }
.section-description > summary::before {
  content: '▸';
  color: var(--neon-magenta);
  transition: transform 0.2s;
  display: inline-block;
}
.section-description[open] > summary::before { transform: rotate(90deg); }
.section-description > summary:hover { color: var(--neon-magenta); }
.section-description > summary:focus-visible {
  outline: 2px solid var(--neon-magenta);
  outline-offset: 2px;
}
.section-description .section-description-label::after {
  content: 'ⓘ';
  margin-left: 8px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 400;
  opacity: 0.7;
  text-transform: none;
  letter-spacing: 0;
}
.section-description .section-description-body {
  padding: 4px 16px 16px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  line-height: 1.6;
  color: var(--card-ink);
}
.section-description .section-description-body p {
  margin: 0 0 8px;
}
.section-description .section-description-body p:last-child { margin-bottom: 0; }
.section-description .section-description-body strong { color: var(--card-ink); font-weight: 600; }

/* Dark-Variante fuer content-intro (dunkler Background) */
.section-description--dark {
  background: rgba(28, 35, 56, 0.4);
  border-color: var(--rule);
}
.section-description--dark > summary { color: var(--ink-soft); }
.section-description--dark > summary:hover { color: var(--neon-magenta); }
.section-description--dark .section-description-body { color: var(--ink-soft); }
.section-description--dark .section-description-body strong { color: var(--ink); }

/* Im content-intro als inline-block ausgerichtet */
.section-description--intro {
  display: inline-block;
  margin: 24px auto 0;
  max-width: 680px;
  text-align: left;
}

/* Glossary-Term: markiert Fachbegriffe im Flietext mit dashed underline + Klick-Explain */
.glossary-term {
  font-style: normal;
  text-decoration: underline dashed var(--neon-purple);
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  cursor: help;
  transition: color 0.15s, text-decoration-color 0.15s;
  border: none;
  background: transparent;
  padding: 0;
  font-family: inherit;
  color: inherit;
}
.glossary-term:hover,
.glossary-term:focus-visible {
  color: var(--neon-magenta);
  text-decoration-color: var(--neon-magenta);
  outline: none;
}
/* Dark-Variante auf dunklem Hintergrund (z.B. in sidenav-eyebrow Kontext) */
.section-preview .glossary-term { color: inherit; }

/* Section-body intro paragraph (kontext-beschreibung vor info-grid) */
.section-body > .section-intro,
.section-preview > .section-intro {
  padding: 16px 36px 8px;
  margin: 0;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 14px;
  line-height: 1.6;
  color: var(--card-ink-soft);
}
.section-body > .section-intro strong,
.section-preview > .section-intro strong {
  color: var(--card-ink);
  font-weight: 600;
}

/* Context-Status-Chip (sitzt zwischen section-intro und info-grid im Zielrepo-Kontext) */
.context-status {
  margin: 0 36px 16px;
  padding: 12px 16px;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  border-radius: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  letter-spacing: 0.04em;
  border: 1px solid;
}
.context-status--ok {
  background: rgba(30, 138, 51, 0.1);
  border-color: rgba(30, 138, 51, 0.3);
  color: var(--card-green);
}
.context-status--attention {
  background: rgba(194, 77, 0, 0.1);
  border-color: rgba(194, 77, 0, 0.3);
  color: var(--card-orange);
}
.context-status--warn {
  background: rgba(255, 154, 72, 0.12);
  border-color: rgba(255, 154, 72, 0.35);
  color: var(--card-orange);
}
.context-status-icon {
  font-size: 12px;
  line-height: 1;
  flex-shrink: 0;
  filter: drop-shadow(0 0 6px currentColor);
}
.context-status-text {
  color: var(--card-ink);
  font-weight: 500;
}

/* Info Grid (title + bullet list cards inside section-preview bodies).
   Default: max 2 Spalten pro Reihe. User-Regel: nie mehr als 2 Cards
   nebeneinander, alles weitere wandert in die naechste Reihe. */
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1px;
  background: var(--card-rule-soft);
  border-top: 1px solid var(--card-rule-soft);
}
.info-grid--halves {
  /* Legacy-Alias — seit default auf 2 Spalten steht, ist dieser Modifier
     ein No-op, bleibt aber erhalten falls Caller ihn explizit nutzen. */
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 720px) {
  .info-grid { grid-template-columns: 1fr; }
}
.info-grid .info-card {
  padding: 22px 28px;
  background: var(--card-bg);
  position: relative;
}
.info-grid .info-card.wide,
.info-grid .info-card--wide { grid-column: span 2; }
.info-grid .info-card--warn::before { background: var(--neon-orange); }
.info-grid .info-card--warn .info-card-title { color: var(--card-orange); }

.info-card .sources-more {
  margin-top: 10px;
  border-top: 1px dashed var(--card-rule);
  padding-top: 10px;
}
.info-card .sources-more > summary {
  list-style: none;
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--card-ink-muted);
  padding: 4px 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.info-card .sources-more > summary::marker { content: ""; }
.info-card .sources-more > summary::-webkit-details-marker { display: none; }
.info-card .sources-more > summary::before {
  content: '▸';
  color: var(--neon-magenta);
  transition: transform 0.2s;
  display: inline-block;
}
.info-card .sources-more[open] > summary::before { transform: rotate(90deg); }
.info-card .sources-more > summary:hover { color: var(--neon-magenta); }
.info-card .sources-more .info-card-list {
  margin-top: 6px;
}
.info-grid .info-card::before {
  content: '';
  position: absolute;
  left: 0; top: 22px; bottom: 22px;
  width: 2px;
  background: var(--neon-purple);
  opacity: 0.55;
  border-radius: 2px;
}
.info-grid .info-card-title {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--card-ink);
  margin-bottom: 12px;
}
.info-grid .info-card-copy {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  line-height: 1.55;
  color: var(--card-ink-soft);
  margin: 0 0 10px;
}
.info-grid .info-card-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.info-grid .info-card-list li {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.45;
  color: var(--card-ink);
  padding-left: 14px;
  position: relative;
}
.info-grid .info-card-list li::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--neon-magenta);
  font-weight: 700;
}
.info-grid .info-card-empty {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 12px;
  font-style: italic;
  color: var(--card-ink-muted);
  margin: 0;
}
.info-grid .info-card-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--neon-magenta);
  text-decoration: none;
  margin-top: 10px;
  word-break: break-all;
  transition: color 0.15s;
}
.info-grid .info-card-link::after {
  content: '↗';
  font-size: 11px;
}
.info-grid .info-card-link:hover { color: var(--neon-orange); }

/* Agent-Field Starter-Checklisten innerhalb info-card */
.info-card .starter-details {
  margin-top: 12px;
  border-top: 1px dashed var(--card-rule);
  padding-top: 10px;
}
.info-card .starter-details > summary {
  cursor: pointer;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--card-ink-muted);
  padding: 4px 0;
  list-style: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.info-card .starter-details > summary::marker { content: ""; }
.info-card .starter-details > summary::-webkit-details-marker { display: none; }
.info-card .starter-details > summary::before {
  content: "▸";
  transition: transform 0.2s;
  display: inline-block;
  color: var(--neon-magenta);
}
.info-card .starter-details[open] > summary::before { transform: rotate(90deg); }
.info-card .starter-details > summary:hover { color: var(--neon-magenta); }
.info-card .starter-sublist { margin-top: 8px; }
.info-card .starter-sublist-title {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--card-ink-muted);
  margin-bottom: 4px;
}
.info-card .starter-sublist-items {
  list-style: none;
  padding: 0;
  margin: 0 0 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.info-card .starter-sublist-items li {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 12px;
  line-height: 1.5;
  color: var(--card-ink);
  padding-left: 12px;
  position: relative;
}
.info-card .starter-sublist-items li::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--neon-magenta);
  font-weight: 700;
}

/* Axis Groups (coverage stacked groups) */
.coverage-axis-group {
  padding: 6px 36px 20px;
}
.coverage-axis-group + .coverage-axis-group {
  border-top: 1px solid var(--card-rule-soft);
  padding-top: 18px;
}
.coverage-axis-group .group-head {
  padding: 18px 0 12px;
  margin-bottom: 0;
  border: none;
}
.coverage-axis-group .group-head h3 {
  font-family: 'Syne', sans-serif;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 15px;
  letter-spacing: 0.06em;
  color: var(--card-ink);
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.coverage-axis-group .group-head h3::before {
  content: '';
  width: 8px; height: 8px;
  background: var(--neon-green);
  box-shadow: 0 0 12px rgba(102,232,122,0.55);
  border-radius: 2px;
}
.coverage-axis-group .group-head .group-head-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--card-ink-muted);
  font-weight: 600;
}

/* Data Table (RepoMatrix etc.) */
.section-body .table-wrap {
  padding: 0;
  overflow-x: auto;
  border-top: 1px solid var(--card-rule-soft);
}
.section-body .data-table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--card-ink);
}
.section-body .data-table th {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--card-ink-muted);
  font-weight: 700;
  text-align: left;
  padding: 18px 28px;
  background: var(--card-bg-alt);
  border-bottom: 1px solid var(--card-rule);
}
.section-body .data-table td {
  padding: 14px 28px;
  border-top: 1px solid var(--card-rule-soft);
  vertical-align: top;
}
.section-body .data-table tbody tr:nth-child(even) {
  background: #f9fafc;
}

/* Report Toolbar (Filter UI) */
.section-preview .toolbar-body {
  padding: 28px 36px 32px;
}
.section-preview .toolbar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 14px 18px;
  align-items: end;
}
.section-preview .toolbar-grid .control {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.section-preview .toolbar-grid .control > span {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--card-ink-muted);
  font-weight: 600;
}
.section-preview .toolbar-grid input,
.section-preview .toolbar-grid select {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  padding: 10px 12px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule);
  border-radius: 6px;
  color: var(--card-ink);
  outline: none;
  transition: border-color 0.15s, background 0.15s;
}
.section-preview .toolbar-grid input:focus,
.section-preview .toolbar-grid select:focus {
  border-color: var(--neon-magenta);
  background: var(--card-bg);
}
.section-preview .toolbar-grid .ghost-button {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--card-rule);
  border-radius: 6px;
  color: var(--card-ink-soft);
  cursor: pointer;
  align-self: stretch;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.section-preview .toolbar-grid .ghost-button:hover {
  border-color: var(--neon-magenta);
  color: var(--neon-magenta);
  background: rgba(255,61,151,0.06);
}
.section-preview .toolbar-inline-help {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 12px;
  color: var(--card-ink-muted);
  margin: 10px 0 0;
  font-style: italic;
}

/* Warn Banner (data-state) */
.section-warn {
  padding: 14px 20px;
  margin: 0 36px 16px;
  background: rgba(255,154,72,0.1);
  border: 1px solid rgba(255,154,72,0.3);
  border-radius: 6px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  line-height: 1.55;
  color: var(--card-ink);
}
.section-warn strong { color: var(--card-orange); font-weight: 600; }

/* Empty states */
.section-body .empty,
.section-preview .empty {
  padding: 28px 36px;
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 13px;
  font-style: italic;
  color: var(--card-ink-muted);
  margin: 0;
}

/* Bullets used within section-body */
.section-body ul.bullets {
  list-style: none;
  padding: 10px 36px 14px;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.section-body ul.bullets li {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  line-height: 1.5;
  color: var(--card-ink);
  padding-left: 14px;
  position: relative;
}
.section-body ul.bullets li::before {
  content: '·';
  position: absolute;
  left: 0;
  color: var(--neon-magenta);
  font-weight: 700;
}

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
}

/* === Mobile Breakpoints === */
@media (max-width: 720px) {
  .hero h1 { font-size: clamp(42px, 12vw, 72px); line-height: 0.95; }
  .hero { padding: 48px 0 24px; }
  .hero .slogan { font-size: 15px; }
  .content-intro { margin: 16px auto 56px; padding: 0 16px; }
  .content-intro .subject { font-size: clamp(26px, 7vw, 38px); }
  .content-intro .meta {
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px 10px;
  }
  .section-head {
    padding: 22px 22px 18px;
    gap: 12px;
  }
  .section-body { padding: 4px 0 8px; }
  details.repo-row > summary {
    grid-template-columns: 28px 1fr auto 24px;
    gap: 14px;
    padding: 16px 22px;
  }
  details.repo-row > summary > .score-cell {
    grid-column: 1 / -1;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding-left: 0;
    border-left: none;
    border-top: 1px dashed var(--card-rule-soft);
    padding-top: 10px;
    margin-top: 6px;
  }
  details.repo-row .repo-body { padding: 18px 22px 22px; }
  details.repo-row .repo-body-grid { grid-template-columns: 1fr; }

  .axis-row {
    grid-template-columns: 28px 100px 1fr 56px;
    gap: 12px;
    padding: 14px 22px;
  }
  .axis-row .axis-value { display: none; }

  .preview { grid-template-columns: 1fr; row-gap: 12px; }
  .stat { padding: 20px 18px; }
  .stat .v { font-size: 36px; }

  .meta-grid { margin: 6px 22px 18px; }

  .coverage-axis-group { padding: 4px 22px 18px; }

  .info-grid { grid-template-columns: 1fr; }
  .info-grid .info-card { padding: 18px 22px; }
  .info-grid .info-card.wide { grid-column: auto; }

  details.candidates-rest > summary.candidates-rest-toggle { padding: 14px 22px; }

  .section-preview .toolbar-body { padding: 22px 22px 24px; }

  .report-footer { margin-top: 48px; padding-top: 24px; }
}

/* === Skip-to-content (a11y) === */
.skip-to-content {
  position: absolute;
  left: 16px;
  top: -200px;
  z-index: 1000;
  padding: 12px 18px;
  background: var(--neon-magenta);
  color: #fff;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  text-decoration: none;
  border-radius: 6px;
  box-shadow: 0 10px 32px rgba(0,0,0,0.5);
  transition: top 0.2s;
}
.skip-to-content:focus {
  top: 16px;
  outline: none;
}

/* === Reduced motion (a11y) === */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
  html { scroll-behavior: auto; }
}

@media (max-width: 480px) {
  .shell { padding: 18px 14px 56px; gap: 16px; }
  .hero { padding: 36px 0 18px; }
  .hero h1 { font-size: clamp(38px, 14vw, 56px); }
  .content-intro .eyebrow { font-size: 10px; letter-spacing: 0.18em; }
  .preview { grid-template-columns: 1fr; }
  .stat .v { font-size: 32px; }
  .section-head { padding: 18px 16px 14px; }
  details.repo-row > summary { padding: 14px 16px; grid-template-columns: 26px 1fr auto 22px; }
  details.repo-row .repo-body { padding: 16px 16px 20px; }
  .axis-row { padding: 12px 16px; grid-template-columns: 24px 1fr 48px; }
  .axis-row .axis-label { grid-column: 2 / 3; }
  .axis-row .axis-track { grid-column: 1 / -1; grid-row: 2; }
  .axis-row .axis-percent { grid-column: 3 / 4; text-align: right; }
}`;

// Cockpit Night is dark-only by design. Kein prefers-color-scheme-Fork.

export const COCKPIT_NIGHT_PRINT_CSS = `@media print {
  body {
    background: #fff;
    color: #111;
  }
  body::before,
  .sidenav,
  .filter-indicator,
  .scroll-progress,
  .grain,
  .info-btn,
  .dark-info-btn,
  .info-modal {
    display: none !important;
  }
  .shell {
    display: block;
    padding: 0;
    max-width: none;
    grid-template-columns: none;
  }
  .wrap {
    padding: 0 20px;
    min-width: 0;
  }
  .hero h1 { color: #111; }
  .hero h1 .pilot {
    background: none;
    -webkit-text-fill-color: #222;
    color: #222;
  }
  .hero .slogan, .hero-meta { color: #444; }
  .content-intro .eyebrow { color: #222; }
  .content-intro .subject { color: #111; }
  .content-intro .subject-id,
  .content-intro .meta { color: #555; }
  .section-preview {
    border: 1px solid #ccc !important;
    box-shadow: none !important;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .section-preview::before { background: #666 !important; }
  .section-preview .section-head {
    background: #f4f4f4 !important;
    border-bottom-color: #ccc !important;
  }
  .section-preview h2 .marker { box-shadow: none !important; }
  .repo-row,
  .axis-row {
    break-inside: avoid;
    page-break-inside: avoid;
    border-top-color: #ddd !important;
  }
  .repo-row:nth-child(even),
  .axis-row:nth-child(even) { background: #fafafa !important; }
  .badge {
    background: transparent !important;
    color: #222 !important;
    border: 1px solid #999 !important;
    box-shadow: none !important;
  }
  .badge::before { display: none; }
  .stat {
    border: 1px solid #ccc !important;
    box-shadow: none !important;
    break-inside: avoid;
  }
  .stat::before { background: #888 !important; }
  .stat .v { color: #111 !important; }
  .info-grid { border-color: #ddd !important; }
  .info-grid .info-card { background: #fff !important; }
  .info-grid .info-card::before { background: #888 !important; }
  a { color: #222 !important; text-decoration: underline; }
  a.name::after { display: none; }
  .section-break { display: none; }
}`;

export const COCKPIT_NIGHT_BASE_CSS = [
  COCKPIT_NIGHT_TOKENS_CSS,
  COCKPIT_NIGHT_RESET_CSS,
  COCKPIT_NIGHT_ATMOSPHERE_CSS,
  COCKPIT_NIGHT_TYPOGRAPHY_CSS,
  COCKPIT_NIGHT_LAYOUT_CSS,
  COCKPIT_NIGHT_COMPONENTS_CSS,
  COCKPIT_NIGHT_PRINT_CSS
].join("\n\n");
