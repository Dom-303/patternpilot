# Problem Statement Mode — Design

- status: proposed
- created_at: 2026-04-20
- authors: domi + claude
- related_open_questions: OQ-005 (LLM augmentation boundary)

## Zweck

Pattern Pilot bewertet externe Repos heute immer relativ zu einem Zielprojekt. Dieses Design ergänzt um eine zweite, optionale Bezugsebene: eine konkrete Problemstellung, die ein Nutzer gerade lösen will.

Der Kernwert ist nicht nur gezielter zu suchen. Der Kernwert ist, die Landschaft an unterschiedlichen Lösungsansätzen zu einem Problem sichtbar zu machen — damit Nutzer aus Tunnelvision rauskommen, wenn sie zu nah am eigenen aktuellen Ansatz denken.

## Leitprinzipien

1. Problem ist optional. Pattern Pilot funktioniert weiter vollständig ohne Problemstellung.
2. Problem ist ein erstklassiges Artefakt. Kein transientes Flag.
3. Projektbindung wird nicht ersetzt. Problem legt sich als zweite Linse darüber.
4. Anti-Tunnel-Zweck ist explizit im Datenmodell und in der Output-Logik verankert.
5. Heuristik-First. Jede Schicht muss ohne LLM funktionieren und Wert liefern.
6. LLM ist additiv, sichtbar getrennt und nur dort erlaubt, wo sie 100 % sinnvoll UND 100 % relevant ist.

## 1. Architektur und Artefakte

Ein Problem ist ein persistentes Artefakt innerhalb der bestehenden Vier-Bereiche-Trennung (`bindings/`, `projects/`, `runs/`, `state/`). Es gibt keine neue Top-Level-Wurzel.

### Layout bei projektgebundenem Problem (Normalfall)

```
projects/<project>/problems/<problem-slug>/
  problem.md            # menschenlesbar, Quelle der Wahrheit
  problem.json          # maschinenlesbar, aus problem.md generiert
  resolution.md         # optional, nach problem:resolve
  landscape/
    <run-id>/
      landscape.html
      landscape.json
      brief.md
      clusters.csv
      llm-cache.json    # optional, nur wenn LLM aktiv war
```

### Layout bei standalone Problem (projektlos)

```
state/standalone-problems/<problem-slug>/
  problem.md
  problem.json
  landscape/<run-id>/...
```

### Beziehung zu bestehenden Artefakten

- `bindings/<project>/PROJECT_BINDING.json` bleibt Pflichtlesung bei projektgebundenen Problemen. Problem-Kontext wird zusätzlich gelesen, nicht anstelle.
- Intake-Dossiers aus `problem:explore` landen im normalen `projects/<project>/intake/`. Das Dossier bekommt eine Rückverweis-Zeile auf das auslösende Problem. Derselbe Fund bleibt aus anderen Problemen heraus wiederauffindbar.
- `knowledge/repo_landkarte.csv` bleibt projektweite Wissensebene und ist von Problemen unberührt.
- Landscape-Runs liegen semantisch am Problem, nicht projektglobal. In `runs/` wird nur ein Zeiger auf den Landscape-Run geschrieben, damit der projektweite Laufindex vollständig bleibt.

## 2. Datenmodell

### problem.md

```markdown
---
slug: slow-event-lists
title: Lange Eventlisten performant im Frontend darstellen
status: active
project: eventbear-worker     # weglassen = standalone
created_at: 2026-04-20
---

## description
Eventlisten mit 500+ Einträgen brauchen 3–5 s bis first paint.
Das bremst den Master-Run-Report massiv aus.

## success_criteria
- erste 50 Events sichtbar < 300 ms nach Navigation
- scroll bleibt flüssig (>50 fps) bis Listenende
- kein Reload beim Filterwechsel

## constraints
- kein externer Service, rein lokal
- Stack bleibt Next.js + Tailwind
- Lizenz kompatibel zu Apache-2.0

## non_goals
- keine neuen Filterfeatures
- kein Server-Side-Rendering-Umbau

## current_approach
Wir laden alle Events im initialen Request und rendern alles auf einmal.
Gedacht war danach eine client-seitige Virtualisierung via react-window.

## hints
- search_terms: long list virtualization, event feed performance
- tech_tags: nextjs, tailwind, react
- constraint_tags: local-only, license:apache-compatible
- approach_keywords: client-virtualization, react-window

## suspected_approach_axes
# optional, nur falls Stufe 1+2 Clustering nicht genügt
- client-side virtualization
- server-side pagination
- infinite scroll
```

Regeln:

- `slug` ist kleinbuchstabiger Kebab-Case, unique pro Projekt bzw. standalone-Scope.
- `status ∈ {active, resolved, archived}`. Alle Probleme starten als `active`.
- Markdown-Sektionen außerhalb der definierten Felder werden ignoriert. Nutzer dürfen eigene Notizen einstreuen.

### problem.json

Generiert aus `problem.md` via `problem:refresh`. Nie handediert.

```json
{
  "slug": "slow-event-lists",
  "title": "Lange Eventlisten performant im Frontend darstellen",
  "status": "active",
  "project": "eventbear-worker",
  "created_at": "2026-04-20",
  "updated_at": "2026-04-20",
  "latest_landscape": "landscape/2026-04-20T14-22-05Z",
  "last_explore_result": "ok",
  "fields": {
    "description": "...",
    "success_criteria": ["...", "..."],
    "constraints": ["...", "..."],
    "non_goals": ["...", "..."],
    "current_approach": "...",
    "suspected_approach_axes": ["...", "..."]
  },
  "derived": {
    "query_seeds": ["long list virtualization", "event feed performance", "..."],
    "approach_signature": ["client-virtualization", "react-window"],
    "constraint_tags": ["local-only", "license:apache-compatible"],
    "tech_tags": ["nextjs", "tailwind", "react"]
  }
}
```

### derived.\* Generierungsregeln

`derived.*` ist eine dünne, deterministische Projektion aus expliziten Hints plus simpler Keyword-Extraktion.

- `derived.query_seeds` = `hints.search_terms` + naive Keyword-Extraktion aus `title` (Stoppwort-Filter, keine Synthese).
- `derived.approach_signature` = `hints.approach_keywords`. Wenn leer: leer.
- `derived.constraint_tags` = `hints.constraint_tags`. Keine Prosa-Extraktion.
- `derived.tech_tags` = `hints.tech_tags`. Keine Prosa-Extraktion.
- `current_approach` bleibt als Rohtext im Artefakt, fließt aber nicht in `derived.*`. Verwendung im Anti-Tunnel-Matching passiert direkt gegen `approach_signature`.

### Resolution-Pfad

`problem:resolve <slug> [--note "..."]` setzt `status: resolved` und legt optional `resolution.md` an:

```markdown
---
problem: slow-event-lists
resolved_at: 2026-04-25
landscape_ref: landscape/2026-04-20T14-22-05Z
---

## chosen_approach
virtualization+windowing (react-window), scroll-anchor fix aus repo <x>

## why
success_criteria erfüllt ohne SSR-Umbau, Cluster divergent betrachtet und verworfen

## links_to_cluster
- near_current_approach: virtualization+windowing
```

## 3. Command Surface

### Neue `problem:*`-Befehle

| Befehl | Wirkung |
|---|---|
| `problem:create --project <p> --title "..." [--slug ...]` | Legt `projects/<p>/problems/<slug>/problem.md` aus Template an. Ohne `--project` landet das Problem unter `state/standalone-problems/`. Öffnet die Datei nicht — Nutzer editiert sie danach von Hand. |
| `problem:list [--project <p>] [--status active\|all]` | Listet Probleme mit Status, letztem Landscape-Zeitpunkt und Cluster-Count. |
| `problem:refresh <slug>` | Re-parst `problem.md`, regeneriert `problem.json` und `derived.*`. Pflicht nach Handedit. Wird von anderen `problem:*`-Commands intern erzwungen. |
| `problem:explore <slug> [--depth quick\|standard\|deep] [--skip-discovery] [--with-llm]` | Kettenlauf: `refresh` → targeted discovery → soft intake → clustering → landscape → brief. Erzeugt `landscape/<run-id>/`. |
| `problem:brief <slug> [--run <run-id>] [--with-llm]` | Erzeugt nur den Brief aus einem bestehenden Landscape-Run. Für Re-Fokussierung ohne neuen Run. |
| `problem:resolve <slug> [--note "..."]` | Setzt `status: resolved`, legt `resolution.md` an. |
| `problem:archive <slug>` | Setzt `status: archived`. Behält alle Artefakte. |

### Flags an bestehenden Befehlen

- `npm run intake -- --project <p> --problem <slug> <url>` — Intake-Dossier erhält Rückverweis `problem: <slug>`; Intake-Logik selbst unverändert.
- `npm run patternpilot -- discover --project <p> --problem <slug>` — Discovery zieht `query_seeds` + `approach_signature` zusätzlich zum Projekt-Kontext heran.
- `npm run review:watchlist -- --project <p> --problem <slug>` — Review filtert die Watchlist auf Problem-Relevanz, Ranking nutzt `constraint_tags` als Soft-Filter.

### Kettenlauf `problem:explore`

```
problem:refresh
  ↓
targeted discovery     (query_seeds gegen GitHub, bestehende Engine mit Problem-Profil)
  ↓
soft intake            (Top-N Kandidaten als Intake-Dossier, Problem-getagged)
  ↓
clustering             (Stufe 1 + Stufe 2 + optional Stufe 3, siehe Abschnitt 5)
  ↓
landscape report       (HTML + JSON + CSV)
  ↓
brief derivation       (brief.md aus Landscape + Problem + Projekt-DNA)
```

Abgrenzung: Der bestehende Kettenlauf `discover → watchlist → intake → re-evaluate → review` bleibt unverändert. `problem:explore` ist eine parallele, problem-gescopte Variante, kein Ersatz.

## 4. Discovery-Integration

Projekt-Kontext bleibt Pflichtlesung bei projektgebundenen Problemen. Problem-Kontext legt sich additiv darüber.

### 4.1 Query-Erweiterung (additiv)

Bestehende Projekt-Query-Familien laufen unverändert. Zusätzlich:

- **Problem-Query-Familie**: aus `derived.query_seeds`.
- **Kreuz-Familie**: Kombinationen der stärksten Projekt- und Problem-Seeds (`event feed virtualization`, …).
- Budget: alle Familien teilen sich das Budget des gewählten Discovery-Profils (`focused`/`balanced`/`expansive`/`max`). Kein paralleles Budget. Split nach Szenario:
  - projektgebundenes Problem: 40 % Projekt / 40 % Problem / 20 % Kreuz
  - standalone-Problem: 100 % Problem (Projekt- und Kreuz-Familie entfallen)

### 4.2 Ranking-Augmentation

- Bestehender `project_fit`-Score bleibt.
- Neuer `problem_fit`-Score aus Überlappung von Repo-Signalen (Topics, README-Keywords, `main_layer`) mit `derived.query_seeds` + `approach_signature`.
- Combined-Score bei projektgebundenem Problem: `0.5 × project_fit + 0.5 × problem_fit` (in Config änderbar).
- Combined-Score bei standalone-Problem: `1.0 × problem_fit`.

### 4.3 Constraint-Anwendung

- `constraint_tags` wie `license:apache-compatible` → harter Filter. Repo fällt raus, wenn vorhandene Lizenzmetadaten unvereinbar. Unbekannte Lizenz = Warn-Markierung, kein Auto-Reject.
- `tech_tags` → weicher Boost. Score-Bonus, nie Reject.
- `non_goals` → in Discovery bewusst ignoriert. Wirken nur als Lesehilfe beim Clustering und im Brief.

### 4.4 Diversitätsregel (Anti-Tunnel)

Standard-Ranking bevorzugt das Nächstähnliche. Gegen Tunnelvision:

- Auswahlfenster z. B. 20 Repos für den Landscape-Input. Plätze 1–10 nach Combined-Score.
- Plätze 11–20: approach-divergente Repos, definiert als **Jaccard-Ähnlichkeit < 0.3** zwischen ihrer Keyword-Signatur und `approach_signature` — UND `problem_fit ≥ 0.4`, damit "divergent" nicht in "off-topic" kippt.
- Wenn keine divergenten Repos den Mindest-Fit schaffen: freie Plätze werden nach Combined-Score aufgefüllt, Report markiert `diversity_gap: no_divergent_candidates_met_threshold`.
- Runselbstbericht: `selected_by_score: N | selected_by_divergence: M` — reproduzierbar und nachvollziehbar.

### 4.5 Fallback- und Caching-Regeln

- Leere `derived.query_seeds`: Engine wirft keine Problem-Query, Discovery läuft wie heute nur auf Projekt-Queries, Run-Log `problem_query_family: empty(reason: no_seeds)`.
- Cache: `problem:explore` darf Discovery-Treffer aus einem projektweiten Discovery-Run der letzten 24 h wiederverwenden. Problem-Queries laufen dann frisch.

## 5. Clustering für Solution Landscape

Dreistufig, ohne LLM. Jede Stufe eigenständig wertstiftend.

### 5.1 Stufe 1 — Struktur-Cluster (primäre Achse)

- Cluster-Schlüssel: `(pattern_family, main_layer)` aus der Landkarte bzw. aus Intake-Heuristik-Vorschlag.
- Cluster mit < 2 Mitgliedern wandern in einen `outliers`-Bucket.
- Repos mit heuristisch vorgeschlagenem `pattern_family` werden im Report mit `pattern_family: suggested` markiert.

### 5.2 Stufe 2 — Keyword-Cluster (sekundäre Achse)

- Keyword-Signatur pro Repo aus: GitHub-Topics, README-H1/H2-Überschriften, `package.json`-Top-Level-Dependencies, häufige Substantive aus README-Einleitung.
- Normalisierung: lowercase, Stoppwort-Filter, Synonym-Map aus `lib/clustering/synonyms.json` (kuratiert).
- Agglomeratives Single-Link-Clustering, Jaccard-Threshold 0.35 (in Config änderbar).
- Stufe 2 läuft additiv: Unter-Cluster innerhalb eines Stufe-1-Clusters ≥ 4 Repos. Bei kleineren Clustern: Keyword-Signatur nur als Tag-Wolke im Report.

### 5.3 Stufe 3 — User-deklarierte Achsen (optional)

- Aus `problem.md` Sektion `suspected_approach_axes`.
- Jedes Repo wird auf die nächste Achse nach Keyword-Überlappung gemappt.
- Achsen ohne Treffer erscheinen im Report als `axis_not_found_in_landscape` — selbst ein Signal.
- Stufe 3 ersetzt nichts automatisch, läuft parallel als zweite Sicht im Report.

### 5.4 Cluster-Labels

Label jedes Clusters = die 2–3 häufigsten Keyword-Tokens im Cluster, alphabetisch sortiert, mit `+` verbunden. Beispiel: `virtualization+windowing`. Deterministisch.

### 5.5 Anti-Tunnel-Markierung pro Cluster

Overlap-Count der `approach_signature`-Tokens im Cluster (nicht Jaccard, da Signatur typisch klein):

- ≥ 66 % der Signatur-Tokens im Cluster → `near_current_approach`
- ≥ 1 gemeinsames Token → `adjacent`
- 0 gemeinsame Tokens → `divergent`

### 5.6 Single-Cluster-Collapse-Fall

Wenn Stufe 1 + Stufe 2 zusammen weniger als 2 Cluster mit ≥ 2 Mitgliedern liefern: Report markiert `landscape_signal: single_cluster_collapse` und empfiehlt (a) `suspected_approach_axes` nachtragen, (b) Problem-Scope verschärfen, (c) Query-Seeds verbreitern. Kein nutzloser Ein-Balken-Report.

### 5.7 Grenzen

- Stufe 2 ist keyword-basiert. Semantische Ähnlichkeit mit unterschiedlichen Begriffen wird nicht erkannt.
- Stufe 1 ist nur so gut wie die `pattern_family`-Vergabe. Heuristik-Vorschläge können fehlerhaft sein, sind entsprechend markiert.
- Qualitätshebel langfristig: mehr kuratierte `pattern_family`, nicht besserer Algorithmus.

## 6. LLM-Grenze als Designprinzip

### Prinzipien

1. **Heuristik-First-Pflicht**: Jede Schicht muss vollständig ohne LLM funktionieren und produktiv sein. LLM darf kein Ersatz für fehlende Code-Arbeit sein.
2. **Additive Sichtbarkeit**: LLM-Output ist immer separat ausgewiesen. JSON-Feld `llm_augmentation`, HTML-Abschnitt "KI-Ergänzung (optional)", Brief-Marker `> [LLM-Zusammenfassung – keine Primärquelle]`. Ohne LLM fällt alles weg, nichts bricht.
3. **Heuristische Wahrheit nicht überschreiben**: LLM darf nicht `pattern_family`, `main_layer`, `approach_signature`, `cluster_membership` ändern, keine `decision` setzen, keine Repos halluzinieren.
4. **Determinismus bei aktivem LLM**: LLM-Output pro `(cluster-id, cluster-member-fingerprint)` in `landscape/<run-id>/llm-cache.json`. Re-Generieren des Briefs trifft den Cache, kein erneuter Modellaufruf.
5. **100 % sinnvoll UND 100 % relevant**: LLM wird nur an Stellen eingebaut, an denen beide Bedingungen gelten.

### Erlaubte LLM-Einsatzorte (nach 100/100-Filter)

| Einsatzort | Warum erlaubt |
|---|---|
| Cluster-Narrativ (je Cluster ~3 Sätze: Kernidee, typische Stärke, typische Schwäche) | Heuristik kann nur Labels + Mitgliederliste; Narrativ macht Cluster lesbar. 100/100. |
| Stärken-/Schwächen-Verdichtung je Cluster (2 Bullets pro Cluster) | Echte Informationslücke im Heuristik-Brief; trägt direkt die Entscheidung. 100/100. |

### Bewusst nicht zugelassen

| Ursprünglich erwogen | Warum abgelehnt |
|---|---|
| Brief-Prosa-Glättung (Bullets → Fließtext) | Stilistik, keine Substanz. Bullets sind lesbar. |
| Divergenz-Hypothese ("warum fundamental anders") | Heuristik sagt schon `divergent`; Nutzer kann selbst in die Repos schauen. |

### Konfiguration

- Default: `llm: off`. Alle Commands laufen ohne Netzaufruf.
- Opt-in via `patternpilot.config.json` (`llm.enabled: true`, Provider, Modell) oder `--with-llm`-Flag.
- Aktives LLM ohne konfigurierten Provider: Hard-Error mit klarer Meldung, kein stiller Fallback.

## 7. Problem Brief

Output am Ende von `problem:explore` oder via `problem:brief`. Kurz, entscheidungs-fokussiert.

### Struktur brief.md

```markdown
---
problem: slow-event-lists
run_id: 2026-04-20T14-22-05Z
project: eventbear-worker
generated_at: 2026-04-20T14-23-10Z
llm_augmentation: false
---

## Problem (1 Satz)
<erste Nicht-Leer-Zeile aus problem.md description, auf 200 Zeichen gekürzt>

## Landscape auf einen Blick
- N Ansatz-Cluster aus M bewerteten Repos
- Anti-Tunnel-Verteilung: x near_current_approach, y adjacent, z divergent
- Diversitäts-Pflicht erfüllt: ja/nein

## Ansätze im Vergleich
| Cluster | Kernidee | Signatur-Kontrast | Beispiel-Repos | Relation |
|---|---|---|---|---|
| <label> | <LLM-Narrativ oder "needs_manual_read"> | <heuristische Unterscheidungs-Keywords> | <3 Top-Repos> | <anti-tunnel-marker> |

## Empfehlungs-Signale (Heuristik)
- highest_problem_fit_cluster: <cluster>
- constraint_clean_cluster: <cluster>
- anti_tunnel_alternative: <divergentester Cluster über Mindest-Fit>

## Nächster konkreter Schritt
→ <deterministisch abgeleitetes Intake-Kommando für Top-Repo aus empfohlenem Cluster>
```

### Ableitungsregeln

- "Problem (1 Satz)": erste Nicht-Leer-Zeile aus `description`, auf 200 Zeichen gekürzt.
- "Landscape auf einen Blick": direkte Zählungen aus `landscape.json`.
- "Ansätze im Vergleich": Top-3 Cluster nach Mitgliederzahl.
- "Signatur-Kontrast": pro Cluster die 3 Tokens, die überdurchschnittlich in diesem Cluster und unterdurchschnittlich in anderen vorkommen (einfacher Frequenz-Kontrast). Deterministisch.
- "Kernidee"-Spalte: im Heuristik-Modus `needs_manual_read`; mit LLM ein 3-Satz-Narrativ.
- "Empfehlungs-Signale": drei getrennte, reproduzierbare Signale. Der Brief setzt KEINE "deshalb nimm X"-Sprache. Entscheidung bleibt beim Nutzer.
- "Nächster konkreter Schritt": höchstbewertetes Repo aus dem empfohlenen Cluster. Wenn Empfehlungs-Signale auf unterschiedliche Cluster zeigen: zwei nächste Schritte, einer pro Signal, explizit markiert.

### Mit LLM (`--with-llm`)

- "Kernidee" wird gefüllt mit 3-Satz-Narrativ.
- Stärken/Schwächen als Zusatzspalten mit 2 Bullets pro Cluster, markiert als LLM-Zusammenfassung.
- Heuristische Felder bleiben unberührt als Quelle der Wahrheit.

## 8. Lebenszyklus, Boundary-Fälle, Grenzen

### Status-Maschine

```
active ─(problem:resolve)─▶ resolved
   │
   └─(problem:archive)────▶ archived
```

Standalone und projektgebunden starten gleich als `active`.

### Boundary-Fälle

| Fall | Verhalten |
|---|---|
| Problem ohne `hints.*`, `problem:explore` aufgerufen | Problem-Query-Familie wird leer, Discovery läuft nur auf Projekt-Queries, Run-Log `problem_query_family: empty(reason: no_seeds)`, Brief empfiehlt Anreicherung |
| Standalone-Problem, `problem:explore` aufgerufen | `project_fit` entfällt, Scoring = 100 % `problem_fit`, Constraint-Filter voll wirksam, projektübergreifende Watchlist steht nicht zur Verfügung |
| Zwei aktive Probleme im selben Projekt, dasselbe Repo als Treffer | Intake-Dossier wird normal im Projekt angelegt; Rückverweis-Zeile listet beide Problem-Slugs; Landscape-Runs pro Problem bleiben unabhängig |
| Problem-Slug-Kollision bei `problem:create` | Hard-Error, kein stilles Überschreiben. Nutzer gibt `--slug` explizit. |
| Discovery liefert 0 Kandidaten | Landscape-Run wird NICHT geschrieben. Problem bekommt `last_explore_result: no_candidates` und Hinweis, Query-Seeds zu prüfen. |
| `problem.md` von Hand editiert, `problem.json` nicht neu generiert | `problem:*`-Commands außer `list` und `refresh` erzwingen intern ein `refresh`. Out-of-sync unmöglich. |
| Projektbindung nicht mehr lesbar, aber projektgebundenes Problem vorhanden | `problem:list` markiert Problem mit `project_binding_missing`; `problem:explore` bricht mit klarer Meldung ab, empfiehlt `bootstrap` zu reparieren oder Problem manuell auf standalone zu konvertieren (Frontmatter `project` entfernen, Datei verschieben). |
| LLM aktiv, aber kein Provider konfiguriert | Hard-Error mit klarer Meldung, kein stiller Fallback. |

### Bewusst akzeptierte Grenzen (MVP)

- Clustering bleibt keyword-basiert. Semantisch ähnliche Repos mit unterschiedlicher Sprache werden fehlgruppiert. Langfrist-Hebel: mehr Kuration, nicht mehr Algorithmus.
- Diversitätsregel basiert auf Keyword-Jaccard. Bei sehr kleinen Kandidatenmengen kippt sie — Engine markiert `diversity_gap` explizit statt stillen Datensünden.
- Constraint-Parsing ist tag-basiert. Komplexe Constraints ("muss mit Firmennetz-Proxy funktionieren") werden als menschlich zu prüfender Punkt in den Brief aufgenommen, nicht automatisch evaluiert.
- Heuristik-Brief trifft keine Decision. Er strukturiert Signale, der Nutzer entscheidet.
- Landscape-Runs werden nicht automatisch bereinigt. Spätere `problem:prune <slug> --keep-last N`-Regel als Follow-up offen.

### Bewusste MVP-Auslassungen

- **`problem:reopen`**: ein resolved-Problem bleibt resolved. Wird es später erneut relevant, legt der Nutzer ein neues Problem an oder editiert `status` per Hand. Keine Command-Oberfläche dafür.
- **`problem:promote --to-project`**: Standalone-zu-Projekt-Promotion ist ein manueller Datei-Move plus Frontmatter-Edit. Kein eigenes Command.

## Offene Fragen

Dieses Design beantwortet die Struktur- und Verhaltensfragen. Offen für den Implementierungsplan:

- Konkrete Provider-Auswahl für den optionalen LLM-Pfad (wenn später aktiviert).
- Scoring-Gewichte und Thresholds (0.3 Jaccard-Divergenz, 0.35 Stufe-2-Cluster, 0.4 Mindest-problem-fit) müssen an echten Runs kalibriert werden.
- Synonym-Map-Seed-Inhalt für `lib/clustering/synonyms.json`.

## Bezug zu Pattern Pilots OPEN_QUESTION.md

- `OQ-005` (LLM-Augmentation-Grenze): wird durch Abschnitt 6 teilweise beantwortet. Die drei LLM-Regeln plus 100/100-Filter werden als verbindliches Designprinzip für den gesamten Pattern-Pilot-Kern etabliert, nicht nur für dieses Feature.
- `OQ-003` (Quality Filters for Discovery): Problem-`constraint_tags` erweitern die Discovery-Gate-Logik um eine problem-scopte Ebene.
