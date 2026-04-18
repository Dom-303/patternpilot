# Contributing

Danke, dass du `patternpilot` verbessern willst.

## Bevor du loslegst

Der wichtigste Produktgrundsatz ist:

- Produktcode und gepflegte Referenzdoku gehoeren ins Repo
- lokale Runtime-Zustaende und Run-Artefakte nicht

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

Bitte halte die drei Nutzerpfade sauber auseinander:

- `docs/foundation/SIMPLE_GUIDE.md`
- `docs/foundation/GETTING_STARTED.md`
- `docs/foundation/ADVANCED_GUIDE.md`

## Wenn du an Produktlogik arbeitest

Bitte bevorzuge:

- klare naechste Schritte
- lesbare Statusausgaben
- produktneutrale Beispiele
- lokale-first Betriebslogik

## Lizenz

Mit Beitragen zu diesem Repo erklaerst du dich damit einverstanden, dass dein Beitrag unter der Apache-2.0-Lizenz dieses Projekts veroeffentlicht wird.
