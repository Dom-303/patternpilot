---
problem: event-deduplication-across-heterogenous-sources
run_id: 2026-04-24T13-13-06-276Z
project: eventbear-worker
generated_at: 2026-04-24T13:13:06.280Z
llm_augmentation: false
---

## Problem (1 Satz)
Derselbe physische Event wird von mehreren Quellen eingesammelt — mit leicht unterschiedlichen Titeln ("Jazz im Keller" vs. "Jazzabend"), Adressschreibweisen, Start-Zeiten (±15 Min), Beschreibungen...

## Landscape auf einen Blick
- 3 Ansatz-Cluster aus 20 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 3 adjacent, 0 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| dedupe+python+query:record-linkage-library | needs_manual_read | query:record-linkage-library, library, linkage | https://github.com/AI-team-UoA/privJedAI, https://github.com/ShahinHasanov90/trade-record-linker, https://github.com/selmamehdi48/Arabic-Latin-Full-Name-Match | adjacent |
| dedupe+deduplication+entity-resolution | needs_manual_read | query:entity-resolution-deduplication, dedupe, deduplication | https://github.com/benzsevern/goldenmatch, https://github.com/benzsevern/dqbench, https://github.com/pradhankukiran/entity-resolution-engine | adjacent |
| agent+python+typescript | needs_manual_read | typescript, levenshtein, query:splink-record-linkage | https://github.com/draganskondric-engcdkso/kds-uti-engine, https://github.com/rapidfuzz/RapidFuzz, https://github.com/kmaurinjones/ontograph | adjacent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: dedupe+python+query:record-linkage-library
- constraint_clean_cluster: dedupe+python+query:record-linkage-library
- anti_tunnel_alternative: -

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem event-deduplication-across-heterogenous-sources https://github.com/AI-team-UoA/privJedAI`
