# Report Output Model

## Zweck

Diese Datei beschreibt die menschenfreundliche Ausgabeschicht von `patternpilot`.

Der Kern von Patternpilot produziert viele strukturierte Daten:

- Discovery-Kandidaten
- Queue-Eintraege
- Intake-Dossiers
- Alignment-Signale
- Promotion-Kandidaten
- Watchlist-Review-Ergebnisse

Diese Daten muessen nicht nur korrekt, sondern auch benutzbar ausgegeben werden.

## Warum HTML

Markdown und CSV bleiben wichtig fuer:

- Versionierung
- Rohdaten
- Weiterverarbeitung
- schnelle lokale Kontrolle

HTML ist die Schicht fuer:

- schnelle Orientierung
- Lesbarkeit bei groesseren Repo-Mengen
- standardisierte Zusammenfassungen
- spaetere Produktoberflaechen

Jeder HTML-Report soll dabei auch offenlegen:

- welche Kontextquellen aus dem Zielrepo gelesen wurden
- welche Verzeichnisse als Strukturkontext gescannt wurden
- welche Signale daraus in Discovery oder Review eingeflossen sind

## Report-Ziele

Ein guter Patternpilot-Report soll immer schnell sichtbar machen:

- welche Zielrepo-Kontextquellen fuer diesen Lauf gelesen wurden
- welche Repos jetzt oben rauskommen
- warum sie relevant sind
- was daraus fuer das Zielprojekt uebernommen oder gelernt werden koennte
- welche Risiken oder Guardrails beachtet werden muessen
- welche naechsten Schritte jetzt folgen sollen

## Report-Views

### `compact`

- wenige Kandidaten
- wenig Matrix
- auf schnelle Orientierung optimiert

### `standard`

- sinnvoller Default
- Mischung aus Uebersicht und Vergleich

### `full`

- mehr Kandidaten
- mehr Vergleichsdetails
- geeignet fuer tiefere Reviews

## Speicherorte

- pro Run: `runs/<project>/<run-id>/summary.html`
- Discovery-Zielausgabe: `projects/<project>/reports/discovery-<profil>.html`
- Watchlist-Review-Zielausgabe: `projects/<project>/reports/watchlist-review-<profil>-<tiefe>.html`

## Produkt-Richtung

Diese HTML-Schicht ist bewusst so gedacht, dass sie spaeter nicht weggeworfen werden muss.

Sie ist:

- eine menschliche Nutzschicht fuer heute
- eine Vorstufe fuer spaetere UI- oder App-Oberflaechen
- ein Schritt von der Repo-Engine hin zu einem echten Produkt
