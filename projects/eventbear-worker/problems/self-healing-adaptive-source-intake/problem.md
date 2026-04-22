---
slug: self-healing-adaptive-source-intake
title: Self-healing adaptive source intake
status: active
project: eventbear-worker
created_at: 2026-04-22
---

## description
Der EventBaer-Worker braucht pro neuer Quelle manuelle Extraktor-Tuning-Arbeit: neue Selektoren hand-crafted, Edge-Cases patchen, neue Source-Families anlegen. Jede Quelle bleibt isolierter Fix — die Pipeline hat keinen Pattern-Bank, der aus gelösten Fällen Extraktions-Regeln destilliert, und kein Self-Healing bei Struktur-Drift. Gesucht werden Patterns aus Wrapper-Induction, Template-Learning und adaptivem Selector-Recovery, die "einmal gelöst, überall ähnlich" realisieren.

## success_criteria
- 100 neue Quellen in einem Batch laufen ohne per-Source Engineering durch
- Selektor-Drift (Site-HTML-Änderung) wird automatisch erkannt und repariert statt stillschweigend leere Events zu liefern
- Gelöste Extraktions-Regeln propagieren in einen Pattern-Bank, den ähnliche Quellen wiederverwenden
- Neue Source-Families werden aus strukturellen Signalen vorgeschlagen statt hand-klassifiziert

## constraints
- Node.js-Worker mit gezielter Playwright-Eskalation, kein Python-Heavy-Stack
- Open-Source-Referenzen bevorzugt — kein SaaS-Closed-Loop in der Kern-Pipeline
- Lern-Entscheidungen müssen inspectable bleiben — kein Black-Box-ML im Hot-Path

## non_goals
- Kein LLM-first-Extractor — heuristische + strukturelle Inferenz ist das Ziel
- Keine generische Scraper-Library — die Frage ist System-Ebene, nicht Library-Wahl
- Kein Orchestration-Tool (Airflow, Prefect) — die Lücke ist in Extraction/Normalization, nicht Scheduling

## current_approach
Paradigmen-Shift "Detect Once, Extract Many" in Umsetzung: Strategy-Registry + Pluggable Extractors. Aber die Onboarding-Kosten pro Quelle und das Fehlen eines echten Feedback/Lernsystems bleiben die dominanten Scaling-Blocker. Gesucht: externe Patterns fuer Wrapper-Maintenance, Template-Learning und adaptiven Selector-Recovery.

## hints
- search_terms: wrapper induction, selector self-healing, adaptive xpath, DOM template matching, scraper auto-recovery, extraction rule learning, automatic wrapper maintenance, wrapper learning system
- tech_tags: nodejs, typescript, playwright, puppeteer, crawler
- constraint_tags: opensource
- approach_keywords: self-healing, adaptive, wrapper-induction, pattern-bank, auto-onboarding, feedback-loop, template-learning, selector-drift

## suspected_approach_axes
- extraction_paradigm: hand-crafted ↔ structural-inference ↔ learned-patterns
- feedback_loop: none ↔ manual-curation ↔ automatic-pattern-bank
- onboarding_cost: high-per-source ↔ templated ↔ zero-touch
