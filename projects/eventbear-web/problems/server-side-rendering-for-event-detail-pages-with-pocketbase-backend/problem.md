---
slug: server-side-rendering-for-event-detail-pages-with-pocketbase-backend
title: Server-side rendering for event detail pages with PocketBase backend
status: active
project: eventbear-web
created_at: 2026-04-25
---

## description
EventBaer's web frontend renders thousands of event detail pages that need to be indexable by search engines and produce rich social-media embeds. The backing data store is PocketBase (SQLite-based). We are looking for SSR + structured-data patterns that combine: live PocketBase queries on the request path, edge-cached HTML for repeated event lookups, schema.org Event JSON-LD injection, and an ISR-style revalidation pipeline when source feeds update an event record.

## success_criteria
- Event detail pages serve fully-rendered HTML with valid schema.org Event JSON-LD on first response
- Cache TTL is configurable per event status (live/upcoming/archived)
- Revalidation triggers when the underlying PocketBase record changes (webhook or polling)
- Open-graph + Twitter card meta tags reflect the live event data, not stale snapshots

## constraints
- Stack: Next.js or Astro (we use both in different apps)
- Backend: PocketBase (HTTP API, no GraphQL)
- License: open-source preferred, Apache-2.0 or MIT
- No third-party CDN lock-in beyond Cloudflare or Vercel Edge

## non_goals
- Full static export of all events (catalog is too large and changes too often)
- Migrating off PocketBase to another backend
- Building a custom CMS-like editor on top of PocketBase
- Server-side image rendering for OG previews (separate concern)

## current_approach
- Next.js app in `apps/web` uses ISR with revalidate=60 for event detail routes
- PocketBase queries fan out per request without caching
- Schema.org JSON-LD is hand-built per page from event fields
- No formal revalidation hook from PocketBase to Next — staleness is observed visually

## hints
- search_terms: pocketbase ssr, edge isr revalidation, schema.org event json-ld, event detail page indexing, structured data injection nextjs, astro pocketbase integration, edge cache event detail
- tech_tags: nextjs, astro, pocketbase, sqlite, vercel, cloudflare, edge, react, typescript
- constraint_tags: opensource, mit-or-apache, edge-deployable
- approach_keywords: server-side-rendering, edge-caching, isr-revalidation, structured-data-injection, schema-org-event, og-meta-tags

## suspected_approach_axes
- rendering_strategy: pure-ssr ↔ isr-revalidation ↔ edge-streaming
- cache_layer: in-memory ↔ kv-store ↔ cdn-edge
- structured_data: hand-built ↔ template-driven ↔ schema-validator-loop
