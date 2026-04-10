# Pattern Families

## Zweck

Diese Datei definiert die kanonischen `pattern_family`-Werte für `patternpilot`.

Sie verhindert, dass die Spalte `pattern_family` in `repo_landkarte.csv` zu einer freien Notizspalte wird.

`pattern_family` beschreibt das wiederkehrende Grundmuster eines Repos oder Produkts.

---

## Regel

Pro Repo wird genau eine primäre `pattern_family` gesetzt.

Wenn ein Repo mehrere Muster berührt, zählt die Frage:

**Welches Grundmuster ist für den Wert dieses Repos am prägendsten?**

---

## Erlaubte Werte

### `single_source_connector`
Eng auf eine einzelne Plattform oder Quelle fokussierter Connector.

### `niche_vertical_connector`
Connector für eine spezielle Unterdomäne oder Szene.

### `local_multi_source_aggregator`
Lokaler oder regionaler Aggregator aus mehreren Quellen.

### `portal_fed_by_many_scrapers`
Zentrales Portal, das von vielen einzelnen Scraper-Modulen beliefert wird.

### `local_source_infra_framework`
Wiederverwendbares Framework für lokale Source-Infrastruktur und Standardisierung.

### `place_data_infrastructure`
Eigenständige Infrastruktur für Places, Venues oder ortsbezogene Daten.

### `platform_based_place_enrichment`
Plattformabhängiger Enricher für Place- oder Business-Daten.

### `cms_distribution_plugin`
Plugin- oder CMS-getriebenes Distributionsmuster.

### `event_discovery_frontend`
Discovery-orientierte Event-Oberfläche oder Nutzerfläche.

### `research_signal`
Strategisch interessantes Signal ohne direkte Zielmuster-Eignung.

---

## Mapping der aktuell erfassten Repos

- facebook-event-scraper → single_source_connector
- meetup_event_scraper → single_source_connector
- compiled-mcr-events → local_multi_source_aggregator
- wp-event-aggregator → cms_distribution_plugin
- Meetable → event_discovery_frontend
- city-scrapers → local_source_infra_framework
- TeSS_scrapers → portal_fed_by_many_scrapers
- ra-scraper → niche_vertical_connector
- alltheplaces → place_data_infrastructure
- google-maps-scraper → platform_based_place_enrichment

---

## Nicht erlaubt

Nicht erlaubt als `pattern_family` sind:

- freie Ad-hoc-Werte
- Mischbegriffe aus zwei Familien
- technische Detailnotizen
- allgemeine Wörter wie `tool`, `scraper`, `api`

Neue Familien sollen selten und bewusst ergänzt werden.
