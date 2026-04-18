# Phase 4 Validation Closeout

## Kurzfassung

Phase 4 ist abgeschlossen.

`patternpilot` wurde in einer kontrollierten Fremdprojekt-Welle gegen `14` oeffentliche Repos aus drei Repo-Familien geprueft:

- AI / LLM / Evaluation
- Workflow / Automation / Orchestration
- Platforms / Product Backends

Der Referenzlauf am `2026-04-18` lief ueber den neuen Produkt-Command:

```bash
npm run validate:cohort
```

Referenz-Run:

- run_id: `2026-04-18T14-56-52-625Z`
- artefakte: `runs/validation-cohort/2026-04-18T14-56-52-625Z/`

## Ergebnis

- repos_validated: `14`
- passed: `0`
- passed_with_followups: `14`
- needs_fix: `0`
- failed: `0`
- fixes_needed: `0`

## Was diese Welle gezeigt hat

- Bootstrap lief ueber die ganze Kohorte stabil.
- Watchlist-Sync erzeugte ueber die ganze Kohorte brauchbare Intake-Dossiers.
- Review blieb ueber die ganze Kohorte lesbar und nutzbar.
- `product-readiness` blieb in frischen Workspaces bewusst konservativ auf `baseline_required`, aber mit klarer Folgeaktion.
- Es blieb kein diffuser Kernbruch mehr uebrig.

## Wichtiger Fix aus dieser Welle

Die Kohorte hat einen echten Produktbruch sichtbar gemacht:

- GitHub-API-Redirects bei repo-bezogenen API-Calls wurden nicht gefolgt.
- Das fiel konkret bei `calcom/cal.com` als `GitHub API 301: Moved Permanently` auf.

Dieser Bug wurde in Phase 4 direkt geschlossen:

- Redirect-Follow in [lib/github/api-client.mjs](../../lib/github/api-client.mjs)
- Regressionstest in [test/github-api-client.test.mjs](../../test/github-api-client.test.mjs)

Nach dem Fix lief die volle 14er-Kohorte ohne offene `needs_fix`- oder `failed`-Repos durch.

## Wie das Ergebnis zu lesen ist

Die `passed_with_followups`-Bewertung ist hier bewusst kein Fehlersignal.
Sie bedeutet:

- Der Kernpfad blieb stabil.
- Die Repo-Typen waren verarbeitbar.
- In einem frisch erzeugten Validierungs-Workspace erwartet `patternpilot` danach noch einen bewusst gesetzten Baseline-Run.

Das ist aktuell eine konservative, aber verstaendliche Produktlogik und keine strukturelle Kernkrise.

## Konsequenz fuer den Abschlussplan

- Phase 4 gilt als erledigt.
- Der naechste Block ist Phase 5: finaler Kern-Closeout.
- Offene Arbeit ist jetzt bewusste Schlussarbeit, nicht mehr breite Kernsuche.
