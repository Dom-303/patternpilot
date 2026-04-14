# Intake Dossier — citybureau/city-scrapers

## Snapshot

- created_at: 2026-04-14T21:21:15.683Z
- status: pending_review
- project: eventbear-worker
- repo_url: https://github.com/citybureau/city-scrapers
- source_host: github.com
- repo_root_reference: `/home/domi/eventbaer/dev/eventbear-worker`
- context_files_loaded: 5
- context_directories_scanned: 5

## Warum das fuer EventBaer Worker relevant sein koennte

- Likely relevant for EventBaer Worker because it may inform 'connector_families' and the worker/project layer 'access_fetch'.
- Intake wurde automatisch aus einem GitHub-Link erzeugt und ist noch nicht kuratiert.

## Auto-Guesses — noch keine Wahrheit

- category_guess: `aggregator`
- pattern_family_guess: `local_source_infra_framework`
- main_layer_guess: `access_fetch`
- eventbaer_gap_area_guess: `connector_families`
- build_vs_borrow_guess: `adapt_pattern`
- priority_guess: `soon`

## GitHub Enrichment

- enrichment_status: failed
- auth_mode: token
- error: getaddrinfo EAI_AGAIN api.github.com
- note: Intake kann weiterverwendet werden, aber Review braucht noch mehr manuelle Sichtung.

## README Snapshot

- README konnte nicht automatisch geladen werden.

## Auto-Hypothesen fuer den Review

- Dieses Repo wirkt primaer wie 'local_source_infra_framework' in der Kategorie 'aggregator'.
- Fuer EventBaer Worker scheint besonders 'connector_families' relevant.
- Die staerkste beleuchtete Schicht wirkt aktuell wie 'access_fetch'.
- Vorlaeufige Tendenz fuer Build-vs-Borrow: 'adapt_pattern'.
- Remote-Anreicherung fehlt oder ist gescheitert; diese Hypothesen sind entsprechend unsicherer.

## Project Alignment — EventBaer Worker

- alignment_status: ready
- project_fit_band: high
- project_fit_score: 67
- matched_capabilities: evidence_acquisition
- recommended_worker_areas: lib/fetch.mjs, lib/headless-scraper.mjs, lib/firecrawl.mjs
- review_docs: WORKER_FLOW.md, docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md
- tensions: -
- suggested_next_step: Check whether the repo should influence connector-family conventions, not the worker core.
- reference_files_loaded: 5

## Decision Signals

- effort: medium
- value: medium
- review_disposition: observe_only
- summary: Medium value, medium effort, observe or defer
- rules_fingerprint: 7627822a3e39

### Reasons

- effort: layer_bias:+8, license_adjustment:+4
- value: gap_bias:+18, matched_capabilities:+8, build_vs_borrow:+10
- disposition: matrix:effort_medium_value_medium

## Alignment Rationale

- Primary layer 'access_fetch' maps into EventBaer worker areas: lib/fetch.mjs, lib/headless-scraper.mjs, lib/firecrawl.mjs.
- Gap area 'connector_families' suggests: Check whether the repo should influence connector-family conventions, not the worker core..
- Matched project capabilities: evidence_acquisition.

## Kontext, den Patternpilot aus dem Zielrepo gelesen hat

- geladene_leitdateien: AGENT_CONTEXT.md, WORKER_CONTRACT.md, WORKER_FLOW.md, docs/SOURCE_MASTERLIST_POLICY.md, ../patternpilot/docs/system/REPO_INTELLIGENCE_SYSTEM.md
- fehlende_kontextdateien: docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md, docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md
- gescannte_verzeichnisse: lib/ (40), scripts/ (30), docs/ (16), sources/ (5), templates/ (3)

## Vor dem Review zuerst im Zielrepo lesen

- `AGENT_CONTEXT.md`
- `WORKER_CONTRACT.md`
- `WORKER_FLOW.md`
- `docs/SOURCE_MASTERLIST_POLICY.md`
- `docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md`
- `docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md`
- `../patternpilot/docs/system/REPO_INTELLIGENCE_SYSTEM.md`

## Besonders relevante Verzeichnisse im Zielrepo

- `lib/`
- `scripts/`
- `docs/`
- `sources/`
- `templates/`

## Zielbild und Staerkungsachsen

- audit-first
- source-first
- candidate-first
- quality gate
- review and governance
- distribution surfaces
- location and gastro intelligence

## Review-Fragen

- Welche Schicht im Worker wird durch das externe Repo beleuchtet?
- Welche konkrete Luecke oder Ausbauflaeche zeigt sich fuer EventBaer?
- Ist der Fund fuer EventBaer eher build_core, adapt_pattern, borrow_optional, observe_only oder avoid_as_core_dependency?
- Welche Folgearbeit sollte sich fuer eventbear-worker oder das spaetere Produktsystem ergeben?

## Review-Notizen

- Repo-Zweck:
- Kernfluss:
- Relevante Schichten:
- Staerken:
- Schwaechen:
- Risiken:
- Learning fuer EventBaer:
- Moegliche konkrete Folge:

## Promotion Candidate fuer knowledge/repo_landkarte.csv

- name: city-scrapers
- repo_url: https://github.com/citybureau/city-scrapers
- owner: citybureau
- category: aggregator
- pattern_family: local_source_infra_framework
- main_layer: access_fetch
- secondary_layers: -
- source_focus: mixed_or_unclear
- geographic_model: regional
- data_model: mixed_entities
- distribution_type: none_visible
- stars: -
- activity_status: unknown
- last_checked_at: 2026-04-14
- maturity: needs_review
- strengths: Needs review with remote metadata unavailable
- weaknesses: Remote enrichment failed, so repo context is still shallow
- risks: needs_review
- learning_for_eventbaer: This repo should be read as a pattern signal for EventBaer rather than copied as-is.
- possible_implication: Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.
- eventbaer_gap_area: connector_families
- build_vs_borrow: adapt_pattern
- priority_for_review: soon
- eventbaer_relevance: medium
- decision: adapt
- notes: stage2_candidate:failed

## Promotion-Kriterien

- Nur nach Review in `knowledge/repo_landkarte.csv` uebernehmen
- Nur verdichtete Muster nach `knowledge/repo_learnings.md`
- Nur echte Richtungsentscheide nach `knowledge/repo_decisions.md`

## Intake-Notizen

- policy-handoff from cycle 2026-04-14T21-14-28-766Z
