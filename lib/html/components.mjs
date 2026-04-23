// lib/html/components.mjs
//
// Cockpit Night visual primitives. Pure HTML-emitting functions with flat props.
// No dependency on sections.mjs / shared.mjs — UI-2 will write the adapter
// layer that maps report data shapes onto these primitives.
//
// Grouped into two families:
//   - Layout primitives     (hero, section-break, content-intro, sidenav,
//                           info-button, info-dialog, INFO_DIALOG_SCRIPT)
//   - Data-display primitives (stat-card, stat-grid, meta-grid,
//                             section-card, repo-row, axis-row)
//
// Every function is prop-first: no hidden couplings, no report-shape knowledge.

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Layout primitives -----------------------------------------------------

export function renderCockpitHero({ title = "Pattern", pilotWord = "Pilot", slogan = "" } = {}) {
  const safeTitle = escapeHtml(title);
  const safePilot = escapeHtml(pilotWord);
  const sloganFragment = slogan
    ? `<p class="slogan">${escapeHtml(slogan)}</p>`
    : "";
  return `<section class="hero">
  <h1>${safeTitle}<br><span class="pilot">${safePilot}</span></h1>
  ${sloganFragment}
</section>`;
}

export function renderSectionBreak() {
  return `<div class="section-break"></div>`;
}

export function renderContentIntro({
  eyebrow,
  subject,
  subjectId = "",
  meta = [],
  actions = "",
  infoPanel = null
} = {}) {
  const subjectIdFragment = subjectId
    ? `<div class="subject-id">${escapeHtml(subjectId)}</div>`
    : "";
  const metaFragment = renderIntroMeta(meta);
  const actionsFragment = actions
    ? `<div class="intro-actions">${actions}</div>`
    : "";
  const panelFragment = renderInfoPanel(infoPanel);
  const sectionIdAttr = infoPanel?.id
    ? ` id="${escapeHtml(infoPanel.id)}" data-nav-section`
    : "";
  return `<section class="content-intro"${sectionIdAttr}>
  <div class="eyebrow">${escapeHtml(eyebrow ?? "")}</div>
  <h2 class="subject">${escapeHtml(subject ?? "")}</h2>
  ${subjectIdFragment}
  ${metaFragment}
  ${actionsFragment}
  ${panelFragment}
</section>`;
}

function renderIntroMeta(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const parts = [];
  items.forEach((item, index) => {
    if (index > 0) {
      parts.push(`<span class="sep">·</span>`);
    }
    const cls = item && typeof item === "object" && item.accent ? ` class="accent"` : "";
    const label = item && typeof item === "object" ? item.label : item;
    parts.push(`<span${cls}>${escapeHtml(label ?? "")}</span>`);
  });
  return `<div class="meta">${parts.join("\n  ")}</div>`;
}

function renderInfoPanel(panel) {
  if (!panel || !panel.id || !panel.bodyHtml) return "";
  return `<div class="info-panel" hidden data-info-panel="${escapeHtml(panel.id)}">
    ${panel.bodyHtml}
  </div>`;
}

export function renderSidenav({ logoSrc, logoAlt = "Pattern Pilot", eyebrow = "Inhalt", items = [] } = {}) {
  const logoFragment = logoSrc
    ? `<a href="#top" class="sidenav-logo-link" aria-label="Zum Seitenanfang">
      <img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(logoAlt)}" class="sidenav-logo">
    </a>`
    : "";
  const links = items
    .map((item, index) => {
      const number = String(index + 1).padStart(2, "0");
      const activeCls = item?.active ? ' class="active"' : "";
      const activeAttr = item?.active ? ' aria-current="location"' : "";
      const href = item?.href ?? `#${item?.id ?? ""}`;
      const label = escapeHtml(item?.label ?? "");
      return `    <li><a href="${escapeHtml(href)}"${activeCls}${activeAttr}><span class="n">${number}</span>${label}</a></li>`;
    })
    .join("\n");
  return `<nav class="sidenav">
  ${logoFragment}
  <div class="sidenav-eyebrow">${escapeHtml(eyebrow)}</div>
  <ul class="sidenav-list">
${links}
  </ul>
</nav>`;
}

export function renderInfoButton({ triggerId, label, darkVariant = false } = {}) {
  const cls = darkVariant ? "dark-info-btn" : "info-btn";
  return `<button type="button" class="${cls}" aria-label="${escapeHtml(label ?? "Info")}" aria-expanded="false" aria-haspopup="dialog" data-info-trigger="${escapeHtml(triggerId ?? "")}">i</button>`;
}

export function renderExplainButton({ title, body, darkVariant = false, label } = {}) {
  if (!title || !body) return "";
  const cls = darkVariant ? "dark-info-btn" : "info-btn";
  const ariaLabel = label ?? `Erklaerung: ${title}`;
  return `<button type="button" class="${cls}" aria-label="${escapeHtml(ariaLabel)}" aria-haspopup="dialog" data-explain-title="${escapeHtml(title)}" data-explain-body="${escapeHtml(body)}">i</button>`;
}

// Section-Beschreibung als inline-collapsible Dropdown (default zu).
// Ersetzt den frueher genutzten Info-Button + Modal-Kombo auf Section-Head.
// Erwartet body-Text (optional mit HTML erlaubt, Caller escapet) + optional
// variant "dark" fuer dunklen Hintergrund (z.B. Hero-naher Content-Intro).
export function renderSectionDescription({ title = "Beschreibung", body, variant } = {}) {
  if (!body) return "";
  const variantClass = variant === "dark" ? " section-description--dark" : "";
  return `<details class="section-description${variantClass}">
  <summary><span class="section-description-label">${escapeHtml(title)}</span></summary>
  <div class="section-description-body">${body}</div>
</details>`;
}

export function renderInfoDialog({ id = "info-modal", closeLabel = "Schliessen" } = {}) {
  const safeId = escapeHtml(id);
  return `<dialog class="info-modal" id="${safeId}" aria-labelledby="${safeId}-title">
  <div class="modal-head">
    <h3 id="${safeId}-title">Info</h3>
    <button class="modal-close" aria-label="${escapeHtml(closeLabel)}">&times;</button>
  </div>
  <div class="modal-body" id="${safeId}-body"></div>
</dialog>`;
}

export const INFO_DIALOG_SCRIPT = `(() => {
  // Tab-Handler fuer renderTabs-Primitives
  document.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const group = btn.getAttribute('data-tab-group');
      const index = btn.getAttribute('data-tab-index');
      if (!group || !index) return;
      document.querySelectorAll('.tab-button[data-tab-group="' + group + '"]').forEach((b) => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });
      document.querySelectorAll('.tab-panel[data-tab-group="' + group + '"]').forEach((p) => {
        p.classList.toggle('active', p.getAttribute('data-tab-index') === index);
      });
    });
  });

  // Empty-Sections-Toggle: Sidenav-Items passend markieren, Body-Klasse default setzen
  const emptySections = document.querySelectorAll('[data-section-empty="true"]');
  emptySections.forEach((sec) => {
    const id = sec.id;
    if (!id) return;
    const navLink = document.querySelector('.sidenav-list a[href="#' + id + '"]');
    if (navLink) navLink.classList.add('nav-hidden-when-empty');
  });
  const emptyToggle = document.getElementById('show-empty-sections-toggle');
  if (emptyToggle) {
    document.body.classList.add('hide-empty-sections');
    emptyToggle.checked = false;
    emptyToggle.addEventListener('change', () => {
      document.body.classList.toggle('hide-empty-sections', !emptyToggle.checked);
    });
  }

  const links = document.querySelectorAll('.sidenav-list a');
  const sections = document.querySelectorAll('[data-nav-section]');
  const setActive = (id) => {
    links.forEach(l => {
      const isActive = l.getAttribute('href') === '#' + id;
      l.classList.toggle('active', isActive);
      if (isActive) l.setAttribute('aria-current', 'location');
      else l.removeAttribute('aria-current');
    });
  };
  if (sections.length && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) setActive(entry.target.id);
      }
    }, { rootMargin: '-30% 0px -60% 0px' });
    sections.forEach(s => observer.observe(s));
  }

  const logoLink = document.querySelector('.sidenav-logo-link');
  if (logoLink) {
    logoLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  const modal = document.getElementById('info-modal');
  if (!modal) return;
  const modalTitle = document.getElementById('info-modal-title');
  const modalBody = document.getElementById('info-modal-body');
  const modalClose = modal.querySelector('.modal-close');

  // Focus management: store the triggering element when modal opens, restore
  // focus to it when modal closes. Improves keyboard-only navigation.
  let lastTrigger = null;
  const openModal = (trigger) => {
    lastTrigger = trigger || null;
    if (typeof modal.showModal === 'function') modal.showModal();
    else modal.setAttribute('open', '');
  };
  modal.addEventListener('close', () => {
    if (lastTrigger && typeof lastTrigger.focus === 'function') {
      lastTrigger.focus();
    }
    lastTrigger = null;
  });

  document.querySelectorAll('[data-info-trigger]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-info-trigger');
      const panel = document.querySelector('[data-info-panel="' + id + '"]');
      if (!panel) return;
      const titleAttr = btn.getAttribute('data-info-title') || modalTitle.textContent;
      modalTitle.textContent = titleAttr;
      modalBody.replaceChildren(...Array.from(panel.cloneNode(true).children));
      openModal(btn);
    });
  });
  // Generic explain-on-click: any element with data-explain-title + data-explain-body
  // opens the info-modal with that content directly (no panel lookup needed).
  document.querySelectorAll('[data-explain-title]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const title = el.getAttribute('data-explain-title') || '';
      const body = el.getAttribute('data-explain-body') || '';
      modalTitle.textContent = title;
      const p = document.createElement('p');
      p.textContent = body;
      modalBody.replaceChildren(p);
      openModal(el);
    });
  });

  if (modalClose) modalClose.addEventListener('click', () => modal.close());
  modal.addEventListener('click', (e) => {
    const rect = modal.getBoundingClientRect();
    const inside = e.clientX >= rect.left && e.clientX <= rect.right
                && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!inside) modal.close();
  });
})();`;

// ---- Data-display primitives ----------------------------------------------

const STAT_ACCENTS = new Set(["magenta", "purple", "orange", "green", "cyan", "mixed"]);

export function renderStatCard({
  key,
  value,
  trend = "",
  variant = "primary",
  accent,
  trendWarn = false
} = {}) {
  const classes = ["stat"];
  if (variant === "meta") classes.push("meta");
  if (accent && STAT_ACCENTS.has(accent)) {
    classes.push(`accent-${accent}`);
  }
  const trendFragment = trend
    ? `<div class="trend${trendWarn ? " warn" : ""}">${escapeHtml(trend)}</div>`
    : "";
  return `<div class="${classes.join(" ")}">
  <div class="k">${escapeHtml(key ?? "")}</div>
  <div class="v">${escapeHtml(value ?? "")}</div>
  ${trendFragment}
</div>`;
}

export function renderStatGrid(cards) {
  if (!Array.isArray(cards) || cards.length === 0) return "";
  const html = cards.map((card) => renderStatCard(card)).join("\n");
  return `<div class="preview">
${html}
</div>`;
}

const SECTION_ACCENTS = new Set(["magenta", "purple", "orange", "green"]);
const BADGE_TONES = new Set(["adopt", "adapt", "observe"]);

export function renderSectionCard({
  id,
  title,
  sub = "",
  countChip = "",
  accent = "magenta",
  infoButton = null,
  bodyHtml = "",
  infoPanel = null
} = {}) {
  const classes = ["section-preview"];
  if (accent && SECTION_ACCENTS.has(accent) && accent !== "magenta") {
    classes.push(`accent-${accent}`);
  } else if (accent === "magenta") {
    classes.push("accent-magenta");
  }
  const idAttr = id ? ` id="${escapeHtml(id)}" data-nav-section` : "";
  const subFragment = sub ? `<div class="sub">${escapeHtml(sub)}</div>` : "";
  const countFragment = countChip
    ? `<span class="count-chip">${escapeHtml(countChip)}</span>`
    : "";
  const infoFragment = infoButton
    ? renderInfoButton({
        triggerId: infoButton.triggerId ?? id ?? "",
        label: infoButton.label,
        darkVariant: infoButton.darkVariant ?? false
      })
    : "";
  const panelFragment = renderInfoPanel(infoPanel);
  return `<div class="${classes.join(" ")}"${idAttr}>
  <div class="section-head">
    <div class="title">
      <h2><span class="marker"></span>${escapeHtml(title ?? "")}</h2>
      ${subFragment}
    </div>
    <div class="head-actions">
      ${countFragment}
      ${infoFragment}
    </div>
  </div>
  ${panelFragment}
  <div class="section-body">
    ${bodyHtml}
  </div>
</div>`;
}

export function renderRepoRow({
  name,
  href = "",
  meta = "",
  decision = null,
  score = null,
  scoreLabel = "Score"
} = {}) {
  const nameFragment = href
    ? `<a class="name" href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(name ?? "")}</a>`
    : `<div class="name">${escapeHtml(name ?? "")}</div>`;
  const metaFragment = meta ? `<div class="meta">${escapeHtml(meta)}</div>` : "";
  const badgeFragment = decision && BADGE_TONES.has(decision.tone)
    ? `<span class="badge ${decision.tone}">${escapeHtml(decision.label ?? decision.tone)}</span>`
    : "";
  const scoreFragment = score != null
    ? `<div class="score-cell">
    <div class="score-label">${escapeHtml(scoreLabel)}</div>
    <div class="score">${escapeHtml(score)}</div>
  </div>`
    : "";
  return `<div class="repo-row">
  <div>
    ${nameFragment}
    ${metaFragment}
  </div>
  ${badgeFragment}
  ${scoreFragment}
</div>`;
}

export function renderAxisRow({ label, percent, valueLabel = "" } = {}) {
  const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
  return `<div class="axis-row">
  <div class="axis-label">${escapeHtml(label ?? "")}</div>
  <div class="axis-track"><div class="axis-fill" style="width: ${safePercent}%;"></div></div>
  <div class="axis-percent">${safePercent}%</div>
  <div class="axis-value">${escapeHtml(valueLabel)}</div>
</div>`;
}

export function renderInfoCard({ title, items = [], copy = "", emptyText = "", link = null, wide = false } = {}) {
  const classes = ["info-card"];
  if (wide) classes.push("wide");
  const titleFragment = title ? `<div class="info-card-title">${escapeHtml(title)}</div>` : "";
  const copyFragment = copy ? `<p class="info-card-copy">${escapeHtml(copy)}</p>` : "";
  const listFragment = Array.isArray(items) && items.length > 0
    ? `<ul class="info-card-list">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
    : (emptyText ? `<p class="info-card-empty">${escapeHtml(emptyText)}</p>` : "");
  const linkFragment = link && link.href
    ? `<a class="info-card-link" href="${escapeHtml(link.href)}"${link.external ? ' target="_blank" rel="noopener noreferrer"' : ""}>${escapeHtml(link.label ?? link.href)}</a>`
    : "";
  return `<div class="${classes.join(" ")}">
  ${titleFragment}
  ${copyFragment}
  ${listFragment}
  ${linkFragment}
</div>`;
}

export function renderInfoGrid(cards, options = {}) {
  if (!Array.isArray(cards) || cards.length === 0) return "";
  const classes = ["info-grid"];
  if (options.variant === "halves") classes.push("info-grid--halves");
  return `<div class="${classes.join(" ")}">
${cards.map((card) => renderInfoCard(card)).join("\n")}
</div>`;
}

// Tabbed content block — stapelt mehrere Unter-Ansichten in einer Section.
// Default: erster Tab aktiv. JS-Handler (im INFO_DIALOG_SCRIPT) schaltet Panels.
let tabGroupCounter = 0;
export function renderTabs(tabs) {
  if (!Array.isArray(tabs) || tabs.length === 0) return "";
  tabGroupCounter += 1;
  const groupId = `tabs-${tabGroupCounter}`;
  const tabButtons = tabs.map((tab, i) => `<button type="button" role="tab" class="tab-button${i === 0 ? " active" : ""}" data-tab-group="${groupId}" data-tab-index="${i}" aria-selected="${i === 0 ? "true" : "false"}">${escapeHtml(tab.label)}</button>`).join("");
  const tabPanels = tabs.map((tab, i) => `<div class="tab-panel${i === 0 ? " active" : ""}" role="tabpanel" data-tab-group="${groupId}" data-tab-index="${i}">${tab.body}</div>`).join("");
  return `<div class="tabs" data-tab-group="${groupId}">
  <div class="tab-list" role="tablist">${tabButtons}</div>
  <div class="tab-panels">${tabPanels}</div>
</div>`;
}

export function renderMetaGrid(items) {
  if (!Array.isArray(items) || items.length === 0) return "";
  const cells = items
    .map((item) => `  <div>
    <div class="k">${escapeHtml(item?.key ?? "")}</div>
    <div class="v">${escapeHtml(item?.value ?? "")}</div>
  </div>`)
    .join("\n");
  return `<div class="meta-grid">
${cells}
</div>`;
}
