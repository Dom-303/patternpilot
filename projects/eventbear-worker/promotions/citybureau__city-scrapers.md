# Promotion Packet — citybureau/city-scrapers

## Snapshot

- created_at: 2026-04-14T21:38:26.541Z
- project: eventbear-worker
- source_status: promotion_prepared
- apply_mode: apply
- intake_doc: projects/eventbear-worker/intake/citybureau__city-scrapers.md
- repo_url: https://github.com/citybureau/city-scrapers

## Warum dieser Fund nach vorne gezogen wird

- Likely relevant for EventBaer Worker because it may inform 'source_systems_and_families' and the worker/project layer 'source_intake'.
- project_fit_band: high
- project_fit_score: 95
- suggested_next_step: Compare the repo against EventBaer's source-system target architecture and family scaling goals.

## Kandidat fuer knowledge/repo_landkarte.csv

- name: city-scrapers
- repo_url: https://github.com/citybureau/city-scrapers
- owner: citybureau
- category: aggregator
- pattern_family: local_source_infra_framework
- main_layer: source_intake
- secondary_layers: parsing_extraction
- source_focus: events
- geographic_model: regional
- data_model: events_only
- distribution_type: none_visible
- stars: 689
- activity_status: unknown
- last_checked_at: 2026-04-14
- maturity: solid
- strengths: Toolkit and scraper family for extracting civic data from many source systems. | Topics: scraper, events, open-data, python | Languages: Python | Likely decision-relevant for EventBaer soon
- weaknesses: Needs deeper repo reading to confirm system depth
- risks: brittle_platform_changes
- learning_for_eventbaer: Source infrastructure should be built as reusable families instead of isolated one-off connectors.
- possible_implication: Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.
- eventbaer_gap_area: source_systems_and_families
- build_vs_borrow: adapt_pattern
- priority_for_review: now
- eventbaer_relevance: high
- decision: adapt
- notes: stage4_promoted:success

## Kandidat fuer knowledge/repo_learnings.md

### citybureau/city-scrapers als Signal fuer source_systems_and_families

**Beobachtung**
- Toolkit and scraper family for extracting civic data from many source systems.

**Wiederkehrende Muster**
- Pattern Family: local_source_infra_framework
- Main Layer: source_intake
- Project Fit: high (95)
- Matched Capabilities: source_first, evidence_acquisition

**Bedeutung fuer EventBaer Worker**
- Source infrastructure should be built as reusable families instead of isolated one-off connectors.

**Moegliche Konsequenz**
- Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.

**Betroffene Worker-Areas**
- docs/SOURCE_MASTERLIST_POLICY.md
- docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md
- sources/

## Kandidat fuer knowledge/repo_decisions.md

### citybureau/city-scrapers fuer EventBaer Worker als 'adapt_pattern' behandeln

**Datum**
- 2026-04-14

**Ausloeser**
- citybureau/city-scrapers
- local_source_infra_framework

**Entscheidung**
- adapt

**Begruendung**
- Toolkit and scraper family for extracting civic data from many source systems. Project fit is 'high' with score 95. Matched project capabilities: source_first,evidence_acquisition. Likely relevant for EventBaer Worker because it may inform 'source_systems_and_families' and the worker/project layer 'source_intake'.

**Konkrete Bedeutung fuer EventBaer Worker**
- Source infrastructure should be built as reusable families instead of isolated one-off connectors.

**Naechster Schritt**
- Compare the repo against EventBaer's source-system target architecture and family scaling goals.

**Status**
- proposed
