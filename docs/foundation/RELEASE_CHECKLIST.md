# Release Checklist

## Zweck

Diese Checkliste ist der einfache letzte Durchlauf vor einem Push, Release oder einer oeffentlichen Freigabe.

Sie soll keine grosse Theorie sein.
Sie soll verhindern, dass ein lokaler Arbeitszustand versehentlich als Produktzustand veroeffentlicht wird.

## 1. Oeffentliche Oberflaeche pruefen

- README ist fuer neue Nutzer verstaendlich
- `GETTING_STARTED.md` fuehrt ohne Vorwissen
- `ADVANCED_GUIDE.md` deckt den technischen Pfad ab
- es gibt keine realen Kunden- oder Dogfood-Beispiele in der sichtbaren Produktoberflaeche

## 2. Lokales gegen oeffentliches Material pruefen

- `patternpilot.config.local.json` ist nicht committed
- `state/*.json` und `state/*.md` sind nicht committed
- `STATUS.md` und `OPEN_QUESTION.md` sind nicht committed
- frische Run-Artefakte unter `runs/` sind nicht committed
- frische Projektartefakte unter `projects/<project>/...` sind nicht versehentlich committed

Wenn du unsicher bist, lies:

- [PUBLIC_VS_LOCAL.md](PUBLIC_VS_LOCAL.md)

## 3. Frischstart pruefen

Diese drei Kommandos sollen in einem frischen Zustand sinnvoll sein:

```bash
npm run getting-started
npm run bootstrap -- --dry-run
npm run patternpilot -- product-readiness --dry-run
```

Erwartung:

- kein kryptischer Crash
- klare naechste Schritte
- `product-readiness` darf im leeren Zustand bewusst `not_ready` melden

## 4. Release-Smoke laufen lassen

```bash
npm run release:smoke
```

Erwartung:

- die zentrale Produkt-, Discovery-, Review- und Policy-Kette bleibt gruen

## 5. Letzten Release-Check laufen lassen

```bash
npm run release:check
```

Erwartung:

- frischer Zustand ohne Projekt: `not_ready` mit Bootstrap-Hinweis
- echter Betriebszustand: klarer Go-/Follow-up-/Hold-Befund

## 6. Fremdprojekt-Beweis nicht vergessen

Vor einer echten `v1`-Freigabe sollte mindestens ein frischer Fremdprojekt-Durchlauf belegt sein:

- frischer Workspace
- GitHub-Zugang verifiziert
- `bootstrap`
- `intake` oder `sync:watchlist`
- `review`
- `product-readiness`

Der aktuelle Produktstatus und Reife-Beleg liegen hier:

- [V1_STATUS.md](V1_STATUS.md)

## 7. Letzte Sicht auf Git

Vor dem Push:

- `git status --short`
- bewusst pruefen, was wirklich mit nach GitHub soll

Faustregel:

- Produktcode, Tests, Doku und bewusst gepflegte Referenzen duerfen rein
- lokale Betriebsdaten, Snapshots und Operator-Zustand nicht
