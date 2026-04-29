# Wizard Phase 2 — Design (Addendum)

- status: proposed
- created_at: 2026-04-29
- authors: domi + claude
- supersedes_gap_in: docs/superpowers/specs/2026-04-28-onboarding-wizard-design.md (sections 4 + step dispatch)
- related_issues: critical review identified 11 gaps post-merge

## Zweck

Der ausgelieferte Wizard (PR #1, commit `8bdcac7`) ist *technisch* fertig (alle Tests grün, alle Step-UIs implementiert), erfüllt aber seinen Produktzweck nicht: er erzeugt **kein lauffähiges Setup**. Konkret werden weder `patternpilot.config.json` noch `bindings/<project>/*` noch `projects/<project>/*` geschrieben. Step 5 und das Re-Run-Menü speichern die Wahl nur in der History, ohne die zugehörigen Aktionen auszuführen.

Diese Phase 2 schließt diese Integrations-Lücken und glättet zusätzlich sechs kleine Polish-Items, die beim Real-Use auffallen würden.

## Scope

### Paket A — Integration (Pflicht)

- A1: Step 2 ruft `initializeProjectBinding` auf → erzeugt config + bindings + projects
- A2: Bestätigte Watchlist-Seed-URLs werden in `bindings/<project>/WATCHLIST.txt` angehängt
- A3: Step 5 dispatcht echt (`runIntake` / `runDiscover` / `runProblemCreate` + `runProblemExplore`)
- A4: Re-Run-Menü dispatcht echt (add-project / reauth / set-default)
- A5: End-to-End-Integration-Test, der das Versprechen wirklich prüft

### Paket B — Polish

- B1: Ctrl+D-Handler im Prompter (rejected pending resolvers bei stdin-close)
- B2: Prompter pausieren während `gh auth login`-Subprozess läuft
- B3: WSL2-Browser-Open via `wslview` als zusätzlichen Fallback
- B4: `[Enter]`-Key-Display kosmetisch klären (nicht als Key-Name framen)
- B5: Doppeltes `> ` im Choose-Output entfernen
- B6: Token-File mode `0o600` auch beim Überschreiben erzwingen

### Bewusst NICHT in dieser Phase

- Re-Run **edit-project**: Selten genutzt, eigene Iteration wert
- Watchlist-Seed-Validation gegen GitHub-API (heute nur lokale Filterung)
- Cockpit-Night-Report-UI (OQ-001 — eigener Release v0.4)
- Discovery-Policy-Audits (OQ-003 — Daten-Tuning, kein Code)

## Leitprinzipien

1. **Keine API-Änderungen an existierenden Run-Funktionen.** Wizard ruft sie mit Standard-Optionen auf.
2. **Project-Key-Derivation** aus Label/Verzeichnisname konsistent mit `initializeProjectBinding`-Logik (`slugifyProjectKey`).
3. **Bei Wizard-Abbruch nach Step 2** soll das Projekt schon angelegt sein — der User hat dann zumindest ein lauffähiges Setup, auch wenn er Step 3-5 nicht beendet.
4. **Integration-Test prüft Real-Outcome**: nach Wizard-Lauf muss `runIntake` ohne „No project configured"-Fehler durchlaufen.
5. **Re-Run-Aktionen müssen idempotent sein**: kein Datenverlust bei mehrfachem Aufruf.

## Datenfluss-Änderungen

Nach Phase 2 schreibt der Wizard zusätzlich:

| Pfad | Wann | Quelle |
|---|---|---|
| `patternpilot.config.json` (oder `.local.json`) | Step 2 Abschluss | `initializeProjectBinding` → `writeConfig` |
| `bindings/<project>/PROJECT_BINDING.{json,md}` | Step 2 Abschluss | `initializeProjectBinding` |
| `bindings/<project>/ALIGNMENT_RULES.json` | Step 2 Abschluss | `initializeProjectBinding` |
| `bindings/<project>/DISCOVERY_POLICY.json` | Step 2 Abschluss | `initializeProjectBinding` |
| `bindings/<project>/WATCHLIST.txt` | Step 2 Abschluss + ggf. Append | `initializeProjectBinding` + Wizard |
| `projects/<project>/PROJECT_CONTEXT.md` | Step 2 Abschluss | `initializeProjectBinding` |
| `projects/<project>/{intake,promotions,reviews,reports}/README.md` | Step 2 Abschluss | `initializeProjectBinding` |
| Intake-Dossiers / Discovery-Runs / Landscape | Step 5 (falls nicht „nothing") | Bestehende Funktionen |

Nicht-Änderungen:

- `~/.config/patternpilot/.env` — wie gehabt
- `state/wizard-history.json` — wie gehabt

## Erfolgs-Kriterien

1. Nach `patternpilot init` (TTY, Default-Antworten) läuft `patternpilot intake <url>` ohne Fehler.
2. Nach `patternpilot init` mit Step 5 = „intake" ist die URL wirklich in der Queue + Intake-Dossier vorhanden.
3. Re-Run-Menü „set-default" wechselt den Default tatsächlich (nicht nur in History).
4. Re-Run-Menü „reauth" überschreibt den Token tatsächlich (nicht nur in History).
5. Wizard-Phase-2-Integrationstest bestätigt 1-4 ohne TTY (via Replay).
6. Existierende Suite bleibt 100% grün.

## Offene Punkte für die Plan-Phase

- Project-Key bei „accept" aus Label slugifizieren — was wenn Label Sonderzeichen enthält? → vorhandene `slugifyProjectKey` verwenden.
- Re-Run „add-project" — neuer voller Wizard-Lauf oder nur ab Step 2? → entscheide für vollen Lauf (Token-Detect kann sich seit dem ersten Setup verändert haben).
- Re-Run „reauth" — nur Step 3 isoliert oder mit Discovery-Profil? → nur Step 3, Discovery bleibt unverändert.
