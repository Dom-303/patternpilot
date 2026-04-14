# Repo Decisions

## Zweck

Diese Datei dokumentiert konkrete Entscheidungen, die aus der Analyse externer Repositories, Tools und Produkte entstehen.

Hier steht nur:

- was wir daraus machen
- was wir bewusst nicht machen
- was wir später prüfen
- was für EventBär konkret folgt

Wichtig:
Die aktuellen Entscheidungen basieren auf dem ersten Seed-Set bereits gesichteter Repos.
Sie sind ein Startzustand, kein Endstand.

---

## Entscheidungsklassen

- adopt
- adapt
- observe
- ignore

---

## Aktuelle Entscheidungen

### 1. Connectoren nicht als Kern verwechseln

**Datum**
- 2026-04-10

**Auslöser**
- facebook-event-scraper
- meetup_event_scraper
- ra-scraper

**Entscheidung**
- adapt

**Begründung**
- Schmale Plattform-Connectoren sind wertvoll, aber zu fragil und zu eng als Systemkern.

**Konkrete Bedeutung für EventBär**
- Connector-Familien modular denken, aber hinter Audit-, Candidate- und Quality-Gates halten.

**Nächster Schritt**
- Patternpilot weiter füllen und später priorisierte Connector-Familienliste definieren.

**Status**
- offen

---

### 2. Distribution als echte Produktfläche mitdenken

**Datum**
- 2026-04-10

**Auslöser**
- compiled-mcr-events
- wp-event-aggregator
- Meetable

**Entscheidung**
- observe

**Begründung**
- Mehrere Repos zeigen, dass derselbe Datenkern in API, Feed, Website und Plugin deutlich mehr Wert bekommt.

**Konkrete Bedeutung für EventBär**
- EventBär darf nicht nur ein Worker bleiben.

**Nächster Schritt**
- Distribution-Surfaces fortlaufend kartieren und priorisieren.

**Status**
- offen

---

### 3. Place-/Location-Schichten ernst nehmen

**Datum**
- 2026-04-10

**Auslöser**
- alltheplaces
- google-maps-scraper

**Entscheidung**
- adapt

**Begründung**
- Für Place-/Location-Daten existiert starke externe Infrastruktur, aber nicht als Event-Wahrheitskern.

**Konkrete Bedeutung für EventBär**
- Locations/Gastro als eigene intelligente Schichten behandeln.

**Nächster Schritt**
- Fortlaufend prüfen, welche Enrichment-Muster für EventBär kontrolliert brauchbar sind.

**Status**
- offen

---

## Vorlage für neue Entscheidungen

### Entscheidungstitel

**Datum**
- YYYY-MM-DD

**Auslöser**
- Welche Repos, Tools oder Muster haben diese Entscheidung ausgelöst?

**Entscheidung**
- adopt / adapt / observe / ignore

**Begründung**
- Warum wurde so entschieden?

**Konkrete Bedeutung für EventBär**
- Welche Auswirkung hat das?

**Nächster Schritt**
- Was folgt daraus konkret?

**Status**
- offen / geplant / in arbeit / umgesetzt / verworfen

## Patternpilot Candidate Decisions

<!-- patternpilot:decision-candidates:start -->
<!-- patternpilot:decision-candidates:citybureau__city-scrapers:start -->
### Candidate: citybureau/city-scrapers fuer EventBaer Worker als 'adapt_pattern' behandeln

**Datum**
- 2026-04-14

**Ausloeser**
- citybureau/city-scrapers
- local_source_infra_framework

**Entscheidung**
- adapt

**Begruendung**
- Toolkit and scraper family for extracting civic data from many source systems. Project fit is 'high' with score 95. Matched project capabilities: source_first,evidence_acquisition. Likely relevant for EventBaer Worker because it may inform 'source_systems_and_families' and the worker/project layer 'source_intake'.

**Konkrete Bedeutung fuer EventBaer Worker**
- Source infrastructure should be built as reusable families instead of isolated one-off connectors.

**Naechster Schritt**
- Compare the repo against EventBaer's source-system target architecture and family scaling goals.

**Status**
- proposed
<!-- patternpilot:decision-candidates:citybureau__city-scrapers:end -->

<!-- patternpilot:decision-candidates:oc__openevents:start -->
### Candidate: oc/openevents fuer EventBaer Worker als 'adapt_pattern' behandeln

**Datum**
- 2026-04-14

**Ausloeser**
- oc/openevents
- place_data_infrastructure

**Entscheidung**
- adapt

**Begruendung**
- Open source events platform with structured event and venue concepts. Project fit is 'high' with score 73. Matched project capabilities: source_first,location_intelligence,distribution_surfaces. Likely relevant for EventBaer Worker because it may inform 'location_and_gastro_intelligence' and the worker/project layer 'location_place_enrichment'.

**Konkrete Bedeutung fuer EventBaer Worker**
- Location and venue intelligence deserve their own deliberate layer next to event truth.

**Naechster Schritt**
- Review against location/gastro layers and geo-validation capabilities.

**Status**
- proposed
<!-- patternpilot:decision-candidates:oc__openevents:end -->

<!-- patternpilot:decision-candidates:end -->
