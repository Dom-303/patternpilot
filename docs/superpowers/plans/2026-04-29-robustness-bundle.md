# Robustness Bundle (v0.4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close OQ-007 (stale-data visibility in user flows + audit) and OQ-008 (webhook alert channel + auto-resume) without new subsystems.

**Architecture:** Three additions, all reusing existing mechanics. Stale-data detector is a thin read-utility called from `intake`/`on-demand`. Re-evaluate audit log is append-only file. Webhook channel is a 5th type in existing alert-delivery dispatcher. Auto-resume is a tick called at start of `automation-jobs` listing.

**Reference:** [docs/superpowers/specs/2026-04-29-robustness-bundle-design.md](../specs/2026-04-29-robustness-bundle-design.md)

---

## File Structure

### New files

| Path | Responsibility |
|---|---|
| `lib/stale-data/detect.mjs` | Read-only stale-data scanner |
| `lib/stale-data/banner.mjs` | Banner formatter for command output |
| `lib/re-evaluate-history.mjs` | Append-only audit log writer/reader |
| `test/stale-data/detect.test.mjs` | scanner test |
| `test/stale-data/banner.test.mjs` | banner formatting test |
| `test/re-evaluate-history.test.mjs` | audit writer test |
| `test/automation/alert-delivery-webhook.test.mjs` | webhook channel test |
| `test/automation/auto-resume.test.mjs` | auto-resume test |

### Modified files

| Path | Change |
|---|---|
| `scripts/commands/discovery.mjs` | call stale-banner at top of `runIntake` |
| `scripts/commands/on-demand.mjs` | call stale-banner at top of `runOnDemand` |
| `scripts/commands/watchlist.mjs` | call audit writer in `runReEvaluate` |
| `lib/automation/alert-delivery.mjs` | add `webhook` channel type |
| `lib/automation/automation-jobs.mjs` | add `tickAutoResume` helper |
| `scripts/commands/automation/control-plane.mjs` | call `tickAutoResume` at start of `runAutomationJobs` |

---

## Task 1: Stale-data detector

**Files:**
- Create: `lib/stale-data/detect.mjs`
- Test: `test/stale-data/detect.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/stale-data/detect.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { summarizeStaleData } from "../../lib/stale-data/detect.mjs";

describe("summarizeStaleData", () => {
  test("returns zero counts when no rows are stale", () => {
    const rows = [
      { project_key: "p", decision_data_state: "live", drift_reasons: [] },
      { project_key: "p", decision_data_state: "live", drift_reasons: [] }
    ];
    const summary = summarizeStaleData(rows, "p");
    assert.equal(summary.totalStale, 0);
    assert.deepEqual(summary.byReason, {});
    assert.deepEqual(summary.examples, []);
  });

  test("counts stale rows and groups by drift reason", () => {
    const rows = [
      { project_key: "p", decision_data_state: "fallback", drift_reasons: ["fallback_decision_data"], repo_url: "https://github.com/a/b" },
      { project_key: "p", decision_data_state: "stale", drift_reasons: ["rules_fingerprint_drift"], repo_url: "https://github.com/c/d" },
      { project_key: "p", decision_data_state: "stale", drift_reasons: ["rules_fingerprint_drift"], repo_url: "https://github.com/e/f" },
      { project_key: "p", decision_data_state: "live", drift_reasons: [], repo_url: "https://github.com/g/h" }
    ];
    const summary = summarizeStaleData(rows, "p");
    assert.equal(summary.totalStale, 3);
    assert.equal(summary.byReason.fallback_decision_data, 1);
    assert.equal(summary.byReason.rules_fingerprint_drift, 2);
    assert.equal(summary.examples.length, 3);
  });

  test("limits examples to maxExamples (default 3)", () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      project_key: "p",
      decision_data_state: "stale",
      drift_reasons: ["stale_decision_data"],
      repo_url: `https://github.com/x/${i}`
    }));
    const summary = summarizeStaleData(rows, "p");
    assert.equal(summary.totalStale, 10);
    assert.equal(summary.examples.length, 3);
  });

  test("filters by project key", () => {
    const rows = [
      { project_key: "a", decision_data_state: "stale", drift_reasons: ["x"], repo_url: "url-a" },
      { project_key: "b", decision_data_state: "stale", drift_reasons: ["x"], repo_url: "url-b" }
    ];
    const summary = summarizeStaleData(rows, "a");
    assert.equal(summary.totalStale, 1);
    assert.equal(summary.examples[0], "url-a");
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `node --test test/stale-data/detect.test.mjs`

- [ ] **Step 3: Implement detector**

```js
// lib/stale-data/detect.mjs
const STALE_STATES = new Set(["fallback", "stale", "missing"]);

export function summarizeStaleData(queueRows, projectKey, { maxExamples = 3 } = {}) {
  const stale = queueRows.filter((row) =>
    row.project_key === projectKey
    && (STALE_STATES.has(row.decision_data_state) || (row.drift_reasons ?? []).length > 0)
  );

  const byReason = {};
  for (const row of stale) {
    const reasons = row.drift_reasons ?? [];
    for (const reason of reasons) {
      byReason[reason] = (byReason[reason] ?? 0) + 1;
    }
  }

  const examples = stale.slice(0, maxExamples).map((row) => row.repo_url || row.normalized_repo_url || "?");

  return {
    totalStale: stale.length,
    byReason,
    examples
  };
}
```

- [ ] **Step 4: Run, verify pass**

Run: `node --test test/stale-data/detect.test.mjs`
Expected: 4 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/stale-data/detect.mjs test/stale-data/detect.test.mjs
git commit -m "feat(stale-data): add detector that summarizes stale queue rows"
```

---

## Task 2: Stale-data banner formatter

**Files:**
- Create: `lib/stale-data/banner.mjs`
- Test: `test/stale-data/banner.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/stale-data/banner.test.mjs
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
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement banner**

```js
// lib/stale-data/banner.mjs
export function renderStaleDataBanner(summary, projectKey) {
  if (!summary || summary.totalStale === 0) return "";

  const lines = [
    "",
    `╭── Stale data notice ──────────────────────────`,
    `│  ${summary.totalStale} stale entr${summary.totalStale === 1 ? "y" : "ies"} in project '${projectKey}'`
  ];

  const reasons = Object.entries(summary.byReason)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([reason, count]) => `${reason} (${count})`);
  if (reasons.length > 0) {
    lines.push(`│  drift reasons: ${reasons.join(", ")}`);
  }

  for (const url of summary.examples) {
    lines.push(`│    - ${url}`);
  }

  lines.push(`│`);
  lines.push(`│  Refresh with:  npm run re-evaluate -- --project ${projectKey} --stale-only`);
  lines.push(`╰────────────────────────────────────────────`);
  lines.push("");

  return lines.join("\n");
}
```

- [ ] **Step 4: Run, verify pass**

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/stale-data/banner.mjs test/stale-data/banner.test.mjs
git commit -m "feat(stale-data): add banner formatter for command output"
```

---

## Task 3: Re-evaluate history writer

**Files:**
- Create: `lib/re-evaluate-history.mjs`
- Test: `test/re-evaluate-history.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/re-evaluate-history.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { appendReEvaluateRun, readReEvaluateHistory } from "../lib/re-evaluate-history.mjs";

describe("re-evaluate history", () => {
  test("appendReEvaluateRun creates state/re-evaluate-history.json", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-reh-"));
    await appendReEvaluateRun(rootDir, {
      runId: "run-1",
      projectKey: "demo",
      targetCount: 5,
      driftReasons: { rules_fingerprint_drift: 5 }
    });
    const file = path.join(rootDir, "state", "re-evaluate-history.json");
    assert.ok(fs.existsSync(file));
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(data.runs.length, 1);
    assert.equal(data.runs[0].targetCount, 5);
    assert.equal(data.runs[0].runId, "run-1");
  });

  test("appendReEvaluateRun appends without losing prior runs", async () => {
    const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "pp-reh-"));
    await appendReEvaluateRun(rootDir, { runId: "r1", projectKey: "demo", targetCount: 1, driftReasons: {} });
    await appendReEvaluateRun(rootDir, { runId: "r2", projectKey: "demo", targetCount: 2, driftReasons: {} });
    const data = await readReEvaluateHistory(rootDir);
    assert.equal(data.runs.length, 2);
    assert.equal(data.runs[1].runId, "r2");
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement history**

```js
// lib/re-evaluate-history.mjs
import fs from "node:fs/promises";
import path from "node:path";

export async function appendReEvaluateRun(rootDir, entry) {
  const dir = path.join(rootDir, "state");
  await fs.mkdir(dir, { recursive: true });
  const file = path.join(dir, "re-evaluate-history.json");

  const existing = await readJsonSafe(file);
  const data = existing ?? { runs: [] };
  data.runs.push({
    timestamp: new Date().toISOString(),
    ...entry
  });
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function readReEvaluateHistory(rootDir) {
  const file = path.join(rootDir, "state", "re-evaluate-history.json");
  return (await readJsonSafe(file)) ?? { runs: [] };
}

async function readJsonSafe(file) {
  try {
    const text = await fs.readFile(file, "utf8");
    return JSON.parse(text);
  } catch { return null; }
}
```

- [ ] **Step 4: Run, verify pass**

Expected: 2 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/re-evaluate-history.mjs test/re-evaluate-history.test.mjs
git commit -m "feat(re-evaluate): add append-only history writer for audit trail"
```

---

## Task 4: Wire stale-banner into intake + on-demand

**Files:**
- Modify: `scripts/commands/discovery.mjs` (runIntake)
- Modify: `scripts/commands/on-demand.mjs` (runOnDemand)

- [ ] **Step 1: Read existing runIntake start**

Run: `grep -n "export async function runIntake" scripts/commands/discovery.mjs`

The function starts around line 80. The first lines load project + queue rows.

- [ ] **Step 2: Add banner output after queue is loaded in runIntake**

Find the line `const existingQueueRows = await loadQueueEntries(rootDir, config);` (around line 98).

Add immediately after:

```js
  // Stale-data banner (OQ-007)
  if (!options.skipStaleBanner) {
    const { summarizeStaleData } = await import("../../lib/stale-data/detect.mjs");
    const { renderStaleDataBanner } = await import("../../lib/stale-data/banner.mjs");
    const summary = summarizeStaleData(existingQueueRows, projectKey);
    const banner = renderStaleDataBanner(summary, projectKey);
    if (banner) console.log(banner);
  }
```

- [ ] **Step 3: Same for runOnDemand**

`scripts/commands/on-demand.mjs` — find where queue rows are loaded (similar pattern). If there's no early queue load, add it just before the existing log header.

Run: `grep -n "loadQueueEntries\|projectKey" scripts/commands/on-demand.mjs | head -10`

Add after the queue load (first occurrence).

If `runOnDemand` doesn't load queue early, add a lightweight load:
```js
  if (!options.skipStaleBanner) {
    const { summarizeStaleData } = await import("../../lib/stale-data/detect.mjs");
    const { renderStaleDataBanner } = await import("../../lib/stale-data/banner.mjs");
    const { loadQueueEntries } = await import("../../lib/queue.mjs");
    const queueRows = await loadQueueEntries(rootDir, config);
    const summary = summarizeStaleData(queueRows, projectKey);
    const banner = renderStaleDataBanner(summary, projectKey);
    if (banner) console.log(banner);
  }
```

- [ ] **Step 4: Run full suite**

Run: `npm test`
Expected: all tests still pass. Banner is silent when no stale data.

- [ ] **Step 5: Commit**

```bash
git add scripts/commands/discovery.mjs scripts/commands/on-demand.mjs
git commit -m "feat(stale-data): show banner at start of intake and on-demand runs"
```

---

## Task 5: Wire history writer into runReEvaluate

**Files:**
- Modify: `scripts/commands/watchlist.mjs` (runReEvaluate)

- [ ] **Step 1: Read end of runReEvaluate**

Run: `sed -n '440,460p' scripts/commands/watchlist.mjs` to see the end of the function.

- [ ] **Step 2: Add history append after updates are written**

Right before the function returns / ends, add:

```js
  // History audit (OQ-007)
  if (!options.dryRun && updates.length > 0) {
    const { appendReEvaluateRun } = await import("../../lib/re-evaluate-history.mjs");
    const driftReasonsCount = {};
    for (const update of updates) {
      const reasons = update.triggerReasons ?? [];
      for (const reason of reasons) {
        driftReasonsCount[reason] = (driftReasonsCount[reason] ?? 0) + 1;
      }
    }
    await appendReEvaluateRun(rootDir, {
      runId,
      projectKey,
      targetCount: updates.length,
      driftReasons: driftReasonsCount,
      remainingTargets: remainingTargetRows
    });
  }
```

- [ ] **Step 3: Run, verify**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add scripts/commands/watchlist.mjs
git commit -m "feat(re-evaluate): write audit entry on every run"
```

---

## Task 6: Webhook alert channel

**Files:**
- Modify: `lib/automation/alert-delivery.mjs`
- Test: `test/automation/alert-delivery-webhook.test.mjs`

- [ ] **Step 1: Inspect existing alert-delivery to find dispatch point**

Run: `grep -n "type === \"file\"\|deliverTo\|dispatchOne" lib/automation/alert-delivery.mjs | head -10`

- [ ] **Step 2: Write failing webhook test**

```js
// test/automation/alert-delivery-webhook.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { deliverWebhookPayload } from "../../lib/automation/alert-delivery.mjs";

describe("webhook alert channel", () => {
  test("posts JSON payload to configured URL via fetcher", async () => {
    let received = null;
    const fetcher = async (url, init) => {
      received = { url, body: init.body, headers: init.headers };
      return { ok: true, status: 200 };
    };

    const result = await deliverWebhookPayload({
      url: "https://hooks.slack.com/services/X/Y/Z",
      payload: { text: "Test alert", priority: "elevated" }
    }, { fetcher });

    assert.equal(result.ok, true);
    assert.equal(received.url, "https://hooks.slack.com/services/X/Y/Z");
    assert.match(received.headers["content-type"] ?? received.headers["Content-Type"], /application\/json/);
    const body = JSON.parse(received.body);
    assert.equal(body.text, "Test alert");
  });

  test("returns ok=false on non-2xx response without throwing", async () => {
    const fetcher = async () => ({ ok: false, status: 500 });
    const result = await deliverWebhookPayload({
      url: "https://example.com/hook",
      payload: { text: "x" }
    }, { fetcher });
    assert.equal(result.ok, false);
    assert.equal(result.status, 500);
  });

  test("returns ok=false on network error without throwing", async () => {
    const fetcher = async () => { throw new Error("ECONNREFUSED"); };
    const result = await deliverWebhookPayload({
      url: "https://example.com/hook",
      payload: { text: "x" }
    }, { fetcher });
    assert.equal(result.ok, false);
    assert.match(result.error, /ECONNREFUSED/);
  });
});
```

- [ ] **Step 3: Implement deliverWebhookPayload**

Add to `lib/automation/alert-delivery.mjs` (export it):

```js
export async function deliverWebhookPayload({ url, payload, headers = {} }, { fetcher = fetch } = {}) {
  try {
    const res = await fetcher(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(payload)
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

Then wire into the channel-type dispatch. Find where existing types like `"file"` get handled and add `"webhook"`:

```js
// inside the channel dispatcher (find the if/else chain):
if (target.type === "webhook") {
  if (!target.url) return { ok: false, error: "webhook channel missing url" };
  return await deliverWebhookPayload({ url: target.url, payload }, opts);
}
```

(The exact integration point depends on the existing dispatch shape. Read the file first.)

- [ ] **Step 4: Run, verify**

Run: `node --test test/automation/alert-delivery-webhook.test.mjs`
Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```bash
git add lib/automation/alert-delivery.mjs test/automation/alert-delivery-webhook.test.mjs
git commit -m "feat(alerts): add webhook channel type (Slack/Discord/Teams compatible)"
```

---

## Task 7: Auto-resume for stuck automation jobs

**Files:**
- Modify: `lib/automation/automation-jobs.mjs`
- Modify: `scripts/commands/automation/control-plane.mjs`
- Test: `test/automation/auto-resume.test.mjs`

- [ ] **Step 1: Write failing test**

```js
// test/automation/auto-resume.test.mjs
import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { tickAutoResume } from "../../lib/automation/automation-jobs.mjs";

describe("tickAutoResume", () => {
  test("releases locks older than autoResumeMinutes", () => {
    const now = new Date("2026-04-29T12:00:00Z").getTime();
    const oldLock = new Date(now - 7 * 60 * 60 * 1000).toISOString(); // 7h ago
    const recentLock = new Date(now - 1 * 60 * 60 * 1000).toISOString(); // 1h ago

    const state = {
      jobs: {
        "job-old": { locked_at: oldLock, autoResumeMinutes: 360 },  // 6h default
        "job-recent": { locked_at: recentLock, autoResumeMinutes: 360 }
      }
    };

    const result = tickAutoResume(state, { now });

    assert.equal(result.released.length, 1);
    assert.equal(result.released[0].jobId, "job-old");
    assert.equal(state.jobs["job-old"].locked_at, null);
    assert.equal(state.jobs["job-recent"].locked_at, recentLock);
  });

  test("respects per-job autoResumeMinutes=0 (disabled)", () => {
    const now = new Date("2026-04-29T12:00:00Z").getTime();
    const veryOld = new Date(now - 99 * 60 * 60 * 1000).toISOString();

    const state = {
      jobs: {
        "job-disabled": { locked_at: veryOld, autoResumeMinutes: 0 }
      }
    };

    const result = tickAutoResume(state, { now });
    assert.equal(result.released.length, 0);
    assert.equal(state.jobs["job-disabled"].locked_at, veryOld);
  });

  test("uses default 360 minutes when autoResumeMinutes is undefined", () => {
    const now = new Date("2026-04-29T12:00:00Z").getTime();
    const oldLock = new Date(now - 7 * 60 * 60 * 1000).toISOString();

    const state = {
      jobs: {
        "job-default": { locked_at: oldLock }
      }
    };

    const result = tickAutoResume(state, { now });
    assert.equal(result.released.length, 1);
  });

  test("does not touch jobs without a lock", () => {
    const state = {
      jobs: {
        "job-free": { locked_at: null }
      }
    };

    const result = tickAutoResume(state);
    assert.equal(result.released.length, 0);
  });
});
```

- [ ] **Step 2: Run, verify fail**

- [ ] **Step 3: Implement tickAutoResume**

Add to `lib/automation/automation-jobs.mjs`:

```js
export function tickAutoResume(state, { now = Date.now() } = {}) {
  const released = [];
  const jobs = state?.jobs ?? {};

  for (const [jobId, job] of Object.entries(jobs)) {
    if (!job.locked_at) continue;

    const minutes = job.autoResumeMinutes != null
      ? Number(job.autoResumeMinutes)
      : 360;

    if (minutes <= 0) continue;

    const lockTime = new Date(job.locked_at).getTime();
    if (Number.isNaN(lockTime)) continue;

    const ageMs = now - lockTime;
    const thresholdMs = minutes * 60 * 1000;

    if (ageMs >= thresholdMs) {
      released.push({
        jobId,
        wasLockedAt: job.locked_at,
        ageMinutes: Math.floor(ageMs / 60000)
      });
      job.locked_at = null;
      job.auto_resumed_at = new Date(now).toISOString();
      job.auto_resume_age_minutes = Math.floor(ageMs / 60000);
    }
  }

  return { released };
}
```

- [ ] **Step 4: Wire into runAutomationJobs**

In `scripts/commands/automation/control-plane.mjs`, find `runAutomationJobs` and add at the start (after state load):

```js
  // Auto-resume tick (OQ-008)
  if (!options.skipAutoResume) {
    const { tickAutoResume, writeAutomationJobState } = await import("../../../lib/automation/automation-jobs.mjs");
    const tick = tickAutoResume(state);
    if (tick.released.length > 0) {
      await writeAutomationJobState(rootDir, config, state, options.dryRun);
      console.log(`# Auto-resumed ${tick.released.length} stuck job${tick.released.length === 1 ? "" : "s"}:`);
      for (const r of tick.released) {
        console.log(`- ${r.jobId} (locked for ${r.ageMinutes} min)`);
      }
      console.log("");
    }
  }
```

(Adjust the import path; use `loadAutomationJobs` if `state` isn't in scope already.)

- [ ] **Step 5: Run, verify**

Run: `node --test test/automation/auto-resume.test.mjs`
Expected: 4 passing tests.

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/automation/automation-jobs.mjs scripts/commands/automation/control-plane.mjs test/automation/auto-resume.test.mjs
git commit -m "feat(automation): auto-resume jobs locked longer than 6h (configurable per job)"
```

---

## Final verification

- [ ] **Step 1: Full regression**

Run: `npm test`
Expected: 850+ tests pass.

- [ ] **Step 2: Smoke — banner visibility**

Create a tmp queue with stale rows and call summarizeStaleData → renderStaleDataBanner. Should produce visible banner.

- [ ] **Step 3: PR + Merge + Release v0.4.0**

```bash
git push -u origin feat/robustness-bundle
gh pr create --title "feat(v0.4): robustness bundle — stale-data visibility + webhook alerts + auto-resume"
gh pr merge --squash --delete-branch
```

Then on main:
- Update CHANGELOG with v0.4.0 entry
- Bump package.json to 0.4.0
- Tag and push: `git tag v0.4.0 && git push --tags`
- `gh release create v0.4.0`

---

## Self-Review

**Spec coverage:**

| Spec section | Plan task |
|---|---|
| T1 Stale detector | Task 1 |
| T2 Banner in intake/on-demand | Task 2 + Task 4 |
| T3 Re-evaluate audit | Task 3 + Task 5 |
| T4 Webhook channel | Task 6 |
| T5 Auto-resume | Task 7 |

All 5 spec items covered.

**No placeholders.** Each task has runnable code, exact file paths, exact assertions.

**Type consistency:**
- `summarizeStaleData(rows, projectKey, opts) → { totalStale, byReason, examples }` — same shape used in banner
- `renderStaleDataBanner(summary, projectKey) → string` — same summary type
- `appendReEvaluateRun(rootDir, entry) / readReEvaluateHistory(rootDir)` — same shape as wizard-history
- `tickAutoResume(state, { now }) → { released: [{ jobId, wasLockedAt, ageMinutes }] }` — clear signature, used in control-plane wiring
