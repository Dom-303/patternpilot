import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

function loadJsonSafely(filename, fallback) {
  try {
    const raw = fs.readFileSync(path.join(moduleDir, filename), "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const TECH_ALIASES = loadJsonSafely("tech-aliases.json", { groups: [] });
const GENERIC_PHRASES = loadJsonSafely("generic-phrases.json", { phrases: [] });

export function expandTechAliases(tags) {
  if (!Array.isArray(tags) || tags.length === 0) return [];
  const seen = new Map();
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const key = tag.toLowerCase();
    if (!seen.has(key)) seen.set(key, tag);
  }
  for (const tag of [...tags]) {
    if (typeof tag !== "string") continue;
    const group = (TECH_ALIASES.groups ?? []).find((g) =>
      g.some((member) => member.toLowerCase() === tag.toLowerCase())
    );
    if (!group) continue;
    for (const member of group) {
      const key = member.toLowerCase();
      if (!seen.has(key)) seen.set(key, member);
    }
  }
  return [...seen.values()];
}

export function normalizeSearchTerms(terms) {
  if (!Array.isArray(terms)) return [];
  const seen = new Map();
  for (const raw of terms) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()];
}

export function lintGenericPhrases(terms) {
  if (!Array.isArray(terms)) return [];
  const deny = (GENERIC_PHRASES.phrases ?? []).map((p) => p.toLowerCase());
  const warnings = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    if (deny.includes(term.trim().toLowerCase())) {
      warnings.push(
        `[lint] warn: search_term "${term}" is a generic phrase. Consider sharpening (e.g. "schema-free scraper", "adaptive selector scraper").`
      );
    }
  }
  return warnings;
}

export function lintSingleWords(terms) {
  if (!Array.isArray(terms)) return [];
  const warnings = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    const parts = term.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
      warnings.push(
        `[lint] warn: search_term "${term}" is a single word and matches too broadly on GitHub. Consider adding a qualifier.`
      );
    }
  }
  return warnings;
}

export function lintLongPhrases(terms) {
  if (!Array.isArray(terms)) return [];
  const warnings = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    const parts = term.trim().split(/\s+/).filter(Boolean);
    if (parts.length > 5) {
      warnings.push(
        `[lint] warn: search_term "${term}" has ${parts.length} words. GitHub search narrows too aggressively beyond 4 words — consider splitting.`
      );
    }
  }
  return warnings;
}

export function lintDuplicates(terms) {
  if (!Array.isArray(terms)) return [];
  const seen = new Map();
  const warnings = [];
  for (const term of terms) {
    if (typeof term !== "string") continue;
    const key = term.trim().toLowerCase();
    if (!key) continue;
    if (seen.has(key)) {
      warnings.push(
        `[lint] warn: search_term "${term}" was a case-insensitive duplicate of "${seen.get(key)}" and was dropped.`
      );
    } else {
      seen.set(key, term);
    }
  }
  return warnings;
}

export function applyHeuristics(input = {}) {
  const raw = {
    query_seeds: Array.isArray(input.query_seeds) ? input.query_seeds : [],
    tech_tags: Array.isArray(input.tech_tags) ? input.tech_tags : [],
    constraint_tags: Array.isArray(input.constraint_tags) ? input.constraint_tags : [],
    approach_signature: Array.isArray(input.approach_signature) ? input.approach_signature : []
  };

  const warnings = [
    ...lintGenericPhrases(raw.query_seeds),
    ...lintSingleWords(raw.query_seeds),
    ...lintLongPhrases(raw.query_seeds),
    ...lintDuplicates(raw.query_seeds)
  ];

  const derived = {
    query_seeds: normalizeSearchTerms(raw.query_seeds),
    tech_tags: expandTechAliases(raw.tech_tags),
    constraint_tags: [...raw.constraint_tags],
    approach_signature: [...raw.approach_signature]
  };

  return { derived, warnings };
}
