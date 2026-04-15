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

- ein strategischer Arbeitsraum
- ein Repo- und Produkt-Intelligence-Layer
- eine Entscheidungshilfe für EventBär
- die Keimzelle eines möglichen späteren eigenständigen Produkts

`patternpilot` ist aktuell nicht:

- ein eigenständiges Produktionssystem
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

---

## Neuer Betriebszustand

Patternpilot ist nicht mehr nur ein Dokumentations-Seed.

Es hat jetzt einen lokalen Motor plus Workspace-Modus:

- `npm run analyze -- --project eventbear-worker <github-url>`
- `npm run run-plan -- --project eventbear-worker`
- `npm run run-drift -- --project eventbear-worker`
- `npm run run-requalify -- --project eventbear-worker --scope automation`
- `npm run discover:import -- --project eventbear-worker --file projects/eventbear-worker/calibration/discovery-candidates.example.json --dry-run`
- `npm run policy:audit -- --project eventbear-worker --dry-run`
- `npm run policy:calibrate -- --project eventbear-worker`
- `npm run policy:compare -- --project eventbear-worker --policy-file projects/eventbear-worker/DISCOVERY_POLICY.next.json`
- `npm run policy:pack -- --project eventbear-worker --policy-file projects/eventbear-worker/DISCOVERY_POLICY.next.json`
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
- `npm run automation:dispatch`

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
- kann jetzt manuelle Requalify-Latches fuer Folge-Runs halten und mit `run-requalify` bewusst wieder freigeben
- schreibt menschenfreundliche HTML-Reports fuer Discovery- und Review-Laeufe
- haelt fuer jedes Projekt einen direkten Report-Pointer in `projects/<project>/reports/browser-link`
- schreibt Metadaten zum letzten Projekt-Report nach `projects/<project>/reports/latest-report.json`
- haelt `STATUS.md` und `OPEN_QUESTION.md` als Uebergabeflaechen fuer Agenten aktuell
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

- `STATUS.md` und `OPEN_QUESTION.md` bleiben im Repo-Root als operative Handoff-Schicht.
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
npm run policy:compare -- --project eventbear-worker --policy-file projects/eventbear-worker/DISCOVERY_POLICY.next.json
```

Das vergleicht den aktuellen Projekt-Policy-Stand mit einer alternativen JSON-Datei gegen dieselben gespeicherten Discovery-Runs und zeigt, wie sich `audit_flagged`, `enforce_hidden` und `preferred_hits` veraendern wuerden.

### Kalibrierungspaket fuer ein Projekt schreiben

```bash
npm run policy:pack -- --project eventbear-worker --policy-file projects/eventbear-worker/DISCOVERY_POLICY.next.json
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

- `projects/eventbear-worker/PROJECT_CONTEXT.md`
- `projects/eventbear-worker/PROJECT_BINDING.md`
- `projects/eventbear-worker/PROJECT_BINDING.json`
- `projects/eventbear-worker/ALIGNMENT_RULES.json`
- `projects/eventbear-worker/project_notes.md`
- `projects/eventbear-worker/WATCHLIST.txt`
- `projects/eventbear-worker/intake/`
- `projects/eventbear-worker/promotions/`

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

`patternpilot` kann sich später zu einem eigenständigen Produkt entwickeln, das Menschen oder Teams hilft, vorhandenes Wissen aus GitHub, Web, Tools und Produktmustern gezielt zu analysieren, zu strukturieren und für eigene Vorhaben nutzbar zu machen.

Aktuell dient es zuerst EventBaer.

---

## Startfrage für jede neue Analyse

Bei jedem neuen Repo, Tool oder Produkt ist zuerst zu beantworten:

**Warum ist das für das aktuelle Projekt relevant und was könnte es konkret bedeuten?**

Wenn diese Frage nicht klar beantwortet werden kann, ist Zurückhaltung besser als bloßes Einsammeln.
