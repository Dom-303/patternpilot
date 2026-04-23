# Automation Failure Recovery Policy

## Zweck

Diese Referenz beschreibt den MVP fuer OQ-008:

- erster Live-Alert-Kanal in GitHub Actions
- klare Auto-Resume-Regeln fuer retrybare Fehler
- harte Blockade fuer Fehler, die bewusst menschliches Eingreifen brauchen

## Erster Live-Kanal

Der erste produktive Alert-Kanal fuer CI ist:

- `GITHUB_STEP_SUMMARY`

Damit erscheinen Automation-Alerts direkt in der sichtbaren GitHub-Actions-Run-Zusammenfassung.

Fuer lokale Nutzung bleiben die bestehenden lokalen Artefakte weiter gueltig.

## Retry- und Resume-Regeln

Patternpilot trennt fuer Automation-Laeufe zwischen zwei Recovery-Pfaden:

- `auto_resume_after_cooldown`
- `manual_clear_required`

### Auto-Resume nach Cooldown

Auto-Resume ist nur fuer retrybare Fehler in auto-resume-faehigen Phasen gedacht.

Aktuelle MVP-Klassen:

- `scheduler_lock` -> `15` Minuten Cooldown
- `rate_limit` / `429` -> `15` Minuten Cooldown
- `network_transient` -> `15` Minuten Cooldown

Wenn so ein Fehler auftritt und die Resume-Empfehlung `autoResumeAllowed: true` ergibt:

- Job-State geht auf `backoff`
- `nextRetryAt` wird gesetzt
- der Alert-Kanal meldet den geplanten Auto-Resume-Zeitpunkt
- nach Ablauf des Cooldowns wird der Job wieder `ready`

### Harte Blockade

Diese Fehler bleiben bewusst hart und verlangen manuellen Eingriff:

- `auth`
- `project_config`
- retrybare Fehler, deren Resume-Empfehlung `autoResumeAllowed: false` liefert

In diesen Faellen:

- Job-State geht auf `blocked_manual`
- kein automatischer Retry wird terminiert
- Operator bekommt einen klaren Next Action Hinweis
- Weiterlauf erst nach `automation-job-clear`

## Manual Clear

`automation-job-clear` loest bewusst:

- `blocked_manual`
- `backoff`
- `blocked_requalify`
- latched operator-ack Restzustand

Danach ist der Job wieder scheduler-faehig und kann ueber `automation:jobs` / `automation:dispatch` normal weiterlaufen.

## Alert-Signale

Der Alert-Kanal zeigt im MVP besonders diese Failure-Recovery-Signale:

- `blocked_manual`
- `blocked_requalify`
- `retry_backoff_scheduled`
- `extended_backoff`
- `repeated_retryable_failures`
- Dispatch-/Governance-Eskalationen

So ist sichtbar:

- was automatisch weiterlaeuft
- was bewusst wartet
- was aktiv vom Operator uebernommen werden muss
