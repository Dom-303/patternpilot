import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildGithubWebhookRecoveryAssessment,
  buildGithubWebhookRecoveryContract,
  buildGithubWebhookResumeContract,
  buildGithubWebhookRunnerState,
  buildGithubWebhookRunnerPlan,
  evaluateGithubWebhookRecoveryContract,
  executeGithubWebhookRunnerPlan,
  loadGithubWebhookExecutionContract,
  renderGithubWebhookRunnerSummary,
  summarizeGithubWebhookRunnerExecution,
  writeGithubWebhookRunnerArtifacts
} from "../lib/github-webhook-runner.mjs";

test("buildGithubWebhookRunnerPlan previews commands without apply", () => {
  const runnerPlan = buildGithubWebhookRunnerPlan({
    contractStatus: "dispatch_ready_resume_contract",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    scheduledCommands: [
      {
        commandName: "on-demand",
        executionClass: "analysis_run",
        shellCommand: "echo on-demand",
        forceRequired: true
      }
    ]
  }, {
    apply: false
  });

  assert.equal(runnerPlan.runnerStatus, "preview_only");
  assert.equal(runnerPlan.commands[0].runnerStatus, "preview_ready");
});

test("buildGithubWebhookRunnerPlan blocks force-gated execution without force approval", () => {
  const runnerPlan = buildGithubWebhookRunnerPlan({
    contractStatus: "dispatch_ready_contract_only",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    forceRequested: false,
    scheduledCommands: [
      {
        commandName: "on-demand",
        executionClass: "analysis_run",
        shellCommand: "echo on-demand",
        forceRequired: true
      }
    ]
  }, {
    apply: true
  });

  assert.equal(runnerPlan.runnerStatus, "blocked_force_gate");
  assert.equal(runnerPlan.commands[0].runnerStatus, "requires_force");
});

test("buildGithubWebhookRunnerPlan schedules commands when force is approved", () => {
  const runnerPlan = buildGithubWebhookRunnerPlan({
    contractStatus: "dispatch_ready_contract_only",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    forceRequested: true,
    scheduledCommands: [
      {
        commandName: "on-demand",
        executionClass: "analysis_run",
        shellCommand: "echo on-demand",
        forceRequired: true
      }
    ]
  }, {
    apply: true
  });

  assert.equal(runnerPlan.runnerStatus, "ready_to_execute");
  assert.equal(runnerPlan.executableCommands.length, 1);
});

test("executeGithubWebhookRunnerPlan runs scheduled commands", async () => {
  const calls = [];
  const results = await executeGithubWebhookRunnerPlan({
    executableCommands: [
      { commandName: "run-drift", shellCommand: "echo run-drift" }
    ]
  }, {
    runShellCommand: async (command) => {
      calls.push(command);
      return { code: 0, signal: null };
    }
  });

  assert.deepEqual(calls, ["echo run-drift"]);
  assert.equal(results.length, 1);
});

test("summarizeGithubWebhookRunnerExecution reports dry-run execution", () => {
  const summary = summarizeGithubWebhookRunnerExecution({
    runnerStatus: "ready_to_execute",
    executableCommands: [
      { commandName: "on-demand" }
    ]
  }, [], {
    dryRun: true
  });

  assert.equal(summary.finalStatus, "dry_run_not_executed");
});

test("buildGithubWebhookRunnerState marks resumable work after a failure", () => {
  const executionContract = {
    contractStatus: "dispatch_ready_contract_only",
    eventKey: "repository_dispatch.patternpilot_on_demand"
  };
  const runnerPlan = buildGithubWebhookRunnerPlan({
    contractStatus: "dispatch_ready_contract_only",
    eventKey: "repository_dispatch.patternpilot_on_demand",
    scheduledCommands: [
      {
        commandName: "run-drift",
        executionClass: "diagnostic",
        shellCommand: "echo run-drift",
        forceRequired: false
      },
      {
        commandName: "on-demand",
        executionClass: "analysis_run",
        shellCommand: "echo on-demand",
        forceRequired: true
      }
    ]
  }, {
    apply: true,
    force: true
  });
  const executionSummary = summarizeGithubWebhookRunnerExecution(runnerPlan, [
    {
      commandName: "run-drift",
      shellCommand: "echo run-drift",
      exitCode: 0,
      signal: null
    },
    {
      commandName: "on-demand",
      shellCommand: "echo on-demand",
      exitCode: 1,
      signal: null
    }
  ]);

  const runnerState = buildGithubWebhookRunnerState({
    executionContract,
    runnerPlan,
    executionResults: [
      {
        commandName: "run-drift",
        shellCommand: "echo run-drift",
        exitCode: 0,
        signal: null
      },
      {
        commandName: "on-demand",
        shellCommand: "echo on-demand",
        exitCode: 1,
        signal: null
      }
    ],
    executionSummary
  });

  assert.equal(runnerState.resumeReady, true);
  assert.equal(runnerState.failedCommand.commandName, "on-demand");
  assert.equal(runnerState.remainingCommands.length, 1);
});

test("buildGithubWebhookResumeContract emits a resume-ready contract", () => {
  const resumeContract = buildGithubWebhookResumeContract({
    executionContract: {
      routeStatus: "dispatchable",
      dispatchStatus: "ready_to_execute",
      forceRequested: true,
      eventKey: "repository_dispatch.patternpilot_on_demand"
    },
    runnerPlan: {
      generatedAt: "2026-04-15T12:00:00.000Z"
    },
    runnerState: {
      generatedAt: "2026-04-15T12:00:00.000Z",
      eventKey: "repository_dispatch.patternpilot_on_demand",
      executionStatus: "execution_failed",
      resumeReady: true,
      failedCommand: {
        commandName: "on-demand"
      },
      remainingCommands: [
        {
          commandName: "on-demand",
          executionClass: "analysis_run",
          shellCommand: "echo on-demand",
          forceRequired: true,
          cwd: "."
        }
      ]
    }
  });

  assert.equal(resumeContract.contractStatus, "dispatch_ready_resume_contract");
  assert.equal(resumeContract.resumeFromCommand, "on-demand");
  assert.equal(resumeContract.scheduledCommands.length, 1);
  assert.equal(resumeContract.attemptNumber, 2);
});

test("buildGithubWebhookRecoveryAssessment marks analysis failures for manual review", () => {
  const recoveryAssessment = buildGithubWebhookRecoveryAssessment({
    executionContract: {
      attemptNumber: 1,
      maxAttempts: 3
    },
    runnerPlan: {
      attemptNumber: 1,
      maxAttempts: 3
    },
    runnerState: {
      generatedAt: "2026-04-15T12:00:00.000Z",
      attemptNumber: 1,
      maxAttempts: 3,
      resumeReady: true,
      failedCommand: {
        commandName: "on-demand",
        executionClass: "analysis_run"
      },
      failedExecution: {
        exitCode: 1,
        signal: null
      }
    },
    executionSummary: {
      finalStatus: "execution_failed",
      nextAction: "Inspect failure."
    }
  });

  assert.equal(recoveryAssessment.recoveryStatus, "manual_recovery_review");
  assert.equal(recoveryAssessment.retryable, false);
});

test("buildGithubWebhookRecoveryAssessment applies backoff for retryable failures", () => {
  const recoveryAssessment = buildGithubWebhookRecoveryAssessment({
    executionContract: {
      attemptNumber: 1,
      maxAttempts: 3
    },
    runnerPlan: {
      attemptNumber: 1,
      maxAttempts: 3
    },
    runnerState: {
      generatedAt: "2026-04-15T12:00:00.000Z",
      attemptNumber: 1,
      maxAttempts: 3,
      resumeReady: true,
      failedCommand: {
        commandName: "run-drift",
        executionClass: "diagnostic"
      },
      failedExecution: {
        exitCode: 124,
        signal: null
      }
    },
    executionSummary: {
      finalStatus: "execution_failed",
      nextAction: "Inspect failure."
    }
  });

  assert.equal(recoveryAssessment.recoveryStatus, "recovery_backoff_pending");
  assert.equal(recoveryAssessment.retryable, true);
  assert.equal(recoveryAssessment.backoffSeconds, 300);
  assert.equal(recoveryAssessment.nextAttemptNumber, 2);
});

test("buildGithubWebhookRecoveryContract emits a recovery contract", () => {
  const recoveryAssessment = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    currentAttempt: 1,
    nextAttemptNumber: 2,
    maxAttempts: 3,
    remainingAttempts: 2,
    retryClass: "transient_runtime_failure",
    retryable: true,
    backoffSeconds: 300,
    nextEligibleAt: "2026-04-15T12:05:00.000Z",
    recoveryStatus: "recovery_backoff_pending",
    nextAction: "Wait and recover."
  };
  const recoveryContract = buildGithubWebhookRecoveryContract({
    executionContract: {
      routeStatus: "dispatchable",
      dispatchStatus: "ready_to_execute",
      forceRequested: true,
      eventKey: "repository_dispatch.patternpilot_on_demand"
    },
    runnerPlan: {
      generatedAt: "2026-04-15T12:00:00.000Z"
    },
    runnerState: {
      generatedAt: "2026-04-15T12:00:00.000Z",
      eventKey: "repository_dispatch.patternpilot_on_demand",
      executionStatus: "execution_failed",
      failedCommand: {
        commandName: "on-demand"
      },
      remainingCommands: [
        {
          commandName: "on-demand",
          executionClass: "analysis_run",
          shellCommand: "echo on-demand",
          forceRequired: true,
          cwd: "."
        }
      ]
    },
    recoveryAssessment
  });

  assert.equal(recoveryContract.contractKind, "recovery_contract");
  assert.equal(recoveryContract.contractStatus, "recovery_backoff_pending");
  assert.equal(recoveryContract.attemptNumber, 2);
});

test("evaluateGithubWebhookRecoveryContract unlocks once backoff elapsed", () => {
  const evaluation = evaluateGithubWebhookRecoveryContract({
    contractStatus: "recovery_backoff_pending",
    recoveryAssessment: {
      nextEligibleAt: "2026-04-15T12:05:00.000Z"
    }
  }, {
    now: "2026-04-15T12:06:00.000Z"
  });

  assert.equal(evaluation.effectiveStatus, "dispatch_ready_recovery_contract");
});

test("writeGithubWebhookRunnerArtifacts writes runner files", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-webhook-runner-"));
  const executionContract = {
    contractStatus: "dispatch_ready_contract_only"
  };
  const runnerPlan = {
    generatedAt: "2026-04-15T12:00:00.000Z",
    runnerStatus: "preview_only"
  };
  const summary = renderGithubWebhookRunnerSummary({
    executionContract,
    runnerPlan,
    executionResults: [],
    executionSummary: {
      scheduledCount: 0,
      attemptedCount: 0,
      succeededCount: 0,
      failedCount: 0,
      finalStatus: "not_executed",
      nextAction: "Inspect."
    }
  });

  const artifacts = await writeGithubWebhookRunnerArtifacts(rootDir, {
    runId: "2026-04-15T12-00-00-000Z",
    executionContract,
    runnerPlan,
    executionResults: [],
    executionSummary: {
      finalStatus: "not_executed"
    },
    runnerState: {
      resumeReady: false
    },
    resumeContract: {
      contractStatus: "resume_not_required"
    },
    recoveryAssessment: {
      recoveryStatus: "recovery_not_required"
    },
    recoveryContract: {
      contractStatus: "recovery_not_required"
    },
    summary,
    dryRun: false
  });

  const writtenContract = JSON.parse(await fs.readFile(artifacts.contractPath, "utf8"));
  const writtenPlan = JSON.parse(await fs.readFile(artifacts.runnerPlanPath, "utf8"));
  const writtenRunnerState = JSON.parse(await fs.readFile(artifacts.runnerStatePath, "utf8"));
  const writtenResumeContract = JSON.parse(await fs.readFile(artifacts.resumeContractPath, "utf8"));
  const writtenRecoveryAssessment = JSON.parse(await fs.readFile(artifacts.recoveryAssessmentPath, "utf8"));
  const writtenRecoveryContract = JSON.parse(await fs.readFile(artifacts.recoveryContractPath, "utf8"));
  const writtenSummary = await fs.readFile(artifacts.summaryPath, "utf8");

  assert.equal(writtenContract.contractStatus, "dispatch_ready_contract_only");
  assert.equal(writtenPlan.runnerStatus, "preview_only");
  assert.equal(writtenRunnerState.resumeReady, false);
  assert.equal(writtenResumeContract.contractStatus, "resume_not_required");
  assert.equal(writtenRecoveryAssessment.recoveryStatus, "recovery_not_required");
  assert.equal(writtenRecoveryContract.contractStatus, "recovery_not_required");
  assert.match(writtenSummary, /Patternpilot GitHub Webhook Runner/);
});

test("loadGithubWebhookExecutionContract reads a stored contract", async () => {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "patternpilot-webhook-contract-"));
  const contractPath = path.join(rootDir, "execution-contract.json");
  await fs.writeFile(contractPath, `${JSON.stringify({ contractStatus: "dispatch_ready" }, null, 2)}\n`, "utf8");

  const contract = await loadGithubWebhookExecutionContract(contractPath);
  assert.equal(contract.contractStatus, "dispatch_ready");
});
