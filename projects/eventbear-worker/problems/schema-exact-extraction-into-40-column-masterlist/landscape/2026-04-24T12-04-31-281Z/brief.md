---
problem: schema-exact-extraction-into-40-column-masterlist
run_id: 2026-04-24T12-04-31-281Z
project: eventbear-worker
generated_at: 2026-04-24T12:04:31.285Z
llm_augmentation: false
---

## Problem (1 Satz)
Nach Crawling/Parsing heterogener Event-Quellen landen extrahierte Felder in einer Masterlist mit ~40 Spalten (title, description, start_at, end_at, street, city, venue, organizer, category, price,...

## Landscape auf einen Blick
- 4 Ansatz-Cluster aus 20 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 0 adjacent, 4 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| data+python+query:structured-data-extractor | needs_manual_read | query:structured-data-extractor, data, github | https://github.com/yarnfieldiscool/resumeX, https://github.com/heripo-lab/heripo-engine, https://github.com/teamn9636/trawl | divergent |
| ipv4+python+query:address-parsing-library | needs_manual_read | query:address-parsing-library, ipv4, ipv6 | https://github.com/GRAAL-Research/deepparse, https://github.com/beaugunderson/ip-address, https://github.com/hitoshyamamoto/soapbar | divergent |
| bridge+csv+query:csv-schema-matcher | needs_manual_read | query:csv-schema-matcher, csv, bridge | https://github.com/jmeyo/seo-scout, https://github.com/malikmuhammadsaadshafiq-dev/mvp-csv-bridge-5608, https://github.com/malikmuhammadsaadshafiq-dev/mvp-csv-bridge | divergent |
| data-mapping+nodejs+typescript | needs_manual_read | nodejs, data-mapping, nestjs | https://github.com/ErrorX407/typemold, https://github.com/AleksaMCode/fastapi-validation-mapping-react, https://github.com/ordermentum/lunartick | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: data+python+query:structured-data-extractor
- constraint_clean_cluster: data+python+query:structured-data-extractor
- anti_tunnel_alternative: data+python+query:structured-data-extractor

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem schema-exact-extraction-into-40-column-masterlist https://github.com/yarnfieldiscool/resumeX`
