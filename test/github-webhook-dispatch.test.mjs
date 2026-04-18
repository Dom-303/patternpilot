import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubWebhookExecutionContract,
  buildGithubWebhookDispatchPlan,
  classifyGithubWebhookCommand,
  executeGithubWebhookDispatchPlan,
  renderGithubWebhookDispatchSummary,
  summarizeGithubWebhookExecution,
  writeGithubWebhookDispatchArtifacts
} from "../lib/github-webhook-dispatch.mjs";

test("classifyGithubWebhookCommand distinguishes safe and force-gated commands", () => {
  assert.equal(classifyGithubWebhookCommand("run-drift"), "diagnostic");
  assert.equal(classifyGithubWebhookCommand("run-governance"), "governance_probe");
  assert.equal(classifyGithubWebhookCommand("on-demand"), "analysis_run");
});

test("buildGithubWebhookDispatchPlan marks ready commands as preview_ready without apply", () => {
  const dispatchPlan = buildGithubWebhookDispatchPlan({
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    routeStatus: "dispatchable",
    gate: "manual",
    commands: [
      {
        commandName: "on-demand",
        status: "ready",
        shellCommand: "\"npm\" \"run\" \"analyze\""
      }
    ]
  }, {
    apply: false
  });

  assert.equal(dispatchPlan.dispatchStatus, "preview_only");
  assert.equal(dispatchPlan.commands[0].dispatchStatus, "preview_ready");
  assert.equal(dispatchPlan.commands[0].executionClass, "analysis_run");
  assert.equal(dispatchPlan.commands[0].forceRequired, true);
});

test("buildGithubWebhookDispatchPlan schedules executable commands in apply mode", () => {
  const dispatchPlan = buildGithubWebhookDispatchPlan({
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "push.default_branch",
    routeStatus: "governance_review",
    gate: "governance",
    commands: [
      {
        commandName: "run-drift",
        status: "ready",
        shellCommand: "\"npm\" \"run\" \"patternpilot\" \"--\" \"run-drift\""
      },
      {
        commandName: "run-governance",
        status: "ready",
        shellCommand: "\"npm\" \"run\" \"patternpilot\" \"--\" \"run-governance\""
      },
      {
        commandName: "automation-dispatch",
        status: "guarded",
        shellCommand: "\"npm\" \"run\" \"patternpilot\" \"--\" \"automation-dispatch\""
      }
    ]
  }, {
    apply: true
  });

  assert.equal(dispatchPlan.dispatchStatus, "ready_to_execute");
  assert.equal(dispatchPlan.executableCommands.length, 2);
  assert.equal(dispatchPlan.executableCommands[0].commandName, "run-drift");
  assert.equal(dispatchPlan.executableCommands[1].commandName, "run-governance");
});

test("buildGithubWebhookDispatchPlan blocks force-gated commands without force", () => {
  const dispatchPlan = buildGithubWebhookDispatchPlan({
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    routeStatus: "dispatchable",
    gate: "manual",
    commands: [
      {
        commandName: "on-demand",
        status: "ready",
        shellCommand: "\"npm\" \"run\" \"analyze\""
      }
    ]
  }, {
    apply: true
  });

  assert.equal(dispatchPlan.dispatchStatus, "blocked_force_gate");
  assert.equal(dispatchPlan.executableCommands.length, 0);
  assert.equal(dispatchPlan.forceGatedCommands.length, 1);
  assert.equal(dispatchPlan.commands[0].dispatchStatus, "requires_force");
});

test("buildGithubWebhookDispatchPlan schedules force-gated commands when force is enabled", () => {
  const dispatchPlan = buildGithubWebhookDispatchPlan({
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    routeStatus: "dispatchable",
    gate: "manual",
    commands: [
      {
        commandName: "on-demand",
        status: "ready",
        shellCommand: "\"npm\" \"run\" \"analyze\""
      }
    ]
  }, {
    apply: true,
    force: true
  });

  assert.equal(dispatchPlan.dispatchStatus, "ready_to_execute");
  assert.equal(dispatchPlan.executableCommands.length, 1);
  assert.equal(dispatchPlan.executableCommands[0].commandName, "on-demand");
});

test("executeGithubWebhookDispatchPlan runs executable commands in order", async () => {
  const calls = [];
  const results = await executeGithubWebhookDispatchPlan({
    executableCommands: [
      { commandName: "run-drift", shellCommand: "echo run-drift" },
      { commandName: "run-governance", shellCommand: "echo run-governance" }
    ]
  }, {
    runShellCommand: async (command) => {
      calls.push(command);
      return { code: 0, signal: null };
    }
  });

  assert.deepEqual(calls, ["echo run-drift", "echo run-governance"]);
  assert.equal(results.length, 2);
});

test("summarizeGithubWebhookExecution reports failure and halted execution", () => {
  const dispatchPlan = buildGithubWebhookDispatchPlan({
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "push.default_branch",
    routeStatus: "governance_review",
    gate: "governance",
    commands: [
      {
        commandName: "run-drift",
        status: "ready",
        shellCommand: "echo run-drift"
      },
      {
        commandName: "run-governance",
        status: "ready",
        shellCommand: "echo run-governance"
      }
    ]
  }, {
    apply: true
  });

  const executionSummary = summarizeGithubWebhookExecution(dispatchPlan, [
    {
      commandName: "run-drift",
      shellCommand: "echo run-drift",
      exitCode: 1,
      signal: null
    }
  ]);

  assert.equal(executionSummary.finalStatus, "execution_failed");
  assert.equal(executionSummary.haltedEarly, true);
  assert.equal(executionSummary.firstFailure.commandName, "run-drift");
});

test("summarizeGithubWebhookExecution reports dry-run as not started by contract", () => {
  const dispatchPlan = buildGithubWebhookDispatchPlan({
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    routeStatus: "dispatchable",
    gate: "manual",
    commands: [
      {
        commandName: "on-demand",
        status: "ready",
        shellCommand: "echo on-demand"
      }
    ]
  }, {
    apply: true,
    force: true
  });

  const executionSummary = summarizeGithubWebhookExecution(dispatchPlan, [], {
    dryRun: true
  });

  assert.equal(executionSummary.finalStatus, "dry_run_not_executed");
});

test("buildGithubWebhookExecutionContract captures runner mode and scheduled commands", () => {
  const dispatchPlan = buildGithubWebhookDispatchPlan({
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    routeStatus: "dispatchable",
    gate: "manual",
    commands: [
      {
        commandName: "on-demand",
        status: "ready",
        shellCommand: "echo on-demand"
      }
    ]
  }, {
    apply: true,
    force: true
  });
  const executionSummary = summarizeGithubWebhookExecution(dispatchPlan, [], {
    dryRun: true
  });
  const executionContract = buildGithubWebhookExecutionContract({
    envelope: {
      deliveryId: "delivery-1",
      repository: {
        fullName: "Dom-303/patternpilot"
      }
    },
    routePlan: {
      projectSelection: {
        selectedProjectKey: "sample-project"
      },
      routeStatus: "dispatchable"
    },
    dispatchPlan,
    executionSummary
  }, {
    dryRun: true,
    cwd: "."
  });

  assert.equal(executionContract.contractStatus, "dispatch_ready_dry_run");
  assert.equal(executionContract.runnerMode, "dry_run_contract");
  assert.equal(executionContract.scheduledCommands.length, 1);
  assert.equal(executionContract.scheduledCommands[0].commandName, "on-demand");
});

test("writeGithubWebhookDispatchArtifacts writes dispatch artifacts", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-webhook-dispatch-"));
  const dispatchPlan = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    dispatchStatus: "preview_only",
    force: false
  };
  const executionContract = {
    contractStatus: "preview_only",
    runnerMode: "preview_contract"
  };
  const summary = renderGithubWebhookDispatchSummary({
    envelope: {
      deliveryId: "delivery-1",
      repository: {
        fullName: "Dom-303/patternpilot"
      }
    },
    routePlan: {
      routeStatus: "dispatchable"
    },
    dispatchPlan,
    executionContract,
    executionResults: []
  });

  const artifacts = await writeGithubWebhookDispatchArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    envelope: {
      deliveryId: "delivery-1"
    },
    routePlan: {
      routeStatus: "dispatchable"
    },
    dispatchPlan,
    executionContract,
    executionResults: [],
    summary,
    dryRun: false
  });

  const writtenEnvelope = JSON.parse(await fs.readFile(artifacts.envelopePath, "utf8"));
  const writtenRoute = JSON.parse(await fs.readFile(artifacts.routePath, "utf8"));
  const writtenDispatch = JSON.parse(await fs.readFile(artifacts.dispatchPath, "utf8"));
  const writtenExecutionContract = JSON.parse(await fs.readFile(artifacts.executionContractPath, "utf8"));
  const writtenExecutionSummary = JSON.parse(await fs.readFile(artifacts.executionSummaryPath, "utf8"));
  const writtenSummary = await fs.readFile(artifacts.summaryPath, "utf8");

  assert.equal(writtenEnvelope.deliveryId, "delivery-1");
  assert.equal(writtenRoute.routeStatus, "dispatchable");
  assert.equal(writtenDispatch.dispatchStatus, "preview_only");
  assert.equal(writtenExecutionContract.contractStatus, "preview_only");
  assert.equal(writtenExecutionSummary.finalStatus, "not_executed");
  assert.match(writtenSummary, /Patternpilot GitHub Webhook Dispatch/);
});
