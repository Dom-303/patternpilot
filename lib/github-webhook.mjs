import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

function normalizeHeaderMap(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[String(key).toLowerCase()] = value;
  }
  return normalized;
}

export function parseWebhookHeadersContent(content) {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return normalizeHeaderMap(parsed);
    }
  } catch {
    // fall through to line parsing
  }

  const headers = {};
  for (const line of String(content).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const separator = trimmed.indexOf(":");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator).trim().toLowerCase();
    const value = trimmed.slice(separator + 1).trim();
    headers[key] = value;
  }
  return headers;
}

export function resolveGithubWebhookSecret(options = {}, env = process.env) {
  return options.webhookSecret
    ?? env.PATTERNPILOT_GITHUB_WEBHOOK_SECRET
    ?? null;
}

export function computeGithubWebhookSignature(secret, payloadText) {
  const digest = crypto
    .createHmac("sha256", secret)
    .update(payloadText, "utf8")
    .digest("hex");
  return `sha256=${digest}`;
}

export function verifyGithubWebhookSignature({ secret, payloadText, signature }) {
  if (!signature) {
    return {
      status: "missing_signature",
      valid: false,
      expectedSignature: secret ? computeGithubWebhookSignature(secret, payloadText) : null
    };
  }

  if (!secret) {
    return {
      status: "missing_secret",
      valid: false,
      expectedSignature: null
    };
  }

  const expectedSignature = computeGithubWebhookSignature(secret, payloadText);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);
  const isValid = expectedBuffer.length === actualBuffer.length
    && crypto.timingSafeEqual(expectedBuffer, actualBuffer);

  return {
    status: isValid ? "verified" : "invalid_signature",
    valid: isValid,
    expectedSignature
  };
}

export function derivePatternpilotEventKeyFromWebhook(input) {
  const rawEvent = input.rawEvent ?? null;
  const action = input.githubAction ?? input.payload?.action ?? null;
  const payload = input.payload ?? {};

  if (rawEvent === "installation" && action === "created") {
    return "installation.created";
  }

  if (rawEvent === "installation_repositories" && action === "added") {
    return "installation_repositories.added";
  }

  if (rawEvent === "repository_dispatch") {
    const dispatchType = payload?.action ?? payload?.event_type ?? action ?? null;
    if (dispatchType === "patternpilot_on_demand") {
      return "repository_dispatch.patternpilot_on_demand";
    }
  }

  if (rawEvent === "workflow_dispatch" && action === "curation_review") {
    return "workflow_dispatch.curation_review";
  }

  if (rawEvent === "push") {
    const ref = payload?.ref ?? null;
    const defaultBranch = payload?.repository?.default_branch ?? null;
    if (ref && defaultBranch && ref === `refs/heads/${defaultBranch}`) {
      return "push.default_branch";
    }
  }

  return null;
}

export function buildGithubWebhookEnvelope(input) {
  const headers = normalizeHeaderMap(input.headers ?? {});
  const payloadText = input.payloadText ?? JSON.stringify(input.payload ?? {});
  const payload = input.payload ?? JSON.parse(payloadText);
  const rawEvent = input.rawEvent ?? headers["x-github-event"] ?? null;
  const deliveryId = input.deliveryId ?? headers["x-github-delivery"] ?? null;
  const githubAction = input.githubAction ?? payload?.action ?? null;
  const signature = input.signature ?? headers["x-hub-signature-256"] ?? null;
  const secret = resolveGithubWebhookSecret(input, input.env);
  const verification = verifyGithubWebhookSignature({
    secret,
    payloadText,
    signature
  });
  const patternpilotEventKey = input.eventKey ?? derivePatternpilotEventKeyFromWebhook({
    rawEvent,
    githubAction,
    payload
  });

  return {
    schemaVersion: 1,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    deliveryId,
    rawEvent,
    githubAction,
    patternpilotEventKey,
    signature,
    verification,
    repository: {
      fullName: payload?.repository?.full_name ?? null,
      defaultBranch: payload?.repository?.default_branch ?? null,
      visibility: payload?.repository?.visibility ?? null
    },
    installation: payload?.installation
      ? {
          id: payload.installation.id ?? null,
          accountLogin: payload?.installation?.account?.login ?? null,
          targetType: payload?.installation?.target_type ?? null
        }
      : null,
    payload
  };
}

export function renderGithubWebhookEnvelopeSummary({ envelope, preview }) {
  return `# Patternpilot GitHub Webhook Preview

- generated_at: ${envelope.generatedAt}
- delivery_id: ${envelope.deliveryId ?? "-"}
- raw_event: ${envelope.rawEvent ?? "-"}
- github_action: ${envelope.githubAction ?? "-"}
- patternpilot_event_key: ${envelope.patternpilotEventKey ?? "-"}
- signature_status: ${envelope.verification.status}
- signature_valid: ${envelope.verification.valid ? "yes" : "no"}
- repository: ${envelope.repository.fullName ?? "-"}
- installation_id: ${envelope.installation?.id ?? "-"}
- preview_status: ${preview.previewStatus}

## Routing

- next_route_gate: ${preview.route?.gate ?? "-"}
- next_route_commands: ${preview.route?.commandPath?.join(" -> ") ?? "-"}
- next_route_purpose: ${preview.route?.purpose ?? "-"}

## Next Action

- ${preview.nextAction}
`;
}

export async function writeGithubWebhookPreviewArtifacts(rootDir, options) {
  const integrationRoot = path.join(rootDir, "runs", "integration", "github-app-webhooks", options.runId);
  const envelopePath = path.join(integrationRoot, "envelope.json");
  const previewPath = path.join(integrationRoot, "event-preview.json");
  const summaryPath = path.join(integrationRoot, "summary.md");

  if (options.dryRun) {
    return {
      rootPath: integrationRoot,
      envelopePath,
      previewPath,
      summaryPath
    };
  }

  await fs.mkdir(integrationRoot, { recursive: true });
  await fs.writeFile(envelopePath, `${JSON.stringify(options.envelope, null, 2)}\n`, "utf8");
  await fs.writeFile(previewPath, `${JSON.stringify(options.preview, null, 2)}\n`, "utf8");
  await fs.writeFile(summaryPath, `${options.summary}\n`, "utf8");
  return {
    rootPath: integrationRoot,
    envelopePath,
    previewPath,
    summaryPath
  };
}
