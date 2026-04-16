# Open Questions

*Arbeitsdokument fuer offene Architektur-, Produkt- und Betriebsfragen in `patternpilot`.*

## Zweck

Diese Datei haelt nur Fragen fest, die fuer die weitere Produktreife von Patternpilot wirklich relevant sind.

Sie ist bewusst kein Sammelbecken fuer beliebige Ideen.

## Aktualisierung

Diese Datei wird zusammen mit `STATUS.md` als operative Uebergabeflaeche mitgefuehrt.

- last_updated: 2026-04-16T15:32:32.688Z
- latest_run_reference: integration/github-app-dispatch

## Handoff Note

- settled_now: target-repo context is run-scoped and transparent, not a hardwired product identity.
- settled_now_too: chain-run automation, discovery quality policy, decision-data re-evaluation and scheduler-ready ops signals are now part of the kernel.
- settled_now_three: scheduler job-state, manual clear and alert views are now available for the automation layer.
- settled_now_four: external scheduler glue and alert artifacts are now available via automation-dispatch and automation-alerts.
- settled_now_five: the on-demand primary flow can now run explicit repo URLs end-to-end and writes stable report pointers per project.
- settled_now_six: the last Decision Summary gap heuristic has been replaced by engine-level `gapAreaCanonical` and weighted `runGapSignals`.
- settled_now_seven: discovery policies now gate repo, license, host, signal, risk and capability quality directly inside discovery and surface those results in reports.
- settled_now_eight: policy-audit and discovery calibration hints now turn policy blocker counts into concrete tuning guidance per run.
- next_recommended_step: run real policy audits and tune project-specific defaults before adding more onboarding or product-shell surface.

## Aktuell offene Fragen

### OQ-001 — REPORT_UI_DIRECTION

- prioritaet: BALD
- frage: Welche finale visuelle Richtung soll die HTML-Report-Schicht bekommen, bevor daraus eine spaetere App- oder Web-Oberflaeche wird?
- warum_offen: Die technische HTML-Schicht steht, aber Designsystem, visuelle Sprache und moegliche Branding-Regeln sind noch nicht final entschieden.
- naechster_sinnvoller_schritt: Ein verbindliches Report-UI-Framework mit Farben, Typografie, Komponenten und Chart-Patterns festziehen.

### OQ-002 — CHAIN_RUN_AUTOMATION

- prioritaet: BALD
- frage: Wie wird der vorhandene Kettenlauf `discover -> watchlist -> intake -> re-evaluate -> review` operativ belastbar gemacht?
- warum_offen: Der Kernlauf existiert, aber Run-Frequenz, Failure-Recovery, Projekt-uebergreifende Zeitfenster und spaetere Scheduling-Regeln sind noch offen. Diese Schicht bleibt bewusst optional gegenueber dem primaeren On-Demand-Modus.
- naechster_sinnvoller_schritt: Betriebsmodus fuer wiederkehrende Laeufe, Retry-Regeln und projektweise Limits definieren, ohne den Produktkern scheduler-zentriert zu bauen.

### OQ-003 — QUALITY_FILTERS_FOR_DISCOVERY

- prioritaet: BALD
- frage: Wie fein muessen projektbezogene Discovery-Policies spaeter werden, damit sie echte Produktqualitaet tragen?
- warum_offen: Die zweite Policy-Stufe und ein eigener Audit-/Calibration-Flow existieren jetzt. Offen ist vor allem noch die Kalibrierung an echten Discovery-Runs und die Frage, welche Gates pro Projekt wirklich hart statt nur bevorzugend wirken sollen.
- naechster_sinnvoller_schritt: Mit echten Policy-Audit-Laeufen die auffaelligsten Blocker pruefen, daraus Projekt-Defaults schaerfen und erst dann weitere Gate-Typen hinzufuegen.

### OQ-004 — GITHUB_APP_CUTOVER

- prioritaet: BALD
- frage: Wann soll Patternpilot vom PAT-Zwischenzustand auf echten GitHub-App-Betrieb umgestellt werden?
- warum_offen: Die Scaffolds sind da, aber App-Deployment, Webhooks und Installationsmodell sind noch nicht produktiv angeschlossen.
- naechster_sinnvoller_schritt: GitHub-App registrieren, Secrets setzen und einen ersten Live-Flow gegen reale Repos pruefen.

### OQ-005 — LLM_AUGMENTATION_BOUNDARY

- prioritaet: SPAETER
- frage: Wo ergaenzt spaeter eine LLM-Schicht die heuristische Engine sinnvoll, ohne den belastbaren Kern zu verwischen?
- warum_offen: Der aktuelle Fokus liegt bewusst auf einer halluzinationsarmen, reproduzierbaren Basis.
- naechster_sinnvoller_schritt: Erst nach stabiler Discovery-, Review- und Report-Schicht LLM-Einsatz nur fuer Verdichtung und Briefing pruefen.

### OQ-006 — FIRST_RUN_ONBOARDING_AND_PROJECT_SETUP_FLOW

- prioritaet: SPAETER
- frage: Wie soll der erste Einstieg fuer neue Nutzer oder neue Projekte aussehen, ohne den stabilen Kern zu frueh zu ueberformen?
- warum_offen: Ein gefuehrter Erststart mit Projektwahl, Kontextabfragen, Default-Profilen und klarer Pipeline ist sinnvoll, aber erst dann, wenn die innere Engine und der Kettenlauf wirklich stehen.
- naechster_sinnvoller_schritt: Erst nach weiterer Kernel-Haertung den Setup-Flow gegen `init-project`, `doctor`, `setup-checklist` und spaetere Chain-Defaults modellieren.

### OQ-007 — DECISION_DATA_REEVALUATION_OPERATIONS

- prioritaet: JETZT
- frage: Wann und wodurch sollen stale oder fallback Decision-Daten automatisch neu berechnet werden?
- warum_offen: Ein Re-Evaluate-Flow existiert jetzt, aber Trigger wie Regel-Aenderungen, Batch-Groessen, Audit-Spuren und Benachrichtigung ueber Drift sind noch nicht final festgelegt.
- naechster_sinnvoller_schritt: Operative Regeln fuer Drift-Erkennung, Batch-Limits, Logging und spaetere Scheduling-Hooks definieren.

### OQ-008 — SCHEDULER_AND_FAILURE_RECOVERY_POLICY

- prioritaet: JETZT
- frage: Wie soll Patternpilot sich unter wiederkehrender Automation bei Teilfehlern, API-Ausfaellen oder projektweisen Blockern verhalten?
- warum_offen: Locking, Retry-Klassifikation, Job-State, Alerting, Manual-Clear und Dispatch-Glue existieren jetzt, aber echte Benachrichtigungskanaele und spaetere Auto-Resume-Regeln sind noch nicht final festgelegt.
- naechster_sinnvoller_schritt: Den ersten echten Kanal fuer Alerts festlegen, etwa GitHub Actions Summary oder Mail/Slack, und bestimmen, ob bestimmte Retry-Faelle nach genug Abstand automatisch wieder freigegeben werden duerfen.

