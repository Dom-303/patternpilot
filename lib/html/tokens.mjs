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

/* Clickable recommendation badge (opens explain modal) */
.repo-row .badge.badge--clickable {
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s;
}
.repo-row .badge.badge--clickable:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 14px rgba(0,0,0,0.3);
}
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

/* Info Grid (title + bullet list cards inside section-preview bodies) */
.info-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1px;
  background: var(--card-rule-soft);
  border-top: 1px solid var(--card-rule-soft);
}
.info-grid--halves {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
@media (max-width: 720px) {
  .info-grid--halves { grid-template-columns: 1fr; }
}
.info-grid .info-card {
  padding: 22px 28px;
  background: var(--card-bg);
  position: relative;
}
.info-grid .info-card.wide { grid-column: span 2; }
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
