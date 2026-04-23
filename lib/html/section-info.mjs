// lib/html/section-info.mjs
//
// Zentraler Erklaerungs-Katalog fuer Report-Sections. Jede Section-Id
// (aus sections.id oder den hardgecodeten Overview-Blocks) ist hier auf
// { title, body } gemappt. Der Info-Button in renderHtmlSection, den
// hardgecodeten Panels und der Landscape-Renderer-Intro zieht sich die
// Texte von hier.
//
// Zweck: trennt Text-Content von Render-Logik, erleichtert spaetere
// Lokalisierung und UX-Copy-Iteration.

export const SECTION_INFO_MAP = {
  "report-intro": {
    title: "Report-Intro",
    body: "Diese Einleitung ordnet den aktuellen Lauf ein: Report-Typ, Zielprojekt, Lauf-ID und die wichtigsten Kennzahlen als Meta-Zeile. Lies sie als Kontext, bevor du in die Details gehst."
  },
  "report-toolbar": {
    title: "Bericht filtern",
    body: "Bericht filtern ist dein Arbeitswerkzeug fuer grosse oder dichte Reports. Statt den ganzen Bericht erneut zu scannen, kannst du hier gezielt nach Repos, Ebenen oder Passungsstufen eingrenzen und so schneller an die relevante Teilmenge springen. Dieser Block veraendert nichts am Ergebnis, sondern nur deinen Blick auf den Bericht."
  },
  "stats": {
    title: "Kennzahlen",
    body: "Hier siehst du die verdichteten Grundzahlen dieses Laufs auf einen Blick. Der Block ist bewusst kompakt, damit du sofort erkennst, wie breit der Bericht ist, wie frisch er wirkt und wie viel Material dahintersteht."
  },
  "decision-summary": {
    title: "Entscheidungsuebersicht",
    body: "Die Entscheidungsuebersicht ist die verdichtete Kernaussage dieses kompletten Laufs. Hier siehst du, wohin der Bericht insgesamt kippt, welches Repo oder welcher Schritt vorne liegt und unter welchem Vertrauensniveau du das lesen solltest. Dieser Block ist also deine Lageeinschaetzung, bevor du in die einzelnen Karten gehst."
  },
  "empfehlungen": {
    title: "Empfehlungen",
    body: "Diese Section buendelt die beiden wichtigsten Empfehlungs-Sichten in einem Block mit Tabs. Tab 1 'Top-Rang' zeigt die drei bis fuenf staerksten Kandidaten als Schnell-Einstieg — so findest du die dringendsten Aktionen ohne Scrollen. Tab 2 'Nach Disposition gruppiert' ordnet dieselben Kandidaten nach Handlungs-Typ (Uebernehmen / Vertiefen / Beobachten / Zurueckstellen) — so siehst du die Gesamt-Verteilung und kannst pro Gruppe arbeiten. Beide Sichten greifen auf dieselbe Datengrundlage zu, praesentieren sie aber in unterschiedlicher Priorisierung."
  },
  "recommendations": {
    title: "Erste Empfehlungen",
    body: "Dieser Block ist deine schnellste Einstiegsspur in den Bericht. Hier stehen nicht alle Details, sondern die wenigen Repos oder Laufhinweise, mit denen du sinnvoll anfangen solltest. Lies ihn als Priorisierung fuer den ersten Blick, nicht als endgueltige Entscheidung."
  },
  "recommended-actions": {
    title: "Empfohlene Aktionen",
    body: "Hier gruppiert Pattern Pilot die Kandidaten nach Handlungstyp statt nur nach Rang. Dadurch wird klarer, was jetzt uebernommen, was vertieft, was beobachtet und was bewusst zurueckgestellt werden sollte."
  },
  "candidates": {
    title: "Discovery-Kandidaten",
    body: "Diese Uebersicht zeigt die Top-Discovery-Kandidaten aus dem Lauf. Die prominentesten drei sind direkt sichtbar, der Rest kommt bei Bedarf ausgeklappt. Pro Repo gibt die Detail-Ansicht Warum relevant, Evidenz, Staerke, Transferidee, Risiken und die Heuristik-Begruendung."
  },
  "candidate-overview": {
    title: "Kandidatenuebersicht",
    body: "Diese Uebersicht zeigt die sichtbar gebliebenen Discovery-Kandidaten in ihrer Kartenform. Sie ist die schnellste Stelle, um zu sehen, welche Repos nach Suche, Regelwerk und Erstgewichtung wirklich uebrig bleiben."
  },
  "coverage": {
    title: "Coverage",
    body: "Coverage macht sichtbar, welche Ebenen, Lueckenbereiche und Faehigkeiten der aktuelle Bericht tatsaechlich beruehrt. Die Balken sind relativ zum Maximum der jeweiligen Gruppe — ein 100%-Balken heisst also 'Spitzenwert dieser Gruppe', nicht 'vollstaendig abgedeckt'. Damit erkennst du, wo der Lauf stark ist und wo Themen unterbelichtet bleiben."
  },
  "top-compared-repositories": {
    title: "Staerkste Vergleichs-Repos",
    body: "Hier beginnt die eigentliche Vergleichsarbeit dieses Reports. Jede Zeile verdichtet pro Repo, warum es relevant ist, was du daraus mitnehmen kannst und wo Risiken oder Grenzen liegen."
  },
  "highest-risk-signals": {
    title: "Staerkste Risikosignale",
    body: "Hier stehen die staerksten Warnsignale aus dem aktuellen Vergleich. Der Block zeigt nicht einfach schlechte Repos, sondern die Stellen, an denen Unsicherheit, operative Risiken oder fehlende Tiefe vor einer Uebernahme geklaert werden sollten."
  },
  "run-scope": {
    title: "Umfang des Laufs",
    body: "Dieser Bereich zeigt, auf welcher Basis der Bericht entstanden ist. Du siehst hier, welche URLs wirklich im Lauf waren, ob der Fokus auf expliziten Repos oder auf der Watchlist lag und wie belastbar die Entscheidungsdaten dazu sind."
  },
  "review-scope": {
    title: "Review-Umfang",
    body: "Hier siehst du, in welchem konkreten Review-Rahmen Pattern Pilot gearbeitet hat. Der Block trennt zwischen explizit uebergebenen Repos und Watchlist-Kontext, damit du die Aussagekraft des Vergleichs besser einordnen kannst."
  },
  "agent-view": {
    title: "KI Coding Agents",
    body: "Diese Sicht ist die verdichtete Uebergabe fuer KI Coding Agents. Sie kombiniert Arbeitsauftrag, priorisierte Repos, Kontext, Leitplanken, Unsicherheiten und das maschinenlesbare Snapshot in einer Form, die direkt weiterverarbeitet werden kann."
  },
  "target-repo-context": {
    title: "Zielrepo-Kontext",
    body: "Der Zielrepo-Kontext zeigt, welche Dateien und Verzeichnisse Pattern Pilot aus dem Zielprojekt gelesen hat, bevor es Kandidaten bewertet. Die Status-Zeile darunter fasst den Gesamtstand zusammen, die vier Karten decken vier Blickwinkel ab: was gelesen wurde, was konfiguriert war aber fehlte, welche Verzeichnisse gescannt wurden, welche Faehigkeiten daraus abgeleitet sind."
  },
  "discovery-lenses": {
    title: "Discovery-Linsen",
    body: "Hier siehst du, aus welchen Suchlinsen oder Query-Familien dieser Lauf aufgebaut wurde. Der Bereich hilft vor allem dann, wenn du verstehen willst, warum bestimmte Repo-Arten ueberhaupt in die Kandidatenmenge geraten sind."
  },
  "discovery-policy": {
    title: "Discovery-Regelwerk",
    body: "Dieses Feld zeigt, wie stark das aktuelle Regelwerk in den Discovery-Lauf eingegriffen hat. Du erkennst hier, ob Kandidaten nur sichtbar geblieben, bewusst markiert oder vom Regelwerk schon aktiv in eine Richtung gedrueckt wurden."
  },
  "policy-calibration": {
    title: "Regel-Kalibrierung",
    body: "Die Regel-Kalibrierung zeigt, wo dein aktuelles Discovery-Regelwerk noch nachgeschaerft werden sollte. Sie ist besonders wertvoll, wenn du zwar Treffer bekommst, aber das Verhaeltnis zwischen Rauschen und wirklich brauchbaren Kandidaten noch nicht stimmt."
  },
  "search-errors": {
    title: "Suchfehler",
    body: "Hier landen technische oder inhaltliche Fehler aus der Discovery-Suche selbst. Der Bereich ist wichtig, damit ein schwacher Lauf nicht faelschlich wie eine schlechte Kandidatenlage aussieht, obwohl in Wahrheit die Suche eingeschraenkt war."
  },
  "repo-matrix": {
    title: "Repo-Matrix",
    body: "Die Repo-Matrix ist die verdichtete Queransicht ueber alle verglichenen Kandidaten. Sie eignet sich besonders, wenn du mehrere Repos systematisch entlang derselben Kriterien gegeneinander abgleichen willst."
  },
  "run-summary": {
    title: "Laufzusammenfassung",
    body: "Die Laufzusammenfassung ist die kompakteste Lesart des gesamten Ad-hoc-Laufs. Sie verbindet Modus, Phasenstatus und Datenqualitaet, damit du den operativen Zustand vor dem Detailblick verstehst."
  },
  "effective-urls": {
    title: "Wirksame URLs",
    body: "Hier stehen die Repository-URLs, die in diesem Lauf tatsaechlich ausgewertet wurden. Das ist deine wichtigste Kontrollstelle, wenn du nachvollziehen willst, worauf sich der Bericht konkret stuetzt."
  },
  "artifacts": {
    title: "Artefakte",
    body: "Dieser Bereich verlinkt die wichtigsten Ausgaben des Laufs als konkrete Dateien. Er ist die Bruecke vom gelesenen Bericht zu den weiterverwendbaren Artefakten wie HTML, Metadaten, Browser-Zeiger oder Agent Hand-Off."
  },
  "run-plan": {
    title: "Laufplan",
    body: "Der Laufplan zeigt, welche Standardform Pattern Pilot fuer diesen Modus vorsieht. Damit wird deutlicher, wie Intake, Review, Drift, Stabilitaet und Folgeaktionen in einem gesunden Ablauf zusammenspielen sollen."
  },
  "run-drift": {
    title: "Laufdrift",
    body: "Laufdrift zeigt, ob sich dieser Lauf noch in der erwarteten Form bewegt oder ob operative Abweichungen zunehmen. Das ist wichtig, damit ein Bericht nicht stabiler oder eindeutiger wirkt, als er es in Wirklichkeit ist."
  },
  "run-stability": {
    title: "Stabilitaet",
    body: "Dieser Block verdichtet, wie stabil vergleichbare juengere Laeufe zuletzt waren. Er hilft dir, Ergebnisse mit dem passenden Mass an Vertrauen oder Vorsicht weiterzuverarbeiten."
  },
  "run-governance": {
    title: "Governance",
    body: "Governance zeigt, wie stark Regeln, manuelle Gates und Automatik im aktuellen Zustand eingreifen. Ein Agent oder Mensch sollte diesen Bereich beachten, bevor aus dem Bericht direkte Folgeaktionen abgeleitet werden."
  },
  "what-now": {
    title: "Was jetzt?",
    body: "Das ist der kompakteste Ausblick auf die direkt sinnvollen Folgeaktionen. Der Block uebersetzt den Bericht bewusst in einen klaren naechsten Schritt, statt ihn nur zusammenzufassen."
  },
  "missing-watchlist-intake": {
    title: "Fehlendes Intake fuer Watchlist",
    body: "Dieses Feld markiert Watchlist-Repos, fuer die noch keine frische Intake-Basis vorliegt. Solche Luecken schwaechen spaetere Vergleiche und sollten vor groesseren Uebernahme- oder Promotionsentscheidungen geschlossen werden."
  },
  // Landscape-spezifische Sections
  "problem": {
    title: "Problem-Landkarte",
    body: "Die Problem-Landkarte buendelt einen Lauf rund um eine konkrete Frage an das Zielprojekt. Aus dem Problem-Slug erzeugt Pattern Pilot Discovery-Queries, bewertet die Fundstuecke, gruppiert sie zu Clustern und liest das Ergebnis gegen den Projektkontext."
  },
  "uebersicht": {
    title: "Uebersicht",
    body: "Die Uebersicht buendelt die Kennzahlen dieses Laufs in einem Blick — Ergebnis-Zahlen aus Discovery und Clustering, Lauf-Metadaten, Profil. Damit laesst sich jeder Report-Start sofort einordnen, auch ohne Scrollen."
  },
  "cluster": {
    title: "Cluster",
    body: "Ein Cluster fasst Kandidaten-Repos mit aehnlichem Muster oder Vokabular zu einer Gruppe. Je enger die Gruppe, desto klarer der gemeinsame Loesungsansatz. Ziel ist, Build-vs-Borrow-Entscheidungen auf Cluster-Ebene statt pro Einzel-Repo zu fuehren."
  },
  "achsen": {
    title: "Achsen-View",
    body: "Die Achsen-View zeigt, wo dieses Problem im Loesungsraum liegt — ueber Dimensionen wie Latenz (Realtime vs. Batch), Datenmodell (relational, graph, document) und Distribution (Library, Service, SaaS). Der Balken zeigt die aggregierte Position aller gefundenen Repos auf jeder Achse."
  },
  "entscheidungen": {
    title: "Entscheidungen",
    body: "Die Entscheidungen sind die konkreten Handlungs-Empfehlungen aus diesem Lauf: Was soll uebernommen, adaptiert oder nur beobachtet werden? Jede Zeile ist an Quellen im Cluster-Bereich rueckgebunden und landet spaeter im Decisions-Log des Zielprojekts."
  },
  "lauf": {
    title: "Lauf-Info",
    body: "Die Lauf-Info haelt die Metadaten dieses Report-Laufs fest: Lauf-ID, Discovery-Profil, Quelle und Token-Budget. Sie dient als Audit-Trail und macht jeden Lauf reproduzierbar."
  }
};

export function getSectionInfo(sectionId) {
  return SECTION_INFO_MAP[String(sectionId || "").toLowerCase()] ?? null;
}
