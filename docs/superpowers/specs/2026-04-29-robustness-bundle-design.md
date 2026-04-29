# Robustness Bundle (v0.4) — Design

- status: proposed
- created_at: 2026-04-29
- authors: domi + claude
- closes: OQ-007 (decision-data re-evaluation operations), OQ-008 (scheduler/failure-recovery policy)

## Zweck

Patternpilot hat heute reife Drift-Erkennung (4 Drift-Reasons in `re-evaluate.mjs`) und eine fortgeschrittene Alert-Delivery (4 Channel-Typen). Beides ist aber **nicht in den User-Flow integriert**:

- Stale Data wird heute nur sichtbar, wenn der Nutzer aktiv `re-evaluate` oder `run-drift` aufruft. In normalen Befehlen (intake, on-demand) gibt es keine Erinnerung.
- Webhook-Channels (Slack, Discord, Teams) fehlen — heute nur file/github-summary/command/stdout.
- Auto-Resume für gelockte Automations-Jobs fehlt — bleibt bis manueller Eingriff.

Diese Phase macht beides für den Nutzer sichtbar und umsetzbar, ohne neue Architektur einzuführen.

## Scope

### OQ-007 — Stale-Data sichtbar im User-Flow

- **T1**: Stale-Data-Detector als reine Read-Utility (scannt Queue, zählt nach Drift-Reason, liefert Top-N-Beispiele).
- **T2**: Banner-Output am Anfang von `intake` und `on-demand`, wenn Stale-Daten existieren — mit konkretem nächsten Befehl (`re-evaluate --stale-only`).
- **T3**: Re-Evaluate-Audit-Log: jede Re-Evaluate-Aktion schreibt einen kurzen Eintrag in `state/re-evaluate-history.json` (was, wann, wieviele, welcher Drift-Reason).

### OQ-008 — Webhook-Channel + Auto-Resume

- **T4**: Neuer Channel-Typ `webhook` in `lib/automation/alert-delivery.mjs` (POST JSON an konfigurierbare URL, Slack-/Discord-/Teams-kompatibel via Standard-Webhook-Format).
- **T5**: Auto-Resume-Policy: gelockte Automation-Jobs werden nach konfigurierbarer Idle-Zeit (Default: 6h) automatisch freigegeben. Bestehender `runAutomationJobClear` wird intern als Auto-Aufrufer benutzt.

### Bewusst NICHT in dieser Phase

- Neuer Standalone-Befehl `stale-check`: Banner-in-existing-commands erfüllt denselben Zweck mit weniger Surface
- Komplexe Auto-Resume-Strategien (exponential backoff, Klassifikation pro Failure-Type): erst wenn Real-Use Pain-Points zeigt
- Slack/Discord-spezifische Helper-Funktionen: Standard-Webhook-Format reicht für alle drei
- Multi-Recipient-Alert-Routing: heute hat ein Job einen Channel, das bleibt so

## Leitprinzipien

1. **Keine Architektur-Brüche**: alle Änderungen stecken vorhandene Mechanik in User-Flows oder erweitern bestehende Channel-Typen-Liste. Keine neuen Subsystem-Klassen.
2. **Stale-Banner ist pure Anzeige**, keine Aktion: zeigt nur Hinweis + Befehl, modifiziert nichts.
3. **Webhook ist generisch** (POST application/json), nicht Slack-spezifisch. Slack-Inbound-Webhook akzeptiert beliebiges JSON.
4. **Auto-Resume ist konservativ** (6h Default, abschaltbar via `autoResumeMinutes: 0` in der Job-Config).
5. **Audit-Log ist append-only** und gitignored (gehört zu `state/`).

## Datenfluss-Änderungen

| Pfad | Wann | Quelle |
|---|---|---|
| `state/re-evaluate-history.json` | nach jedem `re-evaluate`-Run | T3 |
| `state/automation_job_state.json` | nach Auto-Resume-Tick | T5 (überschreibt mit released-Locks) |

Keine Config-Schema-Änderungen, keine Binding-File-Änderungen.

## Erfolgs-Kriterien

1. Wenn Queue 5+ stale Entries hat, zeigt `intake` ohne weitere Flags einen Banner mit Anzahl + nächstem Befehl.
2. Nach `re-evaluate --stale-only` hat `state/re-evaluate-history.json` einen neuen Eintrag mit Anzahl + Drift-Reasons.
3. Mit Webhook-Channel konfiguriert: Test-Alert kommt im konfigurierten Webhook-Endpunkt an.
4. Job-Lock älter als 6h wird beim nächsten `automation-jobs`-Aufruf automatisch released, mit Audit-Eintrag.
5. Existierende Suite bleibt 100% grün.

## Risiken

- **Banner-Spam**: Falls jemand 1000+ stale Entries hat, soll der Banner nicht endlos sein. Mitigation: max. 3 Beispiele zeigen + Gesamtzahl.
- **Webhook-Failure**: Wenn Endpunkt down ist, soll der Alert nicht den ganzen Run brechen. Mitigation: Fehler in Audit loggen, Run fortsetzen.
- **Auto-Resume-Race**: Zwei Prozesse könnten gleichzeitig "auto-release" versuchen. Mitigation: bestehender Locking-Mechanismus von `runAutomationJobClear` schützt.
