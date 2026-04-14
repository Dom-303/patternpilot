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

## Kettenlauf

`automation-run` ist jetzt der orchestrierte Einstieg fuer den Standardfluss:

1. heuristische Discovery pro Projekt
2. Quality Gate auf Discovery-Ergebnisse
3. selektiver Watchlist-Handoff
4. Intake ueber die effektive Menge
5. Watchlist-Review
6. optionale Promotion

Die wichtigsten Guards sind:

- `--automation-min-confidence <low|medium|high>`
- `--automation-max-new-candidates <n>`
- `--skip-discovery`
- `--skip-review`
