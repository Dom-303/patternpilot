#!/usr/bin/env node

import {
  buildAutomationAlertDigest,
  loadAutomationAlertHookPayload,
  parseAutomationAlertHookArgs,
  renderAutomationAlertHookMarkdown,
  writeAutomationAlertHookOutputs
} from "../../lib/automation/alert-hook.mjs";

const options = parseAutomationAlertHookArgs(process.argv.slice(2));
const payload = await loadAutomationAlertHookPayload(options, process.env);
const digest = buildAutomationAlertDigest(payload);
const markdown = renderAutomationAlertHookMarkdown(payload, digest);

await writeAutomationAlertHookOutputs({
  payload,
  digest,
  markdown,
  writeMarkdown: options.writeMarkdown,
  writeJson: options.writeJson
});

if (options.print || (!options.writeMarkdown && !options.writeJson)) {
  console.log(markdown);
}
