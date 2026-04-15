# Patternpilot Road to 100 — Master Implementation Plan

> **For agentic workers:** Use this plan as the long-running reference track for the next major `patternpilot` build phases. Steps use checkbox syntax so they can later be tracked phase by phase.

**Goal:** Fuehre `patternpilot` vom heutigen starken Kernzustand zu einem wirklich freigabefaehigen Produkt mit belastbarer Discovery-Qualitaet, starker Entscheidungsqualitaet, produktneutraler Vollautomatik-Basis, spaeterem GitHub-App-Cutover, sauberem Onboarding und klarer Release-Reife.

**Current baseline:** Laut `docs/foundation/DELIVERY_STATUS.md` steht `patternpilot` heute grob bei `75-79%` Gesamtprodukt, `80-85%` Kernsystem, `75-80%` On-Demand-Pfad, `68-72%` wiederkehrender Automation und `50-55%` Vollautomatik-Zielbild.

**Architecture principle:** Weiterhin zuerst den produktneutralen Kernel haerten und kalibrieren. Erst wenn Discovery, Decision-Layer und Folge-Run-Betrieb belastbar sind, werden Produktschale, GitHub-App und First-Run-Onboarding als echte Produktflaechen ausgebaut.

**Non-goals for this plan:**
- Kein vorschneller UI-/App-Ausbau, der ungelöste Kernel-Themen verdeckt
- Kein GitHub-Actions-zentrierter Produktpfad
- Keine LLM-Zentrierung vor stabiler heuristischer und operativer Basis

---

## Strategic Tracks

### Track A — Discovery Quality Calibration

**Why now:** Der Kern hat Discovery-Policies, `policy-audit`, `policy-review` und Calibration-Hinweise. Der groesste naechste Hebel ist jetzt, reale Discovery-Signale sauberer zu machen.

**Outcome:** Projektbezogene Discovery liefert nicht nur viele Kandidaten, sondern brauchbare Kandidaten mit nachvollziehbaren Gates.

### Track B — Decision and Curation Quality

**Why next:** Gute Discovery ist nur wertvoll, wenn daraus belastbare Queue-, Review-, Promotion- und Learnings-Entscheidungen entstehen.

**Outcome:** Patternpilot wird staerker von einer Finding-Maschine zu einer belastbaren Entscheidungsmaschine.

### Track C — Follow-up Runs and Optional Full Automation

**Why later:** Vollautomatik bleibt Zielbild, aber nicht vor belastbaren Erst- und Folge-Run-Defaults.

**Outcome:** Wiederkehrende Laeufe koennen spaeter optional unattended laufen, ohne den Produktkern scheduler-zentriert zu machen.

### Track D — Product Shell, Onboarding, Release

**Why last:** Diese Schicht soll den Nutzer elegant reinfuehren, nicht ungelöste Kernfragen kaschieren.

**Outcome:** Ein freigabefaehiger, installierbarer und erklaerbarer Produktzustand.

---

## Phase 1 — Real Discovery Calibration

### Goal

Discovery-Policies gegen echte Discovery-Treffer pruefen und die ersten projektbezogenen Defaults belastbar machen.

### Progress Snapshot

- status: started
- groundwork_done:
  - `policy-audit` liefert Lauf-Kalibrierung und Top-Blocker pro Discovery-Run
  - `policy-review` kann gespeicherte Discovery-Runs gegen die aktuelle Policy spiegeln
  - `policy-calibrate` aggregiert mehrere gespeicherte Discovery-Runs zu einem Projektbild
  - `policy-compare` macht Policy-Aenderungen gegen denselben Run-Bestand vergleichbar
  - `policy-pack` schreibt einen gebuendelten Arbeitsstand pro Projekt statt nur einzelner Einzelausgaben
  - `discover-import` kann manuelle Kandidaten-Snapshots als echte Discovery-Runs schreiben
  - `policy-workbench` erzeugt eine Candidate-Level-Arbeitsflaeche mit `proposed-policy.json`
  - `policy-workbench-review` fasst Verdikte und Proposed-Policy-Wirkung fuer denselben Source-Run zusammen
  - `policy-suggest` kann daraus schon eine erste `suggested-policy.json` mit Delta zum Source-Run ableiten
  - `policy-cycle` kann Review, Suggestion, Trial und Replay jetzt als einen zusammenhaengenden Kalibrierungslauf schreiben
  - `policy-handoff` kann die sichtbar gewordenen Cycle-Kandidaten direkt in den normalen On-Demand-Pfad ueberfuehren
  - `policy-curate` kann diese Handoff-Kandidaten inzwischen auch direkt fuer Promotion und Wissenskurationsarbeit vorsortieren
  - `policy-curation-review` und `policy-curation-apply` koennen daraus jetzt einen kontrollierten Apply-Pfad in die kanonische Wissensschicht machen
  - `policy-curation-batch-review` und `policy-curation-batch-apply` koennen mehrere vorbereitete Kandidaten jetzt gemeinsam reviewen, Ueberschneidungen sichtbar machen und bereits promovierte Repos bewusst ueberspringen
  - `policy-trial` spielt diese Variante auf Kandidatenebene als Vorher/Nachher-Simulation durch
  - `policy-apply` schreibt eine vorgeschlagene Policy mit History-Snapshots und Notizen sauber ins Projekt zurueck
- current_limit: Die vorhandenen gespeicherten `eventbear-worker`-Discovery-Runs enthalten aktuell noch keine Kandidaten; die eigentliche Schaerfung braucht daher den naechsten echten Discovery-Schub mit realen Treffern.

### Deliverables

- mehrere reale `policy-audit`-Laeufe gegen `eventbear-worker`
- mehrere `policy-review`-Auswertungen vorhandener Runs
- geschaerfte `projects/eventbear-worker/DISCOVERY_POLICY.json`
- kurze policy-notes oder calibration-notes pro Projekt

### Tasks

- [ ] echte Discovery-Runs mit Netz gegen `eventbear-worker` fahren und Artefakte sammeln
- [ ] `policy-audit` fuer dieselben Runs dokumentieren
- [ ] `policy-review` fuer relevante gespeicherte Runs dokumentieren
- [ ] haeufigste Blocker-Arten clustern: zu hart, sinnvoll, spaeter nur prefer
- [ ] `eventbear-worker`-Policy in mindestens einer Schleife nachschaerfen
- [ ] einmal bewusst pruefen, welche Gates nur `audit/prefer` statt `enforce/block` sein sollten
- [ ] Calibration-Ergebnis knapp in Docs oder Projekt-Notizen sichern

### Exit Criteria

- die haeufigsten Discovery-Blocker fuer `eventbear-worker` sind nicht mehr nur vermutet, sondern an echten Runs geprueft
- die Policy ist mindestens einmal bewusst nachgeschaerft worden
- `policy-audit` und `policy-review` liefern nicht nur `no_candidates`, sondern reale verwertbare Kalibrierung

---

## Phase 2 — Decision and Promotion Tightening

### Goal

Aus besseren Discovery-Treffern belastbarere Queue-, Review- und Promotion-Entscheidungen ableiten.

### Deliverables

- besserer Fluss von Discovery -> Intake -> Review -> Promotion
- staerkere Nachvollziehbarkeit fuer Adopt/Study/Watch/Defer
- mehr echtes Material in Landkarte/Learnings/Decisions

### Progress Snapshot

- status: active
- groundwork_done:
  - Handoff-Kandidaten koennen kontrolliert in Curation ueberfuehrt werden
  - `policy-curation-review` und `policy-curation-apply` decken den Einzel-Apply-Pfad ab
  - `policy-curation-batch-review` und `policy-curation-batch-apply` decken jetzt auch kuratierte Batches mit Skip-fuer-schon-promoted ab
  - `policy-curation-batch-plan` trennt sichere Teil-Batches von echten Manual-Review-Faellen
  - `citybureau/city-scrapers` und `oc/openevents` sind bereits kontrolliert in die kanonische Wissensschicht uebernommen worden
- current_limit: Fuer groessere Batches fehlen noch schaerfere und real kalibrierte Konflikt- und Ueberschneidungsregeln jenseits der ersten Governance-Sicht.

### Tasks

- [ ] echte Discovery-Treffer gezielt in Queue und Watchlist ueberfuehren
- [ ] Review-Pfade gegen diese Treffer laufen lassen und Ergebnisse vergleichen
- [ ] Promotion-Regeln und Follow-up-Entscheidungen gegen echte Repos pruefen
- [ ] Luecken zwischen Decision-Summary, Promotion und kuratierter Wissensebene dokumentieren
- [ ] Batch-Governance fuer mehrere kuratierte Kandidaten gegen echte Handoffs pruefen
- [ ] bei Bedarf Ranking-/Priorisierungslogik fuer Promotion nachschaerfen
- [ ] klare Grenze zwischen Pattern-Signal, Review-Kandidat und echter Uebernahme weiter schaerfen

### Exit Criteria

- Patternpilot verarbeitet nicht nur einen einzelnen Seed, sondern mehrere real kalibrierte Kandidaten end-to-end
- Promotion wirkt nicht mehr nur technisch moeglich, sondern fachlich belastbar

---

## Phase 3 — Folge-Run-Modell und Optional Automation

### Goal

Das Produkt soll nicht nur den ersten Lauf gut koennen, sondern auch den zweiten, dritten und spaeteren Lauf sauber modellieren.

### Progress Snapshot

- status: started
- groundwork_done:
  - `run-plan` klassifiziert geplante Laeufe jetzt als `first_run`, `follow_up_run` oder `maintenance_run`
  - On-Demand-Runs tragen diese Lifecycle-Sicht in Summary, Manifest und HTML
  - Automation-Projektlaeufe tragen jetzt `run_kind` und `recommended_focus` mit
  - erste Betriebsdefaults haengen jetzt daran: Maintenance-Laeufe ziehen `stale_only` Re-Evaluate nach sich, und Fehler bekommen Resume-Empfehlungen
  - `run-drift` misst jetzt dazu echte Mehrlauf-Signale wie URL-Delta, Queue-Staleness und Resume-Hinweise
  - Automation-Job-State und Job-Uebersichten koennen diese Drift-Sicht jetzt mittragen
  - `run-governance` bewertet jetzt explizit, ob ein Folge-Run manuell, begrenzt unattended oder unattended-ready ist
  - `automation:jobs` und `automation:dispatch` koennen diese Governance-Sicht jetzt live verwenden
  - `run-stability` misst jetzt stabile versus instabile Run-Streaks ueber mehrere Schleifen hinweg
  - Requalify-Latches fuer instabile Folge-Runs werden jetzt im Job-State gehalten und mit `run-requalify` bewusst geprueft, bevor weitere unattended Schleifen wieder freigegeben werden
  - `automation-alert-deliver` kann Alert-Summaries jetzt ueber erste echte Adapter wie Datei, `GITHUB_STEP_SUMMARY`, lokale Hook-Commands oder den eingebauten Hook `patternpilot-alert-hook` ausliefern
- current_limit: Die Folge-Run-Logik ist jetzt sichtbar, messbar und erstmals steuernd, aber noch nicht an breitere echte Resume-Strategien oder spaetere GitHub-App-/Produktkanal-Entscheidungen angebunden.

### Deliverables

- klares Modell fuer Erstlauf vs. Folge-Run
- definierte Defaults fuer wiederkehrende optionale Laeufe
- robustere Regeln fuer Auto-Resume, Retry und Drift

### Tasks

- [x] Folge-Run-Zustaende explizit modellieren: first_run, follow_up_run, maintenance_run
- [~] bestimmen, welche Schritte bei Folge-Runs immer, manchmal oder nur bei Drift laufen
- [~] Retry-/Backoff-/Resume-Politik aus realen Betriebsannahmen weiter gegen echte Resume- und Drift-Faelle schaerfen
- [x] ersten echten Alert-Kanal festlegen
- [~] definieren, welche Folge-Runs wirklich unattended laufen duerfen
- [~] Requalify- und Wiederfreigabe-Regeln fuer instabile Folge-Run-Schleifen an echte Betriebsfaelle anbinden
- [ ] Scheduler-Schicht weiterhin optional halten und nicht zum Produktkern machen

### Exit Criteria

- der Unterschied zwischen erstem Lauf und spaeteren Laeufen ist explizit
- die optionale Vollautomatik hat ein belastbares Folge-Run-Modell statt nur einzelne Jobs

---

## Phase 4 — GitHub-App-Ready Integration Layer

### Goal

`patternpilot` so weiterbauen, dass ein spaeterer GitHub-App-Cutover natuerlich ist, ohne den produktneutralen Kern zu beschaedigen.

### Deliverables

- saubere Integrationsgrenzen fuer GitHub App
- geklaerte Rechte, Ereignisse und Installationslogik
- erste Live-nahe App-Roadmap

### Progress Snapshot

- status: started
- groundwork_done:
  - `github-app-readiness` zeigt jetzt explizit, wie nah der aktuelle CLI/PAT-Zustand schon an einem spaeteren GitHub-App-Pfad ist
  - `github-app-plan` beschreibt jetzt Rechte, Event-Bindings, Artefakte und Command-Pfade fuer den spaeteren GitHub-App-Cutover
  - `github-app-event-preview` kann jetzt einzelne Beispiel-Events gegen den heutigen Kernel spiegeln, bevor echte Webhook-Zustellung gebaut wird
  - `github-app-webhook-preview` modelliert jetzt lokal Header, Delivery-ID, Signaturpruefung und Envelope-Artefakte fuer spaetere echte Webhook-Zustellung
  - `github-app-webhook-route` baut jetzt aus einem verifizierten Envelope bereits konkrete lokale Route-Plaene und Command-Vorschlaege
  - `github-app-webhook-dispatch` baut jetzt darueber eine kontrollierte lokale Dispatch-Schicht und trennt Preview, force-gated, ausfuehrbare und guarded Schritte sauber
  - `github-app-execution-run` fuehrt den daraus entstehenden Contract jetzt in einer eigenen Runner-Schicht weiter
  - die Runner-Schicht schreibt inzwischen `runner-state`, `resume-contract`, `recovery-assessment` und `recovery-contract`
  - `github-app-execution-resume` und `github-app-execution-recover` machen Wiederaufnahme und Recovery-Governance jetzt als explizite CLI-Pfade sichtbar
  - `github-app-execution-enqueue` und `github-app-service-tick` bilden jetzt die erste kleine lokale Queue-/Service-Schicht ueber diesen Contracts
  - die Service-Schicht kennt jetzt zusaetzlich `claimed`-Zustaende, Worker-IDs und Lease-Zeiten fuer spaetere Runtime-Prozesse
  - Duplicate-Schutz und ein erster `dead-letter`-Pfad sind jetzt ebenfalls vorbereitet
  - `github-app-service-review` und `github-app-service-requeue` geben dieser Service-Schicht jetzt auch eine explizite manuelle Release-/Requeue-Governance
  - `github-app-installation-review`, `github-app-installation-apply` und `github-app-installation-show` bilden jetzt die erste lokale Installations-/Repo-Scope-Registry fuer `installation.created` und `installation_repositories.added`
  - `github-app-installation-scope` und `github-app-installation-handoff` bilden darauf jetzt den ersten kontrollierten Mehr-Repo-Handoff in Projekt-Watchlists
  - `github-app-installation-governance-review` und `github-app-installation-governance-apply` geben dieser Linie jetzt eine explizite Installations-Policy vor dem Scope-/Handoff-Schritt
  - `github-app-installation-runtime-review` und `github-app-installation-runtime-apply` koppeln diese Installations-Policy jetzt an einen eigenen Betriebsmodus pro Installation
  - `github-app-installation-operations-review` und `github-app-installation-operations-apply` koppeln diese Linie jetzt an Watchlist-/Service-Betriebslogik pro Installation
  - `github-app-service-review` und `github-app-service-tick` respektieren diese Installations-Operationslogik jetzt auch als echte Runtime-Gates
  - `github-app-service-requeue` respektiert diese Installations-Operationslogik jetzt auch als Admin-/Manual-Release-Gate
  - der bestehende Kernel bleibt weiter produktneutral, waehrend GitHub-spezifische Reife separat sichtbar gemacht wird
- current_limit: Es gibt jetzt eine klare Reifeanzeige plus lokale Event-/Runner-/Recovery-/Service-/Installations-Vorstufen inklusive Installations-Policy und erstem Mehr-Repo-Handoff, aber noch keine ausgearbeitete Webhook-, Installations- oder Multi-Repo-Liveintegration.

### Tasks

- [~] GitHub-App-Anforderungen gegen aktuellen CLI-/PAT-Zustand abgleichen
- [ ] festhalten, welche Commands/Flows spaeter App-getrieben werden koennen
- [ ] Webhook- und Event-Modell skizzieren
- [~] lokale Runner-/Service-Governance inklusive Resume/Recovery/Requeue stabilisieren
- [ ] Secrets-, Installations- und Multi-Repo-Modell klaeren
- [~] lokale Installations-Registry und Repo-Scope-Governance als Vorstufe stabilisieren
- [~] Installations-Registry in einen echten Multi-Repo-Handoff fuer Watchlist und spaetere Governance ueberfuehren
- [~] explizite Installations-Policy vor Scope und Handoff scharfziehen
- [ ] entscheiden, welche Outputs die App direkt erzeugt und welche weiter CLI-/Engine-Artefakte bleiben

### Exit Criteria

- GitHub App ist nicht mehr nur “spaeter vielleicht”, sondern als klarer Integrationspfad beschrieben
- der bestehende Kern muss dafuer nicht neu erfunden werden

---

## Phase 5 — Product Shell and First-Run Onboarding

### Goal

Neue Nutzer oder neue Projekte sollen `patternpilot` produktartig starten koennen, ohne die innere Architektur zu kennen.

### Deliverables

- First-Run-Onboarding
- gefuehrte Projektbindung
- klare erste Pipeline fuer neue Nutzer

### Tasks

- [ ] `init-project`, `doctor`, `setup-checklist` und On-Demand-Einstieg zu einem gefuehrten Setup verbinden
- [ ] Defaults fuer Projektwahl, Profile und erste Reports definieren
- [ ] klar machen, was im ersten Lauf Pflicht, optional oder spaeter ist
- [ ] bessere Nutzerfuehrung fuer Folgeaktionen nach dem ersten Report
- [ ] Produktsprache und begriffliche Konsistenz pruefen

### Exit Criteria

- ein neuer Nutzer kann den ersten echten Projektlauf fuehren, ohne den Kernel zu kennen
- Onboarding erklaert das Produkt, statt nur CLI-Optionen aufzuzahlen

---

## Phase 6 — Release and Distribution Readiness

### Goal

`patternpilot` soll am Ende nicht nur intern stark, sondern extern sauber freigabefaehig sein.

### Deliverables

- stabile Installationsgeschichte
- Release-Doku
- geklaerte Produktgrenzen

### Tasks

- [ ] Packaging und Installationspfad fuer andere Repos klarmachen
- [ ] produktreife Doku fuer Setup, erste Nutzung und Folge-Run anlegen
- [ ] klare Abgrenzung zwischen Produktkern, optionaler Automation und Integrationskanaelen dokumentieren
- [ ] v1-Definition festziehen: was muss fuer “freigeben” wirklich fertig sein?
- [ ] letzte Kernel-Risiken und Restfragen gegen `DELIVERY_STATUS.md`, `OPEN_QUESTION.md` und `AUTOMATION_ROADMAP.md` gegenpruefen

### Exit Criteria

- es gibt eine belastbare Aussage, was `v1` ist und was nicht
- Release-Reife ist nicht nur gefuehlt, sondern dokumentiert

---

## Suggested Execution Order

1. Phase 1 — Real Discovery Calibration
2. Phase 2 — Decision and Promotion Tightening
3. Phase 3 — Folge-Run-Modell und Optional Automation
4. Phase 4 — GitHub-App-Ready Integration Layer
5. Phase 5 — Product Shell and First-Run Onboarding
6. Phase 6 — Release and Distribution Readiness

---

## Practical Next Package

Wenn wir diesen Masterplan direkt in das naechste grosse Umsetzungsfenster schneiden, dann ist das erste sinnvolle Paket:

### Package A — Real Discovery Calibration for `eventbear-worker`

- [ ] mehrere echte Discovery-Runs fahren
- [ ] dieselben Runs mit `policy-audit` und `policy-review` spiegeln
- [ ] `projects/eventbear-worker/DISCOVERY_POLICY.json` nachschaerfen
- [ ] Calibration-Ergebnis dokumentieren
- [ ] dann erst den naechsten Decision-/Promotion-Paket-Schnitt machen

Das ist der direkteste Weg von “starker technischer Kern” zu “wirklich belastbarem Produktverhalten”.
