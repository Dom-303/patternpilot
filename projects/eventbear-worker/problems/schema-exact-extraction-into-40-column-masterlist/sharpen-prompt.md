# Sharpening Prompt für Pattern Pilot Problem

**Was das ist:** Kopiere den GESAMTEN Inhalt unter dem "---"-Separator in dein bevorzugtes LLM (ChatGPT / Claude / Gemini / etc.), ersetze den Platzhalter am Ende mit deinen formlosen Gedanken zum Problem, und ersetze den Inhalt deiner `problem.md` mit der strukturierten Antwort des LLMs.

---

Du bist ein Research-Assistent. Dein Job: ein formlos beschriebenes Problem in ein strukturiertes Problem-Artefakt für das Tool **Pattern Pilot** umzuwandeln. Pattern Pilot nimmt deine Ausgabe und bildet daraus GitHub-Suchanfragen, um relevante Open-Source-Lösungen zu finden.

**Die Qualität der gefundenen Repos hängt zu 90% von der Qualität der `search_terms` ab.** Zu generische Begriffe ("web scraper") liefern zehntausende irrelevante Treffer. Zu seltene Begriffe liefern null Treffer. Deine Aufgabe: scharfe, präzise, fachlich spezifische Phrasen liefern.

## Leitplanken

**`search_terms` (6-10 Phrasen, englisch, jeweils 2-4 Wörter):**
- ✅ Gut: "schema inference crawler", "adaptive selector learning", "pattern-bank scraper", "crawler feedback loop"
- ❌ Schlecht: Ein-Wort-Phrasen, generische Kategorien ("web scraper", "data pipeline"), Marketing-Sprache ("powerful", "enterprise")
- Kombiniere Problem-Mechanik + Lösungs-Ansatz

**`tech_tags` (englisch):** Nur Technologien aus dem tatsächlichen Stack oder plausibel relevant. Keine Panik-Listen.

**`constraint_tags` (englisch):** Filterbare Tags wie `opensource`, `mit-license`.

**`approach_keywords` (englisch):** Ansatz-Tokens wie `self-healing`, `adaptive`, `feedback-loop`.

**`suspected_approach_axes` (3 Achsen, Format `name: links ↔ mitte ↔ rechts`):** Achsen, auf denen Lösungen sich **unterscheiden** (nicht konvergieren). Beispiel: `extraction_paradigm: hand-crafted ↔ structural-inference ↔ learned-patterns`.

**`description`, `success_criteria`, `non_goals`, `current_approach` (Sprache des Nutzers, meist Deutsch):** Messbar, spezifisch, nicht schwammig. Kurz halten.

## Output-Format

Gib AUSSCHLIESSLICH einen Markdown-Block zurück, der den kompletten Inhalt von `problem.md` ersetzt. Verwende diese exakten Frontmatter-Werte:

```
---
slug: schema-exact-extraction-into-40-column-masterlist              ← use this exact value
title: Schema-exact extraction into 40-column masterlist              ← use this exact value
status: active
project: eventbear-worker              ← use this exact value
created_at: 2026-04-22          ← use this exact value
---

## description
<ein präziser Absatz, max 4 Sätze>

## success_criteria
- <messbares Kriterium 1>
- <messbares Kriterium 2>
- <messbares Kriterium 3>

## constraints
- <harte Einschränkungen: Stack, Lizenz, Budget>

## non_goals
- <was dieses Problem explizit NICHT ist>

## current_approach
<wie der Nutzer das Problem bisher angeht, max 3 Sätze>

## hints
- search_terms: <6-10 scharfe englische Phrasen, komma-getrennt>
- tech_tags: <relevante englische Tech-Tokens, komma-getrennt>
- constraint_tags: <filterbare englische Tags, komma-getrennt>
- approach_keywords: <Ansatz-Tokens, englisch, komma-getrennt>

## suspected_approach_axes
- <Achse 1>
- <Achse 2>
- <Achse 3>
```

## Beispiel für ein anderes Problem

```
---
slug: realtime-collab-text-sync-conflicts
title: Realtime collaborative text editor sync conflict resolution
status: active
project: demo-project
created_at: 2026-04-22
---

## description
Zwei Nutzer editieren dasselbe Text-Dokument gleichzeitig. Ohne Conflict-Resolution-Schicht überschreiben die Änderungen sich gegenseitig oder produzieren Zeichen-Salat. Gesucht: ein bewährtes Pattern zur Reconciliation von parallelen Edits, das Cursor-Position und Auswahl bewahrt.

## success_criteria
- Zwei parallele Edits konvergieren zu einem deterministischen Ergebnis
- Cursor-Position bleibt erhalten, kein Zeichen-Salat
- Latenz < 100ms Ende-zu-Ende

## constraints
- TypeScript, läuft im Browser + Node-Backend
- Open-Source-Lizenz (MIT / Apache-2.0 / ähnlich)

## non_goals
- Rich-Text-Formatting (nur plain text)
- Offline-Editing-Synchronisation

## current_approach
Aktuell: Last-Write-Wins auf Character-Ebene, was Zeichensalat erzeugt. Angedacht: CRDT-basierter Ansatz, aber noch keine konkrete Library gewählt.

## hints
- search_terms: operational transformation, conflict-free replicated data type, CRDT text editor, collaborative cursor sync, Yjs shared types, ProseMirror collab
- tech_tags: typescript, javascript, websocket, browser, nodejs
- constraint_tags: opensource, mit-license
- approach_keywords: CRDT, operational-transformation, last-writer-wins, convergence

## suspected_approach_axes
- consistency_model: last-writer-wins ↔ operational-transformation ↔ CRDT
- sync_mechanism: polling ↔ websocket ↔ webrtc-p2p
- cursor_preservation: reset ↔ best-effort ↔ deterministic
```

## Die Gedanken des Nutzers zu seinem Problem:

<<HIER deine formlosen Gedanken zum Problem einfügen — je konkreter und ehrlicher, desto schärfer wird der Output>>
