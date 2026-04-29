import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { renderStaleDataBanner } from "../../lib/stale-data/banner.mjs";

describe("renderStaleDataBanner", () => {
  test("returns empty string when no stale rows", () => {
    const out = renderStaleDataBanner({ totalStale: 0, byReason: {}, examples: [] }, "demo");
    assert.equal(out, "");
  });

  test("renders banner with count, top reasons, examples and next-command hint", () => {
    const out = renderStaleDataBanner({
      totalStale: 5,
      byReason: { rules_fingerprint_drift: 3, fallback_decision_data: 2 },
      examples: ["https://github.com/a/b", "https://github.com/c/d", "https://github.com/e/f"]
    }, "demo");

    assert.match(out, /5 stale/);
    assert.match(out, /rules_fingerprint_drift/);
    assert.match(out, /fallback_decision_data/);
    assert.match(out, /https:\/\/github\.com\/a\/b/);
    assert.match(out, /re-evaluate.*--project demo.*--stale-only/);
  });
});
