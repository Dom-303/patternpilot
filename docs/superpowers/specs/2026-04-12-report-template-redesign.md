# Patternpilot Report Template — Redesign Spec

## Zusammenfassung

Kompletter Neubau des HTML-Report-Templates für Patternpilot. Ersetzt das bisherige `discovery-focused.html`-Template durch ein modulares, interaktives, landing-page-artiges Design mit neuem Branding, Animationen und verbesserter UX.

## Ausgangslage

- `html-renderer.mjs` generiert HTML-Reports aus `manifest.json` + `project_profile.json`
- Zwei Report-Typen: Discovery (GitHub-Kandidatensuche) und Watchlist Review (Vergleichsanalyse)
- Bisheriges Template: funktional, aber visuell veraltet, keine Animationen, alte SVG-Logos
- Neue PNG-Logos liegen in `assets/` (logo-hero, logo-text, logo-horizontal, logo-icon)

## Ziel

Ein Report-Template, das sich anfühlt wie eine professionelle Produktoberfläche — nicht wie ein Debug-Output. Modern, interaktiv, großzügig, mit klarem Patternpilot-Branding.

---

## 1. Architektur

**Basis-Template + modulare Sections.**

Ein gemeinsames Gerüst liefert:
- Hero
- Sticky Navigation
- Stats-Leiste
- Search/Filter Toolbar
- Footer

Die Content-Sections sind modular und typabhängig. Der Renderer in `html-renderer.mjs` steckt je nach Report-Typ (Discovery / Watchlist Review) die passenden Sections ein.

Erweiterbar für zukünftige Report-Typen (z.B. Intake-Review) ohne Template-Duplikation.

## 2. Dateiname

```
patternpilot-report-<project>-<YYYY-MM-DD>.html
```

Beispiel: `patternpilot-report-eventbear-worker-2026-04-12.html`

Speicherorte:
- Pro Run: `runs/<project>/<run-id>/patternpilot-report-<project>-<YYYY-MM-DD>.html`
- Projekt-Report: `projects/<project>/reports/patternpilot-report-<project>-<YYYY-MM-DD>.html`

Der Nutzer kann pro Run entscheiden, ob ein neuer Report erstellt oder ein bestehender überschrieben wird. Durch das Datum im Namen bleiben alte Reports erhalten.

## 3. Visuelles System

### Farben

Abgeleitet aus den neuen Logos:

| Token | Wert | Verwendung |
|-------|------|-----------|
| `--bg` | `#050509` | Seiten-Hintergrund |
| `--surface` | `rgba(14, 14, 28, 0.6)` | Card-Hintergründe (Glasmorphismus) |
| `--surface-solid` | `#0e0e1c` | Solide Hintergründe |
| `--surface-border` | `rgba(255, 255, 255, 0.06)` | Card-Borders |
| `--ink` | `#b8b8d0` | Body-Text |
| `--ink-bright` | `#eeeef8` | Hervorgehobener Text |
| `--ink-muted` | `#5c5f82` | Sekundärer Text |
| `--ink-faint` | `#2a2c48` | Tertiärer Text |
| `--cyan` | `#00e5ff` | Primärer Akzent, Discovery |
| `--magenta` | `#e040fb` | Sekundärer Akzent, Review |
| `--orange` | `#ff9100` | Warn/Highlight |
| `--green` | `#00e676` | Erfolg/Positiv |
| `--blue` | `#2979ff` | Info/Neutral |

### Typografie

- **Headlines, Brand:** Syne (700, 800)
- **Body, UI:** Manrope (300–700)
- Geladen via Google Fonts (preconnect)
- Brand-Name "Patternpilot": "Pattern" in weiß, "pilot" in Cyan→Orange Gradient

### Atmosphäre

- Radiale Gradients im Hintergrund (Cyan, Magenta, Green, Orange — subtil)
- Film-Grain-Overlay (SVG feTurbulence, opacity 0.022)
- Glasmorphismus-Surfaces (backdrop-filter: blur)
- Neon-Glow-Effekte auf Akzent-Elementen (drop-shadow, text-shadow, box-shadow)

### Logo-Einbettung

Das P-Icon (`assets/logo-icon.png`, 256x256, 49KB) wird als Base64 Data-URI eingebettet, damit der Report als standalone HTML funktioniert.

## 4. Seitenstruktur

### 4.1 Hero (zentriert, großzügig)

Aufbau von oben nach unten, alles zentriert:

1. **P-Icon** — 96px, border-radius 20px, Neon-Glow (cyan + magenta drop-shadow)
2. **"Patternpilot"** — Syne 800, ~56px, "pilot" in Gradient
3. **"Repo Intelligence System"** — 12px, uppercase, letter-spacing 0.22em, muted
4. **Divider** — 56px breite Linie, Cyan→Magenta Gradient, Glow-Shadow
5. **Claim** — Syne 800, ~28px: "Discover. Align. Decide." — "Discover." in Cyan mit Text-Shadow
6. **Projekt-Card** — Glasmorphie-Box mit:
   - Report-Typ (z.B. "DISCOVERY REPORT") in Cyan uppercase
   - Projektname (z.B. "eventbear-worker") in Syne 800, 22px, weiß
   - Meta-Info (Datum, Profil, Kandidaten) in 12px muted

Großzügiges Padding: 100px oben, 110px unten.

#### Hero Entrance Animation

- Logo: Float-In von oben (0.8s) + Glow-Puls-Loop (4s, infinite, subtle)
- Brand-Name: Fade-Up (0.7s, delay 0.3s)
- Subtitle: Fade-Up (0.6s, delay 0.5s)
- Divider: Fade-Up (0.5s, delay 0.65s)
- Claim: Wörter einzeln nacheinander (je 0.5s, delays 0.8s / 0.95s / 1.1s), mit blur-to-sharp
- Projekt-Card: Fade-Up (0.6s, delay 1.3s)

### 4.2 Sticky Navigation

Erscheint, sobald der Nutzer am Hero vorbeiscrollt (IntersectionObserver auf Hero-Ende).

- Schmal, glasmorph (backdrop-filter: blur, semi-transparent bg)
- Links: "Patternpilot" Mini-Brand (Syne 13px)
- Rechts: Farbige Dots (6px) + Section-Labels als Anchor-Links
- Ganz oben: Scroll-Progress-Balken (2px, position fixed, Cyan→Magenta Gradient, Breite = scroll%)

Sections in der Nav:
- Stats (Cyan)
- Empfehlungen (Green)
- Kandidaten (Magenta)
- Coverage (Orange) — nur bei Review
- Kontext (Blue)
- Matrix (Muted) — nur bei Standard/Full View

### 4.3 Stats-Leiste

Grid mit auto-fit, minmax(200px, 1fr). Jede Stat-Card:
- Glasmorphismus-Surface
- Farbiger Top-Border (3px, rotierend durch Cyan/Magenta/Orange/Green/Blue)
- Label: 11px uppercase, muted
- Wert: Syne 800, 38px, in der jeweiligen Section-Farbe mit Neon-Glow
- Hover: translateY(-4px), tieferer Shadow

**Animierte Counter:** Zahlen zählen von 0 zum Zielwert hoch (1.2s, ease-out cubic), getriggert per IntersectionObserver wenn die Cards ins Blickfeld scrollen.

Discovery-Stats: Profile, Profile Limit, Queries, Known Skipped, Scanned, Candidates, Created, View
Review-Stats: Analysis Profile, Depth, Watchlist URLs, Reviewed Repos, Missing Intake, Top Items, Created, View

### 4.4 Top Recommendations

Gestapelte Karten mit visueller Hierarchie:

- **Nr. 1:** Größer (padding 28px 32px), Rank-Nummer 28px in Cyan-Magenta-Gradient-Box (52x52px), größerer Repo-Name (17px), subtiler Cyan-Border + Background
- **Nr. 2:** Standard-Größe, Rank in Magenta-Box
- **Nr. 3:** Standard-Größe, Rank in Orange-Box

Jede Empfehlung:
- Klickbar → scrollt zur passenden Repo-Card (Anchor-Link auf Card-ID)
- Hover: translateX(6px), Cyan-Border, Pfeil-Icon bewegt sich nach rechts
- Repo-Name (Syne 700) + Aktions-Text (Manrope, muted)

### 4.5 Search & Filter Toolbar

Grid-Layout:
- Textsuche (input type="search", Placeholder "Filter repos, layers, capabilities")
- Dropdown: Fit (All/High/Medium/Low/Unknown)
- Dropdown: Mode (dynamisch aus Daten)
- Dropdown: Layer (dynamisch aus Daten)
- Reset-Button (ghost-style)

Alle Inputs: Glasmorphismus-Style, 14px border-radius, focus-glow in Cyan.

**Filter-Indikator:** Wenn Filter aktiv → über den Cards erscheint "Showing X of Y candidates" mit Glow-Puls.

Live-Filterung: Cards + Tabellen-Rows werden per JS getoggelt (classList hidden-by-filter).

### 4.6 Candidate Cards (Discovery) / Top Compared Repos (Review)

Grid: auto-fit, minmax(380px, 1fr). Jede Card:

- **Großzügiges Padding** (36px 40px)
- Glasmorphismus-Surface, border-radius 20px
- Farbiger Top-Border (3px, rotierend durch die 5 Akzentfarben)
- **Header:** Repo-Name (Syne 700, 18px) + Badges (Score, Fit, Disposition)
- **URL:** Klickbar, 15px
- **Beschreibung:** Muted, 15px
- **Mini-Grid:** 4 Felder (Why relevant, Strong area, Transfer idea, Risks) — Label uppercase 11px, Wert 15px
- **Aufklappbare Details:** `<details>` Element, Summary in Cyan uppercase

**Farb-Glow auf Hover:** Jede n-te Card hat eine eigene Akzentfarbe. Beim Hover:
- Top-Border wird volle Opacity + Box-Shadow-Glow
- Card bekommt farbigen 20px-60px Shadow
- Card hebt sich (translateY -6px)
- Inset-Glow am oberen Rand

Badges: Pill-Style (border-radius 999px), farblich nach Typ (accent/info/warn/neutral).

### 4.7 Coverage & Signals (nur Review)

Grid mit 3 Coverage-Cards (Main Layers, Gap Areas, Capabilities).

Bar-Charts in jeder Card:
- Label links, Track in der Mitte, Count rechts
- Track: 10px Höhe, border-radius 999px, Background rgba(255,255,255,0.04)
- Fill: Akzentfarbe (rotierend) mit box-shadow Glow

**Animierte Bar-Fills:** Breite animiert von 0% zum Zielwert (0.7s, cubic-bezier), getriggert per IntersectionObserver.

Section ist einklappbar (Klick auf Header toggelt Body-Sichtbarkeit).

### 4.8 Target Repo Context / Discovery Lenses

Coverage-Grid mit 4 Sub-Cards:
- Read-first Files
- Missing configured Files
- Scanned Directories
- Signals extracted / Discovery Queries

Section ist einklappbar.
- Discovery: Default offen (zeigt Discovery Lenses / Queries)
- Review: Default eingeklappt (Kontext ist Transparenz, nicht Kerninhalt)

### 4.9 Repo Matrix / Errors / Risks

**Repo Matrix** (nur Standard/Full View):
- Responsive Tabelle (overflow-x scroll)
- Spalten: Repo, Layer, Gap, Fit, Relevance, Next step
- Hover-Rows mit subtiler Background-Änderung
- Wird ebenfalls von den Filtern beeinflusst

**Search Errors:** Liste, tone "warn" wenn Fehler vorhanden.

**Highest Risk Signals** (nur Review): Liste der risikoreichsten Repos.

Sections sind einklappbar.

### 4.10 Footer

Zentriert:
- P-Icon (32px, opacity 0.25, kein Glow)
- "Generated by Patternpilot — Repo Intelligence System"
- Font-size 14px, color ink-faint

## 5. UX-Features

### Sticky Navigation + Scroll-Progress
- IntersectionObserver auf Hero-Ende triggert Einblendung der Sticky Nav
- Scroll-Event-Listener für Progress-Balken (throttled via requestAnimationFrame)

### Klickbare Empfehlungen
- Jede Repo-Card bekommt `id="repo-<owner>-<name>"` (slugified)
- Empfehlungen werden Anchor-Links auf diese IDs
- smooth scroll-behavior

### Einklappbare Sections
- Coverage, Kontext, Matrix/Errors/Risks: Klick auf Section-Header toggelt Body
- CSS-Transition auf max-height für smooth Animation
- Chevron-Icon rotiert beim Toggle
- Default-State: Coverage offen, Kontext und Matrix eingeklappt

### Scroll-Reveal
- Alle Section-Cards, Repo-Cards, Stat-Cards starten mit opacity:0 + translateY(32px)
- IntersectionObserver (threshold 0.06) triggert Einblendung
- Staggered delay basierend auf Sibling-Index (max 0.28s)

### Live-Filter
- search, fit, mode, layer Inputs filtern Cards + Table Rows
- Hidden-by-filter Klasse toggelt display:none
- Filter-Count-Indikator zeigt "Showing X of Y"

### Responsive
- Breakpoint 720px
- Mobile: 1-Column Grid, kleinere Fonts, reduziertes Padding
- Hero-Dekorationen ausgeblendet auf Mobile
- Sticky Nav scrollbar bei vielen Sections

## 6. Technische Umsetzung

### Dateien die geändert werden

1. **`lib/html-renderer.mjs`** — Kompletter Neubau des Renderers
   - `LOGO_SVG` Konstante ersetzen durch Base64 PNG Data-URI
   - `renderHtmlDocument()` komplett neu mit allen neuen Sections
   - Neue Funktionen: `renderStickyNav()`, `renderFilterIndicator()`, `renderCollapsibleSection()`
   - Bestehende Funktionen anpassen: `renderHtmlStatCards()`, `renderDiscoveryCandidateCards()`, `renderWatchlistTopCards()`, `renderCoverageCards()`, `renderRepoMatrix()`, `renderProjectContextSources()`, `renderReportToolbar()`
   - JS-Block am Ende: Counter-Animation, Scroll-Progress, Sticky-Nav-Toggle, Collapsible-Sections, Filter-Count

2. **`lib/constants.mjs`** — Report-Pfad-Pattern anpassen auf neues Namensschema

3. **`lib/patternpilot-engine.mjs`** — Report-Pfad-Generierung anpassen

4. **Alte Reports löschen:**
   - `projects/eventbear-worker/reports/discovery-focused.html`
   - `runs/*/summary.html` werden NICHT gelöscht — sie werden beim nächsten Run automatisch mit dem neuen Template generiert, da der Renderer zentral ist

5. **Report-Pfad-Logik:** Die Entscheidung ob überschrieben oder neu erstellt wird, liegt in der Engine (`patternpilot-engine.mjs`), nicht im Template. Das Template selbst ist nur die HTML-Ausgabe.

### Keine externen Dependencies

- Google Fonts (Syne, Manrope) via preconnect
- Alles andere inline: CSS, JS, Logo als Base64
- Kein Framework, kein Build-Step
- Standalone HTML-Datei, die überall geöffnet werden kann

## 7. PDF-Export

### Ansatz

Browser-native PDF-Erzeugung via `window.print()` mit optimiertem Print-Stylesheet. Kein externer PDF-Generator nötig.

### Export-Button

- Position: Im Hero-Bereich unterhalb der Projekt-Card, rechtsbündig
- Style: Ghost-Button mit PDF-Icon (inline SVG), Cyan-Border
- Label: "Export PDF"
- Hover: Cyan-Glow, translateY(-2px)

### Print-Stylesheet (`@media print`)

- Hintergrund: Weiß statt Dark Theme (bessere Druckqualität)
- Text: Schwarz/Dunkelgrau statt helle Farben
- Glasmorphismus-Surfaces → solide weiße Borders
- Neon-Glows und Shadows entfernen
- Film-Grain-Overlay ausblenden
- Sticky Nav, Scroll-Progress, Filter-Toolbar ausblenden
- Export-Button selbst ausblenden (`display: none`)
- Alle Sections aufgeklappt (kein Collapsible-State im Print)
- Bar-Charts: Fills auf volle Breite (keine Animation)
- Seitenumbrüche: `break-inside: avoid` auf Cards und Sections
- Logo: Bleibt als Base64, wird in Print-Farben dargestellt
- Responsive Grid: 1-Column im Print für saubere Seitenumbrüche

### Keine externen Dependencies

Nutzt ausschließlich `window.print()` und CSS `@media print`. Der Browser erzeugt das PDF über "Speichern als PDF" im Druckdialog.

## 8. Was nicht in Scope ist

- Kein Dark/Light-Toggle (bleibt Dark Theme)
- Keine Chart-Library (Bar-Charts bleiben CSS-basiert)
- Keine Constellation/Particle-Backgrounds
- Kein neues Designsystem-Dokument (das bestehende REPORT_UI_FRAMEWORK.md wird aktualisiert)
