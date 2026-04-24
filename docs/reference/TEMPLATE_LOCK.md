# Template Lock — Report-UI-Deliverables sind strukturell eingefroren

Stand: 2026-04-24 · canonical commit: `11d596b`

Pattern Pilot hat drei HTML-Deliverables, deren **visuelle Struktur und Layout** jetzt final sind. Inhalte und Datenqualitaet duerfen sich weiterentwickeln — die Struktur nicht.

## Die drei gefrorenen Deliverables

### 1. Landscape-Report-Template

- **Quelle:** [`lib/landscape/html-report.mjs`](../../lib/landscape/html-report.mjs)
- **Erzeugt:** `projects/<project>/problems/<slug>/landscape/<timestamp>/landscape.html`
- **Aufruf:** `npm run problem:explore -- <slug> --project <project>`
- **Demo:** [`runs/_ui-test/landscape-demo-smoke.html`](../../runs/_ui-test/landscape-demo-smoke.html) (alle 20 Sections voll befuellt)
- **Sections:** 21 (Uebersicht, Problem-Details, Entscheidungen, Empfehlungen, Linsen, N Cluster, Coverage, Achsen, Risiken, Kontext, Gesundheit, Status, Agenten, Lauf, Was jetzt)

### 2. Discovery / Review / On-Demand-Report-Template

- **Quelle:** [`lib/html-renderer.mjs`](../../lib/html-renderer.mjs)
- **Erzeugt:** `projects/<project>/reports/patternpilot-report-<project>-<date>.html`
- **Aufrufe:** `npm run on-demand`, `npm run review:watchlist`, `npm run sync:watchlist`
- **Demo:** [`runs/_ui-test/full-sections-smoke.html`](../../runs/_ui-test/full-sections-smoke.html) (alle Sections aller drei Report-Typen)
- **Sections:** 15-18 je Report-Typ

### 3. Cockpit-Night Styleguide

- **Quelle:** [`scripts/generate-styleguide.mjs`](../../scripts/generate-styleguide.mjs)
- **Erzeugt:** [`docs/reference/REPORT_UI_TOKENS.html`](./REPORT_UI_TOKENS.html)
- **Aufruf:** `node scripts/generate-styleguide.mjs`
- **Zweck:** Referenz fuer Design-Tokens, Typografie, Components, Do/Don't
- **Kapitel:** 17 (Prinzipien, Farbsystem, Typografie, Accents, Hero, Intro, Sidenav, Stats, Repo-Rows, Axis, Meta-Grid, Info-Grid, Tabs, Badges, Agent-Snapshot, Description-Collapse, Do&Don't)

## Was erlaubt ist ohne Rueckfrage

- **Inhaltliche Qualitaetsverbesserungen** je Section: genauere Texte, bessere Empfehlungen, praezisere Diagnostics
- **Bugfixes** fuer konkrete Rendering-Probleme
- **Neue Daten-Builder** in `lib/landscape/enrichment.mjs`, `lib/html/sections.mjs`, `lib/html/shared.mjs`
- **Erweiterung der Enrichment-Pipeline**, solange die Renderer-Signaturen unveraendert bleiben
- **CSS-Polish** an Base-Tokens (`lib/html/tokens.mjs`) — aber nicht an der Section-Struktur

## Was NICHT erlaubt ist ohne explizite User-Freigabe

- **Umbau der Section-Reihenfolge** in einem der Templates
- **Umbenennung oder Umstrukturierung** bestehender Sections
- **Austausch der Renderer-Helper** (renderEmpfehlungenSection, renderAgentField, renderCoverageCards etc.)
- **Anpassung der Nav-Label-Konvention** (1-2-Wort-Stil)
- **Aenderungen an der max-2-Col-Grundregel** (Ausnahme: Stat-Grid darf 3-Col)
- **Aenderung der Cockpit-Night-Aesthetik** (dunkler Hero, weisse Karten, rationiertes Neon)
- **Umbau des Styleguide-Kapitel-Systems** (17 Kapitel, Editorial-Nummern, Prinzipien-Grid)

## Warum dieser Lock

Das Report-UI-Framework hat sich ueber mehrere iterationsintensive Runden in eine feste Form eingeschwungen. Weitere "Polish"-Runden ohne klares Ziel drohen, bewaehrte Entscheidungen wieder aufzubrechen. Der Lock gibt sowohl Nutzern als auch Agenten eine klare Rote-Linie: Struktur steht, Inhalt atmet.

## Wie man etwas aendert (wenn wirklich noetig)

1. User-Anfrage muss die **gewuenschte Aenderung** und das **konkrete Problem** klar beschreiben — nicht nur "das koennte schoener sein".
2. Kopfkommentare in den Templates + diese Doku aktualisieren.
3. Canonical-commit-Hash (oben) weiterdrehen.
4. Smokes neu rendern und visuell durchgehen.

## Quellen der Wahrheit

- **Design-Tokens:** [`lib/html/tokens.mjs`](../../lib/html/tokens.mjs)
- **Komponenten-Primitives:** [`lib/html/components.mjs`](../../lib/html/components.mjs)
- **Sections-Bausteine:** [`lib/html/sections.mjs`](../../lib/html/sections.mjs)
- **Section-Info-Texte:** [`lib/html/section-info.mjs`](../../lib/html/section-info.mjs)
- **Styleguide:** [`REPORT_UI_TOKENS.html`](./REPORT_UI_TOKENS.html)
