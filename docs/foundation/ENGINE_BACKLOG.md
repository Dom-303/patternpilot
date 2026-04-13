# ENGINE_BACKLOG

## Zweck

Diese Datei sammelt Punkte, die das Report-UI eigentlich schon zeigen *will*, die aber nicht von der HTML-Schicht entschieden werden duerfen. Es sind **Engine-Daten-Luecken**, keine Template-Defekte.

Regel aus dem Report-Output-Model: Wenn das Template aktuell heuristisch raten oder auf einen neutralen Default zurueckfallen muss, obwohl die eigentliche Aussage eine kuratierte Engine-Entscheidung waere, dann gehoert das in diese Liste.

Die Eintraege hier sind kein Grund, das Template zu aendern. Sie sind Input fuer die Engine-/Pipeline-Roadmap.

## Status

- last_updated: 2026-04-13
- begleitet: `lib/html-renderer.mjs` (Decision Summary, Recommended Actions, Top Recommendations)
- verwandt: `docs/reference/REPORT_OUTPUT_MODEL.md`, `docs/foundation/AUTOMATION_ROADMAP.md`

---

## EB-001 — Disposition fuer Watchlist-Review-Items

- betrifft: `renderRecommendedActions`, `renderDecisionSummary`, Decision-Vocabulary-Mapping
- heutiger Zustand: Review-Items haben kein `discoveryDisposition`. Das Template faellt deshalb auf einen `projectFitBand`-Parallelpfad zurueck (`high -> Adopt`, `medium -> Study`, `low -> Watch`, sonst `Defer`).
- warum Engine-Thema: Fit-Band allein ist keine echte Empfehlung. Ob ein bereits kuratierter Repo-Eintrag adoptiert, studiert, beobachtet oder aufgeschoben werden soll, ist eine Bewertungsaussage, die in der Review-Pipeline gefaellt werden muesste.
- gewuenschte Engine-Aenderung: Das Review-Dossier soll pro Item ein eigenes Feld `reviewDisposition` ausgeben, analog zu `discoveryDisposition`, mit denselben Werten (`intake_now`, `review_queue`, `observe_only`, `skip`).
- Nutzen fuer das Report-UI: Die Type-Badges und Gruppen-Buckets stimmen dann fuer Discovery- und Review-Reports nach derselben Wahrheit, nicht nach zwei parallelen Heuristiken.

---

## EB-002 — Echtes Confidence-Signal statt Fit-Ratio-Heuristik

- betrifft: `renderDecisionSummary` (Signal confidence Badge)
- heutiger Zustand: Das Template berechnet eine grobe Confidence aus (a) Anzahl Kandidaten und (b) Anteil `fit=high`. Bei wenig Kandidaten oder vielen mittelguten Treffern wird das Ergebnis als "heuristic" markiert.
- warum Engine-Thema: Confidence ist eine Meta-Aussage ueber Lauf- und Quellqualitaet, nicht ueber Template-Logik. Ein Run mit drei starken Quellen und einer breiten Abdeckung ist vertrauenswuerdiger als ein Run mit einem einzigen guten Treffer.
- gewuenschte Engine-Aenderung: Discovery- und Review-Engine liefern pro Lauf ein Feld `runConfidence` mit Werten wie `high`, `medium`, `low`, plus `runConfidenceReason` mit 1 Satz Begruendung (z. B. "4 von 12 Treffern im High-Band, 2 Quellen uebereinstimmend").
- Nutzen fuer das Report-UI: Der Badge wird zu einem echten Qualitaetsindikator, und die "heuristic"-Markierung verschwindet.

---

## EB-003 — Effort- und Value-Felder pro Kandidat

- betrifft: `renderRecommendedActions` (Reihenfolge innerhalb Adopt/Study-Bucket)
- heutiger Zustand: Innerhalb einer Empfehlungsgruppe wird nach Reihenfolge im Kandidatenarray sortiert. Die ersten drei `adopt`-Eintraege bekommen zusaetzlich das Ranking-Styling, aber "drei" ist willkuerlich und "erste" ist kein Ranking.
- warum Engine-Thema: Eine ehrliche Adopt-Liste braucht mindestens zwei Dimensionen: *wie aufwendig ist die Uebernahme* und *wie gross ist der erwartete Nutzen*. Das ist eine Bewertungsentscheidung, nicht eine Render-Frage.
- gewuenschte Engine-Aenderung: Pro Kandidat zwei normierte Felder, z. B. `effortBand` (`small`, `medium`, `large`) und `valueBand` (`high`, `medium`, `low`), idealerweise inkl. kurzem Begruendungstext.
- Nutzen fuer das Report-UI: Adopt-Eintraege koennen echt nach Value/Effort sortiert werden. Die "Top 3 Adopt" wird zu einer echten Prioritaetsaussage, nicht nur visuelles Hervorheben.

---

## EB-004 — "Most repeated gap signal" braucht ein echtes Gap-Feld

- betrifft: `renderDecisionSummary` (Most repeated gap signal Zelle)
- heutiger Zustand: Das Template zaehlt heute einfach die haeufigste `matchedCapabilities[0]` bzw. `guess.mainLayer` bzw. `gapArea` ueber alle Kandidaten und nennt das "Gap". Das ist keine Luecke, das ist eine Konvergenz.
- warum Engine-Thema: Eine echte Luecke waere eine Aussage wie "Diese Schicht fehlt dem Zielprojekt heute, und mehrere externe Repos zeigen sie stark". Das verlangt einen Abgleich mit dem Zielprojekt-Alignment, nicht nur Zaehlen.
- gewuenschte Engine-Aenderung: Engine berechnet pro Kandidat `gapAreaCanonical` (normalisierte Gap-Kategorie), und der Run-Report-Payload liefert zusaetzlich `runGapSignals: [{ gap, count, strength }]`, bereits gegen die Projekt-Luecken-Matrix aus `ALIGNMENT_RULES.json` gewichtet.
- Nutzen fuer das Report-UI: Aus dem belastbaren Wert wird eine echte strategische Aussage, nicht nur die haeufigste String-Token-Kollision.

---

## EB-005 — Konsistente `projectDisposition` fuer beide Report-Typen

- betrifft: allgemeine Dokumenten-Konsistenz zwischen Discovery und Watchlist Review
- heutiger Zustand: Discovery-Reports und Watchlist-Review-Reports transportieren teils ueberlappende, teils unterschiedliche Felder. Das Template enthaelt deshalb parallele Pfade pro Reportart.
- warum Engine-Thema: Je mehr der beiden Pipelines auf eine gemeinsame Daten-Form fuer "Kandidat mit Bewertung" konvergieren, desto weniger Dualismus muss das Template halten.
- gewuenschte Engine-Aenderung: Gemeinsames Zwischenformat, z. B. `evaluatedCandidate`, das fuer Discovery und Review gleich geschrieben wird. Report-spezifische Extras koennen optional draufliegen.
- Nutzen fuer das Report-UI: Eine einzige Code-Pfad-Logik pro Section statt `if (reportType === "discovery")` ueberall.

---

## Nicht-Ziele

- Keine dieser Punkte rechtfertigt fuer sich allein, das Template zu aendern.
- Keine dieser Punkte sind Bugs: das Template rendert in allen Faellen ohne Crash und mit sinnvollen Defaults.
- Diese Datei ist keine Sammelstelle fuer Feature-Ideen. Sie dokumentiert nur Faelle, in denen das Template heute "raten" muss, weil die Engine die Information nicht liefert.

## Naechster Schritt

Diese Liste soll beim naechsten Engine- bzw. Pipeline-Planungsschritt gegen `docs/foundation/AUTOMATION_ROADMAP.md` abgeglichen werden. Die Entscheidung, *wann* ein Punkt in die Engine-Roadmap wandert, ist eine Produktentscheidung, keine Template-Entscheidung.
