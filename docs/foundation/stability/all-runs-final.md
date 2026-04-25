# Score Stability Results

- generated_at: 2026-04-25T22:53:53.742Z
- source: explicit:projects/eventbear-worker/problems/event-deduplication-across-heterogenous-sources/landscape/2026-04-25T19-44-46-745Z,projects/eventbear-worker/problems/schema-exact-extraction-into-40-column-masterlist/landscape/2026-04-25T19-45-17-182Z,projects/eventbear-worker/problems/self-healing-adaptive-source-intake/landscape/2026-04-25T19-45-29-145Z,runs/eventbear-worker/2026-04-25T19-47-09-211Z,projects/eventbear-web/problems/server-side-rendering-for-event-detail-pages-with-pocketbase-backend/landscape/2026-04-25T20-41-35-195Z,projects/pinflow/problems/runtime-component-introspection-across-react-fiber-and-vue-vnode/landscape/2026-04-25T21-22-50-655Z,projects/cross-domain-test/problems/kubernetes-operator-for-batch-ml-training-jobs/landscape/2026-04-25T22-51-06-705Z,projects/cross-domain-test/problems/rust-embedded-firmware-ota-updates-with-rollback/landscape/2026-04-25T21-58-37-827Z,projects/cross-domain-test/problems/crdt-based-collaborative-text-editing-for-mobile/landscape/2026-04-25T22-02-46-507Z,projects/cross-domain-test/problems/time-series-anomaly-detection-on-edge-devices/landscape/2026-04-25T22-08-20-594Z,projects/cross-domain-test/problems/privacy-preserving-federated-learning-aggregator/landscape/2026-04-25T22-17-27-314Z
- run_count: 11 (scored: 11)
- thresholds: combined median ≥ 8, min ≥ 7, max ≥ 9
- acceptance: FAIL (combined median=7.5 < 8, min=6.5 < 7)

## Aggregat

### Combined (struktur + inhalt)
- **median**: 7.5/10
- **min**: 6.5/10
- **max**: 10/10
- **mean**: 7.98/10

### Struktur-Total
- **median**: 10/10
- **min**: 7/10
- **max**: 10/10
- **mean**: 9.36/10

### Inhalts-Total
- **median**: 6.25/10
- **min**: 3.75/10
- **max**: 10/10
- **mean**: 6.59/10

- **kinds**: landscape=10, review=1

## Per-Run-Tabelle

| Run | Kind | Total | Struct | Content |
| --- | --- | --- | --- | --- |
| projects/eventbear-worker/problems/event-deduplication-across-heterogenous-sources/landscape/2026-04-25T19-44-46-745Z | landscape | 10/10 | 10/10 | 10/10 |
| projects/eventbear-worker/problems/schema-exact-extraction-into-40-column-masterlist/landscape/2026-04-25T19-45-17-182Z | landscape | 7.5/10 | 10/10 | 5/10 |
| projects/eventbear-worker/problems/self-healing-adaptive-source-intake/landscape/2026-04-25T19-45-29-145Z | landscape | 7/10 | 9/10 | 5/10 |
| runs/eventbear-worker/2026-04-25T19-47-09-211Z | review | 9.38/10 | 10/10 | 8.75/10 |
| projects/eventbear-web/problems/server-side-rendering-for-event-detail-pages-with-pocketbase-backend/landscape/2026-04-25T20-41-35-195Z | landscape | 9.38/10 | 10/10 | 8.75/10 |
| projects/pinflow/problems/runtime-component-introspection-across-react-fiber-and-vue-vnode/landscape/2026-04-25T21-22-50-655Z | landscape | 7.5/10 | 10/10 | 5/10 |
| projects/cross-domain-test/problems/kubernetes-operator-for-batch-ml-training-jobs/landscape/2026-04-25T22-51-06-705Z | landscape | 6.88/10 | 10/10 | 3.75/10 |
| projects/cross-domain-test/problems/rust-embedded-firmware-ota-updates-with-rollback/landscape/2026-04-25T21-58-37-827Z | landscape | 6.5/10 | 8/10 | 5/10 |
| projects/cross-domain-test/problems/crdt-based-collaborative-text-editing-for-mobile/landscape/2026-04-25T22-02-46-507Z | landscape | 8.75/10 | 10/10 | 7.5/10 |
| projects/cross-domain-test/problems/time-series-anomaly-detection-on-edge-devices/landscape/2026-04-25T22-08-20-594Z | landscape | 6.63/10 | 7/10 | 6.25/10 |
| projects/cross-domain-test/problems/privacy-preserving-federated-learning-aggregator/landscape/2026-04-25T22-17-27-314Z | landscape | 8.25/10 | 9/10 | 7.5/10 |

## Schwaechste Achsen (Folge-Hebel-Kandidaten)

- **[content] problem-fit** — mean 0.91/2, min 0/2 (anwendbar in 11/11 Runs)
- **[content] label-fidelity** — mean 1/2, min 0/2 (anwendbar in 11/11 Runs)
- **[content] classification-confidence** — mean 1.36/2, min 0/2 (anwendbar in 11/11 Runs)
- **[structure] visual-completeness** — mean 1.73/2, min 0/2 (anwendbar in 11/11 Runs)

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
