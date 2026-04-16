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
- `github-app-installation-service-lane-review` und `github-app-installation-service-lane-apply` legen jetzt darueber eine echte Runtime-Lane pro Installation, inklusive Tick-Disposition und Concurrency-Cap
- `github-app-installation-service-plan-review` und `github-app-installation-service-plan-apply` planen jetzt darueber hinaus Prioritaet, Tick-Budget und Contract-Fokus fuer gemeinsame Service-Ticks ueber mehrere Installationen hinweg
- `github-app-installation-service-schedule-review` und `github-app-installation-service-schedule-apply` verdichten das jetzt zu echten scheduler-scoped Runtime-Lanes mit Tick-Strategie, Lane-Key und Tick-Cap pro Installation
- `github-app-installation-worker-routing-review` und `github-app-installation-worker-routing-apply` legen jetzt darueber hinaus worker-spezifische Zuordnung, erlaubte Worker-Pools und Scheduler-Lanes pro Installation fest
- `github-app-service-tick` respektiert diese Installations-Lanes jetzt ebenfalls, statt alle service-bereiten Installationen gleich zu behandeln
- `github-app-service-tick` respektiert jetzt auch diese installation-spezifischen Shared-Service-Plaene bei Auswahl und Reihenfolge
- `github-app-service-tick` kann jetzt zusaetzlich per `--scheduler-lane` explizit nur eine Runtime-Lane abarbeiten
- `github-app-service-tick` respektiert jetzt zusaetzlich installation-spezifisches Worker-Routing und blockt Worker-Mismatches oder manuelle Worker-Freigaben als eigene Runtime-Entscheidung
- `github-app-service-scheduler-review` und `github-app-service-scheduler-run` heben diese Runtime-Lanes jetzt auf eine echte Scheduler-Orchestrierung ueber die gesamte lokale Queue
- `github-app-service-runtime-review` und `github-app-service-runtime-run` verdichten diese Scheduler-Orchestrierung jetzt weiter zu worker-scoped Runtime-Pfaeden ueber mehrere Worker
- worker-scoped Runtime-Lanes haben jetzt zusaetzlich eine eigene lokale Claim-/Lease-Governance gegen doppelte parallele Ausfuehrung
- `github-app-service-runtime-cycle-review` und `github-app-service-runtime-cycle-run` heben diese Runtime-Schicht jetzt weiter auf mehrschleifige Runtime-Zyklen mit `service-runtime-cycle-plan.json`, `service-runtime-cycle-receipts.json` und eigener Summary
- `github-app-service-runtime-session-review`, `github-app-service-runtime-session-run` und `github-app-service-runtime-session-resume` heben diese Runtime-Zyklen jetzt weiter auf langlebigere Runtime-Sessions mit `service-runtime-session-state.json`, `service-runtime-session-receipts.json` und `service-runtime-session-resume-contract.json`
- `github-app-service-runtime-loop-review`, `github-app-service-runtime-loop-run` und `github-app-service-runtime-loop-resume` heben diese Runtime-Sessions jetzt weiter auf langlebigere Runtime-Loops mit `service-runtime-loop-state.json`, `service-runtime-loop-receipts.json` und `service-runtime-loop-resume-contract.json`
- die Runtime-/Cycle-/Session-/Loop-Kommandos lassen sich jetzt ausserdem intern ohne verschachtelte CLI-Zwischenausgaben komponieren, was spaetere Service-Runtimes deutlich sauberer macht
- damit ist die lokale Runtime-Schicht nicht mehr nur installation-aware, sondern kann mehrere Installationen bewusst gegeneinander priorisieren
- damit ist die lokale Runtime-Schicht jetzt zusaetzlich worker-aware und kann spaetere Scheduler-/Service-Prozesse pro Installation gezielter voneinander trennen
- und damit existiert jetzt erstmals eine echte scheduler-scoped Runtime-Oberflaeche zwischen lokaler Queue und spaeterem Multi-Worker- oder Service-Betrieb
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
