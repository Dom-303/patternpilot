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
- `project-admin.mjs` traegt Setup, Doctor und jetzt auch GitHub-App-Readiness plus GitHub-App-Eventplan, Event-Vorschau, Webhook-Envelope-Vorschau, konkrete Route-Planung und kontrollierten Webhook-Dispatch
- `project-admin.mjs` traegt jetzt ausserdem die lokale Installations-Registry fuer `installation.created` und `installation_repositories.added`
- der Webhook-Dispatch haelt inzwischen auch Force-Gates und einen expliziten Execution-Summary fuer lokale Apply-Laeufe fest
- derselbe Webhook-Dispatch schreibt jetzt auch einen `execution-contract` fuer spaetere App-/Service-Runner
- `project-admin.mjs` traegt jetzt auch den separaten lokalen Runner ueber diesem Contract
- der Runner schreibt jetzt zusaetzlich `runner-state`, `resume-contract`, `recovery-assessment` und `recovery-contract` fuer Wiederaufnahme und Retry-/Backoff-Governance ueber mehrere Schleifen
- `project-admin.mjs` bietet jetzt ausserdem explizite Resume- und Recover-Commands ueber `resume-contract` und `recovery-contract`
- `project-admin.mjs` bietet jetzt auch `github-app-execution-enqueue` und `github-app-service-tick` als kleine lokale Service-/Queue-Schicht ueber diesen Contracts
- die Service-Schicht kennt inzwischen `pending`, `claimed`, `blocked`, `dead-letter` und `processed` sowie erste Lease-/Worker-Semantik fuer spaetere lange Laufprozesse
- `project-admin.mjs` bringt jetzt zusaetzlich `github-app-service-review` und `github-app-service-requeue` als explizite Admin-Kante fuer Manual-Release und kontrolliertes Requeue
- dieselbe Command-Familie bietet jetzt auch `github-app-installation-review`, `github-app-installation-apply` und `github-app-installation-show` fuer lokale Installation-/Repo-Scope-Governance
- darauf baut jetzt auch `github-app-installation-scope` plus `github-app-installation-handoff` auf, damit aus Installations-Repositories ein kontrollierter Watchlist-Handoff werden kann
- davor liegt jetzt zusaetzlich `github-app-installation-governance-review` und `github-app-installation-governance-apply`, damit Scope und Handoff von einer expliziten Installations-Policy getragen werden
- darauf liegt jetzt auch `github-app-installation-runtime-review` und `github-app-installation-runtime-apply`, damit jede Installation einen eigenen Betriebsmodus vor Scope, Handoff und spaeterer Service-Automation bekommt
- darauf liegt jetzt ausserdem `github-app-installation-operations-review` und `github-app-installation-operations-apply`, damit Watchlist-Sync und Service-Bereitschaft pro Installation explizit gesteuert werden
- `github-app-service-review` und `github-app-service-tick` respektieren diese Installations-Operationsschicht jetzt auch im lokalen Queue-/Runner-Pfad
- `github-app-service-requeue` respektiert jetzt ebenfalls installation-spezifische Admin-Freigaben fuer `blocked`, `dead-letter` und `claimed`
