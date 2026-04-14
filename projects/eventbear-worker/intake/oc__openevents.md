# Intake Dossier — oc/openevents

## Snapshot

- created_at: 2026-04-14T16:41:42.796Z
- status: pending_review
- project: eventbear-worker
- repo_url: https://github.com/oc/openevents
- source_host: github.com
- repo_root_reference: `/home/domi/eventbaer/dev/eventbear-worker`
- context_files_loaded: 7
- context_directories_scanned: 5

## Warum das fuer EventBaer Worker relevant sein koennte

- Likely relevant for EventBaer Worker because it may inform 'risk_and_dependency_awareness' and the worker/project layer 'research_signal'.
- Intake wurde automatisch aus einem GitHub-Link erzeugt und ist noch nicht kuratiert.

## Auto-Guesses — noch keine Wahrheit

- category_guess: `aggregator`
- pattern_family_guess: `research_signal`
- main_layer_guess: `research_signal`
- eventbaer_gap_area_guess: `risk_and_dependency_awareness`
- build_vs_borrow_guess: `observe_only`
- priority_guess: `soon`

## GitHub Enrichment

- enrichment_status: skipped
- note: Remote-Anreicherung wurde bewusst uebersprungen.

## README Snapshot

- README konnte nicht automatisch geladen werden.

## Auto-Hypothesen fuer den Review

- Dieses Repo wirkt primaer wie 'research_signal' in der Kategorie 'aggregator'.
- Fuer EventBaer Worker scheint besonders 'risk_and_dependency_awareness' relevant.
- Die staerkste beleuchtete Schicht wirkt aktuell wie 'research_signal'.
- Vorlaeufige Tendenz fuer Build-vs-Borrow: 'observe_only'.
- Remote-Anreicherung fehlt oder ist gescheitert; diese Hypothesen sind entsprechend unsicherer.

## Project Alignment — EventBaer Worker

- alignment_status: ready
- project_fit_band: low
- project_fit_score: 14
- matched_capabilities: -
- recommended_worker_areas: -
- review_docs: -
- tensions: -
- suggested_next_step: Read primarily as a risk or anti-pattern signal for EventBaer.
- reference_files_loaded: 7

## Decision Signals

- effort: medium
- value: low
- review_disposition: skip
- summary: Low value, medium effort, skip
- rules_fingerprint: 7627822a3e39

### Reasons

- effort: license_adjustment:+4
- value: gap_bias:+2
- disposition: matrix:effort_medium_value_low

## Alignment Rationale

- Primary layer 'research_signal' maps into EventBaer worker areas: none.
- Gap area 'risk_and_dependency_awareness' suggests: Read primarily as a risk or anti-pattern signal for EventBaer..
- No strong capability match was found yet; review manually.

## Kontext, den Patternpilot aus dem Zielrepo gelesen hat

- geladene_leitdateien: AGENT_CONTEXT.md, WORKER_CONTRACT.md, WORKER_FLOW.md, docs/SOURCE_MASTERLIST_POLICY.md, docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md, docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md, ../patternpilot/docs/system/REPO_INTELLIGENCE_SYSTEM.md
- fehlende_kontextdateien: -
- gescannte_verzeichnisse: lib/ (40), scripts/ (30), docs/ (40), sources/ (5), templates/ (3)

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

- name: openevents
- repo_url: https://github.com/oc/openevents
- owner: oc
- category: aggregator
- pattern_family: research_signal
- main_layer: research_signal
- secondary_layers: -
- source_focus: events
- geographic_model: global
- data_model: events_only
- distribution_type: none_visible
- stars: -
- activity_status: unknown
- last_checked_at: 2026-04-14
- maturity: needs_review
- strengths: Needs review with remote metadata unavailable
- weaknesses: Remote enrichment failed, so repo context is still shallow
- risks: needs_review
- learning_for_eventbaer: This repo should be read as a pattern signal for EventBaer rather than copied as-is.
- possible_implication: Keep on review watchlist until there is a sharper project need.
- eventbaer_gap_area: risk_and_dependency_awareness
- build_vs_borrow: observe_only
- priority_for_review: soon
- eventbaer_relevance: medium
- decision: observe
- notes: stage2_candidate:skipped

## Promotion-Kriterien

- Nur nach Review in `knowledge/repo_landkarte.csv` uebernehmen
- Nur verdichtete Muster nach `knowledge/repo_learnings.md`
- Nur echte Richtungsentscheide nach `knowledge/repo_decisions.md`

## Intake-Notizen

- Keine zusaetzlichen Intake-Notizen uebergeben.
