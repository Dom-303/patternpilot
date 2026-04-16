import fs from "node:fs/promises";
import path from "node:path";

import {
  buildGithubWebhookEnvelope,
  parseWebhookHeadersContent
} from "../../../lib/index.mjs";
import { refreshContext } from "../../shared/runtime-helpers.mjs";

export { fs, path, refreshContext };

export async function loadGithubWebhookEventInput(rootDir, options) {
  if (!options.file) {
    throw new Error("This command requires --file <payload-json>.");
  }

  const generatedAt = new Date().toISOString();
  const payloadPath = path.isAbsolute(options.file)
    ? options.file
    : path.join(rootDir, options.file);
  const payloadText = await fs.readFile(payloadPath, "utf8");
  const payload = JSON.parse(payloadText);

  let headers = {};
  if (options.headersFile) {
    const headersPath = path.isAbsolute(options.headersFile)
      ? options.headersFile
      : path.join(rootDir, options.headersFile);
    const rawHeaders = await fs.readFile(headersPath, "utf8");
    headers = parseWebhookHeadersContent(rawHeaders);
  }

  const envelope = buildGithubWebhookEnvelope({
    generatedAt,
    headers,
    payloadText,
    payload,
    rawEvent: options.githubEvent ?? headers["x-github-event"] ?? null,
    deliveryId: options.deliveryId,
    githubAction: options.githubAction,
    signature: options.signature,
    webhookSecret: options.webhookSecret,
    env: process.env
  });

  return {
    generatedAt,
    payload,
    payloadText,
    headers,
    envelope
  };
}
