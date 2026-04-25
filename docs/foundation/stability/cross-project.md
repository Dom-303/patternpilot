# Score Stability Results

- generated_at: 2026-04-25T20:42:00.492Z
- source: explicit:projects/eventbear-worker/problems/event-deduplication-across-heterogenous-sources/landscape/2026-04-25T19-44-46-745Z,projects/eventbear-worker/problems/schema-exact-extraction-into-40-column-masterlist/landscape/2026-04-25T19-45-17-182Z,projects/eventbear-worker/problems/self-healing-adaptive-source-intake/landscape/2026-04-25T19-45-29-145Z,runs/eventbear-worker/2026-04-25T19-47-09-211Z,projects/eventbear-web/problems/server-side-rendering-for-event-detail-pages-with-pocketbase-backend/landscape/2026-04-25T20-41-35-195Z,projects/pinflow/problems/runtime-component-introspection-across-react-fiber-and-vue-vnode/landscape/2026-04-25T20-40-12-925Z
- run_count: 6 (scored: 6)
- thresholds: combined median ≥ 8, min ≥ 7, max ≥ 9
- acceptance: FAIL (combined median=7.82 < 8, min=4.75 < 7)

## Aggregat

### Combined (struktur + inhalt)
- **median**: 7.82/10
- **min**: 4.75/10
- **max**: 9.38/10
- **mean**: 7.59/10

### Struktur-Total
- **median**: 10/10
- **min**: 7/10
- **max**: 10/10
- **mean**: 9.33/10

### Inhalts-Total
- **median**: 5.63/10
- **min**: 2.5/10
- **max**: 8.75/10
- **mean**: 5.83/10

- **kinds**: landscape=5, review=1

## Per-Run-Tabelle

| Run | Kind | Total | Struct | Content |
| --- | --- | --- | --- | --- |
| projects/eventbear-worker/problems/event-deduplication-across-heterogenous-sources/landscape/2026-04-25T19-44-46-745Z | landscape | 8.75/10 | 10/10 | 7.5/10 |
| projects/eventbear-worker/problems/schema-exact-extraction-into-40-column-masterlist/landscape/2026-04-25T19-45-17-182Z | landscape | 7.5/10 | 10/10 | 5/10 |
| projects/eventbear-worker/problems/self-healing-adaptive-source-intake/landscape/2026-04-25T19-45-29-145Z | landscape | 7/10 | 9/10 | 5/10 |
| runs/eventbear-worker/2026-04-25T19-47-09-211Z | review | 9.38/10 | 10/10 | 8.75/10 |
| projects/eventbear-web/problems/server-side-rendering-for-event-detail-pages-with-pocketbase-backend/landscape/2026-04-25T20-41-35-195Z | landscape | 8.13/10 | 10/10 | 6.25/10 |
| projects/pinflow/problems/runtime-component-introspection-across-react-fiber-and-vue-vnode/landscape/2026-04-25T20-40-12-925Z | landscape | 4.75/10 | 7/10 | 2.5/10 |

## Schwaechste Achsen (Folge-Hebel-Kandidaten)

- **[content] label-fidelity** — mean 0.17/2, min 0/2 (anwendbar in 6/6 Runs)
- **[content] problem-fit** — mean 1/2, min 0/2 (anwendbar in 6/6 Runs)
- **[content] classification-confidence** — mean 1.5/2, min 0/2 (anwendbar in 6/6 Runs)
- **[structure] visual-completeness** — mean 1.67/2, min 0/2 (anwendbar in 6/6 Runs)

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
