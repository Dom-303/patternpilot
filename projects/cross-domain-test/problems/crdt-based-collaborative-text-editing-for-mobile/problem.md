---
slug: crdt-based-collaborative-text-editing-for-mobile
title: CRDT-based collaborative text editing for mobile
status: active
project: cross-domain-test
created_at: 2026-04-25
---

## description
We are building a mobile-first collaborative writing app that needs offline-first sync with deterministic conflict resolution. Users edit on iOS / Android, often offline for hours, then sync. We need a CRDT-based text editing engine that supports rich-text spans, version vectors, and efficient delta exchange over an unreliable connection. Looking for production-grade CRDT libraries (Yjs, Automerge, Fluid Framework) and integration patterns for native mobile editor controls.

## success_criteria
- Offline-first text editing with consistent merge semantics
- Sync over unreliable connections with delta compression
- Native iOS UITextView + Android EditText integration
- Rich-text span preservation (bold, italic, links, mentions)
- Garbage collection of historical operations to keep storage bounded

## constraints
- Mobile-first: iOS Swift + Android Kotlin native
- Open-source license (MIT or BSD)
- Battery-conscious sync — no constant polling
- Encrypted-at-rest local storage

## non_goals
- Real-time low-latency editing like Google Docs (we accept 100-500ms sync window)
- Operational Transformation (OT) approach — explicitly CRDT
- Full document workflow / approval flows

## current_approach
- Single-writer pessimistic locking via REST API
- Last-write-wins for conflicts (lossy, frustrating users)
- No native CRDT integration

## hints
- search_terms: crdt text editing, yjs mobile, automerge swift, automerge kotlin, collaborative editing mobile, offline-first sync, version vector text, delta-state crdt, rich-text crdt, peritext rich text
- tech_tags: swift, kotlin, ios, android, javascript, typescript, rust, c++, mobile, native
- constraint_tags: opensource, mit-or-bsd, mobile, encrypted-at-rest
- approach_keywords: crdt-text-editing, offline-first-sync, version-vector, delta-state, rich-text-spans, native-bridge

## suspected_approach_axes
- crdt_algorithm: yjs ↔ automerge ↔ logoot ↔ peritext
- sync_strategy: state-based ↔ delta-based ↔ operation-based
- mobile_bridge: ffi-bindings ↔ embedded-runtime ↔ wasm
