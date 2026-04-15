# Automation Alert Delivery

## Zweck

`automation-alert-deliver` und `automation-alerts` koennen Automation-Alerts jetzt ueber produktneutrale Adapter ausliefern:

- `stdout`
- Datei
- `GITHUB_STEP_SUMMARY`
- lokales Hook-Command
- eingebauter Hook ueber `--target-hook`

## Payload Contract

Der Alert-Payload hat aktuell diese Form:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-04-15T12:00:00.000Z",
  "nextJob": {
    "name": "eventbear-worker-apply",
    "status": "ready",
    "reason": "interval_elapsed",
    "command": "npm run automation:run -- --project eventbear-worker ..."
  },
  "alerts": [
    {
      "severity": "high",
      "category": "blocked_manual",
      "jobName": "eventbear-worker-apply",
      "message": "eventbear-worker-apply is blocked for manual intervention.",
      "nextAction": "Inspect the last failure, then clear the job state once the underlying issue is fixed."
    }
  ],
  "markdown": "# Patternpilot Automation Alerts\n..."
}
```

## Hook Environment

Wenn ein `command`-Target ausgefuehrt wird, setzt Patternpilot diese Variablen:

- `PATTERNPILOT_ALERT_GENERATED_AT`
- `PATTERNPILOT_ALERT_PAYLOAD_FILE`
- `PATTERNPILOT_ALERT_JSON`
- `PATTERNPILOT_ALERT_MARKDOWN`

## Direktes Command-Target

```bash
npm run automation:alert-deliver -- \
  --target command \
  --target-command "node scripts/hooks/my-alert-handler.mjs" \
  --payload-file state/automation_alert_hook_payload.json
```

## Built-in Hook

Fuer einen schnellen Einstieg kann statt eines frei geschriebenen Commands auch ein eingebauter Hook genutzt werden:

```bash
npm run automation:alert-deliver -- \
  --target command \
  --target-hook patternpilot-alert-hook \
  --payload-file state/automation_alert_hook_payload.json \
  --hook-markdown-file state/automation_alert_digest.md \
  --hook-json-file state/automation_alert_digest.json \
  --hook-print
```

Das baut intern ein lokales Command auf Basis von:

- `automation/hooks/patternpilot-alert-hook.mjs`

## Config-Beispiel

```json
{
  "automationAlertTargets": [
    {
      "type": "command",
      "hook": "patternpilot-alert-hook",
      "payloadFile": "state/automation_alert_hook_payload.json",
      "hookMarkdownFile": "state/automation_alert_digest.md",
      "hookJsonFile": "state/automation_alert_digest.json"
    }
  ]
}
```

## Warum dieser Zuschnitt

Der Adapter bleibt produktneutral:

- keine feste Plattform-Pflicht
- lokale Hooks fuer schnelle Integration
- spaeter weiter nutzbar fuer GitHub App, Webhooks oder andere Kanaele

So bleibt der Kern stabil, waehrend sich die Aussenkante schrittweise erweitern laesst.
