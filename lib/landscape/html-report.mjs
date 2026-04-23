// lib/landscape/html-report.mjs
//
// Problem-Landscape-HTML-Renderer. Übernimmt die volle Cockpit-Night-Sprache
// aus dem Haupt-Report (Hero, Content-Intro, Section-Break, Section-Preview
// mit Marker/Count-Chip/Description-Collapse, Stat-Grid, Tabs, Info-Grid,
// Skip-Link, Empty-Toggle, Footer-CTA) — Landscape-kontextualisiert.

import { escapeHtml, LOGO_BASE64 } from "../html/shared.mjs";
import {
  COCKPIT_NIGHT_FONTS_HEAD,
  COCKPIT_NIGHT_BASE_CSS
} from "../html/tokens.mjs";
import {
  renderCockpitHero,
  renderSectionBreak,
  renderContentIntro,
  renderSidenav,
  renderSectionCard,
  renderRepoRow,
  renderAxisRow,
  renderMetaGrid,
  renderStatGrid,
  renderInfoDialog,
  INFO_DIALOG_SCRIPT,
  renderTabs
} from "../html/components.mjs";
import {
  renderTabbedSection,
  renderLandscapeEntscheidungenSection,
  renderWhatNowSection
} from "../html/sections.mjs";
import { getSectionInfo } from "../html/section-info.mjs";

const RELATION_ACCENT_MAP = {
  divergent: "magenta",
  adjacent: "purple",
  near_current_approach: "orange"
};

const RELATION_BADGE_MAP = {
  near_current_approach: { tone: "observe", label: "Naher Ansatz" },
  adjacent: { tone: "adapt", label: "Benachbart" },
  divergent: { tone: "adopt", label: "Divergent" }
};

function renderInlineSectionDescription(sectionId) {
  const info = getSectionInfo(sectionId);
  if (!info) return "";
  return `<details class="section-description">
  <summary><span class="section-description-label">Beschreibung</span></summary>
  <div class="section-description-body"><p>${escapeHtml(info.body)}</p></div>
</details>`;
}

export function renderLandscapeHtml({ problem, landscape, runId }) {
  const clusters = Array.isArray(landscape.clusters) ? landscape.clusters : [];
  const axisView = landscape.axis_view ?? null;
  const relationCounts = landscape.relation_counts ?? {};
  const totalMembers = clusters.reduce((sum, c) => sum + (c.member_ids?.length ?? 0), 0);
  const divergentCount = relationCounts.divergent ?? 0;
  const adjacentCount = relationCounts.adjacent ?? 0;
  const nearCount = relationCounts.near_current_approach ?? 0;

  const projectKey = problem.project ?? "-";

  // Stats fuer die Uebersicht-Section (6 Cards, 2x3 grid per user-rule)
  const stats = [
    { label: "Kandidaten", value: totalMembers, primary: true },
    { label: "Cluster", value: clusters.length, primary: true },
    { label: "Divergent", value: divergentCount, primary: true },
    { label: "Benachbart", value: adjacentCount, primary: false },
    { label: "Naher Ansatz", value: nearCount, primary: false },
    { label: "Lauf-Signal", value: landscape.landscape_signal ?? "-", primary: false }
  ];

  // Uebersicht-Section als section-preview (wie im Haupt-Report)
  const uebersichtSection = renderSectionCard({
    id: "uebersicht",
    title: "Uebersicht",
    sub: "Grundzahlen auf einen Blick",
    accent: "cyan",
    countChip: `${stats.length} Kennzahlen`,
    bodyHtml: `${renderInlineSectionDescription("uebersicht")}<div class="section-body section-body--padded"><div class="preview">${renderStatGrid(stats.map((s, i) => {
      const accents = ["magenta", "purple", "orange", "green", "cyan", "mixed"];
      return {
        key: s.label,
        value: s.value,
        variant: s.primary === false ? "meta" : "primary",
        accent: accents[i % accents.length]
      };
    }))}</div></div>`
  });

  // Entscheidungen-Section (neu) — 3-Tab-Helper fuer Landscape
  const entscheidungenSection = renderLandscapeEntscheidungenSection({
    clusters,
    landscapeSignal: landscape.landscape_signal
  });

  // Cluster-Sections: eine pro Cluster, wie bisher aber mit Description-Collapse
  const clusterSections = clusters.map((cluster, index) => {
    const clusterId = `cluster-${index + 1}`;
    const relBadge = RELATION_BADGE_MAP[cluster.relation] ?? { tone: "observe", label: cluster.relation ?? "unbekannt" };
    const accent = RELATION_ACCENT_MAP[cluster.relation] ?? "purple";
    const members = Array.isArray(cluster.member_ids) ? cluster.member_ids : [];
    const signatureMeta = Array.isArray(cluster.signature_contrast) && cluster.signature_contrast.length > 0
      ? cluster.signature_contrast.join(" · ")
      : "";
    const emptyAttr = members.length === 0 ? ' data-section-empty="true"' : "";
    const rows = members.length > 0
      ? members.map((memberId) => {
          const isRepoRef = typeof memberId === "string" && /^[^/\s]+\/[^/\s]+$/.test(memberId);
          const url = isRepoRef ? `https://github.com/${memberId}` : "";
          return renderRepoRow({
            name: memberId,
            href: url,
            meta: signatureMeta,
            decision: relBadge,
            score: null
          });
        }).join("\n")
      : `<p class="empty">Dieser Cluster enthaelt noch keine Mitglieder.</p>`;
    const sub = cluster.pattern_family
      ? `Musterfamilie · ${cluster.pattern_family}`
      : cluster.main_layer
        ? `Ebene · ${cluster.main_layer}`
        : "";
    const accentClass = `accent-${accent}`;
    return `<section class="section-preview ${accentClass}" id="${clusterId}" data-nav-section${emptyAttr}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>${escapeHtml(cluster.label || `Cluster ${index + 1}`)}</h2>
      ${sub ? `<div class="sub">${escapeHtml(sub)}</div>` : ""}
    </div>
    <div class="head-actions"><span class="count-chip">${members.length} Repos</span></div>
  </div>
  ${renderInlineSectionDescription("cluster")}
  <div class="section-body">
    ${rows}
  </div>
</section>`;
  }).join("\n");

  // Achsen-View mit Schema-Validierung + Description
  const validAxisDimensions = axisView && Array.isArray(axisView.dimensions)
    ? axisView.dimensions
        .filter((dim) => dim && (dim.label || dim.name))
        .map((dim) => {
          const rawPercent = dim.percent != null
            ? Number(dim.percent)
            : (dim.position != null ? Number(dim.position) * 100 : null);
          const percent = Number.isFinite(rawPercent)
            ? Math.max(0, Math.min(100, Math.round(rawPercent)))
            : 0;
          return {
            label: String(dim.label ?? dim.name ?? "-"),
            percent,
            valueLabel: String(dim.value ?? dim.label ?? "")
          };
        })
    : [];
  const achsenAccent = validAxisDimensions.length > 0 ? "purple" : "purple";
  const achsenEmpty = validAxisDimensions.length === 0 ? ' data-section-empty="true"' : "";
  const achsenSection = `<section class="section-preview accent-${achsenAccent}" id="achsen" data-nav-section${achsenEmpty}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Achsen-View</h2>
      <div class="sub">Position im Loesungsraum</div>
    </div>
    <div class="head-actions"><span class="count-chip">${validAxisDimensions.length} Achsen</span></div>
  </div>
  ${renderInlineSectionDescription("achsen")}
  <div class="section-body">
    ${validAxisDimensions.length > 0
      ? validAxisDimensions.map((dim) => renderAxisRow(dim)).join("\n")
      : `<p class="empty">Keine Achsen-Dimensionen verfuegbar. Die Achsen-View entsteht erst, wenn Pattern Pilot im Landscape-Lauf genug Dimensions-Signale aus den Clustern extrahieren kann.</p>`}
  </div>
</section>`;

  // Lauf-Info als section-preview mit Meta-Grid
  const laufSection = `<section class="section-preview accent-green" id="lauf" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Lauf-Info</h2>
      <div class="sub">${escapeHtml(projectKey)} · ${escapeHtml(landscape.landscape_signal ?? "-")}</div>
    </div>
    <div class="head-actions"><span class="count-chip">Meta</span></div>
  </div>
  ${renderInlineSectionDescription("lauf")}
  <div class="section-body">
    ${renderMetaGrid([
      { key: "Lauf-ID", value: runId ?? "-" },
      { key: "Problem", value: problem.slug ?? "-" },
      { key: "Projekt", value: projectKey },
      { key: "Signal", value: landscape.landscape_signal ?? "-" },
      { key: "Cluster", value: clusters.length },
      { key: "Kandidaten", value: totalMembers }
    ])}
  </div>
</section>`;

  // Filter-Toolbar (wie im Haupt-Report, aber ohne Filter-Selects — nur Empty-Toggle)
  const filterToolbar = `<section class="section-preview accent-purple" id="landscape-filter" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Bericht filtern</h2>
      <div class="sub">Nur fuer laengere Landscapes</div>
    </div>
    <div class="head-actions">
      <label class="toolbar-toggle toolbar-toggle--prominent" for="show-empty-sections-toggle">
        <input type="checkbox" id="show-empty-sections-toggle">
        <span class="toolbar-toggle-label">Auch leere Felder anzeigen</span>
      </label>
    </div>
  </div>
  ${renderInlineSectionDescription("landscape-filter")}
  <div class="toolbar-body">
    <p class="toolbar-inline-help">Toggle oben rechts zeigt auch leere Cluster + Sections mit Empty-States. Default ist nur gefuelltes Material.</p>
  </div>
</section>`;

  // Was jetzt? — Landscape-spezifische Action-Steps
  const whatNowSection = renderWhatNowSection({
    projectKey,
    compact: [
      "Cluster-Highlights lesen und divergente Ansaetze priorisiert einordnen",
      "Pro Cluster 1-2 Repos fuer vertieftes Pruefen markieren",
      "Ableitung ins Zielprojekt-Decision-Log starten"
    ],
    detailed: [
      {
        title: "1. Divergente Cluster zuerst verstehen",
        body: "Divergente Cluster bieten das hoechste Lern-Potenzial, aber den hoechsten Transfer-Aufwand. Lies pro divergentem Cluster die Top-Repos mit Deep-Content. Frage dich: Welche Kern-Annahme meines Projekts wird dadurch herausgefordert?"
      },
      {
        title: "2. Benachbarte Cluster als Adaptions-Kandidaten",
        body: "Benachbarte Cluster sind niedrige Transferhuerde. Hier lohnt sich eine konkrete Adaptions-Skizze pro Cluster: was ist ein- oder zweischnittig uebernehmbar, wo sind die Anpassungen noetig?"
      },
      {
        title: "3. Entscheidungen im Decision-Log verankern",
        body: "Am Ende sollten die wichtigsten Pro/Contra-Abwaegungen aus diesem Landscape ins Decision-Log des Zielprojekts fliessen. Das macht Lerngewinn durabel und verhindert, dass der gleiche Problem-Raum nochmal durchgekaut werden muss."
      }
    ],
    checklist: [
      { impact: "hoch", text: "Alle divergenten Cluster-Top-Repos einzeln oeffnen und einordnen" },
      { impact: "hoch", text: "Pro divergentem Cluster: konkrete Handlungs-Entscheidung im Decision-Log" },
      { impact: "mittel", text: "Bei benachbarten Clustern: 1-2 Adaptions-Spikes planen" },
      { impact: "mittel", text: "Achsen-View gegen interne Architektur-Thesen gegenchecken" },
      { impact: "niedrig", text: "Nahe-Ansatz-Cluster archivieren oder ignorieren wenn keine Neu-Sicht" }
    ],
    commands: [
      { cmd: `npm run patternpilot -- problem:refresh --problem ${problem.slug ?? "<slug>"}`, label: "Problem-Landscape frisch durchrechnen" },
      { cmd: `npm run patternpilot -- problem:explore --problem ${problem.slug ?? "<slug>"} --with-llm`, label: "Landscape mit LLM-Augmentation neu laufen" },
      { cmd: `npm run patternpilot -- problem:brief --problem ${problem.slug ?? "<slug>"}`, label: "Landscape-Brief fuer Decisions-Log exportieren" },
      { cmd: `npm run intake -- --project ${projectKey} <repo-url>`, label: "Einzelnes Cluster-Repo ins Intake ueberfuehren" }
    ]
  });

  // Sidenav items (alle Hauptsections inkl. Cluster)
  const navItems = [
    { href: "#problem", label: "Problem-Landkarte" },
    { href: "#landscape-filter", label: "Bericht filtern" },
    { href: "#uebersicht", label: "Uebersicht" },
    { href: "#entscheidungen", label: "Entscheidungen" },
    ...clusters.map((c, i) => ({ href: `#cluster-${i + 1}`, label: c.label || `Cluster ${i + 1}` })),
    { href: "#achsen", label: "Achsen-View" },
    { href: "#lauf", label: "Lauf-Info" },
    { href: "#what-now", label: "Was jetzt?" }
  ];

  // Content-Intro (wie bisher, aber ohne dark-info-btn — User-Feedback "uebertrieben")
  const contentIntro = renderContentIntro({
    eyebrow: "Problem-Landkarte",
    subject: problem.title ?? problem.slug ?? "-",
    subjectId: problem.slug ?? "",
    meta: [
      { label: `${totalMembers} Kandidaten` },
      { label: `${clusters.length} Cluster` },
      { label: `${divergentCount} divergent`, accent: true }
    ]
  });

  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Landscape — ${escapeHtml(problem.title ?? problem.slug ?? "Pattern Pilot")}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${COCKPIT_NIGHT_FONTS_HEAD}
  <style>
${COCKPIT_NIGHT_BASE_CSS}
  </style>
</head>
<body>
  <a class="skip-to-content" href="#top">Zum Inhalt springen</a>
  <div class="shell">
    ${renderSidenav({ logoSrc: LOGO_BASE64, eyebrow: "Inhalt", items: navItems })}
    <main class="wrap" id="top">
      ${renderCockpitHero({
        title: "Pattern",
        pilotWord: "Pilot",
        slogan: "Problem-Landkarte aus externen Loesungsansaetzen."
      })}
      ${renderSectionBreak()}
      ${contentIntro}
      ${filterToolbar}
      ${uebersichtSection}
      ${entscheidungenSection}
      ${clusterSections}
      ${achsenSection}
      ${laufSection}
      ${whatNowSection}
      <footer class="report-footer">
        <img src="${LOGO_BASE64}" alt="Patternpilot">
        <p>Erzeugt mit Patternpilot &mdash; Problem-Landscape</p>
        <nav class="footer-cta" aria-label="Naechste Schritte">
          <a class="footer-cta-link" href="#problem">
            <span class="footer-cta-label">Problem</span>
            <span class="footer-cta-hint">Zurueck nach oben</span>
          </a>
          <a class="footer-cta-link" href="#entscheidungen">
            <span class="footer-cta-label">Entscheidungen</span>
            <span class="footer-cta-hint">Was jetzt uebernehmen</span>
          </a>
          <a class="footer-cta-link" href="#achsen">
            <span class="footer-cta-label">Achsen</span>
            <span class="footer-cta-hint">Lage im Loesungsraum</span>
          </a>
          <a class="footer-cta-link" href="#what-now">
            <span class="footer-cta-label">Action-Steps</span>
            <span class="footer-cta-hint">Konkreter Fahrplan</span>
          </a>
        </nav>
        <p class="footer-next-run"><span class="footer-next-run-label">Naechster Lauf:</span> <code>npm run patternpilot -- problem:refresh --problem ${escapeHtml(problem.slug ?? "&lt;slug&gt;")}</code></p>
      </footer>
    </main>
  </div>
  ${renderInfoDialog({})}
  <script>
${INFO_DIALOG_SCRIPT}
  </script>
</body>
</html>`;
}
