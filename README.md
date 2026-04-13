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
- `npm run automation:run -- --all-projects --promotion-mode prepared`

Dieser Motor:

- leitet projektbezogene Discovery-Suchplaene aus Repo-Kontext und Alignment-Regeln ab
- liest dafuer zuerst die konfigurierten Markdown- und Strukturquellen des Zielrepos
- durchsucht GitHub heuristisch nach passenden Repositories
- nimmt GitHub-Links entgegen
- normalisiert sie
- erstellt Queue-Eintraege
- reichert GitHub-Metadaten und README-Inhalte an
- gleicht externe Muster gegen das Zielprojekt ab
- kann Watchlist-Repos gesammelt gegen das Zielprojekt vergleichen
- schreibt menschenfreundliche HTML-Reports fuer Discovery- und Review-Laeufe
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

### Vollen Automationslauf fahren

```bash
npm run automation:run -- --all-projects --promotion-mode prepared --dry-run
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
- `lib/discovery.mjs`
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
