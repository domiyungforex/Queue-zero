import type { QuestionType } from "./types";

export interface ObjectiveQuestionKey {
  questionId: string;
  questionType: QuestionType;
  marks: number;
  negativeMarks: number;
  partialCredit: boolean;
  acceptedAnswers: string[];
  modelAnswer?: string | null;
  expectedUnit?: string | null;
  numericTolerance?: number | null;
  decimalPrecision?: number | null;
  caseSensitive?: boolean;
}

export interface QuestionGradingOutcome {
  questionId: string;
  awardedMarks: number;
  maxMarks: number;
  markingSource: "AUTO_OBJECTIVE" | "AI_SUGGESTED" | "MANUAL";
  explanation: string;
  aiConfidence?: "HIGH" | "MEDIUM" | "LOW";
  criteriaSatisfied: string[];
  criteriaMissing: string[];
}

function normalizeAnswer(raw: string, caseSensitive: boolean): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  return caseSensitive ? trimmed : trimmed.toLowerCase();
}

function parseNumericWithUnit(raw: string): { value: number; unit: string } | null {
  const cleaned = raw.trim().replace(/,/g, "");
  const match = /^(-?\d+(?:\.\d+)?)\s*([a-zA-Z°/%^0-9-]*)$/.exec(cleaned);
  if (!match) return null;
  const value = Number(match[1]);
  if (!Number.isFinite(value)) return null;
  return { value, unit: match[2].trim().toLowerCase() };
}

export function gradeObjectiveQuestion(
  key: ObjectiveQuestionKey,
  studentResponse: unknown,
): QuestionGradingOutcome {
  const responseStr =
    typeof studentResponse === "string"
      ? studentResponse
      : Array.isArray(studentResponse)
        ? studentResponse.map(String).join(", ")
        : studentResponse != null
          ? String(studentResponse)
          : "";

  if (!responseStr.trim()) {
    return {
      questionId: key.questionId,
      awardedMarks: 0,
      maxMarks: key.marks,
      markingSource: "AUTO_OBJECTIVE",
      explanation: "No answer submitted.",
      criteriaSatisfied: [],
      criteriaMissing: ["Answer required"],
    };
  }

  // Subjective types require lecturer review (or AI-assisted recommendation)
  if (
    key.questionType === "LONG_ANSWER" ||
    key.questionType === "ESSAY" ||
    key.questionType === "PRACTICAL_FILE"
  ) {
    return {
      questionId: key.questionId,
      awardedMarks: 0,
      maxMarks: key.marks,
      markingSource: "MANUAL",
      explanation: "Subjective/practical response awaiting lecturer review.",
      criteriaSatisfied: [],
      criteriaMissing: [],
    };
  }

  // Mathematical / numerical tolerance evaluation
  if (key.questionType === "MATH") {
    const studentNum = parseNumericWithUnit(responseStr);
    const expectedRaw = key.acceptedAnswers[0] ?? key.modelAnswer ?? "";
    const expectedNum = parseNumericWithUnit(expectedRaw);

    if (studentNum && expectedNum) {
      const tolerance = Math.max(0, Number(key.numericTolerance ?? 0));
      const diff = Math.abs(studentNum.value - expectedNum.value);
      const unitMatches =
        !key.expectedUnit ||
        !studentNum.unit ||
        studentNum.unit === key.expectedUnit.trim().toLowerCase();

      if (diff <= tolerance && unitMatches) {
        return {
          questionId: key.questionId,
          awardedMarks: key.marks,
          maxMarks: key.marks,
          markingSource: "AUTO_OBJECTIVE",
          explanation:
            diff === 0
              ? "Exact numerical match."
              : `Within configured tolerance (±${tolerance}).`,
          criteriaSatisfied: ["Correct final value"],
          criteriaMissing: [],
        };
      }

      if (diff <= tolerance && !unitMatches && key.partialCredit) {
        const partial = Math.round(key.marks * 0.5 * 100) / 100;
        return {
          questionId: key.questionId,
          awardedMarks: partial,
          maxMarks: key.marks,
          markingSource: "AUTO_OBJECTIVE",
          explanation: `Numerical value matches, but expected unit '${key.expectedUnit}'. Partial credit applied.`,
          criteriaSatisfied: ["Numerical value"],
          criteriaMissing: [`Expected unit: ${key.expectedUnit}`],
        };
      }
    }
  }

  // Matching / multi-part partial credit
  if (key.questionType === "MATCHING" && key.partialCredit && key.acceptedAnswers.length > 1) {
    const studentParts = responseStr.split(",").map((s) => normalizeAnswer(s, Boolean(key.caseSensitive)));
    const expectedParts = key.acceptedAnswers.map((s) => normalizeAnswer(s, Boolean(key.caseSensitive)));
    let hits = 0;
    for (let i = 0; i < expectedParts.length; i += 1) {
      if (studentParts[i] === expectedParts[i]) hits += 1;
    }
    const score = Math.round((hits / expectedParts.length) * key.marks * 100) / 100;
    return {
      questionId: key.questionId,
      awardedMarks: score,
      maxMarks: key.marks,
      markingSource: "AUTO_OBJECTIVE",
      explanation: `Matched ${hits} of ${expectedParts.length} items.`,
      criteriaSatisfied: hits > 0 ? [`${hits}/${expectedParts.length} correct`] : [],
      criteriaMissing: hits < expectedParts.length ? [`${expectedParts.length - hits} mismatch(es)`] : [],
    };
  }

  // Standard exact / multi-accepted answer matching (MCQ, TRUE_FALSE, SHORT_ANSWER, FILL_GAP)
  const normalizedStudent = normalizeAnswer(responseStr, Boolean(key.caseSensitive));
  const accepted = key.acceptedAnswers.map((ans) => normalizeAnswer(ans, Boolean(key.caseSensitive)));

  if (accepted.includes(normalizedStudent)) {
    return {
      questionId: key.questionId,
      awardedMarks: key.marks,
      maxMarks: key.marks,
      markingSource: "AUTO_OBJECTIVE",
      explanation: "Matches accepted answer key.",
      criteriaSatisfied: ["Correct answer"],
      criteriaMissing: [],
    };
  }

  const penalty = key.negativeMarks > 0 ? -Math.abs(key.negativeMarks) : 0;
  return {
    questionId: key.questionId,
    awardedMarks: penalty,
    maxMarks: key.marks,
    markingSource: "AUTO_OBJECTIVE",
    explanation:
      penalty < 0
        ? `Incorrect answer (${penalty} negative marking applied).`
        : "Does not match accepted answer key.",
    criteriaSatisfied: [],
    criteriaMissing: ["Expected accepted answer"],
  };
}

export function gradeObjectiveSubmission(
  keys: ObjectiveQuestionKey[],
  answers: Record<string, unknown>,
): { totalAutoScore: number; results: QuestionGradingOutcome[]; hasSubjective: boolean } {
  const results = keys.map((key) => gradeObjectiveQuestion(key, answers[key.questionId]));
  const totalAutoScore = Math.max(
    0,
    Math.round(results.reduce((sum, r) => sum + r.awardedMarks, 0) * 100) / 100,
  );
  const hasSubjective = results.some((r) => r.markingSource === "MANUAL");
  return { totalAutoScore, results, hasSubjective };
}

export function computeLetterGrade(
  scorePercent: number,
  scale: Array<{ grade: string; min: number; max: number }>,
): string {
  for (const band of scale) {
    if (scorePercent >= band.min && scorePercent <= band.max) {
      return band.grade;
    }
  }
  return scorePercent >= 70 ? "A" : scorePercent >= 60 ? "B" : scorePercent >= 50 ? "C" : scorePercent >= 45 ? "D" : scorePercent >= 40 ? "E" : "F";
}
