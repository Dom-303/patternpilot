# PROJECT_BINDING — eventbear-worker

## Zweck

Diese Datei beschreibt die operative Bindung zwischen `patternpilot` und `eventbear-worker`.

Sie beantwortet nicht nur, **fuer welches Projekt** gearbeitet wird, sondern auch, **welche Teile des Zielrepos dabei als Referenz zuerst gelesen werden sollen**.
Zusaetzlich verweist sie auf die Alignment-Regeln, mit denen Patternpilot externe Muster gegen die reale Zielarchitektur von EventBaer mappt.
Ab Stage 4 entstehen daraus ausserdem Promotion-Pakete, die kontrolliert in Landkarte, Learnings und Entscheidungen ueberfuehrt werden koennen.

---

## Referenz-Repo

- Pfad: `../eventbear-worker`
- Rolle: operativer Daten-Worker und Zielsystem fuer die von Patternpilot abgeleiteten Entscheidungen
- Leselogik: Patternpilot verankert keine harte Primaeroberflaeche, sondern liest fuer diesen Zielkontext zuerst die konfigurierten Leitdateien und Verzeichnisse
- Wenn `docs/` vorhanden und gepflegt ist, ist es ein schneller, hochwertiger Kontextlieferant, aber kein fest verdrahteter Produktbestandteil von Patternpilot

---

## Vor jedem tieferen Review zuerst lesen

- `AGENT_CONTEXT.md`
- `WORKER_CONTRACT.md`
- `WORKER_FLOW.md`
- `docs/SOURCE_MASTERLIST_POLICY.md`
- `docs/SOURCE_SYSTEMS_TARGET_ARCHITECTURE.md`
- `docs/EVIDENCE_ACQUISITION_LAYER_TARGET_ARCHITECTURE.md`
- `../patternpilot/docs/system/REPO_INTELLIGENCE_SYSTEM.md`

---

## Besonders relevante Verzeichnisse

- `docs/` als schnelle Kontextquelle fuer Architektur, Zielbild und Betriebslogik
- `lib/`
- `scripts/`
- `sources/`
- `templates/`

---

## Discovery-Hinweise fuer die GitHub-Suche

- `events`
- `calendar`
- `scraper`
- `connector`
- `venue`
- `location`
- `feed`
- `wordpress plugin`

---

## Fragen, die Patternpilot fuer EventBaer beantworten soll

- Welche Schicht im Worker wird durch das externe Repo beleuchtet?
- Staerkt der Fund Connector-Familien, Source-Systeme, Distribution oder Enrichment?
- Ist das fuer EventBaer eher `build_core`, `adapt_pattern`, `borrow_optional`, `observe_only` oder `avoid_as_core_dependency`?
- Welche Luecke oder Ausbauflaeche wird sichtbar?
- Welche konkrete Folgearbeit waere fuer `eventbear-worker` oder das spaetere Produktsystem sinnvoll?

---

## Guardrails

- EventBaer-Worker bleibt der operative Kern
- Patternpilot fuehrt keine stillen Scope-Erweiterungen im Worker ein
- Distribution-Ideen und Worker-Kern sauber trennen
- externe Scraper nie automatisch als Kernarchitektur missverstehen

---

## Alignment-Regeln

- Maschinenlesbare Alignment-Regeln: `ALIGNMENT_RULES.json`
- Zweck: externe Repos gegen reale Worker-Faehigkeiten, Spannungen und naechste Schritte mappen

---

## Promotion-Fluss

- Watchlist-Datei: `WATCHLIST.txt`
- Intake-Dossiers landen unter `intake/`
- Promotion-Pakete landen unter `promotions/`
- Erst der Promotion-Schritt darf kuratierte Artefakte wie `knowledge/repo_landkarte.csv`, `knowledge/repo_learnings.md` und `knowledge/repo_decisions.md` veraendern
