# Operating Model

## Kernidee

`patternpilot` ist kein loses Link-Archiv.

Es bewertet externe Repositories immer relativ zu einem Zielprojekt.

Darum besteht der Betriebsmodus immer aus zwei Ebenen:

- Produktkern
- Zielprojektbindung

## 1. Produktkern

Der Produktkern lebt in:

- `lib/`
- `scripts/`
- `automation/`
- `deployment/`
- `docs/`

Dieser Teil bleibt generisch.

## 2. Zielprojektbindung

Ein Zielprojekt wird ueber zwei getrennte Flaechen eingebunden:

- `bindings/<project>/`
- `projects/<project>/`

`bindings/<project>/` beschreibt, wie `patternpilot` das Zielprojekt lesen soll.

`projects/<project>/` ist der lesbare Arbeits- und Ergebnisraum fuer dieses Zielprojekt.

## 3. Der erste echte Ablauf

Ein neues Zielprojekt wird zuerst eingebunden:

```bash
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
```

Danach folgen typischerweise:

```bash
npm run intake -- --project my-project https://github.com/example/repo
npm run sync:watchlist -- --project my-project
npm run review:watchlist -- --project my-project
```

## 4. Output-Schichten

`patternpilot` trennt bewusst:

- Queue
- Arbeitsdossiers
- Laufprotokolle
- kuratierte Wissensartefakte

Konkret:

- `state/repo_intake_queue.csv`
- `projects/<project>/intake/`
- `runs/<project>/<run-id>/`
- `knowledge/`

## 5. Frische Installation

Ein frisches Produkt darf leer starten.

Das ist kein Fehler, sondern Teil der Produktlogik:

- keine versteckten Kundenprojekte
- keine mitgelieferte Live-Bindung
- kein Zwang, erst Dogfood-Kontext zu verstehen

Wenn du eine Struktur sehen willst, ohne selbst direkt ein Projekt anzulegen, nutze das fiktive Referenzpaket unter:

[examples/demo-city-guide/README.md](../../examples/demo-city-guide/README.md)
