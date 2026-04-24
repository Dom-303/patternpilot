---
problem: event-deduplication-across-heterogenous-sources
run_id: 2026-04-24T12-04-11-897Z
project: eventbear-worker
generated_at: 2026-04-24T12:04:11.900Z
llm_augmentation: false
---

## Problem (1 Satz)
Derselbe physische Event wird von mehreren Quellen eingesammelt — mit leicht unterschiedlichen Titeln ("Jazz im Keller" vs. "Jazzabend"), Adressschreibweisen, Start-Zeiten (±15 Min), Beschreibungen...

## Landscape auf einen Blick
- 3 Ansatz-Cluster aus 20 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 2 adjacent, 1 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| dedupe+python+query:record-linkage-library | needs_manual_read | query:record-linkage-library, linkage, record | https://github.com/AI-team-UoA/privJedAI, https://github.com/ShahinHasanov90/trade-record-linker, https://github.com/selmamehdi48/Arabic-Latin-Full-Name-Match | adjacent |
| dedupe+entity-resolution+python | needs_manual_read | query:entity-resolution-deduplication, entity-resolution, dedupe | https://github.com/benzsevern/goldenmatch, https://github.com/benzsevern/dqbench, https://github.com/pradhankukiran/entity-resolution-engine | adjacent |
| jaro-winkler+python+string-similarity | needs_manual_read | string-similarity, jaro-winkler, levenshtein | https://github.com/rapidfuzz/RapidFuzz, https://github.com/Ashu9372/medicine-chatbot, https://github.com/Tox1469/string-similarity | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: dedupe+python+query:record-linkage-library
- constraint_clean_cluster: dedupe+python+query:record-linkage-library
- anti_tunnel_alternative: jaro-winkler+python+string-similarity

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem event-deduplication-across-heterogenous-sources https://github.com/AI-team-UoA/privJedAI`
