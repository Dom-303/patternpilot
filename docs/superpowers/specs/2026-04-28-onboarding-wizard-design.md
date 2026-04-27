# Onboarding Wizard — Design

- status: proposed
- created_at: 2026-04-28
- authors: domi + claude
- related_open_questions: OQ-006 (FIRST_RUN_ONBOARDING_AND_PROJECT_SETUP_FLOW)
- replaces: heutiges `getting-started` (reiner Text-Print) im interaktiven Modus

## Zweck

Patternpilot hat heute eine klare Doku und einzelne Setup-Bausteine (`bootstrap`, `init-env`, `setup-checklist`, `init-project`, `doctor`), aber keinen geführten Erststart. `npm run getting-started` druckt nur die Schritte als Text. Neue Nutzer müssen die Bausteine selbst verketten und kennen Begriffe wie „Binding", „Watchlist", „Discovery-Profil" beim ersten Aufruf noch nicht.

Dieses Design ergänzt einen interaktiven Wizard, der genau einen Aufruf braucht (`patternpilot init`), in 60–90 Sekunden ein lauffähiges Setup erzeugt und dem Nutzer am Ende einen konkreten nächsten Befehl in die Hand gibt. Der Wizard erhebt keinen Anspruch, neue Patternpilot-Funktionalität zu erfinden — er verkettet bestehende Bausteine mit guter Auto-Detection und freundlicher Führung.

OQ-006 stand bisher auf SPÄTER mit der Begründung „erst nach Kernel-Härtung". Per [V1_STATUS.md](../../foundation/V1_STATUS.md) ist der Kern jetzt stabil. Damit ist die ursprüngliche Wartebegründung erfüllt.

## Leitprinzipien

1. **Auto-detect zuerst, fragen zweitens.** Was Patternpilot aus dem Dateisystem, env-Vars oder gh-CLI ablesen kann, wird nicht erfragt — nur bestätigt.
2. **Auto-Guesses sichtbar als vorlaeufig markieren.** Jede Detektion zeigt ihre Quelle und ist editierbar. Der Wizard tut nicht so, als wisse er Dinge, die er nur vermutet (konsistent mit AGENT_CONTEXT.md).
3. **Eine Frage pro Schritt.** Keine Multi-Frage-Bildschirme. Defaults sind so gewählt, dass `Enter` durchgängig der richtige Knopf ist.
4. **Keine Sackgassen.** Jeder Schritt hat einen Skip- oder Zurück-Pfad. Fehler haben Diagnose plus mindestens zwei Aktionen.
5. **Cross-platform ohne Sonderwege.** Der Wizard läuft auf macOS, Linux und Windows (inkl. WSL) mit identischem Verhalten. Keine shellspezifischen Aufrufe, Pfade über `path.*`. Respektiert `NO_COLOR`-Env (kein ANSI-Output, ASCII-Fallback für Box-Drawing-Zeichen).
6. **Kern bleibt skriptbar.** In Nicht-TTY-Umgebungen (CI, Docker, `> log.txt`) fällt der Befehl auf den heutigen Text-Print zurück. Eine Logik, ein Befehl, beide Welten bedient.
7. **Token-Speicher außerhalb der Repo-Wurzel.** Token landet in `~/.config/patternpilot/.env` (Linux/macOS) bzw. `%APPDATA%\patternpilot\.env` (Windows), nicht im Projektordner. Überlebt Re-Installs und Worktrees.

## 1. Architektur und Eintritt

### Befehlsoberfläche

| Befehl | Verhalten |
|---|---|
| `patternpilot init` | Hauptaufruf. Interaktiv im TTY, Text-Print im Nicht-TTY. |
| `patternpilot init --reconfigure` | Erzwingt Re-Run-Menü auch bei einem einzelnen Projekt. |
| `patternpilot init --print` | Erzwingt Text-Print auch im TTY (für Doku-Generierung, Screenshots). |
| `patternpilot getting-started` | Alias auf `patternpilot init`. Bestehende Doku-Verweise bleiben gültig. |
| `npm run getting-started` | Alias auf `patternpilot init`. |

### Auto-Trigger

Beim ersten Aufruf eines beliebigen Patternpilot-Befehls ohne vorhandene Config zeigt der Bin-Entry:

```
Patternpilot ist noch nicht eingerichtet. Setup jetzt starten? [Y/n]
```

`Y` (Default) → fließt in den Wizard. `n` → der ursprünglich aufgerufene Befehl bricht mit der heutigen Fehlermeldung ab.

### Modus-Detektion

Pseudo-Logik beim Start:

```
isInteractive = process.stdin.isTTY && process.stdout.isTTY

if (--reconfigure && !isInteractive)
   → fail: "--reconfigure erfordert ein interaktives Terminal" (Exit 2)

mode = (--print) ? "print"
     : (!isInteractive) ? "print"
     : "wizard"
```

Im Print-Modus wird der bisherige `runGettingStarted`-Output in [scripts/commands/project-admin/core.mjs](../../../scripts/commands/project-admin/core.mjs) unverändert ausgegeben. Der Wizard ist eine reine Erweiterung, keine Entfernung.

„Ohne vorhandene Config" für den Auto-Trigger heißt konkret: `patternpilot.config.json` fehlt **oder** `projects` ist leeres Objekt. Eine vorhandene Datei mit ≥ 1 Projekt zählt als eingerichtet.

## 2. Re-Run-Menü

Liegt bereits eine Config mit ≥ 1 Projekt vor (und `--reconfigure` ist nicht gesetzt), ist das erste Bild ein Aktionsmenü statt eines neuen Setups:

```
Patternpilot ist bereits eingerichtet.

  Konfigurierte Projekte:
    - eventbear-worker  (Default)
    - pinflow

  Was möchtest du tun?
    [A] Neues Projekt hinzufügen
    [E] Existierendes Projekt editieren
    [T] GitHub-Token erneuern oder ändern
    [D] Default-Projekt wechseln
    [Z] Zurück (nichts ändern)
```

| Auswahl | Wirkung |
|---|---|
| A | Springt in Step 1, behält Token + Discovery-Default. |
| E | Auswahl-Liste der Projekte, dann Step 2 für das gewählte Projekt. |
| T | Springt in Step 3, lässt Projekte unangetastet. |
| D | Einfache Auswahl, keine weiteren Schritte. |
| Z | Beendet ohne Änderung mit Hinweis auf nächste Befehle. |

## 3. Erst-Setup — fünf Schritte

### Step 1/5 — Zielprojekt

**Auto-Detection.** Scan in dieser Reihenfolge:

1. Argument `--target <pfad>` (falls angegeben)
2. `..` relativ zum aktuellen Working-Dir
3. `~/dev/`, `~/projects/`, `~/code/`, `~/src/` (existierend, max. zwei Ebenen)

Für jeden Treffer prüfen: ist `.git/` vorhanden, gibt es eine `README.md` oder `package.json`. Top 3 nach Mtime.

**Bildschirm.**

```
[1/5] Welches Repo soll Patternpilot analysieren?

  > ../eventbear-worker      (zuletzt geändert: heute)
    ../pinflow               (zuletzt geändert: vor 2 Tagen)
    ../patternpilot-test     (zuletzt geändert: vor 3 Wochen)
    Anderen Pfad eingeben…
```

**Eingabe „Anderen Pfad".** Akzeptiert absolute und relative Pfade, validiert die Existenz und das Vorhandensein von `.git/` (Warnung, kein Hard-Reject — ein Repo ohne Git ist erlaubt, nur eingeschränkt nutzbar).

**Edge-Cases.**

- 0 Treffer in der Auto-Scan-Phase: Liste entfällt, Bildschirm zeigt nur „Anderen Pfad eingeben…" als einzige Option mit erklärendem Satz darüber.
- Pfad-Scan erreicht das Tiefen-Limit (max. zwei Ebenen) oder Zeit-Limit (max. 3s): unauffällig abbrechen, was bisher gefunden wurde anbieten.
- Mehr als drei Treffer: Top 3 nach Mtime + zusätzliche Option „Weitere anzeigen…" als vierten Listenpunkt.

**Speichert.** `<absoluter-pfad>` im Wizard-State, noch nicht in der Config.

### Step 2/5 — Kontext bestätigen

**Auto-Detection** aus dem gewählten Pfad:

| Feld | Quelle | Fallback |
|---|---|---|
| Label | `package.json#name`, sonst Verzeichnisname | Verzeichnisname Title-Case |
| Sprache | `package.json#type`, vorhandene `*.py`/`go.mod`/`Cargo.toml` | „unbekannt" |
| Domäne-Hinweis | Top-3 Wörter aus README-H1 + ersten 200 Zeichen (Stoppwort-gefiltert) | leer |
| Context-Files | `CLAUDE.md`, `AGENT_CONTEXT.md`, `AGENTS.md`, `README.md`, `docs/` | Pflicht: README.md |
| Watchlist-Seed | `package.json#dependencies` ∩ erkannte GitHub-Pakete | leer |

**Watchlist-Seed-Heuristik.** Für jede Dependency wird `https://registry.npmjs.org/<pkg>` abgefragt (cachebar in `state/wizard-cache/npm-registry/`) und das `repository.url`-Feld extrahiert. Nur Pakete mit `github.com`-URL kommen in den Vorschlag. Top 5 nach Verwendungs-Häufigkeit (`dependencies` höher gewichtet als `devDependencies`).

**Network-Verhalten.** Step 2 läuft vor der GitHub-Auth-Entscheidung, darf den Wizard aber nicht blockieren:

- Pro Request 2s Timeout, gesamter Detektor max. 8s
- Bei Offline / Timeout: Watchlist-Seed-Zeile zeigt `(übersprungen — kein Netz)`, alle anderen Felder funktionieren weiter
- Cache-Treffer überspringen den Network-Call und funktionieren auch offline

**Bildschirm.**

```
[2/5] Erkannter Projekt-Kontext (bitte bestätigen):

  Label:           "EventBaer Worker"          ← package.json#name
  Sprache:         Node.js (ESM)
  Domäne-Hinweis:  events / scraping            ← README + Dateinamen
  Context-Files:   CLAUDE.md, AGENT_CONTEXT.md, docs/
  Watchlist-Seed:  3 Repos aus dependencies erkannt
                   (puppeteer, cheerio, ical-generator)

  [Y] passt   [E] anpassen
```

**`[E] anpassen`.** Öffnet ein Sub-Menü mit Edit-Optionen pro Feld. Felder einzeln ansprechbar, Watchlist-Seed mit Checkboxen (welche Repos wirklich rein, welche nicht).

### Step 3/5 — GitHub-Zugang

**Pre-flight.** Vor dem Dialog scannt der Wizard in dieser Reihenfolge:

1. `gh auth status` — falls authentifiziert, Token via `gh auth token` abgreifen
2. `$GITHUB_TOKEN` / `$GH_TOKEN` Umgebungsvariablen
3. `~/.config/patternpilot/.env` (existierender Wizard-Token)

Wird etwas gefunden, wird der Dialog übersprungen und das Ergebnis nur bestätigt:

```
GitHub-Zugang gefunden:
  ✓ gh CLI authentifiziert als @dom-303 (Source: gh auth)

  [Enter] übernehmen   [M] manuell anderen Token eingeben
```

**Wenn nichts gefunden** — Hauptdialog:

```
[3/5] GitHub-Zugang einrichten

  gh CLI ist der empfohlene Weg (sicherer, OS-Keychain).
  Personal Access Token funktioniert genauso, ist aber manueller.

    [G] gh CLI verwenden          empfohlen
    [P] Personal Access Token     funktioniert auch gut
    [S] Überspringen              läuft offline weiter
```

#### Pfad G — gh CLI

Prüft `which gh` / `where gh`. Ist gh installiert: der Wizard übergibt vollständig an gh's eigenen interaktiven Login-Flow (`gh auth login` als Subprozess mit verbundenem stdio), wartet auf Exit, und prüft danach `gh auth status`. Bei Erfolg → Token via `gh auth token` abgreifen und in `~/.config/patternpilot/.env` spiegeln (damit Patternpilot nicht bei jedem Aufruf gh auf den PATH braucht). Ist gh nicht installiert:

```
gh ist nicht installiert. Eine Zeile reicht:

    macOS:     brew install gh
    Linux:     sudo apt install gh    (oder dnf/pacman/yay)
    Windows:   winget install GitHub.cli

  [Enter] wenn fertig    [P] Doch lieber Token-Pfad nehmen    [S] Überspringen
```

#### Pfad P — Personal Access Token

Vier Mikro-Schritte mit `Enter`-Quittung:

**Schritt 1/4 — Browser öffnen.**

```
Schritt 1 von 4 — Browser öffnen
─────────────────────────────────

Ich öffne gleich eine GitHub-Seite. Die richtigen Berechtigungen
sind dort schon vorausgewählt — du musst nur eingeloggt sein.

  Link:  https://github.com/settings/tokens/new
         ?scopes=public_repo,read:user
         &description=Patternpilot

  [Enter] Im Browser öffnen
  [C]     Nur Link kopieren (ich öffne selbst)
  [Z]     Zurück
```

Browser-Open via plattformspezifisch: `open` (macOS), `xdg-open` (Linux), `start` (Windows). Fehler beim Öffnen → automatisch zu `[C]` Link kopieren.

**Schritt 2/4 — Token konfigurieren.**

```
Schritt 2 von 4 — Token konfigurieren
─────────────────────────────────────

Auf der GitHub-Seite siehst du ein Formular. Bitte prüfe:

  Note:        "Patternpilot"           ← schon ausgefüllt
  Expiration:  "90 days"                ← empfohlen, kannst du ändern
  Select scopes:
     [x] public_repo                    ← schon angehakt
     [x] read:user                      ← schon angehakt
     ↑ bitte NICHTS weiter ankreuzen

  Ganz unten: grüner Button "Generate token" — drück ihn.

  [Enter] Habe den Button gedrückt
```

**Schritt 3/4 — Token kopieren.**

```
Schritt 3 von 4 — Token kopieren
─────────────────────────────────

⚠  WICHTIG: GitHub zeigt dir den Token nur EIN EINZIGES MAL.
    Verlässt du die Seite, ist er weg und du musst neu erstellen.

Du siehst jetzt einen grünen Kasten mit einem langen Text,
der mit "ghp_" beginnt. Daneben ein kleines Kopier-Symbol  ⧉

  → Klick auf das Symbol  (oder markieren + Strg+C)

  [Enter] Token ist in der Zwischenablage
```

**Schritt 4/4 — Token einfügen und validieren.**

```
Schritt 4 von 4 — Token einfügen
─────────────────────────────────

Hier einfügen mit Strg+V, dann Enter:

> █

  Prüfe…
  ✓ Format korrekt
  ✓ Authentifiziert als @dom-303
  ✓ Rate Limit: 5000 Requests/Stunde
  ✓ Scopes passen: public_repo, read:user

  Gespeichert: ~/.config/patternpilot/.env
  Du kannst diesen Token jederzeit auf
  https://github.com/settings/tokens widerrufen.
```

Token-Eingabe ist masked (Sterne statt Zeichen). Validierung über `GET https://api.github.com/user`. Bei Fehler:

```
  ✗ Token wurde abgelehnt (HTTP <code>).
    Mögliche Ursachen:
      - Token wurde gelöscht oder ist abgelaufen
      - Token wurde unvollständig eingefügt (zu kurz)
      - Token ist für GitHub Enterprise, nicht github.com

  [E] Erneut eingeben   [N] Doch neuen erstellen   [S] Überspringen
```

#### Pfad S — Überspringen

```
Patternpilot startet im Offline-Modus.

  Funktioniert ohne Token:
    ✓ Lokale Repos lesen, bewerten, dokumentieren
    ✓ Bestehende Watchlist und Intake-Daten verarbeiten
    ✓ HTML-Reports rendern

  Funktioniert NICHT ohne Token:
    ✗ Discovery (GitHub-Suche nach neuen Repos)
    ✗ Intake neuer URLs (Metadaten-Fetch fehlt)
    ✗ Watchlist-Sync (Stars/Activity nicht aktualisierbar)

  Token später nachreichen mit:
    patternpilot init --reconfigure
```

### Step 4/5 — Discovery-Profil

Bewusst auf zwei Optionen reduziert. `expansive` und `max` bleiben in der Config aktivierbar, gehören aber nicht in den Erststart.

```
[4/5] Wie breit soll Discovery suchen?

  > balanced   empfohlen — solide Treffer, wenig Rauschen
    focused    eng am Projekt — weniger, aber sehr passende Treffer

  (expansive/max kannst du später in der Config aktivieren)
```

Wurde Step 3 mit `[S]` übersprungen, ist dieser Schritt deaktiviert mit Hinweis: „Discovery braucht einen GitHub-Token. Default `balanced` wird gespeichert und greift sobald du den Token nachreichst."

### Step 5/5 — Erste Aktion

```
[5/5] Gleich loslegen?

  > Nichts (Setup speichern und beenden)
    intake    — eine bekannte Repo-URL einlesen
    discover  — automatisch passende Repos im GitHub-Universum suchen
    problem   — eine konkrete Frage formulieren und dazu eine Repo-Landschaft erzeugen
```

| Auswahl | Folge-Verhalten |
|---|---|
| Nichts | Wizard endet mit Abschluss-Bildschirm. |
| intake | Fragt nach einer URL, ruft dann `runIntake` mit dem konfigurierten Projekt auf. |
| discover | Ruft `runDiscover` mit balanced/focused-Profil auf. Erfordert Token. |
| problem | Fragt nach „Welche Frage willst du beantworten?" in einem Satz, ruft `runProblemCreate` + `runProblemExplore` hintereinander auf, öffnet am Ende `landscape.html` im Browser. |

`intake` und `discover` ohne Token → Hinweis und Skip auf „Nichts".

### Abschluss-Bildschirm

```
✓ Setup gespeichert
  - bindings/eventbear-worker/         angelegt
  - projects/eventbear-worker/         angelegt
  - patternpilot.config.json           aktualisiert
  - ~/.config/patternpilot/.env        Token gespeichert

Nächster Befehl:
    patternpilot intake <url> --project eventbear-worker

Hilfe jederzeit:
    patternpilot init --reconfigure
    patternpilot --help
```

Bei `[S]` in Step 3 entfällt die Token-Zeile und der Hilfe-Block enthält zusätzlich `patternpilot init --reconfigure  # Token nachreichen`.

## 4. Datenfluss und Persistenz

### Was wird geschrieben

| Pfad | Wann | Format |
|---|---|---|
| `patternpilot.config.json` | nach Step 5, auch bei Abbruch nach Step 2 | bestehender Config-Schreibpfad (`saveConfig`) |
| `bindings/<project>/PROJECT_BINDING.json` | nach Step 2 | bestehender `runBootstrap`-Pfad |
| `bindings/<project>/PROJECT_BINDING.md` | nach Step 2 | bestehender `runBootstrap`-Pfad |
| `bindings/<project>/WATCHLIST.txt` | nach Step 2, falls Watchlist-Seed bestätigt | eine URL pro Zeile |
| `projects/<project>/PROJECT_CONTEXT.md` | nach Step 2 | bestehender `runBootstrap`-Pfad |
| `~/.config/patternpilot/.env` | nach Step 3 (Pfad G/P) | `GITHUB_TOKEN=ghp_…` |
| `state/wizard-history.json` | nach jedem Step | Audit-Spur (Schritte, Entscheidungen, Zeitstempel) |

### `wizard-history.json`

Schlanke Audit-Datei für Re-Run-Diagnose. Schema:

```json
{
  "runs": [
    {
      "started_at": "2026-04-28T19:42:11Z",
      "completed_at": "2026-04-28T19:43:48Z",
      "outcome": "completed",
      "steps": [
        { "name": "target", "value": "../eventbear-worker", "source": "auto-scan-1" },
        { "name": "context", "edits": ["label"] },
        { "name": "github", "path": "G", "user": "@dom-303" },
        { "name": "discovery", "value": "balanced" },
        { "name": "first-action", "value": "intake" }
      ]
    }
  ]
}
```

Ermöglicht später: „Wieso ist Projekt X auf focused konfiguriert?" → ein Lookup statt Spurensuche.

## 5. Implementierungs-Schnitt

### Neue Dateien

| Datei | Verantwortung |
|---|---|
| `lib/wizard/index.mjs` | Einstiegspunkt, Modus-Detektion, Step-Orchestrierung |
| `lib/wizard/steps/target.mjs` | Step 1 inkl. Auto-Scan-Logik |
| `lib/wizard/steps/context.mjs` | Step 2 inkl. Detektoren |
| `lib/wizard/steps/github.mjs` | Step 3 inkl. gh-Integration und PAT-Pfad |
| `lib/wizard/steps/discovery.mjs` | Step 4 |
| `lib/wizard/steps/first-action.mjs` | Step 5 |
| `lib/wizard/rerun-menu.mjs` | Re-Run-Aktionsmenü |
| `lib/wizard/prompt.mjs` | Plattformneutraler Prompt-Wrapper (Read-Line, Auswahl, Masked-Input) |
| `lib/wizard/detect/target-scan.mjs` | Pfad-Scanner für Step 1 |
| `lib/wizard/detect/project-context.mjs` | Detektoren für Step 2 |
| `lib/wizard/detect/github-auth.mjs` | gh/env/.env-Pre-flight für Step 3 |
| `lib/wizard/detect/npm-watchlist-seed.mjs` | dependencies → GitHub-Repos |
| `lib/wizard/state.mjs` | Wizard-State + history.json |

### Geänderte Dateien

| Datei | Änderung |
|---|---|
| `scripts/patternpilot.mjs` | `init`-Command + Auto-Trigger im Bin-Entry |
| `scripts/shared/command-registry.mjs` | `init` registrieren, `getting-started` als Alias |
| `scripts/commands/project-admin/core.mjs` | `runGettingStarted` bleibt für Print-Modus, neuer `runInit`-Wrapper delegiert |

### Bewusst nicht angefasst

- `runBootstrap`, `runIntake`, `runDiscover`, `runProblemCreate`, `runProblemExplore` bleiben unverändert. Der Wizard ruft sie auf, ändert sie nicht.
- Heutiger Text-Print bleibt erhalten und bleibt der Print-Modus.
- Die HTML-Report-Templates sind eingefroren — nichts daran wird angefasst (konsistent mit AGENT_CONTEXT.md).

## 6. Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Nicht-TTY (CI, Pipe) | Fällt automatisch auf Text-Print zurück, Exit-Code 0 |
| Strg+C in beliebigem Step | Wizard schreibt `outcome: "cancelled"` in history, Exit-Code 130, kein Schaden an bestehender Config |
| Token-Validation 401 | Diagnose-Bildschirm mit drei Aktionen (siehe Step 3, Pfad P) |
| Token-Validation Network-Fehler | „Konnte GitHub nicht erreichen. Token wurde noch nicht gespeichert. [R] Wiederholen [S] Überspringen [Z] Zurück" |
| `gh auth login` schlägt fehl | „gh-Anmeldung wurde abgebrochen oder ist fehlgeschlagen. [R] Wiederholen [P] Doch Token-Pfad [S] Überspringen" |
| Existierende `bindings/<project>/` bei „neues Projekt hinzufügen" mit gleichem Namen | „Ein Projekt mit diesem Namen existiert bereits. [O] Anderen Namen wählen [E] Existierendes editieren [Z] Zurück" |
| Pfad in Step 1 existiert nicht | „Pfad nicht gefunden. [E] Erneut eingeben [Z] Zurück" |
| Pfad ohne `.git/` | Warnung, aber erlaubt: „Kein Git-Repo erkannt. Patternpilot funktioniert trotzdem, manche Detektoren arbeiten weniger genau. [Y] Weitermachen [E] Anderen Pfad [Z] Zurück" |

## 7. Was bewusst NICHT in v1 ist

| Verworfen | Grund |
|---|---|
| Fine-grained PAT statt Classic | UX deutlich komplizierter (Repo-Auswahl im Browser), Mehrwert für Patternpilot-Lese-Zugriff gering |
| Token im OS-Keychain | Implementierung pro Plattform unterschiedlich, `.env` ist standard und genug für den lokalen Einsatzfall |
| Mehrere Projekte gleichzeitig im Erst-Setup anlegen | Kognitive Last beim Erststart zu hoch, „Neues Projekt hinzufügen" im Re-Run-Menü reicht |
| LLM-gestützte Domänen-Erkennung in Step 2 | Heuristik-First (konsistent mit Operating-Model). LLM kommt frühestens nach OQ-005-Klärung. |
| Validierung der Watchlist-Seed-Repos vor dem Schreiben | Watchlist ist eine Vorschlagsliste, kein Vertrag. Ungültige Einträge werden beim ersten `sync:watchlist` gefiltert. |
| Auto-Update der bestehenden 14 Validation-Cohort-Workspaces | Nicht Wizard-Scope, ist Test-Infrastruktur. |

## 8. Migration und Backward-Compat

- `npm run getting-started` und `patternpilot getting-started` bleiben funktional. Sie zeigen im TTY den Wizard, im Nicht-TTY den heutigen Print.
- Bestehende Configs werden vom Wizard nicht überschrieben — der zweite Lauf ist immer das Re-Run-Menü.
- Doku-Verweise (README, SIMPLE_GUIDE, GETTING_STARTED) müssen nicht alle gleichzeitig aktualisiert werden. Ein Doku-Refresh-Pass kommt im Implementierungsplan als eigener Schritt.

## 9. Test-Konzept

| Ebene | Form |
|---|---|
| Unit | Jeder Detektor in `lib/wizard/detect/` testbar mit Fixture-Verzeichnissen unter `test/fixtures/wizard/` |
| Integration | Wizard-Run gegen einen temporären `tmp/wizard-test/`-Workspace, Eingaben über `--replay <file>` (siehe unten) |
| Cross-Platform | CI-Matrix für macOS, Linux, Windows mit identischen Replay-Files, Vergleich der erzeugten Config-Dateien |
| Regression | Print-Modus-Output (`patternpilot init --print`) gegen Snapshot — schützt heutigen `getting-started`-Vertrag |

### `--replay <file>` für Tests

Ohne dieses Flag wären Integrations-Tests gegen einen interaktiven Wizard nicht reproduzierbar. Replay-File ist eine YAML-Antwort-Sequenz:

```yaml
# test/fixtures/wizard/scenario-fresh-with-gh.yaml
target: "../eventbear-worker"
context: accept
github:
  path: G                  # gh CLI
  gh_already_authed: true
discovery: balanced
first_action: nothing
```

Der Wizard liest pro Step den passenden Schlüssel und würde bei fehlendem Schlüssel mit Exit 3 abbrechen („Replay unvollständig: kein Wert für Step <name>"). Replay-Modus ist ausschließlich für Tests gedacht und nicht in der Doku beworben.

## 10. Erfolgs-Kriterien

Ein Erst-Setup auf einem frischen Workspace mit einem fremden Zielprojekt soll erfüllen:

1. ≤ 90 Sekunden vom Aufruf bis zum Abschluss-Bildschirm bei „Enter durchklicken".
2. Kein Schritt erfordert das Verlassen des Terminals außer Browser für Token-Erstellung.
3. Am Ende ist mindestens ein lauffähiger Folgebefehl in der Hand des Nutzers.
4. Re-Run nach erfolgreichem Erst-Setup landet im Aktionsmenü, nicht in einer neuen Setup-Schleife.
5. Nicht-TTY-Aufruf in CI bricht nicht und liefert denselben Print wie heute.

## Offene Punkte für die Plan-Phase

- Welche genaue Reihenfolge bekommen die Detektor-Pfade in Step 1 (User-Home zuerst oder relativ zum CWD zuerst)?
- Soll `wizard-history.json` rotiert werden (z. B. nach 50 Einträgen)?
- Wie wird der Browser-Open-Befehl in WSL2 gehandhabt (`wslview` falls vorhanden)?

Diese Fragen blockieren das Design nicht — sie werden im Implementierungsplan adressiert.
