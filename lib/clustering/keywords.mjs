import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNONYMS_RAW = JSON.parse(fs.readFileSync(path.join(__dirname, "synonyms.json"), "utf8"));

const SYNONYM_INDEX = new Map();
for (const [canonical, aliases] of Object.entries(SYNONYMS_RAW)) {
  SYNONYM_INDEX.set(canonical.toLowerCase(), canonical);
  for (const alias of aliases) SYNONYM_INDEX.set(alias.toLowerCase(), canonical);
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "be", "to", "of", "in", "on", "for",
  "with", "and", "or", "it", "that", "this", "as", "at", "by", "from",
  "some", "prose", "about", "under", "over", "fast"
]);

export function normalizeKeyword(token) {
  const lower = token.toLowerCase().trim();
  return SYNONYM_INDEX.get(lower) ?? lower;
}

function tokenize(text) {
  if (!text) return [];
  return text
    .split(/[^a-z0-9-]+/i)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length >= 3 && !STOPWORDS.has(t));
}

function readmeHeadings(readme) {
  if (!readme) return [];
  const tokens = [];
  for (const line of readme.split("\n")) {
    const h = line.match(/^#{1,2}\s+(.+)$/);
    if (h) tokens.push(...tokenize(h[1]));
  }
  return tokens;
}

function readmeLeadingNouns(readme) {
  if (!readme) return [];
  const firstParagraph = readme.split("\n\n")[1] ?? "";
  return tokenize(firstParagraph).slice(0, 20);
}

function addToken(set, raw) {
  const lower = raw.toLowerCase().trim();
  if (!lower || lower.length < 3 || STOPWORDS.has(lower)) return;
  set.add(lower);
  const canonical = SYNONYM_INDEX.get(lower);
  if (canonical) set.add(canonical);
}

export function extractRepoKeywords(repo) {
  const tokens = new Set();
  for (const topic of repo.topics ?? []) addToken(tokens, topic);
  for (const dep of repo.dependencies ?? []) addToken(tokens, dep);
  for (const t of readmeHeadings(repo.readme)) addToken(tokens, t);
  for (const t of readmeLeadingNouns(repo.readme)) addToken(tokens, t);
  return tokens;
}
