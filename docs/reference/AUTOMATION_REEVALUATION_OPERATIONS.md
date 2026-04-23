# Automation Re-Evaluation Operations

## Zweck

Diese Referenz beschreibt OQ-007 fuer Decision-Data-Re-Evaluation.

## Drift-Erkennung

Patternpilot klassifiziert Re-Evaluate-Targets jetzt mit expliziten Drift-Ursachen:

- `rules_fingerprint_drift`
- `missing_rules_fingerprint`
- `fallback_decision_data`
- `stale_decision_data`

Damit wird sichtbar, warum ein Queue-Eintrag neu berechnet werden soll.

## Batch-Limits

`re-evaluate` kann pro Lauf bewusst nur einen Batch abarbeiten:

- `--limit <n>`

Der Lauf reportet dabei getrennt:

- `target_rows_total`
- `target_rows_selected`
- `target_rows_remaining`
- `batch_limit`

So koennen spaetere Scheduler oder Operatoren mehrere kontrollierte Re-Eval-Batches fahren.

## Audit-Log pro Lauf

Jeder `re-evaluate`-Lauf schreibt jetzt ein eigenes Run-Artefakt unter `runs/<project>/<run-id>/`.

Das Audit enthaelt unter anderem:

- Batch-Metadaten
- Drift-Counts
- aktuelle Rules-Fingerprint-Sicht
- pro Repo die Trigger-Ursachen
- vorherigen und neuen Fingerprint
- Intake-Dossier-Write-Status

Auch Null-Target-Laeufe werden als Audit-Run festgehalten, damit sichtbar bleibt, dass bewusst geprueft wurde und nichts offen war.
