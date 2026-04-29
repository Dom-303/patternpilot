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

function defaultConfig() {
  return { projects: {}, defaultProject: null, queueFile: "state/repo_intake_queue.csv" };
}

export async function runWizard(rootDir, {
  flags = {},
  config = null,
  isInteractive = process.stdin.isTTY && process.stdout.isTTY,
  configDir = defaultConfigDir(),
  printFn = null,
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
  const workingConfig = config ?? defaultConfig();

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

    const bootstrap = await performBootstrapFn(rootDir, workingConfig, {
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
        config: workingConfig,
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
