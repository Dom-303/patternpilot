---
slug: time-series-anomaly-detection-on-edge-devices
title: Time-series anomaly detection on edge devices
status: active
project: cross-domain-test
created_at: 2026-04-25
---

## description
We deploy IoT sensor fleets that stream time-series data (temperature, vibration, electrical signal) and need to detect anomalies on-device before exporting any data. Looking for compact anomaly-detection algorithms — isolation forests, Matrix Profile, ESN-based reservoir computing, autoencoders quantized to int8 — that fit in 1MB RAM and process 1kHz signals in real-time on Cortex-M7 or RP2040 class devices.

## success_criteria
- Anomaly detection latency < 50ms per window
- < 1MB total RAM footprint (model + state + buffer)
- Configurable sensitivity per sensor channel
- Online adaptation to slow drift without full retrain
- Clear false-positive vs false-negative tradeoff knob

## constraints
- C / Rust / MicroPython implementation (no Python at runtime)
- Open-source license
- Quantized int8 inference where possible (TensorFlow Lite Micro acceptable)
- No network at inference time

## non_goals
- Cloud-side training (we accept training happens off-device)
- Computer-vision anomaly detection (different sensor class)
- Generic ML framework comparison

## current_approach
- Threshold-based rules per channel (manual tuning)
- High false-positive rate, no adaptation
- Sends raw data to cloud for centralized scoring

## hints
- search_terms: edge anomaly detection, time series matrix profile, isolation forest embedded, esn reservoir computing, tflite micro anomaly, quantized autoencoder, embedded ml, sensor anomaly streaming, streaming time series
- tech_tags: c, rust, embedded, cortex-m7, rp2040, tensorflow-lite, micropython, int8-quantization, edge-ml
- constraint_tags: opensource, embedded, low-memory, real-time
- approach_keywords: matrix-profile, isolation-forest, autoencoder, reservoir-computing, quantized-inference, online-adaptation

## suspected_approach_axes
- detection_algorithm: matrix-profile ↔ isolation-forest ↔ autoencoder ↔ reservoir-computing
- adaptation_strategy: online-update ↔ batch-retrain ↔ no-adaptation
- compute_target: cortex-m7 ↔ rp2040 ↔ esp32 ↔ jetson
