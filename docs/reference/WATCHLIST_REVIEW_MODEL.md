# Watchlist Review Model

## Zweck

Diese Datei beschreibt den zweiten grossen Bewertungs-Run nach Discovery und Intake.

Discovery beantwortet:

- Welche GitHub-Repositories koennten relevant sein?

Watchlist-Review beantwortet:

- Welche dieser Repositories zeigen im Vergleich zum Zielprojekt die staerksten Potenziale, Luecken oder Risiken?

## Operativer Fluss

1. Zielprojekt lesen
2. Discovery laufen lassen oder Watchlist manuell fuellen
3. `sync-watchlist` erzeugt Queue- und Intake-Basis
4. `review-watchlist` vergleicht die Watchlist-Repos gesammelt gegen das Zielprojekt

## Analyse-Profile

### `balanced`

- sinnvoller Standard
- kombiniert Architektur, Chancen und Risiken

### `architecture`

- staerkste Worker-Schichten
- wiederverwendbare Systemmuster
- relevante Worker-Areas

### `sources`

- Connector-Familien
- Source-Systeme
- Access-, Intake- und Parsing-Fluss

### `distribution`

- API- und Feed-Surfaces
- Plugin-Modelle
- Discovery- und Embedding-Surfaces

### `risk`

- Source-Lock-in
- Maintenance-Risiko
- veraltete oder archivierte Repos

## Analyse-Tiefen

### `quick`

- knapper Management-Run
- wenige Top-Kandidaten

### `standard`

- sinnvoller Default
- inklusive Repo-Matrix

### `deep`

- groesserer Vergleichsraum
- mehr Top-Kandidaten und breitere Coverage

## Wichtige Grenze

Auch dieser Review bleibt heuristikbasiert und absichtlich nicht-LLM-zentriert.

Er soll:

- Vergleichsrichtung schaerfen
- Priorisierung verbessern
- manuelle Architektur- und Produktentscheidungen vorbereiten

Er soll noch nicht:

- finale Architekturentscheidungen vollautomatisch treffen
- fremde Repos als Wahrheit behandeln
