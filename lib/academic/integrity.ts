export interface SubmissionTextRecord {
  submissionId: string;
  studentName: string;
  matricNumber: string;
  text: string;
  submittedAt: string | null;
}

export interface SimilarityPairResult {
  submissionAId: string;
  submissionBId: string;
  similarityScore: number;
  matchingPassages: Array<{ excerpt: string; tokens: number }>;
  explanation: string;
}

export interface AiRiskAssessmentResult {
  submissionId: string;
  riskCategory: "LOW" | "MEDIUM" | "HIGH" | "INCONCLUSIVE";
  indicators: string[];
  excerpts: string[];
  method: string;
  limitationsNote: string;
}

export function normalizeAcademicText(raw: string): string[] {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function buildNgrams(words: string[], n = 4): Set<string> {
  const grams = new Set<string>();
  for (let i = 0; i <= words.length - n; i += 1) {
    grams.add(words.slice(i, i + n).join(" "));
  }
  return grams;
}

export function analyzeSubmissionSimilarity(
  submissions: SubmissionTextRecord[],
  thresholdPercent = 25,
): SimilarityPairResult[] {
  const pairs: SimilarityPairResult[] = [];
  const tokenized = submissions.map((s) => {
    const words = normalizeAcademicText(s.text);
    return { ...s, words, grams: buildNgrams(words, 4) };
  });

  for (let i = 0; i < tokenized.length; i += 1) {
    for (let j = i + 1; j < tokenized.length; j += 1) {
      const a = tokenized[i];
      const b = tokenized[j];
      if (a.grams.size === 0 || b.grams.size === 0) continue;

      const shared: string[] = [];
      for (const gram of a.grams) {
        if (b.grams.has(gram)) shared.push(gram);
      }
      const unionSize = a.grams.size + b.grams.size - shared.length;
      if (unionSize <= 0) continue;

      const score = Math.round((shared.length / unionSize) * 10000) / 100;
      if (score >= thresholdPercent) {
        pairs.push({
          submissionAId: a.submissionId,
          submissionBId: b.submissionId,
          similarityScore: score,
          matchingPassages: shared.slice(0, 5).map((excerpt) => ({ excerpt, tokens: 4 })),
          explanation: `${shared.length} shared 4-word phrase(s) detected between ${a.matricNumber} and ${b.matricNumber}. Review context for common definitions or formulas before taking action.`,
        });
      }
    }
  }

  return pairs.sort((x, y) => y.similarityScore - x.similarityScore);
}

const GENERIC_AI_PHRASES = [
  "in conclusion",
  "furthermore",
  "moreover",
  "it is worth noting",
  "plays a crucial role",
  "in today's rapidly evolving",
  "delve into",
  "comprehensive overview",
  "on the other hand",
];

export function assessAiWritingRisk(submissionId: string, rawText: string): AiRiskAssessmentResult {
  const trimmed = rawText.trim();
  const words = normalizeAcademicText(trimmed);

  const limitationsNote =
    "AI-writing indicators are probabilistic signals and never conclusive proof of misconduct. Short answers, technical writing, and non-native English frequently trigger false positives.";

  if (words.length < 40) {
    return {
      submissionId,
      riskCategory: "INCONCLUSIVE",
      indicators: ["Response is shorter than 40 words; stylometric analysis is unreliable."],
      excerpts: [],
      method: "heuristic_stylometric_v1",
      limitationsNote,
    };
  }

  const lower = trimmed.toLowerCase();
  const matchedPhrases = GENERIC_AI_PHRASES.filter((phrase) => lower.includes(phrase));
  const sentences = trimmed.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const sentenceLengths = sentences.map((s) => s.split(/\s+/).length);
  const avgLen =
    sentenceLengths.length > 0
      ? sentenceLengths.reduce((sum, n) => sum + n, 0) / sentenceLengths.length
      : 0;
  const variance =
    sentenceLengths.length > 1
      ? sentenceLengths.reduce((sum, n) => sum + (n - avgLen) ** 2, 0) / sentenceLengths.length
      : 0;

  const indicators: string[] = [];
  if (matchedPhrases.length >= 2) {
    indicators.push(`Contains ${matchedPhrases.length} repeated generic transitional phrases (${matchedPhrases.slice(0, 3).join(", ")}).`);
  }
  if (sentences.length >= 4 && variance < 12) {
    indicators.push("Uniform sentence length across paragraphs (low burstiness).");
  }

  const riskCategory: AiRiskAssessmentResult["riskCategory"] =
    indicators.length >= 2 ? "HIGH" : indicators.length === 1 ? "MEDIUM" : "LOW";

  return {
    submissionId,
    riskCategory,
    indicators: indicators.length ? indicators : ["Natural sentence variation observed."],
    excerpts: sentences.slice(0, 2),
    method: "heuristic_stylometric_v1",
    limitationsNote,
  };
}
