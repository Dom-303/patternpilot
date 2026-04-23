// lib/landscape/html-report.mjs
//
// Problem-Landscape-HTML-Renderer. Setzt die Cockpit-Night-Sprache um
// (Hero, Sidenav, Content-Intro, Übersicht-Stats, Cluster-Sections,
// Achsen-View, Lauf-Info) — visuelle Parität zum Haupt-Report.

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
  INFO_DIALOG_SCRIPT
} from "../html/components.mjs";

const RELATION_BADGE_MAP = {
  near_current_approach: { tone: "adapt", label: "Naher Ansatz" },
  adjacent: { tone: "observe", label: "Benachbart" },
  divergent: { tone: "adopt", label: "Divergent" }
};

const RELATION_ACCENT_MAP = {
  divergent: "magenta",
  adjacent: "purple",
  near_current_approach: "orange"
};

function slugToId(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function renderLandscapeHtml({ problem, landscape, runId }) {
  const clusters = Array.isArray(landscape.clusters) ? landscape.clusters : [];
  const axisView = landscape.axis_view ?? null;
  const relationCounts = landscape.relation_counts ?? {};
  const totalMembers = clusters.reduce((sum, c) => sum + (c.member_ids?.length ?? 0), 0);
  const divergentCount = relationCounts.divergent ?? 0;

  const stats = [
    { label: "Kandidaten", value: totalMembers, primary: true },
    { label: "Cluster", value: clusters.length, primary: true },
    { label: "Divergent", value: divergentCount, primary: true },
    { label: "Lauf-ID", value: runId ?? "-", primary: false },
    { label: "Projekt", value: problem.project ?? "-", primary: false },
    { label: "Signal", value: landscape.landscape_signal ?? "-", primary: false }
  ];

  const navItems = [
    { href: "#problem", label: "Problem-Landkarte" },
    { href: "#uebersicht", label: "Übersicht" },
    ...clusters.map((c, i) => ({ href: `#cluster-${i + 1}`, label: c.label || `Cluster ${i + 1}` })),
    axisView ? { href: "#achsen", label: "Achsen-View" } : null,
    { href: "#lauf", label: "Lauf-Info" }
  ].filter(Boolean);

  const clusterSections = clusters.map((cluster, index) => {
    const clusterId = `cluster-${index + 1}`;
    const relBadge = RELATION_BADGE_MAP[cluster.relation] ?? { tone: "observe", label: cluster.relation ?? "unbekannt" };
    const accent = RELATION_ACCENT_MAP[cluster.relation] ?? "purple";
    const members = Array.isArray(cluster.member_ids) ? cluster.member_ids : [];
    const signatureMeta = Array.isArray(cluster.signature_contrast) && cluster.signature_contrast.length > 0
      ? cluster.signature_contrast.join(" · ")
      : "";
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
    return renderSectionCard({
      id: clusterId,
      title: cluster.label || `Cluster ${index + 1}`,
      sub,
      countChip: `${members.length} Repos`,
      accent,
      bodyHtml: rows
    });
  }).join("\n");

  const axisSection = axisView && Array.isArray(axisView.dimensions) && axisView.dimensions.length > 0
    ? renderSectionCard({
        id: "achsen",
        title: "Achsen-View",
        sub: `${axisView.dimensions.length} Dimensionen gematched`,
        countChip: `${axisView.dimensions.length} Achsen`,
        accent: "purple",
        bodyHtml: axisView.dimensions.map((dim) => renderAxisRow({
          label: dim.label ?? dim.name ?? "-",
          percent: dim.percent != null ? dim.percent : (dim.position != null ? Math.round(dim.position * 100) : 0),
          valueLabel: dim.value ?? dim.label ?? ""
        })).join("\n")
      })
    : "";

  const runInfoSection = renderSectionCard({
    id: "lauf",
    title: "Lauf-Info",
    sub: `${problem.project ?? "-"} · ${landscape.landscape_signal ?? "-"}`,
    countChip: "Meta",
    accent: "green",
    bodyHtml: renderMetaGrid([
      { key: "Lauf-ID", value: runId ?? "-" },
      { key: "Problem", value: problem.slug ?? "-" },
      { key: "Projekt", value: problem.project ?? "-" },
      { key: "Signal", value: landscape.landscape_signal ?? "-" },
      { key: "Cluster", value: clusters.length },
      { key: "Kandidaten", value: totalMembers }
    ])
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

@media print {
  body { background: #fff; color: #111; }
  body::before, .sidenav { display: none !important; }
  .shell { display: block; padding: 0; max-width: none; }
  .wrap { padding: 0 20px; }
  .section-preview { break-inside: avoid; box-shadow: none; border-color: #ccc; }
  .repo-row { break-inside: avoid; }
  a { color: #222; }
}
  </style>
</head>
<body>
  <div class="shell">
    ${renderSidenav({ logoSrc: LOGO_BASE64, eyebrow: "Inhalt", items: navItems })}
    <main class="wrap" id="top">
      ${renderCockpitHero({
        title: "Pattern",
        pilotWord: "Pilot",
        slogan: "Problem-Landkarte aus externen Loesungsansaetzen."
      })}
      ${renderSectionBreak()}
      ${renderContentIntro({
        eyebrow: "Problem-Landkarte",
        subject: problem.title ?? problem.slug ?? "-",
        subjectId: problem.slug ?? "",
        meta: [
          { label: `${totalMembers} Kandidaten` },
          { label: `${clusters.length} Cluster` },
          { label: `${divergentCount} divergent`, accent: true }
        ],
        infoPanel: { id: "problem", bodyHtml: "<p>Die <strong>Problem-Landkarte</strong> buendelt einen Lauf rund um eine konkrete Frage an das Zielprojekt. Aus dem Problem-Slug erzeugt Pattern Pilot Discovery-Queries, bewertet die Fundstuecke, gruppiert sie zu Clustern und liest das Ergebnis gegen den Projektkontext.</p>" }
      })}
      <section class="group" id="uebersicht" data-nav-section>
        <div class="group-head">
          <h3>Übersicht</h3>
        </div>
        ${renderStatGrid(stats.map((stat, index) => {
          const accents = ["magenta", "purple", "orange", "green", "cyan", "mixed"];
          return {
            key: stat.label,
            value: stat.value,
            variant: stat.primary === false ? "meta" : "primary",
            accent: accents[index % accents.length]
          };
        }))}
      </section>
      ${clusterSections}
      ${axisSection}
      ${runInfoSection}
    </main>
  </div>
  ${renderInfoDialog({})}
  <script>
${INFO_DIALOG_SCRIPT}
  </script>
</body>
</html>`;
}
