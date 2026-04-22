// test/brief-heuristic.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { buildHeuristicBrief } from "../lib/brief/heuristic.mjs";

test("buildHeuristicBrief renders markdown with landscape signals and next step", () => {
  const problem = {
    slug: "x",
    title: "T",
    project: "app",
    fields: { description: "Long lists are slow.\n\nSecond paragraph." },
    derived: { constraint_tags: [] }
  };
  const landscape = {
    run_id: "2026-04-20T14-22-05Z",
    clusters: [
      {
        label: "virt+windowing", relation: "near_current_approach",
        signature_contrast: ["virtualization", "windowing"],
        member_ids: ["repo-a", "repo-b"],
        pattern_family: "virt"
      },
      {
        label: "pagination+ssr", relation: "divergent",
        signature_contrast: ["pagination"],
        member_ids: ["repo-c"],
        pattern_family: "pag"
      }
    ],
    relation_counts: { near_current_approach: 1, adjacent: 0, divergent: 1 },
    landscape_signal: "ok"
  };
  const markdown = buildHeuristicBrief({
    problem, landscape, topRepoByCluster: { "virt+windowing": "https://github.com/org/repo-a" }
  });
  assert.match(markdown, /Long lists are slow\./);
  assert.match(markdown, /near_current_approach/);
  assert.match(markdown, /virt\+windowing/);
  assert.match(markdown, /npm run intake/);
});

test("buildHeuristicBrief inserts LLM narrative when augmentation provided", () => {
  const problem = { slug: "x", title: "T", project: "app", fields: { description: "D" }, derived: { constraint_tags: [] } };
  const landscape = {
    run_id: "r",
    clusters: [{ key: "c1", label: "virt", relation: "near_current_approach", signature_contrast: [], member_ids: ["a"], pattern_family: "v" }],
    relation_counts: { near_current_approach: 1, adjacent: 0, divergent: 0 },
    landscape_signal: "ok"
  };
  const aug = { c1: { narrative: "Clever narrative here.", strengths_weaknesses_raw: "STRENGTHS:\n- s1" } };
  const md = buildHeuristicBrief({ problem, landscape, topRepoByCluster: {}, llmAugmentation: aug });
  assert.match(md, /Clever narrative here\./);
  assert.match(md, /KI-Ergänzung/);
  assert.match(md, /llm_augmentation: true/);
});

test("buildHeuristicBrief shortens description to 200 chars for the 1-sentence header", () => {
  const longText = "x".repeat(500);
  const brief = buildHeuristicBrief({
    problem: { slug: "x", title: "T", project: null, fields: { description: longText }, derived: { constraint_tags: [] } },
    landscape: { run_id: "r", clusters: [], relation_counts: { near_current_approach: 0, adjacent: 0, divergent: 0 }, landscape_signal: "ok" },
    topRepoByCluster: {}
  });
  const header = brief.split("## Problem (1 Satz)")[1].split("##")[0].trim();
  assert.ok(header.length <= 200);
});
