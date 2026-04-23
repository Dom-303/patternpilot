// test/html-a11y.test.mjs
//
// Structural a11y gate for the Cockpit-Night report renderers.
// Renders a representative sample for each renderer and asserts on
// accessibility invariants (headings, landmarks, IDs, accessible names,
// keyboard/focus affordances, language-tag, reduced-motion, skip-link).
//
// Operates on the generated HTML strings — no browser required. We own
// the shape of the output and every fixture below exercises a path that
// a real report would also take.

import test from "node:test";
import assert from "node:assert/strict";

import { renderHtmlDocument } from "../lib/html/document.mjs";
import {
  renderDiscoveryCandidateCards,
  renderCoverageCards,
  renderProjectContextSources,
  renderAgentField
} from "../lib/html/sections.mjs";
import { renderLandscapeHtml } from "../lib/landscape/html-report.mjs";

function buildMainReportHtml() {
  const candidate = {
    repo: { owner: "AI-team-UoA", name: "pyJedAI", normalizedRepoUrl: "https://github.com/AI-team-UoA/pyJedAI" },
    discoveryDisposition: "intake_now",
    discoveryScore: 8.4,
    projectAlignment: { fitBand: "high", matchedCapabilities: ["record_linkage"] },
    guess: { mainLayer: "dedupe_identity" },
    gapAreaCanonical: "dedupe_and_identity",
    enrichment: { repo: { description: "Entity resolution toolkit.", topics: ["er"], stars: 1200 }, languages: ["Python"] },
    discoveryEvidence: { grade: "strong", score: 8, topicHits: ["er"] },
    risks: [],
    reasoning: ["stark"],
    queryFamilies: ["er"]
  };
  const reportView = { candidateCount: 3, showMatrix: true };
  return renderHtmlDocument({
    title: "A11y Smoke Render",
    reportType: "discovery",
    projectKey: "eventbear-worker",
    createdAt: "2026-04-23T14:00:00Z",
    heroSubtitle: "balanced",
    candidateCount: 1,
    runRoot: null,
    stats: [
      { label: "Kandidaten", value: 1, primary: true },
      { label: "Risiken", value: 0, primary: true },
      { label: "Profil", value: "balanced", primary: false }
    ],
    recommendations: ["AI-team-UoA/pyJedAI: Basis uebernehmen"],
    candidates: [candidate],
    sections: [
      { id: "candidates", title: "Discovery-Kandidaten", body: renderDiscoveryCandidateCards([candidate], reportView), navLabel: "Kandidaten" },
      { id: "coverage", title: "Coverage", body: renderCoverageCards({ mainLayers: [{ value: "a", count: 3 }], gapAreas: [], capabilities: [] }), navLabel: "Coverage" },
      { id: "agent-view", title: "KI Coding Agents", body: renderAgentField({
        mission: ["m"], deliverable: ["d"], priorityRepos: [], context: [], guardrails: [], uncertainties: [],
        codingStarter: { primary: null, secondary: [] },
        payload: {}, downloadFileName: "x.json"
      }), navLabel: "Agents" },
      { id: "target-repo-context", title: "Zielrepo-Kontext", body: renderProjectContextSources({
        contextSources: { loadedFiles: [], missingFiles: [], scannedDirectories: [], declaredFiles: [], declaredDirectories: [] },
        capabilitiesPresent: []
      }, null), navLabel: "Kontext" }
    ],
    agentPayloadScript: "",
    modeOptions: [],
    layerOptions: []
  });
}

function buildLandscapeHtml() {
  return renderLandscapeHtml({
    problem: { title: "P", slug: "s", project: "proj" },
    landscape: {
      clusters: [{ label: "C", relation: "divergent", member_ids: ["o/r"] }],
      relation_counts: { divergent: 1, adjacent: 0, near_current_approach: 0 },
      axis_view: { dimensions: [{ label: "Latenz", percent: 50, value: "Batch" }] },
      landscape_signal: "x"
    },
    runId: "2026-04-23"
  });
}

function countMatches(html, regex) {
  return Array.from(html.matchAll(regex)).length;
}

function extractAttr(tag, attr) {
  const re = new RegExp(attr + '="([^"]*)"');
  const m = tag.match(re);
  return m ? m[1] : null;
}

function extractAllIds(html) {
  return Array.from(html.matchAll(/ id="([^"]+)"/g)).map((m) => m[1]);
}

// ---- Main-Report a11y ----------------------------------------------------

test("main report: html has lang attribute", () => {
  const html = buildMainReportHtml();
  assert.match(html, /<html lang="de">/);
});

test("main report: sets <title>", () => {
  const html = buildMainReportHtml();
  assert.match(html, /<title>.+<\/title>/);
});

test("main report: exactly one <main> landmark", () => {
  const html = buildMainReportHtml();
  const opens = countMatches(html, /<main\b[^>]*>/g);
  const closes = countMatches(html, /<\/main>/g);
  assert.equal(opens, 1);
  assert.equal(closes, 1);
});

test("main report: at least one <nav> landmark (sidenav)", () => {
  const html = buildMainReportHtml();
  assert.ok(countMatches(html, /<nav\b[^>]*>/g) >= 1);
});

test("main report: skip-to-content link is present and targets #top", () => {
  const html = buildMainReportHtml();
  assert.match(html, /<a class="skip-to-content" href="#top"/);
  assert.match(html, /Zum Inhalt springen/);
});

test("main report: heading order starts with h1 and does not skip levels", () => {
  const html = buildMainReportHtml();
  const headings = Array.from(html.matchAll(/<h([1-6])\b[^>]*>/g)).map((m) => Number(m[1]));
  assert.ok(headings.length > 0, "has headings");
  assert.equal(headings[0], 1, "first heading is h1");
  for (let i = 1; i < headings.length; i += 1) {
    const jump = headings[i] - headings[i - 1];
    assert.ok(jump <= 1, `heading at index ${i} skips levels (h${headings[i - 1]} -> h${headings[i]})`);
  }
});

test("main report: no duplicate element IDs", () => {
  const html = buildMainReportHtml();
  const ids = extractAllIds(html);
  const seen = new Set();
  const dupes = new Set();
  for (const id of ids) {
    if (seen.has(id)) dupes.add(id);
    else seen.add(id);
  }
  assert.equal(dupes.size, 0, `duplicate ids: ${Array.from(dupes).join(", ")}`);
});

test("main report: all <img> have alt attribute (empty allowed for decorative)", () => {
  const html = buildMainReportHtml();
  const imgs = Array.from(html.matchAll(/<img\b[^>]*>/g)).map((m) => m[0]);
  for (const tag of imgs) {
    assert.ok(/\balt=/.test(tag), `<img> without alt: ${tag}`);
  }
});

test("main report: all <button> have accessible name (text or aria-label)", () => {
  const html = buildMainReportHtml();
  const buttonBlocks = Array.from(html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)).map((m) => m[0]);
  assert.ok(buttonBlocks.length > 0, "at least one button exists");
  for (const block of buttonBlocks) {
    const openTag = block.match(/<button\b[^>]*>/)[0];
    const ariaLabel = extractAttr(openTag, "aria-label");
    const innerHtml = block.replace(/<button\b[^>]*>/, "").replace(/<\/button>/, "").trim();
    const innerText = innerHtml.replace(/<[^>]+>/g, "").trim();
    const hasName = (ariaLabel && ariaLabel.length > 0) || innerText.length > 0;
    assert.ok(hasName, `button without accessible name: ${openTag}`);
  }
});

test("main report: form inputs have associated <label> (wrapped or via for/id)", () => {
  const html = buildMainReportHtml();
  const inputs = Array.from(html.matchAll(/<(input|select|textarea)\b[^>]*>/g)).map((m) => m[0]);
  for (const input of inputs) {
    if (/type="hidden"/.test(input)) continue;
    const id = extractAttr(input, "id");
    const ariaLabel = extractAttr(input, "aria-label");
    const ariaLabelledby = extractAttr(input, "aria-labelledby");
    const wrappedByLabel = html.includes(`<label class="control">`);
    const hasNameCandidate = (id && new RegExp(`<label[^>]*\\bfor="${id}"`).test(html))
      || ariaLabel || ariaLabelledby || wrappedByLabel;
    assert.ok(hasNameCandidate, `form input without label association: ${input}`);
  }
});

test("main report: dialog has aria-labelledby pointing at real id", () => {
  const html = buildMainReportHtml();
  const dialogMatches = Array.from(html.matchAll(/<dialog\b[^>]*>/g)).map((m) => m[0]);
  assert.ok(dialogMatches.length > 0, "has <dialog>");
  const labelledBy = extractAttr(dialogMatches[0], "aria-labelledby");
  assert.ok(labelledBy, "dialog has aria-labelledby");
  assert.match(html, new RegExp(`id="${labelledBy}"`));
});

test("main report: info-modal close-button has aria-label", () => {
  const html = buildMainReportHtml();
  assert.match(html, /<button class="modal-close" aria-label="[^"]+">/);
});

test("main report: sidenav active item gets aria-current via JS", () => {
  const html = buildMainReportHtml();
  assert.match(html, /aria-current', 'location'/);
});

test("main report: a11y-specific CSS present (skip-link, reduced-motion)", () => {
  const html = buildMainReportHtml();
  assert.match(html, /\.skip-to-content \{/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
});

test("main report: focus-visible outline on interactive controls", () => {
  const html = buildMainReportHtml();
  assert.match(html, /button\.badge:focus-visible/);
});

test("main report: semantic accent map hits expected colors", () => {
  const html = buildMainReportHtml();
  // Risiken -> orange ; Kandidaten -> magenta ; Profil -> cyan
  assert.match(html, /<div class="stat accent-orange">[\s\S]*?Risiken/);
  assert.match(html, /<div class="stat accent-magenta">[\s\S]*?Kandidaten/);
  assert.match(html, /<div class="stat meta accent-cyan">[\s\S]*?Profil/);
});

// ---- Landscape a11y ------------------------------------------------------

test("landscape: lang + skip-link + semantic landmarks", () => {
  const html = buildLandscapeHtml();
  assert.match(html, /<html lang="de">/);
  assert.match(html, /skip-to-content/);
  assert.match(html, /<main\b[^>]*>/);
  assert.match(html, /<nav\b[^>]*>/);
});

test("landscape: no duplicate IDs and valid heading order", () => {
  const html = buildLandscapeHtml();
  const ids = extractAllIds(html);
  assert.equal(new Set(ids).size, ids.length, "no duplicate ids");
  const headings = Array.from(html.matchAll(/<h([1-6])\b[^>]*>/g)).map((m) => Number(m[1]));
  assert.equal(headings[0], 1);
  for (let i = 1; i < headings.length; i += 1) {
    assert.ok(headings[i] - headings[i - 1] <= 1);
  }
});

test("landscape: all buttons have accessible name", () => {
  const html = buildLandscapeHtml();
  const buttonBlocks = Array.from(html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)).map((m) => m[0]);
  for (const block of buttonBlocks) {
    const openTag = block.match(/<button\b[^>]*>/)[0];
    const ariaLabel = extractAttr(openTag, "aria-label");
    const innerText = block.replace(/<button\b[^>]*>/, "").replace(/<\/button>/, "").replace(/<[^>]+>/g, "").trim();
    assert.ok((ariaLabel && ariaLabel.length > 0) || innerText.length > 0, `landscape button without name: ${openTag}`);
  }
});
