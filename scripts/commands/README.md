# Patternpilot Command Modules

Diese Ebene ist die kuenftige Werkzeug-Familien-Schicht fuer `patternpilot`.

Ziel:

- `scripts/patternpilot.mjs` bleibt nur der duenner CLI-Einstieg
- Command-Familien ziehen schrittweise in eigene Dateien unter `scripts/commands/`
- `lib/` bleibt weiterhin die Engine- und Fachlogik-Schicht

Der Umbau ist inzwischen real in Benutzung:

- `run-diagnostics.mjs` traegt die Run-/Drift-/Governance-Familie
- `automation/` traegt Run, Jobs, Dispatch, Alerts und Alert-Delivery inklusive lokaler Hook-Adapter
- `policy-core.mjs` und `policy-curation.mjs` tragen die groesseren Kalibrierungs- und Kurationspfade
- `project-admin.mjs` ist jetzt nur noch ein duennes Barrel ueber `project-admin/`
- `project-admin/core.mjs` traegt Setup, Doctor, Projektbindung und Workspace-Discovery
- `project-admin/github-app-preview.mjs` traegt GitHub-App-Readiness, Eventplan, Event-Vorschau, Webhook-Envelope-Vorschau und Route-Planung
- `project-admin/github-app-installations.mjs` traegt Installation-Registry, Governance, Runtime, Operations, Service-Lanes, Service-Plan, Worker-Routing, Scope und Handoff
- `project-admin/github-app-service.mjs` traegt kontrollierten Webhook-Dispatch, Runner, Resume/Recover und die lokale Service-/Queue-Schicht
- der Webhook-Dispatch haelt inzwischen auch Force-Gates und einen expliziten Execution-Summary fuer lokale Apply-Laeufe fest
- derselbe Webhook-Dispatch schreibt jetzt auch einen `execution-contract` fuer spaetere App-/Service-Runner
- `project-admin/github-app-service.mjs` traegt jetzt auch den separaten lokalen Runner ueber diesem Contract
- der Runner schreibt jetzt zusaetzlich `runner-state`, `resume-contract`, `recovery-assessment` und `recovery-contract` fuer Wiederaufnahme und Retry-/Backoff-Governance ueber mehrere Schleifen
- `project-admin/github-app-service.mjs` bietet jetzt ausserdem explizite Resume- und Recover-Commands ueber `resume-contract` und `recovery-contract`
- `project-admin/github-app-service.mjs` bietet jetzt auch `github-app-execution-enqueue` und `github-app-service-tick` als kleine lokale Service-/Queue-Schicht ueber diesen Contracts
- die Service-Schicht kennt inzwischen `pending`, `claimed`, `blocked`, `dead-letter` und `processed` sowie erste Lease-/Worker-Semantik fuer spaetere lange Laufprozesse
- `project-admin/github-app-service.mjs` bringt jetzt zusaetzlich `github-app-service-review` und `github-app-service-requeue` als explizite Admin-Kante fuer Manual-Release und kontrolliertes Requeue
- `project-admin/github-app-installations.mjs` bietet jetzt auch `github-app-installation-review`, `github-app-installation-apply` und `github-app-installation-show` fuer lokale Installation-/Repo-Scope-Governance
- darauf baut jetzt auch `github-app-installation-scope` plus `github-app-installation-handoff` auf, damit aus Installations-Repositories ein kontrollierter Watchlist-Handoff werden kann
- davor liegt jetzt zusaetzlich `github-app-installation-governance-review` und `github-app-installation-governance-apply`, damit Scope und Handoff von einer expliziten Installations-Policy getragen werden
- darauf liegt jetzt auch `github-app-installation-runtime-review` und `github-app-installation-runtime-apply`, damit jede Installation einen eigenen Betriebsmodus vor Scope, Handoff und spaeterer Service-Automation bekommt
- darauf liegt jetzt ausserdem `github-app-installation-operations-review` und `github-app-installation-operations-apply`, damit Watchlist-Sync und Service-Bereitschaft pro Installation explizit gesteuert werden
- darauf liegt jetzt ausserdem `github-app-installation-service-lane-review` und `github-app-installation-service-lane-apply`, damit gemeinsame Service-Ticks installierte Repos nicht alle gleich behandeln muessen, sondern mit Lane-Modus und Concurrency-Cap pro Installation arbeiten
- darauf liegt jetzt ausserdem `github-app-installation-service-plan-review` und `github-app-installation-service-plan-apply`, damit gemeinsame Service-Ticks mehrere Installationen bewusst priorisieren und budgetieren koennen
- darauf liegt jetzt ausserdem `github-app-installation-service-schedule-review` und `github-app-installation-service-schedule-apply`, damit gemeinsame Service-Ticks aus diesen Installationen echte scheduler-scoped Runtime-Lanes bilden koennen
- darauf liegt jetzt ausserdem `github-app-installation-worker-routing-review` und `github-app-installation-worker-routing-apply`, damit gemeinsame Service-Ticks auch worker- und scheduler-lane-spezifisch pro Installation geroutet werden koennen
- `github-app-service-review` und `github-app-service-tick` respektieren diese Installations-Operationsschicht jetzt auch im lokalen Queue-/Runner-Pfad
- `github-app-service-tick` respektiert jetzt zusaetzlich installation-spezifische Service-Lanes wie `manual_lane`, `auto_lane` oder `recovery_lane`
- `github-app-service-tick` respektiert jetzt zusaetzlich installation-spezifische Shared-Service-Plaene fuer Prioritaet, Budget und bevorzugte Contract-Kinds
- `github-app-service-tick` respektiert jetzt zusaetzlich installation-spezifische Runtime-Schedules und kann per `--scheduler-lane` gezielt einzelne Runtime-Lanes verarbeiten
- `github-app-service-tick` respektiert jetzt zusaetzlich installation-spezifisches Worker-Routing wie `pinned_worker`, `allowed_pool` oder `manual_worker_release`
- `github-app-service-scheduler-review` und `github-app-service-scheduler-run` heben diese Runtime-Lanes jetzt auf eine echte Scheduler-Orchestrierung ueber mehrere lane-scoped Service-Ticks
- `github-app-service-runtime-review` und `github-app-service-runtime-run` verdichten diese Scheduler-Orchestrierung jetzt weiter zu echten worker-scoped Runtime-Pfaden fuer mehrere Worker
- worker-scoped Runtime-Lanes haben jetzt zusaetzlich eine eigene Claim-/Lease-Governance gegen doppelte Mehrfachausfuehrung
- `github-app-service-runtime-cycle-review` und `github-app-service-runtime-cycle-run` heben diese worker-scoped Runtime-Pfade jetzt zusaetzlich auf eine mehrschleifige Runtime-Zyklus-Schicht mit explizitem Stoppgrund und Zyklus-Artefakten
- `github-app-service-runtime-session-review`, `github-app-service-runtime-session-run` und `github-app-service-runtime-session-resume` heben diese Zyklus-Schicht jetzt weiter auf eine langlebigere Runtime-Session mit Session-State, Resume-Contract und mehrrundiger Fortsetzung
- `github-app-service-runtime-loop-review`, `github-app-service-runtime-loop-run` und `github-app-service-runtime-loop-resume` heben diese Session-Schicht jetzt weiter auf einen langlebigeren Runtime-Loop mit Loop-State, Resume-Contract und mehrstufiger Fortsetzung ueber mehrere Sessions
- die Runtime-/Cycle-/Session-/Loop-Kommandos koennen sich jetzt zudem intern ohne doppelte Zwischen-Ausgabe aufrufen, was die spaetere Service-Runtime deutlich sauberer macht
- die Service-Tick-Auswahl ist damit jetzt nicht mehr nur global oder pro Installation gecappt, sondern wirklich ueber mehrere Installationen hinweg planbar
- `github-app-service-requeue` respektiert jetzt ebenfalls installation-spezifische Admin-Freigaben fuer `blocked`, `dead-letter` und `claimed`
