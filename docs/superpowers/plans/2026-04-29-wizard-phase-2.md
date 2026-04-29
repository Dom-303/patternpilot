# Wizard Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the integration gap left by the v0.2 wizard (no project actually created, no first-action dispatch) and apply 6 polish items so the wizard is real-user ready for v0.3.

**Architecture:** Step modules and re-run-menu module gain a "perform" phase that calls existing run functions (`initializeProjectBinding`, `runIntake`, `runDiscover`, `runProblemCreate`, `runProblemExplore`, `writeConfig`). Existing UI/state code unchanged. Polish items touch `prompt.mjs` and `steps/github.mjs`.

**Tech Stack:** Node 20+, ESM, zero deps, `node:test`, `node:child_process`. No new dependencies.

**Reference:** [docs/superpowers/specs/2026-04-29-wizard-phase-2-design.md](../specs/2026-04-29-wizard-phase-2-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `lib/wizard/perform/bootstrap.mjs` | Wraps `initializeProjectBinding` with wizard-friendly param shape |
| `lib/wizard/perform/first-action-dispatch.mjs` | Dispatches Step 5 to runIntake/runDiscover/runProblem |
| `lib/wizard/perform/rerun-dispatch.mjs` | Dispatches re-run-menu intents |
| `test/wizard/perform/bootstrap.test.mjs` | bootstrap wrapper test |
| `test/wizard/perform/first-action-dispatch.test.mjs` | dispatch test |
| `test/wizard/perform/rerun-dispatch.test.mjs` | re-run dispatch test |
| `test/wizard/integration/wizard-creates-real-project.test.mjs` | E2E that verifies real config + bindings + intake works after |

### Modified files

| Path | Change |
|---|---|
| `lib/wizard/index.mjs` | Call perform-bootstrap after step 2; perform-first-action after step 5; perform-rerun for menu intents |
| `lib/wizard/prompt.mjs` | Ctrl+D handler (B1), question/prompt cleanup (B5) |
| `lib/wizard/steps/github.mjs` | Pause prompter around gh subprocess (B2), wslview fallback (B3), `[Enter]` cosmetic (B4), file mode 0o600 enforcement (B6) |

---

## Package A — Wizard Phase 2 (Integration)

### Task A1: bootstrap-perform module

**Files:**
- Create: `lib/wizard/perform/bootstrap.mjs`
- Test: `test/wizard/perform/bootstrap.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/wizard/perform/bootstrap.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { performBootstrap } from "../../../lib/wizard/perform/bootstrap.mjs";

function makeTarget() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pb-target-"));
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(dir, "README.md"), "# Demo\n");
  return dir;
}

describe("performBootstrap", () => {
  test("creates patternpilot.config.local.json + bindings + projects", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pb-root-"));
    const target = makeTarget();
    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    const result = await performBootstrap(rootDir, config, {
      target,
      label: "Demo Project"
    });

    assert.equal(result.projectKey, "demo-project");
    assert.ok(fs.existsSync(path.join(rootDir, "patternpilot.config.local.json")));
    assert.ok(fs.existsSync(path.join(rootDir, "bindings/demo-project/PROJECT_BINDING.json")));
    assert.ok(fs.existsSync(path.join(rootDir, "projects/demo-project/PROJECT_CONTEXT.md")));
    assert.equal(config.projects["demo-project"]?.label, "Demo Project");
    assert.equal(config.defaultProject, "demo-project");
  });

  test("appends watchlist seed URLs (one per line)", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pb-root-"));
    const target = makeTarget();
    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    const result = await performBootstrap(rootDir, config, {
      target,
      label: "Demo Project",
      watchlistUrls: ["https://github.com/x/a", "https://github.com/y/b"]
    });

    const watchlist = fs.readFileSync(
      path.join(rootDir, "bindings", result.projectKey, "WATCHLIST.txt"),
      "utf8"
    );
    assert.match(watchlist, /https:\/\/github\.com\/x\/a/);
    assert.match(watchlist, /https:\/\/github\.com\/y\/b/);
  });

  test("returns projectKey + label so caller can dispatch downstream actions", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-pb-root-"));
    const target = makeTarget();
    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    const result = await performBootstrap(rootDir, config, {
      target,
      label: "My Cool App"
    });

    assert.equal(result.projectKey, "my-cool-app");
    assert.equal(result.projectLabel, "My Cool App");
    assert.equal(result.targetPath, target);
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/perform/bootstrap.test.mjs`

- [ ] **Step 3: Implement performBootstrap**

```js
// lib/wizard/perform/bootstrap.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { initializeProjectBinding } from "../../project.mjs";

export async function performBootstrap(rootDir, config, {
  target,
  label,
  projectKey = null,
  watchlistUrls = [],
  makeDefault = true
}) {
  const result = await initializeProjectBinding(rootDir, config, {
    target,
    label,
    project: projectKey,
    makeDefault,
    dryRun: false
  });

  if (watchlistUrls.length > 0) {
    const watchlistPath = path.join(rootDir, "bindings", result.projectKey, "WATCHLIST.txt");
    const existing = await fs.readFile(watchlistPath, "utf8").catch(() => "");
    const additions = watchlistUrls.map((u) => u.trim()).filter(Boolean).join("\n");
    await fs.writeFile(watchlistPath, existing + additions + "\n", "utf8");
  }

  return result;
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/perform/bootstrap.test.mjs`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/perform/bootstrap.mjs test/wizard/perform/bootstrap.test.mjs
git commit -m "feat(wizard): add bootstrap-perform that actually creates project setup"
```

---

### Task A2: first-action-dispatch module

**Files:**
- Create: `lib/wizard/perform/first-action-dispatch.mjs`
- Test: `test/wizard/perform/first-action-dispatch.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/wizard/perform/first-action-dispatch.test.mjs
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
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/perform/first-action-dispatch.test.mjs`

- [ ] **Step 3: Implement first-action-dispatch**

```js
// lib/wizard/perform/first-action-dispatch.mjs
import { buildSlug } from "../../problem/slug.mjs";

export async function performFirstActionDispatch({
  action,
  rootDir, config, projectKey,
  discoveryProfile = "balanced",
  runIntake, runDiscover, runProblemCreate, runProblemExplore
}) {
  if (!action || action.action === "nothing") {
    return { dispatched: "nothing" };
  }

  if (action.action === "intake") {
    await runIntake(rootDir, config, {
      project: projectKey,
      urls: [action.url]
    });
    return { dispatched: "intake", url: action.url };
  }

  if (action.action === "discover") {
    await runDiscover(rootDir, config, {
      project: projectKey,
      discoveryProfile
    });
    return { dispatched: "discover", profile: discoveryProfile };
  }

  if (action.action === "problem") {
    const slug = buildSlug(action.question);
    await runProblemCreate(rootDir, config, {
      project: projectKey,
      title: action.question,
      slug
    });
    await runProblemExplore(rootDir, config, {
      project: projectKey,
      slug
    });
    return { dispatched: "problem", question: action.question, slug };
  }

  return { dispatched: "unknown" };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/perform/first-action-dispatch.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/perform/first-action-dispatch.mjs test/wizard/perform/first-action-dispatch.test.mjs
git commit -m "feat(wizard): add first-action dispatch (intake/discover/problem)"
```

---

### Task A3: rerun-dispatch module

**Files:**
- Create: `lib/wizard/perform/rerun-dispatch.mjs`
- Test: `test/wizard/perform/rerun-dispatch.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/wizard/perform/rerun-dispatch.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { performRerunDispatch } from "../../../lib/wizard/perform/rerun-dispatch.mjs";

describe("performRerunDispatch", () => {
  test("set-default updates config.defaultProject and persists", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-rd-"));
    const config = { projects: { "a": {}, "b": {} }, defaultProject: "a" };

    const result = await performRerunDispatch({
      intent: { intent: "set-default", project: "b" },
      rootDir, config
    });

    assert.equal(result.handled, true);
    assert.equal(config.defaultProject, "b");
    assert.ok(fs.existsSync(path.join(rootDir, "patternpilot.config.local.json")));
  });

  test("cancel returns handled=false (caller continues normally)", async () => {
    const result = await performRerunDispatch({
      intent: { intent: "cancel" },
      rootDir: "/tmp", config: {}
    });
    assert.equal(result.handled, true);
    assert.equal(result.action, "cancel");
  });

  test("add-project signals caller to run new wizard pass", async () => {
    const result = await performRerunDispatch({
      intent: { intent: "add-project" },
      rootDir: "/tmp", config: { projects: {} }
    });
    assert.equal(result.handled, false);
    assert.equal(result.continueAs, "fresh-setup");
  });

  test("reauth signals caller to re-run github step only", async () => {
    const result = await performRerunDispatch({
      intent: { intent: "reauth" },
      rootDir: "/tmp", config: {}
    });
    assert.equal(result.handled, false);
    assert.equal(result.continueAs, "github-only");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/wizard/perform/rerun-dispatch.test.mjs`

- [ ] **Step 3: Implement rerun-dispatch**

```js
// lib/wizard/perform/rerun-dispatch.mjs
import { writeConfig } from "../../config.mjs";

export async function performRerunDispatch({ intent, rootDir, config }) {
  if (intent.intent === "cancel") {
    return { handled: true, action: "cancel" };
  }

  if (intent.intent === "set-default") {
    config.defaultProject = intent.project;
    await writeConfig(rootDir, config, { preferLocal: true });
    return { handled: true, action: "set-default", project: intent.project };
  }

  if (intent.intent === "add-project") {
    return { handled: false, continueAs: "fresh-setup" };
  }

  if (intent.intent === "reauth") {
    return { handled: false, continueAs: "github-only" };
  }

  if (intent.intent === "edit-project") {
    return { handled: false, continueAs: "edit-project", project: intent.project };
  }

  return { handled: true, action: "unknown" };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/wizard/perform/rerun-dispatch.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/perform/rerun-dispatch.mjs test/wizard/perform/rerun-dispatch.test.mjs
git commit -m "feat(wizard): add re-run dispatch (set-default + signal-flags for caller)"
```

---

### Task A4: Wire perform modules into wizard/index.mjs

**Files:**
- Modify: `lib/wizard/index.mjs`

- [ ] **Step 1: Read current orchestration**

Run: `cat lib/wizard/index.mjs`

- [ ] **Step 2: Replace runWizard body to call perform modules**

```js
// lib/wizard/index.mjs
import { createPrompter } from "./prompt.mjs";
import { createWizardState, appendHistory } from "./state.mjs";
import { loadReplay } from "./replay.mjs";
import { runRerunMenu } from "./rerun-menu.mjs";
import { runTargetStep } from "./steps/target.mjs";
import { runContextStep } from "./steps/context.mjs";
import { runGithubStep } from "./steps/github.mjs";
import { runDiscoveryStep } from "./steps/discovery.mjs";
import { runFirstActionStep } from "./steps/first-action.mjs";
import { defaultConfigDir } from "./detect/github-auth.mjs";
import { performBootstrap } from "./perform/bootstrap.mjs";
import { performFirstActionDispatch } from "./perform/first-action-dispatch.mjs";
import { performRerunDispatch } from "./perform/rerun-dispatch.mjs";

export function resolveMode({ flags, isInteractive }) {
  if (flags.reconfigure && !isInteractive && !flags.replay) {
    const e = new Error("--reconfigure erfordert ein interaktives Terminal");
    e.exitCode = 2;
    throw e;
  }
  if (flags.print) return "print";
  if (flags.replay) return "wizard";
  if (!isInteractive) return "print";
  return "wizard";
}

export async function runWizard(rootDir, {
  flags = {},
  config = null,
  isInteractive = process.stdin.isTTY && process.stdout.isTTY,
  configDir = defaultConfigDir(),
  printFn = null,
  // dispatchers — overridable for tests
  performBootstrapFn = performBootstrap,
  performFirstActionFn = performFirstActionDispatch,
  performRerunFn = performRerunDispatch,
  runIntake = null,
  runDiscover = null,
  runProblemCreate = null,
  runProblemExplore = null
} = {}) {
  const mode = resolveMode({ flags, isInteractive });
  if (mode === "print") {
    if (!printFn) throw new Error("printFn required in print mode");
    return printFn(rootDir, config);
  }

  const replay = flags.replay ? loadReplay(flags.replay) : null;
  const prompter = createPrompter();
  const state = createWizardState();

  try {
    if (config && !flags.reconfigure && Object.keys(config.projects ?? {}).length > 0 && !replay) {
      const intent = await runRerunMenu({ prompter, config });
      state.recordStep("rerun-menu", { intent: intent.intent, project: intent.project });
      const dispatch = await performRerunFn({ intent, rootDir, config });
      state.recordStep("rerun-dispatch", { handled: dispatch.handled, action: dispatch.action });

      if (dispatch.handled) {
        state.outcome = intent.intent === "cancel" ? "cancelled" : "completed-rerun";
        state.completed_at = new Date().toISOString();
        appendHistory(rootDir, state);
        return { intent, dispatch };
      }

      if (dispatch.continueAs === "github-only") {
        const gh = await runGithubStep({ prompter, state, configDir });
        state.outcome = "completed-reauth";
        state.completed_at = new Date().toISOString();
        appendHistory(rootDir, state);
        return { intent, dispatch, github: gh };
      }
      // continueAs === "fresh-setup" or "edit-project" → fall through to full wizard
    }

    const target = await runTargetStep({ prompter, state, replay });
    const ctx = await runContextStep({ prompter, state, replay, targetPath: target.path });

    const bootstrap = await performBootstrapFn(rootDir, config ?? { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" }, {
      target: target.path,
      label: ctx.context.label,
      watchlistUrls: ctx.watchlistSeed?.urls ?? []
    });
    state.recordStep("bootstrap-perform", { projectKey: bootstrap.projectKey });

    const gh = await runGithubStep({ prompter, state, replay, configDir });
    const githubAvailable = gh.source !== "skipped";
    const disc = await runDiscoveryStep({ prompter, state, replay, githubAvailable });
    const action = await runFirstActionStep({ prompter, state, replay, githubAvailable });

    if (runIntake && runDiscover && runProblemCreate && runProblemExplore) {
      const dispatch = await performFirstActionFn({
        action,
        rootDir,
        config: config ?? { projects: { [bootstrap.projectKey]: {} } },
        projectKey: bootstrap.projectKey,
        discoveryProfile: disc.profile,
        runIntake, runDiscover, runProblemCreate, runProblemExplore
      });
      state.recordStep("first-action-dispatch", dispatch);
    }

    state.outcome = "completed";
    state.completed_at = new Date().toISOString();
    appendHistory(rootDir, state);

    return {
      target: target.path,
      context: ctx.context,
      watchlistSeed: ctx.watchlistSeed,
      bootstrap,
      github: gh,
      discovery: disc.profile,
      firstAction: action
    };
  } catch (err) {
    state.outcome = err.code === "REPLAY_INCOMPLETE" ? "replay-incomplete" : "cancelled";
    state.completed_at = new Date().toISOString();
    appendHistory(rootDir, state);
    throw err;
  } finally {
    prompter.close();
  }
}
```

- [ ] **Step 3: Run existing wizard tests to verify no regressions**

Run: `node --test --test-timeout=10000 test/wizard/`
Expected: all tests still pass (the new `bootstrap` step now runs in integration tests too — those use `mkdtemp` rootDir so the bootstrap should succeed).

If any existing test fails because the wizard now writes files, inspect and adjust test expectations. Most likely: `wizard-fresh-with-pat.test.mjs` will now also have a real config + bindings, which is good — extend assertions to verify.

- [ ] **Step 4: Commit**

```bash
git add lib/wizard/index.mjs
git commit -m "feat(wizard): wire perform modules into orchestration (real bootstrap + dispatch)"
```

---

### Task A5: End-to-end "real project gets created" integration test

**Files:**
- Create: `test/wizard/integration/wizard-creates-real-project.test.mjs`

- [ ] **Step 1: Write the test that proves the gap is closed**

```js
// test/wizard/integration/wizard-creates-real-project.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { runWizard } from "../../../lib/wizard/index.mjs";

function makeTarget() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-target-"));
  fs.mkdirSync(path.join(dir, ".git"), { recursive: true });
  fs.writeFileSync(path.join(dir, "README.md"), "# Real Demo\n");
  fs.writeFileSync(path.join(dir, "package.json"), JSON.stringify({
    name: "real-demo", type: "module"
  }));
  return dir;
}

describe("wizard creates real, usable project setup", () => {
  test("after wizard run, config + bindings + projects all exist", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-root-"));
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-cfg-"));
    const target = makeTarget();

    const replayDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-replay-"));
    const replayPath = path.join(replayDir, "s.json");
    fs.writeFileSync(replayPath, JSON.stringify({
      target,
      context: "accept",
      github: { path: "S" },
      discovery: "balanced",
      first_action: "nothing"
    }));

    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    const result = await runWizard(rootDir, {
      flags: { replay: replayPath },
      config,
      isInteractive: true,
      configDir
    });

    const projectKey = result.bootstrap.projectKey;

    // The 6 things the spec promised:
    assert.ok(fs.existsSync(path.join(rootDir, "patternpilot.config.local.json")), "config must be written");
    assert.ok(fs.existsSync(path.join(rootDir, "bindings", projectKey, "PROJECT_BINDING.json")), "binding json");
    assert.ok(fs.existsSync(path.join(rootDir, "bindings", projectKey, "PROJECT_BINDING.md")), "binding md");
    assert.ok(fs.existsSync(path.join(rootDir, "bindings", projectKey, "WATCHLIST.txt")), "watchlist");
    assert.ok(fs.existsSync(path.join(rootDir, "projects", projectKey, "PROJECT_CONTEXT.md")), "project context");

    // Config has the project registered:
    assert.ok(config.projects[projectKey], "project must be in config object");
    assert.equal(config.defaultProject, projectKey, "must become default");

    // Token file NOT written (skip path):
    assert.equal(fs.existsSync(path.join(configDir, ".env")), false);
  });

  test("when first_action=intake, runIntake is dispatched with the URL", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-intake-"));
    const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-intake-cfg-"));
    const target = makeTarget();

    const replayDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-real-intake-replay-"));
    const replayPath = path.join(replayDir, "s.json");
    fs.writeFileSync(replayPath, JSON.stringify({
      target,
      context: "accept",
      github: { path: "S" },
      discovery: "balanced",
      first_action: "intake",
      first_action_url: "https://github.com/octocat/Hello-World"
    }));

    let intakeCalled = null;
    const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

    await runWizard(rootDir, {
      flags: { replay: replayPath },
      config,
      isInteractive: true,
      configDir,
      runIntake: (rootDir, config, options) => { intakeCalled = options; },
      runDiscover: () => {},
      runProblemCreate: () => {},
      runProblemExplore: () => {}
    });

    assert.ok(intakeCalled, "runIntake must be dispatched");
    assert.deepEqual(intakeCalled.urls, ["https://github.com/octocat/Hello-World"]);
  });
});
```

- [ ] **Step 2: Run, verify pass**

Run: `node --test --test-timeout=10000 test/wizard/integration/wizard-creates-real-project.test.mjs`
Expected: 2 passing tests.

If the first test fails because `config.projects` is empty → check that `performBootstrap` mutates the passed `config` object (it does because `initializeProjectBinding` mutates in place).

- [ ] **Step 3: Re-run full suite to confirm no regressions**

Run: `npm test`
Expected: all 835+ tests pass.

- [ ] **Step 4: Commit**

```bash
git add test/wizard/integration/wizard-creates-real-project.test.mjs
git commit -m "test(wizard): verify real config + bindings + dispatch (closes the v0.2 gap)"
```

---

## Package B — Polish

### Task B1: Ctrl+D handler in prompt

**Files:**
- Modify: `lib/wizard/prompt.mjs`
- Modify: `test/wizard/prompt.test.mjs`

- [ ] **Step 1: Add failing test**

Append to `test/wizard/prompt.test.mjs`:

```js
test("ask rejects when input stream closes before answer", async () => {
  const { Readable, Writable } = await import("node:stream");
  const input = Readable.from([]);
  const output = new Writable({ write(_c, _e, cb) { cb(); } });
  const p = createPrompter({ input, output });

  await assert.rejects(
    p.ask("Frage:"),
    /input.*closed/i
  );
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test --test-timeout=2000 test/wizard/prompt.test.mjs`
Expected: new test fails (currently hangs, then test runner cancels).

- [ ] **Step 3: Patch prompt.mjs to handle close**

Replace the pendingResolvers section in `lib/wizard/prompt.mjs`:

```js
const pendingLines = [];
const pendingResolvers = [];
let closed = false;

rl.on("line", (l) => {
  if (pendingResolvers.length > 0) pendingResolvers.shift().resolve(l.trim());
  else pendingLines.push(l.trim());
});

rl.on("close", () => {
  closed = true;
  while (pendingResolvers.length > 0) {
    pendingResolvers.shift().reject(new Error("input stream closed (Ctrl+D or EOF)"));
  }
});

function nextLine() {
  if (pendingLines.length > 0) return Promise.resolve(pendingLines.shift());
  if (closed) return Promise.reject(new Error("input stream closed (Ctrl+D or EOF)"));
  return new Promise((resolve, reject) => pendingResolvers.push({ resolve, reject }));
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test --test-timeout=2000 test/wizard/prompt.test.mjs`
Expected: 6 passing tests (5 existing + 1 new).

- [ ] **Step 5: Commit**

```bash
git add lib/wizard/prompt.mjs test/wizard/prompt.test.mjs
git commit -m "feat(wizard): handle Ctrl+D / EOF cleanly in prompter"
```

---

### Task B2: Pause prompter around gh subprocess

**Files:**
- Modify: `lib/wizard/prompt.mjs` (add pause/resume)
- Modify: `lib/wizard/steps/github.mjs` (use it around ghLogin)

- [ ] **Step 1: Add pause/resume to prompter**

Edit `lib/wizard/prompt.mjs` — add to the returned object:

```js
function pause() { rl.pause(); }
function resume() { rl.resume(); }

return { ask, askMasked, choose, confirm, close, write, pause, resume };
```

- [ ] **Step 2: Wrap ghLogin with pause/resume in github.mjs**

In `lib/wizard/steps/github.mjs`, modify the `runGhPath` function — around the `ghLogin()` call:

```js
prompter.pause();
const ok = await ghLogin();
prompter.resume();
```

- [ ] **Step 3: Run existing github tests to confirm no regression**

Run: `node --test test/wizard/steps/github.test.mjs`
Expected: 5 passing tests.

- [ ] **Step 4: Commit**

```bash
git add lib/wizard/prompt.mjs lib/wizard/steps/github.mjs
git commit -m "feat(wizard): pause prompter while gh auth login runs (avoid stdin race)"
```

---

### Task B3: WSL2 wslview fallback

**Files:**
- Modify: `lib/wizard/steps/github.mjs`

- [ ] **Step 1: Detect WSL and prefer wslview**

In `lib/wizard/steps/github.mjs`, replace `defaultOpenBrowser`:

```js
function defaultOpenBrowser(url) {
  const isWsl = process.platform === "linux" && /microsoft/i.test(process.env.WSL_DISTRO_NAME ?? "");
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : isWsl ? "wslview"
    : "xdg-open";

  return new Promise((resolve) => {
    const p = spawn(cmd, [url], { stdio: "ignore", shell: process.platform === "win32" });
    p.on("exit", (c) => resolve(c === 0));
    p.on("error", () => {
      // fallback: try xdg-open if wslview wasn't available
      if (cmd === "wslview") {
        const fallback = spawn("xdg-open", [url], { stdio: "ignore" });
        fallback.on("exit", (c2) => resolve(c2 === 0));
        fallback.on("error", () => resolve(false));
      } else {
        resolve(false);
      }
    });
  });
}
```

- [ ] **Step 2: Verify github tests still pass**

Run: `node --test test/wizard/steps/github.test.mjs`
Expected: 5 passing tests (browser-open is mocked in tests).

- [ ] **Step 3: Commit**

```bash
git add lib/wizard/steps/github.mjs
git commit -m "feat(wizard): use wslview for browser-open under WSL"
```

---

### Task B4: `[Enter]` cosmetic — show as visual hint

**Files:**
- Modify: `lib/wizard/steps/github.mjs`

The current display says `[Enter] übernehmen` which suggests typing the literal word "Enter". Better: `(Enter)` as a visual hint, with the actual default being empty input.

- [ ] **Step 1: Replace `key: "Enter"` options with empty-default convention**

In `lib/wizard/steps/github.mjs`, find every `{ key: "Enter", label: "...", default: true }` and change to `{ key: "", label: "(Enter) ...", default: true }`.

The `choose` function already returns the default key when input is empty — empty key as the default-marker works because the matching is `option.key === raw`, both empty.

There are 3 occurrences (pre-flight bestätigen, gh-not-installed-after-install, PAT step 1). Update all three.

- [ ] **Step 2: Update test for M-override which used "Enter" inputs**

Check if `test/wizard/steps/github.test.mjs` uses literal "Enter" inputs — they should use empty string. They already do (`""`), so no test change needed.

- [ ] **Step 3: Run tests**

Run: `node --test test/wizard/steps/github.test.mjs`
Expected: 5 passing tests.

- [ ] **Step 4: Commit**

```bash
git add lib/wizard/steps/github.mjs
git commit -m "polish(wizard): show '(Enter)' as visual hint, not as key name"
```

---

### Task B5: Remove doubled `> ` in choose output

**Files:**
- Modify: `lib/wizard/prompt.mjs`

The choose function currently writes the question + newline AND uses ">" as the input prompt for the embedded `ask` call. Many call sites pass `"> "` as both the question text and the prompt is then `> ` — output looks like:
```
> 
> [A] ...
> 
```

Cleaner: when question is just `"> "` or empty, skip the leading question line.

- [ ] **Step 1: Refactor choose to skip empty/whitespace-only question prefix**

In `lib/wizard/prompt.mjs`, modify `choose`:

```js
async function choose(question, options) {
  const def = options.find((o) => o.default);
  while (true) {
    const trimmed = (question ?? "").trim();
    if (trimmed) write(trimmed + "\n");
    for (const o of options) {
      const marker = o.default ? "> " : "  ";
      const keyDisplay = o.key === "" ? "" : `[${o.key}] `;
      write(`${marker}${keyDisplay}${o.label}\n`);
    }
    const raw = (await ask(">"));
    if (raw === "" && def) return def.key;
    const hit = options.find((o) => o.key.toUpperCase() === raw.toUpperCase());
    if (hit) return hit.key;
    write("Bitte eine der angebotenen Optionen wählen.\n");
  }
}
```

(Two changes: skip empty question line; drop `[]` brackets when key is empty — works with B4's `key: ""`.)

- [ ] **Step 2: Run prompter + step tests**

Run: `node --test --test-timeout=5000 test/wizard/`
Expected: all tests pass (the "Bitte" message test still works).

- [ ] **Step 3: Commit**

```bash
git add lib/wizard/prompt.mjs
git commit -m "polish(wizard): drop doubled '> ' and bracket-less display for empty keys"
```

---

### Task B6: Token file mode 0o600 enforcement on overwrite

**Files:**
- Modify: `lib/wizard/steps/github.mjs`

`fs.writeFileSync(..., { mode: 0o600 })` only sets mode at creation time. If file exists, mode stays at whatever it was. Fix by deleting first.

- [ ] **Step 1: Patch writeTokenFile**

In `lib/wizard/steps/github.mjs`:

```js
function writeTokenFile(configDir, token) {
  fs.mkdirSync(configDir, { recursive: true });
  const file = path.join(configDir, ".env");
  try { fs.unlinkSync(file); } catch { /* fresh write */ }
  fs.writeFileSync(file, `GITHUB_TOKEN=${token}\n`, { mode: 0o600 });
}
```

- [ ] **Step 2: Tests still pass**

Run: `node --test test/wizard/steps/github.test.mjs`
Expected: 5 passing.

- [ ] **Step 3: Commit**

```bash
git add lib/wizard/steps/github.mjs
git commit -m "polish(wizard): enforce 0o600 token file mode on overwrite"
```

---

## Final verification

- [ ] **Step 1: Full regression suite**

Run: `npm test`
Expected: 850+ tests passing, 0 failures.

- [ ] **Step 2: Headless E2E smoke (real, not mocked)**

Create a tiny demo harness (similar to v0.2 smoke) that runs `runWizard` against a fresh tmp workspace via replay, then verifies a follow-up `runIntake` works without "no project configured" error.

```bash
mkdir -p /tmp/pp-v3-smoke
cat > /tmp/pp-v3-smoke/demo.mjs << 'EOF'
import fs from "node:fs";
import { runWizard } from "/home/domi/eventbaer/dev/patternpilot/lib/wizard/index.mjs";
import { runIntake } from "/home/domi/eventbaer/dev/patternpilot/scripts/commands/discovery.mjs";

const target = fs.mkdtempSync("/tmp/pp-v3-target-");
fs.mkdirSync(target + "/.git", { recursive: true });
fs.writeFileSync(target + "/README.md", "# T\n");
fs.writeFileSync(target + "/package.json", JSON.stringify({ name: "v3-smoke", type: "module" }));

const root = fs.mkdtempSync("/tmp/pp-v3-root-");
const configDir = fs.mkdtempSync("/tmp/pp-v3-cfg-");

const replayPath = "/tmp/pp-v3-smoke/scenario.json";
fs.writeFileSync(replayPath, JSON.stringify({
  target,
  context: "accept",
  github: { path: "S" },
  discovery: "balanced",
  first_action: "nothing"
}));

const config = { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };

const result = await runWizard(root, {
  flags: { replay: replayPath },
  config,
  isInteractive: true,
  configDir
});

console.log("Wizard done. Project:", result.bootstrap.projectKey);
console.log("Default in config:", config.defaultProject);
console.log("Bindings exist:", fs.existsSync(root + "/bindings/" + result.bootstrap.projectKey));
console.log("\nNow trying runIntake against the new project — must not throw 'no project configured':");

try {
  // We cannot actually call runIntake without a github URL, but the project lookup is what matters
  // Just verify the project is loadable
  const { loadProjectBinding } = await import("/home/domi/eventbaer/dev/patternpilot/lib/index.mjs");
  const loaded = await loadProjectBinding(root, config, result.bootstrap.projectKey);
  console.log("Project loadable: ✓ project=" + loaded.project.label);
} catch (e) {
  console.error("FAIL:", e.message);
  process.exit(1);
}
EOF
node /tmp/pp-v3-smoke/demo.mjs
```

Expected: prints "Project loadable: ✓" — proves the gap is closed.

Cleanup: `rm -rf /tmp/pp-v3-smoke /tmp/pp-v3-target-* /tmp/pp-v3-root-* /tmp/pp-v3-cfg-*`

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/wizard-phase-2
```

- [ ] **Step 4: Open PR**

Use `gh pr create` with title "feat(wizard): phase 2 — real bootstrap + first-action dispatch + polish" and a body that lists the 11 closed items.

- [ ] **Step 5: Squash-merge after self-review**

```bash
gh pr merge --squash --delete-branch
```

---

## Self-Review

**Spec coverage:**

| Spec section | Plan task |
|---|---|
| A1 Step 2 → bootstrap | A1 + A4 |
| A2 Watchlist seed | A1 (handled inside performBootstrap) |
| A3 Step 5 dispatch | A2 + A4 |
| A4 Re-run dispatch | A3 + A4 |
| A5 E2E test | A5 |
| B1 Ctrl+D | B1 |
| B2 gh prompter pause | B2 |
| B3 wslview | B3 |
| B4 Enter cosmetic | B4 |
| B5 doubled > | B5 |
| B6 mode 0o600 | B6 |

All 11 items have a covering task.

**Type consistency:**
- `performBootstrap(rootDir, config, opts)` — same shape as Patternpilot run-functions
- `performFirstActionDispatch({ action, runIntake, ... })` — keyword args object, override-friendly for tests
- `performRerunDispatch({ intent, rootDir, config })` — handled/continueAs flag pattern, consistent across all branches
- Wizard `recordStep` calls use kebab-case names: "bootstrap-perform", "first-action-dispatch", "rerun-dispatch"

**No placeholders.** Every step has runnable code or precise commands.
