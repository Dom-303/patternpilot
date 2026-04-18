# Getting Started

## Fuer Wen

Diese Anleitung ist fuer einen frischen Nutzer gedacht, der `patternpilot` lokal installiert und noch kein Zielprojekt angebunden hat.

Du brauchst dafuer nicht zuerst EventBaer zu verstehen.

## Kernidee

`patternpilot` ist kein allgemeiner Bookmark-Sammler.

Es arbeitet immer fuer ein eigenes Zielprojekt.
Deshalb ist der erste echte Schritt nie ein GitHub-Scan, sondern immer die Bindung an dein eigenes Repo.

## Schnellster Start

```bash
npm install
npm run doctor -- --offline
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
npm run intake -- --project my-project https://github.com/example/repo
```

## Was Die Schritte tun

### 1. Installation

`npm install`

Laedt die lokale CLI und ihre Abhaengigkeiten.

### 2. Lokaler Check

`npm run doctor -- --offline`

Zeigt:

- ob die lokale Struktur grundsaetzlich stimmt
- welche Projekte schon gebunden sind
- wie die GitHub-Auth-Lage aussieht

### 3. Eigenes Zielprojekt anbinden

`npm run bootstrap -- --project my-project --target ../my-project --label "My Project"`

Das erzeugt zuerst eine lokale Konfigurationsdatei und danach zwei verschiedene Dinge:

- `patternpilot.config.local.json`

- `bindings/my-project/`
- `projects/my-project/`

`bindings/my-project/` ist die technische Zieldefinition:

- `PROJECT_BINDING.json`
- `ALIGNMENT_RULES.json`
- `DISCOVERY_POLICY.json`
- `WATCHLIST.txt`

`projects/my-project/` ist der Arbeits- und Ergebnisraum:

- `PROJECT_CONTEXT.md`
- `intake/`
- `promotions/`
- `reviews/`
- `reports/`

### 4. Erstes Repo intaken

`npm run intake -- --project my-project https://github.com/example/repo`

Danach schreibt Patternpilot:

- einen Queue-Eintrag nach `state/repo_intake_queue.csv`
- ein Intake-Dossier nach `projects/my-project/intake/`
- ein Laufprotokoll nach `runs/my-project/`

## Wenn du lieber mit einer Watchlist startest

1. URLs in `bindings/my-project/WATCHLIST.txt` eintragen
2. Dann:

```bash
npm run sync:watchlist -- --project my-project
```

3. Danach:

```bash
npm run review:watchlist -- --project my-project --dry-run
```

## Gefuehrter CLI-Einstieg

Wenn du die Schritte nicht aus der Doku lesen willst:

```bash
npm run getting-started
```

Dieser Command zeigt die kuerzeste sinnvolle Reihenfolge direkt aus der CLI.
