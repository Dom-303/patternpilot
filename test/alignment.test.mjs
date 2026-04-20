import test from "node:test";
import assert from "node:assert/strict";

import { buildProjectAlignment } from "../lib/classification/alignment.mjs";
import { guessClassification } from "../lib/classification/core.mjs";
import {
  makeFakeAlignmentRules,
  makeFakeEnrichment,
  makeFakeRepo
} from "./helpers/fixtures.mjs";

test("buildProjectAlignment favors reusable intake infra over niche vertical calendars", () => {
  const alignmentRules = makeFakeAlignmentRules();
  const projectProfile = {
    corpus: [
      "source systems",
      "connector families",
      "adapter",
      "scraper",
      "crawler",
      "review",
      "validation",
      "governance",
      "normalize",
      "schema",
      "entity",
      "taxonomy",
      "masterlist",
      "csv",
      "xlsx",
      "location",
      "venue",
      "event"
    ].join(" "),
    capabilitiesPresent: [
      "source_first",
      "evidence_acquisition",
      "quality_governance",
      "location_intelligence"
    ]
  };

  const infraRepo = makeFakeRepo({
    owner: "city-bureau",
    name: "city-scrapers-events"
  });
  const infraEnrichment = makeFakeEnrichment({
    repo: {
      description: "Open data event scraper adapter with validation, governance and schema normalization for public community calendars",
      topics: ["open-data", "events", "scraper", "adapter", "governance", "schema", "calendar"],
      stars: 180
    },
    readme: {
      excerpt: "Public event intake, review workflow, dedupe, normalization, masterlist CSV export and venue/location cleanup."
    },
    languages: ["Python", "HTML"]
  });
  const infraGuess = guessClassification(infraRepo, infraEnrichment);

  const verticalRepo = makeFakeRepo({
    owner: "sportclimbing",
    name: "ifsc-calendar"
  });
  const verticalEnrichment = makeFakeEnrichment({
    repo: {
      description: "Competition climbing timetable and stadium venue calendar",
      topics: ["climbing", "competition", "calendar", "stadium", "venue"],
      stars: 180
    },
    readme: {
      excerpt: "Competition schedule for arena events and climbing venues."
    },
    languages: ["JavaScript"]
  });
  const verticalGuess = guessClassification(verticalRepo, verticalEnrichment);

  const infraAlignment = buildProjectAlignment(
    infraRepo,
    infraGuess,
    infraEnrichment,
    projectProfile,
    alignmentRules,
    "Eventbaer Worker"
  );
  const verticalAlignment = buildProjectAlignment(
    verticalRepo,
    verticalGuess,
    verticalEnrichment,
    projectProfile,
    alignmentRules,
    "Eventbaer Worker"
  );

  assert.equal(infraAlignment.fitBand, "high");
  assert.ok(infraAlignment.fitScore > verticalAlignment.fitScore);
  assert.match(infraAlignment.rationale.join(" "), /source-family|normalization|governance/i);
  assert.match(verticalAlignment.rationale.join(" "), /domain-narrow/i);
});
