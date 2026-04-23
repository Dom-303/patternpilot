# Scheduler Chain-Run Automation

## Zweck

Diese Referenz beschreibt die OQ-002-Haertung fuer den Kettenlauf:

- `discover -> watchlist -> intake -> re-evaluate -> review -> promote`

## Retry-Klassen

Der Chain-Run nutzt die Failure-Recovery-Regeln aus `AUTOMATION_FAILURE_RECOVERY_POLICY.md`.

Wichtig fuer den Scheduler:

- retrybare Fehler gehen in `backoff` und melden ihren Auto-Resume-Zeitpunkt ueber den Alert-Kanal
- harte Fehler gehen in `blocked_manual`
- wiederholte Blocks / Repeats bleiben in den Alert-Artefakten sichtbar

## Projektweise Limits

Automation-Jobs koennen jetzt ein Projektfenster definieren:

- `maxProjectsPerRun`

Wenn ein Job mehr Projekte kennt als er pro Lauf bearbeiten soll:

- waehlt Patternpilot nur ein Fenster von Projekten
- das Fenster rotiert ueber `nextProjectCursor`
- spaetere Scheduler-Ticks starten beim naechsten Projekt statt immer vorne

So lassen sich grosse Installationen in kleinere, stabile Batches schneiden.

## Scheduling-Hook

Jobs koennen optional ein lesbares Scheduling-Metadatum tragen:

- `schedulerHook`

Beispiel:

```json
{
  "name": "all-project-watchlists",
  "scope": "all-projects",
  "schedulerHook": "staggered-project-window",
  "maxProjectsPerRun": 3
}
```

`schedulerHook` ist bewusst kein harter Plattform-Adapter.
Er ist ein sichtbares Ops-Signal fuer den Job-Typ und taucht in Job-State, Dispatch-/Alert-Payloads und Run-Artefakten auf.

## Persistierte Scheduling-Daten

Der Job-State merkt sich fuer Chain-Runs:

- `jobScope`
- `schedulerHook`
- `maxProjectsPerRun`
- `totalProjects`
- `projectWindowKeys`
- `projectWindowTruncated`
- `projectWindowStartCursor`
- `nextProjectCursor`

Damit kann ein externer Scheduler oder Operator sehen:

- welches Projektfenster gerade lief
- ob der Lauf beschnitten war
- wo der naechste Lauf wieder einsetzt

## Praktischer Effekt

Damit wird der Kettenlauf operativ belastbarer:

- Retry und Alerting sprechen dieselbe Sprache
- Projektmengen wachsen nicht unkontrolliert pro Tick
- Scheduler koennen auf stabile, rotierende Windows aufsetzen
