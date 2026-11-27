import "server-only";

export type AiProviderName = "anthropic";

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

export function getAnthropicMarkingModel(): string {
  return process.env.ANTHROPIC_MARKING_MODEL?.trim() || getAnthropicModel();
}

export function getPrimaryAiProvider(): AiProviderName {
  return "anthropic";
}

export function getAiProviderStatus() {
  const anthropicConfigured = isAnthropicConfigured();
  return {
    primaryProvider: "anthropic" as const,
    anthropicConfigured,
    anthropicModel: getAnthropicModel(),
    anyConfigured: anthropicConfigured,
    activeProvider: anthropicConfigured ? ("anthropic" as const) : null,
  };
}
