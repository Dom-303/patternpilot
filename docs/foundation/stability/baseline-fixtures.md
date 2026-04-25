# Score Stability Results

- generated_at: 2026-04-25T19:15:13.746Z
- source: test/fixtures/score-baseline
- run_count: 4 (scored: 4)
- thresholds: median ≥ 8, min ≥ 7, max ≥ 9
- acceptance: FAIL (median=6.5 < 8, min=2 < 7, max=8 < 9)

## Aggregat

- **median**: 6.5/10
- **min**: 2/10
- **max**: 8/10
- **mean**: 5.75/10
- **kinds**: landscape=3, review=1

## Per-Run-Tabelle

| Run | Kind | Total | cluster | pattern | lens | context | visual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 01-event-dedup-landscape | landscape | 6/10 | 2 | 0 | 2 | 2 | 0 |
| 02-schema-extraction-landscape | landscape | 8/10 | 2 | 1 | 2 | 2 | 1 |
| 03-self-healing-landscape | landscape | 7/10 | 2 | 1 | 2 | 2 | 0 |
| 04-watchlist-review-empty | review | 2/10 | 0 | 0 | 0 | 2 | 0 |

## Schwaechste Achsen (Folge-Hebel-Kandidaten)

- **visual-completeness** — mean 0.25/2, min 0/2
- **pattern-family-coverage** — mean 0.5/2, min 0/2
- **cluster-diversity** — mean 1.5/2, min 0/2

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
