# Patternpilot Policy Workbench

- project: eventbear-worker
- source_run: 2026-04-14T20-37-53-197Z
- source_manifest: runs/eventbear-worker/2026-04-14T20-37-53-197Z/manifest.json
- source_candidates: 2
- policy_blocked: 2
- policy_preferred: 2

## Candidate Rows

- oc/openevents :: fit=high/73 :: disposition=observe_only :: allowed=no :: focus=check_false_block :: blockers=disposition_not_allowed:observe_only :: prefers=preferred_pattern_family:place_data_infrastructure, preferred_main_layer:location_place_enrichment, preferred_topic
- citybureau/city-scrapers :: fit=high/95 :: disposition=observe_only :: allowed=no :: focus=check_false_block :: blockers=disposition_not_allowed:observe_only :: prefers=preferred_pattern_family:local_source_infra_framework, preferred_main_layer:source_intake, preferred_topic

## Manual Workflow

- edit `proposed-policy.json` if you want to try a softer or stricter policy variant
- use `manifest.json` or `rows.json` as the structured candidate sheet for notes
- run `policy:compare` against `proposed-policy.json`
- run `policy:pack` after adjustments to freeze the next calibration packet

