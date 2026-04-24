# Contributing

Dieses Dokument beschreibt die Regeln fuer Beitraege zu `patternpilot`.

## Was "Contributing" hier bedeutet

`Contributing` heisst hier einfach:

- du willst einen Bug melden
- du willst einen Bug beheben
- du willst einen Report, einen Command oder die Discovery besser machen
- du willst einen sinnvollen Produktbeitrag leisten

Du musst dafuer nicht gleich ein grosses Feature bauen.
Auch kleine, saubere Verbesserungen sind wertvoll.

## Grundsatz Fuer Externe Beitraege

Externe Beitraege sind hier als Vorschlaege gedacht, nicht als direkte Aenderungen am Haupt-Repo.

Das bedeutet:

- du kannst Issues eroeffnen
- du kannst Bugs melden
- du kannst Vorschlaege machen
- du kannst lokal oder in einem Fork Aenderungen bauen
- du kannst diese Aenderungen als Pull Request einreichen

Du kannst ohne Schreibrechte nicht direkt an diesem Repo schreiben.
Die Entscheidung, was ins Haupt-Repo uebernommen wird, liegt beim Maintainer.

## Was "Maintainer-Entscheidung" hier bedeutet

Der Maintainer prueft eingereichte Aenderungen und entscheidet:

- ob eine Aenderung zum Produkt passt
- ob sie inhaltlich richtig ist
- ob sie in Umfang und Stil passt
- ob sie jetzt, spaeter oder gar nicht uebernommen wird

Ein Pull Request ist also ein Vorschlag, keine automatische Aenderung am Projekt.

## Wichtige Erwartung

`patternpilot` ist kein offenes Wiki.

Bitte gehe nicht davon aus, dass breite Doku-Umbauten, stilistische Umschreibungen oder freie Produktumdeutungen automatisch gewuenscht sind.
Bevorzuge stattdessen:

- konkrete Bugfixes
- klare Produktverbesserungen
- enge, sachliche Doku-Korrekturen
- nachvollziehbare Tests oder Absicherungen

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

Bitte vermeide breite Umformulierungen der Produktdoku ohne klaren sachlichen Grund.

## Wenn du an Produktlogik arbeitest

Bitte bevorzuge:

- klare naechste Schritte
- lesbare Statusausgaben
- produktneutrale Beispiele
- lokale-first Betriebslogik
- echte Verbesserungen aus Nutzung statt theoretischer Ausbau um seiner selbst willen

## Lizenz

Mit Beitraegen zu diesem Repo erklaerst du dich damit einverstanden, dass dein Beitrag unter der MIT-Lizenz dieses Projekts veroeffentlicht wird.
