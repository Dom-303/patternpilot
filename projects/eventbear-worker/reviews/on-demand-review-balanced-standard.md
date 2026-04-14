# Patternpilot Watchlist Review

- project: eventbear-worker
- created_at: 2026-04-14T21:27:22.476Z
- analysis_profile: balanced
- analysis_profile_label: Balanced
- analysis_depth: standard
- review_scope: selected_urls
- input_urls: 2
- watchlist_urls: 1
- reviewed_items: 2
- missing_from_queue: 0

## Focus

- Architecture, opportunities and risks in one pass.

## Main Layer Coverage

- location_place_enrichment: 1
- source_intake: 1

## Gap Area Coverage

- location_and_gastro_intelligence: 1
- source_systems_and_families: 1

## Capability Coverage

- source_first: 2
- distribution_surfaces: 1
- evidence_acquisition: 1
- location_intelligence: 1

## Uncovered Capability Areas

- candidate-first
- quality and governance

## Strongest Patterns Right Now

- citybureau/city-scrapers: Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.
- oc/openevents: Review and adapt the pattern into the EventBaer worker architecture, not as direct dependency.

## Top Items For This Review Mode

- citybureau/city-scrapers (100) :: fit=high (95) | capabilities=source_first, evidence_acquisition | Compare the repo against EventBaer's source-system target architecture and family scaling goals.
- oc/openevents (79) :: fit=high (73) | capabilities=source_first, location_intelligence, distribution_surfaces | Review against location/gastro layers and geo-validation capabilities.

## Highest Risk Signals

- citybureau/city-scrapers: brittle_platform_changes
- oc/openevents: needs_review

## Missing Selected Intake

- none

## Repo Matrix

- citybureau/city-scrapers :: layer=source_intake :: gap=source_systems_and_families :: fit=high (95) :: relevance=high
- oc/openevents :: layer=location_place_enrichment :: gap=location_and_gastro_intelligence :: fit=high (73) :: relevance=medium

## Next Steps

- Promote the top 2 candidates into focused manual review.
- Discovery can be widened for uncovered areas: candidate-first, quality and governance.

