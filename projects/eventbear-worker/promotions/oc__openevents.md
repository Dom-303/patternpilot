# Promotion Packet — oc/openevents

## Snapshot

- created_at: 2026-04-14T21:50:19.764Z
- project: eventbear-worker
- source_status: promotion_prepared
- apply_mode: apply
- intake_doc: projects/eventbear-worker/intake/oc__openevents.md
- repo_url: https://github.com/oc/openevents

## Warum dieser Fund nach vorne gezogen wird

- Likely relevant for EventBaer Worker because it may inform 'location_and_gastro_intelligence' and the worker/project layer 'location_place_enrichment'.
- project_fit_band: high
- project_fit_score: 73
- suggested_next_step: Review against location/gastro layers and geo-validation capabilities.

## Kandidat fuer knowledge/repo_landkarte.csv

- name: openevents
- repo_url: https://github.com/oc/openevents
- owner: oc
- category: aggregator
- pattern_family: place_data_infrastructure
- main_layer: location_place_enrichment
- secondary_layers: export_feed_api
- source_focus: places
- geographic_model: platform_bound
- data_model: places_only
- distribution_type: api
- stars: 84
- activity_status: unknown
- last_checked_at: 2026-04-14
- maturity: solid
- strengths: Open source events platform with structured event and venue concepts. | Topics: events, calendar, venue, open-data | Languages: TypeScript
- weaknesses: Needs deeper repo reading to confirm system depth
- risks: needs_review
- learning_for_eventbaer: Location and venue intelligence deserve their own deliberate layer next to event truth.
- possible_implication: Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.
- eventbaer_gap_area: location_and_gastro_intelligence
- build_vs_borrow: adapt_pattern
- priority_for_review: soon
- eventbaer_relevance: medium
- decision: adapt
- notes: stage4_promoted:success

## Kandidat fuer knowledge/repo_learnings.md

### oc/openevents als Signal fuer location_and_gastro_intelligence

**Beobachtung**
- Open source events platform with structured event and venue concepts.

**Wiederkehrende Muster**
- Pattern Family: place_data_infrastructure
- Main Layer: location_place_enrichment
- Project Fit: high (73)
- Matched Capabilities: source_first, location_intelligence, distribution_surfaces

**Bedeutung fuer EventBaer Worker**
- Location and venue intelligence deserve their own deliberate layer next to event truth.

**Moegliche Konsequenz**
- Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.

**Betroffene Worker-Areas**
- lib/geo-validator.mjs
- scripts/run-locations.mjs
- templates/locations_template.csv

## Kandidat fuer knowledge/repo_decisions.md

### oc/openevents fuer EventBaer Worker als 'adapt_pattern' behandeln

**Datum**
- 2026-04-14

**Ausloeser**
- oc/openevents
- place_data_infrastructure

**Entscheidung**
- adapt

**Begruendung**
- Open source events platform with structured event and venue concepts. Project fit is 'high' with score 73. Matched project capabilities: source_first,location_intelligence,distribution_surfaces. Likely relevant for EventBaer Worker because it may inform 'location_and_gastro_intelligence' and the worker/project layer 'location_place_enrichment'.

**Konkrete Bedeutung fuer EventBaer Worker**
- Location and venue intelligence deserve their own deliberate layer next to event truth.

**Naechster Schritt**
- Review against location/gastro layers and geo-validation capabilities.

**Status**
- proposed
