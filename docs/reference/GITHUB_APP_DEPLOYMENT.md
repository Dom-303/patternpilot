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
- `deployment/github-app/examples/installation.created.json`
- `deployment/github-app/examples/installation.created.headers.json`
- `deployment/github-app/examples/installation_repositories.added.json`
- `deployment/github-app/examples/installation_repositories.added.headers.json`
- `deployment/github-app/examples/push.default_branch.json`
- `deployment/github-app/examples/push.default_branch.headers.json`
- `deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json`
- `deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json`
- `automation/` mit Scheduler- und CI-Templates
- `docs/reference/GITHUB_APP_EVENT_MODEL.md`
- `github-app-plan` als aktueller Plan-Command fuer Rechte-, Event- und Command-Mapping
- `github-app-event-preview` als Vorschau fuer einzelne Event-Payloads gegen den aktuellen Kernel
- `github-app-webhook-preview` als lokale Vorschau fuer Header, Signatur und abgeleitete Event-Routen
- `github-app-webhook-route` als konkrete lokale Route-Plan-Schicht mit Command-Vorschlaegen
- `github-app-webhook-dispatch` als kontrollierte lokale Dispatch-Schicht ueber dem Route-Plan, inklusive Force-Gate fuer mutierende oder teurere Schritte
- Dispatch-Artefakte enthalten jetzt auch einen expliziten `execution-summary`, damit spaetere App-/Service-Runtimes Erfolgs- und Fehlerpfade sauber auswerten koennen
- Dispatch-Artefakte enthalten ausserdem einen `execution-contract`, damit eine spaetere Runner-Schicht nicht erst Shell-Kommandos aus Markdown oder Summaries rekonstruieren muss
- `github-app-execution-run` bildet jetzt die getrennte lokale Runner-Schicht ueber diesem Contract
- Runner-Artefakte enthalten jetzt auch `runner-state.json`, `resume-contract.json`, `recovery-assessment.json` und `recovery-contract.json`, damit spaetere Service-Runtimes kontrolliert wieder aufnehmen und Recovery-Gates nachvollziehen koennen
- `github-app-execution-resume` und `github-app-execution-recover` machen diese beiden Pfade jetzt auch als explizite CLI-Schritte sichtbar
- `github-app-execution-enqueue` und `github-app-service-tick` bilden jetzt zusaetzlich eine kleine lokale Queue-/Service-Schicht ueber diesen Contracts
- diese Service-Schicht kennt jetzt auch `claimed`-Zustaende, Worker-IDs und Lease-Zeiten, damit spaetere Runtime-Prozesse nicht denselben Contract doppelt anfassen
- Duplicate-Schutz und `dead-letter` sind jetzt ebenfalls vorbereitet, damit spaetere Runtime-Prozesse nicht endlos denselben kaputten Contract wiederanfassen
- `github-app-service-review` und `github-app-service-requeue` bilden jetzt zusaetzlich eine explizite Admin-Kante fuer manuelle Freigaben aus `blocked`, `dead-letter` und bei Bedarf `claimed`
- manuelle Freigaben schreiben jetzt Receipts und Service-Historie, statt dass Recovery nur ueber Dateiverschiebungen nachvollziehbar waere
- `github-app-installation-review` und `github-app-installation-apply` schreiben jetzt zusaetzlich lokale Installationspakete und eine Registry nach `state/github-app-installations.json`
- `github-app-installation-show` macht diese Registry direkt sichtbar, bevor spaeter einmal echte Installations- oder Multi-Repo-Liveintegration darueber laeuft
- `github-app-installation-governance-review` und `github-app-installation-governance-apply` fuegen jetzt eine explizite Installations-Policy zwischen Registry und Mehr-Repo-Handoff ein
- `github-app-installation-runtime-review` und `github-app-installation-runtime-apply` leiten daraus jetzt einen eigenen Betriebsmodus pro Installation ab
- `github-app-installation-operations-review` und `github-app-installation-operations-apply` koppeln das jetzt an Watchlist-/Service-Betriebsbereitschaft pro Installation
- `github-app-service-review` und `github-app-service-tick` respektieren diese Installations-Operationsschicht jetzt auch beim lokalen Queue-/Runner-Betrieb
- `github-app-service-requeue` respektiert jetzt ebenfalls installation-spezifische Freigabe-Regeln fuer `blocked`, `dead-letter` und `claimed`
- `github-app-installation-scope` bewertet jetzt die Registry als Mehr-Repo-Scope pro Installation
- `github-app-installation-handoff` kann watchlist-faehige Repositories daraus kontrolliert in Projekt-Watchlists uebergeben

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

Eine konkrete Fundstellenliste steht auch in `docs/reference/SETUP_CHECKLIST.md`.

## Bis dahin

- PAT bleibt ein guter Zwischenzustand
- `doctor` zeigt dir schon heute, ob Patternpilot anonym oder mit Token laeuft
