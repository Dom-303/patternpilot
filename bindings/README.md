# Bindings

`bindings/` enthaelt die technische Zielrepo-Anbindung von `patternpilot`.

Hier liegt, was das Produkt ueber ein Zielprojekt wissen muss:

- welche Dateien zuerst gelesen werden sollen
- welche Verzeichnisse relevant sind
- welche Fragen beantwortet werden sollen
- welche Discovery- und Policy-Schaerfe gelten soll

## Typischer Inhalt

- `PROJECT_BINDING.json`
- `ALIGNMENT_RULES.json`
- `DISCOVERY_POLICY.json`
- `WATCHLIST.txt`

## Abgrenzung

- `bindings/<project>/` = technische Zieldefinition
- `projects/<project>/` = lesbarer Arbeits- und Ergebnisraum

## Frischer Produktzustand

Bei einer frischen Installation kann `bindings/` leer sein.

Neue Bindings entstehen erst, wenn du ein Zielprojekt verbindest:

```bash
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
```

## Beispiel

Ein rein fiktives Referenzbeispiel liegt unter:

[examples/demo-city-guide/README.md](../examples/demo-city-guide/README.md)
