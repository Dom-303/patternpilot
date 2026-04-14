# Patternpilot Policy Suggestion

- project: eventbear-worker
- workbench_id: 2026-04-14T20-38-38-495Z
- source_run: 2026-04-14T20-37-53-197Z
- rows: 2
- manual_verdicts: 0
- heuristic_false_blocks: 2
- changed: yes

## Suggestions

- allow_disposition :: value=observe_only :: changed=yes :: confidence=medium :: heuristic_only=yes :: sources=citybureau/city-scrapers, oc/openevents

## Suggested Policy Comparison

- delta_audit_flagged: -2
- delta_enforce_hidden: -2
- delta_preferred_hits: 0

## Recommendations

- Test whether allowing observe_only reveals strong candidates without introducing too much noise.
- Suggested policy would reveal 2 candidate slots on the source run.

