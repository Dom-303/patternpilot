import {
  LOGO_BASE64,
  escapeHtml,
  renderHtmlStatCards,
  renderHtmlSection,
  renderCollapsibleSection,
  renderStickyNav,
  renderHeroSection,
  renderDecisionSummary,
  renderTopRecommendations,
  renderRecommendedActions,
  slugifyForId
} from "./shared.mjs";
import { renderReportToolbar } from "./sections.mjs";
import {
  COCKPIT_NIGHT_FONTS_HEAD,
  COCKPIT_NIGHT_BASE_CSS
} from "./tokens.mjs";
import { INFO_DIALOG_SCRIPT, renderInfoDialog } from "./components.mjs";

const REPORT_TYPE_LABELS = {
  discovery: "Discovery Report",
  on_demand: "Ad-hoc Lauf",
  watchlist_review: "Watchlist Review",
  review: "Vergleichsbericht"
};

function renderReportContentIntro({ reportType, projectKey, createdAt, heroSubtitle, candidateCount, runRoot }) {
  const eyebrow = REPORT_TYPE_LABELS[reportType] ?? "Patternpilot Report";
  const subject = projectKey || "Patternpilot";
  const runId = runRoot ? String(runRoot).split("/").pop() : "";
  const dateStr = createdAt ? createdAt.slice(0, 10) : "";
  const metaParts = [
    candidateCount != null ? `${candidateCount} Kandidaten` : null,
    heroSubtitle ? `Profil ${heroSubtitle}` : null,
    dateStr
  ].filter(Boolean);
  const metaFragment = metaParts.length > 0
    ? `<div class="meta">${metaParts.map((part, i) => (i > 0 ? `<span class="sep">·</span>` : "") + `<span>${escapeHtml(part)}</span>`).join("\n    ")}</div>`
    : "";
  const subjectIdFragment = runId ? `<div class="subject-id">${escapeHtml(runId)}</div>` : "";
  return `<section class="content-intro" id="report-intro" data-nav-section>
  <div class="eyebrow">${escapeHtml(eyebrow)}</div>
  <h2 class="subject">${escapeHtml(subject)}</h2>
  ${subjectIdFragment}
  ${metaFragment}
</section>`;
}

export function renderHtmlDocument({
  title,
  reportType,
  projectKey,
  createdAt,
  heroSubtitle,
  candidateCount,
  runRoot,
  stats = [],
  recommendations,
  candidates,
  sections,
  agentPayloadScript = "",
  modeOptions = [],
  layerOptions = []
}) {
  const orderedStats = [
    ...stats.filter((s) => s.primary !== false),
    ...stats.filter((s) => s.primary === false)
  ];
  const recommendationsPanel = recommendations?.length
    ? `<section class="section-preview accent-magenta" id="recommendations" data-nav-section>
      <div class="section-head">
        <div class="title">
          <h2><span class="marker"></span>Erste Empfehlungen</h2>
          <div class="sub">Staerkste Kandidaten aus diesem Lauf</div>
        </div>
        <div class="head-actions"><span class="count-chip">${recommendations.length} Zeilen</span></div>
      </div>
      <div class="section-body">
        ${renderTopRecommendations(recommendations, candidates)}
      </div>
    </section>`
    : "";
  const statsPanel = `<section class="group" id="stats" data-nav-section>
      <div class="group-head">
        <h3>Kennzahlen</h3>
      </div>
      <div class="preview">
        ${renderHtmlStatCards(orderedStats)}
      </div>
    </section>`;
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${COCKPIT_NIGHT_FONTS_HEAD}
  <style>
/* === Tokens === */
:root {
  --bg: #050509;
  --surface: rgba(16, 18, 31, 0.84);
  --surface-solid: #10121f;
  --surface-soft: rgba(255, 255, 255, 0.03);
  --surface-border: rgba(255, 255, 255, 0.11);
  --surface-border-strong: rgba(255, 255, 255, 0.18);
  --ink: #d4d8ea;
  --ink-bright: #eeeef8;
  --ink-muted: #9aa2c2;
  --ink-faint: #646b89;
  --cyan: #00e5ff;
  --magenta: #e040fb;
  --orange: #ff9100;
  --green: #00e676;
  --blue: #2979ff;
  --accent: #00e5ff;
  --accent-soft: rgba(0, 229, 255, 0.08);
  --accent-border: rgba(0, 229, 255, 0.25);
  --info: #e040fb;
  --info-soft: rgba(224, 64, 251, 0.08);
  --info-border: rgba(224, 64, 251, 0.25);
  --warn: #ff9100;
  --warn-soft: rgba(255, 145, 0, 0.08);
  --warn-border: rgba(255, 145, 0, 0.25);
  --radius: 20px;
  --radius-lg: 28px;
}

/* === Reset + Body === */
*, *::before, *::after { box-sizing: border-box; margin: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: 'Manrope', sans-serif;
  font-weight: 400;
  font-size: 16px;
  color: var(--ink);
  background: var(--bg);
  min-height: 100vh;
  -webkit-font-smoothing: antialiased;
  line-height: 1.65;
  overflow-x: hidden;
}

/* === Atmosphere === */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  background:
    radial-gradient(1200px circle at 5% 0%, rgba(0,229,255,0.07), transparent 70%),
    radial-gradient(1000px circle at 95% 20%, rgba(224,64,251,0.055), transparent 70%),
    radial-gradient(1100px circle at 30% 85%, rgba(0,230,118,0.04), transparent 70%),
    radial-gradient(800px circle at 80% 70%, rgba(255,145,0,0.03), transparent 70%);
  pointer-events: none;
  z-index: 0;
}

/* === Scrollbar === */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.07); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.14); }

a { color: var(--accent); text-decoration: none; transition: color 0.2s; }
a:hover { color: #80f0ff; }

/* === Page === */
.page {
  max-width: 1360px;
  margin: 0 auto;
  padding: 0 40px 140px;
  position: relative;
  z-index: 1;
}

/* === Scroll Progress === */
.scroll-progress {
  position: fixed;
  top: 0;
  left: 0;
  height: 2px;
  width: 0%;
  background: linear-gradient(90deg, var(--cyan), var(--magenta));
  box-shadow: 0 0 12px rgba(0,229,255,0.5);
  z-index: 200;
  transition: width 0.1s linear;
}

/* === Hero (centered) === */
.hero {
  padding: 100px 0 110px;
  text-align: center;
  position: relative;
}
.hero-logo {
  width: 96px;
  height: 96px;
  border-radius: 20px;
  filter: drop-shadow(0 0 24px rgba(0,229,255,0.4)) drop-shadow(0 0 48px rgba(224,64,251,0.2));
  animation: hero-float-in 0.8s cubic-bezier(0.22,1,0.36,1) both;
}
@keyframes hero-float-in {
  0% { transform: translateY(-40px); opacity: 0; }
  100% { transform: translateY(0); opacity: 1; }
}
@keyframes glow-pulse {
  0%, 100% { filter: drop-shadow(0 0 24px rgba(0,229,255,0.4)) drop-shadow(0 0 48px rgba(224,64,251,0.2)); }
  50% { filter: drop-shadow(0 0 32px rgba(0,229,255,0.55)) drop-shadow(0 0 56px rgba(224,64,251,0.3)); }
}
.hero-logo.animated { animation: glow-pulse 4s ease-in-out infinite; }

.hero-brand {
  font-family: 'Syne', sans-serif;
  font-size: 56px;
  font-weight: 800;
  color: #fff;
  margin: 28px 0 0;
  letter-spacing: -0.02em;
  line-height: 1.14;
  padding-bottom: 0.2em;
  animation: hero-fade-up 0.7s ease 0.3s both;
}
.hero-brand .pilot {
  background: linear-gradient(90deg, var(--cyan), var(--orange));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-subtitle {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  color: var(--ink-muted);
  margin: 12px 0 0;
  line-height: 1.45;
  padding-bottom: 0.18em;
  animation: hero-fade-up 0.6s ease 0.5s both;
}
.hero-divider {
  width: 56px;
  height: 2px;
  margin: 32px auto;
  background: linear-gradient(90deg, var(--cyan), var(--magenta));
  box-shadow: 0 0 16px rgba(0,229,255,0.4);
  border-radius: 1px;
  animation: hero-fade-up 0.5s ease 0.65s both;
}
.hero-claim {
  font-family: 'Syne', sans-serif;
  font-size: 28px;
  font-weight: 800;
  color: var(--ink-bright);
  margin: 0 0 40px;
  line-height: 1.3;
  padding-bottom: 0.28em;
}
.hero-claim .word {
  display: inline-block;
  animation: word-reveal 0.5s ease both;
  opacity: 0;
}
.hero-claim .word:nth-child(1) { animation-delay: 0.8s; }
.hero-claim .word:nth-child(2) { animation-delay: 0.95s; }
.hero-claim .word:nth-child(3) { animation-delay: 1.1s; }
.hero-claim .discover {
  color: var(--cyan);
  text-shadow: 0 0 24px rgba(0,229,255,0.4);
}
@keyframes word-reveal {
  0% { opacity: 0; filter: blur(8px); transform: translateY(8px); }
  100% { opacity: 1; filter: blur(0); transform: translateY(0); }
}
@keyframes hero-fade-up {
  0% { opacity: 0; transform: translateY(24px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* Hero Project Card */
.hero-project-card {
  display: block;
  width: fit-content;
  padding: 28px 40px;
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  text-align: center;
  margin: 0 auto;
  animation: hero-fade-up 0.6s ease 1.3s both;
}
.hero-project-type {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.18em;
  font-weight: 700;
  color: var(--cyan);
  margin-bottom: 8px;
}
.hero-project-name {
  font-family: 'Syne', sans-serif;
  font-size: 22px;
  font-weight: 800;
  color: #fff;
  margin-bottom: 8px;
  line-height: 1.2;
  padding-bottom: 0.16em;
}
.hero-project-meta {
  font-size: 12px;
  color: var(--ink-muted);
  line-height: 1.5;
}

/* === PDF Export Button === */
.pdf-export-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 24px auto 0;
  width: fit-content;
  padding: 12px 24px;
  border-radius: 999px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.03);
  color: var(--ink-muted);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;
  letter-spacing: 0.04em;
}
.pdf-export-btn:hover {
  border-color: var(--accent-border);
  color: var(--cyan);
  background: var(--accent-soft);
  transform: translateY(-2px);
  box-shadow: 0 4px 24px rgba(0,229,255,0.12);
}
.pdf-export-btn svg { width: 16px; height: 16px; }

/* === Sticky Nav === */
.sticky-nav {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 100;
  background: rgba(5,5,9,0.92);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding: 0 40px;
  display: flex;
  align-items: center;
  height: 52px;
  transform: translateY(-100%);
  transition: transform 0.3s ease;
}
.sticky-nav.visible { transform: translateY(0); }
.sticky-nav-brand {
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  font-weight: 800;
  color: #fff;
  white-space: nowrap;
  margin-right: 24px;
  padding-right: 24px;
  border-right: 1px solid rgba(255,255,255,0.08);
}
.sticky-nav-brand .pilot {
  background: linear-gradient(90deg, var(--cyan), var(--orange));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.sticky-nav-items {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.sticky-nav-items::-webkit-scrollbar { display: none; }
.sticky-nav-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--ink-muted);
  white-space: nowrap;
  text-decoration: none;
  transition: all 0.2s;
}
.sticky-nav-item:hover {
  background: rgba(0,229,255,0.06);
  color: var(--cyan);
}
.sticky-nav-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

/* === Stats === */
.report-overview {
  display: grid;
  grid-template-columns: 1fr;
  gap: 48px;
  align-items: stretch;
  margin-bottom: 64px;
}
.panel-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 30px 32px;
  box-shadow: 0 18px 56px rgba(0,0,0,0.24);
}
.panel-card h2 {
  font-family: 'Syne', sans-serif;
  font-size: 30px;
  line-height: 1.22;
  color: #fff;
  margin: 0;
  letter-spacing: -0.02em;
  padding-bottom: 0.16em;
}
.panel-copy {
  margin: 18px 0 24px;
  max-width: 56ch;
  color: var(--ink-muted);
  font-size: 15px;
}
.stats-strip { padding: 30px 32px; }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
.stats-grid--compact {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}
.stat-card {
  padding: 22px 20px 20px;
  background: var(--surface-soft);
  border: 1px solid var(--surface-border);
  border-radius: 18px;
  transition: border-color 0.25s, background 0.25s;
  min-height: 164px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  text-align: center;
}
.stat-card:nth-child(5n+1) { border-top: 3px solid var(--cyan); }
.stat-card:nth-child(5n+2) { border-top: 3px solid var(--magenta); }
.stat-card:nth-child(5n+3) { border-top: 3px solid var(--orange); }
.stat-card:nth-child(5n+4) { border-top: 3px solid var(--green); }
.stat-card:nth-child(5n+5) { border-top: 3px solid var(--blue); }
.stat-card:hover {
  border-color: var(--surface-border-strong);
  background: rgba(255,255,255,0.04);
}
.stat-label {
  display: block;
  color: var(--ink-faint);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 14px;
  line-height: 1.4;
}
.stat-value {
  font-family: 'Syne', sans-serif;
  font-size: 30px;
  font-weight: 800;
  line-height: 1.14;
  padding-bottom: 0.08em;
  overflow-wrap: anywhere;
}
.stat-card:nth-child(5n+1) .stat-value { color: var(--cyan); text-shadow: 0 0 20px rgba(0,229,255,0.3); }
.stat-card:nth-child(5n+2) .stat-value { color: var(--magenta); text-shadow: 0 0 20px rgba(224,64,251,0.3); }
.stat-card:nth-child(5n+3) .stat-value { color: var(--orange); text-shadow: 0 0 20px rgba(255,145,0,0.3); }
.stat-card:nth-child(5n+4) .stat-value { color: var(--green); text-shadow: 0 0 20px rgba(0,230,118,0.3); }
.stat-card:nth-child(5n+5) .stat-value { color: var(--blue); text-shadow: 0 0 20px rgba(41,121,255,0.3); }

/* === Top Recommendations === */
.top-recommendations-card .recommendations { margin-bottom: 0; }
.rec-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 18px 22px;
  border-radius: 16px;
  border: 1px solid var(--surface-border);
  background: var(--surface-soft);
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
  color: inherit;
  margin-bottom: 12px;
}
.rec-card:hover {
  transform: translateX(4px);
  border-color: var(--surface-border-strong);
  background: rgba(255,255,255,0.05);
}
.rec-card:hover .rec-arrow { transform: translateX(4px); }
.rec-rank {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: 'Syne', sans-serif;
  font-size: 18px;
  font-weight: 800;
  color: #fff;
  flex-shrink: 0;
}
.rec-card:nth-child(1) .rec-rank {
  width: 52px; height: 52px; font-size: 22px;
  background: linear-gradient(135deg, var(--cyan), var(--magenta));
}
.rec-card:nth-child(2) .rec-rank { background: rgba(224,64,251,0.2); color: var(--magenta); }
.rec-card:nth-child(3) .rec-rank { background: rgba(255,145,0,0.2); color: var(--orange); }
.rec-card:nth-child(n+4) .rec-rank { background: rgba(255,255,255,0.06); color: var(--ink-muted); }
.rec-card:nth-child(1) {
  padding: 24px 26px;
  border-color: rgba(0,229,255,0.2);
  background: rgba(0,229,255,0.06);
}
.rec-card:nth-child(1) .rec-name { font-size: 17px; }
.rec-text { flex: 1; min-width: 0; }
.rec-name {
  font-family: 'Syne', sans-serif;
  font-size: 15px;
  font-weight: 700;
  color: var(--ink-bright);
  margin-bottom: 2px;
}
.rec-action {
  font-size: 14px;
  color: var(--ink-muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.rec-arrow {
  color: var(--ink-faint);
  font-size: 18px;
  transition: transform 0.3s;
  flex-shrink: 0;
}

/* === Sections === */
.sections {
  display: grid;
  gap: 48px;
}
.section-card {
  background: var(--surface);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 40px 42px;
  scroll-margin-top: 72px;
  border-left: 4px solid transparent;
  box-shadow: 0 18px 56px rgba(0,0,0,0.24);
}
.section-card.accent { border-left-color: var(--cyan); }
.section-card.info { border-left-color: var(--magenta); }
.section-card.warn { border-left-color: var(--orange); }
.section-warn {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(255, 145, 0, 0.12);
  border-left: 3px solid var(--orange);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
}
.section-warn strong {
  color: var(--orange);
  display: block;
  margin-bottom: 4px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
}
.section-head h2 {
  font-family: 'Syne', sans-serif;
  margin: 0;
  font-size: 30px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
  line-height: 1.22;
  padding-bottom: 0.16em;
}
.section-body { margin-top: 24px; }

.heading-with-info,
.heading-with-info {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  position: relative;
  min-width: 0;
  flex-wrap: wrap;
}
.info-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border-radius: 999px;
  border: 1px solid var(--surface-border-strong);
  background: rgba(255,255,255,0.04);
  color: var(--ink-bright);
  font: inherit;
  font-size: 12px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s, color 0.2s, transform 0.2s;
  flex-shrink: 0;
}
.info-button:hover,
.info-button[aria-expanded="true"] {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--cyan);
  transform: translateY(-1px);
}
.info-modal {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: none;
  align-items: center;
  justify-content: center;
  padding: 24px;
}
.info-modal[data-open="true"] {
  display: flex;
}
.info-modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(4, 6, 12, 0.74);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.info-modal-card {
  position: relative;
  z-index: 1;
  width: min(560px, calc(100vw - 40px));
  padding: 26px 26px 22px;
  border-radius: 24px;
  border: 1px solid var(--surface-border-strong);
  background: linear-gradient(180deg, rgba(17, 20, 34, 0.98), rgba(10, 12, 22, 0.98));
  color: var(--ink);
  box-shadow: 0 26px 80px rgba(0,0,0,0.45);
}
.info-modal-kicker {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--cyan);
  font-weight: 700;
  margin-bottom: 10px;
}
.info-modal-title {
  font-family: 'Syne', sans-serif;
  font-size: 24px;
  line-height: 1.2;
  color: #fff;
  margin: 0 0 14px;
  padding-bottom: 0.12em;
}
.info-modal-copy {
  margin: 0;
  color: var(--ink);
  font-size: 15px;
  line-height: 1.7;
}
.info-modal-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-top: 20px;
  padding: 11px 18px;
  border-radius: 999px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.04);
  color: var(--ink-bright);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;
}
.info-modal-close:hover {
  border-color: var(--accent-border);
  background: var(--accent-soft);
  color: var(--cyan);
}

/* Collapsible */
.section-card.collapsible .section-head { cursor: pointer; }
.section-card.collapsible .section-head::after {
  content: "";
  width: 10px;
  height: 10px;
  border-right: 2px solid var(--ink-muted);
  border-bottom: 2px solid var(--ink-muted);
  transform: rotate(45deg);
  transition: transform 0.3s;
  flex-shrink: 0;
  margin-left: 16px;
}
.section-card.collapsible.collapsed .section-head::after {
  transform: rotate(-45deg);
}
.section-card.collapsible .section-body {
  overflow: hidden;
  transition: max-height 0.4s ease, opacity 0.3s ease;
}
.section-card.collapsible.collapsed .section-body {
  max-height: 0 !important;
  opacity: 0;
  margin-top: 0;
}

/* Section contents */
.bullets {
  margin: 0;
  padding-left: 24px;
  line-height: 1.75;
  color: var(--ink);
  font-size: 16px;
}
.bullets li + li { margin-top: 10px; }
.empty {
  color: var(--ink-muted);
  font-style: italic;
  font-size: 16px;
}

/* === Toolbar === */
.toolbar-card {
  margin: 0;
  background: rgba(13, 15, 26, 0.62);
  border-color: rgba(255,255,255,0.08);
  box-shadow: 0 10px 36px rgba(0,0,0,0.16);
}
.toolbar-card--compact {
  padding: 18px 24px 18px;
}
.toolbar-headline {
  align-items: flex-end;
  margin-bottom: 14px;
}
.toolbar-title-group {
  min-width: 0;
}
.toolbar-card .panel-kicker {
  color: var(--ink-faint);
  margin-bottom: 4px;
}
.toolbar-inline-help {
  max-width: 31ch;
  color: var(--ink-muted);
  font-size: 12px;
  line-height: 1.45;
  text-align: right;
}
.toolbar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  align-items: end;
}
.toolbar-grid--compact {
  grid-template-columns: minmax(220px, 1.3fr) repeat(3, minmax(150px, 0.9fr)) auto;
  gap: 12px;
}
.toolbar-help {
  margin-top: 18px;
  color: var(--ink-muted);
  font-size: 14px;
  line-height: 1.6;
}
.control { display: grid; gap: 10px; }
.toolbar-card .control { gap: 8px; }
.control span {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-muted);
  font-weight: 700;
}
.control input, .control select {
  appearance: none;
  width: 100%;
  padding: 12px 18px;
  border-radius: 14px;
  border: 1px solid var(--surface-border);
  background: rgba(255,255,255,0.03);
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.control input:focus, .control select:focus {
  outline: none;
  border-color: var(--accent-border);
  box-shadow: 0 0 0 4px var(--accent-soft), 0 0 32px rgba(0,229,255,0.08);
}
.control input::placeholder { color: var(--ink-faint); }
.control select option { background: var(--surface-solid); color: var(--ink); }
.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 12px 18px;
  border-radius: 999px;
  color: var(--ink-muted);
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--surface-border);
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}
.ghost-button:hover {
  background: var(--accent-soft);
  border-color: var(--accent-border);
  color: var(--accent);
}

/* Filter indicator */
.filter-indicator {
  text-align: center;
  padding: 16px;
  font-size: 14px;
  font-weight: 600;
  color: var(--cyan);
  text-shadow: 0 0 16px rgba(0,229,255,0.3);
  display: none;
}
.filter-indicator.active { display: block; }

/* === Cards === */
.coverage-grid, .repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 24px;
}
.coverage-grid--stacked {
  grid-template-columns: 1fr;
}
.coverage-card, .repo-card {
  background: rgba(255,255,255,0.025);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  padding: 28px 30px;
  transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
}
.repo-card { border-top: 3px solid transparent; }
.repo-grid .repo-card:nth-child(5n+1) { border-top-color: var(--cyan); }
.repo-grid .repo-card:nth-child(5n+2) { border-top-color: var(--magenta); }
.repo-grid .repo-card:nth-child(5n+3) { border-top-color: var(--orange); }
.repo-grid .repo-card:nth-child(5n+4) { border-top-color: var(--green); }
.repo-grid .repo-card:nth-child(5n+5) { border-top-color: var(--blue); }

.repo-grid .repo-card:nth-child(5n+1):hover { border-color: rgba(0,229,255,0.28); box-shadow: 0 16px 48px rgba(0,0,0,0.28); transform: translateY(-4px); }
.repo-grid .repo-card:nth-child(5n+2):hover { border-color: rgba(224,64,251,0.28); box-shadow: 0 16px 48px rgba(0,0,0,0.28); transform: translateY(-4px); }
.repo-grid .repo-card:nth-child(5n+3):hover { border-color: rgba(255,145,0,0.28); box-shadow: 0 16px 48px rgba(0,0,0,0.28); transform: translateY(-4px); }
.repo-grid .repo-card:nth-child(5n+4):hover { border-color: rgba(0,230,118,0.28); box-shadow: 0 16px 48px rgba(0,0,0,0.28); transform: translateY(-4px); }
.repo-grid .repo-card:nth-child(5n+5):hover { border-color: rgba(41,121,255,0.28); box-shadow: 0 16px 48px rgba(0,0,0,0.28); transform: translateY(-4px); }
.repo-grid--stacked {
  grid-template-columns: 1fr;
}
.repo-grid--stacked .repo-card {
  padding: 30px 32px;
}
.report-subsection + .report-subsection {
  margin-top: 36px;
}
.report-subtitle {
  margin: 0 0 10px;
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--ink-muted);
}
.report-subcopy {
  margin: 0 0 18px;
  max-width: 92ch;
  color: var(--ink-muted);
  font-size: 15px;
  line-height: 1.68;
}
.repo-grid--discovery .repo-card {
  padding: 34px 36px;
}
.repo-card--collapsible {
  padding: 0 !important;
  overflow: hidden;
}
.repo-card-summary {
  display: grid;
  gap: 14px;
  padding: 30px 36px 22px;
  cursor: pointer;
  list-style: none;
  position: relative;
}
.repo-card-summary::-webkit-details-marker { display: none; }
.repo-card-summary::marker { content: ""; }
.repo-card-summary::after {
  content: "";
  position: absolute;
  top: 34px;
  right: 36px;
  width: 10px;
  height: 10px;
  border-right: 2px solid var(--ink-muted);
  border-bottom: 2px solid var(--ink-muted);
  transform: rotate(45deg);
  transition: transform 0.22s ease, border-color 0.22s ease;
}
.repo-card--collapsible[open] .repo-card-summary::after {
  transform: rotate(-135deg);
}
.repo-card--collapsible:hover .repo-card-summary::after {
  border-color: var(--ink-bright);
}
.repo-card-summary .repo-head {
  padding-right: 36px;
  margin-bottom: 0;
}
.repo-summary-copy {
  margin: 0;
  max-width: 92ch;
  color: var(--ink-muted);
  font-size: 15px;
  line-height: 1.65;
}
.repo-card-body {
  padding: 0 36px 34px;
}
.repo-grid--stacked .repo-head {
  gap: 20px;
}
.repo-grid--stacked .repo-badges {
  justify-content: flex-start;
}
.repo-grid--stacked .mini-grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.repo-grid--discovery .repo-head {
  gap: 22px;
}
.repo-grid--discovery .repo-copy {
  max-width: 92ch;
  font-size: 16px;
  line-height: 1.75;
}
.repo-grid--discovery .repo-summary-copy {
  font-size: 16px;
  line-height: 1.72;
}
.repo-grid--discovery .mini-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 18px;
}
.repo-grid--discovery .mini-grid > div {
  padding: 18px 18px 16px;
}
.repo-grid--discovery .repo-details {
  margin-top: 24px;
}
.repo-meta-strip {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 18px;
  margin: 18px 0 0;
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.07);
}
.repo-meta-strip span {
  color: var(--ink-muted);
  font-size: 13px;
  line-height: 1.5;
}
.repo-meta-strip strong {
  color: var(--ink-bright);
  display: inline-block;
  margin-right: 6px;
}
.coverage-grid--balanced {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
}
.coverage-card--wide {
  grid-column: 1 / -1;
}
.coverage-grid--balanced .coverage-card {
  min-height: 100%;
}
.subsection-block + .subsection-block {
  margin-top: 22px;
  padding-top: 22px;
  border-top: 1px solid rgba(255,255,255,0.08);
}
.subsection-block h4 {
  margin: 0 0 12px;
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-muted);
}

.coverage-card h3, .repo-card h3 {
  font-family: 'Syne', sans-serif;
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 700;
  color: var(--ink-bright);
  line-height: 1.22;
  padding-bottom: 0.12em;
}
.coverage-card:hover {
  border-color: var(--surface-border-strong);
  box-shadow: 0 16px 44px rgba(0,0,0,0.24);
  transform: translateY(-2px);
}
.repo-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 4px;
}
.repo-badges { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; flex-shrink: 0; }
.badge {
  display: inline-flex;
  align-items: center;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  border: 1px solid transparent;
  white-space: nowrap;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.badge.accent { background: var(--accent-soft); color: var(--accent); border-color: var(--accent-border); text-shadow: 0 0 14px rgba(0,229,255,0.3); }
.badge.info { background: var(--info-soft); color: var(--info); border-color: var(--info-border); text-shadow: 0 0 14px rgba(224,64,251,0.3); }
.badge.warn { background: var(--warn-soft); color: var(--warn); border-color: var(--warn-border); text-shadow: 0 0 14px rgba(255,145,0,0.3); }
.badge.neutral { background: rgba(85,88,120,0.14); color: #8890b0; border-color: rgba(85,88,120,0.2); }

.repo-url { margin: 16px 0 0; font-size: 15px; }
.repo-copy { color: var(--ink); font-size: 15px; line-height: 1.65; margin: 14px 0 0; }
.mini-grid { margin: 24px 0 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 18px 24px; }
.mini-grid > div {
  min-width: 0;
  padding: 14px 16px;
  border-radius: 14px;
  background: rgba(255,255,255,0.02);
  border: 1px solid rgba(255,255,255,0.06);
}
.mini-grid dt { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-muted); font-weight: 700; margin-bottom: 6px; }
.mini-grid dd { margin: 0; line-height: 1.55; color: var(--ink); font-size: 15px; }

.repo-details { margin-top: 28px; padding-top: 24px; border-top: 1px solid var(--surface-border); }
.repo-details summary {
  cursor: pointer;
  font-weight: 700;
  font-size: 13px;
  color: var(--accent);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  transition: color 0.2s;
}
.repo-details summary:hover { color: #80f0ff; }
.agent-json summary {
  margin-bottom: 14px;
}
.agent-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin: 18px 0 18px;
}
.agent-action-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 42px;
  padding: 10px 18px;
  border-radius: 999px;
  border: 1px solid var(--accent-border);
  background: rgba(0,229,255,0.07);
  color: var(--ink-bright);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s, background 0.2s, color 0.2s;
}
.agent-action-button:hover {
  transform: translateY(-1px);
  border-color: rgba(0,229,255,0.45);
  background: rgba(0,229,255,0.12);
  color: var(--cyan);
}
.agent-pre {
  margin: 0;
  padding: 16px 18px;
  border-radius: 16px;
  background: rgba(3, 5, 10, 0.9);
  border: 1px solid rgba(255,255,255,0.08);
  color: #dce8ff;
  font-size: 13px;
  line-height: 1.65;
  max-height: 460px;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

/* === Bar Charts === */
.bar-list { display: grid; gap: 16px; margin-top: 20px; }
.bar-row {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(140px, 3fr) 40px;
  gap: 14px;
  align-items: center;
}
.bar-label { font-size: 14px; color: var(--ink-muted); font-weight: 500; }
.bar-count { font-size: 14px; color: var(--ink-muted); text-align: right; font-weight: 700; font-variant-numeric: tabular-nums; }
.bar-track { position: relative; height: 10px; border-radius: 999px; background: rgba(255,255,255,0.04); overflow: hidden; }
.bar-fill { position: absolute; inset: 0 auto 0 0; border-radius: inherit; width: 0%; transition: width 0.7s cubic-bezier(0.22,1,0.36,1); }
.bar-row:nth-child(5n+1) .bar-fill { background: var(--cyan); box-shadow: 0 0 14px rgba(0,229,255,0.4); }
.bar-row:nth-child(5n+2) .bar-fill { background: var(--magenta); box-shadow: 0 0 14px rgba(224,64,251,0.4); }
.bar-row:nth-child(5n+3) .bar-fill { background: var(--orange); box-shadow: 0 0 14px rgba(255,145,0,0.4); }
.bar-row:nth-child(5n+4) .bar-fill { background: var(--green); box-shadow: 0 0 14px rgba(0,230,118,0.4); }
.bar-row:nth-child(5n+5) .bar-fill { background: var(--blue); box-shadow: 0 0 14px rgba(41,121,255,0.4); }

/* === Data Table === */
.table-wrap { overflow-x: auto; }
.data-table { width: 100%; border-collapse: collapse; font-size: 15px; }
.data-table th, .data-table td { padding: 18px 16px; text-align: left; border-bottom: 1px solid var(--surface-border); vertical-align: top; }
.data-table th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--ink-muted); font-weight: 700; }
.data-table tbody tr { transition: background 0.2s; }
.data-table tbody tr:hover { background: rgba(255,255,255,0.025); }

/* === Footer === */
.report-footer {
  text-align: center;
  padding: 100px 24px 0;
  color: var(--ink-faint);
  font-size: 14px;
  letter-spacing: 0.06em;
}
.report-footer img {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  opacity: 0.25;
  margin: 0 auto 16px;
  display: block;
  filter: none;
}

/* === Decision Summary === */
.decision-summary-card {
  border-left-width: 0;
  position: relative;
  overflow: hidden;
}
.decision-summary-card::before {
  content: "";
  position: absolute;
  inset: 0 0 auto 0;
  height: 2px;
  background: linear-gradient(90deg, var(--cyan), var(--magenta), transparent 85%);
  opacity: 0.9;
}
.decision-summary-layout {
  display: grid;
  grid-template-columns: 1fr;
  gap: 20px;
  align-items: start;
}
.decision-primary {
  display: grid;
  gap: 12px;
}
.decision-callout {
  padding: 26px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.025));
  border: 1px solid rgba(255,255,255,0.12);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
}
.decision-callout-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.decision-callout-name {
  color: var(--ink-bright);
  font-family: 'Syne', sans-serif;
  font-size: 22px;
  line-height: 1.22;
  padding-bottom: 0.12em;
}
.decision-callout-text {
  margin: 0;
  color: var(--ink-bright);
  font-size: 17px;
  line-height: 1.55;
}
.decision-callout-meta {
  margin: 16px 0 0;
  color: var(--ink-muted);
  font-size: 14px;
}
.decision-facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
.summary-grid { display: grid; gap: 20px; }
.summary-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 18px 18px;
  border-radius: 16px;
  background: rgba(255,255,255,0.034);
  border: 1px solid rgba(255,255,255,0.09);
  min-height: 124px;
  justify-content: space-between;
}
.summary-item:nth-child(1) {
  border-top: 3px solid rgba(0,229,255,0.75);
}
.summary-item:nth-child(2) {
  border-top: 3px solid rgba(224,64,251,0.7);
}
.summary-item:nth-child(3) {
  border-top: 3px solid rgba(255,145,0,0.7);
}
.summary-item:nth-child(4) {
  border-top: 3px solid rgba(0,230,118,0.7);
}
.section-warn {
  margin: 0 0 16px;
  padding: 12px 16px;
  border-radius: 8px;
  background: rgba(255, 145, 0, 0.12);
  border-left: 3px solid var(--orange);
  color: var(--ink);
  font-size: 14px;
  line-height: 1.5;
}
.section-warn strong {
  color: var(--orange);
  display: block;
  margin-bottom: 4px;
}
.summary-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--ink-muted);
  font-weight: 700;
}
.summary-value {
  font-size: 15px;
  color: var(--ink-bright);
  line-height: 1.5;
  display: flex;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 8px;
  overflow-wrap: anywhere;
}
.summary-heuristic-label { font-weight: 400; color: var(--ink-muted); }
.summary-hint { color: var(--ink-muted); font-size: 13px; margin-left: 0; display: inline-block; }

/* === Recommended Actions === */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}
.action-group {
  min-width: 0;
  --group-color: var(--ink-muted);
  padding: 18px 18px 8px;
  border-radius: 18px;
  background: rgba(255,255,255,0.025);
  border: 1px solid rgba(255,255,255,0.08);
}
.action-group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 12px;
}
.action-group h3 {
  color: var(--group-color);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 0;
  font-weight: 700;
}
.action-group-count {
  display: inline-flex;
  min-width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(255,255,255,0.06);
  color: var(--ink-bright);
  font-size: 12px;
  font-weight: 700;
}
.action-item {
  display: block;
  padding: 10px 0;
  color: var(--ink);
  text-decoration: none;
  border-bottom: 1px solid var(--surface-border);
  font-size: 14px;
  transition: color 0.2s;
}
.action-item.ranked { font-weight: 600; }
.action-item__rank {
  color: var(--group-color);
  font-size: 12px;
  margin-right: 6px;
  font-weight: 700;
}
.action-item__name { color: var(--ink-bright); }
.action-item__license {
  display: inline-flex;
  align-items: center;
  font-size: 11px;
  margin-left: 8px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  vertical-align: middle;
}
.license-permissive { color: var(--ink-muted); background: rgba(255,255,255,0.04); }
.license-copyleft { color: var(--orange); background: rgba(255,145,0,0.12); }
.license-unknown { color: var(--ink-muted); background: rgba(255,255,255,0.04); opacity: 0.7; }
.action-item__reason {
  display: block;
  color: var(--ink-muted);
  margin-left: 0;
  margin-top: 6px;
  line-height: 1.5;
}
.action-item:hover { color: var(--cyan) !important; }
.action-item:hover .action-item__name { color: var(--cyan) !important; }

/* === Heading safety === */
.hero-brand,
.hero-subtitle,
.hero-claim,
.hero-project-name,
.panel-card h2,
.section-head h2,
.coverage-card h3,
.repo-card h3,
.decision-callout-name {
  overflow: visible;
}

/* === Scroll Reveal === */
.reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.6s ease, transform 0.6s ease; }
.reveal.in-view { opacity: 1; transform: translateY(0); }
.hidden-by-filter { display: none !important; }

/* === Responsive === */
@media (max-width: 720px) {
  .page { padding: 0 20px 72px; }
  .hero { padding: 56px 0 48px; }
  .hero-brand { font-size: 36px; }
  .hero-claim { font-size: 20px; }
  .hero-project-card { padding: 20px 28px; }
  .hero-project-name { font-size: 18px; }
  .report-overview { grid-template-columns: 1fr; gap: 32px; margin-bottom: 40px; }
  .stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  .stat-card { padding: 24px; }
  .stat-value { font-size: 28px; }
  .section-card { padding: 32px 24px; border-radius: var(--radius); }
  .section-head h2 { font-size: 22px; }
  .coverage-card, .repo-card { padding: 24px; }
  .coverage-grid, .repo-grid, .repo-grid--stacked, .coverage-grid--balanced { grid-template-columns: 1fr; }
  .coverage-card--wide { grid-column: auto; }
  .repo-meta-strip { grid-template-columns: 1fr; }
  .repo-head { flex-direction: column; }
  .repo-badges { justify-content: flex-start; }
  .repo-grid--discovery .repo-card { padding: 26px 22px; }
  .repo-card-summary { padding: 24px 22px 18px; }
  .repo-card-summary::after { top: 28px; right: 22px; }
  .repo-card-summary .repo-head { padding-right: 28px; }
  .repo-card-body { padding: 0 22px 24px; }
  .toolbar-card--compact { padding: 18px 18px 16px; }
  .toolbar-headline { align-items: flex-start; flex-direction: column; margin-bottom: 14px; }
  .toolbar-inline-help { max-width: none; text-align: left; }
  .toolbar-grid--compact { grid-template-columns: 1fr; gap: 12px; }
  .sticky-nav { padding: 0 16px; }
  .rec-card { padding: 16px 20px; gap: 14px; }
  .rec-card:nth-child(1) { padding: 20px 24px; }
  .mini-grid { grid-template-columns: 1fr; }
  .sections { gap: 32px; }
  .decision-summary-layout { grid-template-columns: 1fr; }
  .decision-facts { grid-template-columns: 1fr; }
  .decision-callout-name { font-size: 18px; }
  .decision-callout-text { font-size: 16px; }
}

/* === Print / PDF Export === */
@media print {
  body { background: #fff !important; color: #222 !important; font-size: 11pt; }
  body::before, .grain, .scroll-progress, .sticky-nav, .toolbar-card, .pdf-export-btn, .filter-indicator { display: none !important; }
  .page { padding: 0; max-width: none; }
  .hero { padding: 32px 0 24px; }
  .hero-logo { width: 48px; height: 48px; filter: none; }
  .hero-brand { font-size: 28px; color: #222; }
  .hero-brand .pilot { -webkit-text-fill-color: #555; }
  .hero-divider { background: #ccc; box-shadow: none; }
  .hero-claim { color: #222; font-size: 18px; }
  .hero-claim .discover { color: #222; text-shadow: none; }
  .hero-project-card { background: #f8f8f8; border: 1px solid #ddd; backdrop-filter: none; }
  .hero-project-type { color: #555; }
  .hero-project-name { color: #222; }
  .hero-project-meta { color: #666; }
  .stat-card, .section-card, .repo-card, .coverage-card { background: #fff; border: 1px solid #ddd; backdrop-filter: none; -webkit-backdrop-filter: none; box-shadow: none; break-inside: avoid; }
  .stat-card { border-top-width: 2px; }
  .stat-value { color: #222 !important; text-shadow: none !important; }
  .stat-label, .control span, .mini-grid dt { color: #666; }
  .section-head h2 { color: #222; }
  .section-body, .section-card.collapsible.collapsed .section-body { max-height: none !important; opacity: 1 !important; margin-top: 24px !important; overflow: visible !important; }
  .section-card.collapsible .section-head::after { display: none; }
  .badge { border: 1px solid #ccc; background: #f0f0f0; color: #444; text-shadow: none; }
  .rec-card { border: 1px solid #ddd; background: #fafafa; }
  .rec-rank { background: #eee !important; color: #444 !important; }
  .bar-fill { box-shadow: none; }
  .repo-grid .repo-card, .coverage-grid { grid-template-columns: 1fr; }
  .reveal { opacity: 1 !important; transform: none !important; }
  a { color: #222; }
  .report-footer img { opacity: 0.4; }
  .report-footer { color: #999; }
}
  </style>
  <style>
${COCKPIT_NIGHT_BASE_CSS}
  </style>
</head>
<body>
  <svg class="grain" aria-hidden="true" style="position:fixed;inset:0;width:100%;height:100%;opacity:0.022;pointer-events:none;z-index:9999;mix-blend-mode:overlay"><filter id="g"><feTurbulence baseFrequency="0.55" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>
  <div class="scroll-progress" id="scroll-progress"></div>
  <div class="shell">
    ${renderStickyNav(sections)}
    <main class="wrap page" id="top">
      ${renderHeroSection({ reportType, projectKey, createdAt, subtitle: heroSubtitle, candidateCount })}

      <div class="section-break"></div>

      ${renderReportContentIntro({ reportType, projectKey, createdAt, heroSubtitle, candidateCount, runRoot })}

      ${renderReportToolbar({ modeOptions, layerOptions })}

      <section class="report-overview" id="overview">
        ${statsPanel}
        ${renderDecisionSummary({ candidates, reportType, runRoot })}
        ${recommendationsPanel}
        ${renderRecommendedActions({ candidates, reportType, runRoot })}
      </section>

      <div class="sections">
        ${sections.map((section) => {
          if (section.collapsible) {
            return renderCollapsibleSection(section.title, section.body, {
              tone: section.tone ?? "default",
              sectionId: section.id ?? slugifyForId(section.title),
              navLabel: section.navLabel ?? "",
              collapsed: section.collapsed ?? false
            });
          }
          return renderHtmlSection(section.title, section.body, section.tone ?? "default", section.id ?? slugifyForId(section.title));
        }).join("\n")}
      </div>

      <footer class="report-footer">
        <img src="${LOGO_BASE64}" alt="Patternpilot">
        <p>Erzeugt mit Patternpilot &mdash; Repository-Intelligenz-System</p>
      </footer>
    </main>
  </div>
  ${renderInfoDialog({})}
  ${agentPayloadScript ? `<script type="application/json" id="patternpilot-agent-payload">${agentPayloadScript}</script>` : ""}
  <script>
(() => {
  /* ---- Filters ---- */
  const searchInput = document.getElementById("report-search");
  const fitSelect = document.getElementById("report-fit");
  const modeSelect = document.getElementById("report-mode");
  const layerSelect = document.getElementById("report-layer");
  const resetButton = document.getElementById("report-reset");
  const cards = Array.from(document.querySelectorAll(".filter-card"));
  const rows = Array.from(document.querySelectorAll(".data-table tbody tr"));
  const indicator = document.getElementById("filter-indicator");
  const totalCount = cards.length;

  const applyFilters = () => {
    const search = (searchInput?.value || "").trim().toLowerCase();
    const fit = (fitSelect?.value || "").toLowerCase();
    const mode = (modeSelect?.value || "").toLowerCase();
    const layer = (layerSelect?.value || "").toLowerCase();

    const matches = (node, rowSearch) => {
      const text = (node.dataset.search || rowSearch || "").toLowerCase();
      const fitVal = node.dataset.fit || "";
      const modeVal = node.dataset.mode || "";
      const layerVal = node.dataset.layer || "";
      return (!search || text.includes(search))
        && (!fit || fitVal === fit)
        && (!mode || modeVal === mode)
        && (!layer || layerVal === layer);
    };

    let visibleCount = 0;
    cards.forEach((card) => {
      const visible = matches(card, "");
      card.classList.toggle("hidden-by-filter", !visible);
      if (visible) visibleCount++;
    });

    rows.forEach((row) => {
      const firstCell = row.querySelector("td");
      const fitVal = row.children[3]?.textContent?.toLowerCase() || "";
      const layerVal = row.children[1]?.textContent?.toLowerCase() || "";
      const modeVal = row.children[2]?.textContent?.toLowerCase() || "";
      const rowSearch = [firstCell?.dataset.search || "", row.textContent || ""].join(" ").toLowerCase();
      const pseudoNode = {
        dataset: {
          search: rowSearch,
          fit: fitVal.includes("high") ? "high" : fitVal.includes("medium") ? "medium" : fitVal.includes("low") ? "low" : "unknown",
          mode: modeVal,
          layer: layerVal
        }
      };
      row.classList.toggle("hidden-by-filter", !matches(pseudoNode, rowSearch));
    });

    if (indicator) {
      const hasFilter = search || fit || mode || layer;
      indicator.classList.toggle("active", hasFilter);
      if (hasFilter) {
        indicator.textContent = "Gefiltert: " + visibleCount + " von " + totalCount + " Kandidatenkarten sichtbar";
      } else {
        indicator.textContent = "";
      }
    }
  };

  [searchInput, fitSelect, modeSelect, layerSelect].forEach((n) => {
    n?.addEventListener("input", applyFilters);
    n?.addEventListener("change", applyFilters);
  });
  resetButton?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (fitSelect) fitSelect.value = "";
    if (modeSelect) modeSelect.value = "";
    if (layerSelect) layerSelect.value = "";
    applyFilters();
  });
  applyFilters();

  /* ---- Scroll Reveal ---- */
  const revealTargets = document.querySelectorAll(".section-card, .repo-card, .coverage-card, .stat-card, .rec-card");
  revealTargets.forEach((el) => el.classList.add("reveal"));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });

  requestAnimationFrame(() => {
    revealTargets.forEach((el) => {
      const idx = Array.from(el.parentElement?.children || []).indexOf(el);
      el.style.transitionDelay = Math.min(idx * 0.07, 0.28) + "s";
      revealObserver.observe(el);
    });
  });

  /* ---- Counter Animation ---- */
  const counters = document.querySelectorAll(".stat-value[data-count]");
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      if (!Number.isFinite(target)) return;
      counterObserver.unobserve(el);
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(ease * target);
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = "0";
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.3 });
  counters.forEach((el) => counterObserver.observe(el));

  /* ---- Bar Fill Animation ---- */
  const barFills = document.querySelectorAll(".bar-fill[data-width]");
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.width = entry.target.dataset.width + "%";
      barObserver.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  barFills.forEach((el) => barObserver.observe(el));

  /* ---- Sticky Nav ---- */
  const hero = document.getElementById("hero");
  const stickyNav = document.getElementById("sticky-nav");
  if (hero && stickyNav) {
    const heroObserver = new IntersectionObserver(([entry]) => {
      stickyNav.classList.toggle("visible", !entry.isIntersecting);
    }, { threshold: 0 });
    heroObserver.observe(hero);
  }

  /* ---- Scroll Progress ---- */
  const progressBar = document.getElementById("scroll-progress");
  if (progressBar) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          progressBar.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + "%" : "0%";
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ---- Collapsible Sections ---- */
  document.querySelectorAll(".section-card.collapsible .section-head").forEach((head) => {
    head.addEventListener("click", () => {
      const card = head.closest(".section-card");
      const body = card.querySelector(".section-body");
      if (card.classList.contains("collapsed")) {
        body.style.maxHeight = body.scrollHeight + "px";
        card.classList.remove("collapsed");
      } else {
        body.style.maxHeight = body.scrollHeight + "px";
        requestAnimationFrame(() => {
          body.style.maxHeight = "0px";
          card.classList.add("collapsed");
        });
      }
    });
  });

  /* Initialize collapsible max-heights */
  document.querySelectorAll(".section-card.collapsible:not(.collapsed) .section-body").forEach((body) => {
    body.style.maxHeight = body.scrollHeight + "px";
  });
  document.querySelectorAll(".section-card.collapsible details").forEach((details) => {
    details.addEventListener("toggle", () => {
      const body = details.closest(".section-card")?.querySelector(".section-body");
      if (!body) return;
      requestAnimationFrame(() => {
        body.style.maxHeight = body.scrollHeight + "px";
      });
    });
  });

  /* ---- Hero logo glow pulse after entrance ---- */
  const heroLogo = document.querySelector(".hero-logo");
  if (heroLogo) {
    heroLogo.addEventListener("animationend", () => {
      heroLogo.classList.add("animated");
    }, { once: true });
  }

  /* ---- Info Buttons ---- */
  const infoMap = {
    "kennzahlen": "Hier siehst du die verdichteten Grundzahlen dieses Laufs auf einen Blick. Der Block ist bewusst kompakt, damit du sofort erkennst, wie breit der Bericht ist, wie frisch er wirkt und wie viel Material dahintersteht.",
    "stats": "Hier siehst du die verdichteten Grundzahlen dieses Laufs auf einen Blick. Der Block ist bewusst kompakt, damit du sofort erkennst, wie breit der Bericht ist, wie frisch er wirkt und wie viel Material dahintersteht.",
    "erste empfehlungen": "Dieser Block ist deine schnellste Einstiegsspur in den Bericht. Hier stehen nicht alle Details, sondern die wenigen Repos oder Laufhinweise, mit denen du sinnvoll anfangen solltest. Lies ihn als Priorisierung fuer den ersten Blick, nicht als endgueltige Entscheidung.",
    "erste empfehlung": "Dieser Block ist deine schnellste Einstiegsspur in den Bericht. Hier stehen nicht alle Details, sondern die wenigen Repos oder Laufhinweise, mit denen du sinnvoll anfangen solltest. Lies ihn als Priorisierung fuer den ersten Blick, nicht als endgueltige Entscheidung.",
    "recommendations": "Dieser Block ist deine schnellste Einstiegsspur in den Bericht. Hier stehen nicht alle Details, sondern die wenigen Repos oder Laufhinweise, mit denen du sinnvoll anfangen solltest. Lies ihn als Priorisierung fuer den ersten Blick, nicht als endgueltige Entscheidung.",
    "entscheidungsuebersicht": "Die Entscheidungsuebersicht ist die verdichtete Kernaussage dieses kompletten Laufs. Hier siehst du, wohin der Bericht insgesamt kippt, welches Repo oder welcher Schritt vorne liegt und unter welchem Vertrauensniveau du das lesen solltest. Dieser Block ist also deine Lageeinschaetzung, bevor du in die einzelnen Karten gehst.",
    "decision-summary": "Die Entscheidungsuebersicht ist die verdichtete Kernaussage dieses kompletten Laufs. Hier siehst du, wohin der Bericht insgesamt kippt, welches Repo oder welcher Schritt vorne liegt und unter welchem Vertrauensniveau du das lesen solltest. Dieser Block ist also deine Lageeinschaetzung, bevor du in die einzelnen Karten gehst.",
    "empfohlene aktionen": "Hier gruppiert Patternpilot die Kandidaten nach Handlungstyp statt nur nach Rang. Dadurch wird klarer, was jetzt uebernommen, was vertieft, was beobachtet und was bewusst zurueckgestellt werden sollte.",
    "recommended-actions": "Hier gruppiert Patternpilot die Kandidaten nach Handlungstyp statt nur nach Rang. Dadurch wird klarer, was jetzt uebernommen, was vertieft, was beobachtet und was bewusst zurueckgestellt werden sollte.",
    "staerkste vergleichs-repos": "Hier beginnt die eigentliche Vergleichsarbeit dieses Reports. Jede Karte verdichtet pro Repo, warum es relevant ist, was du daraus mitnehmen kannst und wo Risiken oder Grenzen liegen. Wenn du Muster uebernehmen, gegeneinander abwaegen oder bewusst verwerfen willst, triffst du die Entscheidung in diesem Bereich.",
    "staerkste vergleich repos": "Hier beginnt die eigentliche Vergleichsarbeit dieses Reports. Jede Karte verdichtet pro Repo, warum es relevant ist, was du daraus mitnehmen kannst und wo Risiken oder Grenzen liegen. Wenn du Muster uebernehmen, gegeneinander abwaegen oder bewusst verwerfen willst, triffst du die Entscheidung in diesem Bereich.",
    "top-compared-repositories": "Hier beginnt die eigentliche Vergleichsarbeit dieses Reports. Jede Karte verdichtet pro Repo, warum es relevant ist, was du daraus mitnehmen kannst und wo Risiken oder Grenzen liegen. Wenn du Muster uebernehmen, gegeneinander abwaegen oder bewusst verwerfen willst, triffst du die Entscheidung in diesem Bereich.",
    "abdeckung und signale": "Dieser Bereich macht sichtbar, welche Ebenen, Lueckenbereiche und Faehigkeiten der aktuelle Bericht tatsaechlich beruehrt. So erkennst du, ob der Lauf ausgewogen ist oder ob wichtige Themen trotz vieler Karten noch unterbelichtet bleiben.",
    "coverage": "Dieser Bereich macht sichtbar, welche Ebenen, Lueckenbereiche und Faehigkeiten der aktuelle Bericht tatsaechlich beruehrt. So erkennst du, ob der Lauf ausgewogen ist oder ob wichtige Themen trotz vieler Karten noch unterbelichtet bleiben.",
    "umfang des laufs": "Dieser Bereich zeigt, auf welcher Basis der Bericht entstanden ist. Du siehst hier, welche URLs wirklich im Lauf waren, ob der Fokus auf expliziten Repos oder auf der Watchlist lag und wie belastbar die Entscheidungsdaten dazu sind. Damit kannst du einschaetzen, wie breit du die Aussagen dieses Reports lesen solltest.",
    "run-scope": "Dieser Bereich zeigt, auf welcher Basis der Bericht entstanden ist. Du siehst hier, welche URLs wirklich im Lauf waren, ob der Fokus auf expliziten Repos oder auf der Watchlist lag und wie belastbar die Entscheidungsdaten dazu sind. Damit kannst du einschaetzen, wie breit du die Aussagen dieses Reports lesen solltest.",
    "review-umfang": "Hier siehst du, in welchem konkreten Review-Rahmen Patternpilot gearbeitet hat. Der Block trennt zwischen explizit uebergebenen Repos und Watchlist-Kontext, damit du die Aussagekraft des Vergleichs besser einordnen kannst.",
    "review-scope": "Hier siehst du, in welchem konkreten Review-Rahmen Patternpilot gearbeitet hat. Der Block trennt zwischen explizit uebergebenen Repos und Watchlist-Kontext, damit du die Aussagekraft des Vergleichs besser einordnen kannst.",
    "ki coding agents": "Diese Sicht ist die verdichtete Uebergabe fuer KI Coding Agents. Sie kombiniert Arbeitsauftrag, priorisierte Repos, Kontext, Leitplanken, Unsicherheiten und das maschinenlesbare Snapshot in einer Form, die direkt weiterverarbeitet werden kann.",
    "agent-view": "Diese Sicht ist die verdichtete Uebergabe fuer KI Coding Agents. Sie kombiniert Arbeitsauftrag, priorisierte Repos, Kontext, Leitplanken, Unsicherheiten und das maschinenlesbare Snapshot in einer Form, die direkt weiterverarbeitet werden kann.",
    "zielrepo-kontext": "Der Zielrepo-Kontext zeigt, worauf Patternpilot alle Vergleiche bezieht. Dadurch werden Kandidaten nicht isoliert bewertet, sondern immer gegen die echten Dateien, Strukturen und Faehigkeiten des Zielprojekts gelesen.",
    "target-repo-context": "Der Zielrepo-Kontext zeigt, worauf Patternpilot alle Vergleiche bezieht. Dadurch werden Kandidaten nicht isoliert bewertet, sondern immer gegen die echten Dateien, Strukturen und Faehigkeiten des Zielprojekts gelesen.",
    "staerkste risikosignale": "Hier stehen die staerksten Warnsignale aus dem aktuellen Vergleich. Der Block zeigt nicht einfach schlechte Repos, sondern die Stellen, an denen Unsicherheit, operative Risiken oder fehlende Tiefe vor einer Uebernahme geklaert werden sollten. Lies ihn als Pruefliste fuer manuelle Nacharbeit, bevor du eine Richtung festziehst.",
    "highest-risk-signals": "Hier stehen die staerksten Warnsignale aus dem aktuellen Vergleich. Der Block zeigt nicht einfach schlechte Repos, sondern die Stellen, an denen Unsicherheit, operative Risiken oder fehlende Tiefe vor einer Uebernahme geklaert werden sollten. Lies ihn als Pruefliste fuer manuelle Nacharbeit, bevor du eine Richtung festziehst.",
    "fehlendes intake fuer watchlist": "Dieses Feld markiert Watchlist-Repos, fuer die noch keine frische Intake-Basis vorliegt. Solche Luecken schwaechen spaetere Vergleiche und sollten vor groesseren Uebernahme- oder Promotionsentscheidungen geschlossen werden.",
    "fehlendes intake fuer auswahl": "Dieser Bereich markiert Repos aus deiner expliziten Auswahl, fuer die noch keine frische Intake-Grundlage vorliegt. Patternpilot kann sie damit schon sehen, aber noch nicht so belastbar bewerten wie vollstaendig eingelesene Kandidaten. Wenn hier Eintraege stehen, solltest du zuerst Intake nachziehen und erst danach ueber Promotion oder Uebernahme entscheiden.",
    "missing-watchlist-intake": "Dieser Bereich markiert Repos, fuer die im aktuellen Vergleich noch die frische Intake-Grundlage fehlt. Solange diese Basis offen ist, bleiben Bewertungen und Folgeentscheidungen vorsichtiger als bei vollstaendig eingelesenen Kandidaten. Lies die Liste deshalb als Hinweis, wo du vor dem naechsten belastbaren Vergleich erst Daten nachziehen solltest.",
    "repo-matrix": "Die Repo-Matrix ist die verdichtete Queransicht ueber alle verglichenen Kandidaten. Sie eignet sich besonders, wenn du mehrere Repos systematisch entlang derselben Kriterien gegeneinander abgleichen willst.",
    "laufzusammenfassung": "Die Laufzusammenfassung ist die kompakteste Lesart des gesamten Ad-hoc-Laufs. Sie verbindet Modus, Phasenstatus und Datenqualitaet, damit du den operativen Zustand vor dem Detailblick verstehst.",
    "run-summary": "Die Laufzusammenfassung ist die kompakteste Lesart des gesamten Ad-hoc-Laufs. Sie verbindet Modus, Phasenstatus und Datenqualitaet, damit du den operativen Zustand vor dem Detailblick verstehst.",
    "wirksame urls": "Hier stehen die Repository-URLs, die in diesem Lauf tatsaechlich ausgewertet wurden. Das ist deine wichtigste Kontrollstelle, wenn du nachvollziehen willst, worauf sich der Bericht konkret stuetzt.",
    "effective-urls": "Hier stehen die Repository-URLs, die in diesem Lauf tatsaechlich ausgewertet wurden. Das ist deine wichtigste Kontrollstelle, wenn du nachvollziehen willst, worauf sich der Bericht konkret stuetzt.",
    "artefakte": "Dieser Bereich verlinkt die wichtigsten Ausgaben des Laufs als konkrete Dateien. Er ist die Bruecke vom gelesenen Bericht zu den weiterverwendbaren Artefakten wie HTML, Metadaten, Browser-Zeiger oder Agent Hand-Off.",
    "artifacts": "Dieser Bereich verlinkt die wichtigsten Ausgaben des Laufs als konkrete Dateien. Er ist die Bruecke vom gelesenen Bericht zu den weiterverwendbaren Artefakten wie HTML, Metadaten, Browser-Zeiger oder Agent Hand-Off.",
    "bericht filtern": "Bericht filtern ist dein Arbeitswerkzeug fuer grosse oder dichte Reports. Statt den ganzen Bericht erneut zu scannen, kannst du hier gezielt nach Repos, Ebenen oder Passungsstufen eingrenzen und so schneller an die relevante Teilmenge springen. Dieser Block veraendert nichts am Ergebnis, sondern nur deinen Blick auf den Bericht.",
    "report-toolbar": "Bericht filtern ist dein Arbeitswerkzeug fuer grosse oder dichte Reports. Statt den ganzen Bericht erneut zu scannen, kannst du hier gezielt nach Repos, Ebenen oder Passungsstufen eingrenzen und so schneller an die relevante Teilmenge springen. Dieser Block veraendert nichts am Ergebnis, sondern nur deinen Blick auf den Bericht.",
    "laufplan": "Der Laufplan zeigt, welche Standardform Patternpilot fuer diesen Modus vorsieht. Damit wird deutlicher, wie Intake, Review, Drift, Stabilitaet und Folgeaktionen in einem gesunden Ablauf zusammenspielen sollen.",
    "run-plan": "Der Laufplan zeigt, welche Standardform Patternpilot fuer diesen Modus vorsieht. Damit wird deutlicher, wie Intake, Review, Drift, Stabilitaet und Folgeaktionen in einem gesunden Ablauf zusammenspielen sollen.",
    "laufdrift": "Laufdrift zeigt, ob sich dieser Lauf noch in der erwarteten Form bewegt oder ob operative Abweichungen zunehmen. Das ist wichtig, damit ein Bericht nicht stabiler oder eindeutiger wirkt, als er es in Wirklichkeit ist.",
    "run-drift": "Laufdrift zeigt, ob sich dieser Lauf noch in der erwarteten Form bewegt oder ob operative Abweichungen zunehmen. Das ist wichtig, damit ein Bericht nicht stabiler oder eindeutiger wirkt, als er es in Wirklichkeit ist.",
    "stabilitaet": "Dieser Block verdichtet, wie stabil vergleichbare juengere Laeufe zuletzt waren. Er hilft dir, Ergebnisse mit dem passenden Mass an Vertrauen oder Vorsicht weiterzuverarbeiten.",
    "run-stability": "Dieser Block verdichtet, wie stabil vergleichbare juengere Laeufe zuletzt waren. Er hilft dir, Ergebnisse mit dem passenden Mass an Vertrauen oder Vorsicht weiterzuverarbeiten.",
    "governance": "Governance zeigt, wie stark Regeln, manuelle Gates und Automatik im aktuellen Zustand eingreifen. Ein Agent oder Mensch sollte diesen Bereich beachten, bevor aus dem Bericht direkte Folgeaktionen abgeleitet werden.",
    "run-governance": "Governance zeigt, wie stark Regeln, manuelle Gates und Automatik im aktuellen Zustand eingreifen. Ein Agent oder Mensch sollte diesen Bereich beachten, bevor aus dem Bericht direkte Folgeaktionen abgeleitet werden.",
    "was jetzt": "Das ist der kompakteste Ausblick auf die direkt sinnvollen Folgeaktionen. Der Block uebersetzt den Bericht bewusst in einen klaren naechsten Schritt, statt ihn nur zusammenzufassen."
    ,"what-now": "Das ist der kompakteste Ausblick auf die direkt sinnvollen Folgeaktionen. Der Block uebersetzt den Bericht bewusst in einen klaren naechsten Schritt, statt ihn nur zusammenzufassen."
    ,"kandidatenuebersicht": "Diese Uebersicht zeigt die sichtbar gebliebenen Discovery-Kandidaten in ihrer Kartenform. Sie ist die schnellste Stelle, um zu sehen, welche Repos nach Suche, Regelwerk und Erstgewichtung wirklich uebrig bleiben.",
    "candidate-overview": "Diese Uebersicht zeigt die sichtbar gebliebenen Discovery-Kandidaten in ihrer Kartenform. Sie ist die schnellste Stelle, um zu sehen, welche Repos nach Suche, Regelwerk und Erstgewichtung wirklich uebrig bleiben.",
    "discovery-linsen": "Hier siehst du, aus welchen Suchlinsen oder Query-Familien dieser Lauf aufgebaut wurde. Der Bereich hilft vor allem dann, wenn du verstehen willst, warum bestimmte Repo-Arten ueberhaupt in die Kandidatenmenge geraten sind.",
    "discovery-lenses": "Hier siehst du, aus welchen Suchlinsen oder Query-Familien dieser Lauf aufgebaut wurde. Der Bereich hilft vor allem dann, wenn du verstehen willst, warum bestimmte Repo-Arten ueberhaupt in die Kandidatenmenge geraten sind.",
    "discovery-regelwerk": "Dieses Feld zeigt, wie stark das aktuelle Regelwerk in den Discovery-Lauf eingegriffen hat. Du erkennst hier, ob Kandidaten nur sichtbar geblieben, bewusst markiert oder vom Regelwerk schon aktiv in eine Richtung gedrueckt wurden.",
    "discovery-policy": "Dieses Feld zeigt, wie stark das aktuelle Regelwerk in den Discovery-Lauf eingegriffen hat. Du erkennst hier, ob Kandidaten nur sichtbar geblieben, bewusst markiert oder vom Regelwerk schon aktiv in eine Richtung gedrueckt wurden.",
    "regel-kalibrierung": "Die Regel-Kalibrierung zeigt, wo dein aktuelles Discovery-Regelwerk noch nachgeschaerft werden sollte. Sie ist besonders wertvoll, wenn du zwar Treffer bekommst, aber das Verhaeltnis zwischen Rauschen und wirklich brauchbaren Kandidaten noch nicht stimmt.",
    "policy-calibration": "Die Regel-Kalibrierung zeigt, wo dein aktuelles Discovery-Regelwerk noch nachgeschaerft werden sollte. Sie ist besonders wertvoll, wenn du zwar Treffer bekommst, aber das Verhaeltnis zwischen Rauschen und wirklich brauchbaren Kandidaten noch nicht stimmt.",
    "suchfehler": "Hier landen technische oder inhaltliche Fehler aus der Discovery-Suche selbst. Der Bereich ist wichtig, damit ein schwacher Lauf nicht faelschlich wie eine schlechte Kandidatenlage aussieht, obwohl in Wahrheit die Suche eingeschraenkt war.",
    "search-errors": "Hier landen technische oder inhaltliche Fehler aus der Discovery-Suche selbst. Der Bereich ist wichtig, damit ein schwacher Lauf nicht faelschlich wie eine schlechte Kandidatenlage aussieht, obwohl in Wahrheit die Suche eingeschraenkt war."
  };

  const normalizeInfoKey = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß/ -]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");

  const getInfoText = (label, sectionId = "") => {
    const sectionKey = normalizeInfoKey(sectionId);
    const labelKey = normalizeInfoKey(label);
    return infoMap[labelKey] || infoMap[sectionKey] || "Kurzinfo: Dieses Feld erklaert, wie Patternpilot diese Stelle im Bericht einordnet.";
  };

  const closeInfoPopovers = (exceptButton = null) => {
    document.querySelectorAll(".info-button[aria-expanded='true']").forEach((button) => {
      if (button === exceptButton) return;
      button.setAttribute("aria-expanded", "false");
    });
    const modal = document.getElementById("info-modal");
    if (modal) modal.dataset.open = "false";
  };

  const infoModal = document.createElement("div");
  infoModal.id = "info-modal";
  infoModal.className = "info-modal";
  infoModal.dataset.open = "false";
  infoModal.innerHTML = '<div class="info-modal-backdrop"></div><div class="info-modal-card" role="dialog" aria-modal="true" aria-labelledby="info-modal-title"><div class="info-modal-kicker">Kurz erklaert</div><h3 class="info-modal-title" id="info-modal-title"></h3><p class="info-modal-copy" id="info-modal-copy"></p><button type="button" class="info-modal-close" id="info-modal-close">Schliessen</button></div>';
  document.body.append(infoModal);

  const infoModalTitle = infoModal.querySelector("#info-modal-title");
  const infoModalCopy = infoModal.querySelector("#info-modal-copy");
  const infoModalClose = infoModal.querySelector("#info-modal-close");

  const openInfoModal = (label, button) => {
    closeInfoPopovers(button);
    infoModalTitle.textContent = label;
    infoModalCopy.textContent = getInfoText(label, button.dataset.infoSectionId || "");
    infoModal.dataset.open = "true";
    button.setAttribute("aria-expanded", "true");
  };

  const attachInfoButton = (element) => {
    if (!element || element.dataset.infoAttached === "true") return;
    const label = (element.textContent || "").trim();
    if (!label) return;

    const wrapper = document.createElement("span");
    wrapper.className = "heading-with-info";

    const text = document.createElement("span");
    text.className = "heading-text";
    text.textContent = label;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "info-button";
    button.textContent = "i";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Informationen zu " + label);
    button.dataset.infoSectionId = element.closest(".panel-card, .section-card")?.id || "";

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = button.getAttribute("aria-expanded") !== "true";
      if (!willOpen) {
        closeInfoPopovers();
        return;
      }
      openInfoModal(label, button);
    });

    element.textContent = "";
    wrapper.append(text, button);
    element.append(wrapper);
    element.dataset.infoAttached = "true";
  };

  document.querySelectorAll(".panel-card .section-head h2, .section-card .section-head h2").forEach(attachInfoButton);

  infoModal.querySelector(".info-modal-backdrop")?.addEventListener("click", () => closeInfoPopovers());
  infoModalClose?.addEventListener("click", () => closeInfoPopovers());

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".heading-with-info") && !event.target.closest(".info-modal-card")) {
      closeInfoPopovers();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeInfoPopovers();
    }
  });

  const readAgentPayload = () => {
    const script = document.getElementById("patternpilot-agent-payload");
    if (!script?.textContent) return null;
    try {
      return JSON.parse(script.textContent);
    } catch (error) {
      console.error("Patternpilot: Agent payload konnte nicht gelesen werden.", error);
      return null;
    }
  };

  const createAgentBlobUrl = () => {
    const payload = readAgentPayload();
    if (!payload) return null;
    return URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" }));
  };

  document.querySelectorAll(".agent-action-button").forEach((button) => {
    button.addEventListener("click", () => {
      const blobUrl = createAgentBlobUrl();
      if (!blobUrl) return;

      if (button.dataset.agentAction === "open") {
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }

      if (button.dataset.agentAction === "download") {
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = button.dataset.agentFilename || "patternpilot-agent-handoff.json";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
      }
    });
  });
})();
  </script>
  <script>
${INFO_DIALOG_SCRIPT}
  </script>
</body>
</html>`;
}
