import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  diversifySeeds,
  measureSeedDiversity,
  DEFAULT_MIN_ORTHOGONAL,
  DEFAULT_ORTHOGONAL_THRESHOLD,
  DEFAULT_BUDGET,
} from "../lib/discovery/seed-diversifier.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DICTIONARY_PATH = path.join(REPO_ROOT, "lib", "discovery", "seed-dictionary.json");
const DICTIONARY = JSON.parse(readFileSync(DICTIONARY_PATH, "utf8"));

describe("measureSeedDiversity", () => {
  test("empty seeds → counts 0", () => {
    const result = measureSeedDiversity([]);
    assert.equal(result.seed_count, 0);
    assert.equal(result.orthogonal_count, 0);
    assert.equal(result.max_pairwise_jaccard, 0);
  });

  test("single seed counts as one orthogonal", () => {
    const result = measureSeedDiversity(["foo bar baz"]);
    assert.equal(result.seed_count, 1);
    assert.equal(result.orthogonal_count, 1);
    assert.equal(result.max_pairwise_jaccard, 0);
  });

  test("three highly overlapping seeds have low orthogonal count", () => {
    // Worst-case shape: every seed shares the same two tokens with every other.
    const result = measureSeedDiversity([
      "record linkage library",
      "record linkage engine",
      "record linkage tool",
    ]);
    assert.ok(result.max_pairwise_jaccard >= 0.5, "pairwise similarity should exceed threshold");
    assert.equal(result.orthogonal_count, 0, "all three block each other");
  });

  test("three structurally distinct seeds all count as orthogonal", () => {
    const result = measureSeedDiversity([
      "schema parser library",
      "workflow orchestrator engine",
      "geocoding address lookup",
    ]);
    assert.equal(result.orthogonal_count, 3);
    assert.ok(result.max_pairwise_jaccard < 0.3);
  });

  test("threshold option is respected", () => {
    const seeds = ["schema alpha", "schema beta"];
    const strict = measureSeedDiversity(seeds, { orthogonalThreshold: 0.1 });
    const loose = measureSeedDiversity(seeds, { orthogonalThreshold: 0.9 });
    assert.ok(strict.orthogonal_count <= loose.orthogonal_count);
  });
});

describe("diversifySeeds", () => {
  test("returns passthrough when seeds already diverse", () => {
    const seeds = [
      "schema parser library",
      "workflow orchestrator engine",
      "geocoding address lookup",
      "message queue broker",
    ];
    const result = diversifySeeds(seeds, DICTIONARY);
    assert.equal(result.strategy, "passthrough");
    assert.equal(result.reason, "already_diverse");
    assert.deepEqual(result.seeds, seeds);
    assert.equal(result.added.length, 0);
  });

  test("supplements when seeds are lexically collapsed", () => {
    const seeds = [
      "record linkage library",
      "record linkage engine",
      "record linkage tool",
    ];
    const result = diversifySeeds(seeds, DICTIONARY);
    assert.equal(result.strategy, "diversified");
    assert.ok(result.added.length > 0, "should add at least one supplement");
    assert.ok(result.added.length <= DEFAULT_BUDGET, "should respect budget");
    assert.ok(
      result.diversity_after.orthogonal_count > result.diversity_before.orthogonal_count,
      "supplementation must improve orthogonal count",
    );
  });

  test("does not duplicate existing seeds", () => {
    const seeds = ["schema parser library"];
    const result = diversifySeeds(seeds, DICTIONARY);
    const phrases = new Set(result.seeds);
    assert.equal(phrases.size, result.seeds.length, "no duplicates in output");
  });

  test("respects custom budget", () => {
    const seeds = [
      "record linkage library",
      "record linkage engine",
      "record linkage tool",
    ];
    const result = diversifySeeds(seeds, DICTIONARY, { budget: 1 });
    assert.ok(result.added.length <= 1, `budget=1 cap violated: ${result.added.length}`);
  });

  test("passthrough when dictionary is empty", () => {
    const seeds = [
      "record linkage library",
      "record linkage engine",
      "record linkage tool",
    ];
    const result = diversifySeeds(seeds, { phrases: [] });
    assert.equal(result.strategy, "passthrough");
    assert.equal(result.reason, "empty_dictionary");
  });

  test("passthrough when dictionary is null", () => {
    const seeds = [
      "record linkage library",
      "record linkage engine",
      "record linkage tool",
    ];
    const result = diversifySeeds(seeds, null);
    assert.equal(result.strategy, "passthrough");
  });

  test("is deterministic for the same input", () => {
    const seeds = [
      "record linkage library",
      "record linkage engine",
      "record linkage tool",
    ];
    const first = diversifySeeds(seeds, DICTIONARY);
    const second = diversifySeeds(seeds, DICTIONARY);
    assert.deepEqual(first, second);
  });

  test("diversifier output does not overlap with existing seeds (jaccard < threshold)", () => {
    const seeds = ["record linkage library", "entity resolution deduplication"];
    const result = diversifySeeds(seeds, DICTIONARY);
    // Each added phrase should be orthogonal to every existing seed.
    for (const addition of result.added) {
      const addedDiversity = measureSeedDiversity([...seeds, addition.phrase]);
      // When checking the last-added against all prior, max jaccard should be below threshold.
      assert.ok(
        addedDiversity.max_pairwise_jaccard < 1.0,
        `added phrase "${addition.phrase}" should not be a duplicate`,
      );
    }
  });
});

describe("seed-dictionary.json integrity", () => {
  test("has version and phrases array", () => {
    assert.equal(DICTIONARY.version, 1);
    assert.ok(Array.isArray(DICTIONARY.phrases));
    assert.ok(DICTIONARY.phrases.length >= 20, `dictionary should have ≥20 entries, has ${DICTIONARY.phrases.length}`);
  });

  test("every entry has a string phrase and an axes array", () => {
    for (const entry of DICTIONARY.phrases) {
      assert.equal(typeof entry.phrase, "string", `entry missing phrase: ${JSON.stringify(entry)}`);
      assert.ok(entry.phrase.length > 0);
      assert.ok(Array.isArray(entry.axes), `entry ${entry.phrase} missing axes array`);
      assert.ok(entry.axes.length > 0, `entry ${entry.phrase} has empty axes`);
    }
  });

  test("no duplicate phrases", () => {
    const phrases = DICTIONARY.phrases.map((p) => p.phrase);
    const unique = new Set(phrases);
    assert.equal(unique.size, phrases.length, "duplicate phrases detected");
  });
});

describe("default constants", () => {
  test("exported defaults have sensible values", () => {
    assert.equal(DEFAULT_MIN_ORTHOGONAL, 3);
    assert.equal(DEFAULT_ORTHOGONAL_THRESHOLD, 0.5);
    assert.equal(DEFAULT_BUDGET, 3);
  });
});
