---
problem: event-deduplication-across-heterogenous-sources
run_id: 2026-04-22T19-30-32-829Z
project: eventbear-worker
generated_at: 2026-04-22T19:30:32.832Z
llm_augmentation: false
---

## Problem (1 Satz)
Derselbe physische Event wird von mehreren Quellen eingesammelt — mit leicht unterschiedlichen Titeln ("Jazz im Keller" vs. "Jazzabend"), Adressschreibweisen, Start-Zeiten (±15 Min), Beschreibungen...

## Landscape auf einen Blick
- 12 Ansatz-Cluster aus 12 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 8 adjacent, 4 divergent
- Landscape-Signal: single_cluster_collapse

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| agent+ann-blocking+data-engineering | needs_manual_read | agent, ann-blocking, edge-runtime | https://github.com/benzsevern/goldenmatch | adjacent |
| abbreviated+across+addresses | needs_manual_read | abbreviated, addresses, alphabets | https://github.com/ShahinHasanov90/trade-record-linker | adjacent |
| ---+data-disambigation+data-matching | needs_manual_read | data-disambigation, duplicate-detection, link-discovery | https://github.com/AI-team-UoA/pyJedAI | adjacent |
| algerian+arabic+between | needs_manual_read | algerian, arabic, between | https://github.com/selmamehdi48/Arabic-Latin-Full-Name-Match | divergent |
| cli+command-line-tool+dedupe | needs_manual_read | cli, command-line-tool, dependencies | https://github.com/Anuar-boop/string-distance | adjacent |
| benchmark+comparison+data | needs_manual_read | benchmark, comparison, data-validation | https://github.com/benzsevern/dqbench | adjacent |
| -3776ab+align+badge | needs_manual_read | -3776ab, cross-language, downloads | https://github.com/pradhankukiran/entity-resolution-engine | adjacent |
| dedupe+deduplication+record-linkage | needs_manual_read | record-linkage, dedupe, deduplication | https://github.com/gpoulter/pydedupe | adjacent |
| across+cms+data | needs_manual_read | cms, end-to-end, entities | https://github.com/shubhvn-dev/healthcare-provider-linkage | divergent |
| ---+entity-matching+linkage | needs_manual_read | preserving, privacy, --- | https://github.com/AI-team-UoA/privJedAI | adjacent |
| feature+fellegi-sunter+implementation | needs_manual_read | feature, fellegi-sunter, implementation | https://github.com/dylantmoore/splink_stata | divergent |
| 20build+actions+align | needs_manual_read | 20build, actions, com | https://github.com/rapidfuzz/RapidFuzz | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: agent+ann-blocking+data-engineering
- constraint_clean_cluster: agent+ann-blocking+data-engineering
- anti_tunnel_alternative: algerian+arabic+between

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem event-deduplication-across-heterogenous-sources https://github.com/benzsevern/goldenmatch`
