#!/usr/bin/env node
// scripts/suggest-lexicon.mjs
//
// Phase-7.2-CLI-Wrapper. Walkt projects/<*>/problems/*/landscape/*/
// landscape.json, ruft die pure Helfer in lib/scoring/lexicon-suggest.mjs
// auf, formatiert das Ergebnis als Markdown oder JSON.
//
// Aufrufe:
//   npm run lexicon:suggest
//   npm run lexicon:suggest -- --project pinflow
//   npm run lexicon:suggest -- --output docs/foundation/lexicon-suggestions.md
//   npm run lexicon:suggest -- --json --min-members 5

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  collectUnknownMemberSignals,
  aggregateTokenFrequency,
  buildSuggestions,
} from "../lib/scoring/lexicon-suggest.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PROJECTS_ROOT = path.join(REPO_ROOT, "projects");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function listProjectDirs(specificProject) {
  if (!existsSync(PROJECTS_ROOT)) return [];
  const entries = readdirSync(PROJECTS_ROOT)
    .filter((entry) => statSync(path.join(PROJECTS_ROOT, entry)).isDirectory())
    .sort();
  return specificProject ? entries.filter((e) => e === specificProject) : entries;
}

function listLandscapeJsons(projectKey) {
  const problemsRoot = path.join(PROJECTS_ROOT, projectKey, "problems");
  if (!existsSync(problemsRoot)) return [];
  const out = [];
  for (const slug of readdirSync(problemsRoot).sort()) {
    const slugDir = path.join(problemsRoot, slug);
    if (!statSync(slugDir).isDirectory()) continue;
    const lsRoot = path.join(slugDir, "landscape");
    if (!existsSync(lsRoot)) continue;
    for (const runId of readdirSync(lsRoot).sort()) {
      const runDir = path.join(lsRoot, runId);
      if (!statSync(runDir).isDirectory()) continue;
      const file = path.join(runDir, "landscape.json");
      if (!existsSync(file)) continue;
      out.push({ projectKey, slug, runId, file });
    }
  }
  return out;
}

function formatMarkdown({ scope, totalRuns, totalUnknownMembers, suggestions, generatedAt }) {
  const lines = [
    `# Lexicon Suggestions`,
    "",
    `- generated_at: ${generatedAt}`,
    `- scope: ${scope}`,
    `- runs_analyzed: ${totalRuns}`,
    `- unknown_member_pool_size: ${totalUnknownMembers}`,
    "",
    `## Vorgeschlagene Kandidaten-Tokens`,
    "",
    suggestions.length === 0 ? "_(keine Kandidaten ueber dem Mindest-Schwellwert gefunden)_" : "",
    "| Token | Auftritt in Members | Coverage |",
    "| --- | --- | --- |",
    ...suggestions.map((s) => `| ${s.candidate_token} | ${s.appears_in_members} | ${(s.coverage_ratio * 100).toFixed(1)} % |`),
    "",
    `## So uebernimmst du einen Vorschlag`,
    "",
    "1. Pruefe das Token semantisch: ist es eine echte Pattern-Familie (z.B. `wrapper-induction`) oder bloss ein generisches Wort (`framework`)?",
    "2. Wenn ja: erweitere `lib/clustering/pattern-family-lexicon.json` ODER `bindings/<project>/PATTERN_FAMILY_LEXICON.json` mit einem Eintrag wie:",
    "",
    "```json",
    "{",
    "  \"label\": \"wrapper-induction\",",
    "  \"keywords\": [\"wrapper induction\", \"wrapper learning\", \"automatic wrapper\"],",
    "  \"min_matches\": 1",
    "}",
    "```",
    "",
    "3. Re-run `npm run problem:explore` und pruefe, ob `pattern_family_summary.classified_ratio` steigt.",
    "",
  ];
  return lines.join("\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { project: null, output: null, json: false, minMembers: 3, help: false };
  while (args.length > 0) {
    const token = args.shift();
    if (token === "--project") options.project = args.shift() ?? null;
    else if (token === "--output") options.output = args.shift() ?? null;
    else if (token === "--json") options.json = true;
    else if (token === "--min-members") options.minMembers = Number.parseInt(args.shift() ?? "3", 10);
    else if (token === "--help" || token === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function printHelp() {
  process.stdout.write([
    "Usage:",
    "  node scripts/suggest-lexicon.mjs [--project <key>] [--output <md>] [--json] [--min-members <n>]",
    "",
    "Phase-7.2-Auto-Extension. Walkt projects/<*>/problems/*/landscape/*/",
    "und sammelt Topics + Description-Tokens aller Repos, die als",
    "pattern_family=unknown geblieben sind. Gruppiert nach Frequenz und",
    "schlaegt Kandidaten-Tokens vor, die als Familien ins Lexikon",
    "uebernommen werden koennten.",
    "",
    "Default min-members = 3 (Token muss in ≥3 unknown-Repos vorkommen).",
    "",
  ].join("\n"));
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    process.stderr.write(`${error.message}\n\n`);
    printHelp();
    process.exit(2);
  }
  if (options.help) {
    printHelp();
    process.exit(0);
  }

  const projects = listProjectDirs(options.project);
  if (projects.length === 0) {
    process.stderr.write(`No projects found${options.project ? ` for --project ${options.project}` : ""}.\n`);
    process.exit(2);
  }

  const allSignals = [];
  let runsAnalyzed = 0;
  for (const projectKey of projects) {
    for (const run of listLandscapeJsons(projectKey)) {
      try {
        const landscape = readJson(run.file);
        const signals = collectUnknownMemberSignals(landscape);
        for (const signal of signals) allSignals.push({ ...signal, projectKey: run.projectKey });
        runsAnalyzed += 1;
      } catch (error) {
        process.stderr.write(`Skipping ${run.file}: ${error.message}\n`);
      }
    }
  }

  const dedupedById = new Map();
  for (const signal of allSignals) {
    if (!dedupedById.has(signal.id)) dedupedById.set(signal.id, signal);
  }
  const uniqueSignals = [...dedupedById.values()];
  const counts = aggregateTokenFrequency(uniqueSignals);
  const suggestions = buildSuggestions(counts, uniqueSignals.length, {
    minMembers: options.minMembers,
  });

  const payload = {
    generated_at: new Date().toISOString(),
    scope: options.project ? `project:${options.project}` : `all-projects (${projects.length})`,
    runs_analyzed: runsAnalyzed,
    unknown_member_pool_size: uniqueSignals.length,
    suggestions,
  };

  if (options.json) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  } else {
    const md = formatMarkdown({
      scope: payload.scope,
      totalRuns: payload.runs_analyzed,
      totalUnknownMembers: payload.unknown_member_pool_size,
      suggestions,
      generatedAt: payload.generated_at,
    });
    process.stdout.write(`${md}\n`);
    if (options.output) {
      const outAbs = path.resolve(options.output);
      mkdirSync(path.dirname(outAbs), { recursive: true });
      writeFileSync(outAbs, `${md}\n`, "utf8");
      process.stderr.write(`\n[lexicon:suggest] wrote ${path.relative(REPO_ROOT, outAbs)}\n`);
    }
  }
  process.exit(0);
}

main();
