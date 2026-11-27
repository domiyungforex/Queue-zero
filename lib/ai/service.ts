import "server-only";
import { createHash } from "node:crypto";
import { parseAssignmentFromText, type SmartAssignmentExtraction } from "@/lib/academic/ingestion";
import {
  extractAssignmentFromDocumentWithClaude,
  extractAssignmentFromTextWithClaude,
  type AiUsageMetrics,
} from "./anthropic";
import { isAnthropicConfigured } from "./provider";

export interface SmartExtractionResult {
  extraction: SmartAssignmentExtraction;
  providerUsed: "anthropic" | "local_parser";
  usage?: AiUsageMetrics;
  warnings: string[];
  deduplicated?: boolean;
}

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

  const isSupportedVisionOrPdf =
    Boolean(input.buffer) &&
    Boolean(input.mimeType) &&
    (input.mimeType === "application/pdf" ||
      input.mimeType === "image/jpeg" ||
      input.mimeType === "image/png" ||
      input.mimeType === "image/webp" ||
      input.mimeType === "image/gif");

  if (isAnthropicConfigured()) {
    if (isSupportedVisionOrPdf && input.buffer && input.mimeType) {
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
  } else {
    warnings.push("TuRnMaRk AI is temporarily unavailable. You can continue creating your assignment manually.");
  }

  const localExtraction = parseAssignmentFromText(input.extractedText ?? "", input.authorizedCourses);
  return {
    extraction: localExtraction,
    providerUsed: "local_parser",
    warnings: [...warnings, ...localExtraction.warnings],
  };
}
