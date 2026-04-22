# Report UI Framework

## Zweck

Dieses Dokument beschreibt die visuelle und UX-seitige Richtung fuer die HTML-Reports von `patternpilot`.

## Zielbild

Die Reports sollen nicht wie rohe Debug-Seiten wirken, sondern wie eine klare, moderne Produktoberflaeche:

- freundlich
- aufgeraeumt
- viel Luft
- landing-page-artiger Einstieg
- starke Orientierung auf Empfehlungen statt Datenmuell

## Grundprinzipien

### 1. Klarer Einstieg

Ganz oben muss sofort sichtbar werden:

- worum es in diesem Run geht
- fuer welches Projekt er gilt
- welche Zielrepo-Kontextquellen gelesen wurden
- was die wichtigsten Zahlen sind
- was die Top-Empfehlungen jetzt sind

### 2. Details on demand

Nicht alles gleichzeitig zeigen.

Deshalb:

- Cards fuer den schnellen ersten Eindruck
- Details aufklappbar
- Matrix und Filter nur als zweite Ebene

### 3. Menschenfreundliche Sprache

Die UI soll nicht nur Rohfelder wiederholen.

Wichtig sind Formulierungen wie:

- Why relevant
- What to take
- Risks
- Next recommendation

### 4. Interaktive Orientierung

Reports sollen ohne extra App schon nuetzlich navigierbar sein:

- Search
- Filter
- section navigation
- Repo-Matrix

### 5. Produktreife vor Perfektion

Die HTML-Reports sind die erste echte Produktschicht von Patternpilot.

Sie muessen heute schon hilfreich sein, auch wenn spaeter noch ein staerkeres Designsystem oder eine richtige App folgt.

## Pflicht-Komponenten

- Hero mit Patternpilot-Identitaet
- KPI-/Stat-Cards
- Top Recommendations
- Repo-Cards
- Coverage-/Vergleichsbereich
- Matrix oder Tabellenansicht
- Filter-/Search-Bar

## Spaetere Ausbauoptionen

- Charts als eigene Komponenten
- klarer Farbraum / Brand-System
- exportierbare PDF-Sicht
- Drilldown in Repo-Dossiers
- echte Frontend-App auf Basis derselben Daten

## Gewaehlte Richtung — Cockpit Night (2026-04-22)

Im Brainstorming zu OQ-001 wurde als verbindliche Design-Richtung die Variante **Cockpit Night** festgelegt. Dunkler Grundton im Hero und in der Navigation, weisse Daten-Karten mit klarer Struktur, Neon-Akzente als Pattern-Pilot-Brand-Marker.

Referenz-Mockup: [ui-mockup-cockpit-night.html](ui-mockup-cockpit-night.html)

### Farb-Tokens

```
--bg:           #0e131f   /* Body, matcht Logo-Hintergrund */
--bg-card:      #1c2338   /* dunkle Content-Karten (z. B. Sidebar-Area) */
--bg-card-alt:  #232b45

--ink:          #f1f3f9   /* primaere Schrift auf dunkel */
--ink-soft:     #aeb4c3
--ink-muted:    #727891

--rule:         #323a56   /* sichtbare Trennlinien auf dunkel */
--rule-soft:    #262c44

/* Weisse Daten-Karten */
--card-bg:         #ffffff
--card-bg-alt:     #f6f7fb
--card-ink:        #0e131f
--card-ink-soft:   #3f465e
--card-ink-muted:  #7a819a
--card-rule:       #e3e6ef
--card-rule-soft:  #eef0f7

/* Neon-Akzente (sparsam, als Brand-Marker) */
--neon-magenta: #ff3d97
--neon-pink:    #ff7ab0
--neon-orange:  #ff9a48
--neon-green:   #66e87a
--neon-purple:  #a97aff
--neon-cyan:    #5de5ed

/* Badge-/Decision-Farben auf weiss */
--card-green:   #1e8a33   /* Adopt */
--card-orange:  #c24d00   /* Adapt */
--card-purple:  #5b35c4   /* Observe */
```

### Typografie

- **Display**: `Syne` 700/800 — Hero-Titel, Section-H2, KPI-Zahlen, Scores. Uppercase fuer Sektion-Titel.
- **Body/UI**: `IBM Plex Sans` 400/500/600 — Slogan, Long-form-Text.
- **Mono**: `JetBrains Mono` 400/500/600 — Labels, Meta, Repo-Namen, Eyebrow-Kicker, Scores mit `tabular-nums`.
- Skalen: Hero-H1 clamp(48px, 6.8vw, 82px), Problem-Subject clamp(30px, 4vw, 50px), KPI-Value 48px, Section-H2 22px, Eyebrow/Meta 10–11px mit 0.14–0.24em letter-spacing.

### Layout-Prinzipien

- Zwei-Spalten-Shell: `252px` Sidebar + Content, Gap `64px`, Shell-Max `1400px`, Left-Padding `24px`.
- Sidebar-Logo fluchtet oben mit der Hero-H1 (`margin-top: 80px` auf Logo-Link).
- Sidebar sticky bei `top: 32px`, Logo klickt zurueck zum Seitenanfang.
- Hero-Block atmet (kein Top-Topbar, `padding: 80px 0 32px`).
- Zwischen Sektoren: `72px` (Gruppen-Abstand), innerhalb von Gruppen enger (`24px` Header→Content).

### Komponenten

- **Hero**: Syne-H1 mit Neon-Gradient auf „Pilot", Slogan, Section-Break-Dot als visueller Kapitel-Trenner.
- **Problem-Intro** (`.content-intro`): Eyebrow mit seitlichen Gradient-Linien, menschenlesbarer Titel, Mono-Slug-ID, Meta-Zeile mit Akzent-Divergent.
- **Stat-Cards** (`.stat`): 3-px Neon-Top-Strip (Farbe pro Gruppe), kleiner Uppercase-Key, Syne-Value 48 px, Trend-Zeile. Variante `.stat.meta` mit Mono-Value 18 px fuer Text-Metadaten (Datum/Repo/Profil).
- **Section-Cards** (`.section-preview`): Section-Head mit getoenterm Gradient-BG, Marker-Dot vor H2, Count-Chip rechts, Info-i-Button. Section-Body mit Zeilen (Zebra-Pattern bei geraden Rows), 36px-Padding.
- **Repo-Row**: Row-Counter (01/02/03) links, Name als `<a>` mit „↗"-Pfeil bei externen Repos, Meta-Zeile, Decision-Badge mit Leuchtpunkt, Score-Cell mit Trennlinie und Label.
- **Axis-Row**: Track mit 10 %-Raster, Neon-Gradient-Fill mit weiss-umrandetem End-Marker, Prozent + Wert-Label.
- **Meta-Grid**: Karomuster aus 1-px-Gaps, gruener Akzent-Balken pro Zelle.
- **Info-i-Button** (`.info-btn` / `.dark-info-btn`): 22 px Kreis, kursives Mono-i, Hover = Magenta + Scale. Klick oeffnet ein zentriertes Modal (`<dialog>`) mit Backdrop-Blur, Magenta-Dot neben Titel, Schliessen per Button/ESC/Backdrop-Klick.

### Navigation

- Sidebar-Liste mit `Inhalt`-Eyebrow, linker Border-Pipeline, nummerierten Mono-Links, Magenta-Left-Border-Accent auf Active.
- Scroll-Tracking via `IntersectionObserver` (`rootMargin: '-30% 0px -60% 0px'`).
- `scroll-behavior: smooth` + `scroll-padding-top: 40px` fuer saubere Anker-Spruenge.

### Offene Punkte fuer die Implementierung

- Light-Mode-Variante (Tokens vorhanden, aber noch kein zweites Mockup — evtl. spaeter als `prefers-color-scheme`-Fork).
- Print-optimierte Styles (Seitenumbrueche, monochromer Fallback).
- Chart-Komponenten (Donut, Bar, Line) — Farb-Tokens stehen, visuelle Sprache noch offen.
- Migration der drei existierenden Renderer (`lib/html/*`, `lib/landscape/html-report.mjs`, Review-Renderer) auf das neue Token- und Komponenten-System.
