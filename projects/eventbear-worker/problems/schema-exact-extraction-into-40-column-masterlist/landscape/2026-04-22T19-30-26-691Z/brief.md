---
problem: schema-exact-extraction-into-40-column-masterlist
run_id: 2026-04-22T19-30-26-691Z
project: eventbear-worker
generated_at: 2026-04-22T19:30:26.698Z
llm_augmentation: false
---

## Problem (1 Satz)
Nach Crawling/Parsing heterogener Event-Quellen landen extrahierte Felder in einer Masterlist mit ~40 Spalten (title, description, start_at, end_at, street, city, venue, organizer, category, price,...

## Landscape auf einen Blick
- 12 Ansatz-Cluster aus 12 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 0 adjacent, 12 divergent
- Landscape-Signal: single_cluster_collapse

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| date+description+ical | needs_manual_read | date, description, ical | https://github.com/ordermentum/lunartick | divergent |
| blob+file+file-upload | needs_manual_read | blob, file-upload, form | https://github.com/Cram10/frmz | divergent |
| ai-summaries+docker+dockerfile | needs_manual_read | ai-summaries, docker, dockerfile | https://github.com/ZERO24680/EDICTO | divergent |
| checks+cli+crawl | needs_manual_read | checks, cli, crawl | https://github.com/jmeyo/seo-scout | divergent |
| automatic+column+creation | needs_manual_read | automatic, column, creation | https://github.com/chop-dbhi/sql-importer | divergent |
| analytics+built+consolidates | needs_manual_read | analytics, built, consolidates | https://github.com/VojinMK/Football_Match_Analytics_Data_Warehouse | divergent |
| adts+avalonia+design | needs_manual_read | adts, avalonia, design | https://github.com/obselate/ADTS | divergent |
| acroform+ai-automation+backend | needs_manual_read | acroform, ai-automation, backend | https://github.com/lindseystead/ai-pdf-autofiller | divergent |
| data+entity+extraction | needs_manual_read | entity, extraction, financial | https://github.com/Kriti-28/FinanceInsight | divergent |
| 6003+6037+clash | needs_manual_read | 6003, 6037, clash | https://github.com/asgharkapk/Sub-Config-Extractor | divergent |
| beaugunderson+branch+codecov | needs_manual_read | beaugunderson, branch, codecov | https://github.com/beaugunderson/ip-address | divergent |
| api+json+python | needs_manual_read | api, rpc, soap | https://github.com/hitoshyamamoto/soapbar | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: date+description+ical
- constraint_clean_cluster: date+description+ical
- anti_tunnel_alternative: date+description+ical

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem schema-exact-extraction-into-40-column-masterlist https://github.com/ordermentum/lunartick`
