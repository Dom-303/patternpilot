#!/usr/bin/env node
// scripts/run-stability.mjs
//
// Phase-5-Harness aus docs/foundation/SCORE_STABILITY_PLAN.md:
// Aggregiert Phase-0-Scores ueber N Landscape- bzw. Review-Runs und
// schreibt einen Stability-Report im Markdown-Format.
//
// Drei Quellen-Modi:
//   --from-fixtures           liest test/fixtures/score-baseline/*
//   --from-runs <project>     walkt projects/<project>/problems/*/landscape/*/landscape.json
//   --runs <pfad,pfad,...>    explizite Liste von Run-Verzeichnissen oder JSON-Dateien
//
// Optional: --output <pfad>    schreibt das Markdown auch auf Platte.
//
// Real-World-Phase-5-Lauf (10 frische Slugs) ist nicht hier eingebaut —
// das ist ein Multi-Hour-Lauf mit echten GitHub-Calls. Wenn so ein Lauf
// gefahren wird, kann diese Harness die generierten landscape.json-
// Artefakte einsammeln und in `--from-runs` modus auswerten.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  scoreFromJson,
  STRUCTURE_AXIS_NAMES,
  CONTENT_AXIS_NAMES,
} from "../lib/scoring/score-report.mjs";
import {
  aggregateStability,
  summarizeAxisWeakness,
  describeAcceptance,
  ACCEPTANCE_THRESHOLDS,
} from "../lib/scoring/stability.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE_ROOT = path.join(REPO_ROOT, "test", "fixtures", "score-baseline");
const PROJECTS_ROOT = path.join(REPO_ROOT, "projects");

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function resolveArtifactInDir(dir) {
  const landscape = path.join(dir, "landscape.json");
  if (existsSync(landscape)) return landscape;
  const manifest = path.join(dir, "manifest.json");
  if (existsSync(manifest)) return manifest;
  return null;
}

function collectFixtureRuns() {
  if (!existsSync(FIXTURE_ROOT)) return [];
  const entries = readdirSync(FIXTURE_ROOT).sort();
  const runs = [];
  for (const entry of entries) {
    const full = path.join(FIXTURE_ROOT, entry);
    if (!statSync(full).isDirectory()) continue;
    const artifact = resolveArtifactInDir(full);
    if (!artifact) continue;
    runs.push({ name: entry, artifact });
  }
  return runs;
}

function collectProjectRuns(projectKey) {
  const projectDir = path.join(PROJECTS_ROOT, projectKey, "problems");
  if (!existsSync(projectDir)) return [];
  const runs = [];
  const slugs = readdirSync(projectDir).sort();
  for (const slug of slugs) {
    const slugDir = path.join(projectDir, slug);
    if (!statSync(slugDir).isDirectory()) continue;
    const landscapeRoot = path.join(slugDir, "landscape");
    if (!existsSync(landscapeRoot)) continue;
    const runIds = readdirSync(landscapeRoot).sort();
    for (const runId of runIds) {
      const runDir = path.join(landscapeRoot, runId);
      if (!statSync(runDir).isDirectory()) continue;
      const artifact = resolveArtifactInDir(runDir);
      if (!artifact) continue;
      runs.push({ name: `${slug}/${runId}`, artifact });
    }
  }
  return runs;
}

function collectExplicitRuns(commaList) {
  if (!commaList) return [];
  return commaList
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const absolute = path.resolve(entry);
      if (!existsSync(absolute)) {
        throw new Error(`Run path missing: ${absolute}`);
      }
      const stats = statSync(absolute);
      const artifact = stats.isDirectory() ? resolveArtifactInDir(absolute) : absolute;
      if (!artifact) {
        throw new Error(`Run dir contains no landscape.json or manifest.json: ${absolute}`);
      }
      return { name: path.relative(REPO_ROOT, absolute), artifact };
    });
}

function scoreCollected(runs) {
  const scored = [];
  for (const run of runs) {
    try {
      const json = readJson(run.artifact);
      const score = scoreFromJson(json);
      scored.push({ ...run, score, error: null });
    } catch (error) {
      scored.push({ ...run, score: null, error: error.message });
    }
  }
  return scored;
}

function buildMarkdown({ source, scored, stability, generatedAt }) {
  const successScores = scored.filter((entry) => entry.score !== null);
  const headerCells = ["Run", "Kind", "Total", "Struct", "Content"];
  const tableHeader = `| ${headerCells.join(" | ")} |`;
  const tableSep = `| ${headerCells.map(() => "---").join(" | ")} |`;
  const rows = scored.map((entry) => {
    if (!entry.score) {
      return `| ${entry.name} | ERROR | – | – | – |`;
    }
    const totals = entry.score.totals ?? {};
    return `| ${entry.name} | ${entry.score.kind} | ${entry.score.total}/10 | ${totals.structure ?? "–"}/10 | ${totals.content ?? "–"}/10 |`;
  });

  const weakAxes = summarizeAxisWeakness(stability)
    .map((entry) => `- **[${entry.perspective}] ${entry.axis}** — mean ${entry.mean}/2, min ${entry.min}/2 (anwendbar in ${entry.applicable_runs}/${stability.run_count} Runs)`);

  const errorLines = scored
    .filter((entry) => entry.error)
    .map((entry) => `- **${entry.name}** — ${entry.error}`);

  const lines = [
    `# Score Stability Results`,
    "",
    `- generated_at: ${generatedAt}`,
    `- source: ${source}`,
    `- run_count: ${stability.run_count} (scored: ${successScores.length})`,
    `- thresholds: combined median ≥ ${stability.thresholds.median}, min ≥ ${stability.thresholds.min}, max ≥ ${stability.thresholds.max}`,
    `- acceptance: ${describeAcceptance(stability)}`,
    "",
    `## Aggregat`,
    "",
    `### Combined (struktur + inhalt)`,
    `- **median**: ${stability.total.median ?? "–"}/10`,
    `- **min**: ${stability.total.min ?? "–"}/10`,
    `- **max**: ${stability.total.max ?? "–"}/10`,
    `- **mean**: ${stability.total.mean ?? "–"}/10`,
    "",
    `### Struktur-Total`,
    `- **median**: ${stability.structure.median ?? "–"}/10`,
    `- **min**: ${stability.structure.min ?? "–"}/10`,
    `- **max**: ${stability.structure.max ?? "–"}/10`,
    `- **mean**: ${stability.structure.mean ?? "–"}/10`,
    "",
    `### Inhalts-Total`,
    `- **median**: ${stability.content.median ?? "–"}/10`,
    `- **min**: ${stability.content.min ?? "–"}/10`,
    `- **max**: ${stability.content.max ?? "–"}/10`,
    `- **mean**: ${stability.content.mean ?? "–"}/10`,
    "",
    `- **kinds**: ${Object.entries(stability.kinds).map(([kind, count]) => `${kind}=${count}`).join(", ") || "–"}`,
    "",
    `## Per-Run-Tabelle`,
    "",
    tableHeader,
    tableSep,
    ...rows,
    "",
    `## Schwaechste Achsen (Folge-Hebel-Kandidaten)`,
    "",
    weakAxes.length > 0 ? weakAxes.join("\n") : "- (keine Daten)",
    "",
  ];

  if (errorLines.length > 0) {
    lines.push("## Fehler beim Scoren", "", ...errorLines, "");
  }

  lines.push(
    "## Wie diesen Lauf interpretieren",
    "",
    "- Die Phase-0-Scorer-Achsen sind in `docs/foundation/SCORE_STABILITY_PLAN.md` §5 Phase 0 definiert.",
    "- Acceptance-Schwellen entsprechen Plan §5 Phase 5 (Median 8 / Min 7 / Max 9).",
    "- Schwaechste Achsen zeigen, wo eine weitere Pipeline-Stufe den groessten Hebel haette.",
    "",
    "Re-Run via:",
    "",
    "```bash",
    "npm run stability-test -- --from-fixtures",
    "npm run stability-test -- --from-runs <project>",
    "npm run stability-test -- --runs runs/.../foo,runs/.../bar",
    "```",
  );

  return lines.join("\n");
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    fromFixtures: false,
    fromRuns: null,
    runs: null,
    output: null,
    json: false,
    help: false,
  };
  while (args.length > 0) {
    const token = args.shift();
    if (token === "--from-fixtures") options.fromFixtures = true;
    else if (token === "--from-runs") options.fromRuns = args.shift() ?? null;
    else if (token === "--runs") options.runs = args.shift() ?? null;
    else if (token === "--output") options.output = args.shift() ?? null;
    else if (token === "--json") options.json = true;
    else if (token === "--help" || token === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${token}`);
  }
  return options;
}

function printHelp() {
  process.stdout.write([
    "Usage:",
    "  node scripts/run-stability.mjs --from-fixtures [--output <md>]",
    "  node scripts/run-stability.mjs --from-runs <project> [--output <md>]",
    "  node scripts/run-stability.mjs --runs <comma-list> [--output <md>]",
    "",
    "Options:",
    "  --json     Emit aggregate JSON to stdout instead of Markdown",
    "  --output   Also write the Markdown report to the given path",
    "",
    "Phase-5-Harness. Reine Aggregation — keine GitHub-API-Calls.",
    "Default-Acceptance: median ≥ 8, min ≥ 7, max ≥ 9.",
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

  const sources = [];
  let runs = [];
  if (options.fromFixtures) {
    sources.push("test/fixtures/score-baseline");
    runs.push(...collectFixtureRuns());
  }
  if (options.fromRuns) {
    sources.push(`projects/${options.fromRuns}/problems/*/landscape/*`);
    runs.push(...collectProjectRuns(options.fromRuns));
  }
  if (options.runs) {
    sources.push(`explicit:${options.runs}`);
    runs.push(...collectExplicitRuns(options.runs));
  }
  if (runs.length === 0) {
    process.stderr.write("No runs collected. Pass --from-fixtures, --from-runs, or --runs.\n");
    printHelp();
    process.exit(2);
  }

  const scored = scoreCollected(runs);
  const validScores = scored.filter((entry) => entry.score !== null).map((entry) => entry.score);
  const stability = aggregateStability(validScores);
  const source = sources.join(" + ");

  if (options.json) {
    const payload = {
      generated_at: new Date().toISOString(),
      source,
      runs: scored.map((entry) => ({
        name: entry.name,
        kind: entry.score?.kind ?? null,
        total: entry.score?.total ?? null,
        axes: entry.score?.axes ?? null,
        error: entry.error,
      })),
      stability,
    };
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    process.exit(stability.acceptance.overall ? 0 : 1);
  }

  const markdown = buildMarkdown({
    source,
    scored,
    stability,
    generatedAt: new Date().toISOString(),
  });
  process.stdout.write(`${markdown}\n`);
  if (options.output) {
    const outAbsolute = path.resolve(options.output);
    mkdirSync(path.dirname(outAbsolute), { recursive: true });
    writeFileSync(outAbsolute, `${markdown}\n`, "utf8");
    process.stderr.write(`\n[stability] wrote ${path.relative(REPO_ROOT, outAbsolute)}\n`);
  }
  process.exit(stability.acceptance.overall ? 0 : 1);
}

main();

export { ACCEPTANCE_THRESHOLDS };
