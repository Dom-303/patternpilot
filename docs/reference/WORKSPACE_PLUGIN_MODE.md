# Workspace Plugin Mode

## Zweck

Diese Datei beschreibt den wiederverwendbaren Endzustand von Patternpilot als Workspace-gebundenes Meta-System.

## Was jetzt moeglich ist

- lokale Git-Repos im Workspace erkennen
- neue Projekte mit `init-project` anbinden
- einmal gebundene Projekte dauerhaft in `patternpilot.config.json` hinterlegen
- dieselben Intake-, Alignment- und Promotion-Flows auf neue Zielrepos anwenden
- projektgebundene Watchlists mit `sync-watchlist` abarbeiten
- mehrere Projekte gesammelt mit `sync-all-watchlists` oder `automation-run` fahren
- GitHub-Zugang und Workspace-Zustand mit `doctor` pruefen
- lokales Codex-Plugin-Scaffold fuer Verteilung vorbereiten

## Wichtige Kommandos

```bash
npm run discover:workspace
npm run init:project -- --project sample-worker --target ../sample-worker --label "Sample Worker"
npm run list:projects
npm run doctor -- --offline
npm run sync:watchlist -- --project sample-worker --dry-run
npm run automation:run -- --all-projects --promotion-mode prepared --dry-run
```

## Betriebsprinzip

1. Workspace scannen
2. Zielrepo anbinden
3. Projektkontext automatisch vorfuellen
4. Intake auf das gebundene Projekt laufen lassen
5. Promotion kontrolliert auf kuratierte Artefakte anwenden

## Warum das wichtig ist

- Patternpilot bleibt nicht an einem einzelnen Zielprojekt haengen
- neue Zielprojekte koennen ohne manuelles Nachziehen der Struktur starten
- die Betriebslogik bleibt fuer jedes Repo gleich
- spaetere GitHub-App- oder Watchlist-Automatisierung bekommt eine saubere Basis
- die lokale Plugin-Huelle macht spaetere Distribution in Codex-Umgebungen realistischer
