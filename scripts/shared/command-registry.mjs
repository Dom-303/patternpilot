const COMMANDS = [
  { name: "on-demand", description: "Run the primary manual flow for one project in a single step", handlerKey: "runOnDemand", aliases: ["analyze"] },
  { name: "policy-audit", description: "Run discovery with project policy in audit mode for calibration", handlerKey: "runPolicyAudit" },
  { name: "policy-calibrate", description: "Aggregate saved discovery runs into a project-wide policy calibration report", handlerKey: "runPolicyCalibrate" },
  { name: "policy-compare", description: "Compare the current discovery policy with an alternate policy file", handlerKey: "runPolicyCompare" },
  { name: "policy-pack", description: "Write a bundled discovery-policy calibration packet for one project", handlerKey: "runPolicyPack" },
  { name: "policy-review", description: "Re-evaluate a saved discovery run against the current project policy", handlerKey: "runPolicyReview" },
  { name: "policy-workbench", description: "Write a candidate-level calibration workbench from a saved discovery run", handlerKey: "runPolicyWorkbench" },
  { name: "policy-workbench-review", description: "Summarize manual verdicts and proposed-policy impact from a workbench", handlerKey: "runPolicyWorkbenchReview" },
  { name: "policy-suggest", description: "Derive a suggested policy variant from a workbench and compare it to the source run", handlerKey: "runPolicySuggest" },
  { name: "policy-trial", description: "Simulate a trial policy against the workbench source run and emit a candidate-level before/after matrix", handlerKey: "runPolicyTrial" },
  { name: "policy-cycle", description: "Run review -> suggest -> trial -> replay as one calibration loop and optionally apply the result", handlerKey: "runPolicyCycle" },
  { name: "policy-handoff", description: "Send selected policy-cycle candidates into the normal on-demand intake/review path", handlerKey: "runPolicyHandoff" },
  { name: "policy-curate", description: "Rank handoff candidates for curation and optionally prepare promotion packets", handlerKey: "runPolicyCurate" },
  { name: "policy-curation-review", description: "Preview which curated candidates would touch canonical knowledge artifacts", handlerKey: "runPolicyCurationReview" },
  { name: "policy-curation-apply", description: "Apply selected curated candidates into canonical knowledge artifacts", handlerKey: "runPolicyCurationApply" },
  { name: "policy-curation-batch-review", description: "Review multiple curated candidates together before batch apply", handlerKey: "runPolicyCurationBatchReview" },
  { name: "policy-curation-batch-plan", description: "Build a governance plan with safe sub-batches and manual-review cases", handlerKey: "runPolicyCurationBatchPlan" },
  { name: "policy-curation-batch-apply", description: "Apply the safe curated batch while skipping already promoted and high-risk candidates", handlerKey: "runPolicyCurationBatchApply" },
  { name: "run-plan", description: "Classify the next run as first, follow-up, or maintenance and show the default phase shape", handlerKey: "runPlan" },
  { name: "run-drift", description: "Inspect multi-run drift, queue staleness and resume guidance for one project", handlerKey: "runDrift" },
  { name: "run-stability", description: "Inspect recent lifecycle-relevant runs for stable/unstable streaks across multiple loops", handlerKey: "runStability" },
  { name: "run-governance", description: "Evaluate whether the next project run is manual-only, limited unattended, or fully unattended-ready", handlerKey: "runGovernance" },
  { name: "run-requalify", description: "Inspect whether a latched manual requalification can be cleared after stable follow-up loops", handlerKey: "runRequalify" },
  { name: "policy-apply", description: "Apply a proposed policy file back to the project with history snapshots", handlerKey: "runPolicyApply" },
  { name: "automation-dispatch", description: "Run the next ready automation job or a selected one", handlerKey: "runAutomationDispatch" },
  { name: "automation-jobs", description: "Show scheduler readiness for configured automation jobs", handlerKey: "runAutomationJobs" },
  { name: "automation-alert-deliver", description: "Deliver automation alerts to stdout, file, summary or local hook adapters", handlerKey: "runAutomationAlertDeliver" },
  { name: "automation-run", description: "Run discover -> intake -> review and optionally promote", handlerKey: "runAutomation" },
  { name: "doctor", description: "Show GitHub auth, rate-limit and workspace readiness", handlerKey: "runDoctor" },
  { name: "github-app-readiness", description: "Show how close the current setup is to a real GitHub App integration path", handlerKey: "runGithubAppReadiness" },
  { name: "github-app-plan", description: "Write the current GitHub App event, permission and command-mapping plan", handlerKey: "runGithubAppPlan" },
  { name: "github-app-event-preview", description: "Preview how one GitHub App event would map onto existing Patternpilot flows", handlerKey: "runGithubAppEventPreview" },
  { name: "github-app-installation-review", description: "Review one installation webhook packet against local project bindings before persisting it", handlerKey: "runGithubAppInstallationReview" },
  { name: "github-app-installation-apply", description: "Persist one installation webhook packet into the local installation registry", handlerKey: "runGithubAppInstallationApply" },
  { name: "github-app-installation-governance-review", description: "Review the current governance suggestion for one installation or project scope", handlerKey: "runGithubAppInstallationGovernanceReview" },
  { name: "github-app-installation-governance-apply", description: "Persist installation-level governance before multi-repo scope and handoff", handlerKey: "runGithubAppInstallationGovernanceApply" },
  { name: "github-app-installation-runtime-review", description: "Review the suggested runtime mode for one governed installation before app operations continue", handlerKey: "runGithubAppInstallationRuntimeReview" },
  { name: "github-app-installation-runtime-apply", description: "Persist installation runtime policy before scope, handoff and service behavior", handlerKey: "runGithubAppInstallationRuntimeApply" },
  { name: "github-app-installation-operations-review", description: "Review installation-level watchlist/service operations readiness before unattended app behavior", handlerKey: "runGithubAppInstallationOperationsReview" },
  { name: "github-app-installation-operations-apply", description: "Persist installation operations policy so app runtime behavior is governed per installation", handlerKey: "runGithubAppInstallationOperationsApply" },
  { name: "github-app-installation-scope", description: "Review which installation repositories are watchlist-ready versus still manual-review", handlerKey: "runGithubAppInstallationScope" },
  { name: "github-app-installation-handoff", description: "Hand off installation-scoped watchlist candidates into mapped project watchlists", handlerKey: "runGithubAppInstallationHandoff" },
  { name: "github-app-installation-show", description: "Show the current local GitHub App installation registry", handlerKey: "runGithubAppInstallationShow" },
  { name: "github-app-webhook-preview", description: "Preview one GitHub webhook delivery as a verified local envelope and mapped Patternpilot route", handlerKey: "runGithubAppWebhookPreview" },
  { name: "github-app-webhook-route", description: "Build a concrete command-oriented route plan from one verified webhook envelope", handlerKey: "runGithubAppWebhookRoute" },
  { name: "github-app-webhook-dispatch", description: "Turn a verified webhook route into a controlled local dispatch plan and optionally execute ready steps", handlerKey: "runGithubAppWebhookDispatch" },
  { name: "github-app-execution-enqueue", description: "Queue an execution, resume or recovery contract for the local GitHub App service loop", handlerKey: "runGithubAppExecutionEnqueue" },
  { name: "github-app-execution-run", description: "Consume an execution contract and run it through the separate local runner layer", handlerKey: "runGithubAppExecutionRun" },
  { name: "github-app-execution-recover", description: "Evaluate a recovery contract and continue execution once retry/backoff policy allows it", handlerKey: "runGithubAppExecutionRecover" },
  { name: "github-app-execution-resume", description: "Consume a resume contract and continue a previously interrupted runner flow", handlerKey: "runGithubAppExecutionResume" },
  { name: "github-app-service-review", description: "Review blocked, dead-letter or claimed service contracts before manual release", handlerKey: "runGithubAppServiceReview" },
  { name: "github-app-service-requeue", description: "Manually release blocked, dead-letter or claimed contracts back to pending", handlerKey: "runGithubAppServiceRequeue" },
  { name: "github-app-service-tick", description: "Process queued GitHub App runner contracts through a small local service loop", handlerKey: "runGithubAppServiceTick" },
  { name: "discover", description: "Search GitHub heuristically for project-fit repos before intake", handlerKey: "runDiscover" },
  { name: "discover-import", description: "Build a discovery run from an imported candidate JSON fixture", handlerKey: "runDiscoverImport" },
  { name: "init-project", description: "Bind a new local repo/workspace project to Patternpilot", handlerKey: "runInitProject" },
  { name: "init-env", description: "Create local env files from checked-in examples", handlerKey: "runInitEnv" },
  { name: "discover-workspace", description: "Scan workspace roots for git repos and binding candidates", handlerKey: "runDiscoverWorkspace" },
  { name: "list-projects", description: "Show configured Patternpilot project bindings", handlerKey: "printProjectList" },
  { name: "intake", description: "Create intake queue entries and dossiers from GitHub URLs", handlerKey: "runIntake" },
  { name: "promote", description: "Prepare or apply promotion candidates from queue to curated artifacts", handlerKey: "runPromote" },
  { name: "re-evaluate", description: "Refresh stale or fallback decision data in queue and intake docs", handlerKey: "runReEvaluate" },
  { name: "refresh-context", description: "Refresh STATUS.md and OPEN_QUESTION.md", handlerKey: "runRefreshContext" },
  { name: "review-watchlist", description: "Compare watchlist-backed intake repos against the target project", handlerKey: "runReviewWatchlist" },
  { name: "setup-checklist", description: "Show exactly which secrets or IDs are still needed and where to find them", handlerKey: "runSetupChecklist" },
  { name: "sync-all-watchlists", description: "Run watchlist intake across all configured projects", handlerKey: "runSyncAllWatchlists" },
  { name: "sync-watchlist", description: "Run intake against the configured project watchlist file", handlerKey: "runSyncWatchlist" },
  { name: "show-project", description: "Show the binding and reference context for a project", handlerKey: "runShowProject" },
  { name: "automation-alerts", description: "Show blocked/backoff automation jobs and recommended next action", handlerKey: "runAutomationAlerts" },
  { name: "automation-job-clear", description: "Clear scheduler state for a named automation job", handlerKey: "runAutomationJobClear" }
];

const COMMAND_MAP = new Map(COMMANDS.map((command) => [command.name, command]));
const ALIAS_MAP = new Map(
  COMMANDS.flatMap((command) => (command.aliases ?? []).map((alias) => [alias, command.name]))
);

const HELP_EXAMPLES = [
  "npm run analyze -- --project eventbear-worker https://github.com/City-Bureau/city-scrapers",
  "npm run patternpilot -- policy-audit --project eventbear-worker --dry-run",
  "npm run patternpilot -- policy-calibrate --project eventbear-worker",
  "npm run patternpilot -- policy-compare --project eventbear-worker --policy-file projects/eventbear-worker/DISCOVERY_POLICY.json",
  "npm run patternpilot -- policy-pack --project eventbear-worker --policy-file projects/eventbear-worker/DISCOVERY_POLICY.json",
  "npm run patternpilot -- policy-review --project eventbear-worker",
  "npm run patternpilot -- policy-workbench --project eventbear-worker",
  "npm run patternpilot -- policy-workbench-review --project eventbear-worker",
  "npm run patternpilot -- policy-suggest --project eventbear-worker",
  "npm run patternpilot -- policy-trial --project eventbear-worker",
  "npm run patternpilot -- policy-cycle --project eventbear-worker",
  "npm run patternpilot -- policy-handoff --project eventbear-worker",
  "npm run patternpilot -- policy-curate --project eventbear-worker --prepare-promotions",
  "npm run patternpilot -- policy-curation-review --project eventbear-worker --limit 1",
  "npm run patternpilot -- policy-curation-apply --project eventbear-worker --limit 1",
  "npm run patternpilot -- policy-curation-batch-review --project eventbear-worker --limit 2",
  "npm run patternpilot -- policy-curation-batch-plan --project eventbear-worker --limit 3",
  "npm run patternpilot -- policy-curation-batch-apply --project eventbear-worker --limit 2",
  "npm run patternpilot -- run-plan --project eventbear-worker",
  "npm run patternpilot -- run-drift --project eventbear-worker",
  "npm run patternpilot -- run-stability --project eventbear-worker",
  "npm run patternpilot -- run-governance --project eventbear-worker",
  "npm run patternpilot -- run-requalify --project eventbear-worker --scope automation",
  "npm run patternpilot -- policy-apply --project eventbear-worker --policy-file projects/eventbear-worker/calibration/workbench/<id>/proposed-policy.json",
  "npm run patternpilot -- on-demand --project eventbear-worker --analysis-profile architecture",
  "npm run patternpilot -- automation-jobs",
  "npm run patternpilot -- automation-dispatch --dry-run",
  "npm run patternpilot -- automation-alerts",
  "npm run patternpilot -- automation-alert-deliver --target file --file state/automation_alerts_published.md",
  "npm run patternpilot -- automation-alert-deliver --target command --target-hook patternpilot-alert-hook --hook-markdown-file state/automation_alert_digest.md --hook-json-file state/automation_alert_digest.json",
  "npm run patternpilot -- automation-job-clear --automation-job eventbear-worker-apply",
  "npm run automation:run -- --all-projects --promotion-mode prepared --dry-run",
  "npm run automation:run -- --project eventbear-worker --automation-job eventbear-worker-apply --automation-min-confidence medium --automation-max-new-candidates 5 --automation-re-evaluate-limit 20",
  "npm run automation:run -- --all-projects --automation-job all-project-watchlists --promotion-mode prepared --automation-continue-on-project-error --automation-lock-timeout-minutes 180",
  "npm run doctor -- --offline",
  "npm run patternpilot -- github-app-readiness",
  "npm run patternpilot -- github-app-plan",
  "npm run patternpilot -- github-app-event-preview --event-key installation.created --file deployment/github-app/examples/installation.created.json --dry-run",
  "npm run patternpilot -- github-app-installation-review --file deployment/github-app/examples/installation.created.json --headers-file deployment/github-app/examples/installation.created.headers.json --github-event installation --webhook-secret patternpilot-dev-secret --dry-run",
  "npm run patternpilot -- github-app-installation-apply --file deployment/github-app/examples/installation_repositories.added.json --headers-file deployment/github-app/examples/installation_repositories.added.headers.json --github-event installation_repositories --webhook-secret patternpilot-dev-secret --dry-run",
  "npm run patternpilot -- github-app-installation-governance-review --installation-id 10101 --dry-run",
  "npm run patternpilot -- github-app-installation-governance-apply --installation-id 10101 --project eventbear-worker --notes \"governed watchlist scope\" --dry-run",
  "npm run patternpilot -- github-app-installation-runtime-review --installation-id 10101 --dry-run",
  "npm run patternpilot -- github-app-installation-runtime-apply --installation-id 10101 --notes \"runtime for governed installation\" --dry-run",
  "npm run patternpilot -- github-app-installation-operations-review --installation-id 10101 --dry-run",
  "npm run patternpilot -- github-app-installation-operations-apply --installation-id 10101 --notes \"ops policy for governed installation\" --dry-run",
  "npm run patternpilot -- github-app-installation-scope --installation-id 10101 --dry-run",
  "npm run patternpilot -- github-app-installation-handoff --installation-id 10101 --notes \"watchlist sync after installation review\" --apply --dry-run",
  "npm run patternpilot -- github-app-installation-show",
  "npm run patternpilot -- github-app-webhook-preview --headers-file deployment/github-app/examples/installation.created.headers.json --file deployment/github-app/examples/installation.created.json --webhook-secret patternpilot-dev-secret --dry-run",
  "npm run patternpilot -- github-app-webhook-route --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json --github-event repository_dispatch --webhook-secret patternpilot-dev-secret --project eventbear-worker --dry-run",
  "npm run patternpilot -- github-app-webhook-dispatch --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json --github-event repository_dispatch --webhook-secret patternpilot-dev-secret --project eventbear-worker --dry-run",
  "npm run patternpilot -- github-app-webhook-dispatch --headers-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.headers.json --file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.json --github-event repository_dispatch --webhook-secret patternpilot-dev-secret --project eventbear-worker --apply --force --contract-only",
  "npm run patternpilot -- github-app-execution-enqueue --contract-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.recovery-contract.json",
  "npm run patternpilot -- github-app-execution-run --contract-file runs/integration/github-app-dispatch/<run-id>/execution-contract.json --dry-run",
  "npm run patternpilot -- github-app-execution-recover --contract-file runs/integration/github-app-runner/<run-id>/recovery-contract.json --apply --dry-run",
  "npm run patternpilot -- github-app-execution-resume --contract-file deployment/github-app/examples/repository_dispatch.patternpilot_on_demand.resume-contract.json --apply --dry-run",
  "npm run patternpilot -- github-app-service-review --from-status problematic --limit 5 --dry-run",
  "npm run patternpilot -- github-app-service-requeue --from-status dead_letter --limit 2 --notes \"manual release after review\" --apply --dry-run",
  "npm run patternpilot -- github-app-service-tick --limit 3 --worker-id worker-a --service-lease-minutes 20 --max-service-attempts 3 --dry-run",
  "npm run patternpilot -- discover --project eventbear-worker --discovery-profile balanced --report-view standard --dry-run",
  "npm run patternpilot -- discover-import --project eventbear-worker --file projects/eventbear-worker/calibration/discovery-candidates.example.json --dry-run",
  "npm run patternpilot -- discover --project eventbear-worker --discovery-policy-mode audit --dry-run",
  "npm run patternpilot -- policy-calibrate --project eventbear-worker --limit 5",
  "npm run patternpilot -- policy-review --project eventbear-worker --run-id 2026-04-13T14-11-11-441Z",
  "npm run patternpilot -- discover --project eventbear-worker --query \"scraper calendar venue\" --intake",
  "npm run patternpilot -- refresh-context",
  "npm run patternpilot -- re-evaluate --project eventbear-worker --stale-only",
  "npm run patternpilot -- review-watchlist --project eventbear-worker --analysis-profile architecture --analysis-depth deep --report-view full",
  "npm run init:env",
  "npm run init:project -- --project sample-worker --target ../sample-worker --label \"Sample Worker\"",
  "npm run discover:workspace",
  "npm run setup:checklist",
  "npm run sync:all -- --dry-run",
  "npm run patternpilot -- sync-watchlist --project eventbear-worker --dry-run",
  "npm run intake -- --project eventbear-worker https://github.com/City-Bureau/city-scrapers",
  "npm run intake -- --project eventbear-worker --file links.txt --dry-run",
  "npm run intake -- --project eventbear-worker --skip-enrich https://github.com/City-Bureau/city-scrapers",
  "npm run patternpilot -- promote --project eventbear-worker --from-status pending_review",
  "npm run patternpilot -- promote --project eventbear-worker --apply --from-status pending_review",
  "npm run show:project -- --project eventbear-worker"
];

function padCommandName(name, width) {
  return name.padEnd(width, " ");
}

export function listPatternpilotCommands() {
  return COMMANDS.map((command) => ({ ...command }));
}

export function resolvePatternpilotCommandName(commandName) {
  if (!commandName) {
    return null;
  }
  return ALIAS_MAP.get(commandName) ?? commandName;
}

export function getPatternpilotCommand(commandName) {
  const resolvedName = resolvePatternpilotCommandName(commandName);
  return resolvedName ? COMMAND_MAP.get(resolvedName) ?? null : null;
}

export function renderPatternpilotHelp() {
  const width = Math.max(...COMMANDS.map((command) => command.name.length)) + 2;
  const lines = COMMANDS.map((command) => {
    return `  ${padCommandName(command.name, width)}${command.description}`;
  });

  return `Patternpilot CLI

Commands:
${lines.join("\n")}

Examples:
  ${HELP_EXAMPLES.join("\n  ")}
`;
}
