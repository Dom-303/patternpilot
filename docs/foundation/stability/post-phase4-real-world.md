# Score Stability Results

- generated_at: 2026-04-25T19:47:34.189Z
- source: explicit:projects/eventbear-worker/problems/event-deduplication-across-heterogenous-sources/landscape/2026-04-25T19-44-46-745Z,projects/eventbear-worker/problems/schema-exact-extraction-into-40-column-masterlist/landscape/2026-04-25T19-45-17-182Z,projects/eventbear-worker/problems/self-healing-adaptive-source-intake/landscape/2026-04-25T19-45-29-145Z,runs/eventbear-worker/2026-04-25T19-47-09-211Z
- run_count: 4 (scored: 4)
- thresholds: median ≥ 8, min ≥ 7, max ≥ 9
- acceptance: PASS (median=10 ≥ 8, min=9 ≥ 7, max=10 ≥ 9)

## Aggregat

- **median**: 10/10
- **min**: 9/10
- **max**: 10/10
- **mean**: 9.75/10
- **kinds**: landscape=3, review=1

## Per-Run-Tabelle

| Run | Kind | Total | cluster | pattern | lens | context | visual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| projects/eventbear-worker/problems/event-deduplication-across-heterogenous-sources/landscape/2026-04-25T19-44-46-745Z | landscape | 10/10 | 2 | 2 | 2 | 2 | 2 |
| projects/eventbear-worker/problems/schema-exact-extraction-into-40-column-masterlist/landscape/2026-04-25T19-45-17-182Z | landscape | 10/10 | 2 | 2 | 2 | 2 | 2 |
| projects/eventbear-worker/problems/self-healing-adaptive-source-intake/landscape/2026-04-25T19-45-29-145Z | landscape | 9/10 | 1 | 2 | 2 | 2 | 2 |
| runs/eventbear-worker/2026-04-25T19-47-09-211Z | review | 10/10 | 2 | 2 | 2 | 2 | 2 |

## Schwaechste Achsen (Folge-Hebel-Kandidaten)

- **cluster-diversity** — mean 1.75/2, min 1/2
- **pattern-family-coverage** — mean 2/2, min 2/2
- **lens-richness** — mean 2/2, min 2/2

## Wie diesen Lauf interpretieren

- Die Phase-0-Scorer-Achsen sind in `docs/foundation/SCORE_STABILITY_PLAN.md` §5 Phase 0 definiert.
- Acceptance-Schwellen entsprechen Plan §5 Phase 5 (Median 8 / Min 7 / Max 9).
- Schwaechste Achsen zeigen, wo eine weitere Pipeline-Stufe den groessten Hebel haette.

Re-Run via:

```bash
npm run stability-test -- --from-fixtures
npm run stability-test -- --from-runs <project>
npm run stability-test -- --runs runs/.../foo,runs/.../bar
```
