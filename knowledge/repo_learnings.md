# Repo Learnings

## Zweck

Diese Datei enthält verdichtete Learnings aus mehreren externen Repositories, Tools und Produkten.

Sie ist bewusst keine Wiederholung der Landkarte.
Die Landkarte dokumentiert einzelne Funde.
Diese Datei verdichtet daraus Muster, wiederkehrende Stärken, typische Schwächen und strategische Erkenntnisse für EventBär.

Wichtig:
Der aktuelle Stand ist ein **Seed-Stand** auf Basis der bereits einmal gesichteten und eingeordneten Repos.
Er ist als Startmaterial gedacht und soll mit jeder weiteren Analyse geschärft werden.

---

## Aktuelle Lernfelder

### 1. Single-Source-Connector-Muster

**Beobachtung**
- Viele öffentliche Repos sind keine vollständigen Systeme, sondern schmale Connectoren für einzelne Plattformen.

**Wiederkehrende Muster**
- gute Tiefe auf einer Quelle
- hohe Plattformabhängigkeit
- schwache Governance
- wenig Wiederverwendbarkeit als Gesamtsystem

**Bedeutung für EventBär**
- Connectoren sind nützlich, aber nur als modulare Adapter.

**Mögliche Konsequenz**
- EventBär sollte Connector-Familien bewusst modular denken, aber nie den Systemkern daran ausrichten.

---

### 2. Multi-Source-Aggregator-Muster

**Beobachtung**
- Lokale Aggregatoren werden deutlich wertvoller, wenn dieselbe Pipeline mehrere Ausspielwege erzeugt.

**Wiederkehrende Muster**
- Website
- JSON
- Feed/iCal
- einfache Discovery-Surface

**Bedeutung für EventBär**
- Die reine Masterliste reicht langfristig nicht als Produktoberfläche.

**Mögliche Konsequenz**
- Distribution früh mitdenken: API, Feed, Widget, später Plugin.

---

### 3. Plugin- und CMS-Distribution

**Beobachtung**
- WordPress und ähnliche CMS-Flächen sind ein realer Hebel, auch wenn sie nicht den Datensystem-Kern lösen.

**Wiederkehrende Muster**
- hohe Reichweite
- einfache Integration
- Partnerfähigkeit

**Bedeutung für EventBär**
- Plugin/Embed ist keine Nebensache, sondern eine potenzielle Multiplikatorfläche.

**Mögliche Konsequenz**
- WordPress-Plugin als reale spätere Distribution-Surface prüfen.

---

### 4. Place-/Location-Enrichment

**Beobachtung**
- Für ortsbezogene Daten existiert teils deutlich stärkere Open-Source-Infrastruktur als für lokale Event-Truth-Systeme.

**Wiederkehrende Muster**
- standardisierte Place-Datensätze
- große Coverage
- gute Wiederverwendbarkeit
- schwache Event-Semantik

**Bedeutung für EventBär**
- Locations und Gastro verdienen eigene strategische Schichten.

**Mögliche Konsequenz**
- EventBär sollte ortsbezogene Daten nicht nur als Nebenprodukt von Eventquellen behandeln.

---

### 5. Qualitäts- und Governance-Lücken externer Repos

**Beobachtung**
- Viele Repos lösen Ingest oder Darstellung, aber nicht Review, Reject, Truth und langfristige Qualitätskontrolle.

**Wiederkehrende Muster**
- kein echtes Quality Gate
- keine saubere Entitätentrennung
- keine Review-Schleife
- kaum Governance

**Bedeutung für EventBär**
- Genau hier liegt ein potenzieller Vorsprung.

**Mögliche Konsequenz**
- EventBärs Qualitäts- und Governance-Kern ist keine Überkomplexität, sondern ein möglicher Moat.

---

### 6. Rechtliche und operative Risiken

**Beobachtung**
- Plattformgebundene Scraper erzeugen oft ToS-, Lock-in- und Anti-Bot-Risiken.

**Wiederkehrende Muster**
- hohe Abhängigkeit von HTML oder UI
- fragile Pfade
- starke Plattformkopplung

**Bedeutung für EventBär**
- Solche Quellen nur als optionale Adapter behandeln, nicht als Primärwahrheit.

**Mögliche Konsequenz**
- Risk-awareness muss fester Teil jeder Connector-Entscheidung sein.

---

### 7. Marktübliche Schwächen

**Beobachtung**
- Viele Lösungen sind entweder schmal, stadtgebunden, plugin-getrieben oder rein UI-getrieben.

**Wiederkehrende Muster**
- starke Teilflächen
- schwaches Ganzes

**Bedeutung für EventBär**
- Das Problem ist real, aber selten ganzheitlich gelöst.

**Mögliche Konsequenz**
- EventBär kann gewinnen, wenn der Worker-Kern stark bleibt und Distribution später gezielt ergänzt wird.

---

### 8. Potenzieller EventBär-Moat

**Beobachtung**
- Ein echter Vorsprung entsteht nicht aus einem einzelnen Scraper, sondern aus der Kombination mehrerer harter Schichten.

**Wiederkehrende Muster**
- externe Repos sind oft auf eine Ebene spezialisiert
- die Verbindung der Ebenen ist schwach

**Bedeutung für EventBär**
- Moat könnte liegen in:
  - audit-first
  - source-first
  - candidate-first
  - quality gate
  - Entitätentrennung
  - Review/Governance
  - lokale Tiefe
  - spätere Distribution

**Mögliche Konsequenz**
- EventBär sollte bewusst als System gebaut werden, nicht als Sammlung von Scraping-Skripten.

---

## Offene Meta-Fragen

- Welche Connector-Familien lohnen sich zuerst?
- Welche Distribution-Surface bringt den größten Hebel?
- Wo ist EventBär bereits stärker als der sichtbare Markt?
- Wo fehlt noch eine echte, belastbare Schicht?
