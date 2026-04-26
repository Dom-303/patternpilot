# Advanced Guide

<p align="center">
  <img src="../../assets/workspace-map.png" alt="Patternpilot workspace map" width="860">
</p>

## Zweck

Diese Anleitung ist fuer Nutzer, die `patternpilot` nicht nur starten, sondern bewusst betreiben wollen.

Sie erklaert:

- wie das Workspace-Modell funktioniert
- welche Dateien versioniert werden
- wie Discovery, Watchlist, Review und Readiness zusammenspielen

## 1. Produktzustand nach dem Klonen

Nach einem frischen Checkout gilt:

- `patternpilot.config.json` ist der versionierte Empty-default
- `patternpilot.config.local.json` ist dein lokales Overlay
- `bindings/` und `projects/` muessen nicht schon produktiv gefuellt sein

Das ist Absicht:

- Produktzustand bleibt sauber
- lokale Nutzung bleibt lokal
- echte Zielprojekte werden erst durch `bootstrap` oder `init:project` eingebunden

## 2. Erstes Projekt anbinden

```bash
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
```

Danach existieren typischerweise:

- `bindings/my-project/PROJECT_BINDING.json`
- `bindings/my-project/ALIGNMENT_RULES.json`
- `bindings/my-project/DISCOVERY_POLICY.json`
- `bindings/my-project/WATCHLIST.txt`
- `projects/my-project/PROJECT_CONTEXT.md`
- `projects/my-project/intake/`
- `projects/my-project/reviews/`
- `projects/my-project/promotions/`
- `projects/my-project/reports/`

## 3. Was wohin gehoert

`bindings/<project>/`

- technische Zieldefinition
- Suchschaerfe
- Policy
- Watchlist

`projects/<project>/`

- lesbarer Arbeitsraum
- Intake-Dossiers
- Reviews
- Promotion-Pakete
- Reports

`runs/<project>/`

- technische Ablaufhistorie
- Manifeste
- Summaries

`state/`

- Queue
- Alerts
- lokale Dispatch- und Runtime-Zustaende

## 4. Kernworkflow

Ein typischer manueller Ablauf:

```bash
npm run intake -- --project my-project https://github.com/example/repo
npm run sync:watchlist -- --project my-project
npm run review:watchlist -- --project my-project
npm run patternpilot -- product-readiness
```

Ein typischer Discovery-/Kalibrierungsablauf:

```bash
npm run patternpilot -- discover --project my-project --dry-run
npm run patternpilot -- policy-calibrate --project my-project
npm run patternpilot -- policy-control --project my-project
```

## 5. Versionierung

Im Repo bleiben bewusst:

- Produktcode
- Tests
- Referenzdokumente
- bewusst gepflegte Wissens-Templates

Lokal bleiben bewusst:

- `state/*.json`
- `state/*.md`
- frische Reports
- datierte Kalibrierungsartefakte
- session- oder laufbezogene Operator-Snapshots

Die einfache Grundregel dazu steht hier:

[PUBLIC_VS_LOCAL.md](PUBLIC_VS_LOCAL.md)

## 6. Readiness statt Bauchgefuehl

Mit diesem Command bekommst du den aktuellen Produktzustand als Gate:

```bash
npm run patternpilot -- product-readiness
```

Wichtig:

- Wenn noch gar kein Projekt verbunden ist, ist das Ergebnis bewusst `not_ready`.
- Das ist kein Fehler, sondern eine klare erste Fuehrung.

## 7. Automation und GitHub App

Diese Pfade sind optional.

Die klare Produktgrenze dazu steht hier:

[AUTOMATION_OPERATING_MODE.md](AUTOMATION_OPERATING_MODE.md)

Die richtige Reihenfolge ist:

1. Erst lokales Onboarding sauber
2. Dann manuelle Nutzung
3. Dann Watchlist und Reviews
4. Dann erst Automation oder GitHub-App-Betrieb

## 8. Fiktives Referenzbeispiel

Wenn du die Struktur erst anschauen willst, ohne ein echtes Projekt zu verbinden:

[examples/demo-city-guide/README.md](../../examples/demo-city-guide/README.md)

## 9. Ehrlicher Produktstatus

Wenn du wissen willst, was bereits `v1`-nah ist und was noch auf der Zielgeraden liegt:

[V1_STATUS.md](V1_STATUS.md)
