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
  renderStatCard,
  renderInfoDialog,
  INFO_DIALOG_SCRIPT,
  renderTabs
} from "../html/components.mjs";
import {
  renderTabbedSection,
  renderLandscapeEntscheidungenSection,
  renderWhatNowSection,
  renderAgentField,
  renderOnDemandRunDriftCards,
  renderOnDemandStabilityCards,
  renderOnDemandGovernanceCards
} from "../html/sections.mjs";
import { renderHtmlList } from "../html/shared.mjs";
import { renderInfoGrid } from "../html/components.mjs";
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

  // Uebersicht-Section als section-preview (wie im Haupt-Report).
  // User-Regel hier: 3-Spalten-Stats-Grid + volle Breite (Uebersicht
  // darf Ausnahme zur max-2-col-Regel sein, weil Kennzahlen sehr kompakt sind).
  const uebersichtSection = `<section class="section-preview accent-cyan" id="uebersicht" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Uebersicht</h2>
      <div class="sub">Grundzahlen auf einen Blick</div>
    </div>
    <div class="head-actions"><span class="count-chip">${stats.length} Kennzahlen</span></div>
  </div>
  ${renderInlineSectionDescription("uebersicht")}
  <div class="section-body section-body--padded">
    <div class="preview preview--three">${stats.map((s, i) => {
      const accents = ["magenta", "purple", "orange", "green", "cyan", "mixed"];
      return renderStatCard({
        key: s.label,
        value: s.value,
        variant: s.primary === false ? "meta" : "primary",
        accent: accents[i % accents.length]
      });
    }).join("")}</div>
  </div>
</section>`;

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
    const searchIndex = [
      cluster.label,
      cluster.pattern_family,
      cluster.main_layer,
      (cluster.signature_contrast ?? []).join(" "),
      members.join(" ")
    ].filter(Boolean).join(" ").toLowerCase();
    return `<section class="section-preview ${accentClass} landscape-cluster" id="${clusterId}" data-nav-section${emptyAttr}
  data-cluster-relation="${escapeHtml(cluster.relation ?? "")}"
  data-cluster-pattern="${escapeHtml(cluster.pattern_family ?? "")}"
  data-cluster-search="${escapeHtml(searchIndex)}">
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

  // Filter-Toolbar — voll funktional fuer Landscape. Ableitung der
  // verfuegbaren Relation- und Pattern-Family-Optionen direkt aus Clustern.
  const availablePatternFamilies = Array.from(new Set(clusters.map((c) => c.pattern_family).filter(Boolean))).sort();
  const filterToolbar = `<section class="section-preview accent-purple" id="landscape-filter" data-nav-section>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Bericht filtern</h2>
      <div class="sub">Suche, Relation, Musterfamilie</div>
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
    <div class="toolbar-grid">
      <label class="control">
        <span>Suche</span>
        <input id="landscape-search" type="search" placeholder="Repo, Cluster oder Musterfamilie">
      </label>
      <label class="control">
        <span>Relation</span>
        <select id="landscape-relation">
          <option value="">Alle</option>
          <option value="divergent">Divergent</option>
          <option value="adjacent">Benachbart</option>
          <option value="near_current_approach">Naher Ansatz</option>
        </select>
      </label>
      <label class="control">
        <span>Musterfamilie</span>
        <select id="landscape-pattern">
          <option value="">Alle</option>
          ${availablePatternFamilies.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join("")}
        </select>
      </label>
      <button class="ghost-button" id="landscape-reset" type="button">Filter zuruecksetzen</button>
    </div>
    <p class="toolbar-inline-help">Filter sind live: Cluster-Sections werden ausgeblendet, wenn Relation/Musterfamilie nicht passt oder der Suchbegriff nirgendwo matcht.</p>
    <div class="filter-indicator" id="landscape-filter-indicator"></div>
  </div>
</section>`;

  // Discovery-Linsen-Aequivalent fuer Problem-Mode: Query-Phrasen, die aus dem
  // Problem-Slug generiert wurden, plus Reasons fuer jede Query.
  const queryPlans = Array.isArray(landscape.queryPlans) ? landscape.queryPlans : [];
  const queryPlansEmpty = queryPlans.length === 0 ? ' data-section-empty="true"' : "";
  const queryPlansSection = `<section class="section-preview accent-purple" id="landscape-lenses" data-nav-section${queryPlansEmpty}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Problem-Linsen</h2>
      <div class="sub">Query-Phrasen aus dem Problem-Slug</div>
    </div>
    <div class="head-actions"><span class="count-chip">${queryPlans.length} Linsen</span></div>
  </div>
  ${renderInlineSectionDescription("landscape-lenses")}
  <div class="section-body">
    ${queryPlans.length > 0
      ? renderInfoGrid(queryPlans.map((q) => ({
          title: q.label ?? "Query",
          copy: q.query ?? "",
          items: Array.isArray(q.reasons) ? q.reasons : [],
          emptyText: "Keine Gruende erfasst."
        })))
      : `<p class="empty">Noch keine Problem-Linsen aufgebaut. Sie entstehen, sobald Pattern Pilot aus dem Problem-Slug Query-Varianten ableitet und gegen GitHub feuert.</p>`}
  </div>
</section>`;

  // KI Coding Agent Section — der essenzielle Block, damit ein Agent mit der
  // Landscape-Analyse wirklich handeln kann. Nutzt denselben renderAgentField
  // wie der Haupt-Report, wird mit Landscape-Kontext gefuettert.
  const agentView = landscape.agentView ?? null;
  const agentEmpty = !agentView ? ' data-section-empty="true"' : "";
  const agentSection = `<section class="section-preview accent-green" id="agent-view" data-nav-section${agentEmpty}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>KI Coding Agents</h2>
      <div class="sub">Maschinenlesbare Uebergabe fuer autonome Coder</div>
    </div>
    <div class="head-actions"><span class="count-chip">Hand-Off</span></div>
  </div>
  ${renderInlineSectionDescription("agent-view")}
  <div class="section-body">
    ${renderAgentField(agentView)}
  </div>
</section>`;

  // Lauf-Gesundheit-Section (Drift / Stabilitaet / Governance fuer Problem-Mode).
  const runHealth = landscape.runHealth ?? null;
  const runHealthEmpty = !runHealth ? ' data-section-empty="true"' : "";
  const runHealthSection = runHealth
    ? renderTabbedSection({
        id: "run-health",
        title: "Lauf-Gesundheit",
        sub: "Drift / Stabilitaet / Governance",
        accent: "purple",
        countChip: "3 Ansichten",
        tabs: [
          { label: "Drift", body: renderOnDemandRunDriftCards(runHealth.drift ?? {}) },
          { label: "Stabilitaet", body: renderOnDemandStabilityCards(runHealth.stability ?? {}) },
          { label: "Governance", body: renderOnDemandGovernanceCards(runHealth.governance ?? {}) }
        ]
      })
    : `<section class="section-preview accent-purple" id="run-health" data-nav-section${runHealthEmpty}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Lauf-Gesundheit</h2>
      <div class="sub">Drift / Stabilitaet / Governance</div>
    </div>
  </div>
  ${renderInlineSectionDescription("run-drift")}
  <p class="empty">Keine Gesundheits-Metriken fuer diesen Problem-Mode-Lauf verfuegbar. Erscheinen nach 2-3 problem:refresh-Laeufen.</p>
</section>`;

  // Technischer Lauf-Status-Section (Queries / Missing-Candidates / Errors).
  const techStatus = landscape.techStatus ?? {};
  const effectiveQueries = Array.isArray(techStatus.effectiveQueries) ? techStatus.effectiveQueries : [];
  const missingCandidates = Array.isArray(techStatus.missingCandidates) ? techStatus.missingCandidates : [];
  const searchErrors = Array.isArray(techStatus.searchErrors) ? techStatus.searchErrors : [];
  const techTotal = effectiveQueries.length + missingCandidates.length + searchErrors.length;
  const techStatusSection = techTotal > 0
    ? renderTabbedSection({
        id: "tech-status",
        title: "Technischer Lauf-Status",
        sub: "Queries / Kandidaten-Luecken / Suchfehler",
        accent: "green",
        countChip: `${effectiveQueries.length} Queries · ${missingCandidates.length} Luecken · ${searchErrors.length} Fehler`,
        tabs: [
          { label: "Wirksame Queries", body: renderHtmlList(effectiveQueries, "Keine Queries ausgefuehrt.") },
          { label: "Kandidaten-Luecken", body: renderHtmlList(missingCandidates, "Keine Kandidaten-Luecken festgestellt.") },
          { label: "Suchfehler", body: renderHtmlList(searchErrors, "Keine Suchfehler.") }
        ]
      })
    : `<section class="section-preview accent-green" id="tech-status" data-nav-section data-section-empty="true">
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>Technischer Lauf-Status</h2>
      <div class="sub">Queries / Luecken / Fehler</div>
    </div>
  </div>
  <p class="empty">Keine technischen Lauf-Status-Daten erfasst.</p>
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

  // Sidenav items (alle Hauptsections inkl. Cluster + neue Sections)
  const navItems = [
    { href: "#problem", label: "Problem-Landkarte" },
    { href: "#landscape-filter", label: "Bericht filtern" },
    { href: "#uebersicht", label: "Uebersicht" },
    { href: "#entscheidungen", label: "Entscheidungen" },
    { href: "#landscape-lenses", label: "Problem-Linsen" },
    ...clusters.map((c, i) => ({ href: `#cluster-${i + 1}`, label: c.label || `Cluster ${i + 1}` })),
    { href: "#achsen", label: "Achsen-View" },
    { href: "#run-health", label: "Lauf-Gesundheit" },
    { href: "#tech-status", label: "Lauf-Status" },
    { href: "#agent-view", label: "KI Coding Agents" },
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
      ${queryPlansSection}
      ${clusterSections}
      ${achsenSection}
      ${runHealthSection}
      ${techStatusSection}
      ${agentSection}
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
  <script>
(() => {
  // Landscape-Filter: Suche + Relation + Pattern-Family.
  // Filtert sowohl Cluster-Section-Sichtbarkeit als auch deren Sidenav-Items.
  const searchInput = document.getElementById("landscape-search");
  const relationSelect = document.getElementById("landscape-relation");
  const patternSelect = document.getElementById("landscape-pattern");
  const resetButton = document.getElementById("landscape-reset");
  const indicator = document.getElementById("landscape-filter-indicator");
  const clusterSections = Array.from(document.querySelectorAll("section.landscape-cluster"));

  const apply = () => {
    const search = (searchInput?.value || "").trim().toLowerCase();
    const relation = (relationSelect?.value || "").toLowerCase();
    const pattern = (patternSelect?.value || "").toLowerCase();
    let hidden = 0;
    clusterSections.forEach((section) => {
      const clusterRelation = (section.getAttribute("data-cluster-relation") || "").toLowerCase();
      const clusterPattern = (section.getAttribute("data-cluster-pattern") || "").toLowerCase();
      const clusterSearch = (section.getAttribute("data-cluster-search") || "").toLowerCase();
      const matches = (!search || clusterSearch.includes(search))
        && (!relation || clusterRelation === relation)
        && (!pattern || clusterPattern === pattern);
      section.classList.toggle("hidden-by-filter", !matches);
      if (!matches) hidden += 1;
      // Sidenav-Item mit demselben Ziel mitnehmen
      const id = section.id;
      if (id) {
        const navLink = document.querySelector('.sidenav-list a[href="#' + id + '"]');
        if (navLink) navLink.classList.toggle("hidden-by-filter", !matches);
      }
    });
    if (indicator) {
      if (hidden > 0) {
        indicator.classList.add("active");
        indicator.textContent = hidden + " Cluster durch Filter ausgeblendet";
      } else {
        indicator.classList.remove("active");
        indicator.textContent = "";
      }
    }
  };

  [searchInput, relationSelect, patternSelect].forEach((el) => {
    if (!el) return;
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (relationSelect) relationSelect.value = "";
      if (patternSelect) patternSelect.value = "";
      apply();
    });
  }
})();
  </script>
</body>
</html>`;
}
