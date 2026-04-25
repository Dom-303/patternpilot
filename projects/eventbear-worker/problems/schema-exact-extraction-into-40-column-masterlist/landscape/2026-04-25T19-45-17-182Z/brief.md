---
problem: schema-exact-extraction-into-40-column-masterlist
run_id: 2026-04-25T19-45-17-182Z
project: eventbear-worker
generated_at: 2026-04-25T19:45:17.191Z
llm_augmentation: false
---

## Problem (1 Satz)
Nach Crawling/Parsing heterogener Event-Quellen landen extrahierte Felder in einer Masterlist mit ~40 Spalten (title, description, start_at, end_at, street, city, venue, organizer, category, price,...

## Landscape auf einen Blick
- 5 Ansatz-Cluster aus 15 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 1 adjacent, 4 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| github+python+query:structured-data-extractor | needs_manual_read | query:structured-data-extractor, github, python | https://github.com/yarnfieldiscool/resumeX, https://github.com/asgharkapk/Sub-Config-Extractor, https://github.com/teamn9636/trawl | divergent |
| -black-000000+query:typescript-field-mapping+typescript | needs_manual_read | query:typescript-field-mapping, typescript, -black-000000 | https://github.com/ErrorX407/typemold, https://github.com/AleksaMCode/fastapi-validation-mapping-react, https://github.com/ari-davis-debug/clay-crm-pipeline | divergent |
| ical+query:ical-rrule-parser+recurrence | needs_manual_read | ical, query:ical-rrule-parser, recurrence | https://github.com/ordermentum/lunartick, https://github.com/JonasWanke/rrule | divergent |
| addresses+libpostal+query:libpostal-address-normalization | needs_manual_read | addresses, libpostal, query:libpostal-address-normalization | https://github.com/brakmic/address-api, https://github.com/jamesbrink/pypostal-flake | adjacent |
| acroform+ai-automation+query:semantic-field-mapping | needs_manual_read | query:semantic-field-mapping, acroform, ai-automation | https://github.com/lindseystead/ai-pdf-autofiller, https://github.com/zhh2001/fix-protocol | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: github+python+query:structured-data-extractor
- constraint_clean_cluster: github+python+query:structured-data-extractor
- anti_tunnel_alternative: github+python+query:structured-data-extractor

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem schema-exact-extraction-into-40-column-masterlist https://github.com/yarnfieldiscool/resumeX`
