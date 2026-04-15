# Automation Hooks

Dieser Ordner enthaelt lokale Beispiel-Hooks fuer den produktneutralen Alert-Adapter von Patternpilot.

## Enthaltene Hooks

- `patternpilot-alert-hook.mjs`

## Zweck

Der Hook liest den Alert-Payload aus:

- `--payload-file <path>`
- oder `PATTERNPILOT_ALERT_PAYLOAD_FILE`
- oder `PATTERNPILOT_ALERT_JSON`

und kann daraus:

- eine kompakte Markdown-Digest-Datei schreiben
- eine JSON-Digest-Datei schreiben
- oder den Digest direkt nach stdout ausgeben

## Beispiel Direktlauf

```bash
node automation/hooks/patternpilot-alert-hook.mjs \
  --payload-file state/automation_alerts.json \
  --write-markdown state/automation_alert_digest.md \
  --write-json state/automation_alert_digest.json \
  --print
```

## Beispiel ueber den Alert-Adapter

```bash
npm run automation:alert-deliver -- \
  --target command \
  --target-hook patternpilot-alert-hook \
  --payload-file state/automation_alert_hook_payload.json \
  --hook-markdown-file state/automation_alert_digest.md \
  --hook-json-file state/automation_alert_digest.json
```

## Zielbild

Diese Hooks sind bewusst lokale Adapter. Sie koennen spaeter leicht ersetzt oder erweitert werden, ohne den Patternpilot-Kern an einen bestimmten Kanal oder eine bestimmte Plattform zu koppeln.
