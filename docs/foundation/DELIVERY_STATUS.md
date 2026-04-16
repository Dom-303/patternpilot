# Delivery Status

## Zweck

Diese Datei haelt eine bewusst grobe, aber wiederverwendbare Einordnung fest:

- wie weit `patternpilot` heute insgesamt ist
- wie weit der Produktkern ist
- wie weit der vollautomatische Zielzustand ist
- welche grossen Ausbauachsen noch vor uns liegen

Wichtig:

Die Prozentwerte hier sind **nur Schaetzwerte**.
Sie sind kein exaktes Metriksystem, sondern eine gemeinsame Orientierung fuer Priorisierung und Erwartungsmanagement.

## Pflege-Regel

Diese Einordnung soll bewusst nur nach groesseren inhaltlichen Schritten nachgezogen werden.

Faustregel:

- aktualisieren nach echten Meilensteinen
- nicht bei jedem kleinen Turn
- besonders dann, wenn sich die Einschaetzung grob um etwa `3-5%` oder mehr verschiebt

---

## Stand

- last_updated: 2026-04-15
- einordnung_gilt_fuer: Kernsystem + Produktschale + Vollautomatik-Zielbild
- master_plan: `docs/superpowers/plans/2026-04-14-patternpilot-road-to-100.md`

## 100%-Definition

`100%` heisst hier nicht nur:

- der Kern laeuft lokal

sondern:

- der Kern ist belastbar
- die Discovery- und Review-Qualitaet ist gut kalibriert
- die Produktfuehrung ist klar
- Setup und Onboarding sind rund
- GitHub-Integration und Vollautomatik sind sauber anschliessbar
- das Repo ist freigabefaehig, erklaerbar und nicht mehr nur ein interner Arbeitsraum

---

## Grobe Schaetzung

### Gesamtprodukt

- schaetzung: `86-90%`
- begruendung: Der Kernel ist stark, Discovery/Kuration laufen kontrolliert bis in die kanonische Wissensschicht, und Folge-Run-/Drift-/Governance-Logik ist jetzt inklusive Stabilitaets-, Requalify-, installation-scoped Worker-Routing-, Runtime-Schedule-, lane-scoped Service-Scheduler-, worker-scoped Runtime-, Runtime-Claim-/Lease-, Runtime-Cycle-, Runtime-Session- und Runtime-Loop-Schicht samt sauberer interner CLI-Komposition operativ belastbarer. Produktisierung, Onboarding, GitHub-App-Cutover, Release-Haertung und echte Vollautomatik fehlen aber weiter.

### Kernsystem

- schaetzung: `80-85%`
- drin: Intake, Discovery, Review, HTML-Reports, Decision-Layer, Re-Evaluate, Policy-Gates, On-Demand-Flow, Automation-Grundlagen
- offen: weitere Kalibrierung gegen reale Runs, weniger Rest-Unschaerfe in Discovery und Policy-Defaults

### On-Demand-Produktpfad

- schaetzung: `75-80%`
- drin: explizite Repo-Analyse, fokussierte Reviews, Run-Landing, What-now-Schicht, stabile Report-Pointer
- offen: spaeteres First-Run-Onboarding, noch klarere Nutzerfuehrung und fertige Produktschale

### Wiederkehrende Automation

- schaetzung: `80-84%`
- drin: Chain-Run, Job-State, Alerting, Dispatch, Locking, Retry-Klassifikation, Manual-Clear, Run-Lifecycle-Defaults, sichtbare Run-Drift- und Stability-Signale, explizite Governance fuer unattended versus manuell, Requalify-Latches fuer instabile Folge-Run-Schleifen und jetzt installation-scoped Worker-/Scheduler-Routing plus scheduler-scoped Runtime-Schedules, lane-scoped Service-Scheduler-Orchestrierung, worker-scoped Runtime-Pfade, Runtime-Claim-/Lease-Governance, mehrschleifige Runtime-Cycles, langlebigere Runtime-Sessions, erste Runtime-Loops und saubere interne Komposition fuer die lokale GitHub-App-Servicekante
- offen: echte produktive Scheduler-Einbettung, noch schaerfere Auto-Resume-Regeln gegen reale Betriebsfaelle, erste reale Benachrichtigungskanaele, mehr Kalibrierung im echten Betrieb

### Vollautomatisches Zielbild

- schaetzung: `63-68%`
- drin: wichtige technische Grundbausteine fuer Vollautomatik sind angelegt, inklusive Lifecycle-, Drift-, Stability- und Governance-Sicht fuer Folge-Runs plus kontrollierter Requalify-Freigabe, installation-scoped Worker-/Scheduler-Routing, scheduler-scoped Runtime-Schedules, lane-scoped Service-Scheduler-Orchestrierung, worker-scoped Runtime-Pfade, Runtime-Claim-/Lease-Governance, mehrschleifige Runtime-Cycles, langlebigere Runtime-Sessions, erste Runtime-Loops und jetzt saubere interne Runtime-Komposition fuer spaetere Multi-Worker-Runtimes
- offen: GitHub-App-nahe Integration, fertiger Setup-/Onboarding-Flow, belastbare Default-Pipeline fuer Erst- und Folge-Runs, wirklich ausgereifte Unattended-Betriebslogik

### Freigabe-/Release-Reife

- schaetzung: `62-67%`
- drin: klarer Kern, Docs-Grundlage, CLI, Reports, Projektbindung, erste Produktform, kontrollierte Batch-Kuration bis in die Wissensschicht
- offen: Packaging, Installationspfad, Onboarding, Release-Doku, finale Abgrenzung von optionaler Automation versus Produktkern

---

## Ausbauachsen

### 1. Discovery-Qualitaet

Grundton:
Nicht mehr nur mehr finden, sondern besser finden.

Heute schon da:

- projektbezogene Discovery-Policies
- `policy-audit` pro Lauf
- `policy-review` fuer gespeicherte Runs
- `policy-calibrate` fuer die Mehrlauf-Sicht
- `policy-compare` fuer Vorher/Nachher-Vergleiche von Policy-Dateien
- `policy-pack` als gebuendelter Kalibrierungs-Arbeitsstand
- `discover-import` fuer manuelle Kandidaten-Snapshots als Discovery-Artefakte
- `policy-workbench` fuer Candidate-Level-Schaerfung mit `proposed-policy.json`
- `policy-workbench-review` fuer den manuellen Verdikt- und Vergleichsschritt
- `policy-suggest` fuer eine erste regelbasierte Policy-Vorschlagslogik aus echten Kalibrierungsfaellen
- `policy-cycle` als gebuendelten Review/Suggest/Trial/Replay-Lauf statt nur einzelner Kalibrierungsschritte
- `policy-handoff` als Bruecke von Kalibrierung in den echten On-Demand-Intake-/Review-Pfad
- Replay-/Handoff-Paritaet ist jetzt besser: starke Cycle-Kandidaten koennen ihren angereicherten Kontext in den echten Intake-Pfad mitnehmen
- `policy-curate` bringt diese Handoff-Kandidaten jetzt in einen expliziten Curation-/Promotion-Vorbereitungszustand
- `policy-curation-review` und `policy-curation-apply` machen daraus jetzt einen kontrollierten Wissens-Apply-Pfad statt nur losem `promote --apply`
- `policy-curation-batch-review` und `policy-curation-batch-apply` heben diesen Pfad jetzt auf kuratierte Batches, inklusive Overlap-Sicht und Skip-fuer-bereits-promovierte Kandidaten
- `policy-curation-batch-plan` trennt dabei jetzt sichere Teil-Batches von echten Manual-Review-Faellen
- erste reale Kandidaten sind damit jetzt kontrolliert bis nach `knowledge/repo_landkarte.csv`, `knowledge/repo_learnings.md` und `knowledge/repo_decisions.md` durchgelaufen
- `policy-trial` fuer eine sichere Candidate-Level-Vorher/Nachher-Simulation vor dem Anwenden
- `policy-apply` fuer sichere Rueckschreibung mit History-Artefakten
- Discovery-Runs behalten jetzt auch die volle policy-evaluated Kandidatenmenge fuer spaetere Policy-Arbeit

Naechste Themen:

- echte `policy-audit`- und `policy-review`-Laeufe gegen reale Discovery-Treffer
- echte `policy-calibrate`-Schleifen ueber mehrere reale Runs
- Blocker-Defaults und Prefer-Regeln pro Projekt schaerfen
- erst danach weitere Gate-Typen erfinden

### 2. Entscheidungsqualitaet

Grundton:
Nicht nur Signale sammeln, sondern belastbarer entscheiden.

Heute schon da:

- kontrollierte Einzel- und Batch-Kuration bis in die kanonische Wissensebene
- echte Promotion-Faelle fuer `citybureau/city-scrapers` und `oc/openevents`
- erste Governance-Regeln fuer sichere versus manuell zu pruefende kuratierte Batches

Naechste Themen:

- weitere echte Discovery-Treffer in Queue, Watchlist und Promotion ueberfuehren
- Learnings und Entscheidungen aus noch breiterem realem Material schaerfen
- Konflikt-/Ueberschneidungsregeln fuer groessere kuratierte Batches weiter haerten und kalibrieren
- spaeter bessere Vergleichs- und Priorisierungsregeln

### 3. Vollautomatik

Grundton:
Optional vollautomatisch, aber nicht auf Kosten des sauberen Kerns.

Heute schon da:

- ein explizites Folge-Run-Modell fuer `first_run`, `follow_up_run` und `maintenance_run`
- `run-plan` als sichtbare Vorab-Einordnung fuer manuelle und Automation-nahe Laeufe
- On-Demand- und Automation-Ausgaben tragen diese Lifecycle-Sicht jetzt mit
- Maintenance-Laeufe nutzen jetzt erste echte Betriebsdefaults fuer `stale_only` Re-Evaluate und Resume-Empfehlungen bei Fehlern
- `run-drift` macht Mehrlauf-Drift, Queue-Staleness und Resume-Hinweise jetzt als eigenes Artefakt sichtbar
- `run-governance` macht daraus jetzt explizit: manuell, begrenzt unattended oder unattended-ready
- `run-stability` und `run-requalify` machen jetzt sichtbar, ob mehrfache Folge-Runs stabil genug sind und wann eine latched Requalify-Sperre wieder bewusst geloest werden darf
- `automation-alert-deliver` liefert Alert-Summaries jetzt ueber erste echte Aussenkanaele wie Datei, `GITHUB_STEP_SUMMARY`, lokale Hook-Commands oder den eingebauten Hook `patternpilot-alert-hook` aus, ohne den Kern auf einen Kanal festzunageln

Naechste Themen:

- GitHub-App als spaeterer echter Integrationsmodus
- `github-app-readiness` als fruehe Bruecke zwischen aktuellem CLI/PAT-Betrieb und spaeterer App-Integration weiter nutzen und schaerfen
- `github-app-plan` beschreibt jetzt Rechte, Event-Bindings und Command-Pfade fuer den spaeteren App-Cutover explizit
- `github-app-event-preview` kann jetzt einzelne Event-Payloads gegen den aktuellen Kernel spiegeln, bevor echte Webhooks oder Installationsfluesse live gehen
- `github-app-webhook-preview` modelliert jetzt lokal Header, Delivery-ID, Signaturpruefung und das interne Envelope fuer spaetere echte Webhook-Zustellung
- `github-app-webhook-route` baut jetzt aus einem verifizierten Envelope schon konkrete lokale Route-Plaene und Command-Vorschlaege
- `github-app-webhook-dispatch` baut jetzt darueber eine kontrollierte lokale Dispatch-Schicht und unterscheidet sauber zwischen Preview, ausfuehrbar, force-gated und guarded
- `github-app-execution-run` trennt jetzt den spaeteren Runner-Pfad explizit vom Dispatch und konsumiert `execution-contract.json` als eigene lokale Ausfuehrungsschicht
- die Runner-Schicht schreibt jetzt auch `recovery-assessment.json` und `recovery-contract.json`, damit Retry-/Backoff- und Wiederaufnahme-Regeln fuer spaetere Service-Runtimes maschinenlesbar werden
- `github-app-execution-recover` ergaenzt jetzt den schnellen Resume-Pfad um einen expliziten Recovery-Gate-Flow
- `github-app-execution-enqueue` und `github-app-service-tick` fuegen jetzt die erste kleine lokale Queue-/Service-Schicht ueber den Runner-Contracts hinzu
- diese Service-Schicht kann Contracts jetzt auch claimen und mit Lease-Zeiten voruebergehend exklusiv halten, statt nur blind aus `pending` zu lesen
- Duplicate-Schutz und ein erster `dead-letter`-Pfad sind jetzt ebenfalls Teil dieser Service-Schicht
- `github-app-service-review` und `github-app-service-requeue` bilden jetzt die erste explizite Manual-Release-Kante fuer festgefahrene Service-Contracts
- `github-app-installation-review`, `github-app-installation-apply` und `github-app-installation-show` fuegen jetzt eine erste lokale Installations-/Repo-Scope-Registry hinzu
- `github-app-installation-scope` und `github-app-installation-handoff` machen daraus jetzt den ersten echten Mehr-Repo-Handoff Richtung Projekt-Watchlists
- `github-app-installation-governance-review` und `github-app-installation-governance-apply` geben dieser Installationslinie jetzt zusaetzlich eine explizite Policy-Schicht
- `github-app-installation-runtime-review` und `github-app-installation-runtime-apply` koppeln diese Installationslinie jetzt an einen eigenen Betriebsmodus pro Installation
- `github-app-installation-operations-review` und `github-app-installation-operations-apply` koppeln diese Linie jetzt zusaetzlich an Watchlist-/Service-Betriebslogik pro Installation
- dieselbe Installations-Operationsschicht gate’t jetzt auch tatsaechlich den lokalen Queue-/Runner-Pfad ueber `github-app-service-review` und `github-app-service-tick`
- dieselbe Installations-Operationsschicht gate’t jetzt auch manuelle Requeue-/Release-Pfade ueber `github-app-service-requeue`
- `github-app-installation-service-lane-review` und `github-app-installation-service-lane-apply` legen jetzt zusaetzlich installierte Service-Lanes mit Tick-Disposition und Concurrency-Cap pro Installation fest
- `github-app-service-tick` respektiert diese Installations-Lanes jetzt ebenfalls und waehlt dadurch nicht mehr nur global, sondern lane-aware pro Installation
- `github-app-installation-service-plan-review` und `github-app-installation-service-plan-apply` legen jetzt zusaetzlich eine gemeinsame Service-Planung pro Installation mit Prioritaet, Tick-Budget und Contract-Fokus fest
- `github-app-service-tick` respektiert diese Shared-Service-Plaene jetzt ebenfalls und waehlt dadurch nicht mehr nur lane-aware, sondern auch plan-aware ueber mehrere Installationen hinweg
- `github-app-installation-worker-routing-review` und `github-app-installation-worker-routing-apply` legen jetzt zusaetzlich Worker-Zuordnung, erlaubte Worker-Pools und Scheduler-Lanes pro Installation fest
- `github-app-service-tick` respektiert diese Worker-Routing-Regeln jetzt ebenfalls und blockt Worker-Mismatches oder manuelle Worker-Freigaben explizit
- `github-app-installation-service-schedule-review` und `github-app-installation-service-schedule-apply` verdichten diese Ebenen jetzt zusaetzlich zu einer echten scheduler-scoped Runtime-Schedule pro Installation
- `github-app-service-tick` kann jetzt per `--scheduler-lane` gezielt einzelne Runtime-Lanes verarbeiten und blockt Schedule-Mismatches explizit
- `github-app-service-scheduler-review` und `github-app-service-scheduler-run` heben diese Runtime-Lanes jetzt zusaetzlich auf eine echte Scheduler-Orchestrierung ueber mehrere lane-scoped Service-Ticks
- `github-app-service-runtime-review` und `github-app-service-runtime-run` verdichten diese Scheduler-Orchestrierung jetzt weiter zu worker-scoped Runtime-Pfaden ueber mehrere Worker
- diese worker-scoped Runtime-Pfade haben jetzt zusaetzlich eine eigene Claim-/Lease-Governance gegen doppelte parallele Ausfuehrung
- `github-app-service-runtime-cycle-review` und `github-app-service-runtime-cycle-run` heben diese worker-scoped Runtime-Schicht jetzt weiter auf mehrschleifige Runtime-Zyklen mit expliziten Stoppgruenden und eigenen Zyklus-Artefakten
- `github-app-service-runtime-session-review`, `github-app-service-runtime-session-run` und `github-app-service-runtime-session-resume` heben diese Runtime-Zyklen jetzt weiter auf langlebigere Runtime-Sessions mit Session-State, Resume-Contract und mehrrundiger Fortsetzung
- `github-app-service-runtime-loop-review`, `github-app-service-runtime-loop-run` und `github-app-service-runtime-loop-resume` heben diese Runtime-Sessions jetzt weiter auf langlebigere Runtime-Loops mit Loop-State, Resume-Contract und Fortsetzung ueber mehrere Sessions
- die Runtime-/Cycle-/Session-/Loop-Kommandos koennen jetzt zudem intern ohne doppelte Zwischen-Ausgabe komponiert werden, was den spaeteren Service-Runtime-Pfad sauberer macht
- damit ist die GitHub-App-Service-Schicht jetzt zum ersten Mal wirklich multi-installation-faehig gedacht und nicht nur eine Sammlung isolierter Contract-Pfade
- klarer Erstlauf plus Folge-Run-Logik
- definierte Defaults fuer wiederkehrende Laeufe
- belastbare Folgezyklen fuer zweite, dritte, vierte und spaetere Runs

### 4. Produktschale

Grundton:
Der Nutzer soll reinfinden, ohne den Kernel zu kennen.

Naechste Themen:

- First-Run-Onboarding
- Projektwahl und gefuehrte Einrichtung
- klarere Oberflaechen fuer Reports, Runs und Folgeaktionen

### 5. Freigabe und Distribution

Grundton:
Von intern stark zu extern gut benutzbar.

Naechste Themen:

- Installations- und Bindungsweg fuer andere Repos
- Packaging und Release-Doku
- klare Trennung zwischen Produktkern, optionaler Automation und spaeteren Integrationskanälen

---

## Kurzfazit

`patternpilot` ist nicht mehr im fruehen Rohbau.

Es ist heute:

- ein starker Repo-Intelligence-Kern
- ein brauchbarer On-Demand-Produktpfad
- ein halb aufgebauter Automations- und Vollautomatik-Unterbau

Der groesste Weg zu `100%` liegt jetzt **nicht** mehr im Erfinden neuer Kernmechanik,
sondern in:

- Kalibrierung mit echten Runs
- sauberer Produktschale
- GitHub-App-/Integrationsreife
- und der letzten Strecke zur wirklich freigabefaehigen Vollautomatik.
