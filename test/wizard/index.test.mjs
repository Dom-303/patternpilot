import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { resolveMode } from "../../lib/wizard/index.mjs";

describe("resolveMode", () => {
  test("--print forces print mode", () => {
    assert.equal(resolveMode({ flags: { print: true }, isInteractive: true }), "print");
  });

  test("non-interactive forces print mode", () => {
    assert.equal(resolveMode({ flags: {}, isInteractive: false }), "print");
  });

  test("interactive without --print is wizard", () => {
    assert.equal(resolveMode({ flags: {}, isInteractive: true }), "wizard");
  });

  test("--reconfigure without TTY throws", () => {
    assert.throws(
      () => resolveMode({ flags: { reconfigure: true }, isInteractive: false }),
      /erfordert ein interaktives Terminal/
    );
  });
});
