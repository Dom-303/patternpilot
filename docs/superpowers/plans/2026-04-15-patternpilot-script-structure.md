# Patternpilot Script Structure Plan

- date: 2026-04-15
- author: Codex
- status: proposed
- related: [patternpilot/scripts/patternpilot.mjs](../../../scripts/patternpilot.mjs), [patternpilot/lib/index.mjs](../../../lib/index.mjs), [docs/foundation/ENGINE_BACKLOG.md](../../foundation/ENGINE_BACKLOG.md)

## Goal

`patternpilot` soll im weiteren Ausbau eine gesunde, langfristig erweiterbare Struktur behalten:

- `lib/` bleibt die Engine- und Fachlogik-Schicht
- `scripts/` bleibt die Werkzeug- und CLI-Schicht
- die aktuelle 5000-Zeilen-Datei `scripts/patternpilot.mjs` wird schrittweise in klar getrennte Script-Module zerlegt

Die Absicht ist ausdruecklich **nicht**, den `scripts/`-Ordner abzuschaffen oder alles nach `lib/` zu verschieben.

## Current Problem

Heute mischt `scripts/patternpilot.mjs` zu viele Rollen:

- CLI-Einstieg und Command-Dispatch
- Command-spezifische Konsolen-Ausgabe
- Orchestrierung mehrstufiger Flows
- Dateischreiben fuer Run-Artefakte
- lokale Helper, die fachlich schon fast `lib/`-Niveau haben

Das bremst den weiteren Ausbau, weil neue Commands fast automatisch wieder in dieselbe Monolith-Datei laufen.

## Target Architecture

### Principle

Die Schichten bleiben bewusst getrennt:

- `lib/` beantwortet: "Wie funktioniert die fachliche Logik?"
- `scripts/` beantwortet: "Welches Werkzeug gibt es, wie wird es aufgerufen, was wird dem Nutzer gezeigt?"

### Target Directory Shape

```text
patternpilot/
  scripts/
    patternpilot.mjs
    commands/
      automation.mjs
      discovery.mjs
      intake.mjs
      on-demand.mjs
      policy-core.mjs
      policy-curation.mjs
      project-admin.mjs
      promotion.mjs
      run-diagnostics.mjs
      watchlist.mjs
    shared/
      artifacts.mjs
      command-context.mjs
      command-registry.mjs
      output.mjs
  lib/
    ...
```

## Ownership Boundaries

### `scripts/patternpilot.mjs`

Soll am Ende nur noch diese Aufgaben tragen:

- Args parsen
- Root, Config und Env laden
- Command in Registry aufloesen
- passenden Command-Handler aufrufen
- Fehler in CLI-taugliche Exit-Ausgabe uebersetzen

Zielbild: eher `100-250` Zeilen als `5000+`.

### `scripts/commands/*.mjs`

Jede Datei repraesentiert eine zusammenhaengende Werkzeug-Familie.

- `intake.mjs`
  - `intake`
  - spaeter nur intake-nahe Orchestrierung, kein Discovery-Mischblock
- `discovery.mjs`
  - `discover`
  - `discover-import`
- `watchlist.mjs`
  - `review-watchlist`
  - `sync-watchlist`
  - `sync-all-watchlists`
- `on-demand.mjs`
  - `on-demand`
  - nur Multi-Step-Flow fuer manuellen Hauptpfad
- `run-diagnostics.mjs`
  - `run-plan`
  - `run-drift`
  - `run-stability`
  - `run-governance`
  - `run-requalify`
- `policy-core.mjs`
  - `policy-review`
  - `policy-compare`
  - `policy-calibrate`
  - `policy-pack`
  - `policy-workbench`
  - `policy-workbench-review`
  - `policy-suggest`
  - `policy-trial`
  - `policy-cycle`
  - `policy-handoff`
- `policy-curation.mjs`
  - `policy-curate`
  - `policy-curation-review`
  - `policy-curation-apply`
  - `policy-curation-batch-review`
  - `policy-curation-batch-plan`
  - `policy-curation-batch-apply`
- `automation.mjs`
  - `automation-jobs`
  - `automation-dispatch`
  - `automation-alerts`
  - `automation-job-clear`
  - `automation-run`
- `promotion.mjs`
  - `promote`
- `project-admin.mjs`
  - `doctor`
  - `init-env`
  - `init-project`
  - `discover-workspace`
  - `setup-checklist`
  - `show-project`
  - `list-projects`
  - `refresh-context`

### `scripts/shared/*.mjs`

Diese Ebene verhindert, dass dieselben CLI-Muster spaeter wieder in jedem Command-File dupliziert werden.

- `command-registry.mjs`
  - zentrale Beschreibung aller Commands
  - Name, Beschreibung, Handler, Help-Text, Alias
- `command-context.mjs`
  - wiederkehrendes Laden von `project`, `binding`, `alignmentRules`, `projectProfile`, `discoveryPolicy`
- `artifacts.mjs`
  - gemeinsames Schreiben von `summary.md`, `manifest.json`, Run-Verzeichnissen, HTML-Artefakten
- `output.mjs`
  - konsistente Konsolen-Ausgabe, kleine Printer-Helfer, optionale JSON-Ausgabe

### `lib/*.mjs`

`lib/` bleibt im Kern so, wie es heute schon gesund gewachsen ist.

Nur dann neue `lib`-Module anfassen oder ergaenzen, wenn in `scripts/` noch echte Fachlogik steckt, zum Beispiel:

- mehrstufige Governance-/Lifecycle-Berechnung
- wiederverwendbare Policy- oder Review-Entscheidungen
- fachliche Batch-Selektion
- stabile Report-/Manifest-Builder mit echtem Domain-Wert

Nicht alles, was "gross" ist, gehoert automatisch nach `lib/`.

## Growth Rules

Damit die Struktur auch in sechs Monaten noch gesund bleibt:

1. Neue Commands landen nie direkt als neuer Grossblock in `scripts/patternpilot.mjs`.
2. Neue Commands werden immer in eine bestehende Command-Familie einsortiert oder bekommen eine neue Datei unter `scripts/commands/`.
3. Wenn zwei oder mehr Command-Dateien denselben Lade- oder Schreibcode brauchen, wird dieser nach `scripts/shared/` gezogen.
4. Wenn Logik ohne Terminal-Ausgabe sinnvoll testbar und fachlich wiederverwendbar ist, gehoert sie nach `lib/`.
5. Wenn Logik vor allem CLI-Routing, Ausgabe oder Ablauf-Steuerung ist, bleibt sie in `scripts/`.
6. Ein Command-File sollte moeglichst unter grob `300-500` Zeilen bleiben. Wenn es deutlich darueber waechst, ist das ein Signal fuer einen Split.
7. Cross-command-Orchestrierung soll nicht auf wilden Direkt-Imports zwischen vielen Command-Dateien beruhen. Lieber kleine, stabile Shared-Helfer oder klar benannte Flow-Module.

## Recommended Migration Order

### Phase 1 - Infrastructure First

Zuerst die Zielstruktur schaffen, ohne Verhalten zu aendern:

- `scripts/commands/` anlegen
- `scripts/shared/` anlegen
- `command-registry.mjs` einfuehren
- `patternpilot.mjs` auf Registry-Dispatch umstellen

### Phase 2 - Low-Risk Command Families

Dann die relativ einfachen Bereiche herausziehen:

- `project-admin.mjs`
- `run-diagnostics.mjs`
- `promotion.mjs`
- `watchlist.mjs`

Diese Gruppe ist wichtig, weil sie schnell Groesse aus der Monolith-Datei nimmt, ohne die komplexesten Flows zuerst anzufassen.

### Phase 3 - Core Workflow Families

Danach die mittlere Orchestrierung:

- `intake.mjs`
- `discovery.mjs`
- `on-demand.mjs`

Hier sollte parallel `artifacts.mjs` entstehen, damit Report-/Manifest-Schreiben nicht erneut kopiert wird.

### Phase 4 - Policy Families

Dann die groesseren inhaltlichen Bloecke:

- `policy-core.mjs`
- `policy-curation.mjs`

Wichtig: hier nur Script-Orchestrierung verschieben. Die bereits gesunde Engine-Logik bleibt in `lib/`.

### Phase 5 - Automation Last

`automation.mjs` zuletzt:

- `automation-run`
- `automation-dispatch`
- Governance-Anreicherung
- Locking und Resume-Pfade

Das ist absichtlich der letzte Schritt, weil dort die meisten Abhaengigkeiten zusammenlaufen.

## Structural Risks To Avoid

- Nicht `lib/` zur neuen Sammelschublade fuer jede grosse Funktion machen
- Nicht `scripts/commands/*.mjs` untereinander zu stark verketten
- Nicht fuer jeden einzelnen Command eine winzige Datei erzwingen, wenn eine Familie fachlich zusammengehoert
- Nicht zuerst Verhalten veraendern und Struktur umbauen gleichzeitig
- Nicht Help-Text, Registry und Dispatcher getrennt pflegen

## Definition of Done

Die Struktur gilt als gesund, wenn folgendes erreicht ist:

- `scripts/patternpilot.mjs` ist nur noch ein duenner Einstiegspunkt
- alle Commands kommen aus einer zentralen Registry
- `scripts/commands/` bildet die Werkzeug-Familien nachvollziehbar ab
- `scripts/shared/` haelt wiederkehrende CLI-Helfer zusammen
- `lib/` bleibt die Engine-Schicht und wird nicht mit CLI-Routing vermischt
- neue Commands koennen erkennbar an einer Stelle einsortiert werden, ohne den Monolithen wieder aufzubauen

## Recommendation

Die bestehende `lib/`-Struktur ist heute bereits eher ein Vorbild als ein Problem.

Der naechste richtige Schritt ist deshalb:

- **nicht** `scripts/` aufloesen
- **nicht** alles nach `lib/` umziehen
- sondern den `scripts/`-Bereich selbst in eine langfristig tragfaehige Werkzeugstruktur ueberfuehren

So bleibt `patternpilot` sowohl fuer die Engine als auch fuer die spaetere CLI- und Produkt-Erweiterung gesund ausbaubar.
