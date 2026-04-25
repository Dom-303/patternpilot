# Score Stability Results

- generated_at: 2026-04-25T20:35:19.750Z
- source: test/fixtures/score-baseline
- run_count: 4 (scored: 4)
- thresholds: combined median ≥ 8, min ≥ 7, max ≥ 9
- acceptance: FAIL (combined median=5.75 < 8, min=1 < 7, max=6.5 < 9)

## Aggregat

### Combined (struktur + inhalt)
- **median**: 5.75/10
- **min**: 1/10
- **max**: 6.5/10
- **mean**: 4.75/10

### Struktur-Total
- **median**: 6.5/10
- **min**: 2/10
- **max**: 8/10
- **mean**: 5.75/10

### Inhalts-Total
- **median**: 5/10
- **min**: 0/10
- **max**: 5/10
- **mean**: 3.75/10

- **kinds**: landscape=3, review=1

## Per-Run-Tabelle

| Run | Kind | Total | Struct | Content |
| --- | --- | --- | --- | --- |
| 01-event-dedup-landscape | landscape | 5.5/10 | 6/10 | 5/10 |
| 02-schema-extraction-landscape | landscape | 6.5/10 | 8/10 | 5/10 |
| 03-self-healing-landscape | landscape | 6/10 | 7/10 | 5/10 |
| 04-watchlist-review-empty | review | 1/10 | 2/10 | 0/10 |

## Schwaechste Achsen (Folge-Hebel-Kandidaten)

- **[content] label-fidelity** — mean 0/2, min 0/2 (anwendbar in 3/4 Runs)
- **[structure] visual-completeness** — mean 0.25/2, min 0/2 (anwendbar in 4/4 Runs)
- **[structure] pattern-family-coverage** — mean 0.5/2, min 0/2 (anwendbar in 4/4 Runs)
- **[structure] cluster-diversity** — mean 1.5/2, min 0/2 (anwendbar in 4/4 Runs)

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
