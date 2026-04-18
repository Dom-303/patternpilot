# Contributing

Danke, dass du `patternpilot` verbessern willst.

## Was "Contributing" hier bedeutet

`Contributing` heisst hier einfach:

- du willst einen Bug beheben
- du willst die Doku klarer machen
- du willst die Nutzerfuehrung verbessern
- du willst einen Report, einen Command oder die Discovery besser machen
- du willst einen sinnvollen Produktbeitrag leisten

Du musst dafuer nicht gleich ein grosses Feature bauen.
Auch kleine, saubere Verbesserungen sind wertvoll.

## Was "Mitmachen" praktisch heisst

In der README steht bei Open Source der Punkt `Mitmachen`.

Gemeint ist damit genau dieses Dokument:

- [CONTRIBUTING.md](CONTRIBUTING.md)

Also: Wie man sinnvoll an diesem Projekt mitarbeitet.

## Wichtiger Produktgrundsatz

Produktcode und gepflegte Referenzdoku gehoeren ins Repo.

Lokale Runtime-Zustaende und Run-Artefakte nicht.

Wenn du dazu unsicher bist, lies:

- [docs/foundation/PUBLIC_VS_LOCAL.md](docs/foundation/PUBLIC_VS_LOCAL.md)

## Lokaler Start

```bash
npm install
npm run doctor -- --offline
```

Wenn du mit echtem GitHub-Zugang testen willst:

```bash
npm run init:env
npm run setup:checklist
npm run doctor
```

## Typischer lokaler Entwicklungsfluss

```bash
npm run getting-started
npm run release:smoke
npm run release:check
```

## Was vor einem PR oder Push gut ist

- `git status --short` bewusst pruefen
- keine lokalen `state/*.json` oder `state/*.md` committen
- keine `patternpilot.config.local.json` committen
- keine frischen `runs/` oder lokalen Projektartefakte committen
- `npm run release:smoke` laufen lassen

## Wenn du an Doku arbeitest

Bitte halte diese Ebenen sauber getrennt:

- `docs/foundation/SIMPLE_GUIDE.md`
- `docs/foundation/GETTING_STARTED.md`
- `docs/foundation/ADVANCED_GUIDE.md`
- `docs/foundation/OPERATING_MODEL.md`
- `docs/foundation/V1_STATUS.md`

## Wenn du an Produktlogik arbeitest

Bitte bevorzuge:

- klare naechste Schritte
- lesbare Statusausgaben
- produktneutrale Beispiele
- lokale-first Betriebslogik
- echte Verbesserungen aus Nutzung statt theoretischer Ausbau um seiner selbst willen

## Lizenz

Mit Beitraegen zu diesem Repo erklaerst du dich damit einverstanden, dass dein Beitrag unter der Apache-2.0-Lizenz dieses Projekts veroeffentlicht wird.
