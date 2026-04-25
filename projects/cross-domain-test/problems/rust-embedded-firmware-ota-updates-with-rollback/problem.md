---
slug: rust-embedded-firmware-ota-updates-with-rollback
title: Rust embedded firmware OTA updates with rollback
status: active
project: cross-domain-test
created_at: 2026-04-25
---

## description
Embedded Rust firmware running on ARM Cortex-M MCUs (STM32, nRF52) needs over-the-air update capability with atomic A/B partition switch and watchdog-protected rollback if the new firmware fails self-test. We are looking for embedded-rust patterns, no_std crates, bootloader implementations, and OTA-over-LoRa or BLE protocols that fit in 256KB flash.

## success_criteria
- Dual-bank firmware layout with atomic partition swap
- Watchdog-armed boot — automatic rollback if new image crashes during init
- Cryptographic signature verification before swap (Ed25519)
- Delta-update support to keep transfer size small (LoRa = limited bandwidth)
- Total bootloader < 32KB flash

## constraints
- no_std Rust (embassy or cortex-m-rt ecosystem)
- ARM Cortex-M0+/M4 targets
- License: Apache-2.0 / MIT
- No heap allocation in bootloader path

## non_goals
- Linux-class OTA (separate problem)
- Cloud-side update fleet management (we just need device-side)
- Custom bootloader from scratch — we want to adopt prior art

## current_approach
- Single firmware image, manual flashing via SWD probe
- No rollback path; failed update bricks the device
- Signature verification done by host tool, not on-device

## hints
- search_terms: embedded rust ota, rust no-std bootloader, dual-bank firmware, embedded ed25519, mcu firmware update, lora firmware update, cortex-m bootloader, rust embedded delta update
- tech_tags: rust, embedded, no_std, cortex-m, stm32, nrf52, embassy, cortex-m-rt, lora, ble
- constraint_tags: opensource, apache-or-mit, embedded, no-heap
- approach_keywords: dual-bank-swap, watchdog-rollback, signature-verification, delta-update, no-std-bootloader

## suspected_approach_axes
- partition_strategy: dual-bank-swap ↔ rolling-update ↔ recovery-partition
- transport_layer: ble ↔ lora ↔ wifi ↔ uart
- crypto_primitive: ed25519 ↔ ecdsa-p256 ↔ aes-cmac
