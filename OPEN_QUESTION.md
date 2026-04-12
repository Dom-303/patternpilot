# Open Questions

*Arbeitsdokument fuer offene Architektur-, Produkt- und Betriebsfragen in `patternpilot`.*

## Zweck

Diese Datei haelt nur Fragen fest, die fuer die weitere Produktreife von Patternpilot wirklich relevant sind.

Sie ist bewusst kein Sammelbecken fuer beliebige Ideen.

## Aktualisierung

Diese Datei wird zusammen mit `STATUS.md` als operative Uebergabeflaeche mitgefuehrt.

- last_updated: 2026-04-12T17:55:17.631Z
- latest_run_reference: eventbear-worker/2026-04-12T10-39-29-927Z

## Aktuell offene Fragen

### OQ-001 — REPORT_UI_DIRECTION

- prioritaet: BALD
- frage: Welche finale visuelle Richtung soll die HTML-Report-Schicht bekommen, bevor daraus eine spaetere App- oder Web-Oberflaeche wird?
- warum_offen: Die technische HTML-Schicht steht, aber Designsystem, visuelle Sprache und moegliche Branding-Regeln sind noch nicht final entschieden.
- naechster_sinnvoller_schritt: Ein verbindliches Report-UI-Framework mit Farben, Typografie, Komponenten und Chart-Patterns festziehen.

### OQ-002 — CHAIN_RUN_AUTOMATION

- prioritaet: JETZT
- frage: Wie soll der vollautomatische Kettenlauf `discover -> watchlist -> intake -> review` standardmaessig orchestriert werden?
- warum_offen: Die einzelnen Bausteine existieren, aber der integrierte End-to-End-Run mit sauberen Guards, Limits und Quality-Gates ist noch nicht gebaut.
- naechster_sinnvoller_schritt: Einen eigenen Chain-Run-Command mit Blacklist/Allowlist und Safety-Limits einfuehren.

### OQ-003 — QUALITY_FILTERS_FOR_DISCOVERY

- prioritaet: JETZT
- frage: Welche Blacklist-, Allowlist- und Qualitaetsregeln sollen Discovery-Kandidaten vor dem Watchlist-Handoff filtern?
- warum_offen: Discovery ist heuristisch stabil, aber fuer echte Produktnutzung fehlen noch harte Ausschluss- und Vertrauensregeln.
- naechster_sinnvoller_schritt: Policy-Dateien fuer ausgeschlossene Plattformen, Mindestsignale und bevorzugte Musterfamilien einfuehren.

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

