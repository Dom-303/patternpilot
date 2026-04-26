# Open Source Release

## Empfohlene Freigabeform

Die passende erste Freigabe fuer `patternpilot` ist:

- oeffentliches GitHub-Repository
- Lizenz: MIT
- erster Tag: `v0.1.0`
- Positionierung: frueher, aber ernsthafter `v1`-naher Public Release

Das ist bewusst keine ueberverkaufte "`1.0.0` und fertig"-Botschaft.
Es ist eher:

- produktreif genug zum echten Nutzen
- offen genug fuer Feedback und Weiterentwicklung
- ehrlich genug bei den letzten verbleibenden Launch-Entscheidungen

## Warum MIT hier gut passt

MIT ist eine permissive Open-Source-Lizenz.

Sie ist fuer `patternpilot` sinnvoll, weil sie:

- kommerzielle Nutzung erlaubt
- Veraenderung und Weitergabe erlaubt
- fuer ein lokales Tooling-/Automation-Produkt gut verstaendlich ist

Kurz gesagt:

Menschen koennen `patternpilot` klonen, anpassen, weiterentwickeln und auch kommerziell nutzen, solange sie den MIT-Lizenzhinweis beibehalten.

## Was zur ersten Freigabe gehoert

- `LICENSE`
- `NOTICE`
- `CHANGELOG.md`
- `README.md`
- `RELEASE_CHECKLIST.md`
- `V1_STATUS.md`
- `OPERATING_MODEL.md`

## Was nicht zur ersten Freigabe gehoert

- lokale Runtime-Zustaende
- `.env.local`
- `patternpilot.config.local.json`
- frische `runs/`
- lokale Alert-/Dispatch-/Operator-Snapshots

## Empfehlte erste Release-Botschaft

`patternpilot v0.1.0` ist ein lokales, quelloffenes Repo-Intelligence-Tool, das fremde GitHub-Repositories relativ zu deinem eigenen Projekt bewertet und dich von Intake ueber Review bis zum naechsten klaren Schritt fuehrt.
