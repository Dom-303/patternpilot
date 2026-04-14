# Automation

## Zweck

Dieser Ordner enthaelt die Betriebs- und Scheduler-Scaffolds fuer Patternpilot.

## Grundidee

Externe Scheduler oder CI-Systeme sollen nur einen stabilen Einstiegspunkt aufrufen:

```bash
npm run automation:dispatch
```

Oder fuer einen einzelnen Projekt-Loop:

```bash
npm run automation:run -- --project eventbear-worker --automation-job eventbear-worker-apply --promotion-mode apply
```

Und fuer reine Scheduler-Entscheidungen ohne Run:

```bash
npm run automation:jobs
```

Fuer Alerts und manuelle Entsperrung:

```bash
npm run automation:alerts
npm run patternpilot -- automation-job-clear --automation-job eventbear-worker-apply --notes "manual resume after fix"
```

Wenn ein externer Scheduler wirklich den Gesamtfluss steuern soll, ist die Reihenfolge jetzt:

1. `automation:jobs`
2. `automation:dispatch`
3. `automation:alerts`

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
2. Quality Gate auf Discovery-Ergebnisse inklusive projektbezogener Discovery-Policy
3. selektiver Watchlist-Handoff
4. Intake ueber die effektive Menge
5. Re-Evaluate fuer stale oder fallback Decision-Daten
6. Watchlist-Review
7. optionale Promotion
8. Automation-Audit unter `runs/automation/<run-id>/`

Die wichtigsten Guards sind:

- `--automation-min-confidence <low|medium|high>`
- `--automation-max-new-candidates <n>`
- `--automation-re-evaluate-limit <n>`
- `--automation-continue-on-project-error`
- `--automation-force-lock`
- `--automation-lock-timeout-minutes <n>`
- `--skip-discovery`
- `--skip-review`

## Ops Signals

Jeder Automation-Lauf erzeugt jetzt eine eigene Zusammenfassung mit:

- Projektstatus (`completed`, `completed_with_blocks`, `failed`, `skipped`)
- Phasenstatus fuer `discover`, `gate`, `watchlist_handoff`, `intake`, `re_evaluate`, `review`, `promote`
- kompakten Zaehlern fuer selektierte Kandidaten, Re-Evaluate-Targets und Projektfehler
- einem Lock-Eintrag unter `state/automation.lock.json`, damit parallele Scheduler-Laeufe sich nicht gegenseitig ueberfahren
- einer maschinenlesbaren `ops.json` unter `runs/automation/<run-id>/`
- optionalem Job-State unter `state/automation_jobs_state.json`, wenn ein Lauf mit `--automation-job <name>` gestartet wurde
- Alert-Artefakten unter `state/automation_alerts.json` und `state/automation_alerts.md`

Damit ist der Kettenlauf nicht nur ausfuehrbar, sondern auch spaeter fuer Scheduler und Failure-Recovery auswertbar.

## Manual Resume

Wenn ein Job in `blocked_manual` oder einem unerwuenschten Backoff haengen bleibt, kann der State bewusst geloescht werden:

- `automation-alerts` zeigt die betroffenen Jobs
- `automation-job-clear --automation-job <name>` entfernt Block-/Backoff-Zustand
- danach ist der Job ueber `automation-jobs` wieder als `ready` sichtbar

## Maintenance

Fuer bestehende Queue-Eintraege gibt es jetzt einen separaten Refresh-Pfad:

```bash
npm run re-evaluate -- --project eventbear-worker --stale-only --dry-run
```

Damit werden stale oder fallback Decision-Felder neu berechnet und der `## Decision Signals`-Block in bestehenden Intake-Dossiers mitgezogen.
