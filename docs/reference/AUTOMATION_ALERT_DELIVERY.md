# Automation Alert Delivery

## Zweck

`automation-alert-deliver` und `automation-alerts` koennen Automation-Alerts jetzt ueber produktneutrale Adapter ausliefern:

- `stdout`
- Datei
- `GITHUB_STEP_SUMMARY`
- lokales Hook-Command
- eingebauter Hook ueber `--target-hook`

Ohne explizite `automationAlertTargets` kann Patternpilot ausserdem ein eingebautes lokales Profil aktivieren:

- `automationAlertPreset: "local-operator"`

Fuer GitHub Actions gibt es ausserdem ein schlankes Preset fuer den ersten Live-Kanal:

- `automationAlertPreset: "github-actions-summary"`

## Payload Contract

Der Alert-Payload hat aktuell diese Form:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-04-15T12:00:00.000Z",
  "attention": {
    "status": "operator_attention_required",
    "deliveryPriority": "urgent",
    "signals": ["operator_review_open", "high_severity_alert"],
    "promotedJobs": ["my-project-apply"],
    "summary": "1 open operator review requires deliberate follow-up.",
    "nextAction": "Acknowledge the latch deliberately before unattended dispatch resumes."
  },
  "nextJob": {
    "name": "my-project-apply",
    "status": "ready",
    "reason": "interval_elapsed",
    "command": "npm run automation:run -- --project my-project ..."
  },
  "alerts": [
    {
      "severity": "high",
      "category": "blocked_manual",
      "jobName": "my-project-apply",
      "message": "my-project-apply is blocked for manual intervention.",
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
  "automationAlertPreset": "local-operator",
  "automationAlertTargets": [
    {
      "type": "command",
      "name": "operator-review-digest",
      "hook": "patternpilot-alert-hook",
      "payloadFile": "state/automation_alert_hook_payload.json",
      "hookMarkdownFile": "state/automation_alert_digest.md",
      "hookJsonFile": "state/automation_alert_digest.json",
      "minDeliveryPriority": "elevated",
      "attentionSignalsAny": ["operator_review_open", "operator_attention_alert"]
    }
  ]
}
```

## GitHub Actions Summary Preset

Wenn Alerts direkt in die sichtbare GitHub-Actions-Run-Zusammenfassung geschrieben werden sollen:

```json
{
  "automationAlertPreset": "github-actions-summary",
  "automationAlertTargets": []
}
```

Oder ad hoc per CLI:

```bash
npm run automation:alerts -- --target github-summary
```

## Delivery Priorisierung

Targets koennen optional auf die berechnete `attention` reagieren:

- `minDeliveryPriority`: `routine`, `elevated`, `urgent`
- `attentionSignalsAny`: liefert nur aus, wenn mindestens eines der Signale im Payload vorhanden ist

So kann Patternpilot offene Operator-Faelle gezielt an schaerfere Kanaele ausliefern, ohne die Basispipeline repo-spezifisch zu verdrahten.

## Built-in Preset

`local-operator` ist das eingebaute Default-Profil fuer lokale Produktnutzung ohne externe Infrastruktur. Wenn `automationAlertTargets` leer sind, erzeugt das Preset:

- `state/automation_alerts_published.md`
- `state/automation_alert_digest.md`
- `state/automation_alert_digest.json`
- `state/automation_operator_attention.md` nur bei `urgent`-Operator-Signalen

Damit hat Patternpilot out of the box einen lokalen Journal-, Digest- und Attention-Pfad, ohne dass zuerst eigene Delivery-Adapter geschrieben werden muessen.

## Warum dieser Zuschnitt

Der Adapter bleibt produktneutral:

- keine feste Plattform-Pflicht
- lokale Hooks fuer schnelle Integration
- spaeter weiter nutzbar fuer GitHub App, Webhooks oder andere Kanaele

So bleibt der Kern stabil, waehrend sich die Aussenkante schrittweise erweitern laesst.

Die Failure-Recovery-Regeln fuer Backoff, Auto-Resume und Manual-Clear stehen unter:

- [AUTOMATION_FAILURE_RECOVERY_POLICY.md](./AUTOMATION_FAILURE_RECOVERY_POLICY.md)
