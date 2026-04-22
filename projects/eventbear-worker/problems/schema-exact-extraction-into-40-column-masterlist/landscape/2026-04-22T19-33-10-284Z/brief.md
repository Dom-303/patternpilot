---
problem: schema-exact-extraction-into-40-column-masterlist
run_id: 2026-04-22T19-33-10-284Z
project: eventbear-worker
generated_at: 2026-04-22T19:33:10.289Z
llm_augmentation: false
---

## Problem (1 Satz)
Nach Crawling/Parsing heterogener Event-Quellen landen extrahierte Felder in einer Masterlist mit ~40 Spalten (title, description, start_at, end_at, street, city, venue, organizer, category, price,...

## Landscape auf einen Blick
- 1 Ansatz-Cluster aus 12 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 0 adjacent, 1 divergent
- Landscape-Signal: single_cluster_collapse

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| csv+data+python | needs_manual_read | data, python, csv | https://github.com/Toyoclara233/registry, https://github.com/ordermentum/lunartick, https://github.com/jmeyo/seo-scout | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: csv+data+python
- constraint_clean_cluster: csv+data+python
- anti_tunnel_alternative: csv+data+python

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem schema-exact-extraction-into-40-column-masterlist https://github.com/Toyoclara233/registry`
