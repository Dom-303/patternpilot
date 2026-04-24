#!/usr/bin/env node
// scripts/score-report.mjs
//
// CLI-Wrapper fuer den Phase-0-Scorer (lib/scoring/score-report.mjs).
//
// Aufrufe:
//   node scripts/score-report.mjs <run-path>
//   node scripts/score-report.mjs <run-path> --pretty
//   node scripts/score-report.mjs --baseline
//
// <run-path> darf sein:
//   - eine landscape.json direkt (Landscape-Run)
//   - ein Landscape-Run-Verzeichnis (enthaelt landscape.json)
//   - eine review manifest.json direkt
//   - ein Review-Run-Verzeichnis (enthaelt manifest.json)
//
// Mit --baseline werden alle Fixtures unter test/fixtures/score-baseline/
// gegen den Scorer geschickt und eine Zusammenfassung ausgegeben.
//
// Der Scorer ist rein lesend — er ruft keine GitHub-API auf, er fasst keine
// HTMLs an, er schreibt keine Artefakte zurueck.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AXIS_NAMES, scoreFromJson } from '../lib/scoring/score-report.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_DIR = path.join(REPO_ROOT, 'test', 'fixtures', 'score-baseline');

function readJson(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse ${filePath}: ${error.message}`);
  }
}

function resolveRunArtifact(runPath) {
  const absolute = path.resolve(runPath);
  if (!existsSync(absolute)) {
    throw new Error(`Path does not exist: ${absolute}`);
  }
  const stats = statSync(absolute);
  if (stats.isFile()) return absolute;
  if (!stats.isDirectory()) {
    throw new Error(`Unsupported path kind: ${absolute}`);
  }
  const landscape = path.join(absolute, 'landscape.json');
  if (existsSync(landscape)) return landscape;
  const manifest = path.join(absolute, 'manifest.json');
  if (existsSync(manifest)) return manifest;
  throw new Error(`Directory contains neither landscape.json nor manifest.json: ${absolute}`);
}

function formatPretty(result) {
  const axisRows = AXIS_NAMES
    .map((name) => `  ${name.padEnd(26)} ${result.axes[name].score}/2`)
    .join('\n');
  const metaLines = Object.entries(result.meta)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `  ${key}: ${value}`)
    .join('\n');
  return [
    `kind: ${result.kind}`,
    `total: ${result.total}/10`,
    '',
    'axes:',
    axisRows,
    '',
    'meta:',
    metaLines,
  ].join('\n');
}

function scoreOne(runPath) {
  const artifact = resolveRunArtifact(runPath);
  const json = readJson(artifact);
  const result = scoreFromJson(json);
  return { artifact, result };
}

function runBaseline() {
  if (!existsSync(BASELINE_DIR)) {
    throw new Error(`Baseline directory missing: ${BASELINE_DIR}`);
  }
  const entries = readdirSync(BASELINE_DIR).sort();
  const runs = [];
  for (const entry of entries) {
    const full = path.join(BASELINE_DIR, entry);
    if (!statSync(full).isDirectory()) continue;
    try {
      const { artifact, result } = scoreOne(full);
      runs.push({ name: entry, artifact: path.relative(REPO_ROOT, artifact), result });
    } catch (error) {
      runs.push({ name: entry, error: error.message });
    }
  }
  return { baselineDir: path.relative(REPO_ROOT, BASELINE_DIR), runs };
}

function formatBaselineTable(summary) {
  const header = '  name'.padEnd(42) + 'kind      total   ' + AXIS_NAMES.map((n) => n.slice(0, 4)).join('  ');
  const rows = summary.runs.map((run) => {
    if (run.error) return `  ${run.name.padEnd(40)}ERROR: ${run.error}`;
    const axisCells = AXIS_NAMES.map((name) => String(run.result.axes[name].score)).join('     ');
    return `  ${run.name.padEnd(40)}${run.result.kind.padEnd(10)}${String(run.result.total).padEnd(8)}${axisCells}`;
  });
  return [`baseline: ${summary.baselineDir}`, '', header, ...rows].join('\n');
}

function printHelp() {
  process.stdout.write([
    'Usage:',
    '  node scripts/score-report.mjs <run-path> [--pretty]',
    '  node scripts/score-report.mjs --baseline [--pretty]',
    '',
    'Description:',
    '  Phase-0 scorer. Reads a Landscape- or Review-Run-Artifact and emits a',
    '  deterministic 0-10 score with five 0-2 axes. No network, no mutation.',
    '',
    'See docs/foundation/SCORE_STABILITY_PLAN.md §5 Phase 0 for the axis rules.',
    '',
  ].join('\n'));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = { pretty: false, baseline: false, help: false, runPath: null };
  for (const arg of args) {
    if (arg === '--pretty') options.pretty = true;
    else if (arg === '--baseline') options.baseline = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg.startsWith('--')) {
      throw new Error(`Unknown flag: ${arg}`);
    } else if (!options.runPath) {
      options.runPath = arg;
    } else {
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
  }
  return options;
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

  if (options.help || (!options.baseline && !options.runPath)) {
    printHelp();
    process.exit(options.help ? 0 : 2);
  }

  try {
    if (options.baseline) {
      const summary = runBaseline();
      if (options.pretty) {
        process.stdout.write(`${formatBaselineTable(summary)}\n`);
      } else {
        process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
      }
      const hasError = summary.runs.some((run) => run.error);
      process.exit(hasError ? 1 : 0);
    }

    const { artifact, result } = scoreOne(options.runPath);
    if (options.pretty) {
      process.stdout.write(`artifact: ${path.relative(REPO_ROOT, artifact)}\n`);
      process.stdout.write(`${formatPretty(result)}\n`);
    } else {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }
    process.exit(0);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exit(1);
  }
}

main();
