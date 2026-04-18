import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGoldenPathCommands,
  renderNextCommandSections,
  selectPrimaryNextStep
} from "../scripts/shared/golden-path.mjs";

test("buildGoldenPathCommands builds the core workflow commands for one project", () => {
  const commands = buildGoldenPathCommands("sample-project");

  assert.equal(
    commands.bootstrap,
    'npm run bootstrap -- --project sample-project --target ../sample-project --label "My Project"'
  );
  assert.equal(
    commands.intake,
    "npm run intake -- --project sample-project https://github.com/example/repo"
  );
  assert.equal(
    commands.reviewWatchlist,
    "npm run review:watchlist -- --project sample-project --dry-run"
  );
});

test("selectPrimaryNextStep picks the first non-empty unique action", () => {
  const primary = selectPrimaryNextStep([
    "",
    "npm run intake -- --project sample-project https://github.com/example/repo",
    "npm run intake -- --project sample-project https://github.com/example/repo",
    "npm run release:check"
  ]);

  assert.equal(
    primary,
    "npm run intake -- --project sample-project https://github.com/example/repo"
  );
});

test("renderNextCommandSections renders a consistent next-step and also-useful block", () => {
  const output = renderNextCommandSections({
    primary: 'npm run bootstrap -- --project my-project --target ../my-project --label "My Project"',
    additional: [
      "npm run getting-started",
      "npm run getting-started"
    ]
  });

  assert.match(output, /## Next Step/);
  assert.match(output, /## Also Useful/);
  assert.match(output, /npm run getting-started/);
});
