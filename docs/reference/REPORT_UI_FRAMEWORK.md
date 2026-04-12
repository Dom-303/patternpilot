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
