# Webhook Event Map

## Ziel

Diese Datei ordnet spaetere GitHub-App-Events den Patternpilot-Workflows zu.

## Erste sinnvolle Events

- `installation`
  - Zweck: neue Repo-Installationen erkennen
  - Folge: gebundene Zielrepos pruefen oder markieren

- `installation_repositories`
  - Zweck: Repo-Zuordnung zur App aendert sich
  - Folge: Watchlists oder Projektbindungen aktualisieren

- `push`
  - Zweck: Aktivitaet in gebundenen Repos erkennen
  - Folge: optionalen Patternpilot-Automation-Run anstossen

- `repository`
  - Zweck: Repo-Metadaten aendern sich
  - Folge: Projekt-Discovery oder Meta-Refresh anstossen

## Noch nicht umgesetzt

- echter Webhook-Receiver
- Signaturpruefung
- Installation-Token-Erzeugung
- Event-zu-Queue-Orchestrierung
