import test from "node:test";
import assert from "node:assert/strict";

import { buildCommandFailureGuidance } from "../scripts/shared/error-guidance.mjs";

test("guides fresh installs with no configured project toward bootstrap", () => {
  const output = buildCommandFailureGuidance(
    "No project is configured yet. Run 'npm run getting-started' or 'npm run bootstrap -- --project my-project --target ../my-project --label \"My Project\"' first.",
    {}
  );

  assert.match(output ?? "", /npm run bootstrap/);
  assert.match(output ?? "", /npm run getting-started/);
});

test("guides unknown project errors toward list-projects and bootstrap", () => {
  const output = buildCommandFailureGuidance("Unknown project 'demo'.", {
    projectKey: "demo"
  });

  assert.match(output ?? "", /npm run list:projects/);
  assert.match(output ?? "", /npm run bootstrap -- --project demo/);
});

test("guides missing URL intake errors toward the example intake command", () => {
  const output = buildCommandFailureGuidance("No GitHub URLs supplied. Pass URLs directly or via --file.", {
    projectKey: "sample"
  });

  assert.match(output ?? "", /npm run intake -- --project sample https:\/\/github.com\/example\/repo/);
  assert.match(output ?? "", /npm run sync:watchlist -- --project sample/);
});

test("guides missing watchlist configuration toward editing WATCHLIST and alternatives", () => {
  const output = buildCommandFailureGuidance("Project 'sample' has no watchlistFile configured.", {
    projectKey: "sample"
  });

  assert.match(output ?? "", /edit bindings\/sample\/WATCHLIST.txt/);
  assert.match(output ?? "", /npm run intake -- --project sample/);
});
