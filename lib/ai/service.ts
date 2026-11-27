import "server-only";
import { createHash } from "node:crypto";
import { parseAssignmentFromText, type SmartAssignmentExtraction } from "@/lib/academic/ingestion";
import {
  extractAssignmentFromDocumentWithClaude,
  extractAssignmentFromTextWithClaude,
  type AiUsageMetrics,
} from "./anthropic";
import {
  extractAssignmentWithMistralSmall,
  isMistralConfigured,
  runMistralOcr,
} from "./mistral";
import { getAiProviderStatus, isAnthropicConfigured } from "./provider";

export interface SmartExtractionResult {
  extraction: SmartAssignmentExtraction;
  providerUsed: "anthropic" | "mistral" | "local_parser";
  usage?: AiUsageMetrics;
  warnings: string[];
  deduplicated?: boolean;
}

// Bounded in-memory idempotency cache (prevents duplicate AI API spend on double-clicks/refreshes)
const recentExtractionCache = new Map<string, { expiresAt: number; result: SmartExtractionResult }>();

function makeIdempotencyKey(params: {
  organizationId: string;
  contentHash?: string;
  text?: string;
}): string {
  const material = params.contentHash ?? createHash("sha256").update(params.text ?? "").digest("hex");
  return `${params.organizationId}:${material}`;
}

export async function runSmartAssignmentExtraction(input: {
  organizationId: string;
  authorizedCourses: Array<{ id: string; code: string; title: string }>;
  buffer?: Buffer;
  mimeType?: string;
  contentHash?: string;
  extractedText?: string;
}): Promise<SmartExtractionResult> {
  const status = getAiProviderStatus();
  const warnings: string[] = [];

  const cacheKey = makeIdempotencyKey({
    organizationId: input.organizationId,
    contentHash: input.contentHash,
    text: input.extractedText,
  });
  const cached = recentExtractionCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { ...cached.result, deduplicated: true };
  }

  const isBinaryMedia =
    Boolean(input.buffer) &&
    Boolean(input.mimeType) &&
    (input.mimeType === "application/pdf" ||
      input.mimeType === "image/jpeg" ||
      input.mimeType === "image/png" ||
      input.mimeType === "image/webp");

  const tryAnthropicFirst = status.primaryProvider === "anthropic" && isAnthropicConfigured();
  const tryMistral = isMistralConfigured();

  // 1. Primary: Anthropic Claude
  if (tryAnthropicFirst) {
    if (isBinaryMedia && input.buffer && input.mimeType) {
      const res = await extractAssignmentFromDocumentWithClaude({
        buffer: input.buffer,
        mimeType: input.mimeType,
        authorizedCourses: input.authorizedCourses,
      });
      if (res.ok) {
        const out: SmartExtractionResult = {
          extraction: res.extraction,
          providerUsed: "anthropic",
          usage: res.usage,
          warnings: res.extraction.warnings,
        };
        recentExtractionCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, result: out });
        return out;
      }
      warnings.push(res.error);
    } else if (input.extractedText?.trim()) {
      const res = await extractAssignmentFromTextWithClaude({
        text: input.extractedText,
        authorizedCourses: input.authorizedCourses,
      });
      if (res.ok) {
        const out: SmartExtractionResult = {
          extraction: res.extraction,
          providerUsed: "anthropic",
          usage: res.usage,
          warnings: res.extraction.warnings,
        };
        recentExtractionCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, result: out });
        return out;
      }
      warnings.push(res.error);
    }
  } else if (status.primaryProvider === "anthropic" && !isAnthropicConfigured()) {
    warnings.push("TuRnMaRk AI is not configured on the server.");
  }

  // 2. Secondary fallback: Mistral AI (preserved existing integration)
  if (tryMistral) {
    let textForMistral = input.extractedText?.trim() ?? "";
    if (!textForMistral && isBinaryMedia && input.buffer && input.mimeType) {
      const ocr = await runMistralOcr({ buffer: input.buffer, mimeType: input.mimeType });
      if (ocr.ok && ocr.text.trim()) {
        textForMistral = ocr.text;
      } else {
        warnings.push(ocr.ok ? "No readable text found in document." : ocr.error);
      }
    }
    if (textForMistral) {
      const ai = await extractAssignmentWithMistralSmall({
        text: textForMistral,
        authorizedCourses: input.authorizedCourses,
      });
      if (ai.ok) {
        const out: SmartExtractionResult = {
          extraction: ai.extraction,
          providerUsed: "mistral",
          warnings: [...warnings, ...ai.extraction.warnings],
        };
        recentExtractionCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, result: out });
        return out;
      }
      warnings.push(ai.error);
    }
  }

  // 3. Deterministic local fallback (never fabricates results)
  const localExtraction = parseAssignmentFromText(input.extractedText ?? "", input.authorizedCourses);
  return {
    extraction: localExtraction,
    providerUsed: "local_parser",
    warnings: [...warnings, ...localExtraction.warnings],
  };
}
