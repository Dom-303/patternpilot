---
problem: schema-exact-extraction-into-40-column-masterlist
run_id: 2026-04-24T12-24-11-154Z
project: eventbear-worker
generated_at: 2026-04-24T12:24:11.158Z
llm_augmentation: false
---

## Problem (1 Satz)
Nach Crawling/Parsing heterogener Event-Quellen landen extrahierte Felder in einer Masterlist mit ~40 Spalten (title, description, start_at, end_at, street, city, venue, organizer, category, price,...

## Landscape auf einen Blick
- 5 Ansatz-Cluster aus 20 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 0 adjacent, 5 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| ipv4+python+query:address-parsing-library | needs_manual_read | query:address-parsing-library, python, ipv4 | https://github.com/GRAAL-Research/deepparse, https://github.com/beaugunderson/ip-address, https://github.com/hitoshyamamoto/soapbar | divergent |
| bridge+csv+query:csv-schema-matcher | needs_manual_read | query:csv-schema-matcher, csv, bridge | https://github.com/jmeyo/seo-scout, https://github.com/malikmuhammadsaadshafiq-dev/mvp-csv-bridge-5608, https://github.com/malikmuhammadsaadshafiq-dev/mvp-csv-bridge | divergent |
| data+extracting+query:structured-data-extractor | needs_manual_read | query:structured-data-extractor, extracting, llm | https://github.com/ftucos/dossier_medical_reports_scraping, https://github.com/heripo-lab/heripo-engine, https://github.com/teamn9636/trawl | divergent |
| query:typescript-field-mapping+react+typescript | needs_manual_read | query:typescript-field-mapping, typescript, react | https://github.com/ErrorX407/typemold, https://github.com/AleksaMCode/fastapi-validation-mapping-react, https://github.com/ari-davis-debug/clay-crm-pipeline | divergent |
| acroform+nodejs+service | needs_manual_read | service, nodejs, acroform | https://github.com/ordermentum/lunartick, https://github.com/brakmic/address-api, https://github.com/lindseystead/ai-pdf-autofiller | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: ipv4+python+query:address-parsing-library
- constraint_clean_cluster: ipv4+python+query:address-parsing-library
- anti_tunnel_alternative: ipv4+python+query:address-parsing-library

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem schema-exact-extraction-into-40-column-masterlist https://github.com/GRAAL-Research/deepparse`
