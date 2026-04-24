---
problem: schema-exact-extraction-into-40-column-masterlist
run_id: 2026-04-24T11-50-27-435Z
project: eventbear-worker
generated_at: 2026-04-24T11:50:27.439Z
llm_augmentation: false
---

## Problem (1 Satz)
Nach Crawling/Parsing heterogener Event-Quellen landen extrahierte Felder in einer Masterlist mit ~40 Spalten (title, description, start_at, end_at, street, city, venue, organizer, category, price,...

## Landscape auf einen Blick
- 1 Ansatz-Cluster aus 20 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 1 adjacent, 0 divergent
- Landscape-Signal: single_cluster_collapse

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| python+react+typescript | needs_manual_read | typescript, python, react | https://github.com/yarnfieldiscool/resumeX, https://github.com/ordermentum/lunartick, https://github.com/AleksaMCode/fastapi-validation-mapping-react | adjacent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: python+react+typescript
- constraint_clean_cluster: python+react+typescript
- anti_tunnel_alternative: -

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem schema-exact-extraction-into-40-column-masterlist https://github.com/yarnfieldiscool/resumeX`
