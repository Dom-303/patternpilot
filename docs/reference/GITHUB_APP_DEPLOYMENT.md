# GitHub App Deployment

## Zweck

Diese Datei beschreibt den naechsten Produktisierungsschritt von Patternpilot weg vom Personal Access Token hin zu einer echten GitHub App.

## Warum eine GitHub App

- sauberere Rechtevergabe pro Repository oder Organisation
- bessere Basis fuer spaetere Multi-Repo-Automation
- stabilerer Betriebsmodus als eine lose Sammlung einzelner Tokens
- bessere Grundlage fuer Webhooks und automatische Watchlist-Intakes

## Was im Repo jetzt vorbereitet ist

- `deployment/github-app/README.md`
- `deployment/github-app/.env.example`
- `deployment/github-app/app-manifest.template.json`
- `automation/` mit Scheduler- und CI-Templates

## Zielbild

1. GitHub App anlegen
2. App-IDs und Private Key lokal oder in CI hinterlegen
3. Webhook-Events auf Intake-/Watchlist-Pipeline mappen
4. Patternpilot-Automation ueber Actions, Cron oder spaeter einen kleinen Service ausfuehren

## Was du spaeter noch nachreichen musst

- GitHub App ID
- GitHub App Name
- GitHub App Private Key
- optional Installation IDs oder Ziel-Org/Repoliste

## Bis dahin

- PAT bleibt ein guter Zwischenzustand
- `doctor` zeigt dir schon heute, ob Patternpilot anonym oder mit Token laeuft
