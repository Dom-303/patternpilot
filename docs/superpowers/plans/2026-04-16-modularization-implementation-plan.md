# Patternpilot Modularization Status

- date: 2026-04-16
- author: Codex
- status: current
- related: [AGENT_CONTEXT.md](../../../AGENT_CONTEXT.md), [CLAUDE.md](../../../CLAUDE.md), [scripts/commands/project-admin.mjs](../../../scripts/commands/project-admin.mjs), [lib/github-installations.mjs](../../../lib/github-installations.mjs), [lib/github-webhook-service.mjs](../../../lib/github-webhook-service.mjs), [lib/github.mjs](../../../lib/github.mjs), [lib/project.mjs](../../../lib/project.mjs)

## Purpose

Dieses Dokument ist kein offener Umbau-Backlog mehr, sondern der gepflegte Ist-Stand nach der Modularisierung vom 2026-04-16.

Es haelt fest:

- welche grossen Splits bereits umgesetzt wurden
- welche Dateien aktiv auf der Beobachtungsliste bleiben
- welche Bereiche bewusst vorerst unangetastet bleiben

## Working Rule

Fuer weitere Strukturarbeit gilt weiter:

1. Zuerst entlang fachlicher Verantwortung schneiden, nicht entlang beliebiger Hilfsfunktionen.
2. Bestehende Import-Pfade und Verhalten so stabil wie moeglich halten.
3. Nur dort splitten, wo mehrere echte Familien oder wiederholt getrennte Touch-Zonen sichtbar sind.
4. Strukturarbeit und Verhaltensaenderung nicht unnoetig in denselben Schritt mischen.
5. Kohaerente Flows oder Renderer bleiben stehen, auch wenn sie gross sind.

## Implemented Splits

Die folgenden Umbauten sind umgesetzt und muessen nicht mehr als offene Planpunkte verfolgt werden.

### `scripts/commands/project-admin.mjs`

Der bisherige Sammelpunkt wurde in eine Command-Familie mit stabilem Barrel-Einstieg geschnitten:

```text
scripts/
  commands/
    project-admin/
      core.mjs
      github-app-preview.mjs
      github-app-installations.mjs
      github-app-service.mjs
      shared.mjs
```

Die Datei `scripts/commands/project-admin.mjs` bleibt als duenne Re-Export-Schicht bestehen.

### `lib/github-installations.mjs`

Der Installations-Monolith ist jetzt entlang seiner Fachfamilien aufgeteilt:

```text
lib/
  github-installations/
    state.mjs
    packet.mjs
    governance.mjs
    runtime.mjs
    operations.mjs
    service-lane.mjs
    service-plan.mjs
    worker-routing.mjs
    scope.mjs
    artifacts.mjs
    shared.mjs
```

Die zusaetzliche Familie `worker-routing` wurde direkt mit aufgenommen, weil sie im aktuellen Code bereits als eigenstaendige Verantwortungszone sichtbar war.

### `lib/github-webhook-service.mjs`

Die Service-Familie ist jetzt sauber nach Queue-I/O, Klassifikation, Planung, Claims und Artefakten getrennt:

```text
lib/
  github-webhook-service/
    queue-store.mjs
    classification.mjs
    plans.mjs
    leases.mjs
    artifacts.mjs
    shared.mjs
```

Die Datei `lib/github-webhook-service.mjs` bleibt als duenne Re-Export-Schicht bestehen.

### `lib/github.mjs`

Der GitHub-Bereich wurde im naechsten sinnvollen Schritt ebenfalls geschnitten, ohne den alten Importpfad aufzubrechen:

```text
lib/
  github/
    auth.mjs
    app-planning.mjs
    event-preview.mjs
    setup.mjs
    api-client.mjs
    doctor.mjs
    enrichment.mjs
```

Die Datei `lib/github.mjs` bleibt als Barrel bestehen und exportiert weiterhin dieselben oeffentlichen Funktionen.

## Active Watch List

Diese Liste ist die verbleibende Beobachtungsliste.

| Datei | Status | Zeilen | Groesse | Kurzbewertung | Split-Trigger |
| --- | --- | ---: | ---: | --- | --- |
| `lib/project.mjs` | aktiv beobachten | 571 | 19 KB | mehrere Unterthemen, aber noch als Projekt-Lifecycle lesbar | Ausbau von `init-project`, Binding, Discovery oder Profile |
| `lib/html/document.mjs` | aktiv beobachten | 1154 | 37 KB | gross, aber noch ein kohaerenter Renderer | haeufigere getrennte Aenderungen an Layout, Styles oder Client-Skripten |
| `lib/github-webhook-runner.mjs` | vorerst lassen | 633 | 24 KB | noch als Runner-/Recovery-Flow lesbar | erst bei klar getrennten neuen Familien |
| `lib/github-webhook-route.mjs` | vorerst lassen | 266 | 11 KB | aktuell kohaerent | erst bei neuem eigenstaendigem Routing-Subbereich |
| `lib/github-webhook-dispatch.mjs` | vorerst lassen | 417 | 15 KB | aktuell kohaerent | erst bei deutlicher Trennung von Dispatch-Planung und Execution-Familien |

### `lib/project.mjs`

**Heutige Mischung**

- bestehende Projekt-Bindings laden
- generische Projekt-Initialisierung
- Workspace-Repo-Discovery
- Project-Profile-Loading

**Aktuelle Bewertung**

Die Datei hat mehrere Unterthemen, ist aber noch als zusammenhaengender Projekt-Lifecycle lesbar.
Ein Split ist aktuell nicht noetig und waere eher Strukturpflege als echte Entlastung.

**Ausloeser fuer einen spaeteren Split**

- deutlicher Ausbau von `init-project`
- neue Binding- oder Profile-Familien
- komplexere Workspace-Discovery-Regeln

**Moegliches Zielbild spaeter**

```text
lib/
  project/
    binding.mjs
    init.mjs
    discovery.mjs
    profile.mjs
```

### `lib/html/document.mjs`

**Aktuelle Bewertung**

Gross, aber weiterhin eher ein kohaerenter Renderer als ein fachlicher Mischcontainer.

**Ausloeser fuer einen spaeteren Split**

- haeufigere parallele Arbeit an Layout, Styles und Client-Skripten
- wiederholt getrennte Touch-Zonen im selben Renderer

## Vorerst bewusst lassen

- `lib/github-webhook-runner.mjs`
  - 633 Zeilen, ca. 24 KB
  - aktuell noch weitgehend als ein Runner-/Recovery-Flow lesbar
- `lib/github-webhook-route.mjs`
  - 266 Zeilen, ca. 11 KB
  - aktuell noch kohaerent
- `lib/github-webhook-dispatch.mjs`
  - 417 Zeilen, ca. 15 KB
  - aktuell noch kohaerent

## Next Recommendation

Der naechste sinnvolle Kandidat bleibt `lib/project.mjs`, aber nur bei echtem Ausbau.

Konkret bedeutet das:

- nicht proaktiv zerlegen, nur weil die Datei mehrere Bereiche enthaelt
- erst schneiden, wenn Projekt-Setup, Binding, Discovery oder Profile merklich wachsen
- bis dahin die Datei bewusst als beobachteten, aber noch tragfaehigen Arbeitskontext behandeln

## Final Assessment

Der aktuelle Umbau ist aus meiner Sicht in einem guten und sauberen Abschlusszustand.

- die klaren Monolith-Kandidaten sind geschnitten
- der zusaetzliche sinnvolle Kandidat `lib/github.mjs` ist ebenfalls sauber modularisiert
- oeffentliche Importpfade bleiben stabil ueber Barrels
- die Restkandidaten sind bewusst dokumentiert statt reflexhaft weiter zerlegt

Damit ist der Modularisierungsumbau fuer diesen Stand abgeschlossen und es ist sinnvoll, danach ein neues Thema zu beginnen statt weiter auf Verdacht Strukturarbeit zu treiben.
