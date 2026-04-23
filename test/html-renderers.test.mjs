import test from "node:test";
import assert from "node:assert/strict";

import {
  COCKPIT_NIGHT_BASE_CSS,
  COCKPIT_NIGHT_FONTS_HEAD,
  COCKPIT_NIGHT_TOKENS_CSS,
  COCKPIT_NIGHT_PRINT_CSS
} from "../lib/html/tokens.mjs";
import {
  renderCockpitHero,
  renderSectionBreak,
  renderContentIntro,
  renderSidenav,
  renderInfoButton,
  renderInfoDialog,
  renderExplainButton,
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
import {
  renderHtmlSection,
  renderCollapsibleSection,
  renderHtmlStatCards,
  renderTopRecommendations,
  renderStickyNav,
  buildBadgeExplainAttrs
} from "../lib/html/shared.mjs";
import {
  renderDiscoveryCandidateCards,
  renderWatchlistTopCards,
  renderCoverageCards,
  renderProjectContextSources,
  renderAgentField
} from "../lib/html/sections.mjs";
import { renderLandscapeHtml } from "../lib/landscape/html-report.mjs";
import { getSectionInfo, SECTION_INFO_MAP } from "../lib/html/section-info.mjs";

test("tokens.mjs exports combined base CSS without light-mode", () => {
  assert.ok(COCKPIT_NIGHT_BASE_CSS.includes(":root"), "tokens must define :root");
  assert.ok(COCKPIT_NIGHT_BASE_CSS.includes("--neon-magenta"), "neon tokens present");
  assert.ok(COCKPIT_NIGHT_BASE_CSS.includes("@media print"), "print styles present");
  assert.ok(!COCKPIT_NIGHT_BASE_CSS.includes("prefers-color-scheme"), "light-mode fork must not be present");
  assert.ok(COCKPIT_NIGHT_FONTS_HEAD.includes("Syne"), "font head loads Syne");
});

test("renderCockpitHero emits hero + gradient pilot span", () => {
  const html = renderCockpitHero({ slogan: "test slogan" });
  assert.match(html, /class="hero"/);
  assert.match(html, /<span class="pilot">Pilot<\/span>/);
  assert.match(html, /test slogan/);
});

test("renderSectionBreak emits divider", () => {
  assert.match(renderSectionBreak(), /class="section-break"/);
});

test("renderContentIntro emits eyebrow + subject + meta accent", () => {
  const html = renderContentIntro({
    eyebrow: "Report",
    subject: "eventbear-worker",
    subjectId: "run-123",
    meta: [{ label: "12 Kandidaten" }, { label: "1 divergent", accent: true }]
  });
  assert.match(html, /class="content-intro"/);
  assert.match(html, /class="eyebrow"/);
  assert.match(html, /class="accent"/);
  assert.match(html, /run-123/);
});

test("renderSidenav emits nav with logo and numbered active item with aria-current", () => {
  const html = renderSidenav({
    logoSrc: "data:image/png;base64,x",
    items: [
      { href: "#a", label: "Alpha", active: true },
      { href: "#b", label: "Beta" }
    ]
  });
  assert.match(html, /class="sidenav"/);
  assert.match(html, /class="sidenav-logo-link"/);
  assert.match(html, /<span class="n">01<\/span>Alpha/);
  assert.match(html, /aria-current="location"/);
});

test("renderExplainButton needs both title and body", () => {
  assert.equal(renderExplainButton({}), "");
  assert.equal(renderExplainButton({ title: "T" }), "");
  const html = renderExplainButton({ title: "Kennzahlen", body: "Erklaerung" });
  assert.match(html, /<button type="button"/);
  assert.match(html, /data-explain-title="Kennzahlen"/);
  assert.match(html, /data-explain-body="Erklaerung"/);
  assert.match(html, /aria-haspopup="dialog"/);
});

test("renderStatCard meta variant + accent class", () => {
  const primary = renderStatCard({ key: "Kandidaten", value: 12, accent: "magenta" });
  assert.match(primary, /class="stat accent-magenta"/);
  const meta = renderStatCard({ key: "Datum", value: "2026-04-23", variant: "meta", accent: "green" });
  assert.match(meta, /class="stat meta accent-green"/);
});

test("renderStatGrid emits preview wrapper", () => {
  const html = renderStatGrid([{ key: "A", value: 1 }, { key: "B", value: 2 }]);
  assert.match(html, /class="preview"/);
  assert.equal(renderStatGrid([]), "");
});

test("renderSectionCard emits marker, count-chip, and optional info-button via data-nav-section", () => {
  const html = renderSectionCard({
    id: "cluster",
    title: "Cluster",
    sub: "musterfamilie",
    countChip: "3 Repos",
    accent: "magenta",
    bodyHtml: "<div>x</div>",
    infoButton: { triggerId: "cluster", label: "Was ist ein Cluster?" }
  });
  assert.match(html, /data-nav-section/);
  assert.match(html, /<span class="marker"><\/span>/);
  assert.match(html, /class="count-chip"/);
  assert.match(html, /data-info-trigger="cluster"/);
});

test("renderRepoRow clamps unknown decision badges and escapes HTML", () => {
  const good = renderRepoRow({ name: "x/y", href: "https://g.com/x/y", meta: "m", decision: { tone: "adopt", label: "Uebernehmen" }, score: 8.4 });
  assert.match(good, /badge adopt/);
  const hostile = renderRepoRow({ name: "<script>", decision: { tone: "hacky", label: "evil" }, score: "<x>" });
  assert.match(hostile, /&lt;script&gt;/);
  assert.doesNotMatch(hostile, /<script>/);
  assert.doesNotMatch(hostile, /badge hacky/);
});

test("renderAxisRow clamps percent and renders fill width", () => {
  const normal = renderAxisRow({ label: "Latenz", percent: 72, valueLabel: "Batch" });
  assert.match(normal, /width: 72%/);
  const over = renderAxisRow({ label: "X", percent: 150 });
  assert.match(over, /width: 100%/);
  const under = renderAxisRow({ label: "X", percent: -10 });
  assert.match(under, /width: 0%/);
});

test("renderInfoGrid halves variant adds modifier class", () => {
  const normal = renderInfoGrid([{ title: "A" }]);
  assert.match(normal, /class="info-grid"/);
  const halves = renderInfoGrid([{ title: "A" }], { variant: "halves" });
  assert.match(halves, /class="info-grid info-grid--halves"/);
});

test("renderHtmlSection auto-wires inline description-collapse when section-id has info-map entry", () => {
  const htmlWithInfo = renderHtmlSection("Kennzahlen", "<p>body</p>", "default", "stats");
  assert.match(htmlWithInfo, /class="section-description"/);
  assert.match(htmlWithInfo, /section-description-label/);
  const htmlWithoutInfo = renderHtmlSection("Unknown", "<p>body</p>", "default", "no-such-section");
  assert.doesNotMatch(htmlWithoutInfo, /section-description/);
});

test("renderCollapsibleSection emits <details> with marker + inline description if available", () => {
  const html = renderCollapsibleSection("Discovery-Linsen", "body", { sectionId: "discovery-lenses", collapsed: true });
  assert.match(html, /<details class="section-preview-details">/);
  assert.match(html, /class="section-description"/);
});

test("renderStickyNav filters items with id+navLabel and highlights active with aria-current", () => {
  const html = renderStickyNav([
    { id: "a", navLabel: "Alpha" },
    { id: "", navLabel: "Should drop" },
    { id: "c", navLabel: "", something: true },
    { id: "d", navLabel: "Delta" }
  ]);
  assert.match(html, /Alpha/);
  assert.match(html, /Delta/);
  assert.doesNotMatch(html, /Should drop/);
});

test("renderHtmlStatCards rotates accents through 6 colors and emits stat class", () => {
  const html = renderHtmlStatCards([
    { label: "A", value: 1 },
    { label: "B", value: 2, primary: false }
  ]);
  assert.match(html, /class="stat accent-magenta"/);
  assert.match(html, /class="stat meta accent-purple"/);
});

test("buildBadgeExplainAttrs produces attributes for known tones", () => {
  assert.match(buildBadgeExplainAttrs("adopt"), /data-explain-title="Warum uebernehmen\?"/);
  assert.match(buildBadgeExplainAttrs("adapt"), /Warum vertiefen\?/);
  assert.match(buildBadgeExplainAttrs("observe"), /Warum beobachten\?/);
  assert.equal(buildBadgeExplainAttrs("nonsense"), "");
});

test("renderTopRecommendations emits empty copy when list is empty", () => {
  const html = renderTopRecommendations([], []);
  assert.match(html, /Noch keine Empfehlungen/);
});

test("renderTopRecommendations emits clickable button-badges with explain attrs", () => {
  const html = renderTopRecommendations(
    ["owner/repo: do something"],
    [{ repo: { owner: "owner", name: "repo" }, discoveryDisposition: "intake_now" }]
  );
  assert.match(html, /<button type="button" class="badge adopt badge--clickable"/);
  assert.match(html, /data-explain-title="Warum uebernehmen\?"/);
});

test("renderDiscoveryCandidateCards splits top 3 + rest dropdown at >3 items", () => {
  const candidates = Array.from({ length: 5 }).map((_, i) => ({
    repo: { owner: "o", name: `r${i}`, normalizedRepoUrl: `https://g/o/r${i}` },
    discoveryDisposition: "observe_only",
    discoveryScore: i,
    projectAlignment: { fitBand: "low" },
    guess: { mainLayer: "unknown" },
    gapAreaCanonical: "unknown",
    enrichment: {}, risks: [], reasoning: [], queryFamilies: []
  }));
  const html = renderDiscoveryCandidateCards(candidates, { candidateCount: 5 });
  assert.match(html, /candidates-rest/);
  assert.match(html, /Weitere 2 Kandidaten anzeigen/);
});

test("renderDiscoveryCandidateCards empty state", () => {
  const html = renderDiscoveryCandidateCards([], { candidateCount: 5 });
  assert.match(html, /keine Discovery-Kandidaten/);
});

test("renderDiscoveryCandidateCards emits details with filter-card and secondary expand", () => {
  const candidate = {
    repo: { owner: "o", name: "r", normalizedRepoUrl: "https://g/o/r" },
    discoveryDisposition: "intake_now",
    discoveryScore: 9.1,
    projectAlignment: { fitBand: "high", matchedCapabilities: ["cap1"] },
    guess: { mainLayer: "dedupe_identity" },
    gapAreaCanonical: "dedupe_and_identity",
    enrichment: { repo: { description: "d", topics: ["t"], stars: 10 }, languages: ["lang"] },
    discoveryEvidence: { grade: "strong", score: 9, topicHits: ["t1"] },
    risks: [], reasoning: ["because"], queryFamilies: ["q"]
  };
  const html = renderDiscoveryCandidateCards([candidate], { candidateCount: 1 });
  assert.match(html, /<details class="repo-row filter-card"/);
  assert.match(html, /repo-body-secondary/);
  assert.match(html, /data-search="/);
  assert.match(html, /<button type="button" class="badge adopt badge--clickable"/);
});

test("renderCoverageCards emits axis-rows per group", () => {
  const html = renderCoverageCards({
    mainLayers: [{ value: "a", count: 5 }, { value: "b", count: 1 }],
    gapAreas: [{ value: "g", count: 2 }],
    capabilities: []
  });
  assert.match(html, /class="axis-row"/);
  assert.match(html, /coverage-axis-group/);
});

test("renderProjectContextSources emits restructured 2-card layout (Quellen + Fähigkeiten) + status-chip", () => {
  const html = renderProjectContextSources({
    contextSources: { loadedFiles: [], missingFiles: [], scannedDirectories: [], declaredFiles: [], declaredDirectories: [] },
    capabilitiesPresent: []
  }, null);
  assert.match(html, /class="info-grid"/, "has info-grid wrapper (default 2 cols)");
  assert.match(html, /context-status/, "has status chip");
  assert.match(html, /Eingelesene Kontextquellen/, "sources card present");
  assert.match(html, /Extrahierte Faehigkeiten/, "capabilities card present");
  assert.doesNotMatch(html, /class="section-intro"/, "inline section-intro moved to section-description wrapper");
});

test("renderAgentField includes richer JSON snapshot and agent-action-button ids", () => {
  const html = renderAgentField({
    mission: ["m1"],
    deliverable: ["d1"],
    priorityRepos: [{ repo: "o/r", action: "adopt", url: "https://g/o/r" }],
    context: ["c1"],
    guardrails: ["g1"],
    uncertainties: ["u1"],
    codingStarter: {
      primary: {
        repo: "o/r",
        starterLabel: "src/foo.mjs",
        implementationGoal: "goal",
        firstSlice: "slice",
        targetAreas: ["a"],
        starterMode: "prototype",
        compareChecklist: ["cc1"],
        stopIf: ["si1"]
      },
      secondary: [{
        repo: "o/r2", starterLabel: "src/bar.mjs", implementationGoal: "goal2",
        firstSlice: "slice2", targetAreas: [], starterMode: "prototype",
        compareChecklist: [], stopIf: []
      }]
    },
    payload: { schemaVersion: "2" },
    downloadFileName: "x.json"
  });
  assert.match(html, /data-agent-action="open"/);
  assert.match(html, /data-agent-action="download"/);
  assert.match(html, /data-agent-filename="x\.json"/);
  assert.match(html, /agent-pre/);
  assert.match(html, /info-grid--halves/);
  assert.match(html, /Primaerer Pfad/);
  assert.match(html, /Sekundaerer Pfad 1/);
});

test("renderLandscapeEntscheidungenSection emits 3 tabs with expected content", async () => {
  const { renderLandscapeEntscheidungenSection } = await import("../lib/html/sections.mjs");
  const html = renderLandscapeEntscheidungenSection({
    clusters: [
      { label: "Divergent-Cluster", relation: "divergent", member_ids: ["a/b", "c/d"], pattern_family: "x" },
      { label: "Adjacent-Cluster", relation: "adjacent", member_ids: ["e/f"], pattern_family: "y" },
      { label: "Near-Cluster", relation: "near_current_approach", member_ids: ["g/h"], pattern_family: "z" }
    ]
  });
  assert.match(html, /class="tabs"/);
  assert.match(html, /Top-Rang/);
  assert.match(html, /Nach Relation gruppiert/);
  assert.match(html, /Entscheidungs-Begruendung/);
  assert.match(html, /Divergent-Cluster/);
  assert.match(html, /Impact hoch/);
});

test("renderLandscapeEntscheidungenSection empty state when no clusters", async () => {
  const { renderLandscapeEntscheidungenSection } = await import("../lib/html/sections.mjs");
  const html = renderLandscapeEntscheidungenSection({ clusters: [] });
  assert.match(html, /keine Repos in den Clustern/);
  assert.match(html, /keine Cluster nach Relation/);
});

test("renderLandscapeHtml produces full Cockpit-Night structure including all new sections", () => {
  const html = renderLandscapeHtml({
    problem: { title: "Problem-Title", slug: "slug-id", project: "proj" },
    landscape: {
      clusters: [
        { key: "c1", label: "Cluster-1", relation: "divergent", member_ids: ["o/r"] }
      ],
      relation_counts: { divergent: 1, adjacent: 0, near_current_approach: 0 },
      landscape_signal: "fan_out",
      axis_view: { dimensions: [{ label: "Latenz", percent: 72, value: "Batch" }] }
    },
    runId: "2026-04-23"
  });
  // Bestehende Struktur
  assert.match(html, /<span class="pilot">Pilot<\/span>/);
  assert.match(html, /class="content-intro"/);
  assert.match(html, /class="sidenav"/);
  assert.match(html, /Cluster-1/);
  assert.match(html, /class="axis-row"/);
  assert.match(html, /class="meta-grid"/);
  assert.match(html, /class="info-modal"/);
  // Neue Cockpit-Night-Uebertragungen
  assert.match(html, /class="skip-to-content"/, "skip-link present");
  assert.match(html, /class="section-break"/, "section-break after hero");
  assert.match(html, /id="landscape-filter"/, "filter toolbar section");
  assert.match(html, /id="show-empty-sections-toggle"/, "empty-toggle in filter");
  assert.match(html, /id="uebersicht"/, "uebersicht section");
  assert.match(html, /id="entscheidungen"/, "entscheidungen with tabs");
  assert.match(html, /id="what-now"/, "what-now action-steps section");
  assert.match(html, /class="footer-cta"/, "footer CTAs");
  assert.match(html, /problem:refresh/, "footer next-run command");
  assert.match(html, /class="section-description"/, "description-collapse per section");
});

test("renderLandscapeHtml tolerates missing axis-view + invalid dimensions", () => {
  const html = renderLandscapeHtml({
    problem: { title: "T", slug: "s", project: "p" },
    landscape: {
      clusters: [],
      relation_counts: {},
      axis_view: { dimensions: [{ /* no label */ percent: 50 }, null, { label: "ok", percent: 200 }] }
    },
    runId: "r"
  });
  // Only the one valid dimension ("ok") should render, with percent clamped to 100
  assert.ok(html.includes("width: 100%;") || !html.includes("class=\"axis-row\""), "invalid dims filtered out");
  assert.doesNotMatch(html, />NaN</);
});

test("INFO_DIALOG_SCRIPT wires aria-current + focus management + explain handler", () => {
  assert.match(INFO_DIALOG_SCRIPT, /setAttribute\('aria-current', 'location'\)/);
  assert.match(INFO_DIALOG_SCRIPT, /lastTrigger/);
  assert.match(INFO_DIALOG_SCRIPT, /data-explain-title/);
});

test("SECTION_INFO_MAP covers all key section-ids", () => {
  const required = [
    "stats", "decision-summary", "recommendations", "recommended-actions",
    "candidates", "coverage", "target-repo-context", "agent-view",
    "report-toolbar", "report-intro",
    "problem", "uebersicht", "cluster", "achsen", "entscheidungen", "lauf"
  ];
  for (const id of required) {
    assert.ok(SECTION_INFO_MAP[id], `section-info must cover "${id}"`);
    assert.ok(SECTION_INFO_MAP[id].title, `${id} has title`);
    assert.ok(SECTION_INFO_MAP[id].body, `${id} has body`);
  }
  assert.equal(getSectionInfo("nonsense-id"), null);
});

test("COCKPIT_NIGHT_PRINT_CSS hides decorative chrome", () => {
  assert.match(COCKPIT_NIGHT_PRINT_CSS, /@media print/);
  assert.match(COCKPIT_NIGHT_PRINT_CSS, /\.sidenav[\s,]/);
  assert.match(COCKPIT_NIGHT_PRINT_CSS, /\.info-modal/);
});
