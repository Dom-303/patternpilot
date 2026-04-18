# Demo City Guide

Dieses Beispiel ist komplett fiktiv.

Es dient nur dazu, die Produktlogik von `patternpilot` sichtbar zu machen, ohne ein reales Kunden- oder Dogfood-Projekt zu zeigen.

## Was dieses Beispiel zeigt

- wie eine technische Projektbindung aussieht
- wie ein Projekt-Workspace aussieht
- welche Dateien `patternpilot` bei einem echten Projekt anlegen wuerde

## Struktur

- `bindings/demo-city-guide/`
- `projects/demo-city-guide/`

Die Namen sind absichtlich klar als Demo erkennbar.

## Wichtiger Unterschied zum echten Betrieb

Dieses Beispiel wird nicht automatisch aktiv.

Im echten Betrieb entstehen `bindings/<project>/` und `projects/<project>/` erst dann, wenn du selbst:

```bash
npm run bootstrap -- --project my-project --target ../my-project --label "My Project"
```

ausfuehrst.
