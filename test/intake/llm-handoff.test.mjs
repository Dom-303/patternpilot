import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { buildIntakeSummaryPrompt, intakeSummaryPromptPath } from "../../lib/intake/llm-handoff.mjs";

describe("buildIntakeSummaryPrompt", () => {
  test("embeds dossier content + project label + clear instructions", () => {
    const prompt = buildIntakeSummaryPrompt({
      dossierContent: "# foo/bar\n- stars: 42\n- README: scrapes events",
      repoSlug: "foo-bar",
      repoUrl: "https://github.com/foo/bar",
      projectKey: "demo",
      projectLabel: "Demo Project"
    });

    assert.match(prompt, /Demo Project/);
    assert.match(prompt, /https:\/\/github\.com\/foo\/bar/);
    assert.match(prompt, /scrapes events/);
    assert.match(prompt, /Strengths/);
    assert.match(prompt, /Weaknesses/);
    assert.match(prompt, /Suggested category/);
  });

  test("instructs user to paste response back into dossier", () => {
    const prompt = buildIntakeSummaryPrompt({
      dossierContent: "x",
      repoSlug: "x",
      repoUrl: "https://github.com/x/x",
      projectKey: "p",
      projectLabel: "P"
    });
    assert.match(prompt, /zurück in die Dossier-Datei/);
    assert.match(prompt, /LLM-Augmented Summary/);
  });
});

describe("intakeSummaryPromptPath", () => {
  test("derives prompt path next to the dossier", () => {
    const p = intakeSummaryPromptPath("/abs/projects/demo/intake/run-1/foo-bar.md");
    assert.equal(p, "/abs/projects/demo/intake/run-1/foo-bar.summary-prompt.md");
  });
});
