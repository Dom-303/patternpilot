# Automation

## Zweck

Dieser Ordner enthaelt die Betriebs- und Scheduler-Scaffolds fuer Patternpilot.

## Grundidee

Externe Scheduler oder CI-Systeme sollen nur einen stabilen Einstiegspunkt aufrufen:

```bash
npm run automation:run -- --all-projects --promotion-mode prepared
```

Oder fuer einen einzelnen Projekt-Loop:

```bash
npm run automation:run -- --project eventbear-worker --promotion-mode apply
```

## Enthaltene Vorlagen

- `patternpilot-jobs.json`
- `github-actions/patternpilot-watchlist.yml.example`
- `systemd/patternpilot-sync.service`
- `systemd/patternpilot-sync.timer`

## Betriebsmodi

- `promotion-mode skip`
- `promotion-mode prepared`
- `promotion-mode apply`
