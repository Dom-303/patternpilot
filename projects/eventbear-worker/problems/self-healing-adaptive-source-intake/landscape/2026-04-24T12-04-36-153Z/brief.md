---
problem: self-healing-adaptive-source-intake
run_id: 2026-04-24T12-04-36-153Z
project: eventbear-worker
generated_at: 2026-04-24T12:04:36.157Z
llm_augmentation: false
---

## Problem (1 Satz)
Der EventBaer-Worker braucht pro neuer Quelle manuelle Extraktor-Tuning-Arbeit: neue Selektoren hand-crafted, Edge-Cases patchen, neue Source-Families anlegen. Jede Quelle bleibt isolierter Fix — d...

## Landscape auf einen Blick
- 2 Ansatz-Cluster aus 20 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 1 adjacent, 1 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| automation+playwright+query:selector-self-healing | needs_manual_read | query:selector-self-healing, browser, e2e-testing | https://github.com/alexandriashai/cbrowser, https://github.com/lvortexl/aws-test-framework-boilerplate, https://github.com/TheFishPilot/Verity-Agentic-Web-Scraper | adjacent |
| data+selectors+xpath | needs_manual_read | xpath, data, selectors | https://github.com/D4Vinci/Scrapling, https://github.com/chrisabruce/scrapling-rs, https://github.com/mehardsingh/scholarly-entity-wrapper-induction | divergent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: automation+playwright+query:selector-self-healing
- constraint_clean_cluster: automation+playwright+query:selector-self-healing
- anti_tunnel_alternative: data+selectors+xpath

## Nächster konkreter Schritt
→ `npm run intake -- --project eventbear-worker --problem self-healing-adaptive-source-intake https://github.com/alexandriashai/cbrowser`
