# Score Stability Results

- generated_at: 2026-04-25T22:18:09.159Z
- source: explicit:projects/cross-domain-test/problems/kubernetes-operator-for-batch-ml-training-jobs/landscape/2026-04-25T21-55-10-038Z,projects/cross-domain-test/problems/rust-embedded-firmware-ota-updates-with-rollback/landscape/2026-04-25T21-58-37-827Z,projects/cross-domain-test/problems/crdt-based-collaborative-text-editing-for-mobile/landscape/2026-04-25T22-02-46-507Z,projects/cross-domain-test/problems/time-series-anomaly-detection-on-edge-devices/landscape/2026-04-25T22-08-20-594Z,projects/cross-domain-test/problems/privacy-preserving-federated-learning-aggregator/landscape/2026-04-25T22-17-27-314Z
- run_count: 5 (scored: 5)
- thresholds: combined median ≥ 8, min ≥ 7, max ≥ 9
- acceptance: FAIL (combined median=6.88 < 8, min=6.5 < 7, max=8.75 < 9)

## Aggregat

### Combined (struktur + inhalt)
- **median**: 6.88/10
- **min**: 6.5/10
- **max**: 8.75/10
- **mean**: 7.4/10

### Struktur-Total
- **median**: 9/10
- **min**: 7/10
- **max**: 10/10
- **mean**: 8.8/10

### Inhalts-Total
- **median**: 6.25/10
- **min**: 3.75/10
- **max**: 7.5/10
- **mean**: 6/10

- **kinds**: landscape=5

## Per-Run-Tabelle

| Run | Kind | Total | Struct | Content |
| --- | --- | --- | --- | --- |
| projects/cross-domain-test/problems/kubernetes-operator-for-batch-ml-training-jobs/landscape/2026-04-25T21-55-10-038Z | landscape | 6.88/10 | 10/10 | 3.75/10 |
| projects/cross-domain-test/problems/rust-embedded-firmware-ota-updates-with-rollback/landscape/2026-04-25T21-58-37-827Z | landscape | 6.5/10 | 8/10 | 5/10 |
| projects/cross-domain-test/problems/crdt-based-collaborative-text-editing-for-mobile/landscape/2026-04-25T22-02-46-507Z | landscape | 8.75/10 | 10/10 | 7.5/10 |
| projects/cross-domain-test/problems/time-series-anomaly-detection-on-edge-devices/landscape/2026-04-25T22-08-20-594Z | landscape | 6.63/10 | 7/10 | 6.25/10 |
| projects/cross-domain-test/problems/privacy-preserving-federated-learning-aggregator/landscape/2026-04-25T22-17-27-314Z | landscape | 8.25/10 | 9/10 | 7.5/10 |

## Schwaechste Achsen (Folge-Hebel-Kandidaten)

- **[content] problem-fit** — mean 0.8/2, min 0/2 (anwendbar in 5/5 Runs)
- **[content] classification-confidence** — mean 0.8/2, min 0/2 (anwendbar in 5/5 Runs)
- **[content] label-fidelity** — mean 1.2/2, min 0/2 (anwendbar in 5/5 Runs)
- **[structure] visual-completeness** — mean 1.4/2, min 0/2 (anwendbar in 5/5 Runs)

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
