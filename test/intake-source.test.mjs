import test from "node:test";
import assert from "node:assert/strict";
import { indexPreloadedCandidates, hasPreloadedCandidate } from "../lib/intake-source.mjs";

test("indexPreloadedCandidates maps replay candidates by normalized GitHub URL", () => {
  const index = indexPreloadedCandidates([
    {
      repo: {
        normalizedRepoUrl: "https://github.com/oc/openevents"
      },
      enrichment: {
        status: "success"
      }
    }
  ]);

  assert.equal(index.size, 1);
  assert.equal(index.get("https://github.com/oc/openevents").enrichment.status, "success");
});

test("hasPreloadedCandidate detects indexed repo matches", () => {
  const index = indexPreloadedCandidates([
    {
      repo: {
        normalizedRepoUrl: "https://github.com/citybureau/city-scrapers"
      }
    }
  ]);

  assert.equal(
    hasPreloadedCandidate(index, { normalizedRepoUrl: "https://github.com/citybureau/city-scrapers" }),
    true
  );
  assert.equal(
    hasPreloadedCandidate(index, { normalizedRepoUrl: "https://github.com/oc/openevents" }),
    false
  );
});
