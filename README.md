# Patternpilot

## Zweck

`patternpilot` ist das Repo-Intelligence- und Entscheidungs-System fuer externe GitHub-Funde, Tools, Produkte und Muster.

Es dient dazu, aus externen Repositories und Produktsignalen nicht nur interessante Beobachtungen, sondern verwertbare Konsequenzen fuer ein Zielprojekt abzuleiten.

Fuer den aktuellen Stand bedeutet das:

- GitHub-Link rein
- projektgebundener Intake raus
- Muster, Relevanz und naechste Schritte sichtbar
- Promotion-Pakete und kuratierbare Kandidaten fuer Landkarte, Learnings und Entscheidungen

Der Fokus liegt nicht auf losem Sammeln, sondern auf einem klaren Arbeitsprinzip:

- relevante externe Loesungen finden
- sie sauber einordnen
- ihre Staerken und Schwaechen verstehen
- daraus konkrete Bedeutung fuer das Zielprojekt ableiten
- Entscheidungen dokumentieren
- wiederverwendbare Muster sichtbar machen

---

## Einordnung

`patternpilot` ist aktuell:

- ein eigenstaendiges lokales Produkt fuer Repo- und Produkt-Intelligence
- ein strategischer Arbeitsraum
- ein Repo- und Produkt-Intelligence-Layer mit lokalem Workspace-Modell
- ein System, das mehrere Zielrepos ueber Projekt-Bindings tragen kann
- ein Dogfood-Setup mit `eventbear-worker` als erstem gebuendelten Pilotprojekt

`patternpilot` ist aktuell nicht:

- ein gehosteter Multi-Tenant-Dienst
- ein zweiter Worker
- ein Code-Spielplatz
- ein lose gefülltes Bookmark-Archiv
- ein Ersatz für Architekturentscheidungen im Worker
- ein Repo-Unterordner von `eventbear-worker`

Wichtig fuer den heutigen Kern:

- der primaere Modus ist `on-demand`
- Nutzer sollen einen gezielten Lauf bewusst anstossen koennen
- wiederkehrende Automation bleibt ein optionaler Betriebs-Layer, nicht der Produktkern

Fuer eine grobe Einordnung von Kernreife, Vollautomatik-Ziel und naechsten Ausbauachsen:

- siehe [docs/foundation/DELIVERY_STATUS.md](/home/domi/eventbaer/dev/patternpilot/docs/foundation/DELIVERY_STATUS.md)

---

## Verhaeltnis zu EventBaer

`patternpilot` lebt bewusst **außerhalb** des `eventbear-worker`-Repos.

Warum:

- der EventBär-Worker soll fachlich fokussiert bleiben
- `patternpilot` ist eine Meta-Schicht, kein Worker-Bestandteil
- spätere Wiederverwendung über EventBär hinaus bleibt so möglich
- Repo-Scope und Verantwortungen bleiben sauber getrennt

EventBaer ist trotzdem der **erste echte Testfall** von Patternpilot.

Wichtig fuer die Produktperspektive:

- projektnahe Discovery-Schaerfe lebt in `PROJECT_BINDING.json`
- Policy-Blocker und Praeferenzen leben in `DISCOVERY_POLICY.json`
- der Produktkern soll mehrere Zielrepos tragen, ohne EventBaer-Wissen fest einzucodieren
- das heute eingecheckte `eventbear-worker`-Binding ist ein gebuendelter Dogfood-Workspace, nicht die Produktidentitaet von Patternpilot

---

## Workspace-Modell

`patternpilot` trennt bewusst zwischen Produktkern und Zielprojekt-Workspace:

- der Produktkern lebt in `lib/`, `scripts/`, `automation/`, `deployment/` und `docs/`
- technische Zielrepo-Bindungen leben unter `bindings/<project>/`
- gebundene Zielrepos leben unter `projects/<project>/`
- `projects/<project>/` ist bewusst der lesbare Arbeits- und Ergebnisraum
- jedes Projekt unter `projects/` beschreibt ein externes Zielsystem, nicht Patternpilot selbst
- neue Projektordner entstehen ueber `npm run init:project -- --project <key> --target <repo-pfad>`

Wichtig fuer die aktuelle Repo-Form:

- `bindings/eventbear-worker/` ist die technische Dogfood-Bindung
- `projects/eventbear-worker/` ist der zugehoerige Arbeits- und Ergebnisraum
- ein frisches Setup kann mit leerem oder minimalem `projects/`-Verzeichnis starten
- `patternpilot.config.json` in diesem Repo ist jetzt der produktseitige Empty-default
- lokale echte Nutzung laeuft ueber `patternpilot.config.local.json`
- fuer eine neue Installation ist [patternpilot.config.example.json](/home/domi/eventbaer/dev/patternpilot/patternpilot.config.example.json:1) der bessere Startpunkt

---

## Frischer Start

Wenn du `patternpilot` neu installierst und noch kein Zielprojekt angebunden hast, ist der kuerzeste sinnvolle Weg:

```bash
npm install
npm run doctor -- --offline
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
npm run intake -- --project my-project https://github.com/example/repo
```

Danach gilt:

- `bindings/my-project/` beschreibt, wie Patternpilot dein Zielrepo lesen soll
- `projects/my-project/` zeigt, was Patternpilot fuer dieses Zielprojekt erzeugt

Fuer einen gefuehrten Einstieg gibt es jetzt auch:

```bash
npm run getting-started
```

---

## Neuer Betriebszustand

Patternpilot ist nicht mehr nur ein Dokumentations-Seed.

Es hat jetzt einen lokalen Motor plus Workspace-Modus:

Die folgenden Beispiele nutzen das aktuell mitgelieferte Dogfood-Projekt `eventbear-worker`.
Fuer eine frische Installation legst du zuerst dein eigenes Projektbinding mit `init:project` an.

- `npm run analyze -- --project eventbear-worker <github-url>`
- `npm run run-plan -- --project eventbear-worker`
- `npm run run-drift -- --project eventbear-worker`
- `npm run run-requalify -- --project eventbear-worker --scope automation`
- `npm run discover:import -- --project eventbear-worker --file projects/eventbear-worker/calibration/discovery-candidates.example.json --dry-run`
- `npm run policy:audit -- --project eventbear-worker --dry-run`
- `npm run policy:calibrate -- --project eventbear-worker`
- `npm run policy:compare -- --project eventbear-worker --policy-file bindings/eventbear-worker/DISCOVERY_POLICY.next.json`
- `npm run policy:pack -- --project eventbear-worker --policy-file bindings/eventbear-worker/DISCOVERY_POLICY.next.json`
- `npm run policy:apply -- --project eventbear-worker --workbench-dir projects/eventbear-worker/calibration/workbench/<id>`
- `npm run policy:review -- --project eventbear-worker`
- `npm run policy:suggest -- --project eventbear-worker`
- `npm run policy:cycle -- --project eventbear-worker`
- `npm run policy:handoff -- --project eventbear-worker`
- `npm run policy:curate -- --project eventbear-worker --prepare-promotions`
- `npm run policy:curation-review -- --project eventbear-worker --limit 1`
- `npm run policy:curation-batch-review -- --project eventbear-worker --limit 2`
- `npm run policy:curation-batch-plan -- --project eventbear-worker --limit 3`
- `npm run policy:curation-batch-apply -- --project eventbear-worker --limit 2`
- `npm run policy:curation-apply -- --project eventbear-worker --limit 1`
- `npm run policy:trial -- --project eventbear-worker`
- `npm run policy:workbench -- --project eventbear-worker`
- `npm run policy:workbench-review -- --project eventbear-worker`
- `npm run intake -- --project eventbear-worker <github-url>`
- `npm run discover:github -- --project eventbear-worker --limit 8 --dry-run`
- `npm run review:watchlist -- --project eventbear-worker --analysis-profile balanced`
- `npm run refresh:context`
- `npm run init:project -- --project <key> --target <repo-pfad>`
- `npm run discover:workspace`
- `npm run doctor -- --offline`
- `npm run init:env`
- `npm run setup:checklist`
- `npm run sync:watchlist -- --project eventbear-worker`
- `npm run sync:all -- --dry-run`
- `npm run re-evaluate -- --project eventbear-worker --stale-only --dry-run`
- `npm run automation:run -- --all-projects --promotion-mode prepared`
- `npm run automation:jobs`
- `npm run automation:alerts`
- `npm run automation:alert-deliver -- --target file --file state/automation_alerts_published.md`
- `npm run automation:alert-deliver -- --target command --target-hook patternpilot-alert-hook --payload-file state/automation_alert_hook_payload.json --hook-markdown-file state/automation_alert_digest.md --hook-json-file state/automation_alert_digest.json`
- `npm run automation:dispatch`
- `npm run patternpilot -- github-app-readiness`
- `npm run patternpilot -- github-app-live-pilot-review --dry-run`
- `npm run patternpilot -- github-app-plan`
- `npm run github:app-event-preview -- --event-key installation.created --file deployment/github-app/examples/installation.created.json --dry-run`
- `npm run github:app-installation-review -- --file deployment/github-app/examples/installation.created.json --headers-file deployment/github-app/examples/installation.created.headers.json --github-event installation --webhook-secret patternpilot-dev-secret --dry-run`
- `npm run github:app-installation-apply -- --file deployment/github-app/examples/installation_repositories.added.json --headers-file deployment/github-app/examples/installation_repositories.added.headers.json --github-event installation_repositories --webhook-secret patternpilot-dev-secret --dry-run`
- `npm run github:app-installation-governance-review -- --installation-id 10101 --dry-run`
- `npm run github:app-installation-governance-apply -- --installation-id 10101 --project eventbear-worker --notes "governed watchlist scope" --dry-run`
- `npm run github:app-installation-runtime-review -- --installation-id 10101 --dry-run`
- `npm run github:app-installation-runtime-apply -- --installation-id 10101 --notes "runtime for governed installation" --dry-run`
- `npm run github:app-installation-operations-review -- --installation-id 10101 --dry-run`
- `npm run github:app-installation-operations-apply -- --installation-id 10101 --notes "ops policy for governed installation" --dry-run`
- `npm run github:app-installation-service-lane-review -- --installation-id 10101 --dry-run`
- `npm run github:app-installation-service-lane-apply -- --installation-id 10101 --notes "service lane for governed installation" --dry-run`
- `npm run github:app-installation-service-plan-review -- --installation-id 10101 --dry-run`
- `npm run github:app-installation-service-plan-apply -- --installation-id 10101 --notes "shared service plan for governed installation" --dry-run`
- `npm run github:app-installation-service-schedule-review -- --installation-id 10101 --worker-id worker-a --dry-run`
- `npm run github:app-installation-service-schedule-apply -- --installation-id 10101 --worker-id worker-a --notes "runtime schedule for governed installation" --dry-run`
- `npm run github:app-installation-worker-routing-review -- --installation-id 10101 --worker-id worker-a --dry-run`
- `npm run github:app-installation-worker-routing-apply -- --installation-id 10101 --worker-id worker-a --notes "worker routing for governed installation" --dry-run`
- `npm run github:app-installation-scope -- --installation-id 10101 --dry-run`
- `npm run github:app-installation-handoff -- --installation-id 10101 --notes "watchlist sync after installation review" --apply --dry-run`
- `npm run github:app-installation-show`
- `npm run github:app-webhook-preview -- --headers-file deployment/github-app/examples/installation.created.headers.json --file deployment/github-app/examples/installation.created.json --webhook-secret patternpilot-dev-secret --dry-run`
- `npm run github:app-webhook-route -- --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json --github-event repository_dispatch --webhook-secret patternpilot-dev-secret --project eventbear-worker --dry-run`
- `npm run github:app-webhook-dispatch -- --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json --github-event repository_dispatch --webhook-secret patternpilot-dev-secret --project eventbear-worker --dry-run`
- `npm run github:app-webhook-dispatch -- --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json --github-event repository_dispatch --webhook-secret patternpilot-dev-secret --project eventbear-worker --apply --force`

`github-app-webhook-dispatch` schreibt inzwischen neben Envelope, Route-Plan und Execution-Summary auch einen maschinenlesbaren `execution-contract` fuer spaetere Runner-/Service-Integrationen.

Fuer die getrennte Zwei-Stufen-Ausfuehrung gibt es jetzt zusaetzlich:

- `npm run patternpilot -- github-app-webhook-dispatch --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json --github-event repository_dispatch --webhook-secret patternpilot-dev-secret --project eventbear-worker --apply --force --contract-only`
- `npm run github:app-execution-enqueue -- --contract-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.recovery-contract.json`
- `npm run patternpilot -- github-app-service-tick --limit 3 --dry-run`
- `npm run github:app-execution-run -- --contract-file runs/integration/github-app-dispatch/<run-id>/execution-contract.json --dry-run`

Die Runner-Stufe schreibt inzwischen ausserdem `runner-state.json`, `resume-contract.json`, `recovery-assessment.json` und `recovery-contract.json`, damit ein spaeterer Dienst bei Fehlern oder Unterbrechungen gezielt wieder aufnehmen und Retry-/Backoff-Entscheidungen bewusst steuern kann.

Dafuer gibt es jetzt auch einen expliziten Resume-Einstieg:

- `npm run github:app-execution-resume -- --contract-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.resume-contract.json --apply --dry-run`
- `npm run github:app-execution-recover -- --contract-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.recovery-contract.json --apply --dry-run`
- `npm run github:app-service-runtime-review -- --worker-ids worker-a,worker-b --dry-run`
- `npm run github:app-service-runtime-run -- --worker-ids worker-a,worker-b --apply --dry-run`
- `npm run github:app-service-scheduler-review -- --worker-id worker-a --dry-run`
- `npm run github:app-service-scheduler-run -- --worker-id worker-a --apply --dry-run`

Darueber liegt jetzt zusaetzlich eine kleine lokale Service-Schicht mit `state/github-app-runner-queue/{pending,claimed,blocked,processed}`. Damit koennen Contracts nicht nur manuell, sondern auch ueber einen spaeteren kleinen Runtime-Loop abgearbeitet werden.

Die Queue kennt jetzt ausserdem erste Worker-/Lease-Semantik:

- `github-app-service-tick --worker-id <id>`
- `--service-lease-minutes <n>`

So koennen spaetere Service-Prozesse Contracts zuerst claimen, voruebergehend exklusiv halten und abgelaufene Claims wieder in `pending` zurueckgeben.

Zusätzlich gibt es jetzt schon die ersten harten Betriebsgrenzen:

- Duplicate-Schutz fuer aktive Contracts derselben Delivery/Contract-Identitaet
- `dead-letter` fuer Contracts, die ihr Service-Versuchsbudget ausgeschöpft haben
- `--max-service-attempts <n>` fuer die kleine lokale Service-Schicht

Und darueber liegt jetzt zusaetzlich eine kleine manuelle Admin-Kante:

- `github-app-service-review --from-status problematic`
- `github-app-service-requeue --from-status dead_letter --apply`

Damit koennen `blocked`, `dead-letter` und bei Bedarf auch `claimed`-Contracts bewusst gesichtet und gezielt wieder nach `pending` freigegeben werden, inklusive Receipts, Notes und Service-Historie.

Hook- und Payload-Referenz:

- `automation/hooks/README.md`
- `docs/reference/AUTOMATION_ALERT_DELIVERY.md`
- `docs/reference/GITHUB_APP_EVENT_MODEL.md`

Fuer die GitHub-App-Installationsebene gibt es jetzt ausserdem eine erste lokale Registry unter `state/github-app-installations.json`. Darin landen Installation-ID, Account, gesehene Repositories und die bislang erkannten Projekt-Mappings. Dadurch kann `installation.created` oder `installation_repositories.added` schon heute in einen echten lokalen Zustandsfluss gehen, bevor spaeter einmal Live-Webhooks oder Multi-Repo-Serviceprozesse darueber laufen.

Darueber liegt jetzt ausserdem ein erster Scope-/Handoff-Pfad:

- `github-app-installation-governance-review` zeigt, welche Projekte pro Installation aktuell sinnvoll und erlaubt wirken
- `github-app-installation-governance-apply` persistiert diese Installations-Policy lokal
- `github-app-installation-runtime-review` leitet daraus den naechsten Betriebsmodus pro Installation ab
- `github-app-installation-runtime-apply` persistiert diesen Runtime-Modus, bevor Scope, Handoff und spaetere Service-Pfade weiterlaufen
- `github-app-installation-operations-review` uebersetzt Runtime und Governance jetzt in konkrete Watchlist-/Service-Betriebsbereitschaft pro Installation
- `github-app-installation-operations-apply` persistiert diese App-Betriebslogik pro Installation, bevor spaetere Runtime-/Service-Prozesse darauf aufbauen
- `github-app-installation-service-lane-review` schaut auf die aktuelle Queue pro Installation und schlaegt daraus lane-Modi, Tick-Dispositions und Concurrency-Caps vor
- `github-app-installation-service-lane-apply` persistiert diese Installation-Lanes, damit gemeinsame Service-Ticks spaeter nicht alle Installationen gleich behandeln muessen
- `github-app-installation-service-plan-review` plant jetzt darueber hinaus die gemeinsame Tick-Priorisierung ueber mehrere Installationen hinweg
- `github-app-installation-service-plan-apply` persistiert Prioritaet, Tick-Budget und bevorzugte Contract-Kinds pro Installation fuer den gemeinsamen Service-Tick
- `github-app-installation-service-schedule-review` leitet daraus jetzt echte scheduler-scoped Runtime-Lanes und Tick-Strategien pro Installation ab
- `github-app-installation-service-schedule-apply` persistiert diese Runtime-Schedule-Ebene, bevor spaetere Multi-Worker- oder lane-scoped Ticks laufen
- `github-app-installation-worker-routing-review` leitet jetzt daraus worker- und scheduler-lane-spezifische Routing-Regeln pro Installation ab
- `github-app-installation-worker-routing-apply` persistiert diese Worker-Zuordnung, erlaubte Worker-Pools und Scheduler-Lanes pro Installation
- `github-app-service-tick` und `github-app-service-review` respektieren diese Installations-Operationsschicht jetzt auch wirklich im Queue-/Runner-Pfad
- `github-app-service-tick` respektiert jetzt zusaetzlich installation-spezifische Service-Lanes, inklusive `manual`, `auto` und `recovery`-fokussierter Lane-Modi sowie Concurrency-Caps pro Installation
- `github-app-service-tick` respektiert jetzt zusaetzlich installation-spezifische Shared-Service-Plaene fuer Priorisierung, Tick-Budgets und Contract-Kind-Praeferenzen zwischen mehreren Installationen
- `github-app-service-tick` kann jetzt zusaetzlich mit `--scheduler-lane <lane-key>` bewusst nur eine scheduler-scoped Runtime-Lane verarbeiten
- `github-app-service-tick` respektiert jetzt zusaetzlich installation-spezifisches Worker-Routing wie `pinned_worker`, `allowed_pool` oder `manual_worker_release` und blockt Worker-Mismatches explizit als eigene Runtime-Kante
- `github-app-service-scheduler-review` zeigt jetzt die gesamte Queue als scheduler-scoped Lane-Orchestrierung ueber mehrere Runtime-Lanes
- `github-app-service-scheduler-run` fuehrt dispatch-ready Runtime-Lanes jetzt kontrolliert ueber lane-scoped Service-Ticks aus
- `github-app-service-runtime-review` verdichtet diese scheduler-scoped Runtime-Lanes jetzt zusaetzlich zu echten worker-scoped Laufpfaden fuer mehrere Worker
- `github-app-service-runtime-run` fuehrt diese worker-scoped Runtime-Plaene jetzt kontrolliert ueber mehrere lane-scoped Service-Ticks pro Worker aus
- worker-scoped Runtime-Lanes koennen jetzt zusaetzlich ueber eine eigene Runtime-Claim-/Lease-Schicht vor doppelter Mehrfachausfuehrung geschuetzt werden
- `github-app-service-runtime-cycle-review` zeigt jetzt zusaetzlich, wie mehrere worker-scoped Runtime-Runden als zusammenhaengender Service-Zyklus aussehen wuerden
- `github-app-service-runtime-cycle-run` fuehrt diese Runtime-Schicht jetzt kontrolliert ueber mehrere Runden bis zum Stoppgrund wie `dry_run_preview`, `manual_preview`, `no_dispatchable_runtime` oder `cycle_limit_reached`
- `github-app-service-runtime-session-review` hebt diese Cycle-Schicht jetzt weiter auf eine langlebigere Runtime-Session mit mehreren Session-Runden, Gesamtzyklus-Sicht und explizitem Session-Budget
- `github-app-service-runtime-session-run` fuehrt diese Runtime-Sessions jetzt kontrolliert ueber mehrere Runtime-Cycles hinweg aus und schreibt bei Bedarf eine Resume-Kante fuer spaetere Fortsetzung
- `github-app-service-runtime-session-resume` setzt genau auf dieser Resume-Kante auf und kann eine pausierte Runtime-Session bewusst wiederaufnehmen
- `github-app-service-runtime-loop-review` hebt diese Session-Schicht jetzt weiter auf einen langlebigeren Runtime-Loop ueber mehrere Session-Runden mit eigenem Loop-Budget
- `github-app-service-runtime-loop-run` fuehrt diese Runtime-Loops jetzt kontrolliert ueber mehrere Sessions hinweg aus und schreibt bei Bedarf eine Loop-Resume-Kante fuer spaetere Fortsetzung
- `github-app-service-runtime-loop-resume` setzt genau auf dieser Loop-Resume-Kante auf und kann einen pausierten Runtime-Loop bewusst wiederaufnehmen
- `github-app-service-runtime-loop-recover` setzt jetzt zusaetzlich auf einem expliziten `service-runtime-loop-recovery-contract.json` auf und fuehrt Loop-Recovery bewusst ueber die Resume-Kante weiter
- `github-app-service-runtime-loop-recovery-review` zeigt diese Recovery-Kandidaten jetzt separat als dispatch-ready, manual-review oder preview-only
- `github-app-service-runtime-loop-recovery-receipts-review` zeigt diese Recovery-Kandidaten jetzt zusaetzlich als dauerhafte offene, recovered, backoff-pending oder exhausted Receipt-Schicht
- `github-app-service-runtime-loop-recovery-auto` kann den aktuell besten wirklich faelligen Loop-Recovery-Fall jetzt direkt automatisch auswaehlen und weiterfuehren
- `github-app-service-runtime-loop-recovery-receipts-release-review` und `github-app-service-runtime-loop-recovery-receipts-release` geben jetzt zusaetzlich eine bewusste Manual-Release-Kante fuer `backoff_pending`, `manual_review` oder `exhausted`
- `github-app-service-runtime-loop-recovery-runtime-review` und `github-app-service-runtime-loop-recovery-runtime-run` staffeln jetzt mehrere offene Loop-Recoveries worker- und lane-bewusst statt nur einen Einzelfall auszuwahlen
- `github-app-service-runtime-loop-recovery-runtime-cycle-review`, `...-run` und `...-resume` geben dieser Recovery-Runtime jetzt zusaetzlich eine mehrstufige Cycle-Kante mit Resume-Contract ueber mehrere Recovery-Paesse hinweg
- `github-app-service-runtime-loop-recovery-runtime-cycle-history-review`, `...-receipts-review` und `...-auto-resume` geben dieser Cycle-Kante jetzt zusaetzlich eine dauerhafte Follow-up-Governance ueber mehrere Cycle-Laeufe hinweg
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-review` und `...-run` geben dieser Follow-up-Governance jetzt zusaetzlich eine worker-familienbewusste Multi-Cycle-Runtime statt nur einzelner Auto-Resumes
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-review` und `...-apply` geben dieser Multi-Cycle-Runtime jetzt zusaetzlich eine dauerhafte Family-Hold-/Backpressure-/Budget-Governance mit persistiertem State
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-governance-release-review` und `...-release` geben dieser Family-Governance jetzt zusaetzlich eine kontrollierte Release-/Override-Kante fuer Holds, Backpressure und Budget-Grenzen
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-review` und `...-apply` geben dieser Family-Governance jetzt zusaetzlich eine family-uebergreifende Worker-Pool-Konfliktsteuerung mit persistiertem Coordination-State
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-followup-review` und `...-apply` geben dieser Worker-Pool-Koordination jetzt zusaetzlich eine Auto-Release-/Escalation-Kante fuer aufgeloeste oder zu lange offene Konflikte
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-review` und `...-apply` geben dieser Worker-Pool-Koordination jetzt zusaetzlich eine gruppenweite Backpressure-Schicht, damit zu viele gleichzeitige Konfliktgruppen bewusst staffelbar werden
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-followup-review` und `...-apply` geben dieser Gruppen-Backpressure jetzt zusaetzlich eine Auto-Release-/Refresh-/Escalation-Kante fuer abgelaufene, weiter noetige oder zu lange offene Konfliktgruppen
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-history-review` und `...-auto-followup` geben dieser Gruppen-Backpressure jetzt zusaetzlich eine dauerhafte History- sowie eine priorisierte Auto-Follow-up-Kante fuer faellige Releases, Refreshes und Eskalationen
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-review`, `...-run` und `...-resume` geben dieser Gruppen-Backpressure jetzt zusaetzlich eine langlebige Loop-Schicht ueber mehreren Sessions
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-loop-history-review`, `...-recovery-review` und `...-recover` geben dieser langlebigen Gruppen-Backpressure-Loop-Schicht jetzt zusaetzlich eine dauerhafte History-/Recovery-Kante mit eigenem Recovery-Contract
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-session-review`, `...-run` und `...-resume` geben dieser Gruppen-Backpressure jetzt zusaetzlich eine mehrstufige Session-Schicht ueber mehreren Cycle-Runden
- `github-app-service-runtime-loop-recovery-runtime-cycle-runtime-coordination-backpressure-cycle-review`, `...-run` und `...-resume` geben dieser Gruppen-Backpressure jetzt zusaetzlich eine echte mehrpassige Cycle-Schicht mit Resume-Contract statt nur einzelner Auto-Follow-up-Laeufe
- `github-app-service-runtime-ops-review` buendelt Queue, Runtime-Claims, Loop-History, Recovery-Receipts, Recovery-Cycles und die neue Backpressure-Loop-Linie jetzt in eine gemeinsame priorisierte Betriebsuebersicht
- `github-app-service-runtime-integrity-review` validiert jetzt zusaetzlich Queue, Claims, History, Receipts und Artefakt-Referenzen gegeneinander und macht kaputte Verträge oder stale Pfade als eigene Integritaetsfehler sichtbar
- `github-app-service-runtime-maintenance-review` und `...-apply` heben diese Diagnosen jetzt auf eine konservative Maintenance-Ebene, die sichere Reclaim-Aktionen direkt ausfuehren kann und alles andere bewusst als manuelle Folgearbeit stehenlaesst
- `github-app-service-runtime-control-review` zieht `ops`, `integrity` und `maintenance` jetzt in eine einzige Abschlusskante zusammen und liefert damit die gemeinsame Runtime-Schlussbewertung fuer die GitHub-App-Service-Linie
- `github-app-service-runtime-closeout-review` legt diese Abschlusskante jetzt direkt auf die Road-to-100-Definition und liefert eine explizite Closeout-/Completion-Bewertung bis `100%`
- `github-app-live-pilot-review` schliesst daran jetzt direkt an und sagt explizit, ob der erste reale Pilot gerade als `pilot_bridge_ready`, `pilot_live_ready`, `pilot_followup_required` oder `pilot_blocked` gelten sollte
- `github-app-service-runtime-loop-history-review` macht diese langlebigeren Loop-Laeufe jetzt zudem als eigene History-/Recovery-Sicht ueber mehrere Runtime-Loops hinweg sichtbar
- `github-app-service-runtime-loop-review`, `run`, `resume` und ihre Unterpfade drucken jetzt ausserdem keine verschachtelten Zwischen-Summaries mehr, wenn sie intern auf Runtime-/Cycle-/Session-Kommandos aufsetzen
- damit kann ein gemeinsamer lokaler Service-Tick jetzt nicht mehr nur “das naechste passende Contract” nehmen, sondern bewusst mehrere Installationen gegeneinander priorisieren und in getrennte scheduler-scoped Runtime-Lanes aufspalten
- `github-app-service-requeue` respektiert jetzt zusaetzlich installation-spezifische Admin-Regeln fuer `blocked`, `dead-letter` und `claimed`
- `github-app-installation-scope` zeigt, welche Installations-Repositories watchlist-faehig sind und welche noch manuelle Klaerung brauchen
- `github-app-installation-handoff` gibt watchlist-faehige Repositories kontrolliert in die zugeordneten Projekt-Watchlists weiter

So wird aus der Installations-Registry schon heute ein echter Mehr-Repo-Vorbau, ohne dass wir dafuer schon eine komplette Live-App-Runtime brauchen.

Dieser Motor:

- leitet projektbezogene Discovery-Suchplaene aus Repo-Kontext und Alignment-Regeln ab
- liest dafuer zuerst die konfigurierten Markdown- und Strukturquellen des Zielrepos
- durchsucht GitHub heuristisch nach passenden Repositories
- nimmt GitHub-Links entgegen
- normalisiert sie
- erstellt Queue-Eintraege
- reichert GitHub-Metadaten und README-Inhalte an
- gleicht externe Muster gegen das Zielprojekt ab
- haertet Discovery-Handoffs mit projektbezogenen Policies
- kann Discovery jetzt schon auf Repo-, Lizenz-, Host-, Signal- und Capability-Gates pro Projekt vorsortieren
- kann stale oder fallback Decision-Daten in Queue und Intake-Dossiers neu berechnen
- kann Watchlist-Repos gesammelt gegen das Zielprojekt vergleichen
- schreibt fuer Kettenlaeufe eigene Automation-Audits mit Phasenstatus unter `runs/automation/`
- haelt optionalen Scheduler-Job-State unter `state/automation_jobs_state.json`
- schreibt Alert-Snapshots nach `state/automation_alerts.json` und `state/automation_alerts.md`
- kann Alert-Summaries jetzt auch bewusst nach `stdout`, Datei, `GITHUB_STEP_SUMMARY`, an lokale Hook-Commands oder ueber den eingebauten Hook `patternpilot-alert-hook` ausliefern
- kann jetzt manuelle Requalify-Latches fuer Folge-Runs halten und mit `run-requalify` bewusst wieder freigeben
- kann den aktuellen PAT-/GitHub-App-Reifegrad mit `github-app-readiness` gegen den spaeteren Integrationspfad sichtbar machen
- kann mit `github-app-live-pilot-review` jetzt ausserdem den ersten echten Pilot konservativ zwischen PAT-Bruecke, Live-App-Versuch und verbleibenden Blockern einordnen
- schreibt menschenfreundliche HTML-Reports fuer Discovery- und Review-Laeufe
- haelt fuer jedes Projekt einen direkten Report-Pointer in `projects/<project>/reports/browser-link`
- schreibt Metadaten zum letzten Projekt-Report nach `projects/<project>/reports/latest-report.json`
- haelt lokal generierte `STATUS.md` und `OPEN_QUESTION.md` als Uebergabeflaechen fuer Agenten aktuell
- legt projektbezogene Intake-Dossiers an
- schreibt Run-Protokolle
- kann Promotion-Pakete vorbereiten oder direkt anwenden

Wichtig:

Die Intake-Queue ist bewusst **vor** der kuratierten Landkarte geschaltet.
Neue Links landen zuerst in `state/repo_intake_queue.csv` und im jeweiligen Dossier, nicht direkt in `knowledge/repo_landkarte.csv`.

Ebenso wichtig:

Patternpilot verankert keine harte Projektoberflaeche wie `docs/` in seinem Produktkern.
Es nutzt pro Zielprojekt nur die dort konfigurierten Kontextquellen als schnelle Einleseschicht und zeigt in Reports transparent, was fuer den jeweiligen Lauf tatsaechlich gelesen wurde.

Ordnungslogik:

- `STATUS.md` und `OPEN_QUESTION.md` bleiben lokal im Repo-Root als operative Handoff-Schicht, sind aber bewusst keine versionierten Produktdateien.
- `knowledge/repo_decisions.md` gehoert nicht in diese Handoff-Schicht, sondern zur kuratierten Wissensebene zusammen mit `knowledge/repo_landkarte.csv` und `knowledge/repo_learnings.md`.

---

## Startzustand

Dieses Repo startet bewusst klein, aber strukturiert.

Es enthaelt:

- Leitdateien für Bewertungs- und Entscheidungslogik
- kontrollierte Vokabulare
- eine erste Seed-Landkarte relevanter Repos
- verdichtete Learnings
- erste Entscheidungen
- Projektkontext für `eventbear-worker`
- Startprompts für Coding- und Research-Agenten
- einen ersten Intake-Motor fuer GitHub-Links
- projektgebundene Binding-Dateien fuer `eventbear-worker`

Wichtig:

Die Datei `knowledge/repo_landkarte.csv` ist **ein Seed-Stand**, kein endgültiger Wahrheitsbestand.
Sie enthält erste, bereits gesichtete Repos als Startmaterial und soll iterativ geschärft, erweitert und bereinigt werden.

---

## Ziel fuer EventBaer

`patternpilot` soll EventBär helfen bei:

- besseren Architekturentscheidungen
- Lernen von bestehenden Repos und Produkten
- Identifikation wiederverwendbarer Muster
- Einordnung von Single-Source- vs. Multi-Source-Ansätzen
- Bewertung von Distribution-Surfaces wie API, Widget, WordPress Plugin oder White-Label
- klaren Build-vs-Borrow-Entscheidungen
- strategischer Weiterentwicklung statt bloßem Bauchgefühl
- strukturiertem Intake statt losem Link-Sammeln

---

## Kernprinzip

`patternpilot` arbeitet nach einer einfachen Logik:

1. finden
2. einordnen
3. verstehen
4. verdichten
5. entscheiden
6. für das konkrete Projekt nutzbar machen

---

## Schnellstart

### Projektbindung ansehen

```bash
npm run show:project -- --project eventbear-worker
```

### Primaerer On-Demand-Flow mit explizitem Repo

```bash
npm run analyze -- --project eventbear-worker https://github.com/City-Bureau/city-scrapers
```

### Run-Typ vorab einordnen

```bash
npm run run-plan -- --project eventbear-worker
npm run run-plan -- --project eventbear-worker --scope automation
npm run run-drift -- --project eventbear-worker
npm run run-governance -- --project eventbear-worker --scope automation
npm run run-requalify -- --project eventbear-worker --scope automation
```

Damit wird ein geplanter Lauf als `first_run`, `follow_up_run` oder `maintenance_run` eingeordnet und mit einer Default-Phase-Form fuer Intake, Re-Evaluate, Review und Promote versehen.

Zusatznutzen:

- `maintenance_run` zieht jetzt standardmaessig `stale_only` fuer Re-Evaluate im Automation-Pfad nach sich
- retrybare Fehler in fruehen Phasen koennen klarer als Auto-Resume-Faelle erkannt werden
- Review- und Promote-Ausfaelle bleiben bewusst manuell zu pruefen
- `run-drift` zeigt dazu jetzt auch den echten Mehrlauf-Zustand: URL-Delta, Queue-Staleness, Rules-Fingerprint-Mix und eine konkrete Resume-Empfehlung
- `run-governance` setzt darauf auf und sagt explizit, ob ein Folge-Run manuell, nur begrenzt unattended oder wirklich unattended-ready ist
- `run-requalify` zeigt danach bewusst, ob ein latched Instabilitaetsfall schon wieder freigegeben werden darf oder noch weiter manuelle Stabilisierung braucht

### Discovery-Policy gegen echte Treffer kalibrieren

```bash
npm run policy:audit -- --project eventbear-worker --dry-run
```

Der Audit-Modus blendet policy-geflaggte Treffer nicht aus, sondern zeigt zusaetzlich Kalibrierungshinweise und Top-Blocker pro Lauf.

### Discovery-Kandidaten offline importieren

```bash
npm run discover:import -- --project eventbear-worker --file projects/eventbear-worker/calibration/discovery-candidates.example.json --dry-run
```

Damit kannst du eine manuell kuratierte Kandidatenliste in einen echten Discovery-Run ueberfuehren, inklusive Policy-Gates, Summary, HTML-Report und spaeterer Review-/Calibration-Kompatibilitaet.

### Mehrere gespeicherte Discovery-Runs zusammen kalibrieren

```bash
npm run policy:calibrate -- --project eventbear-worker
```

Das erzeugt eine projektweite Zusammenfassung ueber gespeicherte Discovery-Runs und zeigt, welche Policy-Blocker und Kalibrierungsstatus sich ueber mehrere Laeufe hinweg haeufig wiederholen.

### Aktuelle Policy gegen alternative JSON-Datei vergleichen

```bash
npm run policy:compare -- --project eventbear-worker --policy-file bindings/eventbear-worker/DISCOVERY_POLICY.next.json
```

Das vergleicht den aktuellen Projekt-Policy-Stand mit einer alternativen JSON-Datei gegen dieselben gespeicherten Discovery-Runs und zeigt, wie sich `audit_flagged`, `enforce_hidden` und `preferred_hits` veraendern wuerden.

### Kalibrierungspaket fuer ein Projekt schreiben

```bash
npm run policy:pack -- --project eventbear-worker --policy-file bindings/eventbear-worker/DISCOVERY_POLICY.next.json
```

Das schreibt unter `projects/<project>/calibration/packets/<packet-id>/` einen gebuendelten Arbeitsstand mit aktuellem Policy-Snapshot, Mehrlauf-Kalibrierung, optionalem Policy-Vergleich und einer kompakten `summary.md`.

### Candidate-Level-Workbench fuer die Policy-Schaerfung schreiben

```bash
npm run policy:workbench -- --project eventbear-worker
```

Das schreibt unter `projects/<project>/calibration/workbench/<workbench-id>/` eine Kandidatenmatrix, kopiert die aktuelle Policy als `proposed-policy.json` und schafft damit eine saubere manuelle Schaerfungsschleife fuer `policy:compare` und `policy:pack`.

### Kalibrierung als geschlossene Schleife ausfuehren

```bash
npm run policy:cycle -- --project eventbear-worker
```

Das fuehrt `review -> suggest -> trial -> replay` in einem gebuendelten Lauf zusammen und schreibt unter `projects/<project>/calibration/cycles/<cycle-id>/` einen kompletten Arbeitsstand mit:

- `summary.md`
- `suggested-policy.json`
- `effective-policy.json`
- `trial-candidate-matrix.json`
- `replay-summary.md`
- `replay-report.html`

Optional kannst du die wirksame Policy auch direkt anwenden:

```bash
npm run policy:cycle -- --project eventbear-worker --apply
```

### Cycle-Kandidaten direkt in den normalen Review-Pfad uebergeben

```bash
npm run policy:handoff -- --project eventbear-worker
```

Das nimmt standardmaessig die `newly_visible` Kandidaten aus dem letzten `policy-cycle` und schiebt sie direkt in den normalen `on-demand` Intake-/Review-Pfad. So wird aus Kalibrierung ein echter fachlicher Handoff statt nur ein Policy-Artefakt.

Wenn im Cycle bereits starke Replay-Kandidaten mit angereichertem Kontext vorliegen, nutzt der Handoff diese Seeds direkt fuer den Intake. Dadurch bleibt die Qualitaet zwischen Kalibrierung und echtem Review-Pfad stabiler und faellt nicht sofort auf schwaches Live-Enrichment zurueck.

### Handoff-Kandidaten gezielt kuratieren und Promotion vorbereiten

```bash
npm run policy:curate -- --project eventbear-worker --prepare-promotions
```

Das rankt die Kandidaten aus dem letzten `policy-handoff`, schreibt einen eigenen Kurationsreport und kann direkt Promotion-Pakete vorbereiten. Damit wird aus dem Handoff ein echter Schritt Richtung Landkarte, Learnings und Decisions, ohne schon automatisch die kanonischen Wissensdateien zu veraendern.

### Kurations-Apply erst previewen, dann gezielt anwenden

```bash
npm run policy:curation-review -- --project eventbear-worker --limit 1
npm run policy:curation-batch-review -- --project eventbear-worker --limit 2
npm run policy:curation-batch-plan -- --project eventbear-worker --limit 3
npm run policy:curation-batch-apply -- --project eventbear-worker --limit 2
npm run policy:curation-apply -- --project eventbear-worker --limit 1
```

`policy:curation-review` zeigt, welche kuratierten Kandidaten die kanonischen Wissensdateien beruehren wuerden. `policy:curation-batch-review` hebt denselben Schritt auf Batch-Ebene und zeigt Ueberschneidungen, bereits uebernommene Kandidaten und die verbleibende Apply-Menge. `policy:curation-batch-plan` baut daraus eine Governance-Sicht mit empfohlenen Teil-Batches, sicheren Apply-Kandidaten und expliziten Manual-Review-Faellen. `policy:curation-apply` nutzt genau diesen Review-Schritt als kontrollierte Vorstufe und fuehrt dann den eigentlichen `promote --apply` nur fuer die ausgewaehlten Kandidaten aus. `policy:curation-batch-apply` macht dasselbe fuer mehrere vorbereitete Kandidaten zusammen, laesst bereits promovierte Repos bewusst unberuehrt und nimmt standardmaessig nur die sicheren Batch-Kandidaten mit.

### Workbench-Verdikte und Proposed Policy auswerten

```bash
npm run policy:workbench-review -- --project eventbear-worker
```

Das liest `rows.json`, fasst manuelle Verdikte wie `false_block` oder `confirm_block` zusammen und spiegelt die `proposed-policy.json` gegen den Source-Run der Workbench.

### Policy-Vorschlag direkt aus der Workbench ableiten

```bash
npm run policy:suggest -- --project eventbear-worker
```

Das erzeugt `suggested-policy.json` plus eine Vergleichszusammenfassung. Mit `--apply` wird die vorgeschlagene Variante direkt nach `proposed-policy.json` gespiegelt.

### Trial-Simulation vor dem Anwenden fahren

```bash
npm run policy:trial -- --project eventbear-worker
```

Das spielt die Trial-Policy gegen den Source-Run der Workbench durch und schreibt eine Candidate-Matrix mit `newly_visible` oder `newly_hidden`, bevor irgendetwas auf die echte Projekt-Policy zurueckgeschrieben wird.

### Vorgeschlagene Policy sicher anwenden

```bash
npm run policy:apply -- --project eventbear-worker --workbench-dir projects/eventbear-worker/calibration/workbench/<workbench-id>
```

Das schreibt Snapshots in `projects/<project>/calibration/history/`, aktualisiert die Projekt-Policy und haelt die Anwendung in den Kalibrierungsnotizen fest.

### Vorhandenen Discovery-Run gegen aktuelle Policy pruefen

```bash
npm run policy:review -- --project eventbear-worker
```

Damit kannst du einen gespeicherten Discovery-Run nachtraeglich gegen die aktuelle Policy spiegeln und sehen, was im `audit`- versus `enforce`-Modus sichtbar oder verborgen waere.

### Primaerer On-Demand-Flow auf Basis der Watchlist

```bash
npm run patternpilot -- on-demand --project eventbear-worker --analysis-profile architecture
```

### Gebundene Projekte anzeigen

```bash
npm run list:projects
```

### Workspace nach Git-Repos scannen

```bash
npm run discover:workspace
```

### Neues Projekt an Patternpilot anbinden

```bash
npm run init:project -- --project sample-worker --target ../sample-worker --label "Sample Worker"
```

### Projekt-Watchlist einsammeln

```bash
npm run sync:watchlist -- --project eventbear-worker --dry-run
```

### Alle Watchlists einsammeln

```bash
npm run sync:all -- --dry-run
```

### Optionalen Automationslauf fahren

```bash
npm run automation:run -- --all-projects --promotion-mode prepared --dry-run
```

Oder fuer einen projektgebundenen Kettenlauf mit Discovery-Gate:

```bash
npm run automation:run -- --project eventbear-worker --automation-min-confidence medium --automation-max-new-candidates 5 --automation-re-evaluate-limit 20
```

### Scheduler-Job-Lage ansehen

```bash
npm run automation:jobs
```

### Naechsten Scheduler-Job dispatchen

```bash
npm run automation:dispatch -- --dry-run
```

### Alerts und Manual Resume

```bash
npm run automation:alerts
npm run patternpilot -- automation-job-clear --automation-job eventbear-worker-apply --notes "manual resume after fix"
```

### Decision-Daten neu bewerten

```bash
npm run re-evaluate -- --project eventbear-worker --stale-only --dry-run
```

### GitHub-/Token-Diagnose laufen lassen

```bash
npm run doctor -- --offline
```

### Heuristische GitHub-Discovery fuer ein Projekt laufen lassen

```bash
npm run discover:github -- --project eventbear-worker --discovery-profile balanced --report-view standard --dry-run
```

Discovery-Profile:

- `focused`: kleine, schnelle Suchmenge
- `balanced`: sinnvoller Standard
- `expansive`: breiter Discovery-Sweep
- `max`: bis maximal 100 Kandidaten, nur fuer gezielte grosse Suchlaeufe

### Discovery mit zusaetzlichem Suchfokus und direktem Intake

```bash
npm run patternpilot -- discover --project eventbear-worker --query "calendar scraper venue" --intake
```

### Watchlist-Repos gesammelt gegen das Zielprojekt vergleichen

```bash
npm run review:watchlist -- --project eventbear-worker --analysis-profile architecture --analysis-depth deep --dry-run
```

Report-Views:

- `compact`: knapper Report mit wenig Ueberforderung
- `standard`: sinnvoller Standard
- `full`: mehr Kandidaten und mehr Vergleichsdetails

HTML-Ausgabe:

- Discovery schreibt nach `projects/<project>/reports/discovery-<profil>.html`
- Watchlist-Review schreibt nach `projects/<project>/reports/watchlist-review-<profil>-<tiefe>.html`
- zusaetzlich liegt pro Run auch `summary.html` im Run-Ordner

Uebergabedateien:

- `STATUS.md` zeigt den aktuellen Patternpilot-Betriebsstand
- `OPEN_QUESTION.md` haelt die wirklich offenen Produkt- und Betriebsfragen sichtbar
- die Kernlaeufe aktualisieren diese Dateien automatisch
- beide Dateien sind lokale, generierte Arbeitsflaechen und nicht Teil des versionierten Produktkerns
- zusaetzlich gibt es `npm run refresh:context`

Analyse-Profile:

- `balanced`: Architektur, Chancen und Risiken gemeinsam
- `architecture`: Worker-Schichten und wiederverwendbare Muster
- `sources`: Connector-Familien, Source-Systeme und Acquisition
- `distribution`: API, Feed, Plugin und Discovery-Surfaces
- `risk`: Lock-in, Wartung und Anti-Patterns

Analyse-Tiefen:

- `quick`: kompaktes Top-Level Review
- `standard`: sinnvoller Standard mit Repo-Matrix
- `deep`: breiterer Vergleich mit mehr Top-Kandidaten

### Lokale Env-Dateien anlegen

```bash
npm run init:env
```

### Fehlende Angaben und Fundstellen anzeigen

```bash
npm run setup:checklist
```

### GitHub-Links als Intake anlegen

```bash
npm run intake -- --project eventbear-worker https://github.com/City-Bureau/city-scrapers
```

Wenn `PATTERNPILOT_GITHUB_TOKEN`, `GITHUB_TOKEN` oder `GITHUB_PAT` gesetzt ist, nutzt Patternpilot dieses Token fuer hoehere GitHub-API-Limits und spaeter auch fuer private Repos.

Ein GitHub-Token ist hier ein API-Zugangsschluessel fuer GitHub, nicht die abrechnungsrelevanten Modell-Tokens eines LLMs.

### Mehrere Links aus Datei einlesen

```bash
npm run intake -- --project eventbear-worker --file links.txt
```

### Erst testen ohne Dateien zu schreiben

```bash
npm run intake -- --project eventbear-worker --file links.txt --dry-run
```

### Promotion-Pakete aus der Queue vorbereiten

```bash
npm run promote -- --project eventbear-worker --from-status pending_review
```

### Promotion direkt auf kuratierte Artefakte anwenden

```bash
npm run promote -- --project eventbear-worker --apply --from-status pending_review
```

### Remote-Anreicherung bewusst ueberspringen

```bash
npm run intake -- --project eventbear-worker --skip-enrich https://github.com/City-Bureau/city-scrapers
```

---

## Repo-Struktur

### Identitaet und Betrieb

- `docs/foundation/MISSION_VISION.md`
- `docs/foundation/OPERATING_MODEL.md`
- `docs/foundation/AUTOMATION_ROADMAP.md`
- `AGENT_CONTEXT.md`
- `CLAUDE.md`
- `patternpilot.config.json`
- `package.json`

### Kernlogik

- `docs/system/REPO_INTELLIGENCE_SYSTEM.md`
- `docs/taxonomy/PATTERN_FAMILIES.md`
- `docs/taxonomy/EVENTBAER_GAP_AREAS.md`
- `docs/taxonomy/BUILD_VS_BORROW.md`
- `docs/taxonomy/PRIORITY_FOR_REVIEW.md`

### Operative Arbeitsdateien

- `knowledge/repo_landkarte.csv`
- `state/repo_intake_queue.csv`
- `knowledge/repo_learnings.md`
- `knowledge/repo_decisions.md`
- `docs/reference/distribution_surfaces.md`
- `docs/reference/PROJECT_ALIGNMENT_MODEL.md`
- `docs/reference/GITHUB_TOKEN_SETUP.md`
- `docs/reference/GITHUB_APP_DEPLOYMENT.md`
- `docs/reference/SETUP_CHECKLIST.md`
- `docs/reference/WORKSPACE_PLUGIN_MODE.md`

### Kontrollierte Vokabulare

- `taxonomy/controlled_vocabulary/controlled_vocabulary_pattern_families.csv`
- `taxonomy/controlled_vocabulary/controlled_vocabulary_eventbaer_gap_areas.csv`
- `taxonomy/controlled_vocabulary/controlled_vocabulary_build_vs_borrow.csv`
- `taxonomy/controlled_vocabulary/controlled_vocabulary_priority_for_review.csv`

### Prompts

- `prompts/CLAUDE_VSCODE_SETUP_PROMPT.md`
- `prompts/repo_intake_prompt.md`
- `prompts/repo_review_prompt.md`
- `prompts/pattern_extraction_prompt.md`

### Projektkontext

- `bindings/README.md`
- `bindings/<project>/PROJECT_BINDING.md`
- `bindings/<project>/PROJECT_BINDING.json`
- `bindings/<project>/ALIGNMENT_RULES.json`
- `bindings/<project>/DISCOVERY_POLICY.json`
- `bindings/<project>/WATCHLIST.txt`
- `projects/README.md`
- `projects/<project>/PROJECT_CONTEXT.md`
- `projects/<project>/README.md`
- `projects/<project>/intake/`
- `projects/<project>/promotions/`
- `projects/eventbear-worker/` als aktuell gebuendelter Arbeitsraum fuer den Dogfood-Fall

### Motor

- `scripts/patternpilot.mjs`
- `lib/index.mjs`
- `lib/config.mjs`
- `lib/project.mjs`
- `lib/queue.mjs`
- `lib/discovery/`
- `lib/review.mjs`
- `lib/html-renderer.mjs`
- `lib/intake.mjs`
- `lib/promotion.mjs`

### Produktisierung

- `automation/`
- `deployment/github-app/`
- `plugins/patternpilot-workspace/`
- `.agents/plugins/marketplace.json`

---

## Arbeitsregel

Dieses System soll klein, klar und lebendig bleiben.

Das bedeutet:

- lieber wenige saubere Eintraege als viele lose
- lieber klare Learnings als bloße Repo-Beschreibungen
- lieber harte Entscheidungen als endlose Sammlung
- lieber sichtbare Priorisierung als Informationsmüll
- lieber saubere Projekttrennung als bequeme Vermischung
- lieber Intake plus Review als vorschnelle Wahrheit
- lieber wiederverwendbare Produktlogik als EventBaer-Sonderfall

---

## Langfristige Richtung

`patternpilot` ist bereits als eigenstaendiges lokales Produkt angelegt und kann sich weiter zu einem staerker installierbaren oder servicefaehigen System entwickeln, das Menschen oder Teams hilft, vorhandenes Wissen aus GitHub, Web, Tools und Produktmustern gezielt zu analysieren, zu strukturieren und fuer eigene Vorhaben nutzbar zu machen.

Im aktuellen Repo dient `eventbear-worker` als erster gebuendelter Dogfood-Pilot, nicht als harte Produktgrenze.

---

## Startfrage für jede neue Analyse

Bei jedem neuen Repo, Tool oder Produkt ist zuerst zu beantworten:

**Warum ist das für das aktuelle Projekt relevant und was könnte es konkret bedeuten?**

Wenn diese Frage nicht klar beantwortet werden kann, ist Zurückhaltung besser als bloßes Einsammeln.
