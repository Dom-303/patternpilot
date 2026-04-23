# UI-2a-shell: Doc-Shell-Swap auf Cockpit-Night-Tokens — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das aeussere Gehaeuse des Haupt-Reports (Hero, Sidenav, Body-Shell, Font-Links, globale Tokens) auf Cockpit Night umstellen, ohne die inneren Content-Sections anzufassen. Nach diesem Commit sieht die Rahmung neu aus; die Karten/Zeilen innen bleiben visuell im Altstil, was der explizit geplante Uebergangszustand von UI-2a-shell ist.

**Architecture:** Additive CSS-Ueberlagerung — neuer `<style>`-Block mit `COCKPIT_NIGHT_BASE_CSS` wird NACH dem Legacy-Block eingefuegt, damit neue Regeln fuer shell-relevante Klassen (`.hero`, `.sidenav`, `.shell`, `:root`) die alten ueberstimmen. Die inneren Content-Klassen (`.section-card`, `.stat-card`, `.panel-card`, `.data-table`, etc.) behalten ihre Legacy-CSS, weil die neuen Tokens sie nicht benennen. Body-Markup wird von `<svg class="grain">+scroll-progress+renderStickyNav+<main class="page">` auf `<svg class="grain">+scroll-progress+<div class="shell">${renderStickyNav (emittiert sidenav)}<main class="wrap" id="top">` umgebaut. Die Helfer `renderHeroSection` und `renderStickyNav` in `shared.mjs` behalten ihre Signaturen, emittieren aber neues Cockpit-Night-Markup — damit html-renderer.mjs (Watchlist-Review) die neue Shell automatisch mitzieht.

**Tech Stack:** ES Modules, reine Template-Strings. Imports aus `lib/html/tokens.mjs` und `lib/html/components.mjs` (aus UI-1). Keine neuen Dependencies.

---

## File Structure

- **Modify:** `lib/html/document.mjs` — `<head>`-Font-Links ergaenzen, zweiten `<style>`-Block mit Cockpit-Night-Basis einfuegen, Body-Shell-Markup umbauen, INFO_DIALOG_SCRIPT am Body-Ende einziehen.
- **Modify:** `lib/html/shared.mjs` — `renderHeroSection` und `renderStickyNav` intern neu schreiben, Signaturen bleiben.
- **Nicht angefasst:** `lib/html/sections.mjs`, `lib/html/components.mjs`, `lib/html/tokens.mjs`, `lib/html-renderer.mjs`, `lib/landscape/html-report.mjs`.

Grund fuer den additiven Ansatz statt Legacy-CSS zu strippen: Das existierende `<style>`-Block ist ~1400 Zeilen mit vermischten Shell- und Content-Regeln. Ein chirurgisches Herauslesen der Shell-Teile ist risikoreich und bindet Energie, die besser in UI-2a-sections fliesst (wo das Legacy-CSS dann vollstaendig entsorgt wird). CSS-Kaskade macht das Ueberlagern sauber: gleiche Selektoren gewinnt der spaetere Block; nicht-ueberlagerte Legacy-Regeln bleiben stumm weiterbestehen.

---

## Uebergangszustand nach UI-2a-shell

Nach dem Commit sieht der Haupt-Report so aus:
- **Neu**: Hintergrund `#0e131f` (Cockpit-Night-Dunkel), Schrift Syne/IBM Plex/JetBrains Mono, Hero mit Neon-Gradient-„Pilot", linke Sidenav mit Mono-Links, Shell-Grid 252px + Content.
- **Alt**: Discovery-Kandidaten-Karten, Empfehlungs-Panels, Decision-Summary, Coverage-Cards, Report-Toolbar, Footer — alles noch mit Legacy-Styles (weiss-Transluzent, rund, cyan/magenta-Akzente).

Der Zwischenzustand ist bewusst und wird durch UI-2a-sections aufgeloest. Browser-Check: Shell passt, kein gebrochener Flow, kein JS-Fehler in der Konsole.

---

## Task 1: Baseline-Snapshot (Vorher-Referenz)

**Files:** none modified

- [ ] **Step 1.1: Bestehenden Lauf-Report oeffnen**

Run:
```bash
LATEST=$(ls -t runs/eventbear-worker 2>/dev/null | head -1)
echo "runs/eventbear-worker/$LATEST/summary.html"
```
Expected: ein Pfad wie `runs/eventbear-worker/2026-04-22T15-52-25-061Z/summary.html`. Diese Datei manuell im Browser oeffnen, kurz anschauen (Hero, Stats, Recommendations, Sections), mental als Vorher-Bild verankern. Kein Code-Aenderung.

- [ ] **Step 1.2: Alternative — wenn kein Run da ist, frischen erzeugen**

Run:
```bash
ls runs/eventbear-worker/ | wc -l
```
Wenn `0`: kein Bestandslauf. Entweder skippen (Plan laeuft blind weiter) oder einen on-demand-Lauf fahren:
```bash
npm run on-demand -- --project eventbear-worker --dry-run 2>&1 | tail -20
```
Expected: dry-run faehrt durch, Report-HTML wird geschrieben. Falls auch das fehlschlaegt: Step ist nicht kritisch, weiter ohne Baseline.

---

## Task 2: shared.mjs — Shell-Helper auf Cockpit-Night-Markup umklemmen

**Files:**
- Modify: `lib/html/shared.mjs` (renderHeroSection Zeilen 92-119, renderStickyNav Zeilen 121-147)

- [ ] **Step 2.1: renderHeroSection auf Cockpit-Night-Markup umstellen**

Open `lib/html/shared.mjs`. Find:

```javascript
export function renderHeroSection({ reportType, projectKey, createdAt, subtitle, candidateCount }) {
  const dateStr = createdAt.slice(0, 10);
  const typeLabel = reportType === "discovery"
    ? "ENTDECKUNGSBERICHT"
    : reportType === "on_demand"
      ? "AD-HOC-LAUF"
      : "VERGLEICHSBERICHT";
  return `<header class="hero" id="hero">
  <img src="${LOGO_BASE64}" alt="Patternpilot" class="hero-logo">
  <h1 class="hero-brand">Pattern<span class="pilot">pilot</span></h1>
  <p class="hero-subtitle">Repository-Intelligenz-System</p>
  <div class="hero-divider"></div>
  <p class="hero-claim">
    <span class="word discover">Finden.</span>
    <span class="word">Einordnen.</span>
    <span class="word">Entscheiden.</span>
  </p>
  <div class="hero-project-card">
    <div class="hero-project-type">${escapeHtml(typeLabel)}</div>
    <div class="hero-project-name">${escapeHtml(projectKey)}</div>
    <div class="hero-project-meta">${escapeHtml(dateStr)} &middot; ${escapeHtml(subtitle)} &middot; ${escapeHtml(String(candidateCount))} Kandidaten</div>
  </div>
  <button class="pdf-export-btn" onclick="window.print()" type="button">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
    Als PDF exportieren
  </button>
</header>`;
}
```

Replace with:

```javascript
export function renderHeroSection({ reportType, projectKey, createdAt, subtitle, candidateCount }) {
  const dateStr = createdAt.slice(0, 10);
  const typeLabel = reportType === "discovery"
    ? "Entdeckungsbericht"
    : reportType === "on_demand"
      ? "Ad-hoc-Lauf"
      : "Vergleichsbericht";
  const metaLine = `${escapeHtml(typeLabel)} · ${escapeHtml(projectKey)} · ${escapeHtml(dateStr)} · ${escapeHtml(subtitle)} · ${escapeHtml(String(candidateCount))} Kandidaten`;
  return `<section class="hero" id="hero">
  <h1>Pattern<br><span class="pilot">Pilot</span></h1>
  <p class="slogan">Repository-Intelligenz fuer dein Zielprojekt — Finden, Einordnen, Entscheiden.</p>
  <p class="hero-meta" style="font-family: 'JetBrains Mono', monospace; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--ink-muted); margin-top: 28px;">${metaLine}</p>
</section>`;
}
```

Notes:
- Das neue Markup emittiert `.hero` (matcht COCKPIT_NIGHT_COMPONENTS_CSS Hero-Regel) + `.slogan` + eine kleine inline-styled `.hero-meta` Zeile fuer Report-Metadaten.
- PDF-Export-Button wird gestrichen (war Legacy-Design, Cockpit-Night-Mockup hat keinen). Falls spaeter benoetigt: UI-3 Print-Pass.
- `LOGO_BASE64` wird nicht mehr gebraucht — das Logo wandert in die Sidenav.

- [ ] **Step 2.2: renderStickyNav auf Cockpit-Night-Sidenav-Markup umstellen**

Still in `lib/html/shared.mjs`. Find:

```javascript
export function renderStickyNav(sections) {
  const colorMap = {
    stats: "var(--cyan)",
    recommendations: "var(--green)",
    candidate: "var(--magenta)",
    compared: "var(--magenta)",
    coverage: "var(--orange)",
    context: "var(--blue)",
    matrix: "var(--ink-muted)",
    errors: "var(--orange)",
    risks: "var(--orange)",
    lenses: "var(--blue)",
    missing: "var(--ink-muted)"
  };
  const items = sections
    .filter((s) => s.id && s.navLabel)
    .map((s) => {
      const colorKey = Object.keys(colorMap).find((k) => s.id.includes(k)) || "";
      const dotColor = colorMap[colorKey] || "var(--ink-muted)";
      return `<a href="#${escapeHtml(s.id)}" class="sticky-nav-item"><span class="sticky-nav-dot" style="background:${dotColor}"></span>${escapeHtml(s.navLabel)}</a>`;
    })
    .join("");
  return `<nav class="sticky-nav" id="sticky-nav">
  <span class="sticky-nav-brand">Pattern<span class="pilot">pilot</span></span>
  <div class="sticky-nav-items">${items}</div>
</nav>`;
}
```

Replace with:

```javascript
export function renderStickyNav(sections) {
  const items = sections
    .filter((s) => s.id && s.navLabel)
    .map((s, index) => {
      const number = String(index + 1).padStart(2, "0");
      return `    <li><a href="#${escapeHtml(s.id)}"><span class="n">${number}</span>${escapeHtml(s.navLabel)}</a></li>`;
    })
    .join("\n");
  return `<nav class="sidenav" id="sticky-nav">
  <a href="#top" class="sidenav-logo-link" aria-label="Zum Seitenanfang">
    <img src="${LOGO_BASE64}" alt="Patternpilot" class="sidenav-logo">
  </a>
  <div class="sidenav-eyebrow">Inhalt</div>
  <ul class="sidenav-list">
${items}
  </ul>
</nav>`;
}
```

Notes:
- Emittiert `.sidenav`-Markup aus COCKPIT_NIGHT_COMPONENTS_CSS (Logo-Link oben, Eyebrow, nummerierte Mono-Links).
- Behaelt `id="sticky-nav"` fuer etwaige Altscripts, die den Selektor kennen (harmlos, wird von Shell-CSS nicht mehr ausgewertet).
- `LOGO_BASE64` bleibt in Verwendung — damit wird der oberste Import in shared.mjs nicht ueberfluessig.
- `colorMap`-Logik entfaellt; Cockpit-Night-Sidenav hat keine bunten Punkte pro Section.

- [ ] **Step 2.3: Syntax-Check**

Run: `node --check lib/html/shared.mjs`
Expected: exit 0.

- [ ] **Step 2.4: Smoke-Import der Helpers**

Run:
```bash
node --input-type=module -e "
import('./lib/html/shared.mjs').then(m => {
  const hero = m.renderHeroSection({ reportType: 'discovery', projectKey: 'eventbear-worker', createdAt: '2026-04-23T10:00:00Z', subtitle: 'balanced', candidateCount: 12 });
  if (!hero.includes('class=\"hero\"')) throw new Error('Hero missing hero class');
  if (!hero.includes('<span class=\"pilot\">Pilot</span>')) throw new Error('Hero missing pilot span');
  if (!hero.includes('eventbear-worker')) throw new Error('Hero missing project');
  if (hero.includes('hero-brand') || hero.includes('hero-divider')) throw new Error('Hero still has legacy classes');
  const nav = m.renderStickyNav([{ id: 'stats', navLabel: 'Kennzahlen' }, { id: 'recommendations', navLabel: 'Empfehlungen' }]);
  if (!nav.includes('class=\"sidenav\"')) throw new Error('Nav missing sidenav class');
  if (!nav.includes('sidenav-list')) throw new Error('Nav missing sidenav-list');
  if (!nav.includes('<span class=\"n\">01</span>')) throw new Error('Nav numbering broken');
  if (nav.includes('sticky-nav-item') || nav.includes('sticky-nav-dot')) throw new Error('Nav still has legacy classes');
  console.log('shared.mjs shell helpers OK');
});
"
```
Expected output: `shared.mjs shell helpers OK`

---

## Task 3: document.mjs — Font-Links, Cockpit-Night-Style-Block, Body-Shell, Info-Dialog-Script

**Files:**
- Modify: `lib/html/document.mjs` (Zeilen 1, 16, 61-63, 1458, 1460-1495, 1496-Body-Ende)

- [ ] **Step 3.1: Import-Zeile ergaenzen**

Open `lib/html/document.mjs`. Find the top imports:

```javascript
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
```

Replace with:

```javascript
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
```

- [ ] **Step 3.2: Font-Links im `<head>` ergaenzen**

Find (around line 61-63):

```javascript
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
```

Replace with:

```javascript
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Manrope:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  ${COCKPIT_NIGHT_FONTS_HEAD}
  <style>
```

Note: beide Fontsets bleiben geladen — Manrope fuer die noch nicht migrierten Legacy-Sections, IBM Plex/Syne/JetBrains Mono fuer die neue Shell. Overhead ist akzeptabel fuer den Uebergang.

- [ ] **Step 3.3: Zweiten `<style>`-Block nach dem Legacy-Block einfuegen**

Find (around line 1458):

```javascript
  .report-footer img { opacity: 0.4; }
  .report-footer { color: #999; }
}
  </style>
</head>
```

Replace with:

```javascript
  .report-footer img { opacity: 0.4; }
  .report-footer { color: #999; }
}
  </style>
  <style>
${COCKPIT_NIGHT_BASE_CSS}
  </style>
</head>
```

Warum zwei Bloecke: separate `<style>`-Tags werden in der Reihenfolge der Deklaration gekaskadet. Der neue Block steht NACH dem Legacy-Block, also gewinnen neue Regeln bei identischen Selektoren (`.hero`, `body`, `:root`). Legacy-Regeln zu nicht-ueberlagerten Selektoren (`.section-card`, `.stat-card`, etc.) bleiben wirksam.

- [ ] **Step 3.4: Body-Shell umbauen**

Find (around lines 1460-1495):

```javascript
<body>
  <svg class="grain" aria-hidden="true" style="position:fixed;inset:0;width:100%;height:100%;opacity:0.022;pointer-events:none;z-index:9999;mix-blend-mode:overlay"><filter id="g"><feTurbulence baseFrequency="0.55" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>
  <div class="scroll-progress" id="scroll-progress"></div>
  ${renderStickyNav(sections)}

  <main class="page">
    ${renderHeroSection({ reportType, projectKey, createdAt, subtitle: heroSubtitle, candidateCount })}

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
```

Replace with:

```javascript
<body>
  <svg class="grain" aria-hidden="true" style="position:fixed;inset:0;width:100%;height:100%;opacity:0.022;pointer-events:none;z-index:9999;mix-blend-mode:overlay"><filter id="g"><feTurbulence baseFrequency="0.55" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>
  <div class="scroll-progress" id="scroll-progress"></div>
  <div class="shell">
    ${renderStickyNav(sections)}
    <main class="wrap page" id="top">
      ${renderHeroSection({ reportType, projectKey, createdAt, subtitle: heroSubtitle, candidateCount })}

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
```

Notes:
- `<div class="shell">` + `<main class="wrap page" id="top">` legt sich um den bisherigen Content. Die Doppel-Klasse `wrap page` erhaelt das Legacy-`.page`-Padding-Styling fuer die Content-Sections und fuegt das neue `.wrap` (min-width-0 fuer Grid-Item) hinzu.
- `id="top"` ist der Anker fuer den Sidenav-Logo-Scroll-to-top.
- `${renderInfoDialog({})}` wird vor den Skripten eingefuegt. Kein sichtbarer Effekt, solange keine Info-Buttons klicken, aber erfuellt den Vertrag mit INFO_DIALOG_SCRIPT.

- [ ] **Step 3.5: INFO_DIALOG_SCRIPT am Body-Ende injizieren**

Find the end of the existing inline `<script>` block — look for the closing `</script>` before `</body>`. Run:

```bash
grep -n "</script>\|</body>\|</html>" lib/html/document.mjs | tail -10
```

Pick the last `</script>` before `</body>`. Replace it with:

```javascript
</script>
  <script>
${INFO_DIALOG_SCRIPT}
  </script>
</body>
</html>`;
}
```

WICHTIG: nur wenn das `</body>` direkt nach `</script>` kommt. Pruefe mit der grep-Ausgabe vorher, was die letzte Zeile ist. Falls die Struktur bereits mehrere `</script>`-Schliesser hat, das neue Script-Tag vor `</body>` ergaenzen, nicht einen bestehenden Block ueberschreiben.

Alternative (sicherer) Ansatz: direkte Ersetzung von `</body>`:

```bash
grep -c "</body>" lib/html/document.mjs
```

Wenn `1`:

Find:
```javascript
</body>
</html>`;
```

Replace with:
```javascript
<script>
${INFO_DIALOG_SCRIPT}
</script>
</body>
</html>`;
```

- [ ] **Step 3.6: Syntax-Check**

Run: `node --check lib/html/document.mjs`
Expected: exit 0.

---

## Task 4: End-to-end Verifikation + Commit

**Files:** none modified

- [ ] **Step 4.1: Report neu rendern**

Run:
```bash
npm run on-demand -- --project eventbear-worker --dry-run 2>&1 | tail -10
```
Expected: Lauf faehrt durch (auch Dry-Run schreibt Report-HTML). Bei Fehler — Output anschauen, Tippfehler in document.mjs oder shared.mjs beheben.

Wenn on-demand den HTML-Pfad nicht ausgibt, alternativer Pfad via product-readiness oder den letzten runs-Ordner anfassen:

```bash
LATEST=$(ls -t runs/eventbear-worker 2>/dev/null | head -1)
ls "runs/eventbear-worker/$LATEST/"
```

Falls `summary.html` dort existiert, ist das die frisch gerenderte Nachher-Datei.

- [ ] **Step 4.2: Browser-Check (manuell)**

Die Nachher-HTML-Datei im Browser oeffnen. Checkliste:
- Hintergrund ist dunkel (`#0e131f`-Grundton), nicht fast-schwarz (`#050509`).
- Links oben sichtbar: Sidenav mit Logo + „Inhalt"-Eyebrow + nummerierten Mono-Links (01, 02, 03 ...).
- Hero im Content-Bereich zeigt „Pattern" als Syne-Display-Schrift, darunter „Pilot" als Neon-Gradient (magenta → orange → gruen).
- Slogan-Zeile in IBM Plex Sans darunter.
- Unter dem Hero: Report-Toolbar, Kennzahlen-Panel, Empfehlungen — noch im alten Stil (glasige Karten, gerundet), aber sichtbar.
- Keine JavaScript-Fehler in der Browser-Konsole.
- Klick auf Sidenav-Logo scrollt nach oben.
- Klick auf Sidenav-Link scrollt zur jeweiligen Section.

Wenn alles OK: weiter. Wenn visuell gebrochen (z. B. Sidenav fehlt, Hero nicht gradient, Layout zerfaellt): zurueck zu Task 2/3 und debuggen.

- [ ] **Step 4.3: git diff pruefen**

Run:
```bash
git diff --stat lib/html/document.mjs lib/html/shared.mjs
```
Expected: beide Dateien haben Aenderungen, nicht mehr als ~80-100 Zeilen Veraenderung gesamt. Grosse Diffs (>500 Zeilen) sind Alarm: pruefen, ob versehentlich das Legacy-CSS geloescht wurde.

- [ ] **Step 4.4: Nicht-Ziel-Dateien sollen unveraendert sein**

Run:
```bash
git diff --name-only lib/html/sections.mjs lib/html/tokens.mjs lib/html/components.mjs lib/html-renderer.mjs lib/landscape/html-report.mjs
```
Expected: leer. Sonst Rollback der versehentlich beruehrten Datei.

- [ ] **Step 4.5: Commit**

Run:
```bash
git add lib/html/document.mjs lib/html/shared.mjs docs/superpowers/plans/2026-04-23-ui2a-shell-swap.md
git commit -m "$(cat <<'EOF'
feat(report-ui): UI-2a-shell swap doc shell to Cockpit Night tokens

Erster Teil der UI-2a-Migration: das aeussere Gehaeuse des Haupt-Reports
(Hero, Sidenav, Body-Shell, Fonts, globale Tokens) steht in Cockpit
Night. Content-Sections (Discovery-Kandidaten, Empfehlungen, Coverage,
Decision-Summary, etc.) bleiben im Legacy-Stil und werden in
UI-2a-sections umgeklemmt.

Aenderungen:
- lib/html/document.mjs: zweiter <style>-Block mit COCKPIT_NIGHT_BASE_CSS
  nach Legacy-CSS (Kaskade gewinnt neue Shell-Regeln), Font-Links aus
  COCKPIT_NIGHT_FONTS_HEAD zusaetzlich zu Legacy-Fonts geladen,
  Body-Wrapper von <main class="page"> auf <div class="shell"> + <main
  class="wrap page" id="top"> umgebaut, renderInfoDialog + INFO_DIALOG_SCRIPT
  am Body-Ende eingebunden.
- lib/html/shared.mjs: renderHeroSection emittiert Cockpit-Night-Hero
  (Syne h1, Neon-Gradient-„Pilot", IBM Plex Slogan, Meta-Zeile),
  renderStickyNav emittiert Cockpit-Night-Sidenav (Logo-Link, Eyebrow,
  nummerierte Mono-Links). Signaturen unveraendert, damit
  html-renderer.mjs (Watchlist-Review) die neue Shell automatisch mitzieht.

Uebergangszustand: Shell Cockpit Night, Content legacy — bewusst.

Plan: docs/superpowers/plans/2026-04-23-ui2a-shell-swap.md

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4.6: Push**

Run: `git push origin main`
Expected: push success.

---

## Self-Review Checklist

1. **Spec coverage:** Shell (Hero + Sidenav + Body-Layout + Tokens + Fonts + Info-Dialog) in Cockpit Night; Content-Sections explizit nicht im Scope und werden in UI-2a-sections gemacht.
2. **Placeholder scan:** Keine TODO/TBD. Alle CSS-/HTML-Fragmente und Commit-Messages ausgeschrieben.
3. **Type consistency:** renderHeroSection-Signatur unveraendert (`{ reportType, projectKey, createdAt, subtitle, candidateCount }`). renderStickyNav-Signatur unveraendert (`sections: Array`). Keine Aufrufstellen-Anpassung noetig.
4. **Scope discipline:** sections.mjs / tokens.mjs / components.mjs / html-renderer.mjs / landscape/html-report.mjs nicht beruehrt. Nur document.mjs und shared.mjs.
5. **Coexistence safety:** Legacy-CSS und neue Cockpit-Night-CSS koexistieren im gleichen HTML; die Kaskade regelt per Deklarations-Reihenfolge. Inhalte, die keine neuen Klassen kennen, behalten ihren Legacy-Look. Kein class-prefix-Trick noetig.
