# Automation Operating Mode

## Kurzfassung

`patternpilot` hat zwei bewusst getrennte Nutzungsmodi:

- **lokaler Kernmodus**
- **optionaler Automation-Modus**

Der lokale Kernmodus ist das Hauptprodukt.
Automation ist eine erweiterte Betriebsoption, nicht die Voraussetzung dafuer.

## Was das praktisch bedeutet

Wenn keine Automation-Jobs konfiguriert sind, ist das **kein Produktfehler**.
Dann laeuft `patternpilot` einfach im lokalen Kernmodus:

- Projekt binden
- einzelne Repos intaken
- Watchlist synchronisieren
- Reviews lesen
- naechsten Schritt aus `product-readiness` nehmen

Dieser Zustand ist gesund und bewusst so gedacht.

## Wann Automation ins Spiel kommt

Automation lohnt sich erst, wenn der lokale Ablauf schon sauber sitzt:

1. GitHub-Zugang ist stabil
2. mindestens ein Projekt ist bewusst gebunden
3. Watchlist / Intake / Review fuehlen sich manuell schon sicher an
4. erst dann kommen Automation-Jobs, Alerts und Governance dazu

## Die neue Produktsprache

Damit die Automation nicht wie ein zweites halbes Produkt wirkt, nutzt `patternpilot` jetzt bewusst diese Lesart:

- **automation_mode**
  Beschreibt, ob gerade nur der lokale Kern laeuft oder ob Automation aktiv mitspielt.
- **operating_posture**
  Beschreibt, wie vorsichtig oder frei ein aktueller Governance-/Policy-Zustand ist.
- **operator_mode**
  Beschreibt, ob gerade eher manuell, gefuehrt oder konservativ unattended gearbeitet werden darf.

## Wichtige Lesebeispiele

### `automation_mode: core_only`

Das ist der gesunde Default.
Es bedeutet:

- keine Automation ist konfiguriert
- das lokale Produkt funktioniert trotzdem voll
- Alerts und Delivery sind dann ebenfalls optional

### `operating_posture: manual_only`

Das bedeutet:

- der aktuelle Zustand verlangt bewusst menschliche Pruefung
- unattended claims waeren gerade zu frueh

### `operating_posture: guarded_unattended`

Das bedeutet:

- Automation darf teilweise weiterlaufen
- aber Review, Promotion oder sensible Folgeschritte bleiben bewusst konservativ

### `operating_posture: unattended_ready`

Das bedeutet:

- die aktuelle Lage erlaubt unbeaufsichtigtere Fortsetzung
- trotzdem bleibt Monitoring Teil des Betriebs

## Woran man eine gute Grenze erkennt

Die Grenze ist gut, wenn diese drei Dinge gleichzeitig stimmen:

- der lokale Kern bleibt auch ohne Automation voll sinnvoll
- Automation erklaert sich als Zusatzmodus klar selbst
- `product-readiness`, `run-governance`, `policy-control` und `automation-jobs` sagen keine widerspruechlichen Geschichten mehr

## Praktische Reihenfolge

```bash
npm run getting-started
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
npm run intake -- --project my-project https://github.com/example/repo
npm run review:watchlist -- --project my-project --dry-run
npm run patternpilot -- product-readiness
```

Erst wenn das gut sitzt:

```bash
npm run automation:jobs
npm run automation:alerts -- --dry-run
npm run patternpilot -- run-governance --project my-project --scope automation
```
