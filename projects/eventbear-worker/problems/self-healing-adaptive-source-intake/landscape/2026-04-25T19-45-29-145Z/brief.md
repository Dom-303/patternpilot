---
problem: self-healing-adaptive-source-intake
run_id: 2026-04-25T19-45-29-145Z
project: eventbear-worker
generated_at: 2026-04-25T19:45:29.154Z
llm_augmentation: false
---

## Problem (1 Satz)
Der EventBaer-Worker braucht pro neuer Quelle manuelle Extraktor-Tuning-Arbeit: neue Selektoren hand-crafted, Edge-Cases patchen, neue Source-Families anlegen. Jede Quelle bleibt isolierter Fix — d...

## Landscape auf einen Blick
- 2 Ansatz-Cluster aus 16 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 1 adjacent, 1 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| e2e-testing+playwright+query:selector-self-healing | needs_manual_read | query:selector-self-healing, e2e-testing, typescript | https://github.com/ShantanuVr/playwright-self-healing-framework, https://github.com/alexandriashai/cbrowser, https://github.com/lvortexl/aws-test-framework-boilerplate | adjacent |
| automation+data+query:adaptive-xpath | needs_manual_read | query:adaptive-xpath, data, ai-scraping | https://github.com/D4Vinci/Scrapling, https://github.com/chrisabruce/scrapling-rs, https://github.com/atOliverParkerMorgan/product-scaper | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: e2e-testing+playwright+query:selector-self-healing
- constraint_clean_cluster: e2e-testing+playwright+query:selector-self-healing
- anti_tunnel_alternative: automation+data+query:adaptive-xpath

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem self-healing-adaptive-source-intake https://github.com/ShantanuVr/playwright-self-healing-framework`
