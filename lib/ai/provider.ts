import "server-only";

export type AiProviderName = "anthropic" | "mistral";

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5-20251001";

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function isMistralConfiguredServer(): boolean {
  return Boolean(process.env.MISTRAL_API_KEY?.trim());
}

export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_ANTHROPIC_MODEL;
}

export function getAnthropicMarkingModel(): string {
  return process.env.ANTHROPIC_MARKING_MODEL?.trim() || getAnthropicModel();
}

export function getPrimaryAiProvider(): AiProviderName {
  const configured = process.env.AI_PRIMARY_PROVIDER?.trim().toLowerCase();
  if (configured === "mistral") return "mistral";
  return "anthropic";
}

export function getAiProviderStatus() {
  const primary = getPrimaryAiProvider();
  const anthropicConfigured = isAnthropicConfigured();
  const mistralConfigured = isMistralConfiguredServer();

  return {
    primaryProvider: primary,
    anthropicConfigured,
    mistralConfigured,
    anthropicModel: getAnthropicModel(),
    anyConfigured: anthropicConfigured || mistralConfigured,
    activeProvider:
      primary === "anthropic"
        ? anthropicConfigured
          ? "anthropic"
          : mistralConfigured
            ? "mistral"
            : null
        : mistralConfigured
          ? "mistral"
          : anthropicConfigured
            ? "anthropic"
            : null,
  };
}
