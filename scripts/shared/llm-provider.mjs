// scripts/shared/llm-provider.mjs
// Shared helper for building a generate function from config.llm

export async function buildGenerateFn(config) {
  if (!config.llm?.enabled) {
    throw new Error("LLM is not enabled in patternpilot.config.json. Cannot use --with-llm.");
  }
  if (!config.llm.provider) {
    throw new Error("llm.enabled=true but no provider configured. Set llm.provider in config.");
  }
  if (config.llm.provider === "stub") {
    return async (prompt) => `[stub-response for: ${prompt.slice(0, 40)}...]`;
  }
  throw new Error(`Unknown LLM provider: ${config.llm.provider}. MVP supports only 'stub'.`);
}
