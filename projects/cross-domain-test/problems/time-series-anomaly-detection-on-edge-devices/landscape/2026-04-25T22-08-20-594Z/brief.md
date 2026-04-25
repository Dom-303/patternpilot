---
problem: time-series-anomaly-detection-on-edge-devices
run_id: 2026-04-25T22-08-20-594Z
project: cross-domain-test
generated_at: 2026-04-25T22:08:20.600Z
llm_augmentation: false
---

## Problem (1 Satz)
We deploy IoT sensor fleets that stream time-series data (temperature, vibration, electrical signal) and need to detect anomalies on-device before exporting any data. Looking for compact anomaly-de...

## Landscape auf einen Blick
- 4 Ansatz-Cluster aus 17 bewerteten Repos
- Anti-Tunnel-Verteilung: 0 near_current_approach, 2 adjacent, 2 divergent
- Landscape-Signal: ok

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| embedded-ml+embedded+inference | needs_manual_read | query:embedded-ml, inference, quantization | https://github.com/wayang-roleplay/dit, https://github.com/AntGamerMD21/eval-guide, https://github.com/Moramo5213/edgeglyph | divergent |
| isolation-forest-embedded+detection+embedded | needs_manual_read | query:isolation-forest-embedded, detection, intrusion | https://github.com/gowinston123/service-mesh-ids, https://github.com/SagarBiswas-MultiHAT/BF-IDS_Project_Proposal, https://github.com/Souvikhazra15/Animal-Detection-Alert-System-LoRa-Based | adjacent |
| schema_parser+---+2026 | needs_manual_read | ---, 2026, agriculture | https://github.com/HimanshuBairwa/Autonomous-Agronomy-Engine-, https://github.com/sanjaysatheesh417-cyber/Robot_anomlaly_detection | divergent |
| --------------------+machine-learning+rust | needs_manual_read | query:esn-reservoir-computing, machine-learning, -------------------- | https://github.com/Corsking93/COSMO-OS-ROM, https://github.com/haradama/reservoir-rs, https://github.com/georgegrosu1/reservoir-compute-demo | adjacent |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: embedded-ml+embedded+inference
- constraint_clean_cluster: embedded-ml+embedded+inference
- anti_tunnel_alternative: embedded-ml+embedded+inference

## Nächster konkreter Schritt
→ `npm run intake -- --project cross-domain-test --problem time-series-anomaly-detection-on-edge-devices https://github.com/wayang-roleplay/dit`
