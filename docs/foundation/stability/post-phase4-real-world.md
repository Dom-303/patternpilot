# Score Stability Results

- generated_at: 2026-04-25T20:35:19.793Z
- source: explicit:projects/eventbear-worker/problems/event-deduplication-across-heterogenous-sources/landscape/2026-04-25T19-44-46-745Z,projects/eventbear-worker/problems/schema-exact-extraction-into-40-column-masterlist/landscape/2026-04-25T19-45-17-182Z,projects/eventbear-worker/problems/self-healing-adaptive-source-intake/landscape/2026-04-25T19-45-29-145Z,runs/eventbear-worker/2026-04-25T19-47-09-211Z
- run_count: 4 (scored: 4)
- thresholds: combined median ≥ 8, min ≥ 7, max ≥ 9
- acceptance: PASS (combined median=8.13 ≥ 8, min=7 ≥ 7, max=9.38 ≥ 9)

## Aggregat

### Combined (struktur + inhalt)
- **median**: 8.13/10
- **min**: 7/10
- **max**: 9.38/10
- **mean**: 8.16/10

### Struktur-Total
- **median**: 10/10
- **min**: 9/10
- **max**: 10/10
- **mean**: 9.75/10

### Inhalts-Total
- **median**: 6.25/10
- **min**: 5/10
- **max**: 8.75/10
- **mean**: 6.56/10

- **kinds**: landscape=3, review=1

## Per-Run-Tabelle

| Run | Kind | Total | Struct | Content |
| --- | --- | --- | --- | --- |
| projects/eventbear-worker/problems/event-deduplication-across-heterogenous-sources/landscape/2026-04-25T19-44-46-745Z | landscape | 8.75/10 | 10/10 | 7.5/10 |
| projects/eventbear-worker/problems/schema-exact-extraction-into-40-column-masterlist/landscape/2026-04-25T19-45-17-182Z | landscape | 7.5/10 | 10/10 | 5/10 |
| projects/eventbear-worker/problems/self-healing-adaptive-source-intake/landscape/2026-04-25T19-45-29-145Z | landscape | 7/10 | 9/10 | 5/10 |
| runs/eventbear-worker/2026-04-25T19-47-09-211Z | review | 9.38/10 | 10/10 | 8.75/10 |

## Schwaechste Achsen (Folge-Hebel-Kandidaten)

- **[content] label-fidelity** — mean 0.25/2, min 0/2 (anwendbar in 4/4 Runs)
- **[content] problem-fit** — mean 1/2, min 0/2 (anwendbar in 4/4 Runs)
- **[structure] cluster-diversity** — mean 1.75/2, min 1/2 (anwendbar in 4/4 Runs)
- **[structure] pattern-family-coverage** — mean 2/2, min 2/2 (anwendbar in 4/4 Runs)

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
