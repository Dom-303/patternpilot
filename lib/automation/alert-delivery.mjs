import fs from "node:fs/promises";
import path from "node:path";
import { runShellCommand } from "../utils.mjs";

function normalizeTargetType(value) {
  return String(value ?? "").trim().toLowerCase();
}

function buildFileTarget(rootDir, target) {
  const filePath = target.file
    ? path.isAbsolute(target.file) ? target.file : path.join(rootDir, target.file)
    : path.join(rootDir, "state", "automation_alerts_published.md");
  return {
    type: "file",
    filePath
  };
}

function quoteShellValue(value) {
  return JSON.stringify(String(value));
}

function resolveHookFile(rootDir, filePath) {
  return filePath
    ? path.isAbsolute(filePath) ? filePath : path.join(rootDir, filePath)
    : null;
}

function buildBuiltinHookCommand(rootDir, target, payloadFile) {
  const hookName = String(target.hook ?? "").trim();
  if (!hookName) {
    return null;
  }

  const scriptPath = path.join(rootDir, "automation", "hooks", `${hookName}.mjs`);
  const writeMarkdown = resolveHookFile(rootDir, target.hookMarkdownFile ?? target.markdownFile);
  const writeJson = resolveHookFile(rootDir, target.hookJsonFile ?? target.jsonFile);
  const parts = [
    "node",
    quoteShellValue(scriptPath),
    "--payload-file",
    quoteShellValue(payloadFile)
  ];

  if (writeMarkdown) {
    parts.push("--write-markdown", quoteShellValue(writeMarkdown));
  }
  if (writeJson) {
    parts.push("--write-json", quoteShellValue(writeJson));
  }
  if (target.hookPrint) {
    parts.push("--print");
  }

  return {
    hookName,
    command: parts.join(" "),
    hookMarkdownFile: writeMarkdown,
    hookJsonFile: writeJson
  };
}

function buildCommandTarget(rootDir, target) {
  const payloadFile = target.payloadFile
    ? path.isAbsolute(target.payloadFile) ? target.payloadFile : path.join(rootDir, target.payloadFile)
    : path.join(rootDir, "state", "automation_alert_delivery_payload.json");
  const cwd = target.cwd
    ? path.isAbsolute(target.cwd) ? target.cwd : path.join(rootDir, target.cwd)
    : rootDir;
  const builtinHook = !target.command && target.hook
    ? buildBuiltinHookCommand(rootDir, target, payloadFile)
    : null;
  return {
    type: "command",
    command: target.command ?? builtinHook?.command ?? null,
    payloadFile,
    cwd,
    hookName: builtinHook?.hookName ?? null,
    hookMarkdownFile: builtinHook?.hookMarkdownFile ?? null,
    hookJsonFile: builtinHook?.hookJsonFile ?? null
  };
}

export function resolveAutomationAlertTargets(rootDir, config, options = {}) {
  if (options.target) {
    const type = normalizeTargetType(options.target);
    if (type === "file") {
      return [buildFileTarget(rootDir, { file: options.file })];
    }
    if (type === "command") {
      return [buildCommandTarget(rootDir, {
        command: options.targetCommand,
        hook: options.targetHook,
        payloadFile: options.payloadFile,
        cwd: options.targetCwd,
        hookMarkdownFile: options.hookMarkdownFile,
        hookJsonFile: options.hookJsonFile,
        hookPrint: options.hookPrint
      })];
    }
    return [{ type }];
  }

  const configuredTargets = Array.isArray(config.automationAlertTargets)
    ? config.automationAlertTargets
    : [];
  if (configuredTargets.length === 0) {
    return [{ type: "stdout" }];
  }

  return configuredTargets.map((target) => {
    const type = normalizeTargetType(target?.type);
    if (type === "file") {
      return buildFileTarget(rootDir, target);
    }
    if (type === "command") {
      return buildCommandTarget(rootDir, target);
    }
    return { type };
  });
}

async function writeCommandPayload(payloadFile, payload, dryRun = false) {
  if (dryRun) {
    return;
  }
  await fs.mkdir(path.dirname(payloadFile), { recursive: true });
  await fs.writeFile(payloadFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function deliverSingleTarget(rootDir, payload, target, dryRun = false) {
  if (target.type === "stdout") {
    if (!dryRun) {
      console.log(payload.markdown);
    }
    return {
      type: "stdout",
      status: dryRun ? "dry_run" : "printed",
      location: "stdout"
    };
  }

  if (target.type === "file") {
    if (!dryRun) {
      await fs.mkdir(path.dirname(target.filePath), { recursive: true });
      await fs.writeFile(target.filePath, `${payload.markdown}\n`, "utf8");
    }
    return {
      type: "file",
      status: dryRun ? "dry_run" : "written",
      location: path.relative(rootDir, target.filePath)
    };
  }

  if (target.type === "github-summary") {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY ?? null;
    if (!summaryPath) {
      return {
        type: "github-summary",
        status: "missing_env",
        location: "GITHUB_STEP_SUMMARY"
      };
    }
    if (!dryRun) {
      await fs.mkdir(path.dirname(summaryPath), { recursive: true });
      await fs.appendFile(summaryPath, `${payload.markdown}\n`, "utf8");
    }
    return {
      type: "github-summary",
      status: dryRun ? "dry_run" : "written",
      location: summaryPath
    };
  }

  if (target.type === "command") {
    if (!target.command) {
      return {
        type: "command",
        status: "missing_command",
        location: target.payloadFile ? path.relative(rootDir, target.payloadFile) : null
      };
    }

    await writeCommandPayload(target.payloadFile, payload, dryRun);
    const result = dryRun
      ? { code: 0, signal: null }
      : await runShellCommand(target.command, {
          cwd: target.cwd,
          env: {
            ...process.env,
            PATTERNPILOT_ALERT_GENERATED_AT: payload.generatedAt,
            PATTERNPILOT_ALERT_PAYLOAD_FILE: target.payloadFile,
            PATTERNPILOT_ALERT_JSON: JSON.stringify(payload),
            PATTERNPILOT_ALERT_MARKDOWN: payload.markdown
          },
          stdio: "inherit"
        });

    return {
      type: "command",
      status: dryRun ? "dry_run" : result.code === 0 ? "executed" : "command_failed",
      location: path.relative(rootDir, target.payloadFile),
      command: target.command,
      hookName: target.hookName ?? null,
      hookMarkdownFile: target.hookMarkdownFile ? path.relative(rootDir, target.hookMarkdownFile) : null,
      hookJsonFile: target.hookJsonFile ? path.relative(rootDir, target.hookJsonFile) : null,
      exitCode: result.code,
      signal: result.signal
    };
  }

  return {
    type: target.type,
    status: "unsupported_target",
    location: null
  };
}

export async function deliverAutomationAlertPayload(rootDir, config, payload, options = {}) {
  const targets = resolveAutomationAlertTargets(rootDir, config, options);
  const deliveries = [];
  for (const target of targets) {
    deliveries.push(await deliverSingleTarget(rootDir, payload, target, options.dryRun));
  }
  return {
    generatedAt: payload.generatedAt,
    targets,
    deliveries
  };
}

export function renderAutomationAlertDeliverySummary({ generatedAt, deliveries }) {
  const lines = deliveries.length > 0
    ? deliveries.map((delivery) => `- ${delivery.type}: ${delivery.status} | location=${delivery.location ?? "-"}${delivery.hookName ? ` | hook=${delivery.hookName}` : ""}${delivery.hookMarkdownFile ? ` | hook_markdown=${delivery.hookMarkdownFile}` : ""}${delivery.hookJsonFile ? ` | hook_json=${delivery.hookJsonFile}` : ""}${delivery.command ? ` | command=${delivery.command}` : ""}${delivery.exitCode != null ? ` | exit_code=${delivery.exitCode}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot Automation Alert Delivery

- generated_at: ${generatedAt}
- targets: ${deliveries.length}

## Delivery Results

${lines}
`;
}
