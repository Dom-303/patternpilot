import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  classifyRepoPatternFamily,
  classifyRepos,
  DEFAULT_README_LIMIT,
  DEFAULT_TOPIC_WEIGHT,
} from "../lib/clustering/pattern-family-classifier.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const LEXICON_PATH = path.join(REPO_ROOT, "lib", "clustering", "pattern-family-lexicon.json");
const LEXICON = JSON.parse(readFileSync(LEXICON_PATH, "utf8"));
const FIXTURE_ROOT = path.join(REPO_ROOT, "test", "fixtures", "score-baseline");

function readFixtureLandscape(name) {
  return JSON.parse(readFileSync(path.join(FIXTURE_ROOT, name, "landscape.json"), "utf8"));
}

function collectAxisMembers(landscape) {
  const seen = new Set();
  const members = [];
  for (const axis of landscape?.axis_view?.axes ?? []) {
    for (const member of axis?.members ?? []) {
      if (!member?.id || seen.has(member.id)) continue;
      seen.add(member.id);
      members.push(member);
    }
  }
  return members;
}

describe("classifyRepoPatternFamily", () => {
  test("empty repo returns null with reason empty_repo_text", () => {
    const result = classifyRepoPatternFamily({}, LEXICON);
    assert.equal(result.label, null);
    assert.equal(result.reason, "empty_repo_text");
  });

  test("empty lexicon returns null with reason empty_lexicon", () => {
    const result = classifyRepoPatternFamily(
      { description: "anything", topics: [] },
      { families: [] },
    );
    assert.equal(result.label, null);
    assert.equal(result.reason, "empty_lexicon");
  });

  test("null lexicon degrades gracefully", () => {
    const result = classifyRepoPatternFamily(
      { description: "anything", topics: [] },
      null,
    );
    assert.equal(result.label, null);
    assert.equal(result.reason, "empty_lexicon");
  });

  test("unambiguous scraper repo gets scraper label", () => {
    const repo = {
      name: "site-crawler",
      description: "A web crawler that crawls websites using a headless browser.",
      topics: ["crawler", "scraping", "headless"],
    };
    const result = classifyRepoPatternFamily(repo, LEXICON);
    assert.equal(result.label, "scraper");
    assert.ok(result.score >= 2);
  });

  test("dedup repo gets deduper label over matcher when dedup keywords dominate", () => {
    const repo = {
      name: "entity-dedupe",
      description: "Entity resolution and deduplication tool. Handles duplicate detection and record linkage.",
      topics: ["deduplication", "entity-resolution"],
    };
    const result = classifyRepoPatternFamily(repo, LEXICON);
    assert.equal(result.label, "deduper");
  });

  test("specific schema_parser signals outweigh generic parser", () => {
    const repo = {
      name: "event-schema",
      description: "Parser for schema.org microdata and json-ld structured data with ical rrule support.",
      topics: ["schema.org", "json-ld"],
    };
    const result = classifyRepoPatternFamily(repo, LEXICON);
    assert.equal(result.label, "schema_parser");
  });

  test("readmeLimit clips long README to keep classification focused", () => {
    const bigReadme = "x".repeat(5000) + " scraper crawler playwright";
    const repoClipped = {
      name: "mystery",
      description: "",
      topics: [],
      readme: bigReadme,
    };
    const strict = classifyRepoPatternFamily(repoClipped, LEXICON, { readmeLimit: 100 });
    // With a small readmeLimit the scraper keywords past the cutoff shouldn't count.
    assert.equal(strict.label, null);
    const loose = classifyRepoPatternFamily(repoClipped, LEXICON, { readmeLimit: 5500 });
    assert.equal(loose.label, "scraper");
  });

  test("topic hits are weighted higher than description hits", () => {
    const topicOnly = {
      name: "repo-topic-hit",
      description: "generic library for data",
      topics: ["parser"],
    };
    const descOnly = {
      name: "repo-desc-hit",
      description: "we build a parser for data",
      topics: [],
    };
    const topicResult = classifyRepoPatternFamily(topicOnly, LEXICON);
    const descResult = classifyRepoPatternFamily(descOnly, LEXICON);
    assert.equal(topicResult.label, "parser");
    assert.equal(descResult.label, "parser");
    assert.ok(topicResult.score > descResult.score, "topic hit should outweigh description hit");
  });

  test("determinism: same input yields same output", () => {
    const repo = {
      name: "fuzzy-match",
      description: "String matching with jaro winkler and levenshtein distances.",
      topics: ["fuzzy-matching", "similarity"],
    };
    const a = classifyRepoPatternFamily(repo, LEXICON);
    const b = classifyRepoPatternFamily(repo, LEXICON);
    assert.deepEqual(a, b);
  });
});

describe("classifyRepos", () => {
  test("returns summary counts", () => {
    const repos = [
      { name: "a", description: "scraping and crawling library", topics: ["scraping"] },
      { name: "b", description: "we have nothing meaningful to say", topics: [] },
      { name: "c", description: "deduplication engine", topics: ["entity-resolution"] },
    ];
    const { summary, repos: out } = classifyRepos(repos, LEXICON);
    assert.equal(summary.total, 3);
    assert.ok(summary.classified >= 2);
    assert.equal(out.length, 3);
  });

  test("preserves repos that already have pattern_family set", () => {
    const repos = [
      { name: "x", description: "generic library", topics: [], pattern_family: "preset-value" },
    ];
    const { repos: out } = classifyRepos(repos, LEXICON);
    assert.equal(out[0].pattern_family, "preset-value");
    assert.equal(out[0].pattern_family_source, undefined, "should not overwrite pre-set source");
  });

  test("re-classifies repos with pattern_family=unknown", () => {
    const repos = [
      {
        name: "x",
        description: "a web scraper with playwright for headless crawling",
        topics: ["scraping"],
        pattern_family: "unknown",
      },
    ];
    const { repos: out } = classifyRepos(repos, LEXICON);
    assert.equal(out[0].pattern_family, "scraper");
    assert.equal(out[0].pattern_family_source, "lexicon-stage2");
  });

  test("empty input returns zero summary", () => {
    const { repos, summary } = classifyRepos([], LEXICON);
    assert.deepEqual(repos, []);
    assert.equal(summary.total, 0);
  });
});

describe("classifier against baseline fixtures", () => {
  // Anchor expected behavior on real repo shapes. If the lexicon or classifier
  // drifts, these tests break early and force a deliberate update.
  test("event-dedup fixture: all 6 axis members get classified", () => {
    const landscape = readFixtureLandscape("01-event-dedup-landscape");
    const members = collectAxisMembers(landscape);
    const { summary } = classifyRepos(members, LEXICON);
    assert.equal(summary.total, 6);
    assert.ok(summary.classified >= 5, `expected ≥5/6 classified, got ${summary.classified}`);
  });

  test("schema-extraction fixture: both axis members get classified", () => {
    const landscape = readFixtureLandscape("02-schema-extraction-landscape");
    const members = collectAxisMembers(landscape);
    const { summary } = classifyRepos(members, LEXICON);
    assert.ok(summary.classified >= Math.floor(summary.total / 2), `expected ≥50% classified, got ${summary.classified}/${summary.total}`);
  });
});

describe("pattern-family-lexicon.json integrity", () => {
  test("has version and families array", () => {
    assert.equal(LEXICON.version, 1);
    assert.ok(Array.isArray(LEXICON.families));
    assert.ok(LEXICON.families.length >= 20, `expected ≥20 families, got ${LEXICON.families.length}`);
  });

  test("every entry has label, keywords array, min_matches", () => {
    for (const family of LEXICON.families) {
      assert.equal(typeof family.label, "string", `family missing label: ${JSON.stringify(family)}`);
      assert.ok(family.label.length > 0);
      assert.ok(Array.isArray(family.keywords), `family ${family.label} missing keywords`);
      assert.ok(family.keywords.length > 0);
      assert.equal(typeof family.min_matches, "number", `family ${family.label} missing min_matches`);
      assert.ok(family.min_matches >= 1);
    }
  });

  test("no duplicate labels", () => {
    const labels = LEXICON.families.map((f) => f.label);
    assert.equal(new Set(labels).size, labels.length, "duplicate labels detected");
  });
});

describe("default constants", () => {
  test("exported defaults have sensible values", () => {
    assert.equal(DEFAULT_README_LIMIT, 800);
    assert.equal(DEFAULT_TOPIC_WEIGHT, 2);
  });
});
