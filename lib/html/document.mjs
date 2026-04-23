import {
  LOGO_BASE64,
  escapeHtml,
  renderHtmlStatCards,
  renderHtmlSection,
  renderCollapsibleSection,
  renderStickyNav,
  renderHeroSection,
  renderDecisionSummary,
  renderTopRecommendations,
  renderRecommendedActions,
  slugifyForId
} from "./shared.mjs";
import { renderReportToolbar } from "./sections.mjs";
import {
  COCKPIT_NIGHT_FONTS_HEAD,
  COCKPIT_NIGHT_BASE_CSS
} from "./tokens.mjs";
import { INFO_DIALOG_SCRIPT, renderInfoDialog } from "./components.mjs";

const REPORT_TYPE_LABELS = {
  discovery: "Discovery Report",
  on_demand: "Ad-hoc Lauf",
  watchlist_review: "Watchlist Review",
  review: "Vergleichsbericht"
};

function renderReportContentIntro({ reportType, projectKey, createdAt, heroSubtitle, candidateCount, runRoot }) {
  const eyebrow = REPORT_TYPE_LABELS[reportType] ?? "Patternpilot Report";
  const subject = projectKey || "Patternpilot";
  const runId = runRoot ? String(runRoot).split("/").pop() : "";
  const dateStr = createdAt ? createdAt.slice(0, 10) : "";
  const metaParts = [
    candidateCount != null ? `${candidateCount} Kandidaten` : null,
    heroSubtitle ? `Profil ${heroSubtitle}` : null,
    dateStr
  ].filter(Boolean);
  const metaFragment = metaParts.length > 0
    ? `<div class="meta">${metaParts.map((part, i) => (i > 0 ? `<span class="sep">·</span>` : "") + `<span>${escapeHtml(part)}</span>`).join("\n    ")}</div>`
    : "";
  const subjectIdFragment = runId ? `<div class="subject-id">${escapeHtml(runId)}</div>` : "";
  return `<section class="content-intro" id="report-intro" data-nav-section>
  <div class="eyebrow">${escapeHtml(eyebrow)}</div>
  <h2 class="subject">${escapeHtml(subject)}</h2>
  ${subjectIdFragment}
  ${metaFragment}
</section>`;
}

export function renderHtmlDocument({
  title,
  reportType,
  projectKey,
  createdAt,
  heroSubtitle,
  candidateCount,
  runRoot,
  stats = [],
  recommendations,
  candidates,
  sections,
  agentPayloadScript = "",
  modeOptions = [],
  layerOptions = []
}) {
  const orderedStats = [
    ...stats.filter((s) => s.primary !== false),
    ...stats.filter((s) => s.primary === false)
  ];
  const recommendationsPanel = recommendations?.length
    ? `<section class="section-preview accent-magenta" id="recommendations" data-nav-section>
      <div class="section-head">
        <div class="title">
          <h2><span class="marker"></span>Erste Empfehlungen</h2>
          <div class="sub">Staerkste Kandidaten aus diesem Lauf</div>
        </div>
        <div class="head-actions"><span class="count-chip">${recommendations.length} Zeilen</span></div>
      </div>
      <div class="section-body">
        ${renderTopRecommendations(recommendations, candidates)}
      </div>
    </section>`
    : "";
  const statsPanel = `<section class="group" id="stats" data-nav-section>
      <div class="group-head">
        <h3>Kennzahlen</h3>
      </div>
      <div class="preview">
        ${renderHtmlStatCards(orderedStats)}
      </div>
    </section>`;
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  ${COCKPIT_NIGHT_FONTS_HEAD}
  <style>
${COCKPIT_NIGHT_BASE_CSS}

/* === Report-spezifische Add-ons (JS-abhaengige Klassen + Helpers) === */
.hidden-by-filter { display: none !important; }

.scroll-progress {
  position: fixed;
  top: 0; left: 0;
  height: 2px;
  width: 0%;
  background: linear-gradient(90deg, var(--neon-magenta), var(--neon-orange));
  box-shadow: 0 0 12px rgba(255,61,151,0.5);
  z-index: 200;
  transition: width 0.1s linear;
}

.grain { display: block; }

.filter-indicator {
  display: none;
  padding: 10px 18px;
  margin: 14px 36px 0;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule);
  border-radius: 6px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--card-ink-soft);
}
.filter-indicator.active { display: block; }

.reveal {
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 0.6s ease, transform 0.6s ease;
}
.reveal.in-view {
  opacity: 1;
  transform: translateY(0);
}

/* Agent field helpers */
.agent-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 14px 0 12px;
}
.agent-action-button {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
  padding: 9px 14px;
  background: transparent;
  border: 1px solid var(--card-rule);
  border-radius: 6px;
  color: var(--card-ink-soft);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.agent-action-button:hover {
  border-color: var(--neon-magenta);
  color: var(--neon-magenta);
  background: rgba(255,61,151,0.06);
}
.agent-json {
  margin-top: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
}
.agent-json summary {
  cursor: pointer;
  color: var(--card-ink-muted);
  padding: 6px 0;
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  font-weight: 600;
}
.agent-json summary:hover { color: var(--neon-magenta); }
.agent-pre {
  margin-top: 10px;
  padding: 16px;
  background: var(--card-bg-alt);
  border: 1px solid var(--card-rule);
  border-radius: 8px;
  color: var(--card-ink);
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 420px;
  overflow: auto;
}

/* Sticky-nav JS toggles .visible -- legacy, now no-op (sidenav is always visible) */
.sidenav.visible { display: block; }

/* Print rules now live centrally in COCKPIT_NIGHT_PRINT_CSS (tokens.mjs) */
  </style>
</head>
<body>
  <svg class="grain" aria-hidden="true" style="position:fixed;inset:0;width:100%;height:100%;opacity:0.022;pointer-events:none;z-index:9999;mix-blend-mode:overlay"><filter id="g"><feTurbulence baseFrequency="0.55" numOctaves="4" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#g)"/></svg>
  <div class="scroll-progress" id="scroll-progress"></div>
  <div class="shell">
    ${renderStickyNav(sections)}
    <main class="wrap page" id="top">
      ${renderHeroSection({ reportType, projectKey, createdAt, subtitle: heroSubtitle, candidateCount })}

      <div class="section-break"></div>

      ${renderReportContentIntro({ reportType, projectKey, createdAt, heroSubtitle, candidateCount, runRoot })}

      ${renderReportToolbar({ modeOptions, layerOptions })}

      <section class="report-overview" id="overview">
        ${statsPanel}
        ${renderDecisionSummary({ candidates, reportType, runRoot })}
        ${recommendationsPanel}
        ${renderRecommendedActions({ candidates, reportType, runRoot })}
      </section>

      <div class="sections">
        ${sections.map((section) => {
          if (section.collapsible) {
            return renderCollapsibleSection(section.title, section.body, {
              tone: section.tone ?? "default",
              sectionId: section.id ?? slugifyForId(section.title),
              navLabel: section.navLabel ?? "",
              collapsed: section.collapsed ?? false
            });
          }
          return renderHtmlSection(section.title, section.body, section.tone ?? "default", section.id ?? slugifyForId(section.title));
        }).join("\n")}
      </div>

      <footer class="report-footer">
        <img src="${LOGO_BASE64}" alt="Patternpilot">
        <p>Erzeugt mit Patternpilot &mdash; Repository-Intelligenz-System</p>
      </footer>
    </main>
  </div>
  ${renderInfoDialog({})}
  ${agentPayloadScript ? `<script type="application/json" id="patternpilot-agent-payload">${agentPayloadScript}</script>` : ""}
  <script>
(() => {
  /* ---- Filters ---- */
  const searchInput = document.getElementById("report-search");
  const fitSelect = document.getElementById("report-fit");
  const modeSelect = document.getElementById("report-mode");
  const layerSelect = document.getElementById("report-layer");
  const resetButton = document.getElementById("report-reset");
  const cards = Array.from(document.querySelectorAll(".filter-card"));
  const rows = Array.from(document.querySelectorAll(".data-table tbody tr"));
  const indicator = document.getElementById("filter-indicator");
  const totalCount = cards.length;

  const applyFilters = () => {
    const search = (searchInput?.value || "").trim().toLowerCase();
    const fit = (fitSelect?.value || "").toLowerCase();
    const mode = (modeSelect?.value || "").toLowerCase();
    const layer = (layerSelect?.value || "").toLowerCase();

    const matches = (node, rowSearch) => {
      const text = (node.dataset.search || rowSearch || "").toLowerCase();
      const fitVal = node.dataset.fit || "";
      const modeVal = node.dataset.mode || "";
      const layerVal = node.dataset.layer || "";
      return (!search || text.includes(search))
        && (!fit || fitVal === fit)
        && (!mode || modeVal === mode)
        && (!layer || layerVal === layer);
    };

    let visibleCount = 0;
    cards.forEach((card) => {
      const visible = matches(card, "");
      card.classList.toggle("hidden-by-filter", !visible);
      if (visible) visibleCount++;
    });

    rows.forEach((row) => {
      const firstCell = row.querySelector("td");
      const fitVal = row.children[3]?.textContent?.toLowerCase() || "";
      const layerVal = row.children[1]?.textContent?.toLowerCase() || "";
      const modeVal = row.children[2]?.textContent?.toLowerCase() || "";
      const rowSearch = [firstCell?.dataset.search || "", row.textContent || ""].join(" ").toLowerCase();
      const pseudoNode = {
        dataset: {
          search: rowSearch,
          fit: fitVal.includes("high") ? "high" : fitVal.includes("medium") ? "medium" : fitVal.includes("low") ? "low" : "unknown",
          mode: modeVal,
          layer: layerVal
        }
      };
      row.classList.toggle("hidden-by-filter", !matches(pseudoNode, rowSearch));
    });

    if (indicator) {
      const hasFilter = search || fit || mode || layer;
      indicator.classList.toggle("active", hasFilter);
      if (hasFilter) {
        indicator.textContent = "Gefiltert: " + visibleCount + " von " + totalCount + " Kandidatenkarten sichtbar";
      } else {
        indicator.textContent = "";
      }
    }
  };

  [searchInput, fitSelect, modeSelect, layerSelect].forEach((n) => {
    n?.addEventListener("input", applyFilters);
    n?.addEventListener("change", applyFilters);
  });
  resetButton?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (fitSelect) fitSelect.value = "";
    if (modeSelect) modeSelect.value = "";
    if (layerSelect) layerSelect.value = "";
    applyFilters();
  });
  applyFilters();

  /* ---- Scroll Reveal ---- */
  const revealTargets = document.querySelectorAll(".section-card, .repo-card, .coverage-card, .stat-card, .rec-card");
  revealTargets.forEach((el) => el.classList.add("reveal"));

  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("in-view");
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });

  requestAnimationFrame(() => {
    revealTargets.forEach((el) => {
      const idx = Array.from(el.parentElement?.children || []).indexOf(el);
      el.style.transitionDelay = Math.min(idx * 0.07, 0.28) + "s";
      revealObserver.observe(el);
    });
  });

  /* ---- Counter Animation ---- */
  const counters = document.querySelectorAll(".stat-value[data-count]");
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.dataset.count, 10);
      if (!Number.isFinite(target)) return;
      counterObserver.unobserve(el);
      const duration = 1200;
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.round(ease * target);
        if (t < 1) requestAnimationFrame(tick);
      };
      el.textContent = "0";
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.3 });
  counters.forEach((el) => counterObserver.observe(el));

  /* ---- Bar Fill Animation ---- */
  const barFills = document.querySelectorAll(".bar-fill[data-width]");
  const barObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.style.width = entry.target.dataset.width + "%";
      barObserver.unobserve(entry.target);
    });
  }, { threshold: 0.1 });
  barFills.forEach((el) => barObserver.observe(el));

  /* ---- Sticky Nav ---- */
  const hero = document.getElementById("hero");
  const stickyNav = document.getElementById("sticky-nav");
  if (hero && stickyNav) {
    const heroObserver = new IntersectionObserver(([entry]) => {
      stickyNav.classList.toggle("visible", !entry.isIntersecting);
    }, { threshold: 0 });
    heroObserver.observe(hero);
  }

  /* ---- Scroll Progress ---- */
  const progressBar = document.getElementById("scroll-progress");
  if (progressBar) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const scrollTop = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          progressBar.style.width = docHeight > 0 ? (scrollTop / docHeight * 100) + "%" : "0%";
          ticking = false;
        });
        ticking = true;
      }
    });
  }

  /* ---- Collapsible Sections ---- */
  document.querySelectorAll(".section-card.collapsible .section-head").forEach((head) => {
    head.addEventListener("click", () => {
      const card = head.closest(".section-card");
      const body = card.querySelector(".section-body");
      if (card.classList.contains("collapsed")) {
        body.style.maxHeight = body.scrollHeight + "px";
        card.classList.remove("collapsed");
      } else {
        body.style.maxHeight = body.scrollHeight + "px";
        requestAnimationFrame(() => {
          body.style.maxHeight = "0px";
          card.classList.add("collapsed");
        });
      }
    });
  });

  /* Initialize collapsible max-heights */
  document.querySelectorAll(".section-card.collapsible:not(.collapsed) .section-body").forEach((body) => {
    body.style.maxHeight = body.scrollHeight + "px";
  });
  document.querySelectorAll(".section-card.collapsible details").forEach((details) => {
    details.addEventListener("toggle", () => {
      const body = details.closest(".section-card")?.querySelector(".section-body");
      if (!body) return;
      requestAnimationFrame(() => {
        body.style.maxHeight = body.scrollHeight + "px";
      });
    });
  });

  /* ---- Hero logo glow pulse after entrance ---- */
  const heroLogo = document.querySelector(".hero-logo");
  if (heroLogo) {
    heroLogo.addEventListener("animationend", () => {
      heroLogo.classList.add("animated");
    }, { once: true });
  }

  /* ---- Info Buttons ---- */
  const infoMap = {
    "kennzahlen": "Hier siehst du die verdichteten Grundzahlen dieses Laufs auf einen Blick. Der Block ist bewusst kompakt, damit du sofort erkennst, wie breit der Bericht ist, wie frisch er wirkt und wie viel Material dahintersteht.",
    "stats": "Hier siehst du die verdichteten Grundzahlen dieses Laufs auf einen Blick. Der Block ist bewusst kompakt, damit du sofort erkennst, wie breit der Bericht ist, wie frisch er wirkt und wie viel Material dahintersteht.",
    "erste empfehlungen": "Dieser Block ist deine schnellste Einstiegsspur in den Bericht. Hier stehen nicht alle Details, sondern die wenigen Repos oder Laufhinweise, mit denen du sinnvoll anfangen solltest. Lies ihn als Priorisierung fuer den ersten Blick, nicht als endgueltige Entscheidung.",
    "erste empfehlung": "Dieser Block ist deine schnellste Einstiegsspur in den Bericht. Hier stehen nicht alle Details, sondern die wenigen Repos oder Laufhinweise, mit denen du sinnvoll anfangen solltest. Lies ihn als Priorisierung fuer den ersten Blick, nicht als endgueltige Entscheidung.",
    "recommendations": "Dieser Block ist deine schnellste Einstiegsspur in den Bericht. Hier stehen nicht alle Details, sondern die wenigen Repos oder Laufhinweise, mit denen du sinnvoll anfangen solltest. Lies ihn als Priorisierung fuer den ersten Blick, nicht als endgueltige Entscheidung.",
    "entscheidungsuebersicht": "Die Entscheidungsuebersicht ist die verdichtete Kernaussage dieses kompletten Laufs. Hier siehst du, wohin der Bericht insgesamt kippt, welches Repo oder welcher Schritt vorne liegt und unter welchem Vertrauensniveau du das lesen solltest. Dieser Block ist also deine Lageeinschaetzung, bevor du in die einzelnen Karten gehst.",
    "decision-summary": "Die Entscheidungsuebersicht ist die verdichtete Kernaussage dieses kompletten Laufs. Hier siehst du, wohin der Bericht insgesamt kippt, welches Repo oder welcher Schritt vorne liegt und unter welchem Vertrauensniveau du das lesen solltest. Dieser Block ist also deine Lageeinschaetzung, bevor du in die einzelnen Karten gehst.",
    "empfohlene aktionen": "Hier gruppiert Patternpilot die Kandidaten nach Handlungstyp statt nur nach Rang. Dadurch wird klarer, was jetzt uebernommen, was vertieft, was beobachtet und was bewusst zurueckgestellt werden sollte.",
    "recommended-actions": "Hier gruppiert Patternpilot die Kandidaten nach Handlungstyp statt nur nach Rang. Dadurch wird klarer, was jetzt uebernommen, was vertieft, was beobachtet und was bewusst zurueckgestellt werden sollte.",
    "staerkste vergleichs-repos": "Hier beginnt die eigentliche Vergleichsarbeit dieses Reports. Jede Karte verdichtet pro Repo, warum es relevant ist, was du daraus mitnehmen kannst und wo Risiken oder Grenzen liegen. Wenn du Muster uebernehmen, gegeneinander abwaegen oder bewusst verwerfen willst, triffst du die Entscheidung in diesem Bereich.",
    "staerkste vergleich repos": "Hier beginnt die eigentliche Vergleichsarbeit dieses Reports. Jede Karte verdichtet pro Repo, warum es relevant ist, was du daraus mitnehmen kannst und wo Risiken oder Grenzen liegen. Wenn du Muster uebernehmen, gegeneinander abwaegen oder bewusst verwerfen willst, triffst du die Entscheidung in diesem Bereich.",
    "top-compared-repositories": "Hier beginnt die eigentliche Vergleichsarbeit dieses Reports. Jede Karte verdichtet pro Repo, warum es relevant ist, was du daraus mitnehmen kannst und wo Risiken oder Grenzen liegen. Wenn du Muster uebernehmen, gegeneinander abwaegen oder bewusst verwerfen willst, triffst du die Entscheidung in diesem Bereich.",
    "abdeckung und signale": "Dieser Bereich macht sichtbar, welche Ebenen, Lueckenbereiche und Faehigkeiten der aktuelle Bericht tatsaechlich beruehrt. So erkennst du, ob der Lauf ausgewogen ist oder ob wichtige Themen trotz vieler Karten noch unterbelichtet bleiben.",
    "coverage": "Dieser Bereich macht sichtbar, welche Ebenen, Lueckenbereiche und Faehigkeiten der aktuelle Bericht tatsaechlich beruehrt. So erkennst du, ob der Lauf ausgewogen ist oder ob wichtige Themen trotz vieler Karten noch unterbelichtet bleiben.",
    "umfang des laufs": "Dieser Bereich zeigt, auf welcher Basis der Bericht entstanden ist. Du siehst hier, welche URLs wirklich im Lauf waren, ob der Fokus auf expliziten Repos oder auf der Watchlist lag und wie belastbar die Entscheidungsdaten dazu sind. Damit kannst du einschaetzen, wie breit du die Aussagen dieses Reports lesen solltest.",
    "run-scope": "Dieser Bereich zeigt, auf welcher Basis der Bericht entstanden ist. Du siehst hier, welche URLs wirklich im Lauf waren, ob der Fokus auf expliziten Repos oder auf der Watchlist lag und wie belastbar die Entscheidungsdaten dazu sind. Damit kannst du einschaetzen, wie breit du die Aussagen dieses Reports lesen solltest.",
    "review-umfang": "Hier siehst du, in welchem konkreten Review-Rahmen Patternpilot gearbeitet hat. Der Block trennt zwischen explizit uebergebenen Repos und Watchlist-Kontext, damit du die Aussagekraft des Vergleichs besser einordnen kannst.",
    "review-scope": "Hier siehst du, in welchem konkreten Review-Rahmen Patternpilot gearbeitet hat. Der Block trennt zwischen explizit uebergebenen Repos und Watchlist-Kontext, damit du die Aussagekraft des Vergleichs besser einordnen kannst.",
    "ki coding agents": "Diese Sicht ist die verdichtete Uebergabe fuer KI Coding Agents. Sie kombiniert Arbeitsauftrag, priorisierte Repos, Kontext, Leitplanken, Unsicherheiten und das maschinenlesbare Snapshot in einer Form, die direkt weiterverarbeitet werden kann.",
    "agent-view": "Diese Sicht ist die verdichtete Uebergabe fuer KI Coding Agents. Sie kombiniert Arbeitsauftrag, priorisierte Repos, Kontext, Leitplanken, Unsicherheiten und das maschinenlesbare Snapshot in einer Form, die direkt weiterverarbeitet werden kann.",
    "zielrepo-kontext": "Der Zielrepo-Kontext zeigt, worauf Patternpilot alle Vergleiche bezieht. Dadurch werden Kandidaten nicht isoliert bewertet, sondern immer gegen die echten Dateien, Strukturen und Faehigkeiten des Zielprojekts gelesen.",
    "target-repo-context": "Der Zielrepo-Kontext zeigt, worauf Patternpilot alle Vergleiche bezieht. Dadurch werden Kandidaten nicht isoliert bewertet, sondern immer gegen die echten Dateien, Strukturen und Faehigkeiten des Zielprojekts gelesen.",
    "staerkste risikosignale": "Hier stehen die staerksten Warnsignale aus dem aktuellen Vergleich. Der Block zeigt nicht einfach schlechte Repos, sondern die Stellen, an denen Unsicherheit, operative Risiken oder fehlende Tiefe vor einer Uebernahme geklaert werden sollten. Lies ihn als Pruefliste fuer manuelle Nacharbeit, bevor du eine Richtung festziehst.",
    "highest-risk-signals": "Hier stehen die staerksten Warnsignale aus dem aktuellen Vergleich. Der Block zeigt nicht einfach schlechte Repos, sondern die Stellen, an denen Unsicherheit, operative Risiken oder fehlende Tiefe vor einer Uebernahme geklaert werden sollten. Lies ihn als Pruefliste fuer manuelle Nacharbeit, bevor du eine Richtung festziehst.",
    "fehlendes intake fuer watchlist": "Dieses Feld markiert Watchlist-Repos, fuer die noch keine frische Intake-Basis vorliegt. Solche Luecken schwaechen spaetere Vergleiche und sollten vor groesseren Uebernahme- oder Promotionsentscheidungen geschlossen werden.",
    "fehlendes intake fuer auswahl": "Dieser Bereich markiert Repos aus deiner expliziten Auswahl, fuer die noch keine frische Intake-Grundlage vorliegt. Patternpilot kann sie damit schon sehen, aber noch nicht so belastbar bewerten wie vollstaendig eingelesene Kandidaten. Wenn hier Eintraege stehen, solltest du zuerst Intake nachziehen und erst danach ueber Promotion oder Uebernahme entscheiden.",
    "missing-watchlist-intake": "Dieser Bereich markiert Repos, fuer die im aktuellen Vergleich noch die frische Intake-Grundlage fehlt. Solange diese Basis offen ist, bleiben Bewertungen und Folgeentscheidungen vorsichtiger als bei vollstaendig eingelesenen Kandidaten. Lies die Liste deshalb als Hinweis, wo du vor dem naechsten belastbaren Vergleich erst Daten nachziehen solltest.",
    "repo-matrix": "Die Repo-Matrix ist die verdichtete Queransicht ueber alle verglichenen Kandidaten. Sie eignet sich besonders, wenn du mehrere Repos systematisch entlang derselben Kriterien gegeneinander abgleichen willst.",
    "laufzusammenfassung": "Die Laufzusammenfassung ist die kompakteste Lesart des gesamten Ad-hoc-Laufs. Sie verbindet Modus, Phasenstatus und Datenqualitaet, damit du den operativen Zustand vor dem Detailblick verstehst.",
    "run-summary": "Die Laufzusammenfassung ist die kompakteste Lesart des gesamten Ad-hoc-Laufs. Sie verbindet Modus, Phasenstatus und Datenqualitaet, damit du den operativen Zustand vor dem Detailblick verstehst.",
    "wirksame urls": "Hier stehen die Repository-URLs, die in diesem Lauf tatsaechlich ausgewertet wurden. Das ist deine wichtigste Kontrollstelle, wenn du nachvollziehen willst, worauf sich der Bericht konkret stuetzt.",
    "effective-urls": "Hier stehen die Repository-URLs, die in diesem Lauf tatsaechlich ausgewertet wurden. Das ist deine wichtigste Kontrollstelle, wenn du nachvollziehen willst, worauf sich der Bericht konkret stuetzt.",
    "artefakte": "Dieser Bereich verlinkt die wichtigsten Ausgaben des Laufs als konkrete Dateien. Er ist die Bruecke vom gelesenen Bericht zu den weiterverwendbaren Artefakten wie HTML, Metadaten, Browser-Zeiger oder Agent Hand-Off.",
    "artifacts": "Dieser Bereich verlinkt die wichtigsten Ausgaben des Laufs als konkrete Dateien. Er ist die Bruecke vom gelesenen Bericht zu den weiterverwendbaren Artefakten wie HTML, Metadaten, Browser-Zeiger oder Agent Hand-Off.",
    "bericht filtern": "Bericht filtern ist dein Arbeitswerkzeug fuer grosse oder dichte Reports. Statt den ganzen Bericht erneut zu scannen, kannst du hier gezielt nach Repos, Ebenen oder Passungsstufen eingrenzen und so schneller an die relevante Teilmenge springen. Dieser Block veraendert nichts am Ergebnis, sondern nur deinen Blick auf den Bericht.",
    "report-toolbar": "Bericht filtern ist dein Arbeitswerkzeug fuer grosse oder dichte Reports. Statt den ganzen Bericht erneut zu scannen, kannst du hier gezielt nach Repos, Ebenen oder Passungsstufen eingrenzen und so schneller an die relevante Teilmenge springen. Dieser Block veraendert nichts am Ergebnis, sondern nur deinen Blick auf den Bericht.",
    "laufplan": "Der Laufplan zeigt, welche Standardform Patternpilot fuer diesen Modus vorsieht. Damit wird deutlicher, wie Intake, Review, Drift, Stabilitaet und Folgeaktionen in einem gesunden Ablauf zusammenspielen sollen.",
    "run-plan": "Der Laufplan zeigt, welche Standardform Patternpilot fuer diesen Modus vorsieht. Damit wird deutlicher, wie Intake, Review, Drift, Stabilitaet und Folgeaktionen in einem gesunden Ablauf zusammenspielen sollen.",
    "laufdrift": "Laufdrift zeigt, ob sich dieser Lauf noch in der erwarteten Form bewegt oder ob operative Abweichungen zunehmen. Das ist wichtig, damit ein Bericht nicht stabiler oder eindeutiger wirkt, als er es in Wirklichkeit ist.",
    "run-drift": "Laufdrift zeigt, ob sich dieser Lauf noch in der erwarteten Form bewegt oder ob operative Abweichungen zunehmen. Das ist wichtig, damit ein Bericht nicht stabiler oder eindeutiger wirkt, als er es in Wirklichkeit ist.",
    "stabilitaet": "Dieser Block verdichtet, wie stabil vergleichbare juengere Laeufe zuletzt waren. Er hilft dir, Ergebnisse mit dem passenden Mass an Vertrauen oder Vorsicht weiterzuverarbeiten.",
    "run-stability": "Dieser Block verdichtet, wie stabil vergleichbare juengere Laeufe zuletzt waren. Er hilft dir, Ergebnisse mit dem passenden Mass an Vertrauen oder Vorsicht weiterzuverarbeiten.",
    "governance": "Governance zeigt, wie stark Regeln, manuelle Gates und Automatik im aktuellen Zustand eingreifen. Ein Agent oder Mensch sollte diesen Bereich beachten, bevor aus dem Bericht direkte Folgeaktionen abgeleitet werden.",
    "run-governance": "Governance zeigt, wie stark Regeln, manuelle Gates und Automatik im aktuellen Zustand eingreifen. Ein Agent oder Mensch sollte diesen Bereich beachten, bevor aus dem Bericht direkte Folgeaktionen abgeleitet werden.",
    "was jetzt": "Das ist der kompakteste Ausblick auf die direkt sinnvollen Folgeaktionen. Der Block uebersetzt den Bericht bewusst in einen klaren naechsten Schritt, statt ihn nur zusammenzufassen."
    ,"what-now": "Das ist der kompakteste Ausblick auf die direkt sinnvollen Folgeaktionen. Der Block uebersetzt den Bericht bewusst in einen klaren naechsten Schritt, statt ihn nur zusammenzufassen."
    ,"kandidatenuebersicht": "Diese Uebersicht zeigt die sichtbar gebliebenen Discovery-Kandidaten in ihrer Kartenform. Sie ist die schnellste Stelle, um zu sehen, welche Repos nach Suche, Regelwerk und Erstgewichtung wirklich uebrig bleiben.",
    "candidate-overview": "Diese Uebersicht zeigt die sichtbar gebliebenen Discovery-Kandidaten in ihrer Kartenform. Sie ist die schnellste Stelle, um zu sehen, welche Repos nach Suche, Regelwerk und Erstgewichtung wirklich uebrig bleiben.",
    "discovery-linsen": "Hier siehst du, aus welchen Suchlinsen oder Query-Familien dieser Lauf aufgebaut wurde. Der Bereich hilft vor allem dann, wenn du verstehen willst, warum bestimmte Repo-Arten ueberhaupt in die Kandidatenmenge geraten sind.",
    "discovery-lenses": "Hier siehst du, aus welchen Suchlinsen oder Query-Familien dieser Lauf aufgebaut wurde. Der Bereich hilft vor allem dann, wenn du verstehen willst, warum bestimmte Repo-Arten ueberhaupt in die Kandidatenmenge geraten sind.",
    "discovery-regelwerk": "Dieses Feld zeigt, wie stark das aktuelle Regelwerk in den Discovery-Lauf eingegriffen hat. Du erkennst hier, ob Kandidaten nur sichtbar geblieben, bewusst markiert oder vom Regelwerk schon aktiv in eine Richtung gedrueckt wurden.",
    "discovery-policy": "Dieses Feld zeigt, wie stark das aktuelle Regelwerk in den Discovery-Lauf eingegriffen hat. Du erkennst hier, ob Kandidaten nur sichtbar geblieben, bewusst markiert oder vom Regelwerk schon aktiv in eine Richtung gedrueckt wurden.",
    "regel-kalibrierung": "Die Regel-Kalibrierung zeigt, wo dein aktuelles Discovery-Regelwerk noch nachgeschaerft werden sollte. Sie ist besonders wertvoll, wenn du zwar Treffer bekommst, aber das Verhaeltnis zwischen Rauschen und wirklich brauchbaren Kandidaten noch nicht stimmt.",
    "policy-calibration": "Die Regel-Kalibrierung zeigt, wo dein aktuelles Discovery-Regelwerk noch nachgeschaerft werden sollte. Sie ist besonders wertvoll, wenn du zwar Treffer bekommst, aber das Verhaeltnis zwischen Rauschen und wirklich brauchbaren Kandidaten noch nicht stimmt.",
    "suchfehler": "Hier landen technische oder inhaltliche Fehler aus der Discovery-Suche selbst. Der Bereich ist wichtig, damit ein schwacher Lauf nicht faelschlich wie eine schlechte Kandidatenlage aussieht, obwohl in Wahrheit die Suche eingeschraenkt war.",
    "search-errors": "Hier landen technische oder inhaltliche Fehler aus der Discovery-Suche selbst. Der Bereich ist wichtig, damit ein schwacher Lauf nicht faelschlich wie eine schlechte Kandidatenlage aussieht, obwohl in Wahrheit die Suche eingeschraenkt war."
  };

  const normalizeInfoKey = (value) => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9äöüß/ -]+/g, " ")
    .replace(/\\s+/g, " ")
    .trim()
    .replaceAll("ä", "ae")
    .replaceAll("ö", "oe")
    .replaceAll("ü", "ue")
    .replaceAll("ß", "ss");

  const getInfoText = (label, sectionId = "") => {
    const sectionKey = normalizeInfoKey(sectionId);
    const labelKey = normalizeInfoKey(label);
    return infoMap[labelKey] || infoMap[sectionKey] || "Kurzinfo: Dieses Feld erklaert, wie Patternpilot diese Stelle im Bericht einordnet.";
  };

  const closeInfoPopovers = (exceptButton = null) => {
    document.querySelectorAll(".info-button[aria-expanded='true']").forEach((button) => {
      if (button === exceptButton) return;
      button.setAttribute("aria-expanded", "false");
    });
    const modal = document.getElementById("info-modal");
    if (modal) modal.dataset.open = "false";
  };

  const infoModal = document.createElement("div");
  infoModal.id = "info-modal";
  infoModal.className = "info-modal";
  infoModal.dataset.open = "false";
  infoModal.innerHTML = '<div class="info-modal-backdrop"></div><div class="info-modal-card" role="dialog" aria-modal="true" aria-labelledby="info-modal-title"><div class="info-modal-kicker">Kurz erklaert</div><h3 class="info-modal-title" id="info-modal-title"></h3><p class="info-modal-copy" id="info-modal-copy"></p><button type="button" class="info-modal-close" id="info-modal-close">Schliessen</button></div>';
  document.body.append(infoModal);

  const infoModalTitle = infoModal.querySelector("#info-modal-title");
  const infoModalCopy = infoModal.querySelector("#info-modal-copy");
  const infoModalClose = infoModal.querySelector("#info-modal-close");

  const openInfoModal = (label, button) => {
    closeInfoPopovers(button);
    infoModalTitle.textContent = label;
    infoModalCopy.textContent = getInfoText(label, button.dataset.infoSectionId || "");
    infoModal.dataset.open = "true";
    button.setAttribute("aria-expanded", "true");
  };

  const attachInfoButton = (element) => {
    if (!element || element.dataset.infoAttached === "true") return;
    const label = (element.textContent || "").trim();
    if (!label) return;

    const wrapper = document.createElement("span");
    wrapper.className = "heading-with-info";

    const text = document.createElement("span");
    text.className = "heading-text";
    text.textContent = label;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "info-button";
    button.textContent = "i";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Informationen zu " + label);
    button.dataset.infoSectionId = element.closest(".panel-card, .section-card")?.id || "";

    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const willOpen = button.getAttribute("aria-expanded") !== "true";
      if (!willOpen) {
        closeInfoPopovers();
        return;
      }
      openInfoModal(label, button);
    });

    element.textContent = "";
    wrapper.append(text, button);
    element.append(wrapper);
    element.dataset.infoAttached = "true";
  };

  document.querySelectorAll(".panel-card .section-head h2, .section-card .section-head h2").forEach(attachInfoButton);

  infoModal.querySelector(".info-modal-backdrop")?.addEventListener("click", () => closeInfoPopovers());
  infoModalClose?.addEventListener("click", () => closeInfoPopovers());

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".heading-with-info") && !event.target.closest(".info-modal-card")) {
      closeInfoPopovers();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeInfoPopovers();
    }
  });

  const readAgentPayload = () => {
    const script = document.getElementById("patternpilot-agent-payload");
    if (!script?.textContent) return null;
    try {
      return JSON.parse(script.textContent);
    } catch (error) {
      console.error("Patternpilot: Agent payload konnte nicht gelesen werden.", error);
      return null;
    }
  };

  const createAgentBlobUrl = () => {
    const payload = readAgentPayload();
    if (!payload) return null;
    return URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2) + "\\n"], { type: "application/json" }));
  };

  document.querySelectorAll(".agent-action-button").forEach((button) => {
    button.addEventListener("click", () => {
      const blobUrl = createAgentBlobUrl();
      if (!blobUrl) return;

      if (button.dataset.agentAction === "open") {
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
        return;
      }

      if (button.dataset.agentAction === "download") {
        const anchor = document.createElement("a");
        anchor.href = blobUrl;
        anchor.download = button.dataset.agentFilename || "patternpilot-agent-handoff.json";
        document.body.append(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1_000);
      }
    });
  });
})();
  </script>
  <script>
${INFO_DIALOG_SCRIPT}
  </script>
</body>
</html>`;
}
