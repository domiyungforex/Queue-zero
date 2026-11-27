import { inflateRawSync } from "node:zlib";
import type { AssignmentCategory, QuestionType } from "./types";

export interface ExtractedQuestion {
  questionType: QuestionType;
  prompt: string;
  options: string[];
  marks: number;
  formulaLatex: string;
  uncertain: boolean;
}

export interface SmartAssignmentExtraction {
  title: string;
  matchedCourseId: string | null;
  matchedCourseCode: string | null;
  category: AssignmentCategory;
  instructions: string;
  learningObjectives: string;
  dueAt: string | null;
  questions: ExtractedQuestion[];
  totalMarks: number | null;
  missingFields: string[];
  warnings: string[];
  fieldSources: Record<string, "EXTRACTED" | "SUGGESTED" | "INSTITUTIONAL" | "MISSING">;
}

/** Minimal zero-dependency DOCX XML text extractor using Node's native zlib. */
export function extractTextFromDocxBuffer(buffer: Buffer): string {
  try {
    // Locate local file entries (PK\x03\x04) and extract word/document.xml
    let offset = 0;
    while (offset + 30 < buffer.length) {
      if (buffer.readUInt32LE(offset) !== 0x04034b50) {
        offset += 1;
        continue;
      }
      const compression = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const fileNameLen = buffer.readUInt16LE(offset + 26);
      const extraLen = buffer.readUInt16LE(offset + 28);
      const nameStart = offset + 30;
      const nameEnd = nameStart + fileNameLen;
      const fileName = buffer.toString("utf8", nameStart, nameEnd);
      const dataStart = nameEnd + extraLen;
      const dataEnd = dataStart + compressedSize;

      if (fileName === "word/document.xml" && compressedSize > 0 && dataEnd <= buffer.length) {
        const rawData = buffer.subarray(dataStart, dataEnd);
        const xmlBuf = compression === 8 ? inflateRawSync(rawData) : rawData;
        const xml = xmlBuf.toString("utf8");
        return xml
          .replace(/<\/w:p>/g, "\n")
          .replace(/<[^>]+>/g, "")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
      offset = Math.max(offset + 4, dataEnd);
    }
  } catch {
    // Fall back to empty string if malformed DOCX
  }
  return "";
}

function detectCategory(text: string): AssignmentCategory {
  const lower = text.toLowerCase();
  if (lower.includes("lab") || lower.includes("laboratory")) return "LAB_REPORT";
  if (lower.includes("practical")) return "PRACTICAL";
  if (lower.includes("essay")) return "ESSAY";
  if (lower.includes("research")) return "RESEARCH_PAPER";
  if (lower.includes("group project")) return "GROUP_PROJECT";
  if (lower.includes("continuous assessment") || /\bca\b/.test(lower)) return "CONTINUOUS_ASSESSMENT";
  if (lower.includes("exam")) return "EXAM";
  return "HOMEWORK";
}

function detectQuestionType(prompt: string, options: string[]): QuestionType {
  if (options.length >= 2) return "MCQ";
  const lower = prompt.toLowerCase();
  if (/\btrue\s*(or|\/)\s*false\b/.test(lower)) return "TRUE_FALSE";
  if (/[=^]|\\frac|\\sum|\bcalculate\b|\bsolve\b|\bequation\b/.test(lower)) return "MATH";
  if (/\bessay\b|\bdiscuss\b|\bexplain in detail\b|\banalyze\b/.test(lower)) return "ESSAY";
  return "SHORT_ANSWER";
}

export function parseAssignmentFromText(
  rawText: string,
  authorizedCourses: Array<{ id: string; code: string; title: string }>,
): SmartAssignmentExtraction {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const upperText = rawText.toUpperCase();
  const matchedCourse =
    authorizedCourses.find(
      (c) =>
        upperText.includes(c.code.toUpperCase()) ||
        upperText.includes(c.title.toUpperCase()),
    ) ?? null;

  const title = lines[0]?.slice(0, 180) || "";
  const category = detectCategory(rawText);

  const questions: ExtractedQuestion[] = [];
  let currentPrompt = "";
  let currentOptions: string[] = [];
  let currentMarks = 10;

  const flush = () => {
    if (!currentPrompt.trim()) return;
    const qType = detectQuestionType(currentPrompt, currentOptions);
    questions.push({
      questionType: qType,
      prompt: currentPrompt.trim(),
      options: currentOptions,
      marks: currentMarks,
      formulaLatex: qType === "MATH" ? currentPrompt.trim() : "",
      uncertain: currentPrompt.trim().length < 8,
    });
    currentPrompt = "";
    currentOptions = [];
    currentMarks = 10;
  };

  for (const line of lines.slice(1)) {
    const qMatch = /^(?:Q(?:uestion)?\s*)?(\d+)[.)]\s+(.+)$/i.exec(line);
    const optMatch = /^[A-D][.)]\s+(.+)$/.exec(line);
    const marksMatch = /\[(\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\]|\((\d+(?:\.\d+)?)\s*(?:marks?|pts?|points?)\)/i.exec(line);

    if (qMatch) {
      flush();
      currentPrompt = qMatch[2];
      if (marksMatch) {
        currentMarks = Number(marksMatch[1] ?? marksMatch[2] ?? 10);
      }
    } else if (optMatch && currentPrompt) {
      currentOptions.push(optMatch[1].trim());
    } else if (currentPrompt) {
      currentPrompt += ` ${line}`;
      if (marksMatch) {
        currentMarks = Number(marksMatch[1] ?? marksMatch[2] ?? currentMarks);
      }
    }
  }
  flush();

  if (questions.length === 0 && rawText.trim().length > 0) {
    questions.push({
      questionType: detectQuestionType(rawText, []),
      prompt: rawText.trim().slice(0, 2000),
      options: [],
      marks: 10,
      formulaLatex: "",
      uncertain: true,
    });
  }

  const totalMarks =
    questions.length > 0 ? questions.reduce((sum, q) => sum + q.marks, 0) : null;

  const missingFields: string[] = [];
  const warnings: string[] = [];

  if (!matchedCourse) missingFields.push("Course (no authorized course code matched automatically)");
  missingFields.push("Submission deadline (never invented automatically — please set)");
  if (questions.some((q) => q.uncertain)) {
    warnings.push("Some extracted questions are short or uncertain; please review before publishing.");
  }

  return {
    title,
    matchedCourseId: matchedCourse?.id ?? null,
    matchedCourseCode: matchedCourse?.code ?? null,
    category,
    instructions: lines.slice(1, 3).join(" ").slice(0, 600),
    learningObjectives: "",
    dueAt: null,
    questions,
    totalMarks,
    missingFields,
    warnings,
    fieldSources: {
      title: title ? "EXTRACTED" : "MISSING",
      course: matchedCourse ? "INSTITUTIONAL" : "MISSING",
      category: "SUGGESTED",
      dueAt: "MISSING",
      questions: questions.length > 0 ? "EXTRACTED" : "MISSING",
    },
  };
}
