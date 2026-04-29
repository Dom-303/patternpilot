import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { performFirstActionDispatch } from "../../../lib/wizard/perform/first-action-dispatch.mjs";

describe("performFirstActionDispatch", () => {
  test("nothing returns early without calls", async () => {
    let calls = 0;
    const result = await performFirstActionDispatch({
      action: { action: "nothing" },
      rootDir: "/tmp", config: {}, projectKey: "x",
      runIntake: () => { calls++; }, runDiscover: () => { calls++; },
      runProblemCreate: () => { calls++; }, runProblemExplore: () => { calls++; }
    });
    assert.equal(calls, 0);
    assert.equal(result.dispatched, "nothing");
  });

  test("intake calls runIntake with project + url", async () => {
    let received = null;
    await performFirstActionDispatch({
      action: { action: "intake", url: "https://github.com/x/y" },
      rootDir: "/tmp", config: {}, projectKey: "demo",
      runIntake: (rootDir, config, options) => { received = { rootDir, options }; },
      runDiscover: () => {}, runProblemCreate: () => {}, runProblemExplore: () => {}
    });
    assert.equal(received.options.project, "demo");
    assert.deepEqual(received.options.urls, ["https://github.com/x/y"]);
  });

  test("discover calls runDiscover with project + profile", async () => {
    let received = null;
    await performFirstActionDispatch({
      action: { action: "discover" },
      rootDir: "/tmp", config: {}, projectKey: "demo",
      discoveryProfile: "balanced",
      runIntake: () => {},
      runDiscover: (rootDir, config, options) => { received = options; },
      runProblemCreate: () => {}, runProblemExplore: () => {}
    });
    assert.equal(received.project, "demo");
    assert.equal(received.discoveryProfile, "balanced");
  });

  test("problem creates then explores", async () => {
    const calls = [];
    await performFirstActionDispatch({
      action: { action: "problem", question: "Wie loesen andere PDF-Extraktion?" },
      rootDir: "/tmp", config: {}, projectKey: "demo",
      runIntake: () => {},
      runDiscover: () => {},
      runProblemCreate: (rootDir, config, options) => { calls.push(["create", options]); },
      runProblemExplore: (rootDir, config, options) => { calls.push(["explore", options]); }
    });
    assert.equal(calls.length, 2);
    assert.equal(calls[0][0], "create");
    assert.equal(calls[0][1].title, "Wie loesen andere PDF-Extraktion?");
    assert.equal(calls[0][1].project, "demo");
    assert.equal(calls[1][0], "explore");
  });
});
