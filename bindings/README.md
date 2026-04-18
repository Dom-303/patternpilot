# Bindings

## Zweck

`bindings/` enthaelt die technische Zielrepo-Anbindung von `patternpilot`.

Hier liegt, was das Produkt ueber ein externes Zielrepo wissen und konfigurieren muss, damit Discovery, Review und Policy korrekt auf dieses Zielsystem ausgerichtet werden.

## Typischer Inhalt pro Zielprojekt

- `PROJECT_BINDING.md`
- `PROJECT_BINDING.json`
- `ALIGNMENT_RULES.json`
- `DISCOVERY_POLICY.json`
- `WATCHLIST.txt`

## Abgrenzung zu `projects/`

`bindings/<project>/` ist die technische und maschinennahe Zieldefinition.

`projects/<project>/` ist der lesbare Arbeits- und Ergebnisraum, in dem Patternpilot seine projektbezogenen Artefakte ablegt.

Kurz:

- `bindings/` sagt Patternpilot, wie es ein Zielprojekt lesen soll
- `projects/` zeigt, was Patternpilot fuer dieses Zielprojekt erzeugt hat
