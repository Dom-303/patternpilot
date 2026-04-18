# GitHub App Event Model

## Zweck

Dieses Dokument beschreibt die erste belastbare Event- und Rechtekante fuer einen spaeteren GitHub-App-Cutover von Patternpilot.

Der Kern bleibt dabei produktneutral:

- bestehende CLI- und On-Demand-Flows bleiben die Quelle der Wahrheit
- GitHub-App-Ereignisse sollen diese Flows spaeter triggern oder anreichern
- Webhooks duerfen den Policy-, Governance- und Curation-Pfad nicht umgehen

## Aktuelle Leitlinie

Patternpilot unterscheidet jetzt zwischen:

- `github-app-readiness`
- `github-app-plan`
- `github-app-event-preview`
- `github-app-webhook-preview`
- `github-app-webhook-route`
- `github-app-webhook-dispatch`

`github-app-readiness` zeigt, ob die benoetigten App-Umgebungsvariablen vorhanden sind.

`github-app-plan` beschreibt, wie spaetere App-Ereignisse auf bestehende Commands und Artefakte gemappt werden sollen.

`github-app-event-preview` nimmt ein einzelnes Event plus Payload-Fixture und zeigt, wie dieses Ereignis heute in die bestehende CLI-/Artefaktwelt geroutet wuerde.

`github-app-webhook-preview` geht noch eine Stufe tiefer:

- Header
- Delivery-ID
- Signatur
- abgeleiteter Patternpilot-Event-Key
- lokale Envelope-Artefakte

`github-app-webhook-route` nimmt diesen Envelope und baut daraus einen konkreten lokalen Route-Plan:

- Route-Status
- Gate
- vorgeschlagene Commands
- Artefaktziele
- naechste sinnvolle Aktion

`github-app-webhook-dispatch` nimmt diesen Route-Plan und baut daraus einen kontrollierten lokalen Dispatch-Plan:

- welche Commands nur Preview sind
- welche schon wirklich ausfuehrbar waeren
- welche in `apply`-Mode zusaetzlich noch ein explizites `--force` brauchen
- welche guarded oder manuell bleiben
- optionale lokale Ausfuehrung nur fuer wirklich freigegebene Schritte
- ein `execution-summary`, das Erfolg, Fehler und Stop-Punkt des lokalen Dispatch-Laufs festhaelt
- einen `execution-contract`, den ein spaeterer App-/Service-Runner direkt als Ausfuehrungsauftrag lesen kann

`github-app-execution-run` konsumiert danach genau diesen Contract:

- als getrennte Runner-Schicht
- mit eigener Apply-/Dry-Run-/Force-Governance
- mit eigenen Runner-Artefakten und Execution-Summary
- mit `runner-state.json`, `resume-contract.json`, `recovery-assessment.json` und `recovery-contract.json` fuer Failure-Recovery, Wiederaufnahme und Retry-/Backoff-Governance
- ohne dass Webhook-Routing und Shell-Ausfuehrung in einem einzigen Schritt vermischt werden

Darueber kann jetzt optional noch eine kleine lokale Service-Schicht liegen:

- `github-app-execution-enqueue` legt Contracts in `state/github-app-runner-queue/`
- `github-app-service-tick` liest `pending`-Contracts, claimt sie mit Worker-ID und Lease, bewertet Resume-/Recovery-Gates und fuehrt nur die aktuell zulaessigen Schritte weiter
- aktive Duplicates und Contracts mit ausgeschoepftem Service-Versuchsbudget kippen nicht still in Schleifen, sondern werden als Konflikt bzw. `dead-letter` sichtbar
- `github-app-service-review` zeigt jetzt explizit, welche `blocked`, `dead-letter` oder `claimed` Contracts manuell freigabereif sind
- `github-app-service-requeue` gibt solche Contracts kontrolliert nach `pending` zurueck, inklusive Notes, Receipts und Service-Historie

Parallel dazu gibt es jetzt eine erste lokale Installations-Registry:

- `github-app-installation-review` baut aus `installation.created` oder `installation_repositories.added` ein lokales Installationspaket
- `github-app-installation-apply` persistiert dieses Paket nach `state/github-app-installations.json`
- `github-app-installation-show` macht diese Registry direkt sichtbar
- `github-app-installation-governance-review` und `github-app-installation-governance-apply` machen daraus eine explizite Policy pro Installation
- `github-app-installation-runtime-review` und `github-app-installation-runtime-apply` machen daraus jetzt auch einen expliziten Betriebsmodus pro Installation
- `github-app-installation-operations-review` und `github-app-installation-operations-apply` machen daraus jetzt auch konkrete Watchlist-/Service-Governance pro Installation
- `github-app-service-review` und `github-app-service-tick` lesen diese Installations-Operations-Governance jetzt auch wirklich als Laufzeit-Gate
- `github-app-service-requeue` liest diese Governance jetzt zusaetzlich als Admin-/Release-Gate fuer geblockte Contracts
- `github-app-installation-scope` bewertet diese Registry als Mehr-Repo-Scope pro Installation
- `github-app-installation-handoff` uebergibt watchlist-faehige Repositories kontrolliert in die zugeordneten Projekt-Watchlists

## Empfohlene Zwei-Stufen-Linie

1. `github-app-webhook-dispatch --apply --force --contract-only`
2. `github-app-execution-run --contract-file <...>/execution-contract.json`
3. bei Fehlschlag oder Unterbrechung: `github-app-execution-resume --contract-file <...>/resume-contract.json`
4. wenn Retry-/Backoff-Governance greifen soll: `github-app-execution-recover --contract-file <...>/recovery-contract.json`
5. optional fuer eine kleine Runtime: `github-app-execution-enqueue ...` und danach `github-app-service-tick`
6. wenn etwas haengen bleibt: `github-app-service-review` und danach gezielt `github-app-service-requeue`

Damit bleibt die schnelle Wiederaufnahme (`resume`) von der bewussten Recovery-Entscheidung (`recover`) getrennt.

## Erste Event-Bindings

### 1. `repository_dispatch.patternpilot_on_demand`

- Typ: synthetischer Dispatch
- Zweck: explizite manuelle Analyse
- heutiger Command-Pfad: `on-demand`
- Gate: manuell

### 2. `schedule.tick`

- Typ: Scheduler- oder App-Job
- Zweck: optionale Maintenance-Schleife
- heutiger Command-Pfad: `automation-dispatch -> automation-alerts`
- Gate: Governance

### 3. `workflow_dispatch.curation_review`

- Typ: synthetischer Dispatch
- Zweck: kuratierte Review- und Apply-Schritte
- heutiger Command-Pfad:
  - `policy-curation-review`
  - `policy-curation-batch-plan`
  - `policy-curation-batch-apply`
- Gate: manuell

### 4. `installation.created`

- Typ: GitHub-App-Webhook
- Zweck: Installation bootstrapen und auf Patternpilot-Projektbindungen abbilden
- geplanter Command-Pfad:
  - `github-app-installation-review`
  - `github-app-installation-apply`
  - `setup-checklist`
  - `show-project`
- Gate: manuell

### 5. `installation_repositories.added`

- Typ: GitHub-App-Webhook
- Zweck: neue Repo-Rechte sauber in Bindung, Watchlist oder Einmallauf ueberfuehren
- geplanter Command-Pfad:
  - `github-app-installation-review`
  - `github-app-installation-apply`
  - `discover-workspace`
  - `run-plan`
  - `on-demand`
- Gate: manuell oder begrenzt unattended

### 6. `push.default_branch`

- Typ: GitHub-App-Webhook
- Zweck: Drift und Folge-Run-Governance nach relevanten Aenderungen bewerten
- geplanter Command-Pfad:
  - `run-drift`
  - `run-governance`
  - `automation-dispatch`
- Gate: Governance

## Rechtebild

### Sofort sinnvoll

- `metadata: read`
- `contents: read`

### Spaeter hilfreich, aber nicht fuer den ersten Cutover noetig

- `actions: read`
- `issues: read`

## Installationsmodell

- Repo-Auswahl bevorzugt: `selected_repositories`
- eine GitHub-App-Installation darf spaeter auf eine oder mehrere Patternpilot-Projektbindungen zeigen
- die App soll nicht implizit “magisch” entscheiden, welches Repo welches Projekt ist
- diese Abbildung muss explizit und nachvollziehbar bleiben

## Warum das wichtig ist

Damit ist GitHub App nicht mehr nur “spaeter mal”, sondern eine klar vorbereitete Integrationskante:

- Commands bleiben stabil
- Events bekommen saubere Zielpfade
- Hook-Adapter, CLI und spaetere App koennen auf denselben Artefakten aufsetzen

## Beispiel

```bash
npm run github:app-event-preview -- \
  --event-key installation.created \
  --file deployment/github-app/examples/installation.created.json \
  --dry-run
```

```bash
npm run github:app-webhook-preview -- \
  --headers-file deployment/github-app/examples/installation.created.headers.json \
  --file deployment/github-app/examples/installation.created.json \
  --webhook-secret patternpilot-dev-secret \
  --dry-run
```

```bash
npm run github:app-webhook-route -- \
  --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json \
  --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json \
  --github-event repository_dispatch \
  --webhook-secret patternpilot-dev-secret \
  --project my-project \
  --dry-run
```

```bash
npm run github:app-webhook-dispatch -- \
  --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json \
  --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json \
  --github-event repository_dispatch \
  --webhook-secret patternpilot-dev-secret \
  --project my-project \
  --dry-run
```
