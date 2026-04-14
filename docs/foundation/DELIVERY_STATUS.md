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

- schaetzung: `75-79%`
- begruendung: Der Kernel ist stark, Discovery/Kuration laufen kontrolliert bis in die kanonische Wissensschicht, und Folge-Run-/Drift-/Governance-Logik ist jetzt inklusive Stabilitaets- und Requalify-Schicht operativ belastbarer. Produktisierung, Onboarding, GitHub-App-Cutover, Release-Haertung und echte Vollautomatik fehlen aber weiter.

### Kernsystem

- schaetzung: `80-85%`
- drin: Intake, Discovery, Review, HTML-Reports, Decision-Layer, Re-Evaluate, Policy-Gates, On-Demand-Flow, Automation-Grundlagen
- offen: weitere Kalibrierung gegen reale Runs, weniger Rest-Unschaerfe in Discovery und Policy-Defaults

### On-Demand-Produktpfad

- schaetzung: `75-80%`
- drin: explizite Repo-Analyse, fokussierte Reviews, Run-Landing, What-now-Schicht, stabile Report-Pointer
- offen: spaeteres First-Run-Onboarding, noch klarere Nutzerfuehrung und fertige Produktschale

### Wiederkehrende Automation

- schaetzung: `68-72%`
- drin: Chain-Run, Job-State, Alerting, Dispatch, Locking, Retry-Klassifikation, Manual-Clear, Run-Lifecycle-Defaults, sichtbare Run-Drift- und Stability-Signale, explizite Governance fuer unattended versus manuell und jetzt auch Requalify-Latches fuer instabile Folge-Run-Schleifen
- offen: echte produktive Scheduler-Einbettung, noch schaerfere Auto-Resume-Regeln gegen reale Betriebsfaelle, erste reale Benachrichtigungskanaele, mehr Kalibrierung im echten Betrieb

### Vollautomatisches Zielbild

- schaetzung: `50-55%`
- drin: wichtige technische Grundbausteine fuer Vollautomatik sind angelegt, inklusive Lifecycle-, Drift-, Stability- und Governance-Sicht fuer Folge-Runs plus kontrollierter Requalify-Freigabe
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

Naechste Themen:

- GitHub-App als spaeterer echter Integrationsmodus
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
