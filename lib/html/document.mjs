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
  modeOptions = [],
  layerOptions = []
}) {
  const primaryStats = stats.filter((s) => s.primary !== false);
  const secondaryStats = stats.filter((s) => s.primary === false);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
/* === Tokens === */
:root {
  --bg: #050509;
  --surface: rgba(14, 14, 28, 0.6);
  --surface-solid: #0e0e1c;
  --surface-border: rgba(255, 255, 255, 0.06);
  --ink: #b8b8d0;
  --ink-bright: #eeeef8;
  --ink-muted: #5c5f82;
  --ink-faint: #2a2c48;
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
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 56px 140px;
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
  display: inline-block;
  padding: 28px 40px;
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  text-align: center;
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
}
.hero-project-meta {
  font-size: 12px;
  color: var(--ink-muted);
}

/* === PDF Export Button === */
.pdf-export-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-top: 24px;
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
.stats-strip { padding: 0 0 56px; }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
}
.stats-grid-secondary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 14px;
  margin-top: 16px;
}
.stat-card {
  padding: 32px 36px;
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  transition: border-color 0.3s, transform 0.3s, box-shadow 0.3s;
}
.stat-card:nth-child(5n+1) { border-top: 3px solid var(--cyan); }
.stat-card:nth-child(5n+2) { border-top: 3px solid var(--magenta); }
.stat-card:nth-child(5n+3) { border-top: 3px solid var(--orange); }
.stat-card:nth-child(5n+4) { border-top: 3px solid var(--green); }
.stat-card:nth-child(5n+5) { border-top: 3px solid var(--blue); }
.stat-card:hover {
  border-color: rgba(255,255,255,0.12);
  transform: translateY(-4px);
  box-shadow: 0 8px 40px rgba(0,0,0,0.3);
}
.stat-label {
  display: block;
  color: var(--ink-muted);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  font-weight: 700;
  margin-bottom: 14px;
}
.stat-value {
  font-family: 'Syne', sans-serif;
  font-size: 38px;
  font-weight: 800;
  line-height: 1;
}
.stat-card:nth-child(5n+1) .stat-value { color: var(--cyan); text-shadow: 0 0 20px rgba(0,229,255,0.3); }
.stat-card:nth-child(5n+2) .stat-value { color: var(--magenta); text-shadow: 0 0 20px rgba(224,64,251,0.3); }
.stat-card:nth-child(5n+3) .stat-value { color: var(--orange); text-shadow: 0 0 20px rgba(255,145,0,0.3); }
.stat-card:nth-child(5n+4) .stat-value { color: var(--green); text-shadow: 0 0 20px rgba(0,230,118,0.3); }
.stat-card:nth-child(5n+5) .stat-value { color: var(--blue); text-shadow: 0 0 20px rgba(41,121,255,0.3); }

/* === Top Recommendations === */
.recommendations { margin-bottom: 48px; }
.rec-card {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px 28px;
  border-radius: 16px;
  border: 1px solid var(--surface-border);
  background: var(--surface);
  cursor: pointer;
  transition: all 0.3s;
  text-decoration: none;
  color: inherit;
  margin-bottom: 12px;
}
.rec-card:hover {
  transform: translateX(6px);
  border-color: var(--accent-border);
  background: var(--accent-soft);
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
  padding: 28px 32px;
  border-color: rgba(0,229,255,0.15);
  background: rgba(0,229,255,0.03);
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rec-arrow {
  color: var(--ink-faint);
  font-size: 18px;
  transition: transform 0.3s;
  flex-shrink: 0;
}

/* === Sections === */
.sections { display: grid; gap: 36px; }
.section-card {
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 56px 60px;
  scroll-margin-top: 72px;
  border-left: 4px solid transparent;
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
  align-items: center;
  justify-content: space-between;
}
.section-head h2 {
  font-family: 'Syne', sans-serif;
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #fff;
}
.section-body { margin-top: 32px; }

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
  line-height: 1.85;
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
  background: var(--surface);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius-lg);
  padding: 36px 44px;
}
.toolbar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 20px;
  align-items: end;
}
.control { display: grid; gap: 10px; }
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
  padding: 14px 20px;
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
  padding: 14px 28px;
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
  grid-template-columns: repeat(auto-fit, minmax(380px, 1fr));
  gap: 24px;
}
.coverage-card, .repo-card {
  background: rgba(255,255,255,0.02);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--surface-border);
  border-radius: var(--radius);
  padding: 36px 40px;
  transition: border-color 0.3s, box-shadow 0.3s, transform 0.3s;
}
.repo-card { border-top: 3px solid transparent; }
.repo-grid .repo-card:nth-child(5n+1) { border-top-color: var(--cyan); }
.repo-grid .repo-card:nth-child(5n+2) { border-top-color: var(--magenta); }
.repo-grid .repo-card:nth-child(5n+3) { border-top-color: var(--orange); }
.repo-grid .repo-card:nth-child(5n+4) { border-top-color: var(--green); }
.repo-grid .repo-card:nth-child(5n+5) { border-top-color: var(--blue); }

.repo-grid .repo-card:nth-child(5n+1):hover { border-color: rgba(0,229,255,0.35); box-shadow: 0 12px 56px rgba(0,229,255,0.12), inset 0 1px 0 rgba(0,229,255,0.15); transform: translateY(-6px); }
.repo-grid .repo-card:nth-child(5n+2):hover { border-color: rgba(224,64,251,0.35); box-shadow: 0 12px 56px rgba(224,64,251,0.12), inset 0 1px 0 rgba(224,64,251,0.15); transform: translateY(-6px); }
.repo-grid .repo-card:nth-child(5n+3):hover { border-color: rgba(255,145,0,0.35); box-shadow: 0 12px 56px rgba(255,145,0,0.12), inset 0 1px 0 rgba(255,145,0,0.15); transform: translateY(-6px); }
.repo-grid .repo-card:nth-child(5n+4):hover { border-color: rgba(0,230,118,0.35); box-shadow: 0 12px 56px rgba(0,230,118,0.12), inset 0 1px 0 rgba(0,230,118,0.15); transform: translateY(-6px); }
.repo-grid .repo-card:nth-child(5n+5):hover { border-color: rgba(41,121,255,0.35); box-shadow: 0 12px 56px rgba(41,121,255,0.12), inset 0 1px 0 rgba(41,121,255,0.15); transform: translateY(-6px); }

.coverage-card h3, .repo-card h3 {
  font-family: 'Syne', sans-serif;
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--ink-bright);
}
.coverage-card:hover {
  border-color: rgba(224,64,251,0.25);
  box-shadow: 0 12px 56px rgba(224,64,251,0.08);
  transform: translateY(-3px);
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
.repo-copy { color: var(--ink-muted); font-size: 15px; line-height: 1.6; margin: 14px 0 0; }
.mini-grid { margin: 28px 0 0; display: grid; gap: 20px; }
.mini-grid dt { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--ink-muted); font-weight: 700; margin-bottom: 6px; }
.mini-grid dd { margin: 0; line-height: 1.6; color: var(--ink); font-size: 15px; }

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
.summary-grid { display: grid; gap: 20px; }
.summary-item { display: flex; flex-direction: column; gap: 4px; }
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
.summary-item.recommended-move {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--surface-border);
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
  font-size: 16px;
  color: var(--ink-bright);
  line-height: 1.5;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.summary-item.recommended-move .summary-value { font-weight: 600; }
.summary-heuristic-label { font-weight: 400; color: var(--ink-muted); }
.summary-hint { color: var(--ink-muted); font-size: 13px; margin-left: 8px; }

/* === Recommended Actions === */
.actions-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 28px;
}
.action-group {
  min-width: 0;
  --group-color: var(--ink-muted);
}
.action-group h3 {
  color: var(--group-color);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  margin-bottom: 12px;
  font-weight: 700;
}
.action-item {
  display: block;
  padding: 8px 0;
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
.action-item__reason { color: var(--ink-muted); margin-left: 8px; }
.action-item:hover { color: var(--cyan) !important; }
.action-item:hover .action-item__name { color: var(--cyan) !important; }

/* === Stats Primary/Secondary === */
.stat-card.secondary .stat-value {
  font-size: 28px;
  color: var(--ink-bright) !important;
  text-shadow: none !important;
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
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 14px; }
  .stats-grid-secondary { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .stat-card { padding: 24px; }
  .stat-value { font-size: 28px; }
  .section-card { padding: 36px 28px; border-radius: var(--radius); }
  .section-head h2 { font-size: 22px; }
  .coverage-card, .repo-card { padding: 28px; }
  .coverage-grid, .repo-grid { grid-template-columns: 1fr; }
  .repo-head { flex-direction: column; }
  .repo-badges { justify-content: flex-start; }
  .toolbar-card { padding: 28px 24px; }
  .sticky-nav { padding: 0 16px; }
  .rec-card { padding: 16px 20px; gap: 14px; }
  .rec-card:nth-child(1) { padding: 20px 24px; }
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
</head>
<body>
  <svg class="grain" aria-hidden="true" style="position:fixed;inset:0;width:100%;height:100%;opacity:0.022;pointer-events:none;z-index:9999;mix-blend-mode:overlay"><filter id="g"><feTurbulence baseFrequency="0.55" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>
  <div class="scroll-progress" id="scroll-progress"></div>
  ${renderStickyNav(sections)}

  <main class="page">
    ${renderHeroSection({ reportType, projectKey, createdAt, subtitle: heroSubtitle, candidateCount })}

    <section class="stats-strip" id="stats">
      <div class="stats-grid">
        ${renderHtmlStatCards(primaryStats)}
      </div>
      ${secondaryStats.length ? `<div class="stats-grid-secondary">${renderHtmlStatCards(secondaryStats)}</div>` : ""}
    </section>

    ${renderDecisionSummary({ candidates, reportType, runRoot })}

    <section id="recommendations" aria-label="Top Recommendations">
      ${renderTopRecommendations(recommendations, candidates)}
    </section>

    ${renderRecommendedActions({ candidates, reportType, runRoot })}

    ${renderReportToolbar({ modeOptions, layerOptions })}

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
      <p>Generated by Patternpilot &mdash; Repo Intelligence System</p>
    </footer>
  </main>
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
        indicator.textContent = "Showing " + visibleCount + " of " + totalCount + " candidate cards";
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

  /* ---- Hero logo glow pulse after entrance ---- */
  const heroLogo = document.querySelector(".hero-logo");
  if (heroLogo) {
    heroLogo.addEventListener("animationend", () => {
      heroLogo.classList.add("animated");
    }, { once: true });
  }
})();
  </script>
</body>
</html>`;
}
