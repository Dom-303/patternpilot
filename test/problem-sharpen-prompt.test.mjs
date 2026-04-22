import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { buildSharpenPrompt } from "../lib/problem/sharpen-prompt.mjs";

describe("buildSharpenPrompt", () => {
  test("embeds slug, title, project, created_at as literals", () => {
    const prompt = buildSharpenPrompt({
      slug: "my-problem",
      title: "My problem title",
      projectKey: "my-project",
      createdAt: "2026-04-22"
    });
    assert.ok(prompt.includes("slug: my-problem"));
    assert.ok(prompt.includes("title: My problem title"));
    assert.ok(prompt.includes("project: my-project"));
    assert.ok(prompt.includes("created_at: 2026-04-22"));
  });

  test("omits project line when projectKey is null (standalone)", () => {
    const prompt = buildSharpenPrompt({
      slug: "x",
      title: "X",
      projectKey: null,
      createdAt: "2026-04-22"
    });
    assert.ok(!prompt.includes("project: null"));
    assert.ok(!prompt.includes("project: undefined"));
  });

  test("contains all three blocks + user-input placeholder", () => {
    const prompt = buildSharpenPrompt({
      slug: "x",
      title: "X",
      projectKey: "p",
      createdAt: "2026-04-22"
    });
    assert.ok(prompt.toLowerCase().includes("pattern pilot"), "Block 1 mentions tool");
    assert.ok(prompt.includes("search_terms"), "Block 2 guardrails");
    assert.ok(prompt.includes("<<HIER"), "Block 3 user-input placeholder");
  });

  test("contains few-shot example", () => {
    const prompt = buildSharpenPrompt({
      slug: "x",
      title: "X",
      projectKey: "p",
      createdAt: "2026-04-22"
    });
    assert.ok(prompt.toLowerCase().includes("beispiel"), "few-shot marker present");
  });

  test("is deterministic for same inputs", () => {
    const args = { slug: "x", title: "X", projectKey: "p", createdAt: "2026-04-22" };
    assert.equal(buildSharpenPrompt(args), buildSharpenPrompt(args));
  });
});
