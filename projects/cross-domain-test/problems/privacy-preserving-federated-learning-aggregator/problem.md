---
slug: privacy-preserving-federated-learning-aggregator
title: Privacy-preserving federated learning aggregator
status: active
project: cross-domain-test
created_at: 2026-04-25
---

## description
We need a federated-learning aggregation server that combines client model updates without seeing individual gradients. Clients are mobile devices that train locally on user data; the server must aggregate via secure-aggregation (homomorphic / additive masking) and apply differential-privacy noise to the global model. Looking for FL frameworks (Flower, FedML, TensorFlow Federated), secure-aggregation libraries, and DP-SGD aggregator implementations.

## success_criteria
- Server cannot reconstruct any single client's gradient
- Differential-privacy budget tracked per training round
- Robust to client dropouts mid-round (Byzantine tolerance)
- Compatible with TFLite mobile clients
- Supports both FedAvg and FedProx aggregation strategies

## constraints
- Python server, mobile-side TFLite + Swift/Kotlin
- Open-source license
- Differential-privacy library that's audited (e.g., Google DP, OpenDP)
- No Trusted Execution Environment (TEE) requirement — pure crypto

## non_goals
- Vertical federated learning (different problem)
- Cross-silo enterprise FL (we focus on cross-device)
- Model architecture design (we accept whatever the clients train)

## current_approach
- Plain FedAvg with no privacy primitives
- Server sees raw gradients, central aggregation
- No DP budget tracking, no Byzantine handling

## hints
- search_terms: federated learning aggregator, secure aggregation, differential privacy SGD, flower federated learning, tensorflow federated, fedml, byzantine robust aggregation, opendp, homomorphic aggregation, masked aggregation
- tech_tags: python, tensorflow, pytorch, tflite, swift, kotlin, mobile, gpu
- constraint_tags: opensource, audited-dp-library, no-tee
- approach_keywords: secure-aggregation, differential-privacy, fedavg, fedprox, byzantine-robust, dp-sgd, masked-aggregation

## suspected_approach_axes
- privacy_primitive: secure-aggregation ↔ differential-privacy ↔ homomorphic-encryption
- robustness_strategy: dropout-tolerant ↔ byzantine-robust ↔ trust-all-clients
- aggregation_algorithm: fedavg ↔ fedprox ↔ fedopt ↔ scaffold
