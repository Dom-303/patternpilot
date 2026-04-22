---
problem: event-deduplication-across-heterogenous-sources
run_id: 2026-04-22T19-17-06-009Z
project: eventbear-worker
generated_at: 2026-04-22T19:17:06.017Z
llm_augmentation: false
---

## Problem (1 Satz)
Derselbe physische Event wird von mehreren Quellen eingesammelt — mit leicht unterschiedlichen Titeln ("Jazz im Keller" vs. "Jazzabend"), Adressschreibweisen, Start-Zeiten (±15 Min), Beschreibungen...

## Landscape auf einen Blick
- 1 Ansatz-Cluster aus 12 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 1 adjacent, 0 divergent
- Landscape-Signal: single_cluster_collapse

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| dedupe+deduplication+python | needs_manual_read | dedupe, deduplication, python | https://github.com/benzsevern/goldenmatch, https://github.com/ShahinHasanov90/trade-record-linker, https://github.com/AI-team-UoA/pyJedAI | adjacent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: dedupe+deduplication+python
- constraint_clean_cluster: dedupe+deduplication+python
- anti_tunnel_alternative: -

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem event-deduplication-across-heterogenous-sources https://github.com/benzsevern/goldenmatch`
