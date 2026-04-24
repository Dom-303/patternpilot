---
problem: schema-exact-extraction-into-40-column-masterlist
run_id: 2026-04-24T11-55-56-236Z
project: eventbear-worker
generated_at: 2026-04-24T11:55:56.242Z
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
| python+query:typescript-field-mapping+typescript | needs_manual_read | typescript, python, query:typescript-field-mapping | https://github.com/ordermentum/lunartick, https://github.com/AleksaMCode/fastapi-validation-mapping-react, https://github.com/brakmic/address-api | adjacent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: python+query:typescript-field-mapping+typescript
- constraint_clean_cluster: python+query:typescript-field-mapping+typescript
- anti_tunnel_alternative: -

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem schema-exact-extraction-into-40-column-masterlist https://github.com/ordermentum/lunartick`
