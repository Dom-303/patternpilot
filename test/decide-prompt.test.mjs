import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { buildDecidePrompt, decidePromptPath } from "../lib/decide/prompt-builder.mjs";

describe("buildDecidePrompt", () => {
  test("includes queue entry, landkarte entry, project context, and asks for adopt/adapt/observe/ignore", () => {
    const prompt = buildDecidePrompt({
      projectKey: "demo",
      projectLabel: "Demo Project",
      projectContextSnippet: "Demo Project sammelt Events.",
      queueEntry: {
        repo_url: "https://github.com/foo/bar",
        normalized_repo_url: "https://github.com/foo/bar",
        project_key: "demo",
        decision_data_state: "live"
      },
      landkarteEntry: {
        name: "bar",
        category: "connector",
        pattern_family: "scraper",
        strengths: "Fast",
        weaknesses: "Fragile",
        learning_for_project: "Could inform our scraping layer"
      }
    });

    assert.match(prompt, /Demo Project/);
    assert.match(prompt, /https:\/\/github\.com\/foo\/bar/);
    assert.match(prompt, /scraper/);
    assert.match(prompt, /adopt.*adapt.*observe.*ignore/i);
    assert.match(prompt, /sammelt Events/);
  });

  test("works when landkarte entry is missing (queue-only repo)", () => {
    const prompt = buildDecidePrompt({
      projectKey: "demo",
      projectLabel: "Demo",
      projectContextSnippet: "ctx",
      queueEntry: {
        repo_url: "https://github.com/x/y",
        normalized_repo_url: "https://github.com/x/y",
        project_key: "demo"
      },
      landkarteEntry: null
    });

    assert.match(prompt, /https:\/\/github\.com\/x\/y/);
    assert.match(prompt, /(noch nicht in der Landkarte|not yet in landkarte)/i);
  });
});

describe("decidePromptPath", () => {
  test("derives a stable path under projects/<project>/decisions/", () => {
    const p = decidePromptPath("/abs/root", "demo", "https://github.com/foo/bar");
    assert.match(p, /\/abs\/root\/projects\/demo\/decisions\/foo-bar\.decide-prompt\.md$/);
  });
});
