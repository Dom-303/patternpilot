import fs from "node:fs/promises";
import path from "node:path";
import { runShellCommand } from "../utils.mjs";

const DELIVERY_PRIORITY_ORDER = {
  routine: 0,
  elevated: 1,
  urgent: 2
};

const BUILTIN_AUTOMATION_ALERT_PRESETS = {
  "github-actions-summary": [
    {
      type: "github-summary",
      name: "github-actions-summary"
    }
  ],
  "local-operator": [
    {
      type: "file",
      name: "alerts-journal",
      file: "state/automation_alerts_published.md"
    },
    {
      type: "command",
      name: "operator-digest",
      hook: "patternpilot-alert-hook",
      payloadFile: "state/automation_alert_hook_payload.json",
      hookMarkdownFile: "state/automation_alert_digest.md",
      hookJsonFile: "state/automation_alert_digest.json",
      minDeliveryPriority: "elevated"
    },
    {
      type: "file",
      name: "operator-attention",
      file: "state/automation_operator_attention.md",
      minDeliveryPriority: "urgent",
      attentionSignalsAny: [
        "operator_review_open",
        "operator_attention_alert"
      ]
    }
  ]
};

function normalizeTargetType(value) {
  return String(value ?? "").trim().toLowerCase();
}

function normalizeDeliveryPriority(value) {
  const priority = String(value ?? "routine").trim().toLowerCase();
  return DELIVERY_PRIORITY_ORDER[priority] != null ? priority : "routine";
}

function normalizeAttentionSignals(value) {
  return Array.isArray(value)
    ? Array.from(new Set(value.map((item) => String(item ?? "").trim()).filter(Boolean)))
    : [];
}

function buildFileTarget(rootDir, target) {
  const filePath = target.file
    ? path.isAbsolute(target.file) ? target.file : path.join(rootDir, target.file)
    : path.join(rootDir, "state", "automation_alerts_published.md");
  return {
    type: "file",
    filePath,
    name: target.name ?? null,
    minDeliveryPriority: target.minDeliveryPriority ? normalizeDeliveryPriority(target.minDeliveryPriority) : null,
    attentionSignalsAny: normalizeAttentionSignals(target.attentionSignalsAny)
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
    name: target.name ?? null,
    minDeliveryPriority: target.minDeliveryPriority ? normalizeDeliveryPriority(target.minDeliveryPriority) : null,
    attentionSignalsAny: normalizeAttentionSignals(target.attentionSignalsAny),
    hookName: builtinHook?.hookName ?? null,
    hookMarkdownFile: builtinHook?.hookMarkdownFile ?? null,
    hookJsonFile: builtinHook?.hookJsonFile ?? null
  };
}

function buildAutomationAlertTarget(rootDir, target) {
  const type = normalizeTargetType(target?.type);
  if (type === "file") {
    return buildFileTarget(rootDir, target);
  }
  if (type === "command") {
    return buildCommandTarget(rootDir, target);
  }
  if (type === "webhook") {
    return buildWebhookTarget(target);
  }
  return {
    type,
    name: target?.name ?? null,
    minDeliveryPriority: target?.minDeliveryPriority ? normalizeDeliveryPriority(target.minDeliveryPriority) : null,
    attentionSignalsAny: normalizeAttentionSignals(target?.attentionSignalsAny)
  };
}

function buildWebhookTarget(target) {
  return {
    type: "webhook",
    name: target?.name ?? null,
    url: target?.url ?? null,
    headers: target?.headers ?? {},
    minDeliveryPriority: target?.minDeliveryPriority ? normalizeDeliveryPriority(target.minDeliveryPriority) : null,
    attentionSignalsAny: normalizeAttentionSignals(target?.attentionSignalsAny)
  };
}

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

function resolvePresetAutomationAlertTargets(rootDir, config) {
  const preset = String(config?.automationAlertPreset ?? "").trim();
  if (!preset) {
    return [];
  }

  const targetTemplates = BUILTIN_AUTOMATION_ALERT_PRESETS[preset];
  if (!Array.isArray(targetTemplates) || targetTemplates.length === 0) {
    throw new Error(`Unknown automation alert preset '${preset}'.`);
  }

  return targetTemplates.map((target) => buildAutomationAlertTarget(rootDir, target));
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
    const presetTargets = resolvePresetAutomationAlertTargets(rootDir, config);
    if (presetTargets.length > 0) {
      return presetTargets;
    }
    return [{ type: "stdout" }];
  }

  return configuredTargets.map((target) => buildAutomationAlertTarget(rootDir, target));
}

function buildTargetLocation(rootDir, target) {
  if (target.type === "stdout") {
    return "stdout";
  }
  if (target.type === "file") {
    return path.relative(rootDir, target.filePath);
  }
  if (target.type === "github-summary") {
    return process.env.GITHUB_STEP_SUMMARY ?? "GITHUB_STEP_SUMMARY";
  }
  if (target.type === "command") {
    return target.payloadFile ? path.relative(rootDir, target.payloadFile) : null;
  }
  if (target.type === "webhook") {
    return target.url ?? null;
  }
  return null;
}

function assessAutomationAlertTarget(payload, target) {
  const attention = payload?.attention ?? {};
  const deliveryPriority = normalizeDeliveryPriority(attention.deliveryPriority);
  const attentionStatus = String(attention.status ?? "routine");
  const payloadSignals = new Set(normalizeAttentionSignals(attention.signals));
  const requiredSignals = normalizeAttentionSignals(target.attentionSignalsAny);

  if (target.minDeliveryPriority && (DELIVERY_PRIORITY_ORDER[deliveryPriority] ?? 0) < (DELIVERY_PRIORITY_ORDER[target.minDeliveryPriority] ?? 0)) {
    return {
      deliver: false,
      status: "skipped_delivery_priority",
      deliveryPriority,
      attentionStatus,
      reason: `payload priority '${deliveryPriority}' is below target minimum '${target.minDeliveryPriority}'.`
    };
  }

  if (requiredSignals.length > 0 && requiredSignals.every((signal) => !payloadSignals.has(signal))) {
    return {
      deliver: false,
      status: "skipped_attention_signals",
      deliveryPriority,
      attentionStatus,
      reason: `payload signals '${Array.from(payloadSignals).join(", ") || "-"}' do not match target signals '${requiredSignals.join(", ")}'.`
    };
  }

  return {
    deliver: true,
    status: "deliver",
    deliveryPriority,
    attentionStatus,
    reason: null
  };
}

async function writeCommandPayload(payloadFile, payload, dryRun = false) {
  if (dryRun) {
    return;
  }
  await fs.mkdir(path.dirname(payloadFile), { recursive: true });
  await fs.writeFile(payloadFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function deliverSingleTarget(rootDir, payload, target, dryRun = false) {
  const targeting = assessAutomationAlertTarget(payload, target);
  const deliveryContext = {
    targetName: target.name ?? null,
    minDeliveryPriority: target.minDeliveryPriority ?? null,
    attentionSignalsAny: target.attentionSignalsAny ?? [],
    deliveryPriority: targeting.deliveryPriority,
    attentionStatus: targeting.attentionStatus
  };

  if (!targeting.deliver) {
    return {
      type: target.type,
      status: targeting.status,
      location: buildTargetLocation(rootDir, target),
      reason: targeting.reason,
      ...deliveryContext
    };
  }

  if (target.type === "stdout") {
    if (!dryRun) {
      console.log(payload.markdown);
    }
    return {
      type: "stdout",
      status: dryRun ? "dry_run" : "printed",
      location: "stdout",
      ...deliveryContext
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
      location: path.relative(rootDir, target.filePath),
      ...deliveryContext
    };
  }

  if (target.type === "github-summary") {
    const summaryPath = process.env.GITHUB_STEP_SUMMARY ?? null;
    if (!summaryPath) {
      return {
        type: "github-summary",
        status: "missing_env",
        location: "GITHUB_STEP_SUMMARY",
        ...deliveryContext
      };
    }
    if (!dryRun) {
      await fs.mkdir(path.dirname(summaryPath), { recursive: true });
      await fs.appendFile(summaryPath, `${payload.markdown}\n`, "utf8");
    }
    return {
      type: "github-summary",
      status: dryRun ? "dry_run" : "written",
      location: summaryPath,
      ...deliveryContext
    };
  }

  if (target.type === "command") {
    if (!target.command) {
      return {
        type: "command",
        status: "missing_command",
        location: target.payloadFile ? path.relative(rootDir, target.payloadFile) : null,
        ...deliveryContext
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
      signal: result.signal,
      ...deliveryContext
    };
  }

  if (target.type === "webhook") {
    if (!target.url) {
      return {
        type: "webhook",
        status: "missing_url",
        location: null,
        ...deliveryContext
      };
    }
    if (dryRun) {
      return {
        type: "webhook",
        status: "dry_run",
        location: target.url,
        ...deliveryContext
      };
    }
    const result = await deliverWebhookPayload({
      url: target.url,
      payload: { text: payload.markdown, json: payload, generatedAt: payload.generatedAt },
      headers: target.headers ?? {}
    });
    return {
      type: "webhook",
      status: result.ok ? "delivered" : "delivery_failed",
      location: target.url,
      httpStatus: result.status ?? null,
      error: result.error ?? null,
      ...deliveryContext
    };
  }

  return {
    type: target.type,
    status: "unsupported_target",
    location: null,
    ...deliveryContext
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

export function renderAutomationAlertDeliverySummary({ generatedAt, deliveries, attention = null }) {
  const lines = deliveries.length > 0
    ? deliveries.map((delivery) => `- ${delivery.type}: ${delivery.status} | location=${delivery.location ?? "-"}${delivery.targetName ? ` | target=${delivery.targetName}` : ""}${delivery.attentionStatus ? ` | attention=${delivery.attentionStatus}` : ""}${delivery.deliveryPriority ? ` | priority=${delivery.deliveryPriority}` : ""}${delivery.minDeliveryPriority ? ` | min_priority=${delivery.minDeliveryPriority}` : ""}${delivery.attentionSignalsAny?.length ? ` | signals=${delivery.attentionSignalsAny.join(",")}` : ""}${delivery.reason ? ` | reason=${delivery.reason}` : ""}${delivery.hookName ? ` | hook=${delivery.hookName}` : ""}${delivery.hookMarkdownFile ? ` | hook_markdown=${delivery.hookMarkdownFile}` : ""}${delivery.hookJsonFile ? ` | hook_json=${delivery.hookJsonFile}` : ""}${delivery.command ? ` | command=${delivery.command}` : ""}${delivery.exitCode != null ? ` | exit_code=${delivery.exitCode}` : ""}`).join("\n")
    : "- none";

  return `# Patternpilot Automation Alert Delivery

- generated_at: ${generatedAt}
- targets: ${deliveries.length}
- attention_status: ${attention?.status ?? "routine"}
- delivery_priority: ${attention?.deliveryPriority ?? "routine"}
- attention_signals: ${Array.isArray(attention?.signals) && attention.signals.length > 0 ? attention.signals.join(", ") : "-"}

## Delivery Results

${lines}
`;
}
