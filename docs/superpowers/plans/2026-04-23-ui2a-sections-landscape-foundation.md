# UI-2a-sections: Landscape als Fundament — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Den Haupt-Report (Discovery / Watchlist-Review) inhaltlich auf die Sektions-Sprache des Cockpit-Night-Landscape-Mockups umstellen: Content-Intro nach Hero, Section-Preview-Wrapper mit Marker-Dot + Count-Chip + Info-Button, Repo-Rows als Haupt-Content-Muster, Axis-Rows für Coverage. Beide Oberflaechen (Main-Report jetzt, Landscape spaeter UI-2b) sollen stilistisch quasi identisch sein.

**Architecture:** `html-renderer.mjs` bleibt strukturell unberuehrt — baut weiter `sections[]` und gibt's an `renderHtmlDocument`. Die inneren Markup-Generatoren in `sections.mjs` und `shared.mjs` emittieren ab jetzt Cockpit-Night-Primitives aus `components.mjs`/`tokens.mjs`. Legacy-CSS-Block in `document.mjs` bleibt als Fallback fuer noch nicht migrierte Funktionen (renderAgentField, renderOnDemand*, renderProjectContextSources, renderReviewScopeCards, renderArtifactCard, renderRepoMatrix) — die werden in einem Folge-Pass entsorgt, sind aber hinter `<section class="section-preview">`-Wrappern und damit visuell erträglich. Filter-Funktionalität bleibt funktional: Repo-Rows bekommen `class="repo-row filter-card"` plus `data-search/-fit/-mode/-layer`-Attribute.

**Tech Stack:** ES Modules, Template-Strings, Cockpit-Night-Tokens + Komponenten aus UI-1.

---

## File Structure

- **Modify:** `lib/html/shared.mjs` — `renderHtmlSection`, `renderCollapsibleSection`, `renderHtmlStatCards`, `renderTopRecommendations` rewrites. Legacy-Helpers (renderDataStateWarnBanner etc.) unveraendert.
- **Modify:** `lib/html/sections.mjs` — `renderDiscoveryCandidateCards`, `renderWatchlistTopCards`, `renderCoverageCards` rewrites. Rest unveraendert.
- **Modify:** `lib/html/document.mjs` — Content-Intro nach Hero einziehen.
- **Nicht angefasst:** `lib/html-renderer.mjs`, `lib/html/tokens.mjs`, `lib/html/components.mjs`, `lib/landscape/html-report.mjs`.

---

## Visual Reference

Die Landkarten-Sprache aus [docs/reference/ui-mockup-cockpit-night.html](../../reference/ui-mockup-cockpit-night.html) ist Ziel. Konkret:
- Content-Intro (`.content-intro`) mit Eyebrow + Subject + Subject-ID + Meta-Zeile
- Section-Preview (`.section-preview`) mit Marker-Dot + Title + Sub + Count-Chip + Info-Button
- Repo-Row (`.repo-row`) mit Counter + Name + Meta + Decision-Badge + Score-Cell
- Axis-Row (`.axis-row`) mit Counter + Label + Track/Fill + Percent + Value

Alle Primitives aus `lib/html/components.mjs` schon vorhanden aus UI-1.

---

## Task 1: shared.mjs — Wrapper-Helpers auf Cockpit-Night-Primitives

**Files:** Modify `lib/html/shared.mjs`

- [ ] **Step 1.1: renderHtmlSection auf section-preview umklemmen**

Open `lib/html/shared.mjs`. Find:

```javascript
export function renderHtmlSection(title, body, tone = "default", sectionId = "") {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}"` : "";
  return `<section class="section-card ${tone}"${idAttr}>
  <header class="section-head">
    <h2>${escapeHtml(title)}</h2>
  </header>
  <div class="section-body">
    ${body}
  </div>
</section>`;
}
```

Replace with:

```javascript
export function renderHtmlSection(title, body, tone = "default", sectionId = "") {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}" data-nav-section` : "";
  const accentClass = sectionPreviewAccent(sectionId, tone);
  return `<section class="section-preview ${accentClass}"${idAttr}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>${escapeHtml(title)}</h2>
    </div>
  </div>
  <div class="section-body">
    ${body}
  </div>
</section>`;
}

function sectionPreviewAccent(sectionId, tone) {
  const id = String(sectionId || "").toLowerCase();
  if (id.includes("recommendations") || id.includes("empfehl")) return "accent-magenta";
  if (id.includes("coverage") || id.includes("achsen")) return "accent-purple";
  if (id.includes("decision") || id.includes("entscheid")) return "accent-orange";
  if (id.includes("context") || id.includes("lauf") || id.includes("kontext")) return "accent-green";
  if (tone === "warn") return "accent-orange";
  if (tone === "info") return "accent-purple";
  return "accent-magenta";
}
```

Notes:
- `section-preview` aus Cockpit-Night-Tokens (weisse Karte mit Neon-Gradient-Top-Strip + Marker-Dot).
- `data-nav-section` aktiviert das IntersectionObserver-Scroll-Tracking im INFO_DIALOG_SCRIPT.
- Accent-Klasse wird heuristisch aus sectionId / tone abgeleitet (sodass unterschiedliche Sections unterschiedliche Neon-Farben als Marker bekommen).

- [ ] **Step 1.2: renderCollapsibleSection analog umklemmen**

Find:

```javascript
export function renderCollapsibleSection(title, body, { tone = "default", sectionId = "", navLabel = "", collapsed = false } = {}) {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}"` : "";
  const collapsedClass = collapsed ? " collapsed" : "";
  return `<section class="section-card collapsible ${tone}${collapsedClass}"${idAttr}>
  <header class="section-head">
    <h2>${escapeHtml(title)}</h2>
  </header>
  <div class="section-body">
    ${body}
  </div>
</section>`;
}
```

Replace with:

```javascript
export function renderCollapsibleSection(title, body, { tone = "default", sectionId = "", navLabel = "", collapsed = false } = {}) {
  const idAttr = sectionId ? ` id="${escapeHtml(sectionId)}" data-nav-section` : "";
  const accentClass = sectionPreviewAccent(sectionId, tone);
  const openAttr = collapsed ? "" : " open";
  return `<section class="section-preview collapsible ${accentClass}"${idAttr}>
  <details${openAttr} class="section-preview-details">
    <summary class="section-head">
      <div class="title">
        <h2><span class="marker"></span>${escapeHtml(title)}</h2>
      </div>
      <div class="head-actions"><span class="count-chip">Mehr</span></div>
    </summary>
    <div class="section-body">
      ${body}
    </div>
  </details>
</section>`;
}
```

Notes:
- Nutzt `<details>` fuer native Collapse; CSS-Regel fuer `.section-preview-details` wird vom Browser-Default abgefangen, Rest stammt aus section-preview-CSS.

- [ ] **Step 1.3: renderHtmlStatCards auf stat-grid umklemmen**

Find:

```javascript
export function renderHtmlStatCards(stats) {
  return stats
    .map(
      (stat) => {
        const isNumeric = typeof stat.value === "number" && Number.isFinite(stat.value) && stat.value >= 0;
        const countAttr = isNumeric ? ` data-count="${stat.value}"` : "";
        const secondaryClass = stat.primary === false ? " secondary" : "";
        return `<article class="stat-card${secondaryClass}">
  <span class="stat-label">${escapeHtml(stat.label)}</span>
  <strong class="stat-value"${countAttr}>${escapeHtml(stat.value)}</strong>
</article>`;
      }
    )
    .join("");
}
```

Replace with:

```javascript
const STAT_ACCENT_ROTATION = ["magenta", "purple", "orange", "green", "cyan", "mixed"];

export function renderHtmlStatCards(stats) {
  return stats
    .map((stat, index) => {
      const variant = stat.primary === false ? "meta" : "primary";
      const accent = STAT_ACCENT_ROTATION[index % STAT_ACCENT_ROTATION.length];
      const variantClass = variant === "meta" ? " meta" : "";
      const accentClass = ` accent-${accent}`;
      return `<div class="stat${variantClass}${accentClass}">
  <div class="k">${escapeHtml(stat.label)}</div>
  <div class="v">${escapeHtml(stat.value)}</div>
</div>`;
    })
    .join("\n");
}
```

Notes:
- Keine `<article>` mehr, weil Cockpit-Night-Tokens `.stat` direkt auf `<div>` anwenden.
- Accent-Rotation sorgt dafür, dass die 6 Stat-Cards unterschiedliche Neon-Gradient-Strips bekommen.
- `.preview`-Grid-Wrapper liegt bereits im Aufrufer (`document.mjs` `statsPanel`) — den Wrapper passen wir in Task 6 an.

- [ ] **Step 1.4: Syntax-Check**

Run: `node --check lib/html/shared.mjs`
Expected: exit 0.

- [ ] **Step 1.5: Smoke-Test**

Run:
```bash
node --input-type=module -e "
import('./lib/html/shared.mjs').then(m => {
  const sec = m.renderHtmlSection('Kennzahlen', '<p>body</p>', 'default', 'stats');
  if (!sec.includes('class=\"section-preview')) throw new Error('section missing class');
  if (!sec.includes('data-nav-section')) throw new Error('section missing nav');
  if (!sec.includes('<span class=\"marker\"></span>')) throw new Error('section missing marker');
  const col = m.renderCollapsibleSection('Details', '<p>body</p>', { sectionId: 'matrix', collapsed: true });
  if (!col.includes('<details')) throw new Error('collapsible missing details');
  if (col.includes(' open')) throw new Error('collapsed should not have open');
  const stats = m.renderHtmlStatCards([
    { label: 'Kandidaten', value: 12 },
    { label: 'Empfehlungen', value: 4 },
    { label: 'Lauf', value: '2026-04-23', primary: false }
  ]);
  if (!stats.includes('class=\"stat accent-magenta\"')) throw new Error('stats missing first accent');
  if (!stats.includes('class=\"stat meta accent-orange\"')) throw new Error('stats missing meta variant');
  console.log('shared wrappers OK');
});
"
```
Expected: `shared wrappers OK`

---

## Task 2: shared.mjs — renderTopRecommendations auf decision-rows

**Files:** Modify `lib/html/shared.mjs`

- [ ] **Step 2.1: Funktion rewrite**

Find:

```javascript
export function renderTopRecommendations(recommendations, candidates) {
  if (!recommendations || recommendations.length === 0) {
    return `<p class="empty">Noch keine Empfehlungen vorhanden.</p>`;
  }
  return `<div class="recommendations">${recommendations.map((rec, i) => {
    const [repoRef, ...actionParts] = rec.split(": ");
    const localizedWhole = localizeGeneratedText(rec);
    const action = localizeGeneratedText(actionParts.join(": ") || "Manuell pruefen.");
    const slug = slugifyForId(repoRef);

    const candidate = (candidates || []).find((c) => {
      const name = getCandidateName(c);
      return name === repoRef;
    });
    const disposition = getCandidateDisposition(candidate);
    const type = candidate ? mapDispositionToType(disposition) : { label: "Hinweis", tone: "neutral" };
    const displayName = candidate ? repoRef : "Laufhinweis";
    const displayAction = candidate ? action : localizedWhole;

    return `<a href="#repo-${slug}" class="rec-card">
  <span class="rec-rank">${i + 1}</span>
  <div class="rec-text">
    <div class="rec-name">${escapeHtml(displayName)}</div>
    <div class="rec-action">${escapeHtml(truncateText(displayAction, 120))}</div>
  </div>
  ${renderBadge(type.label, type.tone)}
  <span class="rec-arrow">&rarr;</span>
</a>`;
  }).join("")}</div>`;
}
```

Replace with:

```javascript
const DISPOSITION_TO_BADGE = {
  intake_now: { tone: "adopt", label: "Uebernehmen" },
  review_queue: { tone: "adapt", label: "Vertiefen" },
  observe_only: { tone: "observe", label: "Beobachten" }
};

export function renderTopRecommendations(recommendations, candidates) {
  if (!recommendations || recommendations.length === 0) {
    return `<p class="empty">Noch keine Empfehlungen vorhanden.</p>`;
  }
  return recommendations.map((rec) => {
    const [repoRef, ...actionParts] = rec.split(": ");
    const localizedWhole = localizeGeneratedText(rec);
    const action = localizeGeneratedText(actionParts.join(": ") || "Manuell pruefen.");
    const slug = slugifyForId(repoRef);

    const candidate = (candidates || []).find((c) => getCandidateName(c) === repoRef);
    const disposition = getCandidateDisposition(candidate);
    const badge = candidate ? (DISPOSITION_TO_BADGE[disposition] ?? { tone: "observe", label: "Beobachten" }) : null;
    const displayName = candidate ? repoRef : "Laufhinweis";
    const displayAction = truncateText(candidate ? action : localizedWhole, 140);
    const score = candidate ? (getCandidateNetScore(candidate) || getCandidateFitScore(candidate) || "") : "";

    const badgeFragment = badge
      ? `<span class="badge ${badge.tone}">${escapeHtml(badge.label)}</span>`
      : `<span class="badge observe">Hinweis</span>`;
    const scoreFragment = score !== "" && score !== 0
      ? `<div class="score-cell">
    <div class="score-label">Score</div>
    <div class="score">${escapeHtml(score)}</div>
  </div>`
      : "";

    const nameFragment = candidate
      ? `<a class="name" href="#repo-${escapeHtml(slug)}">${escapeHtml(displayName)}</a>`
      : `<div class="name">${escapeHtml(displayName)}</div>`;

    return `<div class="repo-row">
  <div>
    ${nameFragment}
    <div class="meta">${escapeHtml(displayAction)}</div>
  </div>
  ${badgeFragment}
  ${scoreFragment}
</div>`;
  }).join("\n");
}
```

Notes:
- Kein `<div class="recommendations">`-Wrapper mehr — die Zeilen werden direkt in den section-body gehaengt (dessen Wrapper kommt aus renderHtmlSection).
- Decision-Badge-Mapping erweitert: intake_now → adopt (gruen), review_queue → adapt (orange), observe_only → observe (lila).
- Laufhinweise ohne Candidate kriegen einen neutralen "Beobachten"-Badge.

- [ ] **Step 2.2: Smoke-Test**

Run:
```bash
node --input-type=module -e "
import('./lib/html/shared.mjs').then(m => {
  const empty = m.renderTopRecommendations([], []);
  if (!empty.includes('Noch keine Empfehlungen')) throw new Error('empty copy missing');
  const withCand = m.renderTopRecommendations(
    ['pyJedAI: Record-Linkage uebernehmen', 'goldenmatch: Blocking adaptieren'],
    [{ repo: { owner: 'x', name: 'pyJedAI' }, discoveryDisposition: 'intake_now' }]
  );
  if (!withCand.includes('class=\"repo-row\"')) throw new Error('rec row missing');
  if (!withCand.includes('badge adopt')) throw new Error('adopt badge missing');
  console.log('renderTopRecommendations OK');
});
"
```
Expected: `renderTopRecommendations OK`

---

## Task 3: sections.mjs — renderDiscoveryCandidateCards auf repo-rows

**Files:** Modify `lib/html/sections.mjs`

- [ ] **Step 3.1: Funktion drastisch vereinfachen**

Open `lib/html/sections.mjs`. Find the function `renderDiscoveryCandidateCards` (starts at line 112). Replace the ENTIRE function with:

```javascript
const DISCOVERY_BADGE_MAP = {
  intake_now: { tone: "adopt", label: "Uebernehmen" },
  review_queue: { tone: "adapt", label: "Vertiefen" },
  observe_only: { tone: "observe", label: "Beobachten" },
  watch_only: { tone: "observe", label: "Beobachten" }
};

export function renderDiscoveryCandidateCards(candidates, reportView) {
  const visible = candidates.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">In diesem Lauf sind keine Discovery-Kandidaten vorhanden.</p>`;
  }
  return visible.map((candidate) => {
    const cardId = `repo-${slugifyForId(candidate.repo.owner + "-" + candidate.repo.name)}`;
    const repoRef = `${candidate.repo.owner}/${candidate.repo.name}`;
    const repoUrl = candidate.repo.normalizedRepoUrl;
    const description = candidate.enrichment?.repo?.description ?? "";
    const fitBand = localizeFitBand(candidate.projectAlignment?.fitBand ?? "unknown");
    const mainLayer = localizeSystemTerm(candidate.guess?.mainLayer ?? "unknown");
    const gapArea = localizeSystemTerm(candidate.gapAreaCanonical ?? candidate.guess?.gapArea ?? "unknown");
    const metaParts = [
      description ? description.slice(0, 140) : null,
      `Passung ${fitBand}`,
      `Ebene ${mainLayer}`,
      `Lücke ${gapArea}`
    ].filter(Boolean);
    const metaLine = metaParts.join(" · ");
    const badge = DISCOVERY_BADGE_MAP[candidate.discoveryDisposition] ?? DISCOVERY_BADGE_MAP.observe_only;
    const score = candidate.discoveryScore != null ? candidate.discoveryScore : "";
    const dataSearch = [
      candidate.repo.owner,
      candidate.repo.name,
      description,
      candidate.projectAlignment?.matchedCapabilities?.join(" ") ?? "",
      candidate.guess?.mainLayer ?? "",
      candidate.discoveryDisposition ?? ""
    ].join(" ").toLowerCase();

    return `<div class="repo-row filter-card" id="${cardId}"
  data-search="${escapeHtml(dataSearch)}"
  data-fit="${escapeHtml(candidate.projectAlignment?.fitBand ?? "unknown")}"
  data-mode="${escapeHtml(candidate.discoveryDisposition ?? "watch_only")}"
  data-layer="${escapeHtml(candidate.guess?.mainLayer ?? "unknown")}">
  <div>
    <a class="name" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(repoRef)}</a>
    <div class="meta">${escapeHtml(metaLine)}</div>
  </div>
  <span class="badge ${badge.tone}">${escapeHtml(badge.label)}</span>
  <div class="score-cell">
    <div class="score-label">Score</div>
    <div class="score">${escapeHtml(score)}</div>
  </div>
</div>`;
  }).join("\n");
}
```

Notes:
- Komplett weggekuerzt: `<details>`/`<summary>`-Mechanik, mini-grid mit Evidenz/Stärken/Risiken/Transferidee, repo-card-body, buildWhyRelevant/buildEvidence/buildStrengths/buildRisks. Diese Tiefe gehört in UI-3 auf eine Dossier-Subseite.
- Repo-Row-Markup passt zu `.repo-row`-Tokens aus UI-1.
- Filter-Funktionalitaet erhalten: `filter-card` + data-search/fit/mode/layer.
- Interne Helpers (buildOverviewCopy, joinList, etc.) werden ueberfluessig und sollten mit geloescht werden.

---

## Task 4: sections.mjs — renderWatchlistTopCards auf repo-rows

**Files:** Modify `lib/html/sections.mjs`

- [ ] **Step 4.1: Funktion rewrite**

Find `renderWatchlistTopCards` (ab Zeile 238). Replace:

```javascript
export function renderWatchlistTopCards(review, reportView) {
  const visible = review.topItems.slice(0, reportView.candidateCount);
  if (visible.length === 0) {
    return `<p class="empty">Noch keine geprueften Watchlist-Repositories vorhanden.</p>`;
  }
  return visible.map((item) => {
    const cardId = `repo-${slugifyForId(item.repoRef)}`;
    const repoUrl = `https://github.com/${item.repoRef}`;
    const fitBand = localizeFitBand(item.projectFitBand || "unknown");
    const mainLayer = localizeSystemTerm(item.mainLayer || "unbekannt");
    const gapArea = localizeSystemTerm(item.gapArea || "-");
    const reason = localizeGeneratedText(item.reason || "");
    const metaParts = [
      reason ? reason.slice(0, 140) : null,
      `Passung ${fitBand} (${item.projectFitScore ?? "-"})`,
      `Ebene ${mainLayer}`,
      `Lücke ${gapArea}`
    ].filter(Boolean);
    const metaLine = metaParts.join(" · ");
    const tone = (item.projectFitBand === "high") ? "adopt"
      : (item.projectFitBand === "medium") ? "adapt"
      : "observe";
    const badgeLabel = tone === "adopt" ? "Uebernehmen" : tone === "adapt" ? "Vertiefen" : "Beobachten";
    const score = item.reviewScore != null ? item.reviewScore : "";
    const dataSearch = [
      item.repoRef,
      item.reason,
      item.learningForEventbaer,
      item.possibleImplication,
      item.mainLayer,
      item.gapArea,
      (item.matchedCapabilities ?? []).join(" ")
    ].join(" ").toLowerCase();

    return `<div class="repo-row filter-card" id="${cardId}"
  data-search="${escapeHtml(dataSearch)}"
  data-fit="${escapeHtml(item.projectFitBand || "unknown")}"
  data-mode="${escapeHtml(item.gapArea || "unknown")}"
  data-layer="${escapeHtml(item.mainLayer || "unknown")}">
  <div>
    <a class="name" href="${escapeHtml(repoUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.repoRef)}</a>
    <div class="meta">${escapeHtml(metaLine)}</div>
  </div>
  <span class="badge ${tone}">${escapeHtml(badgeLabel)}</span>
  <div class="score-cell">
    <div class="score-label">Score</div>
    <div class="score">${escapeHtml(score)}</div>
  </div>
</div>`;
  }).join("\n");
}
```

Notes:
- Analog zu Task 3: repo-row, filter-card, data-attrs.
- `<details>`/`<summary>`/mini-grid weg.
- Badge-Tone aus fitBand.

---

## Task 5: sections.mjs — renderCoverageCards auf axis-rows

**Files:** Modify `lib/html/sections.mjs`

- [ ] **Step 5.1: Funktion rewrite**

Find `renderCoverageCards` (ab Zeile 380). Replace:

```javascript
export function renderCoverageCards(coverage) {
  const groups = [
    { title: "Hauptlayer", items: coverage.mainLayers ?? [] },
    { title: "Lueckenbereiche", items: coverage.gapAreas ?? [] },
    { title: "Faehigkeiten", items: coverage.capabilities ?? [] }
  ].filter((group) => group.items.length > 0);
  if (groups.length === 0) {
    return `<p class="empty">Keine Coverage-Daten fuer diesen Lauf vorhanden.</p>`;
  }
  return groups.map((group) => {
    const maxCount = group.items.reduce((highest, item) => Math.max(highest, item.count), 1);
    const rows = group.items.slice(0, 10).map((item) => {
      const percent = Math.max(6, Math.min(100, Math.round((item.count / maxCount) * 100)));
      const valueLabel = localizeSystemTerm(item.value);
      return `<div class="axis-row">
  <div class="axis-label">${escapeHtml(valueLabel)}</div>
  <div class="axis-track"><div class="axis-fill" style="width: ${percent}%;"></div></div>
  <div class="axis-percent">${percent}%</div>
  <div class="axis-value">${escapeHtml(item.count)}</div>
</div>`;
    }).join("\n");
    return `<div class="coverage-axis-group">
  <div class="group-head"><h3>${escapeHtml(group.title)}</h3></div>
  ${rows}
</div>`;
  }).join("\n");
}
```

Notes:
- Coverage-Daten werden als axis-rows visualisiert: Balken, Prozent vom Maximum, Anzahl als value-label.
- Drei Sub-Gruppen (Layer / Gap-Areas / Capabilities) unter jeweils einem `<h3>` via group-head.
- Zählt die bestehende `coverage-grid`/`coverage-card`-Klasse nicht mehr — bleibt weg.

---

## Task 6: document.mjs — Content-Intro nach Hero

**Files:** Modify `lib/html/document.mjs`

- [ ] **Step 6.1: Content-Intro-Helfer einziehen**

Open `lib/html/document.mjs`. Nach den Imports (vor `export function renderHtmlDocument`) einfuegen:

```javascript
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
```

- [ ] **Step 6.2: Content-Intro zwischen Hero und Report-Toolbar einschleusen**

Find:

```javascript
    <main class="wrap page" id="top">
      ${renderHeroSection({ reportType, projectKey, createdAt, subtitle: heroSubtitle, candidateCount })}

      ${renderReportToolbar({ modeOptions, layerOptions })}
```

Replace with:

```javascript
    <main class="wrap page" id="top">
      ${renderHeroSection({ reportType, projectKey, createdAt, subtitle: heroSubtitle, candidateCount })}

      <div class="section-break"></div>

      ${renderReportContentIntro({ reportType, projectKey, createdAt, heroSubtitle, candidateCount, runRoot })}

      ${renderReportToolbar({ modeOptions, layerOptions })}
```

Notes:
- Der `section-break` setzt den Magenta-Dot-Trenner zwischen Hero und Content-Intro, spiegelt Mockup.
- `renderHeroSection` bekommt damit eine Meta-Doppelung (Hero-Meta + Content-Intro-Meta) — das ist akzeptabel; die Hero-Meta aus UI-2a-shell kann ggf. spaeter gekuerzt werden.

- [ ] **Step 6.3: statsPanel-Wrapper auf preview-Grid anpassen**

Find:

```javascript
  const statsPanel = `<section class="panel-card stats-strip" id="stats">
      <header class="section-head">
        <h2>Kennzahlen</h2>
      </header>
      <p class="panel-copy">Nur die Kennzahlen, die fuer den ersten belastbaren Blick wirklich zaehlen.</p>
      <div class="${statsGridClass}">
        ${renderHtmlStatCards(orderedStats)}
      </div>
    </section>`;
```

Replace with:

```javascript
  const statsPanel = `<section class="group" id="stats" data-nav-section>
      <div class="group-head">
        <h3>Kennzahlen</h3>
      </div>
      <div class="preview">
        ${renderHtmlStatCards(orderedStats)}
      </div>
    </section>`;
```

Notes:
- Cockpit-Night-Mockup hat die Übersicht als `.group` mit `.group-head` und darunter `.preview`-Stat-Grid — genau das bilden wir jetzt ab.
- `statsGridClass`-Variable wird dadurch obsolet, kann in Step 6.4 entsorgt werden.

- [ ] **Step 6.4: statsGridClass-Variable entfernen**

Find and remove (direkt ueber `recommendationsPanel`):

```javascript
  const statsGridClass = orderedStats.length <= 8 ? "stats-grid stats-grid--compact" : "stats-grid";
```

- [ ] **Step 6.5: recommendationsPanel-Wrapper anpassen (analog zu statsPanel)**

Find:

```javascript
  const recommendationsPanel = recommendations?.length
    ? `<section class="panel-card top-recommendations-card" id="recommendations" aria-label="Erste Empfehlungen">
      <header class="section-head">
        <h2>Erste Empfehlungen</h2>
      </header>
      <p class="panel-copy">Die staerksten Kandidaten oder naechsten Schritte aus diesem Lauf, in sinnvoller Reihenfolge fuer ein schnelles erstes Urteil.</p>
      ${renderTopRecommendations(recommendations, candidates)}
    </section>`
    : "";
```

Replace with:

```javascript
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
```

- [ ] **Step 6.6: Syntax-Check**

Run: `node --check lib/html/document.mjs && node --check lib/html/shared.mjs && node --check lib/html/sections.mjs`
Expected: alle exit 0.

---

## Task 7: Smoke render + Browser-Check

**Files:** none modified

- [ ] **Step 7.1: Smoke-Render neu erzeugen**

Run:
```bash
node /tmp/ui2a-shell-smoke.html.mjs
```
Expected: schreibt `/tmp/ui2a-shell-smoke.html` (jetzt mit neuer Section-Struktur).

Falls das Script Fehler wirft, siehe Output und fixen.

- [ ] **Step 7.2: Smoke-HTML kopieren**

Run: `cp /tmp/ui2a-shell-smoke.html runs/_ui-test/ui2a-shell-smoke.html`

- [ ] **Step 7.3: Inhalts-Checks**

Run:
```bash
grep -c "class=\"section-preview\|class=\"repo-row\|class=\"axis-row\|class=\"stat accent-\|class=\"content-intro\|section-break" runs/_ui-test/ui2a-shell-smoke.html
```
Expected: Zahl deutlich > 10 (Mockup-Primitives werden breit emittiert).

Run:
```bash
grep -c "class=\"section-card\|class=\"stat-card\|class=\"panel-card\|class=\"rec-card\|class=\"coverage-card" runs/_ui-test/ui2a-shell-smoke.html
```
Expected: 0 (keine Legacy-Klassen mehr in migrierten Bereichen).

- [ ] **Step 7.4: Browser-Check (manuell)**

Unter `\\wsl.localhost\Ubuntu-24.04\home\domi\eventbaer\dev\patternpilot\runs\_ui-test\ui2a-shell-smoke.html` oeffnen. Checkliste:
- Nach dem Hero: Magenta-Dot-Trenner sichtbar
- Content-Intro-Block: Eyebrow „Discovery Report", Subject = Project-Name, Subject-ID = Run-ID, Meta-Zeile
- Kennzahlen-Grid: 3+3 Stat-Cards mit unterschiedlichen Neon-Gradient-Strips oben
- Empfehlungen-Section: section-preview mit Marker-Dot + Count-Chip, darin Repo-Rows mit Badge + Score
- Spaetere Sections (Kandidaten, Coverage, ...) haben neuen section-preview-Rahmen
- Kein JS-Fehler in der Konsole
- Filter-Toolbar funktioniert noch (wenn auch Legacy-Style)

---

## Task 8: Commit + push

- [ ] **Step 8.1: Diff-Umfang pruefen**

Run:
```bash
git diff --stat lib/html/shared.mjs lib/html/sections.mjs lib/html/document.mjs
```
Expected: alle drei Dateien haben Aenderungen, deutlich unter 1000 Zeilen Diff gesamt.

- [ ] **Step 8.2: Nicht-Ziel-Dateien unveraendert**

Run:
```bash
git diff --name-only lib/html/tokens.mjs lib/html/components.mjs lib/html-renderer.mjs lib/landscape/html-report.mjs
```
Expected: leer.

- [ ] **Step 8.3: Commit**

Run:
```bash
git add lib/html/shared.mjs lib/html/sections.mjs lib/html/document.mjs docs/superpowers/plans/2026-04-23-ui2a-sections-landscape-foundation.md
git commit -m "$(cat <<'EOF'
feat(report-ui): UI-2a-sections align main report with Landscape pattern

Zweiter Teil der UI-2a-Migration: der Haupt-Report redet jetzt die gleiche
Sektions-Sprache wie das Cockpit-Night-Landscape-Mockup. Content-Intro
nach dem Hero (Eyebrow + Subject + Run-ID + Meta-Zeile), section-preview-
Wrapper mit Marker-Dot + Count-Chip fuer alle Sections, Repo-Rows als
Haupt-Content-Muster mit Decision-Badge + Score-Cell, Axis-Rows fuer
Coverage.

Migriert auf Cockpit-Night-Primitives:
- shared.mjs: renderHtmlSection + renderCollapsibleSection emittieren
  section-preview mit Marker und sinnvoller Accent-Heuristik.
  renderHtmlStatCards emittiert stat-Karten mit rotierenden Neon-Gradient-
  Strips. renderTopRecommendations rendert repo-rows mit Disposition-
  Badge-Mapping (intake_now -> adopt, review_queue -> adapt, observe_only
  -> observe).
- sections.mjs: renderDiscoveryCandidateCards und renderWatchlistTopCards
  emittieren repo-rows mit erhaltenen filter-card + data-search/fit/mode/
  layer Attributen (JS-Filter bleibt funktional). renderCoverageCards
  emittiert axis-rows pro Sub-Gruppe.
- document.mjs: content-intro-Block mit Report-Type-Label + Project-Key
  + Run-ID + Meta-Zeile nach dem Hero. Stats-Panel auf .group + .preview
  umgebaut. Recommendations-Panel auf section-preview mit Count-Chip.

Bewusst noch nicht migriert (Folgepass oder UI-3):
- renderAgentField (komplexes JSON-Panel)
- renderOnDemand* (8 Funktionen, andere Command-Route)
- renderReviewScopeCards, renderProjectContextSources,
  renderArtifactCard, renderRepoMatrix
Diese Funktionen emittieren weiter Legacy-Markup, werden aber durch den
neuen section-preview-Wrapper visuell eingefangen und sehen ertraeglich
aus. Die Innereien werden in einem Folgepass auf Meta-Grid oder einfache
Info-Cards umgestellt.

Legacy-CSS-Block in document.mjs bleibt vorerst als Fallback fuer die
noch nicht migrierten Inner-Markups. Wird in einem Cleanup-Pass nach
Migration der restlichen Funktionen entsorgt.

Plan: docs/superpowers/plans/2026-04-23-ui2a-sections-landscape-foundation.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8.4: Push**

Run: `git push origin main`

---

## Self-Review Checklist

1. **Spec coverage:** Content-Intro + Section-Preview-Wrapper + Repo-Rows + Axis-Rows + Stat-Grid alle im Main-Report aktiv. Bruecke zur Landscape-Parallel-Optik in UI-2b gelegt.
2. **Placeholder scan:** keine TODO/TBD, alle Code-Fragmente ausgeschrieben, Commit-Message komplett.
3. **Type consistency:** Badge-tone Literale (adopt/adapt/observe) konsistent zwischen renderTopRecommendations / renderDiscoveryCandidateCards / renderWatchlistTopCards. Repo-Row-Struktur (name + meta + badge + score-cell) identisch ueber alle drei.
4. **Filter compatibility:** repo-rows behalten `filter-card`-Klasse + data-attrs — JS-Filter funktioniert weiter.
5. **Scope discipline:** html-renderer.mjs / tokens.mjs / components.mjs / landscape/html-report.mjs nicht beruehrt. Nur shared.mjs + sections.mjs + document.mjs.
6. **Graceful coexistence:** nicht-migrierte Funktionen (renderAgentField etc.) emittieren weiter Legacy-Markup, Legacy-CSS-Block bleibt dran — visuell eingefangen im neuen section-preview-Wrapper.
