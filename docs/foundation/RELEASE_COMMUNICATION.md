# Release Communication

## GitHub Release Title

`patternpilot v0.1.0 - first open-source release`

## GitHub Release Body

`patternpilot v0.1.0` ist die erste bewusste Open-Source-Freigabe des Produkts.

Highlights:

- lokales Repo-Intelligence-Produkt mit klarem Zielprojekt-Modell
- gefuehrtes Onboarding mit `getting-started`, `bootstrap` und GitHub-Token-Setup
- lesbare Trennung zwischen `bindings/`, `projects/`, `runs/` und `state/`
- visuelle Produkt- und Onboarding-Oberflaeche
- dokumentierter Produktstatus mit erfolgreich validiertem Fremdprojekt-Pilot

Wichtig:

- Lizenz: Apache-2.0
- Fokus: lokale Nutzung, Intake, Watchlist, Review und Readiness
- GitHub App und tiefere Automation sind vorhanden, aber nicht noetig fuer den ersten produktiven Start

Empfohlener erster Einstieg:

```bash
npm install
npm run getting-started
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
```

Weiterfuehrende Doku:

- `docs/foundation/SIMPLE_GUIDE.md`
- `docs/foundation/GETTING_STARTED.md`
- `docs/foundation/ADVANCED_GUIDE.md`
- `docs/foundation/OPERATING_MODEL.md`
- `docs/foundation/V1_STATUS.md`

## Kurze Release-Nachricht

`patternpilot` ist jetzt als Apache-2.0 Open Source veroeffentlicht.
Es hilft dabei, externe GitHub-Repos relativ zum eigenen Projekt zu bewerten, statt sie nur zu sammeln.
Der aktuelle Stand ist lokal produktiv nutzbar, mit gefuehrtem Onboarding, Review-Flow und dokumentiertem Produktstatus.

## Sehr kurze Ein-Zeilen-Version

`patternpilot v0.1.0` ist raus: lokales Open-Source-Repo-Intelligence mit Zielprojekt-Bindung, Intake, Review und klaren naechsten Schritten.
