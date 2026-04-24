---
problem: schema-exact-extraction-into-40-column-masterlist
run_id: 2026-04-24T11-48-22-310Z
project: eventbear-worker
generated_at: 2026-04-24T11:48:22.315Z
llm_augmentation: false
---

## Problem (1 Satz)
Nach Crawling/Parsing heterogener Event-Quellen landen extrahierte Felder in einer Masterlist mit ~40 Spalten (title, description, start_at, end_at, street, city, venue, organizer, category, price,...

## Landscape auf einen Blick
- 18 Ansatz-Cluster aus 20 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 1 adjacent, 17 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| gemini+gemini-api+github | needs_manual_read | gemini, gemini-api, resume | https://github.com/yarnfieldiscool/resumeX | divergent |
| date+description+ical | needs_manual_read | date, description, ical | https://github.com/ordermentum/lunartick | divergent |
| -black-000000+-prettier-ff69b4+fastapi | needs_manual_read | -black-000000, -prettier-ff69b4, fastapi | https://github.com/AleksaMCode/fastapi-validation-mapping-react | divergent |
| address+addresses+api | needs_manual_read | address, built, easy | https://github.com/brakmic/address-api | divergent |
| acroform+ai-automation+backend | needs_manual_read | acroform, ai-automation, backend | https://github.com/lindseystead/ai-pdf-autofiller | divergent |
| android+chemicalconverter+docking | needs_manual_read | android, chemicalconverter, docking | https://github.com/conectrix/structify | divergent |
| automate+automation+contains | needs_manual_read | automate, contains, designed | https://github.com/soumyadeb-git/Fetch-Py | divergent |
| addresses-parsing+machine-learning | needs_manual_read | addresses-parsing, machine-learning | https://github.com/GRAAL-Research/deepparse | divergent |
| beaugunderson+branch+codecov | needs_manual_read | beaugunderson, branch, codecov | https://github.com/beaugunderson/ip-address | divergent |
| api+json+rpc | needs_manual_read | rpc, soap, soap-client | https://github.com/hitoshyamamoto/soapbar | divergent |
| automation+classes+configuration | needs_manual_read | classes, configuration, curated | https://github.com/Szumak75/JskToolBox | divergent |
| checks+cli+crawl | needs_manual_read | checks, cli, crawl | https://github.com/jmeyo/seo-scout | divergent |
| bridge+csv+mvp | needs_manual_read | bridge, saas, csv | https://github.com/malikmuhammadsaadshafiq-dev/mvp-csv-bridge-5608, https://github.com/malikmuhammadsaadshafiq-dev/mvp-csv-bridge | divergent |
| clay+com+crm | needs_manual_read | clay, com, crm | https://github.com/ari-davis-debug/clay-crm-pipeline | divergent |
| mvp+nextjs+voicefill | needs_manual_read | voicefill, web-app, mvp | https://github.com/malikmuhammadsaadshafiq-dev/mvp-voicefill-2259, https://github.com/malikmuhammadsaadshafiq-dev/mvp-voicefill | divergent |
| address-parsing+addresses+bindings | needs_manual_read | address-parsing, bindings, flake | https://github.com/jamesbrink/pypostal-flake | adjacent |
| enum+field+fix | needs_manual_read | enum, field, fix | https://github.com/zhh2001/fix-protocol | divergent |
| accurately+across+agricultural | needs_manual_read | accurately, across, agricultural | https://github.com/migueldesousanc/Agricultural-Field-Boundary-Delineation-in-Spain | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: bridge+csv+mvp
- constraint_clean_cluster: gemini+gemini-api+github
- anti_tunnel_alternative: gemini+gemini-api+github

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem schema-exact-extraction-into-40-column-masterlist https://github.com/malikmuhammadsaadshafiq-dev/mvp-csv-bridge-5608`
