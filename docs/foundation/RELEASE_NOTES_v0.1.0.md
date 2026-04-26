# Release Notes v0.1.0

`patternpilot v0.1.0` ist die erste bewusste Open-Source-Freigabe des Produkts.

## Was neu ist

- lokales Repo-Intelligence-Produkt mit Zielprojekt-Bindung
- gefuehrtes Onboarding mit `getting-started`, `bootstrap` und GitHub-Token-Setup
- klare Trennung zwischen `bindings/`, `projects/`, `runs/` und `state/`
- Intake-, Watchlist-, Review- und Readiness-Flow als zusammenhaengender Produktpfad
- visuelle Produkt- und Onboarding-Oberflaeche mit statischen SVG-Assets
- neutrale Beispieloberflaeche statt aktiver Dogfood-Defaults
- dokumentierter Produktstatus mit erfolgreich validiertem Fremdprojekt-Pilot

## Fuer wen diese Version gedacht ist

Diese Version ist fuer Menschen und Teams, die:

- fremde GitHub-Repositories relativ zum eigenen Produkt bewerten wollen
- einen lokalen, nachvollziehbaren Review- und Intake-Prozess wollen
- ein Open-Source-Tool suchen, das bewusst zwischen Produktcode und lokalem Betriebszustand trennt

## Wichtige Produktmerkmale

- lokal-first
- Open Source unter MIT
- nutzbar ohne GitHub App
- stabiler mit verifiziertem GitHub-Token

## Schnellster Start

```bash
npm install
npm run getting-started
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
```

## Bekannte ehrliche Restpunkte

- der Kern ist `v1`-nah, aber Launch-/Distribution-Entscheidungen bleiben bewusst offen
- tiefere GitHub-App- und Runtime-Automation sind vorhanden, aber nicht noetig fuer den ersten produktiven Start
- direkte Git-Transportpfade koennen je nach lokaler Umgebung anders robust sein als die GitHub-API selbst

## Wichtigste Links

- [README.md](../../README.md)
- [CHANGELOG.md](../../CHANGELOG.md)
- [SIMPLE_GUIDE.md](SIMPLE_GUIDE.md)
- [GETTING_STARTED.md](GETTING_STARTED.md)
- [OPERATING_MODEL.md](OPERATING_MODEL.md)
- [V1_STATUS.md](V1_STATUS.md)
