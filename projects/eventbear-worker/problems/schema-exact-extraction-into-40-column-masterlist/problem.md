---
slug: schema-exact-extraction-into-40-column-masterlist
title: Schema-exact extraction into 40-column masterlist
status: active
project: eventbear-worker
created_at: 2026-04-22
---

## description
Nach Crawling/Parsing heterogener Event-Quellen landen extrahierte Felder in einer Masterlist mit ~40 Spalten (title, description, start_at, end_at, street, city, venue, organizer, category, price, ...). Heute werden Felder oft falsch zugeordnet: Adresse landet in venue, Datum bleibt String, Kategorien sind nicht kanonisiert. Jede neue Quelle erzwingt manuelles Column-Mapping-Debugging. Gesucht werden Patterns für deterministisches Field-Mapping von heterogenen Inputs auf ein kanonisches Wide-Schema.

## success_criteria
- Felder landen bei ≥95% der Quellen automatisch in der richtigen Spalte
- Neue Quellen mit strukturell ähnlichem Input übernehmen Mapping ohne Code-Change
- Mapping-Confidence pro Feld inspectable, nicht Black-Box
- Fehlmappings werden im Run-Protokoll geflaggt, nicht stillschweigend toleriert

## constraints
- Node.js / TypeScript-Worker, Wide-Schema fix (~40 Spalten, JSON/CSV Output)
- Open-Source-Referenzen bevorzugt — kein SaaS-Closed-Loop
- Lesbare, deterministische Mapping-Logik — kein Black-Box-ML im Hot-Path

## non_goals
- Kein ML-Heavy-Approach — heuristisch und regel-basiert ist Ziel
- Keine Schema-Änderungen — die ~40 Spalten sind fix
- Kein generischer ETL-Framework — Frage ist field-mapping-spezifisch

## current_approach
Feldspezifische Extraktoren mit handcrafted Regeln. Neue Quellen brechen Annahmen; Adressen und Datum/Zeit sind besonders fragil. "Detect Once, Extract Many"-Paradigma in Umsetzung, aber Field-Routing nach Detect-Stage ist noch per-Source hand-tuned.

## hints
- search_terms: semantic field mapping, schema alignment library, table column inference, named entity extraction events, ical rrule parser, structured data extractor, address parsing library, csv schema matcher
- tech_tags: nodejs, typescript, javascript, python
- constraint_tags: opensource
- approach_keywords: field-mapping, schema-alignment, column-inference, deterministic, rule-based, entity-extraction, date-parsing, address-parsing

## suspected_approach_axes
- inference_approach: hand-crafted ↔ schema-aligned ↔ ML-inferred
- confidence_handling: all-or-nothing ↔ per-field-flagged ↔ probabilistic
- schema_flexibility: fixed-target ↔ user-configurable ↔ auto-discovered
