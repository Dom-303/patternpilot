# PinFlow Positioning and Build Focus

Stand: 2026-04-25

Diese Notiz haelt die aktuelle strategische Einordnung von PinFlow gegenueber
Claude Code Desktop, Claude Live Artifacts und Codex Desktop fest. Sie ist kein
Marketingtext allein, sondern eine Bau- und Priorisierungsgrundlage fuer die
naechsten PinFlow-Schritte.

## Kurzfazit

PinFlow sollte nicht als bessere Browser-Preview positioniert werden. Diese
Flaeche wird von Claude Code Desktop und Codex Desktop sehr schnell
professionalisiert: lokale Dev-Server oeffnen, HTML/PDF/Bilder anzeigen,
Screenshots machen, DOM inspizieren, visuelle Kommentare setzen und
UI-Aenderungen automatisch pruefen.

PinFlows starke Position ist eine andere:

> PinFlow gives coding agents source-exact visual context from your running
> frontend.

Auf Deutsch:

> PinFlow zeigt Coding-Agenten nicht nur deine Webseite, sondern welches
> laufende UI-Element zu welcher Source-Stelle, Komponente und welchem
> Runtime-State gehoert.

Das ist der Kern. Claude und Codex koennen die App sehen und bedienen. PinFlow
macht die laufende App fuer Agents source-genau, runtime-bewusst und als
bearbeitbare Aufgabenquelle nutzbar.

## Was PinFlow sein sollte

PinFlow ist der source-genaue Runtime-Kontext-Layer fuer Frontend-Arbeit mit
Coding Agents.

PinFlow verbindet:

- UI-Element im echten Browser
- DOM Snapshot und sichtbaren Zustand
- Source-Datei, Zeile, Spalte und Komponente
- Framework-Kontext wie React Props/State oder Vue VNode-Kontext
- Nutzeranweisung als Annotation
- Agent-Workflow ueber MCP, REST und WebSocket

Das Produktversprechen ist nicht: "Wir zeigen eine Website im Tool."

Das Produktversprechen ist:

> Jeder UI-Klick wird zu einem perfekten Agent-Task mit Source, DOM, Props,
> State und Workflow-Status.

## Was PinFlow nicht sein sollte

PinFlow sollte nicht versuchen, Claude Code Desktop oder Codex Desktop als
vollstaendige Arbeitsoberflaeche zu ersetzen.

Nicht priorisieren:

- eigene Desktop-App als Hauptprodukt
- eigener vollwertiger Browser
- eigener Diff-Reviewer
- eigenes grosses Chat-UI
- allgemeines HTML-/Artifact-System
- generische "Preview mit Kommentaren" als Kernnarrativ

Diese Flaechen haben OpenAI und Anthropic durch Distribution, Modellintegration
und native UX-Vorteile. PinFlow sollte dort nicht frontal konkurrieren.

## Der richtige Plattform-Satz

PinFlow arbeitet mit den grossen LLM-Anbietern und waechst mit ihnen. Es ist
kein Gegenspieler zu Claude oder Codex, sondern eine Tiefenschicht unter deren
Agent-Faehigkeiten.

Gute Formulierung:

> Claude and Codex can edit your repo and preview your app. PinFlow tells them
> exactly what they are looking at.

Oder:

> PinFlow is the source-exact runtime context layer for Claude, Codex, and any
> MCP-compatible coding agent.

Das ist wichtig fuer Positionierung und Architektur: PinFlow muss nicht der
Agent sein. PinFlow muss dem Agenten die fehlende Wahrnehmung geben.

## Alleinstellungsmerkmale

### 1. Source-exakte UI-zu-Code-Bruecke

Der User klickt in der laufenden App auf ein Element. PinFlow findet das
zugehoerige `data-ds`, loest die Manifest-Position auf und gibt Datei, Zeile,
Spalte, Tag und Komponente zurueck.

Das ist staerker als ein Screenshot oder ein DOM-Selector, weil der Agent nicht
raten muss, welche Datei relevant ist.

### 2. Code-zu-UI-Abfrage

Der Agent kann von einer Source-Stelle aus fragen:

> Wie sieht diese Datei/Zeile gerade live im Browser aus?

`pinflow.query.bySource` ist deshalb kein Nebenfeature, sondern ein
Hero-Feature. Es macht aus Source-Code eine live pruefbare UI-Realitaet.

### 3. Runtime-Kontext statt nur DOM

Claude/Codex-Previews koennen DOM, Screenshots und Interaktionen sehen. PinFlow
muss tiefer gehen: Props, State, Komponentenname, Framework-Metadaten,
gerenderte Attribute und relevante Textinhalte.

Dieser Layer ist der eigentliche Moat.

### 4. Agent-agnostische Schnittstelle

PinFlow soll Codex, Claude und andere MCP-Clients bedienen. Es sollte nicht
provider-abhaengig werden.

Die strategische Staerke ist:

- Claude kann es nutzen.
- Codex kann es nutzen.
- ein anderer MCP-Agent kann es nutzen.
- der lokale Workflow bleibt im Repo inspectable.

### 5. Repo-lokale, kontrollierbare Task-Schicht

Annotations leben im Projektkontext. Der User kann queued, processing,
processed, failed und archived sehen. Das ist kein versteckter Blackbox-Flow.

Das macht PinFlow zu einem kontrollierbaren Operator-Layer fuer visuelle
Frontend-Arbeit.

## Was die Konkurrenzentwicklung bedeutet

Claude Code Desktop und Codex Desktop werden die folgenden Funktionen sehr
wahrscheinlich weiter ausbauen:

- localhost-App-Preview
- visuelle Kommentare auf Webseiten
- DOM-Inspektion
- Screenshot-basierte UI-Verifikation
- Browser-Automation
- automatische Fix-Loops nach visueller Pruefung

Diese Flaechen sollten als Commodity betrachtet werden. PinFlow darf sie nutzen,
aber nicht als Hauptmoat behandeln.

PinFlows Moat liegt in den Dingen, die Plattform-Previews nicht automatisch
sauber loesen:

- deterministic DOM-to-source mapping
- stable IDs ueber HMR/Fast Refresh hinweg
- framework-aware Props/State Capture
- source-to-live-UI query
- repo-lokale Annotationen und Queue-Semantik
- MCP-Vertrag fuer beliebige Agents
- explizite, kontrollierbare Dispatch-Schicht

## Bau-Fokus nach Layern

### Layer 1: Stable Identity and Manifest

Ziel: Jede relevante UI-Struktur muss stabil auf Source zurueckfuehrbar sein.

Vertiefen:

- AST-Injection fuer React, Vue, Next und Nuxt weiter haerten
- `data-ds` Stabilitaet ueber HMR, Fast Refresh und kleine Code-Moves sichern
- Manifest-Staleness sauber sichtbar machen
- mehrere Treffer pro Source-Zeile als Kandidaten mit Confidence behandeln
- sourcemap- und monorepo-Pfade robuster normalisieren

Betroffene PinFlow-Bereiche:

- `packages/pinflow-transform`
- `packages/pinflow-manifest`
- Framework-Adapter in `packages/pinflow-react`, `packages/pinflow-vue`,
  `packages/pinflow-next`, `packages/pinflow-nuxt`

Erfolgskriterium:

- Ein Agent bekommt bei einem Klick oder einer Source-Abfrage fast immer eine
  belastbare, erklaerbare Source-Zuordnung statt nur einen DOM-Hinweis.

### Layer 2: Runtime Context Capture

Ziel: PinFlow muss mehr wissen als der Browser sieht.

Vertiefen:

- React/Next als Golden Path perfektionieren
- Vue/Nuxt danach angleichen, aber nicht vor React/Next ueberdehnen
- Props/State-Serialisierung berechenbar und klein halten
- Redaction fuer E-Mails, Tokens und sensible Werte weiterhin standardmaessig
  aktiv lassen
- Capture-Ergebnisse mit Gruenden versehen, wenn Props/State nicht verfuegbar
  sind
- spaeter Event-Handler, derived state oder route/data-loader-Kontext pruefen

Betroffene PinFlow-Bereiche:

- `packages/pinflow-runtime`
- `packages/pinflow-react`
- `packages/pinflow-vue`
- `packages/pinflow-overlay`

Erfolgskriterium:

- Der Agent versteht nicht nur "welcher Button", sondern auch "welche
  Komponente, welcher State, welche Props und welcher sichtbare DOM-Zustand".

### Layer 3: Source-to-Live-UI Query

Ziel: `pinflow.query.bySource` wird das wichtigste Agent-Werkzeug.

Vertiefen:

- Ergebnisformat mit Match-Confidence, Kandidaten und Failure Reasons schaerfen
- bei `rendered: false` klar sagen: Browser nicht verbunden, Route nicht offen,
  Element nicht gerendert, Manifest stale oder Source nicht gefunden
- mehrere Browser-Tabs/Routen spaeter als Sessions modellieren
- Toleranz bei Zeilenverschiebungen bewusst und transparent machen
- Tool-Prompts fuer Agents so schreiben, dass sie vor UI-Aenderungen aktiv
  `query.bySource` nutzen

Betroffene PinFlow-Bereiche:

- `packages/pinflow-relay`
- `packages/pinflow-mcp`
- `packages/pinflow-runtime`
- `packages/pinflow-overlay`

Erfolgskriterium:

- Ein Agent kann von einer Source-Datei aus live pruefen, wie die Stelle im
  Browser aussieht, ohne dass der User erneut klicken muss.

### Layer 4: Annotation and Task Workflow

Ziel: Aus einem UI-Klick wird ein kontrollierter Agent-Task.

Vertiefen:

- Queue-Zustaende sauber trennen: queued, claimed, processing, processed,
  failed, archived
- Claim/Lease-Modell gegen parallele Agents absichern
- Agent-Antworten, Fehlergruende und naechste Aktion im Overlay sichtbar machen
- Annotationen als repo-lokale, lesbare Artefakte erhalten
- Refresh/Re-capture fuer bestehende Annotationen weiter haerten

Betroffene PinFlow-Bereiche:

- `packages/pinflow-core`
- `packages/pinflow-relay`
- `packages/pinflow-overlay`
- `packages/pinflow-mcp`

Erfolgskriterium:

- Der User kann mehrere visuelle Aenderungswuensche sammeln, kontrolliert an
  Agents geben und deren Status im Browser verfolgen.

### Layer 5: Agent Integration Surface

Ziel: PinFlow soll die grossen Agents besser machen, nicht ersetzen.

Vertiefen:

- Claude- und Codex-Setup als First-Class-Flows dokumentieren
- MCP-Toolnamen, Prompts und Rueckgaben auf Agent-Verstaendlichkeit optimieren
- Agent-Regeln bereitstellen: "Bei visuellen Frontend-Aenderungen zuerst
  PinFlow-Kontext abfragen"
- Provider-neutralen Dispatch-Vertrag aufbauen
- spaeter pro Session waehlen: Codex, Claude oder manual

Betroffene PinFlow-Bereiche:

- `packages/pinflow-mcp`
- `packages/pinflow-cli`
- `.codex-plugin`
- Claude Plugin/Skill-Oberflaeche
- Docs und onboarding

Erfolgskriterium:

- Ein User muss nicht erklaeren, wie PinFlow zu benutzen ist. Der Agent kennt
  den visuellen Edit-Loop und nutzt die richtigen Tools.

### Layer 6: Verification Loop

Ziel: PinFlow soll nicht nur den Startkontext liefern, sondern die Aenderung
nach dem Edit pruefbar machen.

Vertiefen:

- vor dem Edit: capture/query context
- nach dem Edit: gleiche Source/Elementstelle erneut abfragen
- sichtbare DOM-/Attribute-/Text-Aenderung vergleichbar machen
- optional Playwright- oder Browser-Verifikation anschliessen
- Fehlerfalle klar ausgeben statt stiller Unsicherheit

Moegliche spaetere Schnittstellen:

- `pinflow.verify.bySource`
- `pinflow.annotation.refresh`
- `pinflow.context.compare`

Diese Namen sind noch keine finalen API-Entscheidungen, aber die Faehigkeit ist
strategisch wichtig.

Erfolgskriterium:

- Der Agent kann sagen: "Ich habe die richtige Stelle geaendert und PinFlow hat
  den geaenderten Runtime-Zustand erneut gesehen."

### Layer 7: Setup, Doctor, and Project Fit

Ziel: PinFlow muss in echten Projekten schnell funktionieren.

Vertiefen:

- `pinflow init` fuer Monorepos klarer machen
- `pinflow doctor` oder vergleichbare Diagnose einfuehren
- Browser connected, relay healthy, manifest present und app root sichtbar
  pruefen
- Fehlermeldungen nutzerfreundlich formulieren
- Preview-Demo nicht mit Produktkern verwechseln

Betroffene PinFlow-Bereiche:

- `packages/pinflow-cli`
- `packages/pinflow-relay`
- docs
- test fixtures

Erfolgskriterium:

- Der erste echte User kommt von "installiert" zu "Element geklickt, Agent hat
  Source-Kontext" ohne Debugging-Odyssee.

## Priorisierung

### Sofort

1. README und Produkttext auf source-exakten Runtime-Kontext schaerfen.
2. `pinflow.query.bySource` als Hero-Feature behandeln.
3. React/Next Golden Path fuer Klick -> Source -> Runtime Context -> Annotation
   perfekt machen.
4. Eine 60-Sekunden-Killer-Demo bauen.
5. Claude/Codex-Setup und Agent-Prompts vereinfachen.

### Danach

1. Annotation Lifecycle mit Claim/Lease und klaren Fehlergruenden staerken.
2. Source-to-UI Query mit Confidence, Kandidaten und Failure Reasons ausbauen.
3. Re-capture/Verification Loop nach Agent-Aenderungen ergaenzen.
4. Monorepo- und Multi-Route-Faelle robuster machen.
5. Provider-neutralen Dispatcher fuer Codex, Claude und manual handling bauen.

### Spaeter

1. Vue/Nuxt-Paritaet nach React/Next-Haertung verbessern.
2. Event-Flow und Performance-Kontext untersuchen.
3. Multi-browser-session registry aufbauen.
4. API fuer visuelle Regression oder DOM-Delta-Vergleich pruefen.
5. Oeffentliche Vergleichs-/Benchmark-Seite erstellen.

## Was bewusst warten sollte

- grosse eigene Desktop-App
- generische Artifact-Plattform
- breite Framework-Paritaet vor einem perfekten Golden Path
- zu viel Overlay-Polish vor Workflow-Zuverlaessigkeit
- Marketing fuer "ganze Website bearbeiten", solange der source-exakte Agent
  Loop noch nicht als Demo sitzt

## Entscheidungssatz fuer die Roadmap

Wenn eine geplante Arbeit nicht mindestens eines dieser Ziele staerkt, sollte
sie vorerst warten:

1. source-exaktere DOM-zu-Code-Zuordnung
2. tieferer Runtime-Kontext
3. bessere Agent-Nutzung ueber MCP
4. stabilerer Annotation-/Task-Workflow
5. schnellere reale Projektinstallation
6. bessere Verifikation nach Agent-Aenderungen

## Quellen und Kontext

Lokaler PinFlow-Kontext:

- `../../../../pinflow/README.md`
- `../../../../pinflow/TECHNICAL_SPEC.md`
- `../../../../pinflow/docs/roadmaps/03-pinflow-agent-workflow.md`

Externe Produktlage, recherchiert am 2026-04-25:

- Claude Live Artifacts in Claude Cowork:
  `https://support.claude.com/en/articles/14729249-use-live-artifacts-in-claude-cowork`
- Claude Code Desktop:
  `https://code.claude.com/docs/en/desktop`
- OpenAI Codex App:
  `https://openai.com/index/introducing-the-codex-app/`
- Codex for almost everything:
  `https://openai.com/index/codex-for-almost-everything/`

## Schlussresuemee

PinFlow sollte enger und tiefer werden, nicht breiter.

Die richtige Strategie ist nicht, Claude oder Codex als Arbeitsoberflaeche zu
kopieren. Die richtige Strategie ist, deren Agenten die source-exakte
Frontend-Wahrnehmung zu geben, die sie allein noch nicht zuverlaessig haben.

PinFlow gewinnt, wenn ein Agent bei visueller Frontend-Arbeit weniger raet,
schneller die richtige Datei findet, den echten Runtime-Zustand versteht und
nach der Aenderung beweisen kann, dass die richtige UI-Stelle getroffen wurde.
